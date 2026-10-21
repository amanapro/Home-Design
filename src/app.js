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
let M, rooms=[], units=(()=>{try{return localStorage.getItem('bm-units')||'mm';}catch(e){return 'mm';}})(), view={s:0.1,ox:0,oy:0};
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
function blankModel(){return {name:'Untitled project',walls:[],openings:[],items:[],roomMeta:[],dims:[],cols:[],arcs:[],areas:[],texts:[],elec:[]};}
const wallById=id=>M.walls.find(w=>w.id===id);
function wallLen(w){return dist(w.a,w.b);}
function wallDir(w){return norm(sub(w.b,w.a));}

/* wall end extensions: how far each end pushes into joining walls */
// An end marked loose stays where it is but is not joined: neighbours don't drag it and it doesn't fill the corner.
const isLoose=(w,k)=>!!(w.loose&&w.loose[k]);
function setLoose(w,k,v){if(v){w.loose=w.loose||{};w.loose[k]=true;}else if(w.loose){delete w.loose[k];if(!w.loose.a&&!w.loose.b)delete w.loose;}}
// How far each wall end reaches past its end point, per side (+n side, -n side), so joined walls meet cleanly
// at any angle: two walls meeting end to end are mitred (their faces meet at a point, nothing sticks out);
// a wall ending on the side of another stops at that wall's far face; three or more walls at one point
// overlap squarely as before. A loose (unsnapped) end stays square at its end point.
function wallCaps(w){const L=wallLen(w),d=wallDir(w),n=perp(d),hw=w.t/2,out=[[0,0],[0,0]];
  [0,1].forEach(k=>{const key=k?'b':'a';if(isLoose(w,key))return;const P=w[key],e=k?d:mul(d,-1);
    const ends=[],tees=[];
    for(const o of M.walls){if(o===w)continue;
      if(dist(P,o.a)<1||dist(P,o.b)<1){const ok=dist(P,o.a)<1?'a':'b';if(!isLoose(o,ok))ends.push([o,ok]);continue;}
      const c=segClosest(P,o.a,o.b);if(c.t>0.0001&&c.t<0.9999&&dist(P,c.q)<1)tees.push(o);}
    if(!ends.length&&!tees.length)return;
    const lim=Math.max(w.t,...ends.map(([o])=>o.t),...tees.map(o=>o.t))*3;
    // the side of the wall on +n is on the left of travel when the end is b, on the right when it is a
    const sideOf=sg=>k?sg:-sg;   // +n side -> path side (+1 left, -1 right)
    const meet=(A,dir,B,dir2)=>{const den=cross(dir,dir2);if(Math.abs(den)<0.02)return null;return cross(sub(B,A),dir2)/den;};
    if(ends.length===1&&!tees.length){const [o,ok]=ends[0];const far=ok==='a'?o.b:o.a;const dO=norm(sub(far,P)),ho=o.t/2;
      [1,-1].forEach((sg,i)=>{const ps=sideOf(sg);const A=add(P,mul(perp(e),ps*hw)),B=add(P,mul(perp(dO),ps*ho));const t=meet(A,e,B,dO);
        out[k][i]=t==null?0:clamp(t,-Math.min(L/2,lim),lim);});return;}
    if(!ends.length&&tees.length===1){const o=tees[0],od=wallDir(o),on=perp(od);const fs=dot(e,on)>=0?1:-1;const B=add(o.a,mul(on,fs*o.t/2));   // o's face beyond the end
      [1,-1].forEach((sg,i)=>{const ps=sideOf(sg);const A=add(P,mul(perp(e),ps*hw));const t=meet(A,e,B,od);out[k][i]=t==null?o.t/2:clamp(t,-Math.min(L/2,lim),lim);});return;}
    const x=Math.max(...ends.map(([o])=>o.t/2),...tees.map(o=>o.t/2));out[k]=[x,x];});
  return out;}
function wallExt(w){const c=wallCaps(w);return [Math.max(0,c[0][0],c[0][1]),Math.max(0,c[1][0],c[1][1])];}

/* solid wall pieces along a wall as [s0,s1] intervals, minus openings */
function wallPieces(w,ext){
  const L=wallLen(w);const cuts=M.openings.filter(o=>o.wall===w.id).map(o=>[o.s-o.w/2,o.s+o.w/2]).sort((a,b)=>a[0]-b[0]);
  const out=[];let cur=-ext[0];for(const c of cuts){if(c[0]>cur)out.push([cur,c[0]]);cur=Math.max(cur,c[1]);}
  if(L+ext[1]>cur)out.push([cur,L+ext[1]]);return out;}
function pieceQuad(w,s0,s1){const d=wallDir(w),n=perp(d),h=w.t/2,L=wallLen(w);let a=[s0,s0],b=[s1,s1];
  // a piece that runs past a joined end takes that end's mitred shape
  if(s0<-0.01||s1>L+0.01){const c=wallCaps(w);if(s0<-0.01)a=[-c[0][0],-c[0][1]];if(s1>L+0.01)b=[L+c[1][0],L+c[1][1]];}
  const P=(s,sg)=>add(add(w.a,mul(d,s)),mul(n,sg*h));
  return [P(a[0],1),P(b[0],1),P(b[1],-1),P(a[1],-1)];}

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
function fixUid(){const all=[M.walls,M.openings,M.items,M.cols,M.dims,M.arcs,M.areas,M.texts,M.elec,...(M.ep?[M.ep.devs,M.ep.wires,M.ep.tubes,(M.ep.devs||[]).flatMap(d=>d.brk||[])]:[]),...(M.pl?[M.pl.devs,M.pl.pipes,(M.pl.sch||{}).devs,(M.pl.sch||{}).pipes]:[])].filter(Array.isArray);let mx=0;
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
  {const he=hitElec(p);if(he)return he;}
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
  if(pMode&&plSheet==='sch'){drawPlumbSheet();return;}
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
  // one path for all the walls, every piece wound the same way, so joints fill as one shape with no hairline seams
  ctx.beginPath();M.walls.forEach(w=>{if(w.kind)return;const ext=wallExt(w);wallPieces(w,ext).forEach(([s0,s1])=>{let q=pieceQuad(w,s0,s1).map(toS);
    let ar=0;for(let i=0;i<4;i++){const p=q[i],r=q[(i+1)%4];ar+=p[0]*r[1]-r[0]*p[1];}if(ar<0)q=q.reverse();q.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.closePath();});});ctx.fill('nonzero');
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
  drawElecLayer();drawEplan();drawPlumb();
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
function txt(s,p,opts={}){if(LANG==='ar')s=trS(s);ctx.save();ctx.font=(opts.weight||'400')+' '+(opts.size||11)+'px '+(opts.mono?'"IBM Plex Mono", ui-monospace, monospace':'"IBM Plex Sans", system-ui, sans-serif');
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
const MEAS_DEF={ext:true,walls:false,openings:false,edit:true,names:true,rooms:true,areas:true,kept:true,epinfo:true,plinfo:true};
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
  const lines=MEAS.names?[[r.name,{weight:'600',size:12.5}]]:[];if(MEAS.rooms)lines.push([fmtArea(r.netArea)+' '+areaU(),{mono:true,size:11}]);
  if(MEAS.rooms&&r.rect&&view.s>0.04)lines.push([fmtLen(r.rect[0])+' × '+fmtLen(r.rect[1]),{mono:true,size:10,color:C.muted}]);
  if(!lines.length)return;const lh=15;lines.forEach((l,i)=>txt(l[0],[c[0],c[1]+(i-(lines.length-1)/2)*lh],Object.assign({halo:C['room-'+r.type]||C.paper},l[1])));}

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
  drawLaserMark();drawWalkMark();drawElecTool();
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
  els.forEach((e,k)=>{const ox=pad+(k%cols)*(colW+gap),top=pad+Math.floor(k/cols)*(cellH+gap);drawElevation(e,r,ox,top+30+maxH*s,s);drawElevElec(e,ox,top+30+maxH*s,s);});
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
  return `<div class="selname">${selTitle('Curved wall',q)} <span class="selbtns"><button class="btn" id="copyBtn" title="Copy (Ctrl+C)">Copy</button><button class="btn" id="delBtn">Delete</button></span></div><div class="kv">
    ${nameField(q,'e.g. Bay window wall')}${field('Radius','qR',g?fmtLen(g.r):'')}${field('Bulge','qS',fmtLen(Math.abs(q.s)))}
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
    <p class="tip">The measurements with tick marks along the outside of the plan are the app's own wall dimensions, not part of the picture. Turn them off with <b>Measures</b> in the top bar.</p>`;}
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
    ctx.save();ctx.font='600 12.5px "IBM Plex Sans", system-ui, sans-serif';const w=MEAS.names?ctx.measureText(r.name).width:0;ctx.restore();
    const lines=(MEAS.names?1:0)+(MEAS.rooms?1:0)+(MEAS.rooms&&r.rect&&view.s>0.04?1:0);if(!lines)continue;const top=c[1]-(lines-1)*7.5-8;
    
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
  // lights, switches and sockets: the selected ones, or the ones on the copied walls / inside the copied room
  {const ids=new Set(elecSelIds());const roomR=sel.kind==='room'&&rooms.find(r=>pointInPoly(sel.pt,r.net));
    C0.elec=(M.elec||[]).filter(E=>ids.has(E.id)||(E.wall&&wallIds.has(E.wall))||(roomR&&(()=>{const q=elecPos(E);if(!q)return false;if(E.wall){const P=elecWallPos(E);return P&&pointInPoly(add(P.p,mul(P.n,40)),roomR.net);}return pointInPoly(q,roomR.net);})()))
      .map(E=>{const n=clone(E);if(E.wall){const P=elecWallPos(E);if(!P)return null;n._p=add(P.p,mul(P.n,40));delete n.wall;delete n.s;delete n.side;}return n;}).filter(Boolean);}
  const pts=clipPoints(C0);if(!pts.length&&!C0.openings.length){toast('Select a wall, column, fixture, door, window, dimension, light, switch, socket or room to copy.');return false;}
  C0.anchor=pts.length?[Math.min(...pts.map(p=>p[0])),Math.min(...pts.map(p=>p[1]))]:[0,0];clip=C0;$('#pasteBtn').hidden=false;
  if(!quiet){const n=[];const add_=(k,w)=>{if(C0[k].length)n.push(C0[k].length+' '+w+(C0[k].length>1?'s':''));};add_('walls','wall');add_('openings','opening');add_('cols','column');add_('items','fixture');add_('dims','dimension');add_('areas','area');add_('texts','text');if(C0.elec.length)n.push(C0.elec.length+' electrical part'+(C0.elec.length>1?'s':''));
    toast('Copied '+n.join(', ')+'. Press Ctrl+V, or Paste on the plan, then click where it goes.');}
  return true;}
function clipPoints(C0){const pts=[];C0.walls.forEach(w=>{const d=wallDir(w),n=perp(d);[w.a,w.b].forEach(p=>pts.push(add(p,mul(n,w.t/2)),add(p,mul(n,-w.t/2))));});
  C0.cols.forEach(c=>pts.push(...colCorners(c)));C0.items.forEach(it=>[[-1,-1],[1,-1],[1,1],[-1,1]].forEach(([x,y])=>pts.push(add([it.x,it.y],rotV([x*it.w/2,y*it.d/2],it.r)))));
  C0.dims.forEach(d=>pts.push(d.a,d.b));(C0.areas||[]).forEach(A=>pts.push(...areaOutline(A)));(C0.texts||[]).forEach(T=>pts.push(...textBox(T)));(C0.elec||[]).forEach(E=>{if(E.a)pts.push(E.a,E.b);else pts.push(E._p||[E.x,E.y]);});return pts;}
const openingOnly=()=>clip&&!clip.walls.length&&clip.openings.length&&!(clip.elec||[]).length&&!clip.cols.length&&!clip.items.length&&!clip.dims.length&&!(clip.areas||[]).length&&!(clip.texts||[]).length;
function startPaste(){if(!clip){toast('Nothing copied yet. Select something and press Ctrl+C.');return;}setTool('paste');pasteOff=null;updatePreview(cursor);dirty();}
function pasteOffsetFor(p){
  if(openingOnly()){const o=clip.openings[0],w=nearestWall(p,24);if(!w)return null;const sl=openingSlot(p,w,o.w)||openingSlotLoose(p,w,o.w);return sl?{wall:w,s:sl.s}:null;}
  let off=sub(p,clip.anchor);pasteSnap='';
  if(snapOn){let best=null,bd=10/view.s;const ends=[];M.walls.forEach(w=>ends.push(w.a,w.b));
    clip.walls.forEach(w=>[w.a,w.b].forEach(q=>{const t=add(q,off);ends.forEach(E=>{const d=dist(t,E);if(d<bd){bd=d;best=sub(E,q);}});}));
    if(best){off=best;pasteSnap='joins a wall end';}else off=[Math.round(off[0]/lenStep())*lenStep(),Math.round(off[1]/lenStep())*lenStep()];}
  return off;}
function doPaste(){const off=pasteOff;if(!off)return;const newWalls=[],sels=[],newElec=[];let skipped=0;
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
    clip.meta.forEach(m=>M.roomMeta.push(Object.assign(clone(m),{x:m.x+off[0],y:m.y+off[1]})));
    (clip.elec||[]).forEach(E=>{const n=elecPasted(E,off);if(!n){skipped++;return;}n.id=nid('e');elecList().push(n);newElec.push(n.id);});});
  if(skipped)toast(skipped>1?skipped+' wall-mounted parts had no wall to sit on there and were left out.':'1 wall-mounted part had no wall to sit on there and was left out.');
  setTool('select');
  const pa=Object.values(amap);
  if(pa.length===1&&newWalls.every(id=>{const w=wallById(id);return w&&w.arcId===pa[0];})){sel={kind:'arc',id:pa[0]};renderInspector();dirty();}
  else if(newWalls.length)setSelWalls(newWalls);else if(newElec.length&&!sels.length)setSelElecs(newElec);else if(sels.length===1){sel=sels[0];renderInspector();dirty();}
  if(!skipped)toast('Pasted. Drag it to adjust, or press Ctrl+V to place another copy.');}
// an electrical part moved by off: wall-mounted ones go onto the wall nearest their new spot (null if there is none)
function elecPasted(E,off){const n=clone(E);delete n._p;delete n.id;
  if(E.a){n.a=add(E.a,off).map(v=>Math.round(v*10)/10);n.b=add(E.b,off).map(v=>Math.round(v*10)/10);return n;}
  if(E._p){const sl=wallSlot(add(E._p,off),80);if(!sl)return null;return Object.assign(n,sl);}
  n.x=Math.round((E.x+off[0])*10)/10;n.y=Math.round((E.y+off[1])*10)/10;return n;}
function drawPasteGhost(){if(!clip||!pasteOff)return;
  if(!openingOnly())(clip.elec||[]).forEach(E=>{const n=elecPasted(E,pasteOff);if(n)drawElecItem(Object.assign(n,{id:'ghost'}),false,true);else{const q=toS(add(E._p,pasteOff));ctx.save();ctx.strokeStyle=C.danger;ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(q[0],q[1],6,0,Math.PI*2);ctx.stroke();ctx.restore();}});
  if(openingOnly()){const o=clip.openings[0];drawOpening(Object.assign({},o,{wall:pasteOff.wall.id,s:pasteOff.s}),true);return;}
  const off=pasteOff;ctx.save();ctx.globalAlpha=.8;
  clip.walls.forEach(w=>{const d=wallDir(w),n=perp(d),h=w.t/2,a=add(w.a,off),b=add(w.b,off);const q=[add(a,mul(n,h)),add(b,mul(n,h)),add(b,mul(n,-h)),add(a,mul(n,-h))].map(toS);
    ctx.beginPath();q.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.closePath();ctx.fillStyle=C['accent-weak'];ctx.fill();ctx.strokeStyle=C.accent;ctx.lineWidth=1.4;ctx.stroke();});
  clip.cols.forEach(c=>drawColumn(Object.assign({},c,{x:c.x+off[0],y:c.y+off[1]}),'ghost'));
  clip.items.forEach(it=>drawItem(Object.assign({},it,{x:it.x+off[0],y:it.y+off[1]}),true,true));
  clip.dims.forEach(d=>drawMeasure(add(d.a,off),add(d.b,off),C.accent,{}));
  ctx.restore();const q=toS(add(clip.anchor,off));ctx.strokeStyle=C.snap;ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(q[0]-7,q[1]);ctx.lineTo(q[0]+7,q[1]);ctx.moveTo(q[0],q[1]-7);ctx.lineTo(q[0],q[1]+7);ctx.stroke();}
$('#pasteBtn').onclick=startPaste;
function syncToolButtons(){document.querySelectorAll('[data-tool]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.tool===tool&&((b.dataset.kind||null)===((tool==='wall'||tool==='area'||tool==='elec'||tool==='eplan'||tool==='plumb')?placeType:(b.dataset.kind||null))))));}
function setTool(t,type){if(t!=='eplan'){epDraw=null;epGhost=null;epKind=null;}if(t!=='plumb'){plDraw=null;plGhost=null;plKind=null;}if(t==='elec'&&!elecOn){toast('Turn on Electrical (above the plan) to use the electrical tools.');syncToolButtons();return;}stripStart=null;elecGhost=null;if(t!==tool){closeTextEditor(false);ruler=null;arcDraw={a:null,b:null,s:0};areaDraw={pts:[],cur:null,snap:null};}tool=t;placeType=type||null;draw.start=null;ghost=null;hideLenbox();
  syncToolButtons();
  document.querySelectorAll('.lib button[data-type]').forEach(b=>b.setAttribute('aria-pressed',String(t==='place'&&b.dataset.type===type)));
  $('#hint').innerHTML=(pMode?plHint(t,type):eMode?epHint(t,type):HINTS[t])||'';$('#snapchip').textContent='';planCv.style.cursor=t==='select'?'default':'crosshair';
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
  if(e.pointerType==='touch'&&touches.size===1&&e.button===0)ctxLPStart(e,sp);else ctxLPCancel();
  if(e.button===2&&e.pointerType==='mouse')ctxDown={sp,p,x:e.clientX,y:e.clientY};
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
  if(tool==='elec'){elecToolClick(p);return;}
  if(tool==='eplan'){epToolClick(p);return;}
  if(tool==='plumb'){plToolClick(p);return;}
  if(tool==='erase'){eraseStart(p);planCv.setPointerCapture(e.pointerId);return;}
  if(tool==='column'&&colGhost&&colGhost.on){const c={id:nid('c'),x:Math.round(colGhost.x*10)/10,y:Math.round(colGhost.y*10)/10,r:colGhost.r,shape:colGhost.shape,w:colGhost.w,d:colGhost.d,h:colGhost.h,gap:colGhost.gap};
    if(colGhost.wall){c.wall=colGhost.wall;c.s=Math.round(colGhost.s*10)/10;c.off=Math.round(colGhost.off*10)/10;}
    mutate(()=>M.cols.push(c));toast('Column placed. Use the Pointer to select it and type exact distances to the walls.');return;}
  if(tool==='ruler'){const from=ruler&&!ruler.b?ruler.a:null;const sn=measureSnap(p,from);
    if(from){if(dist(sn.p,from)>1){ruler.b=sn.p;ruler.cur=sn.p;}renderInspector();}
    else{ruler={a:sn.p,b:null,cur:sn.p,down:sp};planCv.setPointerCapture(e.pointerId);renderInspector();}
    dirty();return;}
  if(tool==='select'&&eMode){epPointerDown(p,e,sp);return;}
  if(tool==='select'&&pMode){plPointerDown(p,e,sp);return;}
  if(tool==='select'){const h=hitTest(p);const mod=e.ctrlKey||e.metaKey;
    if(!h||h.kind==='room'){
      if(emptyDrag==='box'){box={s0:sp,s1:sp,p0:p,add:mod||e.shiftKey,hit:h};}
      else pan={sx:sp[0],sy:sp[1],ox:view.ox,oy:view.oy,click:true,hit:h};
      planCv.setPointerCapture(e.pointerId);return;}
    const ids=selIds();
    if((mod||e.shiftKey)&&h.kind==='elec'&&!h.end){toggleSelElec(h.id);return;}
    if(mod){if(h.kind==='wall'||h.kind==='end')toggleSelWall(h.id);return;}
    if(h.kind==='elec'&&sel&&sel.kind==='elecs'&&sel.ids.includes(h.id)){drag={kind:'elecs',id:h.id,p0:p,snap0:snapshot(),moved:false,e0:sel.ids.map(id=>JSON.parse(JSON.stringify(elecById(id))))};planCv.setPointerCapture(e.pointerId);return;}
    if(h.kind==='wall'&&ids.size>1&&ids.has(h.id)){drag={kind:'group',id:h.id,p0:p,snap0:snapshot(),moved:false,set:groupMoveSet(ids),clickId:h.id,toggle:e.shiftKey};planCv.setPointerCapture(e.pointerId);return;}
    const prevSel=sel;
    sel=h.kind==='end'?{kind:'wall',id:h.id}:h;renderInspector();hover=null;
    drag={kind:h.kind,id:h.id,end:h.end,idx:h.idx,p0:p,snap0:snapshot(),moved:false};
    if(e.shiftKey&&h.kind==='wall')drag.toggleFrom=prevSel;
    if(h.kind==='wall'){const w=wallById(h.id);drag.set=wallMoveSet(w);drag.a0=drag.set.a0;drag.b0=drag.set.b0;}
    if(h.kind==='end'){const w=wallById(h.id);drag.orig=w[h.end].slice();drag.links=[[w,h.end]].concat(connectedEnds(w,h.end));drag.ops=captureOpenings(drag.links.map(([o])=>o));}
    if(h.kind==='item'){const it=M.items.find(x=>x.id===h.id);drag.off=sub([it.x,it.y],p);}
    if(h.kind==='elec')elecDragStart(drag,p);
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
  ctxLPMove(e,sp);
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
    if(drag.kind==='elec')elecDragMove(drag,p);
    if(drag.kind==='ep')epDragMove(drag,p);
    if(drag.kind==='pl')plDragMove(drag,p);
    if(drag.kind==='elecs')elecGroupMove(drag,p);
    if(drag.kind==='item'){const it=M.items.find(x=>x.id===drag.id);const target=add(p,drag.off);const r=fixtureSnap(target,it);it.x=r.x;it.y=r.y;if(r.snapped)it.r=r.r;}
    if(drag.kind==='opening'){const o=M.openings.find(x=>x.id===drag.id);let w=nearestWall(p,24)||wallById(o.wall);const sl=openingSlot(p,w,o.w)||openingSlotLoose(p,w,o.w);if(sl){o.wall=w.id;o.s=sl.s;}}
    $('#snapchip').textContent=drag.snap&&drag.snap.kind!=='free'&&drag.snap.kind!=='angle'?drag.snap.kind:'';
    rooms=computeRooms();dirty();renderInspector();return;}
  updatePreview(p);
  if(tool==='select'&&eMode){const h=epHit(p);planCv.style.cursor=h?(h.pt!=null?'move':'pointer'):'default';}
  if(tool==='select'&&pMode){const h=plHit(p);planCv.style.cursor=h?(h.pt!=null?'move':'pointer'):'default';}
  if(tool==='select'&&!eMode&&!pMode){ptrTouch=e.pointerType!=='mouse';const h=hitTest(p);const key=h&&h.kind!=='room'?h.kind+(h.id||'')+(h.end||''):'';if(key!==(hover&&hover.key)){hover=h&&h.kind!=='room'?Object.assign({key},h):null;dirty();}
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
  if(tool==='eplan'){epToolMove(p);return;}
  if(tool==='plumb'){plToolMove(p);return;}
  if(tool==='elec'){elecToolMove(p);return;}
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
  ctxLPCancel();
  if(ctxDown&&e.pointerType==='mouse'&&e.button===2){const c=ctxDown;ctxDown=null;const sp=evPoint(e);if(Math.hypot(sp[0]-c.sp[0],sp[1]-c.sp[1])<5){pan=null;ctxOpen(c.p,e.clientX,e.clientY);return;}}
  if(eraseOn){eraseEnd();}
  if(tool==='ruler'&&ruler&&ruler.down){const sp=evPoint(e);if(!ruler.b&&Math.hypot(sp[0]-ruler.down[0],sp[1]-ruler.down[1])>8&&dist(ruler.cur,ruler.a)>1){ruler.b=ruler.cur;renderInspector();}ruler.down=null;dirty();}
  if(e.pointerType==='touch'){touches.delete(e.pointerId);if(pinch){if(touches.size<2)pinch=null;return;}}
  if(box){const b=box;box=null;dirty();
    if(Math.hypot(b.s1[0]-b.s0[0],b.s1[1]-b.s0[1])<5){if(!b.add){sel=b.hit&&b.hit.kind==='room'?b.hit:null;if(sel){elevPt=sel.pt.slice();fillElevSelect();}renderInspector();}return;}
    {const fe=elecInBox(toW(b.s0),toW(b.s1),b.s1[0]<b.s0[0]);if(fe.length){setSelElecs(b.add?[...elecSelIds(),...fe]:fe);$('#snapchip').textContent=fe.length+' electrical part'+(fe.length>1?'s':'')+' selected';return;}}
    const found=wallsInBox(toW(b.s0),toW(b.s1),b.s1[0]<b.s0[0]);setSelWalls(b.add?[...selIds(),...found]:found);
    $('#snapchip').textContent=found.length?found.length+' wall'+(found.length>1?'s':'')+' selected':'';return;}
  if(pan){if(pan.click){sel=pan.hit&&pan.hit.kind==='room'?pan.hit:null;if(sel){elevPt=sel.pt.slice();fillElevSelect();}renderInspector();dirty();}pan=null;return;}
  if(drag&&!drag.moved){ // a click, not a drag
    if(drag.kind==='group'){drag.toggle?toggleSelWall(drag.clickId):setSelWalls([drag.clickId]);drag=null;return;}
    if(drag.kind==='elecs'){setSelElecs([drag.id]);drag=null;return;}
    if(drag.toggleFrom!==undefined){sel=drag.toggleFrom;toggleSelWall(drag.id);drag=null;return;}}
  if(drag&&drag.moved&&drag.kind==='end'&&drag.snap&&['end','on wall','to wall','mid'].includes(drag.snap.kind)){ // dropped onto another wall: join it
    const q=drag.snap.p;drag.links.forEach(([w,k])=>setLoose(w,k,false));M.walls.forEach(o=>['a','b'].forEach(k=>{if(dist(o[k],q)<1)setLoose(o,k,false);}));}
  if(drag&&drag.moved&&(drag.kind==='arcmid'||drag.kind==='arcend')){const q=arcById(drag.id);if(q&&q.auto!==false){q.n=autoSegs(q.a,q.b,q.s);regenArc(q);}}
  if(drag&&drag.keepRoom){sel={kind:'room',pt:drag.keepRoom};}
  if(drag){$('#snapchip').textContent='';if(drag.moved){pushUndo(drag.snap0);
      if(drag.kind==='end'){M.walls=M.walls.filter(w=>wallLen(w)>5);}changed();}drag=null;dirty();}}
planCv.addEventListener('pointerup',endPointer);planCv.addEventListener('pointercancel',endPointer);
planCv.addEventListener('dblclick',()=>{if(pMode){if(tool==='plumb'&&plDraw)plFinish();else if(tool==='select')plDbl(cursor);return;}if(eMode){if(tool==='eplan'&&epDraw)epFinish();else if(tool==='select')epDbl(cursor);return;}if(tool==='wall'){draw.start=null;draw.chainStart=null;dirty();}
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
  if(pinch||mouseWheel){const k=Math.exp(-clamp(e.deltaY,-60,60)*(pinch?0.01:0.0015));const w=toW(sp);view.s=clamp(view.s*k,0.008,3);view.ox=sp[0]-w[0]*view.s;view.oy=sp[1]-w[1]*view.s;}
  else{view.ox-=e.deltaX;view.oy-=e.deltaY;}dirty();},{passive:false});

// The desktop app lets pinch gestures through to the page (so two-finger pinch on a touchpad or touch screen zooms the plan);
// stop them, and Ctrl +/-/0, from zooming the whole app instead.
window.addEventListener('wheel',e=>{if(e.ctrlKey)e.preventDefault();},{passive:false});
window.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&!e.altKey&&['+','=','-','_','0'].includes(e.key))e.preventDefault();},true);
function zoomPlan(k,sp){const r=planCv.getBoundingClientRect();sp=sp||[r.width/2,r.height/2];const w=toW(sp);view.s=clamp(view.s*k,0.008,3);view.ox=sp[0]-w[0]*view.s;view.oy=sp[1]-w[1]*view.s;dirty();}
{let g0=null;planCv.addEventListener('gesturestart',e=>{e.preventDefault();g0={s:view.s};});
  planCv.addEventListener('gesturechange',e=>{e.preventDefault();if(!g0)return;const r=planCv.getBoundingClientRect();zoomPlan(g0.s*e.scale/view.s,[e.clientX-r.left,e.clientY-r.top]);});
  planCv.addEventListener('gestureend',e=>{e.preventDefault();g0=null;});}
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
  if(mod&&(eMode||pMode)&&'cvda'.includes(e.key.toLowerCase())){e.preventDefault();return;}   // copy/paste is for the home plan
  if(mod&&e.key.toLowerCase()==='c'){if(sel){e.preventDefault();copySel();}return;}
  if(mod&&e.key.toLowerCase()==='v'){e.preventDefault();startPaste();return;}
  if(mod&&e.key.toLowerCase()==='d'){if(sel){e.preventDefault();if(copySel(true))startPaste();}return;}
  if(mod&&e.key.toLowerCase()==='a'&&tool==='select'){e.preventDefault();setSelWalls(M.walls.map(w=>w.id));return;}
  if(mod)return;
  if(tool==='wall'&&draw.start&&/^[0-9.]$/.test(e.key)){e.preventDefault();showLenbox(e.key);return;}
  if(tool==='arcwall'&&arcDraw.a&&/^[0-9.]$/.test(e.key)){e.preventDefault();showLenbox(e.key);lenInput.placeholder=arcDraw.b?'radius':'distance to the end';return;}
  if(tool==='arcwall'&&e.key==='Escape'&&arcDraw.a){arcDraw={a:null,b:null,s:0};dirty();return;}
  const k=e.key.toLowerCase();
  if(epKey(e,k)||plKeyDown(e,k))return;
  const arrows={arrowleft:[-1,0],arrowright:[1,0],arrowup:[0,-1],arrowdown:[0,1]};
  if(arrows[k]&&sel&&tool==='select'){e.preventDefault();nudge(arrows[k],e.shiftKey?10:1);return;}
  if(tool==='ruler'&&k==='enter'&&ruler&&ruler.b){e.preventDefault();keepRuler();return;}
  if(tool==='area'&&areaDraw.pts.length){if(k==='enter'){e.preventDefault();finishArea();return;}if(k==='escape'){areaDraw={pts:[],cur:null,snap:null};renderInspector();dirty();return;}
    if(k==='backspace'){e.preventDefault();areaDraw.pts.pop();renderInspector();dirty();return;}}
  if(k==='escape'&&tool==='ruler'&&ruler){ruler=null;renderInspector();dirty();return;}
  if(!e.ctrlKey&&!e.metaKey&&(e.key==='+'||e.key==='=')){e.preventDefault();zoomPlan(1.25);return;}
  if(!e.ctrlKey&&!e.metaKey&&(e.key==='-'||e.key==='_')){e.preventDefault();zoomPlan(0.8);return;}
  if(k==='escape'&&tool==='elec'&&stripStart){stripStart=null;elecGhost=null;renderInspector();dirty();return;}
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
  if(sel.kind==='elec'||sel.kind==='elecs'){elecNudge(elecSelIds(),v,step);did=true;msg='moved '+fmtLen(step);}
  if(sel.kind==='opening'){const o=M.openings.find(x=>x.id===sel.id),w=o&&wallById(o.wall);if(w){const a=dot(v,wallDir(w));if(Math.abs(a)>0.5){o.s+=Math.sign(a)*step;did=true;msg='moved '+fmtLen(step);}}}
  if(did){if(newBurst)pushUndo(before);changed();}
  if(msg){$('#snapchip').textContent=msg;clearTimeout(nudge.t);nudge.t=setTimeout(()=>$('#snapchip').textContent='',1400);}}
function deleteSel(){if(!sel)return;const s=sel;if(s.kind==='room'){const r=selRoom();if(r)deleteRoom(r);sel=null;renderInspector();return;}mutate(()=>{
  if(s.kind==='arc'){const q=arcById(s.id);if(q){const ids=new Set(arcSegs(q).map(w=>w.id));M.walls=M.walls.filter(w=>!ids.has(w.id));M.openings=M.openings.filter(o=>!ids.has(o.wall));M.arcs=M.arcs.filter(x=>x!==q);M.elec=(M.elec||[]).filter(e=>!ids.has(e.wall));}}
  if(s.kind==='wall'||s.kind==='walls'){const ids=new Set(s.kind==='wall'?[s.id]:s.ids);M.walls=M.walls.filter(w=>!ids.has(w.id));M.openings=M.openings.filter(o=>!ids.has(o.wall));M.elec=(M.elec||[]).filter(e=>!ids.has(e.wall));}
  if(s.kind==='opening')M.openings=M.openings.filter(o=>o.id!==s.id);
  if(s.kind==='item')M.items=M.items.filter(o=>o.id!==s.id);
  if(s.kind==='dim')M.dims=M.dims.filter(o=>o.id!==s.id);
  if(s.kind==='area')M.areas=M.areas.filter(o=>o.id!==s.id);
  if(s.kind==='text')M.texts=M.texts.filter(o=>o.id!==s.id);
  if(s.kind==='col')M.cols=M.cols.filter(o=>o.id!==s.id);
  if(s.kind==='elec')M.elec=(M.elec||[]).filter(o=>o.id!==s.id);
  if(s.kind==='elecs'){const ids=new Set(s.ids);M.elec=(M.elec||[]).filter(o=>!ids.has(o.id));}});sel=null;renderInspector();}
function updateCoords(){$('#coords').textContent='x '+fmtLen(cursor[0])+' · y '+fmtLen(-cursor[1]);}

/* ============================== inspector & takeoff ============================== */
// Any wall, door, window, fixture or column can carry its own name ("Garden door"); it shows in its panel title,
// the quick menu, the fixture schedule and Statistics. Empty means it goes by its type.
function nameField(o,ph){return `<label for="nmF">Name</label><input id="nmF" data-type="text" maxlength="60" autocomplete="off" placeholder="${esc(ph||'')}" value="${esc(o&&o.name||'')}">`;}
function selTitle(type,o){return o&&o.name?`<span translate="no">${esc(o.name)}</span> <small class="seltype">${type}</small>`:type;}
function nameTarget(){if(!sel)return null;const k=sel.kind;return k==='wall'?wallById(sel.id):k==='opening'?M.openings.find(x=>x.id===sel.id):k==='item'?M.items.find(x=>x.id===sel.id):k==='col'?colById(sel.id):k==='arc'?arcById(sel.id):null;}
const itemName=it=>it.name||(CAT[it.type]?CAT[it.type].label:it.type);
function field(label,id,val,type='len'){return `<label for="${id}">${label}</label><input id="${id}" data-type="${type}" value="${val}">`;}
function selectField(label,id,opts,val){return `<label for="${id}">${label}</label><select id="${id}">${Object.entries(opts).map(([k,v])=>`<option value="${k}"${k==val?' selected':''}>${v}</option>`).join('')}</select>`;}
document.getElementById('inspector').addEventListener('change',e=>{if(e.target.id!=='nmF')return;const o=nameTarget();if(!o)return;const v=e.target.value.replace(/\s+/g,' ').trim().slice(0,60);
  if((o.name||'')===v)return;if(sel.kind==='arc'){const segs=arcSegs(o);mutate(()=>{if(v){o.name=v;segs.forEach(w=>w.name=v);}else{delete o.name;segs.forEach(w=>delete w.name);}});}
  else mutate(()=>{if(v)o.name=v;else delete o.name;});renderInspector();renderTakeoff();toast(v?'Named “'+v+'”':'Name removed');});
const isNarrow=()=>matchMedia('(max-width:900px)').matches;let sheetSel=null;
function setSheet(open){const app=$('#app');app.classList.toggle('sheet',open);const b=$('#detailsBtn');if(b)b.setAttribute('aria-expanded',String(open));if(open)$('#side').scrollTop=0;}
function selPoint(){if(!sel)return null;const k=sel.kind;
  if(k==='item'){const i=M.items.find(x=>x.id===sel.id);return i&&[i.x,i.y];}
  if(k==='wall'){const w=wallById(sel.id);return w&&mul(add(w.a,w.b),.5);}
  if(k==='opening'){const o=M.openings.find(x=>x.id===sel.id),w=o&&wallById(o.wall);return w&&add(w.a,mul(wallDir(w),o.s));}
  if(k==='col'){const c=(M.cols||[]).find(x=>x.id===sel.id);return c&&[c.x,c.y];}
  if(k==='room'){const r=selRoom();return r&&r.centroid;}
  if(k==='text'){const t=(M.texts||[]).find(x=>x.id===sel.id);return t&&[t.x,t.y];}
  if(k==='area'){const A=(M.areas||[]).find(x=>x.id===sel.id);return A&&A.pts.length&&mul(A.pts.reduce((a,p)=>add(a,p),[0,0]),1/A.pts.length);}
  return null;}
// keep what you picked in view above the details sheet
function sheetReveal(){const p=selPoint();if(!p)return;const pr=planCv.getBoundingClientRect(),sr=$('#side').getBoundingClientRect();const bottom=Math.min(pr.bottom,sr.top)-pr.top-30,top=60;
  const sp=toS(p);if(sp[1]>top&&sp[1]<bottom)return;view.oy+=((top+bottom)/2)-sp[1];dirty();}
function sheetFollowSel(){if(!isNarrow())return;const k=sel?JSON.stringify(sel):null;if(k===sheetSel)return;sheetSel=k;setSheet(!!k);if(k)setTimeout(sheetReveal,240);}
function renderInspector(){setTimeout(sheetFollowSel,0);
  if(eMode){$('#inspector').innerHTML=epInspectorHTML();epBindInspector();return;}
  if(pMode){$('#inspector').innerHTML=plInspectorHTML();plBindInspector();return;}
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
    if(tool==='elec'){el.innerHTML=elecToolPanel();return;}
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
      <label>Loose ends</label><span class="ro">${loose}</span>
      ${field('Turn by','mRot','','text')}${rotBtns('mrot')}</div>
      <div class="rowbtns"><button class="btn" id="unsnapBtn" title="Detach these walls from all other walls so they move on their own">Unsnap from others</button><button class="btn" id="snapEndsBtn" title="Join loose ends to walls they touch or to the nearest wall within reach">Snap ends</button></div>
      <p class="tip">Drag any highlighted wall to move them together; near horizontal or vertical the move stays straight (<kbd>Shift</kbd>: free). Arrow keys nudge. <kbd>Ctrl</kbd>+click adds or removes a wall. <b>Turn by</b> turns them together about their centre (anticlockwise; a minus value turns clockwise).</p>`;}
  if(sel.kind==='wall'){const w=wallById(sel.id);if(!w){sel=null;return renderInspector();}const ext=wallExt(w);
    h=`<div class="selname">${selTitle(w.kind&&OUTW[w.kind]?OUTW[w.kind].label:'Wall',w)} <span class="selbtns"><button class="btn" id="copyBtn" title="Copy (Ctrl+C), then paste with Ctrl+V">Copy</button><button class="btn" id="delBtn">Delete</button></span></div><div class="kv">
      ${nameField(w,w.kind&&OUTW[w.kind]?'e.g. Back fence':'e.g. North wall')}${field('Length','wLen',fmtLen(wallLen(w)))}<label>Keep fixed</label><div class="seg" role="group" aria-label="Which end stays put when the length changes">${anchorButtons(w)}</div><label>Clear span</label><span class="ro">${fmtLen(wallLen(w)-ext[0]-ext[1])}</span>
      <label>Ends</label><div class="seg" role="group" aria-label="Joined or loose ends">${jointButtons(w)}</div>
      ${selectField('Type','wKind',WALLKINDS,w.kind||'wall')}${field('Thickness','wT',fmtLen(w.t))}${field('Height','wH',fmtLen(w.h))}${field('Angle','wAng',(Math.round(wallAngle(w)*100)/100)+'°','text')}${rotBtns('wrot')}</div>
      <div class="rowbtns"><button class="btn" id="unsnapBtn" title="Detach this wall from its neighbours so it moves on its own">Unsnap wall</button><button class="btn" id="snapEndsBtn" title="Join loose ends to walls they touch or to the nearest wall within reach">Snap ends</button></div>
      <p class="tip">${freeMove?'Drag the wall to move it in any direction (<b>Free move</b> is on).':'Drag the wall to push or pull it; turn on <b>Free move</b> or hold <kbd>Shift</kbd> to move it in any direction.'} Drag an end square to change its length. Type an <b>Angle</b> (any value, e.g. 18.5) to turn it about the end chosen under <b>Keep fixed</b>; joined walls stay joined. Orange circles mark loose ends. Arrow keys move it ${fmtLen(lenStep())} (with <kbd>Shift</kbd>: ${fmtLen(lenStep()*10)}).</p>`;}
  if(sel.kind==='opening'){const o=M.openings.find(x=>x.id===sel.id);if(!o){sel=null;return renderInspector();}const w=wallById(o.wall),ext=wallExt(w);
    h=`<div class="selname">${selTitle(o.kind==='door'?(isSliding(o)?'Sliding door':'Door'):'Window',o)} <span class="selbtns"><button class="btn" id="copyBtn" title="Copy (Ctrl+C), then paste with Ctrl+V">Copy</button><button class="btn" id="delBtn">Delete</button></span></div><div class="kv">
      ${nameField(o,o.kind==='door'?'e.g. Garden door':'e.g. Kitchen window')}${field('Width','oW',fmtLen(o.w))}${field('Height','oH',fmtLen(o.h))}${o.kind==='window'?field('Sill height','oSill',fmtLen(o.sill)):''}
      ${field('From face','oOff',fmtLen(o.s-o.w/2-ext[0]))}${o.kind==='door'?selectField('Type','oStyle',DOORSTYLES,o.style||'swing'):''}</div>${o.kind==='door'?(o.style==='slide2'?'':`<div class="rowbtns"><button class="btn" id="flipBtn">${isSliding(o)?'Other side of the wall':'Flip swing side'}</button><button class="btn" id="hingeBtn">${isSliding(o)?'Slide the other way':'Swap hinge'}</button></div>`):''}`;}
  if(sel.kind==='elec'){const E=elecById(sel.id);if(!E){sel=null;return renderInspector();}h=elecPanelHTML(E,field);}
  if(sel.kind==='elecs'){h=elecsPanelHTML(sel.ids);}
  if(sel.kind==='item'){const it=M.items.find(x=>x.id===sel.id);if(!it){sel=null;return renderInspector();}
    h=`<div class="selname">${selTitle(CAT[it.type].label,it)} <span class="selbtns"><button class="btn" id="copyBtn" title="Copy (Ctrl+C), then paste with Ctrl+V">Copy</button><button class="btn" id="delBtn">Delete</button></span></div><div class="kv">
      ${nameField(it,'e.g. Guest bed')}${it.type==='firepit'?`<label>Shape</label><div class="seg" role="group" aria-label="Fire pit shape"><button id="fpRound" aria-pressed="${it.shape!=='rect'}">Circular</button><button id="fpRect" aria-pressed="${it.shape==='rect'}">Rectangular</button></div>`:''}
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
// Turn walls by deg (anticlockwise on the plan, like the Angle readout) about point c. Doors, windows, columns and
// wall parts on the turned walls go with them; walls joined to them stay joined: their joined end follows.
function rotPt(p,c,deg){const t=deg*Math.PI/180,co=Math.cos(t),si=Math.sin(t),dx=p[0]-c[0],dy=p[1]-c[1];return [Math.round((c[0]+dx*co+dy*si)*10)/10,Math.round((c[1]-dx*si+dy*co)*10)/10];}
function rotateWalls(ws,deg,c){if(!ws.length||!deg)return;const ids=new Set(ws.map(w=>w.id)),moved=[];
  ws.forEach(w=>['a','b'].forEach(k=>{const np=rotPt(w[k],c,deg);connectedEnds(w,k).forEach(([o,ok])=>{if(!ids.has(o.id))moved.push([o,ok,np]);});moved.push([w,k,np]);}));
  const others=[...new Set(moved.filter(([o])=>!ids.has(o.id)).map(([o])=>o))];const ops=captureOpenings(others);
  moved.forEach(([o,k,np])=>{o[k]=np.slice();});restoreOpenings(ops);
  [...new Set(ws.map(w=>w.arcId).filter(Boolean))].forEach(id=>{const q=arcById(id);if(q){q.a=rotPt(q.a,c,deg);q.b=rotPt(q.b,c,deg);}});}
function wallPivot(w){return lenAnchor==='a'?w.a.slice():lenAnchor==='b'?w.b.slice():mul(add(w.a,w.b),.5);}
const wallAngle=w=>{const d=wallDir(w);let a=-Math.atan2(d[1],d[0])*180/Math.PI;if(a<0)a+=360;return a;};
function parseAngle(v){const x=parseFloat(String(v).replace(',','.').replace(/[°\s]/g,''));return isFinite(x)?x:null;}
function groupCentre(ws){let x0=1e18,y0=1e18,x1=-1e18,y1=-1e18;ws.forEach(w=>[w.a,w.b].forEach(p=>{x0=Math.min(x0,p[0]);y0=Math.min(y0,p[1]);x1=Math.max(x1,p[0]);y1=Math.max(y1,p[1]);}));return [(x0+x1)/2,(y0+y1)/2];}
const rotBtns=pre=>`<label></label><div class="seg segsm rotbtns" role="group" aria-label="Rotate"><button type="button" data-${pre}="15" title="Turn 15° anticlockwise">↺ 15°</button><button type="button" data-${pre}="-15" title="Turn 15° clockwise">↻ 15°</button><button type="button" data-${pre}="90" title="Turn 90° anticlockwise">↺ 90°</button><button type="button" data-${pre}="-90" title="Turn 90° clockwise">↻ 90°</button></div>`;
function setWallLength(w,L){const d=wallDir(w),oldA=w.a.slice(),oldB=w.b.slice();let na,nb;
  if(lenAnchor==='a'){na=oldA;nb=add(oldA,mul(d,L));}else if(lenAnchor==='b'){nb=oldB;na=sub(oldB,mul(d,L));}else{const c=mul(add(oldA,oldB),.5);na=sub(c,mul(d,L/2));nb=add(c,mul(d,L/2));}
  const ca=connectedEnds(w,'a'),cb=connectedEnds(w,'b');const ops=captureOpenings([w,...ca.map(x=>x[0]),...cb.map(x=>x[0])]);
  w.a=na;w.b=nb;ca.forEach(([o,k])=>o[k]=na.slice());cb.forEach(([o,k])=>o[k]=nb.slice());restoreOpenings(ops);}
function colPanel(c,isTool){const round=c.shape==='round',hosted=false;
  let h=isTool?`<p class="h">New column / pillar</p>`:`<div class="selname">${selTitle('Column / pillar',c)} <span class="selbtns"><button class="btn" id="copyBtn" title="Copy (Ctrl+C), then paste with Ctrl+V">Copy</button><button class="btn" id="delBtn">Delete</button></span></div>`;
  h+=`<div class="kv">${isTool?'':nameField(c,'e.g. Entrance pillar')}<label>Shape</label><div class="seg" role="group" aria-label="Shape"><button type="button" data-cshape="rect" aria-pressed="${!round}">Square / rect</button><button type="button" data-cshape="round" aria-pressed="${round}">Round</button></div>
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
    on('wAng',v=>{const a=parseAngle(v);if(a==null)return renderInspector();let d=((a-wallAngle(w))%360+540)%360-180;if(Math.abs(d)>1e-6)mutate(()=>rotateWalls([w],d,wallPivot(w)));renderInspector();dirty();});
    document.querySelectorAll('[data-wrot]').forEach(b=>b.onclick=()=>{mutate(()=>rotateWalls([w],+b.dataset.wrot,wallPivot(w)));renderInspector();dirty();});
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
  if(sel&&sel.kind==='elec'){const E=elecById(sel.id);if(E)bindElecPanel(E);}
  if(sel&&sel.kind==='elecs'){const pb=$('#eParallelAll');if(pb)pb.onclick=()=>{let n=0;mutate(()=>sel.ids.forEach(id=>{const E=elecById(id);if(E&&E.a&&stripParallel(E))n++;}));renderInspector();toast(n+' strip light'+(n===1?'':'s')+' turned parallel to the nearest wall.');};const db=$('#delBtn');if(db)db.onclick=()=>deleteSel();const cb=$('#copyBtn');if(cb)cb.onclick=()=>copySel();}
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
  if(sel&&sel.kind==='walls'){const ws=sel.ids.map(wallById).filter(Boolean);const turn=d=>{if(!d||!ws.length)return;mutate(()=>rotateWalls(ws,d,groupCentre(ws)));renderInspector();dirty();};
    on('mRot',v=>{const a=parseAngle(v);if(a==null)return renderInspector();turn(a);});document.querySelectorAll('[data-mrot]').forEach(b=>b.onclick=()=>turn(+b.dataset.mrot));}
  if(sel&&(sel.kind==='wall'||sel.kind==='walls')){const ids=selIds();
    const ub=$('#unsnapBtn');if(ub)ub.onclick=()=>{let n=0;mutate(()=>{n=unsnapWalls(ids);});toast(n?`Unsnapped ${n} joint${n>1?'s':''}. These walls now move on their own.`:'Nothing to unsnap: these walls are not joined to others.');};
    const sb=$('#snapEndsBtn');if(sb)sb.onclick=()=>{let n=0;mutate(()=>{n=snapWallEnds(ids);});toast(n?`Joined ${n} end${n>1?'s':''}.`:`No wall within ${fmtLen(Math.max(400,24/view.s),true)} to join.`);};
    document.querySelectorAll('[data-joint]').forEach(b=>b.onclick=()=>{const w=wallById(sel.id),k=b.dataset.joint;
      mutate(()=>{if(isLoose(w,k))snapWallEnds(new Set([w.id]),k);else{setLoose(w,k,true);M.walls.forEach(o=>{if(o!==w)['a','b'].forEach(ok=>{if(onWallInterior(o[ok],w))setLoose(o,ok,true);});});}});});
    const setAll=(k,v,min)=>{const x=parseLen(v);if(x>=min)mutate(()=>M.walls.forEach(w=>{if(ids.has(w.id))w[k]=x;}));renderInspector();};
    const mt=$('#mT');if(mt)mt.onchange=()=>setAll('t',mt.value,20);const mh=$('#mH');if(mh)mh.onchange=()=>setAll('h',mh.value,300);}
  const db=$('#delBtn');if(db)db.onclick=deleteSel;const cb=$('#copyBtn');if(cb)cb.onclick=()=>copySel();}
function rotV(v,deg){const a=deg*Math.PI/180;return [v[0]*Math.cos(a)-v[1]*Math.sin(a),v[0]*Math.sin(a)+v[1]*Math.cos(a)];}
function renderTakeoff(){epSidePanel();if(pMode)plSidePanel();
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
  const counts={},named=new Map(),nm=(n,type)=>{const k=n+'|'+type;named.set(k,(named.get(k)||0)+1);};
  M.items.forEach(i=>{if(i.name)nm(i.name,CAT[i.type]?CAT[i.type].label:i.type);else counts[i.type]=(counts[i.type]||0)+1;});
  const un=M.openings.filter(o=>!o.name);M.openings.forEach(o=>{if(o.name)nm(o.name,o.kind==='window'?'Window':isSliding(o)?'Sliding door':'Door');});
  const doors=un.filter(o=>o.kind==='door'&&!isSliding(o)).length,wins=un.filter(o=>o.kind==='window').length,slides=un.filter(isSliding).length;
  let s='';Object.keys(CAT).forEach(k=>{if(counts[k])s+=`<span>${CAT[k].label}</span><span>× ${counts[k]}</span>`;});
  s+=`<span>Doors</span><span>× ${doors}</span>${slides?`<span>Sliding doors</span><span>× ${slides}</span>`:''}<span>Windows</span><span>× ${wins}</span>`;
  const cu=(M.cols||[]).filter(c=>!c.name).length;(M.cols||[]).forEach(c=>{if(c.name)nm(c.name,'Column / pillar');});
  if(cu)s+=`<span>Columns</span><span>× ${cu}</span>`;
  named.forEach((n,k)=>{const [a,b]=k.split('|');s+=`<span><span translate="no">${esc(a)}</span> <small class="seltype">${b}</small></span><span>× ${n}</span>`;});
  {const yr=yardWallRuns();Object.keys(OUTW).forEach(k=>{if(yr[k])s+=`<span>${OUTW[k].label}</span><span>${fmtRun(yr[k])} ${runU()}</span>`;});}
  const run=M.items.filter(i=>COUNTER.has(i.type)).reduce((a,i)=>a+i.w,0);if(run)s+=`<span>Countertop run</span><span>${fmtRun(run)} ${runU()}</span>`;
  s+=elecSchedule();$('#sched').innerHTML=s;}
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
  if(opts.fixtures!==false)(M.elec||[]).forEach(E=>{const D=ELEC[E.type];if(!D)return;const L=D.group==='light'?'E-LITE':'E-POWR';
    if(E.a){LINE(L,E.a,E.b);if(E.label)TEXT(L,add(mul(add(E.a,E.b),.5),[0,-120]),120,E.label,0);return;}
    let c=elecPos(E);if(!c)return;if(E.wall){const P=elecWallPos(E);c=add(P.p,mul(P.n,120));}
    const r=E.type==='chandelier'?250:E.type==='spot'?60:100;ARC(L,c,r,0,360);
    if(E.type==='spot'||E.type==='garden'){const k=r*0.7;LINE(L,add(c,[-k,-k]),add(c,[k,k]));LINE(L,add(c,[-k,k]),add(c,[k,-k]));}
    const tag={switch:'S'+((E.gangs||1)>1?E.gangs:''),dimmer:'SD',socket:E.dbl?'2P':'P',wpsocket:'WP',wall:'WL',chandelier:'CH'}[E.type];
    if(tag||E.label)TEXT(L,add(c,[0,r+130]),110,(tag||'')+(E.label?' '+E.label:''),0);});
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
    ['A-COLS',6,'CONTINUOUS'],['A-AREA-IDEN',2,'CONTINUOUS'],['A-ANNO-DIMS',1,'CONTINUOUS'],['A-AREA-MEAS',30,'CONTINUOUS'],['L-SITE-FENCE',32,'CONTINUOUS'],['L-SITE-GWALL',8,'CONTINUOUS'],['L-SITE-HEDGE',3,'CONTINUOUS'],['E-LITE',2,'CONTINUOUS'],['E-POWR',6,'CONTINUOUS'],['L-SITE-RAILING',250,'CONTINUOUS'],['A-ANNO-TEXT',7,'CONTINUOUS'],...refLayers.map(n=>[n,9,'CONTINUOUS'])];
  const T=['0','SECTION','2','TABLES',
    '0','TABLE','2','LTYPE','70','2',
    '0','LTYPE','2','CONTINUOUS','70','0','3','Solid line','72','65','73','0','40','0',
    '0','LTYPE','2','DASHED','70','0','3','Dashed __ __ __','72','65','73','2','40',num(dash[0]-dash[1]),'49',num(dash[0]),'49',num(dash[1]),
    '0','ENDTAB','0','TABLE','2','LAYER','70',String(layers.length)];
  layers.forEach(([n,c,lt])=>T.push('0','LAYER','2',n,'70','0','62',String(c),'6',lt));
  T.push('0','ENDTAB','0','TABLE','2','STYLE','70','1','0','STYLE','2','STANDARD','70','0','40','0','41','1','50','0','71','0','42','2.5','3','txt','4','','0','ENDTAB','0','ENDSEC');
  return [...H,...T,'0','SECTION','2','BLOCKS','0','ENDSEC','0','SECTION','2','ENTITIES',...E,'0','ENDSEC','0','EOF'].join('\r\n')+'\r\n';}

/* ============================== modal ============================== */
// askModal: a question that waits for the answer (null when the dialog is dismissed with Esc / back)
let modalResolve=null;
function askModal(title,text,buttons,body,wide){return new Promise(res=>{openModal(title,text,null,buttons.map(b=>({label:b.label,primary:b.primary,fn:()=>modalPick(b.value)})),body,wide);modalResolve=res;});}
function modalPick(v){const r=modalResolve;modalResolve=null;closeModal();if(r)r(v);}
function openModal(title,text,area,buttons,bodyNode,wide){if(modalResolve){const r=modalResolve;modalResolve=null;r(null);}delete $('#modal').dataset.exit;$('#modalTitle').textContent=title;$('#modalText').textContent=text;const ta=$('#modalArea');ta.hidden=area==null;if(area!=null)ta.value=area;
  const mb=$('#modalBody');mb.innerHTML='';if(bodyNode)mb.appendChild(bodyNode);mb.hidden=!bodyNode;$('#modal .card').classList.toggle('wide',!!wide);
  const bb=$('#modalBtns');bb.innerHTML='';buttons.forEach(b=>{const e=document.createElement('button');e.className='btn'+(b.primary?' primary':'');e.textContent=b.label;e.onclick=()=>b.fn(e);bb.appendChild(e);});$('#modal').hidden=false;bb.lastChild&&bb.lastChild.focus();}
function closeModal(){$('#modal').hidden=true;$('#modalBody').innerHTML='';delete $('#modal').dataset.exit;if(modalResolve){const r=modalResolve;modalResolve=null;r(null);}}
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
function markSaved(){if(!activeTab)return;activeTab.savedSnap=snapshot();activeTab.lastSaved=Date.now();activeTab.filePath=filePath;activeTab.stored=false;saveTabsNow();renderTabs();recordLast(activeTab);if(filePath)recentAdd(filePath,M.name);}
// recently opened or saved project files (desktop and Android app, where files have a path), newest first
function recentList(){try{const a=JSON.parse(localStorage.getItem('bm-recent')||'[]');return Array.isArray(a)?a.filter(r=>r&&r.path):[];}catch(e){return [];}}
function recentAdd(path,name){if(!NATIVE||!path)return;const a=recentList().filter(r=>r.path!==path);a.unshift({path,name:name||fileProjName(path)||baseName(path),at:Date.now()});try{localStorage.setItem('bm-recent',JSON.stringify(a.slice(0,8)));}catch(e){}}
function recentDrop(path){try{localStorage.setItem('bm-recent',JSON.stringify(recentList().filter(r=>r.path!==path)));}catch(e){}}
async function openRecent(r){if(!r)return;let text=null;try{text=await TAURI.fs.readTextFile(r.path);}catch(e){}
  if(text==null){recentDrop(r.path);toast('Could not find '+baseName(r.path)+'. It may have been moved or deleted.');return;}await openProject({path:r.path,text});}
// "Kitchen plan.bench.json" -> "Kitchen plan" (null when the path has no readable file name, e.g. an Android content id)
function fileProjName(p){const b=baseName(p||'');if(!/\.json$/i.test(b))return null;const n=b.replace(/\.bench\.json$/i,'').replace(/\.json$/i,'').trim();return n||null;}
// the last project worked on, offered as "Continue" the next time the app starts
function recordLast(t){if(!t||tabIsBlank(t))return;if(t===activeTab)storeActive();const rec={name:t.M.name||'Untitled project',filePath:t.filePath||null,savedAt:t.lastSaved||Date.now(),data:JSON.parse(tabJSON(t)),big:!!(t.ref||t.img)};
  delete rec.data.reference;delete rec.data.refImage;try{localStorage.setItem('bm-last',JSON.stringify(rec));}catch(e){}bigSave('last',t.ref,t.img);}
function lastRecord(){try{const r=JSON.parse(localStorage.getItem('bm-last')||'null');return r&&r.data&&r.data.model&&Array.isArray(r.data.model.walls)?r:null;}catch(e){return null;}}
async function saveProject(as){
  try{const text=projectJSON();
    if(NATIVE&&filePath&&!as){await TAURI.fs.writeTextFile(filePath,text);markSaved();toast('Saved '+baseName(filePath));return true;}
    const p=await saveTextFile(safeName(M.name)+'.bench.json',text,'Benchmark project',['json']);if(p){if(NATIVE){filePath=p;const nm=fileProjName(p);if(nm&&nm!==M.name){M.name=nm;$('#projName').value=nm;try{await TAURI.fs.writeTextFile(p,projectJSON());}catch(e){}}}markSaved();toast('Saved '+baseName(p));return true;}return false;}
  catch(err){toast('Could not save: '+err);return false;}}
async function openProject(given){
  try{const f=given||await openProjectFile();if(!f)return;const o=JSON.parse(f.text);const m=o&&o.model;
    if(!m||!Array.isArray(m.walls)||!Array.isArray(m.items)||!Array.isArray(m.openings))throw new Error('this is not a Benchmark project file');
    // opens in its own tab, unless this tab is still empty
    const already=f.path&&tabs.find(t=>t.filePath===f.path);if(already){switchTab(already.id);toast(baseName(f.path)+' is already open.');return;}
    storeActive();const fm=Object.assign(blankModel(),m);if(!m.name||m.name==='Untitled project'){const nm=fileProjName(f.path);if(nm)fm.name=nm;}const t=makeTab(fm,{units:normUnits(o.units||units),ref:o.reference||null,img:o.refImage||null,filePath:NATIVE?f.path:null,lastSaved:Date.now()});
    t.savedSnap=JSON.stringify(t.M);if(activeTab&&tabIsBlank(activeTab)&&!tabDirty(activeTab)){const i=tabs.indexOf(activeTab);tabs.splice(i,1,t);try{localStorage.removeItem('bm-tab-'+activeTab.id);}catch(e){}}else tabs.push(t);
    activate(t,true);saveTabsNow();recordLast(t);if(t.filePath)recentAdd(t.filePath,t.M.name);toast('Opened '+(f.path?baseName(f.path):M.name));}
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
// does this look like a Bosch laser? by name, by Bosch's Bluetooth company id (0x02A6) or by the measuring service
// which characteristic carries the measurements: the classic Bosch one, the newer Bosch one, or any notify+write pair in a vendor service
const GLM_ALT={SVC:'00005301-0000-0041-5253-534f46540000',CHR:'00004301-0000-0041-5253-534f46540000'};
const STD_UUID=/-0000-1000-8000-00805f9b34fb$/i;
function laserTarget(svcs){const L=u=>String(u||'').toLowerCase();const all=[];(svcs||[]).forEach(S=>(S.characteristics||[]).forEach(c=>all.push({svc:L(S.uuid),chr:L(c.uuid),p:+c.properties||0})));
  const wt=c=>c&&!(c.p&8)&&(c.p&4)?'withoutResponse':'withResponse';
  for(const K of [GLM,GLM_ALT]){const c=all.find(x=>x.chr===K.CHR);if(c)return {svc:c.svc,chr:c.chr,wt:wt(c)};}
  const c=all.find(x=>!STD_UUID.test(x.svc)&&(x.p&48)&&(x.p&12));if(c)return {svc:c.svc,chr:c.chr,wt:wt(c)};
  return {svc:GLM.SVC,chr:GLM.CHR,wt:'withResponse'};}
const charFlags=p=>[[2,'read'],[4,'write-no-reply'],[8,'write'],[16,'notify'],[32,'indicate']].filter(([b])=>p&b).map(([,n])=>n).join(', ');
function laserDiag(d,svcs,step,e){const es=String(e&&e.message||e);
  if(step==='connect'&&/Status: ?(133|147|8|62)\b|timeout|timed out/i.test(es)){
    openModal('The laser didn’t answer','The phone found '+(d.name||'the laser')+' but it didn’t accept the connection (tried 3 times). This usually means the laser went to sleep or is still connected to something else.\n\n1. Press the laser’s measure button once to wake it, and check the Bluetooth symbol is on in its display.\n2. Close the Bosch app, and in the phone’s Bluetooth settings make sure the laser isn’t connected to anything.\n3. If it still fails: switch the laser off and on, turn the phone’s Bluetooth off and on, then try again.',null,
      [{label:'Details',fn:()=>{closeModal();laserDiagFull(d,svcs,step,e);}},{label:'Try again',primary:true,fn:()=>{closeModal();laserConnect();}}]);return;}
  laserDiagFull(d,svcs,step,e);}
function laserDiagFull(d,svcs,step,e){const lines=['Device: '+(d.name||'?')+' ('+d.address+')','Failed at: '+step,'Error: '+String(e&&e.message||e),'Services:'];
  (svcs||[]).forEach(S=>{lines.push('  '+S.uuid);(S.characteristics||[]).forEach(c=>lines.push('    '+c.uuid+'  ['+charFlags(+c.properties||0)+']'));});if(!svcs)lines.push('  (could not read them)');
  const txt=lines.join('\n');
  openModal('Couldn’t connect to the laser','The laser was found but the connection didn’t finish. Check that the Bosch app is closed and Bluetooth is on in the laser’s menu, then try again. If it keeps failing, copy this and send it to whoever set up the app — it shows exactly what the laser offers.',txt,
    [{label:'Copy',fn:b=>copyText(txt,b)},{label:'Try again',fn:()=>{closeModal();laserConnect();}},{label:'Close',primary:true,fn:closeModal}]);}
const isLaserDev=d=>GLM.NAME.test(d.name||'')||Object.keys(d.manufacturerData||{}).some(k=>+k===0x02A6)||(d.services||[]).some(u=>[GLM.SVC,GLM_ALT.SVC].includes(String(u).toLowerCase()));
async function blecConnect(){
  try{const ok=await binv('check_permissions',{askIfDenied:true});if(ok===false){laserFail('Bluetooth permission (“Nearby devices”) wasn’t given to Benchmark Planner. Allow it in the phone’s Settings → Apps → Benchmark Planner → Permissions.');return;}}
  catch(e){laserFail(/not found|unknown|plugin/i.test(String(e))?'This copy of the app was built without Bluetooth. Install the newest build.':e);return;}
  try{const st=await binv('get_adapter_state');if(String(st).toLowerCase()==='off'){laserFail('Bluetooth is off on this device. Turn it on, then press Laser again.');return;}}catch(e){}
  const body=document.createElement('div');body.className='lzscan';
  body.innerHTML=`<p class="tip" id="lzScanNote"></p><div class="lzlist" id="lzList"></div>
    <label class="lzall"><input type="checkbox" id="lzAll"> Show every Bluetooth device</label>
    <p class="tip">On the laser: switch it on, open its settings menu and turn Bluetooth on (the Bluetooth symbol shows in the display). Close the Bosch app if it is connected — the laser talks to one app at a time.</p>`;
  let done=false,timer=0;const stop=()=>{if(done)return;done=true;clearTimeout(timer);binv('stop_scan').catch(()=>{});};
  openModal('Connect a laser measure','',null,[{label:'Cancel',fn:()=>{stop();closeModal();}},{label:'Search again',fn:()=>{stop();done=false;scan();}}],body);
  const list=$('#lzList'),all=$('#lzAll'),note=t=>{const n=$('#lzScanNote');if(n)n.textContent=t;};
  const sig=r=>r==null?'':r>-60?'strong signal':r>-80?'good signal':'weak signal';
  const render=()=>{const devs=laser.scanList.filter(d=>all.checked||isLaserDev(d)).sort((a,b)=>(isLaserDev(b)-isLaserDev(a))||((b.rssi||-999)-(a.rssi||-999)));
    list.innerHTML=devs.length?devs.map(d=>{const nm=d.name&&d.name!==d.address?d.name:'Unnamed device';return `<button class="btn lzdev${isLaserDev(d)?' lzhit':''}" data-a="${esc(d.address)}"><b>${esc(nm)}</b><span>${esc(sig(d.rssi))} · ${esc(d.address)}</span></button>`;}).join(''):'<p class="tip">Nothing found yet.</p>';
    list.querySelectorAll('[data-a]').forEach(b=>b.onclick=()=>{stop();pick(laser.scanList.find(d=>d.address===b.dataset.a));});};
  all.onchange=render;
  const pick=async d=>{if(!d)return;closeModal();setLaserState('connecting');let svcs=null,step='connect';
    try{// stop the search first and give the phone a moment: many Android phones fail to connect while still scanning.
      // Android often times out on the first try (status 133/147), so try up to three times.
      try{await binv('stop_scan');}catch(_){}await new Promise(r=>setTimeout(r,400));
      let last=null;for(let i=0;i<3;i++){try{if(i){toast('The laser didn’t answer, trying again ('+(i+1)+' of 3)…');try{await binv('disconnect');}catch(_){}await new Promise(r=>setTimeout(r,1200));}
          await binv('connect',{address:d.address,onDisconnect:bchan(()=>onLaserLost()),allowIbeacons:false});last=null;break;}catch(e){last=e;}}
      if(last)throw last;
      step='list services';try{svcs=await binv('list_services',{address:d.address});}catch(e){svcs=null;}
      const T=laserTarget(svcs);step='subscribe to '+T.chr;
      await binv('subscribe',{characteristic:T.chr,service:T.svc,onData:bchan(v=>onLaserData(v))});
      step='turn on sync';await binv('send',{characteristic:T.chr,data:GLM.SYNC,writeType:T.wt,service:T.svc});
      lastLaser={address:d.address,name:d.name};try{localStorage.setItem('bm-laser',JSON.stringify(lastLaser));}catch(e){}
      laser.target=T;setLaserState('on',d.name&&d.name!==d.address?d.name:'Laser');toast('Connected to '+laser.name+'. Press Read, then measure.');
    }catch(e){binv('disconnect').catch(()=>{});setLaserState('off');laserDiag(d,svcs,step,e);}};
  const progress=()=>{const n=laser.scanList.length,k=laser.scanList.filter(isLaserDev).length;
    note(done?'':k?`Found ${k===1?'a laser':k+' lasers'}. Tap it to connect.`:`Searching… ${n} Bluetooth device${n===1?'':'s'} nearby so far.`);};
  const finish=()=>{if(done)return;stop();const n=laser.scanList.length,k=laser.scanList.filter(isLaserDev).length;
    if(k)note('Search finished. Tap your laser to connect.');
    else if(n){all.checked=true;render();note(`No device named like a Bosch laser among the ${n} found. If one of these is your laser (it may show without a name — try the strongest signal), tap it. Otherwise check the laser’s Bluetooth and Search again.`);}
    else note('No Bluetooth devices found at all. Check that Bluetooth is on, and on Android 11 or older also turn on Location (Android needs it to search). Then Search again.');};
  const scan=()=>{laser.scanList=[];render();note('Searching… Keep the laser on and close to this device.');
    timer=setTimeout(finish,15000);
    binv('scan',{timeout:15000,onDevices:bchan(devs=>{if(done)return;laser.scanList=devs||[];render();progress();
      const again=lastLaser&&laser.scanList.find(d=>d.address===lastLaser.address);if(again){stop();pick(again);}}),allowIbeacons:false})
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


/* ============================== electrical layer: lights, switches and sockets ============================== */
// A layer drawn on top of the plan, shown or hidden with the Electrical button. Wall-mounted parts (wall lights, switches,
// sockets) sit on a wall face and slide along it; ceiling lights and garden lights sit anywhere; strip lights are a line.
const ELEC={
  spot:{label:'Spot light',group:'light',mount:'ceiling',power:0.45,range:3.5},
  chandelier:{label:'Chandelier',group:'light',mount:'ceiling',drop:700,power:1.6,range:7},
  strip:{label:'Strip light',group:'light',mount:'line',h:2400,power:0.5,range:3},
  wall:{label:'Wall light',group:'light',mount:'wall',h:1800,power:0.8,range:4},
  garden:{label:'Garden light',group:'light',mount:'free',h:600,power:0.7,range:4},
  switch:{label:'Switch',group:'switch',mount:'wall',h:1100},
  dimmer:{label:'Dimmer switch',group:'switch',mount:'wall',h:1100},
  socket:{label:'Socket',group:'plug',mount:'wall',h:300},
  wpsocket:{label:'Outdoor socket',group:'plug',mount:'wall',h:450}};
const ELEC_COL={light:'#c98a00',lightFill:'#ffd84d',switch:'#6741d9',plug:'#6741d9'};
let elecOn=true;try{elecOn=localStorage.getItem('bm-elec')!=='0';}catch(e){}
let elecGhost=null,stripStart=null;
const elecList=()=>M.elec||(M.elec=[]);
const elecById=id=>elecList().find(e=>e.id===id);
function setElecLayer(on){elecOn=on;try{localStorage.setItem('bm-elec',on?'1':'0');}catch(e){}const b=$('#elecBtn');if(b)b.setAttribute('aria-pressed',String(on));
  document.querySelectorAll('[data-tool="elec"]').forEach(x=>{x.classList.toggle('lockd',!on);x.setAttribute('aria-disabled',String(!on));x.title=x.title.replace(/ \(turn on Electrical first\)$/,'')+(on?'':' (turn on Electrical first)');});
  if(!on&&tool==='elec')setTool('select');if(!on&&sel&&(sel.kind==='elec'||sel.kind==='elecs')){sel=null;renderInspector();}dirty();schedule3d();}
// where a wall-mounted part is: point on the wall face, and the direction pointing into the room
function elecWallPos(E){const w=wallById(E.wall);if(!w)return null;const d=wallDir(w),n=mul(perp(d),E.side||1);const s=clamp(E.s,0,wallLen(w));
  return {p:add(add(w.a,mul(d,s)),mul(n,w.t/2)),n,d,w};}
function elecPos(E){if(E.a)return mul(add(E.a,E.b),.5);if(E.wall){const q=elecWallPos(E);return q?q.p:null;}return [E.x,E.y];}
function wallSlot(p,tolPx=40){const w=nearestWall(p,tolPx);if(!w)return null;const d=wallDir(w),L=wallLen(w);let s=clamp(dot(sub(p,w.a),d),60,L-60);
  if(snapOn&&!shiftDown)s=Math.round(s/lenStep())*lenStep();const side=dot(sub(p,w.a),perp(d))>=0?1:-1;return {wall:w.id,s,side};}
function elecHeightDefault(t){return ELEC[t].h||null;}
function newElec(t,at){const D=ELEC[t],E={id:nid('e'),type:t};if(D.h)E.h=D.h;if(t==='switch')E.gangs=1;if(t==='socket')E.dbl=true;Object.assign(E,at);return E;}

// ---- drawing
function elecSize(){return clamp(view.s*170,7,15);}
function drawElecItem(E,selected,ghost){const D=ELEC[E.type];if(!D)return;const s=elecSize();ctx.save();ctx.globalAlpha=ghost?0.6:1;
  const lc=ELEC_COL.light,pc=ELEC_COL.plug;ctx.lineWidth=1.6;
  const ring=(q,r)=>{if(!selected)return;ctx.save();ctx.strokeStyle=C.accent;ctx.lineWidth=2;ctx.setLineDash([3,2]);ctx.beginPath();ctx.arc(q[0],q[1],r,0,Math.PI*2);ctx.stroke();ctx.restore();};
  if(D.mount==='line'){const a=toS(E.a),b=toS(E.b);ctx.lineCap='round';ctx.strokeStyle=ELEC_COL.lightFill;ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);ctx.stroke();
    ctx.strokeStyle=lc;ctx.lineWidth=1.4;ctx.setLineDash([5,4]);ctx.beginPath();ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);ctx.stroke();ctx.setLineDash([]);
    [a,b].forEach(q=>{ctx.fillStyle=lc;ctx.beginPath();ctx.arc(q[0],q[1],2.6,0,Math.PI*2);ctx.fill();});
    if(selected){ctx.strokeStyle=C.accent;ctx.lineWidth=1;ctx.setLineDash([3,2]);ctx.beginPath();ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);ctx.stroke();ctx.setLineDash([]);
      [a,b].forEach(q=>{ctx.fillStyle=C.paper;ctx.strokeStyle=C.accent;ctx.lineWidth=1.5;ctx.fillRect(q[0]-4,q[1]-4,8,8);ctx.strokeRect(q[0]-4,q[1]-4,8,8);});}
    ctx.restore();return;}
  if(D.mount==='wall'){const P=elecWallPos(E)||(E._ghost);if(!P){ctx.restore();return;}const q=toS(P.p),n=P.n,ang=Math.atan2(n[1],n[0]);
    ctx.translate(q[0],q[1]);ctx.rotate(ang);   // local +x points into the room, the wall face is the y axis
    if(E.type==='wall'){ctx.fillStyle=ELEC_COL.lightFill;ctx.strokeStyle=lc;ctx.beginPath();ctx.arc(0,0,s*0.8,-Math.PI/2,Math.PI/2);ctx.closePath();ctx.fill();ctx.stroke();
      ctx.beginPath();for(let i=-2;i<=2;i++){const a=i*0.55;ctx.moveTo(Math.cos(a)*s*0.95,Math.sin(a)*s*0.95);ctx.lineTo(Math.cos(a)*s*1.3,Math.sin(a)*s*1.3);}ctx.stroke();}
    else if(D.group==='plug'){ctx.fillStyle=C.paper;ctx.strokeStyle=pc;ctx.beginPath();ctx.arc(0,0,s*0.7,-Math.PI/2,Math.PI/2);ctx.closePath();ctx.fill();ctx.stroke();
      ctx.beginPath();const k=E.dbl||E.type==='wpsocket'?[-0.28,0.28]:[0];k.forEach(y=>{ctx.moveTo(s*0.7,y*s);ctx.lineTo(s*1.25,y*s);});ctx.stroke();
      if(E.type==='wpsocket'){ctx.rotate(-ang);ctx.fillStyle=pc;ctx.font='700 '+Math.round(s*0.7)+'px '+getComputedStyle(document.body).fontFamily;ctx.textAlign='center';ctx.textBaseline='middle';const t=mul(n,s*1.9);ctx.fillText('WP',t[0],t[1]);ctx.rotate(ang);}}
    else{ // switch: a small circle off the wall with a lever line, one tick per gang; dimmers get an arrow
      const cx=s*0.9;ctx.strokeStyle=pc;ctx.fillStyle=pc;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(cx-3,0);ctx.stroke();ctx.beginPath();ctx.arc(cx,0,3.2,0,Math.PI*2);ctx.fill();
      const lv=[Math.cos(-0.8)*s*1.1,Math.sin(-0.8)*s*1.1];ctx.beginPath();ctx.moveTo(cx,0);ctx.lineTo(cx+lv[0],lv[1]);
      const g=E.type==='dimmer'?1:clamp(E.gangs||1,1,4);for(let i=0;i<g;i++){const t=1-i*0.22,px=cx+lv[0]*t,py=lv[1]*t,pp=[Math.cos(0.77)*4,Math.sin(0.77)*4];ctx.moveTo(px,py);ctx.lineTo(px+pp[0],py+pp[1]);}ctx.stroke();
      if(E.type==='dimmer'){ctx.beginPath();ctx.arc(cx,0,s*0.75,-0.3,1.2);ctx.stroke();const e=[cx+Math.cos(1.2)*s*0.75,Math.sin(1.2)*s*0.75];ctx.beginPath();ctx.moveTo(e[0],e[1]);ctx.lineTo(e[0]+4,e[1]-1);ctx.lineTo(e[0]+1,e[1]-4);ctx.closePath();ctx.fill();}}
    ctx.restore();if(selected)ring(add(q,mul(n,s*0.8)),s*1.5);elecLabel(E,add(q,mul(n,s*2.2)));return;}
  const q=toS([E.x,E.y]);
  if(E.type==='spot'){ctx.fillStyle=ELEC_COL.lightFill;ctx.strokeStyle=lc;ctx.beginPath();ctx.arc(q[0],q[1],s*0.55,0,Math.PI*2);ctx.fill();ctx.stroke();
    const r=s*0.55*0.72;ctx.beginPath();ctx.moveTo(q[0]-r,q[1]-r);ctx.lineTo(q[0]+r,q[1]+r);ctx.moveTo(q[0]+r,q[1]-r);ctx.lineTo(q[0]-r,q[1]+r);ctx.stroke();ring(q,s*0.9);}
  else if(E.type==='chandelier'){const R=s*1.05;ctx.strokeStyle=lc;ctx.fillStyle=ELEC_COL.lightFill;ctx.beginPath();ctx.arc(q[0],q[1],R*0.42,0,Math.PI*2);ctx.fill();ctx.stroke();
    ctx.beginPath();for(let i=0;i<8;i++){const a=i/8*Math.PI*2;ctx.moveTo(q[0]+Math.cos(a)*R*0.42,q[1]+Math.sin(a)*R*0.42);ctx.lineTo(q[0]+Math.cos(a)*R,q[1]+Math.sin(a)*R);}ctx.stroke();
    for(let i=0;i<8;i+=2){const a=i/8*Math.PI*2;ctx.beginPath();ctx.arc(q[0]+Math.cos(a)*R,q[1]+Math.sin(a)*R,2.2,0,Math.PI*2);ctx.fill();ctx.stroke();}ring(q,R*1.3);}
  else if(E.type==='garden'){ctx.fillStyle=ELEC_COL.lightFill;ctx.strokeStyle=lc;ctx.beginPath();ctx.arc(q[0],q[1],s*0.45,0,Math.PI*2);ctx.fill();ctx.stroke();
    ctx.beginPath();for(let i=0;i<8;i++){const a=i/8*Math.PI*2+Math.PI/8;ctx.moveTo(q[0]+Math.cos(a)*s*0.65,q[1]+Math.sin(a)*s*0.65);ctx.lineTo(q[0]+Math.cos(a)*s*0.95,q[1]+Math.sin(a)*s*0.95);}ctx.stroke();ring(q,s*1.15);}
  ctx.restore();elecLabel(E,[q[0]+s*1.2,q[1]-s*0.9],true);}
function elecLabel(E,q,screen){if(!E.label)return;ctx.save();ctx.font='600 10.5px '+getComputedStyle(document.body).fontFamily;ctx.fillStyle=ELEC[E.type].group==='light'?ELEC_COL.light:ELEC_COL.plug;ctx.textAlign=screen?'left':'center';ctx.textBaseline='middle';ctx.fillText(E.label,q[0],q[1]);ctx.restore();}

// several electrical parts selected together: {kind:'elecs', ids}
const elecSelIds=()=>!sel?[]:sel.kind==='elec'?[sel.id]:sel.kind==='elecs'?sel.ids.slice():[];
function setSelElecs(ids){ids=[...new Set(ids)].filter(id=>elecById(id));sel=!ids.length?null:ids.length===1?{kind:'elec',id:ids[0]}:{kind:'elecs',ids};renderInspector();dirty();}
function toggleSelElec(id){const ids=elecSelIds();const i=ids.indexOf(id);if(i>=0)ids.splice(i,1);else ids.push(id);setSelElecs(ids);}
function elecInBox(a,b,crossing){if(!elecOn||!M.elec)return [];const x0=Math.min(a[0],b[0]),x1=Math.max(a[0],b[0]),y0=Math.min(a[1],b[1]),y1=Math.max(a[1],b[1]);const ins=q=>q&&q[0]>=x0&&q[0]<=x1&&q[1]>=y0&&q[1]<=y1;
  return M.elec.filter(E=>E.a?(crossing?ins(E.a)||ins(E.b):ins(E.a)&&ins(E.b)):ins(elecPos(E))).map(E=>E.id);}
function elecShift(E,E0,dv){if(E0.a){E.a=add(E0.a,dv);E.b=add(E0.b,dv);return;}
  if(E0.wall){const P=elecWallPos(E0);if(!P)return;const sl=wallSlot(add(add(P.p,mul(P.n,30)),dv),60);if(sl){E.wall=sl.wall;E.s=sl.s;E.side=sl.side;}return;}
  E.x=E0.x+dv[0];E.y=E0.y+dv[1];}
function elecGroupMove(drag,p){let dv=sub(p,drag.p0);if(snapOn&&!shiftDown)dv=[Math.round(dv[0]/lenStep())*lenStep(),Math.round(dv[1]/lenStep())*lenStep()];
  drag.e0.forEach(E0=>{const E=elecById(E0.id);if(E)elecShift(E,E0,dv);});drag.snap={kind:drag.e0.length+' parts'};}
function elecNudge(ids,v,step){ids.forEach(id=>{const E=elecById(id);if(!E)return;const E0=JSON.parse(JSON.stringify(E));
  if(E.wall){const w=wallById(E.wall);if(!w)return;const a=dot(v,wallDir(w));if(Math.abs(a)>0.5)E.s=clamp(E.s+Math.sign(a)*step,0,wallLen(w));return;}elecShift(E,E0,mul(v,step));});}
function elecsPanelHTML(ids){const c={};ids.forEach(id=>{const E=elecById(id);if(E)c[E.type]=(c[E.type]||0)+1;});
  return `<div class="selname">${ids.length} electrical parts<span class="selbtns"><button class="btn" id="copyBtn">Copy</button><button class="btn" id="delBtn">Delete</button></span></div>${c.strip?'<div class="rowbtns" style="margin-bottom:8px"><button class="btn" id="eParallelAll">Make the strips parallel to their walls</button></div>':''}<div class="kv">${Object.keys(c).map(k=>`<label>${ELEC[k].label}</label><span class="ro">× ${c[k]}</span>`).join('')}</div>
    <p class="tip">Drag any of them to move them all, or use the arrow keys. <kbd>Ctrl</kbd>/<kbd>Shift</kbd>+click adds or removes one; <kbd>Ctrl+C</kbd> / <kbd>Ctrl+V</kbd> copies and pastes them; <kbd>Del</kbd> deletes them.</p>`;}
// distances from a point to the nearest wall faces, along x and y (or along given directions)
function rayToWall(p,dir){let best=null,bt=1e12;M.walls.forEach(w=>{[[0,wallLen(w)]].forEach(([s0,s1])=>{const q=pieceQuad(w,s0,s1);   // whole wall: measure to the face even across doors and windows
    for(let i=0;i<4;i++){const a=q[i],b=q[(i+1)%4],e=sub(b,a),den=cross(dir,e);if(Math.abs(den)<1e-9)continue;const t=cross(sub(a,p),e)/den,u=cross(sub(a,p),dir)/den;
      if(t>1&&u>=0&&u<=1&&t<bt){bt=t;best=add(p,mul(dir,t));}}});});return best&&bt<30000?best:null;}
function nearestAlong(p,dirs){let best=null;dirs.forEach(d=>{const q=rayToWall(p,d);if(q&&(!best||dist(p,q)<dist(p,best)))best=q;});return best;}
function drawElecDims(E){if(!E||!M.walls.length)return;const col=ELEC_COL.light,o={width:1.1};
  if(E.a){const d=norm(sub(E.b,E.a)),n=perp(d),m=mul(add(E.a,E.b),.5);
    [[m,[n,mul(n,-1)]],[E.a,[mul(d,-1)]],[E.b,[d]]].forEach(([p,ds])=>{const q=nearestAlong(p,ds);if(q&&dist(p,q)>5)drawMeasure(p,q,col,o);});return;}
  const p=[E.x,E.y];[[[1,0],[-1,0]],[[0,1],[0,-1]]].forEach(ds=>{const q=nearestAlong(p,ds);if(q&&dist(p,q)>5)drawMeasure(p,q,col,o);});}
function drawElecLayer(){if(!elecOn||!M.elec)return;const ids=new Set(elecSelIds());M.elec.forEach(E=>drawElecItem(E,ids.has(E.id),false));
  if(!EXP&&sel&&sel.kind==='elec'){const E=elecById(sel.id);if(E&&!E.wall)drawElecDims(E);if(E)drawLightDist(E,E.id);}}
// distance from a light to the nearest other light (to a strip light: its nearest point), drawn in purple
const LIGHT_DIST_COL='#9c36b5';
function nearestLight(p,skipId){let best=null,bd=1e12;(M.elec||[]).forEach(E=>{if(E.id===skipId||ELEC[E.type].group!=='light')return;const q=E.a?segClosest(p,E.a,E.b).q:elecPos(E);if(!q)return;const d=dist(p,q);if(d<bd){bd=d;best=q;}});return best;}
function drawLightDist(E,skipId){if(!E||!ELEC[E.type]||ELEC[E.type].group!=='light')return;
  const pts=E.a?(E.b&&dist(E.a,E.b)>1?[E.a,E.b]:[E.a]):[E.wall?((elecWallPos(E)||{}).p):[E.x,E.y]];
  let best=null;pts.forEach(p=>{if(!p)return;const q=nearestLight(p,skipId);if(q&&(!best||dist(p,q)<dist(best[0],best[1])))best=[p,q];});
  if(best&&dist(best[0],best[1])>20)drawMeasure(best[0],best[1],LIGHT_DIST_COL,{width:1.3});}
function drawElecTool(){if(tool!=='elec')return;
  if(ELEC[placeType]&&ELEC[placeType].group==='light'){if(placeType==='strip'){const a=stripStart||(elecGhost&&elecGhost.c);if(a)drawLightDist({type:'strip',a,b:stripStart&&elecGhost&&elecGhost.b||a},'ghost');}else if(elecGhost)drawLightDist(elecGhost,'ghost');}
  if(placeType==='strip'&&!stripStart&&elecGhost&&elecGhost.c)drawElecDims({x:elecGhost.c[0],y:elecGhost.c[1]});
  if(placeType==='strip'){if(stripStart){const b=elecGhost&&elecGhost.b||stripStart;drawElecItem({type:'strip',a:stripStart,b},true,true);if(dist(stripStart,b)>50)drawElecDims({a:stripStart,b});const L=dist(stripStart,b);if(L>1){const m=toS(mul(add(stripStart,b),.5));txt(fmtLen(L,true),[m[0],m[1]-14],{weight:'600',size:11,color:ELEC_COL.light});}}return;}
  if(elecGhost){drawElecItem(elecGhost,false,true);if(elecGhost.x!=null)drawElecDims(elecGhost);}}
// Strip lights line up with the wall they run along: when the strip points within ~12° of a nearby wall
// (angled walls included), its free end is turned to run exactly parallel to that wall. Shift = no alignment.
function stripWallNear(a,b,maxD){let best=null,bd=maxD;const m=b?mul(add(a,b),.5):a;M.walls.forEach(w=>{if(w.kind)return;const c=segClosest(m,w.a,w.b);const d=dist(m,c.q)-w.t/2;if(d<bd){bd=d;best=w;}});return best;}
function stripAlign(a,b){if(shiftDown||dist(a,b)<50)return {p:b,w:null};const v=sub(b,a),L=vlen(v),u=mul(v,1/L);let best=null,ba=0.21;
  M.walls.forEach(w=>{if(w.kind)return;const c=segClosest(a,w.a,w.b);if(dist(a,c.q)-w.t/2>1500)return;const d=wallDir(w);const ang=Math.acos(clamp(Math.abs(dot(u,d)),0,1));if(ang<ba){ba=ang;best=w;}});
  if(!best)return {p:b,w:null};let d=wallDir(best);if(dot(d,u)<0)d=mul(d,-1);let l=dot(v,d);if(snapOn)l=Math.max(lenStep(),Math.round(l/lenStep())*lenStep());
  return {p:add(a,mul(d,l)).map(x=>Math.round(x*10)/10),w:best};}
// turn a strip about its middle so it runs parallel to the wall nearest to it
function stripParallel(E){const w=stripWallNear(E.a,E.b,3000);if(!w)return false;const m=mul(add(E.a,E.b),.5),L=dist(E.a,E.b);let d=wallDir(w);if(dot(d,sub(E.b,E.a))<0)d=mul(d,-1);
  E.a=add(m,mul(d,-L/2)).map(x=>Math.round(x*10)/10);E.b=add(m,mul(d,L/2)).map(x=>Math.round(x*10)/10);return true;}
// ---- tool
function elecToolMove(p){const t=placeType,D=ELEC[t];if(!D)return;
  if(D.mount==='line'){if(stripStart){const sn=snapPoint(p,stripStart),al=stripAlign(stripStart,sn.p);elecGhost={b:al.p};$('#snapchip').textContent=al.w?'parallel to wall':'';}else elecGhost={c:snapPoint(p,null).p};dirty();return;}
  if(D.mount==='wall'){const sl=wallSlot(p);elecGhost=sl?Object.assign(newElec(t,sl),{id:'ghost'}):null;$('#snapchip').textContent=sl?'on wall':'';dirty();return;}
  const sn=snapPoint(p,null);elecGhost=Object.assign(newElec(t,{x:sn.p[0],y:sn.p[1]}),{id:'ghost'});dirty();}
function elecToolClick(p){const t=placeType,D=ELEC[t];if(!D||!elecOn)return;
  if(D.mount==='line'){const sn=snapPoint(p,stripStart);if(!stripStart){stripStart=sn.p;elecGhost={b:sn.p};renderInspector();dirty();return;}
    if(dist(sn.p,stripStart)<50){toast('Click further away to set the length of the strip.');return;}
    const E=newElec('strip',{a:stripStart.slice(),b:stripAlign(stripStart,sn.p).p.slice()});mutate(()=>elecList().push(E));stripStart=null;elecGhost=null;sel={kind:'elec',id:E.id};renderInspector();return;}
  if(D.mount==='wall'){const sl=wallSlot(p);if(!sl){toast(D.label+'s go on a wall: click close to a wall.');return;}const E=newElec(t,sl);mutate(()=>elecList().push(E));sel={kind:'elec',id:E.id};renderInspector();return;}
  const sn=snapPoint(p,null);const E=newElec(t,{x:sn.p[0],y:sn.p[1]});mutate(()=>elecList().push(E));sel={kind:'elec',id:E.id};renderInspector();}
function hitElec(p){if(!elecOn||!M.elec)return null;const tol=Math.max(elecSize()*1.3,ptrTouch?18:10)/view.s;let best=null,bd=1e9;
  M.elec.forEach(E=>{let d;if(E.a){const c=segClosest(p,E.a,E.b);d=dist(p,c.q)*1.6;if(sel&&sel.kind==='elec'&&sel.id===E.id){if(dist(p,E.a)<tol*0.6)return void(best={kind:'elec',id:E.id,end:'a'},bd=-1);if(dist(p,E.b)<tol*0.6)return void(best={kind:'elec',id:E.id,end:'b'},bd=-1);}}
    else{const q=E.wall?(elecWallPos(E)?add(elecWallPos(E).p,mul(elecWallPos(E).n,elecSize()*0.8/view.s)):null):[E.x,E.y];if(!q)return;d=dist(p,q);}
    if(d<tol&&d<bd){bd=d;best={kind:'elec',id:E.id};}});return best;}
function elecDragStart(drag,p){const E=elecById(drag.id);if(!E)return;drag.e0=JSON.parse(JSON.stringify(E));}
function elecDragMove(drag,p){const E=elecById(drag.id),E0=drag.e0;if(!E||!E0)return;const dv=sub(p,drag.p0);
  if(E0.a){if(drag.end){const o=drag.end==='a'?E0.b:E0.a,sn=snapPoint(p,o),al=stripAlign(o,sn.p);E[drag.end]=al.p;drag.snap={kind:al.w?'parallel to wall':'strip light'};return;}else{let mv=dv;if(snapOn&&!shiftDown)mv=[Math.round(mv[0]/lenStep())*lenStep(),Math.round(mv[1]/lenStep())*lenStep()];E.a=add(E0.a,mv);E.b=add(E0.b,mv);}drag.snap={kind:'strip light'};return;}
  if(E0.wall){const sl=wallSlot(p,60);if(sl){E.wall=sl.wall;E.s=sl.s;E.side=sl.side;}drag.snap={kind:'on wall'};return;}
  const sn=snapPoint(add([E0.x,E0.y],dv),null);E.x=sn.p[0];E.y=sn.p[1];drag.snap={kind:'move'};}
// ---- side panel
function elecPanelHTML(E,field){const D=ELEC[E.type];const same=Object.keys(ELEC).filter(k=>ELEC[k].mount===D.mount&&ELEC[k].group===D.group);
  let h=`<div class="selname">${D.label}<span class="selbtns"><button class="btn" id="copyBtn">Copy</button><button class="btn" id="delBtn">Delete</button></span></div><div class="kv">`;
  if(same.length>1)h+=`<label for="eType">Type</label><select id="eType">${same.map(k=>`<option value="${k}"${k===E.type?' selected':''}>${ELEC[k].label}</option>`).join('')}</select>`;
  if(E.type==='switch')h+=`<label>Gangs</label><div class="seg segsm" role="group" aria-label="Number of switches">${[1,2,3,4].map(g=>`<button data-gang="${g}" aria-pressed="${(E.gangs||1)===g}">${g}</button>`).join('')}</div>`;
  if(E.type==='socket')h+=`<label>Outlets</label><div class="seg segsm" role="group" aria-label="Single or double"><button data-dbl="0" aria-pressed="${!E.dbl}">Single</button><button data-dbl="1" aria-pressed="${!!E.dbl}">Double</button></div>`;
  if(E.a)h+=field('Length','eLen',fmtLen(dist(E.a,E.b)))+`<label></label><button class="btn" id="eParallel" title="Turn it about its middle to run parallel to the nearest wall">Parallel to nearest wall</button>`;
  if(D.mount!=='ceiling')h+=field(D.mount==='wall'?'Height to centre':'Height','eH',fmtLen(E.h!=null?E.h:(D.h||0)));
  if(E.type==='chandelier')h+=field('Drop from ceiling','eDrop',fmtLen(E.drop!=null?E.drop:D.drop));
  h+=`<label for="eLabel">Label</label><input id="eLabel" data-type="text" style="font-family:var(--f-body)" placeholder="e.g. L1 or circuit" value="${esc(E.label||'')}"></div>`;
  h+=`<p class="tip">${D.mount==='wall'?'Drag it along the wall, or onto another wall. ':D.mount==='line'?'Drag the line to move it, or drag a square end to change its length. ':'Drag it to move. '}The <b>Electrical</b> button above the plan shows or hides this layer.</p>`;return h;}
function bindElecPanel(E){const on=(id,fn)=>{const e=document.getElementById(id);if(e)e.onchange=()=>fn(e.value);};
  on('eType',v=>{mutate(()=>{E.type=v;if(v==='switch'&&!E.gangs)E.gangs=1;});renderInspector();});
  document.querySelectorAll('[data-gang]').forEach(b=>b.onclick=()=>{mutate(()=>E.gangs=+b.dataset.gang);renderInspector();});
  document.querySelectorAll('[data-dbl]').forEach(b=>b.onclick=()=>{mutate(()=>E.dbl=b.dataset.dbl==='1');renderInspector();});
  on('eLen',v=>{const L=parseLen(v);if(L>=50)mutate(()=>{const d=norm(sub(E.b,E.a));E.b=add(E.a,mul(d,L));});renderInspector();});
  on('eH',v=>{const L=parseLen(v);if(L>=0)mutate(()=>E.h=L);renderInspector();});
  on('eDrop',v=>{const L=parseLen(v);if(L>=0)mutate(()=>E.drop=L);renderInspector();});
  on('eLabel',v=>{mutate(()=>{E.label=v.trim()||undefined;});renderInspector();});
  {const b=$('#eParallel');if(b)b.onclick=()=>{if(!stripWallNear(E.a,E.b,3000)){toast('No wall within 3 m of this strip.');return;}mutate(()=>stripParallel(E));renderInspector();toast('Strip turned parallel to the wall.');};}
  const db=$('#delBtn');if(db)db.onclick=()=>deleteSel();const cb=$('#copyBtn');if(cb)cb.onclick=()=>copySel();}
function elecToolPanel(){const D=ELEC[placeType];if(!D)return '';
  const how=D.mount==='wall'?'Click on a wall face where it goes. It sits on the side you click.':D.mount==='line'?(stripStart?'Click where the strip ends (Shift for any angle).':'Click where the strip starts.'):'Click where it goes.';
  return `<p class="h">New ${D.label.toLowerCase()}</p><p class="tip">${how} Heights and labels can be changed afterwards in its side panel.</p>`;}
// ---- schedule
function elecSchedule(){const L=M.elec||[];if(!L.length)return '';const c={};let strip=0;L.forEach(E=>{if(E.type==='strip')strip+=dist(E.a,E.b);else c[E.type]=(c[E.type]||0)+1;});
  let s='';Object.keys(ELEC).forEach(k=>{if(k==='strip'){if(strip)s+=`<span>Strip lights</span><span>${fmtRun(strip)} ${runU()}</span>`;return;}if(c[k])s+=`<span>${ELEC[k].label}${c[k]>1?'s':''}</span><span>× ${c[k]}</span>`;});
  const sw=L.filter(E=>E.type==='switch').reduce((a,E)=>a+(E.gangs||1),0);if(sw)s+=`<span>Switch gangs</span><span>× ${sw}</span>`;
  const out=L.filter(E=>E.type==='socket').reduce((a,E)=>a+(E.dbl?2:1),0)+L.filter(E=>E.type==='wpsocket').length*2;if(out)s+=`<span>Socket outlets</span><span>× ${out}</span>`;return s;}
// ---- elevations: plates and lights on the wall face
function drawElevElec(e,ox,baseY,s){if(!elecOn||!M.elec||!e.left||e.curved)return;const X=x=>ox+x*s,Z=z=>baseY-z*s;
  M.elec.forEach(E=>{if(!E.wall)return;const P=elecWallPos(E);if(!P)return;if(dot(P.n,e.nIn)<0.99)return;if(Math.abs(dot(sub(P.p,e.P),e.nIn))>40)return;
    const x=dot(sub(P.p,e.left),e.right);if(x<-5||x>e.L+5)return;const D=ELEC[E.type],h=E.h!=null?E.h:D.h,cx=X(x),cy=Z(h);
    ctx.save();ctx.lineWidth=1.2;
    if(E.type==='wall'){ctx.fillStyle=ELEC_COL.lightFill;ctx.strokeStyle=ELEC_COL.light;ctx.beginPath();ctx.ellipse(cx,cy,Math.max(5,90*s),Math.max(7,130*s),0,0,Math.PI*2);ctx.fill();ctx.stroke();}
    else{const w=(E.type==='socket'&&E.dbl?146:86)*s,hh=86*s;ctx.fillStyle=C.paper;ctx.strokeStyle=ELEC_COL.plug;ctx.fillRect(cx-w/2,cy-hh/2,w,hh);ctx.strokeRect(cx-w/2,cy-hh/2,w,hh);}
    ctx.fillStyle=ELEC_COL.plug;ctx.font='10px '+getComputedStyle(document.body).fontFamily;ctx.textAlign='left';ctx.textBaseline='middle';ctx.fillText((E.label?E.label+' ':'')+fmtLen(h),cx+Math.max(8,60*s),cy);ctx.restore();});}
// ---- 3D: fittings, and at night the lights shine
function ceilAt(p){const r=roomAt(p);if(r&&r.elevs&&r.elevs.length)return Math.max(...r.elevs.map(e=>e.H));return 2700;}
function build3dElec(g,box,S,inside){if(!M.elec||!M.elec.length)return [];const lights=[];
  const metal=M3('chrome'),bulb=M3('bulb'),plate=M3('white');
  M.elec.forEach(E=>{const D=ELEC[E.type];if(!D)return;
    if(D.mount==='wall'){const P=elecWallPos(E);if(!P)return;const h=E.h!=null?E.h:D.h,ry=-Math.atan2(P.d[1],P.d[0]);
      if(cutaway&&!inside&&h>1150)return;
      if(E.type==='wall'){const c=add(P.p,mul(P.n,45));box(160,220,90,bulb,c[0],h,c[1],ry).castShadow=false;lights.push({p:add(P.p,mul(P.n,250)),y:h,D,E});}
      else{const w=E.type==='socket'&&E.dbl?146:86;const c=add(P.p,mul(P.n,5));box(w,86,10,plate,c[0],h,c[1],ry).castShadow=false;}
      return;}
    if(D.mount==='line'){const H=E.h!=null?E.h:D.h;if(!inside&&cutaway&&H>1150)return;const L=dist(E.a,E.b),c=mul(add(E.a,E.b),.5),d=norm(sub(E.b,E.a));
      box(L,12,24,bulb,c[0],H,c[1],-Math.atan2(d[1],d[0])).castShadow=false;lights.push({p:c,y:H-80,D,E});return;}
    if(E.type==='garden'){const h=E.h!=null?E.h:D.h;const m=new THREE.Mesh(new THREE.CylinderGeometry(0.035,0.045,h*S,10),M3('frame'));m.position.set(E.x*S,h*S/2,E.y*S);m.castShadow=true;g.add(m);
      const t=new THREE.Mesh(new THREE.CylinderGeometry(0.07,0.07,0.12,14),bulb);t.position.set(E.x*S,(h+60)*S,E.y*S);g.add(t);lights.push({p:[E.x,E.y],y:h+60,D,E});return;}
    if(!inside)return;   // ceiling lights are only seen from inside (there is no ceiling in the outside view)
    const Hc=ceilAt([E.x,E.y]);
    if(E.type==='spot'){const m=new THREE.Mesh(new THREE.CylinderGeometry(0.045,0.045,0.01,18),bulb);m.position.set(E.x*S,Hc*S-0.006,E.y*S);g.add(m);
      const r=new THREE.Mesh(new THREE.CylinderGeometry(0.055,0.055,0.006,18),metal);r.position.set(E.x*S,Hc*S-0.003,E.y*S);g.add(r);lights.push({p:[E.x,E.y],y:Hc-150,D,E});}
    else{const drop=E.drop!=null?E.drop:D.drop,y=Hc-drop;const rod=new THREE.Mesh(new THREE.CylinderGeometry(0.006,0.006,drop*S,6),metal);rod.position.set(E.x*S,(Hc-drop/2)*S,E.y*S);g.add(rod);
      const ring=new THREE.Mesh(new THREE.TorusGeometry(0.28,0.012,8,32),metal);ring.rotation.x=Math.PI/2;ring.position.set(E.x*S,y*S,E.y*S);g.add(ring);
      for(let i=0;i<6;i++){const a=i/6*Math.PI*2;const b=new THREE.Mesh(new THREE.SphereGeometry(0.045,12,8),bulb);b.position.set((E.x+Math.cos(a)*280)*S,(y+40)*S,(E.y+Math.sin(a)*280)*S);g.add(b);}
      lights.push({p:[E.x,E.y],y:y-50,D,E});}});
  return lights;}

/* ============================== tabs: several projects open at once, and autosave ============================== */
// Each tab keeps its own drawing, undo history, reference, file and view. The active tab's state lives in the usual
// globals (M, undoStack, …); switching tabs swaps them. Every tab is also kept on this device, and a project that has
// a file is written back to it every 5 minutes when it has changes.
let tabs=[],activeTab=null,tabSeq=1;
const AUTOSAVE_MS=5*60*1000;
let autosaveOn=true;try{autosaveOn=localStorage.getItem('bm-autosave')!=='0';}catch(e){}
// Reference drawings and plan images can be several MB, more than localStorage holds, so between sessions they are
// kept in IndexedDB; the project itself stays in localStorage. Each tab (and the "Continue" project) has one entry.
const BIG=(()=>{let dbp=null;const db=()=>dbp||(dbp=new Promise((res,rej)=>{try{const r=indexedDB.open('benchmark-planner',1);r.onupgradeneeded=()=>r.result.createObjectStore('big');
    r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);}catch(e){rej(e);}}));
  const tx=(mode,fn)=>db().then(d=>new Promise((res,rej)=>{const t=d.transaction('big',mode),st=t.objectStore('big');const q=fn(st);t.oncomplete=()=>res(q&&q.result);t.onerror=()=>rej(t.error);}));
  return {get:k=>tx('readonly',st=>st.get(k)).catch(()=>null),put:(k,v)=>tx('readwrite',st=>st.put(v,k)).catch(()=>null),del:k=>tx('readwrite',st=>st.delete(k)).catch(()=>null)};})();
function bigSave(key,ref,img){return (ref||img)?BIG.put(key,{ref:ref||null,img:img||null}):BIG.del(key);}
function tabJSON(t){return JSON.stringify({app:'benchmark-planner',version:1,units:t.units,model:t.M,reference:t.ref||undefined,refImage:t.img||undefined});}
function makeTab(model,o={}){return Object.assign({id:'t'+(tabSeq++),M:model||blankModel(),undo:[],redo:[],ref:null,img:null,filePath:null,units:units,view:null,elevPt:null,savedSnap:null,lastSaved:0,lastAuto:0},o);}
function storeActive(){const t=activeTab;if(!t)return;Object.assign(t,{M,undo:undoStack,redo:redoStack,ref:refDrawing,img:refImage,filePath,units,view:{...view},elevPt});}
function tabDirty(t){return t.savedSnap!==(t===activeTab?snapshot():JSON.stringify(t.M));}
function activate(t,fitIt){if(typeof walk!=='undefined'&&walk.on)walkStop();activeTab=t;M=t.M;undoStack=t.undo;redoStack=t.redo;filePath=t.filePath;elevPt=t.elevPt||null;
  setReference(t.ref||null,true);setRefImage(t.img||null,true);if(typeof eraseStack!=='undefined')eraseStack.length=0;
  fixUid();setUnits(units);sel=null;hover=null;drag=null;setTool('select');$('#projName').value=M.name;changed();
  if(t.view&&!fitIt)Object.assign(view,t.view);else requestAnimationFrame(()=>{fit();});frame3d();build3d();renderTabs();}
function switchTab(id){if(activeTab&&activeTab.id===id)return;const t=tabs.find(x=>x.id===id);if(!t)return;closeTextEditor&&closeTextEditor(false);storeActive();saveTabsNow();activate(t);}
function newTab(model,o){storeActive();const t=makeTab(model,o);t.savedSnap=JSON.stringify(t.M);tabs.push(t);activate(t,true);saveTabsNow();return t;}
const tabIsBlank=t=>!t.filePath&&!t.M.walls.length&&!t.M.items.length&&!(t.M.areas||[]).length&&!(t.M.texts||[]).length&&!t.ref&&!t.img;
function dropTab(t){const i=tabs.indexOf(t);if(i<0)return;const was=t===activeTab;tabs.splice(i,1);try{localStorage.removeItem('bm-tab-'+t.id);}catch(e){}
  if(!tabs.length){tabs.push(makeTab(blankModel()));tabs[0].savedSnap=JSON.stringify(tabs[0].M);}
  if(was)activate(tabs[Math.min(i,tabs.length-1)],false);else renderTabs();saveTabsNow();}
async function closeTab(id){const t=tabs.find(x=>x.id===id);if(!t)return;if(t===activeTab)storeActive();
  const go=()=>dropTab(t);
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
function saveTabsNow(){clearTimeout(tabSaveTimer);if(!activeTab||bootPending)return;storeActive();
  try{localStorage.setItem('bm-tabs',JSON.stringify({active:activeTab.id,ids:tabs.map(t=>t.id),seq:tabSeq,snap:snapOn,free:freeMove}));}catch(e){}
  tabs.forEach(t=>{if(t!==activeTab&&t.stored&&t.bigRef===t.ref&&t.bigImg===t.img)return;const meta={filePath:t.filePath,dirty:tabDirty(t),lastSaved:t.lastSaved,big:!!(t.ref||t.img)};
    try{const o=JSON.parse(tabJSON(t));delete o.reference;delete o.refImage;localStorage.setItem('bm-tab-'+t.id,JSON.stringify(Object.assign(o,meta)));t.stored=true;}catch(e){}
    if(t.bigRef!==t.ref||t.bigImg!==t.img){t.bigRef=t.ref;t.bigImg=t.img;bigSave('tab-'+t.id,t.ref,t.img);}});}
function save(){if(activeTab)activeTab.stored=false;clearTimeout(tabSaveTimer);tabSaveTimer=setTimeout(saveTabsNow,700);renderTabs();}
function loadTabs(){try{const ix=JSON.parse(localStorage.getItem('bm-tabs')||'null');if(!ix||!ix.ids||!ix.ids.length)return false;tabSeq=ix.seq||tabSeq;if(ix.snap!=null)snapOn=!!ix.snap;if(ix.free!=null)freeMove=!!ix.free;
    ix.ids.forEach(id=>{try{const o=JSON.parse(localStorage.getItem('bm-tab-'+id)||'null');if(!o||!o.model)return;
      const t=makeTab(Object.assign(blankModel(),o.model),{id,units:normUnits(o.units),ref:o.reference||null,img:o.refImage||null,filePath:o.filePath||null,lastSaved:o.lastSaved||0,stored:true,big:!!o.big});
      if(o.big){t.bigRef=t.ref;t.bigImg=t.img;}
      t.savedSnap=o.dirty?null:JSON.stringify(t.M);tabs.push(t);}catch(e){}});
    if(!tabs.length)return false;activeTab=tabs.find(t=>t.id===ix.active)||tabs[0];return true;}catch(e){return false;}}
// older versions kept one drawing; bring it in as the first tab
// Every start begins with the start question. Until it is answered the tabs of the last session stay untouched in storage,
// so "Recover unsaved work" still has them even if the app is closed while the question is up.
let firstRun=false,bootPending=false,prevTabs=[],prevIds=[];
function migrateOld(){let m=null,u=units;try{const s=localStorage.getItem('bm-plan');if(s){const o=JSON.parse(s);if(o&&o.M&&Array.isArray(o.M.walls)){m=o.M;u=normUnits(o.units);snapOn=o.snapOn!==false;freeMove=!!o.freeMove;}}}catch(e){}
  let ref=null,img=null;try{ref=JSON.parse(localStorage.getItem('bm-ref')||'null');}catch(e){}try{img=JSON.parse(localStorage.getItem('bm-refimg')||'null');}catch(e){}
  const t=makeTab(m?Object.assign(blankModel(),m):blankModel(),{units:u,ref,img});t.savedSnap=m?null:JSON.stringify(t.M);tabs.push(t);activeTab=t;if(!m)firstRun=true;
  try{['bm-plan','bm-ref','bm-refimg'].forEach(k=>localStorage.removeItem(k));}catch(e){}}
async function autosaveTick(){if(!autosaveOn)return;storeActive();const now=Date.now();
  for(const t of tabs){if(!tabDirty(t)||now-(t.lastAuto||0)<AUTOSAVE_MS)continue;t.lastAuto=now;
    if(NATIVE&&t.filePath){try{await TAURI.fs.writeTextFile(t.filePath,tabJSON(t));t.savedSnap=JSON.stringify(t.M);t.lastSaved=Date.now();if(t===activeTab)recordLast(t);}catch(e){toast('Autosave failed for '+(t.M.name||'project')+': '+e);}}}
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
fileMenu.addEventListener('click',e=>{if(e.target.closest('button')&&!e.target.closest('#unitSeg')&&!e.target.closest('#langSeg'))closeFileMenu();});
document.addEventListener('pointerdown',e=>{if(!fileMenu.hidden&&!e.target.closest('.menuwrap'))closeFileMenu();});
fileMenu.addEventListener('keydown',e=>{const items=[...fileMenu.querySelectorAll('button:not([hidden])')];const i=items.indexOf(document.activeElement);
  if(e.key==='Escape'){closeFileMenu();fileBtn.focus();}else if(e.key==='ArrowDown'){e.preventDefault();items[(i+1)%items.length].focus();}else if(e.key==='ArrowUp'){e.preventDefault();items[(i-1+items.length)%items.length].focus();}});
function updateMeasUI(){const on=Object.keys(MEAS_DEF).filter(k=>MEAS[k]).length;$('#measBtn').setAttribute('aria-pressed',String(on>0));$('#measBtn').textContent=on?'Measures ▾':'Measures off ▾';
  document.querySelectorAll('[data-meas]').forEach(cb=>cb.checked=!!MEAS[cb.dataset.meas]);}
$('#measBtn').onclick=e=>{e.stopPropagation();const m=$('#measMenu'),open=m.hidden;m.hidden=!open;if(open){m.style.left='';m.style.right='';const r=m.getBoundingClientRect();if(r.left<8){m.style.left='0';m.style.right='auto';}}$('#measBtn').setAttribute('aria-expanded',String(open));if(open)(m.querySelector('input')||m).focus();};
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

$('#statsBtn').onclick=()=>statsDialog();$('#statsBtn2').onclick=()=>statsDialog();$('#importBtn').onclick=importDXF;$('#pdfBtn').onclick=exportImageDialog;$('#planImgBtn').onclick=importPlanImage;$('#dxfBtn').onclick=exportDXF;

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
  // an upright prism from a plan-space outline (mm), between two heights (mm): mitred wall ends
  const prism=(pts,z0,z1,m)=>{if(z1-z0<1)return;const sh=new THREE.Shape(pts.map(p=>new THREE.Vector2(p[0]*S,-p[1]*S)));
    const geo=new THREE.ExtrudeGeometry(sh,{depth:(z1-z0)*S,bevelEnabled:false});geo.rotateX(-Math.PI/2);geo.translate(0,z0*S,0);
    const mesh=new THREE.Mesh(geo,m);mesh.castShadow=true;mesh.receiveShadow=true;g.add(mesh);return mesh;};
  // a flat quad from four plan-space corners (mm) at heights (mm); uv in metres
  const quad=(pts,uvs,m,face)=>{const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pts.flatMap(p=>[p[0]*S,p[1]*S,p[2]*S]),3));
    geo.setAttribute('uv',new THREE.Float32BufferAttribute(uvs.flat(),2));const a=new THREE.Vector3(...pts[0]),b=new THREE.Vector3(...pts[1]),c=new THREE.Vector3(...pts[2]);
    const n=b.clone().sub(a).cross(c.clone().sub(a));geo.setIndex(n.dot(new THREE.Vector3(face[0],face[1],face[2]))>=0?[0,1,2,0,2,3]:[0,2,1,0,3,2]);geo.computeVertexNormals();
    const mesh=new THREE.Mesh(geo,m);mesh.receiveShadow=true;g.add(mesh);return mesh;};
  const capH=w=>cut?Math.min(1200,w.h):w.h;
  M.walls.forEach(w=>{const d=wallDir(w),ext=wallExt(w),ry=-Math.atan2(d[1],d[0]),H=capH(w);
    const seg=(s0,s1,z0,z1,m)=>{if(s1-s0<1||z1-z0<1)return;const c=add(w.a,mul(d,(s0+s1)/2));box(s1-s0,z1-z0,w.t,m,c[0],(z0+z1)/2,c[1],ry,s0,z0);};
    const wm=w.kind?yardWallMat(w.kind):wallMat,Lw=wallLen(w);
    wallPieces(w,ext).forEach(([a,b])=>{if(a<-0.01||b>Lw+0.01){const q=pieceQuad(w,a,b);const sq=Math.abs(dot(sub(q[3],q[0]),d))<0.5&&Math.abs(dot(sub(q[2],q[1]),d))<0.5;if(!sq){prism(q,0,H,wm);return;}}seg(a,b,0,H,wm);});
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
  let nl=0;const litRooms=new Set();if(elecOn)(M.elec||[]).forEach(E=>{if(ELEC[E.type]&&ELEC[E.type].group==='light'){const r=roomAt(elecPos(E)||[0,0]);if(r)litRooms.add(r);}});
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
    if(night&&!litRooms.has(r)&&nl<q3d().lights){nl++;const c=r.centroid,h=(Hc||2700);const bulb=new THREE.Mesh(new THREE.CylinderGeometry(0.16,0.16,0.03,20),M3('bulb'));bulb.position.set(c[0]*S,h*S-0.02,c[1]*S);g.add(bulb);
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
  if(elecOn){const lights=build3dElec(g,box,S,inside);if(night)lights.forEach(Lt=>{if(nl>=q3d().lights)return;nl++;const pl=new THREE.PointLight(0xffd6a0,Lt.D.power,Lt.D.range,2);pl.position.set(Lt.p[0]*S,Lt.y*S,Lt.p[1]*S);g.add(pl);});}
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
  if(M.cols.some(c=>c.wall!=null)){syncHostedCols();M.cols.forEach(c=>{delete c.wall;delete c.s;delete c.off;});}clampOpenings();rooms=computeRooms();fillElevSelect();epSync();plSync();renderInspector();renderTakeoff();schedule3d();dirty();
  $('#undoBtn').disabled=!undoStack.length;$('#redoBtn').disabled=!redoStack.length;save();}
function setView(v){$('#stage').dataset.view=v;['vPlan','vSplit','vElev','v3d'].forEach(id=>{const b=$('#'+id);b.setAttribute('aria-pressed',String(b.dataset.view===v));});
  requestAnimationFrame(()=>{dirty();draw3d();});}
// Units are one setting for the whole app (File menu): every open project shows them, and the app starts with them next time.
function setUnits(u){units=normUnits(u);try{localStorage.setItem('bm-units',units);}catch(e){}try{tabs.forEach(t=>t.units=units);}catch(e){}document.querySelectorAll('#unitSeg button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.units===units)));renderInspector();renderTakeoff();dirty();save();
  document.querySelectorAll('.lib button[data-type]').forEach(b=>{const c=CAT[b.dataset.type];b.querySelector('.libw').textContent=fmtLen(c.w);b.title=c.label+': '+[c.w,c.d,c.h].map(v=>fmtLen(v,true)).join(' × ');});}
function setFree(v,quiet){freeMove=!!v;$('#freeToggle').setAttribute('aria-pressed',String(freeMove));renderInspector();dirty();save();
  if(!quiet&&tool==='select'){$('#snapchip').textContent=freeMove?'free move on':'push / pull';clearTimeout(setFree.t);setFree.t=setTimeout(()=>$('#snapchip').textContent='',1400);}}
$('#freeToggle').onclick=()=>setFree(!freeMove);
function setSnap(v){snapOn=!!v;$('#snapToggle').setAttribute('aria-pressed',String(snapOn));$('#snapToggle').textContent=snapOn?'Snap on':'Snap off';snapInfo=null;dirty();save();}
function setEmptyDrag(v){emptyDrag=v;$('#dragBox').setAttribute('aria-pressed',String(v==='box'));$('#dragPan').setAttribute('aria-pressed',String(v==='pan'));}
$('#snapToggle').onclick=()=>setSnap(!snapOn);$('#dragBox').onclick=()=>setEmptyDrag('box');$('#dragPan').onclick=()=>setEmptyDrag('pan');
function setCut(c){cutaway=c;$('#cutOn').setAttribute('aria-pressed',String(c));$('#cutOff').setAttribute('aria-pressed',String(!c));build3d();}
['vPlan','vSplit','vElev','v3d'].forEach(id=>$('#'+id).onclick=e=>{const v=e.currentTarget.dataset.view;if(eMode)epLeave(true);if(pMode)plLeave(true);setView(v);});
$('#vPplan').onclick=()=>{if(pMode)plLeave();else plEnter();};
$('#plShowBtn').onclick=()=>{plShow=plShow==='hidden'?'faded':'hidden';try{localStorage.setItem('bm-plshow',plShow);}catch(e){}plSync();dirty();toast(plShow==='hidden'?'Plumbing plan hidden on the home plan.':'Plumbing plan shown faded on the home plan.');};
$('#vEplan').onclick=()=>{if(eMode)epLeave();else{if(pMode)plLeave(true);epEnter();}};
$('#epShowBtn').onclick=()=>{epShow=epShow==='hidden'?'faded':'hidden';try{localStorage.setItem('bm-epshow',epShow);}catch(e){}epSync();dirty();toast(epShow==='hidden'?'Electric plan hidden on the home plan.':'Electric plan shown faded on the home plan.');};
document.querySelectorAll('#langSeg [data-lang]').forEach(b=>b.onclick=()=>setLang(b.dataset.lang));
document.querySelectorAll('#unitSeg button').forEach(b=>b.onclick=()=>{setUnits(b.dataset.units);toast('Units: '+b.textContent+'. The app will start with them next time too.');});
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
document.querySelectorAll('[data-tool="eplan"]').forEach(b=>b.onclick=()=>epSetKind(b.dataset.kind));
document.querySelectorAll('[data-tool="plumb"]').forEach(b=>b.onclick=()=>plSetKind(b.dataset.kind));
$('#tDoor').onclick=e=>{if(document.getElementById('doorPick')){closeDoorPick();return;}openDoorPick(e.currentTarget);};
// Tool and fixture icons drawn as plan symbols, the way they appear on the drawing.
const ICONS={
  ep_wire:'<path d="M3 18C8 18 8 6 13 6s5 8 8 8" stroke-width="2.4" stroke="#e03131"/>',
  ep_dcwire:'<path d="M3 18C8 18 8 6 13 6s5 8 8 8" stroke-width="2.2" stroke-dasharray="3 2.2" stroke="#f08c00"/>',
  ep_tube:'<path d="M3 16C9 16 9 8 15 8h6" stroke-width="6" stroke-opacity=".25"/><path d="M3 16C9 16 9 8 15 8h6"/>',
  ep_jbox:'<rect x="6" y="6" width="12" height="12" rx="1"/><circle cx="12" cy="12" r="2" fill="currentColor"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>',
  ep_panel:'<rect x="5" y="3" width="14" height="18" rx="1.5"/><path d="M8 7h3M8 10.5h3M8 14h3M13 7h3M13 10.5h3M13 14h3M9 18h6"/>',
  ep_meter:'<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 10h8"/><path d="M12 14l3-3" /><circle cx="12" cy="14" r="1" fill="currentColor"/>',
  ep_pv:'<path d="M3 17 6 7h15l-3 10z"/><path d="M8 7l-2 10M13.5 7l-2.5 10M4.5 12h15"/>',
  ep_dciso:'<rect x="5" y="4" width="14" height="16" rx="1.5"/><path d="M9 15l6-6"/><circle cx="9" cy="15" r="1" fill="currentColor"/><path d="M8 7h2M14 17h2"/>',
  ep_inv:'<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M7 10c1.3-2 2.7-2 4 0s2.7 2 4 0"/><path d="M7 15h10" stroke-dasharray="2 1.6"/>',
  ep_bat:'<rect x="3" y="7" width="16" height="10" rx="1.5"/><path d="M19 10.5h2v3h-2"/><path d="M7 12h4M9 10v4M14 12h3"/>',
  pl_cold:'<path d="M3 12h18" stroke="#1c7ed6" stroke-width="3"/>',
  pl_hot:'<path d="M3 12h18" stroke="#e03131" stroke-width="3"/>',
  pl_ret:'<path d="M3 12h18" stroke="#f783ac" stroke-width="3" stroke-dasharray="4 2.5"/>',
  pl_drain:'<path d="M3 9h12l6 6" stroke="#7a4b2a" stroke-width="4"/>',
  pl_vent:'<path d="M12 21V4M8 8l4-4 4 4" stroke="#2f9e44" stroke-dasharray="3 2"/>',
  pl_wc:'<rect x="7" y="3" width="10" height="5" rx="1"/><ellipse cx="12" cy="15" rx="5" ry="6"/>',
  pl_basin:'<path d="M4 9h16a8 8 0 0 1-16 0z"/><circle cx="12" cy="11" r="1"/>',
  pl_sink:'<rect x="3" y="6" width="18" height="12" rx="2"/><rect x="6" y="9" width="12" height="6" rx="1"/>',
  pl_shower:'<rect x="4" y="4" width="16" height="16" rx="1"/><path d="M4 4l16 16M20 4 4 20"/>',
  pl_bath:'<rect x="3" y="6" width="18" height="12" rx="4"/><circle cx="7" cy="12" r="1"/>',
  pl_bidet:'<ellipse cx="12" cy="13" rx="5" ry="7"/><circle cx="12" cy="9" r="1"/>',
  pl_washer:'<rect x="5" y="3" width="14" height="18" rx="2"/><circle cx="12" cy="13" r="4"/>',
  pl_dw:'<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M5 8h14"/>',
  pl_faucet:'<path d="M6 20V11h8a4 4 0 0 1 4 4v1"/><path d="M9 11V7h4"/>',
  pl_tap:'<path d="M4 10h9a3 3 0 0 1 3 3v3"/><path d="M8 10V6M6 6h4"/><path d="M16 19v1" />',
  pl_fdrain:'<rect x="5" y="5" width="14" height="14" rx="2"/><path d="M8 9h8M8 12h8M8 15h8"/>',
  pl_meter:'<circle cx="12" cy="12" r="8"/><path d="M12 12l4-3"/>',
  pl_tank:'<rect x="4" y="5" width="16" height="14" rx="2"/><path d="M4 11h16"/>',
  pl_pump:'<circle cx="12" cy="12" r="8"/><path d="M9 7l7 5-7 5z" fill="currentColor"/>',
  pl_ptank:'<ellipse cx="12" cy="12" rx="6" ry="8"/><path d="M12 4V2"/>',
  pl_heater:'<rect x="6" y="3" width="12" height="18" rx="5"/><path d="M10 15c0-2 4-2 4-5" stroke="#e03131"/>',
  pl_valve:'<path d="M4 7v10l16-10v10z"/>',
  pl_fitting:'<path d="M5 19V9a4 4 0 0 1 4-4h10" stroke-width="4" stroke-opacity=".35"/><path d="M5 19V9a4 4 0 0 1 4-4h10"/>',
  pl_stack:'<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="3" fill="currentColor"/>',
  pl_manhole:'<rect x="4" y="4" width="16" height="16"/><path d="M4 4l16 16M20 4 4 20"/>',
  pl_cleanout:'<circle cx="12" cy="12" r="7"/><path d="M8 12h8"/>',
  pl_ventcap:'<path d="M12 21V8"/><path d="M6 8h12l-6-5z"/>',
  pl_note:'<path d="M5 6h14M12 6v13"/>',
  e_spot:'<circle cx="12" cy="12" r="6"/><path d="M8 8l8 8M16 8l-8 8"/>',
  e_strip:'<path d="M3 15 21 9" stroke-width="3" stroke-opacity=".35"/><path d="M3 15 21 9" stroke-dasharray="2.5 2"/><circle cx="3" cy="15" r="1.2" fill="currentColor"/><circle cx="21" cy="9" r="1.2" fill="currentColor"/>',
  e_chand:'<circle cx="12" cy="12" r="3"/><path d="M12 4v5M12 15v5M4 12h5M15 12h5M6.3 6.3l3.6 3.6M14.1 14.1l3.6 3.6M17.7 6.3l-3.6 3.6M9.9 14.1l-3.6 3.6"/>',
  e_wall:'<path d="M5 4v16"/><path d="M5 7a5 5 0 0 1 0 10" /><path d="M13 12h4M12 7.5l3-1.5M12 16.5l3 1.5"/>',
  e_garden:'<circle cx="12" cy="9" r="3"/><path d="M12 12v8M9 20h6M12 3v1.5M6 9H4.5M19.5 9H18M7.8 4.8l1 1M16.2 4.8l-1 1"/>',
  e_switch:'<path d="M4 4v16"/><path d="M4 12h5"/><circle cx="10.5" cy="12" r="1.6" fill="currentColor"/><path d="M10.5 12l6-6M15 4.5l2.5 2.5"/>',
  e_dimmer:'<path d="M4 4v16"/><path d="M4 12h5"/><circle cx="10.5" cy="12" r="1.6" fill="currentColor"/><path d="M10.5 12l6-6"/><path d="M15 13a5 5 0 0 1-3 4.6"/><path d="M10.5 17.3l1.5.3-.4-1.6"/>',
  e_socket:'<path d="M4 4v16"/><path d="M4 6.5a5.5 5.5 0 0 1 0 11"/><path d="M9.5 10h6M9.5 14h6"/>',
  e_wp:'<path d="M4 4v16"/><path d="M4 6.5a5.5 5.5 0 0 1 0 11"/><path d="M9.5 10h4M9.5 14h4"/><path d="M15 17.5l1.2 3 1.3-3 1.3 3 1.2-3" stroke-width="1.2"/>',
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


/* ============================== electric plan: wiring, conduits, breaker panel, solar ============================== */
// A separate plan drawn over the home plan. The home plan, and the lights, switches and sockets placed on it, are
// shown but locked; only the wiring parts below are edited here. In the home plan the wiring shows faded, or not at all.
// Data lives in M.ep = {devs, wires, tubes, set} so it is saved, undone and opened with the project.
var eMode=false,epKind=null,epDraw=null,epGhost=null,epSnapMark=null,epPrevView='plan';
var epShow='faded';try{epShow=localStorage.getItem('bm-epshow')||'faded';}catch(e){}
const EP0=Object.freeze({devs:Object.freeze([]),wires:Object.freeze([]),tubes:Object.freeze([]),set:Object.freeze({spare:10,std:'mm2'})});
const epD=()=>M.ep||EP0;                       // read
function epW(){if(!M.ep)M.ep={devs:[],wires:[],tubes:[],set:{spare:10,std:'mm2'}};const e=M.ep;['devs','wires','tubes'].forEach(k=>{if(!Array.isArray(e[k]))e[k]=[];});if(!e.set)e.set={spare:10,std:'mm2'};return e;}   // write (inside mutate)
const epSet=()=>Object.assign({spare:10,std:'mm2'},epD().set||{});
const epHas=()=>{const e=epD();return !!(e.devs.length||e.wires.length||e.tubes.length);};
const epDev=id=>epD().devs.find(d=>d.id===id), epWire=id=>epD().wires.find(w=>w.id===id), epTube=id=>epD().tubes.find(t=>t.id===id);

const EPDEV={
  panel:{label:'Breaker panel',short:'DB',mount:'wall',h:1500,w:450},
  meter:{label:'Grid supply / meter',short:'M',mount:'wall',h:1500,w:300},
  jbox:{label:'Junction box',short:'JB',mount:'free',h:null},
  pv:{label:'Solar panels',short:'PV',mount:'free',h:null},
  dciso:{label:'DC isolator',short:'DCI',mount:'wall',h:1400,w:200},
  inverter:{label:'Inverter',short:'INV',mount:'wall',h:1500,w:450},
  battery:{label:'Battery',short:'BAT',mount:'wall',h:300,w:600}};
const WIRE_SIZES={mm2:['0.75','1','1.5','2.5','4','6','10','16','25','35','50'],awg:['18','16','14','12','10','8','6','4','2','1/0','2/0']};
const AWG_MM2={'18':0.82,'16':1.31,'14':2.08,'12':3.31,'10':5.26,'8':8.37,'6':13.3,'4':21.2,'2':33.6,'1/0':53.5,'2/0':67.4};
const BRK_AMPS=[6,10,16,20,25,32,40,50,63,80,100,125];
const BRK_TYPES=['MCB','RCBO','RCD','Solar','Isolator'];
const CONNECTORS={none:'None',wago:'Wago lever',nut:'Wire nut',crimp:'Crimp / ferrule',term:'Terminal block',lug:'Cable lug',mc4:'MC4 (solar)'};
const TUBE_TYPES=['PVC rigid','PVC flexible','Metal (EMT)','HDPE underground'];
const TUBE_DIAS=[16,20,25,32,40,50,63];
const ROUTES={ceiling:'In the ceiling',floor:'In the floor',ground:'Underground'};
const wireMM2=w=>w.std==='awg'?(AWG_MM2[w.size]||2.5):(parseFloat(w.size)||2.5);
const wireSizeTxt=w=>w.std==='awg'?w.size+' AWG':w.size+' mm²';
function wireColor(w){const a=wireMM2(w);return a<=1?'#7b8a90':a<=1.6?'#1c7ed6':a<=2.6?'#e03131':a<=4.5?'#f08c00':a<=7?'#2f9e44':a<=11?'#ae3ec9':a<=17?'#0c8599':'#7a4b2a';}
const wireWidth=w=>clamp(1.4+Math.sqrt(wireMM2(w))*1.1,1.6,7);

// ---- geometry
function epRefPos(r){if(!r)return null;if(r.k==='e'){const E=elecById(r.id);if(!E)return null;if(E.a&&r.end)return E[r.end].slice();return elecPos(E);}const d=epDev(r.id);return d?epDevPos(d):null;}
function epDevPos(d){if(EPDEV[d.type]&&EPDEV[d.type].mount==='wall'&&d.wall){const q=elecWallPos(d);return q?add(q.p,mul(q.n,epDevDepth(d)/2)):[d.x||0,d.y||0];}return [d.x,d.y];}
const epDevDepth=d=>d.type==='battery'?220:d.type==='panel'||d.type==='inverter'?140:110;
function epPts(o){const P=o.pts.map(p=>p.slice());const a=epRefPos(o.ea),b=epRefPos(o.eb);if(a)P[0]=a;if(b)P[P.length-1]=b;return P;}
// smooth path through the points (Catmull-Rom), or straight segments
function epPath(o){const P=epPts(o);if(!o.smooth||P.length<3)return P;const out=[P[0]];
  for(let i=0;i<P.length-1;i++){const p0=P[Math.max(0,i-1)],p1=P[i],p2=P[i+1],p3=P[Math.min(P.length-1,i+2)];const n=Math.max(6,Math.min(24,Math.round(dist(p1,p2)/150)));
    for(let k=1;k<=n;k++){const t=k/n,t2=t*t,t3=t2*t;out.push([0,1].map(j=>0.5*((2*p1[j])+(-p0[j]+p2[j])*t+(2*p0[j]-5*p1[j]+4*p2[j]-p3[j])*t2+(-p0[j]+3*p1[j]-3*p2[j]+p3[j])*t3)));}}return out;}
const pathLen=P=>{let L=0;for(let i=1;i<P.length;i++)L+=dist(P[i-1],P[i]);return L;};
function pathMid(P){const L=pathLen(P);let acc=0;for(let i=1;i<P.length;i++){const d=dist(P[i-1],P[i]);if(acc+d>=L/2){const t=(L/2-acc)/(d||1);return {p:add(P[i-1],mul(sub(P[i],P[i-1]),t)),d:norm(sub(P[i],P[i-1]))};}acc+=d;}return {p:P[0],d:[1,0]};}
function distToPath(p,P){let bd=1e12,bi=0;for(let i=1;i<P.length;i++){const c=segClosest(p,P[i-1],P[i]);const d=dist(p,c.q);if(d<bd){bd=d;bi=i;}}return {d:bd,i:bi};}

// ---- heights and lengths
function epRefH(r,p){if(!r)return null;if(r.k==='e'){const E=elecById(r.id);if(!E)return null;const D=ELEC[E.type];if(D.mount==='ceiling')return ceilAt(p);return E.h!=null?E.h:(D.h||ceilAt(p));}
  const d=epDev(r.id);if(!d)return null;if(d.h!=null)return d.h;const D=EPDEV[d.type];return D.h!=null?D.h:ceilAt(p);}
function routeH(w,p){return w.route==='floor'?0:w.route==='ground'?-600:ceilAt(p);}
function wireLens(w){const P=epPath(w),plan=pathLen(P);let drops=0;const Q=epPts(w);
  [[w.ea,Q[0]],[w.eb,Q[Q.length-1]]].forEach(([r,p])=>{const h=epRefH(r,p);if(h!=null)drops+=Math.abs(routeH(w,p)-h);});
  const sp=epSet().spare/100;return {plan,drops,total:(plan+drops)*(1+sp)};}
function tubeLen(t){return pathLen(epPath(t))*(1+epSet().spare/100);}
// outer diameter of a cable (mm), roughly: insulated cores laid up plus a sheath
function cableOD(w){const d1=2*Math.sqrt(wireMM2(w)/Math.PI)+1.6,n=clamp(w.cores||1,1,5);return d1*[1,1,2,2.16,2.42,2.7][n]+(n>1?2:0);}
function tubeFill(t){const wa=(t.wires||[]).map(epWire).filter(Boolean).reduce((a,w)=>a+Math.PI/4*cableOD(w)**2,0);const di=t.dia*0.85;return wa/(Math.PI/4*di*di);}
const refName=r=>{if(!r)return '—';if(r.k==='e'){const E=elecById(r.id);if(!E)return '—';const rm=roomAt(elecPos(E)||[0,0]);return (E.label?E.label+' ':'')+ELEC[E.type].label+(rm&&rm.name?' · '+rm.name:'');}const d=epDev(r.id);return d?(d.name||EPDEV[d.type].label):'—';};
const nextName=(arr,pre)=>{let n=arr.length+1;const has=new Set(arr.map(x=>x.name));while(has.has(pre+n))n++;return pre+n;};

// ---- availability, entering and leaving
function epAllowed(){return M.walls.length>=4&&(M.elec||[]).length>=1;}
function epSync(){const b=$('#vEplan');if(!b)return;const ok=epAllowed();b.setAttribute('aria-disabled',String(!ok));b.classList.toggle('lockd',!ok);
  b.title=ok?'Electric plan: wires, conduits, breaker panel and solar, drawn over the home plan':'Electric plan: draw at least 4 walls and add at least 1 light, switch or socket first';
  b.setAttribute('aria-pressed',String(eMode));if(eMode&&!ok)epLeave(true);const sb=$('#epShowBtn');if(sb){sb.hidden=!epHas()||eMode;sb.setAttribute('aria-pressed',String(epShow!=='hidden'));}}
function epEnter(){if(!epAllowed()){toast('Draw at least 4 walls and add at least one light, switch or socket with the Electrical tools first.');return;}
  if(eMode)return;eMode=true;const v=$('#stage').dataset.view;epPrevView=v==='eplan'?'plan':v;
  setView('plan');$('#app').classList.add('emode');eMode=true;setTool('select');sel=null;epKind=null;epDraw=null;
  ['vPlan','vSplit','vElev','v3d'].forEach(id=>$('#'+id).setAttribute('aria-pressed','false'));
  if(M.ep)M.ep.wires.forEach(w=>{[['ea',1],['eb',-2]].forEach(([k,j])=>{const r=w[k];if(!r||r.k!=='e'||r.end)return;const E=elecById(r.id);if(!E||!E.a)return;const nb=w.pts.length>2?w.pts[j<0?w.pts.length-2:1]:w.pts[k==='ea'?w.pts.length-1:0];r.end=dist(nb,E.a)<=dist(nb,E.b)?'a':'b';});});
  if(M.ep)M.ep.wires.concat(M.ep.tubes).forEach(o=>{const Q=epPts(o);o.pts[0]=Q[0];o.pts[o.pts.length-1]=Q[Q.length-1];});
  epSync();renderInspector();renderTakeoff();dirty();
  if(!epHas())toast('Electric plan: the home plan is locked. Place the breaker panel, then draw wires with the Electric plan tools, starting at a light, switch, socket or the panel.');}
function epLeave(quiet){if(!eMode)return;eMode=false;epDraw=null;epKind=null;$('#app').classList.remove('emode');if(tool==='eplan')setTool('select');else $('#hint').innerHTML=HINTS[tool]||'';sel=null;epSync();
  setView(epPrevView||'plan');renderInspector();renderTakeoff();dirty();}
function epSetKind(k){if(!eMode)return;epKind=k;epDraw=null;epGhost=null;setTool(k?'eplan':'select',k||undefined);}

// ---- drawing
const epPx=()=>clamp(view.s*190,8,16);
const epInfo=(o,on)=>MEAS.epinfo||!!o.info||!!on;   // Measures › Electric plan info, or this item's own "show its info"
const refKey=r=>r?(r.k+':'+r.id):'';const keyRef=k=>k?{k:k.split(':')[0],id:k.split(':')[1]}:null;
function epDrawDev(d,on,faded){const D=EPDEV[d.type];if(!D)return;ctx.save();if(faded)ctx.globalAlpha=0.32;const s=epPx();
  const font=w=>(w||600)+' '+Math.round(s*0.62)+'px '+getComputedStyle(document.body).fontFamily;
  if(d.type==='pv'){const n=Math.max(1,d.count||1),cols=Math.max(1,d.cols||Math.ceil(n/2)),rows=Math.ceil(n/cols),pw=1134,ph=1722,W=cols*pw,H=rows*ph;
    ctx.translate(...toS([d.x,d.y]));ctx.rotate((d.r||0)*Math.PI/180);const k=view.s;ctx.lineWidth=1.2;
    for(let i=0;i<n;i++){const cx=(i%cols)*pw-W/2,cy=Math.floor(i/cols)*ph-H/2;ctx.fillStyle='#1d3d6e';ctx.strokeStyle='#9fb4d6';ctx.fillRect(cx*k+1,cy*k+1,pw*k-2,ph*k-2);ctx.strokeRect(cx*k+1,cy*k+1,pw*k-2,ph*k-2);
      if(pw*k>14){ctx.beginPath();for(let j=1;j<3;j++){ctx.moveTo((cx+pw*j/3)*k,cy*k+2);ctx.lineTo((cx+pw*j/3)*k,(cy+ph)*k-2);}ctx.moveTo(cx*k+2,(cy+ph/2)*k);ctx.lineTo((cx+pw)*k-2,(cy+ph/2)*k);ctx.strokeStyle='rgba(159,180,214,.6)';ctx.stroke();}}
    if(on){ctx.strokeStyle=C.accent;ctx.lineWidth=2;ctx.setLineDash([5,3]);ctx.strokeRect(-W/2*k-4,-H/2*k-4,W*k+8,H*k+8);ctx.setLineDash([]);}
    ctx.restore();if(!faded&&epInfo(d,on))txt((d.name||'PV')+' · '+n+' × '+(d.watt||450)+' W',add(toS([d.x,d.y]),[0,0]),{weight:'600',size:11,color:'#fff',halo:'#1d3d6e'});return;}
  const q=toS(epDevPos(d));let ang=0;if(D.mount==='wall'&&d.wall){const P=elecWallPos(d);if(P)ang=Math.atan2(P.n[1],P.n[0])+Math.PI/2;}
  ctx.translate(q[0],q[1]);ctx.rotate(ang);
  if(d.type==='jbox'){const r=s*0.55;ctx.fillStyle=C.paper;ctx.strokeStyle='#495057';ctx.lineWidth=1.6;ctx.fillRect(-r,-r,2*r,2*r);ctx.strokeRect(-r,-r,2*r,2*r);ctx.beginPath();ctx.arc(0,0,r*0.35,0,Math.PI*2);ctx.fillStyle='#495057';ctx.fill();}
  else{const w=Math.max(s*2.2,(D.w||300)*view.s),h=Math.max(s*1.1,epDevDepth(d)*view.s);
    const fill={panel:'#343a40',meter:'#495057',dciso:'#c92a2a',inverter:'#5f3dc4',battery:'#2b8a3e'}[d.type]||'#495057';
    ctx.fillStyle=fill;ctx.strokeStyle=on?C.accent:'#212529';ctx.lineWidth=on?2.2:1.2;ctx.fillRect(-w/2,-h/2,w,h);ctx.strokeRect(-w/2,-h/2,w,h);
    ctx.rotate(-ang);ctx.fillStyle='#fff';ctx.font=font(700);ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(d.type==='meter'?'kWh':d.type==='inverter'?'~ INV':D.short,0,0);ctx.rotate(ang);}
  ctx.restore();
  if(on){ctx.save();ctx.strokeStyle=C.accent;ctx.lineWidth=2;ctx.setLineDash([3,2]);ctx.beginPath();ctx.arc(q[0],q[1],s*1.6,0,Math.PI*2);ctx.stroke();ctx.restore();}
  if(!faded&&epInfo(d,on)){let lab=d.name||'';if(d.type==='panel')lab+=' · '+(d.main||63)+' A · '+(d.brk||[]).length+' breakers';if(d.type==='inverter')lab+=' · '+(d.kw||5)+' kW';if(d.type==='battery')lab+=' · '+(d.kwh||10)+' kWh';if(d.type==='dciso')lab+=' · '+(d.amps||32)+' A DC';
    if(lab)txt(lab,[q[0],q[1]+s*1.9],{weight:'600',size:10.5,color:C.ink,halo:C.paper});
    if(d.type==='panel')(d.brk||[]).slice(0,12).forEach((b,i)=>txt((b.name||'Breaker')+' '+b.amps+' A '+(b.poles||1)+'P'+(b.to?' → '+refName(keyRef(b.to)):''),[q[0],q[1]+s*1.9+14+i*13],{size:10,color:C.muted,halo:C.paper,mono:true}));}}
function epStrokePath(P){ctx.beginPath();P.forEach((p,i)=>{const s=toS(p);i?ctx.lineTo(s[0],s[1]):ctx.moveTo(s[0],s[1]);});}
function epDrawTube(t,on,faded){const P=epPath(t);if(P.length<2)return;ctx.save();if(faded)ctx.globalAlpha=0.28;const wpx=Math.max(7,t.dia*view.s);
  ctx.lineCap='round';ctx.lineJoin='round';epStrokePath(P);ctx.strokeStyle=on?C.accent:'#868e96';ctx.lineWidth=wpx+2;ctx.stroke();
  epStrokePath(P);ctx.strokeStyle=t.type&&t.type.startsWith('HDPE')?'#ffe8cc':t.type&&t.type.startsWith('Metal')?'#dee2e6':'#e9ecef';ctx.lineWidth=wpx;ctx.stroke();ctx.restore();
  if(!faded&&epInfo(t,on)){const m=pathMid(P),fl=tubeFill(t);const q=toS(add(m.p,mul(perp(m.d),Math.max(t.dia,22/view.s))));
    txt((t.name||'')+' Ø'+t.dia+' · '+(t.wires||[]).length+((t.wires||[]).length===1?' wire · ':' wires · ')+fmtRun(tubeLen(t))+' '+runU()+(fl>0?' · '+Math.round(fl*100)+'%':''),q,{size:10,weight:'500',color:fl>0.4?C.danger:'#495057',halo:C.paper});}
  if(on)epHandles(t);}
function epDrawWire(w,on,faded){const P=epPath(w);if(P.length<2)return;ctx.save();if(faded)ctx.globalAlpha=0.3;ctx.lineCap='round';ctx.lineJoin='round';
  if(on){epStrokePath(P);ctx.strokeStyle=C['accent-weak'];ctx.lineWidth=wireWidth(w)+8;ctx.stroke();}
  epStrokePath(P);ctx.strokeStyle=wireColor(w);ctx.lineWidth=wireWidth(w);if(w.kind==='dc')ctx.setLineDash([9,5]);ctx.stroke();ctx.setLineDash([]);
  // connectors at the ends
  const Q=epPts(w);[[Q[0],w.ca],[Q[Q.length-1],w.cb]].forEach(([p,c])=>{const s=toS(p);ctx.fillStyle=wireColor(w);ctx.strokeStyle=C.paper;ctx.lineWidth=1;
    if(!c||c==='none'){ctx.beginPath();ctx.arc(s[0],s[1],2.6,0,Math.PI*2);ctx.fill();return;}
    ctx.beginPath();if(c==='wago'||c==='term')ctx.rect(s[0]-4,s[1]-4,8,8);else if(c==='nut'){ctx.moveTo(s[0],s[1]-5);ctx.lineTo(s[0]+5,s[1]+4);ctx.lineTo(s[0]-5,s[1]+4);ctx.closePath();}
    else if(c==='mc4'||c==='lug'){ctx.moveTo(s[0],s[1]-5);ctx.lineTo(s[0]+5,s[1]);ctx.lineTo(s[0],s[1]+5);ctx.lineTo(s[0]-5,s[1]);ctx.closePath();}else ctx.arc(s[0],s[1],4,0,Math.PI*2);ctx.fill();ctx.stroke();});
  ctx.restore();
  if(!faded&&epInfo(w,on)){const m=pathMid(P),L=wireLens(w);const n=perp(m.d);const q=toS(add(m.p,mul(n,16/view.s)));let a=Math.atan2(m.d[1],m.d[0]);if(a>Math.PI/2)a-=Math.PI;if(a<-Math.PI/2)a+=Math.PI;
    txt((w.name?w.name+' ':'')+(w.kind==='dc'?'DC':'AC')+' '+wireSizeTxt(w)+' '+(w.cores||1)+'C · '+fmtRun(L.total)+' '+runU(),q,{size:10,weight:'600',color:wireColor(w),halo:C.paper,rot:a});}
  if(on)epHandles(w);}
// the middle of stretch i (between points i-1 and i), on the drawn curve
function epSegMid(o,Q,i){if(!o.smooth||Q.length<3)return mul(add(Q[i-1],Q[i]),.5);const p0=Q[Math.max(0,i-2)],p1=Q[i-1],p2=Q[i],p3=Q[Math.min(Q.length-1,i+1)],t=.5,t2=t*t,t3=t2*t;
  return [0,1].map(j=>0.5*((2*p1[j])+(-p0[j]+p2[j])*t+(2*p0[j]-5*p1[j]+4*p2[j]-p3[j])*t2+(-p0[j]+3*p1[j]-3*p2[j]+p3[j])*t3));}
function epHandles(o){const Q=epPts(o);Q.forEach((p,i)=>{const s=toS(p),end=i===0||i===Q.length-1;ctx.save();ctx.fillStyle=end?C.paper:C.accent;ctx.strokeStyle=C.accent;ctx.lineWidth=1.6;
  const r=ptrTouch?6:4.5;ctx.beginPath();if(end)ctx.arc(s[0],s[1],r+1,0,Math.PI*2);else ctx.rect(s[0]-r,s[1]-r,2*r,2*r);ctx.fill();ctx.stroke();ctx.restore();});
  // a round handle in the middle of each stretch: drag it to bend the run there
  for(let i=1;i<Q.length;i++){const m=toS(epSegMid(o,Q,i)),r=ptrTouch?6.5:5;ctx.save();ctx.fillStyle=C.paper;ctx.strokeStyle=C.accent;ctx.lineWidth=1.5;ctx.setLineDash([2,2]);
    ctx.beginPath();ctx.arc(m[0],m[1],r,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.setLineDash([]);ctx.beginPath();ctx.moveTo(m[0]-r*0.5,m[1]);ctx.lineTo(m[0]+r*0.5,m[1]);ctx.moveTo(m[0],m[1]-r*0.5);ctx.lineTo(m[0],m[1]+r*0.5);ctx.stroke();ctx.restore();}}
function drawEplan(){if(!M)return;const E=epD();
  if(eMode){const W=planCv.width/pxr(),H=planCv.height/pxr();ctx.save();ctx.globalAlpha=0.62;ctx.fillStyle=C.paper;ctx.fillRect(-10,-10,(EXP?EXP.w:W)+20,(EXP?EXP.h:H)+20);ctx.restore();
    (M.elec||[]).forEach(x=>drawElecItem(x,false,false));}
  else{if(epShow==='hidden'||!epHas()||EXP&&!eMode)return;}
  const faded=!eMode,s=eMode&&sel&&sel.kind==='ep'?sel:null;
  E.tubes.forEach(t=>epDrawTube(t,s&&s.id===t.id,faded));
  E.devs.filter(d=>d.type==='pv').forEach(d=>epDrawDev(d,s&&s.id===d.id,faded));
  E.wires.forEach(w=>epDrawWire(w,s&&s.id===w.id,faded));
  E.devs.filter(d=>d.type!=='pv').forEach(d=>epDrawDev(d,s&&s.id===d.id,faded));
  if(eMode&&!EXP)epDrawTool();}
function epDrawTool(){if(tool!=='eplan')return;
  if(epDraw){const o=Object.assign({},epDraw,{pts:epDraw.pts.concat([epGhost&&epGhost.p||epDraw.pts[epDraw.pts.length-1]]),eb:epGhost&&epGhost.ref||null});
    if(epKind==='tube')epDrawTube(o,false,false);else epDrawWire(o,false,false);}
  else if(epGhost&&epGhost.dev){epDrawDev(epGhost.dev,false,false);}
  if(epGhost&&epGhost.ref){const s=toS(epGhost.p);ctx.save();ctx.strokeStyle=C.snap;ctx.lineWidth=2;ctx.beginPath();ctx.arc(s[0],s[1],11,0,Math.PI*2);ctx.stroke();ctx.restore();}
  else if(epGhost&&epGhost.sn)drawSnapMark(epGhost.sn);}

// ---- snapping wire ends to lights, switches, sockets and wiring parts
// A spot light takes one wire; a strip light takes one wire at each end (two in all), right on the end point.
// how many wires a light takes: two (power in, and on to the next light); a strip light one at each end
const EP_MAX={spot:2,chandelier:2,wall:2,garden:2};var epBlocked=null;
const lightKey=r=>r.id+(r.end?':'+r.end:'');
function epUsedLights(skipWire,extra){const u=new Map(),add=r=>{if(r&&r.k==='e'){const k=lightKey(r);u.set(k,(u.get(k)||0)+1);}};epD().wires.forEach(w=>{if(w.id===skipWire)return;[w.ea,w.eb].forEach(add);});(extra||[]).forEach(add);return u;}
function epSnapRef(p,skipWire,extra){const tol=(ptrTouch?22:14)/view.s;let best=null,bd=tol;const used=epUsedLights(skipWire,extra);epBlocked=null;
  (M.elec||[]).forEach(E=>{let q,d,end=null;
    if(E.a){d=dist(p,segClosest(p,E.a,E.b).q);if(d>=bd)return;const ends=(dist(p,E.a)<=dist(p,E.b)?['a','b']:['b','a']).filter(k=>!used.has(E.id+':'+k));
      if(!ends.length){if(!epBlocked||d<epBlocked.d)epBlocked={E,d};return;}end=ends[0];q=E[end].slice();}
    else{q=elecPos(E);if(!q)return;d=dist(p,q);if(d>=bd)return;if(EP_MAX[E.type]&&(used.get(E.id)||0)>=EP_MAX[E.type]){if(!epBlocked||d<epBlocked.d)epBlocked={E,d};return;}}
    bd=d;best={ref:end?{k:'e',id:E.id,end}:{k:'e',id:E.id},p:q};});
  if(best)epBlocked=null;
  epD().devs.forEach(d=>{if(d.type==='pv'){const n=Math.max(1,d.count||1),cols=Math.max(1,d.cols||Math.ceil(n/2)),rows=Math.ceil(n/cols);const hw=cols*1134/2,hh=rows*1722/2;const l=rotV(sub(p,[d.x,d.y]),-(d.r||0));if(Math.abs(l[0])<hw&&Math.abs(l[1])<hh&&!best)best={ref:{k:'d',id:d.id},p:[d.x,d.y]};return;}
    const q=epDevPos(d);if(dist(p,q)<bd*1.4){bd=dist(p,q);best={ref:{k:'d',id:d.id},p:q};epBlocked=null;}});return best;}
const epBlockedMsg=()=>!epBlocked?'':epBlocked.E.a?'Strip light already has a wire on both ends':ELEC[epBlocked.E.type].label+' already has its '+EP_MAX[epBlocked.E.type]+' wires (lights take two at most)';
function epPoint(p,from,skipWire,extra){const r=epSnapRef(p,skipWire,extra);if(r)return r;const sn=snapPoint(p,from);return {p:sn.p,sn};}

// ---- tools
function epToolMove(p){if(!epKind)return;
  if(epKind==='wire_ac'||epKind==='wire_dc'||epKind==='tube'){epGhost=epKind==='tube'?(()=>{const sn=snapPoint(p,epDraw&&epDraw.pts[epDraw.pts.length-1]);return {p:sn.p,sn};})():epPoint(p,epDraw&&epDraw.pts[epDraw.pts.length-1],null,epDraw?[epDraw.ea]:[]);$('#snapchip').textContent=epBlockedMsg()||(epGhost&&epGhost.ref?'to '+refName(epGhost.ref):'');dirty();return;}
  const D=EPDEV[epKind];if(!D)return;
  if(D.mount==='wall'){const sl=wallSlot(p);epGhost=sl?{dev:Object.assign(epNewDev(epKind),sl)}:null;dirty();return;}
  const sn=snapPoint(p,null);epGhost={dev:Object.assign(epNewDev(epKind),{x:sn.p[0],y:sn.p[1]}),sn};dirty();}
function epNewDev(t){const d={id:'ghost',type:t};const E=epD();
  if(t==='panel')Object.assign(d,{name:nextName(E.devs.filter(x=>x.type==='panel'),'DB'),main:63,poles:2,feedStd:epSet().std,feedSize:epSet().std==='awg'?'4':'16',feedLen:5000,brk:[]});
  if(t==='jbox')d.name=nextName(E.devs.filter(x=>x.type==='jbox'),'JB');
  if(t==='meter')d.name='Grid';
  if(t==='pv')Object.assign(d,{name:nextName(E.devs.filter(x=>x.type==='pv'),'PV'),count:8,cols:4,watt:450,r:0});
  if(t==='dciso')Object.assign(d,{name:nextName(E.devs.filter(x=>x.type==='dciso'),'DCI'),amps:32,volts:1000});
  if(t==='inverter')Object.assign(d,{name:nextName(E.devs.filter(x=>x.type==='inverter'),'INV'),kw:5});
  if(t==='battery')Object.assign(d,{name:nextName(E.devs.filter(x=>x.type==='battery'),'BAT'),kwh:10,volts:48});
  return d;}
function epToolClick(p){if(!epKind)return;
  if(epKind==='wire_ac'||epKind==='wire_dc'||epKind==='tube'){const isT=epKind==='tube';const last=epDraw&&epDraw.pts[epDraw.pts.length-1];
    const r=isT?(()=>{const sn=snapPoint(p,last);return {p:sn.p};})():epPoint(p,last,null,epDraw?[epDraw.ea]:[]);
    if(!isT&&!r.ref&&epBlocked){toast(epBlockedMsg()+'. Delete or move '+'one of its wires'+' first.');return;}
    if(!epDraw){const st=epSet(),dc=epKind==='wire_dc';
      epDraw=isT?{type:'tube',pts:[r.p.slice()],smooth:true,dia:20,tt:'PVC flexible'}
        :{type:'wire',pts:[r.p.slice()],ea:r.ref||null,smooth:true,kind:dc?'dc':'ac',std:st.std,size:st.std==='awg'?(dc?'10':'12'):(dc?'4':'2.5'),cores:dc?2:3,route:'ceiling'};
      renderInspector();dirty();return;}
    if(dist(r.p,last)<30){epFinish();return;}
    epDraw.pts.push(r.p.slice());if(r.ref&&!isT){epDraw.eb=r.ref;epFinish();return;}renderInspector();dirty();return;}
  const D=EPDEV[epKind];let at;
  if(D.mount==='wall'){const sl=wallSlot(p);if(!sl){toast(D.label+': click close to a wall, where it is mounted.');return;}at=sl;}else{const sn=snapPoint(p,null);at={x:sn.p[0],y:sn.p[1]};}
  const d=Object.assign(epNewDev(epKind),at,{id:nid('x')});mutate(()=>epW().devs.push(d));if(d.type!=='jbox'){epSetKind(null);sel={kind:'ep',t:'dev',id:d.id};}renderInspector();renderTakeoff();dirty();}
function epFinish(){const o=epDraw;epDraw=null;epGhost=null;if(!o||o.pts.length<2){renderInspector();dirty();return;}
  const E=epD();let made;
  if(o.type==='tube'){made={id:nid('z'),name:nextName(E.tubes,'C'),pts:o.pts,smooth:o.smooth,dia:o.dia,type:o.tt,wires:[]};
    // wires that run along this conduit go in it
    made.wires=E.wires.filter(w=>{const P=epPath(w);const T=epPath(made);let near=0,n=0;for(let i=0;i<P.length;i+=1){n++;if(distToPath(P[i],T).d<Math.max(150,made.dia*4))near++;}return n&&near/n>0.5;}).map(w=>w.id);
    mutate(()=>epW().tubes.push(made));}
  else{made={id:nid('y'),name:nextName(E.wires,'W'),pts:o.pts,ea:o.ea,eb:o.eb||null,smooth:o.smooth,kind:o.kind,std:o.std,size:o.size,cores:o.cores,route:o.route,ca:'none',cb:'none'};
    [['ea','ca'],['eb','cb']].forEach(([r,c])=>{const R=made[r];if(R&&R.k==='d'){const d=epDev(R.id);if(d&&d.type==='pv')made[c]='mc4';if(d&&d.type==='jbox')made[c]='wago';if(d&&d.type==='panel')made[c]='term';}});
    const pn=[made.ea,made.eb].map(r=>r&&r.k==='d'&&epDev(r.id)).find(d=>d&&d.type==='panel');if(pn&&(pn.brk||[]).length)made.circuit=pn.brk[0].id;
    mutate(()=>epW().wires.push(made));}
  sel={kind:'ep',t:o.type==='tube'?'tube':'wire',id:made.id};renderInspector();dirty();}

// ---- selecting and dragging (only wiring parts can be picked in the electric plan)
function epHit(p){const tol=(ptrTouch?16:9)/view.s;const E=epD();
  if(sel&&sel.kind==='ep'&&(sel.t==='wire'||sel.t==='tube')){const o=sel.t==='wire'?epWire(sel.id):epTube(sel.id);if(o){const Q=epPts(o);for(let i=0;i<Q.length;i++)if(dist(p,Q[i])<tol*1.2)return {t:sel.t,id:o.id,pt:i};
    for(let i=1;i<Q.length;i++)if(dist(p,epSegMid(o,Q,i))<tol*1.3)return {t:sel.t,id:o.id,seg:i,mid:true};}}
  for(const d of E.devs){if(d.type==='pv')continue;if(dist(p,epDevPos(d))<Math.max(tol*1.5,epPx()*1.2/view.s))return {t:'dev',id:d.id};}
  let best=null,bd=tol;E.wires.forEach(w=>{const r=distToPath(p,epPath(w));const dd=r.d-wireWidth(w)/2/view.s;if(dd<bd){bd=dd;best={t:'wire',id:w.id,seg:r.i};}});if(best)return best;
  E.tubes.forEach(t=>{const r=distToPath(p,epPath(t));const dd=r.d-t.dia/2;if(dd<bd){bd=dd;best={t:'tube',id:t.id,seg:r.i};}});if(best)return best;
  for(const d of E.devs){if(d.type!=='pv')continue;const n=Math.max(1,d.count||1),cols=Math.max(1,d.cols||Math.ceil(n/2)),rows=Math.ceil(n/cols);const l=rotV(sub(p,[d.x,d.y]),-(d.r||0));if(Math.abs(l[0])<cols*567&&Math.abs(l[1])<rows*861)return {t:'dev',id:d.id};}
  return null;}
function epPointerDown(p,e,sp){const h=epHit(p);
  if(!h){if(sel&&sel.kind==='ep'){sel=null;renderInspector();}pan={sx:sp[0],sy:sp[1],ox:view.ox,oy:view.oy,click:false};planCv.setPointerCapture(e.pointerId);dirty();return;}
  sel={kind:'ep',t:h.t,id:h.id};renderInspector();
  drag={kind:'ep',t:h.t,id:h.id,pt:h.pt,seg:h.seg,mid:h.mid,p0:p,snap0:snapshot(),moved:false};
  const o=h.t==='wire'?epWire(h.id):h.t==='tube'?epTube(h.id):epDev(h.id);drag.o0=JSON.parse(JSON.stringify(o));
  if(h.t!=='dev'&&h.pt==null){drag.pts0=epPts(o);}
  planCv.setPointerCapture(e.pointerId);dirty();}
function epDragMove(drag,p){const dv=sub(p,drag.p0);
  if(drag.t==='dev'){const d=epDev(drag.id);if(!d)return;const D=EPDEV[d.type];
    if(D.mount==='wall'&&drag.o0.wall){const sl=wallSlot(p,60);if(sl){d.wall=sl.wall;d.s=sl.s;d.side=sl.side;}drag.snap={kind:'on wall'};return;}
    const sn=snapPoint(add([drag.o0.x,drag.o0.y],dv),null);d.x=sn.p[0];d.y=sn.p[1];drag.snap={kind:'move'};return;}
  const o=drag.t==='wire'?epWire(drag.id):epTube(drag.id);if(!o)return;const last=o.pts.length-1;
  if(drag.pt!=null){const i=drag.pt,end=i===0||i===last;
    if(end&&drag.t==='wire'){const r=epPoint(p,o.pts[i===0?1:last-1],o.id,[i===0?o.eb:o.ea]);o.pts[i]=r.p.slice();o[i===0?'ea':'eb']=r.ref||null;drag.snap={kind:r.ref?'to '+refName(r.ref):epBlocked?epBlockedMsg():'free end'};return;}
    const sn=snapPoint(p,null);o.pts[i]=sn.p.slice();if(end)o[i===0?'ea':'eb']=null;drag.snap={kind:'bend point'};return;}
  // dragging the line itself pulls a new bend point out of it
  if(drag.seg!=null){const P=drag.pts0;const Q=epPts(o);let si=1,bd=1e12;if(drag.mid)si=drag.seg;else for(let i=1;i<Q.length;i++){const c=segClosest(drag.p0,Q[i-1],Q[i]);const d=dist(drag.p0,c.q);if(d<bd){bd=d;si=i;}}
    o.pts.splice(si,0,p.slice());drag.pt=si;drag.seg=null;drag.snap={kind:'new bend point'};}}
function epDbl(p){const h=epHit(p);if(!h||h.t==='dev')return;const o=h.t==='wire'?epWire(h.id):epTube(h.id);if(!o)return;
  if(h.pt!=null){if(h.pt===0||h.pt===o.pts.length-1)return;mutate(()=>o.pts.splice(h.pt,1));toast('Bend point removed.');renderInspector();return;}
  const Q=epPts(o);let si=1,bd=1e12;for(let i=1;i<Q.length;i++){const c=segClosest(p,Q[i-1],Q[i]);const d=dist(p,c.q);if(d<bd){bd=d;si=i;}}
  mutate(()=>o.pts.splice(si,0,p.slice()));sel={kind:'ep',t:h.t,id:o.id};renderInspector();toast('Bend point added: drag it to shape the run. Double-click it to remove it.');}
function epDelete(){if(!sel||sel.kind!=='ep')return;const s=sel;mutate(()=>{const E=epW();
  if(s.t==='wire'){E.wires=E.wires.filter(w=>w.id!==s.id);E.tubes.forEach(t=>t.wires=(t.wires||[]).filter(id=>id!==s.id));}
  if(s.t==='tube')E.tubes=E.tubes.filter(t=>t.id!==s.id);
  if(s.t==='dev'){E.devs=E.devs.filter(d=>d.id!==s.id);E.wires.forEach(w=>{['ea','eb'].forEach(k=>{if(w[k]&&w[k].k==='d'&&w[k].id===s.id)w[k]=null;});});}});
  sel=null;renderInspector();dirty();}
// keys in the electric plan: Enter / double-click finishes a run, Esc cancels, Delete removes; home-plan shortcuts are off
function epKey(e,k){if(!eMode)return false;const tag=(e.target.tagName||'').toLowerCase();if(tag==='input'||tag==='select'||tag==='textarea')return false;
  if(epDraw){if(k==='enter'){e.preventDefault();epFinish();return true;}if(k==='escape'){epDraw=null;epGhost=null;renderInspector();dirty();return true;}
    if(k==='backspace'||k==='delete'){e.preventDefault();epDraw.pts.pop();if(!epDraw.pts.length)epDraw=null;renderInspector();dirty();return true;}}
  if(k==='escape'){if(tool==='eplan')epSetKind(null);else{sel=null;renderInspector();dirty();}return true;}
  if((k==='delete'||k==='backspace')&&sel&&sel.kind==='ep'){e.preventDefault();epDelete();return true;}
  if(k==='f'||k==='s'||e.key==='+'||e.key==='='||e.key==='-'||e.key==='_'||k===' ')return false;
  if(/^[a-z]$/.test(k)||k.startsWith('arrow')||k==='delete'||k==='backspace')return true;return false;}

function epHint(t,k){if(t==='eplan'){if(k==='wire_ac'||k==='wire_dc'||k==='tube')return 'Click to start, click to add bend points; end on a part, or double-click / <kbd>Enter</kbd>. <kbd>Backspace</kbd> removes the last point, <kbd>Esc</kbd> cancels.';return 'Click to place it. <kbd>Esc</kbd> goes back to the Pointer.';}
  return 'Electric plan: click a wire, conduit or part to edit it. Drag points to reshape a run; double-click a wire to add a bend point. <kbd>Del</kbd> deletes. The home plan is locked.';}
function epFeedOptions(cur){const E=epD();const jb=E.devs.filter(d=>d.type==='jbox'),oth=E.devs.filter(d=>d.type!=='jbox'&&d.type!=='panel'&&d.type!=='pv');
  const el=(M.elec||[]).filter(x=>x.type!=='strip'||true);
  return opt('',cur||'','— not set —')+(jb.length?`<optgroup label="Junction boxes">${jb.map(d=>opt('d:'+d.id,cur,d.name||'Junction box')).join('')}</optgroup>`:'')
    +(oth.length?`<optgroup label="Other parts">${oth.map(d=>opt('d:'+d.id,cur,(d.name?d.name+' · ':'')+EPDEV[d.type].label)).join('')}</optgroup>`:'')
    +(el.length?`<optgroup label="Straight to a light, switch or socket">${el.map(x=>opt('e:'+x.id,cur,refName({k:'e',id:x.id}))).join('')}</optgroup>`:'');}
function epInfoRow(o){return `<label class="epinfo"><input type="checkbox" id="epInfo"${o.info||MEAS.epinfo?' checked':''}${MEAS.epinfo?' disabled':''}> <span>Show its info on the plan${MEAS.epinfo?'<small>All electric info is on (Measures menu). Turn that off to show only the items you pick.</small>':''}</span></label>`;}
// ---- side panel
const opt=(v,cur,lab)=>`<option value="${esc(String(v))}"${String(v)===String(cur)?' selected':''}>${esc(lab!=null?lab:String(v))}</option>`;
function epToolPanel(){const names={wire_ac:'AC wire',wire_dc:'DC wire',tube:'Conduit'};
  if(names[epKind]){const how=epKind==='tube'?'Click along the route of the conduit; double-click or press Enter to finish. Wires that run along it are put in it; change that in its panel.'
    :epDraw?'Click to add bend points. Click on a light, switch, socket, junction box or panel to end the wire there, or double-click / Enter to end it anywhere. Backspace removes the last point, Esc cancels.'
    :'Click where the wire starts: on a light, switch, socket, junction box or the breaker panel (they light up orange), or anywhere.';
    return `<p class="h">New ${names[epKind].toLowerCase()}</p><p class="tip">${how}</p><p class="tip">The run is drawn as a smooth curve through your points; switch it to straight lines in its panel. Size, cores and route are set in its panel afterwards.</p>`;}
  const D=EPDEV[epKind];return D?`<p class="h">New ${D.label.toLowerCase()}</p><p class="tip">${D.mount==='wall'?'Click on a wall face where it is mounted.':'Click where it goes.'} Its settings are in its panel afterwards.</p>`:'';}
function epInspectorHTML(){
  if(tool==='eplan')return epToolPanel();
  if(!sel||sel.kind!=='ep')return `<p class="h">Electric plan</p><p class="empty">The home plan and its lights, switches and sockets are locked here. Pick a wiring tool on the left, or select a wire, conduit or part to edit it. Double-click a wire to add a bend point.</p>
    <div class="kv"><label>Wire sizes</label><div class="seg segsm" role="group" aria-label="Wire size standard"><button data-epstd="mm2" aria-pressed="${epSet().std==='mm2'}">mm²</button><button data-epstd="awg" aria-pressed="${epSet().std==='awg'}">AWG</button></div></div>
    <p class="tip"><b>Breakers</b>: click the breaker panel (DB) on the plan with the Pointer; its breakers (name, size, poles, type, and the junction box each one feeds) are listed here. Names, sizes and lengths on the plan: <b>Measures</b> menu › Electric plan.</p><p class="tip">Back to the home plan: press <b>Plan</b> (or any view) above.</p>`;
  const s=sel;
  if(s.t==='wire'){const w=epWire(s.id);if(!w)return '';const L=wireLens(w);const tubes=epD().tubes.filter(t=>(t.wires||[]).includes(w.id));
    const panels=[w.ea,w.eb].map(r=>r&&r.k==='d'&&epDev(r.id)).filter(d=>d&&d.type==='panel');const brks=(panels.length?panels:epD().devs.filter(d=>d.type==='panel')).flatMap(p=>(p.brk||[]).map(b=>({p,b})));
    return `<div class="selname">Wire ${esc(w.name||'')}<span class="selbtns"><button class="btn" id="epDel">Delete</button></span></div><div class="kv">
      <label for="epName">Name</label><input id="epName" data-type="text" style="font-family:var(--f-body)" value="${esc(w.name||'')}">
      <label>Current</label><div class="seg segsm" role="group" aria-label="AC or DC"><button data-epkind="ac" aria-pressed="${w.kind!=='dc'}">AC</button><button data-epkind="dc" aria-pressed="${w.kind==='dc'}">DC</button></div>
      <label>Size in</label><div class="seg segsm" role="group" aria-label="Size standard"><button data-wstd="mm2" aria-pressed="${w.std!=='awg'}">mm²</button><button data-wstd="awg" aria-pressed="${w.std==='awg'}">AWG</button></div>
      <label for="epSize">Size</label><select id="epSize">${WIRE_SIZES[w.std==='awg'?'awg':'mm2'].map(v=>opt(v,w.size,v+(w.std==='awg'?' AWG':' mm²'))).join('')}</select>
      <label for="epCores">Cores</label><select id="epCores">${[1,2,3,4,5].map(n=>opt(n,w.cores||1,n+(n===1?' core (single)':' cores'))).join('')}</select>
      <label for="epRoute">Runs</label><select id="epRoute">${Object.keys(ROUTES).map(k=>opt(k,w.route||'ceiling',ROUTES[k])).join('')}</select>
      <label>From</label><span class="ro" style="font-family:var(--f-body)">${esc(refName(w.ea))}</span>
      <label for="epCa">Connector</label><select id="epCa">${Object.keys(CONNECTORS).map(k=>opt(k,w.ca||'none',CONNECTORS[k])).join('')}</select>
      <label>To</label><span class="ro" style="font-family:var(--f-body)">${esc(refName(w.eb))}</span>
      <label for="epCb">Connector</label><select id="epCb">${Object.keys(CONNECTORS).map(k=>opt(k,w.cb||'none',CONNECTORS[k])).join('')}</select>
      ${brks.length?`<label for="epCirc">Circuit</label><select id="epCirc">${opt('','',' — none —')}${brks.map(({p,b})=>opt(b.id,w.circuit||'',(p.name||'DB')+' · '+(b.name||'Breaker')+' '+b.amps+' A')).join('')}</select>`:''}
      <label>Shape</label><div class="seg segsm" role="group" aria-label="Curved or straight"><button data-smooth="1" aria-pressed="${!!w.smooth}">Curved</button><button data-smooth="0" aria-pressed="${!w.smooth}">Straight</button></div>
      <label>On the plan</label><span class="ro">${fmtLen(L.plan,true)}</span>
      <label>Up / down</label><span class="ro">${fmtLen(L.drops,true)}</span>
      <label>With ${epSet().spare}% spare</label><span class="ro big">${fmtLen(L.total,true)}</span>
      <label>In conduit</label><span class="ro" style="font-family:var(--f-body)">${tubes.length?tubes.map(t=>esc(t.name)+' Ø'+t.dia).join(', '):'—'}</span></div>${epInfoRow(w)}
      <p class="tip">Drag a round + handle in the middle of a stretch (or the line anywhere) to bend the wire there; drag a square bend point to move it, double-click it to remove it. Drag an end onto a light, switch, socket or panel to connect it. "Up / down" is the run from the ceiling or floor to each end's height.</p>`;}
  if(s.t==='tube'){const t=epTube(s.id);if(!t)return '';const fl=tubeFill(t);
    return `<div class="selname">Conduit ${esc(t.name||'')}<span class="selbtns"><button class="btn" id="epDel">Delete</button></span></div><div class="kv">
      <label for="epName">Name</label><input id="epName" data-type="text" style="font-family:var(--f-body)" value="${esc(t.name||'')}">
      <label for="epType">Type</label><select id="epType">${TUBE_TYPES.map(v=>opt(v,t.type)).join('')}</select>
      <label for="epDia">Diameter</label><select id="epDia">${TUBE_DIAS.map(v=>opt(v,t.dia,v+' mm')).join('')}</select>
      <label>Length</label><span class="ro big">${fmtLen(tubeLen(t),true)}</span>
      <label>Fill</label><span class="ro" style="color:${fl>0.4?'var(--danger)':'inherit'}">${Math.round(fl*100)}%${fl>0.4?' (over 40%: use a bigger conduit)':''}</span>
      <label>Shape</label><div class="seg segsm" role="group" aria-label="Curved or straight"><button data-smooth="1" aria-pressed="${!!t.smooth}">Curved</button><button data-smooth="0" aria-pressed="${!t.smooth}">Straight</button></div></div>${epInfoRow(t)}
      <p class="h" style="margin-top:10px">Wires inside</p><div class="epchk">${epD().wires.length?epD().wires.map(w=>`<label><input type="checkbox" data-tw="${w.id}"${(t.wires||[]).includes(w.id)?' checked':''}> <span style="color:${wireColor(w)};font-weight:600">${esc(w.name||'')}</span> ${w.kind==='dc'?'DC':'AC'} ${wireSizeTxt(w)} ${w.cores||1}C</label>`).join(''):'<p class="empty">No wires yet.</p>'}</div>
      <p class="tip">Length includes the ${epSet().spare}% spare. Fill compares the cables' cross-section with the inside of the conduit.</p>`;}
  const d=epDev(s.id);if(!d)return '';const D=EPDEV[d.type];
  let h=`<div class="selname">${D.label}<span class="selbtns"><button class="btn" id="epDel">Delete</button></span></div>${epInfoRow(d)}<div class="kv"><label for="epName">Name</label><input id="epName" data-type="text" style="font-family:var(--f-body)" value="${esc(d.name||'')}">`;
  const num=(lab,id,v,unit)=>`<label for="${id}">${lab}</label><input id="${id}" data-type="num" value="${v}"${unit?` placeholder="${unit}"`:''}>`;
  if(D.mount==='wall')h+=field('Height to centre','epH',fmtLen(d.h!=null?d.h:D.h));
  if(d.type==='panel'){h+=`<label for="epMain">Main breaker</label><select id="epMain">${BRK_AMPS.map(a=>opt(a,d.main||63,a+' A')).join('')}</select>
      <label for="epPoles">Main poles</label><select id="epPoles">${[1,2,3,4].map(n=>opt(n,d.poles||2,n+'P')).join('')}</select>
      <label>Feed size in</label><div class="seg segsm" role="group" aria-label="Feed size standard"><button data-fstd="mm2" aria-pressed="${d.feedStd!=='awg'}">mm²</button><button data-fstd="awg" aria-pressed="${d.feedStd==='awg'}">AWG</button></div>
      <label for="epFeed">Main feed wire</label><select id="epFeed">${WIRE_SIZES[d.feedStd==='awg'?'awg':'mm2'].map(v=>opt(v,d.feedSize,v+(d.feedStd==='awg'?' AWG':' mm²'))).join('')}</select>
      ${field('Feed length','epFeedLen',fmtLen(d.feedLen||0))}</div>
      <p class="h" style="margin-top:10px">Breakers</p><div class="brks">
      ${(d.brk||[]).map((b,i)=>`<div class="brk"><input data-bk="${i}" data-f="name" value="${esc(b.name||'')}" placeholder="Name, e.g. Kitchen" aria-label="Breaker name"><button class="btn" data-bkdel="${i}" aria-label="Remove breaker">×</button>
        <select data-bk="${i}" data-f="amps" aria-label="Size">${BRK_AMPS.map(a=>opt(a,b.amps,a+' A')).join('')}</select><select data-bk="${i}" data-f="poles" aria-label="Poles">${[1,2,3].map(n=>opt(n,b.poles||1,n+'P')).join('')}</select><select data-bk="${i}" data-f="type" aria-label="Type">${BRK_TYPES.map(v=>opt(v,b.type||'MCB')).join('')}</select>
        <label class="brkto"><span>Feeds</span><select data-bk="${i}" data-f="to" aria-label="What this breaker feeds">${epFeedOptions(b.to)}</select></label>
        <span class="brkw">${(()=>{const ws=epD().wires.filter(w=>w.circuit===b.id);return ws.length?'Wire'+(ws.length>1?'s':'')+': '+ws.map(w=>esc(w.name)+' ('+wireSizeTxt(w)+')').join(', '):'No wire on this breaker yet';})()}</span></div>`).join('')||'<p class="empty">No breakers yet.</p>'}</div>
      <div class="rowbtns"><button class="btn" id="epAddBrk">Add breaker</button><button class="btn" id="epAddSolar">Add solar breaker</button></div>
      <p class="tip">For each breaker: its name, size (A), poles, type, and <b>Feeds</b>: the junction box (or part) it supplies. A wire drawn from this panel to that junction box goes on the breaker by itself; any wire can also be put on a breaker with <b>Circuit</b> in the wire's panel. A solar breaker takes the AC feed from the inverter.</p>`;return h;}
  if(d.type==='pv')h+=num('Panels','epCount',d.count||8)+num('Per row','epCols',d.cols||4)+num('Watts each','epWatt',d.watt||450)+num('Turn (°)','epRot',d.r||0)+`<label>Total</label><span class="ro big">${((d.count||8)*(d.watt||450)/1000).toFixed(2)} kWp</span>`;
  if(d.type==='dciso')h+=`<label for="epAmps">Rating</label><select id="epAmps">${[16,20,25,32,40,50,63].map(a=>opt(a,d.amps||32,a+' A')).join('')}</select>`+num('Volts DC','epVolts',d.volts||1000);
  if(d.type==='inverter')h+=num('Power (kW)','epKw',d.kw||5);
  if(d.type==='battery')h+=num('Capacity (kWh)','epKwh',d.kwh||10)+num('Volts','epVolts',d.volts||48);
  if(d.type==='jbox')h+=field('Height','epH',d.h!=null?fmtLen(d.h):'')+`<label></label><span class="ro" style="font-family:var(--f-body);font-size:11.5px">Empty = in the ceiling</span>`;
  h+=`</div><p class="tip">${D.mount==='wall'?'Drag it along the wall, or onto another wall.':'Drag it to move it.'} ${d.type==='pv'?'Solar chain: panels → DC isolator → inverter (→ battery) → solar breaker in the panel, joined with DC and AC wires.':''}</p>`;return h;}
function epBindInspector(){const el=$('#inspector');const ed=fn=>{mutate(fn);renderInspector();renderTakeoff();dirty();};const s=sel;
  el.querySelectorAll('[data-epstd]').forEach(b=>b.onclick=()=>ed(()=>{epW().set.std=b.dataset.epstd;}));
  if(!s||s.kind!=='ep')return;const o=s.t==='wire'?epWire(s.id):s.t==='tube'?epTube(s.id):epDev(s.id);if(!o)return;
  const on=(id,fn)=>{const e=document.getElementById(id);if(e)e.onchange=()=>fn(e.value);};
  const dl=$('#epDel');if(dl)dl.onclick=()=>epDelete();
  on('epName',v=>ed(()=>o.name=v.trim()||o.name));
  {const c=$('#epInfo');if(c)c.onchange=()=>ed(()=>{if(c.checked)o.info=true;else delete o.info;});}
  el.querySelectorAll('[data-smooth]').forEach(b=>b.onclick=()=>ed(()=>o.smooth=b.dataset.smooth==='1'));
  if(s.t==='wire'){el.querySelectorAll('[data-epkind]').forEach(b=>b.onclick=()=>ed(()=>{o.kind=b.dataset.epkind;if(o.kind==='dc'&&o.cores===3)o.cores=2;if(o.kind==='ac'&&o.cores===2)o.cores=3;}));
    el.querySelectorAll('[data-wstd]').forEach(b=>b.onclick=()=>ed(()=>{if(o.std===b.dataset.wstd)return;const a=wireMM2(o);o.std=b.dataset.wstd;const L=WIRE_SIZES[o.std];o.size=o.std==='awg'?L.reduce((x,y)=>Math.abs(AWG_MM2[y]-a)<Math.abs(AWG_MM2[x]-a)?y:x):L.reduce((x,y)=>Math.abs(+y-a)<Math.abs(+x-a)?y:x);}));
    on('epSize',v=>ed(()=>o.size=v));on('epCores',v=>ed(()=>o.cores=+v));on('epRoute',v=>ed(()=>o.route=v));on('epCa',v=>ed(()=>o.ca=v));on('epCb',v=>ed(()=>o.cb=v));on('epCirc',v=>ed(()=>{o.circuit=v||undefined;if(!v)return;const pn=epD().devs.find(d=>(d.brk||[]).some(b=>b.id===v));const b=pn&&pn.brk.find(b=>b.id===v);
      if(b&&!b.to){const other=[o.ea,o.eb].find(r=>r&&!(r.k==='d'&&r.id===pn.id));if(other&&[o.ea,o.eb].some(r=>r&&r.k==='d'&&r.id===pn.id))b.to=refKey(other);}}));}
  if(s.t==='tube'){on('epType',v=>ed(()=>o.type=v));on('epDia',v=>ed(()=>o.dia=+v));
    el.querySelectorAll('[data-tw]').forEach(c=>c.onchange=()=>ed(()=>{const L=new Set(o.wires||[]);c.checked?L.add(c.dataset.tw):L.delete(c.dataset.tw);o.wires=[...L];}));}
  if(s.t==='dev'){const nv=(id,fn,mn)=>on(id,v=>{const x=parseFloat(v);if(isFinite(x)&&x>=(mn||0))ed(()=>fn(x));else renderInspector();});
    on('epH',v=>{if(o.type==='jbox'&&!v.trim()){ed(()=>delete o.h);return;}const L=parseLen(v);if(L>=0)ed(()=>o.h=L);else renderInspector();});
    on('epMain',v=>ed(()=>o.main=+v));on('epPoles',v=>ed(()=>o.poles=+v));on('epFeed',v=>ed(()=>o.feedSize=v));
    on('epFeedLen',v=>{const L=parseLen(v);if(L>=0)ed(()=>o.feedLen=L);else renderInspector();});
    el.querySelectorAll('[data-fstd]').forEach(b=>b.onclick=()=>ed(()=>{if(o.feedStd===b.dataset.fstd)return;o.feedStd=b.dataset.fstd;o.feedSize=o.feedStd==='awg'?'4':'16';}));
    nv('epCount',x=>o.count=Math.round(x),1);nv('epCols',x=>o.cols=Math.round(x),1);nv('epWatt',x=>o.watt=x,1);nv('epRot',x=>o.r=x);nv('epKw',x=>o.kw=x,0.1);nv('epKwh',x=>o.kwh=x,0.1);nv('epVolts',x=>o.volts=x,1);on('epAmps',v=>ed(()=>o.amps=+v));
    el.querySelectorAll('[data-bk]').forEach(c=>c.onchange=()=>ed(()=>{const b=o.brk[+c.dataset.bk];const f=c.dataset.f;b[f]=f==='amps'||f==='poles'?+c.value:c.value;
      if(f==='to'){if(!b.to)delete b.to;else epD().wires.forEach(w=>{const ks=[refKey(w.ea),refKey(w.eb)];if(!w.circuit&&ks.includes('d:'+o.id)&&ks.includes(b.to))w.circuit=b.id;});}}));
    el.querySelectorAll('[data-bkdel]').forEach(c=>c.onclick=()=>ed(()=>{const b=o.brk.splice(+c.dataset.bkdel,1)[0];epD().wires.forEach(w=>{if(w.circuit===b.id)delete w.circuit;});}));
    const ab=$('#epAddBrk');if(ab)ab.onclick=()=>ed(()=>{o.brk=o.brk||[];o.brk.push({id:nid('k'),name:'Circuit '+(o.brk.length+1),amps:16,poles:1,type:'MCB'});});
    const as=$('#epAddSolar');if(as)as.onclick=()=>ed(()=>{o.brk=o.brk||[];o.brk.push({id:nid('k'),name:'Solar',amps:25,poles:2,type:'Solar'});});}}

// ---- worksheet: everything entered, with sizes and lengths, ready to be priced
function epRows(){const E=epD(),rows=[],R=(cat,item,spec,qty,unit)=>rows.push({cat,item,spec,qty,unit});const m=mm=>+(isMetric()?mm/1000:mm/304.8).toFixed(2),u=runU();
  const cab={};E.wires.forEach(w=>{const k=(w.kind==='dc'?'DC':'AC')+'|'+wireSizeTxt(w)+'|'+(w.cores||1);cab[k]=(cab[k]||0)+wireLens(w).total;});
  E.devs.filter(d=>d.type==='panel'&&d.feedLen).forEach(d=>{const k='AC|'+(d.feedStd==='awg'?d.feedSize+' AWG':d.feedSize+' mm²')+'|'+((d.poles||2)>2?5:3)+'|feed';cab[k]=(cab[k]||0)+d.feedLen*(1+epSet().spare/100);});
  Object.keys(cab).sort().forEach(k=>{const [kd,sz,c,f]=k.split('|');R('Cable',(f?'Main feed cable ':kd+' cable ')+c+'-core',sz,m(cab[k]),u);});
  const tb={};E.tubes.forEach(t=>{const k=t.type+'|'+t.dia;tb[k]=(tb[k]||0)+tubeLen(t);});Object.keys(tb).sort().forEach(k=>{const [ty,d]=k.split('|');R('Conduit',ty+' conduit','Ø'+d+' mm',m(tb[k]),u);});
  const jb=E.devs.filter(d=>d.type==='jbox').length;if(jb)R('Boxes','Junction box','',jb,'pcs');
  const cn={};E.wires.forEach(w=>[w.ca,w.cb].forEach(c=>{if(c&&c!=='none')cn[c]=(cn[c]||0)+(c==='mc4'?1:(w.cores||1));}));Object.keys(cn).forEach(c=>R('Connectors',CONNECTORS[c],c==='mc4'?'pairs':'per core',cn[c],'pcs'));
  E.devs.filter(d=>d.type==='panel').forEach(d=>{R('Panel','Breaker panel '+(d.name||''),(d.brk||[]).length+' ways · main '+(d.main||63)+' A '+(d.poles||2)+'P',1,'pcs');R('Breakers','Main breaker',(d.main||63)+' A '+(d.poles||2)+'P',1,'pcs');});
  const bk={};E.devs.filter(d=>d.type==='panel').forEach(d=>(d.brk||[]).forEach(b=>{const k=(b.type||'MCB')+'|'+b.amps+' A '+(b.poles||1)+'P';bk[k]=(bk[k]||0)+1;}));
  Object.keys(bk).sort().forEach(k=>{const [t,s]=k.split('|');R('Breakers',t==='Solar'?'Solar breaker':t,s,bk[k],'pcs');});
  E.devs.filter(d=>d.type==='meter').forEach(d=>R('Supply','Grid supply / meter',d.name||'',1,'pcs'));
  E.devs.filter(d=>d.type==='pv').forEach(d=>R('Solar','Solar panel',(d.watt||450)+' W',d.count||8,'pcs'));
  E.devs.filter(d=>d.type==='dciso').forEach(d=>R('Solar','DC isolator',(d.amps||32)+' A · '+(d.volts||1000)+' V DC',1,'pcs'));
  E.devs.filter(d=>d.type==='inverter').forEach(d=>R('Solar','Inverter',(d.kw||5)+' kW',1,'pcs'));
  E.devs.filter(d=>d.type==='battery').forEach(d=>R('Solar','Battery',(d.kwh||10)+' kWh · '+(d.volts||48)+' V',1,'pcs'));
  const c={};(M.elec||[]).forEach(x=>{const k=x.type==='switch'?'Switch|'+(x.gangs||1)+'-gang':x.type==='socket'?'Socket|'+(x.dbl?'double':'single'):x.type==='strip'?'Strip light|':ELEC[x.type].label+'|';c[k]=(c[k]||0)+(x.type==='strip'?dist(x.a,x.b):1);});
  Object.keys(c).sort().forEach(k=>{const [it,sp]=k.split('|');if(it==='Strip light')R('Devices',it,sp,m(c[k]),u);else R('Devices',it,sp,c[k],'pcs');});
  return rows;}
function epRuns(){return epD().wires.map(w=>{const L=wireLens(w);const b=w.circuit&&epD().devs.flatMap(d=>(d.brk||[]).map(x=>({d,x}))).find(o=>o.x.id===w.circuit);
  return {name:w.name||'',from:refName(w.ea),to:refName(w.eb),spec:(w.kind==='dc'?'DC ':'AC ')+wireSizeTxt(w)+' '+(w.cores||1)+'C',circuit:b?(b.d.name||'')+' '+(b.x.name||'')+' '+b.x.amps+' A':'',plan:L.plan,drops:L.drops,total:L.total};});}
function epBreakers(){return epD().devs.filter(d=>d.type==='panel').flatMap(d=>(d.brk||[]).map(b=>({panel:d.name||'DB',name:b.name||'',spec:b.amps+' A '+(b.poles||1)+'P',type:b.type||'MCB',to:b.to?refName(keyRef(b.to)):'',wires:epD().wires.filter(w=>w.circuit===b.id).map(w=>w.name+' '+wireSizeTxt(w)).join(', ')})));}
function epCSV(){const q=v=>{v=String(v==null?'':v);return /[",\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v;};const u=runU();
  let s='Electric plan worksheet,'+q(M.name||'')+'\nSpare included,'+epSet().spare+'%\n\nCategory,Item,Size / rating,Quantity,Unit,Unit price,Total\n';
  epRows().forEach((r,i)=>{s+=[r.cat,r.item,r.spec,r.qty,r.unit].map(q).join(',')+',,=D'+(i+5)+'*F'+(i+5)+'\n';});
  {const B=epBreakers();if(B.length){s+='\nBreaker schedule\nPanel,Breaker,Size,Type,Feeds,Wires\n';B.forEach(b=>{s+=[b.panel,b.name,b.spec,b.type,b.to,b.wires].map(q).join(',')+'\n';});}}
  s+='\nWire runs\nName,From,To,Cable,Circuit,On plan ('+u+'),Up/down ('+u+'),Total with spare ('+u+')\n';
  epRuns().forEach(r=>{s+=[r.name,r.from,r.to,r.spec,r.circuit,fmtRun(r.plan),fmtRun(r.drops),fmtRun(r.total)].map(q).join(',')+'\n';});return s;}
function epSheetHTML(full){const rows=epRows();if(!rows.length)return '<p class="empty">Nothing yet. Draw wires and place the panel, and they are listed here with sizes and lengths.</p>';
  let h=`<table class="qt eptab"><thead><tr><th>Item</th><th>Size</th><th>Qty</th>${full?'<th>Unit price</th><th>Total</th>':''}</tr></thead><tbody>`;let cat='';
  rows.forEach(r=>{if(r.cat!==cat){cat=r.cat;h+=`<tr class="epcat"><td colspan="${full?5:3}">${esc(cat)}</td></tr>`;}h+=`<tr><td>${esc(r.item)}</td><td>${esc(r.spec)}</td><td>${r.qty} ${esc(r.unit)}</td>${full?'<td></td><td></td>':''}</tr>`;});
  h+='</tbody></table>';
  if(full){const B=epBreakers();if(B.length)h+=`<p class="h" style="margin-top:14px">Breaker schedule</p><table class="qt eptab"><thead><tr><th>Panel</th><th>Breaker</th><th>Size</th><th>Type</th><th>Feeds</th><th>Wires</th></tr></thead><tbody>`+B.map(b=>`<tr><td>${esc(b.panel)}</td><td>${esc(b.name)}</td><td>${esc(b.spec)}</td><td>${esc(b.type)}</td><td>${esc(b.to)}</td><td>${esc(b.wires)}</td></tr>`).join('')+'</tbody></table>';}
  if(full){const runs=epRuns();if(runs.length){h+=`<p class="h" style="margin-top:14px">Wire runs</p><table class="qt eptab"><thead><tr><th>Name</th><th>From → to</th><th>Cable</th><th>Circuit</th><th>Plan</th><th>Up/down</th><th>Total</th></tr></thead><tbody>`+
    runs.map(r=>`<tr><td>${esc(r.name)}</td><td>${esc(r.from)} → ${esc(r.to)}</td><td>${esc(r.spec)}</td><td>${esc(r.circuit)}</td><td>${fmtRun(r.plan)}</td><td>${fmtRun(r.drops)}</td><td>${fmtRun(r.total)}</td></tr>`).join('')+'</tbody></table>';}}
  return h;}
function epSidePanel(){const el=$('#epSheet');if(!el)return;
  el.innerHTML=`<p class="h">Worksheet</p><div class="kv"><label for="epSpare">Spare</label><input id="epSpare" data-type="num" value="${epSet().spare}%"></div>${epSheetHTML(false)}
    <div class="rowbtns"><button class="btn" id="epOpenSheet">Open worksheet</button><button class="btn" id="epSaveCSV">Save as CSV</button></div><p class="unitnote">Lengths include the spare and the runs up and down to each part. The CSV opens in Excel with empty price columns.</p>`;
  $('#epSpare').onchange=e=>{const x=parseFloat(e.target.value);if(isFinite(x)&&x>=0&&x<=100){mutate(()=>epW().set.spare=x);}renderTakeoff();renderInspector();dirty();};
  $('#epOpenSheet').onclick=()=>{const b=document.createElement('div');b.className='epsheet';b.innerHTML=epSheetHTML(true);
    openModal('Electric plan worksheet',(M.name||'Project')+' · lengths in '+runU()+' include '+epSet().spare+'% spare.',null,[{label:'Close',fn:closeModal},{label:'Copy as CSV',fn:e=>copyText(epCSV(),e)},{label:'Save as CSV',primary:true,fn:()=>{closeModal();epSaveCSV();}}],b,true);};
  $('#epSaveCSV').onclick=epSaveCSV;}
async function epSaveCSV(){try{const p=await saveTextFile(safeName((M.name||'project')+' electric worksheet')+'.csv',epCSV(),'Spreadsheet (CSV)',['csv']);if(p)toast('Saved '+baseName(p));}catch(err){toast('Could not save: '+err);}}


/* ============================== plumbing plan: supply, hot water, drainage, vents, pumps ============================== */
// A separate plan like the electric plan: the home plan is shown faded and locked, plumbing is drawn over it.
// Pipes connect fixtures (the home plan's toilets, vanities, tubs, showers, sinks and dishwashers count too) and
// equipment. From the connections the app works out each pipe's load, its size, the pump flow and head, and a bill
// of materials with fittings. A second sheet ("Schematic") is a blank page for drawing a schematic by hand.
// Data: M.pl = {set, devs, pipes, sch:{devs, pipes}}. Sizes: metric (EN 806 / DIN 1988-300 / EN 12056) or US (IPC).
var pMode=false,plKind=null,plDraw=null,plGhost=null,plSheet='plan',plPrevView='plan';
var plShow='faded';try{plShow=localStorage.getItem('bm-plshow')||'faded';}catch(e){}
const PL_SET0={std:'metric',supply:'mains',mainsP:3,floorH:0,roofH:6,lift:15,riser:20,tankL:1000,fillMin:30,vmax:2.0,resid:1.0,spare:10,slope:2,people:4};
const PL0=Object.freeze({devs:Object.freeze([]),pipes:Object.freeze([]),sch:Object.freeze({devs:[],pipes:[]}),set:Object.freeze(PL_SET0)});
const plD=()=>M.pl||PL0;
function plW(){if(!M.pl)M.pl={devs:[],pipes:[],sch:{devs:[],pipes:[]},set:Object.assign({},PL_SET0)};const p=M.pl;['devs','pipes'].forEach(k=>{if(!Array.isArray(p[k]))p[k]=[];});
  if(!p.sch)p.sch={devs:[],pipes:[]};['devs','pipes'].forEach(k=>{if(!Array.isArray(p.sch[k]))p.sch[k]=[];});if(!p.set)p.set=Object.assign({},PL_SET0);return p;}
const plSet=()=>Object.assign({},PL_SET0,plD().set||{});
const plUS=()=>plSet().std==='us';
// the sheet being worked on: the plan (calculated) or the hand-drawn schematic
const plL=()=>plSheet==='sch'?(plD().sch||{devs:[],pipes:[]}):plD();
const plLW=()=>plSheet==='sch'?plW().sch:plW();
const plHas=()=>{const p=plD();return !!(p.devs.length||p.pipes.length);};
const plDev=id=>plD().devs.find(d=>d.id===id)||(plD().sch||{devs:[]}).devs.find(d=>d.id===id), plPipe=id=>plD().pipes.find(q=>q.id===id)||(plD().sch||{pipes:[]}).pipes.find(q=>q.id===id);

// ---- what each fixture needs: metric flow Qa (l/s, DIN 1988-300) cold/hot and discharge units DU (EN 12056-2, system II);
// US water supply fixture units (IPC, private use) cold/hot and drainage fixture units DFU; smallest drain (mm / inches)
const PLFIX={
  wc:{label:'Toilet (WC)',short:'WC',qc:.13,qh:0,uc:2.2,uh:0,du:1.8,dfu:3,dmin:110,dminUS:3,h:150},
  basin:{label:'Wash basin',short:'WB',qc:.07,qh:.07,uc:.5,uh:.5,du:.3,dfu:1,dmin:40,dminUS:1.25,h:900},
  sink:{label:'Kitchen sink',short:'KS',qc:.07,qh:.07,uc:1,uh:1,du:.6,dfu:2,dmin:50,dminUS:1.5,h:950},
  shower:{label:'Shower',short:'SH',qc:.15,qh:.15,uc:1,uh:1,du:.4,dfu:2,dmin:50,dminUS:2,h:2000},
  bath:{label:'Bathtub',short:'BT',qc:.15,qh:.15,uc:1,uh:1,du:.5,dfu:2,dmin:50,dminUS:1.5,h:600},
  bidet:{label:'Bidet',short:'BD',qc:.07,qh:.07,uc:.5,uh:.5,du:.3,dfu:1,dmin:40,dminUS:1.25,h:400},
  washer:{label:'Washing machine',short:'WM',qc:.15,qh:0,uc:1.4,uh:0,du:.6,dfu:2,dmin:50,dminUS:2,h:900},
  dw:{label:'Dishwasher',short:'DW',qc:.07,qh:0,uc:1.4,uh:0,du:.5,dfu:2,dmin:40,dminUS:1.5,h:500},
  faucet:{label:'Faucet / mixer',short:'F',qc:.07,qh:.07,uc:.5,uh:.5,du:0,dfu:0,dmin:0,dminUS:0,h:1000},
  tap:{label:'Outdoor tap',short:'OT',qc:.3,qh:0,uc:2.5,uh:0,du:0,dfu:0,dmin:0,dminUS:0,h:600},
  fdrain:{label:'Floor drain',short:'FD',qc:0,qh:0,uc:0,uh:0,du:.8,dfu:2,dmin:50,dminUS:2,h:0}};
// home-plan fixtures that plumbing connects to
const PL_ITEM={toilet:'wc',vanity:'basin',tub:'bath',shower:'shower',sinkbase:'sink',dishwasher:'dw'};
const PLEQ={
  meter:{label:'Water meter / mains',short:'M',mount:'free'},
  tank:{label:'Water tank',short:'TANK',mount:'free'},
  pump:{label:'Pump',short:'P',mount:'free'},
  ptank:{label:'Pressure tank',short:'PT',mount:'free'},
  heater:{label:'Water heater',short:'WH',mount:'free'},
  valve:{label:'Valve',short:'V',mount:'free'},
  fitting:{label:'Fitting',short:'FT',mount:'free'},
  stack:{label:'Stack / riser',short:'S',mount:'free'},
  manhole:{label:'Inspection chamber / sewer',short:'IC',mount:'free'},
  cleanout:{label:'Cleanout',short:'CO',mount:'free'},
  ventcap:{label:'Vent terminal / AAV',short:'VT',mount:'free'},
  note:{label:'Note',short:'',mount:'free'}};
const plIsFix=t=>!!PLFIX[t];
const plDevInfo=d=>PLFIX[d.type]||PLEQ[d.type]||{label:d.type,short:'?'};
const PLSYS={cold:{label:'Cold water',col:'#1c7ed6'},hot:{label:'Hot water',col:'#e03131'},hotret:{label:'Hot water return',col:'#f783ac',dash:[8,4]},
  drain:{label:'Drain / waste',col:'#7a4b2a'},vent:{label:'Vent',col:'#2f9e44',dash:[6,4]}};
const plSupply=s=>s==='cold'||s==='hot'||s==='hotret';
// pipe sizes, with inside diameters (mm) for the calculations
const PL_SIZES={
  metric:{supply:{PPR:[[20,13.2],[25,16.6],[32,21.2],[40,26.6],[50,33.4],[63,42]],PEX:[[16,12],[20,16],[26,20],[32,26],[40,33]]},
          drain:{PVC:[[40,36],[50,46],[75,71],[110,104],[125,118],[160,152]]}},
  us:{supply:{Copper:[['1/2',13.8],['3/4',19.9],['1',26],['1-1/4',32.1],['1-1/2',38.2],['2',50.4]],PEX:[['1/2',12.2],['3/4',17.3],['1',22.2],['1-1/4',27.1],['1-1/2',32]]},
      drain:{PVC:[['1-1/4',35],['1-1/2',40.9],['2',52.5],['3',77.9],['4',102.3],['6',154.1]]}}};
const PL_MATS=(std,sys)=>Object.keys(PL_SIZES[std][plSupply(sys)?'supply':'drain']);
const plMatDef=(std,sys)=>PL_MATS(std,sys)[0];
const plSizeList=q=>{const st=plSet().std;const m=PL_SIZES[st][plSupply(q.sys)?'supply':'drain'];return m[q.mat]||m[Object.keys(m)[0]];};
const plSizeTxt=(v,us)=>v==null||v===''?'—':(us?v+'"':v+' mm');
const usNum=v=>{const s=String(v);if(s.includes('-')){const [a,b]=s.split('-');return +a+usNum(b);}if(s.includes('/')){const [a,b]=s.split('/');return a/b;}return +s;};

// ---- positions
function plItem(id){return M.items.find(x=>x.id===id);}
function plRefPos(r){if(!r)return null;if(r.k==='i'){const it=plItem(r.id);return it?[it.x,it.y]:null;}const d=plDev(r.id);return d?[d.x,d.y]:null;}
function plRefType(r){if(!r)return null;if(r.k==='i'){const it=plItem(r.id);return it?PL_ITEM[it.type]:null;}const d=plDev(r.id);return d?d.type:null;}
function plRefName(r){if(!r)return '—';if(r.k==='i'){const it=plItem(r.id);if(!it)return '—';const rm=roomAt([it.x,it.y]);return CAT[it.type].label+(rm&&rm.name?' · '+rm.name:'');}
  const d=plDev(r.id);return d?(d.name||plDevInfo(d).label):'—';}
function plPts(q){const P=q.pts.map(p=>p.slice());const a=plRefPos(q.ea),b=plRefPos(q.eb);if(a)P[0]=a;if(b)P[P.length-1]=b;return P;}
function plPath(q){const P=plPts(q);if(!q.smooth||P.length<3)return P;const out=[P[0]];
  for(let i=0;i<P.length-1;i++){const p0=P[Math.max(0,i-1)],p1=P[i],p2=P[i+1],p3=P[Math.min(P.length-1,i+2)];const n=Math.max(6,Math.min(24,Math.round(dist(p1,p2)/150)));
    for(let k=1;k<=n;k++){const t=k/n,t2=t*t,t3=t2*t;out.push([0,1].map(j=>0.5*((2*p1[j])+(-p0[j]+p2[j])*t+(2*p0[j]-5*p1[j]+4*p2[j]-p3[j])*t2+(-p0[j]+3*p1[j]-3*p2[j]+p3[j])*t3)));}}return out;}
const plLen=q=>pathLen(plPath(q));
const plKey=p=>'p:'+Math.round(p[0])+','+Math.round(p[1]);
const plEndKey=(q,end)=>{const r=end==='a'?q.ea:q.eb;if(r)return r.k+':'+r.id;const P=plPts(q);return plKey(end==='a'?P[0]:P[P.length-1]);};

/* ---------- calculations (plan sheet only) ---------- */
// design flow from the sum of fixture flows: DIN 1988-300 (homes) Qd = 1.48·ΣQa^0.19 − 0.94, never above ΣQa nor below the largest single flow
function plQd(sum,maxOne){if(sum<=0)return 0;const f=sum>0.2?1.48*Math.pow(sum,0.19)-0.94:sum;return Math.min(sum,Math.max(maxOne,f));}
// US: water supply fixture units to gallons per minute (IPC Table E103.3(3), flush tanks)
const HUNTER=[[0,0],[1,3],[2,5],[3,6.5],[4,8],[5,9.4],[6,10.7],[7,11.8],[8,12.8],[9,13.7],[10,14.6],[12,16],[14,17],[16,18],[18,18.8],[20,19.6],[25,21.5],[30,23.3],[35,24.9],[40,26.3],[45,27.7],[50,29.1],[60,32],[70,35],[80,38],[90,41],[100,43.5],[150,55],[200,65],[300,85]];
function plGpm(u){if(u<=0)return 0;for(let i=1;i<HUNTER.length;i++){const [a,fa]=HUNTER[i-1],[b,fb]=HUNTER[i];if(u<=b)return fa+(fb-fa)*(u-a)/(b-a);}return 85+0.2*(u-300);}
const GPM_LS=0.0630902;
// US drainage: largest DFU on a horizontal branch (IPC Table 710.1(2))
const DFU_CAP=[['1-1/4',1],['1-1/2',3],['2',6],['3',20],['4',160],['6',620]];
// metric drain capacity at half full (Manning, n = 0.009 PVC), l/s
const drainCap=(dmm,slopePct)=>{const D=dmm/1000,A=Math.PI*D*D/8,R=D/4;return 1000*(1/0.009)*A*Math.pow(R,2/3)*Math.sqrt(slopePct/100);};
// friction loss (Hazen-Williams), metres of water for L metres of pipe
const hwLoss=(Lm,Qls,dmm,C)=>Qls<=0?0:10.67*Lm*Math.pow(Qls/1000,1.852)/(Math.pow(C,1.852)*Math.pow(dmm/1000,4.87));
// the networks: for each system, which way water flows in every pipe, and what each pipe carries
function plCalc(){const P=plD(),st=plSet(),us=st.std==='us',res={pipes:{},sys:{},issues:[]};if(!P.pipes.length)return res;
  const nodeLoad=(key,sys)=>{const [k,id]=[key.split(':')[0],key.slice(2)];let t=null;if(k==='i'){const it=plItem(id);t=it&&PL_ITEM[it.type];}else if(k==='d'){const d=P.devs.find(x=>x.id===id);t=d&&d.type;}
    const F=t&&PLFIX[t];if(!F)return null;if(sys==='cold')return {q:F.qc,u:F.uc};if(sys==='hot')return {q:F.qh,u:F.uh};if(sys==='drain')return {q:F.du,u:F.dfu,dmin:us?F.dminUS:F.dmin};return null;};
  const devType=key=>{if(!key.startsWith('d:'))return null;const d=P.devs.find(x=>x.id===key.slice(2));return d&&d.type;};
  ['hot','cold','drain'].forEach(sys=>{const pipes=P.pipes.filter(q=>q.sys===sys||(sys==='hot'&&q.sys==='hotret'));if(!pipes.length)return;
    const adj=new Map(),addE=(a,b,q)=>{(adj.get(a)||adj.set(a,[]).get(a)).push([q,b]);};
    pipes.forEach(q=>{const a=plEndKey(q,'a'),b=plEndKey(q,'b');addE(a,b,q);addE(b,a,q);});
    const rootTypes=sys==='cold'?(st.supply==='tank'?['pump','tank','meter']:['meter','pump','tank']):sys==='hot'?['heater']:['manhole','stack'];
    let roots=[];for(const t of rootTypes){roots=[...adj.keys()].filter(k=>devType(k)===t);if(roots.length)break;}
    if(!roots.length){res.issues.push(sys==='cold'?'Cold water has no source: connect a water meter, tank or pump.':sys==='hot'?'Hot water pipes are not connected to a water heater.':'Drains have no outlet: connect a stack or inspection chamber.');return;}
    const parent=new Map(),order=[],seen=new Set(roots);roots.forEach(r=>{order.push(r);});
    for(let i=0;i<order.length;i++){const n=order[i];(adj.get(n)||[]).forEach(([q,m])=>{if(seen.has(m))return;seen.add(m);parent.set(m,[q,n]);order.push(m);});}
    // loads gathered from the far ends back towards the source
    const acc=new Map();order.forEach(n=>acc.set(n,{q:0,u:0,mx:0,dmin:0,n:0}));
    order.forEach(n=>{let L=nodeLoad(n,sys);if(sys==='cold'&&devType(n)==='heater')L={heater:true};if(L&&!L.heater){const a=acc.get(n);a.q+=L.q;a.u+=L.u;a.mx=Math.max(a.mx,L.q);a.dmin=Math.max(a.dmin,L.dmin||0);a.n++;}});
    if(sys==='cold'){const H=res.sys.hot;order.forEach(n=>{if(devType(n)==='heater'&&H){const a=acc.get(n);a.q+=H.sumQ;a.u+=H.sumU;a.mx=Math.max(a.mx,H.maxQ);a.n+=H.count;}});}
    for(let i=order.length-1;i>=0;i--){const n=order[i],pe=parent.get(n);if(!pe)continue;const [q,up]=pe,a=acc.get(n),b=acc.get(up);
      b.q+=a.q;b.u+=a.u;b.mx=Math.max(b.mx,a.mx);b.dmin=Math.max(b.dmin,a.dmin);b.n+=a.n;
      res.pipes[q.id]={sys,from:up,to:n,sumQ:a.q,sumU:a.u,maxQ:a.mx,dmin:a.dmin,count:a.n};}
    const tot={q:0,u:0,mx:0,n:0};roots.forEach(r=>{const a=acc.get(r);tot.q+=a.q;tot.u+=a.u;tot.mx=Math.max(tot.mx,a.mx);tot.n+=a.n;});
    res.sys[sys]={roots,sumQ:tot.q,sumU:tot.u,maxQ:tot.mx,count:tot.n,parent,order};
    pipes.forEach(q=>{if(!res.pipes[q.id])res.issues.push((q.name||'A pipe')+' is not connected to the '+(sys==='drain'?'drain outlet':'supply')+'.');});});
  // sizes
  P.pipes.forEach(q=>{const r=res.pipes[q.id];if(!r||q.sys==='vent')return;
    if(plSupply(q.sys)){const Qd=us?plGpm(r.sumU)*GPM_LS:plQd(r.sumQ,r.maxQ);r.Qd=Qd;const vmax=us?st.vmax*0.3048:st.vmax;const list=plSizeList(q);
      let rec=list[list.length-1];for(const s of list){const A=Math.PI*Math.pow(s[1]/2000,2);if(Qd/1000/A<=vmax){rec=s;break;}}r.rec=rec[0];
      const use=q.size&&q.size!=='auto'?(list.find(s=>String(s[0])===String(q.size))||rec):rec;r.size=use[0];r.id=use[1];r.v=Qd/1000/(Math.PI*Math.pow(use[1]/2000,2));
      r.loss=hwLoss(plLen(q)/1000,Qd,use[1],q.mat==='Copper'?130:150)*1.3;return;}
    // drains
    const list=plSizeList(q);const slope=q.slope!=null?q.slope:(us?2.08:st.slope);let rec=list[list.length-1];
    if(us){for(const s of DFU_CAP){if(r.sumU<=s[1]&&usNum(s[0])>=r.dmin){rec=list.find(x=>x[0]===s[0])||rec;break;}}}
    else{const Qww=Math.max(0.5*Math.sqrt(r.sumQ),Math.min(r.sumQ,r.maxQ));r.Qww=Qww;for(const s of list){if(s[0]>=r.dmin&&drainCap(s[1],slope)>=Qww){rec=s;break;}}}
    r.rec=rec[0];r.size=q.size&&q.size!=='auto'?q.size:rec[0];r.slope=slope;r.fall=plLen(q)*slope/100;
    if(q.size&&q.size!=='auto'&&(us?usNum(q.size)<usNum(rec[0]):+q.size<+rec[0]))res.issues.push((q.name||'A drain')+' is smaller than needed ('+plSizeTxt(rec[0],us)+').');});
  P.pipes.forEach(q=>{if(q.sys!=='vent')return;const rec=plVentSize(q,res);res.pipes[q.id]={sys:'vent',rec,size:q.size&&q.size!=='auto'?q.size:rec};});
  res.pump=plPump(res);res.heater=plHeaterAdvice(res);return res;}
function plVentSize(q,res){const us=plUS();const list=plSizeList(q);let big=null;
  plD().pipes.forEach(o=>{if(o.sys!=='drain')return;const ks=[plEndKey(o,'a'),plEndKey(o,'b')];if(ks.includes(plEndKey(q,'a'))||ks.includes(plEndKey(q,'b'))){const r=res.pipes[o.id];if(r&&r.size!=null&&(!big||(us?usNum(r.size)>usNum(big):+r.size>+big)))big=r.size;}});
  if(big==null)return us?'1-1/2':50;const half=us?usNum(big)/2:+big/2;const min=us?1.25:40;const s=list.find(x=>(us?usNum(x[0]):x[0])>=Math.max(half,min));return s?s[0]:list[0][0];}
// the pump: flow at the source and the head to the hardest fixture (height + friction along the way + pressure needed there)
function plPump(res){const st=plSet(),us=st.std==='us',C=res.sys.cold;if(!C)return null;const P=plD();
  const residM=us?st.resid*0.70307:st.resid*10.197;   // psi or bar → metres of water
  // walk each fixture back to the source adding friction
  const fixH=key=>{const t=key.startsWith('i:')?(plItem(key.slice(2))?PL_ITEM[plItem(key.slice(2)).type]:null):(P.devs.find(d=>'d:'+d.id===key)||{}).type;const F=PLFIX[t];if(!F)return null;
    const d=key.startsWith('d:')&&P.devs.find(x=>'d:'+x.id===key);return d&&d.h!=null?d.h:F.h;};
  let worst=null;C.order.forEach(n=>{const h=fixH(n);if(h==null)return;let loss=0,m=n,guard=0;while(C.parent.has(m)&&guard++<5000){const [q,up]=C.parent.get(m);loss+=(res.pipes[q.id]&&res.pipes[q.id].loss)||0;m=up;}
    const need=h/1000+loss+residM;if(!worst||need>worst.need)worst={key:n,h,loss,need};});
  const Qd=us?plGpm(C.sumU)*GPM_LS:plQd(C.sumQ,C.maxQ);const out={Qd,worst,residM};
  const floorM=us?st.floorH*0.3048:st.floorH;
  if(st.supply==='mains'){const avail=(us?st.mainsP*0.70307:st.mainsP*10.197)-floorM;out.mode='mains';out.avail=avail;out.need=worst?worst.need:0;out.ok=avail>=out.need;
    if(!out.ok){out.head=out.need-avail+2;out.power=9.81*Qd/1000*out.head/0.5;}}
  else{const roofM=us?st.roofH*0.3048:st.roofH;out.mode='tank';out.gravity=worst?roofM-worst.h/1000-worst.loss:0;out.gravOk=out.gravity>=residM;
    // the lift pump fills the roof tank from the ground tank
    const Qf=st.tankL/(st.fillMin*60);const liftM=us?st.lift*0.3048:st.lift,riserM=us?st.riser*0.3048:st.riser;const sizes=PL_SIZES[st.std].supply[Object.keys(PL_SIZES[st.std].supply)[0]];
    let rs=sizes[sizes.length-1];for(const s of sizes){if(Qf/1000/(Math.PI*Math.pow(s[1]/2000,2))<=1.5){rs=s;break;}}
    out.fill=Qf;out.riserSize=rs[0];out.liftHead=liftM+hwLoss(riserM,Qf,rs[1],150)*1.3+2;out.liftPower=9.81*Qf/1000*out.liftHead/0.5;
    if(!out.gravOk){out.head=residM-out.gravity+2;out.power=9.81*Qd/1000*out.head/0.5;}}
  return out;}
function plHeaterAdvice(res){const st=plSet(),H=res.sys.hot;const L=st.people*50;const Qh=H?(plUS()?plGpm(H.sumU)*GPM_LS:plQd(H.sumQ,H.maxQ)):0;
  return {storage:L,inst:Qh*4.186*35,Qh};}   // storage: 50 L a person; instantaneous: kW to heat the design flow by 35 °C
let plRes=null,plResKey='';
function plR(){const k=JSON.stringify([M.pl,M.items.map(i=>[i.id,i.type,i.x,i.y])]);if(k!==plResKey){plResKey=k;try{plRes=plCalc();}catch(e){plRes={pipes:{},sys:{},issues:['Calculation error: '+e.message]};}}return plRes;}

/* ---------- fittings counted from the drawing ---------- */
function plFittings(){const P=plD(),R=plR(),us=plUS(),out={},add=(k,n)=>{out[k]=(out[k]||0)+(n||1);};
  const sz=q=>{const r=R.pipes[q.id];return r&&r.size!=null?r.size:(q.size&&q.size!=='auto'?q.size:null);};
  const stName=sys=>plSupply(sys)?'supply':'drain';
  P.pipes.forEach(q=>{const Q=plPts(q),s=sz(q);if(s==null)return;const tag=PLSYS[q.sys].label+' '+plSizeTxt(s,us);
    if(!q.smooth)for(let i=1;i<Q.length-1;i++){const a=norm(sub(Q[i],Q[i-1])),b=norm(sub(Q[i+1],Q[i]));const ang=Math.acos(clamp(dot(a,b),-1,1))*180/Math.PI;if(ang>60)add('Elbow 90°|'+tag);else if(ang>15)add('Elbow 45°|'+tag);}
    const stock=us?3048:(plSupply(q.sys)?4000:6000);const n=Math.ceil(plLen(q)/stock)-1;if(n>0)add('Coupling|'+tag,n);});
  // joints where pipes meet each other (not at a fixture or equipment)
  const nodes=new Map();P.pipes.forEach(q=>['a','b'].forEach(e=>{const k=plEndKey(q,e);if(!k.startsWith('p:'))return;(nodes.get(k)||nodes.set(k,[]).get(k)).push([q,e]);}));
  nodes.forEach(list=>{if(list.length<2)return;const q0=list[0][0],sizes=list.map(([q])=>sz(q)).filter(x=>x!=null);if(!sizes.length)return;
    const big=sizes.reduce((a,b)=>(us?usNum(b)>usNum(a):+b>+a)?b:a),small=sizes.reduce((a,b)=>(us?usNum(b)<usNum(a):+b<+a)?b:a);const tag=PLSYS[q0.sys].label+' '+plSizeTxt(big,us);
    if(list.length===2){const dirs=list.map(([q,e])=>{const Q=plPts(q);return e==='a'?norm(sub(Q[1],Q[0])):norm(sub(Q[Q.length-2],Q[Q.length-1]));});const ang=180-Math.acos(clamp(dot(dirs[0],dirs[1]),-1,1))*180/Math.PI;
      if(String(big)!==String(small))add('Reducer|'+PLSYS[q0.sys].label+' '+plSizeTxt(big,us)+' × '+plSizeTxt(small,us));else if(ang>60)add('Elbow 90°|'+tag);else if(ang>15)add('Elbow 45°|'+tag);else add('Coupling|'+tag);}
    else{add((q0.sys==='drain'?'Y-branch / tee':'Tee')+'|'+tag,list.length-2);if(String(big)!==String(small))add('Reducer|'+PLSYS[q0.sys].label+' '+plSizeTxt(big,us)+' × '+plSizeTxt(small,us),list.length-2);}});
  // a fitting where a pipe meets a fixture: supply = wall elbow / tap connector, drain = trap connection
  P.pipes.forEach(q=>['ea','eb'].forEach(k=>{const t=plRefType(q[k]);if(!t||!PLFIX[t])return;const s=sz(q);if(s==null)return;
    add((plSupply(q.sys)?'Wall elbow / tap connector':q.sys==='drain'?'Trap connection':'Vent connection')+'|'+PLSYS[q.sys].label+' '+plSizeTxt(s,us));}));
  return out;}

/* ---------- availability, entering and leaving ---------- */
function plAllowed(){return M.walls.length>=4;}
function plSync(){const b=$('#vPplan');if(!b)return;const ok=plAllowed();b.setAttribute('aria-disabled',String(!ok));b.classList.toggle('lockd',!ok);
  b.title=ok?'Plumbing plan: cold and hot water, drains and vents, pumps and heaters, drawn over the home plan':'Plumbing plan: draw at least 4 walls first';
  b.setAttribute('aria-pressed',String(pMode));if(pMode&&!ok)plLeave(true);const sb=$('#plShowBtn');if(sb){sb.hidden=!plHas()||pMode;sb.setAttribute('aria-pressed',String(plShow!=='hidden'));}
  document.querySelectorAll('[data-plsheet]').forEach(x=>x.setAttribute('aria-pressed',String(x.dataset.plsheet===plSheet)));}
function plEnter(){if(!plAllowed()){toast('Draw at least 4 walls first.');return;}if(pMode)return;if(typeof eMode!=='undefined'&&eMode)epLeave(true);
  const v=$('#stage').dataset.view;plPrevView=v;setView('plan');$('#app').classList.add('pmode');pMode=true;plSheet='plan';setTool('select');sel=null;plKind=null;plDraw=null;
  ['vPlan','vSplit','vElev','v3d'].forEach(id=>$('#'+id).setAttribute('aria-pressed','false'));plSync();renderInspector();renderTakeoff();dirty();
  if(!plHas())toast('Plumbing plan: the home plan is locked. Place a water meter (or tank and pump), then draw cold and hot pipes to the fixtures, and drains to a stack.');}
function plLeave(quiet){if(!pMode)return;pMode=false;plDraw=null;plKind=null;plSheet='plan';$('#app').classList.remove('pmode','plsch');if(tool==='plumb')setTool('select');else $('#hint').innerHTML=HINTS[tool]||'';sel=null;plSync();
  setView(plPrevView||'plan');renderInspector();renderTakeoff();dirty();}
function plSetKind(k){if(!pMode)return;plKind=k;plDraw=null;plGhost=null;setTool(k?'plumb':'select',k||undefined);}
function plSetSheet(s){if(!pMode)return;plSheet=s;$('#app').classList.toggle('plsch',s==='sch');plDraw=null;sel=null;setTool('select');plSync();renderInspector();renderTakeoff();
  if(s==='sch'){const L=plL();const pts=L.pipes.flatMap(q=>q.pts).concat(L.devs.map(d=>[d.x,d.y]));if(pts.length){const xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1]);fitTo([Math.min(...xs)-1000,Math.min(...ys)-1000],[Math.max(...xs)+1000,Math.max(...ys)+1000]);}}else fit();dirty();
  toast(s==='sch'?'Schematic: a blank sheet to draw the schematic by hand with the same tools. It is not used in the calculations.':'Plan: the pipes drawn on the home plan; these are calculated.');}
function fitTo(a,b){const r=planCv.getBoundingClientRect();const s=Math.min((r.width-80)/Math.max(1,b[0]-a[0]),(r.height-80)/Math.max(1,b[1]-a[1]));view.s=clamp(s,0.008,3);view.ox=r.width/2-(a[0]+b[0])/2*view.s;view.oy=r.height/2-(a[1]+b[1])/2*view.s;}
const plHint=(t,k)=>t==='plumb'?(PLSYS[k]?'Click to start a pipe, click to add bends; end on a fixture, equipment or another pipe of the same kind (it makes a tee), or double-click / <kbd>Enter</kbd>. <kbd>Esc</kbd> cancels.':'Click to place it. <kbd>Esc</kbd> goes back to the Pointer.')
  :'Plumbing plan: click a pipe, fixture or equipment to edit it. Drag points to reshape a pipe; drag a round + handle to add a bend. <kbd>Del</kbd> deletes. The home plan is locked.';

/* ---------- drawing ---------- */
const plPx=()=>clamp(view.s*190,8,16);
const plInfo=(o,on)=>MEAS.plinfo||!!o.info||!!on;
function plPipeW(q,R){const r=R&&R.pipes[q.id],s=r&&r.size;let mm=s==null?20:(plUS()?usNum(s)*25.4:+s);return q.sys==='drain'?clamp(2+mm/25,2.5,8):q.sys==='vent'?clamp(1.5+mm/40,1.5,4):clamp(1.5+mm/16,1.8,5);}
function plStroke(P){ctx.beginPath();P.forEach((p,i)=>{const s=toS(p);i?ctx.lineTo(s[0],s[1]):ctx.moveTo(s[0],s[1]);});}
function plDrawPipe(q,on,faded,R){const P=plPath(q);if(P.length<2)return;const S=PLSYS[q.sys];ctx.save();if(faded)ctx.globalAlpha=0.3;ctx.lineCap='round';ctx.lineJoin='round';
  if(on){plStroke(P);ctx.strokeStyle=C['accent-weak'];ctx.lineWidth=plPipeW(q,R)+8;ctx.stroke();}
  plStroke(P);ctx.strokeStyle=S.col;ctx.lineWidth=plPipeW(q,R);if(S.dash)ctx.setLineDash(S.dash);ctx.stroke();ctx.setLineDash([]);
  // corners: a small dot for each elbow
  if(!q.smooth){const Q=plPts(q);for(let i=1;i<Q.length-1;i++){const s=toS(Q[i]);ctx.fillStyle=S.col;ctx.beginPath();ctx.arc(s[0],s[1],plPipeW(q,R)/2+1.5,0,Math.PI*2);ctx.fill();}}
  // flow direction arrow in the middle
  const r=R&&R.pipes[q.id];if(r&&r.from&&!faded&&plSheet==='plan'){const m=pathMid(P);let d=m.d;const a=plEndKey(q,'a'),src=q.sys==='drain'?r.to:r.from;if(src!==a)d=mul(d,-1);
    const c=toS(m.p),k=6;ctx.fillStyle=S.col;ctx.beginPath();ctx.moveTo(c[0]+d[0]*k,c[1]+d[1]*k);ctx.lineTo(c[0]-d[0]*k+perp(d)[0]*k*0.7,c[1]-d[1]*k+perp(d)[1]*k*0.7);ctx.lineTo(c[0]-d[0]*k-perp(d)[0]*k*0.7,c[1]-d[1]*k-perp(d)[1]*k*0.7);ctx.closePath();ctx.fill();}
  ctx.restore();
  if(!faded&&plInfo(q,on)){const m=pathMid(P),us=plUS();const n=perp(m.d);const q2=toS(add(m.p,mul(n,18/view.s)));let a=Math.atan2(m.d[1],m.d[0]);if(a>Math.PI/2)a-=Math.PI;if(a<-Math.PI/2)a+=Math.PI;
    let lab=(q.name?q.name+' ':'')+(r&&r.size!=null?plSizeTxt(r.size,us):q.size&&q.size!=='auto'?plSizeTxt(q.size,us):'');if(r&&r.slope!=null)lab+=' · '+(us?(r.slope*0.12).toFixed(2)+'"/ft':r.slope+'%');lab+=' · '+fmtRun(plLen(q))+' '+runU();
    txt(lab,q2,{size:10,weight:'600',color:S.col,halo:C.paper,rot:a});}
  if(on)plHandles(q);}
function plHandles(q){const Q=plPts(q);Q.forEach((p,i)=>{const s=toS(p),end=i===0||i===Q.length-1;ctx.save();ctx.fillStyle=end?C.paper:C.accent;ctx.strokeStyle=C.accent;ctx.lineWidth=1.6;
  const r=ptrTouch?6:4.5;ctx.beginPath();if(end)ctx.arc(s[0],s[1],r+1,0,Math.PI*2);else ctx.rect(s[0]-r,s[1]-r,2*r,2*r);ctx.fill();ctx.stroke();ctx.restore();});
  for(let i=1;i<Q.length;i++){const m=toS(epSegMid(q,Q,i)),r=ptrTouch?6.5:5;ctx.save();ctx.fillStyle=C.paper;ctx.strokeStyle=C.accent;ctx.lineWidth=1.5;ctx.setLineDash([2,2]);
    ctx.beginPath();ctx.arc(m[0],m[1],r,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.setLineDash([]);ctx.beginPath();ctx.moveTo(m[0]-r*0.5,m[1]);ctx.lineTo(m[0]+r*0.5,m[1]);ctx.moveTo(m[0],m[1]-r*0.5);ctx.lineTo(m[0],m[1]+r*0.5);ctx.stroke();ctx.restore();}}
function plDrawDev(d,on,faded){const I=plDevInfo(d),s=plPx(),q=toS([d.x,d.y]);ctx.save();if(faded)ctx.globalAlpha=0.32;
  const font=w=>(w||700)+' '+Math.round(s*0.62)+'px '+getComputedStyle(document.body).fontFamily;
  if(d.type==='note'){ctx.restore();if(!faded)txt(d.text||d.name||'Note',q,{size:Math.max(11,(d.size||250)*view.s),weight:'500',color:C.ink,halo:C.paper});if(on){ctx.save();ctx.strokeStyle=C.accent;ctx.setLineDash([3,2]);ctx.strokeRect(q[0]-30,q[1]-10,60,20);ctx.restore();}return;}
  const col=plIsFix(d.type)?'#1864ab':d.type==='heater'?'#c92a2a':d.type==='pump'||d.type==='ptank'?'#5f3dc4':d.type==='tank'||d.type==='meter'?'#0b7285':['stack','manhole','cleanout','ventcap'].includes(d.type)?'#7a4b2a':'#495057';
  ctx.lineWidth=1.6;ctx.strokeStyle=col;ctx.fillStyle=C.paper;
  if(d.type==='pump'){ctx.beginPath();ctx.arc(q[0],q[1],s*0.9,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.beginPath();ctx.moveTo(q[0]-s*0.45,q[1]+s*0.55);ctx.lineTo(q[0]+s*0.6,q[1]);ctx.lineTo(q[0]-s*0.45,q[1]-s*0.55);ctx.closePath();ctx.fillStyle=col;ctx.fill();}
  else if(d.type==='valve'){const k=s*0.7;ctx.beginPath();ctx.moveTo(q[0]-k,q[1]-k*0.7);ctx.lineTo(q[0]+k,q[1]+k*0.7);ctx.lineTo(q[0]+k,q[1]-k*0.7);ctx.lineTo(q[0]-k,q[1]+k*0.7);ctx.closePath();ctx.fillStyle=col;ctx.fill();}
  else if(d.type==='stack'){ctx.beginPath();ctx.arc(q[0],q[1],s*0.75,0,Math.PI*2);ctx.fillStyle=col;ctx.fill();ctx.fillStyle='#fff';ctx.font=font();ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(d.kind==='vent'?'VS':d.kind==='supply'?'R':'SS',q[0],q[1]);}
  else if(d.type==='manhole'){const k=s*0.9;ctx.fillRect(q[0]-k,q[1]-k,2*k,2*k);ctx.strokeRect(q[0]-k,q[1]-k,2*k,2*k);ctx.beginPath();ctx.moveTo(q[0]-k,q[1]-k);ctx.lineTo(q[0]+k,q[1]+k);ctx.moveTo(q[0]+k,q[1]-k);ctx.lineTo(q[0]-k,q[1]+k);ctx.stroke();}
  else if(d.type==='fitting'){const k=s*0.45;ctx.fillStyle=col;ctx.fillRect(q[0]-k,q[1]-k,2*k,2*k);}
  else{const w=d.type==='tank'||d.type==='heater'?s*2.4:plIsFix(d.type)?s*1.7:s*1.6,h=d.type==='tank'||d.type==='heater'?s*1.5:s*1.3;
    ctx.beginPath();if(d.type==='heater'||d.type==='ptank'){ctx.ellipse(q[0],q[1],w/2,h/2,0,0,Math.PI*2);}else ctx.rect(q[0]-w/2,q[1]-h/2,w,h);ctx.fill();ctx.stroke();
    ctx.fillStyle=col;ctx.font=font();ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(I.short,q[0],q[1]+0.5);}
  ctx.restore();
  if(on){ctx.save();ctx.strokeStyle=C.accent;ctx.lineWidth=2;ctx.setLineDash([3,2]);ctx.beginPath();ctx.arc(q[0],q[1],s*1.7,0,Math.PI*2);ctx.stroke();ctx.restore();}
  if(!faded&&plInfo(d,on)){let lab=d.name||'';if(d.type==='heater')lab+=' · '+(d.kind==='gas'?(d.kw||24)+' kW gas':d.kind==='solar'?(d.liters||200)+' L solar':(d.liters||80)+' L');if(d.type==='tank')lab+=' · '+(d.liters||1000)+' L';
    if(d.type==='pump'&&plSheet==='plan'){const pp=plR().pump;if(pp)lab+=pp.head?' · '+(plUS()?(pp.head/0.3048).toFixed(0)+' ft':pp.head.toFixed(1)+' m'):'';}
    if(d.type==='valve')lab+=' · '+({ball:'ball',check:'check',prv:'PRV',tmv:'mixing'}[d.kind||'ball']);if(d.type==='fitting')lab=(lab?lab+' · ':'')+(PL_FITKINDS[d.kind||'elbow90']||'');
    if(lab)txt(lab,[q[0],q[1]+s*2],{weight:'600',size:10.5,color:C.ink,halo:C.paper});}}
const PL_FITKINDS={elbow90:'Elbow 90°',elbow45:'Elbow 45°',tee:'Tee',coupling:'Coupling',union:'Union',reducer:'Reducer',cap:'End cap',adapter:'Adapter / connector'};
// the home plan's fixtures get a small blue ring so it is clear they can be connected
function plDrawItemRings(faded){M.items.forEach(it=>{if(!PL_ITEM[it.type])return;const s=toS([it.x,it.y]);ctx.save();ctx.globalAlpha=faded?0.3:0.9;ctx.strokeStyle='#1864ab';ctx.lineWidth=1.4;ctx.beginPath();ctx.arc(s[0],s[1],5,0,Math.PI*2);ctx.stroke();ctx.restore();});}
function drawPlumb(){if(!M)return;const L=plL();
  if(pMode){if(plSheet==='plan'){const W=planCv.width/pxr(),H=planCv.height/pxr();ctx.save();ctx.globalAlpha=0.62;ctx.fillStyle=C.paper;ctx.fillRect(-10,-10,(EXP?EXP.w:W)+20,(EXP?EXP.h:H)+20);ctx.restore();plDrawItemRings(false);}}
  else{if(plShow==='hidden'||!plHas()||EXP)return;}
  const faded=!pMode,s=pMode&&sel&&sel.kind==='pl'?sel:null,R=plSheet==='plan'?plR():null,src=pMode?L:plD();
  ['drain','vent','cold','hot','hotret'].forEach(sys=>src.pipes.filter(q=>q.sys===sys).forEach(q=>plDrawPipe(q,s&&s.id===q.id,faded,R)));
  src.devs.forEach(d=>plDrawDev(d,s&&s.id===d.id,faded));
  if(pMode&&!EXP)plDrawTool();}
function drawPlumbSheet(){   // the blank schematic page
  let dpr,W,H;if(EXP){dpr=EXP.k;W=EXP.w;H=EXP.h;}else{resizeCanvas(planCv);dpr=pxr();W=planCv.width/dpr;H=planCv.height/dpr;}
  ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle=C.paper;ctx.fillRect(0,0,W,H);if(!EXP||EXP.grid)drawGrid(W,H);drawPlumb();if(!EXP)updateScalebar();}
function plDrawTool(){if(tool!=='plumb')return;
  if(plDraw){const o=Object.assign({},plDraw,{pts:plDraw.pts.concat([plGhost&&plGhost.p||plDraw.pts[plDraw.pts.length-1]]),eb:plGhost&&plGhost.ref||null});plDrawPipe(o,false,false,null);}
  else if(plGhost&&plGhost.dev)plDrawDev(plGhost.dev,false,false);
  if(plGhost&&(plGhost.ref||plGhost.tee)){const s=toS(plGhost.p);ctx.save();ctx.strokeStyle=C.snap;ctx.lineWidth=2;ctx.beginPath();ctx.arc(s[0],s[1],11,0,Math.PI*2);ctx.stroke();ctx.restore();}
  else if(plGhost&&plGhost.sn)drawSnapMark(plGhost.sn);}

/* ---------- snapping: fixtures, equipment, pipe ends and the middle of pipes of the same kind ---------- */
function plSnap(p,sys,from,skipPipe){const tol=(ptrTouch?22:14)/view.s;let best=null,bd=tol;const L=plL();
  if(plSheet==='plan')M.items.forEach(it=>{if(!PL_ITEM[it.type])return;const F=PLFIX[PL_ITEM[it.type]];if(sys==='drain'&&!F.du)return;if((sys==='cold')&&!F.qc)return;if((sys==='hot'||sys==='hotret')&&!F.qh)return;
    const d=dist(p,[it.x,it.y]);if(d<Math.max(bd,Math.min(it.w,it.d)/2)){bd=d;best={ref:{k:'i',id:it.id},p:[it.x,it.y]};}});
  L.devs.forEach(d=>{if(d.type==='note')return;const dd=dist(p,[d.x,d.y]);if(dd<bd*1.3){bd=dd;best={ref:{k:'d',id:d.id},p:[d.x,d.y]};}});
  if(best)return best;
  const same=q=>!sys||q.sys===sys||(sys!=='cold'&&q.sys!=='cold'&&plSupply(sys)&&plSupply(q.sys));
  L.pipes.forEach(q=>{if(q.id===skipPipe||!same(q))return;const Q=plPts(q);
    Q.forEach((v,i)=>{const d=dist(p,v);if(d<bd){bd=d;best=i>0&&i<Q.length-1?{p:v.slice(),tee:{id:q.id,vert:i}}:{p:v.slice()};}});});
  if(best)return best;
  L.pipes.forEach(q=>{if(q.id===skipPipe||(sys&&q.sys!==sys))return;const Q=plPts(q);for(let i=1;i<Q.length;i++){const c=segClosest(p,Q[i-1],Q[i]);const d=dist(p,c.q);if(d<bd&&c.t>0.02&&c.t<0.98){bd=d;best={p:c.q.map(v=>Math.round(v*10)/10),tee:{id:q.id,seg:i}};}}});
  if(best)return best;
  const sn=snapPoint(p,from);// straight runs: keep to 90°/45° unless Shift
  return {p:sn.p,sn};}
// a pipe that ends on the side of another pipe splits it there: two pipes and a tee
function plSplit(id,seg,pt,vert){const L=plLW(),q=L.pipes.find(x=>x.id===id);if(!q)return;const P=q.pts;
  const a=Object.assign(JSON.parse(JSON.stringify(q)),{pts:vert!=null?P.slice(0,vert+1):P.slice(0,seg).concat([pt.slice()]),eb:null});
  const b=Object.assign(JSON.parse(JSON.stringify(q)),{id:nid('q'),name:plNextName(L.pipes,q.sys),pts:vert!=null?P.slice(vert):[pt.slice()].concat(P.slice(seg)),ea:null});Object.assign(q,a);L.pipes.push(b);}
const plNextName=(arr,sys)=>{const pre={cold:'C',hot:'H',hotret:'HR',drain:'D',vent:'V'}[sys]||'P';let n=arr.filter(x=>x.sys===sys).length+1;const has=new Set(arr.map(x=>x.name));while(has.has(pre+n))n++;return pre+n;};

/* ---------- tools ---------- */
function plNewDev(t){const d={id:'ghost',type:t};const L=plL(),n=L.devs.filter(x=>x.type===t).length+1;
  if(PLFIX[t])d.name=PLFIX[t].short+n;
  if(t==='heater')Object.assign(d,{name:'WH'+n,kind:'electric',liters:80,kw:2});
  if(t==='tank')Object.assign(d,{name:'TANK'+n,liters:1000,where:'roof'});
  if(t==='pump')Object.assign(d,{name:'P'+n});
  if(t==='ptank')Object.assign(d,{name:'PT'+n,liters:24});
  if(t==='meter')Object.assign(d,{name:'M'+n});
  if(t==='valve')Object.assign(d,{name:'V'+n,kind:'ball'});
  if(t==='fitting')Object.assign(d,{kind:'elbow90'});
  if(t==='stack')Object.assign(d,{name:'S'+n,kind:'soil'});
  if(t==='manhole')Object.assign(d,{name:'IC'+n});
  if(t==='cleanout')Object.assign(d,{name:'CO'+n});
  if(t==='ventcap')Object.assign(d,{name:'VT'+n,kind:'roof'});
  if(t==='note')Object.assign(d,{text:'Note',size:250});
  return d;}
function plToolMove(p){if(!plKind)return;const last=plDraw&&plDraw.pts[plDraw.pts.length-1];
  if(PLSYS[plKind]){plGhost=plSnap(p,plKind,last);$('#snapchip').textContent=plGhost.ref?'to '+plRefName(plGhost.ref):plGhost.tee?'tee into the pipe':'';dirty();return;}
  const sn=snapPoint(p,null);plGhost={dev:Object.assign(plNewDev(plKind),{x:sn.p[0],y:sn.p[1]}),sn};dirty();}
function plToolClick(p){if(!plKind)return;
  if(PLSYS[plKind]){const last=plDraw&&plDraw.pts[plDraw.pts.length-1];const r=plSnap(p,plKind,last);
    if(!plDraw){const st=plSet();plDraw={sys:plKind,pts:[r.p.slice()],ea:r.ref||null,tea:r.tee||null,smooth:false,mat:plMatDef(st.std,plKind),size:'auto'};renderInspector();dirty();return;}
    if(dist(r.p,last)<30){plFinish();return;}
    plDraw.pts.push(r.p.slice());if(r.ref){plDraw.eb=r.ref;plFinish();return;}if(r.tee){plDraw.teb=r.tee;plFinish();return;}
    // ends on another pipe's end or bend: finish there too
    if(!r.sn&&plDraw.pts.length>1){plFinish();return;}renderInspector();dirty();return;}
  const sn=snapPoint(p,null);const d=Object.assign(plNewDev(plKind),{x:sn.p[0],y:sn.p[1]},{id:nid('v')});
  mutate(()=>plLW().devs.push(d));if(plKind!=='fitting'&&plKind!=='valve'&&!PLFIX[plKind]){plSetKind(null);sel={kind:'pl',t:'dev',id:d.id};}renderInspector();renderTakeoff();dirty();}
function plFinish(){const o=plDraw;plDraw=null;plGhost=null;if(!o||o.pts.length<2){renderInspector();dirty();return;}const L=plL();
  const made={id:nid('q'),name:'',sys:o.sys,pts:o.pts,ea:o.ea||null,eb:o.eb||null,smooth:false,mat:o.mat,size:'auto'};
  if(o.sys==='drain')made.slope=plUS()?2.08:plSet().slope;
  mutate(()=>{if(o.tea)plSplit(o.tea.id,o.tea.seg,o.pts[0],o.tea.vert);if(o.teb)plSplit(o.teb.id,o.teb.seg,o.pts[o.pts.length-1],o.teb.vert);made.name=plNextName(plLW().pipes,o.sys);plLW().pipes.push(made);});
  sel={kind:'pl',t:'pipe',id:made.id};renderInspector();renderTakeoff();dirty();}

/* ---------- selecting and dragging ---------- */
function plHit(p){const tol=(ptrTouch?16:9)/view.s;const L=plL();
  if(sel&&sel.kind==='pl'&&sel.t==='pipe'){const q=plPipe(sel.id);if(q){const Q=plPts(q);for(let i=0;i<Q.length;i++)if(dist(p,Q[i])<tol*1.2)return {t:'pipe',id:q.id,pt:i};
    for(let i=1;i<Q.length;i++)if(dist(p,epSegMid(q,Q,i))<tol*1.3)return {t:'pipe',id:q.id,seg:i,mid:true};}}
  for(const d of L.devs){if(dist(p,[d.x,d.y])<Math.max(tol*1.5,plPx()*1.2/view.s))return {t:'dev',id:d.id};}
  let best=null,bd=tol;L.pipes.forEach(q=>{const r=distToPath(p,plPath(q));if(r.d<bd){bd=r.d;best={t:'pipe',id:q.id,seg:r.i};}});return best;}
function plPointerDown(p,e,sp){const h=plHit(p);
  if(!h){if(sel&&sel.kind==='pl'){sel=null;renderInspector();}pan={sx:sp[0],sy:sp[1],ox:view.ox,oy:view.oy,click:false};planCv.setPointerCapture(e.pointerId);dirty();return;}
  sel={kind:'pl',t:h.t,id:h.id};renderInspector();
  drag={kind:'pl',t:h.t,id:h.id,pt:h.pt,seg:h.seg,mid:h.mid,p0:p,snap0:snapshot(),moved:false};const o=h.t==='pipe'?plPipe(h.id):plDev(h.id);drag.o0=JSON.parse(JSON.stringify(o));
  planCv.setPointerCapture(e.pointerId);dirty();}
function plDragMove(drag,p){const dv=sub(p,drag.p0);
  if(drag.t==='dev'){const d=plDev(drag.id);if(!d)return;const sn=snapPoint(add([drag.o0.x,drag.o0.y],dv),null);
    // pipes ending loosely on the old spot follow it
    d.x=sn.p[0];d.y=sn.p[1];drag.snap={kind:'move'};return;}
  const q=plPipe(drag.id);if(!q)return;const last=q.pts.length-1;
  if(drag.pt!=null){const i=drag.pt,end=i===0||i===last;
    if(end){const r=plSnap(p,q.sys,q.pts[i===0?1:last-1],q.id);q.pts[i]=r.p.slice();q[i===0?'ea':'eb']=r.ref||null;drag.snap={kind:r.ref?'to '+plRefName(r.ref):'free end'};return;}
    const sn=snapPoint(p,q.pts[i-1]);q.pts[i]=sn.p.slice();drag.snap={kind:'bend'};return;}
  if(drag.seg!=null){const Q=plPts(q);let si=drag.mid?drag.seg:1;if(!drag.mid){let bd=1e12;for(let i=1;i<Q.length;i++){const c=segClosest(drag.p0,Q[i-1],Q[i]);const d=dist(drag.p0,c.q);if(d<bd){bd=d;si=i;}}}
    q.pts.splice(si,0,p.slice());drag.pt=si;drag.seg=null;drag.snap={kind:'new bend'};}}
function plDbl(p){const h=plHit(p);if(!h||h.t!=='pipe')return;const q=plPipe(h.id);if(!q)return;
  if(h.pt!=null){if(h.pt===0||h.pt===q.pts.length-1)return;mutate(()=>q.pts.splice(h.pt,1));renderInspector();return;}
  const Q=plPts(q);let si=1,bd=1e12;for(let i=1;i<Q.length;i++){const c=segClosest(p,Q[i-1],Q[i]);const d=dist(p,c.q);if(d<bd){bd=d;si=i;}}mutate(()=>q.pts.splice(si,0,p.slice()));sel={kind:'pl',t:'pipe',id:q.id};renderInspector();}
function plDelete(){if(!sel||sel.kind!=='pl')return;const s=sel;mutate(()=>{const L=plLW();
  if(s.t==='pipe')L.pipes=L.pipes.filter(q=>q.id!==s.id);
  if(s.t==='dev'){L.devs=L.devs.filter(d=>d.id!==s.id);L.pipes.forEach(q=>['ea','eb'].forEach(k=>{if(q[k]&&q[k].k==='d'&&q[k].id===s.id)q[k]=null;}));}});sel=null;renderInspector();renderTakeoff();dirty();}
function plKeyDown(e,k){if(!pMode)return false;const tag=(e.target.tagName||'').toLowerCase();if(tag==='input'||tag==='select'||tag==='textarea')return false;
  if(plDraw){if(k==='enter'){e.preventDefault();plFinish();return true;}if(k==='escape'){plDraw=null;plGhost=null;renderInspector();dirty();return true;}
    if(k==='backspace'||k==='delete'){e.preventDefault();plDraw.pts.pop();if(!plDraw.pts.length)plDraw=null;renderInspector();dirty();return true;}}
  if(k==='escape'){if(tool==='plumb')plSetKind(null);else{sel=null;renderInspector();dirty();}return true;}
  if((k==='delete'||k==='backspace')&&sel&&sel.kind==='pl'){e.preventDefault();plDelete();return true;}
  if(k==='f'||k==='s'||e.key==='+'||e.key==='='||e.key==='-'||e.key==='_'||k===' ')return false;
  if(/^[a-z]$/.test(k)||k.startsWith('arrow'))return true;return false;}

/* ---------- side panel ---------- */
const plFmtM=m=>plUS()?(m/0.3048).toFixed(1)+' ft':m.toFixed(1)+' m';
const plFmtP=m=>plUS()?(m/0.70307).toFixed(1)+' psi':(m/10.197).toFixed(2)+' bar';
const plFmtQ=ls=>plUS()?(ls/GPM_LS).toFixed(1)+' gpm':ls.toFixed(2)+' l/s ('+(ls*3.6).toFixed(1)+' m³/h)';
const plFmtW=w=>w>=1000?(w/1000).toFixed(2)+' kW'+(plUS()?' ('+(w/746).toFixed(2)+' HP)':''):Math.round(w)+' W'+(plUS()?' ('+(w/746).toFixed(2)+' HP)':'');
function plInfoRow(o){return `<label class="epinfo"><input type="checkbox" id="plInfo"${o.info||MEAS.plinfo?' checked':''}${MEAS.plinfo?' disabled':''}> <span>Show its info on the plan${MEAS.plinfo?'<small>All plumbing info is on (Measures menu). Turn that off to show only the items you pick.</small>':''}</span></label>`;}
function plToolPanel(){if(PLSYS[plKind])return `<p class="h">New ${PLSYS[plKind].label.toLowerCase()} pipe</p><p class="tip">${plDraw?'Click to add a bend. Click on a fixture, equipment or a pipe of the same kind to end there; double-click or Enter ends anywhere. Backspace removes the last point.':'Click where the pipe starts: on a fixture (the blue rings on the home plan are fixtures), equipment, or a pipe of the same kind (a tee is made there).'}</p><p class="tip">The size is worked out from what the pipe feeds (Auto); you can set it yourself in its panel.</p>`;
  const I=PLFIX[plKind]||PLEQ[plKind];return I?`<p class="h">New ${I.label.toLowerCase()}</p><p class="tip">Click where it goes. Its settings are in its panel afterwards.</p>`:'';}
function plSettingsHTML(){const st=plSet(),us=st.std==='us';const f=(lab,id,v,unit)=>`<label for="${id}">${lab}</label><input id="${id}" data-type="num" value="${v}" placeholder="${unit||''}">`;
  return `<p class="h">Plumbing plan</p><div class="seg segsm" role="group" aria-label="Sheet" style="margin-bottom:8px"><button data-plsheet="plan" aria-pressed="${plSheet==='plan'}">Plan</button><button data-plsheet="sch" aria-pressed="${plSheet==='sch'}">Schematic</button></div>
    <div class="kv"><label>Standard</label><div class="seg segsm" role="group" aria-label="Standard"><button data-plstd="metric" aria-pressed="${!us}">Metric (EN)</button><button data-plstd="us" aria-pressed="${us}">US (IPC)</button></div>
    <label>Water supply</label><select id="plSupply">${opt('mains',st.supply,'City mains direct')}${opt('tank',st.supply,'Mains → ground tank → pump → roof tank')}</select>
    ${st.supply==='mains'?f('Mains pressure ('+(us?'psi':'bar')+')','plMainsP',st.mainsP):f('Roof tank above this floor ('+(us?'ft':'m')+')','plRoofH',st.roofH)+f('Pump lift, ground to roof tank ('+(us?'ft':'m')+')','plLift',st.lift)+f('Riser pipe length ('+(us?'ft':'m')+')','plRiser',st.riser)+f('Roof tank (L)','plTankL',st.tankL)+f('Fill time (minutes)','plFill',st.fillMin)}
    ${f('This floor above the supply ('+(us?'ft':'m')+')','plFloorH',st.floorH)}${f('Pressure needed at fixtures ('+(us?'psi':'bar')+')','plResid',st.resid)}${f('Max water speed ('+(us?'ft/s':'m/s')+')','plVmax',st.vmax)}
    ${us?'':f('Drain slope (%)','plSlope',st.slope)}${f('People (for the water heater)','plPeople',st.people)}</div>
    <p class="tip">Draw cold (blue) and hot (red) pipes from the meter, tank, pump or heater to the fixtures, and drains (brown) from the fixtures to a stack or inspection chamber. Sizes, flows and the pump are worked out from the connections. <b>Schematic</b> is a blank sheet for drawing the schematic by hand.</p>`;}
function plInspectorHTML(){if(tool==='plumb')return plToolPanel();if(!sel||sel.kind!=='pl')return plSettingsHTML();
  const R=plSheet==='plan'?plR():{pipes:{}},us=plUS(),s=sel;
  if(s.t==='pipe'){const q=plPipe(s.id);if(!q)return '';const r=R.pipes[q.id]||{};const list=plSizeList(q);
    let h=`<div class="selname">${PLSYS[q.sys].label} ${esc(q.name||'')}<span class="selbtns"><button class="btn" id="plDel">Delete</button></span></div>${plInfoRow(q)}<div class="kv">
      <label for="plName">Name</label><input id="plName" data-type="text" style="font-family:var(--f-body)" value="${esc(q.name||'')}">
      <label for="plSys">Carries</label><select id="plSys">${Object.keys(PLSYS).map(k=>opt(k,q.sys,PLSYS[k].label)).join('')}</select>
      <label for="plMat">Material</label><select id="plMat">${PL_MATS(plSet().std,q.sys).map(m=>opt(m,q.mat)).join('')}</select>
      <label for="plSize">Size</label><select id="plSize">${opt('auto',q.size||'auto','Auto'+(r.rec!=null?' ('+plSizeTxt(r.rec,us)+')':''))}${list.map(x=>opt(x[0],q.size,plSizeTxt(x[0],us))).join('')}</select>
      ${q.sys==='drain'?`<label for="plSlopeP">Slope (${us?'in/ft':'%'})</label><input id="plSlopeP" data-type="num" value="${us?((q.slope!=null?q.slope:2.08)*0.12).toFixed(3):(q.slope!=null?q.slope:plSet().slope)}">`:''}
      <label>Shape</label><div class="seg segsm" role="group" aria-label="Curved or straight"><button data-plsmooth="0" aria-pressed="${!q.smooth}">Straight</button><button data-plsmooth="1" aria-pressed="${!!q.smooth}">Curved</button></div>
      <label>From</label><span class="ro" style="font-family:var(--f-body)">${esc(plRefName(q.ea))}</span><label>To</label><span class="ro" style="font-family:var(--f-body)">${esc(plRefName(q.eb))}</span>
      <label>Length</label><span class="ro">${fmtLen(plLen(q),true)}</span>`;
    if(plSheet==='plan'&&r.size!=null){if(plSupply(q.sys))h+=`<label>Feeds</label><span class="ro">${r.count} fixture${r.count===1?'':'s'} · ${us?r.sumU.toFixed(1)+' WSFU':r.sumQ.toFixed(2)+' l/s ΣQa'}</span><label>Design flow</label><span class="ro">${plFmtQ(r.Qd)}</span>
      <label>Speed</label><span class="ro" style="color:${r.v>(us?plSet().vmax*0.3048:plSet().vmax)?'var(--danger)':'inherit'}">${us?(r.v/0.3048).toFixed(1)+' ft/s':r.v.toFixed(2)+' m/s'}</span><label>Friction</label><span class="ro">${plFmtM(r.loss)}</span><label>Recommended</label><span class="ro big">${plSizeTxt(r.rec,us)}</span>`;
      else if(q.sys==='drain')h+=`<label>Drains</label><span class="ro">${r.count} fixture${r.count===1?'':'s'} · ${us?r.sumU+' DFU':r.sumQ.toFixed(1)+' DU'}</span>${us?'':`<label>Waste flow</label><span class="ro">${r.Qww.toFixed(2)} l/s</span>`}<label>Fall over length</label><span class="ro">${fmtLen(r.fall,true)}</span><label>Recommended</label><span class="ro big">${plSizeTxt(r.rec,us)}</span>`;
      else if(q.sys==='vent')h+=`<label>Recommended</label><span class="ro big">${plSizeTxt(r.rec,us)}</span>`;}
    else if(plSheet==='plan'&&q.sys!=='vent')h+=`<label></label><span class="ro" style="color:var(--danger);font-family:var(--f-body)">Not connected to ${q.sys==='drain'?'an outlet':'a source'} yet</span>`;
    h+=`</div><p class="tip">Drag a round + handle to bend it, drag a square point to move a bend, double-click a bend to remove it. Drag an end onto a fixture, equipment or another pipe to connect it.</p>`;return h;}
  const d=plDev(s.id);if(!d)return '';const I=plDevInfo(d);const num=(lab,id,v)=>`<label for="${id}">${lab}</label><input id="${id}" data-type="num" value="${v}">`;
  let h=`<div class="selname">${I.label}<span class="selbtns"><button class="btn" id="plDel">Delete</button></span></div>${d.type==='note'?'':plInfoRow(d)}<div class="kv">`;
  if(d.type==='note')h+=`<label for="plText">Text</label><input id="plText" data-type="text" style="font-family:var(--f-body)" value="${esc(d.text||'')}">`+field('Text size','plTSize',fmtLen(d.size||250));
  else h+=`<label for="plName">Name</label><input id="plName" data-type="text" style="font-family:var(--f-body)" value="${esc(d.name||'')}">`;
  if(PLFIX[d.type]){const F=PLFIX[d.type];h+=field('Outlet height','plH',fmtLen(d.h!=null?d.h:F.h))+`<label>Water</label><span class="ro">${us?(F.uc+F.uh)+' WSFU':((F.qc+F.qh).toFixed(2))+' l/s'}${F.qh?' · hot + cold':F.qc?' · cold':''}</span><label>Drain</label><span class="ro">${F.du?(us?F.dfu+' DFU · min '+plSizeTxt(F.dminUS,true):F.du+' DU · min '+plSizeTxt(F.dmin,false)):'—'}</span>`;}
  if(d.type==='heater'){const A=plR().heater||{};h+=`<label for="plKind">Type</label><select id="plKind">${opt('electric',d.kind,'Electric storage')}${opt('gas',d.kind,'Gas instantaneous')}${opt('solar',d.kind,'Solar with tank')}</select>`;
    if(d.kind!=='gas')h+=num('Capacity (L)','plLiters',d.liters||80);h+=num('Power (kW)','plKw',d.kw||(d.kind==='gas'?24:2));
    h+=`<label>Suggested</label><span class="ro" style="font-family:var(--f-body)">${d.kind==='gas'?Math.ceil(A.inst||0)+' kW for the hot flow':A.storage+' L for '+plSet().people+' people'}</span>`;}
  if(d.type==='tank')h+=num('Capacity (L)','plLiters',d.liters||1000)+`<label for="plWhere">Where</label><select id="plWhere">${opt('roof',d.where,'Roof')}${opt('ground',d.where,'Ground / underground')}</select>`;
  if(d.type==='ptank')h+=num('Capacity (L)','plLiters',d.liters||24);
  if(d.type==='valve')h+=`<label for="plKind">Type</label><select id="plKind">${opt('ball',d.kind,'Ball / stop valve')}${opt('check',d.kind,'Check (non-return) valve')}${opt('prv',d.kind,'Pressure reducing valve')}${opt('tmv',d.kind,'Thermostatic mixing valve')}</select>`;
  if(d.type==='fitting')h+=`<label for="plKind">Type</label><select id="plKind">${Object.keys(PL_FITKINDS).map(k=>opt(k,d.kind,PL_FITKINDS[k])).join('')}</select>`+`<label for="plFSize">Size</label><input id="plFSize" data-type="text" value="${esc(d.size||'')}" placeholder="${us?'e.g. 3/4':'e.g. 25'}">`;
  if(d.type==='stack')h+=`<label for="plKind">Type</label><select id="plKind">${opt('soil',d.kind,'Soil / waste stack')}${opt('vent',d.kind,'Vent stack')}${opt('supply',d.kind,'Supply riser')}</select>`;
  if(d.type==='ventcap')h+=`<label for="plKind">Type</label><select id="plKind">${opt('roof',d.kind,'Through the roof')}${opt('aav',d.kind,'Air admittance valve (AAV)')}</select>`;
  if(d.type==='pump'&&plSheet==='plan'){const P=plR().pump;if(P){h+=`<label>Flow</label><span class="ro">${plFmtQ(P.mode==='tank'&&!P.head?P.fill:P.Qd)}</span>`;
    if(P.mode==='tank')h+=`<label>Lift pump head</label><span class="ro big">${plFmtM(P.liftHead)}</span><label>Lift pump power</label><span class="ro">${plFmtW(P.liftPower)}</span>`;
    if(P.head)h+=`<label>Booster head</label><span class="ro big">${plFmtM(P.head)}</span><label>Booster power</label><span class="ro">${plFmtW(P.power)}</span>`;}}
  h+=`</div><p class="tip">Drag it to move it; pipes connected to it follow.${PLFIX[d.type]?' Fixtures on the home plan (toilet, vanity, bathtub, shower, sink, dishwasher) can be connected directly; place these for anything else.':''}</p>`;return h;}
function plBindInspector(){const el=$('#inspector');const ed=fn=>{mutate(fn);renderInspector();renderTakeoff();dirty();};const on=(id,fn)=>{const e=document.getElementById(id);if(e)e.onchange=()=>fn(e.value);};
  const setNum=(id,key,mn)=>on(id,v=>{const x=parseFloat(v);if(isFinite(x)&&x>=(mn||0))ed(()=>plW().set[key]=x);else renderInspector();});
  el.querySelectorAll('[data-plsheet]').forEach(b=>b.onclick=()=>plSetSheet(b.dataset.plsheet));
  el.querySelectorAll('[data-plstd]').forEach(b=>b.onclick=()=>{const std=b.dataset.plstd;if(plSet().std===std)return;ed(()=>{const P=plW();P.set.std=std;P.set.vmax=std==='us'?8:2;P.set.resid=std==='us'?15:1;P.set.mainsP=std==='us'?45:3;
    [P.pipes,P.sch.pipes].forEach(L=>L.forEach(q=>{q.mat=plMatDef(std,q.sys);q.size='auto';if(q.sys==='drain')q.slope=std==='us'?2.08:P.set.slope;}));});});
  on('plSupply',v=>ed(()=>plW().set.supply=v));setNum('plMainsP','mainsP');setNum('plRoofH','roofH');setNum('plLift','lift');setNum('plRiser','riser');setNum('plTankL','tankL',1);setNum('plFill','fillMin',1);
  setNum('plFloorH','floorH');setNum('plResid','resid');setNum('plVmax','vmax',0.1);setNum('plSlope','slope',0.1);setNum('plPeople','people',1);
  const s=sel;if(!s||s.kind!=='pl')return;const o=s.t==='pipe'?plPipe(s.id):plDev(s.id);if(!o)return;
  const dl=$('#plDel');if(dl)dl.onclick=()=>plDelete();
  {const c=$('#plInfo');if(c)c.onchange=()=>ed(()=>{if(c.checked)o.info=true;else delete o.info;});}
  on('plName',v=>ed(()=>o.name=v.trim()||o.name));
  if(s.t==='pipe'){on('plSys',v=>ed(()=>{o.sys=v;o.mat=plMatDef(plSet().std,v);o.size='auto';if(v==='drain')o.slope=plUS()?2.08:plSet().slope;}));on('plMat',v=>ed(()=>{o.mat=v;o.size='auto';}));on('plSize',v=>ed(()=>o.size=v));
    on('plSlopeP',v=>{const x=parseFloat(v);if(isFinite(x)&&x>0)ed(()=>o.slope=plUS()?x/0.12:x);});el.querySelectorAll('[data-plsmooth]').forEach(b=>b.onclick=()=>ed(()=>o.smooth=b.dataset.plsmooth==='1'));return;}
  on('plH',v=>{const L=parseLen(v);if(L>=0)ed(()=>o.h=L);});on('plKind',v=>ed(()=>o.kind=v));on('plWhere',v=>ed(()=>o.where=v));on('plFSize',v=>ed(()=>o.size=v.trim()));
  on('plText',v=>ed(()=>o.text=v));on('plTSize',v=>{const L=parseLen(v);if(L>=20)ed(()=>o.size=L);});
  const nv=(id,k,mn)=>on(id,v=>{const x=parseFloat(v);if(isFinite(x)&&x>=(mn||0))ed(()=>o[k]=x);});nv('plLiters','liters',1);nv('plKw','kw',0.1);}

/* ---------- worksheet ---------- */
function plRows(){const P=plD(),R=plR(),us=plUS(),rows=[],Rw=(cat,item,spec,qty,unit)=>rows.push({cat,item,spec,qty,unit});const m=mm=>+(isMetric()?mm/1000:mm/304.8).toFixed(2),u=runU(),sp=1+plSet().spare/100;
  const pipe={};P.pipes.forEach(q=>{const r=R.pipes[q.id];const s=r&&r.size!=null?r.size:(q.size&&q.size!=='auto'?q.size:'?');const k=PLSYS[q.sys].label+'|'+q.mat+' '+plSizeTxt(s,us);pipe[k]=(pipe[k]||0)+plLen(q)*sp;});
  Object.keys(pipe).sort().forEach(k=>{const [a,b]=k.split('|');Rw('Pipes',a,b,m(pipe[k]),u);});
  const F=plFittings();Object.keys(F).sort().forEach(k=>{const [a,b]=k.split('|');Rw('Fittings',a,b,F[k],'pcs');});
  P.devs.filter(d=>d.type==='fitting').forEach(d=>Rw('Fittings',PL_FITKINDS[d.kind||'elbow90'],d.size?plSizeTxt(d.size,us):'',1,'pcs'));
  const fx={};M.items.forEach(it=>{if(PL_ITEM[it.type]){const k=PLFIX[PL_ITEM[it.type]].label;fx[k]=(fx[k]||0)+1;}});P.devs.forEach(d=>{if(PLFIX[d.type]){const k=PLFIX[d.type].label;fx[k]=(fx[k]||0)+1;}});
  Object.keys(fx).sort().forEach(k=>Rw('Fixtures',k,'',fx[k],'pcs'));
  const mixers=M.items.filter(it=>['vanity','sinkbase','tub','shower'].includes(it.type)).length+P.devs.filter(d=>['basin','sink','shower','bath','bidet','faucet'].includes(d.type)).length;if(mixers)Rw('Fixtures','Mixer tap / faucet','',mixers,'pcs');
  P.devs.filter(d=>d.type==='valve').forEach(d=>Rw('Valves',{ball:'Ball / stop valve',check:'Check valve',prv:'Pressure reducing valve',tmv:'Thermostatic mixing valve'}[d.kind||'ball'],'',1,'pcs'));
  const pp=R.pump;
  P.devs.forEach(d=>{if(d.type==='heater')Rw('Equipment','Water heater',d.kind==='gas'?(d.kw||24)+' kW gas':(d.liters||80)+' L · '+(d.kw||2)+' kW '+(d.kind==='solar'?'solar':'electric'),1,'pcs');
    if(d.type==='tank')Rw('Equipment','Water tank',(d.liters||1000)+' L · '+(d.where==='ground'?'ground':'roof'),1,'pcs');
    if(d.type==='pump')Rw('Equipment','Pump',pp?(pp.head?plFmtQ(pp.Qd)+' · '+plFmtM(pp.head):pp.mode==='tank'?plFmtQ(pp.fill)+' · '+plFmtM(pp.liftHead):''):'',1,'pcs');
    if(d.type==='ptank')Rw('Equipment','Pressure tank',(d.liters||24)+' L',1,'pcs');if(d.type==='meter')Rw('Equipment','Water meter','',1,'pcs');
    if(d.type==='manhole')Rw('Drainage','Inspection chamber','',1,'pcs');if(d.type==='cleanout')Rw('Drainage','Cleanout','',1,'pcs');if(d.type==='stack')Rw('Drainage',{soil:'Soil / waste stack',vent:'Vent stack',supply:'Supply riser'}[d.kind||'soil'],'',1,'pcs');
    if(d.type==='ventcap')Rw('Drainage',d.kind==='aav'?'Air admittance valve':'Vent terminal','',1,'pcs');});
  return rows;}
function plSummaryHTML(){if(plSheet!=='plan')return '<p class="tip">The schematic sheet is not calculated; switch to Plan for sizes and the pump.</p>';const R=plR(),us=plUS(),st=plSet();let h='<div class="kv">';
  const C=R.sys.cold,H=R.sys.hot,D=R.sys.drain;
  if(C)h+=`<label>Cold water</label><span class="ro">${C.count} fixtures · ${plFmtQ(us?plGpm(C.sumU)*GPM_LS:plQd(C.sumQ,C.maxQ))}</span>`;
  if(H)h+=`<label>Hot water</label><span class="ro">${H.count} fixtures · ${plFmtQ(us?plGpm(H.sumU)*GPM_LS:plQd(H.sumQ,H.maxQ))}</span>`;
  if(D)h+=`<label>Drainage</label><span class="ro">${D.count} fixtures · ${us?D.sumU+' DFU':D.sumQ.toFixed(1)+' DU'}</span>`;
  const P=R.pump;if(P){if(P.mode==='mains')h+=`<label>Mains</label><span class="ro" style="color:${P.ok?'inherit':'var(--danger)'}">${plFmtP(P.avail)} here · ${plFmtP(P.need)} needed${P.ok?' · OK':''}</span>`+(P.ok?'':`<label>Booster pump</label><span class="ro big">${plFmtQ(P.Qd)} · ${plFmtM(P.head)} · ${plFmtW(P.power)}</span>`);
    else{h+=`<label>Lift pump</label><span class="ro">${plFmtQ(P.fill)} · ${plFmtM(P.liftHead)} · ${plFmtW(P.liftPower)} · riser ${plSizeTxt(P.riserSize,us)}</span><label>Gravity at worst fixture</label><span class="ro" style="color:${P.gravOk?'inherit':'var(--danger)'}">${plFmtP(Math.max(0,P.gravity))}${P.gravOk?' · OK':' · low'}</span>`;
      if(!P.gravOk)h+=`<label>Booster pump</label><span class="ro big">${plFmtQ(P.Qd)} · ${plFmtM(P.head)} · ${plFmtW(P.power)}</span>`;}}
  if(H){const A=R.heater;h+=`<label>Water heater</label><span class="ro">${A.storage} L storage, or ${Math.ceil(A.inst)} kW instantaneous</span>`;}
  h+='</div>';if(R.issues.length)h+='<ul class="plissues">'+R.issues.slice(0,6).map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul>';return h;}
function plCSV(){const q=v=>{v=String(v==null?'':v);return /[",\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v;};const us=plUS();
  let s='Plumbing worksheet,'+q(M.name||'')+'\nStandard,'+(us?'US (IPC)':'Metric (EN)')+'\nSpare included,'+plSet().spare+'%\n\nCategory,Item,Size / rating,Quantity,Unit,Unit price,Total\n';
  plRows().forEach((r,i)=>{s+=[r.cat,r.item,r.spec,r.qty,r.unit].map(q).join(',')+',,=D'+(i+6)+'*F'+(i+6)+'\n';});
  const R=plR();s+='\nPipes\nName,Carries,Material,Size,Recommended,Length,From,To\n';plD().pipes.forEach(p=>{const r=R.pipes[p.id]||{};s+=[p.name,PLSYS[p.sys].label,p.mat,plSizeTxt(r.size!=null?r.size:p.size,us),plSizeTxt(r.rec,us),fmtRun(plLen(p)),plRefName(p.ea),plRefName(p.eb)].map(q).join(',')+'\n';});
  const P=R.pump;if(P){s+='\nPump\n';if(P.mode==='tank')s+='Lift pump,'+q(plFmtQ(P.fill))+','+q(plFmtM(P.liftHead))+','+q(plFmtW(P.liftPower))+'\n';if(P.head)s+='Booster pump,'+q(plFmtQ(P.Qd))+','+q(plFmtM(P.head))+','+q(plFmtW(P.power))+'\n';}
  return s;}
function plSheetHTML(full){const rows=plRows();if(!rows.length)return '<p class="empty">Nothing yet. Draw pipes and place equipment, and they are listed here with sizes and lengths.</p>';
  let h=`<table class="qt eptab"><thead><tr><th>Item</th><th>Size</th><th>Qty</th>${full?'<th>Unit price</th><th>Total</th>':''}</tr></thead><tbody>`;let cat='';
  rows.forEach(r=>{if(r.cat!==cat){cat=r.cat;h+=`<tr class="epcat"><td colspan="${full?5:3}">${esc(cat)}</td></tr>`;}h+=`<tr><td>${esc(r.item)}</td><td>${esc(r.spec)}</td><td>${r.qty} ${esc(r.unit)}</td>${full?'<td></td><td></td>':''}</tr>`;});return h+'</tbody></table>';}
function plSidePanel(){const el=$('#plSide');if(!el)return;
  el.innerHTML=`<p class="h">Calculations</p>${plSummaryHTML()}<p class="h" style="margin-top:12px">Worksheet</p><div class="kv"><label for="plSpare">Spare</label><input id="plSpare" data-type="num" value="${plSet().spare}%"></div>${plSheet==='plan'?plSheetHTML(false):''}
    <div class="rowbtns"><button class="btn" id="plOpenSheet">Open worksheet</button><button class="btn" id="plSaveCSV">Save as CSV</button></div><p class="unitnote">Pipe lengths include the spare. Fittings are counted from the bends and joints in the drawing.</p>`;
  $('#plSpare').onchange=e=>{const x=parseFloat(e.target.value);if(isFinite(x)&&x>=0&&x<=100)mutate(()=>plW().set.spare=x);renderTakeoff();dirty();};
  $('#plOpenSheet').onclick=()=>{const b=document.createElement('div');b.className='epsheet';b.innerHTML=plSummaryHTML()+plSheetHTML(true);
    openModal('Plumbing worksheet',(M.name||'Project')+' · lengths in '+runU()+' include '+plSet().spare+'% spare.',null,[{label:'Close',fn:closeModal},{label:'Copy as CSV',fn:e=>copyText(plCSV(),e)},{label:'Save as CSV',primary:true,fn:()=>{closeModal();plSaveCSV();}}],b,true);};
  $('#plSaveCSV').onclick=plSaveCSV;}
async function plSaveCSV(){try{const p=await saveTextFile(safeName((M.name||'project')+' plumbing worksheet')+'.csv',plCSV(),'Spreadsheet (CSV)',['csv']);if(p)toast('Saved '+baseName(p));}catch(err){toast('Could not save: '+err);}}


/* ============================== statistics: house, garden, walls, windows, doors ============================== */
// One screen with the areas people ask for. The built-up area is everything inside the outer faces of the house walls
// (walls included); it is worked out on a fine grid (about 1/2,000 of the plan's size per cell), so odd shapes and
// angled or curved walls are handled the same way.
const isYardWall=w=>!!(w.kind&&OUTW[w.kind]);
function enclosedArea(walls){if(!walls.length)return 0;let x0=1e18,y0=1e18,x1=-1e18,y1=-1e18,tm=0;
  walls.forEach(w=>{[w.a,w.b].forEach(p=>{x0=Math.min(x0,p[0]);y0=Math.min(y0,p[1]);x1=Math.max(x1,p[0]);y1=Math.max(y1,p[1]);});tm=Math.max(tm,w.t||0);});
  x0-=tm+50;y0-=tm+50;x1+=tm+50;y1+=tm+50;const k=Math.max(4,Math.max(x1-x0,y1-y0)/3000),W=Math.ceil((x1-x0)/k)+2,H=Math.ceil((y1-y0)/k)+2;
  const cv=document.createElement('canvas');cv.width=W;cv.height=H;const g=cv.getContext('2d',{willReadFrequently:true});g.fillStyle='#000';
  const P=p=>[(p[0]-x0)/k+0.37,(p[1]-y0)/k+0.37];
  walls.forEach(w=>{const L=dist(w.a,w.b);if(L<1)return;const d=mul(sub(w.b,w.a),1/L),n=perp(d),h=(w.t||100)/2,a=sub(w.a,mul(d,h)),b=add(w.b,mul(d,h));
    const q=[add(a,mul(n,h)),add(b,mul(n,h)),sub(b,mul(n,h)),sub(a,mul(n,h))].map(P);g.beginPath();q.forEach((p,i)=>i?g.lineTo(p[0],p[1]):g.moveTo(p[0],p[1]));g.closePath();g.fill();});
  const px=g.getImageData(0,0,W,H).data,out=new Uint8Array(W*H),st=[];
  const solid=i=>px[i*4+3]>=128;
  for(let x=0;x<W;x++){st.push(x,(H-1)*W+x);}for(let y=0;y<H;y++){st.push(y*W,y*W+W-1);}
  while(st.length){const i=st.pop();if(out[i]||solid(i))continue;out[i]=1;const x=i%W;if(x>0)st.push(i-1);if(x<W-1)st.push(i+1);if(i>=W)st.push(i-W);if(i<W*(H-1))st.push(i+W);}
  let c=0;for(let i=0;i<W*H;i++)if(!out[i])c++;return c*k*k;}
const opArea=o=>(o.w||0)*(o.h||0);
function opKindLabel(o){if(o.kind==='window')return 'Window';return isSliding(o)?'Sliding door':'Door';}
function siteStats(){const S={};const bw=M.walls.filter(w=>!isYardWall(w)),yw=M.walls.filter(isYardWall);const wallIds=new Set(bw.map(w=>w.id));
  // house
  S.gross=enclosedArea(bw);S.rooms=rooms.map(r=>({name:r.name,type:ROOMTYPES[r.type]||r.type,area:r.netArea,walls:r.wallArea}));
  (M.areas||[]).forEach(A=>{if(isZone(A)){const z=zoneStats(A);S.rooms.push({name:A.name||'Area',type:(ROOMTYPES[A.type]||'')+' (area)',area:z.floor,walls:z.wall});}});
  S.net=S.rooms.reduce((a,r)=>a+r.area,0);S.paint=S.rooms.reduce((a,r)=>a+(r.walls||0),0);
  // garden
  S.surf={};(M.areas||[]).forEach(A=>{if(isZone(A)||!A.surf||!SURF[A.surf])return;const a=areaStats(A).area;S.surf[A.surf]=(S.surf[A.surf]||0)+a;});
  S.garden=Object.values(S.surf).reduce((a,b)=>a+b,0);S.yard=yw.length?Math.max(0,enclosedArea(M.walls)-S.gross):null;
  // walls (one face, along the centre line, full height)
  const ops=M.openings.filter(o=>wallIds.has(o.wall));S.wallLen=bw.reduce((a,w)=>a+wallLen(w),0);S.wallGross=bw.reduce((a,w)=>a+wallLen(w)*(w.h||defaults.h),0);
  S.opArea=ops.reduce((a,o)=>a+opArea(o),0);S.wallNet=Math.max(0,S.wallGross-S.opArea);
  S.yardWalls=Object.keys(OUTW).map(k=>{const ws=yw.filter(w=>w.kind===k);if(!ws.length)return null;const ids=new Set(ws.map(w=>w.id));const go=ws.reduce((a,w)=>a+wallLen(w)*(w.h||OUTW[k].h),0),gt=M.openings.filter(o=>ids.has(o.wall)).reduce((a,o)=>a+opArea(o),0);
    return {label:OUTW[k].label,len:ws.reduce((a,w)=>a+wallLen(w),0),gross:go,gates:gt,net:Math.max(0,go-gt)};}).filter(Boolean);
  // windows and doors, grouped by kind and size
  const group=list=>{const m=new Map();list.forEach(o=>{const k=(o.name||'')+'|'+opKindLabel(o)+'|'+Math.round(o.w)+'|'+Math.round(o.h);const e=m.get(k)||{name:o.name||'',kind:opKindLabel(o),w:o.w,h:o.h,n:0};e.n++;m.set(k,e);});
    return [...m.values()].sort((a,b)=>(a.name?0:1)-(b.name?0:1)||b.w*b.h-a.w*a.h);};
  S.namedWalls=M.walls.filter(w=>w.name).reduce((acc,w)=>{let e=acc.find(x=>x.name===w.name);if(!e){e={name:w.name,type:isYardWall(w)?OUTW[w.kind].label:'Wall',len:0,gross:0,op:0};acc.push(e);}
    const L=wallLen(w);e.len+=L;e.gross+=L*(w.h||defaults.h);e.op+=M.openings.filter(o=>o.wall===w.id).reduce((a,o)=>a+opArea(o),0);return acc;},[]);
  S.win=group(M.openings.filter(o=>o.kind==='window'));S.door=group(M.openings.filter(o=>o.kind!=='window'));
  S.winArea=S.win.reduce((a,e)=>a+e.w*e.h*e.n,0);S.doorArea=S.door.reduce((a,e)=>a+e.w*e.h*e.n,0);
  S.winN=S.win.reduce((a,e)=>a+e.n,0);S.doorN=S.door.reduce((a,e)=>a+e.n,0);return S;}
function statsRows(S){const A=v=>fmtArea(v),U=areaU(),R=[];const r=(...c)=>R.push(c);
  r('House');r('Built-up area (outside of the walls, walls included)',A(S.gross),U);r('Net floor area (inside the rooms)',A(S.net),U);r('Taken by walls and unclosed spaces',A(Math.max(0,S.gross-S.net)),U);
  S.rooms.forEach(x=>r('  '+x.name+' ('+x.type+')',A(x.area),U));
  r('');r('Garden');r('Garden surfaces',A(S.garden),U);Object.keys(S.surf).forEach(k=>r('  '+SURF[k].label,A(S.surf[k]),U));if(S.yard!=null)r('Yard inside the fences and garden walls (not the house)',A(S.yard),U);
  r('');r('Walls of the house (one face)');r('Wall length',fmtRun(S.wallLen),runU());r('Wall area with doors and windows',A(S.wallGross),U);r('Doors and windows in them',A(S.opArea),U);r('Wall area without doors and windows',A(S.wallNet),U);
  r('Inside faces of the rooms, without doors and windows',A(S.paint),U);
  S.yardWalls.forEach(y=>{r(y.label+' (one face)',A(y.gross),U);if(y.gates)r('  '+y.label+' without gates',A(y.net),U);});
  S.namedWalls.forEach(x=>{r(x.name+' ('+x.type+'), with openings',A(x.gross),U);r(x.name+' ('+x.type+'), without openings',A(Math.max(0,x.gross-x.op)),U);});
  r('');r('Windows');S.win.forEach(e=>r('  '+(e.name?e.name+' ':'')+fmtLen(e.w)+' × '+fmtLen(e.h)+' × '+e.n,A(e.w*e.h*e.n),U));r('Windows: '+S.winN,A(S.winArea),U);
  r('');r('Doors');S.door.forEach(e=>r('  '+(e.name?e.name+' ('+e.kind+') ':e.kind+' ')+fmtLen(e.w)+' × '+fmtLen(e.h)+' × '+e.n,A(e.w*e.h*e.n),U));r('Doors: '+S.doorN,A(S.doorArea),U);return R;}
function statsCSV(S){return [['Item','Value','Unit']].concat(statsRows(S)).map(c=>c.map(x=>{x=String(x==null?'':x);return /[",]/.test(x)?'"'+x.replace(/"/g,'""')+'"':x;}).join(',')).join('\n');}
function statsHTML(S){const A=v=>fmtArea(v)+' '+areaU(),big=(lab,v,sub)=>`<div class="stbig"><span>${lab}</span><b>${v}</b>${sub?`<small>${sub}</small>`:''}</div>`;
  const tbl=(head,rows)=>rows.length?`<table class="sttab"><thead><tr>${head.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table>`:'';
  let h=`<section><p class="h">House (without the garden)</p><div class="stgrid">${big('Built-up area',A(S.gross),'outside of the walls, walls included')}${big('Net floor area',A(S.net),'inside the rooms')}${big('Walls and unclosed spaces',A(Math.max(0,S.gross-S.net)))}</div>`;
  h+=tbl(['Room','Type','Floor'],S.rooms.map(x=>`<tr><td>${esc(x.name)}</td><td>${esc(x.type)}</td><td>${A(x.area)}</td></tr>`));
  if(!S.gross&&!S.rooms.length)h+='<p class="tip">Draw walls to get the house areas.</p>';h+='</section>';
  h+=`<section><p class="h">Garden</p><div class="stgrid">${big('Garden surfaces',A(S.garden),Object.keys(S.surf).length?'':'lawn, paving, deck, gravel, pool and beds')}${S.yard!=null?big('Yard inside the fences',A(S.yard),'fences and garden walls, less the house'):''}</div>`;
  h+=tbl(['Surface','Area'],Object.keys(S.surf).map(k=>`<tr><td>${SURF[k].label}</td><td>${A(S.surf[k])}</td></tr>`));
  if(!S.garden&&S.yard==null)h+='<p class="tip">Draw the yard with the Outdoor tools (Ground surfaces, Fence, Garden wall) to get the garden areas.</p>';h+='</section>';
  h+=`<section><p class="h">Walls of the house</p><div class="stgrid">${big('With doors and windows',A(S.wallGross),fmtRun(S.wallLen)+' '+runU()+' of wall, one face')}${big('Without doors and windows',A(S.wallNet),'less '+A(S.opArea)+' of openings')}${big('Inside faces of the rooms',A(S.paint),'without doors and windows, for paint and plaster')}</div>`;
  h+=tbl(['Yard wall','Length','With gates','Without gates'],S.yardWalls.map(y=>`<tr><td>${y.label}</td><td>${fmtRun(y.len)} ${runU()}</td><td>${A(y.gross)}</td><td>${A(y.net)}</td></tr>`));
  h+=tbl(['Named wall','Length','With doors and windows','Without doors and windows'],S.namedWalls.map(x=>`<tr><td><span translate="no">${esc(x.name)}</span> <small class="seltype">${x.type}</small></td><td>${fmtRun(x.len)} ${runU()}</td><td>${A(x.gross)}</td><td>${A(Math.max(0,x.gross-x.op))}</td></tr>`))+'</section>';
  const opT=(list,door)=>tbl(['Name'].concat(door?['Type']:[],['Width','Height','Count','Each','Total']),list.map(e=>`<tr><td translate="no">${e.name?esc(e.name):'—'}</td>${door?`<td>${e.kind}</td>`:''}<td>${fmtLen(e.w)}</td><td>${fmtLen(e.h)}</td><td>${e.n}</td><td>${A(e.w*e.h)}</td><td>${A(e.w*e.h*e.n)}</td></tr>`));
  h+=`<section><p class="h">Windows</p><div class="stgrid">${big('Window area',A(S.winArea),S.winN+' window'+(S.winN===1?'':'s'))}</div>${opT(S.win,false)}</section>`;
  h+=`<section><p class="h">Doors</p><div class="stgrid">${big('Door area',A(S.doorArea),S.doorN+' door'+(S.doorN===1?'':'s'))}</div>${opT(S.door,true)}</section>`;
  return h+`<p class="unitnote">Wall areas are one face, measured along the wall centre line at full wall height; openings count width × height. Lengths in ${({mm:'millimetres',cm:'centimetres',m:'metres',imperial:'feet and inches'})[units]||units}.</p>`;}
function statsDialog(){if(typeof storeActive==='function')try{storeActive();}catch(e){}const S=siteStats();const b=document.createElement('div');b.className='stats';b.innerHTML=statsHTML(S);
  openModal('Statistics',M.name||'',null,[{label:'Copy as CSV',fn:e=>copyText(statsCSV(S),e)},{label:'Save as CSV',fn:()=>saveTextFile(safeName(M.name||'project')+' statistics.csv',statsCSV(S),'CSV',['csv'])},{label:'Close',primary:true,fn:closeModal}],b,true);}

/* ============================== right-click (and long-press) quick menu ============================== */
// Right-click an item on the plan (or press and hold on a touch screen) to select it and get its most-used
// commands right there. The commands are the same ones in its side panel, so nothing behaves differently.
let ctxDown=null,ctxLP=null,ctxOpenAt=0;
const ctxEl=(()=>{const d=document.createElement('div');d.id='ctxMenu';d.className='ctxmenu';d.setAttribute('role','menu');d.hidden=true;document.body.appendChild(d);return d;})();
function ctxClose(){if(ctxEl.hidden)return;ctxEl.hidden=true;ctxEl.innerHTML='';try{planCv.focus({preventScroll:true});}catch(e){}}
function ctxBtn(id){const b=document.getElementById(id);return b&&b.closest('#inspector')&&!b.disabled&&b.offsetParent?b:null;}
function ctxSelectOpts(id){const s=document.getElementById(id);if(!s||!s.closest('#inspector')||s.disabled)return null;
  return [...s.options].map(o=>({label:o.textContent,on:o.selected,fn:()=>{s.value=o.value;s.dispatchEvent(new Event('change',{bubbles:true}));s.dispatchEvent(new Event('input',{bubbles:true}));}}));}
const CTX_SEL={wall:[['wKind','Wall type']],opening:[['oStyle','Style']],room:[['rType','Room type'],['rTile','Tiling']]};
const CTX_SKIP=new Set(['copyBtn','delBtn','rDel','rLblReset','clearRulerBtn','keepBtn','plDel','epDel']);
// a wall hit at point p: put a door or window there, using the same defaults as the Door and Window tools
function ctxOpening(type,p){setTool(type);updatePreview(p);const g=ghost?Object.assign({},ghost,{id:nid('o')}):null;setTool('select');
  if(!g){toast(type==='door'?'There is no room for a door at that spot.':'There is no room for a window at that spot.');return;}
  mutate(()=>M.openings.push(g));sel={kind:'opening',id:g.id};renderInspector();dirty();}
function ctxDuplicate(){if(!copySel(true))return;startPaste();toast(openingOnly()?'Move onto a wall and click where the copy goes.':'Click where the copy goes. Esc cancels.');}
function ctxDelete(){if(eMode)epDelete();else if(pMode)plDelete();else deleteSel();renderInspector();dirty();}
function ctxProps(){if(isNarrow()){sheetSel=sel?JSON.stringify(sel):null;setSheet(true);setTimeout(sheetReveal,240);return;}
  const f=document.querySelector('#inspector input:not([type=checkbox]):not([disabled]),#inspector select');const sd=$('#side');if(sd)sd.scrollTop=0;if(f){f.focus();try{f.select();}catch(e){}}}
// normalise what was hit into what gets selected
function ctxSelFor(h){if(!h)return null;const k=h.kind;
  if(k==='end')return {kind:'wall',id:h.id};if(k==='arcend'||k==='arcmid')return {kind:'arc',id:h.id};if(k==='colrot')return {kind:'col',id:h.id};
  if(k==='areapt'||k==='areamid')return {kind:'area',id:h.id};if(k==='roomcorner'||k==='roomedge'||k==='roomlabel')return {kind:'room',pt:h.pt.slice()};
  if(k==='elec')return {kind:'elec',id:h.id};if(k==='room')return {kind:'room',pt:h.pt.slice()};return {kind:k,id:h.id};}
function ctxItems(p){const L=[],sep=()=>{if(L.length&&L[L.length-1]!=='-')L.push('-');};
  const add=(label,fn,o)=>L.push(Object.assign({label,fn},o||{}));
  const harvest=()=>{document.querySelectorAll('#inspector button[id]').forEach(b=>{if(CTX_SKIP.has(b.id)||b.hasAttribute('aria-pressed')||b.disabled||!b.offsetParent||b.closest('.seg,.dcards'))return;
      if(L.some(x=>x.btn===b.id))return;let lb=b.textContent.trim()||b.title;if(b.id==='rLblHide'){const r=selRoom();lb=r&&r.meta&&r.meta.hideLabel?'Show the room name':'Hide the room name';}
      add(lb,()=>{const x=ctxBtn(b.id);if(x)x.click();},{btn:b.id});});};
  const info=id=>{const c=document.getElementById(id);if(c&&!c.disabled)add(c.checked?'Hide its info on the plan':'Show its info on the plan',()=>{c.checked=!c.checked;c.dispatchEvent(new Event('change',{bubbles:true}));});};
  const k=sel&&sel.kind;
  if(!sel){ // empty spot on the plan
    if(!eMode&&!pMode){if(clip)add('Paste here',()=>{pasteOff=pasteOffsetFor(p);if(pasteOff)doPaste();else startPaste();},{kbd:'Ctrl+V'});
      add('Draw a wall from here',()=>{setTool('wall');const q=snapPoint(p,null).p;draw.start=q;draw.chainStart=q;updatePreview(p);dirty();},{kbd:'W'});
      add('Add text here',()=>{setTool('text');textToolClick(p);});sep();}
    add('Undo',undo,{kbd:'Ctrl+Z',dis:!undoStack.length&&!(typeof eraseStack!=='undefined'&&eraseStack.length)});add('Redo',redo,{kbd:'Ctrl+Y',dis:!redoStack.length});sep();
    add('Zoom to fit',()=>$('#fitBtn').click(),{kbd:'F'});if(!eMode&&!pMode)add('Statistics…',statsDialog);return L;}
  const subs=ids=>ids.forEach(id=>{const o=ctxSelectOpts(id);if(!o||o.length<2)return;const lb=document.querySelector('#inspector label[for="'+id+'"]');add((lb&&lb.textContent.trim())||id,null,{sub:o});});
  if(eMode||pMode){harvest();info(eMode?'epInfo':'plInfo');subs(['plSys','plSize','plMat','plKind','plWhere','epType','epSize','epCores','epCirc','epAmps','epDia','epRoute']);sep();add('Properties…',ctxProps);add('Delete',ctxDelete,{kbd:'Del',danger:true});return L;}
  if(k==='wall'){add('Add a door here',()=>ctxOpening('door',p));add('Add a window here',()=>ctxOpening('window',p));sep();}
  if(k==='item'){const it=M.items.find(x=>x.id===sel.id);if(it&&ctxBtn('rotBtn')){add('Rotate 90°',()=>ctxBtn('rotBtn').click(),{kbd:'R',btn:'rotBtn'});add('Rotate 90° back',()=>{mutate(()=>it.r=((it.r||0)+270)%360);renderInspector();});}}
  if(k==='col')add('Rotate 90°',()=>{mutate(()=>{const c=colById(sel.id);if(c.wall){const t=c.w;c.w=c.d;c.d=t;}else c.r=((c.r||0)+90)%360;});renderInspector();},{kbd:'R'});
  harvest();
  (CTX_SEL[k]||[]).forEach(([id,label])=>{const o=ctxSelectOpts(id);if(o&&o.length>1)add(label,null,{sub:o});});
  sep();
  add('Properties…',ctxProps);
  if(ctxBtn('copyBtn')){add(k==='room'?'Copy room':'Copy',()=>ctxBtn('copyBtn').click(),{kbd:'Ctrl+C'});if(k!=='room')add('Duplicate',ctxDuplicate,{kbd:'Ctrl+D'});}
  if(clip&&k!=='room')add('Paste here',()=>{pasteOff=pasteOffsetFor(p);if(pasteOff)doPaste();else startPaste();},{kbd:'Ctrl+V'});
  add('Delete',ctxDelete,{kbd:'Del',danger:true});return L;}
function ctxTitle(){if(!sel)return eMode?'Electric plan':pMode?'Plumbing plan':'Plan';const t=$('#inspector .selname'),h=$('#inspector .h');
  const s=(t&&t.firstChild&&t.firstChild.textContent)||(h&&h.textContent)||'';return s.trim();}
function ctxRender(items,x,y){ctxEl.innerHTML='';const tt=ctxTitle();if(tt){const d=document.createElement('div');d.className='ctxt';d.setAttribute('translate','no');d.textContent=tt;ctxEl.appendChild(d);}
  items.forEach(it=>{if(it==='-'){ctxEl.appendChild(document.createElement('hr'));return;}
    const b=document.createElement('button');b.type='button';b.setAttribute('role','menuitem');if(it.danger)b.classList.add('danger');if(it.dis)b.disabled=true;
    const l=document.createElement('span');l.textContent=it.label;b.appendChild(l);
    if(it.kbd||it.sub){const k=document.createElement('kbd');k.textContent=it.sub?'▾':it.kbd;k.setAttribute('translate','no');b.appendChild(k);}ctxEl.appendChild(b);
    if(it.sub){const box=document.createElement('div');box.className='ctxsub';box.hidden=true;b.setAttribute('aria-expanded','false');
      it.sub.forEach(o=>{const s=document.createElement('button');s.type='button';s.setAttribute('role','menuitemradio');s.setAttribute('aria-checked',String(!!o.on));s.textContent=o.label;
        s.onclick=()=>{if(Date.now()-ctxOpenAt<300)return;ctxClose();o.fn();};box.appendChild(s);});
      ctxEl.appendChild(box);b.onclick=()=>{const op=box.hidden;box.hidden=!op;b.setAttribute('aria-expanded',String(op));ctxPlace(x,y);};return;}
    b.onclick=()=>{if(Date.now()-ctxOpenAt<300)return;ctxClose();try{it.fn();}catch(e){console.error(e);}};});
  ctxEl.hidden=false;ctxPlace(x,y);const f=ctxEl.querySelector('button:not([disabled])');if(f)f.focus({preventScroll:true});}
function ctxPlace(x,y){const W=innerWidth,H=innerHeight,r=ctxEl.getBoundingClientRect();
  let l=x+2,t=y+2;if(l+r.width>W-6)l=Math.max(6,x-r.width-2);if(t+r.height>H-6)t=Math.max(6,H-r.height-6);ctxEl.style.left=l+'px';ctxEl.style.top=t+'px';}
// open the menu for world point p at screen point (x,y)
function ctxOpen(p,x,y){if(tool!=='select'||walk&&walk.on)return;ctxClose();drag=null;pan=null;box=null;
  if(eMode){const h=epHit(p);sel=h?{kind:'ep',t:h.t,id:h.id}:null;}
  else if(pMode){const h=plHit(p);sel=h?{kind:'pl',t:h.t,id:h.id}:null;}
  else{const h=hitTest(p);const keep=sel&&h&&((sel.kind==='walls'&&(h.kind==='wall'||h.kind==='end')&&sel.ids.includes(h.id))||(sel.kind==='elecs'&&h.kind==='elec'&&sel.ids.includes(h.id)));
    if(!keep){sel=ctxSelFor(h);if(sel&&sel.kind==='room'){elevPt=sel.pt.slice();try{fillElevSelect();}catch(e){}}}}
  renderInspector();sheetSel=sel?JSON.stringify(sel):null;hover=null;dirty();
  ctxOpenAt=Date.now();ctxRender(ctxItems(p),x,y);}
document.addEventListener('pointerdown',e=>{if(!ctxEl.hidden&&!ctxEl.contains(e.target))ctxClose();},true);
window.addEventListener('blur',ctxClose);window.addEventListener('resize',ctxClose);
planCv.addEventListener('wheel',ctxClose,{passive:true});
ctxEl.addEventListener('contextmenu',e=>e.preventDefault());
ctxEl.addEventListener('keydown',e=>{e.stopPropagation();const bs=[...ctxEl.querySelectorAll('button:not([disabled])')].filter(b=>b.offsetParent);const i=bs.indexOf(document.activeElement);
  if(e.key==='Escape'){e.preventDefault();e.stopPropagation();ctxClose();}
  else if(e.key==='ArrowDown'){e.preventDefault();(bs[(i+1)%bs.length]||bs[0]).focus();}
  else if(e.key==='ArrowUp'){e.preventDefault();(bs[(i-1+bs.length)%bs.length]||bs[0]).focus();}
  else if(e.key==='Tab'){e.preventDefault();ctxClose();}});
// keyboard: the Menu key or Shift+F10 opens it for what is under the pointer
planCv.addEventListener('keydown',e=>{if(e.key==='ContextMenu'||(e.key==='F10'&&e.shiftKey)){e.preventDefault();const r=planCv.getBoundingClientRect(),s=toS(cursor||[0,0]);
  ctxOpen(cursor||toW([r.width/2,r.height/2]),r.left+clamp(s[0],0,r.width),r.top+clamp(s[1],0,r.height));}});
// touch: press and hold without moving
function ctxLPStart(e,sp){ctxLPCancel();if(tool!=='select')return;ctxLP={id:e.pointerId,sp,x:e.clientX,y:e.clientY,t:setTimeout(()=>{const L=ctxLP;ctxLP=null;if(!L||touches.size!==1||(drag&&drag.moved))return;
    if(drag&&drag.snap0&&snapshot()!==drag.snap0){M=JSON.parse(drag.snap0);fixUid();changed();}
    try{navigator.vibrate&&navigator.vibrate(15);}catch(err){}ctxOpen(toW(L.sp),L.x+8,L.y+8);},550)};}
function ctxLPCancel(){if(ctxLP){clearTimeout(ctxLP.t);ctxLP=null;}}
function ctxLPMove(e,sp){if(ctxLP&&e.pointerId===ctxLP.id&&Math.hypot(sp[0]-ctxLP.sp[0],sp[1]-ctxLP.sp[1])>9)ctxLPCancel();}

/* ============================== language: English / العربية (Syria) ============================== */
// The app is written in English. In Arabic every piece of text the user sees is swapped as it appears: whole
// sentences (with their <b>/<kbd> markup) first, then exact phrases, then a few patterns for text with numbers
// and names in it, then known phrases inside longer text. Nothing in the project data changes, so switching back
// restores the English as it was. The layout turns right-to-left; the drawing itself stays as drawn.
var LANG='en';try{const v=localStorage.getItem('bm-lang');LANG=v||((navigator.language||'').toLowerCase().startsWith('ar')?'ar':'en');}catch(e){}
const AR_EXACT={"(or any view) above.": "(أو أي عرض آخر) في الأعلى.", "+click adds or removes a wall.": "+نقرة تضيف جداراً أو تزيله.", "+click for several walls.": "+نقرة لتحديد عدة جدران.", "+drag pans.": "+سحب لتحريك العرض.", ". Room names can be dragged too.": ". ويمكن سحب أسماء الغرف أيضاً.", "1 core (single)": "شريحة واحدة (مفرد)", "1 wall-mounted part had no wall to sit on there and was left out.": "قطعة جدارية واحدة لم تجد جداراً هناك فتُركت.", "1-gang": "مفتاح واحد", "2 cores": "شريحتان", "3 cores": "3 شرائح", "3D model view": "عرض النموذج ثلاثي الأبعاد", "3D view": "العرض ثلاثي الأبعاد", "3D view on a second page (PDF)": "العرض ثلاثي الأبعاد في صفحة ثانية (PDF)", "4 cores": "4 شرائح", "5 cores": "5 شرائح", "A small flat with a kitchen, bathroom and living room to explore.": "شقة صغيرة فيها مطبخ وحمّام وصالون للتجربة.", "A text note (for the schematic)": "ملاحظة نصية (للمخطط التخطيطي)", "AC": "AC متناوب", "AC cable 3-core": "كبل AC ثلاثي الشرائح", "AC or DC": "متناوب أو مستمر", "AC wire": "سلك AC", "AC wire: click from part to part": "سلك AC: انقر من قطعة إلى قطعة", "Across": "بالعرض", "Adapter / connector": "وصلة تحويل / موصل", "Add a door here": "إضافة باب هنا", "Add a window here": "إضافة شباك هنا", "Add breaker": "إضافة قاطع", "Add solar breaker": "إضافة قاطع شمسي", "Add text here": "إضافة نص هنا", "Air admittance valve (AAV)": "صمام إدخال هواء (AAV)", "All electric info is on (Measures menu). Turn that off to show only the items you pick.": "كل معلومات الكهرباء ظاهرة (قائمة القياسات). أطفئها لإظهار العناصر التي تختارها فقط.", "All plumbing info is on (Measures menu). Turn that off to show only the items you pick.": "كل معلومات التمديدات الصحية ظاهرة (قائمة القياسات). أوقفها لإظهار العناصر التي تختارها فقط.", "All your work is saved.": "كل عملك محفوظ.", "An area needs at least 3 corners.": "المساحة تحتاج 3 زوايا على الأقل.", "Angle": "الزاوية", "Are you sure you want to exit?": "هل أنت متأكد أنك تريد الخروج؟", "Area": "مساحة", "Area (G)": "مساحة (G)", "Areas and yard": "المساحات والحديقة", "Areas in m², skirting in m. Measured to finished wall faces. Walls are net of doors and windows; tile follows each room's tiling setting and skips areas behind tubs, trays and tall units.": "المساحات بالمتر المربع والنعلات بالمتر. القياس حتى وجه الجدار النهائي. الجدران صافية بعد طرح الأبواب والشبابيك؛ البلاط يتبع إعداد التبليط لكل غرفة ويستثني ما خلف البانيو وقواعد الدوش والخزائن الطولية.", "As on screen": "كما على الشاشة", "Auto": "تلقائي", "Automatic": "تلقائي", "Automatic (High)": "تلقائي (عالية)", "Automatic (large tiles 60×60)": "تلقائي (بلاط كبير 60×60)", "Automatic (wood planks)": "تلقائي (ألواح خشب)", "Autosave every 5 minutes": "حفظ تلقائي كل 5 دقائق", "Autosave failed for": "فشل الحفظ التلقائي لـ", "Autosave is off.": "الحفظ التلقائي متوقف.", "Autosave is on: projects saved to a file are written back every 5 minutes.": "الحفظ التلقائي مفعّل: المشاريع المحفوظة في ملف تُكتب كل 5 دقائق.", "BBQ grill": "شواية", "Back to 0°": "العودة إلى 0°", "Back to centre": "العودة إلى المنتصف", "Back to the home plan: press": "للعودة إلى مخطط البيت اضغط", "Backsplash": "بلاط خلف المجلى", "Ball / stop valve": "محبس كروي / محبس إغلاق", "Base cabinet": "خزانة سفلية", "Bath": "حمّام", "Bathroom": "حمّام", "Bathtub": "بانيو", "Battery": "بطارية", "Battery: click on a wall": "بطارية: انقر على جدار", "Bedroom": "غرفة نوم", "Benchmark Planner": "Benchmark Planner مخطط البيوت", "Bend": "الانحناء", "Bend of edge 1": "انحناء الضلع 1", "Bend of edge 2": "انحناء الضلع 2", "Bend of edge 3": "انحناء الضلع 3", "Bend of edge 4": "انحناء الضلع 4", "Bend point added: drag it to shape the run. Double-click it to remove it.": "أضيفت نقطة انحناء: اسحبها لتشكيل المسار. انقر عليها نقراً مزدوجاً لإزالتها.", "Bend point removed.": "أزيلت نقطة الانحناء.", "Bidet": "شطّافة (بيديه)", "Blank page": "صفحة فارغة", "Blank project": "مشروع فارغ", "Bluetooth isn’t available here": "البلوتوث غير متاح هنا", "Bold": "عريض", "Booster head": "ارتفاع ضخ مضخة التقوية", "Booster power": "قدرة مضخة التقوية", "Booster pump": "مضخة تقوية الضغط", "Bottom": "أسفل", "Box select": "تحديد بمستطيل", "Boxes": "العلب", "Breaker": "قاطع", "Breaker name": "اسم القاطع", "Breaker panel": "لوحة القواطع (تابلو)", "Breaker panel: click on a wall": "لوحة القواطع: انقر على جدار", "Breaker schedule": "جدول القواطع", "Breakers": "القواطع", "Brush size": "حجم الممحاة", "Built-up area": "المساحة الطابقية", "Cable": "الكبلات", "Cable lug": "كوس كبل", "Calculations": "الحسابات", "Camera": "الكاميرا", "Cancel": "إلغاء", "Cancel exit": "إلغاء الخروج", "Capacity (L)": "السعة (لتر)", "Capacity (kWh)": "السعة (kWh)", "Carpet": "موكيت", "Carries": "ينقل", "Centre": "المنتصف", "Chandelier": "ثريا", "Chandelier: click where it hangs": "ثريا: انقر حيث تتدلى", "Check (non-return) valve": "صمام عدم رجوع", "Check that Bluetooth is on in the laser’s settings menu and on this device, that the laser is switched on, and that the Bosch MeasureOn app isn’t connected to it at the same time.": "تأكد أن البلوتوث مفعّل في قائمة إعدادات الليزر وفي هذا الجهاز، وأن الليزر يعمل، وأن تطبيق Bosch MeasureOn غير متصل به في الوقت نفسه.", "Choose a door": "اختر باباً", "Choose a saved project file on this device.": "اختر ملف مشروع محفوظاً على هذا الجهاز.", "Choose which measurements show on the plan": "اختر القياسات التي تظهر على المخطط", "Circuit": "الدارة", "Circular": "دائري", "City mains direct": "من الشبكة العامة مباشرة", "Cleanout": "فتحة تنظيف", "Clear span": "الفتحة الصافية", "Click along the route of the conduit; double-click or press Enter to finish. Wires that run along it are put in it; change that in its panel.": "انقر على طول مسار الأنبوب؛ انقر نقراً مزدوجاً أو اضغط Enter للإنهاء. الأسلاك التي تمر بمحاذاته توضع فيه؛ يمكنك تغيير ذلك من لوحته.", "Click an existing text to change it.": "انقر على نص موجود لتعديله.", "Click further away to set the length of the strip.": "انقر أبعد لتحديد طول الشريط.", "Click on a wall face where it goes. It sits on the side you click. Heights and labels can be changed afterwards in its side panel.": "انقر على وجه الجدار حيث يوضع، ويثبت على الجهة التي تنقر عليها. يمكن تغيير الارتفاع والتسمية لاحقاً من لوحته الجانبية.", "Click on a wall face where it is mounted. Its settings are in its panel afterwards.": "انقر على وجه الجدار حيث يُركَّب. إعداداته في لوحته بعد ذلك.", "Click on a wall to place a door. Dimensions show distance to each wall face.": "انقر على جدار لوضع باب. الأبعاد تُظهر المسافة إلى كل وجه جدار.", "Click on a wall to place a window. Dimensions show distance to each wall face.": "انقر على جدار لوضع شباك. الأبعاد تُظهر المسافة إلى كل وجه جدار.", "Click on the plan to place it. Change shape and size later in its side panel.": "انقر على المخطط لوضعه. غيّر الشكل والقياس لاحقاً من لوحته الجانبية.", "Click to place it.": "انقر لوضعه.", "Click to unsnap this end": "انقر لفك التقاط هذا الطرف", "Click two points, or drag, to measure. It snaps to wall corners, wall faces and fixture corners. On a wall face it measures square from the first point, so you get the true clear distance.": "انقر على نقطتين، أو اسحب، للقياس. يلتقط زوايا الجدران ووجوهها وزوايا التجهيزات. على وجه الجدار يقيس عمودياً من النقطة الأولى لتحصل على المسافة الصافية الحقيقية.", "Click where it goes. Heights and labels can be changed afterwards in its side panel.": "انقر حيث يوضع. يمكن تغيير الارتفاع والتسمية لاحقاً من لوحته الجانبية.", "Click where it goes. Its settings are in its panel afterwards.": "انقر حيث تريد وضعه. إعداداته في لوحته بعد ذلك.", "Click where the copy goes. Esc cancels.": "انقر حيث توضع النسخة. Esc للإلغاء.", "Click where the curved wall starts.": "انقر حيث يبدأ الجدار المنحني.", "Click where the pipe starts: on a fixture (the blue rings on the home plan are fixtures), equipment, or a pipe of the same kind (a tee is made there).": "انقر حيث يبدأ الأنبوب: على أداة صحية (الحلقات الزرقاء على مخطط البيت هي أدوات صحية)، أو معدة، أو أنبوب من النوع نفسه (تُعمل وصلة تي هناك).", "Click where the strip starts. Heights and labels can be changed afterwards in its side panel.": "انقر حيث يبدأ الشريط. يمكن تغيير الارتفاع والتسمية لاحقاً من لوحته الجانبية.", "Click where the wire starts: on a light, switch, socket, junction box or the breaker panel (they light up orange), or anywhere.": "انقر حيث يبدأ السلك: على إنارة أو مفتاح أو بريز أو علبة تفريع أو لوحة القواطع (تضيء بالبرتقالي)، أو في أي مكان.", "Close": "إغلاق", "Close a loop of walls to create a room, or measure any shape with the Area tool.": "أغلق حلقة من الجدران لإنشاء غرفة، أو قِس أي شكل بأداة المساحة.", "Close details": "إغلاق التفاصيل", "Cold water": "مياه باردة", "Cold water has no source: connect a water meter, tank or pump.": "المياه الباردة بلا مصدر: صِلها بعداد مياه أو خزان أو مضخة.", "Cold water pipe (blue)": "أنبوب مياه باردة (أزرق)", "Collapse the tool panel": "طي لوحة الأدوات", "Collapse the tool panel ( [ )": "طي لوحة الأدوات ( [ )", "Colours": "الألوان", "Column / pillar": "عمود", "Column / pillar (C)": "عمود (C)", "Column placed. Use the Pointer to select it and type exact distances to the walls.": "وُضع العمود. استخدم المؤشر لتحديده وكتابة مسافاته الدقيقة إلى الجدران.", "Columns": "الأعمدة", "Common sizes": "قياسات شائعة", "Conduit": "أنبوب", "Conduit: click along its route": "أنبوب تمديد: انقر على طول مساره", "Connect a laser measure": "توصيل متر ليزر", "Connected to": "متصل بـ", "Connector": "الوصلة", "Connectors": "الوصلات", "Copied": "تم نسخ", "Copper": "نحاس", "Copy": "نسخ", "Copy (Ctrl+C)": "نسخ (Ctrl+C)", "Copy (Ctrl+C), then paste with Ctrl+V": "نسخ (Ctrl+C) ثم لصق بـ Ctrl+V", "Copy as CSV": "نسخ كـ CSV", "Copy room": "نسخ الغرفة", "Copy the room's walls, doors, windows, fixtures and columns (Ctrl+C)": "نسخ جدران الغرفة وأبوابها وشبابيكها وتجهيزاتها وأعمدتها (Ctrl+C)", "Copy this text into a file named": "انسخ هذا النص إلى ملف باسم", "Cores": "الشرائح", "Corners": "الزوايا", "Could not import": "تعذر استيراد", "Could not open the file:": "تعذر فتح الملف:", "Could not open:": "تعذر الفتح:", "Could not save the DXF:": "تعذر حفظ ملف DXF:", "Could not save:": "تعذر الحفظ:", "Couldn’t connect to the laser": "تعذر الاتصال بالليزر", "Count": "العدد", "Countertop run": "طول الرخامة", "Coupling": "جلبة وصل", "Crimp / ferrule": "كبس / طرفية", "Current": "التيار", "Curved": "منحني", "Curved or straight": "منحني أو مستقيم", "Curved wall": "جدار منحني", "Curved wall (A)": "جدار منحني (A)", "Curved wall added. Select it with the Pointer to change its radius, bend or ends.": "أضيف جدار منحني. حدده بالمؤشر لتغيير نصف قطره أو انحنائه أو أطرافه.", "Cutaway": "مقطع مفتوح", "DC": "DC مستمر", "DC isolator": "قاطع عزل DC", "DC isolator / breaker: click on a wall": "قاطع عزل DC: انقر على جدار", "DC wire": "سلك DC", "DC wire: click from part to part": "سلك DC: انقر من قطعة إلى قطعة", "DXF ready": "ملف DXF جاهز", "Day — sunlight": "نهار — ضوء الشمس", "Deck": "أرضية خشبية", "Deck: click its corners": "أرضية خشبية: انقر على زواياها", "Delete": "حذف", "Delete or move its wire first.": "احذف سلكه أو انقله أولاً.", "Delete or move one of its wires first.": "احذف أحد أسلاكه أو انقله أولاً.", "Deleted rooms are back.": "عادت الغرف المحذوفة.", "Depth": "العمق", "Design flow": "التدفق التصميمي", "Detach": "فصل", "Detach these walls from all other walls so they move on their own": "افصل هذه الجدران عن باقي الجدران لتتحرك وحدها", "Detach this wall from its neighbours so it moves on its own": "افصل هذا الجدار عن جيرانه ليتحرك وحده", "Details": "التفاصيل", "Devices": "الأجهزة", "Diameter": "القطر", "Dimension": "بُعد", "Dimensions removed. Ctrl+Z brings them back.": "أزيلت الأبعاد. Ctrl+Z يعيدها.", "Dimmer": "ديمر", "Dimmer switch": "مفتاح ديمر", "Dimmer switch: click on a wall": "مفتاح ديمر: انقر على جدار", "Dining set": "طاولة سفرة", "Disconnect": "قطع الاتصال", "Dishwasher": "جلاية صحون", "Distance to walls": "المسافة إلى الجدران", "Don’t save": "عدم الحفظ", "Door": "باب", "Door (D): swing or sliding": "باب (D): مفصلي أو جرّار", "Door and window widths": "عروض الأبواب والشبابيك", "Door area": "مساحة الأبواب", "Door type": "نوع الباب", "Doors": "الأبواب", "Double": "مزدوج", "Double-click inside a room to take its outline, or click the corners of the shape.": "انقر نقراً مزدوجاً داخل غرفة لأخذ حدودها، أو انقر على زوايا الشكل.", "Down": "للأسفل", "Downloaded": "تم التنزيل:", "Drag a corner square to move that corner of the room, or a round handle to push or pull that side; the walls move with it. Delete removes the room from the plan and the takeoff and keeps its walls.": "اسحب مربع الزاوية لتحريك زاوية الغرفة، أو المقبض الدائري لدفع ذلك الضلع أو سحبه؛ تتحرك الجدران معه. الحذف يزيل الغرفة من المخطط وحصر الكميات ويبقي جدرانها.", "Drag a round + handle in the middle of a stretch (or the line anywhere) to bend the wire there; drag a square bend point to move it, double-click it to remove it. Drag an end onto a light, switch, socket or panel to connect it. \"Up / down\" is the run from the ceiling or floor to each end's height.": "اسحب مقبض + الدائري في منتصف أي جزء (أو الخط من أي مكان) لحني السلك هناك؛ اسحب نقطة الانحناء المربعة لتحريكها، وانقر عليها نقراً مزدوجاً لإزالتها. اسحب طرفاً إلى إنارة أو مفتاح أو بريز أو لوحة لتوصيله. \"صعود / نزول\" هو المسافة من السقف أو الأرض حتى ارتفاع كل طرف.", "Drag a round + handle to bend it, drag a square point to move a bend, double-click a bend to remove it. Drag an end onto a fixture, equipment or another pipe to connect it.": "اسحب مقبض + الدائري لثنيه، واسحب النقطة المربعة لتحريك الانحناء، وانقر نقراً مزدوجاً على الانحناء لإزالته. اسحب طرفاً إلى أداة صحية أو معدة أو أنبوب آخر لوصله.", "Drag a wall in any direction instead of only in and out (M)": "اسحب الجدار في أي اتجاه بدلاً من الدفع والسحب فقط (M)", "Drag any of them to move them all, or use the arrow keys.": "اسحب أياً منها لتحريكها جميعاً، أو استخدم مفاتيح الأسهم.", "Drag it along the wall, or onto another wall.": "اسحبه على طول الجدار، أو إلى جدار آخر.", "Drag it to move it.": "اسحبه لتحريكه.", "Drag it to move it. Solar chain: panels → DC isolator → inverter (→ battery) → solar breaker in the panel, joined with DC and AC wires.": "اسحبه لتحريكه. سلسلة الطاقة الشمسية: الألواح ← قاطع عزل DC ← الإنفرتر (← البطارية) ← القاطع الشمسي في اللوحة، موصولة بأسلاك DC وAC.", "Drag it to move it; pipes connected to it follow.": "اسحبه لتحريكه؛ تتبعه الأنابيب الموصولة به.", "Drag it to move it; pipes connected to it follow. Fixtures on the home plan (toilet, vanity, bathtub, shower, sink, dishwasher) can be connected directly; place these for anything else.": "اسحبه لتحريكه؛ تتبعه الأنابيب الموصولة به. يمكن وصل الأدوات الصحية الموجودة على مخطط البيت (المرحاض، المغسلة، البانيو، الدوش، المجلى، جلاية الصحون) مباشرة؛ ضع هذه لأي شيء آخر.", "Drag its corners, or the round handles to curve an edge.": "اسحب زواياها، أو المقابض الدائرية لحني ضلع.", "Drag on empty space draws a selection box": "السحب على مكان فارغ يرسم مستطيل تحديد", "Drag on empty space pans the view": "السحب على مكان فارغ يحرّك العرض", "Drag over lines in the imported picture or drawing to rub them out. Walls, doors and windows are never touched.": "اسحب فوق خطوط الصورة أو الرسم المستورد لمسحها. الجدران والأبواب والشبابيك لا تتأثر أبداً.", "Drag the text to move it; arrow keys nudge it. Double-click it to change the words on the plan.": "اسحب النص لتحريكه؛ مفاتيح الأسهم تزيحه قليلاً. انقر عليه نقراً مزدوجاً لتغيير الكلمات على المخطط.", "Dragging on empty space": "السحب على مكان فارغ", "Drain": "صرف", "Drain / waste": "صرف / مياه مستعملة", "Drain slope (%)": "ميل الصرف (%)", "Drain, waste and soil pipe": "أنبوب صرف ومياه مستعملة", "Drainage": "الصرف", "Drains": "يصرّف", "Drains have no outlet: connect a stack or inspection chamber.": "الصرف بلا مخرج: صِله بعمود صرف أو ريكار تفتيش.", "Draw": "الرسم", "Draw a wall from here": "رسم جدار من هنا", "Draw at least 4 walls and add at least one light, switch or socket with the Electrical tools first.": "ارسم 4 جدران على الأقل وأضف إنارة أو مفتاحاً أو بريزاً واحداً على الأقل بأدوات الكهرباء أولاً.", "Draw the yard with the Outdoor tools (Ground surfaces, Fence, Garden wall) to get the garden areas.": "ارسم الفناء بأدوات الخارج (أرضيات، سياج، جدار حديقة) لتحصل على مساحات الحديقة.", "Draw walls to get the house areas.": "ارسم الجدران لتحصل على مساحات البيت.", "Drop from ceiling": "التدلي من السقف", "Duplicate": "تكرار", "Each": "للواحد", "Edge": "الضلع", "Elbow 45°": "كوع 45°", "Elbow 90°": "كوع 90°", "Electric plan": "مخطط الكهرباء", "Electric plan hidden on the home plan.": "مخطط الكهرباء مخفي على مخطط البيت.", "Electric plan shown faded on the home plan.": "مخطط الكهرباء ظاهر باهتاً على مخطط البيت.", "Electric plan worksheet": "ورقة عمل مخطط الكهرباء", "Electric plan: click a wire, conduit or part to edit it. Drag points to reshape a run; double-click a wire to add a bend point.": "مخطط الكهرباء: انقر على سلك أو أنبوب أو قطعة لتعديلها. اسحب النقاط لتغيير شكل المسار؛ انقر نقراً مزدوجاً على سلك لإضافة نقطة انحناء.", "Electric plan: draw at least 4 walls and add at least 1 light, switch or socket first": "مخطط الكهرباء: ارسم 4 جدران على الأقل وأضف إنارة أو مفتاحاً أو بريزاً واحداً على الأقل أولاً", "Electric plan: the home plan is locked.": "مخطط الكهرباء: مخطط البيت مقفل.", "Electric plan: the home plan is locked. Place the breaker panel, then draw wires with the Electric plan tools, starting at a light, switch, socket or the panel.": "مخطط الكهرباء: مخطط البيت مقفل. ضع لوحة القواطع ثم ارسم الأسلاك بأدوات مخطط الكهرباء، بدءاً من إنارة أو مفتاح أو بريز أو اللوحة.", "Electric plan: wires, conduits, breaker panel and solar, drawn over the home plan": "مخطط الكهرباء: الأسلاك والأنابيب ولوحة القواطع والطاقة الشمسية، مرسومة فوق مخطط البيت", "Electric storage": "كهربائي بخزان", "Electrical": "الكهرباء", "Electrical layer hidden.": "طبقة الكهرباء مخفية.", "Electrical layer shown.": "طبقة الكهرباء ظاهرة.", "Elevation": "الواجهة", "Elevations": "الواجهات", "Empty = in the ceiling": "فارغ = في السقف", "End cap": "سدادة نهاية", "Ends": "الأطراف", "English": "English", "Equipment": "المعدات", "Eraser": "الممحاة", "Eraser for the imported picture (E)": "ممحاة للصورة المستوردة (E)", "Erasing undone": "تم التراجع عن المسح", "Everything under the plan removed. Ctrl+Z (or Undo) brings it back.": "أزيل كل ما تحت المخطط. Ctrl+Z (أو تراجع) يعيده.", "Exit": "خروج", "Exit Benchmark Planner?": "الخروج من Benchmark Planner؟", "Exit cancelled": "تم إلغاء الخروج", "Exit cancelled.": "تم إلغاء الخروج.", "Export": "تصدير", "Export DXF": "تصدير DXF", "Export failed:": "فشل التصدير:", "Export plan as PDF or image": "تصدير المخطط كـ PDF أو صورة", "Export plan as PDF or image…": "تصدير المخطط كـ PDF أو صورة…", "Export ready": "التصدير جاهز", "Export to AutoCAD": "تصدير إلى أوتوكاد", "Export to AutoCAD (DXF)…": "تصدير إلى أوتوكاد (DXF)…", "Exported": "تم التصدير:", "Fall over length": "الهبوط على الطول", "Faucet / mixer": "حنفية / خلاط", "Feed length": "طول كبل التغذية", "Feed size in": "مقطع التغذية بـ", "Feed size standard": "معيار مقطع التغذية", "Feeds": "يغذي", "Fence": "سياج", "Fence: draw like a wall": "سياج: ارسمه مثل الجدار", "File": "ملف", "Fill": "الامتلاء", "Fill time (minutes)": "زمن التعبئة (دقيقة)", "Fire pit": "موقد نار", "Fire pit shape": "شكل موقد النار", "First click both ends of a wall you know the length of.": "انقر أولاً على طرفي جدار تعرف طوله.", "Fit": "ملاءمة", "Fit to the sheet": "ملاءمة الورقة", "Fitting": "وصلة", "Fitting: elbow, tee, coupling, union, reducer…": "وصلة: كوع، تي، جلبة، رَكّور، مسلوب…", "Fittings": "الوصلات", "Fixture schedule": "جدول التجهيزات", "Fixtures": "الأدوات الصحية", "Flip curves": "عكس الانحناءات", "Flip swing side": "عكس جهة الفتح", "Floor": "الأرضية", "Floor drain": "مصرف أرضية (سيفون أرضي)", "Floor in 3D": "الأرضية في العرض ثلاثي الأبعاد", "Floor plan": "المسقط الأفقي", "Floor plan drawing": "رسم المسقط الأفقي", "For each breaker: its name, size (A), poles, type, and": "لكل قاطع: اسمه وقيمته (A) وأقطابه ونوعه و", "Format": "الصيغة", "Fountain": "نافورة", "Free move": "تحريك حر", "Friction": "فاقد الاحتكاك", "From": "من", "From face": "من الوجه", "From → to": "من ← إلى", "Full walls": "جدران كاملة", "Full walls to height": "جدران كاملة بالارتفاع", "Gangs": "عدد المفاتيح", "Garden": "الحديقة", "Garden bench": "مقعد حديقة", "Garden light": "إنارة حديقة", "Garden light: click where it stands": "إنارة حديقة: انقر حيث تقف", "Garden surfaces": "أرضيات الحديقة", "Garden wall": "سور حديقة", "Garden wall: draw like a wall": "سور حديقة: ارسمه مثل الجدار", "Gas instantaneous": "غاز فوري", "Go to room": "الانتقال إلى غرفة", "Go to room…": "الانتقال إلى غرفة…", "Gravel": "حصى", "Gravel: click its corners": "حصى: انقر على زواياه", "Gravity at worst fixture": "ضغط الجاذبية عند أسوأ أداة", "Grid": "الشبكة", "Grid supply": "تغذية الشبكة", "Grid supply / meter": "تغذية الشبكة / العدّاد", "Grid supply / meter: click on a wall": "تغذية الشبكة / العدّاد: انقر على جدار", "Ground": "الأرض", "Ground / underground": "أرضي / تحت الأرض", "HDPE underground": "HDPE تحت الأرض", "HEIC photos (the iPhone default) can't be read here. Share or export the photo as JPG first (on the iPhone: Settings → Camera → Formats → Most Compatible).": "لا يمكن قراءة صور HEIC (الافتراضية في آيفون) هنا. شارك الصورة أو صدّرها بصيغة JPG أولاً (في آيفون: الإعدادات ← الكاميرا ← التنسيقات ← الأكثر توافقاً).", "Hall": "ممر", "Hedge": "سياج نباتي", "Hedge: draw like a wall": "سياج نباتي: ارسمه مثل الجدار", "Height": "الارتفاع", "Height is the wall height unless you type one. The column drags freely and clicks against a wall face, flush with the far face or centred in the wall. Once placed, type its exact distance to each wall in Left, Right, Top and Bottom (negative sets it into the wall).": "الارتفاع هو ارتفاع الجدار ما لم تكتب غيره. العمود يُسحب بحرية ويلتصق بوجه الجدار أو بمحاذاة الوجه البعيد أو في منتصف الجدار. بعد وضعه اكتب مسافته الدقيقة إلى كل جدار في يسار ويمين وأعلى وأسفل (القيمة السالبة تدخله في الجدار).", "Height to centre": "الارتفاع حتى المركز", "Hide": "إخفاء", "Hide all": "إخفاء الكل", "Hide its info on the plan": "إخفاء معلوماته على المخطط", "Hide on plan": "إخفاء من المخطط", "Hide the room name": "إخفاء اسم الغرفة", "High": "عالية", "High (200 dpi)": "عالية (200 dpi)", "High — computers": "عالية — للحواسيب", "Hinged": "مفصلي", "Hinged, opens into the room": "مفصلي، يفتح نحو الغرفة", "Hot return": "راجع الساخن", "Hot tub": "جاكوزي", "Hot water": "مياه ساخنة", "Hot water pipe (red)": "أنبوب مياه ساخنة (أحمر)", "Hot water pipes are not connected to a water heater.": "أنابيب المياه الساخنة غير موصولة بسخان مياه.", "Hot water return": "راجع المياه الساخنة", "Hot water return pipe": "أنبوب راجع المياه الساخنة", "House (without the garden)": "البيت (بدون الحديقة)", "How would you like to start?": "كيف تريد أن تبدأ؟", "If the download did not start, open it and save it from the viewer.": "إذا لم يبدأ التنزيل افتحه واحفظه من العارض.", "If the download did not start, right-click the picture and choose Save image as.": "إذا لم يبدأ التنزيل انقر بالزر الأيمن على الصورة واختر حفظ الصورة باسم.", "If you close it without saving, the changes since it was last saved are lost.": "إذا أغلقته دون حفظ ستضيع التغييرات منذ آخر حفظ.", "Import": "استيراد", "Import from AutoCAD (DXF)…": "استيراد من أوتوكاد (DXF)…", "Import plan image or PDF…": "استيراد صورة مخطط أو PDF…", "Import plan:": "استيراد مخطط:", "Imported": "تم الاستيراد:", "Imported as a reference drawing. Trace it with the Wall tool; points snap to its line ends.": "استُورد كرسم مرجعي. ارسم فوقه بأداة الجدار؛ النقاط تلتقط أطراف خطوطه.", "In conduit": "في الأنبوب", "In the ceiling": "في السقف", "In the floor": "في الأرضية", "In the installed app it saves straight to a file.": "في التطبيق المثبّت يُحفظ مباشرة في ملف.", "Inside faces of the rooms": "الوجوه الداخلية للغرف", "Inside size": "القياس الداخلي", "Inspection chamber": "ريكار تفتيش", "Inspection chamber / sewer": "ريكار تفتيش / الصرف العام", "Inspection chamber / sewer connection": "ريكار تفتيش / وصلة الصرف العام", "Inspector": "الخصائص", "Inverter": "إنفرتر", "Inverter: click on a wall": "إنفرتر: انقر على جدار", "Isolator": "قاطع عزل", "It has changes that aren’t saved to a file yet. If you exit without saving, they are lost.": "فيه تغييرات لم تُحفظ في ملف بعد. إذا خرجت دون حفظ ستضيع.", "Item": "البند", "JPG image": "صورة JPG", "Join loose ends to walls they touch or to the nearest wall within reach": "وصل الأطراف المفكوكة بالجدران التي تلامسها أو بأقرب جدار قريب", "Joined or loose ends": "أطراف موصولة أو مفكوكة", "Junction box": "علبة تفريع", "Junction box: click where it goes": "علبة تفريع: انقر حيث توضع", "Keep fixed": "تثبيت", "Kept as a dimension. Select it with the Pointer to delete it.": "حُفظ كبُعد. حدده بالمؤشر لحذفه.", "Kept on this device": "محفوظ على هذا الجهاز", "Kept on this device · save to a file to autosave it": "محفوظ على هذا الجهاز · احفظه في ملف ليُحفظ تلقائياً", "Kept ruler dimensions": "أبعاد المسطرة المحفوظة", "Kept with the Ruler. It is saved with the project and exported to AutoCAD on layer A-ANNO-DIMS.": "محفوظ بالمسطرة. يُحفظ مع المشروع ويُصدَّر إلى أوتوكاد على الطبقة A-ANNO-DIMS.", "Kind": "النوع", "Kitchen": "مطبخ", "Kitchen 16 A 1P": "مطبخ 16 A 1P", "Kitchen sink": "مجلى المطبخ", "Label": "التسمية", "Landscape": "أفقي", "Language": "اللغة", "Language: English": "اللغة: الإنجليزية", "Large tiles 60×60": "بلاط كبير 60×60", "Laser": "الليزر", "Laser disconnected.": "انقطع اتصال الليزر.", "Laser measure: Bluetooth isn’t available in this browser": "متر الليزر: البلوتوث غير متاح في هذا المتصفح", "Laser reading cancelled.": "أُلغيت قراءة الليزر.", "Laser:": "الليزر:", "Lawn": "عشب", "Lawn: click its corners": "عشب: انقر على زواياه", "Left": "يسار", "Left joined": "اليسار موصول", "Length": "الطول", "Length of every wall": "طول كل جدار", "Lengths include the spare and the runs up and down to each part. The CSV opens in Excel with empty price columns.": "الأطوال تشمل الاحتياط والصعود والنزول إلى كل قطعة. ملف CSV يُفتح في إكسل مع أعمدة أسعار فارغة.", "Letter": "Letter", "Level": "الطابق", "Lift pump": "مضخة الرفع", "Lift pump head": "ارتفاع ضخ مضخة الرفع", "Lift pump power": "قدرة مضخة الرفع", "Light": "إنارة", "Light switch: click on a wall": "مفتاح إنارة: انقر على جدار", "Lights": "الإنارة", "Living": "صالون", "Look at the model from outside": "انظر إلى النموذج من الخارج", "Look ▾": "المظهر ▾", "Loose ends": "أطراف مفكوكة", "Low": "منخفضة", "Low — fastest, for phones": "منخفضة — الأسرع، للهواتف", "MC4 (solar)": "MC4 (شمسي)", "MCB": "MCB قاطع عادي", "Main breaker": "القاطع الرئيسي", "Main breaker 63 A": "القاطع الرئيسي 63 A", "Main feed cable 3-core": "كبل التغذية الرئيسي ثلاثي الشرائح", "Main feed wire": "كبل التغذية الرئيسي", "Main poles": "أقطاب الرئيسي", "Mains": "الشبكة العامة", "Mains fills a tank": "الشبكة تملأ خزاناً", "Mains pressure (bar)": "ضغط الشبكة (بار)", "Mains pressure (psi)": "ضغط الشبكة (psi)", "Mains → ground tank → pump → roof tank": "الشبكة ← خزان أرضي ← مضخة ← خزان السطح", "Make the strips parallel to their walls": "اجعل الشرائط موازية لجدرانها", "Material": "المادة", "Max water speed (ft/s)": "أقصى سرعة للمياه (قدم/ث)", "Max water speed (m/s)": "أقصى سرعة للمياه (م/ث)", "Measured area": "مساحة مقاسة", "Measured areas": "المساحات المقاسة", "Measurement only": "قياس فقط", "Measurements follow the": "القياسات تتبع قائمة", "Measures": "القياسات", "Measures ▾": "القياسات ▾", "Medium": "متوسطة", "Medium — tablets": "متوسطة — للأجهزة اللوحية", "Metal (EMT)": "معدني (EMT)", "Metric (EN)": "متري (EN)", "Mixer tap / faucet": "خلاط / حنفية", "Move": "تحريك", "Move away from the straight line to bend the wall, or use the Wall tool for a straight one.": "ابتعد عن الخط المستقيم لحني الجدار، أو استخدم أداة الجدار لجدار مستقيم.", "Move onto a wall and click where the copy goes.": "حرّك المؤشر إلى جدار وانقر حيث توضع النسخة.", "Move the column within 1.5 m of a wall first.": "قرّب العمود إلى مسافة 1.5 م من جدار أولاً.", "Name": "الاسم", "Name on plan": "الاسم على المخطط", "Name removed": "أزيل الاسم", "Name, e.g. Kitchen": "الاسم، مثلاً مطبخ", "Named wall": "جدار مسمّى", "Negative means the column is set into the wall by that much; blue bars mark sides that line up with a wall face. Type a distance to move the column there exactly. You can also drag it, nudge it with the arrow keys, or check any distance with the Ruler.": "القيمة السالبة تعني أن العمود داخل في الجدار بمقدارها؛ الخطوط الزرقاء تشير إلى الجهات المحاذية لوجه جدار. اكتب مسافة لنقل العمود إليها بدقة. يمكنك أيضاً سحبه أو إزاحته بمفاتيح الأسهم أو التحقق من أي مسافة بالمسطرة.", "Net floor area": "المساحة الصافية للأرضيات", "New ac wire": "سلك AC جديد", "New bathtub": "بانيو جديد", "New bidet": "شطّافة جديدة", "New breaker panel": "لوحة قواطع جديدة", "New cleanout": "فتحة تنظيف جديدة", "New cold water pipe": "أنبوب مياه باردة جديد", "New column / pillar": "عمود جديد", "New conduit": "أنبوب تمديد جديد", "New curved wall": "جدار منحني جديد", "New dc wire": "سلك DC جديد", "New dishwasher": "جلاية صحون جديدة", "New door": "باب جديد", "New drain / waste pipe": "أنبوب صرف جديد", "New faucet / mixer": "حنفية / خلاط جديد", "New fire pit": "موقد نار جديد", "New fitting": "وصلة جديدة", "New floor drain": "مصرف أرضية جديد", "New hot water pipe": "أنبوب مياه ساخنة جديد", "New hot water return pipe": "أنبوب راجع مياه ساخنة جديد", "New inspection chamber / sewer": "ريكار تفتيش جديد", "New kitchen sink": "مجلى مطبخ جديد", "New note": "ملاحظة جديدة", "New outdoor tap": "حنفية خارجية جديدة", "New pressure tank": "خزان ضغط جديد", "New project": "مشروع جديد", "New project in a new tab": "مشروع جديد في تبويب جديد", "New project…": "مشروع جديد…", "New pump": "مضخة جديدة", "New shower": "دوش جديد", "New spot light": "إنارة سبوت جديدة", "New stack / riser": "عمود صرف / صاعد جديد", "New strip light": "شريط إنارة جديد", "New switch": "مفتاح جديد", "New toilet (wc)": "مرحاض جديد", "New valve": "محبس جديد", "New vent pipe": "أنبوب تهوية جديد", "New vent terminal / aav": "نهاية تهوية / صمام هواء جديد", "New walls": "جدران جديدة", "New wash basin": "مغسلة جديدة", "New washing machine": "غسالة جديدة", "New water heater": "سخان مياه جديد", "New water meter / mains": "عداد مياه جديد", "New water tank": "خزان مياه جديد", "Night — room lights on": "ليل — إنارة الغرف مضاءة", "No lines, arcs or text were found in the model space of": "لم يُعثر على خطوط أو أقواس أو نصوص في فضاء النموذج لـ", "No rooms yet": "لا توجد غرف بعد", "No rooms yet.": "لا توجد غرف بعد.", "No tiling": "بدون تبليط", "No wall within 3 m of this strip.": "لا يوجد جدار ضمن 3 م من هذا الشريط.", "None": "لا شيء", "Not connected to a source yet": "غير موصول بمصدر بعد", "Not connected to an outlet yet": "غير موصول بمخرج بعد", "Not saved, so the app stays open": "لم يُحفظ، لذلك يبقى التطبيق مفتوحاً", "Not saved, so the app stays open.": "لم يُحفظ، لذلك يبقى التطبيق مفتوحاً.", "Note": "ملاحظة", "Nothing copied yet. Select something and press Ctrl+C.": "لم يُنسخ شيء بعد. حدد شيئاً واضغط Ctrl+C.", "Nothing left to erase under the plan.": "لم يبقَ شيء لمسحه تحت المخطط.", "Nothing to erase there. The eraser only removes what is drawn in red: what is left of the imported picture or drawing. To hide measurements use Measures; to delete a wall, door, fixture or text, select it with the Pointer and press Delete.": "لا يوجد ما يُمسح هنا. الممحاة تزيل فقط ما يظهر بالأحمر: ما تبقى من الصورة أو الرسم المستورد. لإخفاء القياسات استخدم القياسات؛ ولحذف جدار أو باب أو تجهيز أو نص حدده بالمؤشر واضغط Delete.", "Nothing to import": "لا يوجد ما يُستورد", "Nothing to import: every layer is set to Skip.": "لا يوجد ما يُستورد: كل الطبقات على تخطٍّ.", "Nothing to unsnap: these walls are not joined to others.": "لا يوجد ما يُفك: هذه الجدران غير موصولة بغيرها.", "Nothing was imported.": "لم يُستورد شيء.", "Nothing yet. Draw pipes and place equipment, and they are listed here with sizes and lengths.": "لا شيء بعد. ارسم الأنابيب وضع المعدات، وستظهر هنا بأقطارها وأطوالها.", "Nothing yet. Draw wires and place the panel, and they are listed here with sizes and lengths.": "لا شيء بعد. ارسم الأسلاك وضع اللوحة فتظهر هنا مع المقاطع والأطوال.", "Number of switches": "عدد المفاتيح", "OK": "موافق", "On": "مفعّل", "On the plan": "على المخطط", "One panel slides along the wall": "درفة واحدة تنزلق على طول الجدار", "Open a project": "فتح مشروع", "Open a project file…": "فتح ملف مشروع…", "Open in a new tab": "فتح في تبويب جديد", "Open projects": "المشاريع المفتوحة", "Open project…": "فتح مشروع…", "Open worksheet": "فتح ورقة العمل", "Opened": "تم فتح", "Opens in a new tab. Your other projects stay open.": "يُفتح في تبويب جديد. مشاريعك الأخرى تبقى مفتوحة.", "Or": "أو", "Orbit": "دوران", "Orientation": "الاتجاه", "Other": "أخرى", "Other side of the wall": "الجهة الأخرى من الجدار", "Outdoor": "خارجي", "Outdoor (weatherproof) socket: click on a wall": "بريز خارجي (مقاوم للماء): انقر على جدار", "Outdoor / garden tap": "حنفية خارجية / حديقة", "Outdoor socket": "بريز خارجي", "Outdoor tap": "حنفية خارجية", "Outlet height": "ارتفاع المخرج", "Outlets": "المخارج", "Outside wall dimensions": "أبعاد الجدران الخارجية", "PDF document": "مستند PDF", "PEX": "PEX", "PNG image": "صورة PNG", "PPR": "PPR", "PVC flexible": "PVC مرن", "PVC flexible conduit": "أنبوب PVC مرن", "PVC rigid": "PVC صلب", "Palm tree": "نخلة", "Pan": "تحريك العرض", "Panel": "اللوحة", "Panels": "الألواح", "Paper": "الورق", "Parallel to nearest wall": "موازٍ لأقرب جدار", "Paste": "لصق", "Paste here": "لصق هنا", "Paste the copied items (Ctrl+V)": "لصق العناصر المنسوخة (Ctrl+V)", "Pasted. Drag it to adjust, or press Ctrl+V to place another copy.": "تم اللصق. اسحبه للضبط، أو اضغط Ctrl+V لوضع نسخة أخرى.", "Patio": "فناء", "Patio paving": "تبليط الفناء", "Patio paving: click its corners": "تبليط الفناء: انقر على زواياه", "People (for the water heater)": "عدد الأشخاص (لسخان المياه)", "Per row": "في كل صف", "Pergola / shade": "برغولا / مظلة", "Perimeter": "المحيط", "Pick Wall (W) and click to start drawing": "اختر جدار (W) وانقر لبدء الرسم", "Pick Wall (W) and click to start drawing.": "اختر جدار (W) وانقر لبدء الرسم.", "Pipe lengths include the spare. Fittings are counted from the bends and joints in the drawing.": "أطوال الأنابيب تشمل الاحتياط. تُعدّ الوصلات من الانحناءات والتفرعات في الرسم.", "Pipes": "الأنابيب", "Plan": "المخطط", "Plan + 3D": "المخطط + 3D", "Plan · Level 1": "المخطط · الطابق 1", "Plan: the pipes drawn on the home plan; these are calculated.": "المخطط: الأنابيب المرسومة على مخطط البيت؛ وهذه تُحسب.", "Planter": "حوض نباتات", "Planting bed": "مسكبة زراعة", "Planting bed: click its corners": "مسكبة زراعة: انقر على زواياها", "Plugs": "البرايز", "Plumbing": "التمديدات الصحية", "Plumbing info": "معلومات التمديدات الصحية", "Plumbing plan": "مخطط التمديدات الصحية", "Plumbing plan: cold and hot water, drains and vents, pumps and heaters, drawn over the home plan": "مخطط التمديدات الصحية: المياه الباردة والساخنة، الصرف والتهوية، المضخات والسخانات، مرسومة فوق مخطط البيت", "Plumbing plan: the home plan is locked. Place a water meter (or tank and pump), then draw cold and hot pipes to the fixtures, and drains to a stack.": "مخطط التمديدات الصحية: مخطط البيت مقفل. ضع عداد مياه (أو خزاناً ومضخة)، ثم ارسم الأنابيب الباردة والساخنة إلى الأدوات الصحية، والصرف إلى عمود صرف.", "Plumbing worksheet": "ورقة عمل التمديدات الصحية", "Pointer": "المؤشر", "Pointer (V)": "المؤشر (V)", "Pointer: select and edit pipes, fixtures and equipment (V)": "المؤشر: تحديد وتعديل الأنابيب والأدوات الصحية والمعدات (V)", "Pointer: select and edit wires, conduits and parts (V)": "المؤشر: تحديد الأسلاك والأنابيب والقطع وتعديلها (V)", "Poles": "الأقطاب", "Polished concrete": "بيتون مصقول", "Pool / water": "مسبح / ماء", "Pool or pond: click its corners": "مسبح أو بركة: انقر على زواياه", "Portrait": "عمودي", "Power (kW)": "الاستطاعة (kW)", "Preparing…": "جارٍ التحضير…", "Press Ctrl+V, or Paste on the plan, then click where it goes.": "اضغط Ctrl+V أو لصق على المخطط، ثم انقر حيث يوضع.", "Press Read first to draw a wall with it.": "اضغط قراءة أولاً لرسم جدار به.", "Press Read, then measure.": "اضغط قراءة ثم قِس.", "Pressure needed at fixtures (bar)": "الضغط المطلوب عند الأدوات (بار)", "Pressure needed at fixtures (psi)": "الضغط المطلوب عند الأدوات (psi)", "Pressure reducing valve": "صمام تخفيض ضغط", "Pressure tank": "خزان ضغط", "Preview of the sheet": "معاينة الورقة", "Print (300 dpi)": "طباعة (300 dpi)", "Project": "المشروع", "Project name": "اسم المشروع", "Properties…": "الخصائص…", "Pump": "مضخة", "Pump lift, ground to roof tank (ft)": "رفع المضخة، من الأرض إلى خزان السطح (قدم)", "Pump lift, ground to roof tank (m)": "رفع المضخة، من الأرض إلى خزان السطح (م)", "Qty": "الكمية", "Quality": "الجودة", "Quality and light": "الجودة والإضاءة", "RCBO": "RCBO قاطع تسرب مع حماية", "RCD": "RCD قاطع تسرب", "REF": "براد", "Radius": "نصف القطر", "Railing": "درابزين", "Railing: draw like a wall": "درابزين: ارسمه مثل الجدار", "Range": "غاز", "Rating": "القيمة", "Read wall length": "قراءة طول الجدار", "Reading the PDF…": "جارٍ قراءة ملف PDF…", "Recent projects": "المشاريع الأخيرة", "Recommended": "الموصى به", "Recover unsaved work": "استعادة العمل غير المحفوظ", "Rectangular": "مستطيل", "Redo": "إعادة", "Redo (Ctrl+Shift+Z)": "إعادة (Ctrl+Shift+Z)", "Reducer": "مسلوب", "Reference": "المرجع", "Reference removed": "أزيل المرجع", "Refrigerator": "براد", "Remove": "إزالة", "Remove breaker": "إزالة القاطع", "Remove reference drawing or image": "إزالة الرسم أو الصورة المرجعية", "Remove the reference?": "إزالة المرجع؟", "Remove the room from the plan and the takeoff; its walls stay (Del)": "إزالة الغرفة من المخطط وحصر الكميات؛ تبقى جدرانها (Del)", "Reset 0°": "إعادة إلى 0°", "Right": "يمين", "Right joined": "اليمين موصول", "Riser pipe length (ft)": "طول أنبوب الصاعد (قدم)", "Riser pipe length (m)": "طول أنبوب الصاعد (م)", "Roof": "السطح", "Roof tank (L)": "خزان السطح (لتر)", "Roof tank above this floor (ft)": "ارتفاع خزان السطح فوق هذا الطابق (قدم)", "Roof tank above this floor (m)": "ارتفاع خزان السطح فوق هذا الطابق (م)", "Room": "غرفة", "Room areas and sizes": "مساحات الغرف وأبعادها", "Room names": "أسماء الغرف", "Room type": "نوع الغرفة", "Rotate": "تدوير", "Rotate 90°": "تدوير 90°", "Rotate 90° back": "تدوير 90° للخلف", "Rotation": "الدوران", "Round": "دائري", "Ruler": "المسطرة", "Ruler (L)": "المسطرة (L)", "Runs": "يمر", "Save": "حفظ", "Save as CSV": "حفظ بصيغة CSV", "Save project": "حفظ المشروع", "Save project as…": "حفظ المشروع باسم…", "Saved": "حُفظ", "Saved today,": "حُفظ اليوم،", "Saved yesterday,": "حُفظ أمس،", "Saves an AutoCAD R12 DXF, which every version of AutoCAD opens directly, as do BricsCAD, DraftSight, LibreCAD, ArchiCAD and Revit. Walls are drawn as clean outlines on layer A-WALL, with doors, windows, fixtures, labels and dimensions on their own layers.": "يحفظ ملف DXF بصيغة AutoCAD R12 تفتحه كل إصدارات أوتوكاد مباشرة، وكذلك BricsCAD وDraftSight وLibreCAD وArchiCAD وRevit. الجدران تُرسم كحدود نظيفة على الطبقة A-WALL، والأبواب والشبابيك والتجهيزات والتسميات والأبعاد على طبقاتها الخاصة.", "Saves the plan on a sheet of paper, ready to print, email or put in a report.": "يحفظ المخطط على ورقة جاهزة للطباعة أو الإرسال بالبريد أو الإدراج في تقرير.", "Scale": "المقياس", "Schematic": "المخطط التخطيطي", "Schematic: a blank sheet to draw the schematic by hand with the same tools. It is not used in the calculations.": "المخطط التخطيطي: ورقة فارغة لرسم المخطط يدوياً بالأدوات نفسها. لا تدخل في الحسابات.", "Search again": "البحث مجدداً", "Select a wall, column, fixture, door, window, dimension, light, switch, socket or room to copy.": "حدد جداراً أو عموداً أو تجهيزاً أو باباً أو شباكاً أو بُعداً أو إنارة أو مفتاحاً أو بريزاً أو غرفة لنسخها.", "Select a wall, opening, fixture or room to edit it. Every length field takes typed values like": "حدد جداراً أو فتحة أو تجهيزاً أو غرفة لتعديلها. كل حقل طول يقبل قيماً مكتوبة مثل", "Select all and copy.": "حدد الكل وانسخ.", "Set the scale from one wall, check the walls found (shown in blue), then import. The image stays under the plan so you can trace anything that was missed.": "حدد المقياس من جدار واحد، وتحقق من الجدران المكتشفة (بالأزرق)، ثم استورد. تبقى الصورة تحت المخطط لترسم فوق ما فات.", "Set the size and angle in the side panel, then click to place. It drags freely and clicks against a wall face, the far face or the wall centre; live dimensions show the distances.": "حدد القياس والزاوية في اللوحة الجانبية ثم انقر لوضعه. يُسحب بحرية ويلتصق بوجه الجدار أو الوجه البعيد أو منتصف الجدار؛ الأبعاد الحية تُظهر المسافات.", "Shape": "الشكل", "Sheet": "الورقة", "Show all": "إظهار الكل", "Show elevations": "إظهار الواجهات", "Show its info on the plan": "إظهار معلوماته على المخطط", "Show on the plan": "إظهار على المخطط", "Show or hide the electrical layer: lights, switches and sockets": "إظهار أو إخفاء طبقة الكهرباء: الإنارة والمفاتيح والبرايز", "Show or hide the imported reference drawing": "إظهار أو إخفاء الرسم المرجعي المستورد", "Show the electric plan faded over the home plan, or hide it": "إظهار مخطط الكهرباء باهتاً فوق مخطط البيت أو إخفاؤه", "Show the plumbing plan faded over the home plan, or hide it": "إظهار مخطط التمديدات الصحية باهتاً فوق مخطط البيت، أو إخفاؤه", "Show the room name": "إظهار اسم الغرفة", "Shower": "دوش", "Shower tray": "قاعدة دوش", "Shrub": "شجيرة", "Sill height": "ارتفاع الجلسة", "Single": "مفرد", "Single or double": "مفرد أو مزدوج", "Sink base": "خزانة المجلى", "Size": "المقطع", "Size in": "المقطع بـ", "Size standard": "معيار المقطع", "Skirt.": "نعلات", "Skirting": "النعلات", "Slide the other way": "الانزلاق بالاتجاه المعاكس", "Sliding door": "باب منزلق", "Sliding door, 1 panel": "باب جرّار، درفة واحدة", "Sliding door, 2 panels": "باب جرّار، درفتان", "Sliding doors": "أبواب جرّارة", "Sliding, 1 panel": "منزلق، درفة واحدة", "Sliding, 2 panels": "منزلق، درفتان", "Slope (%)": "الميل (%)", "Slope (in/ft)": "الميل (إنش/قدم)", "Snap": "الالتقاط", "Snap ends": "التقاط الأطراف", "Snap off": "الالتقاط معطّل", "Snap on": "الالتقاط مفعّل", "Snap to wall ends, alignments, angles and a 10 mm grid (S)": "الالتقاط بأطراف الجدران والمحاذاة والزوايا وشبكة 10 مم (S)", "Socket": "بريز", "Socket outlets": "مخارج البرايز", "Socket: click on a wall": "بريز: انقر على جدار", "Soil / waste stack": "عمود صرف", "Solar": "الطاقة الشمسية", "Solar breaker": "قاطع شمسي", "Solar panel": "لوح شمسي", "Solar panels": "ألواح شمسية", "Solar panels: click where the array goes": "ألواح شمسية: انقر حيث توضع المجموعة", "Solar with tank": "شمسي مع خزان", "Spare": "الاحتياط", "Speed": "السرعة", "Spot light": "إنارة سبوت", "Spot light already has its wire (one wire per spot light)": "إنارة السبوت لها سلكها مسبقاً (سلك واحد لكل إنارة سبوت)", "Spot light: click where it goes on the ceiling": "إنارة سبوت: انقر حيث توضع في السقف", "Spot lights": "إنارات سبوت", "Square / rect": "مربع / مستطيل", "Stack / riser": "عمود صرف / صاعد", "Stack or riser": "عمود صرف أو صاعد", "Standard": "المعيار", "Standard (150 dpi)": "عادية (150 dpi)", "Start a new plan from scratch": "ابدأ مخططاً جديداً من الصفر", "Start a new plan from scratch.": "ابدأ مخططاً جديداً من الصفر.", "Start from the sample": "البدء من المثال", "Start with an example": "البدء بمثال", "Statistics": "الإحصائيات", "Statistics: areas of house, garden, walls, windows and doors…": "الإحصائيات: مساحات البيت والحديقة والجدران والشبابيك والأبواب…", "Statistics…": "الإحصائيات…", "Stone": "حجر", "Straight": "مستقيم", "Strip light": "شريط إنارة", "Strip light already has a wire on both ends": "شريط الإنارة له سلك على طرفيه مسبقاً", "Strip light: click its start and end": "شريط إنارة: انقر على بدايته ونهايته", "Strip lights": "شرائط الإنارة", "Strip turned parallel to the wall.": "أصبح الشريط موازياً للجدار.", "Style": "النمط", "Suggested": "المقترح", "Sun lounger": "كرسي تشمّس", "Supply": "التغذية", "Supply riser": "صاعد التغذية", "Surface": "السطح", "Swap hinge": "عكس المفصلة", "Swing door": "باب مفصلي", "Swing set": "أرجوحة", "Switch": "مفتاح", "Switch gangs": "عدد المفاتيح", "Switches": "المفاتيح", "Tabloid": "Tabloid", "Take one measurement on the laser. The wall is drawn as soon as it arrives.": "خذ قياساً واحداً بالليزر. يُرسم الجدار فور وصوله.", "Takeoff": "حصر الكميات", "Takeoff CSV": "حصر الكميات CSV", "Tall cabinet": "خزانة طولية", "Tap the plan at the inside corner where the wall starts.": "انقر على المخطط عند الزاوية الداخلية حيث يبدأ الجدار.", "Tee": "تي", "Terminal block": "ترمينال (مربط)", "Text": "نص", "Text (T)": "نص (T)", "Text size": "حجم النص", "That bend is more than the edge is long.": "هذا الانحناء أكبر من طول الضلع.", "That text is now yours: drag it, change it, or press Delete.": "أصبح هذا النص لك: اسحبه أو غيّره أو اضغط Delete.", "The PDF reader could not be loaded. Check the internet connection, or export the page as a PNG or JPG image and import that.": "تعذر تحميل قارئ PDF. تحقق من الاتصال بالإنترنت، أو صدّر الصفحة كصورة PNG أو JPG واستوردها.", "The PDF reader did not load.": "لم يُحمَّل قارئ PDF.", "The app will start with them next time too.": "وسيبدأ التطبيق بها في المرة القادمة أيضاً.", "The file is damaged near line": "الملف تالف قرب السطر", "The home plan and its lights, switches and sockets are locked here. Pick a wiring tool on the left, or select a wire, conduit or part to edit it. Double-click a wire to add a bend point.": "مخطط البيت وإناراته ومفاتيحه وبرايزه مقفلة هنا. اختر أداة تمديد من لوحة الأدوات، أو حدد سلكاً أو أنبوباً أو قطعة لتعديلها. انقر نقراً مزدوجاً على سلك لإضافة نقطة انحناء.", "The image is empty or too small.": "الصورة فارغة أو صغيرة جداً.", "The imported drawing or plan image under the plan is removed. Walls, doors and windows you have are kept.": "أزيل الرسم المستورد أو صورة المخطط من تحت المخطط. الجدران والأبواب والشبابيك تبقى.", "The laser didn’t answer": "الليزر لم يستجب", "The laser didn’t answer, trying again": "الليزر لم يستجب، جارٍ المحاولة مجدداً", "The laser disconnected. Press Laser to connect again.": "انقطع الليزر. اضغط الليزر للاتصال مجدداً.", "The laser was found but the connection didn’t finish. Check that the Bosch app is closed and Bluetooth is on in the laser’s menu, then try again. If it keeps failing, copy this and send it to whoever set up the app — it shows exactly what the laser offers.": "وُجد الليزر لكن الاتصال لم يكتمل. تأكد أن تطبيق Bosch مغلق وأن البلوتوث مفعّل في قائمة الليزر ثم حاول مجدداً. إذا استمر الفشل انسخ هذا وأرسله لمن أعدّ التطبيق — فهو يبيّن بالضبط ما يقدمه الليزر.", "The last project you worked on": "آخر مشروع عملت عليه", "The plan image is placed to scale under the drawing. Trace it with the Wall tool.": "وُضعت صورة المخطط بالمقياس تحت الرسم. ارسم فوقها بأداة الجدار.", "The plan image is too large to keep between sessions here. Save the project to keep it.": "صورة المخطط أكبر من أن تُحفظ بين الجلسات هنا. احفظ المشروع للاحتفاظ بها.", "The plan image is underneath; trace anything missed with the Wall tool.": "صورة المخطط تحته؛ ارسم فوق ما فات بأداة الجدار.", "The reference drawing is too large to keep between sessions here. Save the project to keep it.": "الرسم المرجعي أكبر من أن يُحفظ بين الجلسات هنا. احفظ المشروع للاحتفاظ به.", "The rest is a reference drawing.": "والباقي رسم مرجعي.", "The run is drawn as a smooth curve through your points; switch it to straight lines in its panel. Size, cores and route are set in its panel afterwards.": "يُرسم المسار منحنياً ناعماً عبر نقاطك؛ حوّله إلى خطوط مستقيمة من لوحته. المقطع والشرائح والمسار تُضبط من لوحته بعد ذلك.", "The schematic sheet is not calculated; switch to Plan for sizes and the pump.": "ورقة المخطط التخطيطي لا تُحسب؛ انتقل إلى المخطط لمعرفة الأقطار والمضخة.", "The size is worked out from what the pipe feeds (Auto); you can set it yourself in its panel.": "يُحسب القطر مما يغذيه الأنبوب (تلقائي)؛ ويمكنك تحديده بنفسك في لوحته.", "The walls from the picture are underneath; trace anything missed with the Wall tool.": "جدران الصورة تحته؛ ارسم فوق ما فات بأداة الجدار.", "There is no imported picture or drawing under the plan to erase.": "لا توجد صورة أو رسم مستورد تحت المخطط لمسحه.", "There is no room for a door at that spot.": "لا يتسع المكان لباب في هذه النقطة.", "There is no room for a window at that spot.": "لا يتسع المكان لشباك في هذه النقطة.", "There is nothing imported under the plan to erase.": "لا يوجد شيء مستورد تحت المخطط لمسحه.", "There is nothing on the plan to export yet.": "لا يوجد شيء على المخطط للتصدير بعد.", "Thermostatic mixing valve": "صمام خلط ثرموستاتي", "Thickness": "السماكة", "This PDF is password protected. Open it, print or save it without a password, and import that.": "ملف PDF هذا محمي بكلمة سر. افتحه واطبعه أو احفظه دون كلمة سر واستورده.", "This file is not an image or a PDF. Use PNG, JPG, WebP, GIF, BMP or PDF.": "هذا الملف ليس صورة ولا PDF. استخدم PNG أو JPG أو WebP أو GIF أو BMP أو PDF.", "This floor above the supply (ft)": "ارتفاع هذا الطابق فوق التغذية (قدم)", "This floor above the supply (m)": "ارتفاع هذا الطابق فوق التغذية (م)", "This image could not be read. Save it again as PNG or JPG and try once more.": "تعذرت قراءة هذه الصورة. احفظها مجدداً بصيغة PNG أو JPG وحاول مرة أخرى.", "This is a binary DXF. Save it from AutoCAD as an ASCII DXF and import that.": "هذا ملف DXF ثنائي. احفظه من أوتوكاد بصيغة ASCII DXF واستورده.", "This is an AutoCAD drawing. Use File → Import from AutoCAD (DXF) instead; it gives exact walls without needing a scale.": "هذا رسم أوتوكاد. استخدم ملف ← استيراد من أوتوكاد (DXF) بدلاً من ذلك؛ يعطي جدراناً دقيقة دون حاجة لمقياس.", "This is an example flat. Change anything, or press + for a new project.": "هذه شقة كمثال. غيّر ما تشاء، أو اضغط + لمشروع جديد.", "This is not a DXF file.": "هذا ليس ملف DXF.", "This page can’t use Bluetooth. To connect the Bosch laser, use the installed Android or Windows app, or the web version opened directly in Chrome or Edge (not inside another page such as this preview).": "هذه الصفحة لا تستطيع استخدام البلوتوث. لتوصيل ليزر Bosch استخدم التطبيق المثبّت على أندرويد أو ويندوز، أو نسخة الويب مفتوحة مباشرة في Chrome أو Edge (وليس داخل صفحة أخرى مثل هذه المعاينة).", "Through the roof": "عبر السطح", "Tile": "البلاط", "Tiles 30×30": "بلاط 30×30", "Tiling": "التبليط", "Title block with name, date, scale and scale bar": "ترويسة بالاسم والتاريخ والمقياس ومسطرة المقياس", "To": "إلى", "Toilet": "مرحاض", "Toilet (WC)": "مرحاض", "Tools": "الأدوات", "Top": "أعلى", "Total": "المجموع", "Total length": "الطول الكلي", "Trap connection": "وصلة سيفون", "Tree": "شجرة", "Try again": "حاول مجدداً", "Turn (°)": "الدوران (°)", "Turn 15° anticlockwise": "تدوير 15° عكس عقارب الساعة", "Turn 15° clockwise": "تدوير 15° مع عقارب الساعة", "Turn 90° anticlockwise": "تدوير 90° عكس عقارب الساعة", "Turn 90° clockwise": "تدوير 90° مع عقارب الساعة", "Turn by": "تدوير بمقدار", "Turn it about its middle to run parallel to the nearest wall": "دوّره حول منتصفه ليصبح موازياً لأقرب جدار", "Turn on Electrical (above the plan) to use the electrical tools.": "فعّل الكهرباء (فوق المخطط) لاستخدام أدوات الكهرباء.", "Two panels, opens in the middle": "درفتان، يفتح من المنتصف", "Type": "النوع", "Type a length, e.g. 3600.": "اكتب طولاً، مثلاً 3600.", "Type an angle in degrees, e.g. 90, then press Draw.": "اكتب زاوية بالدرجات، مثلاً 90، ثم اضغط رسم.", "Type length": "اكتب الطول", "Type the real length of the wall you marked.": "اكتب الطول الحقيقي للجدار الذي حددته.", "US (IPC)": "أمريكي (IPC)", "Umbrella": "شمسية", "Underground": "تحت الأرض", "Undo": "تراجع", "Undo (Ctrl+Z)": "تراجع (Ctrl+Z)", "Undo erase": "تراجع عن المسح", "Unfolded wall elevations of the selected room": "واجهات جدران الغرفة المحددة مفرودة", "Union": "رَكّور", "Unit price": "سعر الوحدة", "Units": "الوحدات", "Units:": "الوحدات:", "Units: mm. The app will start with them next time too.": "الوحدات: مم. وسيبدأ التطبيق بها في المرة القادمة أيضاً.", "Unsnap from others": "فك عن الجدران الأخرى", "Unsnap wall": "فك الجدار", "Untitled project": "مشروع بدون اسم", "Up / down": "صعود / نزول", "Up/down": "صعود/نزول", "Valve": "محبس", "Valves": "المحابس", "Valves, fittings and drainage": "المحابس والوصلات والصرف", "Vanity": "مغسلة", "Vent": "تهوية", "Vent connection": "وصلة تهوية", "Vent pipe": "أنبوب تهوية", "Vent stack": "عمود تهوية", "Vent terminal": "نهاية تهوية", "Vent terminal / AAV": "نهاية تهوية / صمام هواء", "Vent terminal or air admittance valve": "نهاية تهوية أو صمام إدخال هواء", "View": "العرض", "Volts": "الفولت", "Volts DC": "فولت DC", "Wago lever": "وصلة واغو", "Walk": "تجوّل", "Walk inside": "تجوّل في الداخل", "Walk inside at eye level (or double-click a floor)": "تجوّل في الداخل بمستوى النظر (أو انقر نقراً مزدوجاً على أرضية)", "Walk inside this room in 3D": "تجوّل داخل هذه الغرفة ثلاثياً", "Wall": "جدار", "Wall (W)": "جدار (W)", "Wall (building)": "جدار (بناء)", "Wall cabinet": "خزانة علوية", "Wall elbow / tap connector": "كوع حائط / وصلة حنفية", "Wall elevations": "واجهات الجدران", "Wall height in 3D": "ارتفاع الجدران ثلاثياً", "Wall light": "أبليك (إنارة جدارية)", "Wall light: click on a wall": "أبليك: انقر على جدار", "Wall surface": "سطح الجدران", "Wall tile": "بلاط الجدران", "Wall type": "نوع الجدار", "Walls": "الجدران", "Walls and unclosed spaces": "الجدران والفراغات غير المغلقة", "Walls of the house": "جدران البيت", "Wash basin": "مغسلة", "Washing machine": "غسالة", "Waste flow": "تدفق الصرف", "Water": "المياه", "Water heater": "سخان مياه", "Water meter": "عداد المياه", "Water meter / mains": "عداد المياه / الشبكة", "Water meter / mains connection": "عداد المياه / وصلة الشبكة", "Water supply": "التغذية بالمياه", "Water tank": "خزان مياه", "Water tank (roof or ground)": "خزان مياه (سطح أو أرضي)", "Watts each": "واط لكل لوح", "Welcome back": "أهلاً بعودتك", "Welcome to Benchmark Planner": "أهلاً بك في Benchmark Planner", "What this breaker feeds": "ما يغذّيه هذا القاطع", "Where": "الموقع", "Which end stays put when the length changes": "أي طرف يبقى ثابتاً عند تغيير الطول", "While drawing, selecting and moving": "أثناء الرسم والتحديد والتحريك", "White paper": "ورق أبيض", "Width": "العرض", "Window": "شباك", "Window (N)": "شباك (N)", "Window area": "مساحة الشبابيك", "Windows": "الشبابيك", "Wire": "سلك", "Wire nut": "وصلة لولبية", "Wire runs": "مسارات الأسلاك", "Wire size standard": "معيار مقطع السلك", "Wire sizes": "مقاطع الأسلاك", "Wire, conduit and part info": "معلومات الأسلاك والأنابيب والقطع", "Wires": "الأسلاك", "Wires inside": "الأسلاك بداخله", "Wiring": "التمديدات", "With 10% spare": "مع 10% احتياط", "With doors and windows": "مع الأبواب والشبابيك", "With gates": "مع البوابات", "Without doors and windows": "بدون الأبواب والشبابيك", "Without gates": "بدون البوابات", "Wood planks": "ألواح خشب", "Worksheet": "ورقة العمل", "Y-branch / tee": "تفرّع Y / تي", "Yard inside the fences": "الفناء داخل الأسوار", "Yard wall": "جدار الفناء", "Yard walls": "أسوار الحديقة", "Your work was saved automatically.": "حُفظ عملك تلقائياً.", "Zoom": "تكبير", "Zoom in": "تكبير", "Zoom in (+)": "تكبير (+)", "Zoom out": "تصغير", "Zoom out (−)": "تصغير (−)", "Zoom to fit": "ملاءمة المخطط للشاشة", "Zoom to fit (F)": "ملاءمة العرض (F)", "autosave every 5 min": "حفظ تلقائي كل 5 دقائق", "backsplash": "خلف المجلى", "ball": "كروي", "bend point": "نقطة انحناء", "breakers": "قواطع", "cancels.": "للإلغاء.", "check": "عدم رجوع", "clears.": "للمسح.", "cold": "بارد", "deletes them.": "لحذفها.", "double": "مزدوج", "drawn — the room is closed. Press Read to start a new run.": "رُسم — الغرفة مغلقة. اضغط قراءة لبدء سلسلة جديدة.", "drawn. Press Read for the next wall.": "رُسم. اضغط قراءة للجدار التالي.", "e.g. Back fence": "مثال: السياج الخلفي", "e.g. Bay window wall": "مثال: جدار الشرفة", "e.g. Entrance pillar": "مثال: عمود المدخل", "e.g. Garden door": "مثال: باب الحديقة", "e.g. Guest bed": "مثال: سرير الضيوف", "e.g. Kitchen window": "مثال: شباك المطبخ", "e.g. L1 or circuit": "مثلاً L1 أو الدارة", "e.g. North wall": "مثال: الجدار الشمالي", "electric": "كهربائي", "electrical part": "قطعة كهربائية", "electrical parts": "قطع كهربائية", "fences and garden walls, less the house": "الأسوار وجدران الحديقة، بعد طرح البيت", "free end": "طرف حر", "ft-in": "قدم-إنش", "gas": "غاز", "ground": "أرضي", "hidden. It is still in the takeoff; click its row there to show it again.": "مخفية. ما زالت في حصر الكميات؛ انقر على سطرها هناك لإظهارها مجدداً.", "hot + cold": "ساخن + بارد", "inside the rooms": "داخل الغرف", "is already open.": "مفتوح مسبقاً.", "joins a wall end": "يتصل بطرف جدار", "lawn, paving, deck, gravel, pool and beds": "عشب، بلاط، أرضية خشبية، حصى، مسبح وأحواض زراعة", "mixed": "مختلط", "mixing": "خلط", "move onto a wall": "حرّكه إلى جدار", "names, sizes, lengths and breakers. Off hides it all; a selected item can still show its own (in its panel)": "الأسماء والمقاطع والأطوال والقواطع. الإطفاء يخفيها كلها؛ ويبقى بإمكان العنصر المحدد إظهار معلوماته (من لوحته)", "new bend point": "نقطة انحناء جديدة", "off hides plain measurements completely; yard surfaces and room areas keep their colour": "الإطفاء يخفي القياسات العادية كلياً؛ وتبقى أسطح الحديقة ومساحات الغرف بألوانها", "on wall": "على الجدار", "or": "أو", "outside of the walls, walls included": "من الوجه الخارجي للجدران، شاملة الجدران", "parallel to wall": "موازٍ للجدار", "per core": "لكل شريحة", "pipe names, sizes, slopes and lengths; equipment details": "أسماء الأنابيب وأقطارها وميولها وأطوالها؛ تفاصيل المعدات", "plan studio · prototype": "استوديو المخططات · نسخة تجريبية", "removed from the plan and the takeoff. Its walls stay. Ctrl+Z, or Restore under Takeoff, brings it back.": "أزيلت من المخطط وحصر الكميات. تبقى جدرانها. Ctrl+Z أو استعادة تحت حصر الكميات يعيدها.", "roof": "السطح", "solar": "شمسي", "this is not a Benchmark project file": "هذا ليس ملف مشروع Benchmark", "tile": "بلاط", "turned parallel to the nearest wall.": "أصبحت موازية لأقرب جدار.", "unsaved changes": "تغييرات غير محفوظة", "wall": "جدار", "wall lengths, distances of doors, windows and columns": "أطوال الجدران ومسافات الأبواب والشبابيك والأعمدة", "wall-mounted parts had no wall to sit on there and were left out.": "قطع جدارية لم تجد جداراً هناك فتُركت.", "walls": "جدران", "wires": "أسلاك", "without doors and windows, for paint and plaster": "بدون الأبواب والشبابيك، للدهان والتلبيس", "— none —": "— لا شيء —", "— not set —": "— غير محدد —"};
const AR_HTML={"<b>Breakers</b>: click the breaker panel (DB) on the plan with the Pointer; its breakers (name, size, poles, type, and the junction box each one feeds) are listed here. Names, sizes and lengths on the plan: <b>Measures</b> menu › Electric plan.": "<b>القواطع</b>: انقر بالمؤشر على لوحة القواطع (DB) في المخطط؛ تظهر قواطعها هنا (الاسم والقيمة والأقطاب والنوع وعلبة التفريع التي يغذيها كل قاطع). الأسماء والمقاطع والأطوال على المخطط: قائمة <b>القياسات</b> › مخطط الكهرباء.", "<kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> or arrows to walk · drag to look · <kbd>Shift</kbd> faster · <kbd>Esc</kbd> stops": "<kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> أو الأسهم للمشي · اسحب للنظر · <kbd>Shift</kbd> أسرع · <kbd>Esc</kbd> للتوقف", "Back to the home plan: press <b>Plan</b> (or any view) above.": "للعودة إلى مخطط البيت اضغط <b>المخطط</b> (أو أي عرض آخر) في الأعلى.", "Benchmark <small>plan studio · prototype</small>": "Benchmark <small>استوديو المخططات · نسخة تجريبية</small>", "Click on a wall to place it. Change the swing side and hinge afterwards in its side panel. Placed doors can switch type with <b>Type</b> in their side panel.": "انقر على جدار لوضعه. غيّر جهة الفتح والمفصلات لاحقاً من لوحته الجانبية. يمكن تغيير نوع الأبواب الموضوعة من <b>النوع</b> في لوحتها الجانبية.", "Click on the plan where the text goes, type, and press <kbd>Enter</kbd> (<kbd>Shift+Enter</kbd> for a new line, <kbd>Esc</kbd> to cancel).<br><br>Click an existing text to change it.<br><br>To move or delete any text, use the Pointer: drag it, or select it and press <kbd>Delete</kbd>. Room names can be dragged too.": "انقر على المخطط حيث يوضع النص، واكتب، ثم اضغط <kbd>Enter</kbd> (<kbd>Shift+Enter</kbd> لسطر جديد، و<kbd>Esc</kbd> للإلغاء).<br><br>انقر على نص موجود لتعديله.<br><br>لتحريك أي نص أو حذفه استخدم المؤشر: اسحبه، أو حدده واضغط <kbd>Delete</kbd>. ويمكن سحب أسماء الغرف أيضاً.", "Click the corners of any shape; click the first corner, double-click or press <kbd>Enter</kbd> to close. Double-click inside a room to take its outline, curved walls included. <kbd>Backspace</kbd> removes the last corner, <kbd>Esc</kbd> cancels.": "انقر على زوايا أي شكل؛ انقر على الزاوية الأولى أو انقر نقراً مزدوجاً أو اضغط <kbd>Enter</kbd> للإغلاق. انقر نقراً مزدوجاً داخل غرفة لأخذ حدودها مع الجدران المنحنية. <kbd>Backspace</kbd> يزيل آخر زاوية، <kbd>Esc</kbd> للإلغاء.", "Click the corners of the shape, one after another. Click the first corner again, double-click, or press <kbd>Enter</kbd> to close it.<br><br>Or <b>double-click inside a room</b> to take its outline, curved walls included.": "انقر على زوايا الشكل واحدة تلو الأخرى. انقر على الزاوية الأولى مجدداً، أو انقر نقراً مزدوجاً، أو اضغط <kbd>Enter</kbd> لإغلاقه.<br><br>أو <b>انقر نقراً مزدوجاً داخل غرفة</b> لأخذ حدودها، مع الجدران المنحنية.", "Click the start, then the end, then move out to set how far it bends and click (or type a radius and press <kbd>Enter</kbd>). Snaps to wall ends and a half circle; <kbd>Shift</kbd> bends freely. <kbd>Esc</kbd> cancels.": "انقر على البداية ثم النهاية، ثم ابتعد لتحديد مقدار الانحناء وانقر (أو اكتب نصف القطر واضغط <kbd>Enter</kbd>). يلتقط أطراف الجدران ونصف الدائرة؛ <kbd>Shift</kbd> للانحناء الحر. <kbd>Esc</kbd> للإلغاء.", "Click to place it. <kbd>Esc</kbd> goes back to the Pointer.": "انقر لوضعه. <kbd>Esc</kbd> للعودة إلى المؤشر.", "Click to start a pipe, click to add bends; end on a fixture, equipment or another pipe of the same kind (it makes a tee), or double-click / <kbd>Enter</kbd>. <kbd>Esc</kbd> cancels.": "انقر لبدء أنبوب، وانقر لإضافة انحناءات؛ أنهِه على أداة صحية أو معدة أو أنبوب آخر من النوع نفسه (تُعمل وصلة تي)، أو انقر نقراً مزدوجاً / <kbd>Enter</kbd>. <kbd>Esc</kbd> للإلغاء.", "Click to start a wall. Type a length and press <kbd>Enter</kbd> for an exact wall. Angles snap to 15° (hold <kbd>Shift</kbd> to free). <kbd>Esc</kbd> ends the run.": "انقر لبدء جدار. اكتب الطول واضغط <kbd>Enter</kbd> لجدار دقيق. الزوايا تلتقط كل 15° (اضغط <kbd>Shift</kbd> للتحرير). <kbd>Esc</kbd> لإنهاء السلسلة.", "Click to start, click to add bend points; end on a part, or double-click / <kbd>Enter</kbd>. <kbd>Backspace</kbd> removes the last point, <kbd>Esc</kbd> cancels.": "انقر للبدء، وانقر لإضافة نقاط انحناء؛ أنهِ على قطعة، أو انقر نقراً مزدوجاً / <kbd>Enter</kbd>. <kbd>Backspace</kbd> يزيل آخر نقطة، <kbd>Esc</kbd> للإلغاء.", "Click two points, or drag, to measure. Snaps to wall corners, fixture corners and wall faces (square to the first point); hold <kbd>Shift</kbd> for any angle. <kbd>Enter</kbd> keeps it as a dimension, <kbd>Esc</kbd> clears.": "انقر على نقطتين، أو اسحب، للقياس. يلتقط زوايا الجدران وزوايا التجهيزات ووجوه الجدران (عمودياً من النقطة الأولى)؛ اضغط <kbd>Shift</kbd> لأي زاوية. <kbd>Enter</kbd> يحفظه كبُعد، <kbd>Esc</kbd> للمسح.", "Click where the text goes, type, and press <kbd>Enter</kbd> (<kbd>Shift+Enter</kbd> for a new line). Click an existing text to change it. Move or delete text with the Pointer.": "انقر حيث يوضع النص، واكتب، واضغط <kbd>Enter</kbd> (<kbd>Shift+Enter</kbd> لسطر جديد). انقر على نص موجود لتعديله. حرّك النص أو احذفه بالمؤشر.", "Drag a corner to move it, or the round handle on an edge to bend it into a curve (it snaps to straight and to a half circle; <kbd>Shift</kbd> bends freely). Type a bend to set it exactly; it bends outwards, a minus value bends it in. Double-click an edge to add a corner, double-click a corner to remove it.": "اسحب زاوية لتحريكها، أو المقبض الدائري على الضلع لتحويله إلى منحنى (يلتقط المستقيم ونصف الدائرة؛ <kbd>Shift</kbd> للانحناء الحر). اكتب قيمة الانحناء لضبطه بدقة؛ ينحني للخارج، والقيمة السالبة تحنيه للداخل. انقر نقراً مزدوجاً على ضلع لإضافة زاوية، وعلى زاوية لإزالتها.", "Drag a wall to push or pull it (<kbd>M</kbd> or <b>Free move</b>: any direction), or an end to change its length. Box-select or <kbd>Ctrl</kbd>+click for several walls. <kbd>S</kbd> snap on/off, arrows nudge, <kbd>Del</kbd> deletes. Middle-drag or <kbd>Space</kbd>+drag pans.": "اسحب جداراً لدفعه أو سحبه (<kbd>M</kbd> أو <b>تحريك حر</b>: أي اتجاه)، أو طرفه لتغيير طوله. حدد بمستطيل أو <kbd>Ctrl</kbd>+نقرة لعدة جدران. <kbd>S</kbd> تشغيل/إيقاف الالتقاط، الأسهم للإزاحة، <kbd>Del</kbd> للحذف. السحب بالزر الأوسط أو <kbd>Space</kbd>+سحب لتحريك العرض.", "Drag any highlighted wall to move them together; near horizontal or vertical the move stays straight (<kbd>Shift</kbd>: free). Arrow keys nudge. <kbd>Ctrl</kbd>+click adds or removes a wall.": "اسحب أي جدار مظلل لتحريكها معاً؛ قرب الأفقي أو العمودي تبقى الحركة مستقيمة (<kbd>Shift</kbd>: حرة). الأسهم للإزاحة. <kbd>Ctrl</kbd>+نقرة تضيف جداراً أو تزيله.", "Drag any of them to move them all, or use the arrow keys. <kbd>Ctrl</kbd>/<kbd>Shift</kbd>+click adds or removes one; <kbd>Ctrl+C</kbd> / <kbd>Ctrl+V</kbd> copies and pastes them; <kbd>Del</kbd> deletes them.": "اسحب أياً منها لتحريكها جميعاً، أو استخدم الأسهم. <kbd>Ctrl</kbd>/<kbd>Shift</kbd>+نقرة تضيف واحدة أو تزيلها؛ <kbd>Ctrl+C</kbd> / <kbd>Ctrl+V</kbd> للنسخ واللصق؛ <kbd>Del</kbd> للحذف.", "Drag it along the wall, or onto another wall. The <b>Electrical</b> button above the plan shows or hides this layer.": "اسحبه على طول الجدار أو إلى جدار آخر. زر <b>الكهرباء</b> فوق المخطط يُظهر هذه الطبقة أو يخفيها.", "Drag it to move. The <b>Electrical</b> button above the plan shows or hides this layer.": "اسحبه لتحريكه. زر <b>الكهرباء</b> فوق المخطط يُظهر هذه الطبقة أو يخفيها.", "Drag over lines in the imported picture or drawing to rub them out. Walls, doors and windows are never touched. <kbd>Ctrl+Z</kbd> undoes the last stroke.": "اسحب فوق خطوط الصورة أو الرسم المستورد لمسحها. الجدران والأبواب والشبابيك لا تتأثر أبداً. <kbd>Ctrl+Z</kbd> يتراجع عن آخر مسحة.", "Drag the line to move it, or drag a square end to change its length. The <b>Electrical</b> button above the plan shows or hides this layer.": "اسحب الخط لتحريكه، أو اسحب طرفاً مربعاً لتغيير طوله. زر <b>الكهرباء</b> فوق المخطط يُظهر هذه الطبقة أو يخفيها.", "Drag the round handle above the column to turn it (snaps to 15°, hold <kbd>Shift</kbd> for any angle), or type an exact angle.": "اسحب المقبض الدائري فوق العمود لتدويره (يلتقط كل 15°، اضغط <kbd>Shift</kbd> لأي زاوية)، أو اكتب زاوية دقيقة.", "Drag the text to move it; arrow keys nudge it. Double-click it to change the words on the plan. <kbd>Shift+Enter</kbd> starts a new line. The size is the real height of the letters, so it prints and exports to AutoCAD at that size.": "اسحب النص لتحريكه؛ الأسهم لإزاحته. انقر نقراً مزدوجاً لتغيير الكلمات على المخطط. <kbd>Shift+Enter</kbd> يبدأ سطراً جديداً. الحجم هو الارتفاع الحقيقي للأحرف، فيُطبع ويُصدَّر إلى أوتوكاد بهذا الحجم.", "Drag the wall to push or pull it; turn on <b>Free move</b> or hold <kbd>Shift</kbd> to move it in any direction. Drag an end square to change its length. Orange circles mark loose ends. Arrow keys move it 10 (with <kbd>Shift</kbd>: 100).": "اسحب الجدار لدفعه أو سحبه؛ فعّل <b>تحريك حر</b> أو اضغط <kbd>Shift</kbd> لتحريكه في أي اتجاه. اسحب مربع الطرف لتغيير طوله. الدوائر البرتقالية تشير إلى الأطراف المفكوكة. الأسهم تحرّكه 10 (مع <kbd>Shift</kbd>: 100).", "Draw cold (blue) and hot (red) pipes from the meter, tank, pump or heater to the fixtures, and drains (brown) from the fixtures to a stack or inspection chamber. Sizes, flows and the pump are worked out from the connections. <b>Schematic</b> is a blank sheet for drawing the schematic by hand.": "ارسم أنابيب المياه الباردة (أزرق) والساخنة (أحمر) من العداد أو الخزان أو المضخة أو السخان إلى الأدوات الصحية، وأنابيب الصرف (بني) من الأدوات إلى عمود صرف أو ريكار تفتيش. تُحسب الأقطار والتدفقات والمضخة من التوصيلات. <b>المخطط التخطيطي</b> ورقة فارغة لرسم المخطط يدوياً.", "Electric plan: click a wire, conduit or part to edit it. Drag points to reshape a run; double-click a wire to add a bend point. <kbd>Del</kbd> deletes. The home plan is locked.": "مخطط الكهرباء: انقر على سلك أو أنبوب أو قطعة لتعديلها. اسحب النقاط لتغيير شكل المسار؛ انقر نقراً مزدوجاً على سلك لإضافة نقطة انحناء. <kbd>Del</kbd> للحذف. مخطط البيت مقفل.", "For each breaker: its name, size (A), poles, type, and <b>Feeds</b>: the junction box (or part) it supplies. A wire drawn from this panel to that junction box goes on the breaker by itself; any wire can also be put on a breaker with <b>Circuit</b> in the wire's panel. A solar breaker takes the AC feed from the inverter.": "لكل قاطع: اسمه وقيمته (A) وأقطابه ونوعه و<b>يغذّي</b>: علبة التفريع (أو القطعة) التي يغذيها. السلك المرسوم من هذه اللوحة إلى علبة التفريع تلك يُربط بالقاطع تلقائياً؛ ويمكن ربط أي سلك بقاطع من <b>الدارة</b> في لوحة السلك. القاطع الشمسي يستقبل تغذية AC من الإنفرتر.", "Measured areas<small>off hides plain measurements completely; yard surfaces and room areas keep their colour</small>": "المساحات المقاسة<small>الإطفاء يخفي القياسات العادية كلياً؛ وتبقى أسطح الحديقة ومساحات الغرف بألوانها</small>", "Measurements follow the <b>Measures</b> menu, so turn on or off what you want on the sheet first.": "القياسات تتبع قائمة <b>القياسات</b>، ففعّل أو أطفئ ما تريده على الورقة أولاً.", "Move near a wall: the fixture backs onto it and snaps to corners and neighbours. Click to place, <kbd>R</kbd> to rotate, <kbd>Esc</kbd> to stop.": "اقترب من جدار: يستند التجهيز إليه ويلتقط الزوايا والمجاورات. انقر للوضع، <kbd>R</kbd> للتدوير، <kbd>Esc</kbd> للإيقاف.", "Move to where the copy goes (it is held by its top-left corner) and click to place it. Copied walls join existing wall ends when they meet. <kbd>Esc</kbd> cancels.": "تحرّك إلى مكان النسخة (تُمسك من زاويتها العلوية اليسرى) وانقر لوضعها. الجدران المنسوخة تتصل بأطراف الجدران الموجودة عند التقائها. <kbd>Esc</kbd> للإلغاء.", "Plumbing info<small>pipe names, sizes, slopes and lengths; equipment details</small>": "معلومات التمديدات الصحية<small>أسماء الأنابيب وأقطارها وميولها وأطوالها؛ تفاصيل المعدات</small>", "Plumbing plan: click a pipe, fixture or equipment to edit it. Drag points to reshape a pipe; drag a round + handle to add a bend. <kbd>Del</kbd> deletes. The home plan is locked.": "مخطط التمديدات الصحية: انقر على أنبوب أو أداة صحية أو معدة لتعديلها. اسحب النقاط لتغيير شكل الأنبوب؛ اسحب مقبض + الدائري لإضافة انحناء. <kbd>Del</kbd> للحذف. مخطط البيت مقفل.", "Select a wall, opening, fixture or room to edit it. Every length field takes typed values like <kbd>3600</kbd>, <kbd>3.6m</kbd> or <kbd>12'6\"</kbd>.": "حدد جداراً أو فتحة أو تجهيزاً أو غرفة لتعديلها. كل حقل طول يقبل قيماً مكتوبة مثل <kbd>3600</kbd> أو <kbd>3.6m</kbd> أو <kbd>12'6\"</kbd>.", "Set the size and angle in the side panel, then click to place. It drags freely and clicks against a wall face, the far face or the wall centre; live dimensions show the distances. <kbd>R</kbd> turns it 90°.": "حدد القياس والزاوية في اللوحة الجانبية ثم انقر لوضعه. يُسحب بحرية ويلتصق بوجه الجدار أو الوجه البعيد أو منتصف الجدار؛ الأبعاد الحية تُظهر المسافات. <kbd>R</kbd> يدوّره 90°.", "Show its info on the plan<small>All electric info is on (Measures menu). Turn that off to show only the items you pick.</small>": "إظهار معلوماته على المخطط<small>كل معلومات الكهرباء ظاهرة (قائمة القياسات). أطفئها لإظهار العناصر التي تختارها فقط.</small>", "The measurements with tick marks along the outside of the plan are the app's own wall dimensions, not part of the picture. Turn them off with <b>Measures</b> in the top bar.": "القياسات ذات العلامات حول المخطط من الخارج هي أبعاد الجدران من التطبيق نفسه وليست جزءاً من الصورة. أطفئها من <b>القياسات</b> في الشريط العلوي.", "While drawing, selecting and moving<small>wall lengths, distances of doors, windows and columns</small>": "أثناء الرسم والتحديد والتحريك<small>أطوال الجدران ومسافات الأبواب والشبابيك والأعمدة</small>", "Wire, conduit and part info<small>names, sizes, lengths and breakers. Off hides it all; a selected item can still show its own (in its panel)</small>": "معلومات الأسلاك والأنابيب والقطع<small>الأسماء والمقاطع والأطوال والقواطع. الإطفاء يخفيها كلها؛ ويبقى بإمكان العنصر المحدد إظهار معلوماته (من لوحته)</small>"};
const AR_NOFRAG=new Set(['On','Or','To','From','Top','Left','Right','Fill','Move','Hide','Grid','Fit','Look','View','Snap','Pan','Round','Style','Format','Current','Runs','Spare','Item','Kind','Edge','Bend','Detach','Label','Level','Low','High','Medium','Bath','Other','Double','Single','English','Exit','Text']);
const arWord=w=>AR_EXACT[w]!=null?AR_EXACT[w]:null;
const AR_RE=[
  [/^Save changes to “([\s\S]+)”\?$/,m=>'حفظ التغييرات على «'+m[1]+'»؟'],
  [/^Continue “([\s\S]+)”$/,m=>'متابعة «'+m[1]+'»'],
  [/^Continuing “([\s\S]+)”(.*)$/,m=>'متابعة «'+m[1]+'»'+m[2]],
  [/^Project (\d+) of (\d+)\. ([\s\S]*)$/,m=>'المشروع '+m[1]+' من '+m[2]+'. '+trS(m[3])],
  [/^Close (.+)$/,m=>'إغلاق '+m[1]],
  [/^(\d+) walls?$/,m=>m[1]+(m[1]==='1'?' جدار':' جدران')],
  [/^(\d+) electrical parts?$/,m=>m[1]+' قطع كهربائية'],
  [/^(\d+) pcs$/,m=>m[1]+' قطعة'],
  [/^(\d+) ways · main (.+)$/,m=>m[1]+' مخارج · الرئيسي '+m[2]],
  [/^(.+) · (\d+) breakers?$/,m=>m[1]+' · '+m[2]+' قواطع'],
  [/^Length includes the (\d+)% spare\. Fill compares the cables' cross-section with the inside of the conduit\.$/,m=>'الطول يشمل '+m[1]+'% احتياط. الامتلاء يقارن مقطع الكبلات بداخل الأنبوب.'],
  [/^([\s\S]*) · lengths in (\w+) include (\d+)% spare\.$/,m=>m[1]+' · الأطوال بـ '+m[2]+' وتشمل '+m[3]+'% احتياط.'],
  [/^(\w+) (\d+) × (\d+) pixels\.$/,m=>m[1]+' '+m[2]+' × '+m[3]+' بكسل.'],
  [/^(.+) already has its (\d+) wires \(lights take two at most\)$/,m=>(arWord(m[1])||m[1])+' لها سلكان مسبقاً (الإنارة تأخذ سلكين كحد أقصى)'],
  [/^(\d+) wires?$/,m=>m[1]+' أسلاك'],
  [/^([\d.]+) l\/s · (cold|hot \+ cold)$/,m=>m[1]+' ل/ث · '+(m[2]==='cold'?'بارد':'ساخن + بارد')],
  [/^([\d.]+) WSFU · (cold|hot \+ cold)$/,m=>m[1]+' WSFU · '+(m[2]==='cold'?'بارد':'ساخن + بارد')],
  [/^([\d.]+) (DU|DFU) · min (.+)$/,m=>m[1]+' '+m[2]+' · الحد الأدنى '+m[3]],
  [/^(\d+) L · (roof|ground)$/,m=>m[1]+' لتر · '+(m[2]==='roof'?'السطح':'أرضي')],
  [/^(\d+) L for (\d+) people$/,m=>m[1]+' لتر لـ '+m[2]+' أشخاص'],
  [/^(\d+) kW for the hot flow$/,m=>m[1]+' kW لتدفق المياه الساخنة'],
  [/^(\d+) L · ([\d.]+) kW (electric|solar)$/,m=>m[1]+' لتر · '+m[2]+' kW '+(m[3]==='solar'?'شمسي':'كهربائي')],
  [/^(\d+) kW gas$/,m=>m[1]+' kW غاز'],
  [/^Auto \((.+)\)$/,m=>'تلقائي ('+m[1]+')'],
  [/^Named “([\s\S]+)”$/,m=>'سُمّي «'+m[1]+'»'],
  [/^([\d.,]+ (?:m|ft)) of wall, one face$/,m=>m[1]+' من الجدران، وجه واحد'],
  [/^less (.+) of openings$/,m=>'بعد طرح '+m[1]+' من الفتحات'],
  [/^(\d+) windows?$/,m=>m[1]+(m[1]==='1'?' شباك':' شبابيك')],
  [/^(\d+) doors?$/,m=>m[1]+(m[1]==='1'?' باب':' أبواب')],
  [/^Wall areas are one face, measured along the wall centre line at full wall height; openings count width × height\. Lengths in (.+)\.$/,m=>'مساحات الجدران لوجه واحد، مقاسة على محور الجدار بكامل ارتفاعه؛ الفتحات تُحسب العرض × الارتفاع. الأطوال '+({millimetres:'بالمليمتر',centimetres:'بالسنتيمتر',metres:'بالمتر','feet and inches':'بالقدم والإنش'}[m[1]]||m[1])+'.'],
  [/^Could not find (.+)\. It may have been moved or deleted\.$/,m=>'تعذر العثور على '+m[1]+'. ربما نُقل أو حُذف.'],
  [/^(.+) here · (.+) needed( · OK)?$/,m=>m[1]+' متوفر · '+m[2]+' مطلوب'+(m[3]?' · جيد':'')],
  [/^(\d+) L storage, or (\d+) kW instantaneous$/,m=>'خزان '+m[1]+' لتر، أو سخان فوري '+m[2]+' kW'],
  [/^(.+) · riser (.+)$/,m=>m[1]+' · الصاعد '+m[2]],
  [/^([\d.]+ (?:bar|psi)) · (OK|low)$/,m=>m[1]+' · '+(m[2]==='OK'?'جيد':'منخفض')],
  [/^(\d+) fixtures? · (.+)$/,m=>m[1]+' أدوات صحية · '+m[2]],
  [/^(.+) is not connected to the (supply|drain outlet)\.$/,m=>(m[1]==='A pipe'?'أنبوب':m[1])+(m[2]==='supply'?' غير موصول بالتغذية.':' غير موصول بمخرج الصرف.')],
  [/^(Cold water|Hot water|Hot water return|Drain \/ waste|Vent) ([A-Z]{1,2}\d+)$/,m=>arWord(m[1])+' '+m[2]],
  [/^(Cold water|Hot water|Hot water return|Drain \/ waste|Vent|Copper|PPR|PEX|PVC|HDPE|Reducer) (.*\d.*|\?.*)$/,m=>{const w=arWord(m[1]);return w?w+' '+m[2]:null;}],
  [/^([A-Z][a-z]+(?: [a-z]+)?) (\d+)$/,m=>{const w=arWord(m[1]);return w?w+' '+m[2]:null;}],
  [/^(.+): (\d[\d,.]* (?:mm|cm|m|in|ft) × .+)$/,m=>{const w=arWord(m[1]);return w?w+': '+m[2]:null;}],
];
let arFragRe=null;const arCache=new Map(),arOut=new Set();   // arOut: text this produced, never translated again
function arFrag(t){if(!arFragRe){const keys=Object.keys(AR_EXACT).filter(k=>k.length>=3&&/[A-Za-z]/.test(k)&&!AR_NOFRAG.has(k)&&k===k.trim()).sort((a,b)=>b.length-a.length)
    .map(k=>k.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'));arFragRe=new RegExp('(?<![A-Za-z])(?:'+keys.join('|')+')(?![A-Za-z])','g');}
  const out=t.replace(arFragRe,k=>AR_EXACT[k]);return out===t?null:out;}
// translate one string (English in, Arabic out); anything unknown is left as it is
function trS(s){if(LANG!=='ar'||s==null)return s;s=String(s);const t=s.trim();if(!t||!/[A-Za-z]{2}/.test(t)||arOut.has(t))return s;
  if(arCache.has(t)){const r=arCache.get(t);return r==null?s:s.replace(t,r);}
  let r=AR_EXACT[t];if(r==null)for(const [re,f] of AR_RE){const m=t.match(re);if(m){r=f(m);if(r!=null)break;}}
  if(r==null)r=arFrag(t);if(arCache.size>6000){arCache.clear();}arCache.set(t,r==null?null:r);if(r!=null)arOut.add(r.trim());return r==null?s:s.replace(t,r);}
const TR_SKIP=new Set(['SCRIPT','STYLE','TEXTAREA','CANVAS','INPUT','SELECT_','svg','SVG']);
const trText=new WeakMap(),trEl=new WeakMap();
function trAttr(n,a){const v=n.getAttribute(a);if(!v)return;const r=trS(v);if(r!==v){const o=trEl.get(n)||{};(o.attrs=o.attrs||{})[a]=[v,r];trEl.set(n,o);n.setAttribute(a,r);}}
function trNode(n){if(LANG!=='ar'||!n)return;
  if(n.nodeType===3){const p=n.parentNode;if(!p||TR_SKIP.has(p.nodeName)||(p.closest&&p.closest('[translate="no"]')))return;const o=n.nodeValue,r=trS(o);if(r!==o){trText.set(n,[o,r]);n.nodeValue=r;}return;}
  if(n.nodeType!==1||n.nodeName==='SCRIPT'||n.nodeName==='STYLE'||n.getAttribute('translate')==='no')return;
  trAttr(n,'title');trAttr(n,'placeholder');trAttr(n,'aria-label');if(TR_SKIP.has(n.nodeName))return;
  if(n.firstElementChild&&/[A-Za-z]/.test(n.textContent)){const h=n.innerHTML.trim(),r=AR_HTML[h];if(r){const o=trEl.get(n)||{};o.html=[n.innerHTML,r];trEl.set(n,o);n.innerHTML=r;return;}}
  for(let c=n.firstChild;c;c=c.nextSibling)trNode(c);}
function trRevert(root){const w=document.createTreeWalker(root,NodeFilter.SHOW_ELEMENT|NodeFilter.SHOW_TEXT);let n=root;const els=[];
  do{if(n.nodeType===3){const o=trText.get(n);if(o&&n.nodeValue===o[1])n.nodeValue=o[0];trText.delete(n);}else els.push(n);}while(n=w.nextNode());
  els.forEach(e=>{const o=trEl.get(e);if(!o)return;if(o.attrs)for(const a in o.attrs){if(e.getAttribute(a)===o.attrs[a][1])e.setAttribute(a,o.attrs[a][0]);}
    if(o.html&&e.innerHTML===o.html[1])e.innerHTML=o.html[0];trEl.delete(e);});}
new MutationObserver(ms=>{if(LANG!=='ar')return;for(const m of ms){if(m.type==='childList'){const t=m.target;if(t.nodeType===1&&t.firstElementChild&&AR_HTML[t.innerHTML.trim()]){trNode(t);continue;}m.addedNodes.forEach(trNode);}else if(m.type==='characterData')trNode(m.target);else if(m.type==='attributes'&&m.target.nodeType===1&&m.target.getAttribute('translate')!=='no')trAttr(m.target,m.attributeName);}})
  .observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['title','placeholder','aria-label']});
function setLang(l,quiet){l=l==='ar'?'ar':'en';const was=LANG;LANG=l;try{localStorage.setItem('bm-lang',l);}catch(e){}
  document.documentElement.lang=l==='ar'?'ar-SY':'en';document.documentElement.dir=l==='ar'?'rtl':'ltr';
  document.querySelectorAll('[data-lang]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.lang===l)));
  if(was==='ar'&&l!=='ar')trRevert(document.body);arCache.clear();
  try{renderInspector();renderTakeoff();renderTabs();updateMeasUI();syncAutosaveUI();epSync();plSync();$('#hint').innerHTML=(pMode?plHint(tool,placeType):eMode?epHint(tool,placeType):HINTS[tool])||'';}catch(e){}
  if(l==='ar')trNode(document.body);dirty();try{fillElevSelect();}catch(e){}
  if(!quiet&&was!==l)toast(l==='ar'?'اللغة: العربية':'Language: English');}


/* ============================== leaving the app: back button, closing the window ============================== */
// Android back steps out of whatever is open first (a dialog, Walk mode, the details panel, a tool), and only then asks to exit.
// Exiting asks to save projects with unsaved changes; with nothing unsaved it just asks "are you sure?".
let exiting=false;
const unsavedTabs=()=>{storeActive();return tabs.filter(t=>tabDirty(t)&&!tabIsBlank(t));};
// Exiting always ends the session: next time the app starts with the start question (Continue / Blank / Example / Open).
async function reallyExit(){exiting=true;
  try{const ks=[];for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k&&k.startsWith('bm-tab-'))ks.push(k);}ks.forEach(k=>localStorage.removeItem(k));localStorage.removeItem('bm-tabs');}catch(e){}
  if(TAURI){try{if(TAURI.process&&TAURI.process.exit){await TAURI.process.exit(0);return;}}catch(e){}
    try{await TAURI.core.invoke('plugin:process|exit',{code:0});return;}catch(e){}
    try{await TAURI.window.getCurrentWindow().destroy();return;}catch(e){}}
  else{try{history.go(-2);}catch(e){}setTimeout(()=>{try{window.close();}catch(e){}},300);}}
const tabName=t=>t.M.name||'Untitled project';
const keepAsLast=t=>t&&tabs.includes(t)&&!tabIsBlank(t)&&!tabDirty(t)&&(t.filePath||t.lastSaved);
// 1) autosave (when on) quietly writes projects that already have a file, 2) each project still unsaved is asked about
// one at a time and its tab closed after the answer, 3) with nothing to ask, a plain "exit?" (saying the work is saved).
let exitBusy=false;
async function exitDialog(){if(exitBusy||exiting)return;exitBusy=true;
  try{storeActive();const lastT=activeTab;let auto=0;
    if(autosaveOn&&NATIVE){for(const t of tabs){if(!tabDirty(t)||tabIsBlank(t)||!t.filePath)continue;
      try{await TAURI.fs.writeTextFile(t.filePath,tabJSON(t));t.savedSnap=JSON.stringify(t.M);t.lastSaved=Date.now();auto++;}catch(e){}}
      if(auto){saveTabsNow();renderTabs();}}
    const list=unsavedTabs();if(list.includes(lastT)){list.splice(list.indexOf(lastT),1);list.push(lastT);}
    for(let i=0;i<list.length;i++){const t=list[i];if(!tabs.includes(t))continue;if(t!==activeTab)switchTab(t.id);
      const ans=await askModal('Save changes to “'+tabName(t)+'”?',(list.length>1?'Project '+(i+1)+' of '+list.length+'. ':'')+'It has changes that aren’t saved to a file yet. If you exit without saving, they are lost.',
        [{label:'Cancel',value:null},{label:'Don’t save',value:'no'},{label:'Save',value:'save',primary:true}]);
      if(!ans){toast('Exit cancelled.');return;}
      if(ans==='save'){const ok=await saveProject(false);if(!ok){toast('Not saved, so the app stays open.');return;}}
      if(t===lastT&&ans==='save')recordLast(t);
      if(i<list.length-1)dropTab(t);}
    if(!list.length){const msg=auto?'Your work was saved automatically.':tabs.some(t=>!tabIsBlank(t))?'All your work is saved.':'Are you sure you want to exit?';
      const ok=await askModal('Exit Benchmark Planner?',msg,[{label:'Cancel',value:null},{label:'Exit',value:true,primary:true}]);if(!ok)return;}
    if(keepAsLast(lastT))recordLast(lastT);
    reallyExit();}
  finally{exitBusy=false;}}
function handleBack(){
  if(!$('#modal').hidden){closeModal();return;}
  if(document.getElementById('doorPick')){closeDoorPick();return;}
  const lm=$('#lookMenu');if(lm&&!lm.hidden){lm.hidden=true;return;}
  if(typeof closeTextEditor==='function'&&document.querySelector('.texted')){closeTextEditor(false);return;}
  if(walk.on){walkStop();return;}
  if($('#app').classList.contains('sheet')){setSheet(false);return;}
  if(laser.picking){laser.picking=false;$('#hint').innerHTML=HINTS[tool]||'';return;}
  if(tool!=='select'){setTool('select');return;}
  if(sel){sel=null;renderInspector();dirty();return;}
  exitDialog();}
function wireExit(){
  if(TAURI){
    try{if(TAURI.app&&TAURI.app.onBackButtonPress)TAURI.app.onBackButtonPress(()=>handleBack());}catch(e){}
    try{const w=TAURI.window&&TAURI.window.getCurrentWindow&&TAURI.window.getCurrentWindow();if(w&&w.onCloseRequested&&!/android/i.test(navigator.userAgent))w.onCloseRequested(e=>{if(exiting)return;e.preventDefault();exitDialog();});}catch(e){}
    return;}
  // web version: the browser warns before leaving with unsaved work; on the back button we ask first
  window.addEventListener('beforeunload',e=>{if(exiting||!unsavedTabs().length)return;e.preventDefault();e.returnValue='';});
  if(window.top!==window.self)return;
  try{history.pushState({bm:1},'');window.addEventListener('popstate',()=>{if(exiting)return;history.pushState({bm:1},'');handleBack();});}catch(e){}}


/* ============================== first start: blank page or the example ============================== */
function startWith(example){const t=activeTab;if(example){t.M=sampleModel();t.undo=[];t.redo=[];activate(t,true);t.savedSnap=snapshot();renderTabs();saveTabsNow();toast('This is an example flat. Change anything, or press + for a new project.');}
  else toast('Pick Wall (W) and click to start drawing.');}
// the answer to the start question: bring back the last session's tabs, or let them go
function finishBoot(recover){if(!bootPending)return;bootPending=false;
  if(recover&&prevTabs.length){tabs.length=0;prevTabs.forEach(t=>{t.stored=false;tabs.push(t);});activate(tabs.find(t=>t.wasActive)||tabs[0],true);}
  try{prevIds.forEach(id=>{if(!tabs.some(t=>t.id===id)){localStorage.removeItem('bm-tab-'+id);BIG.del('tab-'+id);}});}catch(e){}
  prevTabs=[];saveTabsNow();renderTabs();}
async function continueLast(){const L=lastRecord();if(!L)return;let o=null;
  if(NATIVE&&L.filePath){try{const x=JSON.parse(await TAURI.fs.readTextFile(L.filePath));if(x&&x.model&&Array.isArray(x.model.walls)&&Array.isArray(x.model.items))o=x;}catch(e){}}
  if(!o)o=L.data;
  // the reference drawing and plan image: from the file when it has them, otherwise as they were kept on this device
  if(!o.reference||!o.refImage){const b=await BIG.get('last');if(b){o=Object.assign({},o);if(!o.reference&&b.ref)o.reference=b.ref;if(!o.refImage&&b.img)o.refImage=b.img;}}
  const m=Object.assign(blankModel(),o.model);if(!o.model.name||o.model.name==='Untitled project')m.name=L.name||m.name;
  const t=makeTab(m,{units:normUnits(o.units||units),ref:o.reference||null,img:o.refImage||null,filePath:NATIVE?(L.filePath||null):null,lastSaved:L.savedAt||Date.now()});
  t.savedSnap=JSON.stringify(t.M);const old=activeTab;if(old&&tabIsBlank(old)&&!tabDirty(old)){tabs.splice(tabs.indexOf(old),1,t);try{localStorage.removeItem('bm-tab-'+old.id);}catch(e){}}else tabs.push(t);
  activate(t,true);saveTabsNow();toast('Continuing “'+m.name+'”'+(L.filePath?' ('+baseName(L.filePath)+')':''));}
function whenText(ms){if(!ms)return '';const d=new Date(ms),now=new Date();const tm=d.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});
  if(d.toDateString()===now.toDateString())return 'today, '+tm;const y=new Date(now);y.setDate(now.getDate()-1);if(d.toDateString()===y.toDateString())return 'yesterday, '+tm;
  return d.toLocaleDateString([],{day:'numeric',month:'short',year:d.getFullYear()===now.getFullYear()?undefined:'numeric'})+', '+tm;}
async function welcomeDialog(){try{await Promise.all(prevTabs.filter(t=>t.big&&!t.ref&&!t.img).map(t=>BIG.get('tab-'+t.id).then(b=>{if(b){t.ref=b.ref;t.img=b.img;t.bigRef=t.ref;t.bigImg=t.img;}})));}catch(e){}
  const L=lastRecord();const rec=prevTabs.filter(t=>t.savedSnap!==JSON.stringify(t.M));
  const body=document.createElement('div');body.className='welcome';
  const lang=document.createElement('div');lang.className='wlang';lang.setAttribute('translate','no');lang.innerHTML='<button type="button" data-lang="en" aria-pressed="'+(LANG==='en')+'">English</button><button type="button" data-lang="ar" aria-pressed="'+(LANG==='ar')+'">العربية</button>';
  const card=(id,svg,title,sub)=>`<button type="button" class="wcard" id="${id}"><span class="wimg"><svg viewBox="0 0 64 48" aria-hidden="true">${svg}</svg></span><span class="wtx"><b>${title}</b><span>${sub}</span></span></button>`;
  body.innerHTML=(L?card('wLast','<path d="M10 8h28l12 10v24H10z" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/><path d="M38 8v10h12" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/><path d="M22 30l6 6 12-12" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>',
      'Continue “'+esc(L.name)+'”','The last project you worked on'+(L.filePath?' — '+esc(baseName(L.filePath)):'')+(L.savedAt?'. Saved '+whenText(L.savedAt)+'.':'.')):'')
    +(rec.length?card('wRecover','<path d="M14 24a18 18 0 1 0 6-13.4" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/><path d="M12 6v9h9" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M32 16v9l6 4" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>',
      'Recover unsaved work','The app closed without exiting last time. Bring back '+(rec.length>1?rec.length+' projects with unsaved changes':'“'+esc(tabName(rec[0]))+'”, which has unsaved changes')+'.'):'')
    +card('wBlank','<rect x="6" y="5" width="52" height="38" rx="3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M26 24h12M32 18v12" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>','Blank page','Start a new plan from scratch.')
    +card('wExample','<rect x="6" y="5" width="52" height="38" rx="2" fill="none" stroke="currentColor" stroke-width="3"/><path d="M28 5v24M6 29h22M28 22h30" stroke="currentColor" stroke-width="2.4"/><rect x="10" y="9" width="7" height="6" fill="currentColor" opacity=".35"/><rect x="10" y="33" width="14" height="6" rx="2" fill="currentColor" opacity=".35"/>','Start with an example','A small flat with a kitchen, bathroom and living room to explore.')
    +card('wOpen','<path d="M6 12h18l5 5h29v24H6z" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/><path d="M32 36V22M26 28l6-6 6 6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>','Open a project','Choose a saved project file on this device.');
  const recent=recentList().filter(r=>!L||r.path!==L.filePath).slice(0,5);
  if(recent.length){const box=document.createElement('div');box.className='wrecent';box.innerHTML='<p class="h">Recent projects</p>'+recent.map((r,i)=>`<button type="button" class="wrow" data-ri="${i}"><b>${esc(r.name)}</b><span>${esc(baseName(r.path))}${r.at?' · '+whenText(r.at):''}</span></button>`).join('');
    box.querySelectorAll('[data-ri]').forEach(b=>b.onclick=()=>modalPick('recent:'+b.dataset.ri));body.appendChild(box);}
  body.prepend(lang);lang.querySelectorAll('[data-lang]').forEach(b=>b.onclick=()=>setLang(b.dataset.lang));
  const pr=askModal(L?'Welcome back':'Welcome to Benchmark Planner','How would you like to start?',[],body);
  ['wLast','wRecover','wBlank','wExample','wOpen'].forEach(id=>{const b=document.getElementById(id);if(b)b.onclick=()=>modalPick(id);});
  (document.getElementById('wLast')||$('#wBlank')).focus();
  const ans=await pr;finishBoot(ans==='wRecover');
  try{if(ans==='wLast')await continueLast();else if(ans==='wExample')startWith(true);else if(ans==='wOpen')await openProject();else if(ans==='wBlank')startWith(false);
    else if(ans&&ans.startsWith('recent:'))await openRecent(recent[+ans.slice(7)]);}catch(e){}
  prefsRestoreMode();}

/* ============================== settings remembered between sessions ============================== */
// Tool and view choices (snap, free move, box select or pan, cutaway, the view, the electric or plumbing plan,
// door type and the sizes new walls, doors, columns, fire pits and text start with) come back as they were left.
// Units, language, Measures, layers, 3D look, print options and panel folds are kept by their own settings.
const PREFS=(()=>{try{return JSON.parse(localStorage.getItem('bm-prefs'))||{};}catch(e){return {};}})();let prefsLast='';
function prefsNow(){const v=$('#stage').dataset.view;return {snap:snapOn,free:freeMove,drag:emptyDrag,cut:cutaway,
  view:eMode?epPrevView:pMode?plPrevView:v,mode:eMode?'ep':pMode?'pl':'home',sheet:pMode?plSheet:'plan',door:doorType,
  refShow:refVisible,wall:{t:defaults.t,h:defaults.h},swing:swingDefaults,slide:slideDefaults,col:colDefaults,firepit:firepitDefaults,text:textDefaults};}
function prefsSave(){if(bootPending)return;try{const j=JSON.stringify(prefsNow());if(j!==prefsLast){prefsLast=j;localStorage.setItem('bm-prefs',j);}}catch(e){}}
(function prefsLoad(){const P=PREFS,ok=v=>v&&typeof v==='object';
  if(typeof P.snap==='boolean')snapOn=P.snap;if(typeof P.free==='boolean')freeMove=P.free;if(P.drag==='box'||P.drag==='pan')emptyDrag=P.drag;
  if(P.wall){if(P.wall.t>=10)defaults.t=P.wall.t;if(P.wall.h>=100)defaults.h=P.wall.h;}
  [[swingDefaults,P.swing],[slideDefaults,P.slide],[colDefaults,P.col],[firepitDefaults,P.firepit],[textDefaults,P.text]].forEach(([d,v])=>{if(ok(v))for(const k in d)if(v[k]!=null&&typeof v[k]===typeof d[k])d[k]=v[k];});
  if(typeof P.door==='string'&&P.door)doorType=P.door;})();
function prefsRestoreMode(){const P=PREFS;try{if(P.refShow===false&&(refDrawing||refImage)){refVisible=false;updateRefUI();dirty();}}catch(e){}try{if(P.mode==='ep'&&epAllowed())epEnter();else if(P.mode==='pl'&&plAllowed()){plEnter();if(P.sheet==='sch')plSetSheet('sch');}}catch(e){}prefsSave();}
setInterval(prefsSave,3000);addEventListener('pagehide',prefsSave);document.addEventListener('visibilitychange',()=>{if(document.hidden)prefsSave();});

/* boot */
if(!loadTabs())migrateOld();
// keep the last session's tabs aside (for "Recover unsaved work") and start on one blank page
prevIds=tabs.map(t=>t.id);prevTabs=tabs.filter(t=>!tabIsBlank(t));prevTabs.forEach(t=>t.wasActive=t===activeTab);
tabs.length=0;activeTab=makeTab(blankModel());activeTab.savedSnap=JSON.stringify(activeTab.M);tabs.push(activeTab);bootPending=true;
M=activeTab.M;readColors();
setSnap(snapOn);setFree(freeMove,true);setEmptyDrag(emptyDrag);setView(['plan','split','elev','3d'].includes(PREFS.view)?PREFS.view:'plan');setCut(typeof PREFS.cut==='boolean'?PREFS.cut:true);
activate(activeTab,true);syncAutosaveUI();setLang(LANG,true);
if(three.ok){applyLook();syncWalkUI();}
setTimeout(welcomeDialog,300);
$('#laserBtn').onclick=laserBtnClick;renderLaserBtn();$('#elecBtn').onclick=()=>{setElecLayer(!elecOn);toast(elecOn?'Electrical layer shown.':'Electrical layer hidden.');};setElecLayer(elecOn);$('#zoomIn').onclick=()=>zoomPlan(1.25);$('#zoomOut').onclick=()=>zoomPlan(0.8);wireExit();
$('#detailsBtn').onclick=()=>setSheet(!$('#app').classList.contains('sheet'));$('#sheetClose').onclick=()=>setSheet(false);$('#sheetGrip').onclick=()=>setSheet(false);
requestAnimationFrame(()=>{fit();frame3d();build3d();loop();});
if(!three.ok){$('.pane3d .panelabel').textContent='3D unavailable: the 3D library did not load';}

/* ============================== offline install (browser / PWA only) ============================== */
if(!window.__TAURI__&&'serviceWorker' in navigator&&/^https?:$/.test(location.protocol)){
  window.addEventListener('load',()=>{navigator.serviceWorker.register('sw.js').catch(()=>{});});}
