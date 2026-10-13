/* Benchmark Planner — plan, elevations, 3D and takeoff. Plain JS, no build step. */
"use strict";
/* ============================== basics ============================== */
const $ = s => document.querySelector(s);
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1]], add=(a,b)=>[a[0]+b[0],a[1]+b[1]], mul=(a,k)=>[a[0]*k,a[1]*k];
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1], cross=(a,b)=>a[0]*b[1]-a[1]*b[0], vlen=a=>Math.hypot(a[0],a[1]);
const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const norm=a=>{const l=vlen(a)||1;return [a[0]/l,a[1]/l]}; const perp=a=>[-a[1],a[0]];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
let uid=1; const nid=p=>p+(uid++);
function segClosest(p,a,b){const ab=sub(b,a),L2=dot(ab,ab)||1;const t=clamp(dot(sub(p,a),ab)/L2,0,1);return {t,q:add(a,mul(ab,t))};}
function pointInPoly(p,poly){let c=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];
  if(((a[1]>p[1])!==(b[1]>p[1]))&&(p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0]))c=!c;}return c;}
function polyArea(poly){let s=0;for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length];s+=a[0]*b[1]-b[0]*a[1];}return s/2;}
function polyCentroid(poly){let A=0,cx=0,cy=0;for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length];const f=a[0]*b[1]-b[0]*a[1];A+=f;cx+=(a[0]+b[0])*f;cy+=(a[1]+b[1])*f;}
  if(Math.abs(A)<1e-9)return poly[0].slice();return [cx/(3*A),cy/(3*A)];}
function lineX(p1,d1,p2,d2){const c=cross(d1,d2);if(Math.abs(c)<1e-9)return null;const t=cross(sub(p2,p1),d2)/c;return add(p1,mul(d1,t));}

/* ============================== catalog ============================== */
const CAT={
  base:{label:'Base cabinet',w:600,d:600,h:870,z:0,group:'Kitchen'},
  sinkbase:{label:'Sink base',w:800,d:600,h:870,z:0,group:'Kitchen'},
  dishwasher:{label:'Dishwasher',w:600,d:600,h:870,z:0,group:'Kitchen'},
  range:{label:'Range',w:600,d:600,h:900,z:0,group:'Kitchen'},
  fridge:{label:'Refrigerator',w:700,d:700,h:1800,z:0,group:'Kitchen'},
  tall:{label:'Tall cabinet',w:600,d:600,h:2100,z:0,group:'Kitchen'},
  wallcab:{label:'Wall cabinet',w:600,d:350,h:720,z:1450,group:'Kitchen'},
  toilet:{label:'Toilet',w:380,d:680,h:780,z:0,group:'Bath'},
  vanity:{label:'Vanity',w:800,d:480,h:850,z:0,group:'Bath'},
  tub:{label:'Bathtub',w:1700,d:750,h:560,z:0,group:'Bath'},
  shower:{label:'Shower tray',w:900,d:900,h:60,z:0,group:'Bath'},
};
const ROOMTYPES={kitchen:'Kitchen',bath:'Bathroom',living:'Living',bedroom:'Bedroom',hall:'Hall',other:'Other'};
const COUNTER=new Set(['base','sinkbase','dishwasher']);

/* ============================== outdoor: yard walls, ground surfaces, garden items ============================== */
// Yard walls are walls with a kind. They are drawn and built differently, and they never form rooms.
const OUTW={fence:{label:'Fence',t:50,h:1800},gwall:{label:'Garden wall',t:200,h:1200},hedge:{label:'Hedge',t:600,h:1500},railing:{label:'Railing',t:50,h:1000}};
const WALLKINDS={wall:'Wall (building)',fence:'Fence',gwall:'Garden wall',hedge:'Hedge',railing:'Railing'};
const curWallSpec=()=>tool==='wall'&&OUTW[placeType]?OUTW[placeType]:defaults;
function drawYardWall(w){const ext=wallExt(w);const pieces=wallPieces(w,ext);const d=wallDir(w),n=perp(d);const sel_=sel&&sel.kind==='wall'&&sel.id===w.id;
  pieces.forEach(([s0,s1])=>{const q=pieceQuad(w,s0,s1).map(toS);const path=()=>{ctx.beginPath();q.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.closePath();};
    ctx.save();
    if(w.kind==='hedge'){path();ctx.fillStyle='rgba(76,128,58,.78)';ctx.fill();ctx.clip();ctx.fillStyle='rgba(52,98,40,.85)';const step=Math.max(w.t*0.6,250);
      for(let s=s0;s<=s1;s+=step)for(const k of [-0.25,0.25]){const c=toS(add(add(w.a,mul(d,s+(k>0?step/2:0))),mul(n,k*w.t)));ctx.beginPath();ctx.arc(c[0],c[1],Math.max(1.5,w.t*0.32*view.s),0,Math.PI*2);ctx.fill();}}
    else if(w.kind==='gwall'){path();ctx.fillStyle=C.dim;ctx.globalAlpha=0.55;ctx.fill();ctx.globalAlpha=1;ctx.clip();ctx.strokeStyle=C.paper;ctx.lineWidth=1;const step=300;
      for(let s=s0;s<=s1;s+=step){const a=toS(add(add(w.a,mul(d,s)),mul(n,w.t/2))),b=toS(add(add(w.a,mul(d,s)),mul(n,-w.t/2)));ctx.beginPath();ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);ctx.stroke();}
      path();ctx.strokeStyle=C.dim;ctx.lineWidth=1.2;ctx.stroke();}
    else{ // fence and railing: a line with posts
      const col=w.kind==='fence'?'#8a5a32':C.ink;const a=toS(add(w.a,mul(d,s0))),b=toS(add(w.a,mul(d,s1)));ctx.strokeStyle=col;ctx.lineWidth=Math.max(1.5,w.t*view.s*0.6);
      ctx.beginPath();ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);ctx.stroke();if(w.kind==='railing'){ctx.lineWidth=1;ctx.setLineDash([2,3]);ctx.beginPath();ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);ctx.stroke();ctx.setLineDash([]);}
      const step=w.kind==='fence'?2400:1500,ps=Math.max(4,(w.kind==='fence'?100:60)*view.s);ctx.fillStyle=col;
      for(let s=s0;s<=s1+1;s+=step){const c=toS(add(w.a,mul(d,Math.min(s,s1))));ctx.fillRect(c[0]-ps/2,c[1]-ps/2,ps,ps);}const e=toS(add(w.a,mul(d,s1)));ctx.fillRect(e[0]-ps/2,e[1]-ps/2,ps,ps);}
    ctx.restore();});}
// ground surfaces are measured areas with a material
const SURF={lawn:{label:'Lawn',col:'#7fae57',line:'#4f7f33'},paving:{label:'Patio paving',col:'#d3cdc2',line:'#8f877b'},deck:{label:'Deck',col:'#c19466',line:'#87603b'},
  gravel:{label:'Gravel',col:'#d9cfbd',line:'#9a8e78'},water:{label:'Pool / water',col:'#78bddb',line:'#3a87ad'},bed:{label:'Planting bed',col:'#9a7556',line:'#6b4f38'}};
const surfPat={};
function surfPattern(k){if(surfPat[k])return surfPat[k];const S=SURF[k],c=document.createElement('canvas');const n=k==='paving'?24:k==='deck'?18:16;c.width=c.height=n;const g=c.getContext('2d');
  g.fillStyle=S.col;g.fillRect(0,0,n,n);g.strokeStyle=S.line;g.fillStyle=S.line;g.lineWidth=1;
  if(k==='lawn'){g.globalAlpha=.6;[[3,12],[10,5],[12,14]].forEach(([x,y])=>{g.beginPath();g.moveTo(x,y);g.lineTo(x-1,y-3);g.moveTo(x,y);g.lineTo(x+1,y-3);g.stroke();});}
  if(k==='paving'){g.globalAlpha=.7;g.strokeRect(0.5,0.5,n,n);}
  if(k==='deck'){g.globalAlpha=.6;g.beginPath();g.moveTo(0,0.5);g.lineTo(n,0.5);g.moveTo(0,9.5);g.lineTo(n,9.5);g.moveTo(6.5,0);g.lineTo(6.5,9);g.moveTo(14.5,10);g.lineTo(14.5,n);g.stroke();}
  if(k==='gravel'){g.globalAlpha=.7;[[2,3],[9,2],[13,7],[5,9],[11,13],[3,14],[7,6]].forEach(([x,y])=>{g.beginPath();g.arc(x,y,1,0,Math.PI*2);g.fill();});}
  if(k==='water'){g.globalAlpha=.6;g.beginPath();g.moveTo(1,5);g.quadraticCurveTo(4,3,7,5);g.moveTo(9,12);g.quadraticCurveTo(12,10,15,12);g.stroke();}
  if(k==='bed'){[[4,4,'#e8a0b8'],[12,9,'#f2d36b'],[6,13,'#f7f2e6']].forEach(([x,y,cl])=>{g.fillStyle=cl;g.beginPath();g.arc(x,y,1.8,0,Math.PI*2);g.fill();});}
  return surfPat[k]=ctx.createPattern(c,'repeat');}
const areaShown=A=>(sel&&sel.kind==='area'&&sel.id===A.id)||(!A.hidden&&(MEAS.areas||A.surf||isZone(A)));
function drawSurfaces(){(M.areas||[]).forEach(A=>{if(!areaShown(A))return;if(isZone(A)&&A.pts.length>=3){const P=areaOutline(A).map(toS);ctx.save();ctx.beginPath();P.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.closePath();ctx.fillStyle=C['room-'+A.type]||C['room-other'];ctx.fill();ctx.restore();return;}
  if(!A.surf||!SURF[A.surf]||A.pts.length<3)return;const P=areaOutline(A).map(toS);ctx.save();ctx.beginPath();P.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.closePath();
  ctx.fillStyle=surfPattern(A.surf);ctx.globalAlpha=0.85;ctx.fill();ctx.globalAlpha=1;ctx.strokeStyle=SURF[A.surf].line;ctx.lineWidth=1.2;ctx.stroke();ctx.restore();});}
// garden items
const OUTDOOR_CAT={
  tree:{label:'Tree',w:4000,d:4000,h:6000,z:0,group:'Outdoor',free:true,round:true},
  palm:{label:'Palm tree',w:3000,d:3000,h:5500,z:0,group:'Outdoor',free:true,round:true},
  shrub:{label:'Shrub',w:1000,d:1000,h:1000,z:0,group:'Outdoor',free:true,round:true},
  planter:{label:'Planter',w:600,d:600,h:700,z:0,group:'Outdoor',free:true},
  fountain:{label:'Fountain',w:1600,d:1600,h:1300,z:0,group:'Outdoor',free:true,round:true},
  firepit:{label:'Fire pit',w:1100,d:1100,h:400,z:0,group:'Outdoor',free:true,round:true},
  pergola:{label:'Pergola / shade',w:3600,d:3000,h:2600,z:0,group:'Outdoor',free:true},
  umbrella:{label:'Umbrella',w:2700,d:2700,h:2400,z:0,group:'Outdoor',free:true,round:true},
  bbq:{label:'BBQ grill',w:1400,d:650,h:1100,z:0,group:'Outdoor'},
  dining:{label:'Dining set',w:2600,d:2000,h:750,z:0,group:'Outdoor',free:true},
  lounger:{label:'Sun lounger',w:700,d:2000,h:400,z:0,group:'Outdoor',free:true},
  bench:{label:'Garden bench',w:1500,d:550,h:850,z:0,group:'Outdoor'},
  hottub:{label:'Hot tub',w:2100,d:2100,h:900,z:0,group:'Outdoor',free:true},
  swing:{label:'Swing set',w:3000,d:1800,h:2200,z:0,group:'Outdoor',free:true},
  light:{label:'Garden light',w:300,d:300,h:900,z:0,group:'Outdoor',free:true,round:true}};
const OUTDOOR_ICONS={
  fence:'<path d="M5 20V8l1.5-2.5L8 8v12M11 20V8l1.5-2.5L14 8v12M17 20V8l1.5-2.5L20 8v12M3 11h18M3 16h18"/>',
  gwall:'<rect x="2.5" y="7.5" width="19" height="10" rx=".5"/><path d="M2.5 12.5h19M8 7.5v5M14.5 7.5v5M5 12.5v5M11 12.5v5M17.5 12.5v5"/>',
  hedge:'<path d="M3 17c-1-3 1-5 3-4.5C6 9.5 9 9 10.5 11c1-2.5 4.5-2.5 5 0 2-1.5 5 0 4.5 3 1.5.5 1.5 3-.5 3z"/><path d="M8 17v3M16 17v3"/>',
  railing:'<path d="M3 7.5h18M3 19h18M6 7.5V19M10 7.5V19M14 7.5V19M18 7.5V19"/>',
  lawn:'<path d="M3 19h18M5 19c0-3 1-5 2-6M7 19c0-2-.5-4-1.5-5M11 19c0-3 1-6 2.5-7.5M13 19c0-3-1-5-2.5-6.5M17 19c0-2.5 1-4.5 2-5.5M19 19c0-2-1-3.5-2-4.5"/>',
  paving:'<rect x="3.5" y="3.5" width="17" height="17" rx=".5"/><path d="M3.5 9.5h17M3.5 15h17M9 3.5v6M15 3.5v6M6.5 9.5V15M12 9.5V15M17.5 9.5V15M9 15v5.5M15 15v5.5"/>',
  deck:'<rect x="3.5" y="4.5" width="17" height="15" rx=".5"/><path d="M3.5 8.5h17M3.5 12h17M3.5 15.5h17M10 4.5v4M15 8.5v3.5M8 12v3.5M14 15.5v4"/>',
  gravel:'<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><circle cx="8" cy="9" r="1"/><circle cx="13" cy="8" r="1"/><circle cx="16.5" cy="12" r="1"/><circle cx="10" cy="13.5" r="1"/><circle cx="7" cy="16" r="1"/><circle cx="14" cy="16" r="1"/>',
  water:'<path d="M3 8c2-1.5 4-1.5 6 0s4 1.5 6 0 4-1.5 6 0M3 13c2-1.5 4-1.5 6 0s4 1.5 6 0 4-1.5 6 0M3 18c2-1.5 4-1.5 6 0s4 1.5 6 0 4-1.5 6 0"/>',
  bed:'<path d="M3 19h18"/><circle cx="8" cy="10" r="2"/><circle cx="16" cy="9" r="2"/><path d="M8 12v7M16 11v8M8 15.5c-2 0-3-1-3.5-2.5M16 14.5c2 0 3-1 3.5-2.5"/>',
  tree:'<circle cx="12" cy="11" r="8"/><path d="M8 8.5a4 4 0 0 1 4-2.5M12 11v.01"/><circle cx="12" cy="11" r="1.4"/>',
  palm:'<circle cx="12" cy="12" r="1.5"/><path d="M12 10.5C11 6 8 4 4.5 4.5M13.5 12c4.5-1 6.5-4 6-7.5M12 13.5c1 4.5 4 6.5 7.5 6M10.5 12c-4.5 1-6.5 4-6 7.5"/>',
  shrub:'<path d="M6 16c-3-1-2.5-5.5.5-5.5C7 7 11 6 12.5 8.5 15 6.5 19 8.5 18 11.5c2.5 1 2 5-1 4.5"/><path d="M6 16h11"/>',
  planter:'<path d="M6.5 13.5h11l-1.5 7h-8z"/><path d="M12 13.5V9M12 9c-1-3-3.5-4-5.5-3.5.5 2.5 3 3.5 5.5 3.5zM12 9c1-3 3.5-4 5.5-3.5-.5 2.5-3 3.5-5.5 3.5z"/>',
  fountain:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/>',
  firepit:'<circle cx="12" cy="13" r="8"/><path d="M12 17c-2 0-3-1.5-3-3 0-2 2-3 2.2-5.5 2.3 1.5 3.8 3.4 3.8 5.5 0 1.5-1 3-3 3z"/>',
  pergola:'<rect x="3.5" y="4.5" width="17" height="15"/><path d="M3.5 8h17M3.5 11h17M3.5 14h17M3.5 17h17"/><rect x="2.5" y="3.5" width="2.5" height="2.5" fill="currentColor"/><rect x="19" y="3.5" width="2.5" height="2.5" fill="currentColor"/><rect x="2.5" y="18" width="2.5" height="2.5" fill="currentColor"/><rect x="19" y="18" width="2.5" height="2.5" fill="currentColor"/>',
  umbrella:'<path d="M12 3l6.4 2.6L21 12l-2.6 6.4L12 21l-6.4-2.6L3 12l2.6-6.4z"/><path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6 5.6 18.4" stroke-width="1"/>',
  bbq:'<rect x="3.5" y="7.5" width="17" height="9" rx="1"/><path d="M7 7.5v9M10.5 7.5v9M14 7.5v9M17.5 7.5v9" stroke-width="1"/><path d="M6 16.5 5 20M18 16.5l1 3.5"/>',
  dining:'<rect x="6.5" y="8" width="11" height="8" rx="1"/><rect x="8" y="3.5" width="3" height="2.5" rx=".5"/><rect x="13" y="3.5" width="3" height="2.5" rx=".5"/><rect x="8" y="18" width="3" height="2.5" rx=".5"/><rect x="13" y="18" width="3" height="2.5" rx=".5"/>',
  lounger:'<rect x="8" y="2.5" width="8" height="19" rx="2"/><path d="M8 8h8"/>',
  bench:'<rect x="3.5" y="9" width="17" height="6" rx="1"/><path d="M3.5 12h17"/>',
  hottub:'<rect x="3.5" y="3.5" width="17" height="17" rx="4"/><rect x="6.5" y="6.5" width="11" height="11" rx="2.5"/><circle cx="9" cy="9" r=".8"/><circle cx="15" cy="15" r=".8"/>',
  swing:'<path d="M3 20 6 4h12l3 16M6 4h12"/><path d="M10 4v9M14 4v9M9 13h2M13 13h2"/>',
  light:'<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/>'};
// plan symbols for garden items (drawn instead of the cabinet box)
function drawOutdoorItem(it,selected,isGhost){const c=toS([it.x,it.y]),s=view.s,w=it.w*s,dd=it.d*s,t=it.type,R=Math.min(w,dd)/2;
  ctx.save();ctx.translate(c[0],c[1]);ctx.rotate(it.r*Math.PI/180);ctx.globalAlpha=isGhost?.7:1;const line=selected?C.accent:'#3f5a33';ctx.strokeStyle=line;ctx.lineWidth=selected?2:1.1;
  const green='rgba(104,160,72,.55)',dark='rgba(60,110,45,.65)';
  if(t==='tree'){ctx.fillStyle=green;ctx.beginPath();const k=11;for(let i=0;i<=k;i++){const a=i/k*Math.PI*2,b=(i+.5)/k*Math.PI*2;const r1=R*0.92;if(!i)ctx.moveTo(r1,0);
      ctx.quadraticCurveTo(Math.cos(b-Math.PI/k)*R*1.1,Math.sin(b-Math.PI/k)*R*1.1,Math.cos(a+Math.PI*2/k)*r1,Math.sin(a+Math.PI*2/k)*r1);}ctx.closePath();ctx.fill();ctx.stroke();
    ctx.fillStyle='#7a5536';ctx.beginPath();ctx.arc(0,0,Math.max(2,R*0.08),0,Math.PI*2);ctx.fill();ctx.strokeStyle=dark;ctx.beginPath();for(let i=0;i<5;i++){const a=i/5*Math.PI*2;ctx.moveTo(0,0);ctx.lineTo(Math.cos(a)*R*0.6,Math.sin(a)*R*0.6);}ctx.stroke();}
  else if(t==='palm'){ctx.fillStyle=green;for(let i=0;i<8;i++){const a=i/8*Math.PI*2;ctx.save();ctx.rotate(a);ctx.beginPath();ctx.moveTo(0,0);ctx.quadraticCurveTo(R*0.5,-R*0.25,R,0);ctx.quadraticCurveTo(R*0.5,R*0.25,0,0);ctx.fill();ctx.stroke();ctx.restore();}
    ctx.fillStyle='#7a5536';ctx.beginPath();ctx.arc(0,0,Math.max(2,R*0.1),0,Math.PI*2);ctx.fill();}
  else if(t==='shrub'){ctx.fillStyle=dark;ctx.beginPath();for(let i=0;i<7;i++){const a=i/7*Math.PI*2;ctx.moveTo(Math.cos(a)*R*0.5+R*0.45,Math.sin(a)*R*0.5);ctx.arc(Math.cos(a)*R*0.5,Math.sin(a)*R*0.5,R*0.45,0,Math.PI*2);}ctx.fill();}
  else if(t==='planter'){ctx.fillStyle='rgba(168,128,92,.5)';ctx.fillRect(-w/2,-dd/2,w,dd);ctx.strokeRect(-w/2,-dd/2,w,dd);ctx.fillStyle=green;ctx.beginPath();ctx.arc(0,0,R*0.75,0,Math.PI*2);ctx.fill();}
  else if(t==='fountain'){ctx.fillStyle='rgba(150,150,145,.35)';ctx.beginPath();ctx.arc(0,0,R,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle='rgba(110,180,215,.65)';ctx.beginPath();ctx.arc(0,0,R*0.82,0,Math.PI*2);ctx.fill();
    ctx.beginPath();ctx.arc(0,0,R*0.38,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.arc(0,0,R*0.12,0,Math.PI*2);ctx.fillStyle='rgba(150,150,145,.9)';ctx.fill();ctx.stroke();}
  else if(t==='firepit'&&it.shape==='rect'){const k=Math.min(w,dd)*0.16;ctx.fillStyle='rgba(120,112,104,.55)';ctx.beginPath();ctx.rect(-w/2,-dd/2,w,dd);ctx.rect(w/2-k,-dd/2+k,-(w-2*k),dd-2*k);ctx.fill('evenodd');ctx.stroke();ctx.strokeRect(-w/2+k,-dd/2+k,w-2*k,dd-2*k);
    ctx.fillStyle='rgba(226,110,40,.75)';const fx=Math.min(w-2*k,dd-2*k)/2;ctx.beginPath();ctx.moveTo(0,fx*0.65);ctx.bezierCurveTo(-fx*0.65,fx*0.45,-fx*0.3,-fx*0.3,0,-fx*0.7);ctx.bezierCurveTo(fx*0.3,-fx*0.3,fx*0.65,fx*0.45,0,fx*0.65);ctx.fill();}
  else if(t==='firepit'){ctx.fillStyle='rgba(120,112,104,.55)';ctx.beginPath();ctx.arc(0,0,R,0,Math.PI*2);ctx.moveTo(R*0.68,0);ctx.arc(0,0,R*0.68,0,Math.PI*2,true);ctx.fill();ctx.stroke();
    ctx.fillStyle='rgba(226,110,40,.75)';ctx.beginPath();ctx.moveTo(0,R*0.45);ctx.bezierCurveTo(-R*0.45,R*0.3,-R*0.2,-R*0.2,0,-R*0.5);ctx.bezierCurveTo(R*0.2,-R*0.2,R*0.45,R*0.3,0,R*0.45);ctx.fill();}
  else if(t==='pergola'){ctx.strokeStyle=selected?C.accent:'#87603b';ctx.lineWidth=1;ctx.strokeRect(-w/2,-dd/2,w,dd);const n=Math.max(3,Math.round(it.d/400));ctx.beginPath();
    for(let i=1;i<n;i++){const y=-dd/2+dd*i/n;ctx.moveTo(-w/2-4,y);ctx.lineTo(w/2+4,y);}ctx.stroke();ctx.fillStyle='#87603b';const p=Math.max(3,150*s);[[-1,-1],[1,-1],[1,1],[-1,1]].forEach(([x,y])=>ctx.fillRect(x*w/2-p/2-x*p/2,y*dd/2-p/2-y*p/2,p,p));}
  else if(t==='umbrella'){ctx.fillStyle='rgba(235,190,90,.45)';ctx.beginPath();for(let i=0;i<8;i++){const a=i/8*Math.PI*2+Math.PI/8;i?ctx.lineTo(Math.cos(a)*R,Math.sin(a)*R):ctx.moveTo(Math.cos(a)*R,Math.sin(a)*R);}ctx.closePath();ctx.fill();ctx.stroke();
    ctx.beginPath();for(let i=0;i<8;i++){const a=i/8*Math.PI*2+Math.PI/8;ctx.moveTo(0,0);ctx.lineTo(Math.cos(a)*R,Math.sin(a)*R);}ctx.lineWidth=.8;ctx.stroke();}
  else if(t==='hottub'){ctx.fillStyle='rgba(160,130,100,.4)';roundRect(-w/2,-dd/2,w,dd,Math.min(w,dd)*0.18);ctx.fill();ctx.stroke();ctx.beginPath();ctx.fillStyle='rgba(110,180,215,.7)';roundRect(-w/2+w*0.12,-dd/2+dd*0.12,w*0.76,dd*0.76,Math.min(w,dd)*0.12);ctx.fill();ctx.stroke();}
  else if(t==='light'){ctx.fillStyle='rgba(245,200,80,.85)';ctx.beginPath();ctx.arc(0,0,Math.max(3,R*0.6),0,Math.PI*2);ctx.fill();ctx.stroke();ctx.beginPath();for(let i=0;i<8;i++){const a=i/8*Math.PI*2;ctx.moveTo(Math.cos(a)*R*0.8,Math.sin(a)*R*0.8);ctx.lineTo(Math.cos(a)*R*1.4,Math.sin(a)*R*1.4);}ctx.stroke();}
  else{ // furniture-like items: outline plus a few details
    ctx.fillStyle=C.fixture;ctx.strokeStyle=selected?C.accent:C['fixture-line'];if(t!=='dining'&&t!=='swing'){ctx.fillRect(-w/2,-dd/2,w,dd);ctx.strokeRect(-w/2,-dd/2,w,dd);}ctx.beginPath();
    if(t==='bbq'){for(let i=1;i<6;i++){const x=-w/2+w*i/6;ctx.moveTo(x,-dd/2+dd*0.15);ctx.lineTo(x,dd/2-dd*0.15);}}
    if(t==='dining'){ctx.fillStyle=C.fixture;const tw=w*0.7,td=dd*0.5;ctx.fillRect(-tw/2,-td/2,tw,td);ctx.strokeRect(-tw/2,-td/2,tw,td);const cw=Math.min(500*s,tw/3.4),cd=cw;
      for(const k of [-1,0,1])for(const sd of [-1,1]){const x=k*tw/3,y=sd*(td/2+cd*0.7);ctx.rect(x-cw/2,y-cd/2,cw,cd);}}
    if(t==='lounger'){ctx.moveTo(-w/2,-dd/2+dd*0.3);ctx.lineTo(w/2,-dd/2+dd*0.3);}
    if(t==='bench'){ctx.moveTo(-w/2,-dd/2+dd*0.3);ctx.lineTo(w/2,-dd/2+dd*0.3);}
    if(t==='swing'){ctx.moveTo(-w/2,0);ctx.lineTo(w/2,0);ctx.moveTo(-w/2,-dd/2);ctx.lineTo(-w/2,dd/2);ctx.moveTo(w/2,-dd/2);ctx.lineTo(w/2,dd/2);
      for(const k of [-0.22,0.22]){ctx.rect(k*w-w*0.08,-dd*0.08,w*0.16,dd*0.16);}}
    ctx.stroke();}
  ctx.restore();}
// 3D for garden items
function build3dOutdoor(it,g,box,S){const t=it.type,P=(lx,ly)=>add([it.x,it.y],rotV([lx,ly],it.r)),ry=-it.r*Math.PI/180;
  const leaf=mat(0x5f8f43,{roughness:0.95}),leafD=mat(0x46753a,{roughness:0.95}),bark=mat(0x6e4d33),wood=mat(0xa37650,{roughness:0.8}),stone=mat(0xb9b3a8),water=mat(0x6fb3d4,{roughness:0.15,metalness:0.1}),metal=mat(0x3b3f42,{roughness:0.4,metalness:0.4}),cloth=mat(0xe8c27a),cush=mat(0xece6da);
  const add3=(geo,m,x,y,z,sx=1,sy=1,sz=1)=>{const o=new THREE.Mesh(geo,m);o.position.set(x*S,y*S,z*S);o.scale.set(sx,sy,sz);o.castShadow=true;o.receiveShadow=true;g.add(o);return o;};
  const cyl=(r1,r2,h,m,x,y,z,seg=20)=>add3(new THREE.CylinderGeometry(r1*S,r2*S,h*S,seg),m,x,y,z);const R=Math.min(it.w,it.d)/2,H=it.h,c=[it.x,it.y];
  const part=(lx,ly,w,d,z0,h,m)=>{const q=P(lx,ly);return box(w,h,d,m,q[0],z0+h/2,q[1],ry);};
  if(t==='tree'){cyl(R*0.06,R*0.09,H*0.45,bark,c[0],H*0.225,c[1],10);const s=add3(new THREE.SphereGeometry(R*S,18,14),leaf,c[0],H*0.62,c[1]);s.scale.y=(H*0.42)/R;}
  else if(t==='palm'){cyl(120,170,H*0.85,bark,c[0],H*0.425,c[1],10);for(let i=0;i<8;i++){const a=i/8*Math.PI*2;const f=new THREE.Mesh(new THREE.BoxGeometry(R*S,0.04,R*0.22*S),leaf);
      f.position.set((c[0]+Math.cos(a)*R*0.45)*S,H*0.82*S,(c[1]+Math.sin(a)*R*0.45)*S);f.rotation.y=-a;f.rotation.z=-0.35;f.castShadow=true;g.add(f);}}
  else if(t==='shrub'){const s=add3(new THREE.SphereGeometry(R*S,14,10),leafD,c[0],H*0.5,c[1]);s.scale.y=H/(2*R);}
  else if(t==='planter'){part(0,0,it.w,it.d,0,H*0.55,mat(0xa8805c));const s=add3(new THREE.SphereGeometry(R*0.8*S,12,8),leaf,c[0],H*0.55+R*0.4,c[1]);s.scale.y=0.8;}
  else if(t==='fountain'){cyl(R,R,H*0.3,stone,c[0],H*0.15,c[1],32);cyl(R*0.84,R*0.84,10,water,c[0],H*0.3,c[1],32);cyl(R*0.12,R*0.16,H*0.75,stone,c[0],H*0.3+H*0.375,c[1],12);
    cyl(R*0.38,R*0.25,H*0.08,stone,c[0],H*0.75,c[1],24);cyl(R*0.33,R*0.33,8,water,c[0],H*0.79,c[1],24);}
  else if(t==='firepit'&&it.shape==='rect'){const k=Math.min(it.w,it.d)*0.16;part(0,0,it.w,it.d,0,H,stone);part(0,0,it.w-2*k,it.d-2*k,H,4,mat(0x2a2522));const fr=Math.min(it.w-2*k,it.d-2*k)/2;
    const fl=add3(new THREE.ConeGeometry(fr*0.45*S,fr*0.9*S,10),mat(0xf08a3c,{emissive:0xc04a10,emissiveIntensity:0.6}),c[0],H+fr*0.45,c[1]);fl.castShadow=false;}
  else if(t==='firepit'){cyl(R,R,H,stone,c[0],H/2,c[1],28);cyl(R*0.7,R*0.7,10,mat(0x2a2522),c[0],H+2,c[1],24);const fl=add3(new THREE.ConeGeometry(R*0.3*S,R*0.7*S,10),mat(0xf08a3c,{emissive:0xc04a10,emissiveIntensity:0.6}),c[0],H+R*0.35,c[1]);fl.castShadow=false;}
  else if(t==='pergola'){const p=150;[[-1,-1],[1,-1],[1,1],[-1,1]].forEach(([x,y])=>part(x*(it.w/2-p/2),y*(it.d/2-p/2),p,p,0,H,wood));
    [-1,1].forEach(y=>part(0,y*(it.d/2-p/2),it.w+200,120,H-200,200,wood));const n=Math.max(3,Math.round(it.d/400));for(let i=0;i<=n;i++)part(0,-it.d/2+it.d*i/n,it.w+300,60,H,120,wood);}
  else if(t==='umbrella'){cyl(25,25,H,metal,c[0],H/2,c[1],8);const cn=add3(new THREE.ConeGeometry(R*S,0.45,8),cloth,c[0],H-150,c[1]);cn.rotation.y=Math.PI/8;}
  else if(t==='bbq'){part(0,0,it.w*0.75,it.d,0,H*0.8,metal);part(it.w*0.45,0,it.w*0.1,it.d*0.8,H*0.78,20,metal);part(0,0,it.w*0.75,it.d*0.9,H*0.8,H*0.2,mat(0x1e2224));}
  else if(t==='dining'){const tw=it.w*0.7,td=it.d*0.5;part(0,0,tw,td,H-40,40,wood);[[-1,-1],[1,-1],[1,1],[-1,1]].forEach(([x,y])=>part(x*(tw/2-60),y*(td/2-60),60,60,0,H-40,wood));
    const cw=Math.min(500,tw/3.4);for(const k of [-1,0,1])for(const sd of [-1,1]){part(k*tw/3,sd*(td/2+cw*0.7),cw,cw,0,450,wood);part(k*tw/3,sd*(td/2+cw*1.15),cw,60,450,400,wood);}}
  else if(t==='lounger'){part(0,it.d*0.15,it.w,it.d*0.7,0,H*0.8,cush);const back=part(0,-it.d*0.35,it.w,it.d*0.3,H*0.8,H*0.9,cush);back.rotation.x=0;}
  else if(t==='bench'){part(0,0,it.w,it.d,420,50,wood);part(0,-it.d/2+40,it.w,60,470,380,wood);[-1,1].forEach(x=>part(x*(it.w/2-60),0,60,it.d,0,420,metal));}
  else if(t==='hottub'){part(0,0,it.w,it.d,0,H,mat(0x8a6a4f));part(0,0,it.w*0.78,it.d*0.78,H-6,10,water);}
  else if(t==='swing'){[-1,1].forEach(x=>[-1,1].forEach(y=>part(x*(it.w/2-40),y*(it.d/2-40),80,80,0,H,metal)));[-1,1].forEach(x=>part(x*(it.w/2-40),0,80,it.d,H-80,80,metal));part(0,0,it.w,80,H-80,80,metal);
    for(const k of [-0.22,0.22]){part(k*it.w,0,it.w*0.16,300,450,40,wood);part(k*it.w-it.w*0.07,0,15,15,490,H-570,metal);part(k*it.w+it.w*0.07,0,15,15,490,H-570,metal);}}
  else if(t==='light'){cyl(30,40,H,metal,c[0],H/2,c[1],8);add3(new THREE.SphereGeometry(110*S,12,10),mat(0xfff1c2,{emissive:0xffd77a,emissiveIntensity:0.8}),c[0],H,c[1]).castShadow=false;}
  else part(0,0,it.w,it.d,0,H,wood);}
function yardWallMat(kind){return kind==='hedge'?M3('hedge'):kind==='fence'?M3('fence'):kind==='railing'?mat(0x33383b,{roughness:0.4,metalness:0.4,transparent:true,opacity:0.55}):M3('stonewall');}
const SURF3D={lawn:'grass',paving:'paving',deck:'deck',gravel:'gravel',water:'water',bed:'soil'};
const ZONE_FLOOR={kitchen:0xd9c9a8,bath:0xc9d8de,living:0xb89a76,bedroom:0xb8a68e,hall:0xc7c3b8,other:0xcfcfc8};
function surfaces3d(g,S){(M.areas||[]).forEach(A=>{if(A.hidden)return;if(isZone(A)&&A.pts.length>=3){const P=areaOutline(A,true);const geo=new THREE.ShapeGeometry(new THREE.Shape(P.map(p=>new THREE.Vector2(p[0]*S,p[1]*S))));const m=new THREE.Mesh(geo,M3(floorOf(A.type,A.floor)));m.material.side=THREE.DoubleSide;m.rotation.x=Math.PI/2;m.position.y=0.003;m.receiveShadow=true;g.add(m);return;}
  if(!A.surf||!SURF[A.surf]||A.pts.length<3)return;const P=areaOutline(A,true);
  const shape=new THREE.Shape(P.map(p=>new THREE.Vector2(p[0]*S,p[1]*S)));const geo=new THREE.ShapeGeometry(shape);const col=new THREE.Color(SURF[A.surf].col);
  const m=new THREE.Mesh(geo,SURF3D[A.surf]?M3(SURF3D[A.surf]):mat(col,{side:THREE.DoubleSide,roughness:0.95}));m.material.side=THREE.DoubleSide;m.rotation.x=Math.PI/2;m.position.y=A.surf==='deck'?0.15:A.surf==='water'?0.0015:0.004;m.receiveShadow=true;g.add(m);
  if(A.surf==='deck'){const sh=new THREE.Shape(P.map(p=>new THREE.Vector2(p[0]*S,p[1]*S)));const ex=new THREE.Mesh(new THREE.ExtrudeGeometry(sh,{depth:0.15,bevelEnabled:false}),mat(SURF.deck.line));ex.rotation.x=Math.PI/2;ex.position.y=0.149;g.add(ex);}});}
// lengths of yard walls for the schedule
function yardWallRuns(){const r={};M.walls.forEach(w=>{if(w.kind&&OUTW[w.kind])r[w.kind]=(r[w.kind]||0)+wallLen(w);});return r;}

Object.assign(CAT,OUTDOOR_CAT);


/* ============================== model ============================== */
let M, rooms=[], units='mm', view={s:0.1,ox:0,oy:0};
function sampleModel(){
  uid=1;
  const W=(a,b,t,h=2700)=>({id:nid('w'),a,b,t,h});
  const ext=[[0,0],[7200,0],[7200,5400],[0,5400]];
  const walls=[];
  for(let i=0;i<4;i++)walls.push(W(ext[i].slice(),ext[(i+1)%4].slice(),250));
  const part=W([3000,0],[3000,5400],120), bathTop=W([0,3200],[3000,3200],120);
  walls.push(part,bathTop);
  const top=walls[0],right=walls[1],bottom=walls[2],left=walls[3];
  const O=(wall,s,w,kind,o={})=>Object.assign({id:nid('o'),wall:wall.id,s,w,kind,h:kind==='door'?2100:1200,sill:kind==='door'?0:1000,flip:0,hinge:0},o);
  // bottom wall runs right→left (7200→0); s measured from its start
  const openings=[
    O(top,1725,1000,'window',{sill:1050,h:1150}),
    O(top,5100,1800,'window',{sill:900,h:1500}),
    O(right,2700,1500,'window'),
    O(bottom,7200-5300,1000,'door',{flip:0,hinge:1}),
    O(left,5400-3900,600,'window',{sill:1450,h:700}),
    O(part,1700,900,'door',{flip:1,hinge:0}),
    O(part,4250,800,'door',{flip:1,hinge:1}),
  ];
  const I=(type,x,y,r,o={})=>Object.assign({id:nid('i'),type,x,y,r,w:CAT[type].w,d:CAT[type].d,h:CAT[type].h,z:CAT[type].z},o);
  const yTop=125;
  const items=[
    I('fridge',125+300,yTop+300,0,{w:600,d:650}),
    I('base',725+300,yTop+300,0),
    I('sinkbase',1325+400,yTop+300,0),
    I('dishwasher',2125+300,yTop+300,0),
    I('wallcab',725+250,yTop+175,0,{w:500}),
    I('range',125+300,1625,-90),
    I('base',125+300,2225,-90),
    I('tall',125+300,2825,-90,{w:600,h:2100}),
    I('tub',125+850,5275-375,180),
    I('vanity',1400+400,3260+240,0),
    I('toilet',125+340,3700+190,-90),
  ];
  return {name:'Flat 4B — kitchen & bath renovation',walls,openings,items,
    roomMeta:[{x:1500,y:1600,name:'Kitchen',type:'kitchen'},{x:1500,y:4300,name:'Bathroom',type:'bath'},{x:5100,y:2700,name:'Living',type:'living'}]};
}
function blankModel(){return {name:'Untitled project',walls:[],openings:[],items:[],roomMeta:[],dims:[],cols:[],arcs:[],areas:[],texts:[]};}
const wallById=id=>M.walls.find(w=>w.id===id);
function wallLen(w){return dist(w.a,w.b);}
function wallDir(w){return norm(sub(w.b,w.a));}

/* wall end extensions: how far each end pushes into joining walls */
// An end marked loose stays where it is but is not joined: neighbours don't drag it and it doesn't fill the corner.
const isLoose=(w,k)=>!!(w.loose&&w.loose[k]);
function setLoose(w,k,v){if(v){w.loose=w.loose||{};w.loose[k]=true;}else if(w.loose){delete w.loose[k];if(!w.loose.a&&!w.loose.b)delete w.loose;}}
function wallExt(w){
  const res=[0,0];[w.a,w.b].forEach((P,k)=>{if(isLoose(w,k?'b':'a'))return;
    for(const o of M.walls){if(o===w)continue;
      if(dist(P,o.a)<1||dist(P,o.b)<1){if(!isLoose(o,dist(P,o.a)<1?'a':'b'))res[k]=Math.max(res[k],o.t/2);continue;}
      const c=segClosest(P,o.a,o.b);if(c.t>0.0001&&c.t<0.9999&&dist(P,c.q)<1)res[k]=Math.max(res[k],o.t/2);}
  });return res;}

/* solid wall pieces along a wall as [s0,s1] intervals, minus openings */
function wallPieces(w,ext){
  const L=wallLen(w);const cuts=M.openings.filter(o=>o.wall===w.id).map(o=>[o.s-o.w/2,o.s+o.w/2]).sort((a,b)=>a[0]-b[0]);
  const out=[];let cur=-ext[0];for(const c of cuts){if(c[0]>cur)out.push([cur,c[0]]);cur=Math.max(cur,c[1]);}
  if(L+ext[1]>cur)out.push([cur,L+ext[1]]);return out;}
function pieceQuad(w,s0,s1){const d=wallDir(w),n=perp(d),h=w.t/2;const p0=add(w.a,mul(d,s0)),p1=add(w.a,mul(d,s1));
  return [add(p0,mul(n,h)),add(p1,mul(n,h)),add(p1,mul(n,-h)),add(p0,mul(n,-h))];}

/* ============================== rooms (planar faces) ============================== */
// Faces of the wall graph (each room, plus the outside). Shared by room detection and DXF outlines.
function planarFaces(){
  const ws=M.walls.filter(w=>!w.kind);const nodes=[],key=new Map();
  const nodeOf=p=>{const k=Math.round(p[0])+','+Math.round(p[1]);if(!key.has(k)){key.set(k,nodes.length);nodes.push({p:[Math.round(p[0]),Math.round(p[1])],out:[]});}return key.get(k);};
  const edges=[];const seen=new Set();
  ws.forEach(w=>{const L=wallLen(w);if(L<1)return;const ts=[0,1];const d=sub(w.b,w.a);
    ws.forEach(o=>{if(o===w)return;const e=sub(o.b,o.a);const c=cross(d,e);if(Math.abs(c)<1e-9)return;
      const t=cross(sub(o.a,w.a),e)/c,u=cross(sub(o.a,w.a),d)/c;const et=1/L,eu=1/(wallLen(o)||1);
      if(t>-et&&t<1+et&&u>-eu&&u<1+eu)ts.push(clamp(t,0,1));});
    ts.sort((a,b)=>a-b);const uq=[ts[0]];for(const t of ts)if((t-uq[uq.length-1])*L>1)uq.push(t);
    if((1-uq[uq.length-1])*L<=1)uq[uq.length-1]=1;else uq.push(1);
    for(let i=0;i<uq.length-1;i++){const p0=add(w.a,mul(d,uq[i])),p1=add(w.a,mul(d,uq[i+1]));const u=nodeOf(p0),v=nodeOf(p1);if(u===v)continue;
      const k=u<v?u+'-'+v:v+'-'+u;if(seen.has(k))continue;seen.add(k);edges.push({u,v,w,t0:uq[i],t1:uq[i+1]});}
  });
  const half=[];edges.forEach((e,i)=>{for(const [a,b] of [[e.u,e.v],[e.v,e.u]]){const h={from:a,to:b,e,used:false,ang:0};const dv=sub(nodes[b].p,nodes[a].p);h.ang=Math.atan2(dv[1],dv[0]);nodes[a].out.push(h);half.push(h);}});
  nodes.forEach(n=>n.out.sort((x,y)=>x.ang-y.ang));
  const faces=[];
  for(const h0 of half){if(h0.used)continue;const loop=[];let h=h0,guard=0;
    while(!h.used&&guard++<5000){h.used=true;loop.push(h);const out=nodes[h.to].out;const idx=out.findIndex(x=>x.to===h.from);h=out[(idx-1+out.length)%out.length];}
    if(h!==h0)continue;faces.push(loop);}
  const fs=faces.map(loop=>{const poly=loop.map(h=>nodes[h.from].p);return {loop,poly,area:polyArea(poly)};});
  if(!fs.length)return null;
  let outer=fs.reduce((a,b)=>Math.abs(b.area)>Math.abs(a.area)?b:a);return {fs,nodes,innerSign:-Math.sign(outer.area)};}
function computeRooms(){
  syncHostedCols();syncArcs();const pf=planarFaces();if(!pf)return [];const {fs,innerSign}=pf;
  const res=[];const usedMeta=new Set();offRooms=[];
  fs.filter(f=>Math.sign(f.area)===innerSign&&Math.abs(f.area)>200000).forEach(f=>{
    const poly=f.poly;const n=poly.length;
    // inward normal sign
    const d0=norm(sub(poly[1%n],poly[0]));const mid=mul(add(poly[0],poly[1%n]),.5);let inw=pointInPoly(add(mid,mul(perp(d0),2)),poly)?1:-1;
    const lines=f.loop.map((h,i)=>{const a=poly[i],b=poly[(i+1)%n];const d=norm(sub(b,a));const off=mul(perp(d),inw*h.e.w.t/2);return {p:add(a,off),d};});
    const net=lines.map((ln,i)=>{const pr=lines[(i-1+n)%n];return lineX(pr.p,pr.d,ln.p,ln.d)||ln.p;});
    const simp=net.filter((p,i)=>{const a=net[(i-1+n)%n],b=net[(i+1)%n];return Math.abs(cross(norm(sub(p,a)),norm(sub(b,p))))>1e-4;});
    const r={poly,net,simp,inw,loop:f.loop,netArea:Math.abs(polyArea(net)),centroid:polyCentroid(net)};
    // perimeter, wall area, openings, skirting
    let per=0,wallA=0,doorW=0;const opIds=new Set();
    f.loop.forEach((h,i)=>{const L=dist(net[i],net[(i+1)%n]);per+=L;wallA+=L*h.e.w.h;
      const w=h.e.w,WL=wallLen(w),lo=Math.min(h.e.t0,h.e.t1)*WL,hi=Math.max(h.e.t0,h.e.t1)*WL;
      M.openings.forEach(o=>{if(o.wall===w.id&&o.s>=lo&&o.s<=hi&&!opIds.has(o.id)){opIds.add(o.id);wallA-=o.w*o.h;if(o.kind==='door')doorW+=o.w;}});});
    r.perimeter=per;r.wallArea=wallA;r.skirting=per-doorW;r.openings=opIds;r.cols=0;
    (M.cols||[]).forEach(c=>{if(c.wall){const w=wallById(c.wall);if(!w)return;const n=perp(wallDir(w));
        [1,-1].forEach(sg=>{const pr=c.d/2+sg*(c.off||0)-w.t/2;if(pr<=0.5)return;if(!pointInPoly(add([c.x,c.y],mul(n,sg*(w.t/2+pr/2))),net))return;
          r.cols++;r.netArea-=c.w*pr;r.skirting+=2*pr;r.wallArea+=2*pr*colH(c);});return;}
      if(!pointInPoly([c.x,c.y],net))return;r.cols++;r.netArea-=colArea(c);r.wallArea+=colPerim(c)*colH(c);r.skirting+=colPerim(c);});
    const mi=M.roomMeta.findIndex((m,i)=>!usedMeta.has(i)&&pointInPoly([m.x,m.y],poly));
    if(mi>=0){usedMeta.add(mi);r.meta=M.roomMeta[mi];}
    if(r.meta&&r.meta.off){offRooms.push(r);return;}
    res.push(r);});
  let k=1;res.sort((a,b)=>a.centroid[1]-b.centroid[1]||a.centroid[0]-b.centroid[0]);
  const isDef=n=>!n||/^Room \d+$/.test(n);const used=new Set(res.filter(r=>r.meta&&!isDef(r.meta.name)).map(r=>r.meta.name));
  res.forEach(r=>{if(r.meta&&!isDef(r.meta.name))r.name=r.meta.name;else{while(used.has('Room '+k))k++;r.name='Room '+(k++);}r.type=r.meta&&r.meta.type||'other';
    r.rect=null;if(r.simp.length===4){const s=r.simp;const a=dist(s[0],s[1]),b=dist(s[1],s[2]);
      if(Math.abs(dot(norm(sub(s[1],s[0])),norm(sub(s[2],s[1]))))<1e-3){const d=norm(sub(s[1],s[0]));r.rect=Math.abs(d[0])>=Math.abs(d[1])?[a,b]:[b,a];}}
    r.tileMode=(r.meta&&r.meta.tile)||defaultTile(r.type);r.tileH=(r.meta&&r.meta.tileH)||2100;
    r.elevs=roomElevations(r);r.tileArea=r.elevs.reduce((a,e)=>a+e.tileArea,0);});
  return res;}
function defaultTile(type){return type==='kitchen'?'splash':type==='bath'?'full':'none';}


/* ============================== rooms and areas, one idea ============================== */
// A room is the floor inside a loop of walls. It can be deleted (its walls stay), and resized by dragging its corners or
// sides, which moves the walls. An area you draw can also be a room (a "room area"): it gets a room colour, a floor in 3D,
// and wall surface, tiles and skirting from the walls along its sides.
let offRooms=[];
const isZone=A=>!!(A&&A.type&&ROOMTYPES[A.type]);
function kindOptions(cur){const o=(v,l)=>`<option value="${v}"${v===cur?' selected':''}>${l}</option>`;
  return o('none','Measurement only')+'<optgroup label="Room">'+Object.entries(ROOMTYPES).map(([k,v])=>o('room:'+k,v)).join('')+'</optgroup><optgroup label="Outdoor">'+Object.entries(SURF).map(([k,v])=>o(k,v.label)).join('')+'</optgroup>';}
const areaKindOf=A=>A.type?'room:'+A.type:A.surf||'none';
function setAreaKind(A,v){delete A.type;delete A.surf;if(v.startsWith('room:'))A.type=v.slice(5);else if(SURF[v])A.surf=v;}
function kindLabel(v){return v.startsWith('room:')?ROOMTYPES[v.slice(5)]:SURF[v]?SURF[v].label:'Area';}
// walls along an area's sides give its wall surface, tiles and skirting
const zoneTile=A=>A.tile==='full'||(!A.tile&&A.type==='bath')?'full':'none';
function zoneStats(A){const st=areaStats(A);let wall=0,tile=0,skirt=st.per,floor=st.area;const mode=zoneTile(A),tH=A.tileH||2100;
  const P=areaOutline(A,true);(M.cols||[]).forEach(c=>{if(!c.wall&&pointInPoly([c.x,c.y],P))floor-=colArea(c);});
  const n=A.pts.length;
  for(let i=0;i<n;i++){const [p,q,sg]=areaEdge(A,i);if(Math.abs(sg)>=0.5)continue;const L=dist(p,q);if(L<1)continue;const d=norm(sub(q,p));
    M.walls.forEach(w=>{if(w.kind)return;const wd=wallDir(w);if(Math.abs(cross(d,wd))>0.02)return;const wn=perp(wd);
      for(const side of [1,-1]){const fa=add(w.a,mul(wn,side*w.t/2));if(Math.abs(cross(d,sub(fa,p)))>30)continue;
        const t0=dot(sub(fa,p),d),t1=t0+dot(sub(w.b,w.a),d),lo=Math.max(0,Math.min(t0,t1)),hi=Math.min(L,Math.max(t0,t1));if(hi-lo<1)continue;
        wall+=(hi-lo)*w.h;if(mode==='full')tile+=(hi-lo)*Math.min(tH,w.h);
        M.openings.forEach(o=>{if(o.wall!==w.id)return;const u=dot(sub(add(w.a,mul(wd,o.s)),p),d);if(u<lo||u>hi)return;wall-=o.w*o.h;if(o.kind==='door')skirt-=o.w;
          if(mode==='full')tile-=o.w*Math.max(0,Math.min(o.sill+o.h,tH)-o.sill);});}});}
  return {floor,per:st.per,wall:Math.max(0,wall),tile:Math.max(0,tile),skirt:Math.max(0,skirt),mode};}
// handles on a selected room: its corners, and one on each straight side
function roomEdgeHandles(r){const n=r.net.length,best=new Map();
  for(let i=0;i<n;i++){const a=r.net[i],b=r.net[(i+1)%n],w=r.loop[i].e.w;if(w.arcId)continue;const L=dist(a,b);if(L<250)continue;const cur=best.get(w.id);if(!cur||L>cur.L)best.set(w.id,{p:mul(add(a,b),.5),w,L});}
  return [...best.values()];}
function selRoom(){if(!sel||sel.kind!=='room')return null;let r=rooms.find(r=>pointInPoly(sel.pt,r.net));
  if(!r){let bd=3000;rooms.forEach(x=>{const d=dist(x.centroid,sel.pt);if(d<bd){bd=d;r=x;}});if(r)sel.pt=r.centroid.slice();}return r;}
function drawRoomHandles(){const r=selRoom();if(!r||drag&&drag.moved)return;const hs=ptrTouch?14:9;ctx.save();ctx.strokeStyle=C.accent;ctx.lineWidth=1.5;
  r.simp.forEach((p,i)=>{const q=toS(p),hot=hover&&hover.kind==='roomcorner'&&hover.idx===i;ctx.fillStyle=hot?C.accent:C.paper;ctx.beginPath();ctx.rect(q[0]-hs/2,q[1]-hs/2,hs,hs);ctx.fill();ctx.stroke();});
  roomEdgeHandles(r).forEach(e=>{const q=toS(e.p),hot=hover&&hover.kind==='roomedge'&&hover.wid===e.w.id;ctx.fillStyle=hot?C.accent:C.paper;ctx.beginPath();ctx.arc(q[0],q[1],hs/2,0,Math.PI*2);ctx.fill();ctx.stroke();});
  ctx.restore();}
function hitRoomHandles(p){if(!sel||sel.kind!=='room'||tool!=='select')return null;const r=selRoom();if(!r)return null;const tol=(ptrTouch?14:9)/view.s;
  for(let i=0;i<r.simp.length;i++)if(dist(p,r.simp[i])<tol)return {kind:'roomcorner',pt:sel.pt.slice(),idx:i};
  for(const e of roomEdgeHandles(r))if(dist(p,e.p)<tol)return {kind:'roomedge',pt:sel.pt.slice(),wid:e.w.id};return null;}
// the wall junction behind a room's inside corner, and every wall end that meets there
function roomCornerJoint(r,c){let J=null,bd=1e9;const ws=[...new Set(r.loop.map(h=>h.e.w))];
  ws.forEach(w=>['a','b'].forEach(k=>{const d=dist(w[k],c);if(d<bd&&d<w.t*1.6+60){bd=d;J=w[k].slice();}}));if(!J)return null;
  const ends=[];M.walls.forEach(w=>['a','b'].forEach(k=>{if(dist(w[k],J)<1)ends.push([w,k]);}));return {J,ends};}
function deleteRoom(r){mutate(()=>{roomMetaOf(r).off=true;});toast((r.name||'Room')+' removed from the plan and the takeoff. Its walls stay. Ctrl+Z, or Restore under Takeoff, brings it back.');}
function restoreRooms(){mutate(()=>{M.roomMeta.forEach(m=>{delete m.off;});});toast('Deleted rooms are back.');}

/* ============================== elevations ============================== */
// Each room face, seen from inside, unfolded left to right. x runs along the face, z is height above floor.
function roomElevations(r){
  const n=r.net.length;if(n<3)return [];
  const arcOf=i=>r.loop[i%n].e.w.arcId;
  const isCol=i=>{const a=r.net[i],b=r.net[(i+1)%n],c=r.net[(i+2)%n];if(arcOf(i)&&arcOf(i)===arcOf((i+1)%n))return true;return Math.abs(cross(norm(sub(b,a)),norm(sub(c,b))))<1e-4&&dot(sub(b,a),sub(c,b))>0;};
  let start=0;for(let i=0;i<n;i++){if(!isCol((i-1+n)%n)){start=i;break;}}
  const groups=[];let i=start,guard=0;
  while(guard++<n){const g={edges:[i]};let j=i;while(isCol(j)&&g.edges.length<n){j=(j+1)%n;g.edges.push(j);}groups.push(g);i=(j+1)%n;if(i===start)break;}
  const out=[];
  groups.forEach(g=>{
    const P=r.net[g.edges[0]],Q=r.net[(g.edges[g.edges.length-1]+1)%n];const curved=g.edges.some(k=>arcOf(k));
    const L=curved?g.edges.reduce((acc,k)=>acc+dist(r.net[k],r.net[(k+1)%n]),0):dist(P,Q);if(L<150)return;
    const walls=[...new Set(g.edges.map(k=>r.loop[k].e.w))];const H=Math.max(...walls.map(w=>w.h));
    const d=norm(sub(Q,P)),nIn=mul(perp(d),r.inw),f=mul(nIn,-1),right=[-f[1],f[0]];
    const left=dot(P,right)<=dot(Q,right)?P:Q;const X=p=>dot(sub(p,left),right);
    const ops=[];M.openings.forEach(o=>{const w=walls.find(x=>x.id===o.wall);if(!w)return;const c=add(w.a,mul(wallDir(w),o.s));
      if(Math.abs(dot(sub(c,P),nIn)+w.t/2)>25)return;const x=X(c);if(x<-5||x>L+5)return;ops.push({o,x0:x-o.w/2,x1:x+o.w/2});});
    const its=[];M.items.forEach(it=>{const back=rotV([0,-1],it.r);if(dot(back,f)<0.99)return;const c=[it.x,it.y];const bp=add(c,mul(back,it.d/2));
      if(Math.abs(dot(sub(bp,P),nIn))>40)return;const x=X(c);if(x+it.w/2<0||x-it.w/2>L)return;its.push({it,x0:x-it.w/2,x1:x+it.w/2});});
    if(curved){ops.length=0;its.length=0;}
    const e={P,Q,L,H,nIn,ops,its,curved,left,right,mid:curved?r.net[g.edges[Math.floor(g.edges.length/2)]]:mul(add(P,Q),.5)};const tz=tileZones(r,e);e.tiles=tz.rects;e.tileArea=tz.area;out.push(e);});
  out.forEach((e,k)=>e.label=String.fromCharCode(65+k));
  return out;}
function cutIv(ivs,a,b){const o=[];ivs.forEach(([x,y])=>{if(b<=x||a>=y){o.push([x,y]);return;}if(a>x)o.push([x,a]);if(b<y)o.push([b,y]);});return o;}
function tileZones(r,e){
  const step=10,rects=[];let area=0;if(r.tileMode==='none')return {rects,area};
  const strips=[];
  for(let x=0;x<e.L;x+=step){const xm=Math.min(x+step/2,e.L-0.01);let ivs=[];
    const covering=arr=>arr.filter(v=>xm>=v.x0&&xm<=v.x1);
    if(r.tileMode==='full'){ivs=[[0,Math.min(r.tileH,e.H)]];
      covering(e.its).forEach(({it})=>{if(it.type==='tub'||it.type==='shower')ivs=cutIv(ivs,0,it.z+it.h);});}
    else{const ctr=covering(e.its).filter(({it})=>COUNTER.has(it.type)||it.type==='range'||it.type==='vanity');
      if(ctr.length){const base=Math.max(...ctr.map(({it})=>it.z+it.h));const wc=covering(e.its).filter(({it})=>it.z>=base);
        const top=wc.length?Math.min(...wc.map(({it})=>it.z)):base+600;if(top>base)ivs=[[base,Math.min(top,e.H)]];}}
    covering(e.ops).forEach(({o})=>{ivs=cutIv(ivs,o.sill,o.sill+o.h);});
    covering(e.its).forEach(({it})=>{if(it.type==='fridge'||it.type==='tall')ivs=cutIv(ivs,it.z,it.z+it.h);});
    ivs=ivs.filter(([a,b])=>b-a>1);const w=Math.min(step,e.L-x);ivs.forEach(([a,b])=>area+=(b-a)*w);strips.push({x0:x,x1:x+w,ivs});}
  // merge identical neighbouring strips into rectangles
  let open=[];strips.forEach(s=>{const key=iv=>iv[0].toFixed(0)+'-'+iv[1].toFixed(0);const next=[];
    s.ivs.forEach(iv=>{const k=key(iv);const o=open.find(z=>z.k===k&&Math.abs(z.x1-s.x0)<0.01);if(o){o.x1=s.x1;next.push(o);}else next.push({k,x0:s.x0,x1:s.x1,z0:iv[0],z1:iv[1]});});
    open.filter(o=>!next.includes(o)).forEach(o=>rects.push(o));open=next;});
  open.forEach(o=>rects.push(o));return {rects,area};}
function roomAt(p){return rooms.find(r=>pointInPoly(p,r.net));}

/* ============================== units ============================== */
const isMetric=()=>units!=='imperial';
const trimZeros=(s,keep)=>{if(s.indexOf('.')<0)return s;let [i,f]=s.split('.');f=f.replace(/0+$/,'');while(f.length<keep)f+='0';return f?i+'.'+f:i;};
function fmtLen(mm,withUnit){
  if(units==='mm')return Math.round(mm).toLocaleString('en-US')+(withUnit?' mm':'');
  if(units==='cm')return trimZeros((Math.round(mm)/10).toFixed(1),0)+(withUnit?' cm':'');
  if(units==='m')return trimZeros((Math.round(mm)/1000).toFixed(3),2)+(withUnit?' m':'');
  const sign=mm<0?'-':'';let inch=Math.abs(mm)/25.4;let q=Math.round(inch*4)/4;let ft=Math.floor(q/12);let r=q-ft*12;
  const whole=Math.floor(r),frac=r-whole;const fr=frac===0?'':frac===0.25?' ¼':frac===0.5?' ½':' ¾';
  return sign+(ft?ft+"'-":'')+whole+fr+'"';}
function fmtArea(mm2){return isMetric()?(mm2/1e6).toFixed(2):(mm2/92903.04).toFixed(1);}
function fmtRun(mm){return isMetric()?(mm/1000).toFixed(2):(mm/304.8).toFixed(1);}
const areaU=()=>isMetric()?'m²':'ft²', runU=()=>isMetric()?'m':'ft';
function parseLen(str){
  str=String(str).trim().toLowerCase().replace(/,/g,'');if(!str)return NaN;
  let m;
  if((m=str.match(/^(-?\d*\.?\d+)\s*(mm|cm|m)$/))){const v=parseFloat(m[1]);return m[2]==='mm'?v:m[2]==='cm'?v*10:v*1000;}
  if((m=str.match(/^(-?\d*\.?\d+)\s*'\s*-?\s*(?:(\d*\.?\d+)?\s*(?:(\d+)\/(\d+))?\s*"?)?$/))){
    let ft=parseFloat(m[1]),inch=m[2]?parseFloat(m[2]):0;if(m[3])inch+=parseInt(m[3])/parseInt(m[4]);return (ft*12+inch)*25.4;}
  if((m=str.match(/^(-?\d*\.?\d+)\s*(?:(\d+)\/(\d+))?\s*(?:"|in)$/))){let v=parseFloat(m[1]);if(m[2])v+=parseInt(m[2])/parseInt(m[3]);return v*25.4;}
  if((m=str.match(/^-?\d*\.?\d+$/))){const v=parseFloat(str);return units==='mm'?v:units==='cm'?v*10:units==='m'?v*1000:v*25.4;}
  return NaN;}
const lenStep=()=>isMetric()?10:12.7;

/* ============================== history & persistence ============================== */
let undoStack=[],redoStack=[];
function snapshot(){return JSON.stringify(M);}
function pushUndo(s){undoStack.push(s);if(undoStack.length>200)undoStack.shift();redoStack=[];}
function mutate(fn){const s=snapshot();fn();pushUndo(s);changed();}
function undo(){if((tool==='erase'||eraseLastAll)&&eraseStack.length){eraseLastAll=false;eraseUndo();return;}eraseLastAll=false;if(!undoStack.length)return;redoStack.push(snapshot());M=JSON.parse(undoStack.pop());fixUid();sel=null;changed();}
function redo(){if(!redoStack.length)return;undoStack.push(snapshot());M=JSON.parse(redoStack.pop());fixUid();sel=null;changed();}
// Next free id number across everything that has one, and repair any duplicate ids left by older versions
// (they made two pillars or dimensions select as one).
function fixUid(){const all=[M.walls,M.openings,M.items,M.cols,M.dims,M.arcs,M.areas,M.texts].filter(Array.isArray);let mx=0;
  all.forEach(arr=>arr.forEach(o=>{const n=parseInt(String(o.id).slice(1));if(n>mx)mx=n;}));uid=mx+1;
  const seen=new Set(M.walls.map(w=>w.id));[M.openings,M.items,M.cols,M.dims].filter(Array.isArray).forEach(arr=>arr.forEach(o=>{
    if(seen.has(o.id))o.id=String(o.id).charAt(0)+(uid++);seen.add(o.id);}));}
function normUnits(u){return u==='metric'||!u?'mm':['mm','cm','m','imperial'].includes(u)?u:'mm';}

function load(){try{const s=localStorage.getItem('bm-plan');if(s){const o=JSON.parse(s);if(o&&o.M&&Array.isArray(o.M.walls)){M=o.M;units=normUnits(o.units);snapOn=o.snapOn!==false;freeMove=!!o.freeMove;fixUid();return true;}}}catch(e){}return false;}

/* ============================== state ============================== */
let tool='select',placeType=null,sel=null,hover=null,cursor=[0,0],snapInfo=null,ghost=null;
let draw={start:null,chainStart:null};
let snapOn=true,freeMove=false,box=null,emptyDrag=(()=>{try{return matchMedia('(pointer: fine)').matches?'box':'pan';}catch(e){return 'box';}})();
let drag=null,pan=null,spaceDown=false,shiftDown=false;
const planCv=$('#plan');let ctx=planCv.getContext('2d');let C={};
const TILEMODES={none:'No tiling',splash:'Backsplash',full:'Full walls to height'};
function readColors(){const cs=getComputedStyle(document.documentElement);const g=n=>cs.getPropertyValue('--'+n).trim();
  ['paper','ink','muted','poche','accent','accent-weak','snap','dim','grid','grid-major','danger','fixture','fixture-line','sky','ground','line','tile','tile-line','counter','ref','muted','col','col-hatch',
   'room-kitchen','room-bath','room-living','room-bedroom','room-hall','room-other'].forEach(k=>C[k]=g(k));}

/* ============================== view transforms ============================== */
const toS=p=>[p[0]*view.s+view.ox,p[1]*view.s+view.oy];
const toW=p=>[(p[0]-view.ox)/view.s,(p[1]-view.oy)/view.s];
function fit(){const r=planCv.getBoundingClientRect();if(!r.width)return;let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;
  const pts=[];M.walls.forEach(w=>pts.push(w.a,w.b));M.items.forEach(i=>pts.push([i.x,i.y]));
  if(refDrawing&&refVisible){const S=refDrawing.segs;let a=1e9,b=1e9,c=-1e9,d=-1e9;for(let i=0;i<S.length;i+=2){a=Math.min(a,S[i]);c=Math.max(c,S[i]);b=Math.min(b,S[i+1]);d=Math.max(d,S[i+1]);}
    refDrawing.texts.forEach(t=>{a=Math.min(a,t[0]);c=Math.max(c,t[0]);b=Math.min(b,t[1]);d=Math.max(d,t[1]);});if(a<=c)pts.push([a,b],[c,d]);}
  if(refImage&&refVisible)pts.push(...refImageCorners());
  if(!pts.length){view.s=0.08;view.ox=r.width/2;view.oy=r.height/2;return;}
  pts.forEach(p=>{x0=Math.min(x0,p[0]);y0=Math.min(y0,p[1]);x1=Math.max(x1,p[0]);y1=Math.max(y1,p[1]);});
  const pad=70;const s=Math.min((r.width-2*pad)/Math.max(x1-x0,1000),(r.height-2*pad)/Math.max(y1-y0,1000));
  view.s=clamp(s,0.01,2);view.ox=r.width/2-(x0+x1)/2*view.s;view.oy=r.height/2-(y0+y1)/2*view.s;dirty();}

/* ============================== snapping ============================== */
function allEnds(exW,exP){const out=[];M.walls.forEach(w=>{if(exW&&exW.has(w.id))return;[w.a,w.b].forEach(p=>{if(!(exP&&exP.has(p)))out.push(p);});});
  if(exW)M.walls.forEach(w=>{if(exW.has(w.id))[w.a,w.b].forEach(p=>{if(!(exP&&exP.has(p)))out.push(p);});});return out;}
function snapPoint(raw,from,exW,exP){
  if(!snapOn){const d=from&&dist(raw,from)>0?norm(sub(raw,from)):null;return {p:raw.slice(),kind:'free',guides:[],dir:d||undefined};}
  const tol=10/view.s;let best=null,bd=tol;const ends=allEnds(exW,exP);
  for(const p of ends){const d=dist(raw,p);if(d<bd){bd=d;best={p:p.slice(),kind:'end',guides:[]};}}
  if(best)return best;
  const rs=refSnap(raw,tol);if(rs)return rs;bd=tol*.8;
  for(const w of M.walls){if(exW&&exW.has(w.id))continue;const m=mul(add(w.a,w.b),.5);const d=dist(raw,m);if(d<bd){bd=d;best={p:m,kind:'mid',guides:[]};}}
  if(best)return best;
  const guides=[];
  if(from&&!shiftDown){
    const v=sub(raw,from);let L=vlen(v);let a=Math.atan2(v[1],v[0]);a=Math.round(a/(Math.PI/12))*(Math.PI/12);
    const d=[Math.cos(a),Math.sin(a)];if(Math.abs(d[0])<1e-9)d[0]=0;if(Math.abs(d[1])<1e-9)d[1]=0;
    L=Math.round(dot(v,d)/lenStep())*lenStep();let p=add(from,mul(d,L)),kind='angle';
    for(const w of M.walls){if(exW&&exW.has(w.id))continue;const e=sub(w.b,w.a);const c=cross(d,e);if(Math.abs(c)<1e-9)continue;
      const t=cross(sub(w.a,from),e)/c,u=cross(sub(w.a,from),d)/c;if(t>1&&u>=0&&u<=1){const q=add(from,mul(d,t));if(dist(q,p)<tol){return {p:q,kind:'on wall',guides:[],dir:d};}}}
    for(const E of ends){if(E===from)continue;
      if(Math.abs(d[0])>0.3&&Math.abs(p[0]-E[0])<tol){const t=(E[0]-from[0])/d[0];if(t>0){p=add(from,mul(d,t));guides.push([E,p]);kind='align';break;}}
      if(Math.abs(d[1])>0.3&&Math.abs(p[1]-E[1])<tol){const t=(E[1]-from[1])/d[1];if(t>0){p=add(from,mul(d,t));guides.push([E,p]);kind='align';break;}}}
    return {p,kind,guides,dir:d};}
  for(const w of M.walls){if(exW&&exW.has(w.id))continue;const c=segClosest(raw,w.a,w.b);if(dist(raw,c.q)<tol*.8)return {p:c.q,kind:'on wall',guides:[]};}
  const p=raw.slice();let kind='free';
  let ax=null,ay=null;for(const E of ends){if(ax===null&&Math.abs(raw[0]-E[0])<tol)ax=E;if(ay===null&&Math.abs(raw[1]-E[1])<tol)ay=E;}
  if(ax){p[0]=ax[0];kind='align';}else p[0]=Math.round(p[0]/lenStep())*lenStep();
  if(ay){p[1]=ay[1];kind='align';}else p[1]=Math.round(p[1]/lenStep())*lenStep();
  if(ax)guides.push([ax,p]);if(ay)guides.push([ay,p]);
  return {p,kind,guides};}

/* opening placement on a wall */
function openingSlot(p,w,width){
  const tol=Math.max(w.t/2,12/view.s);const c=segClosest(p,w.a,w.b);if(dist(p,c.q)>tol)return null;
  const L=wallLen(w),ext=wallExt(w);const lo=ext[0]+width/2,hi=L-ext[1]-width/2;if(hi<lo)return null;
  let s=clamp(c.t*L,lo,hi);const midS=(ext[0]+L-ext[1])/2;if(snapOn){if(Math.abs(s-midS)*view.s<10)s=midS;else s=Math.round(s/lenStep())*lenStep();}
  return {s:clamp(s,lo,hi),lo,hi};}
function nearestWall(p,tolPx){let best=null,bd=1e9;for(const w of M.walls){const c=segClosest(p,w.a,w.b);const d=dist(p,c.q);const lim=Math.max(w.t/2,tolPx/view.s);if(d<lim&&d<bd){bd=d;best=w;}}return best;}

/* fixture placement: back against nearest wall face, align with neighbours and corners */
function fixtureSnap(p,it){
  if(!snapOn||CAT[it.type]&&CAT[it.type].free)return {x:p[0],y:p[1],r:it.r,snapped:false};
  const tol=500;let best=null,bd=tol;
  for(const w of M.walls){const d=wallDir(w),n=perp(d);const c=segClosest(p,w.a,w.b);if(c.t<=0||c.t>=1)continue;
    const off=dot(sub(p,w.a),n);const side=off>=0?1:-1;const faceDist=Math.abs(off)-w.t/2;if(faceDist<-w.t/2||faceDist>bd)continue;
    bd=faceDist;best={w,d,n,side};}
  if(!best)return {x:p[0],y:p[1],r:it.r,snapped:false};
  const {w,d,n,side}=best;const nOut=mul(n,side);
  // rotation: item back (local -y) must point toward the wall (-nOut)
  const r=Math.round(Math.atan2(-nOut[0],nOut[1])*180/Math.PI*1000)/1000;
  const faceOrigin=add(w.a,mul(nOut,w.t/2));let s=dot(sub(p,faceOrigin),d);
  const z0=it.z,z1=it.z+it.h;
  const edges=[];
  // corners: where this face meets other walls' faces
  for(const o of M.walls){if(o===w)continue;const od=wallDir(o),on=perp(od);if(Math.abs(cross(d,od))<1e-6)continue;
    for(const sg of [1,-1]){const q=lineX(faceOrigin,d,add(o.a,mul(on,sg*o.t/2)),od);if(q)edges.push(dot(sub(q,faceOrigin),d));}}
  // neighbouring fixtures on the same face and overlapping height band
  for(const o of M.items){if(o.id===it.id)continue;if(o.z>=z1||o.z+o.h<=z0)continue;const c=[o.x,o.y];const dd=Math.abs(dot(sub(c,faceOrigin),nOut));if(Math.abs(dd-o.d/2)>30)continue;
    const os=dot(sub(c,faceOrigin),d);edges.push(os-o.w/2,os+o.w/2);}
  const hw=it.w/2;let bestE=null,be=150;
  for(const e of edges){for(const [cand,adj] of [[s-hw,e+hw],[s+hw,e-hw]]){const dlt=Math.abs(cand-e);if(dlt<be){be=dlt;bestE=adj;}}}
  if(bestE!==null)s=bestE;else s=Math.round(s/lenStep())*lenStep();
  const c=add(add(faceOrigin,mul(d,s)),mul(nOut,it.d/2));
  return {x:c[0],y:c[1],r,snapped:true,wall:w};}

/* ============================== hit testing ============================== */
function itemLocal(it,p){const a=-it.r*Math.PI/180;const v=sub(p,[it.x,it.y]);return [v[0]*Math.cos(a)-v[1]*Math.sin(a),v[0]*Math.sin(a)+v[1]*Math.cos(a)];}
let ptrTouch=false;
function hitDim(p){const tol=(ptrTouch?14:7)/view.s;for(const d of (M.dims||[])){const c=segClosest(p,d.a,d.b);if(dist(p,c.q)<tol)return {kind:'dim',id:d.id};}return null;}
function colRotHandle(c){const [,hy]=colHalf(c);return add([c.x,c.y],rotV([0,-(hy+28/view.s)],c.r||0));}
function hitTest(p){
  {const hr=hitRoomHandles(p);if(hr)return hr;}
  {const ht=hitText(p);if(ht)return ht;}
  {const ha=hitArea(p);if(ha&&(ha.kind!=='area'||areaLabelHit(p,ha.id)))return ha;}
  if(sel&&sel.kind==='arc'&&tool==='select'){const q=arcById(sel.id);if(q){const tol=(ptrTouch?14:9)/view.s,g=arcGeom(q.a,q.b,q.s);
    if(dist(p,g?g.apex:mul(add(q.a,q.b),.5))<tol)return {kind:'arcmid',id:q.id};
    for(const k of ['a','b'])if(dist(p,q[k])<tol)return {kind:'arcend',id:q.id,end:k};}}
  if(sel&&sel.kind==='col'&&tool==='select'){const c=colById(sel.id);if(c&&dist(p,colRotHandle(c))<(ptrTouch?14:9)/view.s)return {kind:'colrot',id:c.id};}
  const hd=hitDim(p);if(hd)return hd;
  for(const c of (M.cols||[])){const l=rotV(sub(p,[c.x,c.y]),-c.r),[hx,hy]=colHalf(c);if(c.shape==='round'?vlen(l)<=hx:Math.abs(l[0])<=hx&&Math.abs(l[1])<=hy)return {kind:'col',id:c.id};}
  const px=(ptrTouch?16:9)/view.s;
  // wall ends and corners can be grabbed directly; the selected wall's handles get a little extra reach
  let bestEnd=null,bd=1e9;
  for(const w of M.walls){if(w.arcId)continue;const isSel=sel&&sel.kind==='wall'&&sel.id===w.id;const tol=isSel?px*1.4:Math.min(Math.max(px,w.t*0.5),w.t*0.7+px*0.3);
    for(const k of ['a','b']){const d=dist(p,w[k])-(isSel?px*0.2:0);if(d<tol&&d<bd){bd=d;bestEnd={kind:'end',id:w.id,end:k};}}}
  if(bestEnd)return bestEnd;
  for(const o of M.openings){const w=wallById(o.wall);if(!w)continue;const d=wallDir(w);const c=add(w.a,mul(d,o.s));const v=sub(p,c);
    if(Math.abs(dot(v,d))<o.w/2&&Math.abs(dot(v,perp(d)))<Math.max(w.t/2,6/view.s))return {kind:'opening',id:o.id};}
  const its=[...M.items].sort((a,b)=>b.z-a.z);
  for(const it of its){const l=itemLocal(it,p);if(Math.abs(l[0])<=it.w/2&&Math.abs(l[1])<=it.d/2)return {kind:'item',id:it.id};}
  for(const w of M.walls){const c=segClosest(p,w.a,w.b);if(dist(p,c.q)<Math.max(w.t/2,6/view.s))return w.arcId&&arcById(w.arcId)?{kind:'arc',id:w.arcId}:{kind:'wall',id:w.id};}
  {const ha=hitArea(p);if(ha)return ha;}
  {const hl=hitRoomLabel(p);if(hl)return hl;}
  const r=roomAt(p);if(r)return {kind:'room',pt:r.centroid.slice()};
  return null;}

/* ============================== plan drawing ============================== */
let needDraw=true;function dirty(){needDraw=true;}
function resizeCanvas(cv){const r=cv.getBoundingClientRect();const dpr=window.devicePixelRatio||1;const w=Math.max(1,Math.round(r.width*dpr)),h=Math.max(1,Math.round(r.height*dpr));
  if(cv.width!==w||cv.height!==h){cv.width=w;cv.height=h;return true;}return false;}
function drawPlan(){
  let dpr,W,H;if(EXP){dpr=EXP.k;W=EXP.w;H=EXP.h;}else{resizeCanvas(planCv);dpr=pxr();W=planCv.width/dpr;H=planCv.height/dpr;}
  ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle=C.paper;ctx.fillRect(0,0,W,H);
  if(!EXP||EXP.grid)drawGrid(W,H);
  // rooms
  rooms.forEach(r=>{ctx.beginPath();r.net.forEach((p,i)=>{const s=toS(p);i?ctx.lineTo(s[0],s[1]):ctx.moveTo(s[0],s[1]);});ctx.closePath();
    ctx.fillStyle=C['room-'+r.type]||C['room-other'];ctx.fill();
    if(sel&&sel.kind==='room'&&pointInPoly(sel.pt,r.net)){ctx.fillStyle=C['accent-weak'];ctx.fill();ctx.strokeStyle=C.accent;ctx.lineWidth=1.5;ctx.setLineDash([6,4]);ctx.stroke();ctx.setLineDash([]);}});
  drawSurfaces();
  drawReference();
  // fixtures below wall cabinets
  const its=[...M.items].sort((a,b)=>a.z-b.z);its.forEach(it=>drawItem(it,false));
  // walls (poché)
  ctx.fillStyle=C.poche;
  M.walls.forEach(w=>{if(w.kind)return;const ext=wallExt(w);wallPieces(w,ext).forEach(([s0,s1])=>{const q=pieceQuad(w,s0,s1).map(toS);ctx.beginPath();q.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.closePath();ctx.fill();});});
  M.walls.forEach(w=>{if(w.kind)drawYardWall(w);});
  // columns
  (M.cols||[]).forEach(c=>drawColumn(c,sel&&sel.kind==='col'&&sel.id===c.id?'selected':'normal'));
  if(sel&&sel.kind==='col'&&tool==='select'){const c=colById(sel.id);if(c){const rot=drag&&drag.kind==='colrot';
      if(!(drag&&drag.moved)||rot){if(!rot)drawColDims(c,c.id,C.accent);
        const [,hy]=colHalf(c),top=toS(add([c.x,c.y],rotV([0,-hy],c.r||0))),hp=toS(colRotHandle(c));
        ctx.save();ctx.strokeStyle=C.accent;ctx.lineWidth=1.2;ctx.beginPath();ctx.moveTo(top[0],top[1]);ctx.lineTo(hp[0],hp[1]);ctx.stroke();
        ctx.fillStyle=hover&&hover.kind==='colrot'||rot?C.accent:C.paper;ctx.lineWidth=1.6;ctx.beginPath();ctx.arc(hp[0],hp[1],6.5,0,Math.PI*2);ctx.fill();ctx.stroke();
        ctx.strokeStyle=hover&&hover.kind==='colrot'||rot?C.paper:C.accent;ctx.lineWidth=1.3;ctx.beginPath();ctx.arc(hp[0],hp[1],3.2,-Math.PI*0.9,Math.PI*0.4);ctx.stroke();
        if(rot){const cs=toS([c.x,c.y]);ctx.setLineDash([3,3]);ctx.beginPath();ctx.moveTo(cs[0],cs[1]);ctx.lineTo(hp[0],hp[1]);ctx.stroke();ctx.setLineDash([]);
          txt((Math.round((c.r||0)*10)/10)+'°',[hp[0]+14,hp[1]-12],{mono:true,size:11.5,weight:'500',color:C.accent,halo:C.paper,align:'left'});}
        ctx.restore();}}}
  // openings
  M.openings.forEach(o=>drawOpening(o,false));
  // selection highlight
  if(hover&&tool==='select'&&!drag&&(hover.kind==='wall'||hover.kind==='end')&&!(sel&&sel.kind==='wall'&&sel.id===hover.id)){const w=wallById(hover.id);if(w)wallHighlight(w,false);}
  if(sel&&sel.kind==='wall'){const w=wallById(sel.id);if(w)wallHighlight(w,true);}
  if(sel&&sel.kind==='room'&&tool==='select')drawRoomHandles();
  if(hover&&tool==='select'&&!drag&&hover.kind==='arc'&&!(sel&&sel.kind==='arc'&&sel.id===hover.id)){const q=arcById(hover.id);if(q)drawArcSel(q,false);}
  if(sel&&sel.kind==='arc'){const q=arcById(sel.id);if(q)drawArcSel(q,true);}
  if(sel&&sel.kind==='walls')sel.ids.forEach(id=>{const w=wallById(id);if(w)wallHighlight(w,true,true);});
  // loose (unsnapped) ends
  if(tool==='select'){ctx.strokeStyle=C.snap;ctx.lineWidth=1.5;M.walls.forEach(w=>['a','b'].forEach(k=>{if(!isLoose(w,k))return;const q=toS(w[k]);ctx.fillStyle=C.paper;ctx.beginPath();ctx.arc(q[0],q[1],4,0,Math.PI*2);ctx.fill();ctx.stroke();}));}
  if(sel&&sel.kind==='opening'){const o=M.openings.find(x=>x.id===sel.id);if(o){drawOpening(o,true);openingDims(o);}}
  if(sel&&sel.kind==='item'){const it=M.items.find(x=>x.id===sel.id);if(it)drawItem(it,true);}
  // kept dimensions
  drawWallLengths();drawOpeningWidths();
  (M.dims||[]).forEach(d=>{const on=sel&&sel.kind==='dim'&&sel.id===d.id;if(!MEAS.kept&&!on)return;drawMeasure(d.a,d.b,on?C.accent:C.ink,{width:on?2:1.1});});
  drawAreas();
  // exterior dimensions
  exteriorDims();
  // room labels
  rooms.forEach(drawRoomLabel);
  drawTexts();
  // elevation markers for the room shown in the elevation pane
  if(!EXP&&isElevView()){const r=elevRoom();if(r){ctx.strokeStyle=C.accent;ctx.lineWidth=1.5;ctx.setLineDash([6,4]);ctx.beginPath();r.net.forEach((p,i)=>{const q=toS(p);i?ctx.lineTo(q[0],q[1]):ctx.moveTo(q[0],q[1]);});ctx.closePath();ctx.stroke();ctx.setLineDash([]);
    r.elevs.forEach(e=>{const c=toS(add(e.mid,mul(e.nIn,Math.max(230,26/view.s))));const tip=toS(add(e.mid,mul(e.nIn,Math.max(40,4/view.s))));
      const dir=norm(sub(tip,c));ctx.fillStyle=C.accent;ctx.beginPath();ctx.moveTo(tip[0],tip[1]);ctx.lineTo(...add(c,mul(perp(dir),8)));ctx.lineTo(...add(c,mul(perp(dir),-8)));ctx.closePath();ctx.fill();
      ctx.beginPath();ctx.arc(c[0],c[1],10,0,Math.PI*2);ctx.fillStyle=C.paper;ctx.fill();ctx.stroke();txt(e.label,[c[0],c[1]+0.5],{weight:'600',size:11,color:C.accent});});}}
  if(EXP)return;
  // tool previews
  drawToolPreview();
  $('#lenBtn').hidden=!(tool==='wall'&&draw.start&&lenbox.hidden);
  updateScalebar();}
function wallHighlight(w,selected,noDim){
  const ext=wallExt(w);ctx.strokeStyle=C.accent;ctx.lineWidth=selected?2:1.2;if(!selected)ctx.setLineDash([5,3]);
  wallPieces(w,ext).forEach(([s0,s1])=>{const q=pieceQuad(w,s0,s1).map(toS);ctx.beginPath();q.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.closePath();ctx.stroke();});ctx.setLineDash([]);
  const hs=ptrTouch?14:9;
  ['a','b'].forEach(k=>{const s=toS(w[k]);const hot=hover&&hover.kind==='end'&&hover.id===w.id&&hover.end===k;
    ctx.fillStyle=hot?C.accent:C.paper;ctx.strokeStyle=C.accent;ctx.lineWidth=1.5;ctx.beginPath();ctx.rect(s[0]-hs/2,s[1]-hs/2,hs,hs);ctx.fill();ctx.stroke();});
  if(selected&&!drag&&!noDim){const n=perp(wallDir(w));dimLine(w.a,w.b,n,w.t/2+Math.max(300,30/view.s),fmtLen(wallLen(w))+'  '+angleLabel(wallDir(w)),C.accent);}}
function liveDim(w,extra){if(!w||wallLen(w)<1)return;const n=perp(wallDir(w));dimLine(w.a,w.b,n,w.t/2+Math.max(300,30/view.s),fmtLen(wallLen(w))+(extra||''),C.accent);}
function drawGrid(W,H){
  const steps=[100,500,1000,5000];let step=steps.find(s=>s*view.s>=12)||10000;const major=step===100?1000:step*5;
  const tl=toW([0,0]),br=toW([W,H]);ctx.lineWidth=1;
  for(const [st,col] of [[step,C.grid],[major,C['grid-major']]]){ctx.strokeStyle=col;ctx.beginPath();
    for(let x=Math.floor(tl[0]/st)*st;x<=br[0];x+=st){const sx=Math.round(x*view.s+view.ox)+.5;ctx.moveTo(sx,0);ctx.lineTo(sx,H);}
    for(let y=Math.floor(tl[1]/st)*st;y<=br[1];y+=st){const sy=Math.round(y*view.s+view.oy)+.5;ctx.moveTo(0,sy);ctx.lineTo(W,sy);}ctx.stroke();}}
function updateScalebar(){const target=110/view.s;const nice=[100,200,250,500,1000,2000,2500,5000,10000,20000];const v=nice.find(n=>n>=target*0.6)||20000;
  const sb=$('#scalebar');sb.querySelector('i').style.width=(v*view.s)+'px';sb.querySelector('span').textContent=isMetric()?(v>=1000?(v/1000)+' m':units==='cm'?(v/10)+' cm':v+' mm'):fmtLen(v);}
function txt(s,p,opts={}){ctx.save();ctx.font=(opts.weight||'400')+' '+(opts.size||11)+'px '+(opts.mono?'"IBM Plex Mono", ui-monospace, monospace':'"IBM Plex Sans", system-ui, sans-serif');
  ctx.textAlign=opts.align||'center';ctx.textBaseline=opts.base||'middle';ctx.translate(p[0],p[1]);if(opts.rot)ctx.rotate(opts.rot);
  if(opts.halo){ctx.strokeStyle=opts.halo;ctx.lineWidth=3.5;ctx.lineJoin='round';ctx.strokeText(s,0,0);}ctx.fillStyle=opts.color||C.ink;ctx.fillText(s,0,0);ctx.restore();}
function dimLine(a,b,n,offMm,label,color){if(!MEAS.edit&&!dimLine.force)return;
  const A=add(a,mul(n,offMm)),B=add(b,mul(n,offMm));const sa=toS(A),sb=toS(B);const ea=toS(add(a,mul(n,offMm*0.25))),eb=toS(add(b,mul(n,offMm*0.25)));
  ctx.strokeStyle=color||C.dim;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(ea[0],ea[1]);ctx.lineTo(...toS(add(a,mul(n,offMm+80/view.s/10))));ctx.moveTo(eb[0],eb[1]);ctx.lineTo(...toS(add(b,mul(n,offMm+80/view.s/10))));
  ctx.moveTo(sa[0],sa[1]);ctx.lineTo(sb[0],sb[1]);ctx.stroke();
  for(const s of [sa,sb]){ctx.beginPath();ctx.moveTo(s[0]-4,s[1]+4);ctx.lineTo(s[0]+4,s[1]-4);ctx.lineWidth=1.4;ctx.stroke();}
  let ang=Math.atan2(sb[1]-sa[1],sb[0]-sa[0]);if(ang>Math.PI/2+1e-3||ang<-Math.PI/2+1e-3)ang+=Math.PI;
  const len=Math.hypot(sb[0]-sa[0],sb[1]-sa[1]);if(len<24)return;
  const m=[(sa[0]+sb[0])/2,(sa[1]+sb[1])/2];txt(label,m,{rot:ang,mono:true,size:10.5,color:color||C.dim,halo:C.paper,base:'middle'});}
// which measurements show on the plan (Measures menu); kept per device
const MEAS_DEF={ext:true,walls:false,openings:false,edit:true,rooms:true,areas:true,kept:true};
let MEAS=Object.assign({},MEAS_DEF);try{const v=JSON.parse(localStorage.getItem('bm-meas')||'null');if(v)Object.assign(MEAS,v);else if(localStorage.getItem('bm-dims')==='0')MEAS.ext=false;}catch(e){}
function saveMeas(){try{localStorage.setItem('bm-meas',JSON.stringify(MEAS));}catch(e){}}
function exteriorDims(){
  if(view.s<0.02||!MEAS.ext)return;dimLine.force=true;try{
  M.walls.forEach(w=>{const d=wallDir(w),n=perp(d),m=mul(add(w.a,w.b),.5);const L=wallLen(w);if(L<300)return;
    const pOut=add(m,mul(n,w.t/2+200)),pIn=add(m,mul(n,-(w.t/2+200)));
    const inA=rooms.some(r=>pointInPoly(pOut,r.poly)),inB=rooms.some(r=>pointInPoly(pIn,r.poly));
    if(inA===inB)return;const side=inA?-1:1;const nn=mul(n,side);const ext=wallExt(w);
    const a=add(add(w.a,mul(d,-ext[0])),mul(nn,w.t/2)),b=add(add(w.b,mul(d,ext[1])),mul(nn,w.t/2));
    dimLine(a,b,nn,Math.max(500,28/view.s),fmtLen(L+ext[0]+ext[1]));});}finally{dimLine.force=false;}}
// length written along every wall (curved walls once, along the curve)
const readableRot=d=>{let a=Math.atan2(d[1],d[0]);if(a>Math.PI/2)a-=Math.PI;if(a<=-Math.PI/2)a+=Math.PI;return a;};
function drawWallLengths(){if(!MEAS.walls||view.s<0.02)return;const done=new Set();
  M.walls.forEach(w=>{if(w.arcId){if(done.has(w.arcId))return;done.add(w.arcId);const q=arcById(w.arcId);if(!q)return;const g=arcGeom(q.a,q.b,q.s);if(!g)return;
      const out=norm(sub(g.apex,g.C)),p=add(g.apex,mul(out,q.t/2+11/view.s));txt(fmtLen(g.len),toS(p),{mono:true,size:10.5,color:C.dim||C.muted,halo:C.paper,rot:readableRot(perp(out))});return;}
    const L=wallLen(w);if(L*view.s<34)return;const d=wallDir(w),n=perp(d),m=mul(add(w.a,w.b),.5);
    // write it on the side away from the room when there is one
    const pa=add(m,mul(n,w.t/2+200)),inA=rooms.some(r=>pointInPoly(pa,r.poly));const side=inA?-1:1;
    txt(fmtLen(L),toS(add(m,mul(n,side*(w.t/2+10/view.s)))),{mono:true,size:10.5,color:C.dim||C.muted,halo:C.paper,rot:readableRot(d)});});}
// width written at every door and window
function drawOpeningWidths(){if(!MEAS.openings||view.s<0.02)return;
  M.openings.forEach(o=>{const w=wallById(o.wall);if(!w)return;const d=wallDir(w),n=perp(d),c=add(w.a,mul(d,o.s));
    const side=o.kind==='door'?(o.flip?1:-1):1;txt((o.kind==='door'?'D ':'W ')+fmtLen(o.w),toS(add(c,mul(n,side*(w.t/2+11/view.s)))),{mono:true,size:10.5,weight:'500',color:C.accent,halo:C.paper,rot:readableRot(d)});});}
function drawRoomLabel(r){
  if(r.meta&&r.meta.hideLabel)return;const c=toS(roomLabelPos(r));if(view.s<0.015)return;
  const lines=[[r.name,{weight:'600',size:12.5}]];if(MEAS.rooms)lines.push([fmtArea(r.netArea)+' '+areaU(),{mono:true,size:11}]);
  if(MEAS.rooms&&r.rect&&view.s>0.04)lines.push([fmtLen(r.rect[0])+' × '+fmtLen(r.rect[1]),{mono:true,size:10,color:C.muted}]);
  const lh=15;lines.forEach((l,i)=>txt(l[0],[c[0],c[1]+(i-(lines.length-1)/2)*lh],Object.assign({halo:C['room-'+r.type]||C.paper},l[1])));}

/* ---------- sliding doors: one panel (slides to one side) or two panels (part in the middle) ---------- */
const DOORSTYLES={swing:'Hinged',slide1:'Sliding, 1 panel',slide2:'Sliding, 2 panels'};
const isSliding=o=>o&&o.kind==='door'&&(o.style==='slide1'||o.style==='slide2');
let slideDefaults={style:'slide2',w:1800};
let swingDefaults={w:900};
let firepitDefaults={shape:'round',r:550,w:1500,d:900};
function applyFirepitShape(it,shape,f=firepitDefaults){it.shape=shape;if(shape==='rect'){it.w=f.w;it.d=f.d;}else{it.w=it.d=2*f.r;}}
const DOOR_TYPES=[{id:'swing',label:'Swing door',sub:'Hinged, opens into the room',icon:'door'},{id:'slide1',label:'Sliding door, 1 panel',sub:'One panel slides along the wall',icon:'slidedoor1'},{id:'slide2',label:'Sliding door, 2 panels',sub:'Two panels, opens in the middle',icon:'slidedoor'}];
let doorType='swing';
const curDoorW=()=>doorType==='swing'?swingDefaults.w:slideDefaults.w;
function setDoorType(id){doorType=id;if(id!=='swing'){if(slideDefaults.style!==id){slideDefaults.style=id;if(id==='slide1'&&slideDefaults.w===1800)slideDefaults.w=1000;if(id==='slide2'&&slideDefaults.w===1000)slideDefaults.w=1800;}}
  const ic=document.getElementById('tDoorIco');if(ic){ic.dataset.icon=DOOR_TYPES.find(t=>t.id===id).icon;ic.innerHTML=iconSvg(ic.dataset.icon);}
  setTool('door',id==='swing'?undefined:'slide');}
const doorCards=()=>DOOR_TYPES.map(t=>`<button type="button" class="dcard" role="menuitemradio" data-dtype="${t.id}" aria-checked="${doorType===t.id}"><span class="dimg">${iconSvg(t.icon)}</span><span class="dtx"><b>${t.label}</b><span>${t.sub}</span></span></button>`).join('');
function closeDoorPick(){const m=document.getElementById('doorPick');if(m)m.remove();document.removeEventListener('pointerdown',doorPickAway,true);}
function doorPickAway(e){if(!e.target.closest('#doorPick')&&!e.target.closest('#tDoor'))closeDoorPick();}
function openDoorPick(btn){closeDoorPick();const m=document.createElement('div');m.id='doorPick';m.className='doorpick';m.setAttribute('role','menu');m.setAttribute('aria-label','Door type');
  m.innerHTML='<p class="dph">Choose a door</p>'+doorCards();document.body.appendChild(m);
  const r=btn.getBoundingClientRect(),mw=m.offsetWidth,mh=m.offsetHeight;let x=r.right+8,y=r.top;
  if(x+mw>innerWidth-8){x=Math.max(8,Math.min(r.left,innerWidth-mw-8));y=r.bottom+6;}if(y+mh>innerHeight-8)y=Math.max(8,innerHeight-mh-8);
  m.style.left=x+'px';m.style.top=y+'px';
  m.querySelectorAll('[data-dtype]').forEach(b=>b.onclick=()=>{closeDoorPick();setDoorType(b.dataset.dtype);});
  (m.querySelector('[aria-checked="true"]')||m.querySelector('button')).focus();
  m.addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Escape'){closeDoorPick();btn.focus();}
    if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();const bs=[...m.querySelectorAll('button')],i=bs.indexOf(document.activeElement);bs[(i+(e.key==='ArrowDown'?1:bs.length-1))%bs.length].focus();}});
  setTimeout(()=>document.addEventListener('pointerdown',doorPickAway,true),0);}
// the panels in plan, in wall units: [s0, s1, offset across the wall] for each panel, plus the way each one slides
function slidePanels(o,w){const h=w.t/2,ov=Math.min(60,o.w*0.04),pt=Math.max(30,Math.min(50,w.t*0.3));
  if(o.style==='slide1'){const sn=o.flip?-1:1,dir=o.hinge?1:-1;return {pt,list:[{s0:-o.w/2-ov,s1:o.w/2+ov,off:sn*Math.max(0,h-pt/2-8),dir}]};}
  const off=Math.min(h*0.45,Math.max(pt*0.6,h-pt));return {pt,list:[{s0:-o.w/2-ov/2,s1:ov,off:off,dir:-1},{s0:-ov,s1:o.w/2+ov/2,off:-off,dir:1}]};}
function drawSlidingDoor(o,w,selected){const d=wallDir(w),n=perp(d),c=add(w.a,mul(d,o.s)),{pt,list}=slidePanels(o,w);
  ctx.save();ctx.strokeStyle=selected?C.accent:C.ink;ctx.lineWidth=selected?1.6:1;ctx.fillStyle=C.paper;
  list.forEach(P=>{const q=[[P.s0,P.off-pt/2],[P.s1,P.off-pt/2],[P.s1,P.off+pt/2],[P.s0,P.off+pt/2]].map(([u,v])=>toS(add(c,add(mul(d,u),mul(n,v)))));
    ctx.beginPath();q.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.closePath();ctx.fill();ctx.stroke();
    // arrow showing the way it slides, just outside the wall on the panel's side
    const side=Math.sign(P.off)||1,mid=(P.s0+P.s1)/2,len=Math.min((P.s1-P.s0)*0.45,600),y=side*(w.t/2+Math.max(80,10/view.s));
    const a=toS(add(c,add(mul(d,mid-len/2*P.dir),mul(n,y)))),b=toS(add(c,add(mul(d,mid+len/2*P.dir),mul(n,y))));
    ctx.beginPath();ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);const ang=Math.atan2(b[1]-a[1],b[0]-a[0]),k=6;
    ctx.moveTo(b[0]-k*Math.cos(ang-0.45),b[1]-k*Math.sin(ang-0.45));ctx.lineTo(b[0],b[1]);ctx.lineTo(b[0]-k*Math.cos(ang+0.45),b[1]-k*Math.sin(ang+0.45));ctx.stroke();});
  ctx.restore();}
function drawOpening(o,selected){
  const w=wallById(o.wall);if(!w)return;const d=wallDir(w),n=perp(d),h=w.t/2;
  const c=add(w.a,mul(d,o.s));const j0=add(c,mul(d,-o.w/2)),j1=add(c,mul(d,o.w/2));
  ctx.strokeStyle=selected?C.accent:C.ink;ctx.lineWidth=selected?2:1;
  // jambs
  ctx.beginPath();for(const j of [j0,j1]){const p=toS(add(j,mul(n,h))),q=toS(add(j,mul(n,-h)));ctx.moveTo(p[0],p[1]);ctx.lineTo(q[0],q[1]);}ctx.stroke();
  if(o.kind==='window'){ctx.beginPath();for(const k of [h,-h,h*0.25,-h*0.25]){const p=toS(add(j0,mul(n,k))),q=toS(add(j1,mul(n,k)));ctx.moveTo(p[0],p[1]);ctx.lineTo(q[0],q[1]);}ctx.stroke();return;}
  if(isSliding(o)){drawSlidingDoor(o,w,selected);return;}
  const sideN=o.flip?-1:1;const hingeJ=o.hinge?j1:j0,freeJ=o.hinge?j0:j1;
  const H=add(hingeJ,mul(n,sideN*h)),F=add(freeJ,mul(n,sideN*h));const tip=add(H,mul(n,sideN*o.w));
  const sH=toS(H),sT=toS(tip),sF=toS(F);ctx.lineWidth=selected?2.2:1.6;ctx.beginPath();ctx.moveTo(sH[0],sH[1]);ctx.lineTo(sT[0],sT[1]);ctx.stroke();
  const a0=Math.atan2(sT[1]-sH[1],sT[0]-sH[0]),a1=Math.atan2(sF[1]-sH[1],sF[0]-sH[0]);let da=a1-a0;while(da>Math.PI)da-=2*Math.PI;while(da<-Math.PI)da+=2*Math.PI;
  ctx.lineWidth=1;ctx.setLineDash([4,3]);ctx.beginPath();ctx.arc(sH[0],sH[1],o.w*view.s,a0,a0+da,da<0);ctx.stroke();ctx.setLineDash([]);}
function openingDims(o,ghostW){
  const w=wallById(o.wall);if(!w)return;const d=wallDir(w),n=perp(d),ext=wallExt(w),L=wallLen(w);
  const off=w.t/2+Math.max(250,22/view.s);const a=add(w.a,mul(d,ext[0])),b=add(w.a,mul(d,o.s-o.w/2)),c=add(w.a,mul(d,o.s+o.w/2)),e=add(w.a,mul(d,L-ext[1]));
  if(dist(a,b)>5)dimLine(a,b,mul(n,-1),off,fmtLen(dist(a,b)),C.accent);dimLine(b,c,mul(n,-1),off,fmtLen(o.w),C.accent);if(dist(c,e)>5)dimLine(c,e,mul(n,-1),off,fmtLen(dist(c,e)),C.accent);}
function drawItem(it,selected,isGhost){
  if(CAT[it.type]&&CAT[it.type].group==='Outdoor'&&it.type!=='bbq'&&it.type!=='bench'||CAT[it.type]&&CAT[it.type].group==='Outdoor'){drawOutdoorItem(it,selected,isGhost);return;}
  const c=toS([it.x,it.y]);const s=view.s;const w=it.w*s,dd=it.d*s;
  ctx.save();ctx.translate(c[0],c[1]);ctx.rotate(it.r*Math.PI/180);ctx.globalAlpha=isGhost?.75:1;
  const upper=it.z>=1000;ctx.lineWidth=selected?2:1;ctx.strokeStyle=selected?C.accent:C['fixture-line'];
  if(upper){ctx.setLineDash([5,3]);ctx.strokeRect(-w/2,-dd/2,w,dd);ctx.beginPath();ctx.moveTo(-w/2,-dd/2);ctx.lineTo(w/2,dd/2);ctx.stroke();ctx.setLineDash([]);}
  else{ctx.fillStyle=C.fixture;ctx.fillRect(-w/2,-dd/2,w,dd);ctx.strokeRect(-w/2,-dd/2,w,dd);}
  ctx.lineWidth=1;ctx.strokeStyle=selected?C.accent:C['fixture-line'];const t=it.type;ctx.beginPath();
  if(COUNTER.has(t)){ctx.moveTo(-w/2,dd/2-30*s);ctx.lineTo(w/2,dd/2-30*s);}
  if(t==='sinkbase'){const bw=Math.min(w-120*s,500*s),bh=dd*0.6;roundRect(-bw/2,-dd/2+70*s,bw,bh,40*s);ctx.moveTo(4,-dd/2+90*s);ctx.arc(0,-dd/2+90*s,4,0,Math.PI*2);}
  if(t==='range'){for(const [x,y] of [[-.25,-.22],[.25,-.22],[-.25,.2],[.25,.2]]){const r=w*0.16;ctx.moveTo(x*w+r,y*dd);ctx.arc(x*w,y*dd,r,0,Math.PI*2);}}
  if(t==='dishwasher'){ctx.moveTo(-w/2,-dd/2);ctx.lineTo(w/2,dd/2-30*s);}
  if(t==='tall'){ctx.moveTo(-w/2,-dd/2);ctx.lineTo(w/2,dd/2);ctx.moveTo(w/2,-dd/2);ctx.lineTo(-w/2,dd/2);}
  if(t==='toilet'){const tk=170*s;ctx.rect(-w/2,-dd/2,w,tk);ctx.moveTo(w*0.42,-dd/2+tk+(dd-tk)*0.45);ctx.ellipse(0,-dd/2+tk+(dd-tk)*0.45,w*0.42,(dd-tk)*0.47,0,0,Math.PI*2);}
  if(t==='vanity'){ctx.moveTo(w*0.28,dd*0.04);ctx.ellipse(0,dd*0.04,w*0.28,dd*0.3,0,0,Math.PI*2);}
  if(t==='tub'){roundRect(-w/2+60*s,-dd/2+60*s,w-120*s,dd-120*s,140*s);ctx.moveTo(-w/2+260*s+20*s,0);ctx.arc(-w/2+260*s,0,20*s,0,Math.PI*2);}
  if(t==='shower'){ctx.moveTo(-w/2,-dd/2);ctx.lineTo(w/2,dd/2);ctx.moveTo(w/2,-dd/2);ctx.lineTo(-w/2,dd/2);ctx.moveTo(30*s,0);ctx.arc(0,0,30*s,0,Math.PI*2);}
  ctx.stroke();
  if(t==='fridge'&&w>36)txt('REF',[0,4],{size:10,mono:true,color:C.muted});
  ctx.restore();}
function roundRect(x,y,w,h,r){r=Math.min(r,w/2,h/2);ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();}
function drawSnapMark(sn){if(!sn)return;const s=toS(sn.p);ctx.strokeStyle=C.snap;ctx.lineWidth=1.5;ctx.beginPath();
  if(sn.kind==='end')ctx.rect(s[0]-6,s[1]-6,12,12);else if(sn.kind==='mid'){ctx.moveTo(s[0],s[1]-7);ctx.lineTo(s[0]+7,s[1]+5);ctx.lineTo(s[0]-7,s[1]+5);ctx.closePath();}
  else if(sn.kind==='on wall'){ctx.moveTo(s[0]-6,s[1]-6);ctx.lineTo(s[0]+6,s[1]+6);ctx.moveTo(s[0]+6,s[1]-6);ctx.lineTo(s[0]-6,s[1]+6);}
  else{ctx.moveTo(s[0]-5,s[1]);ctx.lineTo(s[0]+5,s[1]);ctx.moveTo(s[0],s[1]-5);ctx.lineTo(s[0],s[1]+5);}ctx.stroke();
  (sn.guides||[]).forEach(([a,b])=>{const sa=toS(a),sb=toS(b);ctx.setLineDash([3,4]);ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(sa[0],sa[1]);ctx.lineTo(sb[0],sb[1]);ctx.stroke();ctx.setLineDash([]);});}
function drawToolPreview(){
  drawLaserMark();drawWalkMark();
  if(tool==='erase'){drawEraseOverlay();drawEraseCursor();}
  if(tool==='area')drawAreaTool();
  if(tool==='arcwall')drawArcTool();
  if(tool==='paste')drawPasteGhost();
  if(tool==='column'&&colGhost&&colGhost.on){drawColumn(colGhost,'ghost');if(colGhost.wall)drawHostedDims(colGhost,C.snap,colGhost.side);else drawColDims(colGhost,null,C.snap);
    (colGhost.guides||[]).forEach(([a,b])=>{const p1=toS(a),p2=toS(b);ctx.strokeStyle=C.snap;ctx.setLineDash([3,4]);ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(p1[0],p1[1]);ctx.lineTo(p2[0],p2[1]);ctx.stroke();ctx.setLineDash([]);});}
  if(drag&&drag.kind==='col'&&drag.moved){const c=colById(drag.id);if(c){if(c.wall)drawHostedDims(c,C.snap);else drawColDims(c,c.id,C.snap);(drag.guides||[]).forEach(([a,b])=>{const p1=toS(a),p2=toS(b);ctx.strokeStyle=C.snap;ctx.setLineDash([3,4]);ctx.beginPath();ctx.moveTo(p1[0],p1[1]);ctx.lineTo(p2[0],p2[1]);ctx.stroke();ctx.setLineDash([]);});}}
  if(tool==='ruler'){drawSnapMark(snapInfo&&snapInfo.kind!=='free'?snapInfo:null);const e=rulerEnd();
    if(ruler&&e){drawMeasure(ruler.a,e,C.snap,{pill:true,unit:true,legs:true,width:2});const q=toS(ruler.a);ctx.fillStyle=C.snap;ctx.beginPath();ctx.arc(q[0],q[1],3.5,0,Math.PI*2);ctx.fill();}}
  if(tool==='wall'){drawSnapMark(snapInfo);
    if(draw.start&&snapInfo){const a=draw.start,b=snapInfo.p;const L=dist(a,b);if(L>1){const t=curWallSpec().t;
      const d=norm(sub(b,a)),n=perp(d);const q=[add(a,mul(n,t/2)),add(b,mul(n,t/2)),add(b,mul(n,-t/2)),add(a,mul(n,-t/2))].map(toS);
      ctx.fillStyle=C['accent-weak'];ctx.strokeStyle=C.accent;ctx.lineWidth=1.2;ctx.beginPath();q.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.closePath();ctx.fill();ctx.stroke();
      dimLine(a,b,n,t/2+Math.max(300,30/view.s),fmtLen(L)+'  '+angleLabel(d),C.accent);}
      const s=toS(draw.start);ctx.fillStyle=C.accent;ctx.beginPath();ctx.arc(s[0],s[1],3,0,Math.PI*2);ctx.fill();}}
  if((tool==='door'||tool==='window')&&ghost){drawOpening(ghost,true);openingDims(ghost);}
  if(tool==='place'&&ghost){drawItem(ghost,true,true);}
  if(drag&&drag.kind==='wall'&&drag.moved){const w=wallById(drag.id);if(w){const d=wallDir(w);const mv=drag.mv||[0,0];
      const m0=mul(add(drag.a0,drag.b0),.5),m1=add(m0,mv);const sa=toS(m0),sb=toS(m1);
      ctx.strokeStyle=C.snap;ctx.setLineDash([4,3]);ctx.lineWidth=1;ctx.beginPath();const g0=toS(drag.a0),g1=toS(drag.b0);ctx.moveTo(g0[0],g0[1]);ctx.lineTo(g1[0],g1[1]);ctx.stroke();ctx.setLineDash([]);
      if(vlen(mv)>1){const dir=norm(mv);dimLine(m0,m1,perp(dir),Math.max(250,24/view.s),(drag.free?'moved ':'')+fmtLen(vlen(mv)),C.snap);}
      (drag.guides||[]).forEach(([a,b])=>{const p1=toS(a),p2=toS(b);ctx.strokeStyle=C.snap;ctx.setLineDash([3,4]);ctx.beginPath();ctx.moveTo(p1[0],p1[1]);ctx.lineTo(p2[0],p2[1]);ctx.stroke();ctx.setLineDash([]);});
      const st=drag.set;new Set([...st.ca,...st.cb,...st.tees].map(x=>x[0])).forEach(o=>liveDim(o));}}
  if(drag&&drag.kind==='group'&&drag.moved){const mv=drag.mv||[0,0];ctx.strokeStyle=C.snap;ctx.setLineDash([4,3]);ctx.lineWidth=1;
      drag.set.pts.forEach(([w,k,o0])=>{if(k!=='a')return;const b0=drag.set.pts.find(x=>x[0]===w&&x[1]==='b')[2];const p1=toS(o0),p2=toS(b0);ctx.beginPath();ctx.moveTo(p1[0],p1[1]);ctx.lineTo(p2[0],p2[1]);ctx.stroke();});ctx.setLineDash([]);
      if(vlen(mv)>1){const a0=drag.set.pts[0][2];dimLine(a0,add(a0,mv),perp(norm(mv)),Math.max(250,24/view.s),fmtLen(vlen(mv)),C.snap);}
      new Set(drag.set.follow.map(x=>x[0])).forEach(o=>liveDim(o));}
  if(box){const x=Math.min(box.s0[0],box.s1[0]),y=Math.min(box.s0[1],box.s1[1]),w=Math.abs(box.s1[0]-box.s0[0]),h=Math.abs(box.s1[1]-box.s0[1]);const crossing=box.s1[0]<box.s0[0];
    ctx.save();ctx.strokeStyle=crossing?C.snap:C.accent;ctx.fillStyle=crossing?C.snap:C.accent;ctx.globalAlpha=0.1;ctx.fillRect(x,y,w,h);ctx.globalAlpha=1;ctx.lineWidth=1.2;if(crossing)ctx.setLineDash([6,4]);ctx.strokeRect(x+.5,y+.5,w,h);ctx.restore();}
  if(drag&&drag.kind==='end'&&drag.moved){drawSnapMark(drag.snap);drag.links.forEach(([w])=>liveDim(w,drag.main&&w===drag.main[0]?'  '+angleLabel(wallDir(w)):''));}}
function angleLabel(d){let a=Math.round(-Math.atan2(d[1],d[0])*180/Math.PI*10)/10;if(a<0)a+=360;return a+'°';}

/* ============================== elevation drawing ============================== */
const elevCv=$('#elev'),ectx=elevCv.getContext('2d');let elevPt=null;
const isElevView=()=>$('#stage').dataset.view==='elev';
function elevRoom(){if(elevPt){const r=rooms.find(r=>pointInPoly(elevPt,r.net));if(r)return r;}
  const r=rooms.find(r=>r.type==='kitchen')||rooms.find(r=>r.type==='bath')||rooms[0];if(r)elevPt=r.centroid.slice();return r||null;}
function fillElevSelect(){const cur=elevRoom();$('#elevRoom').innerHTML=rooms.map((r,i)=>`<option value="${i}"${r===cur?' selected':''}>${esc(r.name)}</option>`).join('')||'<option>No rooms yet</option>';}
$('#elevRoom').addEventListener('change',e=>{const r=rooms[+e.target.value];if(r){elevPt=r.centroid.slice();dirty();}});
function sdim(a,b,label,color,side){ // screen-space dimension between points a and b
  ctx.strokeStyle=color||C.dim;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);ctx.stroke();
  for(const p of [a,b]){ctx.beginPath();ctx.moveTo(p[0]-3.5,p[1]+3.5);ctx.lineTo(p[0]+3.5,p[1]-3.5);ctx.lineWidth=1.3;ctx.stroke();}
  const L=Math.hypot(b[0]-a[0],b[1]-a[1]);if(L<22||!label)return;const vert=Math.abs(b[0]-a[0])<1;
  const m=[(a[0]+b[0])/2,(a[1]+b[1])/2];
  txt(label,vert?[m[0]+(side||1)*8,m[1]]:m,{rot:vert?-Math.PI/2:0,mono:true,size:10,color:color||C.dim,halo:C.paper,base:vert?(side===-1?'bottom':'top'):'middle'});}
function drawElev(){
  if(!isElevView())return;const box=$('#elevScroll');const W=box.clientWidth;if(!W)return;
  const keep=ctx;ctx=ectx;try{
  const r=elevRoom();const els=r?r.elevs:[];
  $('#elevSum').textContent=r?`${els.length} walls · ${TILEMODES[r.tileMode].toLowerCase()} · tile ${fmtArea(r.tileArea)} ${areaU()}`:'';
  const cols=W>760?2:1,pad=20,gap=30,colW=(W-pad*2-gap*(cols-1))/cols;
  const maxL=Math.max(1,...els.map(e=>e.L)),maxH=Math.max(1,...els.map(e=>e.H));
  const s=Math.max(0.02,Math.min((colW-60)/maxL,320/maxH));const cellH=maxH*s+96;
  const rows=Math.max(1,Math.ceil(els.length/cols));const Htot=Math.max(box.clientHeight,pad*2+rows*cellH+(rows-1)*gap);
  const dpr=window.devicePixelRatio||1;elevCv.style.height=Htot+'px';
  const cw=Math.round(W*dpr),ch=Math.round(Htot*dpr);if(elevCv.width!==cw)elevCv.width=cw;if(elevCv.height!==ch)elevCv.height=ch;
  ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle=C.paper;ctx.fillRect(0,0,W,Htot);
  if(!r){txt('Close a loop of walls to create a room, then its walls appear here.',[W/2,60],{color:C.muted,size:12.5});return;}
  els.forEach((e,k)=>{const ox=pad+(k%cols)*(colW+gap),top=pad+Math.floor(k/cols)*(cellH+gap);drawElevation(e,r,ox,top+30+maxH*s,s);});
  }finally{ctx=keep;}}
function drawElevation(e,r,ox,baseY,s){
  const X=x=>ox+x*s,Z=z=>baseY-z*s;
  txt(e.label,[ox,Z(e.H)-16],{align:'left',weight:'600',size:14});
  txt(fmtLen(e.L)+(e.curved?' curved, unrolled':'')+'  ·  h '+fmtLen(e.H)+(e.tileArea>0?'  ·  tile '+fmtArea(e.tileArea)+' '+areaU():''),[ox+18,Z(e.H)-16],{align:'left',mono:true,size:10.5,color:C.muted});
  ctx.fillStyle=C.fixture;ctx.fillRect(X(0),Z(e.H),e.L*s,e.H*s);
  // tile zones with a tile grid, measured from floor and from the left corner
  if(e.tiles.length){ctx.save();ctx.beginPath();e.tiles.forEach(t=>ctx.rect(X(t.x0),Z(t.z1),(t.x1-t.x0)*s,(t.z1-t.z0)*s));ctx.fillStyle=C.tile;ctx.fill();ctx.clip();
    const tw=r.tileMode==='splash'?150:300,th=r.tileMode==='splash'?75:300;ctx.strokeStyle=C['tile-line'];ctx.lineWidth=0.7;ctx.beginPath();
    if(tw*s>=4){for(let x=0;x<=e.L;x+=tw){ctx.moveTo(X(x),Z(0));ctx.lineTo(X(x),Z(e.H));}}if(th*s>=4){for(let z=0;z<=e.H;z+=th){ctx.moveTo(X(0),Z(z));ctx.lineTo(X(e.L),Z(z));}}ctx.stroke();ctx.restore();}
  // openings
  e.ops.forEach(({o,x0,x1})=>{const a=X(x0),b=X(x1),zt=Z(o.sill+o.h),zb=Z(o.sill);ctx.lineWidth=1;ctx.strokeStyle=C.ink;
    if(o.kind==='window'){ctx.fillStyle=C['accent-weak'];ctx.fillRect(a,zt,b-a,zb-zt);ctx.strokeRect(a,zt,b-a,zb-zt);const inset=Math.min(50*s,6);
      ctx.strokeRect(a+inset,zt+inset,b-a-2*inset,zb-zt-2*inset);if(o.w>=1000){ctx.beginPath();ctx.moveTo((a+b)/2,zt+inset);ctx.lineTo((a+b)/2,zb-inset);ctx.stroke();}}
    else if(isSliding(o)){ctx.fillStyle=C.paper;ctx.fillRect(a,zt,b-a,zb-zt);ctx.strokeRect(a,zt,b-a,zb-zt);ctx.beginPath();const ym=zt+(zb-zt)*0.45,al=Math.min((b-a)*0.18,40);
      const arrow=(x0,x1)=>{ctx.moveTo(x0,ym);ctx.lineTo(x1,ym);const dr=Math.sign(x1-x0);ctx.moveTo(x1-dr*6,ym-4);ctx.lineTo(x1,ym);ctx.lineTo(x1-dr*6,ym+4);};
      if(o.style==='slide2'){const m=(a+b)/2;ctx.moveTo(m,zt);ctx.lineTo(m,zb);arrow(m-8,m-8-al);arrow(m+8,m+8+al);}
      else{const toLeft=(o.hinge?1:-1)<0;const m=(a+b)/2;arrow(toLeft?m+al/2:m-al/2,toLeft?m-al/2:m+al/2);}ctx.stroke();}
    else{ctx.fillStyle=C.paper;ctx.fillRect(a,zt,b-a,zb-zt);ctx.strokeRect(a,zt,b-a,zb-zt);ctx.setLineDash([4,3]);ctx.beginPath();
      const hingeLeft=o.hinge===0;ctx.moveTo(hingeLeft?b:a,zt);ctx.lineTo(hingeLeft?a:b,(zt+zb)/2);ctx.lineTo(hingeLeft?b:a,zb);ctx.stroke();ctx.setLineDash([]);}});
  // fixtures, lower first
  [...e.its].sort((p,q)=>p.it.z-q.it.z).forEach(({it,x0})=>elevItem(it,x0,X,Z,s));
  // wall outline and floor
  ctx.strokeStyle=C.ink;ctx.lineWidth=1;ctx.strokeRect(X(0),Z(e.H),e.L*s,e.H*s);
  ctx.lineWidth=2.5;ctx.beginPath();ctx.moveTo(X(0)-10,Z(0));ctx.lineTo(X(e.L)+10,Z(0));ctx.stroke();
  // horizontal chain: corners, openings and fixture runs
  const bx=new Set([0,e.L]);e.ops.forEach(p=>{bx.add(Math.max(0,p.x0));bx.add(Math.min(e.L,p.x1));});
  const xs=[...bx].sort((a,b)=>a-b).filter((x,i,arr)=>i===0||x-arr[i-1]>5);
  if(xs.length>2)for(let i=0;i<xs.length-1;i++)sdim([X(xs[i]),baseY+18],[X(xs[i+1]),baseY+18],fmtLen(xs[i+1]-xs[i]));
  sdim([X(0),baseY+(xs.length>2?38:18)],[X(e.L),baseY+(xs.length>2?38:18)],fmtLen(e.L));
  // vertical chain on the right: heights a fitter needs
  const lv=new Set([0,e.H]);e.its.forEach(({it})=>{if(it.type!=='shower'){lv.add(it.z+it.h);if(it.z>0)lv.add(it.z);}});
  e.ops.forEach(({o})=>{if(o.kind==='window')lv.add(o.sill);lv.add(o.sill+o.h);});if(r.tileMode==='full')lv.add(Math.min(r.tileH,e.H));
  const zs=[...lv].filter(z=>z>=0&&z<=e.H).sort((a,b)=>a-b).filter((z,i,arr)=>i===0||z-arr[i-1]>15);
  for(let i=0;i<zs.length-1;i++)sdim([X(e.L)+18,Z(zs[i])],[X(e.L)+18,Z(zs[i+1])],fmtLen(zs[i+1]-zs[i]),null,1);}
function elevItem(it,x0,X,Z,s){
  const t=it.type,x1=x0+it.w,z0=it.z,z1=it.z+it.h;
  const box=(a,b,za,zb,fill)=>{ctx.fillStyle=fill||C.fixture;ctx.fillRect(X(a),Z(zb),(b-a)*s,(zb-za)*s);ctx.strokeRect(X(a),Z(zb),(b-a)*s,(zb-za)*s);};
  const line=(a,za,b,zb)=>{ctx.beginPath();ctx.moveTo(X(a),Z(za));ctx.lineTo(X(b),Z(zb));ctx.stroke();};
  ctx.strokeStyle=C['fixture-line'];ctx.lineWidth=1;
  if(COUNTER.has(t)||t==='vanity'){const kick=t==='vanity'?0:100,slab=t==='vanity'?30:40;
    if(kick)box(x0+0,x1,z0,z0+kick,C.line);box(x0,x1,z0+kick,z1-slab);box(x0-(t==='vanity'?0:10),x1+(t==='vanity'?0:10),z1-slab,z1,t==='vanity'?C.fixture:C.counter);
    if(t==='sinkbase'||(t==='vanity'&&it.w>=700))line((x0+x1)/2,z0+kick,(x0+x1)/2,z1-slab);
    if(t==='base')line(x0,z1-slab-160,x1,z1-slab-160);
    if(t==='dishwasher')line(x0,z1-slab-110,x1,z1-slab-110);
    if(t==='vanity'){ctx.beginPath();ctx.ellipse(X((x0+x1)/2),Z(z1)+1,it.w*0.22*s,8*s+2,0,0,Math.PI);ctx.stroke();}
    return;}
  if(t==='range'){box(x0,x1,z0,z1-30);box(x0,x1,z1-30,z1,C.counter);box(x0+60,x1-60,z0+150,z0+600,C['accent-weak']);line(x0+40,z0+700,x1-40,z0+700);return;}
  if(t==='fridge'){box(x0,x1,z0,z1);line(x0,z0+it.h*0.38,x1,z0+it.h*0.38);line(x1-60,z0+it.h*0.42,x1-60,z0+it.h*0.6);return;}
  if(t==='tall'){box(x0,x1,z0,z1);line(x0,z0+it.h*0.45,x1,z0+it.h*0.45);return;}
  if(t==='wallcab'){box(x0,x1,z0,z1);if(it.w>=700)line((x0+x1)/2,z0,(x0+x1)/2,z1);return;}
  if(t==='toilet'){const c=(x0+x1)/2;box(c-it.w*0.45,c+it.w*0.45,z0+400,z1);ctx.fillStyle=C.fixture;ctx.beginPath();
    ctx.moveTo(X(c-it.w*0.24),Z(z0));ctx.lineTo(X(c+it.w*0.24),Z(z0));ctx.lineTo(X(c+it.w*0.5),Z(z0+400));ctx.lineTo(X(c-it.w*0.5),Z(z0+400));ctx.closePath();ctx.fill();ctx.stroke();return;}
  if(t==='tub'){box(x0,x1,z0,z1);line(x0+40,z1-40,x1-40,z1-40);return;}
  if(t==='shower'){box(x0,x1,z0,z1);ctx.setLineDash([5,4]);ctx.strokeRect(X(x0),Z(2000),it.w*s,(2000-z1)*s);ctx.setLineDash([]);return;}
  box(x0,x1,z0,z1);}

/* ============================== tools & input ============================== */
const defaults={t:120,h:2700};
const HINTS={
  select:'Drag a wall to push or pull it (<kbd>M</kbd> or <b>Free move</b>: any direction), or an end to change its length. Box-select or <kbd>Ctrl</kbd>+click for several walls. <kbd>S</kbd> snap on/off, arrows nudge, <kbd>Del</kbd> deletes. Middle-drag or <kbd>Space</kbd>+drag pans.',
  arcwall:'Click the start, then the end, then move out to set how far it bends and click (or type a radius and press <kbd>Enter</kbd>). Snaps to wall ends and a half circle; <kbd>Shift</kbd> bends freely. <kbd>Esc</kbd> cancels.',
  wall:'Click to start a wall. Type a length and press <kbd>Enter</kbd> for an exact wall. Angles snap to 15° (hold <kbd>Shift</kbd> to free). <kbd>Esc</kbd> ends the run.',
  door:'Click on a wall to place a door. Dimensions show distance to each wall face.',
  window:'Click on a wall to place a window. Dimensions show distance to each wall face.',
  column:'Set the size and angle in the side panel, then click to place. It drags freely and clicks against a wall face, the far face or the wall centre; live dimensions show the distances. <kbd>R</kbd> turns it 90°.',
  paste:'Move to where the copy goes (it is held by its top-left corner) and click to place it. Copied walls join existing wall ends when they meet. <kbd>Esc</kbd> cancels.',
  text:'Click where the text goes, type, and press <kbd>Enter</kbd> (<kbd>Shift+Enter</kbd> for a new line). Click an existing text to change it. Move or delete text with the Pointer.',
  erase:'Drag over lines in the imported picture or drawing to rub them out. Walls, doors and windows are never touched. <kbd>Ctrl+Z</kbd> undoes the last stroke.',
  area:'Click the corners of any shape; click the first corner, double-click or press <kbd>Enter</kbd> to close. Double-click inside a room to take its outline, curved walls included. <kbd>Backspace</kbd> removes the last corner, <kbd>Esc</kbd> cancels.',
  ruler:'Click two points, or drag, to measure. Snaps to wall corners, fixture corners and wall faces (square to the first point); hold <kbd>Shift</kbd> for any angle. <kbd>Enter</kbd> keeps it as a dimension, <kbd>Esc</kbd> clears.',
  place:'Move near a wall: the fixture backs onto it and snaps to corners and neighbours. Click to place, <kbd>R</kbd> to rotate, <kbd>Esc</kbd> to stop.'};

/* ============================== curved walls ============================== */
// An arc is kept as its two ends, a bulge (signed sagitta: distance from the chord's middle to the curve) and a number of
// pieces. The pieces are ordinary straight walls tagged with arcId, so rooms, areas, 3D, takeoff and DXF all work unchanged.
const arcById=id=>(M.arcs||[]).find(q=>q.id===id);
const arcSegs=q=>M.walls.filter(w=>w.arcId===q.id).sort((x,y)=>x.arcIdx-y.arcIdx);
function arcGeom(a,b,s){const c=dist(a,b);if(c<1||Math.abs(s)<0.5)return null;const d=norm(sub(b,a)),n=perp(d),m=mul(add(a,b),.5);
  const r=(c*c/4+s*s)/(2*Math.abs(s));const C=add(m,mul(n,s-Math.sign(s)*r));const sweep=Math.abs(4*Math.atan(2*s/c));
  return {c,d,n,m,r,C,sweep,apex:add(m,mul(n,s)),len:sweep*r};}
function arcPts(a,b,s,n){const g=arcGeom(a,b,s);const out=[];
  if(!g){for(let i=0;i<=n;i++)out.push(add(a,mul(sub(b,a),i/n)));return out;}
  const v=sub(a,g.C),deg=g.sweep*180/Math.PI;let sg=1;if(dist(add(g.C,rotV(v,deg/2)),g.apex)>Math.max(1,g.r*1e-6))sg=-1;
  for(let i=0;i<=n;i++)out.push(add(g.C,rotV(v,sg*deg*i/n)));out[0]=a.slice();out[n]=b.slice();return out;}
function autoSegs(a,b,s){const g=arcGeom(a,b,s);if(!g)return 1;return clamp(Math.ceil(g.sweep*180/Math.PI/6),2,72);}
function regenArc(q){let segs=arcSegs(q);const pts=arcPts(q.a,q.b,q.s,q.n);
  if(segs.length!==q.n){ // rebuild the pieces; doors and windows move to the piece nearest where they were
    const ops=M.openings.filter(o=>segs.some(w=>w.id===o.wall)).map(o=>{const w=wallById(o.wall);return [o,add(w.a,mul(wallDir(w),o.s))];});
    const ids=new Set(segs.map(w=>w.id));M.walls=M.walls.filter(w=>!ids.has(w.id));segs=[];
    for(let i=0;i<q.n;i++){const w={id:nid('w'),a:pts[i],b:pts[i+1],t:q.t,h:q.h,arcId:q.id,arcIdx:i};M.walls.push(w);segs.push(w);}
    ops.forEach(([o,c])=>{let best=null,bd=1e18;segs.forEach(w=>{const d=dist(c,segClosest(c,w.a,w.b).q);if(d<bd){bd=d;best=w;}});o.wall=best.id;o.s=dot(sub(c,best.a),wallDir(best));});}
  else segs.forEach((w,i)=>{w.a=pts[i].slice();w.b=pts[i+1].slice();w.t=q.t;w.h=q.h;});}
// Keep every arc consistent with its pieces: ends that were moved (by a joined wall, a group move…) carry the curve with them.
function syncArcs(){if(!Array.isArray(M.arcs))M.arcs=[];
  M.arcs=M.arcs.filter(q=>{const segs=arcSegs(q);
    if(!segs.length)return false;
    if(segs.length!==q.n){segs.forEach(w=>{delete w.arcId;delete w.arcIdx;});return false;}
    const A=segs[0].a,B=segs[segs.length-1].b;if(dist(A,q.a)>0.01||dist(B,q.b)>0.01){q.a=A.slice();q.b=B.slice();}
    regenArc(q);return true;});}
function arcOutline(q){const g=arcGeom(q.a,q.b,q.s),pts=arcPts(q.a,q.b,q.s,Math.max(q.n*3,24)),h=q.t/2;
  if(!g){const n=perp(norm(sub(q.b,q.a)));return [add(q.a,mul(n,h)),add(q.b,mul(n,h)),add(q.b,mul(n,-h)),add(q.a,mul(n,-h))];}
  const out=pts.map(P=>add(g.C,mul(sub(P,g.C),(g.r+h)/g.r))),inn=pts.map(P=>add(g.C,mul(sub(P,g.C),(g.r-h)/g.r))).reverse();return out.concat(inn);}
function drawArcSel(q,selected){const poly=arcOutline(q).map(toS);ctx.save();ctx.strokeStyle=C.accent;ctx.lineWidth=selected?2:1.2;if(!selected)ctx.setLineDash([5,3]);
  ctx.beginPath();poly.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.closePath();ctx.stroke();ctx.setLineDash([]);
  if(selected&&!(drag&&drag.moved&&drag.kind==='arc')){const g=arcGeom(q.a,q.b,q.s),hs=ptrTouch?14:9;
    [q.a,q.b].forEach((P,k)=>{const sp=toS(P);const hot=hover&&hover.kind==='arcend'&&hover.end===(k?'b':'a');ctx.fillStyle=hot?C.accent:C.paper;ctx.lineWidth=1.5;ctx.beginPath();ctx.rect(sp[0]-hs/2,sp[1]-hs/2,hs,hs);ctx.fill();ctx.stroke();});
    const ap=toS(g?g.apex:mul(add(q.a,q.b),.5)),hot=hover&&hover.kind==='arcmid'||drag&&drag.kind==='arcmid';
    ctx.fillStyle=hot?C.accent:C.paper;ctx.beginPath();ctx.arc(ap[0],ap[1],hs/2+1.5,0,Math.PI*2);ctx.fill();ctx.stroke();
    if(g){const out=norm(sub(g.apex,g.C)),lp=toS(add(g.apex,mul(out,q.t/2+Math.max(120,16/view.s))));
      if(MEAS.edit)txt('R '+fmtLen(g.r)+'  ·  '+fmtLen(g.len),lp,{mono:true,size:11,weight:'500',color:C.accent,halo:C.paper});}}
  ctx.restore();}
function arcPanel(q){const g=arcGeom(q.a,q.b,q.s);
  return `<div class="selname">Curved wall <span class="selbtns"><button class="btn" id="copyBtn" title="Copy (Ctrl+C)">Copy</button><button class="btn" id="delBtn">Delete</button></span></div><div class="kv">
    ${field('Radius','qR',g?fmtLen(g.r):'')}${field('Bulge','qS',fmtLen(Math.abs(q.s)))}
    <label>Sweep</label><span class="ro">${g?(Math.round(g.sweep*1800/Math.PI)/10)+'°':'0°'}</span>
    <label>Length</label><span class="ro">${fmtLen(g?g.len:dist(q.a,q.b),true)}</span>
    <label>Chord</label><span class="ro">${fmtLen(dist(q.a,q.b),true)}</span>
    ${field('Thickness','qT',fmtLen(q.t))}${field('Height','qH',fmtLen(q.h))}${field('Pieces','qN',String(q.n),'text')}</div>
    <div class="rowbtns"><button class="btn" id="qFlip">Flip curve</button><button class="btn" id="qStraight">Make straight</button></div>
    <p class="tip">Drag the curve to move it, an end square to move that end, or the round handle to change how far it bends. Radius keeps the ends where they are. Length is along the centre of the wall. A door or window sits on one piece, so use fewer pieces for a wide opening.</p>`;}
function bindArc(q){const on=(id,fn)=>{const e=document.getElementById(id);if(e)e.onchange=()=>fn(e.value);};
  const edit=fn=>{mutate(()=>{fn(q);regenArc(q);});renderInspector();};
  on('qR',v=>{const r=parseLen(v),c=dist(q.a,q.b);if(!(r>0))return renderInspector();if(r<c/2-0.5){toast('The radius must be at least half the distance between the ends ('+fmtLen(c/2,true)+').');return renderInspector();}
    edit(o=>{const sg=Math.sign(o.s)||1;o.s=sg*(r-Math.sqrt(Math.max(0,r*r-c*c/4)));if(o.auto!==false)o.n=autoSegs(o.a,o.b,o.s);});});
  on('qS',v=>{const x=parseLen(v);if(!(x>0))return renderInspector();edit(o=>{o.s=(Math.sign(o.s)||1)*x;if(o.auto!==false)o.n=autoSegs(o.a,o.b,o.s);});});
  on('qT',v=>{const x=parseLen(v);if(x>=20)edit(o=>{o.t=x;});else renderInspector();});
  on('qH',v=>{const x=parseLen(v);if(x>=300)edit(o=>{o.h=x;});else renderInspector();});
  on('qN',v=>{const x=Math.round(+v);if(x>=1&&x<=96)edit(o=>{o.n=x;o.auto=false;});else renderInspector();});
  $('#qFlip').onclick=()=>edit(o=>{o.s=-o.s;});
  $('#qStraight').onclick=()=>{mutate(()=>{const segs=arcSegs(q),w={id:nid('w'),a:q.a.slice(),b:q.b.slice(),t:q.t,h:q.h};
      const ops=M.openings.filter(o=>segs.some(x=>x.id===o.wall));ops.forEach(o=>{const x=wallById(o.wall);const c=add(x.a,mul(wallDir(x),o.s));o.wall=w.id;o.s=dot(sub(c,w.a),wallDir(w));});
      const ids=new Set(segs.map(x=>x.id));M.walls=M.walls.filter(x=>!ids.has(x.id));M.walls.push(w);M.arcs=M.arcs.filter(x=>x!==q);sel={kind:'wall',id:w.id};});renderInspector();};
  $('#delBtn').onclick=deleteSel;$('#copyBtn').onclick=()=>copySel();}
// drawing tool: start, end, then how far it bends (or type a radius)
let arcDraw={a:null,b:null,s:0};
function arcToolMove(p){
  if(!arcDraw.a||!arcDraw.b){snapInfo=snapPoint(p,arcDraw.a);$('#snapchip').textContent=snapInfo.kind==='free'?'':snapInfo.kind;return;}
  const d=norm(sub(arcDraw.b,arcDraw.a)),n=perp(d),m=mul(add(arcDraw.a,arcDraw.b),.5);let sg=dot(sub(p,m),n);
  if(snapOn&&!shiftDown){const c=dist(arcDraw.a,arcDraw.b);if(Math.abs(Math.abs(sg)-c/2)<10/view.s){sg=Math.sign(sg)*c/2;$('#snapchip').textContent='half circle';}else{sg=Math.round(sg/lenStep())*lenStep();$('#snapchip').textContent='';}}
  arcDraw.s=sg;}
function arcToolClick(p){
  if(!arcDraw.a){arcDraw.a=snapPoint(p,null).p;return;}
  if(!arcDraw.b){const q=snapPoint(p,arcDraw.a).p;if(dist(q,arcDraw.a)>100){arcDraw.b=q;arcDraw.s=0;}return;}
  makeArc(arcDraw.s);}
function makeArc(s){if(Math.abs(s)<1){toast('Move away from the straight line to bend the wall, or use the Wall tool for a straight one.');return;}
  const q={id:nid('q'),a:arcDraw.a.slice(),b:arcDraw.b.slice(),s:Math.round(s*10)/10,t:defaults.t,h:defaults.h,auto:true};q.n=autoSegs(q.a,q.b,q.s);
  mutate(()=>{M.arcs.push(q);regenArc(q);});arcDraw={a:null,b:null,s:0};hideLenbox();dirty();
  toast('Curved wall added. Select it with the Pointer to change its radius, bend or ends.');}
function drawArcTool(){drawSnapMark(snapInfo);const A=arcDraw.a;if(!A)return;
  if(!arcDraw.b){const B=snapInfo?snapInfo.p:cursor;const sa=toS(A),sb=toS(B);ctx.save();ctx.strokeStyle=C.accent;ctx.setLineDash([5,4]);ctx.lineWidth=1.2;ctx.beginPath();ctx.moveTo(sa[0],sa[1]);ctx.lineTo(sb[0],sb[1]);ctx.stroke();ctx.restore();
    if(dist(A,B)>1)dimLine(A,B,perp(norm(sub(B,A))),Math.max(300,30/view.s),fmtLen(dist(A,B)),C.accent);return;}
  const q={a:A,b:arcDraw.b,s:arcDraw.s,t:defaults.t,n:24};const poly=arcOutline(q).map(toS);
  ctx.save();ctx.fillStyle=C['accent-weak'];ctx.strokeStyle=C.accent;ctx.lineWidth=1.3;ctx.beginPath();poly.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.closePath();ctx.fill();ctx.stroke();
  const g=arcGeom(q.a,q.b,q.s);if(g){const cs=toS(g.C),ap=toS(g.apex);ctx.setLineDash([3,4]);ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(cs[0],cs[1]);ctx.lineTo(ap[0],ap[1]);ctx.stroke();ctx.setLineDash([]);
    ctx.fillStyle=C.accent;ctx.beginPath();ctx.arc(cs[0],cs[1],3,0,Math.PI*2);ctx.fill();
    txt('R '+fmtLen(g.r,true)+'  ·  length '+fmtLen(g.len,true)+'  ·  '+(Math.round(g.sweep*1800/Math.PI)/10)+'°',add(ap,[0,-16]),{mono:true,size:11.5,weight:'500',color:C.accent,halo:C.paper});}
  ctx.restore();}


/* ============================== measured areas ============================== */
// An area is a closed outline of corners; each edge can be straight or bent into an arc (b[i] = how far edge i bulges,
// signed like a curved wall). Area and perimeter are exact for both.
const areaById=id=>(M.areas||[]).find(a=>a.id===id);
function areaEdge(A,i){const n=A.pts.length;return [A.pts[i],A.pts[(i+1)%n],(A.b&&A.b[i])||0];}
function areaOutline(A,fine){const out=[];for(let i=0;i<A.pts.length;i++){const [p,q,s]=areaEdge(A,i);
  if(Math.abs(s)<0.5){out.push(p);continue;}const g=arcGeom(p,q,s);const k=fine?Math.max(8,Math.ceil(g.sweep*180/Math.PI/2)):Math.max(6,Math.ceil(g.sweep*180/Math.PI/5));
  const P=arcPts(p,q,s,k);P.pop();out.push(...P);}return out;}
function polyAreaAbs(P){let s=0;for(let i=0;i<P.length;i++){const a=P[i],b=P[(i+1)%P.length];s+=a[0]*b[1]-b[0]*a[1];}return Math.abs(s)/2;}
function areaStats(A){let per=0,curved=0;for(let i=0;i<A.pts.length;i++){const [p,q,s]=areaEdge(A,i);const g=Math.abs(s)>=0.5?arcGeom(p,q,s):null;per+=g?g.len:dist(p,q);if(g)curved++;}
  // exact: straight-edged polygon plus or minus each circular segment
  let base=0;const n=A.pts.length;for(let i=0;i<n;i++){const a=A.pts[i],b=A.pts[(i+1)%n];base+=a[0]*b[1]-b[0]*a[1];}const sign=Math.sign(base)||1;let area=Math.abs(base)/2;
  for(let i=0;i<n;i++){const [p,q,s]=areaEdge(A,i);if(Math.abs(s)<0.5)continue;const g=arcGeom(p,q,s);const seg=g.r*g.r/2*(g.sweep-Math.sin(g.sweep));
    // a bulge towards the outside adds, towards the inside takes away; with y down and this winding, outside is -sign·perp(d)
    const out=-sign*Math.sign(s);area+=out>0?seg:-seg;}
  return {area:Math.abs(area),per,curved};}
function areaCentroid(A){const P=areaOutline(A,true);let a=0,cx=0,cy=0;for(let i=0;i<P.length;i++){const p=P[i],q=P[(i+1)%P.length],c=p[0]*q[1]-q[0]*p[1];a+=c;cx+=(p[0]+q[0])*c;cy+=(p[1]+q[1])*c;}
  if(Math.abs(a)<1e-6)return P[0]||[0,0];let c=[cx/(3*a),cy/(3*a)];if(!pointInPoly(c,P)){const m=P.reduce((s,p)=>add(s,p),[0,0]);c=mul(m,1/P.length);}return c;}
const areaMid=(A,i)=>{const [p,q,s]=areaEdge(A,i);const g=Math.abs(s)>=0.5?arcGeom(p,q,s):null;return g?g.apex:mul(add(p,q),.5);};
// the label sits at the middle of the shape, moved down when a room label is already there
function areaLabelPos(A){const c=toS(areaCentroid(A));if(rooms.some(r=>{const q=toS(r.centroid);return Math.abs(q[0]-c[0])<70&&Math.abs(q[1]-c[1])<30;}))return [c[0],c[1]+36];return c;}
function areaLabelText(A){const st=areaStats(A);return [A.name||'Area',fmtArea(st.area)+' '+areaU()];}
function drawAreas(){(M.areas||[]).forEach(A=>{if(A.pts.length<3||!areaShown(A))return;const AC=A.surf&&SURF[A.surf]?SURF[A.surf].line:isZone(A)?C.muted:C.snap;const on=sel&&sel.kind==='area'&&sel.id===A.id,hov=hover&&hover.kind==='area'&&hover.id===A.id;
    const P=areaOutline(A).map(toS);ctx.save();ctx.beginPath();P.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.closePath();
    ctx.globalAlpha=(on?0.2:0.11)*(document.documentElement.dataset.theme==='dark'||matchMedia('(prefers-color-scheme: dark)').matches&&document.documentElement.dataset.theme!=='light'?0.6:1);ctx.fillStyle=AC;if(!A.surf&&!isZone(A))ctx.fill();ctx.globalAlpha=1;ctx.strokeStyle=AC;ctx.lineWidth=on||hov?2:1.4;if(!on)ctx.setLineDash([7,4]);ctx.stroke();ctx.setLineDash([]);
    const c=areaLabelPos(A),[t1,t2]=areaLabelText(A);if(MEAS.areas||on){txt(t1,[c[0],c[1]-8],{size:12,weight:'600',color:A.surf||isZone(A)?C.ink:AC,halo:C.paper});}if(MEAS.areas||on)txt(t2,[c[0],c[1]+8],{mono:true,size:11.5,weight:'500',color:A.surf?C.ink:AC,halo:C.paper});
    if(on){const hs=ptrTouch?14:9;
      if(MEAS.areas)for(let i=0;i<A.pts.length;i++){const [p,q,s]=areaEdge(A,i);const L=Math.abs(s)>=0.5?arcGeom(p,q,s).len:dist(p,q);const m=areaMid(A,i);
        const nOut=norm(sub(m,areaCentroid(A)));txt(fmtLen(L),toS(add(m,mul(nOut,18/view.s+120))),{mono:true,size:10.5,color:AC,halo:C.paper});}
      ctx.strokeStyle=AC;ctx.lineWidth=1.5;
      A.pts.forEach((p,i)=>{const q=toS(p),hot=hover&&hover.kind==='areapt'&&hover.idx===i;ctx.fillStyle=hot?AC:C.paper;ctx.beginPath();ctx.rect(q[0]-hs/2,q[1]-hs/2,hs,hs);ctx.fill();ctx.stroke();});
      for(let i=0;i<A.pts.length;i++){const q=toS(areaMid(A,i)),hot=hover&&hover.kind==='areamid'&&hover.idx===i;ctx.fillStyle=hot?AC:C.paper;ctx.beginPath();ctx.arc(q[0],q[1],hs/2,0,Math.PI*2);ctx.fill();ctx.stroke();}}
    ctx.restore();});}
function areaLabelHit(p,id){const A=areaById(id);if(!A)return false;const c=areaLabelPos(A),sp=toS(p);return Math.abs(sp[0]-c[0])<45&&Math.abs(sp[1]-c[1])<16;}
function hitArea(p){const tol=(ptrTouch?14:8)/view.s;
  if(sel&&sel.kind==='area'&&tool==='select'){const A=areaById(sel.id);if(A){const ht=(ptrTouch?14:9)/view.s;
    for(let i=0;i<A.pts.length;i++)if(dist(p,A.pts[i])<ht)return {kind:'areapt',id:A.id,idx:i};
    for(let i=0;i<A.pts.length;i++)if(dist(p,areaMid(A,i))<ht)return {kind:'areamid',id:A.id,idx:i};}}
  for(const A of (M.areas||[])){if(A.pts.length<3||!areaShown(A))continue;const P=areaOutline(A);
    for(let i=0;i<P.length;i++){const c=segClosest(p,P[i],P[(i+1)%P.length]);if(dist(p,c.q)<tol)return {kind:'area',id:A.id};}
    const c=areaLabelPos(A),sp=toS(p);if(Math.abs(sp[0]-c[0])<45&&Math.abs(sp[1]-c[1])<16)return {kind:'area',id:A.id};}
  return null;}
// bend: how far the edge's middle is from the straight line; snaps to straight and to a half circle
function bendFor(p0,p1,P){const d=norm(sub(p1,p0)),n=perp(d),m=mul(add(p0,p1),.5),c=dist(p0,p1);let s=dot(sub(P,m),n);
  if(snapOn&&!shiftDown){if(Math.abs(s)<10/view.s)s=0;else if(Math.abs(Math.abs(s)-c/2)<10/view.s)s=Math.sign(s)*c/2;else s=Math.round(s/lenStep())*lenStep();}return s;}
function areaPanel(A){const st=areaStats(A);
  const rows=A.pts.map((p,i)=>{const [a,b,s]=areaEdge(A,i);const g=Math.abs(s)>=0.5?arcGeom(a,b,s):null;
    return `<tr><td>${i+1}</td><td>${fmtLen(g?g.len:dist(a,b),true)}</td><td><input data-bend="${i}" value="${g?(outwardBend(A,i,1)*s<0?'-':'')+fmtLen(Math.abs(s)):''}" placeholder="–" aria-label="Bend of edge ${i+1}"></td><td>${g?fmtLen(g.r,true):''}</td></tr>`;}).join('');
  return `<div class="selname">Area <span class="selbtns"><button class="btn" id="copyBtn" title="Copy (Ctrl+C)">Copy</button><button class="btn" id="delBtn">Delete</button></span></div><div class="kv">
    ${field('Name','arName',A.name||'','text')}<label for="arSurf">Kind</label><select id="arSurf">${kindOptions(areaKindOf(A))}</select>
    ${isZone(A)?selectField('Tiling','arTile',{none:TILEMODES.none,full:TILEMODES.full},zoneTile(A))+(zoneTile(A)==='full'?field('Tile height','arTileH',fmtLen(A.tileH||2100)):''):''}<label>Area</label><span class="ro big">${fmtArea(st.area)} ${areaU()}</span>
    <label>Perimeter</label><span class="ro">${fmtLen(st.per,true)}</span>${isZone(A)?(z=>`<label>Wall surface</label><span class="ro">${fmtArea(z.wall)} ${areaU()}</span><label>Wall tile</label><span class="ro">${fmtArea(z.tile)} ${areaU()}</span><label>Skirting</label><span class="ro">${fmtRun(z.skirt)} ${runU()}</span>`)(zoneStats(A)):''}<label>Corners</label><span class="ro">${A.pts.length}${st.curved?' · '+st.curved+' curved edge'+(st.curved>1?'s':''):''}</span></div>
    <div class="laytable areaedges"><table><thead><tr><th>Edge</th><th>Length</th><th>Bend</th><th>Radius</th></tr></thead><tbody>${rows}</tbody></table></div>
    <div class="rowbtns"><button class="btn" id="arHide">${A.hidden?'Show on plan':'Hide on plan'}</button>${st.curved?'<button class="btn" id="arStraight">Make all edges straight</button>':''}<button class="btn" id="arFlip">Flip curves</button></div>
    ${A.hidden?'<p class="tip"><b>Hidden.</b> It stays in the takeoff; select it again from its row there.</p>':''}
    <p class="tip">Drag a corner to move it, or the round handle on an edge to bend it into a curve (it snaps to straight and to a half circle; <kbd>Shift</kbd> bends freely). Type a bend to set it exactly; it bends outwards, a minus value bends it in. Double-click an edge to add a corner, double-click a corner to remove it.</p>`;}
function bindArea(A){{const hb=$('#arHide');if(hb)hb.onclick=()=>{mutate(()=>{if(A.hidden)delete A.hidden;else A.hidden=true;});if(A.hidden){sel=null;toast((A.name||'Area')+' hidden. It is still in the takeoff; click its row there to show it again.');}renderInspector();dirty();};}
  {const t=$('#arTile');if(t)t.onchange=()=>{mutate(()=>{A.tile=t.value;});renderInspector();};const th=$('#arTileH');if(th)th.onchange=()=>{const v=parseLen(th.value);if(v>=100)mutate(()=>{A.tileH=v;});renderInspector();};}
  const sf=$('#arSurf');if(sf)sf.onchange=()=>{mutate(()=>{setAreaKind(A,sf.value);const def=new RegExp('^('+['Area',...Object.values(SURF).map(v=>v.label),...Object.values(ROOMTYPES)].map(x=>x.replace(/[/]/g,'\\/')).join('|')+') \\d+$');if(def.test(A.name||''))A.name=kindLabel(areaKindOf(A))+' '+((A.name.match(/\d+$/)||['1'])[0]);});renderInspector();};const nm=$('#arName');if(nm)nm.onchange=()=>{mutate(()=>{A.name=nm.value.trim()||A.name;});renderInspector();};
  document.querySelectorAll('[data-bend]').forEach(inp=>inp.onchange=()=>{const i=+inp.dataset.bend,v=inp.value.trim();let x=v===''?0:parseLen(v.replace(/^-/,''));if(!(x>=0)){renderInspector();return;}
    if(/^-/.test(v))x=-x;const [p,q]=areaEdge(A,i);if(Math.abs(x)>dist(p,q)*2){toast('That bend is more than the edge is long.');renderInspector();return;}
    mutate(()=>{if(!A.b)A.b=A.pts.map(()=>0);A.b[i]=outwardBend(A,i,x);});renderInspector();});
  const s=$('#arStraight');if(s)s.onclick=()=>{mutate(()=>{A.b=A.pts.map(()=>0);});renderInspector();};
  const f=$('#arFlip');if(f)f.onclick=()=>{mutate(()=>{A.b=(A.b||[]).map(v=>-v);});renderInspector();};
  $('#delBtn').onclick=deleteSel;$('#copyBtn').onclick=()=>copySel();}
// typed bends are outward-positive: turn that into the stored sign for this edge
function outwardBend(A,i,x){let base=0;const n=A.pts.length;for(let k=0;k<n;k++){const a=A.pts[k],b=A.pts[(k+1)%n];base+=a[0]*b[1]-b[0]*a[1];}return -Math.sign(base||1)*x;}
// the Area tool: click corners, close on the first one (or double-click / Enter); double-click inside a room to take its outline
let areaDraw={pts:[],cur:null,snap:null};
function areaToolMove(p){const A=areaDraw;const from=A.pts.length?A.pts[A.pts.length-1]:null;let sn=measureSnap(p,from);
  const tol=(ptrTouch?16:10)/view.s;if(A.pts.length>=3&&dist(p,A.pts[0])<tol)sn={p:A.pts[0].slice(),kind:'close'};
  else if(snapOn)for(const B of (M.areas||[]))for(const q of B.pts)if(dist(p,q)<tol){sn={p:q.slice(),kind:'area corner'};break;}
  A.cur=sn.p;A.snap=sn;snapInfo=sn;$('#snapchip').textContent=sn.kind==='free'?'':sn.kind==='close'?'click to close':sn.kind;}
function areaToolClick(p){areaToolMove(p);const A=areaDraw;if(A.snap&&A.snap.kind==='close'){finishArea();return;}
  if(A.pts.length&&dist(A.cur,A.pts[A.pts.length-1])<1)return;A.pts.push(A.cur.slice());renderInspector();dirty();}
function finishArea(pts,name){const P=pts||areaDraw.pts;if(P.length<3){toast('An area needs at least 3 corners.');return;}
  const kd=placeType&&(SURF[placeType]||String(placeType).startsWith('room:'))?placeType:'none';const n=(M.areas||[]).filter(a=>areaKindOf(a)===kd).length+1;const A={id:nid('g'),name:name||kindLabel(kd)+' '+n,pts:P.map(p=>p.map(v=>Math.round(v*10)/10)),b:P.map(()=>0)};setAreaKind(A,kd);
  mutate(()=>{M.areas.push(A);});areaDraw={pts:[],cur:null,snap:null};$('#snapchip').textContent='';sel={kind:'area',id:A.id};setTool('select');sel={kind:'area',id:A.id};renderInspector();dirty();
  const st=areaStats(A);toast(A.name+': '+fmtArea(st.area)+' '+areaU()+'. Drag its corners, or the round handles to curve an edge.');}
// a room's floor outline as an area; runs of curved-wall pieces become one curved edge
function areaFromRoom(r){const net=r.net,n=net.length;if(n<3)return null;
  const arcOfEdge=i=>{const h=r.loop&&r.loop[i];return h&&h.e&&h.e.w&&h.e.w.arcId||null;};
  const keep=[];for(let i=0;i<n;i++){const ip=(i-1+n)%n,a=net[ip],p=net[i],c=net[(i+1)%n];
    if(arcOfEdge(i)&&arcOfEdge(i)===arcOfEdge(ip))continue; // inside one curved wall
    const d1=norm(sub(p,a)),d2=norm(sub(c,p));if(!arcOfEdge(i)&&!arcOfEdge(ip)&&Math.abs(cross(d1,d2))<1e-4&&dot(d1,d2)>0)continue; // straight on
    keep.push(i);}
  if(keep.length<2)return {pts:net.map(p=>p.slice()),b:net.map(()=>0)};
  const pts=[],b=[];
  keep.forEach((i,k)=>{const j=keep[(k+1)%keep.length];pts.push(net[i].slice());
    if(arcOfEdge(i)){const cnt=((j-i)+n)%n||n;const mid=net[(i+Math.max(1,Math.floor(cnt/2)))%n];b.push(cnt>1?circleBulge(net[i],net[j],mid):0);}else b.push(0);});
  return pts.length>=3?{pts,b}:{pts:net.map(p=>p.slice()),b:net.map(()=>0)};}
function circleBulge(a,c,m){const d=norm(sub(c,a)),n=perp(d),mm=mul(add(a,c),.5),h=dot(sub(m,mm),n),x=dot(sub(m,mm),d),half=dist(a,c)/2;
  if(Math.abs(h)<1e-6)return 0;const t=(x*x+h*h-half*half)/(2*h),r=Math.sqrt(half*half+t*t);return t+Math.sign(h)*r;} // circle through a, m and c; the bulge on m's side
function drawAreaTool(){const A=areaDraw;drawSnapMark(snapInfo&&snapInfo.kind!=='free'?snapInfo:null);if(!A.pts.length)return;
  const P=A.pts.concat(A.cur&&!(A.snap&&A.snap.kind==='close')?[A.cur]:[]);const S=P.map(toS);
  ctx.save();ctx.strokeStyle=C.snap;ctx.fillStyle=C.snap;ctx.lineWidth=1.6;ctx.beginPath();S.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));
  if(P.length>=3){ctx.closePath();ctx.globalAlpha=0.15;ctx.fill();ctx.globalAlpha=1;}ctx.stroke();
  S.forEach((p,i)=>{ctx.beginPath();ctx.arc(p[0],p[1],i===0&&P.length>=3?6:3.5,0,Math.PI*2);ctx.fillStyle=i===0?C.paper:C.snap;ctx.fill();ctx.stroke();});
  for(let i=0;i+1<P.length;i++){const m=mul(add(P[i],P[i+1]),.5);txt(fmtLen(dist(P[i],P[i+1])),toS(m),{mono:true,size:10.5,color:C.snap,halo:C.paper});}
  if(P.length>=3){const st=areaStats({pts:P,b:[]});const c=toS(mul(P.reduce((s,p)=>add(s,p),[0,0]),1/P.length));
    txt(fmtArea(st.area)+' '+areaU(),c,{mono:true,size:13,weight:'600',color:C.snap,halo:C.paper});}
  ctx.restore();}
function areaToolPanel(){const A=areaDraw;const st=A.pts.length>=3?areaStats({pts:A.pts,b:[]}):null;const n=(M.areas||[]).length;
  return `<p class="h">${placeType?kindLabel(placeType):'Area'}</p><div class="kv"><label for="adSurf">Kind</label><select id="adSurf">${kindOptions(placeType||'none')}</select></div><p class="tip">${!A.pts.length?'Click the corners of the shape, one after another. Click the first corner again, double-click, or press <kbd>Enter</kbd> to close it.<br><br>Or <b>double-click inside a room</b> to take its outline, curved walls included.':
    'Corner '+(A.pts.length+1)+'. '+(A.pts.length>=3?'Click the first corner, double-click or press <kbd>Enter</kbd> to close.':'Keep clicking corners.')+' <kbd>Backspace</kbd> removes the last corner, <kbd>Esc</kbd> cancels.'}</p>
    ${st?`<div class="kv"><label>Area so far</label><span class="ro big">${fmtArea(st.area)} ${areaU()}</span></div>`:''}
    ${n?`<p class="tip">${n} measured area${n>1?'s':''} on the plan, listed under Takeoff.</p>`:''}`;}
function bindAreaTool(){const s=$('#adSurf');if(s)s.onchange=()=>{placeType=s.value==='none'?null:s.value;syncToolButtons();renderInspector();};}
function areasTakeoffRows(){const L=M.areas||[];if(!L.length)return '';let tot=0;
  let h=`<tr class="sub"><td colspan="5">Areas and yard</td></tr>`;L.forEach(A=>{if(isZone(A)){const z=zoneStats(A);tot+=z.floor;h+=`<tr data-area="${A.id}"><td><span class="swatch" style="background:var(--room-${A.type})"></span>${esc(A.name||'Area')}${A.hidden?' <span class="hid">hidden</span>':''}</td><td>${fmtArea(z.floor)}</td><td>${fmtArea(z.wall)}</td><td>${fmtArea(z.tile)}</td><td>${fmtRun(z.skirt)}</td></tr>`;return;}
    const st=areaStats(A);tot+=st.area;h+=`<tr data-area="${A.id}"><td><span class="swatch" style="background:${A.surf&&SURF[A.surf]?SURF[A.surf].col:'var(--snap)'}"></span>${esc(A.name||'Area')}${A.hidden?' <span class="hid">hidden</span>':''}</td><td>${fmtArea(st.area)}</td><td></td><td></td><td>${fmtRun(st.per)}</td></tr>`;});
  if(L.length>1)h+=`<tr class="total"><td>Total areas</td><td>${fmtArea(tot)}</td><td></td><td></td><td></td></tr>`;return h;}


/* ============================== eraser for the reference ============================== */
// Rubs out parts of the imported picture or reference drawing under the plan (dimension lines, furniture, text…).
// It never touches walls, doors, windows or anything else you drew.
let eraseSize=28,eraseOn=null,eraseLastAll=false;const eraseStack=[];
function eraseSnapshot(){return {img:refImage?Object.assign({},refImage):null,vec:refDrawing?JSON.stringify(refDrawing):null};}
function eraseStart(p){if(!refImage&&!refDrawing){toast('There is no imported picture or drawing under the plan to erase.');return;}
  eraseStack.push(eraseSnapshot());if(eraseStack.length>15)eraseStack.shift();eraseOn={last:p,vec:false,hit:0};eraseAt(p);}
function eraseAt(p){if(!eraseOn)return;const rW=eraseSize/2/view.s,from=eraseOn.last;
  const steps=Math.max(1,Math.ceil(dist(from,p)/(rW*0.5)));
  if(refImage&&refImgMask){const R=refImage,th=-R.r*Math.PI/180,c=Math.cos(th),s=Math.sin(th),g=refImgMask.getContext('2d');g.save();g.globalCompositeOperation='destination-out';g.fillStyle='#000';
    for(let i=0;i<=steps;i++){const P=add(from,mul(sub(p,from),i/steps)),v=sub(P,[R.x,R.y]);const u=[(v[0]*c-v[1]*s)/R.s,(v[0]*s+v[1]*c)/R.s];const rr=rW/R.s;
      if(!eraseOn.hit){const x0=Math.max(0,Math.floor(u[0]-rr)),y0=Math.max(0,Math.floor(u[1]-rr)),x1=Math.min(refImgMask.width,Math.ceil(u[0]+rr)),y1=Math.min(refImgMask.height,Math.ceil(u[1]+rr));
        if(x1>x0&&y1>y0){const dd=g.getImageData(x0,y0,x1-x0,y1-y0).data;for(let q=3;q<dd.length;q+=16)if(dd[q]>70){eraseOn.hit++;break;}}}
      g.beginPath();g.arc(u[0],u[1],rr,0,Math.PI*2);g.fill();}
    g.restore();refImgTintCol='';refTintVer++;}
  if(refDrawing){const D=refDrawing,S=D.segs,keepS=[],keepL=[];let cut=false;
    const near=(a,b)=>{for(let i=0;i<=steps;i++){const P=add(from,mul(sub(p,from),i/steps));if(dist(P,segClosest(P,a,b).q)<rW)return true;}return false;};
    for(let i=0;i<S.length;i+=4){if(near([S[i],S[i+1]],[S[i+2],S[i+3]])){cut=true;continue;}keepS.push(S[i],S[i+1],S[i+2],S[i+3]);keepL.push(D.sl[i/4]);}
    const arcs=D.arcs.filter(([x,y,r,a0,a1,li,full])=>{const pts=full?[[x+r,y],[x-r,y],[x,y+r],[x,y-r]]:[0,0.25,0.5,0.75,1].map(t=>{const a=a0+(a1-a0)*t;return [x+r*Math.cos(a),y+r*Math.sin(a)];});
      const hit=pts.some(q=>{for(let i=0;i<=steps;i++)if(dist(add(from,mul(sub(p,from),i/steps)),q)<rW)return true;return false;});if(hit)cut=true;return !hit;});
    const texts=D.texts.filter(t=>{const hit=dist(segClosest([t[0],t[1]],from,p).q,[t[0],t[1]])<rW+t[2]*0.6;if(hit)cut=true;return !hit;});
    if(cut){eraseOn.hit++;D.segs=keepS;D.sl=keepL;D.arcs=arcs;D.texts=texts;eraseOn.vec=true;setReference(D,true);}}
  eraseOn.last=p;dirty();}
function eraseEnd(){if(!eraseOn)return;
  if(!eraseOn.hit){eraseStack.pop();eraseOn=null;toast('Nothing to erase there. The eraser only removes what is drawn in red: what is left of the imported picture or drawing. To hide measurements use Measures; to delete a wall, door, fixture or text, select it with the Pointer and press Delete.');dirty();return;}
  if(refImage&&refImgMask){ // keep the result: rebuild the stored picture from what is left
    const c=document.createElement('canvas');c.width=refImgMask.width;c.height=refImgMask.height;const g=c.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,c.width,c.height);g.drawImage(refImgMask,0,0);
    refImage.src=c.toDataURL(/^data:image\/png/.test(refImage.src)?'image/png':'image/jpeg',0.85);saveRefImage();}
  if(eraseOn.vec)saveRef();eraseOn=null;checkRefLeftover();renderInspector();}
function eraseUndo(){const s=eraseStack.pop();if(!s)return;setReference(s.vec?JSON.parse(s.vec):null);setRefImage(s.img);refVisible=true;updateRefUI();renderInspector();dirty();toast('Erasing undone');}
function drawEraseCursor(){if(!cursor||ptrTouch&&!eraseOn)return;const q=toS(cursor);ctx.save();ctx.strokeStyle=C.danger||'#e5484d';ctx.lineWidth=1.5;ctx.setLineDash([4,3]);
  ctx.beginPath();ctx.arc(q[0],q[1],eraseSize/2,0,Math.PI*2);ctx.stroke();ctx.restore();}
function erasePanel(){const has=refImage||refDrawing;
  return `<p class="h">Eraser</p><p class="tip">${has?'Everything the eraser can remove is shown <b style="color:var(--danger)">in red</b>: what is left of the imported picture or drawing (dimension lines, furniture, fixtures, text). Drag over it to rub it out. Walls, doors, windows, fixtures and text you added are never touched.':'There is nothing imported under the plan to erase.'}</p>
    <div class="kv"><label for="eraseSz">Brush size</label><input type="range" id="eraseSz" min="8" max="120" step="2" value="${eraseSize}" aria-label="Brush size"></div>
    <div class="rowbtns"><button class="btn" id="eraseUndoBtn"${eraseStack.length?'':' disabled'}>Undo erase</button>${has?'<button class="btn" id="eraseAllBtn">Remove all of it</button>':''}</div>
    <p class="tip">The measurements with tick marks along the outside of the plan are the app's own wall dimensions, not part of the picture. Turn them off with <b>Measures</b> at the top of the plan.</p>`;}
function bindErase(){const r=$('#eraseSz');if(r)r.oninput=()=>{eraseSize=+r.value;dirty();};
  const u=$('#eraseUndoBtn');if(u)u.onclick=eraseUndo;
  const a=$('#eraseAllBtn');if(a)a.onclick=()=>{eraseStack.push(eraseSnapshot());eraseLastAll=true;setReference(null);setRefImage(null);setTool('select');renderInspector();toast('Everything under the plan removed. Ctrl+Z (or Undo) brings it back.');};}


/* ============================== text on the plan ============================== */
// Notes and labels you place yourself. Size is in real units (like the drawing), so text keeps its place when you zoom.
const textById=id=>(M.texts||[]).find(t=>t.id===id);
const textFont=(T,px)=>(T.bold?'600 ':'400 ')+px+'px "IBM Plex Sans", system-ui, sans-serif';
function textLines(T){return String(T.s||'').split('\n');}
// corners of the text's box in plan units
function textBox(T){ctx.save();ctx.font=textFont(T,100);const L=textLines(T),w=Math.max(...L.map(l=>ctx.measureText(l).width),20)/100*T.h;ctx.restore();
  const lh=T.h*1.3,h=lh*L.length,x0=T.a==='bl'?0:-w/2,y0=T.a==='bl'?-T.h:-h/2;const pad=T.h*0.15;
  return [[x0-pad,y0-pad],[x0+w+pad,y0-pad],[x0+w+pad,y0+h+pad],[x0-pad,y0+h+pad]].map(p=>add([T.x,T.y],rotV(p,T.r||0)));}
function drawTexts(){(M.texts||[]).forEach(T=>{const px=T.h*view.s;const on=sel&&sel.kind==='text'&&sel.id===T.id;if(px<3&&!on)return;
  const q=toS([T.x,T.y]),L=textLines(T);ctx.save();ctx.translate(q[0],q[1]);ctx.rotate((T.r||0)*Math.PI/180);ctx.font=textFont(T,Math.max(px,3));
  ctx.textAlign=T.a==='bl'?'left':'center';ctx.textBaseline=T.a==='bl'?'alphabetic':'middle';ctx.fillStyle=T.color||C.ink;
  const lh=px*1.3,y0=T.a==='bl'?0:-(L.length-1)*lh/2;ctx.strokeStyle=C.paper;ctx.lineWidth=Math.min(4,px*0.25);ctx.lineJoin='round';
  L.forEach((l,i)=>{ctx.strokeText(l,0,y0+i*lh);ctx.fillText(l,0,y0+i*lh);});ctx.restore();
  if(on||(hover&&hover.kind==='text'&&hover.id===T.id&&tool==='select')){const B=textBox(T).map(toS);ctx.save();ctx.strokeStyle=C.accent;ctx.lineWidth=on?1.5:1;ctx.setLineDash([4,3]);ctx.beginPath();B.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.closePath();ctx.stroke();ctx.restore();}});}
function hitText(p){const L=M.texts||[];for(let i=L.length-1;i>=0;i--){const T=L[i];if(T.h*view.s<3)continue;if(pointInPoly(p,textBox(T)))return {kind:'text',id:T.id};}return null;}
// room names can be dragged to a better spot
function roomLabelPos(r){const lo=r.meta&&r.meta.lo;return lo?add(r.centroid,lo):r.centroid;}
function hitRoomLabel(p){if(view.s<0.015)return null;const sp=toS(p);for(const r of rooms){if(r.meta&&r.meta.hideLabel)continue;const c=toS(roomLabelPos(r));
    ctx.save();ctx.font='600 12.5px "IBM Plex Sans", system-ui, sans-serif';const w=ctx.measureText(r.name).width;ctx.restore();
    const lines=1+(MEAS.rooms?1:0)+(MEAS.rooms&&r.rect&&view.s>0.04?1:0),top=c[1]-(lines-1)*7.5-8;
    const ww=Math.max(w,lines>1?90:0);if(Math.abs(sp[0]-c[0])<ww/2+6&&sp[1]>top&&sp[1]<top+16+(lines-1)*15)return {kind:'roomlabel',pt:r.centroid.slice()};}return null;}
function roomMetaOf(r){if(r.meta)return r.meta;const m={x:r.centroid[0],y:r.centroid[1],type:r.type};M.roomMeta.push(m);r.meta=m;return m;}
// the Text tool: click to place, type, Enter to finish (Shift+Enter for a new line); click an imported text to make it your own
let textEdit=null;
function textToolClick(p){
  // an imported drawing's text becomes a normal text you can move and change
  if(refDrawing&&refVisible){const R=refDrawing;for(let i=0;i<R.texts.length;i++){const [x,y,h,rot,s]=R.texts[i];const T={x,y,h,r:rot*180/Math.PI,s:String(s),a:'bl'};
      if(h*view.s>=3&&pointInPoly(p,textBox(T))){const n={id:nid('t'),x,y,h:Math.round(h),r:Math.round(T.r*10)/10,s:String(s),a:'bl'};R.texts.splice(i,1);setReference(R);
        mutate(()=>{M.texts.push(n);});setTool('select');sel={kind:'text',id:n.id};renderInspector();dirty();toast('That text is now yours: drag it, change it, or press Delete.');return;}}}
  const h=hitText(p);if(h){setTool('select');sel=h;renderInspector();dirty();focusTextField();return;}
  openTextEditor(p,null);}
function openTextEditor(p,T){closeTextEditor(true);const box=document.createElement('textarea');box.className='texted';box.rows=1;box.value=T?T.s:'';box.placeholder='Type text';
  const size=T?T.h:textDefaults.h;const px=clamp(size*view.s,12,40);const q=toS(T?[T.x,T.y]:p);
  Object.assign(box.style,{left:q[0]+'px',top:(q[1]-px*0.75)+'px',fontSize:px+'px',fontWeight:(T?T.bold:textDefaults.bold)?'600':'400'});
  planCv.parentElement.appendChild(box);textEdit={box,p:T?[T.x,T.y]:p,id:T?T.id:null};
  const grow=()=>{box.style.height='auto';box.style.height=box.scrollHeight+'px';box.style.width='auto';box.style.width=Math.max(120,box.scrollWidth+8)+'px';};grow();
  box.addEventListener('input',grow);
  box.addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();closeTextEditor(false);}else if(e.key==='Escape'){e.preventDefault();closeTextEditor(true);}});
  box.addEventListener('blur',()=>setTimeout(()=>{if(textEdit&&textEdit.box===box)closeTextEditor(false);},0));
  setTimeout(()=>box.focus(),0);}
function closeTextEditor(cancel){if(!textEdit)return;const {box,p,id}=textEdit;textEdit=null;const v=box.value.replace(/\s+$/,'');box.remove();
  if(cancel||!v){dirty();return;}
  if(id){const T=textById(id);if(T)mutate(()=>{T.s=v;});sel={kind:'text',id};}
  else{const T={id:nid('t'),x:Math.round(p[0]),y:Math.round(p[1]),s:v,h:textDefaults.h,r:textDefaults.r,bold:textDefaults.bold};mutate(()=>{M.texts.push(T);});sel={kind:'text',id:T.id};}
  renderInspector();dirty();}
let textDefaults={h:150,r:0,bold:false};
function focusTextField(){setTimeout(()=>{const f=$('#txS');if(f){f.focus();f.select();}},0);}
function textPanel(T){return `<div class="selname">Text <span class="selbtns"><button class="btn" id="copyBtn" title="Copy (Ctrl+C)">Copy</button><button class="btn" id="delBtn">Delete</button></span></div>
  <div class="kv"><label for="txS">Text</label><textarea id="txS" rows="${Math.min(5,textLines(T).length+1)}">${esc(T.s)}</textarea>
  ${field('Size','txH',fmtLen(T.h))}${field('Angle','txR',(Math.round((T.r||0)*10)/10)+'°','text')}
  <label>Style</label><span class="lblbtns"><button class="btn togglebtn" id="txB" aria-pressed="${!!T.bold}">Bold</button><button class="btn" id="txRot">↻ 90°</button><button class="btn" id="txLvl">Level</button></span></div>
  <p class="tip">Drag the text to move it; arrow keys nudge it. Double-click it to change the words on the plan. <kbd>Shift+Enter</kbd> starts a new line. The size is the real height of the letters, so it prints and exports to AutoCAD at that size.</p>`;}
function bindText(T){const ed=fn=>{mutate(()=>fn(T));renderInspector();};
  const s=$('#txS');s.onchange=()=>{const v=s.value.replace(/\s+$/,'');if(!v){deleteSel();return;}ed(t=>{t.s=v;});};
  $('#txH').onchange=e=>{const v=parseLen(e.target.value);if(v>=20&&v<=5000){ed(t=>{t.h=v;});textDefaults.h=v;}else renderInspector();};
  $('#txR').onchange=e=>{const v=parseFloat(String(e.target.value).replace(',','.'));if(isFinite(v)){ed(t=>{t.r=((v%360)+540)%360-180;});textDefaults.r=T.r;}else renderInspector();};
  $('#txB').onclick=()=>{ed(t=>{t.bold=!t.bold;});textDefaults.bold=T.bold;};
  $('#txRot').onclick=()=>ed(t=>{t.r=(((t.r||0)+90)+540)%360-180;});$('#txLvl').onclick=()=>ed(t=>{t.r=0;});
  $('#delBtn').onclick=deleteSel;$('#copyBtn').onclick=()=>copySel();}
function textToolPanel(){return `<p class="h">Text</p><div class="kv">${field('Size','tdH',fmtLen(textDefaults.h))}<label>Style</label><span class="lblbtns"><button class="btn togglebtn" id="tdB" aria-pressed="${textDefaults.bold}">Bold</button></span></div>
  <p class="tip">Click on the plan where the text goes, type, and press <kbd>Enter</kbd> (<kbd>Shift+Enter</kbd> for a new line, <kbd>Esc</kbd> to cancel).<br><br>Click an existing text to change it.${refDrawing&&refDrawing.texts.length?' Click a text in the imported drawing to turn it into a normal text you can move or delete.':''}<br><br>To move or delete any text, use the Pointer: drag it, or select it and press <kbd>Delete</kbd>. Room names can be dragged too.</p>`;}
function bindTextTool(){const h=$('#tdH');if(h)h.onchange=()=>{const v=parseLen(h.value);if(v>=20&&v<=5000)textDefaults.h=v;renderInspector();};
  const b=$('#tdB');if(b)b.onclick=()=>{textDefaults.bold=!textDefaults.bold;renderInspector();};}

/* copy and paste: the copy follows the pointer by its top-left corner; click to place it */
let clip=null,pasteOff=null,pasteSnap='';
const clone=o=>JSON.parse(JSON.stringify(o));
function copySel(quiet){if(!sel)return false;const C0={walls:[],openings:[],cols:[],items:[],dims:[],meta:[],areas:[],texts:[]};
  let wallIds=new Set();
  if(sel.kind==='wall'||sel.kind==='walls')wallIds=selIds();
  if(sel.kind==='arc'){const q=arcById(sel.id);if(q)arcSegs(q).forEach(w=>wallIds.add(w.id));}
  if(sel.kind==='room'){const r=rooms.find(r=>pointInPoly(sel.pt,r.net));if(r){
      // just this room's stretch of each wall, with the doors and windows on that stretch
      r.loop.forEach((h,i)=>{const w=h.e.w,p0=r.poly[i],p1=r.poly[(i+1)%r.poly.length];const nw=Object.assign(clone(w),{id:'r'+i,a:p0.slice(),b:p1.slice()});delete nw.loose;delete nw.arcId;delete nw.arcIdx;C0.walls.push(nw);
        const d=wallDir(w),s0=dot(sub(p0,w.a),d),s1=dot(sub(p1,w.a),d),rev=s1<s0;
        M.openings.forEach(o=>{if(o.wall!==w.id||o.s<Math.min(s0,s1)||o.s>Math.max(s0,s1))return;const n=Object.assign(clone(o),{wall:nw.id,s:rev?s0-o.s:o.s-s0});
          if(rev){n.flip=o.flip?0:1;n.hinge=o.hinge?0:1;}C0.openings.push(n);});});
      M.items.forEach(it=>{if(pointInPoly([it.x,it.y],r.net))C0.items.push(clone(it));});(M.cols||[]).forEach(c=>{if(pointInPoly([c.x,c.y],r.net))C0.cols.push(clone(c));});
      C0.meta.push({x:r.centroid[0],y:r.centroid[1],name:r.name,type:r.type,tile:r.meta&&r.meta.tile,tileH:r.meta&&r.meta.tileH});}}
  M.walls.forEach(w=>{if(wallIds.has(w.id))C0.walls.push(clone(w));});
  C0.arcs=(M.arcs||[]).filter(q=>{const sg=arcSegs(q);return sg.length&&sg.every(w=>wallIds.has(w.id));}).map(clone);
  C0.walls.forEach(w=>{if(w.arcId&&!C0.arcs.some(q=>q.id===w.arcId)){delete w.arcId;delete w.arcIdx;}});
  if(sel.kind==='room'){}
  M.openings.forEach(o=>{if(wallIds.has(o.wall)||(sel.kind==='opening'&&sel.id===o.id))C0.openings.push(clone(o));});
  if(sel.kind==='col'){const c=colById(sel.id);if(c)C0.cols.push(clone(c));}
  if(sel.kind==='item'){const it=M.items.find(x=>x.id===sel.id);if(it)C0.items.push(clone(it));}
  if(sel.kind==='dim'){const d=(M.dims||[]).find(x=>x.id===sel.id);if(d)C0.dims.push(clone(d));}
  if(sel.kind==='area'){const A=areaById(sel.id);if(A)C0.areas.push(clone(A));}
  if(sel.kind==='text'){const T=textById(sel.id);if(T)C0.texts.push(clone(T));}
  const pts=clipPoints(C0);if(!pts.length&&!C0.openings.length){toast('Select a wall, column, fixture, door, window, dimension or room to copy.');return false;}
  C0.anchor=pts.length?[Math.min(...pts.map(p=>p[0])),Math.min(...pts.map(p=>p[1]))]:[0,0];clip=C0;$('#pasteBtn').hidden=false;
  if(!quiet){const n=[];const add_=(k,w)=>{if(C0[k].length)n.push(C0[k].length+' '+w+(C0[k].length>1?'s':''));};add_('walls','wall');add_('openings','opening');add_('cols','column');add_('items','fixture');add_('dims','dimension');add_('areas','area');add_('texts','text');
    toast('Copied '+n.join(', ')+'. Press Ctrl+V, or Paste on the plan, then click where it goes.');}
  return true;}
function clipPoints(C0){const pts=[];C0.walls.forEach(w=>{const d=wallDir(w),n=perp(d);[w.a,w.b].forEach(p=>pts.push(add(p,mul(n,w.t/2)),add(p,mul(n,-w.t/2))));});
  C0.cols.forEach(c=>pts.push(...colCorners(c)));C0.items.forEach(it=>[[-1,-1],[1,-1],[1,1],[-1,1]].forEach(([x,y])=>pts.push(add([it.x,it.y],rotV([x*it.w/2,y*it.d/2],it.r)))));
  C0.dims.forEach(d=>pts.push(d.a,d.b));(C0.areas||[]).forEach(A=>pts.push(...areaOutline(A)));(C0.texts||[]).forEach(T=>pts.push(...textBox(T)));return pts;}
const openingOnly=()=>clip&&!clip.walls.length&&clip.openings.length&&!clip.cols.length&&!clip.items.length&&!clip.dims.length&&!(clip.areas||[]).length&&!(clip.texts||[]).length;
function startPaste(){if(!clip){toast('Nothing copied yet. Select something and press Ctrl+C.');return;}setTool('paste');pasteOff=null;updatePreview(cursor);dirty();}
function pasteOffsetFor(p){
  if(openingOnly()){const o=clip.openings[0],w=nearestWall(p,24);if(!w)return null;const sl=openingSlot(p,w,o.w)||openingSlotLoose(p,w,o.w);return sl?{wall:w,s:sl.s}:null;}
  let off=sub(p,clip.anchor);pasteSnap='';
  if(snapOn){let best=null,bd=10/view.s;const ends=[];M.walls.forEach(w=>ends.push(w.a,w.b));
    clip.walls.forEach(w=>[w.a,w.b].forEach(q=>{const t=add(q,off);ends.forEach(E=>{const d=dist(t,E);if(d<bd){bd=d;best=sub(E,q);}});}));
    if(best){off=best;pasteSnap='joins a wall end';}else off=[Math.round(off[0]/lenStep())*lenStep(),Math.round(off[1]/lenStep())*lenStep()];}
  return off;}
function doPaste(){const off=pasteOff;if(!off)return;const newWalls=[],sels=[];
  if(openingOnly()){const o=clip.openings[0];const n=Object.assign(clone(o),{id:nid('o'),wall:off.wall.id,s:off.s});mutate(()=>M.openings.push(n));setTool('select');sel={kind:'opening',id:n.id};renderInspector();dirty();return;}
  const map={};
  const amap={};
  mutate(()=>{(clip.arcs||[]).forEach(q=>{const n=Object.assign(clone(q),{id:nid('q'),a:add(q.a,off).map(v=>Math.round(v*10)/10),b:add(q.b,off).map(v=>Math.round(v*10)/10)});amap[q.id]=n.id;M.arcs.push(n);});
    clip.walls.forEach(w=>{const n=clone(w);n.id=nid('w');map[w.id]=n.id;if(n.arcId){if(amap[n.arcId])n.arcId=amap[n.arcId];else{delete n.arcId;delete n.arcIdx;}}n.a=add(w.a,off).map(v=>Math.round(v*10)/10);n.b=add(w.b,off).map(v=>Math.round(v*10)/10);M.walls.push(n);newWalls.push(n.id);});
    clip.openings.forEach(o=>{if(map[o.wall])M.openings.push(Object.assign(clone(o),{id:nid('o'),wall:map[o.wall]}));});
    clip.cols.forEach(c=>{const n=Object.assign(clone(c),{id:nid('c'),x:c.x+off[0],y:c.y+off[1]});M.cols.push(n);sels.push({kind:'col',id:n.id});});
    clip.items.forEach(it=>{const n=Object.assign(clone(it),{id:nid('i'),x:it.x+off[0],y:it.y+off[1]});M.items.push(n);sels.push({kind:'item',id:n.id});});
    clip.dims.forEach(d=>{const n={id:nid('m'),a:add(d.a,off),b:add(d.b,off)};M.dims.push(n);sels.push({kind:'dim',id:n.id});});
    (clip.texts||[]).forEach(T=>{const n=Object.assign(clone(T),{id:nid('t'),x:T.x+off[0],y:T.y+off[1]});M.texts.push(n);sels.push({kind:'text',id:n.id});});
    (clip.areas||[]).forEach(A=>{const n=Object.assign(clone(A),{id:nid('g'),pts:A.pts.map(q=>add(q,off).map(v=>Math.round(v*10)/10))});M.areas.push(n);sels.push({kind:'area',id:n.id});});
    clip.meta.forEach(m=>M.roomMeta.push(Object.assign(clone(m),{x:m.x+off[0],y:m.y+off[1]})));});
  setTool('select');
  const pa=Object.values(amap);
  if(pa.length===1&&newWalls.every(id=>{const w=wallById(id);return w&&w.arcId===pa[0];})){sel={kind:'arc',id:pa[0]};renderInspector();dirty();}
  else if(newWalls.length)setSelWalls(newWalls);else if(sels.length===1){sel=sels[0];renderInspector();dirty();}
  toast('Pasted. Drag it to adjust, or press Ctrl+V to place another copy.');}
function drawPasteGhost(){if(!clip||!pasteOff)return;
  if(openingOnly()){const o=clip.openings[0];drawOpening(Object.assign({},o,{wall:pasteOff.wall.id,s:pasteOff.s}),true);return;}
  const off=pasteOff;ctx.save();ctx.globalAlpha=.8;
  clip.walls.forEach(w=>{const d=wallDir(w),n=perp(d),h=w.t/2,a=add(w.a,off),b=add(w.b,off);const q=[add(a,mul(n,h)),add(b,mul(n,h)),add(b,mul(n,-h)),add(a,mul(n,-h))].map(toS);
    ctx.beginPath();q.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.closePath();ctx.fillStyle=C['accent-weak'];ctx.fill();ctx.strokeStyle=C.accent;ctx.lineWidth=1.4;ctx.stroke();});
  clip.cols.forEach(c=>drawColumn(Object.assign({},c,{x:c.x+off[0],y:c.y+off[1]}),'ghost'));
  clip.items.forEach(it=>drawItem(Object.assign({},it,{x:it.x+off[0],y:it.y+off[1]}),true,true));
  clip.dims.forEach(d=>drawMeasure(add(d.a,off),add(d.b,off),C.accent,{}));
  ctx.restore();const q=toS(add(clip.anchor,off));ctx.strokeStyle=C.snap;ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(q[0]-7,q[1]);ctx.lineTo(q[0]+7,q[1]);ctx.moveTo(q[0],q[1]-7);ctx.lineTo(q[0],q[1]+7);ctx.stroke();}
$('#pasteBtn').onclick=startPaste;
function syncToolButtons(){document.querySelectorAll('[data-tool]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.tool===tool&&((b.dataset.kind||null)===((tool==='wall'||tool==='area')?placeType:(b.dataset.kind||null))))));}
function setTool(t,type){if(t!==tool){closeTextEditor(false);ruler=null;arcDraw={a:null,b:null,s:0};areaDraw={pts:[],cur:null,snap:null};}tool=t;placeType=type||null;draw.start=null;ghost=null;hideLenbox();
  syncToolButtons();
  document.querySelectorAll('.lib button[data-type]').forEach(b=>b.setAttribute('aria-pressed',String(t==='place'&&b.dataset.type===type)));
  $('#hint').innerHTML=HINTS[t]||'';$('#snapchip').textContent='';planCv.style.cursor=t==='select'?'default':'crosshair';
  colGhost=t==='column'?{id:'ghost',x:cursor[0],y:cursor[1],r:colDefaults.r||0,shape:colDefaults.shape,w:colDefaults.w,d:colDefaults.d,h:colDefaults.h,gap:colDefaults.gap,place:'free',on:false}:null;
  if(t==='place'){const c=CAT[type];ghost={id:'ghost',type,x:cursor[0],y:cursor[1],r:0,w:c.w,d:c.d,h:c.h,z:c.z};if(type==='firepit')applyFirepitShape(ghost,firepitDefaults.shape);}
  if(t!=='select'&&t!=='place')sel=null;renderInspector();dirty();}
function evPoint(e){const r=planCv.getBoundingClientRect();return [e.clientX-r.left,e.clientY-r.top];}
function addWall(a,b){const sp=curWallSpec(),t=sp.t,h=sp.h;const w={id:nid('w'),a:a.slice(),b:b.slice(),t,h};if(tool==='wall'&&OUTW[placeType])w.kind=placeType;M.walls.push(w);}
// Moving a wall drags the ends of walls joined to it, so corners and T-junctions stay closed.
function wallMoveSet(w){const set={a0:w.a.slice(),b0:w.b.slice(),ca:connectedEnds(w,'a').map(([o,k])=>[o,k,o[k].slice()]),cb:connectedEnds(w,'b').map(([o,k])=>[o,k,o[k].slice()]),tees:[]};
  M.walls.forEach(o=>{if(o===w)return;['a','b'].forEach(k=>{if(!isLoose(o,k)&&onWallInterior(o[k],w))set.tees.push([o,k,o[k].slice()]);});});
  set.ops=captureOpenings([...set.ca,...set.cb,...set.tees].map(([o])=>o));return set;}
function applyWallMove(w,set,mv){w.a=add(set.a0,mv);w.b=add(set.b0,mv);[...set.ca,...set.cb,...set.tees].forEach(([o,k,o0])=>o[k]=add(o0,mv));restoreOpenings(set.ops);}
// Doors and windows on walls that stretch keep their place in the room.
function captureOpenings(walls){const ids=new Set(walls.map(w=>w.id));return M.openings.concat((M.cols||[]).filter(c=>c.wall)).filter(o=>ids.has(o.wall)).map(o=>{const w=wallById(o.wall);return [o,add(w.a,mul(wallDir(w),o.s))];});}
function restoreOpenings(list){list.forEach(([o,c])=>{const w=wallById(o.wall);if(w)o.s=dot(sub(c,w.a),wallDir(w));});}
function clampOpenings(){M.openings=M.openings.filter(o=>wallById(o.wall));M.openings.forEach(o=>{const w=wallById(o.wall),L=wallLen(w),ext=wallExt(w);const lo=ext[0]+o.w/2,hi=L-ext[1]-o.w/2;if(hi>=lo)o.s=clamp(o.s,lo,hi);});}
function connectedEnds(w,k){if(isLoose(w,k))return [];const p=w[k],out=[];M.walls.forEach(o=>{if(o===w)return;['a','b'].forEach(ok=>{if(dist(o[ok],p)<1&&!isLoose(o,ok))out.push([o,ok]);});});return out;}
const onWallInterior=(p,o)=>{const c=segClosest(p,o.a,o.b);return c.t>0.001&&c.t<0.999&&dist(p,c.q)<1;};
// Moving several walls: their ends move, and joined neighbours outside the group stretch to follow.
function groupMoveSet(ids){const ws=M.walls.filter(w=>ids.has(w.id));const pts=[],follow=[],seen=new Set();
  ws.forEach(w=>['a','b'].forEach(k=>{pts.push([w,k,w[k].slice()]);connectedEnds(w,k).forEach(([o,ok])=>{if(!ids.has(o.id)&&!seen.has(o.id+ok)){seen.add(o.id+ok);follow.push([o,ok,o[ok].slice()]);}});}));
  M.walls.forEach(o=>{if(ids.has(o.id))return;['a','b'].forEach(k=>{if(isLoose(o,k)||seen.has(o.id+k))return;if(ws.some(w=>onWallInterior(o[k],w))){seen.add(o.id+k);follow.push([o,k,o[k].slice()]);}});});
  return {ids,pts,follow,ops:captureOpenings(follow.map(([o])=>o))};}
function applyGroupMove(set,mv){set.pts.forEach(([w,k,o0])=>w[k]=add(o0,mv));set.follow.forEach(([o,k,o0])=>o[k]=add(o0,mv));restoreOpenings(set.ops);}
// Unsnap: let the chosen walls go from every wall outside the choice.
function unsnapWalls(ids){let n=0;const ws=M.walls.filter(w=>ids.has(w.id));
  ws.forEach(w=>['a','b'].forEach(k=>{const p=w[k];const touches=M.walls.some(o=>!ids.has(o.id)&&(dist(o.a,p)<1||dist(o.b,p)<1||onWallInterior(p,o)));if(touches&&!isLoose(w,k)){setLoose(w,k,true);n++;}}));
  M.walls.forEach(o=>{if(ids.has(o.id))return;['a','b'].forEach(k=>{if(!isLoose(o,k)&&ws.some(w=>dist(o[k],segClosest(o[k],w.a,w.b).q)<1)){setLoose(o,k,true);n++;}});});
  return n;}
// Snap: join the chosen ends to whatever they touch, or to the nearest wall end or wall line within reach.
function snapWallEnds(ids,only){let n=0;const tol=Math.max(400,24/view.s);const ws=M.walls.filter(w=>ids.has(w.id));const ops=captureOpenings(ws);
  ws.forEach(w=>['a','b'].forEach(k=>{if(only&&only!==k)return;const p=w[k],other=w[k==='a'?'b':'a'];const wasLoose=isLoose(w,k);setLoose(w,k,false);let touching=false;
    M.walls.forEach(o=>{if(o===w)return;['a','b'].forEach(ok=>{if(dist(o[ok],p)<1){setLoose(o,ok,false);touching=true;}});if(onWallInterior(p,o))touching=true;});
    if(touching){if(wasLoose)n++;return;}
    let best=null,bd=tol;
    M.walls.forEach(o=>{if(o===w)return;['a','b'].forEach(ok=>{const d=dist(o[ok],p);if(d<bd){bd=d;best={q:o[ok].slice(),o,ok};}});});
    if(!best){const d=norm(sub(p,other));M.walls.forEach(o=>{if(o===w)return;const e=sub(o.b,o.a);const c=cross(d,e);if(Math.abs(c)<1e-9)return;
      const t=cross(sub(o.a,other),e)/c,u=cross(sub(o.a,other),d)/c;if(u<-0.001||u>1.001||t<=50)return;const q=add(other,mul(d,t));const dd=dist(q,p);if(dd<bd){bd=dd;best={q,o};}});}
    if(best){w[k]=best.q;if(best.ok)setLoose(best.o,best.ok,false);n++;}else if(wasLoose)n++;}));
  restoreOpenings(ops);return n;}
const selIds=()=>new Set(!sel?[]:sel.kind==='wall'?[sel.id]:sel.kind==='walls'?sel.ids:[]);
function setSelWalls(arr){arr=[...new Set(arr)].filter(id=>wallById(id));sel=!arr.length?null:arr.length===1?{kind:'wall',id:arr[0]}:{kind:'walls',ids:arr};renderInspector();dirty();}
function toggleSelWall(id){const ids=selIds();ids.has(id)?ids.delete(id):ids.add(id);setSelWalls([...ids]);}
function segInter(a,b,c,d){const r=sub(b,a),q=sub(d,c),den=cross(r,q);if(Math.abs(den)<1e-12)return false;const t=cross(sub(c,a),q)/den,u=cross(sub(c,a),r)/den;return t>=0&&t<=1&&u>=0&&u<=1;}
// Left-to-right box: walls fully inside. Right-to-left box: any wall it touches.
function wallsInBox(a,b,crossing){const x0=Math.min(a[0],b[0]),x1=Math.max(a[0],b[0]),y0=Math.min(a[1],b[1]),y1=Math.max(a[1],b[1]);const ins=p=>p[0]>=x0&&p[0]<=x1&&p[1]>=y0&&p[1]<=y1;
  const E=[[[x0,y0],[x1,y0]],[[x1,y0],[x1,y1]],[[x1,y1],[x0,y1]],[[x0,y1],[x0,y0]]];
  return M.walls.filter(w=>(ins(w.a)&&ins(w.b))||(crossing&&(ins(w.a)||ins(w.b)||E.some(([p,q])=>segInter(w.a,w.b,p,q))))).map(w=>w.id);}

planCv.addEventListener('contextmenu',e=>e.preventDefault());
const touches=new Map();let pinch=null;
planCv.addEventListener('pointerdown',e=>{
  planCv.focus({preventScroll:true});const sp=evPoint(e);const p=toW(sp);cursor=p;ptrTouch=e.pointerType!=='mouse';
  if(e.pointerType==='touch'){touches.set(e.pointerId,sp);planCv.setPointerCapture(e.pointerId);
    if(touches.size>=2){if(drag&&drag.moved){M=JSON.parse(drag.snap0);fixUid();changed();}drag=null;pan=null;
      const [a,b]=[...touches.values()];pinch={d0:dist(a,b),s0:view.s,w:toW(mul(add(a,b),.5))};return;}}
  if(e.pointerType!=='mouse')updatePreview(p);
  if(e.button===1||e.button===2||(e.button===0&&spaceDown)){pan={sx:sp[0],sy:sp[1],ox:view.ox,oy:view.oy};planCv.setPointerCapture(e.pointerId);return;}
  if(e.button!==0)return;
  if(laser.picking){laserStartAt(p);return;}
  if(tool==='wall'){const sn=snapPoint(p,draw.start);const q=sn.p;
    if(!draw.start){draw.start=q;draw.chainStart=q;}
    else if(dist(q,draw.start)>5){const a=draw.start;mutate(()=>addWall(a,q));
      if(draw.chainStart&&dist(q,draw.chainStart)<1){draw.start=null;draw.chainStart=null;}else draw.start=q;}
    hideLenbox();dirty();return;}
  if((tool==='door'||tool==='window')&&ghost){const g=Object.assign({},ghost,{id:nid('o')});mutate(()=>M.openings.push(g));sel={kind:'opening',id:g.id};renderInspector();return;}
  if(tool==='place'&&ghost){const g=Object.assign({},ghost,{id:nid('i')});mutate(()=>M.items.push(g));return;}
  if(tool==='paste'){pasteOff=pasteOffsetFor(p);if(pasteOff)doPaste();return;}
  if(tool==='arcwall'){arcToolMove(p);arcToolClick(p);renderInspector();dirty();return;}
  if(tool==='area'){areaToolClick(p);return;}
  if(tool==='text'){textToolClick(p);return;}
  if(tool==='erase'){eraseStart(p);planCv.setPointerCapture(e.pointerId);return;}
  if(tool==='column'&&colGhost&&colGhost.on){const c={id:nid('c'),x:Math.round(colGhost.x*10)/10,y:Math.round(colGhost.y*10)/10,r:colGhost.r,shape:colGhost.shape,w:colGhost.w,d:colGhost.d,h:colGhost.h,gap:colGhost.gap};
    if(colGhost.wall){c.wall=colGhost.wall;c.s=Math.round(colGhost.s*10)/10;c.off=Math.round(colGhost.off*10)/10;}
    mutate(()=>M.cols.push(c));toast('Column placed. Use the Pointer to select it and type exact distances to the walls.');return;}
  if(tool==='ruler'){const from=ruler&&!ruler.b?ruler.a:null;const sn=measureSnap(p,from);
    if(from){if(dist(sn.p,from)>1){ruler.b=sn.p;ruler.cur=sn.p;}renderInspector();}
    else{ruler={a:sn.p,b:null,cur:sn.p,down:sp};planCv.setPointerCapture(e.pointerId);renderInspector();}
    dirty();return;}
  if(tool==='select'){const h=hitTest(p);const mod=e.ctrlKey||e.metaKey;
    if(!h||h.kind==='room'){
      if(emptyDrag==='box'){box={s0:sp,s1:sp,p0:p,add:mod||e.shiftKey,hit:h};}
      else pan={sx:sp[0],sy:sp[1],ox:view.ox,oy:view.oy,click:true,hit:h};
      planCv.setPointerCapture(e.pointerId);return;}
    const ids=selIds();
    if(mod){if(h.kind==='wall'||h.kind==='end')toggleSelWall(h.id);return;}
    if(h.kind==='wall'&&ids.size>1&&ids.has(h.id)){drag={kind:'group',id:h.id,p0:p,snap0:snapshot(),moved:false,set:groupMoveSet(ids),clickId:h.id,toggle:e.shiftKey};planCv.setPointerCapture(e.pointerId);return;}
    const prevSel=sel;
    sel=h.kind==='end'?{kind:'wall',id:h.id}:h;renderInspector();hover=null;
    drag={kind:h.kind,id:h.id,end:h.end,idx:h.idx,p0:p,snap0:snapshot(),moved:false};
    if(e.shiftKey&&h.kind==='wall')drag.toggleFrom=prevSel;
    if(h.kind==='wall'){const w=wallById(h.id);drag.set=wallMoveSet(w);drag.a0=drag.set.a0;drag.b0=drag.set.b0;}
    if(h.kind==='end'){const w=wallById(h.id);drag.orig=w[h.end].slice();drag.links=[[w,h.end]].concat(connectedEnds(w,h.end));drag.ops=captureOpenings(drag.links.map(([o])=>o));}
    if(h.kind==='item'){const it=M.items.find(x=>x.id===h.id);drag.off=sub([it.x,it.y],p);}
    if(h.kind==='col'){const c=colById(h.id);drag.off=sub([c.x,c.y],p);}
    if(h.kind==='colrot'){sel={kind:'col',id:h.id};drag.r0=colById(h.id).r||0;}
    if(h.kind==='text'){const T=textById(h.id);drag.orig=[T.x,T.y];}
    if(h.kind==='roomcorner'){sel={kind:'room',pt:h.pt};const r=selRoom();const jt=r&&roomCornerJoint(r,r.simp[h.idx]);if(!jt){drag=null;return;}drag.J0=jt.J;drag.ends=jt.ends;const mw=[...new Set(jt.ends.map(([w])=>w))];drag.ops=captureOpenings(mw);
      // walls that meet the moved walls part way along (T-junctions) stay attached at the same fraction
      drag.tees=[];{let front=mw.slice();const done=new Set(mw);for(let it=0;it<6&&front.length;it++){const next=[];M.walls.forEach(o=>{['a','b'].forEach(k=>{front.forEach(w=>{if(o===w||drag.tees.some(t=>t[0]===o&&t[1]===k)||mw.includes(o)&&jt.ends.some(([x,y])=>x===o&&y===k))return;const c=segClosest(o[k],w.a,w.b);if(c.t>0.001&&c.t<0.999&&dist(o[k],c.q)<1){const mk=jt.ends.find(([x])=>x===w)||drag.tees.find(t=>t[0]===w);const anchor=mk?(mk[1]==='a'?'b':'a'):'a';drag.tees.push([o,k,w,anchor,dist(o[k],w[anchor])]);if(!done.has(o)){done.add(o);next.push(o);}}});});});front=next;}}
      drag.ops=drag.ops.concat(captureOpenings(drag.tees.map(([o])=>o)));renderInspector();}
    if(h.kind==='roomedge'){sel={kind:'room',pt:h.pt};const w=wallById(h.wid);drag.kind='wall';drag.id=w.id;drag.set=wallMoveSet(w);drag.a0=drag.set.a0;drag.b0=drag.set.b0;drag.keepRoom=h.pt.slice();renderInspector();}
    if(h.kind==='roomlabel'){const r=rooms.find(r=>pointInPoly(h.pt,r.net));sel={kind:'room',pt:h.pt.slice()};renderInspector();if(r){drag.meta=roomMetaOf(r);drag.lo0=(drag.meta.lo||[0,0]).slice();}}
    if(h.kind==='area'||h.kind==='areapt'||h.kind==='areamid'){sel={kind:'area',id:h.id};renderInspector();const A=areaById(h.id);drag.orig=A.pts.map(q=>q.slice());drag.b0=(A.b||A.pts.map(()=>0)).slice();if(!A.b)A.b=drag.b0.slice();}
    if(h.kind==='arc'||h.kind==='arcend'||h.kind==='arcmid'){sel={kind:'arc',id:h.id};renderInspector();const q=arcById(h.id),segs=arcSegs(q);
      if(h.kind==='arc')drag.set=groupMoveSet(new Set(segs.map(w=>w.id)));
      if(h.kind==='arcend'){const w=h.end==='a'?segs[0]:segs[segs.length-1];drag.links=connectedEnds(w,h.end).filter(([o])=>!o.arcId||o.arcId!==q.id);drag.other=q[h.end==='a'?'b':'a'].slice();}}
    planCv.setPointerCapture(e.pointerId);dirty();}
});
planCv.addEventListener('pointermove',e=>{
  const sp=evPoint(e);const p=toW(sp);
  if(e.pointerType==='touch'&&touches.has(e.pointerId)){touches.set(e.pointerId,sp);
    if(pinch&&touches.size>=2){const [a,b]=[...touches.values()];const m=mul(add(a,b),.5);view.s=clamp(pinch.s0*dist(a,b)/Math.max(pinch.d0,1),0.008,3);view.ox=m[0]-pinch.w[0]*view.s;view.oy=m[1]-pinch.w[1]*view.s;dirty();return;}}
  cursor=p;updateCoords();
  if(box){box.s1=sp;dirty();return;}
  if(tool==='erase'){if(eraseOn)eraseAt(p);dirty();return;}
  if(pan){view.ox=pan.ox+sp[0]-pan.sx;view.oy=pan.oy+sp[1]-pan.sy;if(Math.hypot(sp[0]-pan.sx,sp[1]-pan.sy)>4)pan.click=false;dirty();return;}
  if(drag){const dv=sub(p,drag.p0);const thr=ptrTouch?9:(drag.kind==='wall'||drag.kind==='end'||drag.kind==='group')?3:6;if(!drag.moved&&vlen(dv)*view.s<thr)return;drag.moved=true;
    if(drag.kind==='wall')dragWall(dv);
    if(drag.kind==='group')dragGroup(dv);
    if(drag.kind==='end')dragEnd(p,dv);
    if(drag.kind==='arc'){let mv=dv;if(snapOn)mv=[Math.round(mv[0]/lenStep())*lenStep(),Math.round(mv[1]/lenStep())*lenStep()];applyGroupMove(drag.set,mv);drag.mv=mv;drag.snap={kind:'move curved wall'};}
    if(drag.kind==='arcend'){const q=arcById(drag.id),segs=arcSegs(q);const exW=new Set([...segs.map(w=>w.id),...drag.links.map(([o])=>o.id)]);const exP=new Set(drag.links.map(([o,k])=>o[k]));
      const sn=snapPoint(p,drag.other,exW,exP);if(dist(sn.p,drag.other)>100){q[drag.end]=sn.p.slice();drag.links.forEach(([o,k])=>o[k]=sn.p.slice());regenArc(q);}drag.snap=sn;}
    if(drag.kind==='arcmid'){const q=arcById(drag.id),d=norm(sub(q.b,q.a)),n=perp(d),m=mul(add(q.a,q.b),.5);let sg=dot(sub(p,m),n);
      const c=dist(q.a,q.b);if(snapOn&&!shiftDown){if(Math.abs(Math.abs(sg)-c/2)<10/view.s)sg=Math.sign(sg)*c/2;else sg=Math.round(sg/lenStep())*lenStep();}
      if(Math.abs(sg)<1)sg=sg<0?-1:1;q.s=sg;regenArc(q);const g=arcGeom(q.a,q.b,q.s);drag.snap={kind:g?'R '+fmtLen(g.r,true):''};}
    if(drag.kind==='area'){const A=areaById(drag.id);let mv=dv;if(snapOn)mv=[Math.round(mv[0]/lenStep())*lenStep(),Math.round(mv[1]/lenStep())*lenStep()];A.pts=drag.orig.map(q=>add(q,mv));drag.snap={kind:'move area'};}
    if(drag.kind==='areapt'){const A=areaById(drag.id),n=A.pts.length,prev=A.pts[(drag.idx-1+n)%n];const sn=measureSnap(p,prev);A.pts[drag.idx]=sn.p.slice();drag.snap=sn;}
    if(drag.kind==='areamid'){const A=areaById(drag.id),[a,b]=areaEdge(A,drag.idx);const sg=bendFor(a,b,p);A.b[drag.idx]=sg;const g=Math.abs(sg)>=0.5?arcGeom(a,b,sg):null;drag.snap={kind:g?'R '+fmtLen(g.r,true):'straight'};}
    if(drag.kind==='roomcorner'){let mv=dv;if(snapOn&&!shiftDown)mv=[Math.round(mv[0]/lenStep())*lenStep(),Math.round(mv[1]/lenStep())*lenStep()];const J=add(drag.J0,mv);
      drag.ends.forEach(([w,k])=>{w[k]=J.slice();});drag.tees.forEach(([o,k,w,an,d0])=>{const fr=w[an],to=w[an==='a'?'b':'a'];o[k]=add(fr,mul(norm(sub(to,fr)),d0));});restoreOpenings(drag.ops);drag.snap={kind:'move room corner'};}
    if(drag.kind==='text'){const T=textById(drag.id);let mv=dv;if(snapOn&&!shiftDown)mv=[Math.round(mv[0]/lenStep())*lenStep(),Math.round(mv[1]/lenStep())*lenStep()];T.x=drag.orig[0]+mv[0];T.y=drag.orig[1]+mv[1];drag.snap={kind:'move text'};}
    if(drag.kind==='roomlabel'&&drag.meta){drag.meta.lo=add(drag.lo0,dv);drag.snap={kind:'move room name'};}
    if(drag.kind==='colrot'){const c=colById(drag.id);let a=Math.atan2(p[1]-c.y,p[0]-c.x)*180/Math.PI+90;
      if(snapOn&&!shiftDown)a=Math.round(a/15)*15;else a=Math.round(a*10)/10;c.r=((a%360)+360)%360;drag.snap={kind:'angle '+(Math.round(c.r*10)/10)+'°'};}
    if(drag.kind==='col'){const c=colById(drag.id);
      if(c.wall){const sl=hostSlot(add(p,drag.off),Object.assign({},c,{align:'keep'}),c.id);if(sl){if(sl.w.id!==c.wall)c.off=0;c.wall=sl.w.id;c.s=sl.s;if(sl.w.id===c.wall&&c.off==null)c.off=sl.off;syncHostedCols();drag.snap={kind:sl.kind};}drag.guides=[];}
      else{const sn=colSnap(c,add(p,drag.off),c.id);c.x=sn.c.x;c.y=sn.c.y;c.r=sn.c.r;drag.snap={kind:sn.kind};drag.guides=sn.guides;}}
    if(drag.kind==='item'){const it=M.items.find(x=>x.id===drag.id);const target=add(p,drag.off);const r=fixtureSnap(target,it);it.x=r.x;it.y=r.y;if(r.snapped)it.r=r.r;}
    if(drag.kind==='opening'){const o=M.openings.find(x=>x.id===drag.id);let w=nearestWall(p,24)||wallById(o.wall);const sl=openingSlot(p,w,o.w)||openingSlotLoose(p,w,o.w);if(sl){o.wall=w.id;o.s=sl.s;}}
    $('#snapchip').textContent=drag.snap&&drag.snap.kind!=='free'&&drag.snap.kind!=='angle'?drag.snap.kind:'';
    rooms=computeRooms();dirty();renderInspector();return;}
  updatePreview(p);
  if(tool==='select'){ptrTouch=e.pointerType!=='mouse';const h=hitTest(p);const key=h&&h.kind!=='room'?h.kind+(h.id||'')+(h.end||''):'';if(key!==(hover&&hover.key)){hover=h&&h.kind!=='room'?Object.assign({key},h):null;dirty();}
    let cur='default';if(h&&(h.kind==='colrot'||h.kind==='arcmid'||h.kind==='areamid'))cur='grab';else if(h&&(h.kind==='areapt'||h.kind==='area'||h.kind==='text'||h.kind==='roomlabel'||h.kind==='roomcorner'))cur='move';else if(h&&h.kind==='roomedge')cur='grab';else if(h&&h.kind==='end')cur='move';else if(h&&h.kind==='wall'){const d=wallDir(wallById(h.id));cur=freeMove?'move':Math.abs(d[0])>0.92?'ns-resize':Math.abs(d[1])>0.92?'ew-resize':'move';}else if(h&&h.kind!=='room')cur='move';planCv.style.cursor=cur;}
});
function dragWall(dv){
  const w=wallById(drag.id),set=drag.set;const d=norm(sub(set.b0,set.a0)),n=perp(d);let mv;drag.guides=[];
  const rnd=v=>snapOn?Math.round(v/lenStep())*lenStep():v;
  // Free move (button or M) goes in any direction; Shift swaps between free and push/pull for one drag.
  if(freeMove!==shiftDown){let m=dv.slice(),kind='free move';
    if(snapOn){const ang=Math.atan2(Math.abs(m[1]),Math.abs(m[0]));
      if(ang<0.17){m[1]=0;kind='free · straight';}else if(ang>Math.PI/2-0.17){m[0]=0;kind='free · straight';}
      m=[rnd(m[0]),rnd(m[1])];
      // let the wall's ends click onto nearby wall ends
      const tol=10/view.s,linked=new Set([w.id,...set.ca.map(x=>x[0].id),...set.cb.map(x=>x[0].id),...set.tees.map(x=>x[0].id)]);
      const ends=[];M.walls.forEach(o=>{if(!linked.has(o.id))ends.push(o.a,o.b);});
      outer:for(const P of [set.a0,set.b0]){const q=add(P,dv);for(const E of ends){if(dist(q,E)<tol){m=sub(E,P);kind='to wall end';break outer;}}}}
    mv=m;drag.free=true;drag.freeKind=kind;}
  else{let off=rnd(dot(dv,n));drag.free=false;
    // line up with parallel walls (centrelines or matching faces)
    const tol=snapOn?8/view.s:0;let best=null,bd=tol;const linked=new Set([w,...set.ca.map(x=>x[0]),...set.cb.map(x=>x[0]),...set.tees.map(x=>x[0])]);
    M.walls.forEach(o=>{if(linked.has(o)||Math.abs(cross(d,wallDir(o)))>1e-3)return;const base=dot(sub(o.a,set.a0),n);
      for(const t of [base,base+(o.t-w.t)/2,base-(o.t-w.t)/2]){const dd=Math.abs(t-dot(dv,n));if(dd<bd){bd=dd;best={t,o};}}});
    if(best){off=best.t;const m=mul(add(best.o.a,best.o.b),.5);drag.guides.push([m,add(mul(add(set.a0,set.b0),.5),mul(n,off))]);}
    drag.offset=off;mv=mul(n,off);}
  drag.mv=mv;applyWallMove(w,set,mv);
  drag.snap={kind:drag.free?drag.freeKind:(drag.guides.length?'aligned':'push / pull')};}
function dragEnd(p,dv){
  if(!drag.main){ // decide which wall this end belongs to from the direction of the drag
    let best=null,bv=-1;drag.links.forEach(([w,k])=>{const o=w[k==='a'?'b':'a'];const v=Math.abs(dot(norm(sub(drag.orig,o)),norm(dv)))+(drag.links[0][0]===w&&sel&&sel.kind==='wall'&&sel.id===w.id?0.2:0);if(v>bv){bv=v;best=[w,k];}});
    drag.main=best;drag.other=best[0][best[1]==='a'?'b':'a'].slice();drag.axis=norm(sub(drag.orig,drag.other));sel={kind:'wall',id:best[0].id};
    // walls meeting this end at an angle slide along with it, so the room stays square
    drag.carry=drag.links.filter(([w])=>w!==best[0]&&Math.abs(cross(drag.axis,wallDir(w)))>0.2).map(([w])=>[w,wallMoveSet(w)]);
    const carried=new Set(drag.carry.map(([w])=>w));drag.ops=captureOpenings(drag.links.map(([o])=>o).filter(o=>!carried.has(o)));}
  const exW=new Set(drag.links.map(([w])=>w.id)),exP=new Set(drag.links.map(([w,k])=>w[k]));
  const s0=snapPoint(p,drag.other,exW,exP);let sn=null;
  if(s0.kind==='end'||s0.kind==='mid')sn=s0;
  else if(!shiftDown){const v=sub(p,drag.other);const off=Math.abs(cross(drag.axis,v));
    if(off*view.s<28){ // keep the wall's angle: only its length changes
      let L=snapOn?Math.max(lenStep(),Math.round(dot(v,drag.axis)/lenStep())*lenStep()):Math.max(1,dot(v,drag.axis));const tol=8/view.s,guides=[];let kind='length';
      if(snapOn)for(const w of M.walls){if(exW.has(w.id))continue;const e=sub(w.b,w.a);const c=cross(drag.axis,e);if(Math.abs(c)<1e-9)continue;
        const t=cross(sub(w.a,drag.other),e)/c,u=cross(sub(w.a,drag.other),drag.axis)/c;if(u>=0&&u<=1&&Math.abs(t-L)<tol&&t>0){L=t;kind='to wall';break;}}
      if(kind==='length'&&snapOn)for(const E of allEnds(exW,exP)){const ax=drag.axis;
        if(Math.abs(ax[0])>0.3){const t=(E[0]-drag.other[0])/ax[0];if(t>0&&Math.abs(t-L)<tol){L=t;guides.push([E,add(drag.other,mul(ax,L))]);kind='aligned';break;}}
        if(Math.abs(ax[1])>0.3){const t=(E[1]-drag.other[1])/ax[1];if(t>0&&Math.abs(t-L)<tol){L=t;guides.push([E,add(drag.other,mul(ax,L))]);kind='aligned';break;}}}
      sn={p:add(drag.other,mul(drag.axis,L)),kind,guides};}}
  if(!sn)sn=s0;drag.snap=sn;
  const square=!shiftDown&&(sn.kind==='length'||sn.kind==='aligned'||sn.kind==='to wall');
  drag.carry.forEach(([w,set])=>applyWallMove(w,set,square?sub(sn.p,drag.orig):[0,0]));
  const carried=new Set(square?drag.carry.map(([w])=>w):[]);
  drag.links.forEach(([w,k])=>{if(!carried.has(w))w[k]=sn.p.slice();});restoreOpenings(drag.ops);}
function dragGroup(dv){let mv=dv.slice();
  if(snapOn&&!shiftDown){const ang=Math.atan2(Math.abs(mv[1]),Math.abs(mv[0]));if(ang<0.17)mv[1]=0;else if(ang>Math.PI/2-0.17)mv[0]=0;}
  if(snapOn)mv=[Math.round(mv[0]/lenStep())*lenStep(),Math.round(mv[1]/lenStep())*lenStep()];
  drag.mv=mv;applyGroupMove(drag.set,mv);drag.snap={kind:(mv[0]===0||mv[1]===0)&&vlen(mv)>0?'group · straight':'group'};}
/* columns / pillars: free-standing, usually set a little off the walls */
const colDefaults={shape:'rect',w:300,d:300,h:0,gap:50,r:0,place:'free',align:'centre'};let colGhost=null;
const COL_PRESETS=[['rect',200,200],['rect',300,300],['rect',400,400],['rect',250,500],['round',300,300],['round',450,450]];
const colById=id=>(M.cols||[]).find(c=>c.id===id);
const colH=c=>c.h||defaults.h,colHalf=c=>c.shape==='round'?[c.w/2,c.w/2]:[c.w/2,c.d/2];
const colArea=c=>c.shape==='round'?Math.PI*c.w*c.w/4:c.w*c.d,colPerim=c=>c.shape==='round'?Math.PI*c.w:2*(c.w+c.d);
function colAxes(c){const a=c.r*Math.PI/180;return [[Math.cos(a),Math.sin(a)],[-Math.sin(a),Math.cos(a)]];}
function colCorners(c){const [hx,hy]=colHalf(c);if(c.shape==='round')return [[c.x+hx,c.y],[c.x-hx,c.y],[c.x,c.y+hy],[c.x,c.y-hy]];
  return [[-1,-1],[1,-1],[1,1],[-1,1]].map(([x,y])=>add([c.x,c.y],rotV([x*hx,y*hy],c.r)));}
function colEdges(c){if(c.shape==='round'){const n=24,r=c.w/2,pts=[];for(let i=0;i<n;i++){const a=i/n*Math.PI*2;pts.push([c.x+r*Math.cos(a),c.y+r*Math.sin(a)]);}return pts.map((p,i)=>[p,pts[(i+1)%n]]);}
  const q=colCorners(c);return q.map((p,i)=>[p,q[(i+1)%4]]);}
function wallFaceSegs(){const L=[];M.walls.forEach(w=>{const ext=wallExt(w);wallPieces(w,ext).forEach(([s0,s1])=>{const q=pieceQuad(w,s0,s1);L.push([q[0],q[1]],[q[3],q[2]],[q[1],q[2]],[q[3],q[0]]);});});
  rooms.forEach(r=>r.net.forEach((p,i)=>L.push([p,r.net[(i+1)%r.net.length]])));return L;}
function rayHit(o,u,faces,minT){let best=null;for(const [a,b] of faces){const e=sub(b,a),den=cross(u,e);if(Math.abs(den)<1e-9)continue;const ao=sub(a,o);
  const t=cross(ao,e)/den,sg=cross(ao,u)/den;if(sg<-1e-6||sg>1+1e-6||t<minT||t>30000)continue;if(!best||t<best)best=t;}return best;}
// distances from each side of the column to the nearest wall face or other column
const COL_DIRS=[['left','Left',0,-1],['right','Right',0,1],['up','Top',1,-1],['down','Bottom',1,1]];
function colRays(c,excl){const ax=colAxes(c),h=colHalf(c);const faces=wallFaceSegs();(M.cols||[]).forEach(o=>{if(o.id!==excl&&o.id!==c.id)faces.push(...colEdges(o));});
  const o=[c.x,c.y];const out={};
  COL_DIRS.forEach(([k,label,i,sg])=>{const u=mul(ax[i],sg),half=h[i];const t=rayHit(o,u,faces,0.5);out[k]=t==null?null:{u,half,t,d:t-half,label};});return out;}
// Every side of every wall piece (and of other columns), with the point its material lies toward, plus wall centrelines.
function snapFaces(excl){const F=[];
  M.walls.forEach(w=>{const ext=wallExt(w);wallPieces(w,ext).forEach(([s0,s1])=>{const q=pieceQuad(w,s0,s1),ctr=mul(add(q[0],q[2]),.5);
    q.forEach((p,i)=>F.push({a:p,b:q[(i+1)%4],inner:ctr,kind:'wall'}));F.push({a:mul(add(q[0],q[3]),.5),b:mul(add(q[1],q[2]),.5),kind:'centre'});});});
  (M.cols||[]).forEach(o=>{if(o.id===excl||o.shape==='round')return;const q=colCorners(o),ctr=[o.x,o.y];q.forEach((p,i)=>F.push({a:p,b:q[(i+1)%4],inner:ctr,kind:'col'}));});
  return F;}
// The column follows the pointer freely; each axis only clicks to a position when it is within a few pixels of it:
// the set gap from a wall (negative = into the wall), touching a wall face, flush with the far face, or centred in the wall.
function colSnap(c,p,excl){const n=Object.assign({},c,{x:p[0],y:p[1]});const guides=[];
  if(!snapOn)return {c:n,kind:'',guides};
  const ax=colAxes(n),h=colHalf(n),gap=c.gap==null?colDefaults.gap:c.gap,tol=7/view.s,F=snapFaces(excl),labels=[];
  [0,1].forEach(i=>{const u=ax[i],v=ax[1-i],half=h[i],lat=h[1-i],o=[n.x,n.y];let best=null;
    const consider=(dl,label)=>{if(Math.abs(dl)<tol&&(!best||Math.abs(dl)<Math.abs(best.d)-0.01))best={d:dl,label};};
    for(const f of F){const fd=norm(sub(f.b,f.a));if(Math.abs(dot(fd,u))>0.02)continue;
      const l0=dot(sub(f.a,o),v),l1=dot(sub(f.b,o),v);if(Math.max(l0,l1)<-lat-300||Math.min(l0,l1)>lat+300)continue;
      const e=dot(sub(f.a,o),u);
      if(f.kind==='centre'){if(c.shape!=='round'||true)consider(e,'centred in wall');continue;}
      const m=dot(sub(f.inner,f.a),u),own=f.kind==='col'?'column':'wall';
      consider(e-half,m>0?'touching '+own:'flush with '+own+' face');consider(e+half,m<0?'touching '+own:'flush with '+own+' face');
}
    if(best){n.x+=u[0]*best.d;n.y+=u[1]*best.d;labels.push(best.label);}
    else if(Math.abs(u[0])>0.999)n.x=Math.round(n.x/lenStep())*lenStep();else if(Math.abs(u[1])>0.999)n.y=Math.round(n.y/lenStep())*lenStep();});
  // line up with other columns
  if(Math.abs(n.r%90)<1e-6&&labels.length<2){const at=10/view.s;
    const ox=(M.cols||[]).find(o=>o.id!==excl&&Math.abs(o.x-n.x)<at),oy=(M.cols||[]).find(o=>o.id!==excl&&Math.abs(o.y-n.y)<at);
    if(ox&&!labels.length){n.x=ox.x;guides.push([[ox.x,ox.y],[n.x,n.y]]);labels.push('in line with column');}
    if(oy&&labels.length<2){n.y=oy.y;guides.push([[oy.x,oy.y],[n.x,n.y]]);if(!labels.includes('in line with column'))labels.push('in line with column');}}
  return {c:n,kind:[...new Set(labels)].join(' · '),guides};}
// Where a column side lies exactly on a wall (or column) face: drawn as a connection.
function colContacts(c){const out=[];const F=snapFaces(c.id).filter(f=>f.kind!=='centre');
  if(c.shape==='round'){const r=c.w/2;F.forEach(f=>{const q=segClosest([c.x,c.y],f.a,f.b);if(q.t>0&&q.t<1&&Math.abs(dist([c.x,c.y],q.q)-r)<0.6)out.push({pt:q.q,dir:norm(sub(f.b,f.a))});});return out;}
  const Q=colCorners(c);Q.forEach((p,i)=>{const q=Q[(i+1)%4],d=norm(sub(q,p));
    F.forEach(f=>{const fd=norm(sub(f.b,f.a));if(Math.abs(cross(d,fd))>1e-3)return;if(Math.abs(dot(sub(f.a,p),perp(d)))>0.6)return;
      const t0=Math.max(0,Math.min(dot(sub(f.a,p),d),dot(sub(f.b,p),d))),t1=Math.min(dist(p,q),Math.max(dot(sub(f.a,p),d),dot(sub(f.b,p),d)));
      if(t1-t0>1)out.push({a:add(p,mul(d,t0)),b:add(p,mul(d,t1)),dir:d});});});
  return out;}
function drawContacts(c){const cs=colContacts(c);if(!cs.length)return;ctx.save();ctx.strokeStyle=C.accent;ctx.fillStyle=C.accent;ctx.lineCap='round';
  cs.forEach(k=>{if(k.pt){const q=toS(k.pt);ctx.beginPath();ctx.arc(q[0],q[1],4,0,Math.PI*2);ctx.fill();return;}
    const a=toS(k.a),b=toS(k.b);ctx.lineWidth=3.5;ctx.beginPath();ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);ctx.stroke();
    const nx=-(b[1]-a[1]),ny=b[0]-a[0],L=Math.hypot(nx,ny)||1;ctx.lineWidth=1.5;
    [a,b].forEach(q=>{ctx.beginPath();ctx.moveTo(q[0]-nx/L*6,q[1]-ny/L*6);ctx.lineTo(q[0]+nx/L*6,q[1]+ny/L*6);ctx.stroke();});});
  ctx.restore();}
/* pillars set into a wall: kept as a distance along the wall (s) and an offset across it, so they follow the wall */
function syncHostedCols(){(M.cols||[]).forEach(c=>{if(!c.wall)return;const w=wallById(c.wall);if(!w){delete c.wall;delete c.s;delete c.off;return;}
  const d=wallDir(w),n=perp(d),p=add(add(w.a,mul(d,c.s)),mul(n,c.off||0));c.x=p[0];c.y=p[1];c.r=Math.round(Math.atan2(d[1],d[0])*180/Math.PI*1000)/1000;});}
function sideNames(w){const n=perp(wallDir(w));if(Math.abs(n[1])>=Math.abs(n[0]))return n[1]>0?{plus:'bottom',minus:'top'}:{plus:'top',minus:'bottom'};return n[0]>0?{plus:'right',minus:'left'}:{plus:'left',minus:'right'};}
function hostSlot(p,c,excl,reach){let best=null,bd=1e18;
  for(const w of M.walls){const q=segClosest(p,w.a,w.b).q,dd=dist(p,q);const lim=reach||Math.max(w.t/2+60,24/view.s);if(dd>=lim)continue;
    const sc=c.align==='keep'&&w.id===c.wall?dd-(w.t/2+120):dd;if(sc<bd){bd=sc;best=w;}}
  if(!best)return null;const w=best,d=wallDir(w),n=perp(d),L=wallLen(w),ext=wallExt(w);
  let s=clamp(dot(sub(p,w.a),d),-ext[0],L+ext[1]);const side=dot(sub(p,w.a),n)>=0?1:-1;let kind='in wall';
  if(snapOn){const tol=12/view.s,cw=c.w;const cands=[[ext[0]+cw/2,'flush with corner'],[L-ext[1]-cw/2,'flush with corner'],[0,'on corner'],[L,'on corner'],[(ext[0]+L-ext[1])/2,'middle of wall']];
    (M.cols||[]).forEach(o=>{if(o.wall===w.id&&o.id!==excl)cands.push([o.s+o.w/2+cw/2,'next to column'],[o.s-o.w/2-cw/2,'next to column']);});
    wallJunctions(w).forEach(([x,y])=>cands.push([x-cw/2,'flush with corner'],[y+cw/2,'flush with corner'],[(x+y)/2,'on junction']));
    M.openings.forEach(o=>{if(o.wall===w.id)cands.push([o.s+o.w/2+cw/2,'beside opening'],[o.s-o.w/2-cw/2,'beside opening']);});
    let bc=null,bdc=tol;for(const [v,k] of cands)if(Math.abs(v-s)<bdc){bdc=Math.abs(v-s);bc=[v,k];}
    if(bc){s=bc[0];kind=bc[1];}else{const f=ext[0]+cw/2;s=f+Math.round((s-f)/lenStep())*lenStep();}}
  const off=c.align==='keep'&&c.wall===w.id?(c.off||0):c.align==='face'?side*(w.t/2-c.d/2):0;
  return {w,s,off,side,kind};}
// clear distance along the wall from each end of the pillar to the corner, an opening or another pillar
function wallJunctions(w){const d=wallDir(w),L=wallLen(w),out=[];
  M.walls.forEach(o=>{if(o===w)return;['a','b'].forEach(k=>{const q=segClosest(o[k],w.a,w.b);if(q.t>0.001&&q.t<0.999&&dist(o[k],q.q)<1){const sj=q.t*L;const od=wallDir(o);const half=o.t/2/Math.max(0.2,Math.abs(cross(d,od)));out.push([sj-half,sj+half]);}});});
  return out;}
function hostedSpan(c){const w=c.wall&&wallById(c.wall);if(!w)return null;const L=wallLen(w),ext=wallExt(w),a0=c.s-c.w/2,a1=c.s+c.w/2;
  const iv=wallJunctions(w);(M.cols||[]).forEach(o=>{if(o.wall===w.id&&o.id!==c.id)iv.push([o.s-o.w/2,o.s+o.w/2]);});M.openings.forEach(o=>{if(o.wall===w.id)iv.push([o.s-o.w/2,o.s+o.w/2]);});
  let lo=ext[0]<=a0+0.5?ext[0]:null,hi=L-ext[1]>=a1-0.5?L-ext[1]:null;
  iv.forEach(([x,y])=>{if(y<=a0+0.5&&(lo==null||y>lo))lo=y;if(x>=a1-0.5&&(hi==null||x<hi))hi=x;});return {w,lo,hi,a0,a1};}
function drawHostedDims(c,color,side){if(!MEAS.edit)return;const H=hostedSpan(c);if(!H)return;const w=H.w,d=wallDir(w),n=perp(d),sg=side||-1;
  const off=Math.max(w.t/2,c.d/2+sg*(c.off||0))+Math.max(250,22/view.s),P=u=>add(w.a,mul(d,u)),nn=mul(n,sg);
  if(H.lo!=null&&H.a0-H.lo>0.5)dimLine(P(H.lo),P(H.a0),nn,off,fmtLen(H.a0-H.lo),color);
  dimLine(P(H.a0),P(H.a1),nn,off,fmtLen(H.a1-H.a0),color);
  if(H.hi!=null&&H.hi-H.a1>0.5)dimLine(P(H.a1),P(H.hi),nn,off,fmtLen(H.hi-H.a1),color);}
function drawColumn(c,state){const q=toS([c.x,c.y]);const [hx,hy]=colHalf(c);const w=hx*2*view.s,d=hy*2*view.s;
  ctx.save();ctx.translate(q[0],q[1]);ctx.rotate(c.r*Math.PI/180);if(state==='ghost')ctx.globalAlpha=.75;
  ctx.beginPath();if(c.shape==='round')ctx.arc(0,0,w/2,0,Math.PI*2);else ctx.rect(-w/2,-d/2,w,d);
  ctx.fillStyle=C.col;ctx.fill();
  ctx.save();ctx.clip();ctx.strokeStyle=C['col-hatch'];ctx.lineWidth=1;ctx.beginPath();const m=Math.max(w,d);for(let k=-m;k<=m;k+=6){ctx.moveTo(k-m,m);ctx.lineTo(k+m,-m);}ctx.stroke();ctx.restore();
  ctx.beginPath();if(c.shape==='round')ctx.arc(0,0,w/2,0,Math.PI*2);else ctx.rect(-w/2,-d/2,w,d);
  ctx.lineWidth=state==='normal'?1:2;ctx.strokeStyle=state==='normal'?C.poche:C.accent;ctx.stroke();ctx.restore();}
function drawColDims(c,excl,color){if(!MEAS.edit)return;const rays=colRays(c,excl);drawContacts(c);
  COL_DIRS.forEach(([k])=>{const r=rays[k];if(!r||r.t>15000)return;const o=[c.x,c.y];const a=add(o,mul(r.u,r.half)),b=add(o,mul(r.u,r.t));
    if(Math.abs(r.d)<0.6)return;
    if(r.d<0){drawMeasure(b,a,color,{width:1.3,label:fmtLen(-r.d)+' in'});return;}
    drawMeasure(a,b,color,{width:1.3});});}
/* ruler: measure between two points, optionally keep as a dimension */
let ruler=null; // {a, b|null, cur, snapA, snapB, down}
function measurePoints(){const pts=[];
  M.walls.forEach(w=>{const ext=wallExt(w);wallPieces(w,ext).forEach(([s0,s1])=>pts.push(...pieceQuad(w,s0,s1)));});
  rooms.forEach(r=>pts.push(...r.net));
  M.items.forEach(it=>[[-1,-1],[1,-1],[1,1],[-1,1]].forEach(([x,y])=>pts.push(add([it.x,it.y],rotV([x*it.w/2,y*it.d/2],it.r)))));
  M.dims.forEach(d=>pts.push(d.a,d.b));(M.cols||[]).forEach(c=>pts.push(...colCorners(c),[c.x,c.y]));return pts;}
function measureFaces(){const L=[];M.walls.forEach(w=>{const ext=wallExt(w);wallPieces(w,ext).forEach(([s0,s1])=>{const q=pieceQuad(w,s0,s1);L.push([q[0],q[1]],[q[3],q[2]]);});});
  rooms.forEach(r=>r.net.forEach((p,i)=>L.push([p,r.net[(i+1)%r.net.length]])));(M.cols||[]).forEach(c=>{if(c.shape!=='round')L.push(...colEdges(c));});return L;}
function measureSnap(raw,from){
  const tol=(ptrTouch?16:10)/view.s;
  if(snapOn){let best=null,bd=tol;
    for(const q of measurePoints()){const d=dist(raw,q);if(d<bd){bd=d;best=q;}}
    if(best)return {p:best.slice(),kind:'corner'};
    const rs=refSnap(raw,tol);if(rs)return rs;
    let face=null,fd=tol;
    for(const [a,b] of measureFaces()){const c=segClosest(raw,a,b);const d=dist(raw,c.q);if(d<fd){fd=d;face={a,b,q:c.q};}}
    if(face){if(from){const d=norm(sub(face.b,face.a));const F=add(face.a,mul(d,dot(sub(from,face.a),d)));if(dist(F,raw)<tol*4&&dist(F,from)>1)return {p:F,kind:'square to face'};}
      return {p:face.q,kind:'on face'};}
    if(from&&!shiftDown){const v=sub(raw,from);const L=vlen(v);if(L>0){let a=Math.atan2(v[1],v[0]);a=Math.round(a/(Math.PI/12))*(Math.PI/12);const d=[Math.cos(a),Math.sin(a)];
      return {p:add(from,mul(d,dot(v,d))),kind:'angle'};}}}
  return {p:raw.slice(),kind:'free'};}
function rulerEnd(){return ruler?(ruler.b||ruler.cur):null;}
function drawMeasure(a,b,color,opts={}){
  const sa=toS(a),sb=toS(b),L=dist(a,b);if(L<1)return;const ang=Math.atan2(sb[1]-sa[1],sb[0]-sa[0]);const nx=-Math.sin(ang)*6,ny=Math.cos(ang)*6;
  ctx.save();ctx.strokeStyle=color;ctx.lineWidth=opts.width||1.6;
  if(opts.legs&&Math.abs(a[0]-b[0])>1&&Math.abs(a[1]-b[1])>1){const c=toS([b[0],a[1]]);ctx.setLineDash([3,4]);ctx.lineWidth=1;ctx.globalAlpha=.7;
    ctx.beginPath();ctx.moveTo(sa[0],sa[1]);ctx.lineTo(c[0],c[1]);ctx.lineTo(sb[0],sb[1]);ctx.stroke();ctx.setLineDash([]);ctx.globalAlpha=1;ctx.lineWidth=opts.width||1.6;
    txt(fmtLen(Math.abs(b[0]-a[0])),[(sa[0]+c[0])/2,(sa[1]+c[1])/2+(c[1]>sa[1]?-9:9)],{mono:true,size:10,color,halo:C.paper});
    txt(fmtLen(Math.abs(b[1]-a[1])),[(c[0]+sb[0])/2+(sb[0]<c[0]?10:-10),(c[1]+sb[1])/2],{mono:true,size:10,color,halo:C.paper,align:sb[0]<c[0]?'left':'right'});}
  ctx.beginPath();ctx.moveTo(sa[0],sa[1]);ctx.lineTo(sb[0],sb[1]);
  for(const q of [sa,sb]){ctx.moveTo(q[0]-nx,q[1]-ny);ctx.lineTo(q[0]+nx,q[1]+ny);}ctx.stroke();
  const label=opts.label||fmtLen(L,opts.unit);let ta=ang;if(ta>Math.PI/2||ta<-Math.PI/2)ta+=Math.PI;const m=[(sa[0]+sb[0])/2,(sa[1]+sb[1])/2];
  if(opts.pill){ctx.font='500 11.5px "IBM Plex Mono", ui-monospace, monospace';const w=ctx.measureText(label).width+14;ctx.translate(m[0],m[1]);ctx.rotate(ta);ctx.translate(0,-14);
    ctx.fillStyle=color;ctx.beginPath();ctx.roundRect?ctx.roundRect(-w/2,-10,w,20,10):ctx.rect(-w/2,-10,w,20);ctx.fill();ctx.fillStyle=C.paper;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(label,0,0.5);}
  else txt(label,[m[0]-Math.sin(ta)*9,m[1]+Math.cos(ta)*-9],{rot:ta,mono:true,size:10.5,color,halo:C.paper});
  ctx.restore();}
function keepRuler(){if(!ruler||!ruler.b||dist(ruler.a,ruler.b)<1)return;const d={id:nid('m'),a:ruler.a.map(v=>Math.round(v*10)/10),b:ruler.b.map(v=>Math.round(v*10)/10)};
  mutate(()=>M.dims.push(d));ruler=null;renderInspector();dirty();toast('Kept as a dimension. Select it with the Pointer to delete it.');}
function updatePreview(p){
  if(tool==='area'){areaToolMove(p);dirty();}
  if(tool==='arcwall'){arcToolMove(p);if(arcDraw.b&&!lenbox.hidden)positionLenbox();dirty();}
  if(tool==='wall'){snapInfo=snapPoint(p,draw.start);$('#snapchip').textContent=snapInfo.kind==='free'?'':snapInfo.kind;
    if(draw.start&&!$('#lenbox').hidden)positionLenbox();dirty();}
  if(tool==='door'||tool==='window'){const w=nearestWall(p,16);ghost=null;if(w){const slide=tool==='door'&&placeType==='slide';const width=slide?slideDefaults.w:tool==='door'?swingDefaults.w:1200;const sl=openingSlot(p,w,width);
      if(sl){ghost={id:'ghost',wall:w.id,s:sl.s,w:width,kind:tool,h:tool==='door'?2100:1200,sill:tool==='door'?0:1000,flip:dot(sub(p,w.a),perp(wallDir(w)))<0?1:0,hinge:0};if(slide)ghost.style=slideDefaults.style;}}dirty();}
  if(tool==='paste'){pasteOff=pasteOffsetFor(p);$('#snapchip').textContent=openingOnly()?(pasteOff?'':'move onto a wall'):pasteSnap;dirty();}
  if(tool==='column'&&colGhost){
    if(colGhost.place==='wall'){const sl=hostSlot(p,colGhost,null);
      if(sl){const d=wallDir(sl.w),n=perp(d),q=add(add(sl.w.a,mul(d,sl.s)),mul(n,sl.off));Object.assign(colGhost,{x:q[0],y:q[1],r:Math.atan2(d[1],d[0])*180/Math.PI,wall:sl.w.id,s:sl.s,off:sl.off,side:sl.side,on:true,guides:[]});$('#snapchip').textContent=sl.kind;}
      else{colGhost.on=false;colGhost.wall=null;$('#snapchip').textContent='move onto a wall';}}
    else{const sn=colSnap(colGhost,p,null);Object.assign(colGhost,{x:sn.c.x,y:sn.c.y,r:sn.c.r,on:true,guides:sn.guides,wall:null});$('#snapchip').textContent=sn.kind;}
    dirty();}
  if(tool==='ruler'){const from=ruler&&!ruler.b?ruler.a:null;const sn=measureSnap(p,from);snapInfo=sn;if(from){ruler.cur=sn.p;ruler.snapB=sn;renderRulerInfo();}
    $('#snapchip').textContent=sn.kind==='free'||sn.kind==='angle'?'':sn.kind;dirty();}
  if(tool==='place'&&ghost){const r=fixtureSnap(p,ghost);ghost.x=r.x;ghost.y=r.y;if(r.snapped)ghost.r=r.r;$('#snapchip').textContent=r.snapped?'wall face':'';dirty();}}
function openingSlotLoose(p,w,width){const L=wallLen(w),ext=wallExt(w);const c=segClosest(p,w.a,w.b);const lo=ext[0]+width/2,hi=L-ext[1]-width/2;if(hi<lo)return null;return {s:clamp(Math.round(c.t*L/lenStep())*lenStep(),lo,hi)};}
function endPointer(e){
  if(eraseOn){eraseEnd();}
  if(tool==='ruler'&&ruler&&ruler.down){const sp=evPoint(e);if(!ruler.b&&Math.hypot(sp[0]-ruler.down[0],sp[1]-ruler.down[1])>8&&dist(ruler.cur,ruler.a)>1){ruler.b=ruler.cur;renderInspector();}ruler.down=null;dirty();}
  if(e.pointerType==='touch'){touches.delete(e.pointerId);if(pinch){if(touches.size<2)pinch=null;return;}}
  if(box){const b=box;box=null;dirty();
    if(Math.hypot(b.s1[0]-b.s0[0],b.s1[1]-b.s0[1])<5){if(!b.add){sel=b.hit&&b.hit.kind==='room'?b.hit:null;if(sel){elevPt=sel.pt.slice();fillElevSelect();}renderInspector();}return;}
    const found=wallsInBox(toW(b.s0),toW(b.s1),b.s1[0]<b.s0[0]);setSelWalls(b.add?[...selIds(),...found]:found);
    $('#snapchip').textContent=found.length?found.length+' wall'+(found.length>1?'s':'')+' selected':'';return;}
  if(pan){if(pan.click){sel=pan.hit&&pan.hit.kind==='room'?pan.hit:null;if(sel){elevPt=sel.pt.slice();fillElevSelect();}renderInspector();dirty();}pan=null;return;}
  if(drag&&!drag.moved){ // a click, not a drag
    if(drag.kind==='group'){drag.toggle?toggleSelWall(drag.clickId):setSelWalls([drag.clickId]);drag=null;return;}
    if(drag.toggleFrom!==undefined){sel=drag.toggleFrom;toggleSelWall(drag.id);drag=null;return;}}
  if(drag&&drag.moved&&drag.kind==='end'&&drag.snap&&['end','on wall','to wall','mid'].includes(drag.snap.kind)){ // dropped onto another wall: join it
    const q=drag.snap.p;drag.links.forEach(([w,k])=>setLoose(w,k,false));M.walls.forEach(o=>['a','b'].forEach(k=>{if(dist(o[k],q)<1)setLoose(o,k,false);}));}
  if(drag&&drag.moved&&(drag.kind==='arcmid'||drag.kind==='arcend')){const q=arcById(drag.id);if(q&&q.auto!==false){q.n=autoSegs(q.a,q.b,q.s);regenArc(q);}}
  if(drag&&drag.keepRoom){sel={kind:'room',pt:drag.keepRoom};}
  if(drag){$('#snapchip').textContent='';if(drag.moved){pushUndo(drag.snap0);
      if(drag.kind==='end'){M.walls=M.walls.filter(w=>wallLen(w)>5);}changed();}drag=null;dirty();}}
planCv.addEventListener('pointerup',endPointer);planCv.addEventListener('pointercancel',endPointer);
planCv.addEventListener('dblclick',()=>{if(tool==='wall'){draw.start=null;draw.chainStart=null;dirty();}
  if(tool==='area'){const A=areaDraw;if(A.pts.length>=3){finishArea();return;}
    const r=roomAt(cursor);A.pts=[];if(!r){toast('Double-click inside a room to take its outline, or click the corners of the shape.');renderInspector();dirty();return;}
    const o=areaFromRoom(r);if(!o)return;const n=(M.areas||[]).length+1;const B={id:nid('g'),name:r.name||'Area '+n,pts:o.pts.map(p=>p.map(v=>Math.round(v*10)/10)),b:o.b};
    mutate(()=>{M.areas.push(B);});setTool('select');sel={kind:'area',id:B.id};renderInspector();dirty();toast(B.name+': '+fmtArea(areaStats(B).area)+' '+areaU()+' measured.');return;}
  if(tool==='select'){const ht=hitText(cursor);if(ht){const T=textById(ht.id);sel=ht;renderInspector();openTextEditor(null,T);return;}}
  if(tool==='select'&&sel&&sel.kind==='area'){const A=areaById(sel.id);if(!A)return;const h=hitArea(cursor);
    if(h&&h.kind==='areapt'){if(A.pts.length<=3){toast('An area needs at least 3 corners.');return;}mutate(()=>{A.pts.splice(h.idx,1);if(A.b){A.b.splice(h.idx,1);}});renderInspector();return;}
    // add a corner on the edge nearest the pointer
    let best=-1,bd=(ptrTouch?16:10)/view.s;for(let i=0;i<A.pts.length;i++){const [p,q,sg]=areaEdge(A,i);if(Math.abs(sg)>=0.5)continue;const c=segClosest(cursor,p,q);const d=dist(cursor,c.q);if(d<bd){bd=d;best=i;}}
    if(best>=0){const c=segClosest(cursor,A.pts[best],A.pts[(best+1)%A.pts.length]).q;mutate(()=>{A.pts.splice(best+1,0,c.map(v=>Math.round(v*10)/10));if(!A.b)A.b=A.pts.map(()=>0);else A.b.splice(best+1,0,0);});renderInspector();}}});
planCv.addEventListener('pointerleave',()=>{if(tool==='door'||tool==='window'){ghost=null;dirty();}if(colGhost){colGhost.on=false;dirty();}});
planCv.addEventListener('wheel',e=>{e.preventDefault();const sp=evPoint(e);
  const pinch=e.ctrlKey;const mouseWheel=!pinch&&e.deltaX===0&&(e.deltaMode===1||Math.abs(e.deltaY)>=50&&Number.isInteger(e.deltaY));
  if(pinch||mouseWheel){const k=Math.exp(-e.deltaY*(pinch?0.01:0.0015));const w=toW(sp);view.s=clamp(view.s*k,0.008,3);view.ox=sp[0]-w[0]*view.s;view.oy=sp[1]-w[1]*view.s;}
  else{view.ox-=e.deltaX;view.oy-=e.deltaY;}dirty();},{passive:false});

/* length entry */
const lenbox=$('#lenbox'),lenInput=$('#lenInput');
function positionLenbox(){const s=toS(cursor);const r=planCv.getBoundingClientRect();lenbox.style.left=clamp(s[0]+16,4,r.width-180)+'px';lenbox.style.top=clamp(s[1]+16,4,r.height-40)+'px';}
function showLenbox(ch){lenbox.hidden=false;lenInput.value=ch;positionLenbox();lenInput.placeholder={mm:'3600 or 3600<90',cm:'360 or 360<90',m:'3.6 or 3.6<90'}[units]||"12'6 or 12'6<90";lenInput.focus();}
function hideLenbox(){if(!lenbox.hidden){lenbox.hidden=true;planCv.focus({preventScroll:true});}}
lenInput.addEventListener('keydown',e=>{e.stopPropagation();
  if(e.key==='Enter'&&tool==='arcwall'){const L=parseLen(lenInput.value);
    if(arcDraw.a&&!arcDraw.b&&L>100){const sn=snapPoint(cursor,arcDraw.a);let d=sn.dir||norm(sub(sn.p,arcDraw.a));if(vlen(sub(sn.p,arcDraw.a))<1)d=[1,0];arcDraw.b=add(arcDraw.a,mul(d,L));arcDraw.s=0;}
    else if(arcDraw.b&&L>0){const c=dist(arcDraw.a,arcDraw.b);if(L<c/2-0.5)toast('The radius must be at least half the distance between the ends ('+fmtLen(c/2,true)+').');else makeArc((Math.sign(arcDraw.s)||1)*(L-Math.sqrt(Math.max(0,L*L-c*c/4))));}
    hideLenbox();renderInspector();dirty();return;}
  if(e.key==='Enter'){const parts=lenInput.value.split('<');const L=parseLen(parts[0]);if(draw.start&&L>0){const sn=snapPoint(cursor,draw.start);let d=sn.dir||norm(sub(sn.p,draw.start));if(vlen(sub(sn.p,draw.start))<1)d=[1,0];
      if(parts.length>1&&isFinite(parseFloat(parts[1]))){const a=-parseFloat(parts[1])*Math.PI/180;d=[Math.cos(a),Math.sin(a)];if(Math.abs(d[0])<1e-9)d[0]=0;if(Math.abs(d[1])<1e-9)d[1]=0;}
      const a=draw.start,b=add(a,mul(d,L));mutate(()=>addWall(a,b));draw.start=b;}hideLenbox();dirty();}
  else if(e.key==='Escape'){hideLenbox();}});
lenInput.addEventListener('blur',()=>{setTimeout(()=>{if(document.activeElement!==lenInput){lenbox.hidden=true;dirty();}},150);});
$('#lenBtn').addEventListener('click',()=>{if(draw.start){showLenbox('');}});

window.addEventListener('keydown',e=>{
  const tag=(e.target.tagName||'').toLowerCase();if(tag==='input'||tag==='select'||tag==='textarea')return;
  if(!$('#modal').hidden){if(e.key==='Escape')closeModal();return;}
  if(e.key===' '){spaceDown=true;if(e.target===planCv)e.preventDefault();return;}
  if(e.key==='Shift')shiftDown=true;
  const mod=e.ctrlKey||e.metaKey;
  if(mod&&e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?redo():undo();return;}
  if(mod&&e.key.toLowerCase()==='y'){e.preventDefault();redo();return;}
  if(mod&&e.key.toLowerCase()==='c'){if(sel){e.preventDefault();copySel();}return;}
  if(mod&&e.key.toLowerCase()==='v'){e.preventDefault();startPaste();return;}
  if(mod&&e.key.toLowerCase()==='d'){if(sel){e.preventDefault();if(copySel(true))startPaste();}return;}
  if(mod&&e.key.toLowerCase()==='a'&&tool==='select'){e.preventDefault();setSelWalls(M.walls.map(w=>w.id));return;}
  if(mod)return;
  if(tool==='wall'&&draw.start&&/^[0-9.]$/.test(e.key)){e.preventDefault();showLenbox(e.key);return;}
  if(tool==='arcwall'&&arcDraw.a&&/^[0-9.]$/.test(e.key)){e.preventDefault();showLenbox(e.key);lenInput.placeholder=arcDraw.b?'radius':'distance to the end';return;}
  if(tool==='arcwall'&&e.key==='Escape'&&arcDraw.a){arcDraw={a:null,b:null,s:0};dirty();return;}
  const k=e.key.toLowerCase();
  const arrows={arrowleft:[-1,0],arrowright:[1,0],arrowup:[0,-1],arrowdown:[0,1]};
  if(arrows[k]&&sel&&tool==='select'){e.preventDefault();nudge(arrows[k],e.shiftKey?10:1);return;}
  if(tool==='ruler'&&k==='enter'&&ruler&&ruler.b){e.preventDefault();keepRuler();return;}
  if(tool==='area'&&areaDraw.pts.length){if(k==='enter'){e.preventDefault();finishArea();return;}if(k==='escape'){areaDraw={pts:[],cur:null,snap:null};renderInspector();dirty();return;}
    if(k==='backspace'){e.preventDefault();areaDraw.pts.pop();renderInspector();dirty();return;}}
  if(k==='escape'&&tool==='ruler'&&ruler){ruler=null;renderInspector();dirty();return;}
  if(k==='escape'&&laser.picking){laser.picking=false;$('#hint').innerHTML=HINTS[tool]||'';toast('Laser reading cancelled.');return;}
  if(k==='escape'){if(tool==='wall'&&draw.start){draw.start=null;draw.chainStart=null;}else{setTool('select');sel=null;renderInspector();}dirty();return;}
  if(k==='c')setTool('column');else if(k==='v')setTool('select');else if(k==='w')setTool('wall');else if(k==='d')setDoorType(doorType);else if(k==='n')setTool('window');else if(k==='l')setTool('ruler');else if(k==='a')setTool('arcwall');else if(k==='g')setTool('area');else if(k==='e'){if((refImage||refDrawing)&&refLeftover)setTool('erase');}else if(k==='t')setTool('text');
  else if(k==='f')fit();
  else if(k==='s')setSnap(!snapOn);
  else if(k==='m')setFree(!freeMove);
  else if(k==='r'){if(tool==='column'&&colGhost){colGhost.r=((colGhost.r||0)+90)%360;colDefaults.r=colGhost.r;renderInspector();dirty();}else if(sel&&sel.kind==='col'){mutate(()=>{const c=colById(sel.id);if(c.wall){const t=c.w;c.w=c.d;c.d=t;}else c.r=(c.r+90)%360;});}else if(tool==='place'&&ghost){ghost.r=(ghost.r+90)%360;dirty();}else if(sel&&sel.kind==='item'){mutate(()=>{const it=M.items.find(x=>x.id===sel.id);it.r=(it.r+90)%360;});}
    else if(sel&&sel.kind==='opening'){mutate(()=>{const o=M.openings.find(x=>x.id===sel.id);if(o.kind==='door'){if(o.hinge)o.flip^=1;o.hinge^=1;}});}}
  else if((k==='delete'||k==='backspace')&&sel)deleteSel();});
window.addEventListener('keyup',e=>{if(e.key===' ')spaceDown=false;if(e.key==='Shift')shiftDown=false;});
let lastNudge=0;
function nudge(v,mult){
  const step=lenStep()*mult,before=snapshot(),now=Date.now(),newBurst=now-lastNudge>900;lastNudge=now;let did=false,msg='';
  if(sel.kind==='text'){const T=textById(sel.id);if(T){T.x+=v[0]*step;T.y+=v[1]*step;did=true;msg='text moved '+fmtLen(step);}}
  if(sel.kind==='area'){const A=areaById(sel.id);if(A){A.pts=A.pts.map(q=>add(q,mul(v,step)));did=true;msg='area moved '+fmtLen(step);}}
  if(sel.kind==='arc'){const q=arcById(sel.id);if(q){applyGroupMove(groupMoveSet(new Set(arcSegs(q).map(w=>w.id))),mul(v,step));did=true;msg='curved wall moved '+fmtLen(step);}}
  if(sel.kind==='walls'){applyGroupMove(groupMoveSet(selIds()),mul(v,step));did=true;msg=sel.ids.length+' walls moved '+fmtLen(step);}
  if(sel.kind==='wall'){const w=wallById(sel.id);if(w){const set=wallMoveSet(w);applyWallMove(w,set,mul(v,step));did=true;msg='wall moved '+fmtLen(step);}}
  if(sel.kind==='col'){const c=colById(sel.id);if(c){if(c.wall){const w=wallById(c.wall),d=wallDir(w),n=perp(d);const a=dot(v,d),b=dot(v,n);
      if(Math.abs(a)>0.5)c.s+=Math.sign(a)*step;else c.off=(c.off||0)+Math.sign(b)*step;syncHostedCols();}else{c.x+=v[0]*step;c.y+=v[1]*step;}did=true;msg='column moved '+fmtLen(step);}}
  if(sel.kind==='item'){const it=M.items.find(x=>x.id===sel.id);if(it){it.x+=v[0]*step;it.y+=v[1]*step;did=true;msg='moved '+fmtLen(step);}}
  if(sel.kind==='opening'){const o=M.openings.find(x=>x.id===sel.id),w=o&&wallById(o.wall);if(w){const a=dot(v,wallDir(w));if(Math.abs(a)>0.5){o.s+=Math.sign(a)*step;did=true;msg='moved '+fmtLen(step);}}}
  if(did){if(newBurst)pushUndo(before);changed();}
  if(msg){$('#snapchip').textContent=msg;clearTimeout(nudge.t);nudge.t=setTimeout(()=>$('#snapchip').textContent='',1400);}}
function deleteSel(){if(!sel)return;const s=sel;if(s.kind==='room'){const r=selRoom();if(r)deleteRoom(r);sel=null;renderInspector();return;}mutate(()=>{
  if(s.kind==='arc'){const q=arcById(s.id);if(q){const ids=new Set(arcSegs(q).map(w=>w.id));M.walls=M.walls.filter(w=>!ids.has(w.id));M.openings=M.openings.filter(o=>!ids.has(o.wall));M.arcs=M.arcs.filter(x=>x!==q);}}
  if(s.kind==='wall'||s.kind==='walls'){const ids=new Set(s.kind==='wall'?[s.id]:s.ids);M.walls=M.walls.filter(w=>!ids.has(w.id));M.openings=M.openings.filter(o=>!ids.has(o.wall));}
  if(s.kind==='opening')M.openings=M.openings.filter(o=>o.id!==s.id);
  if(s.kind==='item')M.items=M.items.filter(o=>o.id!==s.id);
  if(s.kind==='dim')M.dims=M.dims.filter(o=>o.id!==s.id);
  if(s.kind==='area')M.areas=M.areas.filter(o=>o.id!==s.id);
  if(s.kind==='text')M.texts=M.texts.filter(o=>o.id!==s.id);
  if(s.kind==='col')M.cols=M.cols.filter(o=>o.id!==s.id);});sel=null;renderInspector();}
function updateCoords(){$('#coords').textContent='x '+fmtLen(cursor[0])+' · y '+fmtLen(-cursor[1]);}

/* ============================== inspector & takeoff ============================== */
function field(label,id,val,type='len'){return `<label for="${id}">${label}</label><input id="${id}" data-type="${type}" value="${val}">`;}
function selectField(label,id,opts,val){return `<label for="${id}">${label}</label><select id="${id}">${Object.entries(opts).map(([k,v])=>`<option value="${k}"${k==val?' selected':''}>${v}</option>`).join('')}</select>`;}
function renderInspector(){
  const el=$('#inspector');let h='';
  if(!sel){
    if(tool==='ruler'){el.innerHTML=rulerPanel();bindRuler();return;}
    if(tool==='area'){el.innerHTML=areaToolPanel();bindAreaTool();return;}
    if(tool==='erase'){el.innerHTML=erasePanel();bindErase();return;}
    if(tool==='text'){el.innerHTML=textToolPanel();bindTextTool();return;}
    if(tool==='arcwall'){el.innerHTML=`<p class="h">New curved wall</p><div class="kv">${field('Thickness','wallT',fmtLen(defaults.t))}${field('Height','wallH',fmtLen(defaults.h))}</div>
      <p class="tip">${!arcDraw.a?'Click where the curved wall starts.':!arcDraw.b?'Click where it ends, or type the distance and press Enter.':'Move out from the line to bend it and click, or type a radius and press Enter.'}</p>`;bindInspector();return;}
    if(tool==='column'){el.innerHTML=colPanel(colDefaults,true);bindCol(colDefaults,true);return;}
    if(tool==='place'&&placeType==='firepit'){const f=firepitDefaults,rd=f.shape!=='rect';el.innerHTML=`<p class="h">New fire pit</p><div class="kv"><label>Shape</label><div class="seg" role="group" aria-label="Fire pit shape"><button id="fpRound" aria-pressed="${rd}">Circular</button><button id="fpRect" aria-pressed="${!rd}">Rectangular</button></div>
      ${rd?field('Radius','fpR',fmtLen(f.r)):field('Length','fpW',fmtLen(f.w))+field('Width','fpD',fmtLen(f.d))}</div><p class="tip">Click on the plan to place it. ${rd?'':'Press <kbd>R</kbd> to turn it 90°. '}Change shape and size later in its side panel.</p>`;
      const upd=()=>{if(ghost)applyFirepitShape(ghost,f.shape);renderInspector();dirty();};
      $('#fpRound').onclick=()=>{f.shape='round';upd();};$('#fpRect').onclick=()=>{f.shape='rect';upd();};
      const onc=(id,mn,fn)=>{const e=document.getElementById(id);if(e)e.onchange=()=>{const x=parseLen(e.value);if(x>=mn)fn(x);upd();};};
      onc('fpR',100,x=>f.r=x);onc('fpW',200,x=>f.w=x);onc('fpD',200,x=>f.d=x);return;}
    if(tool==='door'){const slide=doorType!=='swing';el.innerHTML=`<p class="h">New door</p><div class="dcards" role="radiogroup" aria-label="Door type">${doorCards().replace(/menuitemradio/g,'radio')}</div><div class="kv">${field('Width','sdW',fmtLen(curDoorW()))}</div>
      <p class="tip">Click on a wall to place it. ${slide?'Arrows show which way the panels slide; change the side and direction afterwards in its side panel.':'Change the swing side and hinge afterwards in its side panel.'} Placed doors can switch type with <b>Type</b> in their side panel.</p>`;
      el.querySelectorAll('[data-dtype]').forEach(b=>b.onclick=()=>setDoorType(b.dataset.dtype));
      $('#sdW').onchange=e=>{const v=parseLen(e.target.value);if(v>=400&&v<=6000){if(slide)slideDefaults.w=v;else swingDefaults.w=v;}renderInspector();};return;}
    if(tool==='wall'){const sp=curWallSpec();h=`<p class="h">New ${OUTW[placeType]?OUTW[placeType].label.toLowerCase()+'s':'walls'}</p><div class="kv">${field('Thickness','wallT',fmtLen(sp.t))}${field('Height','wallH',fmtLen(sp.h))}</div>${OUTW[placeType]?'<p class="tip">Draw it like a wall: click to start, click each corner, double-click to finish. Yard walls never form rooms. Put a gate in it with the Door tool.</p>':''}`;}
    else h=`<p class="h">Inspector</p><p class="empty">Select a wall, opening, fixture or room to edit it. Every length field takes typed values like <kbd>3600</kbd>, <kbd>3.6m</kbd> or <kbd>12'6"</kbd>.</p>`;
    el.innerHTML=h;bindInspector();return;}
  if(sel.kind==='arc'){const q=arcById(sel.id);if(!q){sel=null;return renderInspector();}el.innerHTML=arcPanel(q);bindArc(q);return;}
  if(sel.kind==='text'){const T=textById(sel.id);if(!T){sel=null;return renderInspector();}el.innerHTML=textPanel(T);bindText(T);return;}
  if(sel.kind==='area'){const A=areaById(sel.id);if(!A){sel=null;return renderInspector();}el.innerHTML=areaPanel(A);bindArea(A);return;}
  if(sel.kind==='col'){const c=colById(sel.id);if(!c){sel=null;return renderInspector();}el.innerHTML=colPanel(c,false);bindCol(c,false);return;}
  if(sel.kind==='dim'){const d=(M.dims||[]).find(x=>x.id===sel.id);if(!d){sel=null;return renderInspector();}
    el.innerHTML=`<div class="selname">Dimension <span class="selbtns"><button class="btn" id="copyBtn" title="Copy (Ctrl+C), then paste with Ctrl+V">Copy</button><button class="btn" id="delBtn">Delete</button></span></div><div class="kv"><label>Length</label><span class="ro">${fmtLen(dist(d.a,d.b),true)}</span>
      <label>Across</label><span class="ro">${fmtLen(Math.abs(d.b[0]-d.a[0]),true)}</span><label>Down</label><span class="ro">${fmtLen(Math.abs(d.b[1]-d.a[1]),true)}</span></div>
      <p class="tip">Kept with the Ruler. It is saved with the project and exported to AutoCAD on layer A-ANNO-DIMS.</p>`;bindInspector();return;}
  if(sel.kind==='walls'){const ws=sel.ids.map(wallById).filter(Boolean);if(ws.length<2){setSelWalls(ws.map(w=>w.id));return;}
    const same=k=>ws.every(w=>w[k]===ws[0][k])?fmtLen(ws[0][k]):'';const loose=ws.reduce((a,w)=>a+(isLoose(w,'a')?1:0)+(isLoose(w,'b')?1:0),0);
    h=`<div class="selname">${ws.length} walls <span class="selbtns"><button class="btn" id="copyBtn" title="Copy (Ctrl+C), then paste with Ctrl+V">Copy</button><button class="btn" id="delBtn">Delete</button></span></div><div class="kv">
      <label>Total length</label><span class="ro">${fmtLen(ws.reduce((a,w)=>a+wallLen(w),0))}</span>
      <label for="mT">Thickness</label><input id="mT" value="${same('t')}" placeholder="mixed">
      <label for="mH">Height</label><input id="mH" value="${same('h')}" placeholder="mixed">
      <label>Loose ends</label><span class="ro">${loose}</span></div>
      <div class="rowbtns"><button class="btn" id="unsnapBtn" title="Detach these walls from all other walls so they move on their own">Unsnap from others</button><button class="btn" id="snapEndsBtn" title="Join loose ends to walls they touch or to the nearest wall within reach">Snap ends</button></div>
      <p class="tip">Drag any highlighted wall to move them together; near horizontal or vertical the move stays straight (<kbd>Shift</kbd>: free). Arrow keys nudge. <kbd>Ctrl</kbd>+click adds or removes a wall.</p>`;}
  if(sel.kind==='wall'){const w=wallById(sel.id);if(!w){sel=null;return renderInspector();}const ext=wallExt(w);
    h=`<div class="selname">${w.kind&&OUTW[w.kind]?OUTW[w.kind].label:'Wall'} <span class="selbtns"><button class="btn" id="copyBtn" title="Copy (Ctrl+C), then paste with Ctrl+V">Copy</button><button class="btn" id="delBtn">Delete</button></span></div><div class="kv">
      ${field('Length','wLen',fmtLen(wallLen(w)))}<label>Keep fixed</label><div class="seg" role="group" aria-label="Which end stays put when the length changes">${anchorButtons(w)}</div><label>Clear span</label><span class="ro">${fmtLen(wallLen(w)-ext[0]-ext[1])}</span>
      <label>Ends</label><div class="seg" role="group" aria-label="Joined or loose ends">${jointButtons(w)}</div>
      ${selectField('Type','wKind',WALLKINDS,w.kind||'wall')}${field('Thickness','wT',fmtLen(w.t))}${field('Height','wH',fmtLen(w.h))}<label>Angle</label><span class="ro">${angleLabel(wallDir(w))}</span></div>
      <div class="rowbtns"><button class="btn" id="unsnapBtn" title="Detach this wall from its neighbours so it moves on its own">Unsnap wall</button><button class="btn" id="snapEndsBtn" title="Join loose ends to walls they touch or to the nearest wall within reach">Snap ends</button></div>
      <p class="tip">${freeMove?'Drag the wall to move it in any direction (<b>Free move</b> is on).':'Drag the wall to push or pull it; turn on <b>Free move</b> or hold <kbd>Shift</kbd> to move it in any direction.'} Drag an end square to change its length. Orange circles mark loose ends. Arrow keys move it ${fmtLen(lenStep())} (with <kbd>Shift</kbd>: ${fmtLen(lenStep()*10)}).</p>`;}
  if(sel.kind==='opening'){const o=M.openings.find(x=>x.id===sel.id);if(!o){sel=null;return renderInspector();}const w=wallById(o.wall),ext=wallExt(w);
    h=`<div class="selname">${o.kind==='door'?(isSliding(o)?'Sliding door':'Door'):'Window'} <span class="selbtns"><button class="btn" id="copyBtn" title="Copy (Ctrl+C), then paste with Ctrl+V">Copy</button><button class="btn" id="delBtn">Delete</button></span></div><div class="kv">
      ${field('Width','oW',fmtLen(o.w))}${field('Height','oH',fmtLen(o.h))}${o.kind==='window'?field('Sill height','oSill',fmtLen(o.sill)):''}
      ${field('From face','oOff',fmtLen(o.s-o.w/2-ext[0]))}${o.kind==='door'?selectField('Type','oStyle',DOORSTYLES,o.style||'swing'):''}</div>${o.kind==='door'?(o.style==='slide2'?'':`<div class="rowbtns"><button class="btn" id="flipBtn">${isSliding(o)?'Other side of the wall':'Flip swing side'}</button><button class="btn" id="hingeBtn">${isSliding(o)?'Slide the other way':'Swap hinge'}</button></div>`):''}`;}
  if(sel.kind==='item'){const it=M.items.find(x=>x.id===sel.id);if(!it){sel=null;return renderInspector();}
    h=`<div class="selname">${CAT[it.type].label} <span class="selbtns"><button class="btn" id="copyBtn" title="Copy (Ctrl+C), then paste with Ctrl+V">Copy</button><button class="btn" id="delBtn">Delete</button></span></div><div class="kv">
      ${it.type==='firepit'?`<label>Shape</label><div class="seg" role="group" aria-label="Fire pit shape"><button id="fpRound" aria-pressed="${it.shape!=='rect'}">Circular</button><button id="fpRect" aria-pressed="${it.shape==='rect'}">Rectangular</button></div>`:''}
      ${it.type==='firepit'&&it.shape!=='rect'?field('Radius','iR',fmtLen(it.w/2)):it.type==='firepit'?field('Length','iW',fmtLen(it.w))+field('Width','iD',fmtLen(it.d)):field('Width','iW',fmtLen(it.w))+field('Depth','iD',fmtLen(it.d))}${field('Height','iH',fmtLen(it.h))}${field('Elevation','iZ',fmtLen(it.z))}
      ${it.type==='firepit'&&it.shape!=='rect'?'</div>':`<label>Rotation</label><span class="ro">${Math.round(((it.r%360)+360)%360)}°</span></div><div class="rowbtns"><button class="btn" id="rotBtn">Rotate 90°</button></div>`}`;}
  if(sel.kind==='room'){const r=selRoom();if(!r){sel=null;return renderInspector();}
    h=`<div class="selname">${esc(r.name)}<span class="selbtns"><button class="btn" id="copyBtn" title="Copy the room's walls, doors, windows, fixtures and columns (Ctrl+C)">Copy room</button><button class="btn" id="rDel" title="Remove the room from the plan and the takeoff; its walls stay (Del)">Delete</button></span></div><div class="kv">
      <label for="rName">Name</label><input id="rName" data-type="text" value="${esc(r.name)}" style="font-family:var(--f-body)">
      <label>Name on plan</label><span class="lblbtns"><button class="btn" id="rLblHide">${r.meta&&r.meta.hideLabel?'Show':'Hide'}</button><button class="btn" id="rLblReset"${r.meta&&r.meta.lo?'':' disabled'}>Back to centre</button></span>
      ${selectField('Type','rType',ROOMTYPES,r.type)}
      ${selectField('Tiling','rTile',TILEMODES,r.tileMode)}${selectField('Floor in 3D','rFloor',Object.fromEntries(Object.entries(FLOORS).map(([k,v])=>[k,k==='auto'?'Automatic ('+FLOORS[autoFloor(r.type)].toLowerCase()+')':v])),(r.meta&&r.meta.floor)||'auto')}${r.tileMode==='full'?field('Tile height','rTileH',fmtLen(r.tileH)):''}
      <label>Floor</label><span class="ro">${fmtArea(r.netArea)} ${areaU()}</span>
      <label>Wall tile</label><span class="ro">${fmtArea(r.tileArea)} ${areaU()}</span>
      <label>Wall surface</label><span class="ro">${fmtArea(r.wallArea)} ${areaU()}</span>
      <label>Perimeter</label><span class="ro">${fmtRun(r.perimeter)} ${runU()}</span>
      <label>Skirting</label><span class="ro">${fmtRun(r.skirting)} ${runU()}</span>
      ${r.rect?`<label>Inside size</label><span class="ro">${fmtLen(r.rect[0])} × ${fmtLen(r.rect[1])}</span>`:''}</div>
      <div class="rowbtns"><button class="btn" id="rElev">Show elevations</button><button class="btn" id="rWalk" title="Walk inside this room in 3D">Walk inside</button></div>
      <p class="tip">Drag a corner square to move that corner of the room, or a round handle to push or pull that side; the walls move with it. Delete removes the room from the plan and the takeoff and keeps its walls.</p>`;}
  el.innerHTML=h;bindInspector();}
let lenAnchor='a';
function jointButtons(w){const nm=endNames(w);const order={Left:0,Top:0,Right:1,Bottom:1};return [['a',nm[0]],['b',nm[1]]].sort((x,y)=>order[x[1]]-order[y[1]])
  .map(([k,l])=>`<button type="button" data-joint="${k}" aria-pressed="${!isLoose(w,k)}" title="Click to ${isLoose(w,k)?'join':'unsnap'} this end">${l} ${isLoose(w,k)?'loose':'joined'}</button>`).join('');}
function endNames(w){const d=wallDir(w);if(Math.abs(d[0])>=Math.abs(d[1]))return w.a[0]<=w.b[0]?['Left','Right']:['Right','Left'];return w.a[1]<=w.b[1]?['Top','Bottom']:['Bottom','Top'];}
function anchorButtons(w){const nm=endNames(w);return [['a',nm[0]],['mid','Centre'],['b',nm[1]]].sort((x,y)=>{const o={Left:0,Top:0,Centre:1,Right:2,Bottom:2};return o[x[1]]-o[y[1]];})
  .map(([k,l])=>`<button type="button" data-anchor="${k}" aria-pressed="${lenAnchor===k}">${l}</button>`).join('');}
function setWallLength(w,L){const d=wallDir(w),oldA=w.a.slice(),oldB=w.b.slice();let na,nb;
  if(lenAnchor==='a'){na=oldA;nb=add(oldA,mul(d,L));}else if(lenAnchor==='b'){nb=oldB;na=sub(oldB,mul(d,L));}else{const c=mul(add(oldA,oldB),.5);na=sub(c,mul(d,L/2));nb=add(c,mul(d,L/2));}
  const ca=connectedEnds(w,'a'),cb=connectedEnds(w,'b');const ops=captureOpenings([w,...ca.map(x=>x[0]),...cb.map(x=>x[0])]);
  w.a=na;w.b=nb;ca.forEach(([o,k])=>o[k]=na.slice());cb.forEach(([o,k])=>o[k]=nb.slice());restoreOpenings(ops);}
function colPanel(c,isTool){const round=c.shape==='round',hosted=false;
  let h=isTool?`<p class="h">New column / pillar</p>`:`<div class="selname">Column / pillar <span class="selbtns"><button class="btn" id="copyBtn" title="Copy (Ctrl+C), then paste with Ctrl+V">Copy</button><button class="btn" id="delBtn">Delete</button></span></div>`;
  h+=`<div class="kv"><label>Shape</label><div class="seg" role="group" aria-label="Shape"><button type="button" data-cshape="rect" aria-pressed="${!round}">Square / rect</button><button type="button" data-cshape="round" aria-pressed="${round}">Round</button></div>
    ${round?field('Diameter','cW',fmtLen(c.w)):field(hosted?'Along wall':'Length','cW',fmtLen(c.w))+field(hosted?'Across wall':'Width','cD',fmtLen(c.d))}
    ${field('Height','cH',c.h?fmtLen(c.h):'')}
    ${field('Rotation','cR',(Math.round((((c.r||0)%360)+360)%360*100)/100)+'°','text')}
    <label></label><div class="seg segsm rotbtns" role="group" aria-label="Rotate"><button type="button" data-crot="-15" title="Turn 15° anticlockwise">↺ 15°</button><button type="button" data-crot="15" title="Turn 15° clockwise">↻ 15°</button><button type="button" data-crot="90" title="Turn 90° clockwise">↻ 90°</button><button type="button" data-crot="0" title="Back to 0°">Reset 0°</button></div></div>
  ${isTool?'':'<p class="tip">Drag the round handle above the column to turn it (snaps to 15°, hold <kbd>Shift</kbd> for any angle), or type an exact angle.</p>'}`;
  if(hosted&&isTool)h+=`<div class="kv" style="margin-top:6px"><label>Align</label><div class="seg segsm" role="group" aria-label="Align in the wall"><button type="button" data-calign="centre" aria-pressed="${c.align!=='face'}">Centred</button><button type="button" data-calign="face" aria-pressed="${c.align==='face'}" title="Flush with the wall face nearer the pointer">Nearer face</button></div></div>`;
  if(hosted&&!isTool){const w=wallById(c.wall),sn=sideNames(w),en=endNames(w),H=hostedSpan(c),fl=w.t/2-c.d/2,o=c.off||0;
    h+=`<div class="kv" style="margin-top:6px"><label>Flush to</label><div class="seg segsm" role="group" aria-label="Align in the wall"><button type="button" data-coff="${-fl}" aria-pressed="${Math.abs(o+fl)<0.5}" title="Flush with the ${sn.minus} face">${sn.minus[0].toUpperCase()+sn.minus.slice(1)}</button><button type="button" data-coff="0" aria-pressed="${Math.abs(o)<0.5}" title="Centred in the wall">Centre</button><button type="button" data-coff="${fl}" aria-pressed="${Math.abs(o-fl)<0.5}" title="Flush with the ${sn.plus} face">${sn.plus[0].toUpperCase()+sn.plus.slice(1)}</button></div>
      ${field('Offset to '+sn.plus,'cOff',fmtLen(o))}</div>
      <p class="h" style="margin-top:12px">Distance along the wall</p><div class="kv">
      ${H.lo!=null?field('From '+en[0].toLowerCase(),'cS0',fmtLen(H.a0-H.lo)):`<label>From ${en[0].toLowerCase()}</label><span class="ro">past the corner</span>`}
      ${H.hi!=null?field('From '+en[1].toLowerCase(),'cS1',fmtLen(H.hi-H.a1)):`<label>From ${en[1].toLowerCase()}</label><span class="ro">past the corner</span>`}</div>
      <p class="tip">Distances are clear gaps to the corner, a door or window, or the next pillar on this wall. Type one to move the pillar there; drag it to slide it along the wall. It moves with the wall.</p>`;}
  if(isTool)h+=`<div class="presets" role="group" aria-label="Common sizes">${COL_PRESETS.map(([sh,w,d])=>`<button type="button" class="chip" data-preset="${sh},${w},${d}">${sh==='round'?'Ø'+fmtLen(w):fmtLen(w)+' × '+fmtLen(d)}</button>`).join('')}</div>
    <p class="tip">${hosted?'Move onto a wall and click: the pillar sits in the wall thickness at any point along it, centred or flush with the face you are nearer. Live dimensions show the clear distance to the corners.':'Height is the wall height unless you type one. The column drags freely and clicks against a wall face, flush with the far face or centred in the wall. Once placed, type its exact distance to each wall in Left, Right, Top and Bottom (negative sets it into the wall).'}</p>`;
  else if(!hosted){const rays=colRays(c,c.id);
    h+=`<p class="h" style="margin-top:12px">Distance to walls</p><div class="kv">${COL_DIRS.map(([k,label])=>{const r=rays[k];return r&&r.t<15000?field(label,'cd_'+k,fmtLen(r.d)):`<label>${label}</label><span class="ro">no wall</span>`;}).join('')}</div>
      <p class="tip">Negative means the column is set into the wall by that much; blue bars mark sides that line up with a wall face. Type a distance to move the column there exactly. You can also drag it, nudge it with the arrow keys, or check any distance with the Ruler.</p>`;}
  return h;}
function bindCol(c,isTool){
  const apply=fn=>{if(isTool){fn(c);if(colGhost)Object.assign(colGhost,{shape:c.shape,w:c.w,d:c.d,h:c.h,gap:c.gap,r:c.r||0,place:'free'});renderInspector();dirty();}else{mutate(()=>fn(c));renderInspector();}};
  const on=(id,fn)=>{const e=document.getElementById(id);if(e)e.onchange=()=>fn(e.value);};
  document.querySelectorAll('[data-cshape]').forEach(b=>b.onclick=()=>apply(o=>{o.shape=b.dataset.cshape;if(o.shape==='round')o.d=o.w;}));
  document.querySelectorAll('[data-cplace]').forEach(b=>b.onclick=()=>{const v=b.dataset.cplace;
    if(isTool){apply(o=>{o.place=v;});return;}
    if(v==='wall'&&!c.wall){const sl=hostSlot([c.x,c.y],Object.assign({},c,{align:'centre'}),c.id,1500);if(!sl){toast('Move the column within 1.5 m of a wall first.');return;}
      apply(o=>{o.wall=sl.w.id;o.s=sl.s;o.off=0;});}
    else if(v==='free'&&c.wall)apply(o=>{delete o.wall;delete o.s;delete o.off;});});
  document.querySelectorAll('[data-calign]').forEach(b=>b.onclick=()=>apply(o=>{o.align=b.dataset.calign;}));
  document.querySelectorAll('[data-coff]').forEach(b=>b.onclick=()=>apply(o=>{o.off=+b.dataset.coff;}));
  on('cOff',v=>{const x=parseLen(v);if(isFinite(x))apply(o=>{o.off=x;});else renderInspector();});
  on('cS0',v=>{const x=parseLen(v),H=hostedSpan(c);if(x>=0&&H&&H.lo!=null)apply(o=>{o.s=H.lo+x+o.w/2;});else renderInspector();});
  on('cS1',v=>{const x=parseLen(v),H=hostedSpan(c);if(x>=0&&H&&H.hi!=null)apply(o=>{o.s=H.hi-x-o.w/2;});else renderInspector();});
  document.querySelectorAll('[data-preset]').forEach(b=>b.onclick=()=>{const [sh,w,d]=b.dataset.preset.split(',');apply(o=>{o.shape=sh;o.w=+w;o.d=+d;});});
  on('cW',v=>{const x=parseLen(v);if(x>=50)apply(o=>{o.w=x;if(o.shape==='round')o.d=x;});else renderInspector();});
  on('cD',v=>{const x=parseLen(v);if(x>=50)apply(o=>{o.d=x;});else renderInspector();});
  on('cH',v=>{const x=String(v).trim()?parseLen(v):0;if(x===0||x>=100)apply(o=>{o.h=x||0;});else renderInspector();});
  on('cGap',v=>{const x=parseLen(v);if(isFinite(x))apply(o=>{o.gap=x;});else renderInspector();});
  document.querySelectorAll('[data-crot]').forEach(b=>b.onclick=()=>apply(o=>{const d=+b.dataset.crot;o.r=d===0?0:(((((o.r||0)+d)%360)+360)%360);}));
  on('cR',v=>{const x=parseFloat(String(v).replace('°','').replace(',','.'));if(isFinite(x))apply(o=>{o.r=((x%360)+360)%360;});else renderInspector();});
  if(!isTool)COL_DIRS.forEach(([k])=>on('cd_'+k,v=>{const x=parseLen(v);const r=colRays(c,c.id)[k];if(!isFinite(x)||!r)return renderInspector();
    apply(o=>{const mv=mul(r.u,r.d-x);o.x+=mv[0];o.y+=mv[1];});}));
  const db=$('#delBtn');if(db)db.onclick=deleteSel;const cb=$('#copyBtn');if(cb)cb.onclick=()=>copySel();}
function rulerPanel(){const e=rulerEnd();
  let h=`<p class="h">Ruler</p>`;
  if(ruler&&e&&dist(ruler.a,e)>0.5){const L=dist(ruler.a,e),dx=e[0]-ruler.a[0],dy=e[1]-ruler.a[1];
    h+=`<div class="kv rulerkv"><label>Length</label><span class="ro big" id="rLen">${fmtLen(L,true)}</span><label>Angle</label><span class="ro" id="rAng">${angleLabel(norm([dx,dy]))}</span>
      <label>Across</label><span class="ro" id="rDx">${fmtLen(Math.abs(dx),true)}</span><label>Up / down</label><span class="ro" id="rDy">${fmtLen(Math.abs(dy),true)}</span></div>`;
    h+=ruler.b?`<div class="rowbtns"><button class="btn primary" id="keepBtn">Keep as dimension</button><button class="btn" id="clearRulerBtn">Clear</button></div>`
      :`<p class="tip">Click the second point.</p>`;}
  else h+=`<p class="empty">Click two points, or drag, to measure. It snaps to wall corners, wall faces and fixture corners. On a wall face it measures square from the first point, so you get the true clear distance.</p>`;
  const n=(M.dims||[]).length;if(n)h+=`<p class="tip">${n} kept dimension${n>1?'s':''} on the plan.</p><div class="rowbtns"><button class="btn" id="clearDimsBtn">Remove all dimensions</button></div>`;
  return h;}
function renderRulerInfo(){if(!$('#rLen')){renderInspector();return;}const e=rulerEnd();const L=dist(ruler.a,e),dx=e[0]-ruler.a[0],dy=e[1]-ruler.a[1];
  $('#rLen').textContent=fmtLen(L,true);$('#rAng').textContent=angleLabel(norm([dx,dy]));$('#rDx').textContent=fmtLen(Math.abs(dx),true);$('#rDy').textContent=fmtLen(Math.abs(dy),true);}
function bindRuler(){const k=$('#keepBtn');if(k)k.onclick=keepRuler;const c=$('#clearRulerBtn');if(c)c.onclick=()=>{ruler=null;renderInspector();dirty();};
  const a=$('#clearDimsBtn');if(a)a.onclick=()=>{mutate(()=>{M.dims=[];});toast('Dimensions removed. Ctrl+Z brings them back.');};}
function esc(s){return String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}
function bindInspector(){
  const on=(id,fn)=>{const e=document.getElementById(id);if(e)e.addEventListener('change',()=>{fn(e.value);});};
  const len=(v,min=1)=>{const L=parseLen(v);return L>=min?L:null;};
  on('wallT',v=>{const L=len(v,20);if(L)(tool==='wall'?curWallSpec():defaults).t=L;renderInspector();});on('wallH',v=>{const L=len(v,300);if(L)(tool==='wall'?curWallSpec():defaults).h=L;renderInspector();});
  if(sel&&sel.kind==='wall'){const w=wallById(sel.id);
    on('wLen',v=>{const L=len(v,50);if(!L)return renderInspector();mutate(()=>setWallLength(w,L));renderInspector();});
    document.querySelectorAll('[data-anchor]').forEach(b=>b.onclick=()=>{lenAnchor=b.dataset.anchor;renderInspector();});
    on('wKind',v=>{mutate(()=>{const was=w.kind||'wall';if(v==='wall'){delete w.kind;if(was!=='wall'){w.t=defaults.t;w.h=defaults.h;}}else{w.kind=v;if(was!==v){w.t=OUTW[v].t;w.h=OUTW[v].h;}}});renderInspector();});
    on('wT',v=>{const L=len(v,20);if(L)mutate(()=>w.t=L);renderInspector();});on('wH',v=>{const L=len(v,300);if(L)mutate(()=>w.h=L);renderInspector();});}
  if(sel&&sel.kind==='opening'){const o=M.openings.find(x=>x.id===sel.id),w=wallById(o.wall),ext=wallExt(w),L=wallLen(w);
    on('oW',v=>{const x=len(v,200);if(x)mutate(()=>{o.w=Math.min(x,L-ext[0]-ext[1]);o.s=clamp(o.s,ext[0]+o.w/2,L-ext[1]-o.w/2);});renderInspector();});
    on('oH',v=>{const x=len(v,200);if(x)mutate(()=>o.h=Math.min(x,w.h-o.sill));renderInspector();});
    on('oSill',v=>{const x=len(v,0);if(x!==null)mutate(()=>o.sill=Math.min(x,w.h-o.h));renderInspector();});
    on('oOff',v=>{const x=parseLen(v);if(x>=0)mutate(()=>o.s=clamp(ext[0]+x+o.w/2,ext[0]+o.w/2,L-ext[1]-o.w/2));renderInspector();});
    {const st=$('#oStyle');if(st)st.onchange=()=>{mutate(()=>{if(st.value==='swing')delete o.style;else o.style=st.value;});renderInspector();};}
    const fb=$('#flipBtn');if(fb)fb.onclick=()=>mutate(()=>o.flip^=1);const hb=$('#hingeBtn');if(hb)hb.onclick=()=>mutate(()=>o.hinge^=1);}
  if(sel&&sel.kind==='item'){const it=M.items.find(x=>x.id===sel.id);
    const setDim=(k,v,min)=>{const x=len(v,min);if(x!==null)mutate(()=>{
      if(k==='d'){const back=add([it.x,it.y],rotV([0,-it.d/2],it.r));it.d=x;const c=add(back,rotV([0,x/2],it.r));it.x=c[0];it.y=c[1];}else it[k]=x;});renderInspector();};
    on('iW',v=>setDim('w',v,100));on('iD',v=>setDim('d',v,100));on('iH',v=>setDim('h',v,20));on('iZ',v=>setDim('z',v,0));
    on('iR',v=>{const x=len(v,50);if(x!==null){mutate(()=>{it.w=it.d=2*x;});firepitDefaults.r=x;}renderInspector();});
    const fpr=$('#fpRound'),fpq=$('#fpRect');
    if(fpr)fpr.onclick=()=>{if(it.shape==='rect'){mutate(()=>applyFirepitShape(it,'round',{r:Math.min(it.w,it.d)/2}));firepitDefaults.shape='round';renderInspector();}};
    if(fpq)fpq.onclick=()=>{if(it.shape!=='rect'){const r=it.w/2;mutate(()=>applyFirepitShape(it,'rect',{w:Math.max(firepitDefaults.w,2*r),d:Math.max(2*r,Math.min(firepitDefaults.d,2*r))}));firepitDefaults.shape='rect';renderInspector();}};
    const rb=$('#rotBtn');if(rb)rb.onclick=()=>mutate(()=>it.r=(it.r+90)%360);}
  if(sel&&sel.kind==='room'){const r=selRoom();
    const meta=()=>{if(r.meta)return r.meta;const m={x:r.centroid[0],y:r.centroid[1],type:r.type};M.roomMeta.push(m);return m;};
    on('rName',v=>{mutate(()=>{meta().name=v.trim()||r.name;});renderInspector();});on('rType',v=>{mutate(()=>{meta().type=v;});renderInspector();});
    on('rTile',v=>{mutate(()=>{meta().tile=v;});renderInspector();});on('rFloor',v=>{mutate(()=>{meta().floor=v;});renderInspector();});
    {const wb=$('#rWalk');if(wb)wb.onclick=()=>{if($('#stage').dataset.view==='plan')setView('split');requestAnimationFrame(()=>walkStart(null,r));};}
    {const dl=$('#rDel');if(dl)dl.onclick=()=>{deleteRoom(r);sel=null;renderInspector();};const ev=$('#rElev');if(ev)ev.onclick=()=>{elevPt=r.centroid.slice();setView('elev');fillElevSelect();dirty();};}
    const lh=$('#rLblHide');if(lh)lh.onclick=()=>{mutate(()=>{const m=meta();m.hideLabel=!m.hideLabel;});renderInspector();};
    const lr=$('#rLblReset');if(lr)lr.onclick=()=>{mutate(()=>{delete meta().lo;});renderInspector();};on('rTileH',v=>{const x=len(v,100);if(x)mutate(()=>{meta().tileH=x;});renderInspector();});}
  if(sel&&(sel.kind==='wall'||sel.kind==='walls')){const ids=selIds();
    const ub=$('#unsnapBtn');if(ub)ub.onclick=()=>{let n=0;mutate(()=>{n=unsnapWalls(ids);});toast(n?`Unsnapped ${n} joint${n>1?'s':''}. These walls now move on their own.`:'Nothing to unsnap: these walls are not joined to others.');};
    const sb=$('#snapEndsBtn');if(sb)sb.onclick=()=>{let n=0;mutate(()=>{n=snapWallEnds(ids);});toast(n?`Joined ${n} end${n>1?'s':''}.`:`No wall within ${fmtLen(Math.max(400,24/view.s),true)} to join.`);};
    document.querySelectorAll('[data-joint]').forEach(b=>b.onclick=()=>{const w=wallById(sel.id),k=b.dataset.joint;
      mutate(()=>{if(isLoose(w,k))snapWallEnds(new Set([w.id]),k);else{setLoose(w,k,true);M.walls.forEach(o=>{if(o!==w)['a','b'].forEach(ok=>{if(onWallInterior(o[ok],w))setLoose(o,ok,true);});});}});});
    const setAll=(k,v,min)=>{const x=parseLen(v);if(x>=min)mutate(()=>M.walls.forEach(w=>{if(ids.has(w.id))w[k]=x;}));renderInspector();};
    const mt=$('#mT');if(mt)mt.onchange=()=>setAll('t',mt.value,20);const mh=$('#mH');if(mh)mh.onchange=()=>setAll('h',mh.value,300);}
  const db=$('#delBtn');if(db)db.onclick=deleteSel;const cb=$('#copyBtn');if(cb)cb.onclick=()=>copySel();}
function rotV(v,deg){const a=deg*Math.PI/180;return [v[0]*Math.cos(a)-v[1]*Math.sin(a),v[0]*Math.sin(a)+v[1]*Math.cos(a)];}
function renderTakeoff(){
  const t=$('#qtable');let tot={f:0,w:0,s:0,t:0};
  let h=`<thead><tr><th>Room</th><th>Floor</th><th>Walls</th><th>Tile</th><th>Skirt.</th></tr></thead><tbody>`;
  rooms.forEach((r,i)=>{tot.f+=r.netArea;tot.w+=r.wallArea;tot.s+=r.skirting;tot.t+=r.tileArea;
    h+=`<tr data-room="${i}"><td><span class="swatch" style="background:var(--room-${r.type})"></span>${esc(r.name)}</td><td>${fmtArea(r.netArea)}</td><td>${fmtArea(r.wallArea)}</td><td>${fmtArea(r.tileArea)}</td><td>${fmtRun(r.skirting)}</td></tr>`;});
  if(!rooms.length&&!(M.areas||[]).length)h+=`<tr><td colspan="5" style="color:var(--muted)">Close a loop of walls to create a room, or measure any shape with the Area tool.</td></tr>`;
  else h+=`<tr class="total"><td>Total</td><td>${fmtArea(tot.f)}</td><td>${fmtArea(tot.w)}</td><td>${fmtArea(tot.t)}</td><td>${fmtRun(tot.s)}</td></tr>`;
  h+=areasTakeoffRows();if(offRooms.length)h+=`<tr class="sub"><td colspan="5">${offRooms.length} deleted room${offRooms.length>1?'s':''} · <button class="linkbtn" id="restoreRooms">Restore</button></td></tr>`;t.innerHTML=h+'</tbody>';
  {const rb=$('#restoreRooms');if(rb)rb.onclick=e=>{e.stopPropagation();restoreRooms();};}
  t.querySelectorAll('tr[data-area]').forEach(tr=>tr.onclick=()=>{sel={kind:'area',id:tr.dataset.area};setTool('select');sel={kind:'area',id:tr.dataset.area};renderInspector();dirty();});
  $('#qnote').textContent=`Areas in ${areaU()}, skirting in ${runU()}. Measured to finished wall faces. Walls are net of doors and windows; tile follows each room's tiling setting and skips areas behind tubs, trays and tall units.`;
  t.querySelectorAll('tr[data-room]').forEach(tr=>tr.onclick=()=>{const r=rooms[+tr.dataset.room];sel={kind:'room',pt:r.centroid.slice()};setTool('select');renderInspector();dirty();});
  const counts={};M.items.forEach(i=>counts[i.type]=(counts[i.type]||0)+1);
  const doors=M.openings.filter(o=>o.kind==='door'&&!isSliding(o)).length,wins=M.openings.filter(o=>o.kind==='window').length,slides=M.openings.filter(isSliding).length;
  let s='';Object.keys(CAT).forEach(k=>{if(counts[k])s+=`<span>${CAT[k].label}</span><span>× ${counts[k]}</span>`;});
  s+=`<span>Doors</span><span>× ${doors}</span>${slides?`<span>Sliding doors</span><span>× ${slides}</span>`:''}<span>Windows</span><span>× ${wins}</span>`;
  if((M.cols||[]).length)s+=`<span>Columns</span><span>× ${M.cols.length}</span>`;
  {const yr=yardWallRuns();Object.keys(OUTW).forEach(k=>{if(yr[k])s+=`<span>${OUTW[k].label}</span><span>${fmtRun(yr[k])} ${runU()}</span>`;});}
  const run=M.items.filter(i=>COUNTER.has(i.type)).reduce((a,i)=>a+i.w,0);if(run)s+=`<span>Countertop run</span><span>${fmtRun(run)} ${runU()}</span>`;
  $('#sched').innerHTML=s;}
function takeoffCSV(){const rows=[['Room','Type','Floor ('+areaU()+')','Walls ('+areaU()+')','Wall tile ('+areaU()+')','Perimeter ('+runU()+')','Skirting ('+runU()+')']];
  rooms.forEach(r=>rows.push([r.name,ROOMTYPES[r.type],fmtArea(r.netArea),fmtArea(r.wallArea),fmtArea(r.tileArea),fmtRun(r.perimeter),fmtRun(r.skirting)]));
  (M.areas||[]).forEach(A=>{if(isZone(A)){const z=zoneStats(A);rows.push([A.name||'Area',ROOMTYPES[A.type]+' (area)',fmtArea(z.floor),fmtArea(z.wall),fmtArea(z.tile),fmtRun(z.per),fmtRun(z.skirt)]);return;}const st=areaStats(A);rows.push([A.name||'Area',A.surf&&SURF[A.surf]?SURF[A.surf].label:'Measured area',fmtArea(st.area),'','',fmtRun(st.per),'']);});
  return rows.map(r=>r.map(c=>/[",]/.test(c)?'"'+String(c).replace(/"/g,'""')+'"':c).join(',')).join('\n');}

/* ============================== AutoCAD DXF: read ============================== */
// Reads ASCII DXF from AutoCAD R12 to 2018+. Returns plain geometry in drawing units (y up).
const DXF_INSUNITS={1:25.4,2:304.8,4:1,5:10,6:1000,8:0.0000254,9:0.0254,10:914.4,14:100};
const DXF_VERSIONS={AC1009:'R12',AC1012:'R13',AC1014:'R14',AC1015:'2000',AC1018:'2004',AC1021:'2007',AC1024:'2010',AC1027:'2013',AC1032:'2018'};
const DXF_CODEPAGES={ANSI_874:'windows-874',ANSI_932:'shift_jis',ANSI_936:'gbk',ANSI_949:'euc-kr',ANSI_950:'big5',ANSI_1250:'windows-1250',ANSI_1251:'windows-1251',
  ANSI_1252:'windows-1252',ANSI_1253:'windows-1253',ANSI_1254:'windows-1254',ANSI_1255:'windows-1255',ANSI_1256:'windows-1256',ANSI_1257:'windows-1257',ANSI_1258:'windows-1258'};
const DWG_HELP='This is a DWG file. In AutoCAD use Save As → "AutoCAD 2018 DXF", or convert it with the free ODA File Converter, then import the DXF.';

function dxfDecode(bytes){
  let head='';for(let i=0;i<Math.min(bytes.length,24);i++)head+=String.fromCharCode(bytes[i]);
  if(/^AC10\d\d/.test(head))throw new Error(DWG_HELP);
  if(head.startsWith('AutoCAD Binary DXF'))throw new Error('This is a binary DXF. Save it from AutoCAD as an ASCII DXF and import that.');
  let probe='';for(let i=0;i<Math.min(bytes.length,65536);i++)probe+=String.fromCharCode(bytes[i]);
  const ver=(probe.match(/\$ACADVER\s*\r?\n\s*1\s*\r?\n\s*(AC\d{4})/)||[])[1]||'';
  const cp=((probe.match(/\$DWGCODEPAGE\s*\r?\n\s*3\s*\r?\n\s*([A-Za-z0-9_]+)/)||[])[1]||'').toUpperCase();
  let text,enc='utf-8';
  if(ver>='AC1021'||(bytes[0]===0xEF&&bytes[1]===0xBB&&bytes[2]===0xBF))text=new TextDecoder('utf-8').decode(bytes);
  else{ // older files use the Windows code page named in the header; plain ASCII and UTF-8 also pass the first try
    try{text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}
    catch(e){enc=DXF_CODEPAGES[cp]||'windows-1252';text=new TextDecoder(enc).decode(bytes);}}
  return {text,ver,cp,enc};}

function dxfParse(text){
  const L=text.split(/\r\n|\r|\n/);const codes=[],vals=[];
  for(let k=0;k+1<L.length;k+=2){const raw=L[k].trim();if(raw===''&&k>=L.length-3)break;const c=+raw;
    if(!Number.isInteger(c))throw new Error(codes.length?'The file is damaged near line '+(k+1)+'.':'This is not a DXF file.');
    codes.push(c);vals.push(c===1||c===3?L[k+1]:L[k+1].trim());}
  if(!codes.length||!vals.includes('SECTION'))throw new Error('This is not a DXF file.');
  const N=codes.length;let p=0;const header={},layers={},blocks={},ents=[];
  const isEnd=()=>codes[p]===0&&vals[p]==='ENDSEC';
  const readEnt=()=>{const type=vals[p];const pairs=[];p++;while(p<N&&codes[p]!==0){pairs.push([codes[p],vals[p]]);p++;}return {type,pairs};};
  while(p<N){
    if(!(codes[p]===0&&vals[p]==='SECTION')){p++;continue;}
    const name=vals[p+1];p+=2;
    if(name==='HEADER'){let cur=null;while(p<N&&!isEnd()){if(codes[p]===9){cur=vals[p];header[cur]={};}else if(cur&&header[cur][codes[p]]===undefined)header[cur][codes[p]]=vals[p];p++;}}
    else if(name==='TABLES'){while(p<N&&!isEnd()){if(codes[p]===0&&vals[p]==='LAYER'){const g=pairMap(readEnt().pairs);if(g[2]!==undefined)layers[g[2]]={color:+(g[62]||7),flags:+(g[70]||0)};}else p++;}}
    else if(name==='BLOCKS'){while(p<N&&!isEnd()){
        if(codes[p]===0&&vals[p]==='BLOCK'){const g=pairMap(readEnt().pairs);const blk={name:g[2]||g[3]||'',base:[+g[10]||0,+g[20]||0],ents:[]};
          while(p<N&&!(codes[p]===0&&(vals[p]==='ENDBLK'||vals[p]==='ENDSEC'))){if(codes[p]===0)blk.ents.push(readEnt());else p++;}
          if(p<N&&vals[p]==='ENDBLK')readEnt();blocks[blk.name]=blk;}
        else p++;}}
    else if(name==='ENTITIES'){while(p<N&&!isEnd()){if(codes[p]===0)ents.push(readEnt());else p++;}}
    else while(p<N&&!isEnd())p++;
    p++;}
  return {header,layers,blocks,ents};}
function pairMap(pairs){const g={};for(const [c,v] of pairs)if(g[c]===undefined)g[c]=v;return g;}

function dxfText(s){return String(s||'').replace(/\\U\+([0-9a-fA-F]{4})/g,(m,h)=>String.fromCharCode(parseInt(h,16)))
  .replace(/%%[cC]/g,'Ø').replace(/%%[dD]/g,'°').replace(/%%[pP]/g,'±').replace(/%%[uUoOkK]/g,'').replace(/%%%/g,'%');}
function dxfMText(s){return dxfText(s).replace(/\\\\/g,'\u0001').replace(/\\[Pp](?![a-z])/g,'\n').replace(/\\~/g,' ').replace(/\\[LlOoKkN]/g,'')
  .replace(/\\S([^;]*?)[\^\/#]([^;]*);/g,'$1/$2').replace(/\\[ACcFfHQTWpa][^;]*;/g,'').replace(/[{}]/g,'').replace(/\u0001/g,'\\').replace(/[ \t]+/g,' ').replace(/ *\n */g,'\n').trim();}

// Expand everything (blocks included) into lines, arcs and texts in WCS drawing units.
function dxfGeometry(d){
  const G={segs:[],sl:[],arcs:[],texts:[],layers:[],lidx:new Map(),skipped:{},count:0,truncated:false};
  const LIM=400000;
  const li=name=>{if(!G.lidx.has(name)){const t=d.layers[name]||{color:7,flags:0};G.lidx.set(name,G.layers.length);
      G.layers.push({name,color:Math.abs(t.color)||7,off:t.color<0,frozen:!!(t.flags&1),segs:0,arcs:0,texts:0,len:0});}return G.lidx.get(name);};
  const mm=(A,B)=>[A[0]*B[0]+A[2]*B[1],A[1]*B[0]+A[3]*B[1],A[0]*B[2]+A[2]*B[3],A[1]*B[2]+A[3]*B[3],A[0]*B[4]+A[2]*B[5]+A[4],A[1]*B[4]+A[3]*B[5]+A[5]];
  const ap=(T,x,y)=>[T[0]*x+T[2]*y+T[4],T[1]*x+T[3]*y+T[5]];
  const TR=(x,y)=>[1,0,0,1,x,y],RO=a=>{const c=Math.cos(a),s=Math.sin(a);return [c,s,-s,c,0,0];},SC=(x,y)=>[x,0,0,y,0,0],MIR=[-1,0,0,1,0,0];
  const seg=(T,L,x1,y1,x2,y2)=>{if(G.count>LIM){G.truncated=true;return;}const a=ap(T,x1,y1),b=ap(T,x2,y2);if(!isFinite(a[0]+a[1]+b[0]+b[1]))return;
    G.segs.push(a[0],a[1],b[0],b[1]);const i=li(L);G.sl.push(i);G.layers[i].segs++;G.layers[i].len+=Math.hypot(b[0]-a[0],b[1]-a[1]);G.count++;};
  const poly=(T,L,pts)=>{for(let i=0;i+1<pts.length;i++)seg(T,L,pts[i][0],pts[i][1],pts[i+1][0],pts[i+1][1]);};
  const arc=(T,L,cx,cy,r,a0,a1)=>{ // degrees, counter-clockwise
    if(!(r>0))return;let sweep=((a1-a0)%360+360)%360;if(sweep<1e-9)sweep=360;const full=sweep>=359.999;
    const sx=Math.hypot(T[0],T[1]),sy=Math.hypot(T[2],T[3]);const ortho=Math.abs(T[0]*T[2]+T[1]*T[3])<1e-9*sx*sy;
    if(Math.abs(sx-sy)>1e-6*Math.max(sx,sy)||!ortho){const n=Math.max(8,Math.ceil(sweep/10));const pts=[];
      for(let k=0;k<=n;k++){const a=(a0+sweep*k/n)*Math.PI/180;pts.push([cx+r*Math.cos(a),cy+r*Math.sin(a)]);}poly(T,L,pts);return;}
    if(G.count>LIM){G.truncated=true;return;}
    const c=ap(T,cx,cy),p0=ap(T,cx+r*Math.cos(a0*Math.PI/180),cy+r*Math.sin(a0*Math.PI/180)),p1=ap(T,cx+r*Math.cos((a0+sweep)*Math.PI/180),cy+r*Math.sin((a0+sweep)*Math.PI/180));
    let s=Math.atan2(p0[1]-c[1],p0[0]-c[0]),e=Math.atan2(p1[1]-c[1],p1[0]-c[0]);if(T[0]*T[3]-T[1]*T[2]<0)[s,e]=[e,s];
    const i=li(L);G.arcs.push({x:c[0],y:c[1],r:r*sx,s,e,full,li:i});G.layers[i].arcs++;G.count++;};
  const bulgePts=(T,L,vs,closed)=>{const n=vs.length;const lim=closed?n:n-1;
    for(let k=0;k<lim;k++){const A=vs[k],B=vs[(k+1)%n];const b=A[2]||0;
      if(Math.abs(b)<1e-9){seg(T,L,A[0],A[1],B[0],B[1]);continue;}
      const th=4*Math.atan(b),c=Math.hypot(B[0]-A[0],B[1]-A[1]);if(c<1e-12)continue;const ux=(B[0]-A[0])/c,uy=(B[1]-A[1])/c;
      const h=(c/2)/Math.tan(th/2),cx=(A[0]+B[0])/2-uy*h,cy=(A[1]+B[1])/2+ux*h,r=Math.abs(c/(2*Math.sin(th/2)));
      let s=Math.atan2(A[1]-cy,A[0]-cx)*180/Math.PI,e=Math.atan2(B[1]-cy,B[0]-cx)*180/Math.PI;if(b<0)[s,e]=[e,s];arc(T,L,cx,cy,r,s,e);}};
  const text=(T,L,x,y,h,rotDeg,s)=>{s=String(s||'').trim();if(!s||G.count>LIM)return;const p=ap(T,x,y);const sc=Math.sqrt(Math.abs(T[0]*T[3]-T[1]*T[2]))||1;
    const r=(rotDeg||0)*Math.PI/180+Math.atan2(T[1],T[0]);const i=li(L);G.texts.push({x:p[0],y:p[1],h:(+h||1)*sc,r,s,li:i});G.layers[i].texts++;G.count++;};
  function expand(list,T,parentLayer,depth){
    for(let k=0;k<list.length;k++){const e=list[k];if(G.count>LIM){G.truncated=true;return;}
      const g=pairMap(e.pairs);if(g[67]==='1')continue;let L=g[8]===undefined?'0':g[8];if(L==='0'&&parentLayer)L=parentLayer;
      const O=(+g[230]||1)<0?mm(T,MIR):T; // entities drawn on a mirrored work plane
      switch(e.type){
        case 'LINE':seg(T,L,+g[10]||0,+g[20]||0,+g[11]||0,+g[21]||0);break;
        case 'LWPOLYLINE':{const vs=[];for(const [c,v] of e.pairs){if(c===10)vs.push([+v,0,0]);else if(c===20&&vs.length)vs[vs.length-1][1]=+v;else if(c===42&&vs.length)vs[vs.length-1][2]=+v;}
          bulgePts(O,L,vs,(+g[70]||0)&1);break;}
        case 'POLYLINE':{const fl=+g[70]||0;const vs=[];let j=k+1;
          for(;j<list.length&&list[j].type!=='SEQEND';j++){if(list[j].type!=='VERTEX')break;const v=pairMap(list[j].pairs);if((+v[70]||0)&128&&!((+v[70]||0)&64))continue;vs.push([+v[10]||0,+v[20]||0,+v[42]||0]);}
          k=j;if(fl&16||fl&64)break;bulgePts(fl&8?T:O,L,vs,fl&1);break;}
        case 'ARC':arc(O,L,+g[10]||0,+g[20]||0,+g[40],+g[50]||0,+g[51]||0);break;
        case 'CIRCLE':arc(O,L,+g[10]||0,+g[20]||0,+g[40],0,360);break;
        case 'ELLIPSE':{const cx=+g[10]||0,cy=+g[20]||0,mx=+g[11]||0,my=+g[21]||0,ra=+g[40]||1;let u0=+(g[41]||0),u1=g[42]===undefined?Math.PI*2:+g[42];if(u1<=u0)u1+=Math.PI*2;
          const ez=(+g[230]||1)<0?-1:1;const nx=-my*ra*ez,ny=mx*ra*ez;const n=Math.max(12,Math.ceil((u1-u0)/(Math.PI/24)));const pts=[];
          for(let q=0;q<=n;q++){const u=u0+(u1-u0)*q/n;pts.push([cx+mx*Math.cos(u)+nx*Math.sin(u),cy+my*Math.cos(u)+ny*Math.sin(u)]);}poly(T,L,pts);break;}
        case 'SPLINE':{const fit=[],ctl=[];for(const [c,v] of e.pairs){if(c===11)fit.push([+v,0]);else if(c===21&&fit.length)fit[fit.length-1][1]=+v;else if(c===10)ctl.push([+v,0]);else if(c===20&&ctl.length)ctl[ctl.length-1][1]=+v;}
          poly(T,L,fit.length>1?fit:ctl);break;}
        case 'TEXT':case 'ATTRIB':{if(e.type==='ATTRIB'&&(+g[70]||0)&1)break;const al=(+g[72]||0)||(+g[73]||0);
          const x=al&&g[11]!==undefined?+g[11]:+g[10]||0,y=al&&g[21]!==undefined?+g[21]:+g[20]||0;text(O,L,x,y,g[40],+g[50]||0,dxfText(g[1]));break;}
        case 'MTEXT':{let s='';for(const [c,v] of e.pairs)if(c===3)s+=v;s+=g[1]||'';let rot=+g[50]||0;if(g[11]!==undefined)rot=Math.atan2(+g[21]||0,+g[11]||0)*180/Math.PI;
          text(T,L,+g[10]||0,+g[20]||0,g[40],rot,dxfMText(s));break;}
        case 'INSERT':{const blk=d.blocks[g[2]];if(!blk||depth>6||/^\*paper_space/i.test(g[2]||''))break;
          const sx=g[41]===undefined?1:+g[41],sy=g[42]===undefined?1:+g[42],rot=(+g[50]||0)*Math.PI/180;
          const cols=Math.min(+g[70]||1,50),rows=Math.min(+g[71]||1,50),cs=+g[44]||0,rs=+g[45]||0;
          for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){
            const M_=[TR(+g[10]||0,+g[20]||0),RO(rot),TR(c*cs,r*rs),SC(sx,sy),TR(-blk.base[0],-blk.base[1])].reduce((A,B)=>mm(A,B),O);
            expand(blk.ents,M_,L,depth+1);}
          break;}
        case 'DIMENSION':{const blk=d.blocks[g[2]];if(blk&&depth<6)expand(blk.ents,T,L,depth+1);break;}
        case 'SEQEND':case 'VERTEX':case 'ATTDEF':break;
        default:G.skipped[e.type]=(G.skipped[e.type]||0)+1;}}}
  expand(d.ents,[1,0,0,1,0,0],null,0);
  return G;}

// Bounding box of the chosen layers, in drawing units.
function dxfBBox(G,use){let x0=1e300,y0=1e300,x1=-1e300,y1=-1e300;const inc=(x,y)=>{if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;};
  for(let i=0;i<G.sl.length;i++)if(use(G.sl[i])){inc(G.segs[4*i],G.segs[4*i+1]);inc(G.segs[4*i+2],G.segs[4*i+3]);}
  G.arcs.forEach(a=>{if(use(a.li)){inc(a.x-a.r,a.y-a.r);inc(a.x+a.r,a.y+a.r);}});G.texts.forEach(t=>{if(use(t.li))inc(t.x,t.y);});
  return x0>x1?null:{x0,y0,x1,y1};}

// Unitless files: guess from the size of the drawing.
function dxfGuessUnit(G,header){const ins=+((header.$INSUNITS||{})[70]||0);if(DXF_INSUNITS[ins])return {f:DXF_INSUNITS[ins],fromFile:true};
  const b=dxfBBox(G,()=>true);if(!b)return {f:1,fromFile:false};const span=Math.max(b.x1-b.x0,b.y1-b.y0);
  const imperial=((header.$MEASUREMENT||{})[70])==='0';
  return {f:span<300?(imperial?304.8:1000):span<6000?(imperial?25.4:10):1,fromFile:false};}

/* ============================== AutoCAD DXF: drawing → walls ============================== */
// Architects draw walls as pairs of parallel lines. Pair them up, join the pieces, read door swings and
// window glazing in the gaps, and close corners and T-junctions. Works in model millimetres (y down).
function subtractIv(free,cov){let out=free;for(const [a,b] of cov){const nx=[];for(const [x,y] of out){if(b<=x||a>=y){nx.push([x,y]);continue;}if(a>x)nx.push([x,a]);if(b<y)nx.push([b,y]);}out=nx;}return out;}
function rebuildWalls(lines,evid,opt){
  const minT=opt.minT||40,maxT=opt.maxT||600,ANG=0.2*Math.PI/180;
  // 1. normalise every line: direction in the upper half plane, offset c along the normal, extent t0..t1
  const Ls=[];
  for(const [a,b] of lines){if(dist(a,b)<30)continue;let d=norm(sub(b,a));if(d[1]<0||(d[1]===0&&d[0]<0))d=[-d[0],-d[1]];
    let ang=Math.atan2(d[1],d[0]);if(ang>Math.PI-ANG*3){ang-=Math.PI;d=[-d[0],-d[1]];}
    const nr=perp(d),ta=dot(a,d),tb=dot(b,d);Ls.push({a,b,d,nr,ang,c:dot(a,nr),t0:Math.min(ta,tb),t1:Math.max(ta,tb),cov:[]});}
  Ls.sort((p,q)=>p.ang-q.ang);
  // 2. candidate pairs: parallel, wall-thickness apart, overlapping
  const cands=[];let g0=0;
  for(let i=0;i<=Ls.length;i++){
    if(i<Ls.length&&Ls[i].ang-Ls[g0].ang<=ANG*2)continue;
    const G=Ls.slice(g0,i).sort((p,q)=>p.c-q.c);g0=i;
    for(let x=0;x<G.length;x++){const A=G[x];for(let y=x+1;y<G.length;y++){const B=G[y];const dc=B.c-A.c;if(dc>maxT+5)break;if(dc<minT-5)continue;
      const u0=dot(B.a,A.d),u1=dot(B.b,A.d);const lo=Math.max(A.t0,Math.min(u0,u1)),hi=Math.min(A.t1,Math.max(u0,u1));if(hi-lo<50)continue;
      const sepAt=u=>{const tB=(u-u0)/((u1-u0)||1);return dot(sub(add(B.a,mul(sub(B.b,B.a),tB)),A.a),A.nr);};
      const s0=sepAt(lo),s1=sepAt(hi);if(Math.abs(s0-s1)>3)continue;const sep=(s0+s1)/2;if(Math.abs(sep)<minT||Math.abs(sep)>maxT)continue;
      cands.push({A,B,lo,hi,sep});}}}
  // 3. closest partners first; each stretch of line is used once
  cands.sort((p,q)=>Math.abs(p.sep)-Math.abs(q.sep));
  const pieces=[];
  for(const k of cands){const {A,B}=k,t=Math.abs(k.sep);
    const onA=u=>add(A.a,mul(A.d,u-dot(A.a,A.d))),onB=v=>add(B.a,mul(B.d,v-dot(B.a,B.d)));
    const bToA=([x,y])=>{const p=dot(onB(x),A.d),q=dot(onB(y),A.d);return [Math.min(p,q),Math.max(p,q)];};
    let free=subtractIv(subtractIv([[k.lo,k.hi]],A.cov),B.cov.map(bToA));
    for(const [lo,hi] of free){if(hi-lo<Math.max(0.8*t,100))continue;const off=mul(A.nr,Math.sign(k.sep)*t/2);
      const P0=add(onA(lo),off);pieces.push({t,d:A.d,nr:A.nr,ang:A.ang,c:dot(P0,A.nr),t0:lo,t1:hi});
      A.cov.push([lo,hi]);const p=dot(onA(lo),B.d),q=dot(onA(hi),B.d);B.cov.push([Math.min(p,q),Math.max(p,q)]);}}
  // 4. collinear pieces of the same thickness form clusters
  const clusters=[];
  for(const p of pieces){const cl=clusters.find(c=>Math.abs(c.ang-p.ang)<=ANG*2&&Math.abs(c.c-p.c)<=5&&Math.abs(c.t-p.t)<=10);if(cl)cl.ps.push(p);else clusters.push({ang:p.ang,c:p.c,t:p.t,d:p.d,nr:p.nr,ps:[p]});}
  const at=(cl,u)=>add(mul(cl.d,u),mul(cl.nr,cl.c));
  const abuts=(cl,lo,hi)=>pieces.some(p=>{if(Math.abs(cross(p.d,cl.d))<0.2||p.dead)return false;
    return [p.t0,p.t1].some(u=>{const E=add(mul(p.d,u),mul(p.nr,p.c));const al=dot(E,cl.d);return al>=lo-5&&al<=hi+5&&Math.abs(dot(E,cl.nr)-cl.c)<=cl.t/2+p.t/2+30;});});
  const arcMid=a=>{const sw=a.full?Math.PI*2:(((a.a0-a.a1)%(2*Math.PI))+2*Math.PI)%(2*Math.PI)||Math.PI*2;const m=a.a0-sw/2;return [a.x+a.r*Math.cos(m),a.y+a.r*Math.sin(m)];};
  function evidence(cl,lo,hi){const w=hi-lo;if(w<400||w>4000)return null;const J0=at(cl,lo),J1=at(cl,hi);
    let best=null;
    for(const a of evid.arcs){if(a.r<0.4*w||a.r>1.15*w)continue;const d0=dist([a.x,a.y],J0),d1=dist([a.x,a.y],J1);if(Math.min(d0,d1)>cl.t/2+60)continue;
      const m=arcMid(a);best={kind:'door',hingeLow:d0<=d1,side:dot(sub(m,at(cl,(lo+hi)/2)),cl.nr)>=0?1:-1};break;}
    if(best)return best;
    const inBand=(P,Q)=>{const dd=norm(sub(Q,P));if(Math.abs(cross(dd,cl.d))>0.02)return false;const m=mul(add(P,Q),.5);if(Math.abs(dot(m,cl.nr)-cl.c)>cl.t/2+5)return false;
      const u0=dot(P,cl.d),u1=dot(Q,cl.d);return Math.min(hi,Math.max(u0,u1))-Math.max(lo,Math.min(u0,u1))>=0.6*w;};
    let glaz=false;for(const [P,Q] of evid.segs)if(inBand(P,Q)){glaz=true;break;}
    for(const p of pieces){if(p.dead||p.t>=cl.t||Math.abs(cross(p.d,cl.d))>0.02||Math.abs(p.c-cl.c)>cl.t/2)continue;
      if(Math.min(hi,p.t1)-Math.max(lo,p.t0)>=0.6*w){p.dead=true;glaz=true;}}
    return glaz?{kind:'window'}:null;}
  // 5. merge each cluster into runs, bridging joints, T-junctions, doors and windows
  const runs=[];
  for(const cl of clusters){const ps=cl.ps.sort((p,q)=>p.t0-q.t0);let run=null;
    for(const p of ps){
      if(!run){run={cl,t0:p.t0,t1:p.t1,ps:[p],ops:[]};continue;}
      const gap=p.t0-run.t1;
      if(gap<=5||gap<=450||abuts(cl,run.t1,p.t0)){run.t1=Math.max(run.t1,p.t1);run.ps.push(p);continue;}
      const ev=evidence(cl,run.t1,p.t0);
      if(ev){run.ops.push(Object.assign({P:at(cl,(run.t1+p.t0)/2),w:gap},ev));run.t1=Math.max(run.t1,p.t1);run.ps.push(p);continue;}
      runs.push(run);run={cl,t0:p.t0,t1:p.t1,ps:[p],ops:[]};}
    if(run)runs.push(run);}
  const W=runs.filter(r=>!r.ps.every(p=>p.dead)).map(r=>({a:at(r.cl,r.t0),b:at(r.cl,r.t1),t:Math.round(r.cl.t),ops:r.ops}));
  // 6. corners and T-junctions: pull each end onto the centreline of the wall it meets
  for(const w of W)for(const k of ['a','b']){
    const P=w[k],Q=w[k==='a'?'b':'a'];const u=norm(sub(P,Q));let best=null,bs=1e9;
    for(const o of W){if(o===w)continue;const od=norm(sub(o.b,o.a));if(Math.abs(cross(u,od))<0.2)continue;
      const X=lineX(P,u,o.a,od);if(!X)continue;const s=dot(sub(X,P),u);if(s<-(o.t/2+w.t/2+40)||s>o.t/2+w.t+60)continue;
      const Lo=dist(o.a,o.b),v=dot(sub(X,o.a),od);if(v<-(w.t/2+60)||v>Lo+w.t/2+60)continue;
      if(Math.abs(s)<bs){bs=Math.abs(s);best={o,X,v,Lo};}}
    if(best){w[k]=best.X.slice();
      if(best.v<1&&dist(best.o.a,best.X)<w.t/2+80)best.o.a=best.X.slice();
      else if(best.v>best.Lo-1&&dist(best.o.b,best.X)<w.t/2+80)best.o.b=best.X.slice();}}
  // 7. tidy: weld ends that almost touch, round to the millimetre
  const pts=[];W.forEach(w=>['a','b'].forEach(k=>{const p=w[k];const q=pts.find(z=>dist(z,p)<3);if(q)w[k]=q;else{const r=[Math.round(p[0]),Math.round(p[1])];pts.push(r);w[k]=r;}}));
  return W.filter(w=>dist(w.a,w.b)>=50);}

// Room names from text placed inside rooms, with the room type guessed from the words (English and Arabic).
function guessRoomType(s){s=s.toLowerCase();
  if(/kitchen|kitchenette|cuisine|مطبخ/.test(s))return 'kitchen';
  if(/bath|wc|toilet|shower|lav|حمام|مرحاض|تواليت|دورة مياه|مغسل/.test(s))return 'bath';
  if(/bed|master|نوم|ماستر/.test(s))return 'bedroom';
  if(/living|lounge|family|salon|sitting|dining|معيشة|صالون|جلوس|استقبال|طعام|سفرة/.test(s))return 'living';
  if(/hall|corridor|entr|lobby|foyer|ممر|مدخل|موزع|بهو|ردهة/.test(s))return 'hall';
  return 'other';}

/* ============================== AutoCAD DXF: write ============================== */
// Every face of every room (and the outside) offset to the wall faces: clean outlines with real corners,
// cut where doors and windows are, instead of overlapping rectangles.
function wallOutlines(){
  const pf=planarFaces();const segs=[],jambs=[];if(!pf)return {segs,jambs};
  const {fs,innerSign}=pf;let inw=0;
  for(const f of fs){if(Math.abs(f.area)<1)continue;const poly=f.poly,n=poly.length;const d0=norm(sub(poly[1%n],poly[0]));
    const inPoly=pointInPoly(add(mul(add(poly[0],poly[1%n]),.5),mul(perp(d0),2)),poly);const faceInside=Math.sign(f.area)===innerSign;
    inw=(faceInside?inPoly:!inPoly)?1:-1;break;}
  if(!inw)inw=1;
  const cutByOpenings=(w,P,Q)=>{const d=wallDir(w);const sP=dot(sub(P,w.a),d),sQ=dot(sub(Q,w.a),d);if(Math.abs(sQ-sP)<1e-6)return [[P,Q]];
    const lo=Math.min(sP,sQ),hi=Math.max(sP,sQ);const cov=M.openings.filter(o=>o.wall===w.id).map(o=>[o.s-o.w/2,o.s+o.w/2]);
    return subtractIv([[lo,hi]],cov).map(([x,y])=>{const at=s=>add(P,mul(sub(Q,P),(s-sP)/(sQ-sP)));return [at(x),at(y)];});};
  for(const f of fs){const lp=f.loop,n=lp.length;if(!n)continue;
    const L=lp.map((h,i)=>{const a=f.poly[i],b=f.poly[(i+1)%n];const d=norm(sub(b,a));const off=mul(perp(d),inw*h.e.w.t/2);return {p:add(a,off),q:add(b,off),d,w:h.e.w};});
    const st=new Array(n),en=new Array(n);
    for(let i=0;i<n;i++){const pr=L[(i-1+n)%n],ln=L[i];
      if(Math.abs(cross(pr.d,ln.d))>1e-6){const X=lineX(pr.p,pr.d,ln.p,ln.d);en[(i-1+n)%n]=X;st[i]=X;}
      else{en[(i-1+n)%n]=pr.q;st[i]=ln.p;if(dist(pr.q,ln.p)>0.5)segs.push([pr.q,ln.p]);}} // wall end caps and thickness steps
    for(let i=0;i<n;i++)if(dist(st[i],en[i])>0.5)cutByOpenings(L[i].w,st[i],en[i]).forEach(s=>{if(dist(s[0],s[1])>0.5)segs.push(s);});}
  M.openings.forEach(o=>{const w=wallById(o.wall);if(!w)return;const d=wallDir(w),n=perp(d);
    [o.s-o.w/2,o.s+o.w/2].forEach(s=>{const c=add(w.a,mul(d,s));jambs.push([add(c,mul(n,w.t/2)),add(c,mul(n,-w.t/2))]);});});
  return {segs,jambs};}

function dxfEscape(s){return String(s).replace(/[\r\n]+/g,' ').replace(/[^\x20-\x7e]/g,ch=>{const c=ch.charCodeAt(0);return c>0xffff?'?':'\\U+'+c.toString(16).toUpperCase().padStart(4,'0');});}
const EXPORT_UNITS={mm:{f:1,ins:4,label:'millimetres'},cm:{f:10,ins:5,label:'centimetres'},m:{f:1000,ins:6,label:'metres'},in:{f:25.4,ins:1,label:'inches'}};
function toDXF(opts){
  opts=Object.assign({unit:'mm',fixtures:true,labels:true,dims:true,reference:false},opts||{});
  const U=EXPORT_UNITS[opts.unit]||EXPORT_UNITS.mm,f=U.f;
  const num=v=>{v=Math.round(v*1e5)/1e5;if(Object.is(v,-0)||Math.abs(v)<1e-9)v=0;return String(v);};
  let x0=1e300,y0=1e300,x1=-1e300,y1=-1e300;
  const P=p=>{const x=p[0]/f,y=-p[1]/f;if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;return [x,y];};
  const E=[];
  const LINE=(L,a,b)=>{const A=P(a),B=P(b);if(Math.hypot(A[0]-B[0],A[1]-B[1])<1e-9)return;E.push('0','LINE','8',L,'10',num(A[0]),'20',num(A[1]),'30','0','11',num(B[0]),'21',num(B[1]),'31','0');};
  const ARC=(L,c,r,s,e)=>{const C=P(c);E.push('0','ARC','8',L,'10',num(C[0]),'20',num(C[1]),'30','0','40',num(r/f),'50',num(s),'51',num(e));};
  const TEXT=(L,p,h,s,rot)=>{const A=P(p);E.push('0','TEXT','8',L,'10',num(A[0]),'20',num(A[1]),'30','0','40',num(h/f),'1',dxfEscape(s));if(rot)E.push('50',num(rot));E.push('72','4','11',num(A[0]),'21',num(A[1]),'31','0');};
  const dxfAng=v=>Math.atan2(-v[1],v[0])*180/Math.PI; // model (y down) direction → DXF degrees
  const readable=a=>{a=((a%360)+360)%360;return a>90.001&&a<=270.001?a-180:a;};
  // walls
  const {segs,jambs}=wallOutlines();segs.forEach(([a,b])=>LINE('A-WALL',a,b));jambs.forEach(([a,b])=>LINE('A-WALL',a,b));
  // doors and windows
  M.openings.forEach(o=>{const w=wallById(o.wall);if(!w)return;const d=wallDir(w),n=perp(d),h=w.t/2,c=add(w.a,mul(d,o.s));const j0=add(c,mul(d,-o.w/2)),j1=add(c,mul(d,o.w/2));
    if(o.kind==='window'){[h,-h,h*0.25,-h*0.25].forEach(k=>LINE('A-GLAZ',add(j0,mul(n,k)),add(j1,mul(n,k))));return;}
    if(isSliding(o)){const {pt,list}=slidePanels(o,w);list.forEach(P=>{const q=[[P.s0,P.off-pt/2],[P.s1,P.off-pt/2],[P.s1,P.off+pt/2],[P.s0,P.off+pt/2]].map(([u,v])=>add(c,add(mul(d,u),mul(n,v))));for(let i=0;i<4;i++)LINE('A-DOOR',q[i],q[(i+1)%4]);});return;}
    const sn=o.flip?-1:1,H=add(o.hinge?j1:j0,mul(n,sn*h)),F=add(o.hinge?j0:j1,mul(n,sn*h)),tip=add(H,mul(n,sn*o.w));
    LINE('A-DOOR',H,tip);let a0=dxfAng(sub(tip,H)),a1=dxfAng(sub(F,H));if((((a1-a0)%360)+360)%360>180)[a0,a1]=[a1,a0];ARC('A-DOOR',H,o.w,a0,a1);});
  // fixtures
  (M.cols||[]).forEach(c=>{if(c.shape==='round'){const C0=P([c.x,c.y]);E.push('0','CIRCLE','8','A-COLS','10',num(C0[0]),'20',num(C0[1]),'30','0','40',num(c.w/2/f));}
    else{const q=colCorners(c);q.forEach((p,i)=>LINE('A-COLS',p,q[(i+1)%4]));LINE('A-COLS',q[0],q[2]);LINE('A-COLS',q[1],q[3]);}});
  if(opts.fixtures)M.items.forEach(it=>{const pts=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([x,y])=>add([it.x,it.y],rotV([x*it.w/2,y*it.d/2],it.r)));
    pts.forEach((p,i)=>LINE(it.z>=1000?'A-FURN-UPPR':'A-FURN',p,pts[(i+1)%4]));});
  // labels and dimensions are written with the chosen unit's own number format
  const keep=units;units=opts.unit==='in'?'imperial':opts.unit;
  try{
    if(opts.labels)rooms.forEach(r=>{TEXT('A-AREA-IDEN',add(r.centroid,[0,-130]),200,r.name);TEXT('A-AREA-IDEN',add(r.centroid,[0,170]),140,(r.netArea/1e6).toFixed(2)+' m²');});
    if(opts.dims)(M.dims||[]).forEach(dm=>{const L=dist(dm.a,dm.b);if(L<1)return;const d=norm(sub(dm.b,dm.a)),n=perp(d),tk=mul(norm(add(d,n)),90);
      LINE('A-ANNO-DIMS',dm.a,dm.b);[dm.a,dm.b].forEach(p=>LINE('A-ANNO-DIMS',sub(p,tk),add(p,tk)));TEXT('A-ANNO-DIMS',add(mul(add(dm.a,dm.b),.5),mul(n,-140)),150,fmtLen(L),readable(dxfAng(d)));});
    if(opts.dims)M.walls.forEach(w=>{const d=wallDir(w),n=perp(d),m=mul(add(w.a,w.b),.5),L=wallLen(w);if(L<300)return;
      const inA=rooms.some(r=>pointInPoly(add(m,mul(n,w.t/2+200)),r.poly)),inB=rooms.some(r=>pointInPoly(add(m,mul(n,-(w.t/2+200))),r.poly));if(inA===inB)return;
      const nn=mul(n,inA?-1:1),ext=wallExt(w);const a=add(add(w.a,mul(d,-ext[0])),mul(nn,w.t/2)),b=add(add(w.b,mul(d,ext[1])),mul(nn,w.t/2));
      const A=add(a,mul(nn,600)),B=add(b,mul(nn,600));LINE('A-ANNO-DIMS',A,B);LINE('A-ANNO-DIMS',add(a,mul(nn,150)),add(A,mul(nn,100)));LINE('A-ANNO-DIMS',add(b,mul(nn,150)),add(B,mul(nn,100)));
      const tk=mul(norm(add(d,nn)),90);[A,B].forEach(p=>LINE('A-ANNO-DIMS',sub(p,tk),add(p,tk)));
      TEXT('A-ANNO-DIMS',add(mul(add(A,B),.5),mul(nn,140)),150,fmtLen(L+ext[0]+ext[1]),readable(dxfAng(d)));});
  }finally{units=keep;}
  // reference drawing
  (M.areas||[]).forEach(A=>{if(A.pts.length<3)return;for(let i=0;i<A.pts.length;i++){const [p,q,sg]=areaEdge(A,i);
      if(Math.abs(sg)<0.5){LINE('A-AREA-MEAS',p,q);continue;}const g=arcGeom(p,q,sg);const a1=dxfAng(sub(p,g.C)),a2=dxfAng(sub(q,g.C));
      // DXF arcs run counter-clockwise; pick the order whose middle is the apex
      const mid=dxfAng(sub(g.apex,g.C)),inCCW=(s0,e0,m)=>{const n=v=>((v%360)+360)%360;return n(m-s0)<n(e0-s0);};if(inCCW(a1,a2,mid))ARC('A-AREA-MEAS',g.C,g.r,a1,a2);else ARC('A-AREA-MEAS',g.C,g.r,a2,a1);}
    const st=areaStats(A),c=areaCentroid(A);TEXT('A-AREA-MEAS',c,180,A.name||'Area',0);TEXT('A-AREA-MEAS',add(c,[0,260]),150,fmtArea(st.area)+' '+areaU(),0);});
  (M.texts||[]).forEach(T=>{const L=textLines(T),lh=T.h*1.3;L.forEach((l,i)=>{if(!l.trim())return;const B=textBox(T);const c=mul(add(B[0],B[2]),.5);
      const p=add(c,rotV([0,(i-(L.length-1)/2)*lh],T.r||0));TEXT('A-ANNO-TEXT',p,T.h,l,-(T.r||0));});});
  M.walls.forEach(w=>{if(!w.kind)return;const ext=wallExt(w);wallPieces(w,ext).forEach(([s0,s1])=>{const q=pieceQuad(w,s0,s1);for(let i=0;i<4;i++)LINE('L-SITE-'+w.kind.toUpperCase(),q[i],q[(i+1)%4]);});});
  const refLayers=[];
  if(opts.reference&&refDrawing){const R=refDrawing;const lname=i=>{const nm='REF-'+(i+1)+'-'+String(R.layers[i]||'').replace(/[^A-Za-z0-9_-]+/g,'').slice(0,20);if(!refLayers.includes(nm))refLayers.push(nm);return nm;};
    for(let i=0;i<R.sl.length;i++)LINE(lname(R.sl[i]),[R.segs[4*i],R.segs[4*i+1]],[R.segs[4*i+2],R.segs[4*i+3]]);
    R.arcs.forEach(([x,y,r,a0,a1,li,full])=>{if(full)ARC(lname(li),[x,y],r,0,360);else ARC(lname(li),[x,y],r,-a0*180/Math.PI,-a1*180/Math.PI);});
    R.texts.forEach(([x,y,h,rot,s,li])=>TEXT(lname(li),[x,y],h,s,-rot*180/Math.PI));}
  if(x0>x1){x0=y0=0;x1=y1=1;}
  // header and tables (AutoCAD R12 ASCII: opens in every AutoCAD release and most CAD programs)
  const H=['0','SECTION','2','HEADER','9','$ACADVER','1','AC1009','9','$DWGCODEPAGE','3','ANSI_1252','9','$INSBASE','10','0','20','0','30','0',
    '9','$EXTMIN','10',num(x0),'20',num(y0),'30','0','9','$EXTMAX','10',num(x1),'20',num(y1),'30','0',
    '9','$INSUNITS','70',String(U.ins),'9','$MEASUREMENT','70',opts.unit==='in'?'0':'1','9','$LTSCALE','40','1','0','ENDSEC'];
  const dash=[60/f,-40/f];
  const layers=[['0',7,'CONTINUOUS'],['A-WALL',7,'CONTINUOUS'],['A-DOOR',3,'CONTINUOUS'],['A-GLAZ',4,'CONTINUOUS'],['A-FURN',8,'CONTINUOUS'],['A-FURN-UPPR',8,'DASHED'],
    ['A-COLS',6,'CONTINUOUS'],['A-AREA-IDEN',2,'CONTINUOUS'],['A-ANNO-DIMS',1,'CONTINUOUS'],['A-AREA-MEAS',30,'CONTINUOUS'],['L-SITE-FENCE',32,'CONTINUOUS'],['L-SITE-GWALL',8,'CONTINUOUS'],['L-SITE-HEDGE',3,'CONTINUOUS'],['L-SITE-RAILING',250,'CONTINUOUS'],['A-ANNO-TEXT',7,'CONTINUOUS'],...refLayers.map(n=>[n,9,'CONTINUOUS'])];
  const T=['0','SECTION','2','TABLES',
    '0','TABLE','2','LTYPE','70','2',
    '0','LTYPE','2','CONTINUOUS','70','0','3','Solid line','72','65','73','0','40','0',
    '0','LTYPE','2','DASHED','70','0','3','Dashed __ __ __','72','65','73','2','40',num(dash[0]-dash[1]),'49',num(dash[0]),'49',num(dash[1]),
    '0','ENDTAB','0','TABLE','2','LAYER','70',String(layers.length)];
  layers.forEach(([n,c,lt])=>T.push('0','LAYER','2',n,'70','0','62',String(c),'6',lt));
  T.push('0','ENDTAB','0','TABLE','2','STYLE','70','1','0','STYLE','2','STANDARD','70','0','40','0','41','1','50','0','71','0','42','2.5','3','txt','4','','0','ENDTAB','0','ENDSEC');
  return [...H,...T,'0','SECTION','2','BLOCKS','0','ENDSEC','0','SECTION','2','ENTITIES',...E,'0','ENDSEC','0','EOF'].join('\r\n')+'\r\n';}

/* ============================== modal ============================== */
function openModal(title,text,area,buttons,bodyNode,wide){$('#modalTitle').textContent=title;$('#modalText').textContent=text;const ta=$('#modalArea');ta.hidden=area==null;if(area!=null)ta.value=area;
  const mb=$('#modalBody');mb.innerHTML='';if(bodyNode)mb.appendChild(bodyNode);mb.hidden=!bodyNode;$('#modal .card').classList.toggle('wide',!!wide);
  const bb=$('#modalBtns');bb.innerHTML='';buttons.forEach(b=>{const e=document.createElement('button');e.className='btn'+(b.primary?' primary':'');e.textContent=b.label;e.onclick=()=>b.fn(e);bb.appendChild(e);});$('#modal').hidden=false;bb.lastChild&&bb.lastChild.focus();}
function closeModal(){$('#modal').hidden=true;$('#modalBody').innerHTML='';}
function copyText(s,btn){const done=()=>{btn.textContent='Copied';setTimeout(()=>btn.textContent='Copy',1600);};
  try{navigator.clipboard.writeText(s).then(done,()=>{$('#modalArea').hidden=false;$('#modalArea').value=s;$('#modalArea').select();btn.textContent='Press Ctrl+C';});}catch(e){$('#modalArea').select();}}
$('#csvBtn').onclick=e=>{const s=takeoffCSV();const b=e.currentTarget;try{navigator.clipboard.writeText(s).then(()=>{b.textContent='Copied';setTimeout(()=>b.textContent='Copy as CSV',1600);},()=>openModal('Takeoff CSV','Select all and copy.',s,[{label:'Close',fn:closeModal}]));}catch(err){openModal('Takeoff CSV','Select all and copy.',s,[{label:'Close',fn:closeModal}]);}};
$('#newBtn').onclick=()=>newProjectDialog();

/* ============================== files ============================== */
// In the installed app (Tauri) files go through native save/open dialogs. In a browser they download / use a file picker.
const TAURI=window.__TAURI__||null;const NATIVE=!!(TAURI&&TAURI.dialog&&TAURI.fs);let filePath=null;
const PROJ_FILTER=[{name:'Benchmark project',extensions:['json']}];
const safeName=n=>(String(n||'project').replace(/[\\/:*?"<>|]+/g,' ').trim()||'project').slice(0,80);
const baseName=p=>{p=decodeURIComponent(String(p));return p.split(/[\\/]/).pop().split(':').pop();};
let toastT=null;function toast(msg){const t=$('#toast');t.textContent=msg;t.hidden=false;clearTimeout(toastT);toastT=setTimeout(()=>t.hidden=true,2600);}
function browserDownload(name,text){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type:'application/octet-stream'}));a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},1500);}
async function saveTextFile(name,text,label,exts){
  if(NATIVE){const path=await TAURI.dialog.save({defaultPath:name,filters:[{name:label,extensions:exts}]});if(!path)return null;await TAURI.fs.writeTextFile(path,text);return path;}
  browserDownload(name,text);return name;}
async function openProjectFile(){
  if(NATIVE){const sel=await TAURI.dialog.open({multiple:false,directory:false,filters:/Android/i.test(navigator.userAgent)?undefined:PROJ_FILTER});if(!sel)return null;
    const path=typeof sel==='string'?sel:(sel.path||sel.uri||String(sel));return {path,text:await TAURI.fs.readTextFile(path)};}
  return new Promise(res=>{const inp=document.createElement('input');inp.type='file';inp.accept='.json,application/json';inp.onchange=()=>{const f=inp.files[0];if(!f)return res(null);f.text().then(t=>res({path:null,text:t}));};inp.click();});}
function projectJSON(){return JSON.stringify({app:'benchmark-planner',version:1,units,model:M,reference:refDrawing||undefined,refImage:refImage||undefined});}
function markSaved(){if(!activeTab)return;activeTab.savedSnap=snapshot();activeTab.lastSaved=Date.now();activeTab.filePath=filePath;activeTab.stored=false;saveTabsNow();renderTabs();}
async function saveProject(as){
  try{const text=projectJSON();
    if(NATIVE&&filePath&&!as){await TAURI.fs.writeTextFile(filePath,text);markSaved();toast('Saved '+baseName(filePath));return true;}
    const p=await saveTextFile(safeName(M.name)+'.bench.json',text,'Benchmark project',['json']);if(p){if(NATIVE)filePath=p;markSaved();toast('Saved '+baseName(p));return true;}return false;}
  catch(err){toast('Could not save: '+err);return false;}}
async function openProject(){
  try{const f=await openProjectFile();if(!f)return;const o=JSON.parse(f.text);const m=o&&o.model;
    if(!m||!Array.isArray(m.walls)||!Array.isArray(m.items)||!Array.isArray(m.openings))throw new Error('this is not a Benchmark project file');
    // opens in its own tab, unless this tab is still empty
    const already=f.path&&tabs.find(t=>t.filePath===f.path);if(already){switchTab(already.id);toast(baseName(f.path)+' is already open.');return;}
    storeActive();const t=makeTab(Object.assign(blankModel(),m),{units:normUnits(o.units||units),ref:o.reference||null,img:o.refImage||null,filePath:NATIVE?f.path:null,lastSaved:Date.now()});
    t.savedSnap=JSON.stringify(t.M);if(activeTab&&tabIsBlank(activeTab)&&!tabDirty(activeTab)){const i=tabs.indexOf(activeTab);tabs.splice(i,1,t);try{localStorage.removeItem('bm-tab-'+activeTab.id);}catch(e){}}else tabs.push(t);
    activate(t,true);saveTabsNow();toast('Opened '+(f.path?baseName(f.path):M.name));}
  catch(err){toast('Could not open: '+(err.message||err));}}



/* ============================== laser measure: Bosch GLM 400 C (GLM 50 C / 100 C / 120 C) over Bluetooth ============================== */
// The meter talks Bluetooth Low Energy. After connecting we turn on its "sync" mode; from then on every measurement taken
// on the meter is sent as a 20-byte frame: C0 55 10 <status> ... with the distance in metres as a little-endian float at byte 7.
// Installed app (Windows, Mac, Linux, Android): the blec plugin. Chrome / Edge web version: Web Bluetooth.
const GLM={SVC:'02a6c0d0-0451-4000-b000-fb3210111989',CHR:'02a6c0d1-0451-4000-b000-fb3210111989',SYNC:[0xC0,0x55,0x02,0x01,0x00,0x1A],NAME:/GLM|BOSCH|PLR|DLE/i};
const laser={state:'off',name:'',dev:null,chr:null,raw:'',lastMM:null,lastAt:0,waiter:null,picking:false,scanList:[]};
let laserChain={tab:null,side:'left',seg:[],start:null};   // seg: [{F,G,d,off,id}] — F,G are the room-side face points
const BLEC_OK=!!(TAURI&&TAURI.core&&TAURI.core.invoke);
const WEBBT_OK=!BLEC_OK&&!!(navigator.bluetooth&&navigator.bluetooth.requestDevice);
const laserSupported=()=>BLEC_OK||WEBBT_OK;
const hex=d=>Array.from(d).map(b=>b.toString(16).padStart(2,'0')).join(' ');
function glmParse(bytes){const d=Uint8Array.from(bytes);
  if(d.length<11||d[0]!==0xC0||d[1]!==0x55||d[2]!==0x10)return null;
  const v=new DataView(d.buffer).getFloat32(7,true);if(!isFinite(v)||v<0.0005||v>300)return null;return Math.round(v*10000)/10;}
function onLaserData(bytes){laser.raw=hex(bytes);const r=$('#lzRaw');if(r)r.textContent=laser.raw;
  const mm=glmParse(bytes);if(mm==null)return;laser.lastMM=mm;laser.lastAt=Date.now();
  if(laser.waiter){const w=laser.waiter;laser.waiter=null;w(mm);}
  else toast('Laser: '+fmtLen(mm,true)+'. Press Read first to draw a wall with it.');
  const lu=$('#lzLast');if(lu){lu.hidden=false;lu.textContent='Use last reading ('+fmtLen(mm,true)+')';}}
function setLaserState(s,name){laser.state=s;if(name!=null)laser.name=name;renderLaserBtn();dirty();}
function onLaserLost(){if(laser.state==='off')return;laser.dev=null;laser.chr=null;laser.waiter=null;setLaserState('off');
  if(!$('#modal').hidden&&$('#lzWait'))closeModal();toast('The laser disconnected. Press Laser to connect again.');}
function renderLaserBtn(){const b=$('#laserBtn');if(!b)return;b.hidden=false;const s=laser.state;b.dataset.state=laserSupported()?s:'na';
  $('#laserLbl').textContent=s==='on'?'Read':s==='connecting'?'Connecting…':'Laser';
  b.title=!laserSupported()?'Laser measure: Bluetooth isn’t available in this browser':s==='on'?'Read a wall length from '+(laser.name||'the laser')+' (Bluetooth connected)':s==='connecting'?'Connecting to the laser…':'Connect a Bosch laser measure by Bluetooth';
  b.setAttribute('aria-label',b.title);}
function laserBtnClick(){if(laser.state==='on')laserReadDialog();else if(laser.state==='off')laserConnect();}

// ---- connecting
async function laserConnect(){
  if(BLEC_OK)return blecConnect();
  if(!WEBBT_OK||!window.isSecureContext||window.top!==window.self&&!document.featurePolicy?.allowsFeature?.('bluetooth')){openModal('Bluetooth isn’t available here','This page can’t use Bluetooth. To connect the Bosch laser, use the installed Android or Windows app, or the web version opened directly in Chrome or Edge (not inside another page such as this preview).',null,[{label:'OK',primary:true,fn:closeModal}]);return;}
  try{setLaserState('connecting');
    const dev=await navigator.bluetooth.requestDevice({filters:[{namePrefix:'GLM'},{namePrefix:'Bosch'},{namePrefix:'BOSCH'},{services:[GLM.SVC]}],optionalServices:[GLM.SVC]});
    dev.addEventListener('gattserverdisconnected',onLaserLost);
    const srv=await dev.gatt.connect();const svc=await srv.getPrimaryService(GLM.SVC);const chr=await svc.getCharacteristic(GLM.CHR);
    chr.addEventListener('characteristicvaluechanged',e=>{const v=e.target.value;onLaserData(new Uint8Array(v.buffer,v.byteOffset,v.byteLength));});
    await chr.startNotifications();
    const data=new Uint8Array(GLM.SYNC);await(chr.writeValueWithResponse?chr.writeValueWithResponse(data):chr.writeValue(data));
    laser.dev=dev;laser.chr=chr;setLaserState('on',dev.name||'Laser');toast('Connected to '+laser.name+'. Press Read, then measure.');
  }catch(e){setLaserState('off');if(e&&e.name==='NotFoundError')return;laserFail(e);}}
function laserFail(e){const msg=String(e&&e.message||e);
  openModal('Couldn’t connect to the laser',msg+'\n\nCheck that Bluetooth is on in the laser’s settings menu and on this device, that the laser is switched on, and that the Bosch MeasureOn app isn’t connected to it at the same time.',null,[{label:'OK',primary:true,fn:closeModal}]);}
// installed app: scan, list the meters found, connect to the one picked (or straight away to the one used last time)
const binv=(c,a)=>TAURI.core.invoke('plugin:blec|'+c,a||{});
function bchan(fn){const ch=new TAURI.core.Channel();ch.onmessage=fn;return ch;}
let lastLaser=null;try{lastLaser=JSON.parse(localStorage.getItem('bm-laser')||'null');}catch(e){}
async function blecConnect(){
  try{const ok=await binv('check_permissions',{askIfDenied:true});if(ok===false){laserFail('Bluetooth permission wasn’t given to Benchmark Planner.');return;}}
  catch(e){laserFail(/not found|unknown|plugin/i.test(String(e))?'This copy of the app was built without Bluetooth. Install the newest build.':e);return;}
  const body=document.createElement('div');body.className='lzscan';
  body.innerHTML=`<p class="tip" id="lzScanNote">Looking for laser measures… Switch the laser on and make sure Bluetooth is on in its menu.</p><div class="lzlist" id="lzList"></div>
    <label class="lzall"><input type="checkbox" id="lzAll"> Show every Bluetooth device</label>`;
  let done=false;const stop=()=>{if(done)return;done=true;binv('stop_scan').catch(()=>{});};
  openModal('Connect a laser measure','',null,[{label:'Cancel',fn:()=>{stop();closeModal();}},{label:'Search again',fn:()=>{done=false;scan();}}],body);
  const list=$('#lzList'),all=$('#lzAll');
  const render=()=>{const devs=laser.scanList.filter(d=>all.checked||GLM.NAME.test(d.name||''));
    list.innerHTML=devs.length?devs.map(d=>`<button class="btn lzdev" data-a="${esc(d.address)}"><b>${esc(d.name||'Unnamed device')}</b><span>${esc(d.address)}</span></button>`).join(''):'<p class="tip">Nothing found yet.</p>';
    list.querySelectorAll('[data-a]').forEach(b=>b.onclick=()=>{stop();pick(laser.scanList.find(d=>d.address===b.dataset.a));});};
  all.onchange=render;
  const pick=async d=>{if(!d)return;closeModal();setLaserState('connecting');
    try{await binv('connect',{address:d.address,onDisconnect:bchan(()=>onLaserLost()),allowIbeacons:false});
      await binv('subscribe',{characteristic:GLM.CHR,service:GLM.SVC,onData:bchan(v=>onLaserData(v))});
      await binv('send',{characteristic:GLM.CHR,data:GLM.SYNC,writeType:'withResponse',service:GLM.SVC});
      lastLaser={address:d.address,name:d.name};try{localStorage.setItem('bm-laser',JSON.stringify(lastLaser));}catch(e){}
      setLaserState('on',d.name||'Laser');toast('Connected to '+laser.name+'. Press Read, then measure.');
    }catch(e){binv('disconnect').catch(()=>{});setLaserState('off');laserFail(e);}};
  const scan=()=>{laser.scanList=[];render();$('#lzScanNote').textContent='Looking for laser measures… Switch the laser on and make sure Bluetooth is on in its menu.';
    binv('scan',{timeout:12000,onDevices:bchan(devs=>{if(done)return;laser.scanList=devs||[];render();
      const again=lastLaser&&laser.scanList.find(d=>d.address===lastLaser.address);if(again){stop();pick(again);}}),allowIbeacons:false})
      .then(()=>{if(!done&&$('#lzScanNote'))$('#lzScanNote').textContent=laser.scanList.length?'Search finished. Pick your laser.':'No laser found. Check that it is on, then Search again.';})
      .catch(e=>{stop();closeModal();laserFail(e);});};
  scan();}
async function laserDisconnect(){laser.waiter=null;const was=laser.state;laser.state='off';
  try{if(BLEC_OK)await binv('disconnect');else if(laser.dev&&laser.dev.gatt.connected)laser.dev.gatt.disconnect();}catch(e){}
  laser.dev=null;laser.chr=null;if(was!=='off')toast('Laser disconnected.');renderLaserBtn();dirty();}

// ---- reading a wall
function laserChainOk(){const c=laserChain;if(!activeTab||c.tab!==activeTab.id){laserChain={tab:activeTab&&activeTab.id,side:c.side,seg:[],start:null};return;}
  while(c.seg.length&&!wallById(c.seg[c.seg.length-1].id))c.seg.pop();}
const laserNext=()=>{const c=laserChain;return c.seg.length?c.seg[c.seg.length-1].G:c.start;};
function laserPickStart(){closeModal();laser.waiter=null;laser.picking=true;$('#hint').innerHTML='<b>Laser:</b> tap the inside corner where the first wall starts. <kbd>Esc</kbd> cancels.';
  toast('Tap the plan at the inside corner where the wall starts.');planCv.style.cursor='crosshair';dirty();}
function laserStartAt(p){laser.picking=false;$('#hint').innerHTML=HINTS[tool]||'';laserChain={tab:activeTab.id,side:laserChain.side,seg:[],start:snapPoint(p,null).p};laserReadDialog();}
function laserReadDialog(){laserChainOk();const from=laserNext();if(!from){laserPickStart();return;}
  const body=document.createElement('div');body.className='lzread';const t=curWallSpec().t;
  const recent=laser.lastMM&&Date.now()-laser.lastAt<120000;
  body.innerHTML=`<div class="lzwait" id="lzWait"><span class="lzdot"></span><span id="lzMsg">Waiting for a measurement from ${esc(laser.name||'the laser')}…</span></div>
    <div class="kv">
      <label for="lzAng">Angle</label><div class="lzang"><input id="lzAng" inputmode="decimal" value="0" aria-describedby="lzAngTip"><span class="unit">°</span>
        <div class="seg segsm" role="group" aria-label="Quick angles">${[[0,'→ 0'],[90,'↑ 90'],[180,'← 180'],[270,'↓ 270']].map(([v,l])=>`<button type="button" data-ang="${v}" aria-pressed="${v===0}">${l}</button>`).join('')}</div></div>
      <label>Room side</label><div class="seg segsm" role="group" aria-label="Room side">${['left','right'].map(s=>`<button type="button" data-side="${s}" aria-pressed="${laserChain.side===s}">Room on the ${s}</button>`).join('')}</div>
      <label for="lzLen">Or type</label><div class="lzang"><input id="lzLen" inputmode="decimal" placeholder="length" autocomplete="off"><button type="button" class="btn" id="lzDraw">Draw</button></div>
    </div>
    <p class="tip" id="lzAngTip">0° points right, 90° up. The reading is the room-side face of the wall; the ${fmtLen(t,true)} wall thickness goes on the other side.
      ${laserChain.seg.length?'This wall continues from the end of the last one.':'This is the first wall of a new run.'} <a href="#" id="lzNew">Start somewhere else</a></p>
    <button type="button" class="btn" id="lzLast"${recent?'':' hidden'}>${recent?'Use last reading ('+fmtLen(laser.lastMM,true)+')':''}</button>
    <details class="lzdbg"><summary>Data from the laser</summary><code id="lzRaw">${esc(laser.raw||'nothing yet')}</code></details>`;
  const cancel=()=>{laser.waiter=null;closeModal();};
  openModal('Read wall length','Take one measurement on the laser. The wall is drawn as soon as it arrives.',null,
    [{label:'Disconnect',fn:()=>{closeModal();laserDisconnect();}},{label:'Cancel',primary:true,fn:cancel}],body);
  const ang=$('#lzAng'),btns=body.querySelectorAll('[data-ang]');
  const syncAng=()=>btns.forEach(b=>b.setAttribute('aria-pressed',String(parseFloat(ang.value)===+b.dataset.ang)));
  btns.forEach(b=>b.onclick=()=>{ang.value=b.dataset.ang;syncAng();});ang.oninput=syncAng;
  body.querySelectorAll('[data-side]').forEach(b=>b.onclick=()=>{laserChain.side=b.dataset.side;body.querySelectorAll('[data-side]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));});
  const go=mm=>{const a=parseFloat(String(ang.value).replace(',','.'));if(!isFinite(a)){lenIn.value=String(mm);ang.focus();toast('Type an angle in degrees, e.g. 90, then press Draw.');laser.waiter=go;return;}
    laser.waiter=null;closeModal();laserAddWall(mm,a);};
  const lenIn=$('#lzLen');laser.waiter=go;
  $('#lzLast').onclick=()=>{if(laser.lastMM)go(laser.lastMM);};
  $('#lzDraw').onclick=()=>{const L=parseLen(lenIn.value);if(L>0)go(L);else{lenIn.focus();toast('Type a length, e.g. 3600.');}};
  lenIn.onkeydown=e=>{e.stopPropagation();if(e.key==='Enter')$('#lzDraw').click();};ang.onkeydown=e=>e.stopPropagation();
  $('#lzNew').onclick=e=>{e.preventDefault();laserPickStart();};}
const lzCross=(a,b)=>a[0]*b[1]-a[1]*b[0];
function laserAddWall(L,deg){laserChainOk();const c=laserChain,F=laserNext();if(!F)return;
  const r=-deg*Math.PI/180;let d=[Math.cos(r),Math.sin(r)];d=d.map(v=>Math.abs(v)<1e-9?0:v);
  const t=curWallSpec().t,n=c.side==='left'?[-d[1],d[0]]:[d[1],-d[0]];const off=mul(n,t/2);   // toward the wall, away from the room (y points down)
  const G=add(F,mul(d,L));let a=add(F,off),b=add(G,off);
  const prev=c.seg[c.seg.length-1],first=c.seg[0];let joinPrev=null,closed=false;
  const meet=(p1,d1,p2,d2)=>{const den=lzCross(d1,d2);if(Math.abs(den)<1e-6)return null;const s=lzCross(sub(p2,p1),d2)/den;return add(p1,mul(d1,s));};
  if(prev){const X=meet(add(prev.F,prev.off),prev.d,a,d);if(X)joinPrev=a=X;else if(dot(prev.d,d)>0)joinPrev=a;}
  if(first&&c.seg.length>=2&&dist(G,first.F)<Math.max(150,L*0.03)){const X=meet(a,d,add(first.F,first.off),first.d);if(X){b=X;closed=true;}}
  let id=null;
  mutate(()=>{if(prev&&joinPrev){const pw=wallById(prev.id);if(pw)pw.b=joinPrev.slice();}
    if(closed){const fw=wallById(first.id);if(fw)fw.a=b.slice();}
    addWall(a,b);id=M.walls[M.walls.length-1].id;clampOpenings();});
  c.seg.push({F,G,d,off,id});
  if(closed){laserChain={tab:c.tab,side:c.side,seg:[],start:null};toast('Wall '+fmtLen(L,true)+' drawn — the room is closed. Press Read to start a new run.');}
  else toast('Wall '+fmtLen(L,true)+' at '+(Math.round(deg*10)/10)+'° drawn. Press Read for the next wall.');
  sel={kind:'wall',id};renderInspector();dirty();}
function drawLaserMark(){if(laser.state!=='on'||!activeTab||laserChain.tab!==activeTab.id)return;const p=laserNext();if(!p)return;
  const s=toS(p),col=C.accent||'#1f6feb';ctx.save();ctx.strokeStyle=col;ctx.fillStyle=col;ctx.lineWidth=1.5;
  ctx.beginPath();ctx.arc(s[0],s[1],7,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.arc(s[0],s[1],2.5,0,Math.PI*2);ctx.fill();
  ctx.font='600 11px '+getComputedStyle(document.body).fontFamily;ctx.fillText('next',s[0]+10,s[1]-8);ctx.restore();}

/* ============================== tabs: several projects open at once, and autosave ============================== */
// Each tab keeps its own drawing, undo history, reference, file and view. The active tab's state lives in the usual
// globals (M, undoStack, …); switching tabs swaps them. Every tab is also kept on this device, and a project that has
// a file is written back to it every 5 minutes when it has changes.
let tabs=[],activeTab=null,tabSeq=1;
const AUTOSAVE_MS=5*60*1000;
let autosaveOn=true;try{autosaveOn=localStorage.getItem('bm-autosave')!=='0';}catch(e){}
function tabJSON(t){return JSON.stringify({app:'benchmark-planner',version:1,units:t.units,model:t.M,reference:t.ref||undefined,refImage:t.img||undefined});}
function makeTab(model,o={}){return Object.assign({id:'t'+(tabSeq++),M:model||blankModel(),undo:[],redo:[],ref:null,img:null,filePath:null,units:units,view:null,elevPt:null,savedSnap:null,lastSaved:0,lastAuto:0},o);}
function storeActive(){const t=activeTab;if(!t)return;Object.assign(t,{M,undo:undoStack,redo:redoStack,ref:refDrawing,img:refImage,filePath,units,view:{...view},elevPt});}
function tabDirty(t){return t.savedSnap!==(t===activeTab?snapshot():JSON.stringify(t.M));}
function activate(t,fitIt){if(typeof walk!=='undefined'&&walk.on)walkStop();activeTab=t;M=t.M;undoStack=t.undo;redoStack=t.redo;filePath=t.filePath;elevPt=t.elevPt||null;
  setReference(t.ref||null,true);setRefImage(t.img||null,true);if(typeof eraseStack!=='undefined')eraseStack.length=0;
  fixUid();setUnits(t.units||units);sel=null;hover=null;drag=null;setTool('select');$('#projName').value=M.name;changed();
  if(t.view&&!fitIt)Object.assign(view,t.view);else requestAnimationFrame(()=>{fit();});frame3d();build3d();renderTabs();}
function switchTab(id){if(activeTab&&activeTab.id===id)return;const t=tabs.find(x=>x.id===id);if(!t)return;closeTextEditor&&closeTextEditor(false);storeActive();saveTabsNow();activate(t);}
function newTab(model,o){storeActive();const t=makeTab(model,o);t.savedSnap=JSON.stringify(t.M);tabs.push(t);activate(t,true);saveTabsNow();return t;}
const tabIsBlank=t=>!t.filePath&&!t.M.walls.length&&!t.M.items.length&&!(t.M.areas||[]).length&&!(t.M.texts||[]).length&&!t.ref&&!t.img;
async function closeTab(id){const t=tabs.find(x=>x.id===id);if(!t)return;if(t===activeTab)storeActive();
  const go=()=>{const i=tabs.indexOf(t);tabs.splice(i,1);try{localStorage.removeItem('bm-tab-'+t.id);}catch(e){}
    if(!tabs.length){tabs.push(makeTab(blankModel()));tabs[0].savedSnap=JSON.stringify(tabs[0].M);}
    if(t===activeTab)activate(tabs[Math.min(i,tabs.length-1)],false);else renderTabs();saveTabsNow();};
  if(!tabDirty(t)||tabIsBlank(t)){go();return;}
  if(t!==activeTab)switchTab(t.id);
  openModal('Save changes to “'+(t.M.name||'Untitled project')+'”?','If you close it without saving, the changes since it was last saved are lost.',null,[
    {label:'Cancel',fn:closeModal},{label:'Don’t save',fn:()=>{closeModal();go();}},
    {label:'Save',primary:true,fn:async()=>{closeModal();const ok=await saveProject(false);if(ok)go();}}]);}
function renderTabs(){const el=$('#tabbar');if(!el)return;if(activeTab)activeTab.M=M;
  el.innerHTML=tabs.map(t=>{const d=tabDirty(t),on=t===activeTab,nm=esc(t.M.name||'Untitled project');
    return `<div class="tab${on?' on':''}" role="tab" aria-selected="${on}" data-tab="${t.id}" title="${nm}${t.filePath?' — '+esc(baseName(t.filePath)):''}${d?' (unsaved changes)':''}"><span class="tn">${nm}</span>${d?'<span class="tdot" aria-label="unsaved changes"></span>':''}<button class="tx" data-close="${t.id}" aria-label="Close ${nm}" title="Close">×</button></div>`;}).join('')+
    `<button class="tabnew" id="tabNew" title="New project in a new tab" aria-label="New project">+</button><span class="autosv" id="autosv"></span>`;
  el.querySelectorAll('[data-tab]').forEach(b=>{b.onclick=e=>{if(e.target.closest('[data-close]'))return;switchTab(b.dataset.tab);};b.onauxclick=e=>{if(e.button===1){e.preventDefault();closeTab(b.dataset.tab);}};});
  el.querySelectorAll('[data-close]').forEach(b=>b.onclick=e=>{e.stopPropagation();closeTab(b.dataset.close);});
  $('#tabNew').onclick=()=>newProjectDialog();updateAutosaveNote();}
function updateAutosaveNote(){const n=$('#autosv');if(!n)return;const t=activeTab;if(!t)return;
  const tm=t.lastSaved?new Date(t.lastSaved).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}):null;
  n.textContent=!autosaveOn?'Autosave off':t.filePath&&NATIVE?(tm?'Saved '+tm+' · autosave every 5 min':'Autosave every 5 min'):'Kept on this device · save to a file to autosave it';}
// keep every tab on this device (quietly drops the imported picture if storage is full)
let tabSaveTimer=0;
function saveTabsNow(){clearTimeout(tabSaveTimer);if(!activeTab)return;storeActive();
  try{localStorage.setItem('bm-tabs',JSON.stringify({active:activeTab.id,ids:tabs.map(t=>t.id),seq:tabSeq,snap:snapOn,free:freeMove}));}catch(e){}
  tabs.forEach(t=>{if(t!==activeTab&&t.stored)return;const meta={filePath:t.filePath,dirty:tabDirty(t),lastSaved:t.lastSaved};
    try{localStorage.setItem('bm-tab-'+t.id,JSON.stringify(Object.assign(JSON.parse(tabJSON(t)),meta)));t.stored=true;}
    catch(e){try{const o=JSON.parse(tabJSON(t));delete o.refImage;localStorage.setItem('bm-tab-'+t.id,JSON.stringify(Object.assign(o,meta)));t.stored=true;}catch(_){}}});}
function save(){if(activeTab)activeTab.stored=false;clearTimeout(tabSaveTimer);tabSaveTimer=setTimeout(saveTabsNow,700);renderTabs();}
function loadTabs(){try{const ix=JSON.parse(localStorage.getItem('bm-tabs')||'null');if(!ix||!ix.ids||!ix.ids.length)return false;tabSeq=ix.seq||tabSeq;if(ix.snap!=null)snapOn=!!ix.snap;if(ix.free!=null)freeMove=!!ix.free;
    ix.ids.forEach(id=>{try{const o=JSON.parse(localStorage.getItem('bm-tab-'+id)||'null');if(!o||!o.model)return;
      const t=makeTab(Object.assign(blankModel(),o.model),{id,units:normUnits(o.units),ref:o.reference||null,img:o.refImage||null,filePath:o.filePath||null,lastSaved:o.lastSaved||0,stored:true});
      t.savedSnap=o.dirty?null:JSON.stringify(t.M);tabs.push(t);}catch(e){}});
    if(!tabs.length)return false;activeTab=tabs.find(t=>t.id===ix.active)||tabs[0];return true;}catch(e){return false;}}
// older versions kept one drawing; bring it in as the first tab
function migrateOld(){let m=null,u=units;try{const s=localStorage.getItem('bm-plan');if(s){const o=JSON.parse(s);if(o&&o.M&&Array.isArray(o.M.walls)){m=o.M;u=normUnits(o.units);snapOn=o.snapOn!==false;freeMove=!!o.freeMove;}}}catch(e){}
  let ref=null,img=null;try{ref=JSON.parse(localStorage.getItem('bm-ref')||'null');}catch(e){}try{img=JSON.parse(localStorage.getItem('bm-refimg')||'null');}catch(e){}
  const t=makeTab(m?Object.assign(blankModel(),m):sampleModel(),{units:u,ref,img});t.savedSnap=m?null:JSON.stringify(t.M);tabs.push(t);activeTab=t;
  try{['bm-plan','bm-ref','bm-refimg'].forEach(k=>localStorage.removeItem(k));}catch(e){}}
async function autosaveTick(){if(!autosaveOn)return;storeActive();const now=Date.now();
  for(const t of tabs){if(!tabDirty(t)||now-(t.lastAuto||0)<AUTOSAVE_MS)continue;t.lastAuto=now;
    if(NATIVE&&t.filePath){try{await TAURI.fs.writeTextFile(t.filePath,tabJSON(t));t.savedSnap=JSON.stringify(t.M);t.lastSaved=Date.now();}catch(e){toast('Autosave failed for '+(t.M.name||'project')+': '+e);}}}
  saveTabsNow();renderTabs();}
setInterval(autosaveTick,30*1000);
function newProjectDialog(){openModal('New project','Opens in a new tab. Your other projects stay open.',null,[
  {label:'Cancel',fn:closeModal},{label:'Start from the sample',fn:()=>{closeModal();newTab(sampleModel());}},
  {label:'Blank project',primary:true,fn:()=>{closeModal();newTab(blankModel());setTool('wall');}}]);}

function syncAutosaveUI(){const s=$('#autosaveState');if(s)s.textContent=autosaveOn?'On':'Off';updateAutosaveNote();}
$('#autosaveBtn').onclick=()=>{autosaveOn=!autosaveOn;try{localStorage.setItem('bm-autosave',autosaveOn?'1':'0');}catch(e){}syncAutosaveUI();toast(autosaveOn?'Autosave is on: projects saved to a file are written back every 5 minutes.':'Autosave is off.');};
$('#saveBtn').onclick=()=>saveProject(false);$('#saveAsBtn').onclick=()=>saveProject(true);$('#openBtn').onclick=openProject;
// Inside an embedded preview frame downloads are blocked, so saving is hidden there; the drawing still autosaves.
const FRAMED=(()=>{try{return window.self!==window.top;}catch(e){return true;}})();
if(FRAMED&&!NATIVE){$('#saveBtn').hidden=true;$('#saveAsBtn').hidden=true;}
window.addEventListener('keydown',e=>{const mod=e.ctrlKey||e.metaKey;if(!mod)return;const k=e.key.toLowerCase();if(!$('#modal').hidden)return;
  if(k==='s'){e.preventDefault();if(!(FRAMED&&!NATIVE))saveProject(e.shiftKey);}else if(k==='o'){e.preventDefault();openProject();}
  else if(k==='i'){e.preventDefault();importDXF();}else if(k==='e'){e.preventDefault();exportDXF();}else if(k==='p'){e.preventDefault();exportImageDialog();}},true);
/* ============================== reference drawing ============================== */
// Lines, arcs and text from an imported DXF, shown faintly under the plan to trace over. Kept outside the
// undo history (it can be large). segs: flat [x1,y1,x2,y2…] in model mm; arcs: [x,y,r,a0,a1,layer,full]; texts: [x,y,h,rot,s,layer].
let refDrawing=null,refVisible=true,refPath=null,refGrid=null;
function setReference(R,keep){refDrawing=R&&R.segs?R:null;if(typeof checkRefLeftover==='function')checkRefLeftover();refPath=null;refGrid=null;
  if(refDrawing){refPath=new Path2D();const S=refDrawing.segs;for(let i=0;i<S.length;i+=4){refPath.moveTo(S[i],S[i+1]);refPath.lineTo(S[i+2],S[i+3]);}
    refDrawing.arcs.forEach(([x,y,r,a0,a1,li,full])=>{if(full){refPath.moveTo(x+r,y);refPath.arc(x,y,r,0,Math.PI*2);}else{refPath.moveTo(x+r*Math.cos(a0),y+r*Math.sin(a0));refPath.arc(x,y,r,a0,a1,true);}});
    refGrid=new Map();const cell=500,addP=(x,y)=>{const k=Math.floor(x/cell)+','+Math.floor(y/cell);let a=refGrid.get(k);if(!a)refGrid.set(k,a=[]);if(a.length<64)a.push([x,y]);};
    for(let i=0;i<S.length;i+=4){addP(S[i],S[i+1]);addP(S[i+2],S[i+3]);}
    refDrawing.arcs.forEach(([x,y,r,a0,a1,li,full])=>{if(full)addP(x,y);else{addP(x+r*Math.cos(a0),y+r*Math.sin(a0));addP(x+r*Math.cos(a1),y+r*Math.sin(a1));}});}
  if(!keep)saveRef();updateRefUI();dirty();}
function saveRef(){if(typeof save==='function'&&activeTab)save();}
function saveRefOld(){try{if(refDrawing)localStorage.setItem('bm-ref',JSON.stringify(refDrawing));else localStorage.removeItem('bm-ref');}
  catch(e){try{localStorage.removeItem('bm-ref');}catch(_){}toast('The reference drawing is too large to keep between sessions here. Save the project to keep it.');}}
function loadRef(){try{const s=localStorage.getItem('bm-ref');if(s)setReference(JSON.parse(s),true);}catch(e){}try{const s=localStorage.getItem('bm-refimg');if(s)setRefImage(JSON.parse(s),true);}catch(e){}}
function updateRefUI(){const has=!!refDrawing||!!refImage;{const can=has&&refLeftover,te=$('#tErase');if(te)te.hidden=!can;if(!can&&tool==='erase'&&!eraseOn){setTool('select');if(has)toast('Nothing left to erase under the plan.');}}$('#refToggle').hidden=!has;$('#refToggle').setAttribute('aria-pressed',String(has&&refVisible));
  $('#refRemoveBtn').hidden=!has;$('#refSep').hidden=!has;}
function refSnap(raw,tol){if(!refGrid||!refVisible)return null;const cell=500;let best=null,bd=tol;
  const cx0=Math.floor((raw[0]-tol)/cell),cx1=Math.floor((raw[0]+tol)/cell),cy0=Math.floor((raw[1]-tol)/cell),cy1=Math.floor((raw[1]+tol)/cell);
  if((cx1-cx0+1)*(cy1-cy0+1)>400)return null;
  for(let cx=cx0;cx<=cx1;cx++)for(let cy=cy0;cy<=cy1;cy++){const a=refGrid.get(cx+','+cy);if(a)for(const p of a){const d=dist(raw,p);if(d<bd){bd=d;best=p;}}}
  return best?{p:best.slice(),kind:'reference',guides:[]}:null;}
function drawReference(){drawRefImage();if(!refDrawing||!refVisible||!refPath)return;const dpr=pxr();
  ctx.save();ctx.setTransform(dpr*view.s,0,0,dpr*view.s,dpr*view.ox,dpr*view.oy);ctx.strokeStyle=C.ref;ctx.lineWidth=1/view.s;ctx.stroke(refPath);ctx.restore();
  ctx.save();ctx.fillStyle=C.ref;let n=0;
  for(const [x,y,h,rot,s] of refDrawing.texts){const px=h*view.s;if(px<5)continue;const q=toS([x,y]);if(q[0]<-400||q[1]<-50||q[0]>4000||q[1]>4000)continue;if(++n>1500)break;
    ctx.save();ctx.translate(q[0],q[1]);ctx.rotate(rot);ctx.font=px+'px "IBM Plex Sans", system-ui, sans-serif';ctx.textBaseline='alphabetic';String(s).split('\n').forEach((ln,i)=>ctx.fillText(ln,0,i*px*1.45));ctx.restore();}
  ctx.restore();}

/* ============================== File menu ============================== */
const fileMenu=$('#fileMenu'),fileBtn=$('#fileBtn');
function closeFileMenu(){fileMenu.hidden=true;fileBtn.setAttribute('aria-expanded','false');}
fileBtn.addEventListener('click',e=>{e.stopPropagation();const open=fileMenu.hidden;fileMenu.hidden=!open;fileBtn.setAttribute('aria-expanded',String(open));if(open)(fileMenu.querySelector('button:not([hidden])')||fileBtn).focus();});
fileMenu.addEventListener('click',e=>{if(e.target.closest('button'))closeFileMenu();});
document.addEventListener('pointerdown',e=>{if(!fileMenu.hidden&&!e.target.closest('.menuwrap'))closeFileMenu();});
fileMenu.addEventListener('keydown',e=>{const items=[...fileMenu.querySelectorAll('button:not([hidden])')];const i=items.indexOf(document.activeElement);
  if(e.key==='Escape'){closeFileMenu();fileBtn.focus();}else if(e.key==='ArrowDown'){e.preventDefault();items[(i+1)%items.length].focus();}else if(e.key==='ArrowUp'){e.preventDefault();items[(i-1+items.length)%items.length].focus();}});
function updateMeasUI(){const on=Object.keys(MEAS_DEF).filter(k=>MEAS[k]).length;$('#measBtn').setAttribute('aria-pressed',String(on>0));$('#measBtn').textContent=on?'Measures ▾':'Measures off ▾';
  document.querySelectorAll('[data-meas]').forEach(cb=>cb.checked=!!MEAS[cb.dataset.meas]);}
$('#measBtn').onclick=e=>{e.stopPropagation();const m=$('#measMenu'),open=m.hidden;m.hidden=!open;$('#measBtn').setAttribute('aria-expanded',String(open));if(open)(m.querySelector('input')||m).focus();};
document.querySelectorAll('[data-meas]').forEach(cb=>cb.onchange=()=>{MEAS[cb.dataset.meas]=cb.checked;saveMeas();updateMeasUI();dirty();});
$('#measAll').onclick=()=>{Object.keys(MEAS_DEF).forEach(k=>MEAS[k]=true);saveMeas();updateMeasUI();dirty();};
$('#measNone').onclick=()=>{Object.keys(MEAS_DEF).forEach(k=>MEAS[k]=false);saveMeas();updateMeasUI();dirty();};
document.addEventListener('pointerdown',e=>{const m=$('#measMenu');if(!m.hidden&&!e.target.closest('.measwrap')){m.hidden=true;$('#measBtn').setAttribute('aria-expanded','false');}});
$('#measMenu').addEventListener('keydown',e=>{if(e.key==='Escape'){$('#measMenu').hidden=true;$('#measBtn').setAttribute('aria-expanded','false');$('#measBtn').focus();}});
updateMeasUI();
$('#refToggle').onclick=()=>{refVisible=!refVisible;updateRefUI();dirty();};
$('#refRemoveBtn').onclick=()=>openModal('Remove the reference?','The imported drawing or plan image under the plan is removed. Walls, doors and windows you have are kept.',null,
  [{label:'Cancel',fn:closeModal},{label:'Remove',primary:true,fn:()=>{setReference(null);setRefImage(null);closeModal();toast('Reference removed');}}]);

/* ============================== import ============================== */
async function pickDxfFile(){
  if(NATIVE){const sel=await TAURI.dialog.open({multiple:false,directory:false,filters:/Android/i.test(navigator.userAgent)?undefined:[{name:'AutoCAD drawing',extensions:['dxf','DXF','dwg','DWG']}]});
    if(!sel)return null;const path=typeof sel==='string'?sel:(sel.path||sel.uri||String(sel));return {name:baseName(path),bytes:new Uint8Array(await TAURI.fs.readFile(path))};}
  return new Promise(res=>{const inp=document.createElement('input');inp.type='file';inp.accept='.dxf,.dwg,image/vnd.dxf,application/dxf';
    inp.onchange=()=>{const f=inp.files[0];if(!f)return res(null);f.arrayBuffer().then(b=>res({name:f.name,bytes:new Uint8Array(b)}));};inp.click();});}
const WALL_LAYER_RX=/wall|wand|mur(?!al)|muro|parede|جدار|جدران|حائط|حيطان|^a-?wal/i, SKIP_LAYER_RX=/^defpoints$|viewport|vport|^xref|title|border|frame|إطار|اطار/i;
async function importDXF(){
  let file;try{file=await pickDxfFile();}catch(err){toast('Could not open the file: '+(err.message||err));return;}if(!file)return;
  let dec,d,G;
  try{dec=dxfDecode(file.bytes);d=dxfParse(dec.text);G=dxfGeometry(d);}
  catch(err){openModal('Could not import '+file.name,err.message||String(err),null,[{label:'Close',primary:true,fn:closeModal}]);return;}
  if(!G.count){openModal('Nothing to import','No lines, arcs or text were found in the model space of '+file.name+'.',null,[{label:'Close',primary:true,fn:closeModal}]);return;}
  showImportDialog(file.name,dec,d,G);}
function showImportDialog(name,dec,d,G){
  const guess=dxfGuessUnit(G,d.header);let f=guess.f;
  const unitOpts=[['1','millimetres (mm)'],['10','centimetres (cm)'],['1000','metres (m)'],['25.4','inches'],['304.8','feet']];
  if(!unitOpts.some(o=>+o[0]===f))unitOpts.push([String(f),f+' mm per unit']);
  // layer roles: names first, then whichever layer has the most double-line walls
  const roles=G.layers.map(l=>l.off||l.frozen||SKIP_LAYER_RX.test(l.name)?'skip':WALL_LAYER_RX.test(l.name)?'walls':'ref');
  if(!roles.includes('walls')){let best=-1,bestLen=0;
    G.layers.forEach((l,i)=>{if(roles[i]==='skip'||l.segs<4)return;const lines=[];for(let k=0;k<G.sl.length&&lines.length<3000;k++)if(G.sl[k]===i)lines.push([[G.segs[4*k]*f,G.segs[4*k+1]*f],[G.segs[4*k+2]*f,G.segs[4*k+3]*f]]);
      const W=rebuildWalls(lines,{segs:[],arcs:[]},{minT:40,maxT:600});const len=W.reduce((a,w)=>a+dist(w.a,w.b),0);if(len>bestLen&&len>3000&&len*2>l.len*f*0.25){bestLen=len;best=i;}});
    if(best>=0)roles[best]='walls';}
  const ver=DXF_VERSIONS[dec.ver]?'AutoCAD '+DXF_VERSIONS[dec.ver]+' DXF':'DXF';
  const skipped=Object.entries(G.skipped).sort((a,b)=>b[1]-a[1]).slice(0,4).map(([t,n])=>n+' '+t.toLowerCase()).join(', ');
  const body=document.createElement('div');body.className='imp';
  body.innerHTML=`<div class="impprev"><canvas id="impPrev" aria-label="Preview of the drawing"></canvas>
      <div class="implegend"><span><i class="lw"></i>Walls</span><span><i class="lr"></i>Reference</span></div></div>
    <div class="impside">
      <div class="kv"><label for="impUnit">Drawing units</label><select id="impUnit">${unitOpts.map(([v,l])=>`<option value="${v}"${+v===f?' selected':''}>${l}</option>`).join('')}</select>
        <label>Size</label><span class="ro" id="impSize"></span>
        <label for="impMaxT">Thickest wall</label><input id="impMaxT" value="${fmtLen(600,true)}">
        <label for="impH">Wall height</label><input id="impH" value="${fmtLen(defaults.h,true)}"></div>
      <p class="tip" id="impUnitNote">${guess.fromFile?'Units are taken from the file.':'The file does not say its units; this is a guess from its size. Check the size above.'}</p>
      <div class="laytable"><table><thead><tr><th>Layer</th><th>Objects</th><th>Use as</th></tr></thead><tbody>
        ${G.layers.map((l,i)=>`<tr><td title="${esc(l.name)}"><span class="swatch" style="background:${aciColor(l.color)}"></span>${esc(l.name)}</td><td>${(l.segs+l.arcs+l.texts).toLocaleString('en-US')}</td>
          <td><select data-layer="${i}" aria-label="Use layer ${esc(l.name)} as"><option value="walls"${roles[i]==='walls'?' selected':''}>Walls</option><option value="ref"${roles[i]==='ref'?' selected':''}>Reference</option><option value="skip"${roles[i]==='skip'?' selected':''}>Skip</option></select></td></tr>`).join('')}
      </tbody></table></div>
      <div class="impmode" role="radiogroup" aria-label="Where to put it"><label><input type="radio" name="impMode" value="replace" checked> Replace the current drawing</label><label><input type="radio" name="impMode" value="add"> Add to the current drawing</label></div>
    </div>`;
  openModal('Import '+name,`${ver} · ${G.count.toLocaleString('en-US')} objects on ${G.layers.length} layer${G.layers.length>1?'s':''}${dec.enc!=='utf-8'?' · text read as '+dec.enc:''}${skipped?' · not imported: '+skipped:''}${G.truncated?' · very large file, only the first 400,000 objects were read':''}. Walls drawn as double lines become real walls; doors and windows are found from swings and glazing in the gaps. Everything set to Reference stays under the plan for tracing.`,null,
    [{label:'Cancel',fn:closeModal},{label:'Import',primary:true,fn:()=>{const mode=(body.querySelector('[name=impMode]:checked')||{}).value||'replace';
      const maxT=parseLen($('#impMaxT').value),h=parseLen($('#impH').value);closeModal();
      runImport(name,G,f,roles,{maxT:maxT>50?maxT:600,h:h>500?h:defaults.h,mode});}}],body,true);
  const cv=$('#impPrev'),pc=cv.getContext('2d');
  const drawPrev=()=>{const r=cv.getBoundingClientRect(),dpr=window.devicePixelRatio||1;cv.width=Math.max(1,r.width*dpr);cv.height=Math.max(1,r.height*dpr);
    pc.setTransform(dpr,0,0,dpr,0,0);pc.fillStyle=C.paper;pc.fillRect(0,0,r.width,r.height);
    const bb=dxfBBox(G,i=>roles[i]!=='skip');if(!bb)return;const pad=12,s=Math.min((r.width-2*pad)/Math.max(bb.x1-bb.x0,1e-9),(r.height-2*pad)/Math.max(bb.y1-bb.y0,1e-9));
    const X=x=>pad+(x-bb.x0)*s+((r.width-2*pad)-(bb.x1-bb.x0)*s)/2,Y=y=>pad+(bb.y1-y)*s+((r.height-2*pad)-(bb.y1-bb.y0)*s)/2;
    for(const role of ['ref','walls']){pc.strokeStyle=role==='walls'?C.accent:C.muted;pc.lineWidth=role==='walls'?1.4:0.8;pc.beginPath();
      for(let i=0;i<G.sl.length;i++)if(roles[G.sl[i]]===role){pc.moveTo(X(G.segs[4*i]),Y(G.segs[4*i+1]));pc.lineTo(X(G.segs[4*i+2]),Y(G.segs[4*i+3]));}
      G.arcs.forEach(a=>{if(roles[a.li]!==role)return;const cx=X(a.x),cy=Y(a.y),rr=a.r*s;pc.moveTo(cx+rr*Math.cos(-a.s),cy+rr*Math.sin(-a.s));if(a.full)pc.arc(cx,cy,rr,0,Math.PI*2);else pc.arc(cx,cy,rr,-a.s,-a.e,true);});
      pc.stroke();}};
  const showSize=()=>{const bb=dxfBBox(G,i=>roles[i]!=='skip');$('#impSize').textContent=bb?fmtLen((bb.x1-bb.x0)*f,true)+' × '+fmtLen((bb.y1-bb.y0)*f,true):'nothing selected';};
  $('#impUnit').onchange=e=>{f=+e.target.value;showSize();$('#impUnitNote').textContent='Check that the size looks right for this building.';};
  body.querySelectorAll('[data-layer]').forEach(sel=>sel.onchange=()=>{roles[+sel.dataset.layer]=sel.value;drawPrev();showSize();});
  showSize();requestAnimationFrame(drawPrev);}
function aciColor(c){return ({1:'#e5484d',2:'#e8c33a',3:'#3fb950',4:'#38bdf8',5:'#3b82f6',6:'#d946ef',7:'var(--ink)',8:'#8b8f94',9:'#c0c4c8'})[c]||'var(--muted)';}
function runImport(name,G,f,roles,opt){
  const bb=dxfBBox(G,i=>roles[i]==='walls')||dxfBBox(G,i=>roles[i]!=='skip');if(!bb){toast('Nothing to import: every layer is set to Skip.');return;}
  const r1=v=>Math.round(v*10)/10;
  let ox=-bb.x0*f,oy=bb.y1*f;
  if(opt.mode==='add'&&M.walls.length){let x1=-1e9,y0=1e9;M.walls.forEach(w=>[w.a,w.b].forEach(p=>{x1=Math.max(x1,p[0]);y0=Math.min(y0,p[1]);}));ox+=x1+2000;oy+=y0;}
  const m=(x,y)=>[x*f+ox,-y*f+oy];
  const wallLines=[],evSegs=[],R={name,layers:G.layers.map(l=>l.name),segs:[],sl:[],arcs:[],texts:[]};
  for(let i=0;i<G.sl.length;i++){const role=roles[G.sl[i]];if(role==='skip')continue;const a=m(G.segs[4*i],G.segs[4*i+1]),b=m(G.segs[4*i+2],G.segs[4*i+3]);evSegs.push([a,b]);
    if(role==='walls')wallLines.push([a,b]);else{R.segs.push(r1(a[0]),r1(a[1]),r1(b[0]),r1(b[1]));R.sl.push(G.sl[i]);}}
  const evArcs=[];G.arcs.forEach(a=>{if(roles[a.li]==='skip')return;const c=m(a.x,a.y),A={x:c[0],y:c[1],r:a.r*f,a0:-a.s,a1:-a.e,full:a.full};evArcs.push(A);
    if(roles[a.li]==='ref')R.arcs.push([r1(A.x),r1(A.y),r1(A.r),+A.a0.toFixed(5),+A.a1.toFixed(5),a.li,A.full?1:0]);});
  const texts=[];G.texts.forEach(t=>{if(roles[t.li]==='skip')return;const p=m(t.x,t.y);const ref=roles[t.li]==='ref'?[r1(p[0]),r1(p[1]),r1(t.h*f),+(-t.r).toFixed(5),t.s,t.li]:null;
    if(ref)R.texts.push(ref);texts.push({p,h:t.h*f,s:t.s.split('\n')[0].replace(/[\s:]*[\d.,]+\s*(m2|m²|م2|م²|sqm|sq\.?\s*m|ft2|ft²)\s*$/i,'').trim(),ref});});
  const W=wallLines.length?rebuildWalls(wallLines,{segs:evSegs,arcs:evArcs},{minT:40,maxT:opt.maxT}):[];
  let nd=0,nw=0;
  mutate(()=>{
    if(opt.mode!=='add'){Object.assign(M,blankModel());M.name=name.replace(/\.(dxf|dwg)$/i,'');}
    W.forEach(w=>{const wall={id:nid('w'),a:w.a,b:w.b,t:w.t,h:opt.h};M.walls.push(wall);const d=wallDir(wall),L=wallLen(wall);
      w.ops.forEach(o=>{const s=dot(sub(o.P,wall.a),d);if(s-o.w/2<-1||s+o.w/2>L+1)return;
        if(o.kind==='door'){nd++;M.openings.push({id:nid('o'),wall:wall.id,s,w:Math.round(o.w),kind:'door',h:Math.min(2100,opt.h),sill:0,flip:o.side>=0?0:1,hinge:o.hingeLow?0:1});}
        else{nw++;M.openings.push({id:nid('o'),wall:wall.id,s,w:Math.round(o.w),kind:'window',h:Math.min(1200,opt.h-900),sill:900,flip:0,hinge:0});}});});});
  // name rooms from the text inside them
  let named=0;const plain=s=>!/^[\s\d.,:×x*+\-/()]*(m2|m²|م2|م²|sqm|sq\.?\s*m|ft2|ft²)?[\s\d.,]*$/i.test(s);
  rooms.forEach(r=>{if(r.meta)return;let best=null;texts.forEach(t=>{if(plain(t.s)&&t.s.length<=40&&pointInPoly(t.p,r.net)&&(!best||t.h>best.h))best=t;});
    if(best){M.roomMeta.push({x:r.centroid[0],y:r.centroid[1],name:best.s,type:guessRoomType(best.s)});named++;if(best.ref)R.texts.splice(R.texts.indexOf(best.ref),1);}});
  if(named)changed();
  const hasRef=R.segs.length||R.arcs.length||R.texts.length;
  if(opt.mode!=='add'||hasRef)setReference(hasRef?(opt.mode==='add'&&refDrawing?mergeRef(refDrawing,R):R):(opt.mode==='add'?refDrawing:null));
  sel=null;$('#projName').value=M.name;renderInspector();fit();frame3d();build3d();
  const parts=[];if(W.length)parts.push(W.length+' wall'+(W.length>1?'s':''));if(nd)parts.push(nd+' door'+(nd>1?'s':''));if(nw)parts.push(nw+' window'+(nw>1?'s':''));if(rooms.length)parts.push(rooms.length+' room'+(rooms.length>1?'s':''));
  toast(parts.length?'Imported '+parts.join(', ')+(hasRef?'. The rest is a reference drawing.':'.'):hasRef?'Imported as a reference drawing. Trace it with the Wall tool; points snap to its line ends.':'Nothing was imported.');}
function mergeRef(A,B){const off=A.layers.length;return {name:A.name,layers:A.layers.concat(B.layers),segs:A.segs.concat(B.segs),sl:A.sl.concat(B.sl.map(i=>i+off)),
  arcs:A.arcs.concat(B.arcs.map(a=>{const c=a.slice();c[5]+=off;return c;})),texts:A.texts.concat(B.texts.map(t=>{const c=t.slice();c[5]+=off;return c;}))};}


/* ============================== import a plan image or PDF ============================== */
// The plan is scaled from one wall the user marks, straightened to it, and kept under the drawing as a reference image.
// Walls are found from their thickness: thin lines (furniture, fixtures, text, dimensions, hatching) are removed,
// what is left is thinned to centre lines, and those become walls. Gaps between wall ends become doors or windows.
const PDFJS_URL='vendor/pdf.min.js',PDFJS_WORKER='vendor/pdf.worker.min.js';
let pdfjsP=null;
function loadPdfJs(){if(window.pdfjsLib)return Promise.resolve(window.pdfjsLib);
  if(!pdfjsP)pdfjsP=new Promise((res,rej)=>{const s=document.createElement('script');s.src=PDFJS_URL;
    s.onload=()=>{const L=window.pdfjsLib;if(!L){pdfjsP=null;return rej(new Error('The PDF reader did not load.'));}L.GlobalWorkerOptions.workerSrc=new URL(PDFJS_WORKER,location.href).href;res(L);};
    s.onerror=()=>{pdfjsP=null;rej(new Error('The PDF reader could not be loaded. Check the internet connection, or export the page as a PNG or JPG image and import that.'));};document.head.appendChild(s);});
  return pdfjsP;}
async function pickPlanFile(){
  if(NATIVE){const sel=await TAURI.dialog.open({multiple:false,directory:false,filters:/Android/i.test(navigator.userAgent)?undefined:[{name:'Plan image or PDF',extensions:['png','PNG','jpg','JPG','jpeg','JPEG','webp','WEBP','bmp','BMP','gif','GIF','pdf','PDF']}]});
    if(!sel)return null;const path=typeof sel==='string'?sel:(sel.path||sel.uri||String(sel));return {name:baseName(path),bytes:new Uint8Array(await TAURI.fs.readFile(path))};}
  return new Promise(res=>{const inp=document.createElement('input');inp.type='file';inp.accept='image/*,.pdf,application/pdf';
    inp.onchange=()=>{const f=inp.files[0];if(!f)return res(null);f.arrayBuffer().then(b=>res({name:f.name,bytes:new Uint8Array(b)}));};inp.click();});}
function sniffPlan(b){const s=(i,j)=>String.fromCharCode(...b.slice(i,j));
  if(s(0,4)==='%PDF')return 'pdf';if(b[0]===0x89&&s(1,4)==='PNG')return 'image/png';if(b[0]===0xFF&&b[1]===0xD8)return 'image/jpeg';if(s(0,3)==='GIF')return 'image/gif';
  if(s(0,2)==='BM')return 'image/bmp';if(s(0,4)==='RIFF'&&s(8,12)==='WEBP')return 'image/webp';if(/^ftyp(heic|heix|hevc|mif1|msf1)/.test(s(4,12)))return 'heic';
  if(/^AC10/.test(s(0,4)))return 'dwg';if(/^\s*0\s*\r?\n\s*SECTION/.test(s(0,40)))return 'dxf';return null;}
function loadPlanImg(bytes,type){return new Promise((res,rej)=>{const url=URL.createObjectURL(new Blob([bytes],{type}));const im=new Image();
  im.onload=()=>res(im);im.onerror=()=>{URL.revokeObjectURL(url);rej(new Error('This image could not be read. Save it again as PNG or JPG and try once more.'));};im.src=url;});}
async function pdfPageCanvas(doc,n){const page=await doc.getPage(n);const v1=page.getViewport({scale:1});
  const sc=Math.min(4800/Math.max(v1.width,v1.height),Math.sqrt(18e6/(v1.width*v1.height)));const vp=page.getViewport({scale:sc});
  const cv=document.createElement('canvas');cv.width=Math.round(vp.width);cv.height=Math.round(vp.height);const g=cv.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,cv.width,cv.height);
  await page.render({canvasContext:g,viewport:vp}).promise;return cv;}
// very large photos are reduced so phones and tablets keep enough memory
function capPlanSrc(src){const W=src.naturalWidth||src.width,H=src.naturalHeight||src.height,k=Math.min(1,5000/Math.max(W,H),Math.sqrt(20e6/(W*H)));if(k>=1)return src;
  const cv=document.createElement('canvas');cv.width=Math.round(W*k);cv.height=Math.round(H*k);const g=cv.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,cv.width,cv.height);g.drawImage(src,0,0,cv.width,cv.height);return cv;}
async function importPlanImage(){
  let file;try{file=await pickPlanFile();}catch(err){toast('Could not open the file: '+(err.message||err));return;}if(!file)return;
  const kind=sniffPlan(file.bytes);
  try{
    if(kind==='heic')throw new Error('HEIC photos (the iPhone default) can\'t be read here. Share or export the photo as JPG first (on the iPhone: Settings → Camera → Formats → Most Compatible).');
    if(kind==='dxf'||kind==='dwg')throw new Error('This is an AutoCAD drawing. Use File → Import from AutoCAD (DXF) instead; it gives exact walls without needing a scale.');
    if(!kind)throw new Error('This file is not an image or a PDF. Use PNG, JPG, WebP, GIF, BMP or PDF.');
    const st={name:file.name,doc:null,pages:1,page:1};
    if(kind==='pdf'){toast('Reading the PDF…');const L=await loadPdfJs();
      try{st.doc=await L.getDocument({data:file.bytes,isEvalSupported:false}).promise;}catch(e){throw new Error(/password/i.test(e&&(e.name+e.message))?'This PDF is password protected. Open it, print or save it without a password, and import that.':'This PDF could not be read ('+(e.message||e)+').');}
      st.pages=st.doc.numPages;st.src=await pdfPageCanvas(st.doc,1);}
    else st.src=capPlanSrc(await loadPlanImg(file.bytes,kind));
    st.W=st.src.naturalWidth||st.src.width;st.H=st.src.naturalHeight||st.src.height;
    if(!(st.W>20&&st.H>20))throw new Error('The image is empty or too small.');
    showPlanDialog(st);
  }catch(err){openModal('Could not import '+file.name,err.message||String(err),null,[{label:'Close',primary:true,fn:closeModal}]);}}

function planScale(st){if(!(st.p1&&st.p2&&st.len>0))return null;const d=dist(st.p1,st.p2);if(d<5)return null;
  const a=Math.atan2(st.p2[1]-st.p1[1],st.p2[0]-st.p1[0])*180/Math.PI,dev=a-90*Math.round(a/90);
  return {s:st.len/d,dev,rot:st.straight&&Math.abs(dev)<=20?-dev:0};}
function showPlanDialog(st){
  st.p1=st.p2=null;st.len=0;st.straight=true;st.crop=null;st.mode='mark';st.res=null;st.hover=null;
  st.o={style:'fill',ink:'dark',minT:80,maxT:450,h:defaults.h,find:true,place:'replace',under:'walls'};
  const body=document.createElement('div');body.className='pimp';
  body.innerHTML=`<div class="pstage"><canvas id="pimpCv" aria-label="The plan. Click both ends of a wall you know the length of."></canvas>
      <div class="pzoom"><button class="btn" id="pzIn" title="Zoom in" aria-label="Zoom in">+</button><button class="btn" id="pzOut" title="Zoom out" aria-label="Zoom out">−</button><button class="btn" id="pzFit">Fit</button></div>
      <div class="implegend"><span><i class="lw"></i>Walls found</span><span><i class="lo"></i>Doors and windows</span><span><i class="lm"></i>Your wall</span></div></div>
    <div class="impside">
      ${st.pages>1?`<div class="kv"><label for="pimpPage">Page</label><select id="pimpPage">${Array.from({length:st.pages},(_,i)=>`<option value="${i+1}">Page ${i+1} of ${st.pages}</option>`).join('')}</select></div>`:''}
      <p class="h">1 · Scale from one wall</p>
      <p class="tip" id="pimpTip"></p>
      <div class="kv"><label for="pimpLen">Its real length</label><input id="pimpLen" inputmode="decimal" placeholder="e.g. ${fmtLen(3600)}" autocomplete="off">
        <label>Scale</label><span class="ro" id="pimpScale">–</span></div>
      <div class="checks"><label><input type="checkbox" id="pimpStraight" checked> <span id="pimpStraightL">Straighten the plan to this wall</span></label></div>
      <p class="h">2 · Walls</p>
      <div class="checks"><label><input type="checkbox" id="pimpFind" checked> Find the walls; leave out furniture, fixtures, text and dimensions</label></div>
      <div class="kv" id="pimpOpts"><label for="pimpStyle">Walls are drawn</label><select id="pimpStyle"><option value="fill">Filled solid</option><option value="hatch">Hatched</option><option value="outline">As two lines (empty)</option></select>
        <label for="pimpInk">Wall colour</label><select id="pimpInk"><option value="dark">Black or dark</option><option value="grey">Grey or coloured</option></select>
        <label for="pimpMinT">Thinnest wall</label><input id="pimpMinT" value="${fmtLen(80,true)}">
        <label for="pimpMaxT">Thickest wall</label><input id="pimpMaxT" value="${fmtLen(450,true)}">
        <label for="pimpH">Wall height</label><input id="pimpH" value="${fmtLen(defaults.h,true)}"></div>
      <div class="kv"><label for="pimpUnder">Under the plan</label><select id="pimpUnder"><option value="walls">Walls only</option><option value="all">The whole picture</option><option value="none">Nothing</option></select></div>
      <div class="rowbtns"><button class="btn" id="pimpCrop" aria-pressed="false">Crop to the plan</button><button class="btn" id="pimpUncrop" hidden>Remove crop</button></div>
      <p class="tip pres" id="pimpRes" aria-live="polite"></p>
      <div class="impmode" role="radiogroup" aria-label="Where to put it"><label><input type="radio" name="pimpPlace" value="replace" checked> Replace the current drawing</label><label><input type="radio" name="pimpPlace" value="add"> Add to the current drawing</label></div>
    </div>`;
  openModal('Import plan: '+st.name,'Set the scale from one wall, check the walls found (shown in blue), then import. The image stays under the plan so you can trace anything that was missed.',null,
    [{label:'Cancel',fn:closeModal},{label:'Import',primary:true,fn:()=>{
      if(!planScale(st)){$('#pimpRes').textContent=!st.p2?'First click both ends of a wall you know the length of.':'Type the real length of the wall you marked.';$('#pimpRes').classList.add('warn');(st.p2?$('#pimpLen'):cv).focus();return;}
      st.o.place=(body.querySelector('[name=pimpPlace]:checked')||{}).value||'replace';st.o.under=$('#pimpUnder').value;
      if(st.o.find&&!st.res)st.res=findPlanWalls(st);closeModal();applyPlanImport(st);}}],body,true);
  const cv=$('#pimpCv'),g=cv.getContext('2d'),V={s:1,ox:0,oy:0};let cw=0,ch=0,timer=0;
  const toSrc=p=>[(p[0]-V.ox)/V.s,(p[1]-V.oy)/V.s],toCv=u=>[u[0]*V.s+V.ox,u[1]*V.s+V.oy];
  const fitV=()=>{const r=st.crop||[0,0,st.W,st.H];V.s=Math.min((cw-20)/(r[2]-r[0]),(ch-20)/(r[3]-r[1]));V.ox=(cw-(r[2]-r[0])*V.s)/2-r[0]*V.s;V.oy=(ch-(r[3]-r[1])*V.s)/2-r[1]*V.s;};
  const resize=()=>{const r=cv.getBoundingClientRect(),dpr=window.devicePixelRatio||1;cw=r.width;ch=r.height;cv.width=Math.max(1,cw*dpr);cv.height=Math.max(1,ch*dpr);};
  const zoomAt=(p,k)=>{const u=toSrc(p);V.s=clamp(V.s*k,0.02,40);V.ox=p[0]-u[0]*V.s;V.oy=p[1]-u[1]*V.s;draw();};
  const w0ToSrc=(P,sc)=>{const th=(st.res&&st.res.rot!=null?st.res.rot:sc.rot)*Math.PI/180,c=Math.cos(th),s=Math.sin(th);return [(P[0]*c+P[1]*s)/sc.s,(-P[0]*s+P[1]*c)/sc.s];};
  function draw(){const dpr=window.devicePixelRatio||1;g.setTransform(dpr,0,0,dpr,0,0);g.fillStyle=C.grid||C.paper;g.fillRect(0,0,cw,ch);
    g.save();g.translate(V.ox,V.oy);g.scale(V.s,V.s);g.imageSmoothingEnabled=V.s<2;g.drawImage(st.src,0,0);g.restore();
    if(st.crop){const r=st.crop,a=toCv([r[0],r[1]]),b=toCv([r[2],r[3]]);g.save();g.fillStyle='rgba(20,24,26,.45)';g.beginPath();g.rect(0,0,cw,ch);g.rect(a[0],a[1],b[0]-a[0],b[1]-a[1]);g.fill('evenodd');g.strokeStyle=C.accent;g.setLineDash([5,4]);g.strokeRect(a[0],a[1],b[0]-a[0],b[1]-a[1]);g.restore();}
    const sc=planScale(st);
    if(sc&&st.res&&st.res.walls){g.save();g.fillStyle='rgba(37,99,235,.35)';g.strokeStyle='#2563eb';g.lineWidth=1.2;
      st.res.walls.forEach(w=>{const d=norm(sub(w.b,w.a)),n=mul(perp(d),w.t/2);const q=[add(w.a,n),add(w.b,n),sub(w.b,n),sub(w.a,n)].map(P=>toCv(w0ToSrc(P,sc)));
        g.beginPath();q.forEach((p,i)=>i?g.lineTo(p[0],p[1]):g.moveTo(p[0],p[1]));g.closePath();g.fill();g.stroke();});
      g.strokeStyle='#f97316';g.lineWidth=3;st.res.ops.forEach(o=>{const a=toCv(w0ToSrc(sub(o.P,mul(o.d,o.w/2)),sc)),b=toCv(w0ToSrc(add(o.P,mul(o.d,o.w/2)),sc));g.beginPath();g.moveTo(a[0],a[1]);g.lineTo(b[0],b[1]);g.stroke();});g.restore();}
    if(st.mode==='crop'&&st.cropDrag){const a=toCv(st.cropDrag[0]),b=toCv(st.cropDrag[1]);g.save();g.strokeStyle=C.accent;g.lineWidth=1.5;g.setLineDash([5,4]);g.strokeRect(a[0],a[1],b[0]-a[0],b[1]-a[1]);g.restore();}
    const mk=(u,label)=>{const p=toCv(u);g.save();g.fillStyle=C.paper;g.strokeStyle='#e11d48';g.lineWidth=2;g.beginPath();g.arc(p[0],p[1],6,0,Math.PI*2);g.fill();g.stroke();
      g.beginPath();g.moveTo(p[0]-11,p[1]);g.lineTo(p[0]+11,p[1]);g.moveTo(p[0],p[1]-11);g.lineTo(p[0],p[1]+11);g.lineWidth=1;g.stroke();g.restore();};
    if(st.p1&&st.p2){const a=toCv(st.p1),b=toCv(st.p2);g.save();g.strokeStyle='#e11d48';g.lineWidth=2.5;g.beginPath();g.moveTo(a[0],a[1]);g.lineTo(b[0],b[1]);g.stroke();
      const m=mul(add(a,b),.5),lbl=st.len>0?fmtLen(st.len,true):'type its length';g.font='600 12px "IBM Plex Mono", monospace';const tw=g.measureText(lbl).width;
      g.fillStyle='#e11d48';g.fillRect(m[0]-tw/2-6,m[1]-22,tw+12,18);g.fillStyle='#fff';g.textAlign='center';g.textBaseline='middle';g.fillText(lbl,m[0],m[1]-13);g.restore();}
    if(st.p1)mk(st.p1);if(st.p2)mk(st.p2);
    if(st.hover&&st.mode==='mark'&&!(drag2&&drag2.pan&&drag2.moved)){const R=62,z=4,cx=st.hover[0]<cw/2&&st.hover[1]<ch/2?cw-R-10:R+10,cy=R+10,u=toSrc(st.hover);
      g.save();g.beginPath();g.arc(cx,cy,R,0,Math.PI*2);g.fillStyle='#fff';g.fill();g.clip();g.translate(cx,cy);g.scale(V.s*z,V.s*z);g.translate(-u[0],-u[1]);g.imageSmoothingEnabled=false;g.drawImage(st.src,0,0);g.restore();
      g.save();g.strokeStyle='#e11d48';g.lineWidth=1;g.beginPath();g.moveTo(cx-R,cy);g.lineTo(cx-4,cy);g.moveTo(cx+4,cy);g.lineTo(cx+R,cy);g.moveTo(cx,cy-R);g.lineTo(cx,cy-4);g.moveTo(cx,cy+4);g.lineTo(cx,cy+R);g.stroke();
      g.strokeStyle=C.line;g.lineWidth=2;g.beginPath();g.arc(cx,cy,R,0,Math.PI*2);g.stroke();g.restore();}}
  function ui(){const sc=planScale(st);
    $('#pimpTip').textContent=!st.p1?'Click one end of a wall whose length you know (or one end of a dimension). Drag to move around the plan; scroll or pinch to zoom.':
      !st.p2?'Now click the other end of that wall.':'Type its real length. Drag the red points to adjust them, or click again to start over.';
    $('#pimpScale').textContent=sc?'1 px = '+fmtLen(sc.s,true)+'  ·  plan '+fmtLen(((st.crop?st.crop[2]-st.crop[0]:st.W))*sc.s,true)+' × '+fmtLen(((st.crop?st.crop[3]-st.crop[1]:st.H))*sc.s,true):'–';
    const L=$('#pimpStraightL'),cb=$('#pimpStraight');
    if(st.p1&&st.p2){const a=Math.atan2(st.p2[1]-st.p1[1],st.p2[0]-st.p1[0])*180/Math.PI,dev=a-90*Math.round(a/90);cb.disabled=Math.abs(dev)>20;
      L.textContent=Math.abs(dev)<0.05?'This wall is already level':Math.abs(dev)>20?'This wall is at an angle, so the plan is kept as it is':'Straighten the plan to this wall (it is '+(Math.round(Math.abs(dev)*10)/10)+'° off)';}
    else{cb.disabled=true;L.textContent='Straighten the plan to this wall';}
    $('#pimpOpts').classList.toggle('dim',!st.o.find);$('#pimpCrop').setAttribute('aria-pressed',String(st.mode==='crop'));$('#pimpCrop').classList.toggle('on',st.mode==='crop');
    $('#pimpCrop').textContent=st.mode==='crop'?'Drag a box around the plan…':st.crop?'Crop again':'Crop to the plan';$('#pimpUncrop').hidden=!st.crop;
    cv.style.cursor=st.mode==='crop'?'crosshair':'crosshair';
    const res=$('#pimpRes');res.classList.remove('warn');
    if(!sc)res.textContent=st.o.find?'Walls are found once the scale is set.':'Only the image will be imported, as a reference to trace over.';
    else if(!st.o.find)res.textContent='Only the image will be imported, scaled and placed, as a reference to trace over.';
    else if(!st.res)res.textContent='Finding walls…';
    else if(st.res.err)res.textContent='Finding walls failed: '+st.res.err;
    else{const r=st.res,nd=r.ops.filter(o=>o.kind==='door').length,nw=r.ops.length-nd;
      res.textContent=r.walls.length?`Found ${r.walls.length} wall${r.walls.length>1?'s':''}${nd?', '+nd+' door'+(nd>1?'s':''):''}${nw?', '+nw+' window'+(nw>1?'s':''):''}. Thickness ${r.tList}. ${r.note||''}`:
        'No walls found. Check the scale, try “As two lines” or “Grey or coloured”, or lower Thinnest wall. You can still import the image and trace it.';}}
  function rerun(){clearTimeout(timer);st.res=null;ui();draw();if(!planScale(st)||!st.o.find)return;
    timer=setTimeout(()=>{if(!document.body.contains(cv))return;try{st.res=findPlanWalls(st);}catch(e){console.error(e);st.res={err:e.message||String(e)};}ui();draw();},180);}
  function readOpts(){const o=st.o;o.style=$('#pimpStyle').value;o.ink=$('#pimpInk').value;o.find=$('#pimpFind').checked;
    const a=parseLen($('#pimpMinT').value),b=parseLen($('#pimpMaxT').value),h=parseLen($('#pimpH').value);
    if(a>=20&&a<=600)o.minT=a;if(b>=o.minT&&b<=2000)o.maxT=b;if(h>=500)o.h=h;}
  ['pimpStyle','pimpInk','pimpFind','pimpMinT','pimpMaxT','pimpH'].forEach(id=>{$('#'+id).onchange=()=>{readOpts();rerun();};});
  $('#pimpLen').oninput=()=>{const v=parseLen($('#pimpLen').value);st.len=v>0?v:0;ui();draw();};$('#pimpLen').onchange=()=>rerun();
  $('#pimpLen').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();rerun();}};
  $('#pimpStraight').onchange=()=>{st.straight=$('#pimpStraight').checked;rerun();};
  $('#pimpCrop').onclick=()=>{st.mode=st.mode==='crop'?'mark':'crop';ui();draw();};
  $('#pimpUncrop').onclick=()=>{st.crop=null;fitV();rerun();};
  $('#pzIn').onclick=()=>zoomAt([cw/2,ch/2],1.4);$('#pzOut').onclick=()=>zoomAt([cw/2,ch/2],1/1.4);$('#pzFit').onclick=()=>{fitV();draw();};
  if($('#pimpPage'))$('#pimpPage').onchange=async e=>{const n=+e.target.value;$('#pimpRes').textContent='Reading page '+n+'…';
    try{st.src=await pdfPageCanvas(st.doc,n);st.page=n;st.W=st.src.width;st.H=st.src.height;st.p1=st.p2=null;st.crop=null;fitV();rerun();}catch(err){$('#pimpRes').textContent='That page could not be read.';}};
  const ptrs=new Map();let drag2=null;
  const cpt=e=>{const r=cv.getBoundingClientRect();return [e.clientX-r.left,e.clientY-r.top];};
  const clampU=u=>[clamp(u[0],0,st.W),clamp(u[1],0,st.H)];
  cv.onpointerdown=e=>{e.preventDefault();cv.focus();cv.setPointerCapture(e.pointerId);const p=cpt(e);ptrs.set(e.pointerId,p);
    if(ptrs.size===2){const [a,b]=[...ptrs.values()];drag2={pinch:true,d0:Math.max(1,dist(a,b)),s0:V.s,c:toSrc(mul(add(a,b),.5))};return;}
    const touch=e.pointerType!=='mouse';const tol=touch?16:10;let hk=null;for(const k of ['p2','p1'])if(st[k]&&dist(toCv(st[k]),p)<tol)hk=k;
    if(st.mode==='mark'&&hk&&e.button===0){drag2={handle:hk};return;}
    if(st.mode==='crop'&&e.button===0){const u=clampU(toSrc(p));st.cropDrag=[u,u];drag2={crop:true};return;}
    drag2={pan:true,p0:p,ox:V.ox,oy:V.oy,moved:false,btn:e.button,touch};};
  cv.onpointermove=e=>{const p=cpt(e);if(ptrs.has(e.pointerId))ptrs.set(e.pointerId,p);st.hover=e.pointerType==='mouse'?p:null;
    if(drag2){if(drag2.pinch&&ptrs.size===2){const [a,b]=[...ptrs.values()],m=mul(add(a,b),.5);V.s=clamp(drag2.s0*dist(a,b)/drag2.d0,0.02,40);V.ox=m[0]-drag2.c[0]*V.s;V.oy=m[1]-drag2.c[1]*V.s;}
      else if(drag2.handle){st[drag2.handle]=clampU(toSrc(p));ui();}
      else if(drag2.crop){st.cropDrag[1]=clampU(toSrc(p));}
      else if(drag2.pan){if(!drag2.moved&&dist(p,drag2.p0)>(drag2.touch?8:4))drag2.moved=true;if(drag2.moved){V.ox=drag2.ox+p[0]-drag2.p0[0];V.oy=drag2.oy+p[1]-drag2.p0[1];}}}
    draw();};
  const up=e=>{const had=ptrs.has(e.pointerId);ptrs.delete(e.pointerId);if(!drag2||!had)return;const p=cpt(e);
    if(drag2.pinch){if(ptrs.size<2)drag2=null;return;}
    if(drag2.pan&&!drag2.moved&&drag2.btn===0&&st.mode==='mark'&&e.type==='pointerup'){const u=clampU(toSrc(p));
      if(!st.p1)st.p1=u;else if(!st.p2){if(dist(toCv(st.p1),p)>6){st.p2=u;setTimeout(()=>$('#pimpLen').focus(),0);}}else{st.p1=u;st.p2=null;}rerun();}
    if(drag2.handle)rerun();
    if(drag2.crop){const [a,b]=st.cropDrag;st.cropDrag=null;if(Math.abs(a[0]-b[0])*V.s>20&&Math.abs(a[1]-b[1])*V.s>20){st.crop=[Math.min(a[0],b[0]),Math.min(a[1],b[1]),Math.max(a[0],b[0]),Math.max(a[1],b[1])];st.mode='mark';fitV();rerun();}}
    drag2=null;draw();};
  cv.onpointerup=up;cv.onpointercancel=up;cv.onpointerleave=()=>{st.hover=null;draw();};
  cv.onwheel=e=>{e.preventDefault();zoomAt(cpt(e),Math.exp(-e.deltaY*(e.deltaMode?0.05:0.0015)));};
  cv.oncontextmenu=e=>e.preventDefault();cv.tabIndex=0;
  cv.onkeydown=e=>{if(e.key==='+'||e.key==='=')zoomAt([cw/2,ch/2],1.4);else if(e.key==='-')zoomAt([cw/2,ch/2],1/1.4);};
  requestAnimationFrame(()=>{resize();fitV();ui();draw();});
  const ro=new ResizeObserver(()=>{if(!document.body.contains(cv))return ro.disconnect();resize();draw();});ro.observe(cv);}

/* ---------- finding walls in the picture ---------- */
function otsuLevel(L){const h=new Float64Array(256);for(let i=0;i<L.length;i++)h[L[i]]++;const N=L.length;let sum=0;for(let i=0;i<256;i++)sum+=i*h[i];
  let sB=0,wB=0,best=0,lev=128;for(let t=0;t<256;t++){wB+=h[t];if(!wB)continue;const wF=N-wB;if(!wF)break;sB+=t*h[t];const mB=sB/wB,mF=(sum-sB)/wF,v=wB*wF*(mB-mF)*(mB-mF);if(v>best){best=v;lev=t;}}return lev;}
function boxMorph(m,W,H,r,erode){ // square erosion or dilation of side 2r+1, done as a row pass then a column pass
  const tmp=new Uint8Array(W*H),out=new Uint8Array(W*H),k=2*r+1;
  for(let y=0;y<H;y++){let s=0;const o=y*W;for(let x=0;x<Math.min(r,W);x++)s+=m[o+x];
    for(let x=0;x<W;x++){if(x+r<W)s+=m[o+x+r];if(x-r-1>=0)s-=m[o+x-r-1];tmp[o+x]=erode?(s===k?1:0):(s>0?1:0);}}
  for(let x=0;x<W;x++){let s=0;for(let y=0;y<Math.min(r,H);y++)s+=tmp[y*W+x];
    for(let y=0;y<H;y++){if(y+r<H)s+=tmp[(y+r)*W+x];if(y-r-1>=0)s-=tmp[(y-r-1)*W+x];out[y*W+x]=erode?(s===k?1:0):(s>0?1:0);}}
  return out;}
// walls drawn as two lines: fill only between two long parallel lines that are no further apart than the thickest wall
function fillPairs(m,W,H,gmax,minRun){const hl=new Uint8Array(W*H),vl=new Uint8Array(W*H),out=m.slice();
  for(let y=0;y<H;y++){let x=0;while(x<W){if(!m[y*W+x]){x++;continue;}let e=x;while(e<W&&m[y*W+e])e++;if(e-x>=minRun)for(let k=x;k<e;k++)hl[y*W+k]=1;x=e;}}
  for(let x=0;x<W;x++){let y=0;while(y<H){if(!m[y*W+x]){y++;continue;}let e=y;while(e<H&&m[e*W+x])e++;if(e-y>=minRun)for(let k=y;k<e;k++)vl[k*W+x]=1;y=e;}}
  for(let x=0;x<W;x++){let last=-1;for(let y=0;y<H;y++){const i=y*W+x;if(hl[i]){const g=y-last-1;if(last>=0&&g>0&&g<=gmax)for(let k=last+1;k<y;k++)out[k*W+x]=1;last=y;}}}
  for(let y=0;y<H;y++){let last=-1;for(let x=0;x<W;x++){const i=y*W+x;if(vl[i]){const g=x-last-1;if(last>=0&&g>0&&g<=gmax)for(let k=last+1;k<x;k++)out[y*W+k]=1;last=x;}}}
  // second pass closes the corner squares, where only the outside lines meet: fill between a line and wall already filled
  const F=new Uint8Array(W*H);for(let i=0;i<W*H;i++)F[i]=out[i]&&!m[i]?1:0;const o2=out.slice();
  for(let x=0;x<W;x++){let last=-1,lk=0;for(let y=0;y<H;y++){const i=y*W+x,k=hl[i]?1:F[i]?2:0;if(k){const g=y-last-1;if(last>=0&&g>0&&g<=gmax&&(k|lk)===3)for(let q=last+1;q<y;q++)o2[q*W+x]=1;last=y;lk=k;}}}
  for(let y=0;y<H;y++){let last=-1,lk=0;for(let x=0;x<W;x++){const i=y*W+x,k=vl[i]?1:F[i]?2:0;if(k){const g=x-last-1;if(last>=0&&g>0&&g<=gmax&&(k|lk)===3)for(let q=last+1;q<x;q++)o2[y*W+q]=1;last=x;lk=k;}}}
  return o2;}
function chamferDT(m,W,H){const D=new Float32Array(W*H),INF=1e9;for(let i=0;i<W*H;i++)D[i]=m[i]?INF:0;
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){const i=y*W+x;if(!D[i])continue;let v=D[i];
    if(x>0)v=Math.min(v,D[i-1]+3);else v=Math.min(v,3);if(y>0){v=Math.min(v,D[i-W]+3);if(x>0)v=Math.min(v,D[i-W-1]+4);if(x<W-1)v=Math.min(v,D[i-W+1]+4);}else v=Math.min(v,3);D[i]=v;}
  for(let y=H-1;y>=0;y--)for(let x=W-1;x>=0;x--){const i=y*W+x;if(!D[i])continue;let v=D[i];
    if(x<W-1)v=Math.min(v,D[i+1]+3);else v=Math.min(v,3);if(y<H-1){v=Math.min(v,D[i+W]+3);if(x<W-1)v=Math.min(v,D[i+W+1]+4);if(x>0)v=Math.min(v,D[i+W-1]+4);}else v=Math.min(v,3);D[i]=v;}
  for(let i=0;i<W*H;i++)D[i]/=3;return D;}
function thinZS(m,W,H){ // Zhang–Suen thinning, in place, only visiting pixels still on
  let act=[];for(let y=1;y<H-1;y++)for(let x=1;x<W-1;x++)if(m[y*W+x])act.push(y*W+x);
  for(let y=0;y<H;y++){m[y*W]=0;m[y*W+W-1]=0;}for(let x=0;x<W;x++){m[x]=0;m[(H-1)*W+x]=0;}
  let changed=true;const del=[];
  while(changed){changed=false;
    for(let pass=0;pass<2;pass++){del.length=0;
      for(const i of act){if(!m[i])continue;const p2=m[i-W],p3=m[i-W+1],p4=m[i+1],p5=m[i+W+1],p6=m[i+W],p7=m[i+W-1],p8=m[i-1],p9=m[i-W-1];
        const B=p2+p3+p4+p5+p6+p7+p8+p9;if(B<2||B>6)continue;
        const A=(!p2&&p3?1:0)+(!p3&&p4?1:0)+(!p4&&p5?1:0)+(!p5&&p6?1:0)+(!p6&&p7?1:0)+(!p7&&p8?1:0)+(!p8&&p9?1:0)+(!p9&&p2?1:0);if(A!==1)continue;
        if(pass===0?(p2&&p4&&p6)||(p4&&p6&&p8):(p2&&p4&&p8)||(p2&&p6&&p8))continue;del.push(i);}
      if(del.length){changed=true;for(const i of del)m[i]=0;}}
    act=act.filter(i=>m[i]);}
  return m;}
function dpSimplify(P,tol){if(P.length<3)return [0,P.length-1];const keep=new Uint8Array(P.length);keep[0]=keep[P.length-1]=1;const st=[[0,P.length-1]];
  while(st.length){const [i,j]=st.pop();const a=P[i],b=P[j];let bd=-1,bk=-1;const d=sub(b,a),L=vlen(d)||1;
    for(let k=i+1;k<j;k++){const e=Math.abs(cross(d,sub(P[k],a)))/L;if(e>bd){bd=e;bk=k;}}
    if(bd>tol){keep[bk]=1;st.push([i,bk],[bk,j]);}}
  const out=[];keep.forEach((v,i)=>{if(v)out.push(i);});return out;}
function planRaster(st,sc){const o=st.o;const cr=st.crop||[0,0,st.W,st.H];const th=sc.rot*Math.PI/180,c=Math.cos(th),sn=Math.sin(th);
  const cs=[[cr[0],cr[1]],[cr[2],cr[1]],[cr[2],cr[3]],[cr[0],cr[3]]].map(([u,v])=>[(u*c-v*sn)*sc.s,(u*sn+v*c)*sc.s]);
  const x0=Math.min(...cs.map(p=>p[0])),x1=Math.max(...cs.map(p=>p[0])),y0=Math.min(...cs.map(p=>p[1])),y1=Math.max(...cs.map(p=>p[1]));
  let px=Math.max(sc.s,o.minT/8);px=Math.max(px,Math.sqrt((x1-x0)*(y1-y0)/6e6),(Math.max(x1-x0,y1-y0))/3200);
  const W=Math.ceil((x1-x0)/px)+3,H=Math.ceil((y1-y0)/px)+3;
  const cv=document.createElement('canvas');cv.width=W;cv.height=H;const g=cv.getContext('2d',{willReadFrequently:true});g.fillStyle='#fff';g.fillRect(0,0,W,H);
  const k=sc.s/px;g.setTransform(k*c,k*sn,-k*sn,k*c,-x0/px+1,-y0/px+1);g.beginPath();g.rect(cr[0],cr[1],cr[2]-cr[0],cr[3]-cr[1]);g.clip();g.imageSmoothingEnabled=true;g.imageSmoothingQuality='high';g.drawImage(st.src,0,0);
  const d=g.getImageData(0,0,W,H).data,L=new Uint8Array(W*H);for(let i=0;i<W*H;i++)L[i]=(d[4*i]*299+d[4*i+1]*587+d[4*i+2]*114)/1000;
  return {L,W,H,px,ox:x0-px,oy:y0-px};}
function findPlanWalls(st){const sc=planScale(st);if(!sc)return null;const o=st.o,R=planRaster(st,sc),{W,H,px}=R,N=W*H;
  const toW=(x,y)=>[(x+0.5)*px+R.ox,(y+0.5)*px+R.oy];
  // 1. ink
  const lev=o.ink==='grey'?232:clamp(otsuLevel(R.L),70,150);const ink=new Uint8Array(N);for(let i=0;i<N;i++)ink[i]=R.L[i]<lev?1:0;
  // 2. walls drawn as two lines: fill between them
  let m=o.style==='outline'?fillPairs(ink,W,H,Math.max(2,Math.round(o.maxT/px)),Math.round(Math.max(900,o.minT*6)/px)):ink;
  if(o.style==='hatch'){const r2=Math.max(1,Math.round(0.3*o.minT/px));m=boxMorph(boxMorph(m,W,H,r2,false),W,H,r2,true);} // fill between hatch lines
  // 3. remove everything thinner than the thinnest wall (furniture, fixtures, text, dimensions, door swings, window glazing)
  const r=Math.max(1,Math.floor((0.62*o.minT/px-1)/2));m=boxMorph(boxMorph(m,W,H,r,true),W,H,r,false);
  // 4. drop small pieces (bold text, symbols)
  {const lab=new Int32Array(N),stack=[];let n=0;const minLen=Math.max(600,o.minT*4)/px;
    for(let i=0;i<N;i++){if(!m[i]||lab[i])continue;n++;let x0=W,x1=0,y0=H,y1=0;const pix=[];stack.push(i);lab[i]=n;
      while(stack.length){const j=stack.pop();pix.push(j);const x=j%W,y=(j-x)/W;if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;
        if(x>0&&m[j-1]&&!lab[j-1]){lab[j-1]=n;stack.push(j-1);}if(x<W-1&&m[j+1]&&!lab[j+1]){lab[j+1]=n;stack.push(j+1);}
        if(y>0&&m[j-W]&&!lab[j-W]){lab[j-W]=n;stack.push(j-W);}if(y<H-1&&m[j+W]&&!lab[j+W]){lab[j+W]=n;stack.push(j+W);}}
      if(Math.max(x1-x0,y1-y0)+1<minLen)for(const j of pix)m[j]=0;}}
  // fill small holes inside walls (they would thin into little rings)
  {const lab=new Uint8Array(N),stack=[],Amax=Math.pow(o.maxT/px,2);
    for(let i=0;i<N;i++){if(m[i]||lab[i])continue;const pix=[i];let edge=false;lab[i]=1;stack.push(i);
      while(stack.length){const j=stack.pop();const x=j%W,y=(j-x)/W;if(x===0||y===0||x===W-1||y===H-1)edge=true;
        for(const k of [x>0?j-1:-1,x<W-1?j+1:-1,y>0?j-W:-1,y<H-1?j+W:-1])if(k>=0&&!m[k]&&!lab[k]){lab[k]=1;stack.push(k);if(pix.length<=Amax)pix.push(k);}}
      if(!edge&&pix.length<=Amax)for(const j of pix)m[j]=1;}}
  const DT=chamferDT(m,W,H);
  // 5. centre lines
  const sk=thinZS(m.slice(),W,H);
  const nb=i=>{let c=0;for(const d of [-W-1,-W,-W+1,-1,1,W-1,W,W+1])if(sk[i+d])c++;return c;};
  const deg=new Uint8Array(N);for(let i=0;i<N;i++)if(sk[i])deg[i]=nb(i);
  const nodeOf=new Int32Array(N).fill(-1),nodes=[];
  const isNodePx=i=>sk[i]&&deg[i]!==2;
  for(let i=0;i<N;i++){if(!isNodePx(i)||nodeOf[i]>=0)continue;const id=nodes.length,pix=[i],stk=[i];nodeOf[i]=id;
    while(stk.length){const j=stk.pop();for(const d of [-W-1,-W,-W+1,-1,1,W-1,W,W+1]){const k=j+d;if(isNodePx(k)&&nodeOf[k]<0){nodeOf[k]=id;pix.push(k);stk.push(k);}}}
    let sx=0,sy=0;pix.forEach(k=>{sx+=k%W;sy+=Math.floor(k/W);});nodes.push({x:sx/pix.length,y:sy/pix.length,pix,dt:Math.max(...pix.map(k=>DT[k]))});}
  const seen=new Uint8Array(N),edges=[];
  const walk=(start,first)=>{const path=[start,first];let prev=start,cur=first;
    while(true){if(nodeOf[cur]>=0)return {path,end:nodeOf[cur]};seen[cur]=1;let nx=-1;
      for(const d of [-W,-1,1,W,-W-1,-W+1,W-1,W+1]){const k=cur+d;if(!sk[k]||k===prev)continue;if(nodeOf[k]>=0&&nodeOf[k]===nodeOf[start]&&path.length<3)continue;if(nodeOf[k]>=0||!seen[k]){nx=k;break;}}
      if(nx<0)return {path,end:-1};path.push(nx);prev=cur;cur=nx;}};
  const traceFrom=id=>{for(const p of nodes[id].pix)for(const d of [-W-1,-W,-W+1,-1,1,W-1,W,W+1]){const k=p+d;if(!sk[k]||nodeOf[k]>=0||seen[k])continue;
      const r=walk(p,k);if(r.end>=0&&r.path.length>2)edges.push({a:id,b:r.end,px:r.path.slice(1,-1)});}};
  for(let id=0;id<nodes.length;id++)traceFrom(id);
  for(let i=0;i<N;i++)if(sk[i]&&!seen[i]&&nodeOf[i]<0){const id=nodes.length;nodeOf[i]=id;nodes.push({x:i%W,y:Math.floor(i/W),pix:[i],dt:DT[i]});traceFrom(id);} // closed rings
  // 6. prune short spurs (the forks a thinned wall makes at its corners), then join through 2-way nodes
  const ndeg=()=>{const c=new Array(nodes.length).fill(0);edges.forEach(e=>{if(e.dead)return;c[e.a]++;c[e.b]++;});return c;};
  for(let it=0;it<3;it++){const c=ndeg();let cut=0;
    edges.forEach(e=>{if(e.dead)return;const fa=c[e.a]===1,fb=c[e.b]===1;if(fa===fb)return;const j=fa?e.b:e.a;if(c[j]<3)return;
      if(e.px.length+1<nodes[j].dt*1.6+2){e.dead=true;cut++;}});if(!cut)break;}
  edges.forEach(e=>{if(!e.dead&&e.a===e.b&&e.px.length<6)e.dead=true;});
  const pt=k=>[k%W,Math.floor(k/W)];
  const chains=[];{const c=ndeg(),adj=nodes.map(()=>[]);edges.forEach((e,i)=>{if(e.dead)return;adj[e.a].push(i);adj[e.b].push(i);});const used=new Uint8Array(edges.length);
    const nodePt=id=>[nodes[id].x,nodes[id].y];
    const follow=(ei,from)=>{const pts=[nodePt(from)],dts=[];let cur=from,e=edges[ei];
      while(true){used[ei]=1;const fwd=e.a===cur;const seq=fwd?e.px:e.px.slice().reverse();seq.forEach(k=>{pts.push(pt(k));dts.push(DT[k]);});const nxt=fwd?e.b:e.a;pts.push(nodePt(nxt));
        if(c[nxt]!==2||nxt===from)return {pts,dts,a:from,b:nxt};const ne=adj[nxt].find(j=>!used[j]);if(ne==null)return {pts,dts,a:from,b:nxt};cur=nxt;ei=ne;e=edges[ei];}};
    nodes.forEach((n,id)=>{if(c[id]===2)return;adj[id].forEach(ei=>{if(!used[ei])chains.push(follow(ei,id));});});
    edges.forEach((e,ei)=>{if(!e.dead&&!used[ei])chains.push(follow(ei,e.a));});}
  // 7. straight pieces with their thickness
  const V=[],S=[];const vid=new Map();
  const vtx=(key,p)=>{if(key!=null&&vid.has(key))return vid.get(key);const id=V.length;V.push({p:toW(p[0],p[1])});if(key!=null)vid.set(key,id);return id;};
  const med=a=>{if(!a.length)return 0;const b=a.slice().sort((x,y)=>x-y);return b[Math.floor(b.length/2)];};
  chains.forEach(ch=>{if(ch.pts.length<2)return;const tol=Math.max(1.2,0.35*med(ch.dts));const keep=dpSimplify(ch.pts,tol);
    for(let q=0;q+1<keep.length;q++){const i0=keep[q],i1=keep[q+1];const va=q===0?vtx('n'+ch.a,ch.pts[i0]):vtx('c'+chains.indexOf(ch)+'_'+i0,ch.pts[i0]);
      const vb=q+1===keep.length-1?vtx('n'+ch.b,ch.pts[i1]):vtx('c'+chains.indexOf(ch)+'_'+i1,ch.pts[i1]);if(va===vb)continue;
      const dd=ch.dts.slice(Math.max(0,i0),Math.max(i0+1,i1-1));const hT=med(dd);S.push({a:va,b:vb,t:Math.max(1,2*hT-0.6)*px});}});
  const vdeg=()=>{const c=new Array(V.length).fill(0);S.forEach(s=>{if(s.dead)return;c[s.a]++;c[s.b]++;});return c;};
  const segLen=s=>dist(V[s.a].p,V[s.b].p);
  // measure each piece's width straight across it, at several places along its middle
  const inM=(x,y)=>{const i=Math.round(y)*W+Math.round(x);return x>=0&&y>=0&&x<W&&y<H&&m[i];};
  S.forEach(s=>{const A=V[s.a].p,B=V[s.b].p,L=dist(A,B);if(L<px*3)return;const d=norm(sub(B,A)),n=perp(d),ws=[];
    for(let f=0.2;f<=0.8;f+=0.075){const P=add(A,mul(d,L*f));const x=(P[0]-R.ox)/px-0.5,y=(P[1]-R.oy)/px-0.5;if(!inM(x,y))continue;let a=0,b=0;
      while(a<400&&inM(x+n[0]*(a+0.5),y+n[1]*(a+0.5)))a+=0.5;while(b<400&&inM(x-n[0]*(b+0.5),y-n[1]*(b+0.5)))b+=0.5;ws.push((a+b)*px);}
    if(ws.length>=3)s.t=med(ws);});
  // too thick (filled areas) or too thin to be a wall
  S.forEach(s=>{if(s.t>o.maxT*1.5)s.dead=true;});
  // 8. tidy junctions: very short pieces between two junctions collapse into one point; short loose stubs go
  for(let it=0;it<3;it++){const c=vdeg();let ch=0;
    S.forEach(s=>{if(s.dead)return;const L=segLen(s);
      if(c[s.a]>=3&&c[s.b]>=3&&L<0.75*s.t){const m=mul(add(V[s.a].p,V[s.b].p),.5);V[s.a].p=m;S.forEach(q=>{if(q.a===s.b)q.a=s.a;if(q.b===s.b)q.b=s.a;});s.dead=true;ch++;}
      else if((c[s.a]===1||c[s.b]===1)&&(c[s.a]>=3||c[s.b]>=3)&&L<0.6*s.t){s.dead=true;ch++;}
      else if(c[s.a]===1&&c[s.b]===1&&L<Math.max(300,1.5*s.t)){s.dead=true;ch++;}
      else if(o.style==='outline'&&(c[s.a]===1||c[s.b]===1)&&L<2.2*s.t){s.dead=true;ch++;} // a fixture drawn against a wall, filled in by mistake
      else if((c[s.a]===1&&c[s.b]===2)||(c[s.b]===1&&c[s.a]===2)){ // a slanted hook at a wall end (a door leaf or a mark touching it)
        const j=c[s.a]===2?s.a:s.b,q=S.find(x=>x!==s&&!x.dead&&(x.a===j||x.b===j));if(q&&L<Math.max(1.8*s.t,250)&&segLen(q)>L){
          const d1=norm(sub(V[s.a===j?s.b:s.a].p,V[j].p)),d2=norm(sub(V[q.a===j?q.b:q.a].p,V[j].p)),cs=Math.abs(dot(d1,d2));if(cs>0.34&&cs<0.94){s.dead=true;ch++;}}}});
    S.forEach(s=>{if(!s.dead&&s.a===s.b)s.dead=true;});if(!ch)break;}
  let segs=S.filter(s=>!s.dead);
  // the plan may still be slightly crooked (marks a little off, or a skewed scan): find its main direction and turn it square
  let skew=0;{let sw=0,sa=0;segs.forEach(s=>{const d=sub(V[s.b].p,V[s.a].p),L=vlen(d);if(L<600)return;let a=Math.atan2(d[1],d[0])*180/Math.PI;a-=90*Math.round(a/90);if(Math.abs(a)>6)return;sw+=L;sa+=L*a;});
    if(sw>0)skew=sa/sw;if(Math.abs(skew)>0.03)V.forEach(v=>{v.p=rotV(v.p,-skew);});else skew=0;}
  // 9. thickness: round to 10 mm and use one value for walls that are nearly the same
  segs.forEach(s=>{s.t=clamp(Math.round(s.t/10)*10,Math.round(o.minT*0.8/10)*10,Math.round(o.maxT/10)*10);});
  {const groups=[];segs.slice().sort((a,b)=>a.t-b.t).forEach(s=>{const g=groups[groups.length-1];if(g&&s.t-g.lo<=Math.max(25,px*1.6)){g.list.push(s);}else groups.push({lo:s.t,list:[s]});});
    groups.forEach(g=>{const w=new Map();g.list.forEach(s=>w.set(s.t,(w.get(s.t)||0)+segLen(s)));let bt=g.lo,bw=-1;w.forEach((v,k)=>{if(v>bw){bw=v;bt=k;}});g.list.forEach(s=>s.t=bt);});}
  // 10. square up: pieces within 4° of level or plumb become exactly level or plumb, sharing their x or y
  {const par=V.map((_,i)=>i),find=i=>{while(par[i]!==i)i=par[i]=par[par[i]];return i;};const parY=V.map((_,i)=>i),findY=i=>{while(parY[i]!==i)i=parY[i]=parY[parY[i]];return i;};
    const TOL=Math.tan(4*Math.PI/180);
    segs.forEach(s=>{const d=sub(V[s.b].p,V[s.a].p);if(Math.abs(d[1])<=Math.abs(d[0])*TOL){parY[findY(s.a)]=findY(s.b);s.dir='h';}else if(Math.abs(d[0])<=Math.abs(d[1])*TOL){par[find(s.a)]=find(s.b);s.dir='v';}});
    const avg=(fn,k)=>{const acc=new Map();V.forEach((v,i)=>{const r=fn(i);const a=acc.get(r)||[0,0];a[0]+=v.p[k];a[1]++;acc.set(r,a);});V.forEach((v,i)=>{const a=acc.get(fn(i));v.p=k?[v.p[0],a[0]/a[1]]:[a[0]/a[1],v.p[1]];});};
    avg(find,0);avg(findY,1);
    // line up separate walls that are on the same line (both sides of a door, say)
    for(const [dir,k] of [['h',1],['v',0]]){const ids=[...new Set(segs.filter(s=>s.dir===dir).flatMap(s=>[s.a,s.b]))].sort((a,b)=>V[a].p[k]-V[b].p[k]);
      let grp=[];const flush=()=>{if(grp.length>1){const m=grp.reduce((a,i)=>a+V[i].p[k],0)/grp.length;grp.forEach(i=>V[i].p[k]=m);}grp=[];};
      ids.forEach(i=>{if(grp.length&&V[i].p[k]-V[grp[0]].p[k]>Math.max(20,px*1.5))flush();grp.push(i);});flush();}}
  // 11. free ends: thinning stops about half a thickness short, so put that back
  {const c=vdeg();segs.forEach(s=>{for(const [e,f] of [['a','b'],['b','a']])if(c[s[e]]===1){const d=norm(sub(V[s[e]].p,V[s[f]].p));V[s[e]].p=add(V[s[e]].p,mul(d,s.t/2));}});}
  // 12. gaps between wall ends in line are doors or windows
  const ops=[];const sample=(P0)=>{const P=skew?rotV(P0,skew):P0;const x=Math.round((P[0]-R.ox)/px-0.5),y=Math.round((P[1]-R.oy)/px-0.5);if(x<1||y<1||x>=W-1||y>=H-1)return 0;
      for(const d of [0,-1,1,-W,W])if(ink[y*W+x+d])return 1;return 0;};
  {const c=vdeg();const ends=[];segs.forEach((s,si)=>{for(const [e,f] of [['a','b'],['b','a']])if(c[s[e]]===1)ends.push({v:s[e],o:s[f],s:si,d:norm(sub(V[s[e]].p,V[s[f]].p))});});
    const pairs=[];for(let i=0;i<ends.length;i++)for(let j=i+1;j<ends.length;j++){const A=ends[i],B=ends[j];if(A.s===B.s)continue;if(dot(A.d,B.d)>-0.996)continue;
      const ab=sub(V[B.v].p,V[A.v].p),gap=dot(ab,A.d),lat=Math.abs(cross(A.d,ab)),t=Math.max(segs[A.s].t,segs[B.s].t);
      if(gap>=380&&gap<=3000&&lat<Math.max(t*0.5,40))pairs.push({A,B,gap,t});}
    pairs.sort((p,q)=>p.gap-q.gap);const usedV=new Set();
    pairs.forEach(pr=>{if(usedV.has(pr.A.v)||usedV.has(pr.B.v))return;usedV.add(pr.A.v);usedV.add(pr.B.v);
      const PA=V[pr.A.v].p,PB=V[pr.B.v].p,d=pr.A.d,n=perp(d),gap=pr.gap;
      // swing: a quarter circle of radius = gap from either jamb, on either side
      let door=null,best=0.5;for(const [hv,H0,F0] of [[0,PA,PB],[1,PB,PA]])for(const sd of [1,-1]){const toF=norm(sub(F0,H0)),side=mul(n,sd);let hit=0,tot=0;
        for(let q=4;q<=86;q+=3){const a=q*Math.PI/180,u=add(mul(toF,Math.cos(a)),mul(side,Math.sin(a)));tot++;
          for(const rr of [0,-1.5,1.5,-3,3,-4.5,4.5]){if(sample(add(add(H0,mul(side,pr.t/2)),mul(u,gap+rr*px)))){hit++;break;}}}
        const f=hit/tot;if(f>best){best=f;door={hingeAtA:hv===0,side:sd};}}
      let lines=0;if(!door)for(let q=-4;q<=4;q++){const off=mul(n,q/9*pr.t);let hit=0,tot=0;for(let u=0.1;u<=0.9;u+=0.04){tot++;hit+=sample(add(add(PA,mul(d,u*gap)),off));}if(hit/tot>0.75)lines++;}
      const kind=door?'door':lines>=1?'window':'door';
      S.push({a:pr.A.v,b:pr.B.v,t:pr.t,dir:segs[pr.A.s].dir,fill:true});
      ops.push({P:mul(add(PA,PB),.5),d,w:Math.round(gap/10)*10,kind,hingeP:door?(door.hingeAtA?PA:PB):null,swingN:door?mul(n,door.side):null});});
    segs=S.filter(s=>!s.dead);}
  // 13. loose ends that stop just short of another wall are taken onto it
  {const c=vdeg();segs.forEach(s=>{for(const [e,f] of [['a','b'],['b','a']]){if(c[s[e]]!==1)continue;const P=V[s[e]].p,d=norm(sub(P,V[s[f]].p));let best=null,bd=s.t*0.9+120;
      segs.forEach(q=>{if(q===s||q.a===s[e]||q.b===s[e])return;const A=V[q.a].p,B=V[q.b].p,X=lineX(P,d,A,sub(B,A));if(!X)return;const u=dot(sub(X,A),norm(sub(B,A))),L=dist(A,B);
        if(u<-q.t||u>L+q.t)return;const ahead=dot(sub(X,P),d);if(ahead>-q.t/2&&ahead<bd){bd=ahead;best={X,q,u,L};}});
      if(best){V[s[e]].p=best.X;const {q,u,L}=best;if(u<0&&c[q.a]===1)V[q.a].p=best.X;if(u>L&&c[q.b]===1)V[q.b].p=best.X;}}});}
  {const par=V.map((_,i)=>i),f=i=>{while(par[i]!==i)i=par[i]=par[par[i]];return i;};segs.forEach(s=>{par[f(s.a)]=f(s.b);});
    const tot=new Map();segs.forEach(s=>tot.set(f(s.a),(tot.get(f(s.a))||0)+dist(V[s.a].p,V[s.b].p)));const big=Math.max(0,...tot.values());
    segs=segs.filter(s=>tot.get(f(s.a))>=Math.min(big*0.2,6000));
    const keepV=new Set(segs.flatMap(s=>[s.a,s.b]));for(let i=ops.length-1;i>=0;i--){const o=ops[i];if(!segs.some(s=>s.fill&&dist(mul(add(V[s.a].p,V[s.b].p),.5),o.P)<1))ops.splice(i,1);}}
  // 14. join straight runs through 2-way points into single walls
  const out=[];{const c=vdeg(),adj=V.map(()=>[]);segs.forEach((s,i)=>{adj[s.a].push(i);adj[s.b].push(i);});const used=new Uint8Array(segs.length);
    const can=(i,j,v)=>{const s=segs[i],q=segs[j];if(Math.abs(s.t-q.t)>15)return false;const d1=norm(sub(V[s.a===v?s.b:s.a].p,V[v].p)),d2=norm(sub(V[q.a===v?q.b:q.a].p,V[v].p));return dot(d1,d2)<-0.9995;};
    const runFrom=(i,v0)=>{let v=v0,ids=[i];used[i]=1;let cur=i;let far=segs[i].a===v0?segs[i].b:segs[i].a;
      while(c[far]===2){const nx=adj[far].find(j=>j!==cur&&!used[j]);if(nx==null||!can(cur,nx,far))break;used[nx]=1;ids.push(nx);cur=nx;far=segs[nx].a===far?segs[nx].b:segs[nx].a;}return {end:far,ids};};
    segs.forEach((s,i)=>{if(used[i])return;used[i]=1;let a=s.a,b=s.b;
      const back=(()=>{let v=s.a,cur=i;while(c[v]===2){const nx=adj[v].find(j=>j!==cur&&!used[j]);if(nx==null||!can(cur,nx,v))break;used[nx]=1;cur=nx;v=segs[nx].a===v?segs[nx].b:segs[nx].a;}return v;})();
      const fwd=(()=>{let v=s.b,cur=i;while(c[v]===2){const nx=adj[v].find(j=>j!==cur&&!used[j]);if(nx==null||!can(cur,nx,v))break;used[nx]=1;cur=nx;v=segs[nx].a===v?segs[nx].b:segs[nx].a;}return v;})();
      a=back;b=fwd;const P=V[a].p,Q=V[b].p;if(dist(P,Q)<60)return;out.push({a:P.map(v=>Math.round(v)),b:Q.map(v=>Math.round(v)),t:s.t});});}
  const tl=[...new Set(out.map(w=>w.t))].sort((a,b)=>a-b).map(t=>fmtLen(t,true));
  const tooFine=sc.s>o.minT/2.5;
  return {walls:out,ops,rot:sc.rot-skew,mask:{m,W,H,px,ox:R.ox,oy:R.oy,skew},tList:tl.length?tl.join(', '):'–',note:tooFine?'The picture is coarse for walls this thin; a sharper scan or the PDF works better.':''};}

function applyPlanImport(st){const sc=planScale(st),res=st.o.find?st.res:null,o=st.o,rot=res&&res.rot!=null?res.rot:sc.rot;
  const th=rot*Math.PI/180,c=Math.cos(th),sn=Math.sin(th),W0=(u,v)=>[(u*c-v*sn)*sc.s,(u*sn+v*c)*sc.s];
  const cr=st.crop||[0,0,st.W,st.H];let pts=res&&res.walls.length?res.walls.flatMap(w=>[w.a,w.b]):[W0(cr[0],cr[1]),W0(cr[2],cr[1]),W0(cr[2],cr[3]),W0(cr[0],cr[3])];
  const x0=Math.min(...pts.map(p=>p[0])),y0=Math.min(...pts.map(p=>p[1]));let off=[-x0,-y0];
  const adding=o.place==='add'&&M.walls.length;
  if(adding){let x1=-1e9,yy=1e9;M.walls.forEach(w=>[w.a,w.b].forEach(p=>{x1=Math.max(x1,p[0]);yy=Math.min(yy,p[1]);}));off=[x1+2000-x0,yy-y0];}
  off=off.map(v=>Math.round(v));const T=p=>[Math.round((p[0]+off[0])*10)/10,Math.round((p[1]+off[1])*10)/10];
  let nd=0,nw=0;const ws=[];
  mutate(()=>{
    if(!adding){Object.assign(M,blankModel());M.name=st.name.replace(/\.(png|jpe?g|webp|gif|bmp|pdf)$/i,'');}
    if(res)res.walls.forEach(w=>{const wall={id:nid('w'),a:T(w.a),b:T(w.b),t:w.t,h:o.h};M.walls.push(wall);ws.push(wall);});
    if(res)res.ops.forEach(op=>{const P=T(op.P);let best=null,bd=1e9;ws.forEach(w=>{const d=wallDir(w);if(Math.abs(dot(d,op.d))<0.99)return;const q=segClosest(P,w.a,w.b);const e=dist(P,q.q);if(e<bd){bd=e;best=w;}});
      if(!best||bd>best.t)return;const d=wallDir(best),L=wallLen(best),s=dot(sub(P,best.a),d);const w=Math.min(op.w,L-20);if(w<300||s-w/2<-1||s+w/2>L+1)return;
      if(op.kind==='door'){nd++;const n=perp(d),hp=op.hingeP?T(op.hingeP):null;M.openings.push({id:nid('o'),wall:best.id,s,w,kind:'door',h:Math.min(2100,o.h),sill:0,flip:dot(op.swingN||n,n)>=0?0:1,hinge:dot(sub(hp||best.a,best.a),d)<s?0:1});}
      else{nw++;M.openings.push({id:nid('o'),wall:best.id,s,w,kind:'window',h:Math.min(1200,o.h-900),sill:900,flip:0,hinge:0});}});});
  // keep the picture under the plan; reduce it so the project file stays a sensible size
  const k=Math.min(1,3000/Math.max(cr[2]-cr[0],cr[3]-cr[1]));const cw=Math.max(1,Math.round((cr[2]-cr[0])*k)),chh=Math.max(1,Math.round((cr[3]-cr[1])*k));
  const cv=document.createElement('canvas');cv.width=cw;cv.height=chh;const g=cv.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,cw,chh);g.drawImage(st.src,cr[0],cr[1],cr[2]-cr[0],cr[3]-cr[1],0,0,cw,chh);
  const P0=W0(cr[0],cr[1]);
  if(!adding)setReference(null);
  const under=o.under==='walls'&&!(res&&res.mask)?'all':o.under;
  if(under==='none')setRefImage(null);
  else if(under==='walls'){ // just the walls as they appear in the picture: furniture, fixtures, text and dimensions are left out
    const K0=res.mask,K=Object.assign({},K0,{m:keepNearWalls(K0,res.walls)});let i0=K.W,j0=K.H,i1=-1,j1=-1;for(let j=0;j<K.H;j++)for(let i=0;i<K.W;i++)if(K.m[j*K.W+i]){if(i<i0)i0=i;if(i>i1)i1=i;if(j<j0)j0=j;if(j>j1)j1=j;}
    if(i1<0)setRefImage(null);else{const bw=i1-i0+1,bh=j1-j0+1,c2=document.createElement('canvas');c2.width=bw;c2.height=bh;const g2=c2.getContext('2d'),id=g2.createImageData(bw,bh);
      for(let j=0;j<bh;j++)for(let i=0;i<bw;i++){const q=4*(j*bw+i),on=K.m[(j+j0)*K.W+i+i0];id.data[q]=id.data[q+1]=id.data[q+2]=on?0:255;id.data[q+3]=255;}g2.putImageData(id,0,0);
      const P=rotV([i0*K.px+K.ox,j0*K.px+K.oy],-K.skew);setRefImage({name:st.name,src:c2.toDataURL('image/png'),w:bw,h:bh,x:Math.round((P[0]+off[0])*10)/10,y:Math.round((P[1]+off[1])*10)/10,s:K.px,r:-K.skew});}}
  else setRefImage({name:st.name,src:cv.toDataURL('image/jpeg',0.82),w:cw,h:chh,x:Math.round((P0[0]+off[0])*10)/10,y:Math.round((P0[1]+off[1])*10)/10,s:sc.s/k,r:rot});
  refVisible=true;updateRefUI();sel=null;$('#projName').value=M.name;renderInspector();fit();frame3d();build3d();
  const parts=[];if(ws.length)parts.push(ws.length+' wall'+(ws.length>1?'s':''));if(nd)parts.push(nd+' door'+(nd>1?'s':''));if(nw)parts.push(nw+' window'+(nw>1?'s':''));if(rooms.length)parts.push(rooms.length+' room'+(rooms.length>1?'s':''));
  toast(parts.length?'Imported '+parts.join(', ')+(under==='none'?'.':under==='walls'?'. The walls from the picture are underneath; trace anything missed with the Wall tool.':'. The plan image is underneath; trace anything missed with the Wall tool.'):'The plan image is placed to scale under the drawing. Trace it with the Wall tool.');}

// keep only the dark areas joined to a wall that was found (drops the sheet border, a title, a legend box…)
function keepNearWalls(K,walls){const {W,H,px}=K,cv=document.createElement('canvas');cv.width=W;cv.height=H;const g=cv.getContext('2d');g.strokeStyle='#000';g.lineCap='square';
  walls.forEach(w=>{const a=rotV(w.a,K.skew),b=rotV(w.b,K.skew);g.lineWidth=Math.max(2,w.t/px*0.6);g.beginPath();g.moveTo((a[0]-K.ox)/px,(a[1]-K.oy)/px);g.lineTo((b[0]-K.ox)/px,(b[1]-K.oy)/px);g.stroke();});
  const band=g.getImageData(0,0,W,H).data,out=new Uint8Array(W*H),st=[];
  for(let i=0;i<W*H;i++)if(K.m[i]&&band[4*i+3]>100&&!out[i]){out[i]=1;st.push(i);
    while(st.length){const j=st.pop(),x=j%W;for(const k of [x>0?j-1:-1,x<W-1?j+1:-1,j-W,j+W])if(k>=0&&k<W*H&&K.m[k]&&!out[k]){out[k]=1;st.push(k);}}}
  return out;}
/* ---------- the plan image under the drawing ---------- */
let refImage=null,refImgMask=null,refImgTint=null,refImgTintCol='';
function setRefImage(R,keep){refImage=R&&R.src?R:null;if(typeof checkRefLeftover==='function')checkRefLeftover();refImgMask=refImgTint=null;refImgTintCol='';
  if(refImage){const im=new Image();im.onload=()=>{if(refImage!==R)return;const cv=document.createElement('canvas');cv.width=im.width;cv.height=im.height;const g=cv.getContext('2d',{willReadFrequently:true});g.drawImage(im,0,0);
      const d=g.getImageData(0,0,cv.width,cv.height),a=d.data;const h=new Uint32Array(256);for(let i=0;i<a.length;i+=4)h[(a[i]*299+a[i+1]*587+a[i+2]*114)/1000|0]++;
      let acc=0,paper=255;for(let v=255;v>=0;v--){acc+=h[v];if(acc>a.length/4*0.3){paper=v;break;}} // the paper is the lightest 30% or so
      const top=Math.max(60,paper-14),k=255/Math.max(40,top-30);
      for(let i=0;i<a.length;i+=4){const l=(a[i]*299+a[i+1]*587+a[i+2]*114)/1000;a[i]=a[i+1]=a[i+2]=0;a[i+3]=l>=top?0:Math.min(255,(top-l)*k);}
      g.putImageData(d,0,0);refImgMask=cv;checkRefLeftover();dirty();};im.src=R.src;}
  if(!keep)saveRefImage();updateRefUI();dirty();}
function saveRefImage(){if(typeof save==='function'&&activeTab)save();}
function saveRefImageOld(){try{if(refImage)localStorage.setItem('bm-refimg',JSON.stringify(refImage));else localStorage.removeItem('bm-refimg');}
  catch(e){try{localStorage.removeItem('bm-refimg');}catch(_){}toast('The plan image is too large to keep between sessions here. Save the project to keep it.');}}
const refTintCache={};
function refTinted(col){if(refTintCache.col===col&&refTintCache.mask===refImgMask&&refTintCache.ver===refTintVer)return refTintCache.cv;const cv=document.createElement('canvas');cv.width=refImgMask.width;cv.height=refImgMask.height;const g=cv.getContext('2d');
  g.drawImage(refImgMask,0,0);g.globalCompositeOperation='source-in';g.fillStyle=col;g.fillRect(0,0,cv.width,cv.height);Object.assign(refTintCache,{col,mask:refImgMask,ver:refTintVer,cv});return cv;}
let refTintVer=0;
// in the Eraser, whatever can be rubbed out is drawn on top in red, so you can see it even where it sits under a wall
function drawEraseOverlay(){const col=C.danger||'#e5484d',dpr=window.devicePixelRatio||1;
  if(refImage&&refImgMask){const R=refImage;ctx.save();ctx.setTransform(dpr*view.s,0,0,dpr*view.s,dpr*view.ox,dpr*view.oy);ctx.translate(R.x,R.y);ctx.rotate(R.r*Math.PI/180);ctx.scale(R.s,R.s);
    ctx.globalAlpha=0.6;ctx.drawImage(refTinted(col),0,0);ctx.restore();}
  if(refDrawing&&refPath){ctx.save();ctx.setTransform(dpr*view.s,0,0,dpr*view.s,dpr*view.ox,dpr*view.oy);ctx.strokeStyle=col;ctx.globalAlpha=0.8;ctx.lineWidth=1.5/view.s;ctx.stroke(refPath);ctx.restore();
    ctx.save();ctx.fillStyle=col;refDrawing.texts.forEach(([x,y,h,rot,str])=>{const px=h*view.s;if(px<5)return;const q=toS([x,y]);ctx.save();ctx.translate(q[0],q[1]);ctx.rotate(rot);ctx.font=px+'px "IBM Plex Sans", system-ui, sans-serif';ctx.fillText(String(str).split('\n')[0],0,0);ctx.restore();});ctx.restore();}}
// is there anything under the plan that is not hidden under a wall? (the eraser is only offered when there is)
let refLeftover=false,refLeftTimer=0;
function checkRefLeftover(){clearTimeout(refLeftTimer);refLeftTimer=setTimeout(()=>{refLeftover=computeRefLeftover();updateRefUI();},250);}
function computeRefLeftover(){
  if(refDrawing&&(refDrawing.segs.length||refDrawing.arcs.length||refDrawing.texts.length))return true;
  if(!refImage)return false;if(!refImgMask)return true;
  const W=refImgMask.width,H=refImgMask.height,k=Math.min(1,700/Math.max(W,H)),w=Math.max(1,Math.round(W*k)),h=Math.max(1,Math.round(H*k));
  const cv=document.createElement('canvas');cv.width=w;cv.height=h;const g=cv.getContext('2d',{willReadFrequently:true});g.drawImage(refImgMask,0,0,w,h);
  const R=refImage;g.globalCompositeOperation='destination-out';g.scale(k/R.s,k/R.s);g.rotate(-R.r*Math.PI/180);g.translate(-R.x,-R.y);g.strokeStyle='#000';g.lineCap='square';
  M.walls.forEach(wl=>{g.lineWidth=wl.t+80;g.beginPath();g.moveTo(wl.a[0],wl.a[1]);g.lineTo(wl.b[0],wl.b[1]);g.stroke();});
  const d=g.getImageData(0,0,w,h).data;let n=0;for(let i=3;i<d.length;i+=4)if(d[i]>70)n++;
  return n>Math.max(25,w*h*0.0004);}
function drawRefImage(){if(!refImage||!refVisible||!refImgMask)return;
  if(refImgTintCol!==C.ref){const cv=document.createElement('canvas');cv.width=refImgMask.width;cv.height=refImgMask.height;const g=cv.getContext('2d');g.drawImage(refImgMask,0,0);g.globalCompositeOperation='source-in';g.fillStyle=C.ref;g.fillRect(0,0,cv.width,cv.height);refImgTint=cv;refImgTintCol=C.ref;}
  const dpr=pxr(),R=refImage;ctx.save();ctx.setTransform(dpr*view.s,0,0,dpr*view.s,dpr*view.ox,dpr*view.oy);ctx.translate(R.x,R.y);ctx.rotate(R.r*Math.PI/180);ctx.scale(R.s,R.s);
  ctx.globalAlpha=0.9;ctx.imageSmoothingEnabled=true;ctx.drawImage(refImgTint,0,0);ctx.restore();}
function refImageCorners(){const R=refImage;if(!R)return [];const th=R.r*Math.PI/180,c=Math.cos(th),s=Math.sin(th);
  return [[0,0],[R.w,0],[R.w,R.h],[0,R.h]].map(([u,v])=>[R.x+(u*c-v*s)*R.s,R.y+(u*s+v*c)*R.s]);}


/* ============================== export the plan as PDF, PNG or JPG ============================== */
// The plan is drawn again off screen onto a sheet of paper, at a chosen scale and resolution, with a title block.
const PAPERS={A4:[297,210],A3:[420,297],A2:[594,420],A1:[841,594],Letter:[279.4,215.9],Tabloid:[431.8,279.4]};
const PRINT_SCALES=[20,25,50,75,100,150,200,250,500];
let EXP=null;const pxr=()=>EXP?EXP.k:(window.devicePixelRatio||1);
let printOpts={fmt:'pdf',paper:'A3',orient:'auto',scale:'fit',dpi:200,colors:'print',grid:false,ref:false,title:true,view3d:false};
try{Object.assign(printOpts,JSON.parse(localStorage.getItem('bm-print')||'{}'));}catch(e){}
function planBounds(){const pts=[];M.walls.forEach(w=>{const n=mul(perp(wallDir(w)),w.t/2);pts.push(add(w.a,n),sub(w.a,n),add(w.b,n),sub(w.b,n));});
  M.items.forEach(it=>[[-1,-1],[1,-1],[1,1],[-1,1]].forEach(([x,y])=>pts.push(add([it.x,it.y],rotV([x*it.w/2,y*it.d/2],it.r)))));
  (M.cols||[]).forEach(c=>pts.push(...colCorners(c)));(M.dims||[]).forEach(d=>pts.push(d.a,d.b));(M.areas||[]).forEach(A=>{if(A.pts.length>=3)pts.push(...areaOutline(A));});
  (M.texts||[]).forEach(T=>pts.push(...textBox(T)));
  if(printOpts.ref&&refImage)pts.push(...refImageCorners());
  if(!pts.length)return null;let x0=1e18,y0=1e18,x1=-1e18,y1=-1e18;pts.forEach(p=>{x0=Math.min(x0,p[0]);y0=Math.min(y0,p[1]);x1=Math.max(x1,p[0]);y1=Math.max(y1,p[1]);});
  const pad=MEAS.ext?1300:300;return {x0:x0-pad,y0:y0-pad,x1:x1+pad,y1:y1+pad};}
// page layout in CSS pixels (96 per inch) for the options; returns where the plan goes and at what scale
function sheetLayout(o){const bb=planBounds();if(!bb)return null;const mm=96/25.4;let [pw,ph]=PAPERS[o.paper]||PAPERS.A3;
  const landscape=o.orient==='landscape'||(o.orient==='auto'&&(bb.x1-bb.x0)>=(bb.y1-bb.y0));if(landscape!==(pw>=ph))[pw,ph]=[ph,pw];
  const M_=10*mm,TB=o.title?20*mm:0,W=pw*mm,H=ph*mm,aw=W-2*M_,ah=H-2*M_-TB;
  const fitS=Math.min(aw/(bb.x1-bb.x0),ah/(bb.y1-bb.y0));let s=fitS,den=null;
  if(o.scale!=='fit'){den=+o.scale;s=mm/den;}
  const ox=M_+(aw-(bb.x1-bb.x0)*s)/2-bb.x0*s,oy=M_+(ah-(bb.y1-bb.y0)*s)/2-bb.y0*s;
  // the smallest standard scale that fits, for the note and for "fit"
  const fitDen=mm/fitS;const best=PRINT_SCALES.find(d=>d>=fitDen-1e-6);
  return {W,H,pw,ph,M:M_,TB,aw,ah,s,ox,oy,den,fitDen,best,fits:s<=fitS*1.0001};}
function renderSheet(o,k){const L=sheetLayout(o);if(!L)return null;
  // stay within what browsers can draw: about 40 million pixels
  k=Math.min(k,Math.sqrt(40e6/(L.W*L.H)));const cv=document.createElement('canvas');cv.width=Math.round(L.W*k);cv.height=Math.round(L.H*k);
  const keep={ctx,view:{...view},sel,hover,drag,tool,refVisible,theme:document.documentElement.getAttribute('data-theme'),C};
  try{
    if(o.colors==='print'){skipTheme=true;document.documentElement.setAttribute('data-theme','light');readColors();C=Object.assign({},C,{paper:'#ffffff'});}
    ctx=cv.getContext('2d');EXP={w:L.W,h:L.H,k,grid:o.grid};view.s=L.s;view.ox=L.ox;view.oy=L.oy;sel=null;hover=null;drag=null;tool='export';refVisible=!!o.ref;
    ctx.save();ctx.setTransform(k,0,0,k,0,0);ctx.fillStyle=C.paper;ctx.fillRect(0,0,L.W,L.H);ctx.restore();
    drawPlan();
    ctx.setTransform(k,0,0,k,0,0);
    // margins and title block over the edges of the drawing
    ctx.fillStyle=C.paper;ctx.fillRect(0,0,L.W,L.M);ctx.fillRect(0,L.H-L.M-L.TB,L.W,L.M+L.TB);ctx.fillRect(0,0,L.M,L.H);ctx.fillRect(L.W-L.M,0,L.M,L.H);
    ctx.strokeStyle=C.ink;ctx.lineWidth=1.2;ctx.strokeRect(L.M,L.M,L.W-2*L.M,L.H-2*L.M);
    if(o.title){const y=L.H-L.M-L.TB;ctx.beginPath();ctx.moveTo(L.M,y);ctx.lineTo(L.W-L.M,y);ctx.stroke();
      const mid=y+L.TB/2;txt(M.name||'Untitled project',[L.M+14,mid-9],{align:'left',size:18,weight:'600',color:C.ink});
      const d=new Date();txt('Floor plan  ·  '+d.toLocaleDateString(undefined,{year:'numeric',month:'long',day:'numeric'})+'  ·  '+o.paper,[L.M+14,mid+13],{align:'left',size:11.5,color:C.muted});
      const sc=L.den?'Scale 1:'+L.den+' at '+o.paper:'Not to scale (fitted to the sheet, about 1:'+Math.round(L.fitDen)+')';
      txt(sc,[L.W-L.M-14,mid-9],{align:'right',size:12,weight:'500',color:C.ink});
      // scale bar: a round length close to 40 mm on paper
      const target=40*96/25.4/L.s;const nice=[100,200,250,500,1000,2000,2500,5000,10000,20000,50000].reduce((a,b)=>Math.abs(b-target)<Math.abs(a-target)?b:a);
      const bw=nice*L.s,bx=L.W-L.M-14-bw,by=mid+10;ctx.fillStyle=C.ink;for(let i=0;i<4;i++){if(i%2===0)ctx.fillRect(bx+bw*i/4,by-3,bw/4,6);}ctx.strokeRect(bx,by-3,bw,6);
      txt('0',[bx,by+13],{size:10,color:C.muted});txt(fmtLen(nice,true),[bx+bw,by+13],{size:10,color:C.muted});
      txt('Benchmark Planner',[L.W/2,mid+13],{size:10,color:C.muted});}
    return {cv,L,k};
  }finally{EXP=null;ctx=keep.ctx;Object.assign(view,keep.view);sel=keep.sel;hover=keep.hover;drag=keep.drag;tool=keep.tool;refVisible=keep.refVisible;
    if(o.colors==='print'){if(keep.theme==null)document.documentElement.removeAttribute('data-theme');else document.documentElement.setAttribute('data-theme',keep.theme);readColors();}dirty();}}
function render3dImage(w,h,light){if(!three.ok)return null;const r=three.renderer,old=new THREE.Vector2();r.getSize(old);const pr=r.getPixelRatio();const theme=document.documentElement.getAttribute('data-theme'),orbit={theta:three.orbit.theta,phi:three.orbit.phi,r:three.orbit.r,target:three.orbit.target.clone()};
  try{three.exporting=true;if(light){skipTheme=true;document.documentElement.setAttribute('data-theme','light');readColors();}build3d();if(typeof frame3d==='function')frame3d();r.setPixelRatio(1);r.setSize(w,h,false);three.cam.aspect=w/h;three.cam.updateProjectionMatrix();three.scene.background=null;place3dCam();r.render(three.scene,three.cam);return r.domElement.toDataURL('image/jpeg',0.9);}
  catch(e){return null;}finally{three.exporting=false;Object.assign(three.orbit,orbit);if(walk.on&&!light)build3d();if(light){if(theme==null)document.documentElement.removeAttribute('data-theme');else document.documentElement.setAttribute('data-theme',theme);readColors();build3d();}r.setPixelRatio(pr);r.setSize(old.x,old.y,false);three.cam.aspect=old.x/Math.max(1,old.y);three.cam.updateProjectionMatrix();setTimeout(()=>{try{draw3d();}catch(e){}},0);}}
const canvasBytes=(cv,type,q)=>new Promise(res=>cv.toBlob(b=>b.arrayBuffer().then(a=>res(new Uint8Array(a))),type,q));
const dataUrlBytes=u=>{const s=atob(u.split(',')[1]);const b=new Uint8Array(s.length);for(let i=0;i<s.length;i++)b[i]=s.charCodeAt(i);return b;};
function jpegSize(b){for(let i=2;i<b.length-9;){if(b[i]!==0xFF){i++;continue;}const m=b[i+1],len=(b[i+2]<<8)|b[i+3];if(m>=0xC0&&m<=0xCF&&m!==0xC4&&m!==0xC8&&m!==0xCC)return [(b[i+7]<<8)|b[i+8],(b[i+5]<<8)|b[i+6]];i+=2+len;}return [0,0];}
// a small PDF writer: one JPEG image filling each page
function makePDF(pages,title){const enc=new TextEncoder(),parts=[],offs=[];let len=0;const push=x=>{const b=typeof x==='string'?enc.encode(x):x;parts.push(b);len+=b.length;};
  push('%PDF-1.4\n%\u00e2\u00e3\u00cf\u00d3\n');const n=pages.length,ids=pages.map((_,i)=>({page:4+3*i,cont:5+3*i,img:6+3*i}));
  const obj=(id,body)=>{offs[id]=len;push(id+' 0 obj\n');(Array.isArray(body)?body:[body]).forEach(push);push('\nendobj\n');};
  const esc=s=>String(s).replace(/[\\()]/g,m=>'\\'+m).replace(/[^\x20-\x7e]/g,'');
  obj(1,'<< /Type /Catalog /Pages 2 0 R >>');obj(2,'<< /Type /Pages /Kids ['+ids.map(x=>x.page+' 0 R').join(' ')+'] /Count '+n+' >>');
  const hex16=t=>'<FEFF'+Array.from(String(t)).map(ch=>{const c=ch.codePointAt(0);if(c>0xffff){const v=c-0x10000;return ((0xD800+(v>>10)).toString(16)+(0xDC00+(v&1023)).toString(16)).toUpperCase();}return c.toString(16).padStart(4,'0').toUpperCase();}).join('')+'>';
  obj(3,'<< /Title '+hex16(title)+' /Producer (Benchmark Planner) /CreationDate (D:'+new Date().toISOString().replace(/[-:T]/g,'').slice(0,14)+') >>');
  pages.forEach((p,i)=>{const I=ids[i],pw=+p.pw.toFixed(2),ph=+p.ph.toFixed(2),cs=`q ${pw} 0 0 ${ph} 0 0 cm /Im0 Do Q`;
    obj(I.page,`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pw} ${ph}] /Resources << /XObject << /Im0 ${I.img} 0 R >> >> /Contents ${I.cont} 0 R >>`);
    obj(I.cont,['<< /Length '+cs.length+' >>\nstream\n',cs,'\nendstream']);
    const [iw,ih]=jpegSize(p.jpeg);obj(I.img,[`<< /Type /XObject /Subtype /Image /Width ${iw} /Height ${ih} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.jpeg.length} >>\nstream\n`,p.jpeg,'\nendstream']);});
  const xref=len,total=4+3*n;push('xref\n0 '+total+'\n0000000000 65535 f \n');for(let i=1;i<total;i++)push(String(offs[i]).padStart(10,'0')+' 00000 n \n');
  push('trailer\n<< /Size '+total+' /Root 1 0 R /Info 3 0 R >>\nstartxref\n'+xref+'\n%%EOF\n');
  const out=new Uint8Array(len);let o=0;parts.forEach(b=>{out.set(b,o);o+=b.length;});return out;}
async function saveBinaryFile(name,bytes,mime,label,exts){
  if(NATIVE){const path=await TAURI.dialog.save({defaultPath:name,filters:[{name:label,extensions:exts}]});if(!path)return null;await TAURI.fs.writeFile(path,bytes);return path;}
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([bytes],{type:mime}));a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},2000);return name;}
function exportImageDialog(){
  if(!planBounds()){toast('There is nothing on the plan to export yet.');return;}
  const o=printOpts,body=document.createElement('div');body.className='imp printdlg';
  const opt=(v,l,cur)=>`<option value="${v}"${String(v)===String(cur)?' selected':''}>${l}</option>`;
  body.innerHTML=`<div class="impprev"><canvas id="prPrev" aria-label="Preview of the sheet"></canvas><p class="tip" id="prNote"></p></div>
    <div class="impside"><div class="kv">
      <label for="prFmt">Format</label><select id="prFmt">${opt('pdf','PDF document',o.fmt)}${opt('png','PNG image',o.fmt)}${opt('jpg','JPG image',o.fmt)}</select>
      <label for="prPaper">Paper</label><select id="prPaper">${Object.keys(PAPERS).map(k=>opt(k,k,o.paper)).join('')}</select>
      <label for="prOrient">Orientation</label><select id="prOrient">${opt('auto','Automatic',o.orient)}${opt('landscape','Landscape',o.orient)}${opt('portrait','Portrait',o.orient)}</select>
      <label for="prScale">Scale</label><select id="prScale">${opt('fit','Fit to the sheet',o.scale)}${PRINT_SCALES.map(d=>opt(d,'1:'+d,o.scale)).join('')}</select>
      <label for="prDpi">Quality</label><select id="prDpi">${opt(150,'Standard (150 dpi)',o.dpi)}${opt(200,'High (200 dpi)',o.dpi)}${opt(300,'Print (300 dpi)',o.dpi)}</select>
      <label for="prCol">Colours</label><select id="prCol">${opt('print','White paper',o.colors)}${opt('screen','As on screen',o.colors)}</select></div>
      <div class="checks"><label><input type="checkbox" id="prTitle"${o.title?' checked':''}> Title block with name, date, scale and scale bar</label>
        <label><input type="checkbox" id="prGrid"${o.grid?' checked':''}> Grid</label>
        ${refImage||refDrawing?`<label><input type="checkbox" id="prRef"${o.ref?' checked':''}> Imported picture or drawing</label>`:''}
        ${three.ok?`<label id="pr3dL"><input type="checkbox" id="pr3d"${o.view3d?' checked':''}> 3D view on a second page (PDF)</label>`:''}</div>
      <p class="tip">Measurements follow the <b>Measures</b> menu, so turn on or off what you want on the sheet first.</p></div>`;
  const read=()=>{o.fmt=$('#prFmt').value;o.paper=$('#prPaper').value;o.orient=$('#prOrient').value;o.scale=$('#prScale').value;o.dpi=+$('#prDpi').value;o.colors=$('#prCol').value;
    o.title=$('#prTitle').checked;o.grid=$('#prGrid').checked;o.ref=!!($('#prRef')&&$('#prRef').checked);o.view3d=!!($('#pr3d')&&$('#pr3d').checked);try{localStorage.setItem('bm-print',JSON.stringify(o));}catch(e){}};
  openModal('Export plan as PDF or image','Saves the plan on a sheet of paper, ready to print, email or put in a report.',null,
    [{label:'Cancel',fn:closeModal},{label:'Export',primary:true,fn:async btn=>{read();btn.disabled=true;btn.textContent='Preparing…';try{await doExportImage(o);}catch(err){toast('Export failed: '+(err.message||err));}closeModal();}}],body,true);
  const preview=()=>{read();const L=sheetLayout(o);const cv=$('#prPrev');if(!cv||!L)return;const r=cv.getBoundingClientRect(),dpr=window.devicePixelRatio||1;
    const sc=Math.min((r.width-16)/L.W,(r.height-16)/L.H);const res=renderSheet(o,sc*dpr);cv.width=r.width*dpr;cv.height=r.height*dpr;const g=cv.getContext('2d');g.fillStyle=getComputedStyle(cv).backgroundColor||'#ddd';g.fillRect(0,0,cv.width,cv.height);
    if(res){const w=L.W*sc*dpr,h=L.H*sc*dpr;g.shadowColor='rgba(0,0,0,.25)';g.shadowBlur=8;g.drawImage(res.cv,(cv.width-w)/2,(cv.height-h)/2,w,h);}
    const px=Math.round(L.W*Math.min(o.dpi/96,Math.sqrt(40e6/(L.W*L.H)))),py=Math.round(L.H*px/L.W);
    $('#prNote').innerHTML=(o.scale!=='fit'&&!L.fits?`<b style="color:var(--danger)">At 1:${o.scale} the plan does not fit on ${o.paper}.</b> Use 1:${L.best||'—'} or a larger sheet. `:o.scale==='fit'&&L.best?`Fits at 1:${L.best} on ${o.paper}. `:'')+`${o.fmt==='pdf'?'PDF':'Image'} ${px} × ${py} pixels.`;
    if($('#pr3dL'))$('#pr3dL').hidden=o.fmt!=='pdf';};
  body.querySelectorAll('select,input').forEach(e=>e.onchange=preview);requestAnimationFrame(preview);}
async function doExportImage(o){const res=renderSheet(o,o.dpi/96);if(!res)return;const base=safeName(M.name||'plan');
  if(o.fmt==='pdf'){const mmToPt=72/25.4;const pages=[{jpeg:await canvasBytes(res.cv,'image/jpeg',0.92),pw:res.L.W/96*72,ph:res.L.H/96*72}];
    if(o.view3d){const w=Math.round(res.cv.width),h=Math.round(res.cv.height);const u=render3dImage(Math.min(w,3200),Math.round(Math.min(w,3200)*h/w),o.colors==='print');if(u)pages.push({jpeg:dataUrlBytes(u),pw:res.L.W/96*72,ph:res.L.H/96*72});}
    const pdf=makePDF(pages,M.name||'Plan');const p=await saveBinaryFile(base+'.pdf',pdf,'application/pdf','PDF document',['pdf']);if(p)afterExport(p,base+'.pdf',pdf,'application/pdf');return;}
  const mime=o.fmt==='png'?'image/png':'image/jpeg',bytes=await canvasBytes(res.cv,mime,0.92),name=base+'.'+o.fmt;
  const p=await saveBinaryFile(name,bytes,mime,o.fmt.toUpperCase()+' image',[o.fmt]);if(p)afterExport(p,name,bytes,mime);}
function afterExport(p,name,bytes,mime){
  if(FRAMED&&!NATIVE){ // inside a preview frame downloads may be blocked: offer to open it instead
    const url=URL.createObjectURL(new Blob([bytes],{type:mime}));const b=document.createElement('div');b.innerHTML=mime.startsWith('image/')?`<img src="${url}" alt="Exported plan" style="max-width:100%;max-height:60vh;border:1px solid var(--line);border-radius:6px">`:'';
    openModal('Export ready',mime.startsWith('image/')?'If the download did not start, right-click the picture and choose Save image as.':'If the download did not start, open it and save it from the viewer.',null,[{label:'Open in a new tab',fn:()=>window.open(url,'_blank')},{label:'Close',primary:true,fn:closeModal}],b,true);return;}
  toast('Exported '+(NATIVE?baseName(p):name));}

/* ============================== export ============================== */
function exportDXF(){
  const def=units==='imperial'?'in':units;const body=document.createElement('div');body.className='expform';
  body.innerHTML=`<div class="kv"><label for="expUnit">Units</label><select id="expUnit">${Object.entries(EXPORT_UNITS).map(([k,u])=>`<option value="${k}"${k===def?' selected':''}>${u.label}</option>`).join('')}</select></div>
    <div class="checks"><label><input type="checkbox" id="expFix" checked> Fixtures</label><label><input type="checkbox" id="expLab" checked> Room names and areas</label>
      <label><input type="checkbox" id="expDim" checked> Outside dimensions</label>${refDrawing?'<label><input type="checkbox" id="expRef"> Reference drawing</label>':''}</div>`;
  openModal('Export to AutoCAD','Saves an AutoCAD R12 DXF, which every version of AutoCAD opens directly, as do BricsCAD, DraftSight, LibreCAD, ArchiCAD and Revit. Walls are drawn as clean outlines on layer A-WALL, with doors, windows, fixtures, labels and dimensions on their own layers.',null,
    [{label:'Cancel',fn:closeModal},{label:'Export DXF',primary:true,fn:async()=>{
      const opts={unit:$('#expUnit').value,fixtures:$('#expFix').checked,labels:$('#expLab').checked,dims:$('#expDim').checked,reference:!!($('#expRef')&&$('#expRef').checked)};
      const s=toDXF(opts);const fname=safeName(M.name)+'.dxf';
      if(NATIVE){closeModal();try{const p=await saveTextFile(fname,s,'AutoCAD DXF',['dxf']);if(p)toast('Exported '+baseName(p));}catch(err){toast('Could not save the DXF: '+err);}return;}
      if(!FRAMED){closeModal();browserDownload(fname,s);toast('Downloaded '+fname);return;}
      openModal('DXF ready','Copy this text into a file named '+fname+'. In the installed app it saves straight to a file.',s,[{label:'Close',fn:closeModal},{label:'Copy',primary:true,fn:b=>copyText(s,b)}]);}}],body);}

$('#importBtn').onclick=importDXF;$('#pdfBtn').onclick=exportImageDialog;$('#planImgBtn').onclick=importPlanImage;$('#dxfBtn').onclick=exportDXF;

/* ============================== 3D ============================== */
// Realistic look: physically based materials with textures drawn in code (no image files), sun and sky,
// soft shadows, sky reflections, ceilings and room lights at night. A Quality setting keeps phones smooth.
// Walk mode: an eye-level camera you walk through the rooms with; walls stop you, door openings let you through.
const three={ok:typeof THREE!=='undefined',exporting:false};let cutaway=false;
const Q3D={low:{label:'Low',pr:1,shadow:0,tex:256,bump:false,env:false,lights:4},medium:{label:'Medium',pr:1.5,shadow:1024,tex:512,bump:false,env:true,lights:8},high:{label:'High',pr:2,shadow:2048,tex:1024,bump:true,env:true,lights:12}};
// phone / tablet / computer: phones default to Low; later heavy features (photo render, detailed models) are for tablets and computers only
function deviceClass(){const coarse=matchMedia('(pointer:coarse)').matches,s=Math.min(screen.width,screen.height);return !coarse?'computer':s<600?'phone':'tablet';}
const autoQuality=()=>({phone:'low',tablet:'medium',computer:'high'})[deviceClass()];
let q3dPick='auto',night=false;try{q3dPick=localStorage.getItem('bm-q3d')||'auto';night=localStorage.getItem('bm-night')==='1';}catch(e){}
const q3dLevel=()=>Q3D[q3dPick]?q3dPick:autoQuality();
const q3d=()=>Q3D[q3dLevel()];
const walk={on:false,x:0,y:0,yaw:0,pitch:0,eye:1600,keys:new Set(),joy:null,raf:0,last:0,obs:[]};

// ---- textures drawn in code. Each covers `world` metres; UVs are in metres, so tiles and planks keep their real size.
function rng(seed){let a=seed>>>0;return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
const hashStr=s=>{let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;};
function hexRGB(h){const n=parseInt(h.slice(1),16);return[n>>16&255,n>>8&255,n&255];}
const rgbStr=(c,k=0)=>`rgb(${c.map(v=>Math.max(0,Math.min(255,Math.round(v+k)))).join(',')})`;
function noise(g,n,amt,R){const d=g.getImageData(0,0,n,n),p=d.data;for(let i=0;i<p.length;i+=4){const k=(R()-0.5)*amt;p[i]+=k;p[i+1]+=k;p[i+2]+=k;}g.putImageData(d,0,0);}
function tileGrid(g,n,R,cols,rows,base,grout,opt={}){const tw=n/cols,th=n/rows,gp=Math.max(1,n*(opt.gw||0.004));g.fillStyle=grout;g.fillRect(0,0,n,n);const c=hexRGB(base);
  for(let r=0;r<rows;r++){const off=opt.bond&&r%2?tw/2:0;for(let k=-1;k<=cols;k++){const x=k*tw+off;if(x>n||x+tw<0)continue;const v=(R()-0.5)*(opt.vary||10);
    g.fillStyle=rgbStr(c,v);g.fillRect(x+gp/2,r*th+gp/2,tw-gp,th-gp);if(opt.glaze){const gr=g.createLinearGradient(x,r*th,x+tw,r*th+th);gr.addColorStop(0,'rgba(255,255,255,.10)');gr.addColorStop(1,'rgba(0,0,0,.05)');g.fillStyle=gr;g.fillRect(x+gp/2,r*th+gp/2,tw-gp,th-gp);}}}}
function grain(g,x,y,w,h,R,col,count){g.save();g.beginPath();g.rect(x,y,w,h);g.clip();g.strokeStyle=col;for(let i=0;i<count;i++){const yy=y+R()*h,a=R()*h*0.04,f=2+R()*4;g.globalAlpha=0.08+R()*0.14;g.lineWidth=0.5+R()*1.4;g.beginPath();
  for(let s=0;s<=24;s++){const xx=x+w*s/24;const yv=yy+Math.sin(s/24*Math.PI*f+i)*a;s?g.lineTo(xx,yv):g.moveTo(xx,yv);}g.stroke();}g.restore();g.globalAlpha=1;}
const TEXDEF={
  plaster:{world:2,draw:(g,n,R)=>{g.fillStyle='#f1eee8';g.fillRect(0,0,n,n);noise(g,n,9,R);}},
  ceiling:{world:2,draw:(g,n,R)=>{g.fillStyle='#f6f5f2';g.fillRect(0,0,n,n);noise(g,n,5,R);}},
  wood:{world:1.2,draw:(g,n,R)=>{const cols=6,pw=n/cols,tones=['#b48a5e','#a87f55','#bf9668','#9f7650','#b8905f'];
    for(let c=0;c<cols;c++){let y=-R()*n;while(y<n){const L=n*(0.45+R()*0.55),t=tones[Math.floor(R()*tones.length)];g.fillStyle=t;g.fillRect(c*pw,y,pw,L);grain(g,c*pw,y,pw,L,R,'#5a3b22',26);
      g.fillStyle='rgba(40,25,12,.55)';g.fillRect(c*pw,y,pw,Math.max(1,n/600));y+=L;}g.fillStyle='rgba(40,25,12,.55)';g.fillRect(c*pw,0,Math.max(1,n/500),n);}
    // planks run along x in the room: rotate the drawing
    const cv=g.canvas,tmp=document.createElement('canvas');tmp.width=tmp.height=n;const t=tmp.getContext('2d');t.translate(n,0);t.rotate(Math.PI/2);t.drawImage(cv,0,0);g.clearRect(0,0,n,n);g.drawImage(tmp,0,0);noise(g,n,6,R);}},
  veneer:{world:1,draw:(g,n,R)=>{g.fillStyle='#c39b6c';g.fillRect(0,0,n,n);g.save();g.translate(n,0);g.rotate(Math.PI/2);grain(g,0,0,n,n,R,'#6b4527',90);g.restore();noise(g,n,5,R);}},
  tile600:{world:1.2,draw:(g,n,R)=>{tileGrid(g,n,R,2,2,'#d8d2c8','#b9b2a6',{vary:8,gw:0.004});noise(g,n,7,R);}},
  tile300:{world:0.6,draw:(g,n,R)=>{tileGrid(g,n,R,2,2,'#dfe4e4','#bfc6c6',{vary:6,gw:0.008,glaze:true});noise(g,n,4,R);}},
  walltile:{world:0.6,draw:(g,n,R)=>{tileGrid(g,n,R,2,2,'#eef1f0','#c9cfcd',{vary:5,gw:0.008,glaze:true});noise(g,n,3,R);}},
  subway:{world:0.6,draw:(g,n,R)=>{tileGrid(g,n,R,4,8,'#f2f2ee','#c8c6bf',{vary:6,gw:0.008,bond:true,glaze:true});noise(g,n,3,R);}},
  stone:{world:1.6,draw:(g,n,R)=>{tileGrid(g,n,R,2,2,'#cfc6b6','#a39a8a',{vary:14,gw:0.003});noise(g,n,16,R);for(let i=0;i<n*3;i++){g.fillStyle=R()<0.5?'rgba(90,80,70,.12)':'rgba(255,255,255,.12)';const s=1+R()*n/250;g.fillRect(R()*n,R()*n,s,s);}}},
  carpet:{world:0.5,draw:(g,n,R)=>{g.fillStyle='#a69c8f';g.fillRect(0,0,n,n);noise(g,n,30,R);}},
  concrete:{world:2,draw:(g,n,R)=>{g.fillStyle='#b9b8b3';g.fillRect(0,0,n,n);noise(g,n,14,R);for(let i=0;i<40;i++){const gr=g.createRadialGradient(R()*n,R()*n,0,R()*n,R()*n,n*0.2);gr.addColorStop(0,'rgba(120,118,112,.08)');gr.addColorStop(1,'rgba(120,118,112,0)');g.fillStyle=gr;g.fillRect(0,0,n,n);}}},
  worktop:{world:1,draw:(g,n,R)=>{g.fillStyle='#4c5154';g.fillRect(0,0,n,n);noise(g,n,18,R);for(let i=0;i<n*4;i++){g.fillStyle=['rgba(220,220,215,.35)','rgba(20,20,20,.4)','rgba(160,150,140,.3)'][Math.floor(R()*3)];const s=0.6+R()*n/400;g.fillRect(R()*n,R()*n,s,s);}}},
  grass:{world:2,draw:(g,n,R)=>{g.fillStyle='#4f7d2f';g.fillRect(0,0,n,n);noise(g,n,24,R);for(let i=0;i<n*6;i++){const x=R()*n,y=R()*n,l=n/120*(0.5+R());g.strokeStyle=['#46722a','#5f8f3a','#3c6424','#6b9a44'][Math.floor(R()*4)];g.globalAlpha=0.5;g.lineWidth=Math.max(1,n/700);g.beginPath();g.moveTo(x,y);g.lineTo(x+(R()-0.5)*l*0.6,y-l);g.stroke();}g.globalAlpha=1;}},
  paving:{world:1.6,draw:(g,n,R)=>{tileGrid(g,n,R,4,4,'#d6cfc2','#aaa292',{vary:16,gw:0.006,bond:true});noise(g,n,14,R);}},
  gravel:{world:0.6,draw:(g,n,R)=>{g.fillStyle='#bdb4a3';g.fillRect(0,0,n,n);for(let i=0;i<n*n/40;i++){const r=n/220*(0.6+R());g.fillStyle=rgbStr(hexRGB('#cfc6b5'),(R()-0.5)*70);g.beginPath();g.ellipse(R()*n,R()*n,r,r*0.7,R()*3,0,7);g.fill();}}},
  deck:{world:1.4,draw:(g,n,R)=>{const rows=10,h=n/rows;for(let r=0;r<rows;r++){g.fillStyle=rgbStr(hexRGB('#a8794c'),(R()-0.5)*26);g.fillRect(0,r*h,n,h);grain(g,0,r*h,n,h,R,'#5b3b20',10);g.fillStyle='rgba(30,18,8,.6)';g.fillRect(0,r*h,n,Math.max(1,h*0.08));}}},
  water:{world:3,draw:(g,n,R)=>{g.fillStyle='#4fa3c9';g.fillRect(0,0,n,n);for(let i=0;i<60;i++){g.strokeStyle='rgba(255,255,255,.12)';g.lineWidth=Math.max(1,n/400);g.beginPath();const y=R()*n;for(let s=0;s<=20;s++){const x=n*s/20;g.lineTo(x,y+Math.sin(s*0.9+i)*n/60);}g.stroke();}}},
  soil:{world:1,draw:(g,n,R)=>{g.fillStyle='#6e5240';g.fillRect(0,0,n,n);noise(g,n,30,R);}},
  stonewall:{world:1.2,draw:(g,n,R)=>{tileGrid(g,n,R,3,6,'#b9ad99','#8c8272',{vary:22,gw:0.012,bond:true});noise(g,n,18,R);}},
  hedge:{world:1,draw:(g,n,R)=>{g.fillStyle='#3f6a2e';g.fillRect(0,0,n,n);for(let i=0;i<n*n/90;i++){g.fillStyle=['#4f7f3a','#36602a','#5d8f43','#2f5424'][Math.floor(R()*4)];const r=n/90*(0.5+R());g.beginPath();g.ellipse(R()*n,R()*n,r,r*0.55,R()*3,0,7);g.fill();}}},
  fence:{world:1,draw:(g,n,R)=>{const cols=7,w=n/cols;for(let c=0;c<cols;c++){g.fillStyle=rgbStr(hexRGB('#9b6b43'),(R()-0.5)*24);g.fillRect(c*w,0,w,n);g.save();g.translate(c*w+w,0);g.rotate(Math.PI/2);grain(g,0,0,n,w,R,'#4d3019',8);g.restore();g.fillStyle='rgba(30,18,8,.6)';g.fillRect(c*w,0,Math.max(1,w*0.06),n);}}},
};
const TEXC={},MATC={};
function tex(kind){const L=q3dLevel(),k=kind+'@'+L;if(TEXC[k])return TEXC[k];const D=TEXDEF[kind],n=q3d().tex;const cv=document.createElement('canvas');cv.width=cv.height=n;const g=cv.getContext('2d');
  D.draw(g,n,rng(hashStr(kind)));const t=new THREE.CanvasTexture(cv);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(1/D.world,1/D.world);t.encoding=THREE.sRGBEncoding;
  t.anisotropy=Math.min(L==='low'?2:8,three.renderer.capabilities.getMaxAnisotropy());TEXC[k]=t;return t;}
// shared materials, made once per quality level
const MATDEF={
  plaster:{tex:'plaster',rough:0.92},ceiling:{tex:'ceiling',rough:0.95},
  wood:{tex:'wood',rough:0.55,bump:0.0012},tile600:{tex:'tile600',rough:0.35,bump:0.0015},tile300:{tex:'tile300',rough:0.25,bump:0.0015},stone:{tex:'stone',rough:0.6,bump:0.0015},
  carpet:{tex:'carpet',rough:1,bump:0.002},concrete:{tex:'concrete',rough:0.45},walltile:{tex:'walltile',rough:0.18,bump:0.001},subway:{tex:'subway',rough:0.15,bump:0.001},
  veneer:{tex:'veneer',rough:0.5},worktop:{tex:'worktop',rough:0.25,env:1.2},grass:{tex:'grass',rough:1},paving:{tex:'paving',rough:0.85,bump:0.002},gravel:{tex:'gravel',rough:1,bump:0.003},
  deck:{tex:'deck',rough:0.75,bump:0.0015},water:{tex:'water',rough:0.06,env:1.5},soil:{tex:'soil',rough:1},stonewall:{tex:'stonewall',rough:0.9,bump:0.003},hedge:{tex:'hedge',rough:1,bump:0.004},fence:{tex:'fence',rough:0.8},
  white:{col:0xf7f7f4,rough:0.18,env:1.1},satin:{col:0xe9e4da,rough:0.55},steel:{col:0xc4c8ca,rough:0.28,metal:0.85,env:1.4},dark:{col:0x2b2f31,rough:0.5},frame:{col:0x3a3f43,rough:0.4,metal:0.4},
  glass:{col:0xb9d6e2,rough:0.04,opacity:0.22,env:1.6},trim:{col:0xf3f1ec,rough:0.45},chrome:{col:0xdadde0,rough:0.12,metal:1,env:1.5},bulb:{col:0xfff3dc,emissive:0xffd9a0}};
function lmat(o){const c=new THREE.Color(o.col!=null?o.col:0xffffff);c.convertSRGBToLinear();const m=new THREE.MeshStandardMaterial({color:c,roughness:o.rough!=null?o.rough:0.85,metalness:(o.metal||0)*(q3d().env?1:0.3)});
  if(o.tex){m.map=tex(o.tex);if(o.bump&&q3d().bump){m.bumpMap=m.map;m.bumpScale=o.bump;}}
  if(o.opacity!=null){m.transparent=true;m.opacity=o.opacity;m.depthWrite=false;}if(o.env)m.envMapIntensity=o.env;
  if(o.emissive){m.emissive=new THREE.Color(o.emissive);m.emissiveIntensity=night?1.4:0.15;}return m;}
function M3(kind){const k=kind+'@'+q3dLevel()+(night?'n':'');if(!MATC[k])MATC[k]=lmat(MATDEF[kind]);return MATC[k];}
function clear3dCaches(){Object.values(MATC).forEach(m=>m.dispose());Object.values(TEXC).forEach(t=>t.dispose());for(const k in MATC)delete MATC[k];for(const k in TEXC)delete TEXC[k];}
// plain coloured materials (fixtures, outdoor items) — colours are given in sRGB
function mat(color,o={}){const c=new THREE.Color(color);c.convertSRGBToLinear();return new THREE.MeshStandardMaterial(Object.assign({roughness:0.85,metalness:0},o,{color:c}));}
// floor finish for a room (Room side panel → Floor in 3D)
const FLOORS={auto:'Automatic',wood:'Wood planks',tile600:'Large tiles 60×60',tile300:'Tiles 30×30',stone:'Stone',carpet:'Carpet',concrete:'Polished concrete'};
const autoFloor=t=>({kitchen:'tile600',bath:'tile300',living:'wood',bedroom:'wood',hall:'wood'})[t]||'tile600';
const floorOf=(type,pick)=>pick&&FLOORS[pick]&&pick!=='auto'?pick:autoFloor(type);
// box UVs in metres (u along the box's length, v up), with offsets so neighbouring pieces line up
function boxUV(geo,w,h,d,u0=0,v0=0){const uv=geo.attributes.uv;const F=[[d,h,0,v0],[d,h,0,v0],[w,d,u0,0],[w,d,u0,0],[w,h,u0,v0],[w,h,u0,v0]];
  for(let f=0;f<6;f++){const [su,sv,ou,ov]=F[f];for(let i=f*4;i<f*4+4;i++)uv.setXY(i,uv.getX(i)*su+ou,uv.getY(i)*sv+ov);}uv.needsUpdate=true;}

// ---- scene: renderer, sun, sky, reflections
function skyTexture(){const cv=document.createElement('canvas');cv.width=8;cv.height=256;const g=cv.getContext('2d');const gr=g.createLinearGradient(0,0,0,256);
  if(night){gr.addColorStop(0,'#05080f');gr.addColorStop(0.45,'#0e1726');gr.addColorStop(0.5,'#1b2636');gr.addColorStop(1,'#0b0d10');}
  else{gr.addColorStop(0,'#5d8fc4');gr.addColorStop(0.42,'#a9c7e2');gr.addColorStop(0.5,'#e4ecef');gr.addColorStop(0.52,'#cfd3cc');gr.addColorStop(1,'#8d8f86');}
  g.fillStyle=gr;g.fillRect(0,0,8,256);const t=new THREE.CanvasTexture(cv);t.encoding=THREE.sRGBEncoding;return t;}
function applyLook(){if(!three.ok)return;const Q=q3d(),r=three.renderer;
  r.shadowMap.enabled=Q.shadow>0;r.shadowMap.type=q3dLevel()==='high'?THREE.PCFSoftShadowMap:THREE.PCFShadowMap;
  const sun=three.sun;sun.castShadow=Q.shadow>0&&!night;if(Q.shadow){sun.shadow.mapSize.set(Q.shadow,Q.shadow);if(sun.shadow.map){sun.shadow.map.dispose();sun.shadow.map=null;}}
  sun.visible=!night;sun.intensity=1.9;three.hemi.intensity=night?0.16:(Q.env?0.5:1.0);three.hemi.color.set(night?0x5a5040:0xdde8f5);three.hemi.groundColor.set(night?0x101010:0x6b6252);
  if(three.sky.material.map)three.sky.material.map.dispose();three.sky.material.map=skyTexture();three.sky.material.needsUpdate=true;
  three.scene.fog.color.set(night?0x111a26:0xdfe7ea);
  if(three.scene.environment){three.scene.environment.dispose();three.scene.environment=null;}
  if(Q.env){const pm=new THREE.PMREMGenerator(r);const es=new THREE.Scene();const sk=new THREE.Mesh(new THREE.SphereGeometry(10,32,16),new THREE.MeshBasicMaterial({side:THREE.BackSide,map:skyTexture()}));es.add(sk);
    if(!night){const s=new THREE.Mesh(new THREE.SphereGeometry(0.9,16,8),new THREE.MeshBasicMaterial({color:0xfff2d8}));s.position.set(-4,7,-6);es.add(s);}
    three.scene.environment=pm.fromScene(es,0.04).texture;pm.dispose();sk.geometry.dispose();sk.material.map.dispose();}
  clear3dCaches();build3d();}
if(three.ok){
  const cv=$('#view3d');cv.tabIndex=0;three.renderer=new THREE.WebGLRenderer({canvas:cv,antialias:true,preserveDrawingBuffer:true});
  const r=three.renderer;r.outputEncoding=THREE.sRGBEncoding;r.toneMapping=THREE.ACESFilmicToneMapping;r.toneMappingExposure=0.92;
  three.scene=new THREE.Scene();three.cam=new THREE.PerspectiveCamera(40,1,0.1,600);three.scene.fog=new THREE.Fog(0xdfe7ea,60,260);
  three.hemi=new THREE.HemisphereLight(0xdde8f5,0x6b6252,0.45);three.scene.add(three.hemi);
  const sun=new THREE.DirectionalLight(0xfff1dc,1.9);sun.shadow.bias=-0.0004;sun.shadow.normalBias=0.02;
  ['left','bottom'].forEach(k=>sun.shadow.camera[k]=-14);['right','top'].forEach(k=>sun.shadow.camera[k]=14);sun.shadow.camera.far=60;
  three.sun=sun;three.scene.add(sun);three.scene.add(sun.target);
  three.sky=new THREE.Mesh(new THREE.SphereGeometry(400,32,16),new THREE.MeshBasicMaterial({side:THREE.BackSide,fog:false,depthWrite:false}));three.sky.renderOrder=-1;three.scene.add(three.sky);
  three.group=new THREE.Group();three.scene.add(three.group);
  three.orbit={theta:-0.75,phi:0.95,r:13,target:new THREE.Vector3(3.6,0,2.7)};
  let od=null;
  cv.addEventListener('contextmenu',e=>e.preventDefault());
  cv.addEventListener('pointerdown',e=>{cv.focus({preventScroll:true});od={x:e.clientX,y:e.clientY,pan:e.button!==0||e.shiftKey,id:e.pointerId,moved:0};cv.setPointerCapture(e.pointerId);});
  cv.addEventListener('pointermove',e=>{if(!od||e.pointerId!==od.id)return;const dx=e.clientX-od.x,dy=e.clientY-od.y;od.x=e.clientX;od.y=e.clientY;od.moved+=Math.abs(dx)+Math.abs(dy);
    if(walk.on){walk.yaw+=dx*0.0045;walk.pitch=clamp(walk.pitch-dy*0.0035,-1.2,1.2);draw3d();dirty();return;}
    const o=three.orbit;
    if(od.pan){const k=o.r*0.0016;const fw=new THREE.Vector3(Math.sin(o.theta),0,Math.cos(o.theta));const rt=new THREE.Vector3(Math.cos(o.theta),0,-Math.sin(o.theta));
      o.target.addScaledVector(rt,-dx*k).addScaledVector(fw,-dy*k);}else{o.theta-=dx*0.006;o.phi=clamp(o.phi-dy*0.006,0.12,1.52);}draw3d();});
  const up=()=>{od=null;};cv.addEventListener('pointerup',up);cv.addEventListener('pointercancel',up);
  cv.addEventListener('wheel',e=>{e.preventDefault();if(walk.on){walkMove(-Math.sign(e.deltaY)*300,0);draw3d();dirty();return;}const o=three.orbit;o.r=clamp(o.r*Math.exp(e.deltaY*(e.ctrlKey?0.01:0.0012)),2,80);draw3d();},{passive:false});
  // double-click a floor to walk in from there
  cv.addEventListener('dblclick',e=>{if(walk.on)return;const rc=cv.getBoundingClientRect();const v=new THREE.Vector2((e.clientX-rc.left)/rc.width*2-1,-(e.clientY-rc.top)/rc.height*2+1);
    const ray=new THREE.Raycaster();ray.setFromCamera(v,three.cam);const p=new THREE.Vector3();if(ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),0),p))walkStart([p.x*1000,p.z*1000]);});
  cv.addEventListener('keydown',walkKey);cv.addEventListener('keyup',e=>{walk.keys.delete(e.key.toLowerCase());});cv.addEventListener('blur',()=>walk.keys.clear());
  r.setPixelRatio(Math.min(window.devicePixelRatio||1,q3d().pr));
}
let rebuildTimer=null;function schedule3d(){clearTimeout(rebuildTimer);rebuildTimer=setTimeout(build3d,60);}
function build3d(){
  if(!three.ok)return;const g=three.group;while(g.children.length){const c=g.children.pop();c.geometry&&c.geometry.dispose();}
  const S=0.001,inside=walk.on&&!three.exporting,cut=cutaway&&!inside;const wallMat=M3('plaster'),capMat=mat(0x3a4246);
  const box=(w,h,d,m,x,y,z,ry=0,u0=0,v0=0)=>{const geo=new THREE.BoxGeometry(Math.max(w,1)*S,Math.max(h,1)*S,Math.max(d,1)*S);boxUV(geo,Math.max(w,1)*S,Math.max(h,1)*S,Math.max(d,1)*S,u0*S,v0*S);
    const mesh=new THREE.Mesh(geo,m);mesh.position.set(x*S,y*S,z*S);mesh.rotation.y=ry;mesh.castShadow=true;mesh.receiveShadow=true;g.add(mesh);return mesh;};
  // a flat quad from four plan-space corners (mm) at heights (mm); uv in metres
  const quad=(pts,uvs,m,face)=>{const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pts.flatMap(p=>[p[0]*S,p[1]*S,p[2]*S]),3));
    geo.setAttribute('uv',new THREE.Float32BufferAttribute(uvs.flat(),2));const a=new THREE.Vector3(...pts[0]),b=new THREE.Vector3(...pts[1]),c=new THREE.Vector3(...pts[2]);
    const n=b.clone().sub(a).cross(c.clone().sub(a));geo.setIndex(n.dot(new THREE.Vector3(face[0],face[1],face[2]))>=0?[0,1,2,0,2,3]:[0,2,1,0,3,2]);geo.computeVertexNormals();
    const mesh=new THREE.Mesh(geo,m);mesh.receiveShadow=true;g.add(mesh);return mesh;};
  const capH=w=>cut?Math.min(1200,w.h):w.h;
  M.walls.forEach(w=>{const d=wallDir(w),ext=wallExt(w),ry=-Math.atan2(d[1],d[0]),H=capH(w);
    const seg=(s0,s1,z0,z1,m)=>{if(s1-s0<1||z1-z0<1)return;const c=add(w.a,mul(d,(s0+s1)/2));box(s1-s0,z1-z0,w.t,m,c[0],(z0+z1)/2,c[1],ry,s0,z0);};
    const wm=w.kind?yardWallMat(w.kind):wallMat;wallPieces(w,ext).forEach(([a,b])=>seg(a,b,0,H,wm));
    M.openings.filter(o=>o.wall===w.id).forEach(o=>{const a=o.s-o.w/2,b=o.s+o.w/2;seg(a,b,0,Math.min(o.sill,H),wm);if(!w.kind)seg(a,b,Math.min(o.sill+o.h,H),H,wm);
      const n=perp(d),c0=add(w.a,mul(d,o.s));
      if(o.kind==='window'&&o.sill<H){const top=Math.min(o.sill+o.h,H),fw=55,fd=Math.min(80,w.t);
        box(o.w-2*fw,top-o.sill-2*fw,8,M3('glass'),c0[0],(o.sill+top)/2,c0[1],ry).castShadow=false;
        [[a+fw/2,fw],[b-fw/2,fw]].forEach(([s])=>{const c=add(w.a,mul(d,s));box(fw,top-o.sill,fd,M3('frame'),c[0],(o.sill+top)/2,c[1],ry);});
        [o.sill+fw/2,top-fw/2].forEach(z=>box(o.w,fw,fd,M3('frame'),c0[0],z,c0[1],ry));
        if(o.w>1100)box(fw*0.8,top-o.sill,fd*0.8,M3('frame'),c0[0],(o.sill+top)/2,c0[1],ry);
        if(!w.kind&&o.sill>0)box(o.w+60,25,w.t+50,M3('trim'),c0[0],o.sill-12,c0[1],ry).castShadow=false;}
      if(o.kind==='door'&&!w.kind){const lh=Math.min(o.h,H),jw=30,jd=w.t+24;   // door frame: two jambs and a head, standing a little proud of the wall
        [a+jw/2,b-jw/2].forEach(s=>{const c=add(w.a,mul(d,s));box(jw,lh,jd,M3('trim'),c[0],lh/2,c[1],ry);});box(o.w,6,w.t,M3('stone'),c0[0],3,c0[1],ry).castShadow=false;if(lh<H)box(o.w,40,jd,M3('trim'),c0[0],lh+20,c0[1],ry);}
      if(isSliding(o)){const {pt,list}=slidePanels(o,w),lh=Math.min(o.h,H);list.forEach(P=>{const cc=add(c0,add(mul(d,(P.s0+P.s1)/2),mul(n,P.off))),pw=P.s1-P.s0;
          box(pw,lh-10,pt,M3('frame'),cc[0],lh/2,cc[1],ry);box(Math.max(10,pw-120),lh-180,pt+4,M3('glass'),cc[0],lh/2,cc[1],ry).castShadow=false;});}
      else if(o.kind==='door'){const sn=o.flip?-1:1,hj=add(w.a,mul(d,o.hinge?b:a));const H0=add(hj,mul(n,sn*w.t/2));
        const closed=o.hinge?mul(d,-1):d;const ang=sn*(o.hinge?-1:1)*88*Math.PI/180;const dir=rotV(closed,ang*180/Math.PI);const lh=Math.min(o.h,H)-10,lw=o.w-50,rr=-Math.atan2(dir[1],dir[0]);
        const c=add(H0,mul(dir,lw/2+25));box(lw,lh,40,w.kind?M3('fence'):M3('veneer'),c[0],lh/2,c[1],rr);
        if(!w.kind){const nn=perp(dir);[1,-1].forEach(k=>{const hp=add(add(H0,mul(dir,lw-50)),mul(nn,k*45));box(130,22,22,M3('chrome'),hp[0],1000,hp[1],rr).castShadow=false;});}}});
    if(cut){wallPieces(w,ext).forEach(([a,b])=>{const cc=add(w.a,mul(d,(a+b)/2));const m=box(b-a,6,w.t,capMat,cc[0],H+3,cc[1],ry);m.castShadow=false;});}});
  // floors, wall tiles, skirting, ceilings and room lights
  let nl=0;
  rooms.forEach(r=>{const shape=new THREE.Shape(r.net.map(p=>new THREE.Vector2(p[0]*S,p[1]*S)));const geo=new THREE.ShapeGeometry(shape);
    const fm=floorOf(r.type,r.meta&&r.meta.floor);const m=new THREE.Mesh(geo,M3(fm));m.material.side=THREE.DoubleSide;m.rotation.x=Math.PI/2;m.position.y=0.002;m.receiveShadow=true;g.add(m);
    let Hc=0;(r.elevs||[]).forEach(e=>{Hc=Math.max(Hc,e.H);if(e.curved||!e.left)return;const at=(x,off)=>add(add(e.left,mul(e.right,x)),mul(e.nIn,off));const f3=[e.nIn[0],0,e.nIn[1]];
      const tm=M3(r.tileMode==='splash'?'subway':'walltile');
      (e.tiles||[]).forEach(t=>{const z1=cut?Math.min(t.z1,1200):t.z1;if(z1-t.z0<5)return;const A=at(t.x0,3),B=at(t.x1,3);
        quad([[A[0],t.z0,A[1]],[B[0],t.z0,B[1]],[B[0],z1,B[1]],[A[0],z1,A[1]]],[[t.x0/1000,t.z0/1000],[t.x1/1000,t.z0/1000],[t.x1/1000,z1/1000],[t.x0/1000,z1/1000]],tm,f3);});
      // skirting: along the face, except across doors and floor-level openings
      let iv=[[0,e.L]];(e.ops||[]).forEach(({o,x0,x1})=>{if(o.sill<90)iv=cutIv(iv,x0,x1);});
      if(r.tileMode!=='full')iv.forEach(([x0,x1])=>{if(x1-x0<40)return;const c=at((x0+x1)/2,7);const rr=-Math.atan2(e.right[1],e.right[0]);box(x1-x0,80,14,M3('trim'),c[0],40,c[1],rr).castShadow=false;});});
    if(inside&&Hc>0){const cg=new THREE.ShapeGeometry(shape);const cm=new THREE.Mesh(cg,M3('ceiling'));cm.material.side=THREE.DoubleSide;cm.rotation.x=Math.PI/2;cm.position.y=Hc*S-0.001;cm.castShadow=true;cm.receiveShadow=true;g.add(cm);}
    if(night&&nl<q3d().lights){nl++;const c=r.centroid,h=(Hc||2700);const bulb=new THREE.Mesh(new THREE.CylinderGeometry(0.16,0.16,0.03,20),M3('bulb'));bulb.position.set(c[0]*S,h*S-0.02,c[1]*S);g.add(bulb);
      const size=Math.sqrt(Math.max(r.netArea||4e6,1e6))/1000;const L=new THREE.PointLight(0xffd6a0,1.6,size*2.2+3,2);L.position.set(c[0]*S,h*S-0.25,c[1]*S);g.add(L);}});
  M.items.forEach(it=>{const ry=-it.r*Math.PI/180;const P=(lx,ly)=>add([it.x,it.y],rotV([lx,ly],it.r));
    const part=(lx,ly,w,d,z0,h,m)=>{const c=P(lx,ly);return box(w,h,d,m,c[0],z0+h/2,c[1],ry);};
    const white=M3('white'),carc=M3('satin'),top=M3('worktop'),steel=M3('steel'),dark=M3('dark');
    const t=it.type;
    if(CAT[t]&&CAT[t].group==='Outdoor'){build3dOutdoor(it,g,box,S);return;}
    if(COUNTER.has(t)){part(0,10,it.w-4,it.d-20,it.z+100,it.h-140,t==='dishwasher'?steel:carc);part(0,15,it.w,it.d-10,it.z,100,dark);part(0,10,it.w,it.d+20,it.z+it.h-40,40,top);
      if(t!=='dishwasher')part(0,it.d/2+1,it.w-8,4,it.z+it.h-110,8,steel);   // handle line
      if(t==='sinkbase'){part(0,-20,Math.min(it.w-150,500),it.d*0.6,it.z+it.h-30,32,steel);const tc=P(0,-it.d*0.38);const tap=new THREE.Mesh(new THREE.CylinderGeometry(0.014,0.018,0.28,12),M3('chrome'));tap.position.set(tc[0]*S,(it.z+it.h+140)*S,tc[1]*S);tap.castShadow=true;g.add(tap);}}
    else if(t==='range'){part(0,0,it.w-4,it.d,it.z,it.h-30,steel);part(0,0,it.w,it.d,it.z+it.h-30,30,dark);}
    else if(t==='fridge'){part(0,0,it.w-4,it.d,it.z,it.h,steel);}
    else if(t==='tall'||t==='wallcab'){part(0,0,it.w-4,it.d,it.z,it.h,carc);}
    else if(t==='toilet'){part(0,-it.d/2+85,it.w,170,it.z+400,380,white);const c=P(0,(it.d-170)*0.15+60);const cyl=new THREE.Mesh(new THREE.CylinderGeometry(it.w*0.45*S,it.w*0.35*S,0.42,24),white);cyl.scale.z=1.35;cyl.position.set(c[0]*S,0.21,c[1]*S);cyl.rotation.y=ry;cyl.castShadow=true;g.add(cyl);}
    else if(t==='vanity'){part(0,0,it.w,it.d,it.z,it.h-30,carc);part(0,0,it.w,it.d,it.z+it.h-30,30,white);}
    else if(t==='tub'){part(0,0,it.w,it.d,it.z,it.h,white);part(0,0,it.w-140,it.d-140,it.z+it.h-2,4,mat(0xdfe8ea,{roughness:0.15}));}
    else if(t==='shower'){part(0,0,it.w,it.d,it.z,60,white);const gl=part(0,0,it.w,it.d,it.z+60,1900,M3('glass'));gl.castShadow=false;}
    else part(0,0,it.w,it.d,it.z,it.h,carc);});
  surfaces3d(g,S);
  const colMat=mat(0xe2dcd2,{roughness:0.75});
  (M.cols||[]).forEach(c=>{const H=cut?Math.min(1200,colH(c)):colH(c);
    if(c.shape==='round'){const m=new THREE.Mesh(new THREE.CylinderGeometry(c.w/2*S,c.w/2*S,H*S,32),colMat);m.position.set(c.x*S,H/2*S,c.y*S);m.castShadow=true;m.receiveShadow=true;g.add(m);}
    else box(c.w,H,c.d,colMat,c.x,H/2,c.y,-c.r*Math.PI/180);});
  // ground
  const gm=M3('grass');gm.polygonOffset=true;gm.polygonOffsetFactor=4;gm.polygonOffsetUnits=4;const gr=new THREE.Mesh(new THREE.PlaneGeometry(400,400),gm);gr.rotation.x=-Math.PI/2;gr.position.y=-0.02;gr.receiveShadow=true;
  const uv=gr.geometry.attributes.uv;for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*400,uv.getY(i)*400);g.add(gr);
  if(walk.on){walk.obs=walkObstacles();syncWalkUI();}
  draw3d();}
function frame3d(){if(!three.ok)return;let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;M.walls.forEach(w=>[w.a,w.b].forEach(p=>{x0=Math.min(x0,p[0]);y0=Math.min(y0,p[1]);x1=Math.max(x1,p[0]);y1=Math.max(y1,p[1]);}));
  if(x0>x1)return;three.orbit.target.set((x0+x1)/2000,0.6,(y0+y1)/2000);three.orbit.r=Math.max(x1-x0,y1-y0)/1000*2.4+4;three.orbit.phi=0.85;}
function place3dCam(){const c=three.cam;let tgt;
  if(walk.on&&!three.exporting){c.fov=c.aspect>=1?68:Math.min(100,2*Math.atan(Math.tan(78*Math.PI/360)/c.aspect)*180/Math.PI);c.position.set(walk.x/1000,walk.eye/1000,walk.y/1000);const cp=Math.cos(walk.pitch);c.lookAt(c.position.x+Math.cos(walk.yaw)*cp,c.position.y+Math.sin(walk.pitch),c.position.z+Math.sin(walk.yaw)*cp);tgt=new THREE.Vector3(walk.x/1000,0,walk.y/1000);}
  else{c.fov=40;const o=three.orbit;c.position.set(o.target.x+o.r*Math.sin(o.phi)*Math.sin(o.theta),o.target.y+o.r*Math.cos(o.phi),o.target.z+o.r*Math.sin(o.phi)*Math.cos(o.theta));c.lookAt(o.target);tgt=o.target;}
  c.updateProjectionMatrix();three.sun.position.set(tgt.x-6,14,tgt.z-9);three.sun.target.position.copy(tgt);three.sky.position.copy(c.position);}
function draw3d(){if(!three.ok)return;const cv=$('#view3d');if(!cv.offsetParent)return;const r=cv.getBoundingClientRect();if(!r.width)return;
  three.renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,q3d().pr));three.renderer.setSize(r.width,r.height,false);three.cam.aspect=r.width/r.height;
  three.scene.background=null;place3dCam();three.renderer.render(three.scene,three.cam);}

// ---- walking
// obstacles in plan space (mm): oriented boxes {c,u,hw,hd} and circles {c,r}
function walkObstacles(){const ob=[];
  M.walls.forEach(w=>{const d=wallDir(w),L=wallLen(w);let iv=[[0,L]];M.openings.forEach(o=>{if(o.wall===w.id&&o.kind==='door')iv=cutIv(iv,o.s-o.w/2+20,o.s+o.w/2-20);});
    iv.forEach(([a,b])=>{if(b-a<1)return;ob.push({c:add(w.a,mul(d,(a+b)/2)),u:d,hw:(b-a)/2,hd:w.t/2});});
    // open swing door leaves (drawn open at 88°)
    M.openings.forEach(o=>{if(o.wall!==w.id||o.kind!=='door'||isSliding(o))return;const a=o.s-o.w/2,b=o.s+o.w/2,n=perp(d),sn=o.flip?-1:1,H0=add(add(w.a,mul(d,o.hinge?b:a)),mul(n,sn*w.t/2));
      const dir=rotV(o.hinge?mul(d,-1):d,sn*(o.hinge?-1:1)*88),lw=o.w-50;ob.push({c:add(H0,mul(dir,lw/2+25)),u:dir,hw:lw/2,hd:22});});});
  (M.cols||[]).forEach(c=>{if(c.shape==='round')ob.push({c:[c.x,c.y],r:c.w/2});else ob.push({c:[c.x,c.y],u:rotV([1,0],c.r||0),hw:c.w/2,hd:c.d/2});});
  M.items.forEach(it=>{const t=it.type,cat=CAT[t]||{};if(it.z>1700||it.h<300||['light','umbrella','pergola','swing','dining'].includes(t))return;
    if(t==='tree'||t==='palm'){ob.push({c:[it.x,it.y],r:180});return;}
    if(cat.round&&!(t==='firepit'&&it.shape==='rect')){ob.push({c:[it.x,it.y],r:Math.min(it.w,it.d)/2});return;}
    ob.push({c:[it.x,it.y],u:rotV([1,0],it.r),hw:it.w/2,hd:it.d/2});});
  return ob;}
function walkResolve(p,R=230){for(let it=0;it<4;it++){let moved=false;for(const o of walk.obs){let q;
      if(o.r!=null){q=o.c;const v=sub(p,q),dd=vlen(v),need=o.r+R;if(dd<need){const n=dd>1e-6?mul(v,1/dd):[1,0];p=add(q,mul(n,need));moved=true;}continue;}
      const v=sub(p,o.c),n=[-o.u[1],o.u[0]],lx=dot(v,o.u),ly=dot(v,n);const cx=clamp(lx,-o.hw,o.hw),cy=clamp(ly,-o.hd,o.hd);
      const dx=lx-cx,dy=ly-cy,dd=Math.hypot(dx,dy);
      if(dd<R){let nx,ny,push;if(dd>1e-6){nx=dx/dd;ny=dy/dd;push=R-dd;}else{const ex=o.hw-Math.abs(lx),ey=o.hd-Math.abs(ly);if(ex<ey){nx=Math.sign(lx)||1;ny=0;push=ex+R;}else{nx=0;ny=Math.sign(ly)||1;push=ey+R;}}
        p=add(p,add(mul(o.u,nx*push),mul(n,ny*push)));moved=true;}}if(!moved)break;}return p;}
function walkMove(fwd,side){const f=[Math.cos(walk.yaw),Math.sin(walk.yaw)],s=[-f[1],f[0]];const mv=add(mul(f,fwd),mul(s,side));const L=vlen(mv);if(L<0.01)return;
  const steps=Math.ceil(L/80);let p=[walk.x,walk.y];for(let i=0;i<steps;i++)p=walkResolve(add(p,mul(mv,1/steps)));walk.x=p[0];walk.y=p[1];}
function walkFreeDist(p,a,poly){let d=0;const v=[Math.cos(a),Math.sin(a)];while(d<15000){const q=add(p,mul(v,d+100));if(poly&&!pointInPoly(q,poly))break;const r=walkResolve(q.slice(),1);if(dist(r,q)>0.5)break;d+=100;}return d;}
function roomAt(p){return rooms.find(r=>pointInPoly(p,r.net));}
function walkStart(at,room){if(!three.ok)return;if(!$('#view3d').offsetParent)setView('3d');walk.obs=walkObstacles();
  let p=at;if(!p){const r=room||roomAt([three.orbit.target.x*1000,three.orbit.target.z*1000])||rooms.slice().sort((a,b)=>(b.netArea||0)-(a.netArea||0))[0];p=r?r.centroid.slice():[three.orbit.target.x*1000,three.orbit.target.z*1000];}
  p=walkResolve(p.slice());const rm=roomAt(p),poly=rm&&rm.net;walk.pitch=-0.08;
  // look across the room along its longest clear line, standing back near the wall behind you
  let best=0,bd=-1;for(let k=0;k<24;k++){const a=k/24*Math.PI*2,d=walkFreeDist(p,a,poly)+walkFreeDist(p,a+Math.PI,poly);if(d>bd){bd=d;best=a;}}
  if(walkFreeDist(p,best+Math.PI,poly)>walkFreeDist(p,best,poly))best+=Math.PI;
  const back=walkFreeDist(p,best+Math.PI,poly);if(!at&&back>500)p=walkResolve(add(p,mul([Math.cos(best+Math.PI),Math.sin(best+Math.PI)],back-450)));
  walk.x=p[0];walk.y=p[1];walk.yaw=best;
  walk.on=true;$('#stage').classList.add('walking');syncWalkUI();build3d();$('#view3d').focus({preventScroll:true});dirty();}
function walkStop(){if(!walk.on)return;walk.on=false;walk.keys.clear();walk.joy=null;cancelAnimationFrame(walk.raf);walk.raf=0;$('#stage').classList.remove('walking');
  three.orbit.target.set(walk.x/1000,0.6,walk.y/1000);syncWalkUI();build3d();dirty();}
const WALK_KEYS=new Set(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright','shift','q','e']);
function walkKey(e){if(!walk.on)return;const k=e.key.toLowerCase();if(k==='escape'){e.preventDefault();e.stopPropagation();walkStop();return;}
  if(WALK_KEYS.has(k)){e.preventDefault();e.stopPropagation();walk.keys.add(k);walkTickStart();}else if(!e.ctrlKey&&!e.metaKey)e.stopPropagation();}
function walkTickStart(){if(walk.raf)return;walk.last=performance.now();walk.raf=requestAnimationFrame(walkTick);}
function walkTick(now){const dt=Math.min(0.1,(now-walk.last)/1000);walk.last=now;const K=walk.keys;let f=0,s=0,turn=0;
  if(K.has('w')||K.has('arrowup'))f+=1;if(K.has('s')||K.has('arrowdown'))f-=1;if(K.has('a'))s-=1;if(K.has('d'))s+=1;if(K.has('arrowleft')||K.has('q'))turn-=1;if(K.has('arrowright')||K.has('e'))turn+=1;
  if(walk.joy){f-=walk.joy.y;s+=walk.joy.x;}
  const sp=(K.has('shift')?3000:1400)*dt;if(f||s){const n=Math.max(1,Math.hypot(f,s));walkMove(f/n*sp*Math.min(1,Math.hypot(f,s)),s/n*sp*Math.min(1,Math.hypot(f,s)));}
  if(turn)walk.yaw+=turn*1.8*dt;
  if(f||s||turn){draw3d();dirty();syncWalkRoom();}
  if(walk.on&&(K.size||walk.joy))walk.raf=requestAnimationFrame(walkTick);else walk.raf=0;}
function syncWalkRoom(){const sel=$('#walkRoom');if(!sel)return;const r=roomAt([walk.x,walk.y]);const v=r?String(rooms.indexOf(r)):'';if(sel.value!==v)sel.value=v;}
function syncWalkUI(){const on=walk.on;$('#walkOff').setAttribute('aria-pressed',String(!on));$('#walkOn').setAttribute('aria-pressed',String(on));$('#cutSeg').hidden=on;$('#walkHud').hidden=!on;
  const sel=$('#walkRoom');sel.innerHTML='<option value="">Go to room…</option>'+rooms.map((r,i)=>`<option value="${i}">${esc(r.name||'Room')}</option>`).join('');syncWalkRoom();
  $('#walkJoy').hidden=!(on&&matchMedia('(pointer:coarse)').matches);}
function drawWalkMark(){if(!walk.on)return;const s=toS([walk.x,walk.y]),col=C.accent||'#1f6feb',L=Math.max(26,900*view.s);ctx.save();ctx.fillStyle=col;ctx.strokeStyle=col;
  const fov=0.6;ctx.globalAlpha=0.18;ctx.beginPath();ctx.moveTo(s[0],s[1]);ctx.arc(s[0],s[1],L,walk.yaw-fov,walk.yaw+fov);ctx.closePath();ctx.fill();ctx.globalAlpha=1;
  ctx.beginPath();ctx.arc(s[0],s[1],6,0,Math.PI*2);ctx.fill();ctx.lineWidth=2;ctx.strokeStyle='#fff';ctx.stroke();ctx.restore();}
function setQuality(q){q3dPick=q;try{localStorage.setItem('bm-q3d',q);}catch(e){}renderLookMenu();applyLook();}
function setNight(n){night=n;try{localStorage.setItem('bm-night',n?'1':'0');}catch(e){}renderLookMenu();applyLook();}
function renderLookMenu(){const m=$('#lookMenu');if(!m)return;const auto=Q3D[autoQuality()].label;
  m.innerHTML=`<p class="mh">Quality</p>${[['auto','Automatic ('+auto+')'],['low','Low — fastest, for phones'],['medium','Medium — tablets'],['high','High — computers']].map(([k,l])=>`<button role="menuitemradio" aria-checked="${q3dPick===k}" data-q="${k}">${l}</button>`).join('')}
    <p class="mh">Light</p><button role="menuitemradio" aria-checked="${!night}" data-n="0">Day — sunlight</button><button role="menuitemradio" aria-checked="${night}" data-n="1">Night — room lights on</button>`;
  m.querySelectorAll('[data-q]').forEach(b=>b.onclick=()=>setQuality(b.dataset.q));m.querySelectorAll('[data-n]').forEach(b=>b.onclick=()=>setNight(b.dataset.n==='1'));}

/* ============================== wiring ============================== */
function changed(){if(typeof checkRefLeftover==='function'&&(refImage||refDrawing))checkRefLeftover();if(!Array.isArray(M.arcs))M.arcs=[];if(!Array.isArray(M.areas))M.areas=[];if(!Array.isArray(M.texts))M.texts=[];if(!Array.isArray(M.dims))M.dims=[];if(!Array.isArray(M.cols))M.cols=[];
  if(M.cols.some(c=>c.wall!=null)){syncHostedCols();M.cols.forEach(c=>{delete c.wall;delete c.s;delete c.off;});}clampOpenings();rooms=computeRooms();fillElevSelect();renderInspector();renderTakeoff();schedule3d();dirty();
  $('#undoBtn').disabled=!undoStack.length;$('#redoBtn').disabled=!redoStack.length;save();}
function setView(v){$('#stage').dataset.view=v;['vPlan','vSplit','vElev','v3d'].forEach(id=>{const b=$('#'+id);b.setAttribute('aria-pressed',String(b.dataset.view===v));});
  requestAnimationFrame(()=>{dirty();draw3d();});}
function setUnits(u){units=normUnits(u);document.querySelectorAll('#unitSeg button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.units===units)));renderInspector();renderTakeoff();dirty();save();
  document.querySelectorAll('.lib button[data-type]').forEach(b=>{const c=CAT[b.dataset.type];b.querySelector('.libw').textContent=fmtLen(c.w);b.title=c.label+': '+[c.w,c.d,c.h].map(v=>fmtLen(v,true)).join(' × ');});}
function setFree(v,quiet){freeMove=!!v;$('#freeToggle').setAttribute('aria-pressed',String(freeMove));renderInspector();dirty();save();
  if(!quiet&&tool==='select'){$('#snapchip').textContent=freeMove?'free move on':'push / pull';clearTimeout(setFree.t);setFree.t=setTimeout(()=>$('#snapchip').textContent='',1400);}}
$('#freeToggle').onclick=()=>setFree(!freeMove);
function setSnap(v){snapOn=!!v;$('#snapToggle').setAttribute('aria-pressed',String(snapOn));$('#snapToggle').textContent=snapOn?'Snap on':'Snap off';snapInfo=null;dirty();save();}
function setEmptyDrag(v){emptyDrag=v;$('#dragBox').setAttribute('aria-pressed',String(v==='box'));$('#dragPan').setAttribute('aria-pressed',String(v==='pan'));}
$('#snapToggle').onclick=()=>setSnap(!snapOn);$('#dragBox').onclick=()=>setEmptyDrag('box');$('#dragPan').onclick=()=>setEmptyDrag('pan');
function setCut(c){cutaway=c;$('#cutOn').setAttribute('aria-pressed',String(c));$('#cutOff').setAttribute('aria-pressed',String(!c));build3d();}
['vPlan','vSplit','vElev','v3d'].forEach(id=>$('#'+id).onclick=e=>setView(e.currentTarget.dataset.view));
document.querySelectorAll('#unitSeg button').forEach(b=>b.onclick=()=>setUnits(b.dataset.units));
$('#cutOn').onclick=()=>setCut(true);$('#cutOff').onclick=()=>setCut(false);
$('#walkOn').onclick=()=>walkStart();$('#walkOff').onclick=()=>walkStop();
$('#walkRoom').onchange=e=>{const r=rooms[+e.target.value];if(r){walk.on=false;walkStart(null,r);}};
$('#lookBtn').onclick=e=>{e.stopPropagation();const m=$('#lookMenu');m.hidden=!m.hidden;$('#lookBtn').setAttribute('aria-expanded',String(!m.hidden));if(!m.hidden){renderLookMenu();const b=m.querySelector('[aria-checked="true"]');b&&b.focus();}};
document.addEventListener('pointerdown',e=>{if(!e.target.closest('.lookwrap')){$('#lookMenu').hidden=true;$('#lookBtn').setAttribute('aria-expanded','false');}});
$('#lookMenu').addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Escape'){$('#lookMenu').hidden=true;$('#lookBtn').focus();}});
{const J=$('#walkJoy'),K=J.querySelector('.knob');let jid=null;const upd=e=>{const r=J.getBoundingClientRect(),R=r.width/2;let x=(e.clientX-r.left-R)/R,y=(e.clientY-r.top-R)/R;const L=Math.hypot(x,y);if(L>1){x/=L;y/=L;}walk.joy={x,y};K.style.transform=`translate(${x*R*0.6}px,${y*R*0.6}px)`;walkTickStart();};
  J.addEventListener('pointerdown',e=>{e.preventDefault();jid=e.pointerId;try{J.setPointerCapture(jid);}catch(_){}upd(e);});J.addEventListener('pointermove',e=>{if(e.pointerId===jid)upd(e);});
  const end=e=>{if(e.pointerId!==jid)return;jid=null;walk.joy=null;K.style.transform='';};J.addEventListener('pointerup',end);J.addEventListener('pointercancel',end);}
$('#undoBtn').onclick=undo;$('#redoBtn').onclick=redo;$('#fitBtn').onclick=()=>{fit();frame3d();draw3d();};
$('#projName').addEventListener('change',e=>{M.name=e.target.value;save();});
document.querySelectorAll('[data-tool]').forEach(b=>b.onclick=()=>setTool(b.dataset.tool,b.dataset.kind||undefined));
$('#tDoor').onclick=e=>{if(document.getElementById('doorPick')){closeDoorPick();return;}openDoorPick(e.currentTarget);};
// Tool and fixture icons drawn as plan symbols, the way they appear on the drawing.
const ICONS={
  select:'<path d="M6 3.5 18 12l-5.4 1.3 3 6.1-2.4 1.1-3-6.2L6 18z" fill="currentColor" fill-opacity=".14"/>',
  arcwall:'<path d="M3.5 21A17.5 17.5 0 0 1 21 3.5M3.5 15.5A12 12 0 0 1 15.5 3.5M3.5 15.5V21M15.5 3.5H21"/><path d="M6 15.2 9.5 19M8.5 11.5l5.2 5.6M12 8.6l5 5.3M15.5 6.6l4 4.1" stroke-width="1"/>',
  wall:'<rect x="2.5" y="8.5" width="19" height="7"/><path d="M5 15.5 12 8.5M10 15.5l7-7M15 15.5l6-6M2.5 13.5l5-5" stroke-width="1"/>',
  slidedoor1:'<path d="M2.5 16h4M17.5 16h4M6.5 13v6M17.5 13v6"/><rect x="6.5" y="11.5" width="11" height="2.5"/><path d="M9 7.5h8m0 0-1.6-1.4M17 7.5l-1.6 1.4"/>',
  slidedoor:'<path d="M2.5 16h4M17.5 16h4M6.5 13v6M17.5 13v6"/><rect x="6.5" y="11.5" width="7" height="2.5"/><rect x="10.5" y="15" width="7" height="2.5"/><path d="M8 7.5H4.5m0 0 1.6-1.4M4.5 7.5l1.6 1.4M16 7.5h3.5m0 0-1.6-1.4m1.6 1.4-1.6 1.4"/>',
  door:'<path d="M2.5 20h4.5M17 20h4.5M7 20V7.5"/><path d="M7 7.5A12.5 12.5 0 0 1 19.5 20" stroke-dasharray="2 2"/><path d="M7 18v2M17 18v2"/>',
  window:'<path d="M2.5 9h4M17.5 9h4M2.5 15h4M17.5 15h4M6.5 9v6M17.5 9v6M6.5 9h11M6.5 15h11M6.5 12h11"/>',
  column:'<path d="M3 3.5h17.5M3.5 3v17.5" stroke-width="2.6"/><rect x="9" y="9" width="10" height="10" fill="currentColor" fill-opacity=".2"/><path d="M9 14l5-5M9 19l10-10M14 19l5-5" stroke-width="1"/>',
  text:'<path d="M5 6V4h14v2M12 4v16M9 20h6"/>',
  erase:'<path d="M14.5 4.5 20 10 11 19H6.5L3.5 16z"/><path d="M9 10l5.5 5.5M11 19h9.5"/>',
  area:'<path d="M4 6.5 14 3.5l6.5 7-3 9.5-12 0z"/><path d="M7.5 12.5h7M7.5 15.5h5" stroke-width="1.2"/><circle cx="4" cy="6.5" r="1.2"/><circle cx="14" cy="3.5" r="1.2"/><circle cx="20.5" cy="10.5" r="1.2"/>',
  ruler:'<path d="M3 15.5 15.5 3 21 8.5 8.5 21z"/><path d="M6.3 12.2l1.8 1.8M8.7 9.8l2.6 2.6M11.1 7.4l1.8 1.8M13.5 5l2.6 2.6"/>',
  base:'<rect x="3.5" y="4.5" width="17" height="15" rx="1"/><path d="M3.5 16h17"/>',
  sinkbase:'<rect x="2.5" y="4.5" width="19" height="15" rx="1"/><rect x="6" y="7" width="12" height="8.5" rx="2.5"/><circle cx="12" cy="9.3" r=".9" fill="currentColor"/>',
  dishwasher:'<rect x="3.5" y="4.5" width="17" height="15" rx="1"/><path d="M3.5 4.5 20.5 16M3.5 16h17"/>',
  range:'<rect x="3.5" y="3.5" width="17" height="17" rx="1"/><circle cx="8.3" cy="8.3" r="2.6"/><circle cx="15.7" cy="8.3" r="2.6"/><circle cx="8.3" cy="15.7" r="2.6"/><circle cx="15.7" cy="15.7" r="2.6"/>',
  fridge:'<rect x="4.5" y="3.5" width="15" height="17" rx="1.2"/><path d="M4.5 9.5h15M16.5 12v4"/>',
  tall:'<rect x="4.5" y="3.5" width="15" height="17" rx="1"/><path d="M4.5 3.5l15 17M19.5 3.5l-15 17"/>',
  wallcab:'<rect x="3.5" y="7.5" width="17" height="9" rx="1" stroke-dasharray="2.5 1.8"/><path d="M3.5 7.5l17 9" stroke-dasharray="2.5 1.8"/>',
  toilet:'<rect x="6.5" y="2.5" width="11" height="5" rx="1"/><path d="M8 7.5c-1.6 1.5-2.3 3.6-2.3 6 0 4.3 2.8 7.5 6.3 7.5s6.3-3.2 6.3-7.5c0-2.4-.7-4.5-2.3-6"/><ellipse cx="12" cy="14" rx="3.4" ry="4.3"/>',
  vanity:'<rect x="2.5" y="5.5" width="19" height="13" rx="1"/><ellipse cx="12" cy="12.6" rx="5.6" ry="3.8"/><circle cx="12" cy="8.2" r=".9" fill="currentColor"/>',
  tub:'<rect x="1.5" y="6.5" width="21" height="11" rx="1.2"/><rect x="4" y="8.5" width="16.5" height="7" rx="3.2"/><circle cx="6.8" cy="12" r="1"/>',
  shower:'<rect x="3.5" y="3.5" width="17" height="17" rx="1"/><path d="M3.5 3.5l17 17M20.5 3.5l-17 17" stroke-width="1"/><circle cx="12" cy="12" r="2.2"/>'};
Object.assign(ICONS,OUTDOOR_ICONS);
const iconSvg=k=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[k]||''}</svg>`;
document.querySelectorAll('[data-icon]').forEach(e=>e.innerHTML=iconSvg(e.dataset.icon));
for(const [k,c] of Object.entries(CAT)){const b=document.createElement('button');b.className='titem';b.dataset.type=k;
  b.innerHTML=`<span class="ico">${iconSvg(k)}</span><span class="tl">${c.label}</span><span class="libw"></span>`;b.title=`${c.label}: ${c.w} × ${c.d} × ${c.h} mm`;
  b.onclick=()=>setTool('place',k);$(c.group==='Kitchen'?'#libKitchen':c.group==='Outdoor'?'#libOutdoorItems':'#libBath').appendChild(b);}
// Collapsible panel: the whole panel folds to an icon rail, and each section folds on its own. Remembered per viewer.
const uiState=(()=>{try{return JSON.parse(localStorage.getItem('bm-ui'))||{};}catch(e){return {};}})();uiState.folded=uiState.folded||{};
const saveUi=()=>{try{localStorage.setItem('bm-ui',JSON.stringify(uiState));}catch(e){}};
function settleLayout(){const t0=performance.now();const step=()=>{dirty();draw3d();if(performance.now()-t0<260)requestAnimationFrame(step);};requestAnimationFrame(step);}
function setRail(collapsed,quiet){uiState.rail=!!collapsed;$('#app').classList.toggle('railc',!!collapsed);const b=$('#railToggle');
  b.setAttribute('aria-expanded',String(!collapsed));const lbl=collapsed?'Expand the tool panel':'Collapse the tool panel';b.setAttribute('aria-label',lbl);b.title=lbl+' ( [ )';
  if(!quiet){saveUi();settleLayout();}}
function setFold(sec,folded,quiet){const el=document.querySelector(`.tsec[data-sec="${sec}"]`);if(!el)return;const h=el.querySelector('.sechead'),list=el.querySelector('.toollist');
  h.setAttribute('aria-expanded',String(!folded));list.classList.toggle('folded',!!folded);uiState.folded[sec]=!!folded;if(!quiet)saveUi();}
$('#railToggle').onclick=()=>setRail(!uiState.rail);
document.querySelectorAll('.tsec').forEach(el=>el.querySelector('.sechead').onclick=()=>setFold(el.dataset.sec,!uiState.folded[el.dataset.sec]));
setRail(uiState.rail,true);Object.entries(uiState.folded).forEach(([k,v])=>setFold(k,v,true));
window.addEventListener('keydown',e=>{if(e.key!=='['||e.ctrlKey||e.metaKey||e.altKey)return;const tag=(e.target.tagName||'').toLowerCase();if(tag==='input'||tag==='select'||tag==='textarea'||!$('#modal').hidden)return;e.preventDefault();setRail(!uiState.rail);});
let skipTheme=false;function onTheme(){if(skipTheme){skipTheme=false;return;}readColors();dirty();build3d();}
try{matchMedia('(prefers-color-scheme: dark)').addEventListener('change',onTheme);}catch(e){}
new MutationObserver(onTheme).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
let narrow=window.innerWidth<900;
window.addEventListener('resize',()=>{const n=window.innerWidth<900;if(n!==narrow){narrow=n;requestAnimationFrame(()=>{fit();frame3d();draw3d();});}dirty();draw3d();});
function loop(){if(needDraw){needDraw=false;drawPlan();drawElev();}requestAnimationFrame(loop);}

/* boot */
if(!loadTabs())migrateOld();
M=activeTab.M;readColors();
setSnap(snapOn);setFree(freeMove,true);setEmptyDrag(emptyDrag);setView('plan');setCut(true);
activate(activeTab,true);syncAutosaveUI();
if(three.ok){applyLook();syncWalkUI();}
$('#laserBtn').onclick=laserBtnClick;renderLaserBtn();
requestAnimationFrame(()=>{fit();frame3d();build3d();loop();});
if(!three.ok){$('.pane3d .panelabel').textContent='3D unavailable: the 3D library did not load';}

/* ============================== offline install (browser / PWA only) ============================== */
if(!window.__TAURI__&&'serviceWorker' in navigator&&/^https?:$/.test(location.protocol)){
  window.addEventListener('load',()=>{navigator.serviceWorker.register('sw.js').catch(()=>{});});}
