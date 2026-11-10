import bounds from './bai-turn-bounds.json';
import type { Fish } from './data';
export const BAI_TURN_ASSET='/assets/motion/bai-turn-v1.png';
// Only the original pale spotted appearance. Never substitute other fixed skins.
export const hasTurnArtwork=(fish:Fish)=>fish.sprite===0&&fish.skin===undefined;
export default function BaiTurnPortrait({name}:{name:string}) {
  return <span className="bai-turn-portrait" role="img" aria-label={name}>{bounds.map(([l,t,r,b],index)=>{
    const scale=Math.min(180/((r-l)*180),120/((b-t)*180));
    return <span key={index} data-turn-frame={index} className="bai-turn-frame" style={{backgroundPosition:`${-(index%3)*180}px ${-Math.floor(index/3)*180}px`,transform:`translate(${(.5-(l+r)/2)*180*scale}px,${(.5-(t+b)/2)*180*scale}px) scale(${scale})`,opacity:index===0?1:0}}/>;
  })}</span>;
}
