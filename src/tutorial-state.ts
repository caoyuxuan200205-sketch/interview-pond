export type Tutorial={version:1;status:'active'|'paused'|'complete';step:'welcome'|'create'|'observe'|'profile'|'waiting'|'social'|'done';fishId?:string};
export const freshTutorial=():Tutorial=>({version:1,status:'active',step:'welcome'});
export function validTutorial(value:unknown):value is Tutorial{
 const v=value as Tutorial;return !!v&&v.version===1&&['active','paused','complete'].includes(v.status)&&['welcome','create','observe','profile','waiting','social','done'].includes(v.step)&&(v.fishId===undefined||typeof v.fishId==='string');
}
// Progress follows actual page visits and personal fish, never a timer or a demo fish.
export function advanceTutorial(t:Tutorial,ids:string[],page:string,profileId?:string):Tutorial{
 if(t.status!=='active')return t;
 if(['observe','profile'].includes(t.step)&&!ids.includes(t.fishId||''))return {...t,step:ids.length?'observe':'create',fishId:ids[0]};
 if(t.step==='create'&&ids.length)return {...t,step:'observe',fishId:ids.at(-1)};
 if(t.step==='observe'&&page==='fish'&&profileId===t.fishId)return {...t,step:'profile'};
 if(t.step==='waiting'&&ids.length>=2)return {...t,step:'social'};
 return t;
}
