import {
  useEffect,
  useState,
  type CSSProperties,
  type FormEvent,
} from "react";
import {
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  Fish,
  Heart,
  LoaderCircle,
  LockKeyhole,
  Mail,
  Sparkles,
  UserRound,
  Waves,
} from "lucide-react";
import { FishPortrait, Modal } from "./components";
import { initialFish } from "./data";
import { playPondSuccess } from "./Soundscape";
import { useSession,accountRequest } from "./Session";

type Props = {
  mode: "login" | "register";
  go: (path: string) => void;
};

export default function AuthPage({ mode, go }: Props) {
  const {authenticate,user} = useSession();
  const register = mode === "register";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "ready">("idle");
  const [forgotPassword, setForgotPassword] = useState(false);
  const [confirmationSent,setConfirmationSent]=useState(false);
  const [recovery,setRecovery]=useState(new URLSearchParams(location.search).get('auth')==='recovery');
  useEffect(() => { setError(''); setStatus('idle'); setPassword(''); setConfirmation(''); },[mode]);
  const strength =
    Number(password.length >= 12) +
    Number(/[A-Za-z]/.test(password) && /\d/.test(password)) +
    Number(password.length >= 16 || /[^A-Za-z0-9]/.test(password));
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (register && password !== confirmation) {
      setError("两次密码还不一致，再检查一下吧。");
      return;
    }
    setError("");
    setStatus("loading");
    try {
      const signedIn=await authenticate(mode,{email,password,...(register?{name:name.trim()}:{})});
      if(signedIn)playPondSuccess();else{setConfirmationSent(true);setStatus('idle');setPassword('');setConfirmation('');}
    } catch(e) { setError(e instanceof Error?e.message:'暂时无法登录，请重试。');setStatus('idle'); }
  };
  return (
    <div className={`auth-page ${register ? "register-mode" : "login-mode"}`}>
      <div className="auth-atmosphere" aria-hidden="true">
        <div className="auth-caustics" />
        {Array.from({ length: 16 }, (_, index) => (
          <i
            key={index}
            className="auth-bubble"
            style={
              {
                "--x": `${7 + index * 5.7}%`,
                "--size": `${9 + (index % 5) * 8}px`,
                "--duration": `${15 + (index % 6) * 3}s`,
                "--delay": `${-index * 2.1}s`,
              } as CSSProperties
            }
          />
        ))}
      </div>
      <section className="auth-story">
        <span className="auth-eyebrow">
          <span /> 每段经历，都值得一个新的开始
        </span>
        <h1>
          {register ? (
            <>
              属于你的鱼塘，
              <br />
              <em>从此刻开始。</em>
            </>
          ) : (
            <>
              欢迎回来，
              <br />
              <em>你的鱼塘想你了。</em>
            </>
          )}
        </h1>
        <p>
          {register
            ? "把面试里的紧张、期待与成长，变成一条条有故事的鱼。"
            : "把世界的喧嚣留在岸上，回来看看那些熟悉的小伙伴。"}
          <br />
          在这里，故事会继续，彼此也会慢慢靠近。
        </p>
        <div className="auth-fish-school">
          <div className="auth-fish auth-fish-blue">
            <FishPortrait fish={initialFish[1]} size={310} />
            <span>今天，也有新的故事。</span>
          </div>
          <div className="auth-fish auth-fish-orange">
            <FishPortrait fish={initialFish[2]} size={245} />
          </div>
          <div className="auth-fish auth-fish-white">
            <FishPortrait fish={initialFish[0]} size={185} />
          </div>
          <span className="auth-orbit" />
          <span className="auth-sparkle sparkle-one">
            <Sparkles />
          </span>
          <span className="auth-sparkle sparkle-two">
            <Sparkles size={17} />
          </span>
        </div>
        <div className="auth-story-note">
          <Heart size={25} />
          <div>
            <strong>每一条鱼，都从你的一段经历诞生。</strong>
            <span>相遇 · 交流 · 成长 · 让故事继续</span>
          </div>
        </div>
      </section>
      <section className="auth-panel">
        <div className="auth-panel-shine" />
        <div className="auth-tabs" role="tablist" aria-label="账号入口">
          <button
            role="tab"
            aria-selected={!register}
            onClick={() => go("login")}
            disabled={status === "loading"}
          >
            登录
          </button>
          <button
            role="tab"
            aria-selected={register}
            onClick={() => go("register")}
            disabled={status === "loading"}
          >
            注册
          </button>
          <span className={register ? "right" : ""} />
        </div>
        {user ? (
          <div className="auth-success" role="status">
            <span className="auth-success-icon">
              <Check size={38} />
            </span>
            <h2>{register ? "新故事，准备启程" : "欢迎回来，塘主"}</h2>
            <p>{user.name}，伙伴们正在等你。</p>
            <FishPortrait fish={initialFish[0]} size={190} />
            <button
              className="gold-button auth-submit"
              onClick={() => go("home")}
            >
              进入我的鱼塘 <ArrowRight size={22} />
            </button>
            <small>已登录 · 账号与鱼塘数据由服务端保存</small>
          </div>
        ) : (
          <form key={mode} onSubmit={submit} className="auth-form">
            <div className="auth-form-heading">
              <span className="auth-mini-logo">
                <Fish size={27} />
              </span>
              <h2>{register ? "遇见你的第一段故事" : "回到你的温暖水域"}</h2>
              <p>
                {register
                  ? "成为塘主，给每一段经历一个家。"
                  : "那些未完待续的故事，等你来续写。"}
              </p>
            </div>
            {register && (
              <label className="auth-field">
                <span>塘主昵称</span>
                <div>
                  <UserRound size={21} />
                  <input
                    autoComplete="nickname"
                    aria-label="注册昵称"
                    required
                    pattern={".*\\S.*"}
                    maxLength={12}
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="大家该怎么称呼你？"
                    disabled={status === "loading"}
                  />
                </div>
              </label>
            )}
            <label className="auth-field">
              <span>邮箱</span>
              <div>
                <Mail size={21} />
                <input
                  type="email"
                  required
                  autoComplete="email"
                  aria-label="账号邮箱"
                  maxLength={100}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="输入你的邮箱地址"
                  disabled={status === "loading"}
                />
              </div>
            </label>
            <label className="auth-field">
              <span>密码</span>
              <div>
                <LockKeyhole size={21} />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={register ? 12 : 1}
                  maxLength={128}
                  autoComplete={register ? "new-password" : "current-password"}
                  aria-label="账号密码"
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    setError("");
                  }}
                  placeholder={
                    register ? "至少 12 位，支持长短语和中文" : "输入你的密码"
                  }
                  disabled={status === "loading"}
                />
                <button
                  type="button"
                  className="password-toggle"
                  aria-label={showPassword ? "隐藏密码" : "显示密码"}
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </label>
            {register && (
              <>
                <div
                  className="password-strength"
                  aria-label={`密码强度${["待输入", "一般", "良好", "较强"][password ? strength : 0]}`}
                >
                  <span>
                    {[0, 1, 2].map((index) => (
                      <i
                        key={index}
                        className={password && index < strength ? "filled" : ""}
                      />
                    ))}
                  </span>
                  <small>
                    {password
                      ? [
                          "请至少输入 12 位",
                          "还可以更丰富一点",
                          "这个密码不错",
                          "密码强度较强",
                        ][strength]
                      : "给你的鱼塘多一点保护"}
                  </small>
                </div>
                <label className="auth-field">
                  <span>确认密码</span>
                  <div>
                    <LockKeyhole size={21} />
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      minLength={register ? 12 : 1}
                      maxLength={128}
                      autoComplete="new-password"
                      aria-label="确认密码"
                      value={confirmation}
                      onChange={(event) => {
                        setConfirmation(event.target.value);
                        setError("");
                      }}
                      placeholder="再输入一次密码"
                      disabled={status === "loading"}
                    />
                  </div>
                </label>
              </>
            )}
            {!register && (
              <div className="auth-options">
                <span>
                  <Waves size={16} /> 给自己一点慢下来的时间
                </span>
                <button type="button" onClick={() => setForgotPassword(true)}>
                  忘记密码？
                </button>
              </div>
            )}
            {error && (
              <p className="auth-error" role="alert">
                {error}
              </p>
            )}
            {confirmationSent&&<p className="auth-demo-note" role="status">请检查邮箱并完成确认，再回来登录。若未收到邮件，请稍后重试或联系内测管理员。</p>}
            <button
              className="gold-button auth-submit"
              type="submit"
              disabled={status === "loading"}
            >
              {status === "loading" ? (
                <>
                  <LoaderCircle className="auth-spinner" size={23} />{" "}
                  正在准备你的鱼塘…
                </>
              ) : (
                <>
                  {register ? "开启我的鱼塘" : "登录鱼塘"}{" "}
                  <ArrowRight size={22} />
                </>
              )}
            </button>
            <div className="auth-divider">
              <span /> 或者 <span />
            </div>
            <button
              type="button"
              className="auth-guest"
              onClick={() => go("home")}
              disabled={status === "loading"}
            >
              <Fish size={20} /> 先去鱼塘逛逛 <ArrowRight size={17} />
            </button>
            <p className="auth-demo-note">真实账号登录 · 登录后鱼塘数据保存至服务端</p>
          </form>
        )}
      </section>
      <footer className="auth-footer">
        <span>
          面试鱼塘 <i /> 让经历成为生命，让相遇成为故事。
        </span>
        <span>
          <Sparkles size={15} /> 一方小小鱼塘，一段自己的时光
        </span>
      </footer>
      {(forgotPassword||recovery)&&<PasswordRecovery reset={recovery&&!!user} initialEmail={email} onClose={()=>{setForgotPassword(false);setRecovery(false);history.replaceState(null,'',location.pathname+location.hash);}}/>}
    </div>
  );
}

