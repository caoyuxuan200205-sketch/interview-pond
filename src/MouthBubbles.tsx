import {useEffect,useRef,type RefObject} from 'react';
import {advanceMouthBubble,makeMouthBubble,type MouthAnchor,type MouthBubble} from './mouth-bubbles';

const COUNT=18;
export default function MouthBubbles({anchors,active,motion}:{anchors:RefObject<Map<string,MouthAnchor>>;active:boolean;motion:boolean}){
  const root=useRef<HTMLDivElement>(null),settings=useRef({active,motion});settings.current={active,motion};
  const resume=useRef(()=>{});
  useEffect(()=>{
    const layer=root.current!;const nodes=Array.from(layer.querySelectorAll<HTMLElement>('.fish-mouth-bubble'));
    const pool:Array<MouthBubble|null>=Array(COUNT).fill(null);
    const schedules=new Map<string,{wait:number;remaining:number}>();
    const reduced=matchMedia('(prefers-reduced-motion: reduce)');
    let frame=0,previous=0;
    const enabled=()=>settings.current.active&&settings.current.motion&&!document.hidden&&!reduced.matches;
    const tick=(now:number)=>{
      if(!enabled())return;
      if(previous&&now-previous<1000/30){frame=requestAnimationFrame(tick);return;}
      const dt=previous?Math.min(.05,(now-previous)/1000):0;previous=now;
      for(const id of schedules.keys())if(!anchors.current.has(id))schedules.delete(id);
      for(const [id,anchor] of anchors.current){
        let schedule=schedules.get(id);
        if(!schedule){schedule={wait:2+Math.random()*10,remaining:0};schedules.set(id,schedule);}
        schedule.wait-=dt;if(schedule.wait>0)continue;
        if(!anchor.visible){schedule.wait=1.5+Math.random()*2;continue;}
        const slot=pool.findIndex(b=>b===null);
        if(slot<0){schedule.wait=1;continue;}
        pool[slot]=makeMouthBubble(anchor);
        nodes[slot].dataset.fishId=id;
        if(schedule.remaining){schedule.remaining=0;schedule.wait=9+Math.random()*12;}
        else if(Math.random()<.32){schedule.remaining=1;schedule.wait=.22+Math.random()*.18;}
        else schedule.wait=9+Math.random()*12;
      }
      pool.forEach((bubble,i)=>{
        if(!bubble){nodes[i].style.opacity='0';return;}
        // New bubbles detach from the mouth and keep their own water-space trajectory.
        if(!advanceMouthBubble(bubble,dt)){pool[i]=null;nodes[i].style.opacity='0';return;}
        const size=bubble.radius*2*(.7+.3*Math.min(1,bubble.age/.8));
        nodes[i].style.width=nodes[i].style.height=`${size}px`;
        nodes[i].style.transform=`translate3d(${bubble.x-size/2}px,${bubble.y-size/2}px,0)`;
        nodes[i].style.opacity=String(Math.min(1,bubble.age/.12,(bubble.life-bubble.age)/.8,(bubble.y-202)/25)*.74);
      });
      frame=requestAnimationFrame(tick);
    };
    const restart=()=>{cancelAnimationFrame(frame);previous=0;layer.hidden=!enabled();if(enabled())frame=requestAnimationFrame(tick);};
    resume.current=restart;document.addEventListener('visibilitychange',restart);reduced.addEventListener('change',restart);restart();
    return()=>{cancelAnimationFrame(frame);resume.current=()=>{};document.removeEventListener('visibilitychange',restart);reduced.removeEventListener('change',restart);};
  },[anchors]);
  useEffect(()=>resume.current(),[active,motion]);
  return <div ref={root} className="fish-mouth-bubbles" aria-hidden="true">{Array.from({length:COUNT},(_,i)=><i className="fish-mouth-bubble" key={i}/>)}</div>;
}
