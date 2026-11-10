// Explicit live test: only disposable accounts made by this run are removed.
// Does not email anyone, call ModelScope, or read any existing user's rows.
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {request as httpRequest} from 'node:http';
import {makeSupabase,unwrap} from '../server/supabase-client.mjs';
import {createSupabaseApplication} from '../server/supabase-app.mjs';
const file=process.argv[2];if(!file)throw Error('Pass the local .env file path, never a secret on the command line.');
process.loadEnvFile(file);
const config={supabaseUrl:process.env.SUPABASE_URL,supabasePublishableKey:process.env.SUPABASE_PUBLISHABLE_KEY,supabaseSecretKey:process.env.SUPABASE_SECRET_KEY,origins:['http://localhost:5173'],apiKey:''};
const admin=makeSupabase({url:config.supabaseUrl,key:config.supabaseSecretKey});
const ids=[],app=createSupabaseApplication(config),report=[];
const password='PondTest-'+randomUUID();
const fish={id:'fish-'+randomUUID(),name:'隔离测试伙伴',role:'产品经理',category:'产品',rarity:'R',sprite:1,skin:3,traits:['认真'],quote:'自动测试',description:'仅用于连接验证',company:'示例公司'};
app.server.listen(0,'127.0.0.1');await once(app.server,'listening');
function call(path,body,cookie='',method=body?'POST':'GET',extra={}){
  return new Promise((resolve,reject)=>{const req=httpRequest({host:'127.0.0.1',port:app.server.address().port,path,method,headers:{Host:'localhost:5173',Origin:'http://localhost:5173','Content-Type':'application/json','X-Pond-Request':'1',Cookie:cookie,...extra}},res=>{const chunks=[];res.on('data',c=>chunks.push(c));res.on('end',()=>{try{resolve({status:res.statusCode,body:JSON.parse(Buffer.concat(chunks)),cookie:(res.headers['set-cookie']||[]).map(c=>c.split(';')[0]).join('; '),headers:res.headers});}catch(e){reject(e);}});});req.on('error',reject);req.setTimeout(30000,()=>req.destroy(new Error('request timeout')));req.end(body?JSON.stringify(body):undefined);});
}
try{
  console.log('Starting isolated cloud-account verification.');
  for(let i=0;i<2;i++){
    const result=await admin.auth.admin.createUser({email:`pond-check-${randomUUID()}@example.invalid`,password,email_confirm:true,user_metadata:{name:'连接验证'}});
    if(result.error)throw new Error('Test-account creation failed: '+result.error.code);ids.push(result.data.user.id);
  }
  console.log('Disposable accounts ready.');
  const accounts=[];
  for(const id of ids){const {data,error}=await admin.auth.admin.getUserById(id);assert.equal(error,null);accounts.push(data.user);}
  assert.equal((await call('/api/health')).body.storage,'supabase');
  assert.equal((await call('/api/pond/state')).status,401);report.push('anonymous API blocked');
  const a=await call('/api/auth/login',{email:accounts[0].email,password});const b=await call('/api/auth/login',{email:accounts[1].email,password});
  assert.equal(a.status,200);assert.equal(b.status,200);assert.ok(a.headers['set-cookie'].every(v=>v.includes('HttpOnly')));report.push('real password login + HttpOnly session');
  console.log('Password login verified.');
  const empty=await call('/api/pond/state',null,a.cookie);assert.deepEqual(empty.body.values['pond-fish-v1'],[]);
  const headers={'X-Pond-User':ids[0]};
  const [one,two]=await Promise.all([call('/api/pond/fish',{fish},a.cookie,'POST',headers),call('/api/pond/fish',{fish},a.cookie,'POST',headers)]);
  assert.equal(one.status,200);assert.equal(two.status,200);assert.equal(Number(one.body.created)+Number(two.body.created),1);report.push('concurrent birth is idempotent');
  const retry=await call('/api/pond/fish',{fish:{...fish,skin:6}},a.cookie,'POST',headers);assert.equal(retry.status,409);report.push('appearance cannot reroll');
  const other=await call('/api/pond/state',null,b.cookie);assert.deepEqual(other.body.values['pond-fish-v1'],[]);
  assert.equal((await call('/api/pond/fish',{fish},b.cookie,'POST',headers)).status,409);report.push('cross-account API write blocked');
  const dbA=makeSupabase({url:config.supabaseUrl,key:config.supabasePublishableKey});const dbB=makeSupabase({url:config.supabaseUrl,key:config.supabasePublishableKey});
  assert.equal((await dbA.auth.signInWithPassword({email:accounts[0].email,password})).error,null);
  assert.equal((await dbB.auth.signInWithPassword({email:accounts[1].email,password})).error,null);
  assert.equal(unwrap(await dbA.from('pond_fish').select('fish_id')).length,1);assert.equal(unwrap(await dbB.from('pond_fish').select('fish_id')).length,0);
  assert.ok((await dbB.from('pond_fish').insert({user_id:ids[0],fish_id:fish.id,data:fish})).error);
  assert.ok((await dbA.rpc('pond_use_ai',{p_user:ids[0],p_kind:'interview',p_limit:1000})).error);report.push('RLS + server-only RPC enforced on direct API');
  const state={value:{name:'云端测试',motion:true,notifications:true,highContrast:false},revision:0};
  const first=await call('/api/pond/state/pond-preferences-v1',state,a.cookie,'PUT',headers);assert.equal(first.status,200);
  assert.equal((await call('/api/pond/state/pond-preferences-v1',state,a.cookie,'PUT',headers)).body.revision,first.body.revision);
  assert.equal((await call('/api/pond/state/pond-preferences-v1',{...state,value:{name:'stale'}},a.cookie,'PUT',headers)).status,409);report.push('lost-response replay + stale write protection');
  const snapshot=await call('/api/social/snapshot',null,a.cookie);assert.equal(snapshot.status,200);assert.equal(snapshot.body.fish.length,1);assert.equal(snapshot.body.events.length,0);report.push('cloud social roster and empty-history isolation');
  assert.equal(unwrap(await admin.rpc('pond_use_ai',{p_user:ids[0],p_kind:'interview',p_limit:1})),true);
  assert.equal(unwrap(await admin.rpc('pond_use_ai',{p_user:ids[0],p_kind:'interview',p_limit:1})),false);report.push('persistent daily AI quota');
  const out=await call('/api/auth/logout',{},a.cookie);assert.equal(out.status,200);report.push('logout succeeds');
  console.log(JSON.stringify({ok:true,checks:report},null,2));
}finally{
  await app.close();
  for(const id of ids){const {error}=await admin.auth.admin.deleteUser(id);if(error)throw new Error('Disposable test-account cleanup failed.');}
  console.log(JSON.stringify({temporaryAccountsRemoved:ids.length}));
}
