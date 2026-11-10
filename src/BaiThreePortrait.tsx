import {useEffect,useRef,useState,type RefObject} from 'react';
import type {BaiPose} from './bai-motion';
import type {createBaiRenderer} from './bai-model';
import type {Fish} from './data';
type Renderer=ReturnType<typeof createBaiRenderer>;

export default function BaiThreePortrait({pose,fish,active=true,motion=true,revision=0,onError}:{pose:RefObject<BaiPose>;fish?:Fish;active?:boolean;motion?:boolean;revision?:number;onError?:()=>void}){
  const canvas=useRef<HTMLCanvasElement>(null),renderer=useRef<Renderer|null>(null),resume=useRef(()=>{});
  const settings=useRef({active,motion,onError});settings.current={active,motion,onError};
  const [status,setStatus]=useState<'loading'|'ready'|'error'>('loading');
  useEffect(()=>{
    let disposed=false,frame=0,previous=0;setStatus('loading');
    const reduced=matchMedia('(prefers-reduced-motion: reduce)');
    const animate=()=>settings.current.active&&settings.current.motion&&!reduced.matches&&!document.hidden;
    const tick=(now:number)=>{if(disposed||!animate())return;const dt=previous?(now-previous)/1000:0;previous=now;renderer.current?.draw(pose.current,dt,true);frame=requestAnimationFrame(tick);};
    const restart=()=>{cancelAnimationFrame(frame);previous=0;if(disposed||!renderer.current)return;if(settings.current.active&&!document.hidden)renderer.current.draw(pose.current,0,animate());if(animate())frame=requestAnimationFrame(tick);};
    resume.current=restart;
    const fail=()=>{if(disposed)return;cancelAnimationFrame(frame);setStatus('error');settings.current.onError?.();};
    const lost=(e:Event)=>{e.preventDefault();fail();};
    const el=canvas.current!;el.addEventListener('webglcontextlost',lost);
    document.addEventListener('visibilitychange',restart);reduced.addEventListener('change',restart);
    import('./bai-model').then(({createBaiRenderer})=>{if(disposed)return;try{renderer.current=createBaiRenderer(el,fish);setStatus('ready');restart();}catch{fail();}}).catch(fail);
    return()=>{disposed=true;resume.current=()=>{};cancelAnimationFrame(frame);document.removeEventListener('visibilitychange',restart);reduced.removeEventListener('change',restart);el.removeEventListener('webglcontextlost',lost);renderer.current?.dispose();renderer.current=null;};
  },[pose,fish?.sprite,fish?.skin]);
  useEffect(()=>resume.current(),[active,motion,revision]);
  return <span className="bai-three-portrait" data-status={status}>
    <canvas ref={canvas} aria-label={`${fish?.name??'阿白'}的实时三维模型`} role="img"/>
    {status==='loading'&&<span className="bai-three-status">伙伴准备中…</span>}
    {status==='error'&&<span className="bai-three-status" role="status">此设备暂时无法显示三维效果，请返回插画模式。</span>}
  </span>;
}
