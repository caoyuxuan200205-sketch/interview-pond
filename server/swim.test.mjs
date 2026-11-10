import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,stepWorld,syncWorld,canOccupy,sampleSwimmer} from '../src/swim.ts';
function seeded(seed=73){return()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
const inputs=Array.from({length:12},(_,i)=>({id:'fish-'+i,traits:i%2?['好奇','热情']:['耐心','内敛']}));
test('all fish stay inside water and outside obstacles throughout continuous travel',()=>{
  const world=createWorld(inputs,seeded());const modes=new Set();
  for(let tick=0;tick<5400;tick++){
    const before=world.fish.map(f=>({x:f.x,y:f.y}));stepWorld(world,1/30);
    world.fish.forEach((f,i)=>{
      assert.ok(canOccupy(f.x,f.y,f.width,f.height),`fish ${i} at ${f.x},${f.y}`);
      assert.ok(Math.hypot(f.x-before[i].x,f.y-before[i].y)<(f.speed*1.35+2)/30,'displacement stays within swimming speed');
      assert.ok(Number.isFinite(f.heading));modes.add(f.mode);
    });
  }
  assert.equal(world.fish.length,12);
  assert.ok(world.fish.every(f=>f.distance>200&&f.decisions>6),'every fish explores and chooses new goals');
  assert.deepEqual([...modes].sort(),['explore','glide','rest','school']);
});
test('hover gently brakes one fish; long frame gaps are bounded; additions preserve state',()=>{
  const world=createWorld(inputs,seeded(32));
  for(let i=0;i<90;i++)stepWorld(world,1/30);
  const selected=world.fish[0],speed=selected.cruise,held={x:selected.x,y:selected.y};
  stepWorld(world,1/60,inputs[0].id);
  assert.ok(selected.cruise>=speed*.90,'hover does not zero the speed in one frame');
  for(let i=0;i<180;i++)stepWorld(world,1/30,inputs[0].id);
  assert.ok(Math.hypot(selected.x-held.x,selected.y-held.y)<speed/4+3,'braking stops within a clickable area');
  assert.ok(selected.cruise<.1,'fish settles to a gentle hover');
  assert.ok(world.fish.slice(1).some(f=>f.distance>30));
  const before=world.fish.map(f=>({x:f.x,y:f.y}));stepWorld(world,600);
  world.fish.forEach((f,i)=>assert.ok(Math.hypot(f.x-before[i].x,f.y-before[i].y)<(f.speed*1.35+2)*.051));
  const existing=world.fish[0];syncWorld(world,[...inputs,{id:'new-arrival',traits:['温暖']}]);
  assert.equal(world.fish[0],existing);assert.equal(world.fish.at(-1).arrival,5);
  assert.ok(canOccupy(world.fish.at(-1).x,world.fish.at(-1).y,world.fish.at(-1).width,world.fish.at(-1).height));
});

test('fixed-step motion agrees at 30, 60 and 120 FPS',()=>{
  const worlds=[30,60,120].map(fps=>{
    const w=createWorld(inputs,seeded(245));
    for(let i=0;i<fps*20;i++)stepWorld(w,1/fps);
    return w;
  });
  for(let i=1;i<worlds.length;i++)assert.deepEqual(worlds[i].fish,worlds[0].fish);
});

test('coasting preserves momentum, steering is continuous and propulsion is asynchronous',()=>{
  const world=createWorld(inputs,seeded(85));let coasts=0,strokes=0,asyncFrames=0;
  for(let i=0;i<3600;i++){
    const before=world.fish.map(f=>({heading:f.heading,speed:f.cruise}));stepWorld(world,1/60);
    for(const [j,f] of world.fish.entries()){
      assert.ok(Math.abs(f.heading-before[j].heading)<=1.85/60+1e-8,'no orientation jumps');
      if(f.effort>.4)strokes++;
      if(f.effort<.05&&f.cruise>10)coasts++;
    }
    if(world.fish.some(f=>f.effort>.4)&&world.fish.some(f=>f.effort<.05))asyncFrames++;
  }
  assert.ok(strokes>100&&coasts>100&&asyncFrames>100,'each fish has independent bursts and inertial glides');
});
test('species and role do not affect behavior; crowded ponds include every fish',()=>{
  const left=createWorld(inputs.map(f=>({...f,role:'产品经理',sprite:0})),seeded(10));
  const right=createWorld(inputs.map(f=>({...f,role:'后端工程师',sprite:9})),seeded(10));
  for(let i=0;i<180;i++){stepWorld(left,1/30);stepWorld(right,1/30);}
  assert.deepEqual(left.fish,right.fish);
  const crowded=createWorld(Array.from({length:100},(_,i)=>({id:String(i),traits:[]})),seeded(82));
  for(let i=0;i<300;i++)stepWorld(crowded,1/30);
  assert.equal(crowded.fish.length,100);
  assert.ok(crowded.fish.every(f=>canOccupy(f.x,f.y,f.width,f.height)&&Number.isFinite(f.x)));
});

test('render interpolation fills fractional frames without mutating the simulation',()=>{
  const w=createWorld(inputs,seeded(18));
  for(let i=0;i<120;i++)stepWorld(w,1/60);
  const f=w.fish[0],before=sampleSwimmer(w,f),position={x:f.x,y:f.y};
  stepWorld(w,1/120);
  const halfway=sampleSwimmer(w,f);
  assert.equal(f.x,position.x);assert.equal(f.y,position.y);
  assert.ok(Math.abs(halfway.x-(before.x+position.x)/2)<1e-9);
  assert.ok(Math.abs(halfway.y-(before.y+position.y)/2)<1e-9);
});

test('approaching fish yield without passing through each other or being pushed sideways',()=>{
  const w=createWorld(inputs.slice(0,2),seeded(14));
  const [a,b]=w.fish;
  Object.assign(a,{x:580,y:345,heading:0,targetX:980,targetY:345,mode:'explore',remaining:18,cruise:30});
  Object.assign(b,{x:910,y:345,heading:Math.PI,targetX:480,targetY:345,mode:'explore',remaining:18,cruise:30});
  let closest=Infinity;
  for(let i=0;i<1800;i++){
    stepWorld(w,1/60);
    const d=Math.hypot((a.x-b.x)/((a.width+b.width)*.31),(a.y-b.y)/((a.height+b.height)*.33));
    closest=Math.min(closest,d);
    assert.ok(d>=.998,'body contact does not deepen');
  }
  assert.ok(closest<2,'the fish actually approach');
  assert.ok(a.distance>100&&b.distance>100,'both resume swimming after yielding');
});

test('a fish leaving close contact is not frozen by its approaching neighbor',()=>{
  const w=createWorld(inputs.slice(0,2),seeded(14));const [a,b]=w.fish;
  Object.assign(a,{x:600,y:345,heading:Math.PI,targetX:450,targetY:345,mode:'glide',remaining:18,cruise:20,cycle:1});
  Object.assign(b,{x:700,y:345,heading:Math.PI,targetX:450,targetY:345,mode:'glide',remaining:18,cruise:40,cycle:1});
  stepWorld(w,1/60);
  assert.ok(a.x<599.8,'outward travel remains available to break a crowd deadlock');
});

test('fish crowded beside the social sign can find a way back into open water',()=>{
  const w=createWorld(inputs.slice(0,3),seeded(49));
  const positions=[[1055,676],[975,623],[1094,602]];
  w.fish.forEach((f,i)=>Object.assign(f,{x:positions[i][0],y:positions[i][1],heading:i*2,targetX:980,targetY:560,cruise:8,remaining:8}));
  for(let i=0;i<3600;i++)stepWorld(w,1/60);
  assert.ok(w.fish.every(f=>f.distance>150),'no fish is permanently frozen in the narrow passage');
});
