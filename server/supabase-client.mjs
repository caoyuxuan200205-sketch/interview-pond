import {createClient} from '@supabase/supabase-js';
import {HttpError} from './auth.mjs';

export function makeSupabase({url,key,token,fetch:customFetch}) {
  return createClient(url,key,{db:{retry:false},auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
    global:{headers:token?{Authorization:`Bearer ${token}`}:{},fetch:customFetch||((input,init)=>fetch(input,{...init,signal:init?.signal?AbortSignal.any([init.signal,AbortSignal.timeout(15000)]):AbortSignal.timeout(15000)}))}});
}
export function unwrap({data,error}) {
  if(error){
    const code=error.code;
    console.error(JSON.stringify({event:'pond_storage_error',code:code||'network'}));
    if(!code)console.error(JSON.stringify({event:'pond_storage_network',message:String(error.message||'').slice(0,100)}));
    if(code==='40001'||code==='55P03'||code==='PT409')throw new HttpError(409,'数据已更新，或这条鱼的外观已经固定，请刷新后重试。');
    if(code==='28000'||code==='PGRST301'||code==='PGRST303')throw new HttpError(401,'登录已过期，请重新登录。');
    if(code==='22023'||code==='23514')throw new HttpError(422,'提交的数据不符合鱼塘规则。');
    throw new HttpError(503,'云端存储暂时不可用，请保留当前页面并重试。');
  }
  return data;
}
