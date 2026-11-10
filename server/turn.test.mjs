import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceTurn,createTurn,isTurning,startTurn} from '../src/turn.ts';
import {createWorld,stepWorld} from '../src/swim.ts';

test('both turn directions pass through a sustained front view without jumping or reversing',()=>{
  for(const facing of [1,-1]){
    const state=createTurn(facing);startTurn(state,-facing);
    let previous=state.pose,frontFrames=0;
    for(let i=0;i<60;i++){
      advanceTurn(state,-facing,1/30);
      assert.ok(state.pose>=0&&state.pose<=8);
      assert.ok((state.pose-previous)*facing>=-1e-9);
      assert.ok(Math.abs(state.pose-previous)<.3);
      if(state.pose===4)frontFrames++;
      previous=state.pose;
    }
    assert.equal(state.pose,facing===1?8:0);
    assert.ok(!isTurning(state));assert.ok(frontFrames>=8);
  }
});
test('direction jitter cannot interrupt a turn and background time cannot skip it',()=>{
  const state=createTurn(1);startTurn(state,-1);
  advanceTurn(state,1,600);
  assert.ok(state.pose<1);assert.equal(state.target,8);
  const before=state.pose;advanceTurn(state,1,0);assert.equal(state.pose,before);
  for(let i=0;i<60;i++)advanceTurn(state,i%2?1:-1,1/30);
  assert.equal(state.pose,8);
  for(let i=0;i<15;i++)advanceTurn(state,1,1/30);
  assert.equal(state.pose,8);
});
test('turning fish decelerates while the rest of the pond keeps swimming',()=>{
  const input=[{id:'bai',traits:[]},{id:'blue',traits:[]}];
  const normal=createWorld(input,()=>.42),turning=createWorld(input,()=>.42);
  for(let i=0;i<45;i++){
    stepWorld(normal,1/30);
    stepWorld(turning,1/30,null,1,new Map([['bai',.12]]));
  }
  assert.ok(turning.fish[0].distance<normal.fish[0].distance*.6);
  assert.ok(turning.fish[1].distance>0);
});
