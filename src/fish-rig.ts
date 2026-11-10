import * as T from 'three';
import {followAngle,angleDifference,type BaiPose} from './bai-motion';
import {fishColors,mixHex,type FishLook} from './fish-3d-appearance';
import {finWeights,flexFin,type FinKind,type FinProfile} from './fin-motion';
const dimensions=[[.70,.68,1.04],[.63,.62,1.12],[.72,.70,.95],[.78,.74,1],[.55,.62,1.04],[.7,.65,.9],[.64,.58,1.05],[.93,.91,.97],[.54,.50,1.04],[.6,.56,.94],[.73,.73,.88],[.66,.44,.87]];
export function createFishRig(look:FishLook){
  const colors=fishColors(look),kind=colors.sprite;
  const root=new T.Group(),head=new T.Group(),tail=new T.Group();
  const material=(color:T.ColorRepresentation,extra:T.MeshPhysicalMaterialParameters={})=>new T.MeshPhysicalMaterial({color,roughness:.52,metalness:0,clearcoat:.18,clearcoatRoughness:.34,...extra});
  const cream=material(colors.belly),gold=material(0xb98a48,{metalness:.68,roughness:.26});
  // Keep the cheeks in the fish's own palette; reserve cream for a small muzzle.
  const faceColor=mixHex(colors.body,colors.belly,kind===0?.65:kind===7?.48:.18);
  const face=material(faceColor);
  const brown=material(0x71422d,{roughness:.6}),eyeWhite=material(0xfff8ef,{roughness:.2}),iris=material(0x603d67,{roughness:.16}),black=material(0x17152a,{roughness:.1});
  const blush=material(mixHex(colors.body,'#f5a7ba',.65),{roughness:.6});
  const sphere=new T.SphereGeometry(1,32,24);
  function ellipsoid(parent:T.Object3D,mat:T.Material,position:number[],scale:number[]){const m=new T.Mesh(sphere,mat);m.position.set(...position as [number,number,number]);m.scale.set(...scale as [number,number,number]);parent.add(m);return m;}
  function curve(parent:T.Object3D,points:number[][],radius:number,mat:T.Material){const path=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p as [number,number,number])));const m=new T.Mesh(new T.TubeGeometry(path,14,radius,5,false),mat);parent.add(m);return m;}

  // Deterministic UV skin: lavender back, cream belly, ink-purple spots.
  // This is a new procedural material, not a recolor/edit of reference artwork.
  const skinCanvas=document.createElement('canvas');skinCanvas.width=1024;skinCanvas.height=512;
  const ctx=skinCanvas.getContext('2d')!;
  const gradient=ctx.createLinearGradient(0,0,0,512);gradient.addColorStop(0,mixHex(colors.body,'#36304f',.22));gradient.addColorStop(.40,colors.body);gradient.addColorStop(.70,mixHex(colors.body,colors.belly,.10));gradient.addColorStop(.88,mixHex(colors.body,colors.belly,.55));gradient.addColorStop(1,colors.belly);ctx.fillStyle=gradient;ctx.fillRect(0,0,1024,512);
  let seed=781+kind*173;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  if([0,1,3,7,8].includes(kind))for(let i=0;i<65;i++){const x=random()*1024,y=55+random()*190,r=4+random()*10;ctx.fillStyle=mixHex(colors.body,'#302246',.45);ctx.beginPath();ctx.ellipse(x,y,r,r*.67,random()*3,0,Math.PI*2);ctx.fill();}
  if(kind===2||kind===4){ctx.strokeStyle=kind===4?colors.accent:colors.belly;ctx.lineWidth=kind===4?42:28;for(const x of [80,440,660,900]){ctx.beginPath();ctx.moveTo(x,0);ctx.bezierCurveTo(x+30,150,x-30,350,x,512);ctx.stroke();}}
  if(kind===9){ctx.fillStyle=colors.accent;for(let i=0;i<18;i++){const x=random()*1024,y=70+random()*260,r=9+random()*17;ctx.beginPath();for(let j=0;j<10;j++){const a=j*Math.PI/5-Math.PI/2,d=j%2?r*.42:r;ctx.lineTo(x+Math.cos(a)*d,y+Math.sin(a)*d);}ctx.closePath();ctx.fill();}}
  const cheekBlend=ctx.createRadialGradient(256,300,12,256,300,120);cheekBlend.addColorStop(0,faceColor);cheekBlend.addColorStop(.35,faceColor);cheekBlend.addColorStop(1,faceColor+'00');ctx.fillStyle=cheekBlend;ctx.fillRect(0,0,1024,512);
  // Fine overlapping scales are deliberately subtle at the aquarium viewing size.
  ctx.strokeStyle='#ffffff0c';ctx.lineWidth=1.2;for(let row=0;row<18;row++)for(let col=0;col<35;col++){ctx.beginPath();ctx.arc(col*31+(row%2)*15,row*26,14,0,Math.PI);ctx.stroke();}
  const skin=new T.CanvasTexture(skinCanvas);skin.colorSpace=T.SRGBColorSpace;skin.anisotropy=4;
  const bodyMat=material(0xffffff,{map:skin,iridescence:.07,iridescenceIOR:1.3});
  ellipsoid(root,bodyMat,[0,0,-.24],dimensions[kind]);
  head.position.set(0,kind===11?-.06:0,kind===11?.55:.40);root.add(head);
  ellipsoid(head,face,[0,-.035,.08],[.595,.54,.59]);
  ellipsoid(head,cream,[0,-.25,.42],[.36,.22,.25]);
  for(const side of [-1,1]){
    const eye=new T.Group();eye.position.set(side*.365,.17,.48);eye.rotation.y=side*.25;head.add(eye);
    ellipsoid(eye,eyeWhite,[0,0,0],[.238,.258,.154]);
    ellipsoid(eye,iris,[side*.012,-.008,.126],[.135,.168,.045]);
    ellipsoid(eye,black,[side*.012,-.008,.163],[.088,.123,.025]);
    ellipsoid(eye,new T.MeshBasicMaterial({color:0xffffff}),[-.034,.066,.187],[.034,.045,.012]);
    ellipsoid(eye,new T.MeshBasicMaterial({color:0xffe4bf}),[.043,-.057,.183],[.013,.017,.009]);
    if([0,1,5,6].includes(kind)){
      const rimMaterial=kind===1||kind===6?black:gold;
      if(kind===1||kind===6)curve(eye,[[-.25,-.19,.17],[-.27,.18,.17],[-.20,.23,.17],[.23,.23,.17],[.27,.17,.17],[.24,-.19,.17],[-.25,-.19,.17]],.023,rimMaterial);
      else{const rimMesh=new T.Mesh(new T.TorusGeometry(.26,.016,8,40),gold);rimMesh.position.z=.16;eye.add(rimMesh);}
      if(kind===6)ellipsoid(eye,black,[0,.015,.19],[.245,.20,.04]);
      else{const lens=new T.Mesh(new T.CircleGeometry(.244,32),material(0xc9e6ff,{transparent:true,opacity:.055,depthWrite:false,roughness:.12}));lens.position.z=.168;eye.add(lens);}
      curve(head,[[side*.60,.20,.48],[side*.65,.18,.12],[side*.59,.13,-.18]],.013,rimMaterial);
    }
    if(kind===3)ellipsoid(eye,bodyMat,[0,.12,.14],[.238,.14,.06]);
    ellipsoid(head,blush,[side*.43,-.17,.44],[.12,.065,.028]);
  }
  if([0,1,5,6].includes(kind))curve(head,[[-.10,.16,.65],[0,.205,.67],[.10,.16,.65]],.016,kind===1||kind===6?black:gold);
  curve(head,[[-.12,-.19,.684],[0,-.23,.713],[.12,-.19,.684]],.016,material(0xa26769));
  ellipsoid(head,cream,[0,-.24,.693],[.08,.026,.024]);
  const mouth=new T.Object3D();mouth.position.set(0,kind===4?-.10:-.21,kind===4?1.25:.72);head.add(mouth);
  // Bow tie is actual geometry, fixed to the throat.
  if(kind===0)for(const side of [-1,1]){const bow=ellipsoid(head,brown,[side*.14,-.48,.31],[.18,.10,.065]);bow.rotation.z=side*.22;}
  if(kind===0)ellipsoid(head,gold,[0,-.48,.38],[.065,.065,.035]);

  const finMat=material(colors.fin,{side:T.DoubleSide,transparent:true,opacity:.94,depthWrite:false,metalness:0,roughness:.46,iridescence:.20});
  const rayMat=material(mixHex(colors.fin,'#ffffff',.22),{transparent:true,opacity:.65,roughness:.52});
  const flexible:Array<{geometry:T.BufferGeometry;rest:Float32Array;weights:Float32Array;profile:FinProfile}>=[];
  function registerFlex(geometry:T.BufferGeometry,profile:FinProfile,reach?:number){
    const attr=geometry.getAttribute('position') as T.BufferAttribute;
    attr.setUsage(T.DynamicDrawUsage);
    const rest=new Float32Array(attr.array);
    flexible.push({geometry,rest,weights:finWeights(rest,reach),profile});
    // Vertices flex beyond rest bounds; preserve the entire silhouette at every phase.
    geometry.computeBoundingSphere();if(geometry.boundingSphere)geometry.boundingSphere.radius+=.3;
  }
  function flexSolid(mesh:T.Mesh,profile:FinProfile){
    // Bake a unique mesh into its parent's coordinates. Never deform shared body geometry.
    mesh.updateMatrix();mesh.geometry=mesh.geometry.clone().applyMatrix4(mesh.matrix);
    mesh.position.set(0,0,0);mesh.rotation.set(0,0,0);mesh.scale.set(1,1,1);
    registerFlex(mesh.geometry,profile);
  }
  function fin(parent:T.Object3D,outline:number[][],type:FinKind='tail',side=0){
    // Curved membrane from the attachment point to a continuous fin outline.
    const edge=new T.CatmullRomCurve3(outline.map(p=>new T.Vector3(...p as [number,number,number])));
    const positions:number[]=[],indices:number[]=[];const rows=10,cols=24;
    for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){const t=j/rows,p=edge.getPoint(i/cols).multiplyScalar(t);p.x+=Math.sin(t*Math.PI)*.045;positions.push(p.x,p.y,p.z);}
    for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){const a=j*(cols+1)+i,b=a+cols+1;indices.push(a,b,a+1,a+1,b,b+1);}
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();parent.add(new T.Mesh(g,finMat));
    const reach=Math.max(...outline.map(p=>Math.hypot(...p)));
    const profile:FinProfile={kind:type,side,phase:type==='pectoral'?side*.85:type==='dorsal'?.6:type==='belly'?1.1:0,softness:kind===8?1.2:kind===7?.7:1};
    registerFlex(g,profile,reach);
    for(let i=0;i<=5;i++){const p=edge.getPoint(i/5);const ray=curve(parent,[[0,0,0],[p.x*.5+.025,p.y*.52,p.z*.5],[p.x,p.y,p.z]],.007,rayMat);registerFlex(ray.geometry,profile,reach);}
  }
  tail.position.set(0,.02,-1.12);root.add(tail);
  ellipsoid(tail,bodyMat,[0,0,-.07],[.22,.25,.28]);
  if(kind!==10&&kind!==11)fin(tail,[[0,.67,-.61],[0,.73,-.91],[0,.37,-.88],[0,0,-.58],[0,-.36,-.87],[0,-.70,-.90],[0,-.62,-.60]]);
  const dorsal=new T.Group();dorsal.position.set(0,.49,-.28);root.add(dorsal);
  if(kind!==11)fin(dorsal,[[0,.12,.45],[0,.56,.12],[0,.67,-.26],[0,.38,-.57],[0,.08,-.76]],'dorsal');
  const fins:T.Group[]=[];
  for(const side of [-1,1]){const f=new T.Group();f.position.set(side*.60,-.12,.02);root.add(f);if(kind===11){const flipper=ellipsoid(f,bodyMat,[side*.23,-.03,-.15],[.40,.09,.55]);flexSolid(flipper,{kind:'flipper',side,phase:side*.9,softness:.85});f.rotation.y=side*.5;}else fin(f,[[side*.25,.08,-.04],[side*.48,-.10,-.18],[side*.42,-.33,-.44],[side*.20,-.37,-.52],[side*.03,-.13,-.40]],'pectoral',side);fins.push(f);}
  const bellyFin=new T.Group();bellyFin.position.set(0,-.55,-.25);root.add(bellyFin);if(kind!==11)fin(bellyFin,[[0,-.1,.1],[0,-.40,-.20],[0,-.28,-.52],[0,-.04,-.60]],'belly');

  const accent=material(colors.accent),leather=material(0x825037,{roughness:.65});
  function box(parent:T.Object3D,mat:T.Material,position:number[],size:number[]){const m=new T.Mesh(new T.BoxGeometry(...size as [number,number,number]),mat);m.position.set(...position as [number,number,number]);parent.add(m);return m;}
  function badgeShape(parent:T.Object3D,points:number[][],mat:T.Material,z=.03){const shape=new T.Shape();points.forEach((p,i)=>{if(i===0)shape.moveTo(p[0],p[1]);else shape.lineTo(p[0],p[1]);});shape.closePath();const mesh=new T.Mesh(new T.ExtrudeGeometry(shape,{depth:z,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:.014,bevelThickness:.014}),mat);parent.add(mesh);return mesh;}
  if(kind===1||kind===6){const tie=new T.Group();tie.position.set(0,-.45,.51);head.add(tie);const fabric=material(kind===6?0xa33b4c:0x9c703c,{roughness:.65});badgeShape(tie,[[0,.08],[.07,0],[.04,-.10],[.11,-.34],[0,-.43],[-.11,-.34],[-.04,-.10],[-.07,0]],fabric);}
  if(kind===2){
    curve(head,[[-.67,.02,.05],[-.69,.50,.02],[-.37,.76,0],[0,.82,0],[.37,.76,0],[.69,.50,.02],[.67,.02,.05]],.065,black);
    for(const side of [-1,1]){ellipsoid(head,black,[side*.68,.04,.06],[.13,.31,.28]);ellipsoid(head,leather,[side*.77,.04,.06],[.055,.245,.225]);const ring=new T.Mesh(new T.TorusGeometry(.18,.018,8,32),accent);ring.rotation.y=side*Math.PI/2;ring.position.set(side*.83,.04,.06);head.add(ring);curve(head,[[side*.85,.10,.13],[side*.85,.04,.19],[side*.85,-.02,.13]],.018,accent);}
    dorsal.scale.set(1,1.1,1);
  }
  if(kind===3){
    const book=new T.Group();book.position.set(0,-.43,.87);book.rotation.x=-.20;root.add(book);
    const cover=material(0x8b4c30),paper=material(0xffe9ba,{roughness:.9}),ink=material(0xc3a779);
    for(const side of [-1,1]){const page=new T.Group();page.position.x=side*.24;page.rotation.y=side*.30;book.add(page);box(page,cover,[0,0,0],[.49,.55,.085]);box(page,paper,[0,.015,.055],[.43,.48,.035]);for(let line=0;line<5;line++)curve(page,[[-.15,.15-line*.07,.079],[.02,.15-line*.07,.085],[.16,.15-line*.07,.079]],.005,ink);}
    curve(book,[[0,-.28,.02],[0,0,.04],[0,.28,.02]],.025,gold);
    for(const side of [-1,1])ellipsoid(root,bodyMat,[side*.48,-.37,.85],[.14,.11,.11]);
    dorsal.scale.y=.65;
  }
  if(kind===4){
    ellipsoid(head,cream,[0,-.12,.72],[.12,.12,.28]);ellipsoid(head,leather,[0,-.10,.99],[.055,.045,.27]);
    const bag=new T.Group();bag.position.set(-.43,-.54,.18);bag.rotation.z=-.12;root.add(bag);
    box(bag,leather,[0,0,0],[.56,.41,.21]);box(bag,material(0xb27a47),[0,.13,.12],[.56,.13,.04]);box(bag,gold,[.08,.025,.145],[.075,.09,.025]);curve(bag,[[-.12,.21,0],[-.11,.32,0],[.10,.32,0],[.12,.21,0]],.025,leather);
    curve(root,[[-.43,-.5,.08],[-.67,.1,-.1],[-.2,.62,-.1],[.36,.44,-.15]],.022,leather);
    tail.scale.y=1.1;
  }
  if(kind===5){
    curve(root,[[0,.58,.03],[0,.87,-.18],[0,1.03,-.48],[0,.99,-.66],[0,.82,-.64],[0,.84,-.48]],.065,finMat);
    dorsal.scale.set(1,.7,1.05);tail.scale.y=1.05;
  }
  if(kind===6){dorsal.scale.set(1,.85,.85);tail.scale.set(1,.8,.8);}
  if(kind===7){
    dorsal.scale.set(1,.4,.45);tail.scale.set(1,.52,.58);
    fins.forEach(f=>f.scale.setScalar(.65));
    const spikeGeometry=new T.ConeGeometry(.065,.18,7),spikeMat=material(mixHex(colors.body,'#fff6df',.35));
    for(let row=0;row<5;row++)for(let col=0;col<12;col++){
      const latitude=-.85+row*.37,longitude=col*Math.PI/6+(row%2)*.22;
      const n=new T.Vector3(Math.cos(latitude)*Math.cos(longitude),Math.sin(latitude),Math.cos(latitude)*Math.sin(longitude));
      if(n.z>.55)continue;
      const spike=new T.Mesh(spikeGeometry,spikeMat);spike.position.set(n.x*.93,n.y*.91,n.z*.97-.24);spike.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),n);root.add(spike);
    }
  }
  if(kind===8){tail.scale.set(1,1.12,1.16);dorsal.scale.set(1,1.12,1.25);fins.forEach(f=>f.scale.set(1.15,1,1.25));}
  if(kind===9){
    const starMat=material(colors.accent,{emissive:colors.accent,emissiveIntensity:.18,metalness:.3});
    for(const side of [-1,1]){const starGroup=new T.Group();starGroup.position.set(side*.585,.03,-.30);starGroup.rotation.y=side*Math.PI/2;root.add(starGroup);badgeShape(starGroup,Array.from({length:10},(_,i)=>{const a=i*Math.PI/5+Math.PI/2,r=i%2?.11:.26;return [Math.cos(a)*r,Math.sin(a)*r];}),starMat,.02);}
    tail.scale.set(1,1.05,1.1);
  }
  if(kind===10){
    const petal=material(colors.fin,{roughness:.46,iridescence:.20,transparent:true,opacity:.95,depthWrite:false});
    for(const a of [-1,-.5,0,.5,1]){const leaf=ellipsoid(tail,petal,[0,Math.sin(a)*.46,-Math.cos(a)*.50],[.075,.29,.74]);leaf.rotation.x=a;flexSolid(leaf,{kind:'petal',side:0,phase:a*.4,softness:1.2});}
    dorsal.scale.set(1,.7,.8);fins.forEach(f=>f.scale.set(1.2,1.1,1));
  }
  if(kind===11){
    tail.visible=false;dorsal.visible=false;bellyFin.visible=false;
    const shellCanvas=document.createElement('canvas');shellCanvas.width=512;shellCanvas.height=256;const sc=shellCanvas.getContext('2d')!;
    sc.fillStyle=colors.fin;sc.fillRect(0,0,512,256);sc.lineWidth=5;sc.strokeStyle=mixHex(colors.fin,'#422e27',.5);
    for(let row=-1;row<7;row++)for(let col=-1;col<11;col++){const x=col*53+(row%2)*26,y=row*45;sc.beginPath();for(let i=0;i<6;i++){const a=Math.PI/3*i+Math.PI/6;sc.lineTo(x+Math.cos(a)*30,y+Math.sin(a)*30);}sc.closePath();sc.fillStyle=mixHex(colors.fin,colors.body,(row+col+30)%3*.09);sc.fill();sc.stroke();}
    const shellTexture=new T.CanvasTexture(shellCanvas);shellTexture.colorSpace=T.SRGBColorSpace;
    const shellMaterial=material(0xffffff,{map:shellTexture,roughness:.5,clearcoat:.3});
    ellipsoid(root,cream,[0,-.18,-.3],[.79,.20,1]);ellipsoid(root,shellMaterial,[0,.24,-.35],[.85,.57,1.01]);
    const edge=new T.Mesh(new T.TorusGeometry(.82,.045,8,48),material(mixHex(colors.fin,'#ffd890',.35)));edge.rotation.x=Math.PI/2;edge.scale.y=1.22;edge.position.set(0,.01,-.35);root.add(edge);
    for(const side of [-1,1]){const rear=new T.Group();rear.position.set(side*.56,-.19,-.92);rear.rotation.y=-side*.6;root.add(rear);const flipper=ellipsoid(rear,bodyMat,[side*.15,0,-.10],[.32,.1,.46]);flexSolid(flipper,{kind:'flipper',side,phase:side*.9+1.6,softness:.7});fins.push(rear);}
  }

  let yaw=1.12,headYaw=1.12,time=kind*.73,initial=true,finEffort=0,finSpeed=0,finTurn=0;
  function update(pose:BaiPose,delta:number,animate=true){
    const dt=Math.min(.05,Math.max(0,delta));
    if(initial){yaw=headYaw=pose.yaw;initial=false;}
    if(animate){time+=dt;headYaw=followAngle(headYaw,pose.yaw,dt,13);yaw=followAngle(yaw,pose.yaw,dt,7);}else yaw=headYaw=pose.yaw;
    const natural=pose.effort!==undefined;
    const effort=pose.effort??(pose.moving?.65:.08),speed=pose.speedRatio??(pose.moving?.7:0);
    const response=animate?1-Math.exp(-dt*5):0;
    finEffort+=(effort-finEffort)*response;finSpeed+=(speed-finSpeed)*response;
    finTurn+=((pose.turnRate??0)-finTurn)*response;
    const bend=Math.max(-.22,Math.min(.22,(pose.turnRate??0)*.10+angleDifference(headYaw,yaw)*.35));
    root.rotation.y=yaw;head.rotation.y=Math.max(-.12,Math.min(.12,angleDifference(headYaw,yaw)*.6));
    const stroke=pose.stroke??time*(kind===7?3.6:5.2);
    // Tail thrust and translational acceleration now share the simulation's stroke.
    // Coasting folds the tail motion down; pectoral fins continue stabilizing the fish.
    tail.rotation.y=Math.sin(stroke)*(.012+finEffort*.065)-bend*.45;
    fins.forEach((f,i)=>{
      const side=i%2===0?-1:1;
      const rowing=Math.sin(stroke*.43+time*.35+side*.85+(i>1?1.6:0));
      f.rotation.z=rowing*(kind===11?.10:.025)*(.4+finEffort*.7);
      f.rotation.y=(kind===11?side*(i>1?-.6:.5):0)+rowing*(.015+finEffort*.025)+side*bend*.25;
    });
    dorsal.rotation.x=Math.sin(stroke-.7)*(.008+effort*.018);
    root.rotation.z=Math.sin(stroke)*.012*effort-(pose.turnRate??0)*.025;
    root.position.y=Math.sin(time*1.6)*(.008+Math.max(0,1-speed)*.008);
    root.position.x=natural?0:Math.sin(yaw)*.38;root.position.z=natural?0:Math.cos(yaw)*.38;
    const flexState={time,stroke,effort:finEffort,speed:finSpeed,turn:finTurn};
    for(const f of flexible){
      const positions=f.geometry.getAttribute('position') as T.BufferAttribute;
      flexFin(f.rest,f.weights,positions.array as Float32Array,f.profile,flexState);
      positions.needsUpdate=true;f.geometry.computeVertexNormals();
    }
    return yaw;
  }
  function dispose(){const geometries=new Set<T.BufferGeometry>(),materials=new Set<T.Material>(),textures=new Set<T.Texture>();root.traverse(o=>{if(o instanceof T.Mesh){geometries.add(o.geometry);(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>{materials.add(m);const map=(m as T.MeshStandardMaterial).map;if(map)textures.add(map);});}});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());}
  return {root,mouth,update,dispose};
}
