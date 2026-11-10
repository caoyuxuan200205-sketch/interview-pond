import {initialFish} from '../src/data.ts';
import {createSocial,serializeSocial} from '../src/social-engine.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { request as httpRequest } from 'node:http';
import { createApplication } from './app.mjs';
const origin='http://localhost:5173';
const password='TestOnly-Fish-Pond-2026!';
async function boot(file,options={}) {
  const app=createApplication({databaseFile:file,origins:[origin],...options});
  app.server.listen(0,'127.0.0.1');await once(app.server,'listening');
  const base=`http://127.0.0.1:${app.server.address().port}`;
  async function call(path,{method='GET',cookie='',body,headers={}}={}) {
    return new Promise((resolve,reject)=>{
      const req=httpRequest(base+path,{method,headers:{Host:'localhost:5173',Origin:origin,'X-Pond-Request':'1','Content-Type':'application/json',Cookie:cookie,...headers}},res=>{
        const chunks=[];res.on('data',chunk=>chunks.push(chunk));res.on('end',()=>{
          const setCookie=res.headers['set-cookie']?.[0]||'';
          try{resolve({status:res.statusCode,body:JSON.parse(Buffer.concat(chunks)),cookie:setCookie.split(';')[0],setCookie});}catch(e){reject(e);}
        });
      });req.on('error',reject);req.setTimeout(10000,()=>req.destroy(new Error('test request timeout')));req.end(body===undefined?undefined:JSON.stringify(body));
    });
  }
  return {...app,call};
}

async function seedPersonal(app,account){
 const fish=initialFish.map((f,i)=>({...f,id:'personal-'+i}));
 const result=await app.call('/api/pond/state/pond-fish-v1',{method:'PUT',cookie:account.cookie,headers:{'X-Pond-User':account.body.user.id},body:{revision:0,value:fish}});
 assert.equal(result.status,200);return fish;
}

test('social worlds persist, isolate accounts and share one clock across tabs',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'pond-social-'));const file=join(directory,'social.sqlite');let now=1762617600000;
 let app=await boot(file,{socialOptions:{autoTick:false,clock:()=>now}});
 try{
  assert.equal((await app.call('/api/social/pulse',{method:'POST',body:{}})).status,401);
  const a=await app.call('/api/auth/register',{method:'POST',body:{name:'甲',email:'social-a@example.test',password}});
  const b=await app.call('/api/auth/register',{method:'POST',body:{name:'乙',email:'social-b@example.test',password}});
  assert.equal((await app.call('/api/social/snapshot',{cookie:a.cookie})).body.fish.length,0);
  await seedPersonal(app,a);
  const pulse=()=>app.call('/api/social/pulse',{method:'POST',cookie:a.cookie,body:{}});
  const first=await pulse(),tab2=await pulse();assert.equal(first.body.time,tab2.body.time);assert.equal(first.body.events.length,0);
  let result=first;
  for(let i=0;i<1800;i++){now+=100;app.social.tick(.1);if(i%10===0)result=await pulse();}
  result=await pulse();assert.ok(result.body.events.some(e=>e.status==='completed'));assert.ok(result.body.relationships.length>0);
  const other=await app.call('/api/social/snapshot',{cookie:b.cookie});assert.equal(other.body.events.length,0);assert.equal(other.body.relationships.length,0);
  const relations=result.body.relationships,events=result.body.events;const time=result.body.time;
  now+=60000;app.social.tick(.1);assert.equal((await app.call('/api/social/snapshot',{cookie:a.cookie})).body.time,time,'inactive world does not catch up');
  await app.close();app=await boot(file,{socialOptions:{autoTick:false,clock:()=>now}});
  const restored=await app.call('/api/social/snapshot',{cookie:a.cookie});assert.deepEqual(restored.body.relationships,relations);for(const event of events)assert.ok(restored.body.events.some(e=>e.id===event.id));
  assert.equal((await app.call('/api/social/settle',{method:'POST',cookie:a.cookie,body:{trust:100}})).status,404);
  const ids=restored.body.events.map(e=>e.id);assert.equal(new Set(ids).size,ids.length);
 }finally{await app.close();await rm(directory,{recursive:true,force:true});}
});
test('new fish join the account roster and registered appearance cannot be overwritten',async()=>{
 const app=await boot(':memory:',{socialOptions:{autoTick:false}});
 try{
  const a=await app.call('/api/auth/register',{method:'POST',body:{name:'甲',email:'new-fish@example.test',password}}),cookie=a.cookie,headers={'X-Pond-User':a.body.user.id};
  const fish={id:'created-test',name:'新伙伴',sprite:8,skin:3,traits:['好奇'],role:'产品经理'};
  assert.equal((await app.call('/api/pond/state/pond-fish-v1',{method:'PUT',cookie,headers,body:{revision:0,value:[fish]}})).status,200);
  const world=await app.call('/api/social/snapshot',{cookie});assert.ok(world.body.fish.some(f=>f.id===fish.id));assert.equal(world.body.relationships.length,0);
  assert.equal((await app.call('/api/pond/state/pond-fish-v1',{method:'PUT',cookie,headers,body:{revision:1,value:[{...fish,skin:4}]}})).status,409);
  assert.equal((await app.call('/api/social/invite',{method:'POST',cookie,body:{from:fish.id,to:'another-user-fish',kind:'meet'}})).status,409);
  assert.equal((await app.call('/api/social/settings',{method:'POST',cookie,body:{enabled:false}})).body.enabled,false);
 }finally{await app.close();}
});

