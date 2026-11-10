export type MouthAnchor={x:number;y:number;dx:number;dy:number;visible:boolean};
export type MouthBubble={x:number;y:number;vx:number;vy:number;age:number;life:number;radius:number;phase:number};
export function makeMouthBubble(anchor:MouthAnchor,random=Math.random):MouthBubble{
  return {x:anchor.x,y:anchor.y,vx:anchor.dx*9+(random()-.5)*3,vy:Math.min(-2,anchor.dy*6-8),age:0,life:3.5+random()*2,radius:2+random()*1.7,phase:random()*Math.PI*2};
}
export function advanceMouthBubble(b:MouthBubble,delta:number){
  const dt=Math.max(0,Math.min(.05,delta));b.age+=dt;
  b.vx*=Math.exp(-dt*.8);b.vy+=(-27-b.radius*2-b.vy)*(1-Math.exp(-dt*1.3));
  b.x+=(b.vx+Math.sin(b.age*1.7+b.phase)*2)*dt;b.y+=b.vy*dt;
  return b.age<b.life&&b.y>202;
}
