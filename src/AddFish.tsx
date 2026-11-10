import {usePondMode} from "./PondMode";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Fish as FishIcon, Sparkles, LockKeyhole, Waves } from "lucide-react";
import {
  GlassPanel,
  PageHeading,
  Tags,
  usePersisted,
} from "./components";
import { initialFish, type Fish } from "./data";
import { rollAppearance } from './birth.mjs';
import { skinName, speciesNames, type Appearance } from './appearance';
import { useSession } from './Session';
import { playPondSuccess } from './Soundscape';
import MysteryFishStage from "./MysteryFishStage";

type Draft = {
  company: string;
  role: string;
  category: string;
  round: string;
  date: string;
  notes: string;
  name: string;
  mood: string;
  birth?: Appearance;
  birthId?: string;
};
const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};
const blankDraft = (): Draft => ({
  company: "",
  role: "",
  category: "技术",
  round: "一面",
  date: today(),
  notes: "",
  name: "",
  mood: "充满期待",
});
const isDraft = (value: unknown): value is Draft => {
  if (!value || typeof value !== 'object') return false;
  const d = value as Draft;
  return Object.keys(blankDraft()).every(key => typeof (value as Record<string,unknown>)[key] === 'string') &&
    (!d.birth || (Number.isInteger(d.birth.sprite) && d.birth.sprite >= 0 && d.birth.sprite < 12 && Number.isInteger(d.birth.skin) && d.birth.skin >= 0 && d.birth.skin <= 16 && typeof d.birthId === 'string'));
};