function PasswordRecovery({reset,initialEmail,onClose}:{reset:boolean;initialEmail:string;onClose:()=>void}){
  const session=useSession();const [email,setEmail]=useState(initialEmail),[password,setPassword]=useState(''),[confirm,setConfirm]=useState(''),[pending,setPending]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
  async function submit(e:FormEvent){e.preventDefault();setError('');if(reset&&password!==confirm){setError('两次密码不一致。');return;}setPending(true);
    try{const r=await accountRequest(reset?'/api/auth/password':'/api/auth/recover',{method:'POST',body:JSON.stringify(reset?{password}:{email})});setMessage(reset?'密码已更新，请使用新密码登录。':r.message);if(reset){history.replaceState(null,'',location.pathname+'#/login');await session.refresh();}}
    catch(e){setError(e instanceof Error?e.message:'操作失败，请重试。');}finally{setPending(false);}}
  return <Modal title={reset?'设置新的登录密码':'找回你的鱼塘'} onClose={onClose}><form className="auth-form" onSubmit={submit}>
    {reset?<><label className="auth-field"><span>新密码</span><div><input aria-label="新密码" required type="password" autoComplete="new-password" minLength={12} maxLength={128} value={password} onChange={e=>setPassword(e.target.value)}/></div></label><label className="auth-field"><span>再次输入新密码</span><div><input aria-label="再次输入新密码" required type="password" autoComplete="new-password" value={confirm} onChange={e=>setConfirm(e.target.value)}/></div></label></>:<label className="auth-field"><span>注册邮箱</span><div><input aria-label="找回密码邮箱" required type="email" value={email} onChange={e=>setEmail(e.target.value)}/></div></label>}
    {message&&<p role="status">{message}</p>}{error&&<p role="alert" className="auth-error">{error}</p>}<button className="gold-button" disabled={pending||!!message}>{pending?'正在处理…':reset?'保存新密码':'发送找回邮件'}</button>
  </form></Modal>;
}
