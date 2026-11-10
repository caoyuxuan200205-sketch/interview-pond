import { useEffect, useRef, useState } from "react";
import {
  Music2,
  Volume2,
  VolumeX,
  SlidersHorizontal,
  X,
  Waves,
} from "lucide-react";
import { usePersisted } from "./components";
import "./soundscape.css";

type Sound = "click" | "select" | "bubble" | "success";
type AudioPreferences = {
  music: boolean;
  effects: boolean;
  musicVolume: number;
  effectsVolume: number;
};
const sounds: Sound[] = ["click", "select", "bubble", "success"];
const validPreferences = (value: unknown): value is AudioPreferences => {
  if (!value || typeof value !== "object") return false;
  const p = value as AudioPreferences;
  return (
    typeof p.music === "boolean" &&
    typeof p.effects === "boolean" &&
    [p.musicVolume, p.effectsVolume].every(
      (v) => typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 1,
    )
  );
};

export function playPondSuccess() {
  window.dispatchEvent(new CustomEvent("pond:sound", { detail: "success" }));
}

/** A single persistent player lives outside the page routes. */
export default function Soundscape() {
  const [preferences, setPreferences, saveError] =
    usePersisted<AudioPreferences>(
      "pond-audio-v1",
      { music: true, effects: true, musicVolume: 0.18, effectsVolume: 0.22 },
      validPreferences,
    );
  const latest = useRef(preferences);
  latest.current = preferences;
  const music = useRef<HTMLAudioElement>(null);
  const effects = useRef<Partial<Record<Sound, HTMLAudioElement>>>({});
  const dock = useRef<HTMLDivElement>(null);
  const panelToggle = useRef<HTMLButtonElement>(null);
  const unlocked = useRef(false);
  const fade = useRef(0);
  const playVersion = useRef(0);
  const lastSound = useRef(0);
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState("轻触界面，唤醒鱼塘的声音");
  const [playing, setPlaying] = useState(false);
  const [soundError, setSoundError] = useState(false);

  const pauseMusic = () => {
    ++playVersion.current;
    cancelAnimationFrame(fade.current);
    music.current?.pause();
    setPlaying(false);
  };
  const startMusic = () => {
    const player = music.current;
    if (
      !player ||
      !latest.current.music ||
      !unlocked.current ||
      document.hidden
    )
      return;
    if (!player.paused) return;
    const version = ++playVersion.current;
    cancelAnimationFrame(fade.current);
    player.volume = 0;
    setStatus("正在铺开温柔的水声旋律…");
    void player
      .play()
      .then(() => {
        if (version !== playVersion.current) return;
        if (!latest.current.music || document.hidden) {
          pauseMusic();
          return;
        }
        setPlaying(true);
        setStatus("正在播放 · Dream Culture");
        const began = performance.now();
        const fadeIn = (now: number) => {
          const progress = Math.max(0, Math.min((now - began) / 1200, 1));
          player.volume = latest.current.musicVolume * progress;
          if (progress < 1) fade.current = requestAnimationFrame(fadeIn);
        };
        fade.current = requestAnimationFrame(fadeIn);
      })
      .catch((error: unknown) => {
        if (version !== playVersion.current) return;
        setPlaying(false);
        setStatus(
          error instanceof DOMException && error.name === "NotAllowedError"
            ? "浏览器需要你点一下「开始聆听」"
            : "音乐暂时未能播放，请点击重试",
        );
      });
  };
  const playEffect = (sound: Sound, force = false) => {
    if ((!latest.current.effects && !force) || document.hidden) return;
    const now = performance.now();
    if (now - lastSound.current < 95 && sound !== "success") return;
    const player = effects.current[sound];
    if (!player) return;
    lastSound.current = now;
    // Only one short cue at a time, even during fast navigation.
    Object.values(effects.current).forEach((audio) => audio.pause());
    player.currentTime = 0;
    player.volume =
      latest.current.effectsVolume * (sound === "success" ? 0.7 : 1);
    void player
      .play()
      .then(() => setSoundError(false))
      .catch(() => setSoundError(true));
  };

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return;
      const button = event.target.closest("button");
      if (event.target.closest(".sound-dock")) return;
      unlocked.current = true;
      startMusic();
      if (
        !button ||
        button.disabled ||
        button.getAttribute("aria-disabled") === "true"
      )
        return;
      if (button.closest(".main-nav") || button.getAttribute("role") === "tab")
        playEffect("select");
      else if (button.querySelector(".fish-portrait")) playEffect("bubble");
      else playEffect("click");
    };
    const onSuccess = () => playEffect("success");
    const visibility = () => {
      if (document.hidden) {
        pauseMusic();
        Object.values(effects.current).forEach((audio) => audio.pause());
      } else startMusic();
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (
        event.key === "Escape" &&
        dock.current?.contains(document.activeElement)
      ) {
        setOpen(false);
        panelToggle.current?.focus();
      }
    };
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !dock.current?.contains(event.target))
        setOpen(false);
    };
    document.addEventListener("click", onClick, true);
    document.addEventListener("visibilitychange", visibility);
    document.addEventListener("keydown", closeOnEscape);
    document.addEventListener("pointerdown", outside);
    window.addEventListener("pond:sound", onSuccess);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("visibilitychange", visibility);
      document.removeEventListener("keydown", closeOnEscape);
      document.removeEventListener("pointerdown", outside);
      window.removeEventListener("pond:sound", onSuccess);
      ++playVersion.current;
      cancelAnimationFrame(fade.current);
      music.current?.pause();
      Object.values(effects.current).forEach((audio) => audio.pause());
    };
  }, []);
  useEffect(() => {
    if (preferences.music) startMusic();
    else {
      pauseMusic();
      setStatus("音乐已关闭 · 留一点安静给自己");
    }
    if (!preferences.effects)
      Object.values(effects.current).forEach((audio) => audio.pause());
  }, [preferences.music, preferences.effects]);
  useEffect(() => {
    if (music.current) music.current.volume = preferences.musicVolume;
  }, [preferences.musicVolume]);

  const toggleMusic = () => {
    unlocked.current = true;
    const enabled = !latest.current.music;
    latest.current = { ...latest.current, music: enabled };
    setPreferences(latest.current);
    if (enabled) startMusic();
    else pauseMusic();
  };
  const toggleEffects = () => {
    const enabled = !latest.current.effects;
    latest.current = { ...latest.current, effects: enabled };
    setPreferences(latest.current);
    if (enabled) playEffect("bubble", true);
    else Object.values(effects.current).forEach((audio) => audio.pause());
  };
  return (
    <div className="sound-dock" ref={dock}>
      <audio
        ref={music}
        src="/audio/dream-culture.mp3"
        preload="none"
        loop
        aria-hidden="true"
        onPlaying={() => {
          setPlaying(true);
          setStatus("正在播放 · Dream Culture");
        }}
        onPause={() => setPlaying(false)}
        onError={() => {
          setPlaying(false);
          setStatus("音乐加载失败，请重新开启音乐");
        }}
      />
      {sounds.map((sound) => (
        <audio
          key={sound}
          ref={(node) => {
            if (node) effects.current[sound] = node;
          }}
          src={`/audio/${sound}.ogg`}
          preload="auto"
          aria-hidden="true"
          data-pond-sound={sound}
        />
      ))}
      <div className="sound-toolbar" aria-label="鱼塘声音控制">
        <button
          className={`sound-icon ${preferences.music ? "enabled" : ""} ${playing ? "is-playing" : ""}`}
          aria-label={preferences.music ? "关闭背景音乐" : "开启背景音乐"}
          aria-pressed={preferences.music}
          title={preferences.music ? "关闭背景音乐" : "开启背景音乐"}
          onClick={toggleMusic}
        >
          <Music2 />
          <span>音乐</span>
          {!preferences.music && <i className="sound-slash" />}
        </button>
        <button
          className={`sound-icon ${preferences.effects ? "enabled" : ""}`}
          aria-label={preferences.effects ? "关闭交互音效" : "开启交互音效"}
          aria-pressed={preferences.effects}
          title={preferences.effects ? "关闭交互音效" : "开启交互音效"}
          onClick={toggleEffects}
        >
          {preferences.effects ? <Volume2 /> : <VolumeX />}
          <span>音效</span>
        </button>
        <button
          ref={panelToggle}
          className="sound-icon sound-more"
          aria-label="声音设置"
          title="声音设置"
          aria-expanded={open}
          aria-controls="sound-settings"
          onClick={() => setOpen(!open)}
        >
          <SlidersHorizontal />
        </button>
      </div>
      {open && (
        <section
          className="sound-panel"
          id="sound-settings"
          aria-label="鱼塘声景设置"
        >
          <header>
            <span>
              <Waves /> 鱼塘声景
            </span>
            <button
              className="icon-button"
              aria-label="关闭声音设置"
              onClick={() => {
                setOpen(false);
                panelToggle.current?.focus();
              }}
            >
              <X size={18} />
            </button>
          </header>
          <p className="sound-intro">把声音放轻，让故事慢慢发生。</p>
          <div className="sound-track">
            <Music2 size={26} />
            <div>
              <strong>Dream Culture</strong>
              <small>梦幻钢琴 · 70 BPM · Kevin MacLeod</small>
            </div>
          </div>
          <p className="sound-status" role="status">
            {status}
          </p>
          {preferences.music && !playing && (
            <button
              className="sound-start"
              onClick={() => {
                unlocked.current = true;
                startMusic();
              }}
            >
              开始聆听 / 重试
            </button>
          )}
          <label className="sound-slider">
            背景音乐{" "}
            <output>{Math.round(preferences.musicVolume * 100)}%</output>
            <input
              type="range"
              min="0"
              max="100"
              aria-label="背景音乐音量"
              value={Math.round(preferences.musicVolume * 100)}
              onChange={(e) =>
                setPreferences((p) => ({
                  ...p,
                  musicVolume: Number(e.target.value) / 100,
                }))
              }
            />
          </label>
          <label className="sound-slider">
            交互音效{" "}
            <output>{Math.round(preferences.effectsVolume * 100)}%</output>
            <input
              type="range"
              min="0"
              max="100"
              aria-label="交互音效音量"
              value={Math.round(preferences.effectsVolume * 100)}
              onChange={(e) =>
                setPreferences((p) => ({
                  ...p,
                  effectsVolume: Number(e.target.value) / 100,
                }))
              }
            />
          </label>
          <button
            className="sound-preview"
            disabled={!preferences.effects}
            onClick={() => playEffect("bubble")}
          >
            试听一颗小气泡
          </button>
          {soundError && (
            <p role="status" className="sound-note">
              音效暂时无法播放，请重新点击试听。
            </p>
          )}
          <p className="sound-note">
            切换页面不断播 · 离开标签页自动暂停
            <br />
            {saveError
              ? "声音偏好未能保存，请检查网络或存储空间。"
              : "开关与音量会记住你的偏好。"}
          </p>
          <details className="sound-credits">
            <summary>音乐与音效鸣谢</summary>
            <p>
              “Dream Culture” —{" "}
              <a
                href="https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1300046"
                target="_blank"
                rel="noreferrer"
              >
                Kevin MacLeod (incompetech.com)
              </a>{" "}
              ·{" "}
              <a
                href="https://creativecommons.org/licenses/by/4.0/"
                target="_blank"
                rel="noreferrer"
              >
                CC BY 4.0
              </a>
              。原文件未修改，仅调整播放音量及淡入。
            </p>
            <p>
              Interface Sounds —{" "}
              <a
                href="https://kenney.nl/assets/interface-sounds"
                target="_blank"
                rel="noreferrer"
              >
                Kenney
              </a>{" "}
              ·{" "}
              <a
                href="https://creativecommons.org/publicdomain/zero/1.0/"
                target="_blank"
                rel="noreferrer"
              >
                CC0
              </a>
              。
            </p>
          </details>
        </section>
      )}
    </div>
  );
}
