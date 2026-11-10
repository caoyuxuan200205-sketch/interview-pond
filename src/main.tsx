import React, {useState,useEffect} from "react";
import { createRoot, type Root } from "react-dom/client";
import App from "./App";
import {PondModeContext} from "./PondMode";
import "./onboarding.css";
import {SocialProvider} from "./Social";
import "./social.css";
import { SessionProvider, useSession } from "./Session";
import "./styles.css";
import "./generated.css";
import "./auth.css";

function AccountApp() {
  const {user,ready,error,refresh} = useSession();
  const [hash,setHash]=useState(location.hash);
  useEffect(()=>{const update=()=>setHash(location.hash);window.addEventListener('hashchange',update);return()=>window.removeEventListener('hashchange',update);},[]);
  const demo=!user||hash.startsWith('#/demo/');
  if(!ready || error) return <div className="account-boot"><div><h1>面试鱼塘</h1><p>{error || '正在连接你的鱼塘…'}</p>{error && <button className="gold-button" onClick={()=>void refresh()}>重新连接</button>}</div></div>;
  return <PondModeContext.Provider value={{demo}}><SocialProvider key={(user?.id||'guest')+(demo?':demo':':personal')}><App /></SocialProvider></PondModeContext.Provider>;
}
// Reuse the mounted root when a shared context module triggers an entry HMR update.
const hot = (import.meta as ImportMeta & {hot?:{data:{root?:Root};accept:()=>void}}).hot;
const root = hot?.data.root || createRoot(document.getElementById("root")!);
if(hot){hot.data.root=root;hot.accept();}
root.render(
  <React.StrictMode>
    <SessionProvider><AccountApp /></SessionProvider>
  </React.StrictMode>,
);
