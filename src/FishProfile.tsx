import { useState } from "react";
import { ArrowRight, Heart, MessageCircle, Send, Sparkles } from "lucide-react";
import { FishPortrait, GlassPanel, PageHeading, Tags } from "./components";
import { type Fish } from "./data";
import { skinName, speciesNames, species } from "./appearance";
import portraitBounds from './portrait-bounds.json';
import {useSocial,socialTime} from './Social';

export default function FishProfile({
  fish,
  go,
  initialTab,
  favorite,
  toggleFavorite,
}: {
  fish: Fish;
  go: (path: string) => void;
  initialTab: string;
  favorite: boolean;
  toggleFavorite: () => void;
}) {
  const [tab, setTab] = useState(
    initialTab === "chat"
      ? "角色对话"
      : initialTab === "practice"
        ? "面试模拟"
        : "角色档案",
  );
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<{ from: string; text: string }[]>([
    { from: fish.name, text: `你好，我是${fish.name}。${fish.quote}` },
  ]);
  const [answer, setAnswer] = useState("");
  const [review, setReview] = useState(false);
  const [question, setQuestion] = useState(0);
  const questions = [
    "请用一个具体项目介绍自己，说明你负责的部分和最终结果。",
    "当你的方案与同事意见不同时，你会如何推动讨论？",
    "在选择下一份工作时，你最看重什么？你会如何向面试官确认？",
  ];
  const {snapshot:s}=useSocial();
  const related = (s?.events||[]).filter(e=>e.status==='completed'&&e.members.includes(fish.id)).map(e=>({...e,time:socialTime(e.at)}));
  // Center the visible artwork, not the atlas cell's unequal transparent margins.
  const hasSkin = Number.isInteger(fish.skin) && fish.skin! >= 0 && fish.skin! <= 16;
  const atlas = !hasSkin ? 'original' : fish.skin === 16 ? 'internet' : species[fish.sprite];
  const bounds = (portraitBounds as Record<string, number[][]>)[atlas]?.[hasSkin && fish.skin !== 16 ? fish.skin! : fish.sprite] || [0, 0, 1, 1];
  const [left, top, right, bottom] = bounds;
  const portraitScale = Math.min(330 / ((right-left)*355), 210 / ((bottom-top)*355));
  const portraitTransform = `translate(${(0.5-(left+right)/2)*355*portraitScale}px, ${(0.5-(top+bottom)/2)*355*portraitScale}px) scale(${portraitScale})`;
  const send = () => {
    if (!message.trim()) return;
    const text = message.trim();
    const reply = /紧张|焦虑|压力/.test(text)
      ? "紧张也没关系。我们可以先把最想表达的一件事讲清楚，慢慢来。"
      : /面试|项目|工作/.test(text)
        ? "可以从一个具体经历开始，讲讲当时遇到的问题、你做了什么，以及结果。也别忘了问问，这份工作是否适合你。"
        : "我记下了。也许我们可以从不同的角度再想一想，你最在意的是哪一部分？";
    setMessages((current) => [
      ...current,
      { from: "你", text },
      { from: fish.name, text: reply },
    ]);
    setMessage("");
  };
  return (
    <div className="custom-page profile-page">
      <PageHeading
        title="单鱼档案"
        subtitle="每一条鱼，都有自己的性格、记忆与故事。"
        onBack={() => go("atlas")}
      />
      <div className="profile-layout">
        <GlassPanel className="profile-character">
          <div className="profile-character-toolbar">
          <span className={`rarity ${fish.rarity.toLowerCase()}`}>
            {fish.rarity}
          </span>
          <button className="subtle-button skin-picker-trigger" onClick={() => go('skins')}><Sparkles size={17} /> 查看皮肤图鉴</button>
          <button
            className="icon-button favorite"
            aria-label={favorite ? "取消收藏" : "收藏角色"}
            onClick={toggleFavorite}
          >
            <Heart fill={favorite ? "currentColor" : "none"} />
          </button>
          </div>
          <div className="profile-portrait">
            <div className="profile-fitted-portrait" style={{transform:portraitTransform}}><FishPortrait fish={fish} size={355} /></div>
          </div>
          <div className="profile-character-summary">
          <h1>{fish.name}</h1>
          {fish.skin !== undefined && <small className="birth-identity">{speciesNames[fish.sprite]} · {skinName({sprite:fish.sprite,skin:fish.skin})} · 出生已定</small>}
          <p>
            {fish.role} · {fish.category}向
          </p>
          <Tags items={fish.traits} />
          <blockquote>“{fish.quote}”</blockquote>
          <div className="profile-status">
            <span>
              心情 <b>积极热烈</b>
            </span>
            <span>
              状态 <b>探索鱼塘中</b>
            </span>
          </div>
          </div>
          <button
            className="gold-button full"
            onClick={() => setTab("角色对话")}
          >
            <MessageCircle size={21} /> 和它聊聊
          </button>
        </GlassPanel>
        <GlassPanel className="profile-content">
          <div className="tabs">
            {["角色档案", "共同记忆", "角色对话", "面试模拟"].map((item) => (
              <button
                key={item}
                className={tab === item ? "active" : ""}
                onClick={() => setTab(item)}
              >
                {item}
              </button>
            ))}
          </div>
          {tab === "角色档案" && (
            <>
              <h2>认识{fish.name}</h2>
              <p className="lead-copy">{fish.description}</p>
              <div className="profile-facts">
                <div>
                  <small>诞生于</small>
                  <b>{fish.company || "示例面试经历"}</b>
                </div>
                <div>
                  <small>面试岗位</small>
                  <b>{fish.role}</b>
                </div>
                <div>
                  <small>面试日期</small>
                  <b>
                    {fish.date ||
                      (fish.ai ? "尚未提供" : "示例鱼塘 · 第 12 天")}
                  </b>
                </div>
                <div>
                  <small>近期目标</small>
                  <b>找到可以一起成长的伙伴</b>
                </div>
              </div>
              <h3>
                <Sparkles size={21} /> 初始记忆
              </h3>
              <div className="memory-note">
                {fish.notes ||
                  "这段经历的细节还没有被记录。未来共同经历的片刻，会慢慢留在这里。"}
              </div>
              {fish.ai && (
                <p className="ai-profile-source">
                  由魔搭 AI 整理，并经塘主确认 · 角色故事为虚构创作
                </p>
              )}
              <h3>它的个性</h3>
              {fish.traits.map((trait, index) => (
                <div className="trait-row" key={trait}>
                  <span>{trait}</span>
                  <div className="meter">
                    <i style={{ width: `${86 - index * 12}%` }} />
                  </div>
                </div>
              ))}
              <button className="subtle-button" onClick={() => go("relations")}>
                去看看它与其他鱼的关系 <ArrowRight size={20} />
              </button>
            </>
          )}
          {tab === "共同记忆" && (
            <>
              <h2>留在鱼塘里的涟漪</h2>
              <div className="memory-list">
                {related.length ? (
                  related.map((event) => (
                    <button
                      key={event.id}
                      onClick={() => go("events?id=" + event.id)}
                    >
                      <time>{event.time}</time>
                      <div>
                        <h3>{event.title}</h3>
                        <p>{event.summary}</p>
                      </div>
                      <ArrowRight />
                    </button>
                  ))
                ) : (
                  <div className="empty-state">
                    <Sparkles />
                    <h3>第一段故事，刚刚开始</h3>
                    <p>它记得你的面试经历，正在认识这片新的水域。</p>
                  </div>
                )}
              </div>
            </>
          )}
          {tab === "角色对话" && (
            <div className="chat-panel">
              <p className="muted small">
                本地示例对话 · 用预设回应体验角色交流
              </p>
              <div className="chat-messages" aria-live="polite">
                {messages.map((item, index) => (
                  <div
                    className={item.from === "你" ? "outgoing" : "incoming"}
                    key={index}
                  >
                    <small>{item.from}</small>
                    <p>{item.text}</p>
                  </div>
                ))}
              </div>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  send();
                }}
              >
                <input
                  aria-label="对话消息"
                  maxLength={500}
                  placeholder="和它分享今天的故事…"
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                />
                <button
                  className="gold-button"
                  type="submit"
                  disabled={!message.trim()}
                  aria-label="发送消息"
                >
                  <Send size={22} />
                </button>
              </form>
            </div>
          )}
          {tab === "面试模拟" && (
            <div className="practice-panel">
              <span className="eyebrow">
                练习 {question + 1} / {questions.length}
              </span>
              <h2>{questions[question]}</h2>
              <p className="muted">给自己一点时间，尝试用具体的经历表达。</p>
              <textarea
                rows={6}
                maxLength={3000}
                aria-label="你的面试回答"
                value={answer}
                onChange={(event) => {
                  setAnswer(event.target.value);
                  setReview(false);
                }}
                placeholder="在这里写下你的回答…"
              />
              {review && (
                <div className="memory-note">
                  <Sparkles />
                  <p>
                    练习提示 ·
                    试着检查回答是否包含具体情境、你采取的行动和可以说明的结果。这是预设的自检提示，可结合自己的经历继续完善。
                  </p>
                </div>
              )}
              <footer>
                <button
                  className="gold-button"
                  disabled={!answer.trim()}
                  onClick={() => setReview(true)}
                >
                  完成本次回答
                </button>
                <button
                  className="subtle-button"
                  onClick={() => {
                    setQuestion((question + 1) % questions.length);
                    setAnswer("");
                    setReview(false);
                  }}
                >
                  换一道题 →
                </button>
              </footer>
            </div>
          )}
        </GlassPanel>
      </div>
    </div>
  );
}
