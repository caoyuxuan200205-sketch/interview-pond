import type { CSSProperties } from "react";
import { FishPortrait } from "./components";
import type { Fish } from "./data";
import "./birth-reveal.css";

export default function MysteryFishStage({ phase = "quiet", fish }: { phase?: "quiet" | "summoning" | "revealed"; fish?: Fish | null }) {
  return <div className={`mystery-visual ${phase}`}>
          <div className="mystery-stage" aria-label={phase === 'summoning' ? '正在揭晓新伙伴' : fish ? '你的新伙伴' : '未知鱼的轮廓与问号'}>
            <div className="mystery-aura"/><div className="mystery-ring ring-one"/><div className="mystery-ring ring-two"/><div className="mystery-ring ring-three"/>
            <div className="mystery-particles" aria-hidden="true">{Array.from({length:16},(_,i)=><i key={i} style={{'--angle':`${i*22.5}deg`,'--delay':`${i%5*.18}s`,'--travel':`${105+i%4*20}px`} as CSSProperties}/>)}</div>
            {phase === 'revealed' && fish ? <div className="revealed-fish"><FishPortrait fish={fish} size={240}/></div> : <div className="mystery-shell"><div className="mystery-orb"/><svg className="unknown-fish" viewBox="0 0 260 180" aria-hidden="true"><path d="M70 89C90 28 175 23 220 88C176 153 90 149 70 89L23 43Q43 88 23 135Z"/><path d="M122 46Q141 14 168 36M126 132Q147 162 170 139"/></svg><span className="mystery-question" aria-hidden="true">?</span></div>}
            <div className="reveal-flash"/><div className="mystery-platform"/>
          </div>
  </div>;
}
