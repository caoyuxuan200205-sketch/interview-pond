import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type {Fish} from './data';
export type Account = { id:string; email:string; name:string; createdAt:string };
type SessionData = { user:Account|null; values:Record<string,unknown>; revisions:Record<string,number> };
type SessionContext = SessionData & { ready:boolean; error:string; refresh:()=>Promise<void>; authenticate:(mode:'login'|'register',form:{email:string;password:string;name?:string})=>Promise<boolean>; logout:()=>Promise<void>; save:(key:string,value:unknown)=>Promise<void>; createFish:(fish:Fish)=>Promise<Fish[]>; flush:()=>Promise<void> };
const Context = createContext<SessionContext | null>(null);
const empty:SessionData = { user:null, values:{}, revisions:{} };
class RequestError extends Error { constructor(message:string, readonly status:number) { super(message); } }
export async function accountRequest(path:string, init:RequestInit={}) {
  const response = await fetch(path,{ credentials:'same-origin', ...init, headers:{'Content-Type':'application/json','X-Pond-Request':'1',...init.headers}, signal:init.signal || AbortSignal.timeout(15000) });
  let data; try { data=await response.json(); } catch { throw new Error('账号服务暂时不可用，请检查后端是否启动。'); }
  if(!response.ok)throw new RequestError(data.error || '请求失败，请重试。',response.status);
  return data;
}
const request=accountRequest;
let callbackTask:Promise<void>|null=null;
async function acceptEmailCallback(){
  if(callbackTask)return callbackTask;
  const fragment=new URLSearchParams(window.location.hash.slice(1));
  if(fragment.has('error_description')){const message=fragment.get('error_description');history.replaceState(null,'',location.pathname+'#/login');throw new Error(message||'邮箱确认链接已失效。');}
  const accessToken=fragment.get('access_token'),refreshToken=fragment.get('refresh_token');
  if(!accessToken||!refreshToken)return;
  const recovery=fragment.get('type')==='recovery'||new URLSearchParams(location.search).get('auth')==='recovery';
  // Remove credentials from the URL immediately; they are exchanged for HttpOnly cookies.
  history.replaceState(null,'',location.pathname+(recovery?'?auth=recovery':'')+'#/login');
  callbackTask=request('/api/auth/callback',{method:'POST',body:JSON.stringify({accessToken,refreshToken})}).then(()=>{});
  try{await callbackTask;}finally{callbackTask=null;}
}
export function SessionProvider({children}:{children:ReactNode}) {
  const [state,setState]=useState<SessionData>(empty), [ready,setReady]=useState(false), [error,setError]=useState('');
  const current=useRef(state), queues=useRef(new Map<string,Promise<void>>()), errors=useRef(new Map<string,string>());
  const channel=useRef<BroadcastChannel|null>(null), generation=useRef(0), booted=useRef(false);
  const commit=useCallback((next:SessionData)=>{ current.current=next;booted.current=true;setState(next);setReady(true);setError(''); },[]);
  const refresh=useCallback(async()=>{
    const sequence=++generation.current;
    try {
      await acceptEmailCallback();
      const result=await request('/api/auth/session');
      if(sequence!==generation.current)return;
      if(!result.user) {commit(empty);return;}
      // Keep mounted forms on ordinary focus checks; rehydrate on identity change.
      if(current.current.user?.id===result.user.id){setReady(true);return;}
      const pond=await request('/api/pond/state');
      if(sequence!==generation.current)return;
      if(pond.userId!==result.user.id)throw new Error('账号已在另一窗口切换，请重新加载。');
      queues.current.clear();errors.current.clear();
      commit({user:result.user,values:pond.values,revisions:pond.revisions});
    } catch(e) {if(sequence===generation.current && !booted.current){setError(e instanceof Error?e.message:'无法连接账号服务。');setReady(true);}}
  },[commit]);
  useEffect(()=>{
    void refresh();
    const focus=()=>{if(document.visibilityState==='visible')void refresh();};
    window.addEventListener('focus',focus);document.addEventListener('visibilitychange',focus);
    if(typeof BroadcastChannel!=='undefined'){channel.current=new BroadcastChannel('pond-session');channel.current.onmessage=()=>void refresh();}
    return ()=>{generation.current++;window.removeEventListener('focus',focus);document.removeEventListener('visibilitychange',focus);channel.current?.close();};
  },[refresh]);
  const authenticate=async(mode:'login'|'register',form:{email:string;password:string;name?:string})=>{
    const result=await request('/api/auth/'+mode,{method:'POST',body:JSON.stringify(form)});
    if(result.confirmationRequired)return false;
    await refresh();
    if(!current.current.user)throw new Error('账号已验证，但鱼塘未能加载，请刷新重试。');
    window.location.hash='/home';channel.current?.postMessage('changed');return true;
  };
  const save=useCallback((key:string,value:unknown)=>{
    const userId=current.current.user?.id;
    if(!userId)return Promise.reject(new Error('请先登录。'));
    const task=(queues.current.get(key)||Promise.resolve()).catch(()=>{}).then(async()=>{
      if(current.current.user?.id!==userId)throw new Error('账号已切换，本次保存已停止。');
      try {
        const result=await request('/api/pond/state/'+key,{method:'PUT',headers:{'X-Pond-User':userId},body:JSON.stringify({value,revision:current.current.revisions[key]||0})});
        if(current.current.user?.id===userId){current.current.revisions[key]=result.revision;current.current.values[key]=value;errors.current.delete(key);}
      } catch(e) {
        errors.current.set(key,e instanceof Error?e.message:'保存失败');
        if(e instanceof RequestError && e.status===401)void refresh();
        throw e;
      }
    });
    queues.current.set(key,task);return task;
  },[refresh]);
  const createFish=useCallback((fish:Fish)=>{
    const id=current.current.user?.id;if(!id)return Promise.reject(new Error('请先登录。'));
    const task=(queues.current.get('pond-fish-v1')||Promise.resolve()).catch(()=>{}).then(async()=>{
      if(current.current.user?.id!==id)throw new Error('账号已切换，请重新登录。');
      const result=await request('/api/pond/fish',{method:'POST',headers:{'X-Pond-User':id},body:JSON.stringify({fish})});
      if(current.current.user?.id!==id)throw new Error('账号已切换，请刷新查看已保存的鱼。');
      current.current.values['pond-fish-v1']=result.state.values['pond-fish-v1'];
      current.current.revisions['pond-fish-v1']=result.state.revisions['pond-fish-v1']||0;
      errors.current.delete('pond-fish-v1');return result.state.values['pond-fish-v1'] as Fish[];
    });
    queues.current.set('pond-fish-v1',task.then(()=>{},e=>{errors.current.set('pond-fish-v1',e instanceof Error?e.message:'保存失败');}));return task;
  },[]);
  const flush=async()=>{await Promise.all([...queues.current.values()]);if(errors.current.size)throw new Error([...errors.current.values()][0]);};
  const logout=async()=>{
    await flush();
    await request('/api/auth/logout',{method:'POST',body:'{}'});
    generation.current++;queues.current.clear();errors.current.clear();window.location.hash='/login';commit(empty);channel.current?.postMessage('changed');
  };
  return <Context.Provider value={{...state,ready,error,refresh,authenticate,logout,save,createFish,flush}}>{children}</Context.Provider>;
}
export function useSession(){const value=useContext(Context);if(!value)throw new Error('SessionProvider missing');return value;}
