import {useEffect,useRef,useState} from 'react';
import {Modal} from './components';
import BaiThreePortrait from './BaiThreePortrait';
import type {BaiPose} from './bai-motion';
import type {Fish} from './data';
import {speciesNames,skinName} from './appearance';
export default function BaiThreeLab({fish,onClose,motion}:{fish:Fish[];onClose:()=>void;motion:boolean}){
  const [selected,setSelected]=useState(fish[0].id);
  const current=fish.find(f=>f.id===selected)??fish[0];
  const pose=useRef<BaiPose>({yaw:.8,moving:true});
  const [angle,setAngle]=useState(46),[auto,setAuto]=useState(false),[moving,setMoving]=useState(true);
  const reduced=useRef(matchMedia('(prefers-reduced-motion: reduce)'));
  const [reduceMotion,setReduceMotion]=useState(reduced.current.matches);
  useEffect(()=>{const media=reduced.current;const update=()=>setReduceMotion(media.matches);media.addEventListener('change',update);return()=>media.removeEventListener('change',update);},[]);
  useEffect(()=>{pose.current.moving=moving;},[moving]);
  useEffect(()=>{if(!auto||!motion||reduceMotion)return;let frame=0,last=0,time=Math.asin(Math.max(-1,Math.min(1,pose.current.yaw/1.35)))/.65;const tick=(now:number)=>{time+=last?Math.min(.05,(now-last)/1000):0;pose.current.yaw=Math.sin(time*.65)*1.35;last=now;frame=requestAnimationFrame(tick);};const resume=()=>{cancelAnimationFrame(frame);last=0;if(!document.hidden)frame=requestAnimationFrame(tick);};document.addEventListener('visibilitychange',resume);resume();return()=>{cancelAnimationFrame(frame);document.removeEventListener('visibilitychange',resume);};},[auto,motion,reduceMotion]);
  const toggleAuto=()=>{if(auto)setAngle(Math.round(pose.current.yaw*180/Math.PI));setAuto(v=>!v);};
  return <Modal title="和立体的伙伴见个面" wide onClose={onClose}>
    <div className="bai-lab">
      <div className="bai-lab-stage"><div className="bai-lab-ring"/><BaiThreePortrait pose={pose} fish={current} motion={motion} revision={angle}/><span className="bai-lab-caption">{current.name} · {speciesNames[current.sprite]}</span></div>
      <div className="bai-lab-copy"><span className="bai-lab-eyebrow">A LITTLE MORE ALIVE</span><h3>每一位伙伴，<br/>都有自己的模样。</h3><label className="three-fish-selector">选择伙伴<select value={current.id} onChange={e=>setSelected(e.target.value)} aria-label="选择三维预览伙伴">{fish.map(f=><option key={f.id} value={f.id}>{f.name} · {speciesNames[f.sprite]}</option>)}</select></label><p>{current.quote}</p><div className="tags"><span>{speciesNames[current.sprite]}</span><span>{current.skin===undefined?'初见本色':skinName({sprite:current.sprite,skin:current.skin})}</span></div>
      <label className="bai-angle">转动角度 <span>{auto?'自由转身':`${angle}°`}</span><input aria-label="伙伴转动角度" type="range" min="-180" max="180" value={angle} onChange={e=>{const value=Number(e.target.value);pose.current.yaw=value*Math.PI/180;setAuto(false);setAngle(value);}}/></label>
      <div className="bai-lab-actions"><button className="gold-button" aria-pressed={auto} disabled={!motion||reduceMotion} onClick={toggleAuto}>{auto?'暂停转身':'自动转身'}</button><button aria-pressed={moving} onClick={()=>setMoving(v=>!v)}>{moving?'轻轻游动':'安静悬游'}</button></div>
      <small>12 类伙伴的三维首版。配色沿用出生时的皮肤，不能在这里更换。</small></div>
    </div>
  </Modal>;
}
