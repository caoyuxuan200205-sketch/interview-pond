import {createHash} from 'node:crypto';
import {makeSupabase} from './supabase-client.mjs';
import {createLimiter,HttpError,readJson,sendJson} from './auth.mjs';

export function createSupabaseAuth(config) {
  const base={url:config.supabaseUrl,key:config.supabasePublishableKey};
  const accessName=config.secureCookies?'__Host-pond_access':'pond_access';
  const refreshName=config.secureCookies?'__Host-pond_refresh':'pond_refresh';
  const limiter=createLimiter(),refreshing=new Map();
  const client=()=>makeSupabase(base);
  function tokens(req){const cookies=Object.fromEntries((req.headers.cookie||'').split(';').map(c=>c.trim().split('=')));return {access:cookies[accessName]||'',refresh:cookies[refreshName]||''};}
  function cookies(res,s){
    const suffix=`; Path=/; HttpOnly; SameSite=Lax${config.secureCookies?'; Secure':''}`;
    res.setHeader('Set-Cookie',[
      `${accessName}=${s?.access_token||''}; Max-Age=${s?Math.max(0,s.expires_in||3600):0}${suffix}`,
      `${refreshName}=${s?.refresh_token||''}; Max-Age=${s?7*86400:0}${suffix}`,
    ]);res.setHeader('Cache-Control','no-store');
  }
  const account=u=>({id:u.id,email:u.email,name:u.user_metadata?.name||'塘主',createdAt:u.created_at});
  const view=(user,token,refresh)=>({user:account(user),token,refresh,db:makeSupabase({...base,token})});
  async function session(req,res){
    if(req.pondAuth)return req.pondAuth;
    const t=tokens(req);if(!t.access&&!t.refresh)return null;
    if(t.access){
      const {data,error}=await client().auth.getUser(t.access);
      if(!error&&data.user)return req.pondAuth=view(data.user,t.access,t.refresh);
      if(error&&(!error.status||error.status>=500))throw new HttpError(503,'暂时无法验证云端账号，请重试。');
    }
    if(!t.refresh){cookies(res,null);return null;}
    const key=createHash('sha256').update(t.refresh).digest('hex');
    let task=refreshing.get(key);
    if(!task){
      if(refreshing.size>1000)throw new HttpError(503,'账号服务繁忙，请稍后重试。');
      task=client().auth.refreshSession({refresh_token:t.refresh});refreshing.set(key,task);
      const cleanup=()=>{const timer=setTimeout(()=>refreshing.delete(key),5000);timer.unref();};task.then(cleanup,cleanup);
    }
    const {data,error}=await task;
    if(error||!data.session){
      if(error&&(!error.status||error.status>=500))throw new HttpError(503,'暂时无法续期登录，请重试。');
      cookies(res,null);return null;
    }
    cookies(res,data.session);return req.pondAuth=view(data.user,data.session.access_token,data.session.refresh_token);
  }
  async function requireUser(req,res){const s=await session(req,res);if(!s)throw new HttpError(401,'请先登录。');return s;}
  async function route(req,res,path){
    if(path==='/api/auth/config'&&req.method==='GET'){sendJson(res,200,{provider:'supabase',emailConfirmation:true});return true;}
    if(path==='/api/auth/session'&&req.method==='GET'){const s=await session(req,res);sendJson(res,200,{user:s?.user||null});return true;}
    if(!path.startsWith('/api/auth/')||req.method!=='POST')return false;
    limiter('auth:'+req.socket.remoteAddress,40,15*60000);
    const body=await readJson(req);
    if(path==='/api/auth/callback'){
      if(typeof body.accessToken!=='string'||typeof body.refreshToken!=='string'||body.accessToken.length>8192||body.refreshToken.length>8192)throw new HttpError(422,'确认链接不完整。');
      const {data,error}=await client().auth.setSession({access_token:body.accessToken,refresh_token:body.refreshToken});
      if(error||!data.user||!data.session)throw new HttpError(401,'确认链接已失效，请重新申请。');
      cookies(res,data.session);sendJson(res,200,{user:account(data.user)});return true;
    }
    if(path==='/api/auth/logout'){
      const s=await session(req,res);if(s){const c=client();const {error}=await c.auth.setSession({access_token:s.token,refresh_token:s.refresh});if(error)throw new HttpError(503,'注销未完成，请重试。');const out=await c.auth.signOut({scope:'local'});if(out.error)throw new HttpError(503,'注销未完成，请重试。');}
      cookies(res,null);sendJson(res,200,{ok:true});return true;
    }
    if(path==='/api/auth/password'){
      const s=await requireUser(req,res);
      if(typeof body.password!=='string'||body.password.length<12||body.password.length>128)throw new HttpError(422,'新密码需要 12–128 位。');
      const c=client();const established=await c.auth.setSession({access_token:s.token,refresh_token:s.refresh});
      if(established.error)throw new HttpError(401,'请重新登录后修改密码。');
      const result=await c.auth.updateUser({password:body.password});if(result.error)throw new HttpError(422,'密码更新未完成，请确认新密码符合规则或重新申请找回。');
      await c.auth.signOut({scope:'local'});cookies(res,null);sendJson(res,200,{ok:true});return true;
    }
    if(!['/api/auth/register','/api/auth/login','/api/auth/recover'].includes(path))return false;
    const email=typeof body.email==='string'?body.email.trim().toLowerCase():'';
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254)throw new HttpError(422,'请填写有效邮箱。');
    limiter('email:'+createHash('sha256').update(email).digest('hex'),8,15*60000);
    const origin=config.origins[0];
    if(path==='/api/auth/recover'){
      const {error}=await client().auth.resetPasswordForEmail(email,{redirectTo:origin+'/?auth=recovery'});
      if(error)throw new HttpError(error.status===429?429:503,error.status===429?'发送较频繁，请稍后重试。':'邮件服务暂时不可用，请稍后重试。');
      sendJson(res,200,{message:'如果该邮箱已注册，密码重置邮件会发送至邮箱。请同时检查垃圾邮件。'});return true;
    }
    if(typeof body.password!=='string'||body.password.length>128||body.password.length<(path.endsWith('register')?12:1))throw new HttpError(422,'请填写有效密码；注册密码至少 12 位。');
    let result;
    if(path.endsWith('register')){
      if(typeof body.name!=='string'||!body.name.trim()||body.name.trim().length>12)throw new HttpError(422,'昵称需要 1–12 位。');
      result=await client().auth.signUp({email,password:body.password,options:{data:{name:body.name.trim()},emailRedirectTo:origin+'/?auth=confirm'}});
    }else result=await client().auth.signInWithPassword({email,password:body.password});
    if(result.error){
      if(result.error.code==='email_not_confirmed')throw new HttpError(403,'请先打开邮箱完成账号确认。');
      if(result.error.status===429)throw new HttpError(429,'操作较频繁，请稍后再试。');
      if(!result.error.status||result.error.status>=500)throw new HttpError(503,'云端账号服务暂时不可用。');
      throw new HttpError(400,path.endsWith('register')?'注册未完成，请检查邮箱、密码或邮件发送配置。':'邮箱或密码不正确。');
    }
    if(result.data.session)cookies(res,result.data.session);
    sendJson(res,200,{user:result.data.session?account(result.data.user):null,confirmationRequired:!result.data.session});return true;
  }
  return {route,requireUser,session};
}
