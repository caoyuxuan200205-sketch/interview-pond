import {Flame,Network,Smile,ArrowRight,CalendarDays} from 'lucide-react';
import {FishPortrait} from './components';
import type {Fish} from './data';
import {useSocial,socialTime,SocialNotice} from './Social';
export default function Daily({fish,go,onShare}:{fish:Fish[];go:(path:string)=>void;onShare:()=>void}){
 const {snapshot:s}=useSocial();const day=(n:number)=>new Date(n).toLocaleDateString('en-CA',{timeZone:'Asia/Shanghai'}),today=day(Date.now());
 const events=(s?.events||[]).filter(e=>day(e.at)===today),complete=events.filter(e=>e.status==='completed'),participants=new Set(complete.flatMap(e=>e.members));
 return <article className="daily-paper social-daily"><header className="daily-masthead"><div className="reporter">{fish[0]&&<FishPortrait fish={fish[0]} size={180}/>}<span>PRESS</span></div><div><span>来自鱼塘社会的每日观察与速报</span><h1>鱼塘日报</h1><p>FISH POND DAILY</p></div><div className="daily-date"><strong><CalendarDays size={18}/> 今日观察</strong><span>{today}</span><small>北京时间 · 实际互动记录</small></div></header><SocialNotice/>
 <div className="daily-stats"><span>共同经历 <b>{complete.length} 次</b></span><span>参与伙伴 <b>{participants.size} 位</b></span><span>鱼群数量 <b>{fish.length} 条</b></span></div>
 <div className="daily-columns"><section className="paper-section"><h2><Flame/> 今日相遇</h2>{complete.length?complete.slice(0,3).map(e=><button className="social-paper-item" key={e.id} onClick={()=>go('events?id='+e.id)}><strong>{e.title}</strong><p>{e.summary}</p><small>{socialTime(e.at)} →</small></button>):<p>今天还没有完成的互动。伙伴们可以慢慢熟悉彼此，不必急着留下大事记。</p>}</section>
 <section className="paper-section"><h2><Network/> 关系的涟漪</h2>{complete.slice(0,3).map(e=><button className="social-paper-item" key={e.id} onClick={()=>go('relations')}><strong>{e.members.map(id=>fish.find(f=>f.id===id)?.name||'伙伴').join(' ↔ ')}</strong><p>{e.changes.map(c=>`${fish.find(f=>f.id===c.from)?.name||'伙伴'}：熟悉 +${c.familiar}，亲近 +${c.closeness}`).join('；')}</p></button>)}{!complete.length&&<p>关系来自一起经历的时刻。新的变化会在这里出现。</p>}</section>
 <section className="paper-section"><h2><Smile/> 自在相处</h2><h3>{s?.activity?'此刻，有伙伴正在靠近':'也给独处留一点空间'}</h3><p>今天有 {events.filter(e=>e.status==='declined').length} 次邀请被礼貌婉拒。休息与边界不会降低关系。</p><p>{s?.enabled?'自动互动已开启':'自动互动已暂停或尚未登录'}</p><button className="gold-button" onClick={()=>go('home')}>回鱼塘看看 <ArrowRight size={17}/></button><small>首版展示最近 200 条记录中的当日活动。</small></section></div></article>;
}
