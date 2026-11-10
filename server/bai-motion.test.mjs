import test from 'node:test';
import assert from 'node:assert/strict';
import {followAngle,poseToYaw,headingToYaw,angleDifference} from '../src/bai-motion.ts';

test('continuous turning follows the same path at different frame rates without overshoot',()=>{
  const results=[];
  for(const fps of [30,60,120]){
    let angle=1.12;
    for(let i=0;i<fps;i++){const next=followAngle(angle,-1.12,1/fps,7);assert.ok(next<=angle&&next>=-1.12);angle=next;}
    results.push(angle);
  }
  assert.ok(Math.abs(results[0]-results[2])<1e-10);
  assert.ok(Math.abs(results[1]+1.12)<.003);
});

test('natural heading crosses front and back continuously without a full spin at the seam',()=>{
  let yaw=headingToYaw(0),previousTarget=yaw;
  for(let i=1;i<=1200;i++){
    const target=headingToYaw(i/1200*Math.PI*4);
    assert.ok(Math.abs(angleDifference(target,previousTarget))<.04);
    const next=followAngle(yaw,target,1/60,7);
    assert.ok(Math.abs(next-yaw)<.05);
    previousTarget=target;yaw=next;
  }
  const from=Math.PI-.02,to=-Math.PI+.02;
  assert.ok(followAngle(from,to,1/60)>from,'takes the short path across the back view');
});
test('head leads the body, paused time does not move, long gaps cannot snap the model',()=>{
  const head=followAngle(1,-1,1/60,13),body=followAngle(1,-1,1/60,7);
  assert.ok(head<body);
  assert.equal(followAngle(.4,-1,0),.4);
  assert.equal(followAngle(.4,-1,-1),.4);
  assert.equal(followAngle(1,-1,300,7),followAngle(1,-1,.05,7));
  assert.ok(followAngle(1,-1,300,7)>0);
});
test('fish pose maps continuously through the front view and remains within a safe yaw range',()=>{
  assert.equal(poseToYaw(4),0);
  assert.equal(poseToYaw(-50),poseToYaw(0));assert.equal(poseToYaw(50),poseToYaw(8));
  for(let p=0;p<8;p+=.01)assert.ok(Math.abs(poseToYaw(p+.01)-poseToYaw(p))<.003);
});
