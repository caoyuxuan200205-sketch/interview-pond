export type FinKind = 'tail' | 'dorsal' | 'pectoral' | 'belly' | 'petal' | 'flipper';
export type FinProfile = {kind:FinKind;side:number;phase:number;softness:number};
export type FinMotion = {time:number;stroke:number;effort:number;speed:number;turn:number};
const clamp=(x:number,a:number,b:number)=>Math.max(a,Math.min(b,x));

// Rest-space distances anchor the attachment and allow progressively more
// flex at the edge. Membranes and their supporting rays use the same field.
export function finWeights(rest:Float32Array,reach?:number){
  let span=reach??0;
  if(!reach)for(let i=0;i<rest.length;i+=3)span=Math.max(span,Math.hypot(rest[i],rest[i+1],rest[i+2]));
  const weights=new Float32Array(rest.length/3);
  for(let i=0;i<weights.length;i++)weights[i]=clamp(Math.hypot(rest[i*3],rest[i*3+1],rest[i*3+2])/Math.max(.01,span),0,1);
  return weights;
}

export function flexFin(rest:Float32Array,weights:Float32Array,out:Float32Array,profile:FinProfile,motion:FinMotion){
  const effort=clamp(motion.effort,0,1),speed=clamp(motion.speed,0,1.5);
  const pectoral=profile.kind==='pectoral'||profile.kind==='flipper';
  const stabilizer=profile.kind==='dorsal'||profile.kind==='belly';
  const phase=pectoral?motion.stroke*.43+motion.time*.35+profile.phase:motion.stroke*(stabilizer?.58:1)+profile.phase;
  const amplitude=(pectoral?(profile.kind==='flipper'?.045:.032)+effort*.09:stabilizer?.018+effort*.038:.035+effort*.16)*profile.softness;
  // Smooth, distance-dependent lag gives an S-shaped membrane instead of a paddle.
  for(let i=0;i<weights.length;i++){
    const k=i*3,x=rest[k],y=rest[k+1],z=rest[k+2],s=weights[i];
    const weight=s*s;
    const lag=s*(pectoral?2.0:1.65);
    const wave=Math.sin(phase-lag)+Math.sin(phase*.5-lag*1.3+profile.phase)*.18;
    const curl=Math.cos(phase-lag-.6);
    if(pectoral){
      const fold=(.075+speed*.035-effort*.04)*weight;
      out[k]=x*(1-fold);
      out[k+1]=y+wave*amplitude*weight;
      out[k+2]=z+curl*amplitude*.42*weight*s+profile.side*motion.turn*.016*weight;
    }else{
      out[k]=x+wave*amplitude*weight-motion.turn*.045*weight;
      out[k+1]=y*(1-(.07*(1-effort)+.025*curl)*weight);
      out[k+2]=z+curl*amplitude*.2*weight*s;
    }
  }
}
