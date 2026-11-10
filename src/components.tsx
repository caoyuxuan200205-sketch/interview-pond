import {usePondMode,demoKey} from "./PondMode";
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  ArrowLeft,
  BookOpen,
  CalendarDays,
  Fish as FishIcon,
  Flag,
  Home,
  Network,
  X,
} from "lucide-react";
import type { Fish } from "./data";
import { useSession } from "./Session";
import { species } from './appearance';

export function FishPortrait({
  fish,
  size = 100,
}: {
  fish: Fish;
  size?: number;
}) {
  const appearance = fish;
  const sprite = Number.isInteger(appearance.sprite) && appearance.sprite >= 0 && appearance.sprite < 12 ? appearance.sprite : 0;
  const skin = appearance.skin;
  const hasSkin = Number.isInteger(skin) && skin! >= 0 && skin! <= 16;
  const index = hasSkin && skin !== 16 ? skin! : sprite;
  const column = index % 4;
  const row = Math.floor(index / 4);
  return (
    <span
      role="img"
      aria-label={fish.name}
      className="fish-portrait"
      style={{
        width: size,
        height: size,
        backgroundImage: hasSkin ? `url(/assets/skins/${skin === 16 ? 'internet' : species[sprite]}.png)` : undefined,
        backgroundSize: `${size * 4}px ${size * (hasSkin && skin !== 16 ? 4 : 3)}px`,
        backgroundPosition: `${-column * size}px ${-row * size}px`,
      }}
    />
  );
}

export function GlassPanel({
  children,
  className = "",
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <section className={`glass-panel ${className}`} style={style}>
      {children}
    </section>
  );
}

export function Tags({ items }: { items: string[] }) {
  return (
    <div className="tags">
      {items.map((item) => (
        <span key={item}>{item}</span>
      ))}
    </div>
  );
}

export function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key !== "Tab") return;
      const focusable = ref.current?.querySelectorAll<HTMLElement>(
        'button, input, select, textarea, a[href], [tabindex="0"]',
      );
      if (!focusable?.length) return;
      const first = focusable[0],
        last = focusable[focusable.length - 1];
      if (
        event.shiftKey &&
        (document.activeElement === first ||
          document.activeElement === ref.current)
      ) {
        event.preventDefault();
        last.focus();
      }
      if (
        !event.shiftKey &&
        (document.activeElement === last ||
          document.activeElement === ref.current)
      ) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("keydown", handleKey);
      previous?.focus();
    };
  }, [onClose]);
  return (
    <div className="modal-shade" onClick={onClose}>
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`glass-panel modal ${wide ? "wide" : ""}`}
        onClick={(event) => event.stopPropagation()}
      >
        <header>
          <h2>{title}</h2>
          <button
            className="icon-button"
            aria-label="关闭弹窗"
            onClick={onClose}
          >
            <X />
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}

export const navigation = [
  { id: "home", label: "首页", icon: Home },
  { id: "add", label: "投鱼", icon: FishIcon },
  { id: "atlas", label: "图鉴", icon: BookOpen },
  { id: "relations", label: "关系网", icon: Network },
  { id: "events", label: "事件", icon: Flag },
  { id: "daily", label: "日报", icon: CalendarDays },
];

export function Navigation({
  page,
  go,
}: {
  page: string;
  go: (path: string) => void;
}) {
  return (
    <nav
      aria-label="主导航"
      className="main-nav"
      style={{ left: 276, width: 1120, top: 836 }}
    >
      {navigation.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          data-guide={id}
          className={page === id ? "active" : ""}
          aria-current={page === id ? "page" : undefined}
          onClick={() => go(id)}
          title={label}
        >
          <Icon />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}

export function PageHeading({
  title,
  subtitle,
  onBack,
}: {
  title: string;
  subtitle: string;
  onBack?: () => void;
}) {
  return (
    <div className="page-heading">
      {onBack && (
        <button className="icon-button" onClick={onBack} aria-label="返回">
          <ArrowLeft />
        </button>
      )}
      <div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
    </div>
  );
}

export function usePersisted<T>(
  key: string,
  fallback: T,
  validate: (value: unknown) => value is T,
  autoSave = true,
) {
  const {user,values,save} = useSession();
  const {demo}=usePondMode();
  const [value, setValue] = useState<T>(() => {
    try {
      const parsed: unknown = !demo && user ? values[key] : JSON.parse(sessionStorage.getItem(demoKey(key)) || "null");
      return validate(parsed) ? parsed : fallback;
    } catch { return fallback; }
  });
  const [error, setError] = useState(false);
  const previous = useRef(JSON.stringify(value));
  useEffect(() => {
    const serialized = JSON.stringify(value);
    if(user && !demo) {
      if(!autoSave)return;
      if(previous.current === serialized)return;
      let live=true;
      void save(key,value).then(()=>{previous.current=serialized;if(live)setError(false);}).catch(()=>{if(live)setError(true);});
      return ()=>{live=false;};
    }
    try { sessionStorage.setItem(demoKey(key), serialized); window.dispatchEvent(new Event("pond-demo-update")); setError(false); } catch { setError(true); }
  }, [key,value,user,save,demo,autoSave]);
  return [value, setValue, error] as const;
}
