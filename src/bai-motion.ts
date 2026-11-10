export type BaiPose = { yaw:number; moving:boolean; effort?:number; stroke?:number; speedRatio?:number; turnRate?:number };
export const poseToYaw=(pose:number)=>(1-Math.max(0,Math.min(8,pose))/4)*1.12;
export const angleDifference=(target:number,current:number)=>Math.atan2(Math.sin(target-current),Math.cos(target-current));
// The shallow aquarium projects vertical travel into front/back views. Keep a
// slight three-quarter bias, but allow both sides of the body through a full turn.
export const headingToYaw=(heading:number)=>Math.atan2(Math.cos(heading),.38+Math.sin(heading)*.9);
export function followAngle(current:number,target:number,dt:number,rate=10){
  return current+angleDifference(target,current)*(1-Math.exp(-rate*Math.max(0,Math.min(.05,dt))));
}
