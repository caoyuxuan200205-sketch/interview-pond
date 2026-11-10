import test from 'node:test';
import assert from 'node:assert/strict';
import {makeMouthBubble,advanceMouthBubble} from '../src/mouth-bubbles.ts';

test('bubbles begin at the mouth, then detach from the swimming fish',()=>{
  const anchor={x:535,y:500,dx:1,dy:.2,visible:true};
  const bubble=makeMouthBubble(anchor,()=>.5);
  assert.equal(bubble.x,anchor.x);assert.equal(bubble.y,anchor.y);
  anchor.x+=100;anchor.y+=50;
  advanceMouthBubble(bubble,1/30);
  assert.ok(bubble.x<536&&bubble.y<500,'water-space particle does not follow the moved mouth');
});

test('mouth bubbles rise continuously and expire instead of accumulating',()=>{
  const bubble=makeMouthBubble({x:800,y:600,dx:-1,dy:1,visible:true},()=>.5);
  let alive=true;
  for(let i=0;i<400&&alive;i++){
    const y=bubble.y;alive=advanceMouthBubble(bubble,1/60);
    assert.ok(bubble.y<y);assert.ok(Number.isFinite(bubble.x));
  }
  assert.equal(alive,false);
  bubble.y=202.1;assert.equal(advanceMouthBubble(bubble,.05),false);
});

test('pause and long frame gaps cannot teleport mouth bubbles',()=>{
  const bubble=makeMouthBubble({x:800,y:600,dx:0,dy:0,visible:true},()=>.5);
  const original={...bubble};advanceMouthBubble(bubble,0);assert.deepEqual(bubble,original);
  const capped={...bubble};advanceMouthBubble(bubble,600);advanceMouthBubble(capped,.05);
  assert.deepEqual(bubble,capped);
});
