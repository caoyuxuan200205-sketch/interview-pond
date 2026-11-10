import {usePondMode} from "./PondMode";
import Onboarding,{useOnboarding} from "./Onboarding";
import DemoArchive from "./DemoArchive";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bell,
  BriefcaseBusiness,
  Check,
  Download,
  Fish as FishIcon,
  Heart,
  Settings,
  Sparkles,
  Volume2,
} from "lucide-react";
import {
  FishPortrait,
  GlassPanel,
  Modal,
  Navigation,
  PageHeading,
  usePersisted,
} from "./components";
import { initialFish, type Fish } from "./data";
import Atlas from "./Atlas";
import Relations from "./Relations";
import Events from "./Events";
import AddFishEntry from "./AddFishEntry";
import FishProfile from "./FishProfile";
import Council from "./Council";
import Home from "./Home";
import Daily from "./Daily";
import AuthPage from "./AuthPage";
import { useSession } from "./Session";
import Soundscape, { playPondSuccess } from "./Soundscape";
import SkinGallery from './SkinStudio';
import AquariumBubbles from './AquariumBubbles';

type Preferences = {
  name: string;
  motion: boolean;
  notifications: boolean;
  highContrast: boolean;
};
const isStrings = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string");
const isFishList = (value: unknown): value is Fish[] =>
  Array.isArray(value) &&
  value.every(
    (item) =>
      item &&
      [
        "id",
        "name",
        "role",
        "category",
        "rarity",
        "quote",
        "description",
      ].every((key) => typeof item[key] === "string") &&
      isStrings(item.traits) &&
      Number.isInteger(item.sprite) &&
      item.sprite >= 0 &&
      item.sprite < 12,
  );
const isPreferences = (value: unknown): value is Preferences =>
  !!value &&
  typeof value === "object" &&
  typeof (value as Preferences).name === "string" &&
  ["motion", "notifications", "highContrast"].every(
    (key) => typeof (value as Record<string, unknown>)[key] === "boolean",
  );
