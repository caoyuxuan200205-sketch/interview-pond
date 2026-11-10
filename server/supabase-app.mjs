import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {createLimiter,HttpError,readJson,sendJson} from './auth.mjs';
import {makeSupabase,unwrap} from './supabase-client.mjs';
import {createSupabaseAuth} from './supabase-auth.mjs';
import {createSupabaseSocial} from './supabase-social.mjs';
import {createAiMiddleware} from './ai.mjs';

export function createSupabaseApplication(config){
  if(!config.supabaseUrl||!config.supabasePublishableKey||!config.supabaseSecretKey)throw new Error('Supabase configuration incomplete; refusing local fallback.');
  if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(config.supabaseUrl))throw new Error('Invalid Supabase project URL.');
  const auth=createSupabaseAuth(config),admin=makeSupabase({url:config.supabaseUrl,key:config.supabaseSecretKey});
  const social=createSupabaseSocial(admin,config),limit=createLimiter();
  const origins=new Set(config.origins),hosts=new Set(config.origins.map(o=>new URL(o).host));
  const ai=createAiMiddleware({apiKey:config.apiKey||'',model:config.model,originChecked:true});
  const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.mp3':'audio/mpeg','.ogg':'audio/ogg','.ico':'image/x-icon','.woff2':'font/woff2'};
  const server=createServer(async(req,res)=>{
    res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','DENY');res.setHeader('Referrer-Policy','no-referrer');
    try{
      if(!hosts.has(req.headers.host))throw new HttpError(403,'请求地址不受信任。');
      const path=new URL(req.url,'http://localhost').pathname;
      if(path.startsWith('/api/')){
        res.setHeader('Cache-Control','no-store');
        if(req.headers.origin&&!origins.has(req.headers.origin))throw new HttpError(403,'请从鱼塘页面发起请求。');
        if(!['GET','HEAD'].includes(req.method)&&(!origins.has(req.headers.origin)||req.headers['x-pond-request']!=='1'))throw new HttpError(403,'请求校验失败，请刷新重试。');
        if(path==='/api/health'&&req.method==='GET'){unwrap(await admin.from('pond_fish').select('fish_id').limit(0));return sendJson(res,200,{ok:true,service:'interview-pond-api',storage:'supabase',version:2});}
        if(await auth.route(req,res,path))return;
        // Provider configuration contains no credentials and can be viewed before sign-in.
        if(path==='/api/ai/status')return await ai(req,res,()=>sendJson(res,404,{error:'接口不存在。'}));
        const s=await auth.requireUser(req,res);
        if(path==='/api/pond/state'&&req.method==='GET')return sendJson(res,200,unwrap(await s.db.rpc('pond_read_state')));
        if(path==='/api/pond/fish'&&req.method==='POST'){
          if(req.headers['x-pond-user']!==s.user.id)throw new HttpError(409,'账号已切换，请刷新。');
          limit('fish:'+s.user.id,20,60000);const body=await readJson(req,32768);
          const result=unwrap(await s.db.rpc('pond_create_fish',{p_fish:body.fish}));
          try{await social.refreshRoster(s.user.id);}catch{/* Fish is committed. Next social request reloads the roster. */}
          return sendJson(res,200,result);
        }
        if(path.startsWith('/api/pond/state/')&&req.method==='PUT'){
          if(req.headers['x-pond-user']!==s.user.id)throw new HttpError(409,'账号已切换，请刷新。');
          limit('save:'+s.user.id,240,60000);const body=await readJson(req,512*1024),key=path.slice('/api/pond/state/'.length);
          if(!Number.isSafeInteger(body.revision)||body.revision<0||body.value===undefined)throw new HttpError(422,'保存格式不正确。');
          return sendJson(res,200,unwrap(await s.db.rpc('pond_save_state',{p_key:key,p_value:body.value,p_revision:body.revision})));
        }
        if(await social.route(req,res,path,s.user))return;
        if(path==='/api/ai/interview'&&req.method==='POST'){
          limit('ai:'+s.user.id,8,60000);
          if(!config.apiKey)throw new HttpError(503,'AI 尚未配置，可以先手动创建。');
          if(!unwrap(await admin.rpc('pond_use_ai',{p_user:s.user.id,p_kind:'interview',p_limit:60})))throw new HttpError(429,'今天的 AI 整理额度已用完，明天再继续。手动创建仍可使用。');
          return await ai(req,res,()=>sendJson(res,404,{error:'接口不存在。'}));
        }
        throw new HttpError(404,'接口不存在。');
      }
      if(!config.staticRoot||!['GET','HEAD'].includes(req.method))throw new HttpError(404,'页面不存在。');
      const relative=decodeURIComponent(path==='/'?'/index.html':path);
      if(relative.split('/').some(s=>s.startsWith('.'))||relative.includes('\\'))throw new HttpError(404,'页面不存在。');
      const root=resolve(config.staticRoot),file=resolve(root,'.'+relative);
      if(!file.startsWith(root+sep))throw new HttpError(404,'页面不存在。');
      let info;try{info=await stat(file);}catch{throw new HttpError(404,'页面不存在，请先构建。');}
      if(!info.isFile())throw new HttpError(404,'页面不存在。');
      res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
      res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream','Cache-Control':extname(file)==='.html'?'no-cache':'public, max-age=3600','Content-Length':info.size});res.end(req.method==='HEAD'?undefined:await readFile(file));
    }catch(error){if(!res.headersSent&&!res.destroyed)sendJson(res,error instanceof HttpError?error.status:500,{error:error instanceof HttpError?error.message:'服务暂时遇到问题，请重试。'});}
  });server.requestTimeout=100000;server.headersTimeout=15000;
  return {server,social,close:async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));await social.close();}};
}
