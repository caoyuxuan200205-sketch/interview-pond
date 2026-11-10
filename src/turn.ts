export type TurnState = {pose:number;from:number;target:number;elapsed:number;cooldown:number;turns:number};
export const TURN_DURATION = 1.9;
export const isTurning = (state:TurnState) => state.elapsed < TURN_DURATION;
export function createTurn(facing:number):TurnState {
  const pose=facing>0?0:8;
  return {pose,from:pose,target:pose,elapsed:TURN_DURATION,cooldown:0,turns:0};
}
export function startTurn(state:TurnState,facing:number) {
  if(isTurning(state))return false;
  const target=facing>0?0:8;
  if(target===state.pose)return false;
  state.from=state.pose;state.target=target;state.elapsed=0;state.turns++;
  return true;
}
const ease=(t:number)=>(1-Math.cos(Math.PI*t))/2;
export function advanceTurn(state:TurnState,desiredFacing:number,delta:number) {
  const dt=Math.max(0,Math.min(delta,.05));
  state.cooldown=Math.max(0,state.cooldown-dt);
  if(!isTurning(state)&&state.cooldown===0)startTurn(state,desiredFacing);
  if(!isTurning(state))return;
  state.elapsed=Math.min(TURN_DURATION,state.elapsed+dt);
  // Head comes toward the viewer, holds a short glance, then the body follows.
  const progress=state.elapsed<=.8?ease(state.elapsed/.8)*.5:state.elapsed<=1.1?.5:.5+ease((state.elapsed-1.1)/.8)*.5;
  state.pose=state.from+(state.target-state.from)*progress;
  if(state.elapsed===TURN_DURATION){state.pose=state.target;state.cooldown=1.1;}
}