const illustrated = ["home", "atlas", "relations", "events", "daily"];
const readRoute = () => window.location.hash.replace(/^#\/?/, "").replace(/^demo\//, "") || "home";

function downloadReport(name: string, total: number, headline:string) {
  const safeHeadline=headline.replace(/[<>&"\']/g, "").slice(0,38);
  const safeName = name.replace(/[<>&"']/g, "");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800"><defs><linearGradient id="bg" x2="1" y2="1"><stop stop-color="#292e51"/><stop offset="1" stop-color="#755564"/></linearGradient></defs><rect width="1200" height="800" rx="36" fill="url(#bg)"/><rect x="40" y="40" width="1120" height="720" rx="28" stroke="#ecc4aa" fill="none"/><g font-family="Microsoft YaHei, sans-serif" fill="#fff0d5"><text x="85" y="130" font-size="60" font-weight="bold">鱼塘日报</text><text x="85" y="185" font-size="25">${safeName}的鱼塘 · 本地体验报告</text><text x="85" y="290" font-size="36">${total} 位伙伴，正在这里续写故事。</text><text x="85" y="380" font-size="28">${safeHeadline}</text><text x="85" y="430" font-size="24">记录每一次真正发生的相遇。</text><text x="85" y="525" font-size="28">关系来自彼此真实的相处</text><text x="85" y="575" font-size="24">认真表达，彼此倾听，让每次交流留下新的涟漪。</text><text x="85" y="695" font-size="22">面试鱼塘 · 鱼塘记录 · ${new Date().toLocaleDateString("zh-CN")}</text></g></svg>`;
  const url = URL.createObjectURL(
    new Blob([svg], { type: "image/svg+xml;charset=utf-8" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = "鱼塘日报分享卡.svg";
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

import {useSocial,socialTime} from "./Social";

export default function App() {
  const {demo}=usePondMode();
  const social=useSocial();
  const events=(social.snapshot?.events||[]).map(e=>({...e,time:socialTime(e.at)}));
  const session = useSession();
  const [loggingOut,setLoggingOut] = useState(false);
  const [accountError,setAccountError] = useState("");
  const logout = async () => {setLoggingOut(true);setAccountError("");try{await session.logout();}catch(e){setAccountError(e instanceof Error?e.message:"退出未完成，请重试。");setLoggingOut(false);}};
  const [route, setRoute] = useState(readRoute);
  const [scale, setScale] = useState(1);
  const [addedFish, setAddedFish, fishSaveError] = usePersisted<Fish[]>(
    "pond-fish-v1",
    [],
    isFishList,
    false,
  );
  const [favorites, setFavorites] = usePersisted<string[]>(
    "pond-favorites-v1",
    [],
    isStrings,
  );
  const [preferences, setPreferences, preferencesError] =
    usePersisted<Preferences>(
      "pond-preferences-v1",
      { name: demo ? "演示塘主" : session.user?.name || "塘主", motion: true, notifications: true, highContrast: false },
      isPreferences,
    );
  const [readNotifications, setReadNotifications] = usePersisted<string[]>(
    "pond-read-v1",
    [],
    isStrings,
  );
  const [modal, setModal] = useState<{ title: string; text: string } | null>(
    null,
  );
  const [share, setShare] = useState(false);
  const [toast, setToast] = useState("");
  const fish = useMemo(() => demo ? [...initialFish,...addedFish] : addedFish, [addedFish,demo]);
  const path = route.split("?")[0];
  const page = path.split("/")[0];
  const isAuth = page === "login" || page === "register";
  const validPages = [
    ...illustrated,
    "add",
    "fish",
    "council",
    "settings",
    "notifications",
    "login",
    "register",
    "skins", "archive",
  ];
  const validPage = validPages.includes(page);
  const fishId = path.split("/")[1];
  const profileFish = fish.find((item) => item.id === fishId);
  const go = useCallback((next: string) => {
    window.location.hash = `/${demo&&!['login','register'].includes(next)?'demo/':''}${next}`;
  }, [demo]);
  const tutorial=useOnboarding(fish,page,fishId);
  const enterDemo=()=>{window.location.hash='/demo/home';};
  const closeModal = useCallback(() => setModal(null), []);
  const closeShare = useCallback(() => setShare(false), []);
  useEffect(() => {
    const listener = () => setRoute(readRoute());
    window.addEventListener("hashchange", listener);
    return () => window.removeEventListener("hashchange", listener);
  }, []);
  useEffect(() => {
    const resize = () =>
      setScale(Math.min(window.innerWidth / 1672, window.innerHeight / 941));
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(""), 4200);
    return () => clearTimeout(timeout);
  }, [toast]);
  useEffect(() => {
    document.title = `${({ skins: "皮肤图鉴", home: "首页", add: "投鱼", atlas: "图鉴", fish: "单鱼档案", relations: "关系网", events: "事件回顾", daily: "鱼塘日报", council: "鱼群议会", settings: "设置", notifications: "通知", login: "欢迎回来", register: "加入鱼塘" } as Record<string, string>)[page] || "未找到页面"} · 面试鱼塘`;
  }, [page]);
  const toggleFavorite = (id: string) =>
    setFavorites((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  const showInfo = (title: string, text: string) => setModal({ title, text });
  const onAdd = async (newFish: Fish) => {
    if(demo)setAddedFish((current) => current.some(fish => fish.id === newFish.id) ? current : [...current, newFish]);
    else setAddedFish(await session.createFish(newFish));
    playPondSuccess();
    go(!demo&&tutorial.state.status==='active'&&tutorial.state.step==='create'?'home':`fish/${newFish.id}`);
    setToast(`${newFish.name}游进鱼塘了，新的故事即将开始。`);
  };
  return (
    <main
      className={`viewport ${preferences.motion ? "" : "reduced-motion"} ${preferences.highContrast ? "high-contrast" : ""}`}
    >
      <div
        className="stage-frame"
        style={{ width: 1672 * scale, height: 941 * scale }}
      >
        <div
          className={`stage ${isAuth ? "auth-stage" : ""} ${!demo&&tutorial.state.status==='active'?'tutorial-'+tutorial.state.step:''}`}
          style={{ transform: `scale(${scale})` }}
        >
          <div
            className={`scene ${page === "home" || page === "relations" ? "" : "soft-scene"}`}
            aria-hidden="true"
          >
            <img src="/assets/aquarium-water-clear.png" alt="" draggable="false" />
            <AquariumBubbles enabled={!isAuth && preferences.motion} />
          </div>
          <header className={`global-header ${isAuth ? "auth-header" : ""}`}>
            <button
              className="brand"
              aria-label="面试鱼塘，返回首页"
              onClick={() => go("home")}
            >
              <span className="brand-mark">
                <FishIcon size={77} />
                <BriefcaseBusiness size={32} />
              </span>
              <span>
                <strong>面试鱼塘</strong>
                <small>— AI 社交模拟 · 职场面试生态 —</small>
              </span>
            </button>
            <div className="user-controls">
              <button className="auth-entry" onClick={() => go(session.user ? "settings" : "login")}>
                {session.user ? "我的账号" : "登录 / 注册"}
              </button>
              <button
                className="icon-button notification-button"
                aria-label="打开通知"
                onClick={() => go("notifications")}
              >
                <Bell />
                {preferences.notifications &&
                  events.some(e=>!readNotifications.includes(e.id)) && <i />}
              </button>
              <button
                className="user-profile"
                aria-label="塘主个人设置"
                onClick={() => go("settings")}
              >
                <span className="user-avatar">
                  {demo?<FishPortrait fish={initialFish[7]} size={67}/>:fish[0]?<FishPortrait fish={fish[0]} size={67}/>:<FishIcon size={38}/>}
                </span>
                <span>
                  <strong>
                    {preferences.name || "塘主"} <small>{demo?"演示":"我的鱼塘"}</small>
                  </strong>
                  <span className="meter">
                    <i style={{ width: "72%" }} />
                  </span>
                </span>
              </button>
              <button
                className="icon-button"
                aria-label="打开设置"
                onClick={() => go("settings")}
              >
                <Settings />
              </button>
            </div>
            {isAuth && (
              <button className="auth-back" onClick={() => go("home")}>
                返回鱼塘 →
              </button>
            )}
          </header>
          {!isAuth&&demo&&<div className="pond-mode-banner"><span>演示鱼塘 · 示例与试用记录仅保留在此标签页，不进入个人账号</span><button onClick={()=>{window.location.hash=session.user?'/home':'/register';}}>{session.user?'回到我的鱼塘':'创建我的鱼塘'} →</button></div>}
          <Soundscape />
          {isAuth && (
            <AuthPage
              mode={page === "register" ? "register" : "login"}
              go={go}

            />
          )}
          <div hidden={page !== 'home'}><Home fish={fish} go={go} active={page === 'home'} motion={preferences.motion} guideFish={!demo&&tutorial.state.step==='observe'?tutorial.state.fishId:undefined}/></div>
          {page === 'skins' && <SkinGallery go={go} />}
          {page === "atlas" && (
            <Atlas
              fish={fish}
              go={go}
              favorites={favorites}
              toggleFavorite={toggleFavorite}
              showInfo={showInfo}
            />
          )}
          {page === "relations" && <Relations fish={fish} go={go} />}
          {page === "events" && (
            <Events fish={fish}
              key={route}
              go={go}
              initialId={
                new URLSearchParams(route.split("?")[1]).get("id") || ""
              }
            />
          )}
          <div hidden={page !== "add"}>
            <AddFishEntry onAdd={onAdd} active={page === "add"} />
          </div>
          {page === "fish" && profileFish && (
            <FishProfile
              key={profileFish.id}
              fish={profileFish}
              go={go}
              initialTab={
                new URLSearchParams(route.split("?")[1]).get("tab") || ""
              }
              favorite={favorites.includes(profileFish.id)}
              toggleFavorite={() => toggleFavorite(profileFish.id)}
            />
          )}
          {page === "council" && (demo?<Council go={go}/>:<div className="custom-page"><PageHeading title="鱼群议会" subtitle="让共同的经历，慢慢长成共同的议题。"/><GlassPanel className="not-found"><h2>议会还在筹备中</h2><p>当前已开放认识、同游和陪伴。这里不会预填讨论或投票结果。</p><button className="gold-button" onClick={()=>go('relations')}>观察伙伴的关系</button></GlassPanel></div>)}
          {page==='archive'&&!demo&&<DemoArchive go={go}/> }
          {page === "daily" && (
            <Daily fish={fish} go={go} onShare={() => setShare(true)} />
          )}
          {page === "settings" && (
            <div className="custom-page settings-page">
              <PageHeading
                title="鱼塘设置"
                subtitle="让这片小小的水域，更适合你的节奏。"
              />
              <GlassPanel className="settings-panel">
                <h2><Settings /> 我的鱼塘</h2>
                {!demo&&<div className="onboarding-settings"><strong>新手旅程</strong><p>{tutorial.state.status==='complete'?'你已走完首次旅程，可以随时重看。':tutorial.state.step==='waiting'?'第一位伙伴已入塘，第二位伙伴到来时会继续社交引导。':'引导会跟随真实操作，进度按账号保存。'}</p><div><button className="subtle-button" disabled={tutorial.pending||tutorial.state.status==='complete'} onClick={()=>void tutorial.resume().then(saved=>{if(saved)go('home');})}>继续引导</button><button className="subtle-button" disabled={tutorial.pending} onClick={()=>void tutorial.restart().then(saved=>{if(saved)go('home');})}>重新查看教程</button><button className="subtle-button" onClick={enterDemo}>参观演示鱼塘</button><button className="subtle-button" onClick={()=>go('archive')}>查看旧演示历史</button></div>{tutorial.error&&<p role="alert">{tutorial.error}</p>}</div>}
                <div className="account-settings"><div><strong>{demo?'演示体验':session.user ? '已登录 · '+session.user.email : '游客体验'}</strong><small>{demo?'演示试用仅在当前标签页保存，不写入你的账号。':'账号数据独立保存，演示鱼塘不会混入个人记录。'}</small></div>{session.user ? <button className="subtle-button" disabled={loggingOut} onClick={()=>void logout()}>{loggingOut?'正在退出…':'退出登录'}</button> : <button className="gold-button" onClick={()=>go('login')}>登录 / 注册</button>}</div>
                {accountError && <p role="alert" className="auth-error">{accountError}</p>}
                <label>
                  塘主昵称
                  <input
                    value={preferences.name}
                    maxLength={12}
                    onChange={(event) =>
                      setPreferences((current) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                    onBlur={() => {
                      if (!preferences.name.trim())
                        setPreferences((current) => ({
                          ...current,
                          name: "塘主",
                        }));
                    }}
                  />
                </label>
                {[
                  {
                    key: "motion" as const,
                    title: "界面动态效果",
                    text: "柔和的光晕与过渡，让鱼塘保持呼吸感",
                    icon: Sparkles,
                  },
                  {
                    key: "notifications" as const,
                    title: "鱼塘动态提醒",
                    text: "显示真实社交事件的未读提示",
                    icon: Bell,
                  },
                  {
                    key: "highContrast" as const,
                    title: "增强面板对比度",
                    text: "提高交互面板的文字可读性",
                    icon: Volume2,
                  },
                ].map(({ key, title, text, icon: Icon }) => (
                  <div className="setting-row" key={key}>
                    <Icon />
                    <div>
                      <strong>{title}</strong>
                      <p>{text}</p>
                    </div>
                    <button
                      role="switch"
                      aria-checked={preferences[key]}
                      aria-label={title}
                      className={`switch ${preferences[key] ? "on" : ""}`}
                      onClick={() =>
                        setPreferences((current) => ({
                          ...current,
                          [key]: !current[key],
                        }))
                      }
                    >
                      <i />
                    </button>
                  </div>
                ))}
                <p className="save-state">
                  <Check size={18} />{" "}
                  {preferencesError
                    ? "保存失败，请检查网络或刷新后重试"
                    : session.user && !demo ? "设置已保存到你的账号" : "演示设置保存在当前标签页"}
                </p>
                <div className="about-note">
                  <strong>面试鱼塘 · 账号版 0.2</strong>
                  <p>
                    个人鱼塘只包含你创建的伙伴。AI 投鱼与社交对白已接入魔搭，角色聊天和议会功能仍在完善。
                  </p>
                  <p>建议使用桌面浏览器，以 16∶9 比例全屏体验。</p>
                </div>
              </GlassPanel>
            </div>
          )}
          {page === "notifications" && (
            <div className="custom-page notifications-page">
              <PageHeading
                title="鱼塘动态"
                subtitle="每一条动态，都来自伙伴实际经历的片刻。"
              />
              <GlassPanel className="notifications-panel">
                <header>
                  <h2>
                    <Bell /> 最近的消息
                  </h2>
                  <button
                    className="subtle-button"
                    onClick={() =>
                      setReadNotifications(events.map((event) => event.id))
                    }
                  >
                    全部标为已读
                  </button>
                </header>
                {!events.length&&<p className="empty-state">这里还没有新动态。真实的相遇发生后，再来看看吧。</p>}{events.map((event) => (
                  <button
                    className={`notification-row ${readNotifications.includes(event.id) ? "read" : ""}`}
                    key={event.id}
                    onClick={() => {
                      setReadNotifications((current) => [
                        ...new Set([...current, event.id]),
                      ]);
                      go(
                        event.id === "council"
                          ? "council"
                          : "events?id=" + event.id,
                      );
                    }}
                  >
                    <span className="notification-dot" />
                    <span>
                      <strong>{event.title}</strong>
                      <p>{event.summary}</p>
                    </span>
                    <time>{event.time}</time>
                    <span>›</span>
                  </button>
                ))}
              </GlassPanel>
            </div>
          )}
          {(!validPage || (page === "fish" && !profileFish)) && (
            <div className="custom-page">
              <GlassPanel className="not-found">
                <h1>这片水域还没有故事</h1>
                <p>这个页面或角色暂时不存在。</p>
                <button className="gold-button" onClick={() => go("home")}>
                  返回鱼塘
                </button>
              </GlassPanel>
            </div>
          )}
          {!isAuth && <Navigation page={page === 'skins' ? 'atlas' : page} go={go} />}
          {(toast || fishSaveError) && (
            <div className="toast" role="status">
              <Check size={20} />
              {fishSaveError
                ? "新鱼暂未保存，请保持页面打开并检查网络或存储空间。"
                : toast}
            </div>
          )}
          {!demo&&!isAuth&&<Onboarding control={tutorial} fish={fish} page={page} go={go} enterDemo={enterDemo}/>}
          {modal && (
            <Modal title={modal.title} onClose={closeModal}>
              <p className="modal-copy">{modal.text}</p>
              <button className="gold-button" onClick={closeModal}>
                知道了
              </button>
            </Modal>
          )}
          {share && (
            <Modal title="把今天的故事，带给朋友" onClose={closeShare} wide>
              <div className="share-preview">
                <span>FISH POND DAILY</span>
                <h1>鱼塘日报</h1>
                <p>
                  {preferences.name}的鱼塘 · {fish.length} 位伙伴
                </p>
                <div>
                  <Heart /> 每一段真实经历，都值得被记住。
                </div>
                <p>
                  {events.find(e=>e.status==='completed')?.title||'还没有共同社交事件。每一段关系，都从相遇开始。'}
                </p>
                <small>面试鱼塘 · {demo?"演示记录":"个人鱼塘记录"}</small>
              </div>
              <button
                className="gold-button full"
                onClick={() => {
                  downloadReport(preferences.name, fish.length,events.find(e=>e.status==='completed')?.title||'还没有共同社交事件');
                  setToast("分享卡已生成，请查看浏览器下载。");
                }}
              >
                <Download size={22} /> 下载分享卡 SVG
              </button>
            </Modal>
          )}
        </div>
      </div>
    </main>
  );
}
