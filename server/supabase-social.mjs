import {randomUUID} from 'node:crypto';
import {createSocial,restoreSocial,serializeSocial,syncSocial,advanceSocial,invite,pauseSocial} from '../src/social-engine.ts';
import {createSocialDialogue,dialogueContext} from './social-dialogue.mjs';
import {unwrap} from './supabase-client.mjs';
import {HttpError,readJson,sendJson} from './auth.mjs';

// Single in-memory simulation per owner, guarded by a Postgres lease across instances.
// Cloud writes are batched; no animation frames or bubble positions are written individually.
export function createSupabaseSocial(admin,{apiKey,model,clock=Date.now,autoTick=true,generateDialogue}={}) {
  const worlds=new Map(),loading=new Map(),lease=randomUUID(),requests=new Map();let closed=false;
  const generate=generateDialogue||createSocialDialogue({apiKey,model});
  const aiAvailable=!!apiKey||!!generateDialogue;
  const fishFor=async id=>unwrap(await admin.from('pond_fish').select('data').eq('user_id',id).order('created_at')).map(r=>r.data);
  async function persist(id,e){
    const pending=e.pending.splice(0),state=JSON.parse(serializeSocial(e.s));
    try{
      const saved=unwrap(await admin.rpc('pond_save_world',{p_user:id,p_lease:lease,p_revision:e.revision,p_state:state,p_events:pending}));
      e.revision=saved.revision;e.saved=clock();e.events=[...pending.reverse(),...e.events].filter((v,i,arr)=>arr.findIndex(a=>a.id===v.id)===i).slice(0,200);
    }catch(error){worlds.delete(id);throw error;}
  }
  function exclusive(e,work){const task=(e.queue||Promise.resolve()).catch(()=>{}).then(work);e.queue=task;return task;}
  async function get(id){
    if(worlds.has(id))return worlds.get(id);
    if(loading.has(id))return loading.get(id);
    const task=(async()=>{
      const fish=await fishFor(id),fresh=createSocial(fish);fresh.scope='personal-v1';
      const saved=unwrap(await admin.rpc('pond_claim_world',{p_user:id,p_lease:lease,p_initial:JSON.parse(serializeSocial(fresh))}));
      const s=restoreSocial(JSON.stringify(saved.state),fish);s.scope='personal-v1';
      const enabled=s.enabled,pending=s.activity?pauseSocial(s,clock(),'服务恢复后，未完成的互动已结束，关系没有变化。'):[];s.enabled=enabled;
      const rows=unwrap(await admin.from('pond_events').select('data').eq('user_id',id).order('at',{ascending:false}).order('event_id',{ascending:false}).limit(200));
      const archive=unwrap(await admin.from('pond_demo_archive').select('data').eq('user_id',id).maybeSingle());
      const e={s,fish,events:rows.map(r=>r.data),pending,revision:saved.revision,saved:clock(),lastSeen:clock(),lastTick:clock(),busy:false,archiveCount:archive?.data?.events?.length||0};
      await persist(id,e);worlds.set(id,e);return e;
    })();loading.set(id,task);try{return await task;}finally{loading.delete(id);}
  }
  function prepare(id,e){
    const a=e.s.activity,now=clock();
    if(!aiAvailable||e.s.aiEnabled===false||!a||a.kind==='company'||a.phase!=='approaching'||a.aiRequested||requests.size>=2||now-(e.lastAi||0)<90000)return;
    a.aiRequested=true;e.lastAi=now;const controller=new AbortController();requests.set(a.id,controller);
    void (async()=>{
      if(!unwrap(await admin.rpc('pond_use_ai',{p_user:id,p_kind:'social',p_limit:30})))return;
      const memories=e.events.filter(ev=>ev.status==='completed'&&a.members.every(m=>ev.members.includes(m)));
      const result=await generate(dialogueContext(a.members.map(m=>e.fish.find(f=>f.id===m)||{}),a.kind,memories),controller.signal);
      if(!closed&&worlds.get(id)===e&&e.s.aiEnabled!==false&&e.s.activity===a&&a.phase==='approaching'&&!controller.signal.aborted)a.prepared=result;
    })().catch(()=>{}).finally(()=>requests.delete(a.id));
  }
  function tick(){
    if(closed)return;
    const now=clock();
    for(const [id,e] of worlds){
      if(e.busy)continue;e.busy=true;
      void exclusive(e,async()=>{
        if(worlds.get(id)!==e)return;
        const dt=Math.min(.5,Math.max(0,(now-e.lastTick)/1000));e.lastTick=now;
        if(now-e.lastSeen<=2500){e.pending.push(...advanceSocial(e.s,dt,now));prepare(id,e);}
        if(e.pending.length||now-e.saved>=10000)await persist(id,e);
        if(now-e.lastSeen>60000)worlds.delete(id);
      }).catch(()=>{worlds.delete(id);console.error('Supabase social storage failed; simulation paused.');}).finally(()=>{e.busy=false;});
    }
  }
  const timer=autoTick?setInterval(tick,100):null;timer?.unref();
  function snapshot(e){return {time:e.s.world.time,revision:e.s.revision,enabled:e.s.enabled,aiEnabled:e.s.aiEnabled!==false,aiAvailable,archiveCount:e.archiveCount,fish:e.fish,
    activity:e.s.activity?{...e.s.activity,prepared:undefined}:null,relationships:Object.values(e.s.relationships),events:e.events,
    poses:e.s.world.fish.map(f=>({id:f.id,x:f.x,y:f.y,heading:f.heading,pitch:f.pitch,cruise:f.cruise,effort:f.effort,stroke:f.stroke,width:f.width,height:f.height,speed:f.speed,angularVelocity:f.angularVelocity,mode:f.mode}))};}
  return {
    async refreshRoster(id){const e=worlds.get(id);if(!e)return;await exclusive(e,async()=>{e.fish=await fishFor(id);e.pending.push(...syncSocial(e.s,e.fish,clock()));await persist(id,e);});},
    async route(req,res,path,user){
      if(!path.startsWith('/api/social/'))return false;
      if(path==='/api/social/archive'&&req.method==='GET'){
        const offset=Number(new URL(req.url,'http://localhost').searchParams.get('offset')||0);
        if(!Number.isSafeInteger(offset)||offset<0)throw new HttpError(422,'页码不正确。');
        const row=unwrap(await admin.from('pond_demo_archive').select('data,archived_at').eq('user_id',user.id).maybeSingle());
        sendJson(res,200,{events:row?.data?.events?.slice(offset,offset+50)||[],fish:row?.data?.world?.fish||[],total:row?.data?.events?.length||0,archivedAt:row?.archived_at||null});return true;
      }
      const e=await get(user.id);
      if(path==='/api/social/snapshot'&&req.method==='GET'){sendJson(res,200,snapshot(e));return true;}
      if(req.method!=='POST')throw new HttpError(405,'不支持的操作。');
      const body=await readJson(req,4096);
      if(path==='/api/social/pulse'){e.lastSeen=clock();sendJson(res,200,snapshot(e));return true;}
      await exclusive(e,async()=>{
        if(path==='/api/social/invite'){
          const error=invite(e.s,body.from,body.to,body.kind,clock());if(error)throw new HttpError(409,error);
        }else if(path==='/api/social/settings'){
          if(typeof body.enabled!=='boolean'&&typeof body.aiEnabled!=='boolean')throw new HttpError(422,'设置格式不正确。');
          if(body.enabled===false)e.pending.push(...pauseSocial(e.s,clock()));
          if(typeof body.enabled==='boolean')e.s.enabled=body.enabled;
          if(typeof body.aiEnabled==='boolean'){e.s.aiEnabled=body.aiEnabled;if(!body.aiEnabled&&e.s.activity){requests.get(e.s.activity.id)?.abort();delete e.s.activity.prepared;}}
          e.s.revision++;
        }else throw new HttpError(404,'社交接口不存在。');
        e.lastSeen=clock();await persist(user.id,e);
      });sendJson(res,200,snapshot(e));return true;
    },
    async close(){closed=true;if(timer)clearInterval(timer);for(const c of requests.values())c.abort();await Promise.allSettled([...worlds].map(([id,e])=>exclusive(e,()=>persist(id,e))));await admin.from('pond_worlds').update({lease_id:null,lease_until:null}).eq('lease_id',lease);worlds.clear();}
  };
}
