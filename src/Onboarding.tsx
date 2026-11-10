import {useEffect,useState} from 'react';
import {ArrowRight,Check,Sparkles,Waves,X} from 'lucide-react';
import {Modal} from './components';
import {useSession} from './Session';
import {usePondMode} from './PondMode';
import {advanceTutorial,freshTutorial,validTutorial,type Tutorial} from './tutorial-state';
import type {Fish} from './data';

export function useOnboarding(fish:Fish[],page:string,profileId?:string){
 const {values,save}=useSession(),{demo}=usePondMode();
 const [state,setState]=useState<Tutorial>(()=>validTutorial(values['pond-onboarding-v1'])?values['pond-onboarding-v1']:freshTutorial());
 const [error,setError]=useState(''),[pending,setPending]=useState(false);
 const write=async(next:Tutorial)=>{if(demo||pending)return false;setPending(true);setError('');try{await save('pond-onboarding-v1',next);setState(next);return true;}catch(e){setError(e instanceof Error?e.message:'教程暂未保存');return false;}finally{setPending(false);}};
 useEffect(()=>{if(demo||pending||error)return;const next=advanceTutorial(state,fish.map(f=>f.id),page,profileId);if(next!==state)void write(next);},[demo,state,fish,page,profileId,pending,error]);
 return {state,error,pending,write,retry:()=>setError(''),pause:()=>write({...state,status:'paused'}),restart:()=>write(freshTutorial()),resume:()=>write({...state,status:'active'})};
}
export type TutorialControl=ReturnType<typeof useOnboarding>;
export default function Onboarding({control,fish,page,go,enterDemo}:{control:TutorialControl;fish:Fish[];page:string;go:(p:string)=>void;enterDemo:()=>void}){
 const {state:t,error,pending,write,pause,retry}=control;
 if(t.status!=='active'||['login','register','settings','archive'].includes(page))return null;
 const friend=fish.find(f=>f.id===t.fishId);
 const begin=()=>void write({...t,step:fish.length?'observe':'create',fishId:fish[0]?.id}).then(saved=>{if(saved)go('home');});
 if(t.step==='welcome')return <Modal title="这片鱼塘，现在属于你" onClose={()=>void pause()}><div className="welcome-journey"><div className="welcome-orbit"><Waves size={60}/><Sparkles/></div><p>一段真实经历，一位独一无二的伙伴。</p><p className="muted">你的经历只属于你的鱼塘。参观演示不会带入示例伙伴，你可以按自己的节奏开始。</p><div className="journey-path"><span>记录经历</span><i>→</i><span>揭晓伙伴</span><i>→</i><span>共同成长</span></div><button className="gold-button full" disabled={pending} onClick={begin}>开始我的鱼塘 <ArrowRight size={20}/></button><div className="welcome-actions"><button className="subtle-button" disabled={pending} onClick={()=>void pause()}>跳过引导</button><button className="subtle-button" onClick={enterDemo}>先逛演示鱼塘</button></div>{error&&<p role="alert">{error}</p>}</div></Modal>;
 if(t.step==='waiting'||t.step==='done')return null;
 const compact=t.step==='create'&&page==='add';
 return <aside className={`tutorial-coach ${compact?'compact':''} step-${t.step}`} aria-label="鱼塘新手引导" aria-live="polite"><div className="coach-head"><span><Sparkles size={17}/> {({create:'01 · 留下一段经历',observe:'02 · 认识新伙伴',profile:'03 · 属于它的故事',social:'04 · 让关系慢慢发生'} as Record<string,string>)[t.step]}</span><button aria-label="暂时收起教程" disabled={pending} onClick={()=>void pause()}><X size={18}/></button></div>
 {t.step==='create'&&(page==='add'?<p>选择 AI 或手动录入你的真实经历。外观会保持神秘，直到你主动揭晓并确认入塘。</p>:<><h2>第一位伙伴，还藏在你的故事里</h2><p>点击下方发光的「投鱼」。不用一次写得完美，也不需要为了教程编造面试。</p><button className="gold-button" onClick={()=>go('add')}>记录第一段经历 <ArrowRight size={18}/></button></>)}
 {t.step==='observe'&&<><h2>{friend?.name||'新伙伴'}已经在等你</h2><p>回到首页，看它自在游动。点击这条鱼，就能打开它的性格与面试档案。</p>{page!=='home'&&<button className="gold-button" onClick={()=>go('home')}>回鱼塘看看</button>}</>}
 {t.step==='profile'&&<><h2>它记得这段经历</h2><p>这里保存着你的记录、它的性格和固定的出生外观。未来的共同记忆，也会留在这里。</p><button className="gold-button" disabled={pending} onClick={()=>void write({...t,step:fish.length>=2?'social':'waiting'}).then(saved=>{if(saved)go('home');})}><Check size={18}/> 明白了，回到鱼塘</button></>}
 {t.step==='social'&&<><h2>现在，它们可以慢慢认识彼此</h2><p>伙伴可能接受邀请，也可能想先休息。只有真实完成互动，才会留下关系与记忆。</p>{page==='relations'?<button className="gold-button" disabled={pending} onClick={()=>void write({...t,status:'complete',step:'done'})}>让它们自由相处 <Check size={18}/></button>:<button className="gold-button" onClick={()=>go('relations')}>看看关系网 <ArrowRight size={18}/></button>}</>}
 {error&&<p role="alert">{error}<button onClick={retry}>重试自动保存</button></p>}</aside>;
}

