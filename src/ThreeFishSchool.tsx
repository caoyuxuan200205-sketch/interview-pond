import {useEffect,useRef,type RefObject} from 'react';
import type {Fish} from './data';
import type {createSchoolRenderer,SchoolPose} from './fish-renderer';
import type {MouthAnchor} from './mouth-bubbles';
type Renderer=ReturnType<typeof createSchoolRenderer>;
export default function ThreeFishSchool({fish,poses,mouths,active,motion,onReady,onError}:{fish:Fish[];poses:RefObject<Map<string,SchoolPose>>;mouths:RefObject<Map<string,MouthAnchor>>;active:boolean;motion:boolean;onReady:()=>void;onError:()=>void}){
  const canvas=useRef<HTMLCanvasElement>(null),renderer=useRef<Renderer|null>(null),resume=useRef(()=>{});
  const settings=useRef({fish,active,motion,onReady,onError});settings.current={fish,active,motion,onReady,onError};
  useEffect(()=>{
    let disposed=false,frame=0,previous=0;const reduced=matchMedia('(prefers-reduced-motion: reduce)');
    const enabled=()=>settings.current.active&&settings.current.motion&&!document.hidden&&!reduced.matches;
    const tick=(now:number)=>{if(disposed||!enabled())return;if(previous&&settings.current.fish.length>24&&now-previous<1000/30){frame=requestAnimationFrame(tick);return;}const dt=previous?(now-previous)/1000:0;previous=now;renderer.current?.draw(poses.current,dt,true,mouths.current);frame=requestAnimationFrame(tick);};
    const restart=()=>{cancelAnimationFrame(frame);previous=0;if(disposed||!renderer.current)return;if(settings.current.active&&!document.hidden)renderer.current.draw(poses.current,0,enabled(),mouths.current);if(enabled())frame=requestAnimationFrame(tick);};resume.current=restart;
    const fail=()=>{if(!disposed){cancelAnimationFrame(frame);settings.current.onError();}};
    const lost=(event:Event)=>{event.preventDefault();fail();};const el=canvas.current!;el.addEventListener('webglcontextlost',lost);
    document.addEventListener('visibilitychange',restart);reduced.addEventListener('change',restart);
    import('./fish-renderer').then(({createSchoolRenderer})=>{if(disposed)return;try{renderer.current=createSchoolRenderer(el);renderer.current.sync(settings.current.fish);restart();settings.current.onReady();}catch{fail();}}).catch(fail);
    return()=>{disposed=true;cancelAnimationFrame(frame);resume.current=()=>{};document.removeEventListener('visibilitychange',restart);reduced.removeEventListener('change',restart);el.removeEventListener('webglcontextlost',lost);renderer.current?.dispose();renderer.current=null;};
  },[poses,mouths]);
  useEffect(()=>{try{renderer.current?.sync(fish);resume.current();}catch{settings.current.onError();}},[fish]);
  useEffect(()=>resume.current(),[active,motion]);
  return <canvas ref={canvas} className="three-fish-school-canvas" aria-hidden="true"/>;
}
