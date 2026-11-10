import test from 'node:test';
import assert from 'node:assert/strict';
import {createSocialDialogue,dialogueContext,parseDialogue} from './social-dialogue.mjs';
import {createSocial,invite,advanceSocial} from '../src/social-engine.ts';
import {initialFish} from '../src/data.ts';

test('social prompts use bounded character facts, excluding raw interview/contact material',()=>{
  const context=dialogueContext([{role:'产品经理',traits:['好奇'],notes:'private notes',company:'private company',interview:{topics:'系统设计 https://private.example',feelings:'紧张',interviewer:'private contact',experience:'private experience',location:'private address'}}],'meet');
  const json=JSON.stringify(context);assert.ok(!json.includes('private'));assert.match(json,/系统设计/);assert.match(json,/紧张/);
  assert.throws(()=>parseDialogue('{"lines":[{"speaker":0,"text":"hello"}]}'));
  assert.throws(()=>parseDialogue('{"lines":[{"speaker":1,"text":"hello"},{"speaker":0,"text":"hello"}]}'));
  assert.throws(()=>parseDialogue('{"lines":[{"speaker":0,"text":"http://bad.test"},{"speaker":1,"text":"hello"}]}'));
});
test('ModelScope dialogue adapter validates two turns and propagates a bounded abort signal',async()=>{
  let sent;
  const generate=createSocialDialogue({apiKey:'test-only',timeoutMs:1000,fetchImpl:async(url,options)=>{sent={url,...options};return {ok:true,json:async()=>({choices:[{finish_reason:'stop',message:{content:'{"lines":[{"speaker":0,"text":"刚刚想到一个有趣的问题。"},{"speaker":1,"text":"边游边聊，我很愿意听。"}]}'}}]})};}});
  const result=await generate(dialogueContext(initialFish.slice(0,2),'swim'));assert.equal(result.lines.length,2);assert.ok(sent.signal instanceof AbortSignal);assert.match(sent.url,/modelscope.cn/);assert.equal(JSON.parse(sent.body).stream,false);
  await assert.rejects(createSocialDialogue({apiKey:'test',fetchImpl:async()=>({ok:false,status:429})})({}));
});
test('prepared AI dialogue is only recorded when physically spoken, without granting extra scores',()=>{
  const s=createSocial(initialFish.slice(0,2),42);s.nextDecision=1e9;s.world.fish.forEach((f,i)=>Object.assign(f,{x:550+i*210,y:360,targetX:550+i*210,targetY:360,heading:i?Math.PI:0,energy:1,social:1}));
  invite(s,'bai','lan','meet');s.activity.prepared={lines:['我喜欢从小问题开始理解事情。','那我们一起慢慢观察吧。'],model:'test-model'};
  const events=[];for(let i=0;i<600;i++)events.push(...advanceSocial(s,.1,1762617600000+i*100));
  assert.equal(events[0].status,'completed');assert.equal(events[0].dialogue.filter(d=>d.source==='ai').length,2);assert.equal(events[0].changes[0].familiar,2);assert.equal(s.relationships['["bai","lan"]'].trust,0);
});