test('AI preparation is single-flight, hidden until spoken, and late responses cannot rewrite history',async()=>{
 let now=1762617600000,calls=0,finish;
 const app=await boot(':memory:',{socialOptions:{autoTick:false,clock:()=>now,generateDialogue:()=>{calls++;return new Promise(resolve=>{finish=resolve;});}}});
 try{
  const account=await app.call('/api/auth/register',{method:'POST',body:{name:'对白测试',email:'dialogue@example.test',password}});
  await seedPersonal(app,account);
  const pulse=()=>app.call('/api/social/pulse',{method:'POST',cookie:account.cookie,body:{}});
  await pulse();
  for(let i=0;i<2000&&!calls;i++){now+=100;app.social.tick(.1);if(i%10===0)await pulse();}
  assert.equal(calls,1);const pending=await pulse();assert.equal(pending.body.activity.prepared,undefined);
  for(let i=0;i<10;i++){now+=100;app.social.tick(.1);await pulse();}assert.equal(calls,1);
  const paused=await app.call('/api/social/settings',{method:'POST',cookie:account.cookie,body:{enabled:false}});assert.equal(paused.body.activity,null);
  finish({lines:['这句话已经迟到了。','这句话不应该出现在记录中。'],model:'test'});await new Promise(resolve=>setImmediate(resolve));
  const after=await pulse();assert.equal(after.body.activity,null);assert.ok(after.body.events.every(e=>e.dialogue.every(line=>line.source!=='ai')));
  const off=await app.call('/api/social/settings',{method:'POST',cookie:account.cookie,body:{aiEnabled:false}});assert.equal(off.body.aiEnabled,false);
 }finally{await app.close();}
});

