import * as T from 'three';
import {RoomEnvironment} from 'three/examples/jsm/environments/RoomEnvironment.js';
import {createFishRig} from './fish-rig';
import type {FishLook} from './fish-3d-appearance';
import type {BaiPose} from './bai-motion';
import type {MouthAnchor} from './mouth-bubbles';
export type SchoolPose=BaiPose&{x:number;y:number;width:number;height:number;pitch:number;held:boolean};
export type SchoolFish=FishLook&{id:string};
function lighting(canvas:HTMLCanvasElement,school=false){
  const renderer=new T.WebGLRenderer({canvas,alpha:true,antialias:true,powerPreference:'low-power'});
  renderer.setClearColor(0x000000,0);renderer.setPixelRatio(Math.min(devicePixelRatio||1,school?1.25:2));
  renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.02;
  const scene=new T.Scene(),camera=new T.PerspectiveCamera(31,1.5,.1,40);camera.position.set(0,.22,5.6);camera.lookAt(0,0,-.12);
  const pmrem=new T.PMREMGenerator(renderer),room=new RoomEnvironment(),env=pmrem.fromScene(room,.04);scene.environment=env.texture;scene.environmentIntensity=.30;room.dispose();pmrem.dispose();
  // Lift diffuse light and shaded faces without restoring the washed-out clearcoat.
  scene.add(new T.HemisphereLight(0xe5e5ff,0x84738c,1.10));
  for(const [color,intensity,x,y,z] of [[0xffdfbc,2.2,-3,5,5],[0x9dbdff,1.6,3,2,-4],[0xffdfcc,.50,2,-1,3]]){const light=new T.DirectionalLight(color,intensity);light.position.set(x,y,z);scene.add(light);}
  const dispose=()=>{env.dispose();renderer.dispose();renderer.forceContextLoss();};
  return {renderer,scene,camera,dispose};
}
export function createFishPreview(canvas:HTMLCanvasElement,look:FishLook={sprite:0}){
  const context=lighting(canvas),{renderer,scene,camera}=context,rig=createFishRig(look);scene.add(rig.root);
  let frames=0,disposed=false;
  function resize(){const w=canvas.clientWidth||180,h=canvas.clientHeight||120;renderer.setSize(w,h,false);camera.aspect=w/h;camera.position.z=5.6*Math.max(1,1.3/camera.aspect);camera.lookAt(0,0,-.12);camera.updateProjectionMatrix();renderer.render(scene,camera);}
  const observer=new ResizeObserver(resize);observer.observe(canvas);resize();
  return {draw(pose:BaiPose,dt:number,animate=true){if(disposed)return;const yaw=rig.update(pose,dt,animate);renderer.render(scene,camera);canvas.dataset.yaw=yaw.toFixed(4);canvas.dataset.frame=String(++frames);canvas.dataset.render='webgl';},dispose(){if(disposed)return;disposed=true;observer.disconnect();rig.dispose();context.dispose();}};
}
export function createSchoolRenderer(canvas:HTMLCanvasElement){
  const context=lighting(canvas,true),{renderer,scene,camera}=context;
  const width=1672,height=941;renderer.setSize(width,height,false);renderer.autoClear=false;
  const rigs=new Map<string,{key:string;rig:ReturnType<typeof createFishRig>}>();let disposed=false,frames=0;
  const mouthPoint=new T.Vector3(),forwardPoint=new T.Vector3();
  function sync(fish:SchoolFish[]){
    const ids=new Set(fish.map(f=>f.id));
    for(const [id,entry] of rigs)if(!ids.has(id)){scene.remove(entry.rig.root);entry.rig.dispose();rigs.delete(id);}
    for(const f of fish){const key=`${f.sprite}:${f.skin??'original'}`;const existing=rigs.get(f.id);if(existing?.key===key)continue;if(existing){scene.remove(existing.rig.root);existing.rig.dispose();}const rig=createFishRig(f);rig.root.visible=false;scene.add(rig.root);rigs.set(f.id,{key,rig});}
    canvas.dataset.fishCount=String(rigs.size);
  }
  function draw(poses:Map<string,SchoolPose>,dt:number,animate=true,mouths?:Map<string,MouthAnchor>){
    mouths?.clear();
    if(disposed)return;renderer.setScissorTest(false);renderer.clear(true,true,true);renderer.setScissorTest(true);
    const ordered=[...poses.entries()].sort((a,b)=>Number(a[1].held)-Number(b[1].held)||a[1].y-b[1].y);
    for(const [id,p] of ordered){const rig=rigs.get(id)?.rig;if(!rig)continue;
      const x=p.x-p.width/2,y=height-p.y-p.height/2,w=p.width,h=p.height;
      if(x+w<0||x>width||y+h<0||y>height)continue;
      renderer.setViewport(x,y,w,h);renderer.setScissor(Math.max(0,x),Math.max(0,y),Math.min(width,x+w)-Math.max(0,x),Math.min(height,y+h)-Math.max(0,y));renderer.clear(false,true,false);
      rig.update(p,dt,animate);rig.root.rotation.z-=p.pitch*Math.PI/180;rig.root.visible=true;renderer.render(scene,camera);rig.root.visible=false;
      if(mouths){
        mouthPoint.setFromMatrixPosition(rig.mouth.matrixWorld).project(camera);
        forwardPoint.set(0,0,.12).applyMatrix4(rig.mouth.matrixWorld).project(camera);
        const dx=(forwardPoint.x-mouthPoint.x)*w,dy=-(forwardPoint.y-mouthPoint.y)*h,length=Math.hypot(dx,dy)||1;
        mouths.set(id,{x:p.x+mouthPoint.x*w/2,y:p.y-mouthPoint.y*h/2,dx:dx/length,dy:dy/length,visible:Math.cos(rig.root.rotation.y)>.05});
      }
    }
    renderer.setScissorTest(false);canvas.dataset.frame=String(++frames);canvas.dataset.render='webgl';
  }
  function dispose(){if(disposed)return;disposed=true;rigs.forEach(({rig})=>rig.dispose());rigs.clear();context.dispose();}
  return {sync,draw,dispose};
}
