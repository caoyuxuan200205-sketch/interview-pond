// Continuous local movement. Jobs, species and immutable skins never select behavior.
export type FishInput = { id: string; traits: string[] };
export type Mode = 'explore' | 'glide' | 'rest' | 'school';
export type Swimmer = {
  id: string; x: number; y: number; vx: number; vy: number; heading: number;
  targetX: number; targetY: number; mode: Mode; remaining: number; phase: number;
  width: number; height: number; speed: number; social: number; curiosity: number;
  facing: number; pitch: number; arrival: number; decisions: number; distance: number;
  angularVelocity: number; cruise: number; effort: number; stroke: number;
  burst: number; coast: number; cycle: number; wander: number; wanderTarget: number;
  attention: number; buddyId: string | null; buddyTime: number; side: number;
  sensedX: number; sensedY: number; sensedHeading: number;
  avoidSide: number; avoidTime: number; stuck: number; energy: number;
  previous: {x:number;y:number;heading:number;pitch:number;stroke:number;effort:number;cruise:number};
};
export type MotionIntent = { x:number; y:number; face?:number; pace?:number };
export type World = { fish: Swimmer[]; time: number; accumulator: number; random: () => number; intents?:Map<string,MotionIntent> };
export const water = { left: 115, right: 1515, top: 210, bottom: 775 };
export const obstacles = [
  { left: 70, top: 420, right: 407, bottom: 520 },
  { left: 70, top: 700, right: 407, bottom: 775 },
  { left: 70, top: 520, right: 160, bottom: 700 },
  { left: 1070, top: 195, right: 1550, bottom: 462 },
  { left: 1200, top: 445, right: 1530, bottom: 780 },
  { left: 637, top: 647, right: 870, bottom: 738 },
];
const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
const range = (world: World, a: number, b: number) => a + world.random() * (b-a);
const angleDelta = (a: number, b: number) => Math.atan2(Math.sin(a-b), Math.cos(a-b));
const FIXED_STEP = 1/60;
function dimensions(count: number) {
  const density = clamp(Math.sqrt(12 / Math.max(12, count)), .43, 1);
  return { width: 180*density, height: 120*density };
}
export function canOccupy(x: number, y: number, width: number, height: number, margin = 4) {
  // The render viewport includes transparent padding; collide the visible body,
  // not that entire rectangle, so fish can turn out of the coral's narrow passages.
  const rx = width*.40 + margin, ry = height*.42 + margin;
  if (x-rx < water.left || x+rx > water.right || y-ry < water.top || y+ry > water.bottom) return false;
  return !obstacles.some(o => x+rx > o.left && x-rx < o.right && y+ry > o.top && y-ry < o.bottom);
}
function pathClear(f: Swimmer, x: number, y: number, margin = 4) {
  const steps = Math.ceil(Math.hypot(x-f.x, y-f.y) / 14);
  for (let i=1; i<=steps; i++) if (!canOccupy(f.x+(x-f.x)*i/steps, f.y+(y-f.y)*i/steps, f.width, f.height, margin)) return false;
  return true;
}
function clearance(f: Swimmer, angle: number, length: number) {
  const dx=Math.cos(angle),dy=Math.sin(angle);
  for(let d=10;d<=length;d+=10)if(!canOccupy(f.x+dx*d,f.y+dy*d,f.width,f.height,6))return d-10;
  return length;
}
function findPosition(world: World, width: number, height: number, newcomer: boolean) {
  let best = {x: 550, y: 320}, score = -1;
  for (let i=0; i<180; i++) {
    const x = newcomer && i<60 ? range(world, 970, 1100) : range(world, water.left+width/2+10, water.right-width/2-10);
    const y = newcomer && i<60 ? range(world, 545, 645) : range(world, water.top+height/2+10, water.bottom-height/2-10);
    if (!canOccupy(x,y,width,height,10)) continue;
    const distance = world.fish.reduce((min,f)=>Math.min(min,Math.hypot(x-f.x,y-f.y)),500);
    if (distance>score) { score=distance;best={x,y}; }
    if (distance>width*1.12) return best;
  }
  return best;
}
function chooseGoal(world: World, f: Swimmer) {
  let best = {x:f.x,y:f.y}, score = -Infinity;
  for (let i=0; i<30; i++) {
    const angle = i<20?f.heading+range(world,-1.2,1.2):range(world,-Math.PI,Math.PI);
    const distance = range(world,110,260+f.curiosity*150);
    const x = f.x+Math.cos(angle)*distance, y = f.y+Math.sin(angle)*distance*.65;
    if (!canOccupy(x,y,f.width,f.height,10) || !pathClear(f,x,y,7)) continue;
    const value = Math.cos(angle-f.heading)*65 + world.random()*55 + distance*.15;
    if (value>score) { best={x,y};score=value; }
  }
  f.targetX=best.x;f.targetY=best.y;f.decisions++;
}
export function createWorld(input: FishInput[], random = Math.random): World {
  const world: World = {fish:[],time:0,accumulator:0,random};
  syncWorld(world,input,false);return world;
}
export function syncWorld(world: World, input: FishInput[], newcomers = true) {
  const ids = new Set(input.map(f=>f.id));
  world.fish=world.fish.filter(f=>ids.has(f.id));
  const size=dimensions(input.length);
  for (const f of world.fish) {
    f.width=size.width;f.height=size.height;
    if (!canOccupy(f.x,f.y,f.width,f.height)) {Object.assign(f,findPosition(world,f.width,f.height,false));f.previous.x=f.x;f.previous.y=f.y;}
    if(f.buddyId&&!ids.has(f.buddyId))f.buddyId=null;
  }
  for (const info of input) {
    if (world.fish.some(f=>f.id===info.id)) continue;
    const traits=info.traits.join(' ');
    const social=/温暖|同理|团队|连接|交流|活泼|热情/.test(traits) ? .8 : /内敛|独立|冷静|深度/.test(traits) ? .25 : .5;
    const curiosity=/好奇|探索|创新|极客|灵活/.test(traits) ? .85 : .45;
    const calm=/耐心|稳健|内敛|冷静|深度/.test(traits);
    const position=findPosition(world,size.width,size.height,newcomers);
    const f: Swimmer={id:info.id,...position,...size,vx:0,vy:0,heading:range(world,-Math.PI,Math.PI),targetX:position.x,targetY:position.y,mode:'explore',remaining:range(world,5,12),phase:range(world,0,Math.PI*2),speed:range(world,calm?32:39,calm?41:49),social,curiosity,facing:1,pitch:0,arrival:newcomers?5:0,decisions:0,distance:0,
      angularVelocity:0,cruise:0,effort:0,stroke:0,burst:range(world,.28,.5),coast:range(world,.65,1.35),cycle:range(world,0,.8),wander:0,wanderTarget:0,attention:range(world,.15,.45),buddyId:null,buddyTime:0,side:world.random()>.5?1:-1,sensedX:position.x,sensedY:position.y,sensedHeading:0,avoidSide:0,avoidTime:0,stuck:0,energy:range(world,.55,1),previous:{...position,heading:0,pitch:0,stroke:0,effort:0,cruise:0}};
    world.fish.push(f);chooseGoal(world,f);
    if(Math.hypot(f.targetX-f.x,f.targetY-f.y)>20)f.heading=Math.atan2(f.targetY-f.y,f.targetX-f.x);
    f.facing=Math.cos(f.heading)>=0?1:-1;
    f.previous.heading=f.heading;
  }
}
function nearbyGrid(fish: Swimmer[]) {
  const grid=new Map<string,Swimmer[]>();
  for (const f of fish) { const key=`${Math.floor(f.x/200)},${Math.floor(f.y/200)}`; const group=grid.get(key)||[];group.push(f);grid.set(key,group); }
  return (f: Swimmer) => {
    const result: Swimmer[]=[];const x=Math.floor(f.x/200),y=Math.floor(f.y/200);
    for(let dx=-2;dx<=2;dx++)for(let dy=-2;dy<=2;dy++)result.push(...(grid.get(`${x+dx},${y+dy}`)||[]));
    return result;
  };
}
function sense(world: World, f: Swimmer, neighbors: Swimmer[]) {
  f.attention=range(world,.22,.44);
  // Correlated wandering: smoothly chase a small offset, never redraw a heading each frame.
  f.wanderTarget=clamp(f.wanderTarget+range(world,-.2,.2),-.65,.65);
  if(f.mode!=='school'){f.buddyId=null;return;}
  let buddy=neighbors.find(o=>o.id===f.buddyId);
  if(buddy&&(f.buddyTime<=0||Math.hypot(buddy.x-f.x,buddy.y-f.y)>310||buddy.mode==='rest'||!pathClear(f,buddy.x,buddy.y)))buddy=undefined;
  if(!buddy){
    const candidates=neighbors.filter(o=>o!==f&&o.buddyId!==f.id&&o.mode!=='rest'&&Math.hypot(o.x-f.x,o.y-f.y)<260&&Math.hypot(o.x-f.x,o.y-f.y)>f.width*.6&&Math.cos(o.heading-f.heading)>-.25&&pathClear(f,o.x,o.y));
    candidates.sort((a,b)=>Math.hypot(a.x-f.x,a.y-f.y)-Math.hypot(b.x-f.x,b.y-f.y));
    buddy=candidates[0];f.buddyTime=range(world,5,10);
  }
  f.buddyId=buddy?.id??null;
  if(buddy){f.sensedX=buddy.x+buddy.vx*.3;f.sensedY=buddy.y+buddy.vy*.3;f.sensedHeading=buddy.heading;}
}
function integrate(world: World, dt: number, heldId: string|null, speedFactors:ReadonlyMap<string,number>) {
  world.time+=dt;
  const nearby=nearbyGrid(world.fish);
  const updates: Array<{f:Swimmer;x:number;y:number}> = [];
  for(const f of world.fish)f.previous={x:f.x,y:f.y,heading:f.heading,pitch:f.pitch,stroke:f.stroke,effort:f.effort,cruise:f.cruise};
  for (const f of world.fish) {
    const held=f.id===heldId;
    const intent=world.intents?.get(f.id);
    if(intent){f.targetX=intent.x;f.targetY=intent.y;f.mode='explore';f.remaining=2;}
    f.arrival=Math.max(0,f.arrival-dt);f.avoidTime=Math.max(0,f.avoidTime-dt);f.buddyTime-=dt;
    f.energy=clamp(f.energy+dt*(f.mode==='rest'?.035:-.003),0,1);
    if(!held)f.remaining-=dt;
    const distance=Math.hypot(f.targetX-f.x,f.targetY-f.y);
    if(!held&&!intent&&(f.remaining<=0||(distance<35&&f.mode==='explore'))){
      const roll=world.random(),restChance=f.energy<.35?.38:.10;
      f.mode=roll<restChance?'rest':roll<restChance+.22?'glide':roll<restChance+.22+f.social*.45?'school':'explore';
      f.remaining=range(world,f.mode==='rest'?2.5:f.mode==='school'?9:6,f.mode==='rest'?5:f.mode==='school'?18:13);
      chooseGoal(world,f);
    }
    const neighbors=nearby(f);
    f.attention-=dt;if(f.attention<=0)sense(world,f,neighbors);
    f.wander+=(f.wanderTarget-f.wander)*(1-Math.exp(-dt*.8));
    let desired=Math.atan2(f.targetY-f.y,f.targetX-f.x);
    let aimX=Math.cos(f.heading+f.wander)*.7+Math.cos(desired)*.8;
    let aimY=Math.sin(f.heading+f.wander)*.45+Math.sin(desired)*.8;
    if(f.mode==='glide'){aimX=Math.cos(f.heading+f.wander*.35);aimY=Math.sin(f.heading+f.wander*.35);}
    if(f.mode==='school'&&f.buddyId){
      const h=f.sensedHeading;
      // Loose side-by-side formation, instead of a train aimed at the neighbor's tail.
      const x=f.sensedX-Math.cos(h)*f.width*.4-Math.sin(h)*f.width*.85*f.side;
      const y=f.sensedY-Math.sin(h)*f.width*.4+Math.cos(h)*f.height*.85*f.side;
      if(canOccupy(x,y,f.width,f.height)&&pathClear(f,x,y)){
        const d=Math.hypot(x-f.x,y-f.y)||1;
        aimX=(x-f.x)/d*.7+Math.cos(h);aimY=(y-f.y)/d*.7+Math.sin(h);
      }
    }
    let crowdBrake=1;
    for(const other of neighbors){
      if(other===f)continue;
      const dx=f.x-other.x,dy=f.y-other.y,rx=(f.width+other.width)*.40,ry=(f.height+other.height)*.42;
      const d=Math.hypot(dx/rx,dy/ry);
      const rvx=f.vx-other.vx,rvy=f.vy-other.vy;
      const t=clamp(-(dx*rvx+dy*rvy)/(rvx*rvx+rvy*rvy+1),0,1.6);
      const future=Math.hypot((dx+rvx*t)/rx,(dy+rvy*t)/ry);
      if(d<1.5||future<1.25){
        const weight=clamp((1.5-Math.min(d,future))/1.1,0,1.3);
        const norm=Math.hypot(dx,dy)||1;
        aimX+=dx/norm*weight*1.8;aimY+=dy/norm*weight*1.8;
        // Stable passing preference breaks head-on symmetry; no direct position pushing.
        if(future<1.1&&Math.cos(other.heading-f.heading)<-.3)aimY+=(f.id<other.id?1:-1)*weight;
        if((other.x-f.x)*Math.cos(f.heading)+(other.y-f.y)*Math.sin(f.heading)>0)crowdBrake=Math.min(crowdBrake,clamp(d-.35,.18,1));
      }
    }
    if(intent){aimX=Math.cos(desired);aimY=Math.sin(desired);}
    desired=Math.atan2(aimY,aimX);
    const look=65+f.cruise*1.4;
    const room=clearance(f,f.heading,look);
    const destinationRoom=clearance(f,desired,look);
    if(room<look||destinationRoom<look*.75||f.stuck>.5){
      let best=f.heading,bestScore=-Infinity;
      const goalAngle=Math.atan2(f.targetY-f.y,f.targetX-f.x);
      for(const offset of [angleDelta(goalAngle,f.heading),angleDelta(desired,f.heading),0,.35,-.35,.7,-.7,1.05,-1.05,1.45,-1.45,1.9,-1.9,2.5,-2.5,Math.PI]){
        const angle=f.heading+offset,free=clearance(f,angle,look);
        const committed=f.avoidTime>0&&f.avoidSide&&Math.sign(offset)===f.avoidSide?.55:0;
        const sample=Math.min(free,look*.6),px=f.x+Math.cos(angle)*sample,py=f.y+Math.sin(angle)*sample;
        let occupied=0;
        for(const other of neighbors){
          if(other===f)continue;
          const gap=Math.hypot((px-other.x)/((f.width+other.width)*.33),(py-other.y)/((f.height+other.height)*.35));
          occupied+=Math.max(0,1.3-gap)*2.5;
        }
        const score=free/look*3+Math.cos(angle-desired)*.75-Math.abs(offset)*.12+committed-occupied;
        if(score>bestScore){best=angle;bestScore=score;}
      }
      desired=best;
      if(f.avoidTime===0){f.avoidSide=Math.sign(angleDelta(best,f.heading));f.avoidTime=1.8;}
    }
    if(intent&&distance<35&&intent.face!==undefined)desired=intent.face;
    const turn=angleDelta(desired,f.heading);
    const turnLimit=1.85-clamp(f.cruise/f.speed,0,1)*.85;
    const desiredRate=held||f.mode==='rest'?0:clamp(turn*2,-turnLimit,turnLimit);
    f.angularVelocity+=(desiredRate-f.angularVelocity)*(1-Math.exp(-dt*4));
    f.heading+=f.angularVelocity*dt;
    // Independent burst/coast clocks. Thrust and tail motion share this phase.
    f.cycle+=dt;
    if(f.cycle>=f.burst+f.coast){f.cycle-=f.burst+f.coast;f.burst=range(world,.28,.5);f.coast=range(world,.65,1.35)*(f.mode==='glide'?1.35:1);}
    const pulse=f.cycle<f.burst?Math.sin(Math.PI*f.cycle/f.burst):0;
    const roomBrake=clamp((room-6)/45,.06,1);
    const turningBrake=1-.55*clamp(Math.abs(turn)/2.3,0,1);
    const control=clamp((speedFactors.get(f.id)??1)*(intent?Math.min(intent.pace??1,Math.max(0,(distance-12)/65)):1),0,1);
    const resting=held||f.mode==='rest';
    const drive=resting?0:pulse*(f.mode==='glide'?.72:1)*turningBrake*crowdBrake*roomBrake*control;
    f.effort+=(drive-f.effort)*(1-Math.exp(-dt*16));
    f.stroke+=dt*(2+f.effort*11+clamp(f.cruise/f.speed,0,1)*2);
    const drag=(resting?5:roomBrake<.5?2.8:.68)+(1-control)*2;
    f.cruise=clamp(f.cruise+(f.speed*3.9*drive-f.cruise*drag)*dt,0,f.speed*1.35);
    const drift=resting?.16:1;
    const flowX=(Math.sin(world.time*.17+f.y*.003)+Math.sin(world.time*.09+f.x*.004))*.55*drift;
    const flowY=Math.sin(world.time*.13+f.x*.003)*.55*drift;
    const vx=Math.cos(f.heading)*f.cruise+flowX,vy=Math.sin(f.heading)*f.cruise+flowY;
    let x=f.x+vx*dt,y=f.y+vy*dt;
    if(!canOccupy(x,y,f.width,f.height)){
      // Collision guard only; do not slide along a screen axis or teleport sideways.
      x=f.x;y=f.y;f.cruise*=Math.exp(-dt*12);f.stuck+=dt;
    }else f.stuck=Math.max(0,f.stuck-dt*.3);
    if(!resting&&f.cruise<3)f.stuck+=dt;
    if(f.stuck>1.4&&!resting&&!intent){chooseGoal(world,f);f.mode='explore';f.remaining=6;f.avoidTime=0;f.stuck=0;}
    updates.push({f,x,y});
  }
  // Last-resort body contact guard: shorten forward travel, never shove fish sideways.
  // Existing overlaps after a crowded spawn may separate, but cannot deepen.
  for(let pass=0;pass<2;pass++)for(let a=0;a<updates.length;a++)for(let b=a+1;b<updates.length;b++){
    const u=updates[a],v=updates[b],rx=(u.f.width+v.f.width)*.31,ry=(u.f.height+v.f.height)*.33;
    if(Math.abs(u.x-v.x)>rx+3||Math.abs(u.y-v.y)>ry+3)continue;
    const before=Math.hypot((u.f.x-v.f.x)/rx,(u.f.y-v.f.y)/ry);
    const after=Math.hypot((u.x-v.x)/rx,(u.y-v.y)/ry);
    if(after<1&&after<before){
      const nx=(u.f.x-v.f.x)/rx/(before||1),ny=(u.f.y-v.f.y)/ry/(before||1);
      const du=(u.x-u.f.x)/rx*nx+(u.y-u.f.y)/ry*ny;
      const dv=-(v.x-v.f.x)/rx*nx-(v.y-v.f.y)/ry*ny;
      const available=Math.max(0,before-1)+Math.max(0,du)+Math.max(0,dv);
      const fraction=clamp(available/(Math.max(0,-du)+Math.max(0,-dv)+1e-9)-.005,0,1);
      // Always let the fish swimming OUT of contact leave. Braking both creates deadlocks.
      for(const [item,approach] of [[u,du],[v,dv]] as const)if(approach<0){item.x=item.f.x+(item.x-item.f.x)*fraction;item.y=item.f.y+(item.y-item.f.y)*fraction;item.f.cruise*=.98;}
    }
  }
  for(const {f,x,y} of updates){
    const vx=(x-f.x)/dt,vy=(y-f.y)/dt;
    if(Math.hypot(x-f.x,y-f.y)<.002&&f.cruise>3&&f.id!==heldId&&f.mode!=='rest')f.stuck+=dt;
    f.distance+=Math.hypot(x-f.x,y-f.y);f.x=x;f.y=y;f.vx=vx;f.vy=vy;
    if(Math.abs(Math.cos(f.heading))>.25)f.facing=Math.cos(f.heading)>0?1:-1;
    const pitch=clamp(Math.atan2(vy,Math.abs(vx)+12)*18,-15,15)*f.facing;
    f.pitch+=(pitch-f.pitch)*(1-Math.exp(-dt*3));
  }
}
export function stepWorld(world: World, delta: number, heldId: string|null = null, pace = 1, speedFactors:ReadonlyMap<string,number> = new Map()) {
  // Fixed simulation steps make behavior independent of display refresh rate.
  // A hidden/restored tab never attempts to catch up minutes of missed frames.
  if(!Number.isFinite(delta)||!Number.isFinite(pace))return;
  world.accumulator+=clamp(delta,0,.05)*clamp(pace,0,1.5);
  while(world.accumulator+1e-9>=FIXED_STEP){integrate(world,FIXED_STEP,heldId,speedFactors);world.accumulator=Math.max(0,world.accumulator-FIXED_STEP);}
}
// Interpolate render samples, not the simulation. A 120 Hz screen also gets
// continuous movement; throttled/paused worlds keep their last stable pose.
export function sampleSwimmer(world:World,f:Swimmer){
  const t=clamp(world.accumulator/FIXED_STEP,0,1),p=f.previous;
  const lerp=(a:number,b:number)=>a+(b-a)*t;
  return {x:lerp(p.x,f.x),y:lerp(p.y,f.y),heading:lerp(p.heading,f.heading),pitch:lerp(p.pitch,f.pitch),stroke:lerp(p.stroke,f.stroke),effort:lerp(p.effort,f.effort),cruise:lerp(p.cruise,f.cruise)};
}
