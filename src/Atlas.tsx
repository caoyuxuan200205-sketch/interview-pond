import { useState } from "react";
import {
  ArrowRight,
  BookOpen,
  ChartNoAxesColumnIncreasing,
  Heart,
  Network,
  Search,
  Sparkles,
  Trophy,
} from "lucide-react";
import { FishPortrait, GlassPanel, Tags } from "./components";
import type { Fish } from "./data";

export default function Atlas({
  fish,
  go,
  favorites,
  toggleFavorite,
  showInfo,
}: {
  fish: Fish[];
  go: (path: string) => void;
  favorites: string[];
  toggleFavorite: (id: string) => void;
  showInfo: (title: string, text: string) => void;
}) {
  const [category, setCategory] = useState("全部");
  const [query, setQuery] = useState("");
  const [rarity, setRarity] = useState("全部");
  const [selected, setSelected] = useState("lan");
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const selectedFish = fish.find((item) => item.id === selected) || fish[0];
  const filtered = fish.filter(
    (item) =>
      (category === "全部" || item.category === category) &&
      (rarity === "全部" || item.rarity === rarity) &&
      (!onlyFavorites || favorites.includes(item.id)) &&
      [item.name, item.role, ...item.traits].join(" ").includes(query.trim()),
  );
  if(!fish.length)return <div className="custom-page"><GlassPanel className="not-found"><BookOpen size={42}/><h1>图鉴的第一页，留给你的故事</h1><p>创建第一位伙伴后，它的性格和面试记录就会出现在这里。</p><button className="gold-button" onClick={()=>go('add')}>迎接第一位伙伴</button></GlassPanel></div>;
  return (
    <>
      <aside className="atlas-sidebar">
        <div className="wood-title">
          <BookOpen size={36} /> 图鉴
        </div>
        <GlassPanel>
          <button onClick={() => go('skins')}><Sparkles /> 皮肤图鉴</button>
          <button
            className="active"
            onClick={() => {
              setCategory("全部");
              setOnlyFavorites(false);
              setQuery("");
              setRarity("全部");
            }}
          >
            <BookOpen /> 鱼色图鉴
          </button>
          <button
            onClick={() =>
              showInfo(
                "收集进度",
                `已记录 ${fish.length} 条面试鱼，收藏 ${fish.filter(f=>favorites.includes(f.id)).length} 条。每一条新鱼都来自你认真记录的一段经历。`,
              )
            }
          >
            <ChartNoAxesColumnIncreasing /> 收集进度
          </button>
          <button onClick={() => go("relations")}>
            <Network /> 羁绊图谱
          </button>
          <button
            onClick={() =>
              showInfo(
                "成长的印记",
                `已记录 ${fish.length} 位伙伴。成长来自真实经历，社交历程可以在关系网中查看。`,
              )
            }
          >
            <Trophy /> 成就奖励
          </button>
        </GlassPanel>
        <p>
          把每一段经历
          <br />
          收藏成独特的生命。
        </p>
      </aside>
      <div className="atlas-filters" aria-label="图鉴分类">
        {["全部", "产品", "技术", "运营", "HR"].map((item) => (
          <button
            key={item}
            className={category === item ? "active" : ""}
            onClick={() => setCategory(item)}
          >
            {item}
          </button>
        ))}
      </div>
      <select
        className="atlas-rarity"
        aria-label="稀有度"
        value={rarity}
        onChange={(event) => setRarity(event.target.value)}
      >
        <option value="全部">全部稀有度</option>
        <option>R</option>
        <option>SR</option>
        <option>SSR</option>
      </select>
      <label className="atlas-search">
        <Search size={20} />
        <input
          aria-label="搜索鱼名或标签"
          placeholder="搜索鱼名 / 标签…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      <div className="atlas-grid-panel">
        <div className="fish-grid">
          {filtered.map((item) => (
            <button
              key={item.id}
              className={`fish-card ${selected === item.id ? "selected" : ""}`}
              onClick={() => setSelected(item.id)}
            >
              <span className={`rarity ${item.rarity.toLowerCase()}`}>
                {item.rarity}
              </span>
              <FishPortrait fish={item} size={155} />
              <strong>
                {item.name}
                <small>{item.category}向</small>
              </strong>
              <Tags items={item.traits} />
            </button>
          ))}
        </div>
        {filtered.length === 0 && (
          <GlassPanel className="empty-state">
            <Search />
            <h3>这片水域还没有找到它</h3>
            <p>换个名字、标签或筛选条件试试。</p>
            <button
              onClick={() => {
                setQuery("");
                setCategory("全部");
                setRarity("全部");
                setOnlyFavorites(false);
              }}
            >
              清除筛选
            </button>
          </GlassPanel>
        )}
      </div>
      <div className="atlas-footer">
        <button
          className={onlyFavorites ? "selected" : ""}
          onClick={() => setOnlyFavorites(!onlyFavorites)}
        >
          <Heart size={18} fill={onlyFavorites ? "currentColor" : "none"} />
          {onlyFavorites ? "查看全部" : "我的收藏"}
        </button>
        <span>
          已展示 {filtered.length} 条 · 共 {fish.length} 条面试鱼
        </span>
      </div>
      <GlassPanel className="atlas-detail">
        <div className="detail-art">
          <span className={`rarity ${selectedFish.rarity.toLowerCase()}`}>
            {selectedFish.rarity}
          </span>
          <button
            className="icon-button favorite"
            aria-label={
              favorites.includes(selectedFish.id) ? "取消收藏" : "收藏角色"
            }
            onClick={() => toggleFavorite(selectedFish.id)}
          >
            <Heart
              fill={
                favorites.includes(selectedFish.id) ? "currentColor" : "none"
              }
            />
          </button>
          <div className="display-ring" />
          <FishPortrait fish={selectedFish} size={285} />
        </div>
        <h1>
          {selectedFish.name} <small>{selectedFish.category}向</small>
        </h1>
        <blockquote>“{selectedFish.quote}”</blockquote>
        <p>{selectedFish.description}</p>
        <Tags items={selectedFish.traits} />
        <div className="collection-progress">
          <Sparkles size={20} /> 已记录 <span>出生外观已确定</span>
        </div>
        <div className="meter">
          <i style={{ width: "100%" }} />
        </div>
        <button
          className="gold-button full"
          onClick={() => go(`fish/${selectedFish.id}`)}
        >
          打开单鱼档案 <ArrowRight size={22} />
        </button>
        <button className="subtle-button full" onClick={() => go("relations")}>
          查看它的羁绊故事
        </button>
      </GlassPanel>
    </>
  );
}
