import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowRight,
  Check,
  ImagePlus,
  LoaderCircle,
  LockKeyhole,
  MessageCircle,
  RefreshCw,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import { GlassPanel, PageHeading, Tags } from "./components";
import { initialFish, type Fish } from "./data";
import ClarificationDialog from "./ClarificationDialog";
import { useSession } from "./Session";
import { rollAppearance } from './birth.mjs';
import { skinName, speciesNames, type Appearance } from './appearance';
import MysteryFishStage from './MysteryFishStage';
import { playPondSuccess } from './Soundscape';
import './ai-birth.css';
import {
  interviewFields,
  type AiDraft,
  type InterviewField,
  type InterviewMessage,
} from "./ai-types";

type Request = { messages: InterviewMessage[]; intent: "gather" | "finalize" };
const readImage = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("截图读取失败，请重新选择。"));
    reader.readAsDataURL(file);
  });

export default function AiAddFish({ onAdd, active }: { onAdd: (fish: Fish) => Promise<void>; active: boolean }) {
  const [saving,setSaving]=useState(false);
  const {user} = useSession();
  const [messages, setMessages] = useState<InterviewMessage[]>([]);
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<string[]>([]);
  const [draft, setDraft] = useState<AiDraft | null>(null);
  const [review, setReview] = useState(false);
  const [appearance, setAppearance] = useState<Appearance | null>(null);
  const [phase, setPhase] = useState<'quiet' | 'summoning' | 'revealed'>('quiet');
  const birth = useRef<{appearance: Appearance; id: string} | null>(null);
  const committed = useRef(false), sounded = useRef(false);
  const [requestBusy, setBusy] = useState(false);
  const busy = requestBusy || saving || phase === 'summoning';
  const [reading, setReading] = useState(false);
  const [error, setError] = useState("");
  const [failed, setFailed] = useState<Request | null>(null);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [questionBatch, setQuestionBatch] = useState<AiDraft | null>(null);
  const [questionsOpen, setQuestionsOpen] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const feed = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const roundCount = messages.filter(
    (message) => message.role === "assistant",
  ).length;
  const imageCount = messages.reduce(
    (sum, message) => sum + (message.images?.length || 0),
    0,
  );
  const portrait = draft && appearance
    ? { ...initialFish[appearance.sprite], ...draft.fish, ...appearance, id: 'ai-preview' }
    : null;
  const known = draft
    ? interviewFields.filter(([key]) => draft.interview[key]).length
    : 0;

  useEffect(() => {
    const abort = new AbortController();
    void fetch("/api/ai/status", { signal: abort.signal })
      .then((response) => response.json())
      .then((data) => setConfigured(data.configured === true))
      .catch(() => {
        if (!abort.signal.aborted) setConfigured(false);
      });
    return () => {
      abort.abort();
      controller.current?.abort();
    };
  }, []);
  useEffect(() => {
    if (feed.current) feed.current.scrollTop = feed.current.scrollHeight;
  }, [messages, busy, error]);

  useEffect(() => {
    if (phase !== 'summoning' || !active) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches || !!document.querySelector('.viewport.reduced-motion');
    const timer = window.setTimeout(() => setPhase('revealed'), reduced ? 120 : 2900);
    return () => window.clearTimeout(timer);
  }, [phase, active]);
  useEffect(() => {
    if (phase === 'revealed' && active && !sounded.current) { sounded.current = true; playPondSuccess(); }
  }, [phase, active]);

  const addImages = async (files: File[]) => {
    if (busy || reading) return;
    setError("");
    if (imageCount + attachments.length + files.length > 3) {
      setError("一段故事最多上传 3 张截图，可以先移除多余图片。");
      return;
    }
    if (
      files.some(
        (file) =>
          !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
          file.size > 4 * 1024 * 1024,
      )
    ) {
      setError("请选择 4 MB 以内的 PNG、JPEG 或 WebP 截图。");
      return;
    }
    setReading(true);
    try {
      const images = await Promise.all(files.map(readImage));
      setAttachments((current) => [...current, ...images]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "截图读取失败。");
    } finally {
      setReading(false);
    }
  };
  const request = async (payload: Request) => {
    if (controller.current || phase === 'summoning') return;
    if (!user) { setError("请先登录，再让 AI 为你生成新伙伴。"); return; }
    const abort = new AbortController();
    controller.current = abort;
    setBusy(true);
    setError("");
    setFailed(null);
    setReview(false);
    setQuestionBatch(null);
    const timeout = window.setTimeout(() => abort.abort("timeout"), 95000);
    try {
      const response = await fetch("/api/ai/interview", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Pond-Request": "1" },
        body: JSON.stringify({
          intent: payload.intent,
          messages: payload.messages.map(({ role, text, images }) => ({
            role,
            text,
            images,
          })),
        }),
        signal: abort.signal,
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(
          typeof result.error === "string"
            ? result.error
            : "生成失败，请重试。",
        );
      const answer = result as AiDraft;
      if (!answer.fish || !answer.interview || !Array.isArray(answer.questions))
        throw new Error("AI 响应不完整，请重试。");

      setDraft(answer);
      setConfigured(true);
      setMessages([
        ...payload.messages,
        {
          role: "assistant",
          text: JSON.stringify(answer),
          display: answer.message,
          questions: answer.questions,
        },
      ]);
      if (payload.intent === "finalize" || !answer.questions.length) setReview(true);
      else { setQuestionBatch(answer); setQuestionsOpen(true); }
    } catch (e) {
      setFailed(payload);
      setError(
        abort.signal.aborted
          ? "请求已停止，已有信息会保留，可以继续或重试。"
          : e instanceof Error
            ? e.message
            : "暂时连接失败，请重试。",
      );
    } finally {
      window.clearTimeout(timeout);
      if (controller.current === abort) controller.current = null;
      setBusy(false);
    }
  };
  const send = (event?: FormEvent) => {
    event?.preventDefault();
    if (
      (!input.trim() && !attachments.length) ||
      busy ||
      reading ||
      roundCount >= 10
    )
      return;
    const next: InterviewMessage[] = [
      ...messages,
      {
        role: "user",
        text: input.trim() || "请帮我看看这份面试邀请。",
        images: attachments,
      },
    ];
    setMessages(next);
    setInput("");
    setAttachments([]);
    void request({ messages: next, intent: "gather" });
  };
  const finalize = () => {
    if (!draft || busy) return;
    const text = input.trim()
      ? `补充信息：${input.trim()}。请结束追问，生成待核对的鱼档案。`
      : "先用目前的信息生成待核对的鱼档案，未知信息留空。";
    const next: InterviewMessage[] = [
      ...messages,
      { role: "user", text, images: attachments },
    ];
    setMessages(next);
    setInput("");
    setAttachments([]);
    void request({ messages: next, intent: "finalize" });
  };
  const submitClarifications = (answers: string[], finish = false) => {
    if (!questionBatch || busy) return;
    const responseText = questionBatch.questions.map((question, index) => answers[index] ? `${question.title}\n我的回答：${answers[index]}` : "").filter(Boolean).join("\n\n");
    const text = `${responseText}\n${finish ? "请用已有信息生成待核对档案，不再追问。" : "请结合这些回答继续完善，不要重复询问已经回答或跳过的内容。"}`;
    const next: InterviewMessage[] = [...messages, { role: "user", text }];
    setMessages(next); setQuestionsOpen(false);
    void request({ messages: next, intent: finish || roundCount >= 3 ? "finalize" : "gather" });
  };
  const reset = () => {
    if (busy) return;
    setMessages([]);
    setDraft(null);
    setAppearance(null);
    setPhase('quiet');
    birth.current = null; committed.current = false; sounded.current = false;
    setInput("");
    setAttachments([]);
    setReview(false);
    setFailed(null);
    setError("");
    setQuestionBatch(null); setQuestionsOpen(false);
  };
  const updateFact = (field: InterviewField, value: string) =>
    setDraft(
      (current) =>
        current && {
          ...current,
          interview: { ...current.interview, [field]: value },
        },
    );
  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (
      !draft ||
      !draft.interview.company.trim() ||
      !draft.interview.role.trim() ||
      !draft.fish.name.trim() ||
      busy || committed.current
    )
      return;
    if (phase !== 'revealed') {
      // Draw only at the explicit reveal boundary; edits and retries keep this identity.
      if (!birth.current) birth.current = {appearance: rollAppearance(), id: `fish-${crypto.randomUUID()}`};
      setAppearance(birth.current.appearance);
      setQuestionsOpen(false);
      setPhase('summoning');
      return;
    }
    if (!appearance || !birth.current) return;
    committed.current = true;
    setSaving(true);setError('');
    try { await onAdd({
      id: birth.current.id,
      ...draft.fish,
      sprite: appearance.sprite,
      skin: appearance.skin,
      name: draft.fish.name.trim(),
      rarity: "R",
      role: draft.interview.role.trim(),
      company: draft.interview.company.trim(),
      date: draft.interview.date,
      notes: interviewFields
        .filter(([field]) => draft.interview[field])
        .map(([field, label]) => `${label}：${draft.interview[field]}`)
        .join("\n"),
      interview: draft.interview,
      createdAt: new Date().toISOString(),
      ai: { model: draft.model, generatedAt: draft.generatedAt },
    });
    reset();
    }catch(e){committed.current=false;setError((e instanceof Error?e.message:'保存未完成。')+' 外观已保留，可以重试。');}finally{setSaving(false);}
  };
  return (
    <div className="custom-page ai-add-page">
      {!user && <div className="ai-login-note">AI 生成需要登录。<button className="subtle-button" onClick={()=>{window.location.hash="/login";}}>登录 / 注册</button><span>也可以切换到手动创建，体验游客鱼塘。</span></div>}

      <PageHeading
        title="把一段经历，交给一条鱼"
        subtitle="递来一张面邀，轻点几个答案。让 AI 为你整理，再由你决定。"
      />
      <div className="ai-add-layout">
        <GlassPanel className="ai-conversation">
          <header className="ai-chat-header">
            <div>
              <span className="ai-assistant-icon">
                <Sparkles size={23} />
              </span>
              <span>
                <strong>鱼塘记录员</strong>
                <small>
                  {configured === false
                    ? "AI 服务暂未就绪 · 手动创建仍可用"
                    : "魔搭 AI · 听见经历里的细节"}
                </small>
              </span>
            </div>
            <button
              className="subtle-button"
              disabled={busy || !messages.length}
              onClick={reset}
            >
              <RefreshCw size={15} /> 新故事
            </button>
          </header>
          <div
            className="ai-feed"
            ref={feed}
            role="log"
            aria-label="AI 面试信息对话"
            aria-live="polite"
          >
            <div className="ai-message assistant">
              <span className="ai-speaker">鱼塘记录员</span>
              <p>
                把面邀截图或经历发给我。我会先识别已有信息，再用一张张问答卡了解缺少的细节。轻点选项即可继续，也可以用自己的话回答。
              </p>
              <div className="ai-welcome-chips">
                <span>
                  <ImagePlus size={15} /> 截图识别
                </span>
                <span>
                  <MessageCircle size={15} /> 引导式问答
                </span>
                <span>
                  <Check size={15} /> 核对后入塘
                </span>
              </div>
            </div>
            <div className="agent-workflow"><span className="done">01 读取资料</span><i /><span className={draft ? "done" : ""}>02 完善故事</span><i /><span className={review ? "done" : ""}>03 核对入塘</span></div>
            {draft && <div className="agent-task-summary"><Sparkles size={23} /><div><strong>{review ? "新伙伴的档案已准备好" : "已整理你的面试资料"}</strong><p>{draft.message}</p>{questionBatch && !busy && <button className="gold-button" onClick={() => setQuestionsOpen(true)}>继续完善故事 <ArrowRight size={17} /></button>}</div></div>}
            <details className="agent-source-history"><summary>已提供的资料与回答（{messages.filter(message => message.role === "user").length}）</summary>
            {messages.filter(message => message.role === "user").map((message, index) => (
              <div key={index} className={`ai-message ${message.role}`}>
                <span className="ai-speaker">
                  {message.role === "user" ? "你" : "鱼塘记录员"}
                </span>
                <p>{message.display || message.text}</p>
                {message.images?.length ? (
                  <div className="ai-message-images">
                    {message.images.map((image, i) => (
                      <img src={image} key={i} alt={`面试资料截图 ${i + 1}`} />
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
            </details>
            {requestBusy && (
              <div className="ai-waiting" role="status">
                <LoaderCircle size={18} /> 正在理解你的经历，整理下一段故事…
              </div>
            )}
            {error && (
              <div className="ai-error" role="alert">
                {error}
                {failed && (
                  <button onClick={() => void request(failed)} disabled={busy}>
                    重新尝试
                  </button>
                )}
              </div>
            )}
          </div>
          <form className="ai-composer" onSubmit={send}>
            {attachments.length > 0 && (
              <div className="ai-attachments">
                {attachments.map((image, i) => (
                  <div key={i}>
                    <img src={image} alt={`待发送截图 ${i + 1}`} />
                    <button
                      type="button"
                      aria-label={`移除截图 ${i + 1}`}
                      disabled={busy}
                      onClick={() =>
                        setAttachments((current) =>
                          current.filter((_, index) => index !== i),
                        )
                      }
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <textarea
              aria-label="告诉 AI 你的面试信息"
              placeholder={
                roundCount
                  ? "还有想补充的资料？可以在这里告诉我…"
                  : "例如：我收到星河科技的前端面邀，是下周的技术二面，有点紧张…"
              }
              value={input}
              maxLength={5000}
              disabled={busy || roundCount >= 10}
              onChange={(e) => setInput(e.target.value)}
              onPaste={(e) => {
                const files = Array.from(e.clipboardData.files);
                if (files.length) {
                  e.preventDefault();
                  void addImages(files);
                }
              }}
            />
            <div className="ai-composer-actions">
              <input
                ref={fileInput}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                multiple
                hidden
                aria-label="上传面试邀请截图"
                onChange={(e) => {
                  void addImages(Array.from(e.target.files || []));
                  e.target.value = "";
                }}
              />
              <button
                type="button"
                className="subtle-button"
                disabled={
                  busy ||
                  reading ||
                  imageCount + attachments.length >= 3 ||
                  roundCount >= 10
                }
                onClick={() => fileInput.current?.click()}
              >
                <ImagePlus size={19} /> {reading ? "读取截图中…" : "添加截图"}
              </button>
              <span>{Math.min(roundCount, 10)} / 10 轮 · 可随时结束</span>
              {phase === 'summoning' ? <button type="button" className="subtle-button" disabled>正在揭晓新伙伴…</button> : busy ? (
                <button
                  type="button"
                  className="subtle-button"
                  onClick={() => controller.current?.abort()}
                >
                  停止生成
                </button>
              ) : (
                <button
                  className="gold-button"
                  type="submit"
                  disabled={
                    reading ||
                    (!input.trim() && !attachments.length) ||
                    roundCount >= 10
                  }
                >
                  <Send size={17} /> {draft ? "补充资料" : "开始生成"}
                </button>
              )}
            </div>
            <p className="ai-privacy">
              发送后由魔搭 AI
              解析文字与截图。截图仅留在本次页面内存，刷新会清空。
            </p>
          </form>
        </GlassPanel>
        <GlassPanel className={`ai-preview ai-blind-preview ${phase}`}>
          <div className="ai-preview-heading">
            <span>
              <Sparkles size={20} />{" "}
              {review ? "核对新伙伴的档案" : "正在长成的故事"}
            </span>
            <small>{known} 项信息已整理</small>
          </div>
          <div className={`ai-mystery-preview ${draft && phase !== 'summoning' ? 'compact' : ''}`}>
            <MysteryFishStage phase={phase} fish={portrait} />
            <div className="ai-mystery-copy">
              <span className="ai-draft-badge">{phase === 'revealed' ? '相遇已揭晓' : review ? '故事已就绪 · 等你揭晓' : '外观未揭晓'}</span>
              <h2 aria-live="polite">{phase === 'summoning' ? '听，故事正在发光' : phase === 'revealed' ? draft?.fish.name : '它会是什么模样？'}</h2>
              <p>{phase === 'summoning' ? '一位独特的伙伴，正循着你的故事游来。' : phase === 'revealed' ? `${speciesNames[appearance!.sprite]} · ${skinName(appearance!)}` : '先让故事完整，把惊喜留在最后。'}</p>
              {phase === 'revealed' && draft ? <Tags items={draft.fish.traits} /> : <span className="ai-mystery-lock"><LockKeyhole size={13} /> 核对资料后，亲手揭晓</span>}
            </div>
          </div>
          {phase === 'summoning' ? <div className="ai-birth-wait" role="status"><div className="birth-progress"><i /></div><p>水波记下经历，微光正在凝聚…</p><small>这份模样，只属于这次相遇。</small></div> : !draft ? (
            <div className="ai-preview-empty">
              <h3>从一句话开始就好</h3>
              <p>
                公司、岗位、一次难忘的提问，
                <br />
                或是当时的小小心情。
              </p>
              <p>
                AI 会为你构思名字、性格与故事，
                <br />
                每一种经历，都可能遇见意想不到的模样。
              </p>
            </div>
          ) : review ? (
            <form className="ai-review-form" onSubmit={save}>
              <div className="ai-review-scroll">
                <label>
                  伙伴昵称
                  <input
                    aria-label="AI 鱼昵称"
                    required
                    pattern={".*\\S.*"}
                    maxLength={12}
                    value={draft.fish.name}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        fish: { ...draft.fish, name: e.target.value },
                      })
                    }
                  />
                </label>
                <div className="ai-review-fields">
                  {interviewFields.map(([field, label]) => (
                    <label key={field}>
                      {label}
                      {(field === "company" || field === "role") && <em> *</em>}
                      <input
                        aria-label={`核对${label}`}
                        required={field === "company" || field === "role"}
                        pattern={
                          field === "company" || field === "role"
                            ? ".*\\S.*"
                            : undefined
                        }
                        maxLength={field === "experience" ? 1400 : 500}
                        placeholder="未提供，可留空"
                        value={draft.interview[field]}
                        onChange={(e) => updateFact(field, e.target.value)}
                      />
                    </label>
                  ))}
                </div>
                <label>
                  角色故事 · AI 创作
                  <textarea
                    aria-label="AI 角色故事"
                    required
                    value={draft.fish.description}
                    maxLength={900}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        fish: { ...draft.fish, description: e.target.value },
                      })
                    }
                  />
                </label>
                <label>
                  口头禅
                  <input
                    aria-label="AI 口头禅"
                    required
                    value={draft.fish.quote}
                    maxLength={120}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        fish: { ...draft.fish, quote: e.target.value },
                      })
                    }
                  />
                </label>
                <p className="ai-review-note">
                  面试信息以你核对后的内容为准。角色故事与性格为虚构创作，形象取自现有角色库。
                </p>
              </div>
              <footer>
                <button
                  type="button"
                  className="subtle-button"
                  onClick={() => setReview(false)}
                >
                  继续聊聊
                </button>
                <button className="gold-button" type="submit" disabled={busy}>
                  <Sparkles size={18} /> {saving?'正在保存到鱼塘…':phase === 'revealed' ? '确认，放入鱼塘' : '揭晓我的新伙伴'}
                </button>
              </footer>
            </form>
          ) : (
            <>
              <div className="ai-facts-scroll">
                <dl>
                  {interviewFields.map(([key, label]) => (
                    <div key={key}>
                      <dt>{label}</dt>
                      <dd className={!draft.interview[key] ? "unknown" : ""}>
                        {draft.interview[key] || "待补充"}
                      </dd>
                    </div>
                  ))}
                </dl>
                {draft.uncertainties.length > 0 && (
                  <div className="ai-uncertainties">
                    <strong>还想和你确认</strong>
                    {draft.uncertainties.map((item, i) => (
                      <p key={i}>{item}</p>
                    ))}
                  </div>
                )}
              </div>
              <div className="ai-finalize">
                <p>还可以继续回答，也可以先看看完整档案。</p>
                <button
                  className="gold-button full"
                  disabled={busy || reading}
                  onClick={finalize}
                >
                  结束追问，生成档案 <ArrowRight size={19} />
                </button>
              </div>
            </>
          )}
        </GlassPanel>
      </div>
      {questionBatch && <ClarificationDialog key={questionBatch.generatedAt} open={questionsOpen && active} questions={questionBatch.questions} draft={questionBatch} onClose={() => setQuestionsOpen(false)} onComplete={answers => submitClarifications(answers)} onFinishEarly={answers => submitClarifications(answers, true)} />}
    </div>
  );
}
