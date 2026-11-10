import {
  Activity,
  ArrowRight,
  CalendarDays,
  Fish as FishIcon,
  MessageCircle,
  Moon,
  Smile,
  Swords,
  Users,
  Zap,
} from "lucide-react";
import { GlassPanel } from "./components";
import FishSchool from './FishSchool';
import { type Fish } from "./data";
import {useSocial,SocialNotice,socialTime} from "./Social";

export default function Home({
  fish,
  go,
  active,
  motion,guideFish,
}: {
  fish: Fish[];
  go: (path: string) => void;
  active: boolean;
  motion: boolean;guideFish?:string;
}) {
  const {snapshot:s,loggedIn,demo}=useSocial();
  const completed=s?.events.filter(e=>e.status==='completed')||[];
  return (
    <div className="home-layer">
      <div className="live-stats">
        <span>
          <FishIcon /> 鱼群数量 <b>{fish.length}</b> 条
        </span>
        <span>
          <Activity /> 共同经历 <b>{completed.length}</b>
        </span>
        <span>
          <Swords /> 相识关系 <b className="warm">{s?.relationships.filter(r=>r.from<r.to).length||0}</b>
        </span>
        <span>
          <Smile /> 鱼群状态 <b className="green">{s?.activity?'正在相伴':s?.enabled?'自在探索':'安静时光'}</b>
        </span>
      </div>
      <FishSchool fish={fish} active={active} motion={motion} go={go} guideFish={guideFish}/>
      {fish.length===0&&<GlassPanel className="first-fish-card"><span className="eyebrow">YOUR STORY STARTS HERE</span><h1>第一圈涟漪，等你写下</h1><p>鱼塘已经准备好了。把一段真实的面试经历，变成独一无二的新伙伴。</p><button className="gold-button" onClick={()=>go('add')}>迎接第一位伙伴 <ArrowRight size={20}/></button><small>还没有准备好？可以先自由逛逛，不需要编造经历。</small></GlassPanel>}
      <div className="wood-sign quiet-sign">
        <Moon size={23} /> 静思洞窟
      </div>
      <button className="wood-sign coral-sign" onClick={() => go("relations")}>
        <span>
          <Users size={26} /> 珊瑚社交区
        </span>
        <small>交流 · 讨论 · 组队</small>
      </button>
      <button className="bubble-plaza" onClick={() => go("council")}>
        <Users size={43} />
        <strong>
          <MessageCircle size={26} /> 气泡广场
        </strong>
        <small>圆桌讨论 · 模拟群面 · 公共活动</small>
      </button>
      <GlassPanel className="home-events">
        <button
          className="home-events-title"
          onClick={() => go("notifications")}
        >
          <CalendarDays size={30} />
          <h2>鱼塘动态</h2>
          <ArrowRight size={24} />
        </button>
        {(s?.events||[]).slice(0,3).map(e=><button key={e.id} onClick={()=>go('events?id='+e.id)}><span className="activity-icon"><Users/></span><div><strong>{e.title}</strong><p>{e.status==='completed'?'留下一段共同记忆':e.status==='declined'?'想先休息，关系不受影响':'活动提前结束'}</p></div><time>{socialTime(e.at)}</time></button>)}
        {!s?.events.length&&<div className="home-social-empty"><MessageCircle/><strong>相遇正在酝酿</strong><p>{(loggedIn||demo)?(fish.length===0?'从第一段经历开始，这里会慢慢热闹起来。':fish.length===1?'独处也是舒服的时光。等第二位真实伙伴到来，再一起认识彼此。':'伙伴们会慢慢认识彼此，完成互动后，这里会留下记录。'):'登录后开启自动社交，保存属于你的共同故事。'}</p><button className="subtle-button" onClick={()=>go(loggedIn||demo?'relations':'login')}>{loggedIn||demo?'去看看关系网':'登录 / 注册'}</button></div>}
        <SocialNotice/>
      </GlassPanel>
      <span className="home-caption">点击伙伴认识它的故事 · 每一次相处，留下共同记忆</span>
    </div>
  );
}
