import { useEffect, useMemo, useRef, useState } from 'react';
import { FishPortrait } from './components';
import { species } from './appearance';
import portraitBounds from './portrait-bounds.json';
import type { Fish } from './data';
import { createWorld, syncWorld, stepWorld, sampleSwimmer, type World } from './swim';
import './fish-school.css';
import BaiTurnPortrait, { BAI_TURN_ASSET, hasTurnArtwork } from './BaiTurnPortrait';
import { advanceTurn, createTurn, type TurnState } from './turn';
import ThreeFishSchool from './ThreeFishSchool';
import type {SchoolPose} from './fish-renderer';
import BaiThreeLab from './BaiThreeLab';
import {headingToYaw,angleDifference} from './bai-motion';
import MouthBubbles from './MouthBubbles';
import type {MouthAnchor} from './mouth-bubbles';
import {useSocial,socialLabels} from './Social';

const nativeFacing = [1,1,-1,1,1,-1,-1,-1,-1,-1,-1,-1];
const modeNames = {explore:'轻摆尾鳍，探索水域',glide:'顺着水流滑行',rest:'安静悬游，歇一会儿',school:'留意身边的伙伴'};
function artwork(fish: Fish) {
  const skinned=Number.isInteger(fish.skin)&&fish.skin!>=0&&fish.skin!<=16;
  const key=skinned?(fish.skin===16?'internet':species[fish.sprite]):'original';
  const index=skinned&&fish.skin!==16?fish.skin!:fish.sprite;
  const [l,t,r,b]=(portraitBounds as Record<string,number[][]>)[key]?.[index]||[0,0,1,1];
  const scale=Math.min(180/((r-l)*240),120/((b-t)*240));
  return `translate(${(.5-(l+r)/2)*240*scale}px,${(.5-(t+b)/2)*240*scale}px) scale(${scale})`;
}
export default function FishSchool({fish,active,motion,go,guideFish}:{fish:Fish[];active:boolean;motion:boolean;go:(path:string)=>void;guideFish?:string}) {
  const social=useSocial();
  const remote=useRef(social);remote.current=social;
  const root=useRef<HTMLDivElement>(null),world=useRef<World|null>(null);
  const held=useRef<string|null>(null),[selected,setSelected]=useState<string|null>(null);
  const [pace,setPace]=useState(1);
  const paceRef=useRef(pace);paceRef.current=pace;
  const [showNames,setShowNames]=useState(false);
  const [three,setThree]=useState(false),[threeFailed,setThreeFailed]=useState(false),[lab,setLab]=useState(false);
  const threePoses=useRef(new Map<string,SchoolPose>()),greetCursor=useRef(0);
  const mouths=useRef(new Map<string,MouthAnchor>());
  const [threeReady,setThreeReady]=useState(false);
  const useThree=three&&!threeFailed;
  const turns=useRef(new Map<string,TurnState>()),greeting=useRef<string|null>(null);
  const greetingTime=useRef(0);
  const greetingYaw=useRef(0),greetingFront=useRef(0);
  const [turnReady,setTurnReady]=useState(false),[greetingActive,setGreetingActive]=useState(false),[systemReduced,setSystemReduced]=useState(false);
  useEffect(()=>{const image=new Image();image.onload=()=>setTurnReady(true);image.src=BAI_TURN_ASSET;return()=>{image.onload=null;};},[]);
  const shapes=useMemo(()=>new Map(fish.map(f=>[f.id,artwork(f)])),[fish]);
  useEffect(()=>{
    const container=root.current;if(!container)return;
    if(world.current)syncWorld(world.current,fish);else world.current=createWorld(fish);
    const pond=world.current;
    const nodes=new Map(Array.from(container.querySelectorAll<HTMLElement>('[data-fish-id]')).map(e=>[e.dataset.fishId!,{node:e,body:e.querySelector<HTMLElement>('.free-fish-body')!,facing:e.querySelector<HTMLElement>('.free-fish-facing')!,frames:Array.from(e.querySelectorAll<HTMLElement>('[data-turn-frame]')),label:e.querySelector<HTMLElement>('.fish-behavior')!}]));
    const info=new Map(fish.map(f=>[f.id,f]));
    for(const swimmer of pond.fish)if(!turns.current.has(swimmer.id))turns.current.set(swimmer.id,createTurn(swimmer.facing));
    for(const id of turns.current.keys())if(!info.has(id))turns.current.delete(id);
    for(const id of threePoses.current.keys())if(!info.has(id))threePoses.current.delete(id);
    for(const id of mouths.current.keys())if(!info.has(id))mouths.current.delete(id);
    if(greeting.current&&!info.has(greeting.current)){greeting.current=null;setGreetingActive(false);}
    const reduced=matchMedia('(prefers-reduced-motion: reduce)');
    let frame=0,previous=0;
    const paint=()=>{
      for(const swimmer of pond.fish) {
        const ui=nodes.get(swimmer.id);if(!ui)continue;
        const pose=sampleSwimmer(pond,swimmer);
        const frames=remote.current.frames.current;
        if(frames){const next=frames.current.find(p=>p.id===swimmer.id),prev=frames.previous.find(p=>p.id===swimmer.id)||next;
          if(next&&prev){const t=Math.min(1,Math.max(0,(performance.now()-frames.received)/frames.interval));
            for(const key of ['x','y','pitch','cruise','effort','stroke'] as const)pose[key]=prev[key]+(next[key]-prev[key])*t;
            pose.heading=prev.heading+angleDifference(next.heading,prev.heading)*t;
            swimmer.width=next.width;swimmer.height=next.height;swimmer.angularVelocity=next.angularVelocity;swimmer.speed=next.speed;swimmer.facing=Math.cos(pose.heading)>=0?1:-1;
          }
        }
        if(!useThree)mouths.current.set(swimmer.id,{x:pose.x+swimmer.facing*swimmer.width*.32,y:pose.y-swimmer.height*.06,dx:swimmer.facing,dy:0,visible:true});
        ui.node.style.transform=`translate3d(${pose.x-swimmer.width/2}px,${pose.y-swimmer.height/2}px,0)`;
        ui.node.style.width=`${swimmer.width}px`;ui.node.style.height=`${swimmer.height}px`;
        ui.node.style.setProperty('--fish-size',String(swimmer.width/180));
        ui.node.style.zIndex=held.current===swimmer.id?'5':String(1+Math.floor((swimmer.y-210)/200));
        ui.node.dataset.below=String(swimmer.y<420);
        ui.node.dataset.arrival=String(swimmer.arrival>0);
        ui.body.style.transform=`rotate(${pose.pitch}deg)`;
        const turn=turns.current.get(swimmer.id);
        if((ui.frames.length||useThree)&&turn) {
          ui.facing.style.transform='none';
          if(useThree){
            let yaw=headingToYaw(pose.heading);
            if(greeting.current===swimmer.id){
              const t=greetingTime.current;
              const weight=t<.8?(1-Math.cos(t/.8*Math.PI))/2:t<1.6?1:(1+Math.cos(Math.min(1,(t-1.6)/1.2)*Math.PI))/2;
              greetingYaw.current+=angleDifference(yaw,greetingYaw.current);
              yaw=greetingYaw.current+(greetingFront.current-greetingYaw.current)*weight;
            }
            threePoses.current.set(swimmer.id,{yaw,moving:pose.cruise>2,effort:pose.effort,stroke:pose.stroke,speedRatio:pose.cruise/swimmer.speed,turnRate:-swimmer.angularVelocity,x:pose.x,y:pose.y,width:swimmer.width,height:swimmer.height,pitch:pose.pitch,held:held.current===swimmer.id});
          }
          // Two neighboring view drawings blend briefly; their silhouette never collapses.
          const first=Math.floor(turn.pose),mix=turn.pose-first;
          for(let i=0;i<ui.frames.length;i++)ui.frames[i].style.opacity=String(i===first?1-mix:i===first+1?mix:0);
          ui.node.dataset.turnPose=turn.pose.toFixed(2);
          ui.node.dataset.greeting=String(greeting.current===swimmer.id);
        } else ui.facing.style.transform=`scaleX(${swimmer.facing/nativeFacing[info.get(swimmer.id)!.sprite]})`;
        ui.node.dataset.motion='natural';ui.node.dataset.behavior=swimmer.mode;
        const activity=remote.current.snapshot?.activity;
        const socialLabel=activity?.members.includes(swimmer.id)?(activity.phase==='inviting'?'正在询问伙伴':activity.phase==='approaching'?'正游向伙伴':socialLabels[activity.kind]):null;
        const label=socialLabel|| (greeting.current===swimmer.id?'正在向你打招呼':held.current===swimmer.id?'点击查看档案':swimmer.arrival>0?'新伙伴正在熟悉鱼塘':swimmer.mode==='school'&&swimmer.buddyId?'和附近的伙伴一起游':modeNames[swimmer.mode]);
        if(ui.label.textContent!==label)ui.label.textContent=label;
      }
    };
    const tick=(now:number)=>{
      if(!useThree&&previous&&now-previous<1000/30){frame=requestAnimationFrame(tick);return;}
      const dt=previous?(now-previous)/1000:0;previous=now;
      const speedFactors=new Map<string,number>();
      if(greeting.current){
        greetingTime.current+=Math.min(.05,dt);
        if(greetingTime.current>=2.8){greeting.current=null;setGreetingActive(false);}
        else speedFactors.set(greeting.current,.35);
      }
      if(!remote.current.simulated)stepWorld(pond,dt,held.current,paceRef.current,speedFactors);
      for(const swimmer of pond.fish) {
        const turn=turns.current.get(swimmer.id);if(!turn)continue;
        const horizontal=Math.cos(swimmer.heading);
        const desired=Math.abs(horizontal)>.4?(horizontal>0?1:-1):(turn.target<4?1:-1);
        // Legacy illustration frames are a fallback only; they never slow the swimmer.
        if(!useThree&&held.current!==swimmer.id)advanceTurn(turn,desired,dt);
      }
      paint();frame=requestAnimationFrame(tick);
    };
    const resume=()=>{
      cancelAnimationFrame(frame);previous=0;paint();
      setSystemReduced(reduced.matches);
      if(active&&motion&&!lab&&!document.hidden&&!reduced.matches)frame=requestAnimationFrame(tick);
    };
    document.addEventListener('visibilitychange',resume);reduced.addEventListener('change',resume);resume();
    return()=>{cancelAnimationFrame(frame);document.removeEventListener('visibilitychange',resume);reduced.removeEventListener('change',resume);};
  },[fish,active,motion,turnReady,useThree,lab]);
  const hold=(id:string|null)=>{held.current=id;setSelected(id);};
  useEffect(()=>{if(!active){hold(null);setLab(false);}},[active]);
  const greetFish=()=>{
    const swimmers=world.current?.fish;if(!swimmers?.length)return;
    const swimmer=swimmers[greetCursor.current++%swimmers.length];
    if(!swimmer||!motion||systemReduced)return;
    greetingYaw.current=headingToYaw(swimmer.heading);
    greetingFront.current=greetingYaw.current+angleDifference(0,greetingYaw.current);
    greeting.current=swimmer.id;greetingTime.current=0;setGreetingActive(true);
  };
  return <>
    <div ref={root} className={`fish-school ${showNames?'show-fish-names':''} ${useThree&&threeReady?'school-3d-ready':''}`} aria-label="自由游动的鱼群">
      {useThree&&<ThreeFishSchool fish={fish} poses={threePoses} mouths={mouths} active={active&&!lab} motion={motion} onReady={()=>setThreeReady(true)} onError={()=>{setThreeFailed(true);setThreeReady(false);}}/>}
      {social.snapshot?.activity&&<div className="social-live-bubble" role="status"><span>{social.snapshot.activity.members.map(id=>fish.find(f=>f.id===id)?.name||'伙伴').join(' · ')} · {socialLabels[social.snapshot.activity.kind]}</span><strong>{social.snapshot.activity.phase==='approaching'?'正在慢慢靠近…':social.snapshot.activity.dialogue.at(-1)?.text}</strong></div>}
      <MouthBubbles anchors={mouths} active={active&&!lab} motion={motion}/>
      {fish.map(f=><button key={f.id} data-fish-id={f.id} data-guide-fish={f.id===guideFish||undefined} className={`free-fish ${selected===f.id?'is-held':''}`} aria-label={`打开${f.name}的档案`} onPointerEnter={e=>{if(e.pointerType!=='touch')hold(f.id);}} onPointerLeave={()=>hold(null)} onFocus={()=>hold(f.id)} onBlur={()=>hold(null)} onClick={()=>go(`fish/${f.id}`)}>
        <span className="free-fish-size"><span className="free-fish-body"><span className={`free-fish-facing ${turnReady&&hasTurnArtwork(f)?'has-turn-frames':''}`}>{turnReady&&hasTurnArtwork(f)?<BaiTurnPortrait name={f.name}/>:<span className="free-fish-art" style={{transform:shapes.get(f.id)}}><FishPortrait fish={f} size={240}/></span>}</span></span></span>
        <span className="free-fish-label"><strong>{f.name}</strong><small className="fish-job">{f.role}</small><small className="fish-behavior">探索水域</small></span>
      </button>)}
    </div>
    <div className="school-controls" aria-label="鱼群游动设置"><span>水中时光</span><button disabled={social.simulated} aria-pressed={pace===.65} onClick={()=>setPace(.65)}>悠闲</button><button disabled={social.simulated} aria-pressed={pace===1} onClick={()=>setPace(1)}>灵动</button><i/><button aria-pressed={showNames} onClick={()=>setShowNames(v=>!v)}>鱼名{showNames?'：开':'：关'}</button>{fish.length>0&&<><i/><button disabled={!motion||systemReduced||greetingActive} onClick={greetFish} title="依次邀请一位伙伴转过头来">{greetingActive?'伙伴回应中…':'招呼伙伴'}</button><button aria-pressed={useThree} disabled={threeFailed} onClick={()=>{setThreeReady(false);setThree(v=>!v);}}>{useThree?'鱼群：3D':'鱼群：插画'}</button><button onClick={()=>setLab(true)}>放大看看</button></>}</div>
    {threeFailed&&<span className="bai-fallback-note" role="status">三维暂不可用，已保留插画显示</span>}
    {lab&&fish.length>0&&<BaiThreeLab fish={fish} motion={motion} onClose={()=>setLab(false)}/>}
  </>;
}
