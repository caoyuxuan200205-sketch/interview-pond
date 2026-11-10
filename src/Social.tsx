import {usePondMode,demoKey} from "./PondMode";
import {initialFish} from "./data";
import {createSocial,restoreSocial,serializeSocial,syncSocial,advanceSocial,invite,pauseSocial} from "./social-engine";
import {createContext,useContext,useEffect,useRef,useState,type ReactNode,type MutableRefObject} from 'react';
import {useSession} from './Session';
import type {SocialEvent,Relation,SocialKind} from './social-engine';
import type {Fish} from './data';
export type SocialPose={id:string;x:number;y:number;heading:number;pitch:number;cruise:number;effort:number;stroke:number;width:number;height:number;speed:number;angularVelocity:number;mode:string};
export type SocialSnapshot={time:number;revision:number;enabled:boolean;aiEnabled:boolean;aiAvailable:boolean;archiveCount:number;fish:Fish[];poses:SocialPose[];activity:null|{id:string;kind:SocialKind;members:string[];phase:string;dialogue:{fishId:string;text:string;at:number}[]};relationships:Relation[];events:SocialEvent[]};
type Frames={previous:SocialPose[];current:SocialPose[];received:number;interval:number};
type Value={snapshot:SocialSnapshot|null;frames:MutableRefObject<Frames|null>;error:string;pending:boolean;loggedIn:boolean;demo:boolean;simulated:boolean;command:(action:'invite'|'settings',body:unknown)=>Promise<void>};
const Context=createContext<Value|null>(null);
export function SocialProvider({children}:{children:ReactNode}){
  const {user}=useSession();const {demo}=usePondMode();const demoAction=useRef<((action:string,body:unknown)=>void)|null>(null);const [snapshot,setSnapshot]=useState<SocialSnapshot|null>(null),[error,setError]=useState(''),[pending,setPending]=useState(false);
  const frames=useRef<Frames|null>(null),signature=useRef(''),generation=useRef(0),busy=useRef(false),errorUntil=useRef(0);
  const accept=(value:SocialSnapshot)=>{
    const received=performance.now(),old=frames.current;
    frames.current={previous:old?.current||value.poses,current:value.poses,received,interval:old?Math.min(1200,Math.max(100,received-old.received)):400};
    const key=JSON.stringify([value.revision,value.fish,value.activity?.dialogue.length,value.events[0]?.id,value.enabled,value.aiEnabled,value.aiAvailable]);
    if(key!==signature.current){signature.current=key;setSnapshot(value);}if(performance.now()>errorUntil.current)setError('');
  };
  useEffect(()=>{
    const version=++generation.current;frames.current=null;signature.current='';setSnapshot(null);setError('');
    if(demo){
      const roster=()=>{try{const added=JSON.parse(sessionStorage.getItem(demoKey('pond-fish-v1'))||'[]');return [...initialFish,...(Array.isArray(added)?added.filter(f=>f&&typeof f.id==='string'&&!initialFish.some(i=>i.id===f.id)&&typeof f.name==='string'&&Array.isArray(f.traits)&&Number.isInteger(f.sprite)):[])];}catch{return initialFish;}};
      let world=createSocial(roster()),events:SocialEvent[]=[];
      try{const saved=JSON.parse(sessionStorage.getItem(demoKey('world'))||'null');if(saved){world=restoreSocial(saved.state,roster());events=saved.events.slice(0,200);}}catch{/* A broken demo cache never affects an account. */}
      const publish=()=>accept({time:world.world.time,revision:world.revision,enabled:world.enabled,aiEnabled:false,aiAvailable:false,archiveCount:0,fish:roster(),activity:world.activity,poses:world.world.fish.map(f=>({...f})),relationships:Object.values(world.relationships),events});
      const remember=()=>{try{sessionStorage.setItem(demoKey('world'),JSON.stringify({state:serializeSocial(world),events}));}catch{/* Demo is best effort and disposable. */}};
      const addEvents=(next:SocialEvent[])=>{events=[...next.reverse(),...events].slice(0,200);};
      const sync=()=>{addEvents(syncSocial(world,roster()));publish();};
      demoAction.current=(action,body)=>{const v=body as {enabled?:boolean;from:string;to:string;kind:'meet'|'swim'|'company'};if(action==='settings'){if(v.enabled===false)addEvents(pauseSocial(world));if(typeof v.enabled==='boolean')world.enabled=v.enabled;}else{const error=invite(world,v.from,v.to,v.kind);if(error){errorUntil.current=performance.now()+6000;setError(error);}}world.revision++;publish();remember();};
      let ticks=0;publish();const timer=setInterval(()=>{if(document.hidden)return;addEvents(advanceSocial(world,.1));if(++ticks%4===0)publish();if(ticks%20===0)remember();},100);
      window.addEventListener('pond-demo-update',sync);return()=>{clearInterval(timer);window.removeEventListener('pond-demo-update',sync);demoAction.current=null;remember();};
    }
    if(!user)return;
    let stopped=false,timer=0;const abort=new AbortController();
    async function poll(){
      if(stopped)return;
      if(!document.hidden&&!/^#\/(login|register)/.test(location.hash))try{
        const response=await fetch('/api/social/pulse',{method:'POST',headers:{'Content-Type':'application/json','X-Pond-Request':'1'},body:'{}',signal:AbortSignal.any([abort.signal,AbortSignal.timeout(6000)])});
        const data=await response.json();if(!response.ok)throw new Error(data.error||'社交服务暂时无法连接');if(version===generation.current)accept(data);
      }catch(e){if(!stopped&&version===generation.current)setError(e instanceof Error?e.message:'社交服务暂时无法连接');}
      timer=window.setTimeout(poll,400);
    }
    void poll();return()=>{stopped=true;abort.abort();clearTimeout(timer);};
  },[user?.id,demo]);
  async function command(action:'invite'|'settings',body:unknown){
    if(demo){demoAction.current?.(action,body);return;}
    if(!user||busy.current)return;busy.current=true;setPending(true);const version=generation.current;
    try{const response=await fetch('/api/social/'+action,{method:'POST',headers:{'Content-Type':'application/json','X-Pond-Request':'1'},body:JSON.stringify(body),signal:AbortSignal.timeout(8000)});const data=await response.json();if(!response.ok)throw new Error(data.error||'暂时无法发起互动');if(version===generation.current){errorUntil.current=0;accept(data);}}
    catch(e){if(version===generation.current){errorUntil.current=performance.now()+6000;setError(e instanceof Error?e.message:'请求失败');}}finally{busy.current=false;setPending(false);}
  }
  return <Context.Provider value={{snapshot,frames,error,pending,loggedIn:!!user&&!demo,demo,simulated:!!user||demo,command}}>{children}</Context.Provider>;
}
export function useSocial(){const context=useContext(Context);if(!context)throw new Error('SocialProvider missing');return context;}
export const socialTime=(at:number)=>new Date(at).toLocaleString('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});
export const socialLabels={meet:'初次认识',swim:'相伴同游',company:'安静陪伴'};
export function SocialNotice(){const {error,loggedIn,demo}=useSocial();return demo?<p className="social-note">演示中的相遇仅用于体验，不进入个人关系、日报或 AI 调用。</p>:!loggedIn?<p className="social-note">登录后，伙伴们会拥有持续保存的关系与共同记忆。<a href="#/login">登录 / 注册</a></p>:error?<p className="social-note" role="status">{error} · 已有记忆仍会保留。</p>:null;}
