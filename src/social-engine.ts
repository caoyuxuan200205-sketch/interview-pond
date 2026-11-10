import { createWorld, syncWorld, stepWorld, canOccupy, type World, type FishInput, type Swimmer } from './swim.ts';
export type SocialFish = FishInput & {name:string;sprite:number;skin?:number};
export type SocialKind = 'meet'|'swim'|'company';
export const socialNames = {meet:'认识新伙伴',swim:'邀请同游',company:'安静陪伴'};
export type Relation = {from:string;to:string;familiar:number;closeness:number;trust:number;count:number;lastEvent:string;updatedAt:number};
export type SocialEvent = {id:string;kind:SocialKind;status:'completed'|'declined'|'interrupted';members:string[];title:string;summary:string;reason:string;at:number;duration:number;dialogue:{fishId:string;text:string;at:number;source?:'ai';model?:string}[];changes:{from:string;to:string;familiar:number;closeness:number}[]};
type Activity = {id:string;kind:SocialKind;members:[string,string];phase:'inviting'|'approaching'|'interacting';elapsed:number;valid:number;stable:number;slots:{x:number;y:number}[];dialogue:SocialEvent['dialogue'];started:number;travelStart?:number[];prepared?:{lines:string[];model:string};aiRequested?:boolean};
export type SocialState = {seed:number;scope?:string;world:World;fish:SocialFish[];activity:Activity|null;relationships:Record<string,Relation>;cooldown:Record<string,number>;pairCooldown:Record<string,number>;daily:Record<string,number>;enabled:boolean;nextDecision:number;revision:number;aiEnabled?:boolean;aiBudget?:{day:string;count:number;last:number}};
const pair=(a:string,b:string)=>[a,b].sort().join('|');
export const relationKey=(a:string,b:string)=>JSON.stringify([a,b]);
const hash=(s:string)=>{let n=2166136261;for(const c of s)n=Math.imul(n^c.charCodeAt(0),16777619);return n>>>0;};
export function createSocial(fish:SocialFish[],seed=hash(crypto.randomUUID())):SocialState {
  const s={seed,fish,activity:null,relationships:{},cooldown:{},pairCooldown:{},daily:{},enabled:true,nextDecision:8,revision:0} as unknown as SocialState;
  const rng=()=>{s.seed=(Math.imul(s.seed,1664525)+1013904223)>>>0;return s.seed/4294967296;};
  s.world=createWorld(fish,rng);return s;
}
export function serializeSocial(s:SocialState){return JSON.stringify({...s,world:{fish:s.world.fish,time:s.world.time,accumulator:s.world.accumulator}});}
export function restoreSocial(json:string,fish:SocialFish[]) {
  const saved=JSON.parse(json),s=createSocial(fish,saved.seed);
  Object.assign(s,saved,{fish,world:{...saved.world,random:s.world.random}});syncWorld(s.world,fish);return s;
}
export function syncSocial(s:SocialState,fish:SocialFish[],now=Date.now()) {
  const ids=new Set(fish.map(f=>f.id));const events:SocialEvent[]=[];
  if(s.activity&&s.activity.members.some(id=>!ids.has(id)))events.push(finish(s,'interrupted','伙伴已离开鱼塘，本次活动结束。',now));
  s.fish=fish;syncWorld(s.world,fish);
  for(const [k,r] of Object.entries(s.relationships))if(!ids.has(r.from)||!ids.has(r.to))delete s.relationships[k];
  return events;
}
function visible(a:Swimmer,b:{x:number;y:number}){for(let t=0;t<=1;t+=.08)if(!canOccupy(a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t,a.width*.7,a.height*.7))return false;return true;}
function ready(s:SocialState,id:string){return (s.cooldown[id]||0)<=s.world.time;}
function slotsFor(s:SocialState,a:Swimmer,b:Swimmer){
  const mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2}, gap=Math.max(120,a.width*1.1);
  for(const angle of [0,Math.PI/2,Math.PI/4,-Math.PI/4]){
    const slots=[-1,1].map(sign=>({x:mid.x+sign*Math.cos(angle)*gap/2,y:mid.y+sign*Math.sin(angle)*gap/2}));
    if(slots.every((p,i)=>canOccupy(p.x,p.y,[a,b][i].width,[a,b][i].height,8)&&visible([a,b][i],p)))return slots;
  }return null;
}
export function invite(s:SocialState,aId:string,bId:string,kind:SocialKind,now=Date.now()) {
  if(!s.enabled)return '自动互动已暂停，请先开启。';
  if(s.activity)return '伙伴们正在互动，稍后再邀请。';
  if(!['meet','swim','company'].includes(kind)||aId===bId)return '请选择两位不同的伙伴。';
  const a=s.world.fish.find(f=>f.id===aId),b=s.world.fish.find(f=>f.id===bId);
  if(!a||!b)return '伙伴不在当前鱼塘中。';
  if(kind==='meet'&&s.relationships[relationKey(aId,bId)])return '已经认识啦，可以邀请同游或安静陪伴。';
  if(!ready(s,aId)||!ready(s,bId)||(s.pairCooldown[pair(aId,bId)]||0)>s.world.time)return '它们想先休息一会儿，稍后再试。';
  const slots=slotsFor(s,a,b);if(!slots)return '附近暂时没有合适的相遇位置，等它们游近一些。';
  s.activity={id:crypto.randomUUID(),kind,members:[aId,bId],phase:'inviting',elapsed:0,valid:0,stable:0,slots,dialogue:[],started:now};
  s.activity.dialogue.push({fishId:aId,text:kind==='meet'?'你好，可以认识一下吗？':kind==='swim'?'要不要一起游一小段？':'想在这里安静待一会儿吗？',at:now});s.revision++;return null;
}
function finish(s:SocialState,status:SocialEvent['status'],reason:string,now:number):SocialEvent {
  const a=s.activity!,names=a.members.map(id=>s.fish.find(f=>f.id===id)?.name||'离开的伙伴');
  const changes:SocialEvent['changes']=[];const day=new Date(now+8*3600000).toISOString().slice(0,10),dayKey=day+':'+pair(...a.members);
  // Bounded repeat gains; only completed, physically verified activities count.
  const repeats=s.daily[dayKey]||0;
  if(status==='completed'){
    for(const [from,to] of [a.members,[...a.members].reverse()]){
      const key=relationKey(from,to),r=s.relationships[key]||{from,to,familiar:0,closeness:0,trust:0,count:0,lastEvent:'',updatedAt:now};
      const familiar=repeats<6?Math.min(a.kind==='meet'?2:1,100-r.familiar):0;
      const closeness=repeats<4&&a.kind!=='meet'?Math.min(from===a.members[0]?2:1,100-r.closeness):0;
      r.familiar+=familiar;r.closeness+=closeness;r.count++;r.lastEvent=a.id;r.updatedAt=now;s.relationships[key]=r;changes.push({from,to,familiar,closeness});
    }
    s.daily[dayKey]=repeats+1;
  }
  for(const key of Object.keys(s.daily))if(!key.startsWith(day+':'))delete s.daily[key];
  const title=status==='completed'?`${names[0]}与${names[1]}${a.kind==='meet'?'互相认识了':a.kind==='swim'?'完成了一次同游':'安静相伴了一会儿'}`:status==='declined'?`${names[1]}想先休息一会儿`:'这次互动暂时告一段落';
  const event:SocialEvent={id:a.id,kind:a.kind,status,members:a.members,title,summary:reason,reason,at:now,duration:Math.round(a.valid),dialogue:[...a.dialogue],changes};
  for(const id of a.members)s.cooldown[id]=s.world.time+45+s.world.random()*45;
  s.pairCooldown[pair(...a.members)]=s.world.time+(status==='declined'?120:240);
  s.activity=null;s.world.intents?.clear();s.nextDecision=s.world.time+8+s.world.random()*10;s.revision++;return event;
}
export function pauseSocial(s:SocialState,now=Date.now(),reason='塘主暂停了自动互动，伙伴们各自休息。') {s.enabled=false;s.revision++;return s.activity?[finish(s,'interrupted',reason,now)]:[];}
export function advanceSocial(s:SocialState,dt:number,now=Date.now()):SocialEvent[] {
  const result:SocialEvent[]=[];dt=Math.min(.2,Math.max(0,dt));const a=s.activity;
  s.world.intents=new Map();
  if(a){
    const swimmers=a.members.map(id=>s.world.fish.find(f=>f.id===id));
    if(swimmers.some(f=>!f)){result.push(finish(s,'interrupted','伙伴离开了，本次活动结束。',now));}
    else {
      const [left,right]=swimmers as [Swimmer,Swimmer];a.elapsed+=dt;
      if(a.phase==='inviting'&&a.elapsed>=2){
        const familiarity=s.relationships[relationKey(right.id,left.id)]?.familiar||0;
        const acceptance=Math.min(.92,.5+right.social*.25+right.energy*.15+familiarity*.002);
        if(right.energy<.22||s.world.random()>acceptance){a.dialogue.push({fishId:right.id,text:'我想先休息一下，我们晚点再聊吧。',at:now});result.push(finish(s,'declined','对方婉拒了邀请，没有降低关系。',now));}
        else{a.phase='approaching';a.elapsed=0;a.dialogue.push({fishId:right.id,text:a.kind==='company'?'好，我们安静待一会儿。':'好呀，我这就过来。',at:now});s.revision++;}
      }
      if(s.activity&&a.phase!=='inviting'){
        const gap=Math.hypot(left.x-right.x,left.y-right.y),near=gap<Math.max(280,left.width*1.7)&&visible(left,right);
        if(a.phase==='approaching'){
          const arrived=swimmers.every((f,i)=>Math.hypot(f!.x-a.slots[i].x,f!.y-a.slots[i].y)<45)&&near;
          a.stable=arrived?a.stable+dt:0;
          if(a.stable>=1.2){a.phase='interacting';a.elapsed=0;a.travelStart=swimmers.map(f=>f!.distance);a.dialogue.push({fishId:left.id,...(a.prepared?{source:'ai' as const,model:a.prepared.model}:{}),text:a.prepared?.lines[0]||(a.kind==='meet'?'很高兴认识你，慢慢熟悉这片水域吧。':a.kind==='swim'?'这个节奏刚刚好，我们一起慢慢游。':'不用急着说话，在这里歇一会儿也很好。'),at:now});s.revision++;}
          else if(a.elapsed>35)result.push(finish(s,'interrupted','这次没有顺利会合，先各自探索，不影响关系。',now));
        }else{
          if(near)a.valid+=dt;
          if(a.kind==='swim'&&a.elapsed<1){
            const candidates=[{x:80,y:50},{x:-80,y:50},{x:0,y:-75}];
            for(const d of candidates){const next=a.slots.map(p=>({x:p.x+d.x,y:p.y+d.y}));if(next.every((p,i)=>canOccupy(p.x,p.y,swimmers[i]!.width,swimmers[i]!.height,10)&&visible(swimmers[i]!,p))){a.slots=next;a.elapsed=1;break;}}
          }
          if(a.valid>5&&a.dialogue.length===3)a.dialogue.push({fishId:right.id,...(a.prepared?{source:'ai' as const,model:a.prepared.model}:{}),text:a.prepared?.lines[1]||(a.kind==='meet'?'下次见面，我会记得你的。':a.kind==='swim'?'有你一起，沿途也变得有趣了。':'谢谢你的陪伴，我想慢慢放松下来。'),at:now});
          if(a.valid>=(a.kind==='meet'?9:a.kind==='swim'?18:16)&&(a.kind!=='swim'||swimmers.every((f,i)=>f!.distance-(a.travelStart?.[i]??f!.distance)>25)))result.push(finish(s,'completed',a.kind==='meet'?'双方接受邀请、游近并完成问候，留下第一次认识的记忆。':a.kind==='swim'?'双方会合后在可见距离内同行，记住了这次共同经历。':'双方同意并安静相伴，没有强求对方聊天。',now));
          else if(a.elapsed>40)result.push(finish(s,'interrupted','途中没有持续保持相伴，本次活动提前结束。',now));
        }
        if(s.activity)a.members.forEach((id,i)=>{const f=swimmers[i]!,other=swimmers[1-i]!;s.world.intents!.set(id,{...a.slots[i],face:Math.atan2(other.y-f.y,other.x-f.x),pace:a.phase==='interacting'?.55:.85});});
      }
    }
  }
  if(s.enabled&&!s.activity&&s.world.time>=s.nextDecision){
    s.nextDecision=s.world.time+8+s.world.random()*8;
    const candidates=s.world.fish.filter(f=>ready(s,f.id)&&f.energy>.3);
    const scored:{a:string;b:string;score:number}[]=[];
    for(let i=0;i<candidates.length;i++)for(let j=i+1;j<candidates.length;j++){
      const a=candidates[i],b=candidates[j],distance=Math.hypot(a.x-b.x,a.y-b.y);
      if(distance>400||(s.pairCooldown[pair(a.id,b.id)]||0)>s.world.time||!visible(a,b))continue;
      const r=s.relationships[relationKey(a.id,b.id)];scored.push({a:a.id,b:b.id,score:s.world.random()*2+(r?Math.min(.6,r.closeness*.02):.45)-distance/650});
    }
    scored.sort((a,b)=>b.score-a.score);const best=scored[0];
    if(best){const known=s.relationships[relationKey(best.a,best.b)];invite(s,best.a,best.b,known?(s.world.random()<.6?'swim':'company'):'meet',now);}
  }
  for(let remaining=dt;remaining>1e-6;remaining-=1/60)stepWorld(s.world,Math.min(remaining,1/60));
  return result;
}
