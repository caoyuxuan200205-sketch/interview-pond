import test from 'node:test';
import assert from 'node:assert/strict';
import {createSocial,advanceSocial,invite,pauseSocial,serializeSocial,restoreSocial,syncSocial} from '../src/social-engine.ts';
import {initialFish} from '../src/data.ts';
const run=(s,seconds)=>{const events=[];for(let i=0;i<seconds*10;i++)events.push(...advanceSocial(s,.1,1762617600000+i*100));return events;};
function pairState(){const s=createSocial(initialFish.slice(0,2),42);s.nextDecision=1e9;s.world.fish.forEach((f,i)=>Object.assign(f,{x:550+i*210,y:360,targetX:550+i*210,targetY:360,heading:i?Math.PI:0,energy:1,social:1}));return s;}
test('real approach and completion create directional evidence; replay cannot settle again',()=>{
 const s=pairState();assert.equal(invite(s,'bai','lan','meet'),null);
 const events=run(s,60);assert.equal(events.length,1);assert.equal(events[0].status,'completed');assert.ok(events[0].duration>=9);assert.equal(Object.keys(s.relationships).length,2);assert.equal(s.relationships['["bai","lan"]'].count,1);
 s.nextDecision=1e9;run(s,30);assert.equal(s.relationships['["bai","lan"]'].count,1);
});
test('declining, pausing and deleting a participant never invent relationship gains',()=>{
 const s=pairState();s.world.fish[1].energy=.1;invite(s,'bai','lan','meet');const declined=run(s,3);assert.equal(declined[0].status,'declined');assert.equal(Object.keys(s.relationships).length,0);
 const other=pairState();invite(other,'bai','lan','company');assert.match(invite(other,'lan','bai','swim'),/正在互动/);assert.equal(pauseSocial(other)[0].status,'interrupted');assert.equal(Object.keys(other.relationships).length,0);
 const removed=pairState();invite(removed,'bai','lan','meet');assert.equal(syncSocial(removed,[initialFish[0]])[0].status,'interrupted');assert.equal(removed.activity,null);
});
test('blocked encounters time out; being invited does not imply completion',()=>{
 const s=pairState();invite(s,'bai','lan','meet');s.activity.slots=[{x:1300,y:250},{x:1400,y:250}];const events=run(s,50);assert.equal(events[0].status,'interrupted');assert.equal(Object.keys(s.relationships).length,0);
});
test('same job and skin do not control social choices; state survives serialization',()=>{
 const s=createSocial(initialFish,77);const events=run(s,120);assert.ok(events.some(e=>e.status==='completed'));const saved=serializeSocial(s),restored=restoreSocial(saved,initialFish);assert.deepEqual(restored.relationships,s.relationships);assert.equal(restored.world.time,s.world.time);assert.equal(restored.seed,s.seed);assert.ok(Number.isFinite(restored.world.random()));
 const empty=createSocial([],1);assert.deepEqual(run(empty,30),[]);const solo=createSocial([initialFish[0]],1);assert.deepEqual(run(solo,30),[]);
});
test('swimming and quiet company require accepted physical time and do not claim trust',()=>{
 for(const kind of ['swim','company']){const s=pairState();invite(s,'bai','lan',kind);const events=run(s,65);assert.equal(events[0].status,'completed',kind);assert.ok(events[0].duration>=16);assert.equal(s.relationships['["bai","lan"]'].trust,0);assert.notEqual(events[0].changes[0].closeness,events[0].changes[1].closeness);}
});
