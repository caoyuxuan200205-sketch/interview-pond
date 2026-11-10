import {usePondMode} from "./PondMode";
import { useState } from "react";
import { Sparkles, PenLine } from "lucide-react";
import AddFish from "./AddFish";
import AiAddFish from "./AiAddFish";
import type { Fish } from "./data";
import "./ai-fish.css";

export default function AddFishEntry({
  onAdd,
  active,
}: {
  onAdd: (fish: Fish) => Promise<void>;
  active: boolean;
}) {
  const {demo}=usePondMode();
  const [mode, setMode] = useState<"ai" | "manual">(demo?"manual":"ai");
  return (
    <>
      <div className="add-mode-switch" role="tablist" aria-label="投鱼方式">
        <button
          role="tab"
          disabled={demo} title={demo?"在个人鱼塘登录后使用真实 AI，演示只使用示例资料":""} aria-selected={mode === "ai"}
          className={mode === "ai" ? "active" : ""}
          onClick={() => setMode("ai")}
        >
          <Sparkles size={20} /> AI 帮我生成
        </button>
        <button
          role="tab"
          aria-selected={mode === "manual"}
          className={mode === "manual" ? "active" : ""}
          onClick={() => setMode("manual")}
        >
          <PenLine size={20} /> 手动创建
        </button>
      </div>
      <div hidden={mode !== "ai"}>
        {!demo&&<AiAddFish onAdd={onAdd} active={active && mode === "ai"} />}
      </div>
      <div hidden={mode !== "manual"}>
        <AddFish onAdd={onAdd} active={active && mode === "manual"} />
      </div>
    </>
  );
}
