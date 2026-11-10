import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, ArrowRight, Check, CornerDownLeft, SkipForward, Sparkles, X } from "lucide-react";
import MysteryFishStage from "./MysteryFishStage";
import type { AiDraft, ClarificationQuestion } from "./ai-types";

type Props = { open: boolean; questions: ClarificationQuestion[]; draft: AiDraft; onClose: () => void; onComplete: (answers: string[]) => void; onFinishEarly: (answers: string[]) => void };
export default function ClarificationDialog({ open, questions, draft, onClose, onComplete, onFinishEarly }: Props) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const [custom, setCustom] = useState("");
  const [chosen, setChosen] = useState("");
  const [advancing, setAdvancing] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const locked = useRef(false);
  const close = useRef(onClose); close.current = onClose;
  const question = questions[index];
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    heading.current?.focus();
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); close.current(); }
      if (event.key !== "Tab") return;
      const nodes = [...(panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled),textarea,input,a[href]') || [])];
      const first = nodes[0], last = nodes.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && (document.activeElement === first || document.activeElement === heading.current)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === heading.current)) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", keyboard);
    return () => { document.removeEventListener("keydown", keyboard); previous?.focus(); };
  }, [open]);
  useEffect(() => { if (open) heading.current?.focus(); }, [index]);
  const answer = (value: string) => {
    if (locked.current || !value.trim()) return;
    locked.current = true; setAdvancing(true); setChosen(value);
    const updated = [...answers]; updated[index] = value.trim(); setAnswers(updated);
    timer.current = setTimeout(() => {
      locked.current = false; setAdvancing(false); setChosen("");
      if (index + 1 < questions.length) { setIndex(index + 1); setCustom(updated[index + 1] || ""); }
      else onComplete(updated);
    }, 180);
  };
  if (!open || !question) return null;
  const target = document.querySelector(".stage");
  if (!target) return null;
  return createPortal(<div className="agent-question-shade">
    <div className="agent-question-dialog" role="dialog" aria-modal="true" aria-labelledby="agent-question-title" ref={panel}>
      <aside className="agent-question-aside">
        <span className="agent-eyebrow"><Sparkles size={17} /> 让故事更像你</span>
        <h2>再了解一点，<br /><em>就更靠近你一点。</em></h2>
        <div className="agent-mystery-orbit"><MysteryFishStage /></div>
        <div className="agent-known"><span><Check size={15} /> 已从你的资料中整理</span><strong>{draft.interview.company || "公司待补充"}</strong><p>{draft.interview.role || "岗位待补充"}</p>{draft.interview.round && <small>{draft.interview.round}</small>}</div>
        <p className="agent-aside-note">选一个贴近的答案，<br />或者用自己的话告诉我。</p>
      </aside>
      <section className="agent-question-main">
        <header><span>完善故事 <b>{String(index + 1).padStart(2, "0")}</b><i> / {String(questions.length).padStart(2, "0")}</i></span><button className="icon-button" aria-label="稍后继续问答" onClick={onClose} disabled={advancing}><X size={21} /></button></header>
        <div className="agent-question-progress" aria-label={`本组第 ${index + 1} 题，共 ${questions.length} 题`}>{questions.map((item, i) => <span key={item.id} className={i <= index ? "complete" : ""} />)}</div>
        <div className="agent-question-body" key={index}>
          <h2 ref={heading} id="agent-question-title" tabIndex={-1}>{question.title}</h2>
          <p className="agent-question-hint">{question.hint || "只记录你确认的信息；暂时不知道，也可以跳过。"}</p>
          <div className="agent-question-options">{question.options.map((option, i) => <button key={option} className={(chosen || answers[index]) === option ? "selected" : ""} disabled={advancing} onClick={() => answer(option)}><span className="agent-option-number">{(chosen || answers[index]) === option ? <Check size={18} /> : String.fromCharCode(65 + i)}</span><span>{option}</span><ArrowRight className="agent-option-arrow" size={18} /></button>)}</div>
          <form className="agent-custom-answer" onSubmit={event => { event.preventDefault(); answer(custom); }}>
            <label htmlFor="agent-custom-input">用自己的话补充</label>
            <div><input id="agent-custom-input" aria-label="手动填写本题答案" value={custom} onChange={event => setCustom(event.target.value)} maxLength={1000} placeholder="这里也可以直接输入你的答案…" disabled={advancing} /><button type="submit" aria-label="提交自定义答案，进入下一题" disabled={!custom.trim() || advancing}><CornerDownLeft size={20} /></button></div>
          </form>
          <p className="agent-selection-note">选择后自动进入下一题 · 回答仅用于完善这条鱼的故事</p>
        </div>
        <footer><button className="subtle-button" disabled={index === 0 || advancing} onClick={() => { setIndex(index - 1); setCustom(answers[index - 1] || ""); }}><ArrowLeft size={16} /> 上一题</button><button className="agent-skip" disabled={advancing} onClick={() => answer("暂不确定，先跳过这项，不要重复追问。")}>暂不确定，跳过 <SkipForward size={15} /></button></footer>
        <button className="agent-finish-early" disabled={advancing} onClick={() => { const updated = [...answers]; if (custom.trim()) updated[index] = custom.trim(); onFinishEarly(updated); }}>信息已经够了，直接核对档案</button>
      </section>
    </div>
  </div>, target);
}
