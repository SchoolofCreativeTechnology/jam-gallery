// Procedural low-poly objects: a stable silhouette for each item, in every encounter.
import * as THREE from 'three';
const mat=(color,extra={})=>new THREE.MeshStandardMaterial({color,roughness:.68,flatShading:true,...extra});
export function createObject(item){
 const g=new THREE.Group(),base=mat(item.color||'#c49556'),dark=mat('#252e29'),brass=mat('#ae874b',{metalness:.55}),cream=mat('#e7dfbd');
 const add=(geometry,material,x=0,y=0,z=0)=>{const m=new THREE.Mesh(geometry,material);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;g.add(m);return m;};
 const box=(w,h,d,m,x,y,z)=>add(new THREE.BoxGeometry(w,h,d),m,x,y,z);
 const ball=(r,m,x,y,z)=>add(new THREE.SphereGeometry(r,12,8),m,x,y,z);
 const cylinder=(r,h,m,x,y,z)=>add(new THREE.CylinderGeometry(r,r,h,16),m,x,y,z);
 switch(item.form){
 case 'duck':
   ball(.22,base,0,.20,0).scale.set(1.25,.9,1);ball(.15,base,0,.4,.08);box(.18,.055,.18,brass,0,.36,.22);ball(.025,dark,-.1,.44,.19);ball(.025,dark,.1,.44,.19);ball(.1,base,.20,.22,0).scale.set(.4,1,1.4);break;
 case 'clock':{
   const body=cylinder(.26,.16,base,0,.31,0);body.rotation.x=Math.PI/2;
   const face=cylinder(.23,.015,cream,0,.31,.09);face.rotation.x=Math.PI/2;
   for(let i=0;i<12;i++){const a=i*Math.PI/6;const tick=box(.012,.04,.01,brass,Math.sin(a)*.195,.31+Math.cos(a)*.195,.105);tick.rotation.z=-a;}
   box(.018,.16,.02,dark,0,.38,.12).rotation.z=.3;box(.13,.018,.02,dark,-.055,.31,.125);ball(.035,brass,0,.31,.13);
   for(const x of [-.17,.17]){ball(.1,brass,x,.57,0).scale.y=.5;box(.055,.10,.06,brass,x,.055,0);}break;}
 case 'heart':
   ball(.17,base,-.11,.32,0);ball(.17,base,.11,.32,0);const tip=add(new THREE.ConeGeometry(.25,.32,8),base,0,.13,0);tip.rotation.z=Math.PI;
   cylinder(.035,.15,brass,-.09,.52,0);cylinder(.05,.1,brass,.09,.48,0);ball(.075,brass,0,.27,.19);break;
 case 'camera':
   box(.55,.32,.22,base,0,.22,0);box(.25,.12,.19,dark,-.1,.43,0);const lens=cylinder(.14,.16,dark,.08,.25,.17);lens.rotation.x=Math.PI/2;const glass=cylinder(.11,.02,mat('#527c79',{metalness:.7,roughness:.2}),.08,.25,.26);glass.rotation.x=Math.PI/2;box(.11,.07,.025,cream,-.19,.3,.13);box(.3,.025,.12,cream,0,.06,.12);break;
 case 'snake':{
   const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(-.23,.08,0),new THREE.Vector3(0,.06,.18),new THREE.Vector3(.23,.12,0),new THREE.Vector3(0,.24,-.12),new THREE.Vector3(-.1,.44,0)]);
   add(new THREE.TubeGeometry(curve,24,.06,6,false),base);ball(.09,base,-.09,.46,.03);ball(.014,brass,-.13,.48,.1);ball(.014,brass,-.04,.48,.1);
   for(const side of [-1,1])for(let i=0;i<4;i++){const feather=box(.055,.28-i*.035,.025,cream,side*(.13+i*.05),.32+i*.015,0);feather.rotation.z=-side*(.5+i*.2);}break;}
 default:
   box(.62,.4,.26,base,0,.25,0);box(.3,.27,.018,dark,-.09,.25,.14);for(let i=0;i<7;i++)box(.26,.012,.02,brass,-.09,.14+i*.032,.155);box(.13,.08,.025,cream,.2,.32,.15);for(const y of [.14,.22]){const knob=cylinder(.035,.035,brass,.2,y,.17);knob.rotation.x=Math.PI/2;}box(.4,.07,.06,dark,0,.49,0);
 }
 return g;
}
export function signTexture(text,{color='#dfd5b4',background='#263e32',size=512}={}){
 const canvas=document.createElement('canvas');canvas.width=size;canvas.height=size/2;const c=canvas.getContext('2d');c.fillStyle=background;c.fillRect(0,0,size,size/2);c.strokeStyle=color;c.lineWidth=3;c.strokeRect(12,12,size-24,size/2-24);c.fillStyle=color;c.font=`bold ${size/9}px Georgia`;c.textAlign='center';c.textBaseline='middle';const lines=text.split('\n');lines.forEach((s,i)=>c.fillText(s,size/2,size/4+(i-(lines.length-1)/2)*size/8,size-44));return new THREE.CanvasTexture(canvas);
}
export function floorTexture(){
 const c=document.createElement('canvas');c.width=c.height=512;const x=c.getContext('2d');x.fillStyle='#344537';x.fillRect(0,0,512,512);
 for(let row=0;row<4;row++)for(let col=0;col<4;col++){x.fillStyle=(row+col)%2?'#88846b':'#baad8e';x.fillRect(col*128+3,row*128+3,122,122);x.fillStyle='#9b6452';x.beginPath();x.moveTo(col*128+64,row*128+47);x.lineTo(col*128+81,row*128+64);x.lineTo(col*128+64,row*128+81);x.lineTo(col*128+47,row*128+64);x.fill();}
 // Deterministic wear, so every visit is the same place.
 for(let i=0;i<600;i++){x.fillStyle=`rgba(37,44,30,${.02+(i%5)*.009})`;x.fillRect((i*71)%512,(i*137)%512,2+i%30,1+i%5);}
 const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(3,4);t.colorSpace=THREE.SRGBColorSpace;return t;
}
