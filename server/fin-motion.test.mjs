import test from 'node:test';
import assert from 'node:assert/strict';
import {finWeights,flexFin} from '../src/fin-motion.ts';

const rest=new Float32Array([0,0,0, 0,.2,-.4, 0,.4,-.8]);
const weights=finWeights(rest);
const profile={kind:'tail',side:0,phase:0,softness:1};
const motion={time:2,stroke:2.5,effort:.8,speed:.6,turn:0};

test('flexible fin keeps its attachment fixed and bends instead of rotating as a rigid plate',()=>{
  const out=new Float32Array(rest.length);flexFin(rest,weights,out,profile,motion);
  assert.deepEqual([...out.slice(0,3)],[0,0,0]);
  assert.ok(Math.abs(out[6])>.05,'tip visibly flexes');
  let curvature=0;
  for(let phase=0;phase<Math.PI*2;phase+=.2){
    flexFin(rest,weights,out,profile,{...motion,stroke:phase});
    curvature=Math.max(curvature,Math.abs(out[3]-out[6]*.5));
  }
  assert.ok(curvature>.04,'middle and tip have different lag and curvature across the stroke');
});

test('fin deformation starts from rest each frame, without drift or changes to source geometry',()=>{
  const original=new Float32Array(rest),out=new Float32Array(rest.length);
  flexFin(rest,weights,out,profile,motion);const expected=new Float32Array(out);
  for(let i=0;i<100;i++)flexFin(rest,weights,out,profile,motion);
  assert.deepEqual(out,expected);assert.deepEqual(rest,original);
  for(const kind of ['tail','dorsal','pectoral','belly','petal','flipper']){
    flexFin(rest,weights,out,{...profile,kind},{...motion,turn:1.8});
    assert.ok([...out].every(Number.isFinite));
  }
});

test('coasting keeps a soft residual wave, propulsion increases flex and left/right fins differ',()=>{
  const idle=new Float32Array(rest.length),push=new Float32Array(rest.length);
  flexFin(rest,weights,idle,profile,{...motion,effort:0});
  flexFin(rest,weights,push,profile,{...motion,effort:1});
  assert.ok(Math.abs(idle[6])>.005,'coasting is not a frozen fin');
  assert.ok(Math.abs(push[6])>Math.abs(idle[6])*2,'stronger propulsion has a wider wave');
  flexFin(rest,weights,idle,{...profile,kind:'pectoral',side:-1,phase:-.85},motion);
  flexFin(rest,weights,push,{...profile,kind:'pectoral',side:1,phase:.85},motion);
  assert.ok(Math.abs(idle[7]-push[7])>.01,'pectoral fins do not march in sync');
});
