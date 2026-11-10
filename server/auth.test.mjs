import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { request as httpRequest } from 'node:http';
import { createApplication } from './app.mjs';
const origin='http://localhost:5173';
const password='TestOnly-Fish-Pond-2026!';
async function boot(file,options={}) {
  const app=createApplication({databaseFile:file,origins:[origin],...options});
  app.server.listen(0,'127.0.0.1');await once(app.server,'listening');
  const base=`http://127.0.0.1:${app.server.address().port}`;
  async function call(path,{method='GET',cookie='',body,headers={}}={}) {
    return new Promise((resolve,reject)=>{
      const req=httpRequest(base+path,{method,headers:{Host:'localhost:5173',Origin:origin,'X-Pond-Request':'1','Content-Type':'application/json',Cookie:cookie,...headers}},res=>{
        const chunks=[];res.on('data',chunk=>chunks.push(chunk));res.on('end',()=>{
          const setCookie=res.headers['set-cookie']?.[0]||'';
          try{resolve({status:res.statusCode,body:JSON.parse(Buffer.concat(chunks)),cookie:setCookie.split(';')[0],setCookie});}catch(e){reject(e);}
        });
      });req.on('error',reject);req.setTimeout(10000,()=>req.destroy(new Error('test request timeout')));req.end(body===undefined?undefined:JSON.stringify(body));
    });
  }
  return {...app,call};
}
test('real registration, password verification, durable session and logout revocation',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'pond-auth-'));const file=join(directory,'test.sqlite');let app=await boot(file);
  try {
    assert.equal((await app.call('/api/auth/register',{method:'POST',body:{name:'测试塘主',email:'a@example.test',password:'short'}})).status,422);
    const registration=await app.call('/api/auth/register',{method:'POST',body:{name:'测试塘主',email:' A@Example.Test ',password}});
    assert.equal(registration.status,201);assert.equal(registration.body.user.email,'a@example.test');
    assert.match(registration.setCookie,/HttpOnly/);assert.match(registration.setCookie,/SameSite=Lax/);assert.ok(!JSON.stringify(registration.body).includes(password));
    const row=app.db.prepare('SELECT * FROM users').get();assert.match(row.password_hash,/^scrypt\$/);assert.ok(!row.password_hash.includes(password));
    const storedSession=app.db.prepare('SELECT token_hash FROM sessions').get();assert.notEqual(storedSession.token_hash,registration.cookie.split('=')[1]);
    const duplicate=await app.call('/api/auth/register',{method:'POST',body:{name:'重复',email:'A@example.test',password}});assert.equal(duplicate.status,409);
    const invalid=await app.call('/api/auth/login',{method:'POST',body:{email:'a@example.test',password:password+'wrong'}});assert.equal(invalid.status,401);
    const unknown=await app.call('/api/auth/login',{method:'POST',body:{email:'missing@example.test',password}});assert.deepEqual(invalid.body,unknown.body);
    await app.close();app=await boot(file);
    const restored=await app.call('/api/auth/session',{cookie:registration.cookie});assert.equal(restored.body.user.id,registration.body.user.id);
    const login=await app.call('/api/auth/login',{method:'POST',cookie:registration.cookie,body:{email:'a@example.test',password}});assert.equal(login.status,200);assert.notEqual(login.cookie,registration.cookie);
    assert.equal((await app.call('/api/auth/session',{cookie:registration.cookie})).body.user,null);
    assert.equal((await app.call('/api/auth/logout',{method:'POST',cookie:login.cookie,body:{}})).status,200);
    assert.equal((await app.call('/api/auth/session',{cookie:login.cookie})).body.user,null);
    assert.equal((await app.call('/api/pond/state',{cookie:login.cookie})).status,401);
  } finally {await app.close();assert.ok(directory.startsWith(join(tmpdir(),'pond-auth-')));await rm(directory,{recursive:true,force:true});}
});
test('accounts cannot read/write each other’s state; stale revisions are rejected',async()=>{
  const app=await boot(':memory:');
  try {
    const a=await app.call('/api/auth/register',{method:'POST',body:{name:'甲',email:'a@test.example',password}});
    const b=await app.call('/api/auth/register',{method:'POST',body:{name:'乙',email:'b@test.example',password}});
    const headers={'X-Pond-User':a.body.user.id};
    const saved=await app.call('/api/pond/state/pond-fish-v1',{method:'PUT',cookie:a.cookie,headers,body:{revision:0,value:[{id:'private-fish',skin:7}]}});assert.equal(saved.status,200);
    const other=await app.call('/api/pond/state',{cookie:b.cookie});assert.deepEqual(other.body.values,{});
    const own=await app.call('/api/pond/state',{cookie:a.cookie});assert.equal(own.body.values['pond-fish-v1'][0].skin,7);
    assert.equal((await app.call('/api/pond/state/pond-fish-v1',{method:'PUT',cookie:b.cookie,headers,body:{revision:0,value:[]}})).status,409);
    assert.equal((await app.call('/api/pond/state/pond-fish-v1',{method:'PUT',cookie:a.cookie,headers,body:{revision:0,value:[]}})).status,409);
    assert.equal((await app.call('/api/ai/interview',{method:'POST',body:{}})).status,401);
    assert.equal((await app.call('/api/pond/state/unknown',{method:'PUT',cookie:a.cookie,headers,body:{}})).status,400);
  } finally {await app.close();}
});
test('origin protection, session expiry and auth rate limit',async()=>{
  const app=await boot(':memory:');
  try {
    assert.equal((await app.call('/api/auth/register',{method:'POST',headers:{Origin:'https://evil.example'},body:{}})).status,403);
    assert.equal((await app.call('/api/auth/logout',{method:'POST',headers:{'X-Pond-Request':''},body:{}})).status,403);
    const a=await app.call('/api/auth/register',{method:'POST',body:{name:'甲',email:'a@test.example',password}});
    app.db.prepare('UPDATE sessions SET expires_at=?').run(Date.now()-1);
    assert.equal((await app.call('/api/auth/session',{cookie:a.cookie})).body.user,null);
    for(let i=0;i<7;i++)assert.equal((await app.call('/api/auth/login',{method:'POST',body:{email:'a@test.example',password:'wrong'}})).status,401);
    assert.equal((await app.call('/api/auth/login',{method:'POST',body:{email:'a@test.example',password}})).status,429);
  } finally {await app.close();}
});
