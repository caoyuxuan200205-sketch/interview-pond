import {palettes,internetPalettes} from './appearance';
export type FishLook={sprite:number;skin?:number};
export const originalColors=[
  ['#9773ca','#ffe1b8','#8d73d4'],['#2865ca','#fce8c8','#577ee0'],
  ['#ee781f','#ffe0ad','#dc4f25'],['#7f3fa8','#f5ccba','#9045bd'],
  ['#f4b91e','#ffe7aa','#efbb32'],['#dd729f','#ffe0d8','#db81b6'],
  ['#647bb6','#f9d9b4','#7b83c5'],['#dca43b','#fff1cf','#cb893d'],
  ['#4eaf91','#f7e7b9','#85c377'],['#7044c4','#f5d9ed','#9367d6'],
  ['#e58bb8','#ffecda','#cd89d5'],['#4c9a7f','#f2d29b','#a97840'],
] as const;
export function fishColors(look:FishLook){
  const sprite=Number.isInteger(look.sprite)&&look.sprite>=0&&look.sprite<12?look.sprite:0;
  const base=originalColors[sprite];
  const palette=look.skin===16?internetPalettes[sprite]:look.skin!==undefined&&look.skin>0&&look.skin<16?palettes[look.skin]:null;
  return {sprite,body:palette?.[1]??base[0],belly:palette?mixHex(palette[2],'#fff0d7',.30):base[1],fin:palette?.[2]??base[2],accent:palette?.[2]??(sprite===4?'#6059aa':sprite===9?'#ffe092':'#b98a48'),name:palette?.[0]??'初见本色'};
}
export function mixHex(a:string,b:string,t:number){const color=(s:string)=>[1,3,5].map(i=>parseInt(s.slice(i,i+2),16));const x=color(a),y=color(b);return '#'+x.map((v,i)=>Math.round(v+(y[i]-v)*t).toString(16).padStart(2,'0')).join('');}
