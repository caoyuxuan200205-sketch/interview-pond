import { randomBytes, randomUUID, createHash, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
const derive = promisify(scrypt);
const SCRYPT = { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 };
const digest = value => createHash('sha256').update(value).digest('hex');
export class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }
export function sendJson(res, status, value) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(value));
}
export async function readJson(req, max = 16384) {
  if (!req.headers['content-type']?.startsWith('application/json')) throw new HttpError(415, '请使用 JSON 请求。');
  const chunks = []; let size = 0;
  for await (const chunk of req) { size += chunk.length; if (size > max) throw new HttpError(413, '提交内容过大。'); chunks.push(chunk); }
  try { const result = JSON.parse(Buffer.concat(chunks).toString('utf8')); if (!result || typeof result !== 'object' || Array.isArray(result)) throw new Error(); return result; }
  catch { throw new HttpError(400, '请求格式不正确。'); }
}
export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const key = await derive(password, salt, 64, SCRYPT);
  return `scrypt$32768$8$3$${salt}$${key.toString('hex')}`;
}
export async function checkPassword(password, encoded) {
  const [algorithm,n,r,p,salt,hash] = encoded.split('$');
  if (algorithm !== 'scrypt' || n !== '32768' || r !== '8' || p !== '3' || !/^[a-f0-9]{32}$/.test(salt) || !/^[a-f0-9]{128}$/.test(hash)) return false;
  const actual = await derive(password, salt, 64, SCRYPT);
  return timingSafeEqual(actual, Buffer.from(hash,'hex'));
}
export function createLimiter() {
  const entries = new Map();
  return (key, maximum, windowMs) => {
    const now = Date.now();
    if (entries.size >= 10000) { for (const [k,v] of entries) if (v.until <= now) entries.delete(k); if (entries.size >= 10000) throw new HttpError(429, '请求较多，请稍后再试。'); }
    const entry = entries.get(key);
    if (!entry || entry.until <= now) { entries.set(key,{ count: 1, until: now + windowMs }); return; }
    if (entry.count >= maximum) throw new HttpError(429, '尝试次数较多，请稍后再试。');
    entry.count++;
  };
}
export function createAuth(db, { secureCookies = false, sessionMs = 7*86400000, idleMs = 86400000 } = {}) {
  const cookieName = secureCookies ? '__Host-pond_session' : 'pond_session';
  const limit = createLimiter();
  let hashing = 0;
  const dummyHash = `scrypt$32768$8$3$${'0'.repeat(32)}$${'0'.repeat(128)}`;
  const tokenOf = req => (req.headers.cookie || '').split(';').map(v => v.trim()).find(v => v.startsWith(cookieName+'='))?.slice(cookieName.length + 1) || '';
  const publicUser = row => ({ id: row.id, email: row.email, name: row.name, createdAt: new Date(row.created_at).toISOString() });
  function cookie(res, token, seconds) { res.setHeader('Set-Cookie', `${cookieName}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${seconds}${secureCookies ? '; Secure' : ''}`); }
  function session(req) {
    const token = tokenOf(req); if (!/^[a-f0-9]{64}$/.test(token)) return null;
    const now = Date.now(), tokenHash = digest(token);
    const row = db.prepare(`SELECT u.*, s.expires_at, s.last_seen FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=?`).get(tokenHash);
    if (!row) return null;
    if (row.expires_at <= now || row.last_seen <= now-idleMs) { db.prepare('DELETE FROM sessions WHERE token_hash=?').run(tokenHash); return null; }
    if (now-row.last_seen > 60000) db.prepare('UPDATE sessions SET last_seen=? WHERE token_hash=?').run(now, tokenHash);
    return publicUser(row);
  }
  function requireUser(req) { const user = session(req); if (!user) throw new HttpError(401, '请先登录，或重新登录已过期的账号。'); return user; }
  function establish(req, res, userId) {
    const now = Date.now(), token = randomBytes(32).toString('hex');
    db.exec('BEGIN IMMEDIATE');
    try {
      db.prepare('DELETE FROM sessions WHERE expires_at<=? OR last_seen<=? OR token_hash=?').run(now, now-idleMs, digest(tokenOf(req)));
      db.prepare('INSERT INTO sessions VALUES (?,?,?,?,?)').run(digest(token), userId, now, now, now+sessionMs);
      db.prepare('DELETE FROM sessions WHERE user_id=? AND token_hash NOT IN (SELECT token_hash FROM sessions WHERE user_id=? ORDER BY created_at DESC LIMIT 5)').run(userId,userId);
      db.exec('COMMIT');
    } catch(error) { db.exec('ROLLBACK'); throw error; }
    cookie(res,token, Math.floor(sessionMs/1000));
  }
  async function route(req,res,path) {
    if (path === '/api/auth/session' && req.method === 'GET') { sendJson(res,200,{ user: session(req) }); return true; }
    if (path === '/api/auth/logout' && req.method === 'POST') {
      db.prepare('DELETE FROM sessions WHERE token_hash=?').run(digest(tokenOf(req))); cookie(res,'',0); sendJson(res,200,{ ok:true }); return true;
    }
    if (!['/api/auth/register','/api/auth/login'].includes(path) || req.method !== 'POST') return false;
    const ip = req.socket.remoteAddress || 'unknown';
    limit('ip:'+ip,30,15*60000);
    const body = await readJson(req);
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || password.length < 1 || password.length > 128) throw new HttpError(422,'请填写有效邮箱和密码。');
    limit('login:'+digest(ip+'|'+email),8,15*60000);
    if (hashing >= 2) throw new HttpError(429,'正在处理其他登录请求，请稍后再试。');
    hashing++;
    try {
      if (path.endsWith('/register')) {
        const name = typeof body.name === 'string' ? body.name.trim() : '';
        if (!name || name.length > 12) throw new HttpError(422,'昵称请填写 1–12 个字符。');
        if (password.length < 12) throw new HttpError(422,'密码至少需要 12 位，最多 128 位。');
        const passwordHash = await hashPassword(password);
        const id = randomUUID(), createdAt = Date.now();
        try { db.prepare('INSERT INTO users(id,email,name,password_hash,created_at) VALUES(?,?,?,?,?)').run(id,email,name,passwordHash,createdAt); }
        catch(error) { if (db.prepare('SELECT id FROM users WHERE email=?').get(email)) throw new HttpError(409,'此邮箱无法重复注册，请尝试登录。'); throw error; }
        establish(req,res,id);
        sendJson(res,201,{ user: { id,email,name,createdAt:new Date(createdAt).toISOString() } });
      } else {
        const row = db.prepare('SELECT * FROM users WHERE email=?').get(email);
        const valid = await checkPassword(password,row?.password_hash || dummyHash);
        if (!row || !valid) throw new HttpError(401,'邮箱或密码不正确。');
        establish(req,res,row.id); sendJson(res,200,{user: publicUser(row)});
      }
    } finally { hashing--; }
    return true;
  }
  return { route, requireUser, session };
}
