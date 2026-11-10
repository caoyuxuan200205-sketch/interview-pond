import { initialFish } from '../src/data.ts';
import {createSocial,restoreSocial,serializeSocial,syncSocial,advanceSocial,invite,pauseSocial} from '../src/social-engine.ts';
import {HttpError,readJson,sendJson} from './auth.mjs';
import {createSocialDialogue,dialogueContext} from './social-dialogue.mjs';

export function createSocialService(db,auth,{clock=Date.now,autoTick=true,apiKey='',model,generateDialogue}={}) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS social_worlds(owner_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,state_json TEXT NOT NULL,updated_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS social_fish(owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,fish_id TEXT NOT NULL,sprite INTEGER NOT NULL,skin INTEGER,PRIMARY KEY(owner_id,fish_id));
    CREATE TABLE IF NOT EXISTS social_events(owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,event_id TEXT NOT NULL,at INTEGER NOT NULL,event_json TEXT NOT NULL,PRIMARY KEY(owner_id,event_id));
    CREATE INDEX IF NOT EXISTS social_events_recent ON social_events(owner_id,at DESC);
    CREATE TABLE IF NOT EXISTS social_relationships(owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,from_id TEXT NOT NULL,to_id TEXT NOT NULL,relation_json TEXT NOT NULL,PRIMARY KEY(owner_id,from_id,to_id));
    CREATE TABLE IF NOT EXISTS social_memories(owner_id TEXT NOT NULL,fish_id TEXT NOT NULL,event_id TEXT NOT NULL,PRIMARY KEY(owner_id,fish_id,event_id),FOREIGN KEY(owner_id,event_id) REFERENCES social_events(owner_id,event_id) ON DELETE CASCADE);
    CREATE TABLE IF NOT EXISTS social_demo_archive(owner_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,archive_json TEXT NOT NULL,event_count INTEGER NOT NULL,archived_at INTEGER NOT NULL);
    PRAGMA user_version=3;
  `);
  const worlds=new Map(),requests=new Map();let closed=false;
  const aiAvailable=!!apiKey||!!generateDialogue;
  const generate=generateDialogue||createSocialDialogue({apiKey,model});
  const valid=f=>f&&typeof f.id==='string'&&f.id.length<100&&typeof f.name==='string'&&Number.isInteger(f.sprite)&&f.sprite>=0&&f.sprite<12&&Array.isArray(f.traits)&&f.traits.every(t=>typeof t==='string');
  const roster=userId=>{
    const row=db.prepare("SELECT value_json FROM pond_state WHERE user_id=? AND state_key='pond-fish-v1'").get(userId);
    const added=row?JSON.parse(row.value_json):[];
    return (Array.isArray(added)?added.filter(valid).filter(f=>!initialFish.some(i=>i.id===f.id)):[]).map(f=>({id:f.id,name:f.name,sprite:f.sprite,skin:f.skin,traits:f.traits}));
  };
  function validateFish(userId,value){
    if(!Array.isArray(value)||value.length>188||new Set(value.map(f=>f?.id)).size!==value.length)throw new HttpError(422,'鱼列表格式不正确或超过容量。');
    for(const f of value){
      if(!f||typeof f.id!=='string'||initialFish.some(i=>i.id===f.id))throw new HttpError(422,'角色身份不正确。');
      const prior=db.prepare('SELECT sprite,skin FROM social_fish WHERE owner_id=? AND fish_id=?').get(userId,f.id);
      if(prior&&(prior.sprite!==f.sprite||(prior.skin??null)!==(f.skin??null)))throw new HttpError(409,'这条鱼的出生外观已经固定，不能重新抽取。');
    }
  }
  function register(userId,fish){
    for(const f of fish)db.prepare('INSERT OR IGNORE INTO social_fish VALUES(?,?,?,?)').run(userId,f.id,f.sprite,f.skin??null);
  }
  function persist(userId,entry,events=[]){
    db.exec('BEGIN IMMEDIATE');
    try{
      register(userId,entry.s.fish);
      for(const event of events){
        const changed=db.prepare('INSERT OR IGNORE INTO social_events VALUES(?,?,?,?)').run(userId,event.id,event.at,JSON.stringify(event)).changes;
        if(changed&&event.status==='completed')for(const id of event.members)db.prepare('INSERT OR IGNORE INTO social_memories VALUES(?,?,?)').run(userId,id,event.id);
      }
      db.prepare('DELETE FROM social_relationships WHERE owner_id=?').run(userId);
      for(const r of Object.values(entry.s.relationships))db.prepare('INSERT INTO social_relationships VALUES(?,?,?,?)').run(userId,r.from,r.to,JSON.stringify(r));
      db.prepare('INSERT INTO social_worlds VALUES(?,?,?) ON CONFLICT(owner_id) DO UPDATE SET state_json=excluded.state_json,updated_at=excluded.updated_at').run(userId,serializeSocial(entry.s),clock());
      db.exec('COMMIT');entry.saved=clock();
    }catch(e){db.exec('ROLLBACK');worlds.delete(userId);throw e;}
  }
  function get(userId){
    let entry=worlds.get(userId);if(entry)return entry;
    const fish=roster(userId),row=db.prepare('SELECT state_json FROM social_worlds WHERE owner_id=?').get(userId);
    const s=row?restoreSocial(row.state_json,fish):createSocial(fish);
    if(row&&s.scope!=='personal-v1'){
      const demoIds=new Set(initialFish.map(f=>f.id));
      const events=db.prepare('SELECT event_json FROM social_events WHERE owner_id=? ORDER BY at DESC').all(userId).map(r=>JSON.parse(r.event_json)).filter(event=>event.members.some(id=>demoIds.has(id)));
      const archive={world:JSON.parse(row.state_json),events,relationships:Object.values(s.relationships).filter(r=>demoIds.has(r.from)||demoIds.has(r.to))};
      if(s.activity?.members.some(id=>demoIds.has(id)))s.activity=null;
      syncSocial(s,fish,clock());s.scope='personal-v1';
      db.exec('BEGIN IMMEDIATE');
      try{
        db.prepare('INSERT OR IGNORE INTO social_demo_archive VALUES(?,?,?,?)').run(userId,JSON.stringify(archive),events.length,clock());
        for(const event of events)db.prepare('DELETE FROM social_events WHERE owner_id=? AND event_id=?').run(userId,event.id);
        for(const id of demoIds)db.prepare('DELETE FROM social_relationships WHERE owner_id=? AND (from_id=? OR to_id=?)').run(userId,id,id);
        db.prepare('UPDATE social_worlds SET state_json=?,updated_at=? WHERE owner_id=?').run(serializeSocial(s),clock(),userId);
        db.exec('COMMIT');
      }catch(error){db.exec('ROLLBACK');throw error;}
    }
    s.scope='personal-v1';
    // A process restart cannot retroactively claim a pending encounter completed.
    const interrupted=s.activity?pauseSocial(s,clock(),'服务恢复后，本次未完成的活动已安全结束，关系没有变化。'):[];if(row)s.enabled=JSON.parse(row.state_json).enabled;
    entry={s,lastSeen:0,saved:clock()};worlds.set(userId,entry);persist(userId,entry,interrupted);return entry;
  }
  function refreshRoster(userId){const e=worlds.get(userId);if(!e)return;const events=syncSocial(e.s,roster(userId),clock());persist(userId,e,events);}
  function prepareDialogue(id,e){
    const a=e.s.activity,now=clock(),day=new Date(now+8*3600000).toISOString().slice(0,10);
    if(!aiAvailable||e.s.aiEnabled===false||!a||a.phase!=='approaching'||a.kind==='company'||a.aiRequested||requests.size>=2)return;
    const budget=e.s.aiBudget;
    if(budget&&(now-budget.last<90000||budget.day===day&&budget.count>=30))return;
    a.aiRequested=true;e.s.aiBudget={day,count:(budget?.day===day?budget.count:0)+1,last:now};
    // Reserve before the request so restarts and multiple tabs cannot spend twice.
    persist(id,e);
    const row=db.prepare("SELECT value_json FROM pond_state WHERE user_id=? AND state_key='pond-fish-v1'").get(id);
    const added=row?JSON.parse(row.value_json):[];
    const fish=a.members.map(member=>(Array.isArray(added)?added:[]).find(f=>f.id===member)||{});
    const memories=db.prepare('SELECT event_json FROM social_events WHERE owner_id=? ORDER BY at DESC LIMIT 200').all(id).map(r=>JSON.parse(r.event_json)).filter(event=>event.status==='completed'&&a.members.every(member=>event.members.includes(member)));
    const controller=new AbortController();requests.set(a.id,controller);
    void generate(dialogueContext(fish,a.kind,memories),controller.signal).then(result=>{
      // Never replace executed lines or attach a late response to another encounter.
      if(closed||worlds.get(id)!==e||e.s.aiEnabled===false||e.s.activity?.id!==a.id||a.phase!=='approaching'||controller.signal.aborted)return;
      a.prepared=result;persist(id,e);
    }).catch(()=>{/* Rule dialogue keeps the encounter moving on errors/timeouts. */}).finally(()=>requests.delete(a.id));
  }
  function snapshot(userId,e){
    const activity=e.s.activity?{...e.s.activity,prepared:undefined}:null;
    return {time:e.s.world.time,revision:e.s.revision,enabled:e.s.enabled,aiEnabled:e.s.aiEnabled!==false,aiAvailable,archiveCount:db.prepare('SELECT event_count FROM social_demo_archive WHERE owner_id=?').get(userId)?.event_count||0,fish:e.s.fish,activity,
      poses:e.s.world.fish.map(f=>({id:f.id,x:f.x,y:f.y,heading:f.heading,pitch:f.pitch,cruise:f.cruise,effort:f.effort,stroke:f.stroke,width:f.width,height:f.height,speed:f.speed,angularVelocity:f.angularVelocity,mode:f.mode})),
      relationships:Object.values(e.s.relationships),events:db.prepare('SELECT event_json FROM social_events WHERE owner_id=? ORDER BY at DESC,event_id DESC LIMIT 200').all(userId).map(r=>JSON.parse(r.event_json))};
  }
  function tick(dt=.1){
    const now=clock();
    for(const [id,e] of worlds){
      try{
        if(now-e.lastSeen>2500){if(now-e.saved>1500)persist(id,e);if(now-e.lastSeen>60000)worlds.delete(id);continue;}
        const events=advanceSocial(e.s,dt,now);if(events.length||now-e.saved>=1500)persist(id,e,events);prepareDialogue(id,e);
      }catch{worlds.delete(id);console.error('Social world paused after a storage/simulation error.');}
    }
  }
  const timer=autoTick?setInterval(()=>tick(),100):null;timer?.unref();
  return {validateFish,refreshRoster,tick,registerFish:(id,value)=>register(id,value.filter(valid)),
    async route(req,res,path){
      if(!path.startsWith('/api/social/'))return false;
      const user=auth.requireUser(req);const e=get(user.id);
      if(path==='/api/social/archive'&&req.method==='GET'){
        const row=db.prepare('SELECT archive_json,archived_at,event_count FROM social_demo_archive WHERE owner_id=?').get(user.id);
        const offset=Number(new URL(req.url,'http://localhost').searchParams.get('offset')||0);
        if(!Number.isSafeInteger(offset)||offset<0)throw new HttpError(422,'页码不正确。');
        const archived=row?JSON.parse(row.archive_json):null;
        sendJson(res,200,{events:archived?.events.slice(offset,offset+50)||[],fish:archived?.world.fish||[],total:row?.event_count||0,archivedAt:row?.archived_at||null});return true;
      }
      if(path==='/api/social/snapshot'&&req.method==='GET'){sendJson(res,200,snapshot(user.id,e));return true;}
      if(req.method!=='POST')throw new HttpError(405,'不支持的操作。');
      const body=await readJson(req,4096);
      if(path==='/api/social/pulse'){e.lastSeen=clock();sendJson(res,200,snapshot(user.id,e));return true;}
      if(path==='/api/social/invite'){
        const error=invite(e.s,body.from,body.to,body.kind,clock());if(error)throw new HttpError(409,error);
        e.lastSeen=clock();persist(user.id,e);sendJson(res,200,snapshot(user.id,e));return true;
      }
      if(path==='/api/social/settings'){
        if(typeof body.enabled!=='boolean'&&typeof body.aiEnabled!=='boolean')throw new HttpError(422,'设置格式不正确。');
        const events=body.enabled===false?pauseSocial(e.s,clock()):[];
        if(typeof body.enabled==='boolean')e.s.enabled=body.enabled;
        if(typeof body.aiEnabled==='boolean'){
          e.s.aiEnabled=body.aiEnabled;
          if(!body.aiEnabled&&e.s.activity){requests.get(e.s.activity.id)?.abort();if(e.s.activity.phase==='approaching')delete e.s.activity.prepared;}
        }
        e.s.revision++;persist(user.id,e,events);sendJson(res,200,snapshot(user.id,e));return true;
      }
      throw new HttpError(404,'社交接口不存在。');
    },
    close(){closed=true;if(timer)clearInterval(timer);for(const controller of requests.values())controller.abort();for(const [id,e]of worlds)persist(id,e);worlds.clear();}
  };
}
