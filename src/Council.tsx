import { useState } from "react";
import { Check, MessageCircle, Send, Users } from "lucide-react";
import {
  FishPortrait,
  GlassPanel,
  PageHeading,
  usePersisted,
} from "./components";
import { initialFish } from "./data";

const proposals = [
  "一起练习项目表达",
  "整理面试复盘笔记",
  "多了解自己的选择标准",
];
export default function Council({ go }: { go: (path: string) => void }) {
  const [vote, setVote, error] = usePersisted<string>(
    "pond-vote-v1",
    "",
    (value): value is string =>
      typeof value === "string" && (value === "" || proposals.includes(value)),
  );
  const [comments, setComments] = usePersisted<string[]>(
    "pond-comments-v1",
    [],
    (value): value is string[] =>
      Array.isArray(value) && value.every((item) => typeof item === "string"),
  );
  const [draft, setDraft] = useState("");
  return (
    <div className="custom-page council-page">
      <PageHeading
        title="鱼群议会"
        subtitle="在气泡广场，每一个声音都值得被听见。"
      />
      <div className="council-layout">
        <GlassPanel className="council-main">
          <span className="eyebrow">
            <Users size={20} /> 示例议题 · 自动议会将在后续开放
          </span>
          <h1>如何提升面试通过率？</h1>
          <p className="muted">
            一起讨论能力、表达与选择，也给不同的观点留一点空间。
          </p>
          <div className="council-fish">
            {initialFish.slice(0, 6).map((fish) => (
              <button key={fish.id} onClick={() => go(`fish/${fish.id}`)}>
                <FishPortrait fish={fish} size={120} />
                <span>{fish.name}</span>
              </button>
            ))}
          </div>
          <div className="council-speeches">
            <p>
              <strong>阿蓝</strong>把项目逻辑讲清楚，比背标准答案更重要。
            </p>
            <p>
              <strong>阿橙</strong>练习表达也很重要，好的经历需要被对方理解。
            </p>
            <p>
              <strong>阿悦</strong>
              我们也可以反过来问一问，这家公司适不适合自己。
            </p>
            {comments.map((text, index) => (
              <p key={index}>
                <strong>塘主</strong>
                {text}
              </p>
            ))}
          </div>
          <form
            className="comment-form"
            onSubmit={(event) => {
              event.preventDefault();
              if (draft.trim()) {
                setComments((current) => [...current, draft.trim()]);
                setDraft("");
              }
            }}
          >
            <input
              aria-label="议会发言"
              maxLength={300}
              placeholder="作为塘主，你想补充什么？"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
            />
            <button
              className="gold-button"
              disabled={!draft.trim()}
              type="submit"
            >
              <Send size={20} /> 发言
            </button>
          </form>
        </GlassPanel>
        <GlassPanel className="council-vote">
          <h2>
            <MessageCircle /> 下一步，一起做什么
          </h2>
          <p className="muted">选择你支持的提案，参与这一次共同决定。</p>
          {proposals.map((proposal, index) => {
            const count = [5, 4, 3][index] + Number(vote === proposal);
            return (
              <button
                className={vote === proposal ? "active" : ""}
                key={proposal}
                onClick={() => setVote(proposal)}
              >
                <div>
                  <strong>{proposal}</strong>
                  {vote === proposal && <Check size={21} />}
                </div>
                <div className="meter">
                  <i
                    style={{
                      width: `${(count / (12 + Number(!!vote))) * 100}%`,
                    }}
                  />
                </div>
                <small>
                  {count} 票 {vote === proposal && "· 已投票"}
                </small>
              </button>
            );
          })}
          <p className="small muted">
            {error
              ? "投票暂未保存，请保持页面打开。"
              : vote
                ? "你的投票已记录，可点击其他提案修改。"
                : "12 条鱼已表达意见，等待你的想法。"}
          </p>
          <div className="memory-note">
            “我们在互相评价，也在学习如何更好地理解彼此。”
          </div>
          <button className="subtle-button full" onClick={() => go("events")}>
            回顾议会事件 →
          </button>
        </GlassPanel>
      </div>
    </div>
  );
}
