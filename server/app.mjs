import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { openDatabase } from './database.mjs';
import { createAuth, createLimiter, HttpError, readJson, sendJson } from './auth.mjs';
import { createAiMiddleware } from './ai.mjs';
import { createSocialService } from './social.mjs';

const stateKeys = new Set(['pond-fish-v1','pond-favorites-v1','pond-preferences-v1','pond-read-v1','pond-draft-v1','pond-vote-v1','pond-comments-v1','pond-audio-v1','pond-onboarding-v1']);
const mime = { '.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.mp3':'audio/mpeg','.ogg':'audio/ogg','.ico':'image/x-icon','.woff2':'font/woff2' };
export function createApplication(config) {
  const db = openDatabase(config.databaseFile);
  const auth = createAuth(db, config);
  const social = createSocialService(db,auth,{apiKey:config.apiKey,model:config.model,...config.socialOptions});
  const origins = new Set(config.origins);
  const hosts = new Set(config.origins.map(origin => new URL(origin).host));
  const ai = createAiMiddleware({ apiKey:config.apiKey || '', model:config.model, originChecked:true });
  const limit = createLimiter();
  const server = createServer(async (req,res) => {
    res.setHeader('X-Content-Type-Options','nosniff'); res.setHeader('X-Frame-Options','DENY'); res.setHeader('Referrer-Policy','same-origin');
    try {
      if (!hosts.has(req.headers.host)) throw new HttpError(403,'请求地址不受信任。');
      const path = new URL(req.url,'http://localhost').pathname;
      if (path.startsWith('/api/')) {
        if (req.headers.origin && !origins.has(req.headers.origin)) throw new HttpError(403,'请从鱼塘页面发起请求。');
        if (!['GET','HEAD'].includes(req.method) && (!origins.has(req.headers.origin) || req.headers['x-pond-request'] !== '1')) throw new HttpError(403,'请求校验失败，请刷新页面重试。');
        if (path === '/api/health' && req.method === 'GET') return sendJson(res,200,{ ok:true, service:'interview-pond-api', version:1 });
        if (await auth.route(req,res,path)) return;
        if (await social.route(req,res,path)) return;
        if(path==='/api/pond/fish'&&req.method==='POST'){
          const user=auth.requireUser(req);if(req.headers['x-pond-user']!==user.id)throw new HttpError(409,'账号已切换，请刷新。');
          limit('fish:'+user.id,20,60000);const {fish}=await readJson(req,32768);
          if(!fish||!/^fish-[a-zA-Z0-9-]{8,90}$/.test(fish.id)||typeof fish.name!=='string'||!fish.name.trim()||!Number.isInteger(fish.sprite)||fish.sprite<0||fish.sprite>11||!Array.isArray(fish.traits))throw new HttpError(422,'鱼的信息不完整。');
          db.exec('BEGIN IMMEDIATE');let saved,created=false;
          try{
            const row=db.prepare("SELECT value_json,revision FROM pond_state WHERE user_id=? AND state_key='pond-fish-v1'").get(user.id);
            const list=row?JSON.parse(row.value_json):[];const prior=list.find(f=>f.id===fish.id);
            social.validateFish(user.id,prior?list.map(f=>f.id===fish.id?fish:f):[...list,fish]);
            saved=prior||fish;
            if(!prior){list.push(fish);created=true;db.prepare('INSERT INTO pond_state VALUES(?,?,?,?,?) ON CONFLICT(user_id,state_key) DO UPDATE SET value_json=excluded.value_json,revision=excluded.revision,updated_at=excluded.updated_at').run(user.id,'pond-fish-v1',JSON.stringify(list),(row?.revision||0)+1,Date.now());social.registerFish(user.id,list);}
            db.exec('COMMIT');
          }catch(e){db.exec('ROLLBACK');throw e;}
          try{social.refreshRoster(user.id);}catch{}
          const values={},revisions={};for(const row of db.prepare('SELECT state_key,value_json,revision FROM pond_state WHERE user_id=?').all(user.id)){values[row.state_key]=JSON.parse(row.value_json);revisions[row.state_key]=row.revision;}
          return sendJson(res,200,{fish:saved,created,state:{userId:user.id,values,revisions}});
        }
        if (path === '/api/pond/state' && req.method === 'GET') {
          const user = auth.requireUser(req), values = {}, revisions = {};
          for (const row of db.prepare('SELECT state_key,value_json,revision FROM pond_state WHERE user_id=?').all(user.id)) { values[row.state_key] = JSON.parse(row.value_json); revisions[row.state_key] = row.revision; }
          return sendJson(res,200,{ userId:user.id, values, revisions });
        }
        if (path.startsWith('/api/pond/state/') && req.method === 'PUT') {
          const user = auth.requireUser(req), key = path.slice('/api/pond/state/'.length);
          if (req.headers['x-pond-user'] !== user.id) throw new HttpError(409,'登录账号已变化，请刷新后再修改。');
          if (!stateKeys.has(key)) throw new HttpError(400,'不支持的数据类型。');
          limit('save:'+user.id,240,60000);
          const body = await readJson(req,512*1024);
          if (!Number.isInteger(body.revision) || body.revision < 0 || body.value === undefined) throw new HttpError(422,'保存格式不正确。');
          if(key==='pond-onboarding-v1'&&(!body.value||body.value.version!==1||!['active','paused','complete'].includes(body.value.status)||!['welcome','create','observe','profile','waiting','social','done'].includes(body.value.step)||(body.value.fishId!==undefined&&(typeof body.value.fishId!=='string'||body.value.fishId.length>100))))throw new HttpError(422,'教程进度格式不正确。');
          if(key==='pond-fish-v1')social.validateFish(user.id,body.value);
          const json = JSON.stringify(body.value);
          db.exec('BEGIN IMMEDIATE');
          let revision;
          try {
            const row = db.prepare('SELECT revision FROM pond_state WHERE user_id=? AND state_key=?').get(user.id,key);
            if ((row?.revision || 0) !== body.revision) throw new HttpError(409,'另一窗口已更新鱼塘，请刷新后再修改。');
            revision = body.revision+1;
            db.prepare('INSERT INTO pond_state VALUES(?,?,?,?,?) ON CONFLICT(user_id,state_key) DO UPDATE SET value_json=excluded.value_json, revision=excluded.revision, updated_at=excluded.updated_at').run(user.id,key,json,revision,Date.now());
            if(key==='pond-fish-v1')social.registerFish(user.id,body.value);
            db.exec('COMMIT');
          } catch(error) { db.exec('ROLLBACK'); throw error; }
          if(key==='pond-fish-v1'){try{social.refreshRoster(user.id);}catch{console.error('Saved fish; social world will reload on next request.');}}
          return sendJson(res,200,{ revision });
        }
        if (path.startsWith('/api/ai/')) {
          if (path === '/api/ai/interview') { const user = auth.requireUser(req); limit('ai:'+user.id,8,60000); }
          return await ai(req,res,() => sendJson(res,404,{ error:'接口不存在。' }));
        }
        throw new HttpError(404,'接口不存在。');
      }
      if (!config.staticRoot || !['GET','HEAD'].includes(req.method)) throw new HttpError(404,'页面不存在。');
      const relative = decodeURIComponent(path === '/' ? '/index.html' : path);
      if (relative.split('/').some(segment => segment.startsWith('.')) || relative.includes('\\')) throw new HttpError(404,'页面不存在。');
      const root = resolve(config.staticRoot), file = resolve(root,'.'+relative);
      if (!file.startsWith(root+sep)) throw new HttpError(404,'页面不存在。');
      let info; try { info = await stat(file); } catch { throw new HttpError(404,'页面不存在，请先构建应用。'); }
      if (!info.isFile()) throw new HttpError(404,'页面不存在。');
      res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
      res.writeHead(200,{ 'Content-Type': mime[extname(file)] || 'application/octet-stream', 'Cache-Control':extname(file)==='.html'?'no-cache':'public, max-age=3600', 'Content-Length':info.size });
      res.end(req.method === 'HEAD' ? undefined : await readFile(file));
    } catch(error) {
      if (res.headersSent || res.destroyed) return;
      sendJson(res,error instanceof HttpError ? error.status : 500,{ error:error instanceof HttpError ? error.message : '服务暂时遇到问题，请重试。' });
    }
  });
  server.requestTimeout = 100000; server.headersTimeout = 15000;
  return { server, db, social, close: () => new Promise(resolveClose => { social.close(); server.closeAllConnections(); server.close(() => { db.close(); resolveClose(); }); }) };
}