test('legacy demo history is archived once without losing personal fish, events or relationships',async()=>{
 const app=await boot(':memory:',{socialOptions:{autoTick:false}});
 try{
  const account=await app.call('/api/auth/register',{method:'POST',body:{name:'旧塘主',email:'legacy@example.test',password}}),id=account.body.user.id;
  const personal=await seedPersonal(app,account),legacy=createSocial([...initialFish,...personal],42);
  const relation=(from,to,event)=>({from,to,familiar:2,closeness:0,trust:0,count:1,lastEvent:event,updatedAt:100});
  legacy.relationships={'["bai","personal-0"]':relation('bai','personal-0','demo-event'),'["personal-0","personal-1"]':relation('personal-0','personal-1','own-event')};
  app.db.prepare('INSERT INTO social_worlds VALUES(?,?,?)').run(id,serializeSocial(legacy),100);
  for(const [eventId,members] of [['demo-event',['bai','personal-0']],['own-event',['personal-0','personal-1']]]){
   const event={id:eventId,kind:'meet',members,status:'completed',title:eventId,summary:'历史验证',reason:'',at:100,duration:9,dialogue:[],changes:[]};
   app.db.prepare('INSERT INTO social_events VALUES(?,?,?,?)').run(id,eventId,100,JSON.stringify(event));
   for(const member of members)app.db.prepare('INSERT INTO social_memories VALUES(?,?,?)').run(id,member,eventId);
  }
  const before=(await app.call('/api/pond/state',{cookie:account.cookie})).body;
  const snapshot=(await app.call('/api/social/snapshot',{cookie:account.cookie})).body;
  assert.equal(snapshot.fish.length,personal.length);assert.ok(snapshot.fish.every(f=>f.id.startsWith('personal-')));
  assert.deepEqual(snapshot.events.map(e=>e.id),['own-event']);assert.equal(snapshot.relationships.length,1);assert.equal(snapshot.archiveCount,1);
  const archive=(await app.call('/api/social/archive',{cookie:account.cookie})).body;assert.deepEqual(archive.events.map(e=>e.id),['demo-event']);
  assert.deepEqual((await app.call('/api/pond/state',{cookie:account.cookie})).body,before);
  await app.call('/api/social/snapshot',{cookie:account.cookie});assert.equal(app.db.prepare('SELECT COUNT(*) AS n FROM social_demo_archive WHERE owner_id=?').get(id).n,1);
  assert.equal(app.db.prepare('SELECT COUNT(*) AS n FROM social_memories WHERE owner_id=? AND event_id=?').get(id,'own-event').n,2);
  const other=await app.call('/api/auth/register',{method:'POST',body:{name:'其他塘主',email:'archive-other@example.test',password}});
  assert.equal((await app.call('/api/social/archive',{cookie:other.cookie})).body.total,0);
 }finally{await app.close();}
});

test('new accounts start empty and tutorial progress is isolated, validated and revision protected',async()=>{
 const app=await boot(':memory:',{socialOptions:{autoTick:false}});
 try{
  const a=await app.call('/api/auth/register',{method:'POST',body:{name:'新塘主',email:'onboarding@example.test',password}}),cookie=a.cookie;
  const s=(await app.call('/api/social/snapshot',{cookie})).body;assert.deepEqual(s.fish,[]);assert.deepEqual(s.events,[]);assert.deepEqual(s.relationships,[]);
  const headers={'X-Pond-User':a.body.user.id},path='/api/pond/state/pond-onboarding-v1',value={version:1,status:'paused',step:'create'};
  assert.equal((await app.call(path,{method:'PUT',cookie,headers,body:{revision:0,value}})).status,200);
  assert.equal((await app.call(path,{method:'PUT',cookie,headers,body:{revision:0,value}})).status,409);
  assert.equal((await app.call(path,{method:'PUT',cookie,headers,body:{revision:1,value:{...value,step:'made-up'}}})).status,422);
  assert.deepEqual((await app.call('/api/pond/state',{cookie})).body.values['pond-onboarding-v1'],value);
  const b=await app.call('/api/auth/register',{method:'POST',body:{name:'另一个人',email:'onboarding-b@example.test',password}});
  assert.equal((await app.call('/api/pond/state',{cookie:b.cookie})).body.values['pond-onboarding-v1'],undefined);
  assert.equal((await app.call('/api/pond/state/pond-fish-v1',{method:'PUT',cookie,headers,body:{revision:0,value:[initialFish[0]]}})).status,422);
 }finally{await app.close();}
});
