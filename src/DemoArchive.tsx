import {useEffect,useState} from 'react';
import {Archive,ArrowLeft,ArrowRight} from 'lucide-react';
import {GlassPanel,PageHeading} from './components';
import {socialTime} from './Social';
import type {SocialEvent} from './social-engine';
export default function DemoArchive({go}:{go:(path:string)=>void}){
 const [offset,setOffset]=useState(0),[data,setData]=useState<{events:SocialEvent[];total:number;fish:{id:string;name:string}[]}|null>(null),[error,setError]=useState('');
 useEffect(()=>{const abort=new AbortController();setData(null);setError('');void fetch('/api/social/archive?offset='+offset,{signal:abort.signal}).then(async r=>{const value=await r.json();if(!r.ok)throw new Error(value.error||'暂时无法读取历史');return value;}).then(setData).catch(e=>{if(!abort.signal.aborted)setError(e.message);});return()=>abort.abort();},[offset]);
 return <div className="custom-page"><PageHeading title="旧演示历史" subtitle="更新前与演示角色发生的互动已单独保存，不计入个人关系和日报。" onBack={()=>go('settings')}/><GlassPanel className="demo-archive"><h2><Archive/> 留作纪念的旧故事</h2><p>你的真实鱼和面试记录仍在个人鱼塘。这里仅供回看，不会再次结算关系。</p>{error&&<p role="alert">{error}</p>}{!data&&!error&&<p>正在读取归档…</p>}{data?.events.map(event=><article key={event.id}><small>{socialTime(event.at)} · {event.status==='completed'?'已完成':'未完成'}</small><h3>{event.title}</h3><p>{event.summary}</p><details><summary>查看当时的对白</summary>{event.dialogue.map((line,i)=><p key={i}><b>{data.fish.find(f=>f.id===line.fishId)?.name||'伙伴'}：</b>{line.text}</p>)}</details></article>)}{data&&!data.total&&<div className="empty-state"><Archive/><h3>没有需要归档的演示互动</h3><p>你的个人鱼塘可以从第一段真实故事开始。</p></div>}{data&&data.total>50&&<footer><button disabled={!offset} onClick={()=>setOffset(Math.max(0,offset-50))}><ArrowLeft/> 上一页</button><span>{offset+1}–{Math.min(offset+50,data.total)} / {data.total}</span><button disabled={offset+50>=data.total} onClick={()=>setOffset(offset+50)}>下一页 <ArrowRight/></button></footer>}</GlassPanel></div>;
}