export default function AddFish({ onAdd, active }: { onAdd: (fish: Fish) => Promise<void>; active: boolean }) {
  const [saving,setSaving]=useState(false),[saveError,setSaveError]=useState('');
  const {user} = useSession();const {demo}=usePondMode();
  const [draft, setDraft, storageError] = usePersisted('pond-draft-v1', blankDraft(), isDraft);
  const [step, setStep] = useState(draft.birth ? 2 : 1);
  const [phase, setPhase] = useState<'quiet'|'summoning'|'revealed'>(draft.birth ? 'revealed' : 'quiet');
  const starting = useRef(false), committed = useRef(false), sounded = useRef(!!draft.birth);
  const appearance = draft.birth;
  const model = appearance ? { ...initialFish[appearance.sprite], id: 'manual-preview', skin: appearance.skin } : null;
  useEffect(() => {
    if (phase !== 'summoning') return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches || !!document.querySelector('.viewport.reduced-motion');
    const timer = window.setTimeout(() => { setPhase('revealed'); starting.current = false; }, reduced ? 120 : 2900);
    return () => window.clearTimeout(timer);
  }, [phase]);
  useEffect(() => {
    if (phase === 'revealed' && active && !sounded.current) { sounded.current = true; playPondSuccess(); }
  }, [phase, active]);
  const reveal = () => {
    if (starting.current || !draft.company.trim() || !draft.role.trim() || !draft.date) return;
    if (appearance) { setStep(2); setPhase('revealed'); return; }
    starting.current = true;
    setDraft(current => ({ ...current, birth: rollAppearance(), birthId: `fish-${crypto.randomUUID()}` }));
    setStep(2); setPhase('summoning');
  };
  const update = (key: keyof Draft, value: string) =>
    setDraft((current) => ({ ...current, [key]: value }));
  const submit = async () => {
    if (!model || !draft.birthId || phase !== 'revealed' || committed.current) return;
    committed.current = true;
    setSaving(true);setSaveError('');
    const name = draft.name.trim() || model.name;
    try { await onAdd({
      ...model,
      id: draft.birthId,
      name,
      role: draft.role.trim(),
      category: draft.category,
      company: draft.company.trim(),
      date: draft.date,
      notes: draft.notes.trim(),
      rarity: "R",
      quote: "每一段认真经历，都值得被温柔记住。",
      traits: [draft.mood, draft.round, "新的开始"],
      description: `诞生于 ${draft.company.trim()} 的${draft.round}，带着关于${draft.role.trim()}的一段新记忆，开始在鱼塘里寻找自己的故事。`,
    });
    setDraft(blankDraft());
    setPhase('quiet'); sounded.current = false; committed.current = false;
    setStep(1);
    }catch(e){committed.current=false;setSaveError(e instanceof Error?e.message:'保存未完成，请重试。');}finally{setSaving(false);}
  };
  return (
    <div className="custom-page add-page">

      <PageHeading
        title="投一条鱼，留一段故事"
        subtitle="把今天的面试经历，变成鱼塘里一个独一无二的新伙伴。"
      />
      <div className="add-layout">
        <GlassPanel className="interview-form">
          {demo&&step===1&&<div className="demo-form-note"><span>演示试用 · 建议使用示例，不填写真实联系信息</span><button type="button" className="subtle-button" onClick={()=>setDraft(d=>({...d,company:'星光科技（示例）',role:'产品经理（示例）',notes:'示例经历：讨论了一个改善用户体验的小项目。'}))}>填入示例资料</button></div>}
          <div className="steps">
            <span className={step === 1 ? "active" : ""}>01 记录经历</span>
            <i />
            <span className={step === 2 ? "active" : ""}>02 迎接新生命</span>
          </div>
          {step === 1 ? (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                reveal();
              }}
            >
              <div className="form-row">
                <label>
                  公司名称 <em>*</em>
                  <input
                    required
                    maxLength={60}
                    pattern={".*\\S.*"}
                    title="请输入公司名称"
                    value={draft.company}
                    onChange={(e) => update("company", e.target.value)}
                    placeholder="这次故事发生在哪里？"
                  />
                </label>
                <label>
                  面试岗位 <em>*</em>
                  <input
                    required
                    maxLength={60}
                    pattern={".*\\S.*"}
                    title="请输入面试岗位"
                    value={draft.role}
                    onChange={(e) => update("role", e.target.value)}
                    placeholder="如 · 前端工程师"
                  />
                </label>
              </div>
              <div className="form-row three">
                <label>
                  岗位方向
                  <select
                    value={draft.category}
                    onChange={(e) => update("category", e.target.value)}
                  >
                    {["产品", "技术", "运营", "HR"].map((item) => (
                      <option key={item}>{item}</option>
                    ))}
                  </select>
                </label>
                <label>
                  面试轮次
                  <select
                    value={draft.round}
                    onChange={(e) => update("round", e.target.value)}
                  >
                    {["初聊", "一面", "二面", "终面", "HR 面"].map((item) => (
                      <option key={item}>{item}</option>
                    ))}
                  </select>
                </label>
                <label>
                  面试日期
                  <input
                    required
                    type="date"
                    max={today()}
                    value={draft.date}
                    onChange={(e) => update("date", e.target.value)}
                  />
                </label>
              </div>
              <label>
                想留下的记忆
                <textarea
                  rows={3}
                  maxLength={2000}
                  value={draft.notes}
                  onChange={(e) => update("notes", e.target.value)}
                  placeholder="聊了什么？有什么让你印象深刻的提问？也可以记下你对这家公司的感受。"
                />
                <small>{draft.notes.length} / 2000 · 选填</small>
              </label>
              <div className="birth-details-row"><label>伙伴昵称 <small>选填</small><input maxLength={12} value={draft.name} onChange={e=>update('name',e.target.value)} placeholder="先给这次相遇取个名字" /></label><div><label>此刻的心情</label>
              <div className="mood-options">
                {[
                  "充满期待",
                  "轻松愉快",
                  "有点紧张",
                  "收获满满",
                  "需要休息",
                ].map((item) => (
                  <button
                    type="button"
                    className={draft.mood === item ? "active" : ""}
                    key={item}
                    onClick={() => update("mood", item)}
                  >
                    {item}
                  </button>
                ))}
              </div>
              </div></div>
              <footer>
                <span className="muted">
                  {storageError
                    ? "草稿暂未保存，请保持页面打开"
                    : user && !demo ? "草稿保存至你的账号" : "草稿已保存在本机浏览器"}
                </span>
                <button className="gold-button" type="submit">
                  {appearance ? "查看我的新伙伴" : "揭晓我的新伙伴"} <Sparkles size={21} />
                </button>
              </footer>
            </form>
          ) : phase === 'summoning' ? (
            <div className="birth-wait" role="status" aria-live="polite"><span className="birth-wait-icon"><Waves size={34} /></span><span className="eyebrow">A LITTLE MIRACLE IS ON ITS WAY</span><h2>这段经历，正在拥有生命。</h2><p>水波记下你的故事，<br />一位独特的伙伴正游向这里。</p><div className="birth-progress"><i /></div><small>正在凝聚微光 · 请稍候</small><div className="birth-ticket"><span>{draft.company}</span><strong>{draft.role}</strong><span>{draft.date} · {draft.round}</span></div></div>
          ) : model && appearance ? (
            <div className="birth-form birth-result">
              <span className="birth-result-kicker"><Sparkles size={17} /> 相遇已揭晓</span><h2>原来，等你的是它。</h2><p className="muted">这份颜色与模样，只属于这次相遇。</p>
              <div className="birth-appearance-summary"><Sparkles /><div><strong>{speciesNames[appearance.sprite]} · {skinName(appearance)}</strong><p>岗位不限制鱼种，外观已固定。返回修改经历不会重新抽取。</p></div></div>
              <label>新伙伴的名字<input maxLength={12} value={draft.name} onChange={e=>update('name',e.target.value)} placeholder={model.name} /></label>
              <div className="memory-note"><Sparkles size={22}/><p>{draft.notes || '我的出生始于一次认真表达。关于工作、未来，还有一个努力介绍自己的人。'}</p></div>
              {saveError&&<p role="alert" className="auth-error">{saveError} 外观已保留，重试不会重新抽取。</p>}
              <footer><button className="subtle-button" disabled={saving} onClick={()=>setStep(1)}>返回修改经历</button><button className="gold-button" disabled={saving} onClick={()=>void submit()}><FishIcon size={23}/> {saving?'正在保存到鱼塘…':'让它游进鱼塘'}</button></footer>
            </div>
          ) : null}
        </GlassPanel>
        <GlassPanel className={`birth-preview blind-preview ${phase}`}>
          <span className="eyebrow">{phase === 'revealed' ? '命中一份独一无二的相遇' : '一段经历 · 一个尚未揭晓的生命'}</span>
          <MysteryFishStage phase={phase} fish={model ? {...model, name:draft.name.trim() || model.name} : null} />
          <h1 aria-live="polite">{phase === 'summoning' ? '听，故事正在发光' : model ? draft.name || model.name : '它会是什么模样？'}</h1>
          <p>{phase === 'summoning' ? '让这一次偶然，成为你的专属记忆。' : model ? `${draft.company} · ${draft.role}` : '先写下经历，把惊喜留在最后。'}</p>
          {phase === 'revealed' ? <Tags items={[draft.mood,draft.category+'向','新的开始']}/> : <div className="mystery-seals"><span><LockKeyhole size={14}/> 外观未揭晓</span><span><Sparkles size={14}/> 204 种可能</span></div>}
          <blockquote>{phase === 'revealed' ? '“面试结束了，故事才刚刚开始。”' : '“有些相遇，值得多期待一会儿。”'}</blockquote>
          <p className="muted small">{phase === 'revealed' ? '出生即定格 · 带着这份独特，开启新的故事' : '填写完成后随机诞生 · 每一种岗位都有无限可能'}</p>
        </GlassPanel>
      </div>
    </div>
  );
}
