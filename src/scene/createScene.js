/* eslint-disable */
// 3D 무대: 원래 portfolio-3d.html의 three.js 코드를 React에서 마운트/정리할 수 있게 감싼 모듈.
// createScene()이 반환하는 함수를 호출하면 애니메이션 루프, 이벤트, WebGL 리소스가 모두 정리된다.
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import Lenis from 'lenis';

/**
 * @param {object} o
 * @param {HTMLCanvasElement} o.canvas  고정 WebGL 캔버스
 * @param {HTMLElement} o.root          글자 오버레이(.story)
 * @param {HTMLElement} o.progressBar   맨 위 진행 막대
 * @param {HTMLElement} o.scrollRoot    data-stage 섹션들을 담은 <main>
 * @param {{t:string,s:string,b:string[]}[]} o.cards  카드 내용
 */
export function createScene(o){
var canvas = o.canvas, root = o.root, scrollRoot = o.scrollRoot, CARDS = o.cards;
var raf = 0, disposed = false, lenis = null, offs = [];
function on(t, ev, fn){ t.addEventListener(ev, fn); offs.push(function(){ t.removeEventListener(ev, fn); }); }
function dispose(){
  disposed = true; cancelAnimationFrame(raf); offs.forEach(function(f){ f(); });
  if (lenis) lenis.destroy();
  if (typeof scene !== 'undefined' && scene) scene.traverse(function(n){
    if (n.geometry) n.geometry.dispose();
    if (n.material) [].concat(n.material).forEach(function(m){ if (m.map) m.map.dispose(); m.dispose(); });
  });
  if (renderer){ renderer.dispose(); }
}

var i, FONT = '"Pretendard Variable", Pretendard, sans-serif';

/* ---------------- card content: 제목 · 부연설명 · 항목 ---------------- */
/* ---------------- helpers ---------------- */
function clamp(x, a, b){ return x < a ? a : x > b ? b : x; }
function sm(x){ x = clamp(x, 0, 1); return x * x * (3 - 2 * x); }
function eo(x){ x = clamp(x, 0, 1); return 1 - Math.pow(1 - x, 3); }       // ease-out cubic
function eio(x){ x = clamp(x, 0, 1); return x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }
function lerp(a, b, t){ return a + (b - a) * t; }
var seed = 11; function rnd(){ seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
function $(id){ return root.querySelector('#' + id); }

/* ---------------- scroll → stage value s (0 intro, 1 quant, 2 device, 3 cards, 4 contact) ---------------- */
var secs = Array.prototype.slice.call(scrollRoot.querySelectorAll('[data-stage]')), tops = [], hs = [];
function measure(){ tops = []; hs = []; secs.forEach(function(el){ var r = el.getBoundingClientRect(); tops.push(r.top + window.scrollY); hs.push(el.offsetHeight); }); }
function stageValue(){
  var y = window.scrollY, s = 0, last = secs.length - 1;
  for (var k = 0; k < secs.length; k++){ if (y >= tops[k]) s = k + clamp((y - tops[k]) / Math.max(1, hs[k] - (k === last ? window.innerHeight : 0)), 0, 1); }
  return Math.min(s, last);
}

/* ---------------- text overlay in Figma frame units ---------------- */
var bar = o.progressBar, nBits = $('nBits'), lLab = $('lLab');
var FR = {u: 1, fx: 0, fy: 0, mob: false};
var LAY = {
  lName: {x: 99, y: 550, f: 200, min: 64}, lKr: {x: 80, y: 243, f: 29, min: 17}, lEn: {x: 84, y: 336, f: 17, min: 12},
  lQ: {x: 95, y: 112, f: 72, min: 38}, lBits: {x: 95, y: 262, f: 48, min: 28}, lLab: {x: 95, y: 335, f: 24, min: 15},
  lD: {x: 95, y: 112, f: 72, min: 34}, lEnv: {x: 95, y: 262, f: 48, min: 26}, lModel: {x: 95, y: 335, f: 24, min: 15},
  lCName: {x: 52, y: 127, f: 78, min: 44}, lLinks: {x: 64, y: 259, f: 16, min: 12}
};
var NAME_B = {x: 80, y: 155, f: 64};
function frameFit(){
  var w = window.innerWidth, h = window.innerHeight, mob = w / h < 0.85; FR.mob = mob;
  FR.u = Math.min(w / 894, h / 690); if (mob) FR.u = w / 894 * 1.25;
  FR.fx = mob ? -40 * FR.u : (w - 894 * FR.u) / 2; FR.fy = mob ? 40 : (h - 690 * FR.u) / 2;
  Object.keys(LAY).forEach(function(id){ var L = LAY[id]; L.px = Math.max(L.min, L.f * FR.u); $(id).style.fontSize = L.px + 'px'; });
  LAY.lName.y = mob ? (h - 40) / FR.u - 110 : 550;
  // contact tiles: 58u squares, 24u apart, logo about half the tile
  var t = Math.max(46, 58 * FR.u), g = Math.max(14, 26 * FR.u);
  $('lLinks').style.gap = g + 'px';
  Array.prototype.forEach.call(root.querySelectorAll('.links a'), function(a){ a.style.width = a.style.height = t + 'px'; a.style.borderRadius = (t * 0.24) + 'px'; a.firstChild.style.width = a.firstChild.style.height = (t * 0.48) + 'px'; });
}
function place(id, op, dy){
  var L = LAY[id], el = $(id), x = FR.fx + L.x * FR.u, y = FR.fy + (L.y + (dy || 0)) * FR.u;
  el.style.opacity = op; el.style.visibility = op > 0.002 ? 'visible' : 'hidden';
  el.style.transform = 'translate3d(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,0)';
}
var bitsShown = 32;
function updateDom(s, q){
  var max = document.documentElement.scrollHeight - window.innerHeight;
  bar.style.transform = 'scaleX(' + (max > 0 ? window.scrollY / max : 0) + ')';
  // Frame 1 → 2: the name glides up and shrinks, then the details dissolve in one by one from below
  var m = eio(s / 0.42), A = LAY.lName, out = sm((s - 0.86) / 0.16);
  var nx = lerp(A.x, NAME_B.x, m), ny = lerp(A.y, NAME_B.y, m), sc = lerp(1, Math.max(NAME_B.f * FR.u, 30) / A.px, m);
  var el = $('lName'); el.style.opacity = 1 - out; el.style.visibility = out < 1 ? 'visible' : 'hidden';
  el.style.transform = 'translate3d(' + (FR.fx + nx * FR.u).toFixed(1) + 'px,' + (FR.fy + (ny - out * 30) * FR.u).toFixed(1) + 'px,0) scale(' + sc.toFixed(4) + ')';
  var k1 = sm((s - 0.42) / 0.14), k2 = sm((s - 0.54) / 0.14);
  place('lKr', k1 * (1 - out), (1 - k1) * 26 - out * 30);
  place('lEn', k2 * (1 - out), (1 - k2) * 26 - out * 30);
  // Frames 3–5: bit count runs 32 → 16 → 8 with the scroll
  var qo = sm((s - 1.82) / 0.12), qi = sm((s - 0.98) / 0.16), bi = sm((s - 1.04) / 0.16), li = sm((s - 1.1) / 0.16);
  place('lQ', qi * (1 - qo), (1 - qi) * 26 - qo * 26);
  place('lBits', bi * (1 - qo), (1 - bi) * 26 - qo * 26);
  place('lLab', li * (1 - qo), (1 - li) * 26 - qo * 26);
  var bc = q < 0.5 ? 32 - 32 * q : 16 - 16 * (q - 0.5), shown = Math.round(bc);
  if (shown !== bitsShown){ bitsShown = shown; nBits.textContent = shown; }
  var lab = q < 0.2 ? '기존모델' : q < 0.8 ? 'to W8A8' : 'W8A8'; if (lLab.textContent !== lab) lLab.textContent = lab;
  // Frame 6
  var dOut = sm((s - 2.78) / 0.12);
  [['lD', 1.95], ['lEnv', 2.03], ['lModel', 2.1]].forEach(function(p){ var k = sm((s - p[1]) / 0.16); place(p[0], k * (1 - dOut), (1 - k) * 26 - dOut * 26); });
  // Frame 8: contact
  var c1 = sm((s - 3.84) / 0.1), c2 = sm((s - 3.9) / 0.1);
  place('lCName', c1, (1 - c1) * 26); place('lLinks', c2, (1 - c2) * 26);
}

/* ---------------- 3D ---------------- */
var cv = canvas, ok = true, renderer;
if (ok){ try { renderer = new THREE.WebGLRenderer({canvas: cv, antialias: true}); } catch (err){ ok = false; } }
if (!ok){ measure(); frameFit(); on(window, 'resize', function(){ measure(); frameFit(); }); (function tick(){ var s = stageValue(); updateDom(s, sm((s - 1.36) / 0.46)); raf = requestAnimationFrame(tick); })(); return dispose; }

var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
var BG = new THREE.Color(0x030019).convertSRGBToLinear(); renderer.setClearColor(BG, 1);
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.92;
var scene = new THREE.Scene();
scene.fog = new THREE.Fog(BG, 16, 42);
var camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);

// studio reflections for metal parts: a dark room with a few soft light panels
(function(){
  var pm = new THREE.PMREMGenerator(renderer), env = new THREE.Scene();
  env.add(new THREE.Mesh(new THREE.BoxGeometry(30, 30, 30), new THREE.MeshBasicMaterial({color: 0x121216, side: THREE.BackSide})));
  [[0, 12, 0, 18, 6, 2.2], [-12, 4, 6, 3, 14, 1.6], [12, 3, -4, 3, 10, 1.2], [4, 2, 13, 10, 2, 1.0]].forEach(function(p){
    var m = new THREE.Mesh(new THREE.PlaneGeometry(p[3], p[4]), new THREE.MeshBasicMaterial({color: new THREE.Color(p[5], p[5], p[5] * 1.05), side: THREE.DoubleSide}));
    m.position.set(p[0], p[1], p[2]); m.lookAt(0, 0, 0); env.add(m);
  });
  scene.environment = pm.fromScene(env, 0.03).texture;
})();
scene.add(new THREE.AmbientLight(0xffffff, 0.25));
var key = new THREE.DirectionalLight(0xffffff, 0.9); key.position.set(4, 7, 5); scene.add(key);
var rim = new THREE.DirectionalLight(0xc9d2ff, 0.6); rim.position.set(-5, 3, -4); scene.add(rim);

var composer = null, bloom = null;
{
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.6, 0.5, 0.78);
  composer.addPass(bloom);
}

/* ---------- particle / voxel model ---------- */
var N = 1400, step = 0.3, BOARD_Y = -1.25, DIE_Y = 0.04 + 0.05 + 0.012;   // die top, board-local
var A = new Float32Array(N * 3), B = new Float32Array(N * 3), C = new Float32Array(N * 3), D = new Float32Array(N * 3);
var P = new Float32Array(N * 3), CUR = new Float32Array(N * 3), CURS = new Float32Array(N), W = new Float32Array(N), PH = new Float32Array(N), DL = new Float32Array(N), RT = new Float32Array(N);
var FOL = new Float32Array(N), JO = new Float32Array(N * 3), SW = new Float32Array(N), TU = new Float32Array(N), follow = 0, ORD = new Float32Array(N), VEL = new Float32Array(N * 3), dmin = 1e9, dmax = 0;
var golden = Math.PI * (3 - Math.sqrt(5)), cols = 40, rows = Math.ceil(N / cols);
for (i = 0; i < N; i++){
  var yy = 1 - (i / (N - 1)) * 2, rad = Math.sqrt(1 - yy * yy), th = golden * i, r = 1.9 * (0.82 + 0.36 * rnd());
  W[i] = rnd() * 2 - 1; PH[i] = rnd() * Math.PI * 2; FOL[i] = 0.85 + rnd() * 0.15; TU[i] = Math.pow(rnd(), 1.5); SW[i] = (1.5 + rnd() * 3) * (rnd() < 0.5 ? -1 : 1);
  var ju = rnd() * 2 - 1, jp = rnd() * Math.PI * 2, jq = Math.sqrt(1 - ju * ju), jr = 0.04 + Math.pow(rnd(), 2.2) * 0.55;
  JO[i*3] = Math.cos(jp) * jq * jr; JO[i*3+1] = Math.sin(jp) * jq * jr; JO[i*3+2] = ju * jr * 0.6; DL[i] = rnd() * 0.5; RT[i] = 3 + rnd() * 4;
  P[i*3] = -2.4 + (rnd() - 0.5) * 12; P[i*3+1] = (rnd() - 0.5) * 8; P[i*3+2] = 9 + rnd() * 7;
  CUR[i*3] = P[i*3]; CUR[i*3+1] = P[i*3+1]; CUR[i*3+2] = P[i*3+2];
  A[i*3] = Math.cos(th) * rad * r; A[i*3+1] = yy * r; A[i*3+2] = Math.sin(th) * rad * r;
  for (var a = 0; a < 3; a++) B[i*3+a] = Math.round(A[i*3+a] / step) * step;
  var gx = i % cols, gz = Math.floor(i / cols);
  C[i*3] = (gx / (cols - 1) - 0.5) * 0.46; C[i*3+1] = 0; C[i*3+2] = (gz / (rows - 1) - 0.5) * 0.46;
  var u = rnd() * 2 - 1, ph = rnd() * Math.PI * 2, sr = 9 + rnd() * 16, sq = Math.sqrt(1 - u * u);
  D[i*3] = Math.cos(ph) * sq * sr; D[i*3+1] = u * sr * 0.7; D[i*3+2] = Math.sin(ph) * sq * sr - 6;
  var dd = Math.hypot(B[i*3], B[i*3+1] + 2.6, B[i*3+2]); ORD[i] = dd; dmin = Math.min(dmin, dd); dmax = Math.max(dmax, dd);
}
for (i = 0; i < N; i++) ORD[i] = (ORD[i] - dmin) / (dmax - dmin);
var vox = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({color: 0xffffff, emissive: 0x9aa3b8, emissiveIntensity: 0.12, roughness: 0.45, metalness: 0.05, envMapIntensity: 0.6}), N);
vox.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
var tmpC = new THREE.Color(1, 1, 1);
for (i = 0; i < N; i++) vox.setColorAt(i, tmpC);
var model = new THREE.Group(); model.add(vox); scene.add(model);
var dummy = new THREE.Object3D();

/* ---------- Raspberry Pi 4–class board ---------- */
var board = new THREE.Group(), parts = [];
board.position.set(0, BOARD_Y, 0); scene.add(board);
function std(color, o){ return new THREE.MeshStandardMaterial(Object.assign({color: color, roughness: 0.5, metalness: 0}, o || {})); }
var M = {
  metal: std(0xd8dce3, {metalness: 1, roughness: 0.22}), brushed: std(0xc3c8d0, {metalness: 1, roughness: 0.38}),
  ic: std(0x1c1e24, {roughness: 0.55}), icLight: std(0x2a2d35, {roughness: 0.45}), plastic: std(0xf1f2f5, {roughness: 0.6}),
  black: std(0x0d0e12, {roughness: 0.7}), gold: std(0xe9edf2, {metalness: 1, roughness: 0.18}), die: std(0x9aa6c4, {metalness: 0.6, roughness: 0.25, emissive: 0x4a5577, emissiveIntensity: 0.4})
};
// part = a group that explodes upward by `lift` (and outward by `out`) with its own delay
function part(lift, out, dly){ var g = new THREE.Group(); board.add(g); parts.push({g: g, lift: lift, out: out || [0, 0], dly: dly === undefined ? rnd() * 0.35 : dly, rx: (rnd() - 0.5) * 0.5, rz: (rnd() - 0.5) * 0.5}); return g; }
function bx(g, w, h, d, mat, x, y, z){ var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); g.add(m); return m; }
function roundedRect(w, h, r){ var s = new THREE.Shape(), x = -w / 2, y = -h / 2; s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h); s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r); s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y); return s; }

// PCB with mounting holes and a traced top layer
var PW = 4.4, PD = 2.9, PT = 0.08;
(function(){
  var shape = roundedRect(PW, PD, 0.17), holes = [[-1.84, 1.1], [1.06, 1.1], [-1.84, -1.1], [1.06, -1.1]];
  holes.forEach(function(h){ var p = new THREE.Path(); p.absarc(h[0], h[1], 0.07, 0, Math.PI * 2, true); shape.holes.push(p); });
  var cvs = document.createElement('canvas'); cvs.width = 2048; cvs.height = 1350; var g = cvs.getContext('2d'), sx = 2048 / PW, sz = 1350 / PD;
  g.fillStyle = '#e9ebef'; g.fillRect(0, 0, 2048, 1350);
  function X(x){ return (x + PW / 2) * sx; } function Z(z){ return (PD / 2 - z) * sz; }
  var rs = 5;
  function rr(){ rs = (rs * 16807) % 2147483647; return rs / 2147483647; }
  // copper pour hatch
  g.strokeStyle = 'rgba(160,168,184,.18)'; g.lineWidth = 1;
  for (var k = -1350; k < 2048; k += 14){ g.beginPath(); g.moveTo(k, 0); g.lineTo(k + 1350, 1350); g.stroke(); }
  // traces: Manhattan runs with 45° kinks fanning out of the SoC
  g.lineCap = 'round'; g.lineJoin = 'round';
  for (var t = 0; t < 260; t++){
    var ang = rr() * Math.PI * 2, x0 = X(Math.cos(ang) * 0.55), y0 = Z(Math.sin(ang) * 0.55), len = 120 + rr() * 520, dir = Math.floor(rr() * 4), kink = rr() * 0.6 + 0.2;
    var dx = [1, -1, 0, 0][dir], dy = [0, 0, 1, -1][dir], x1 = x0 + dx * len * kink, y1 = y0 + dy * len * kink, d2 = rr() < .5 ? 1 : -1;
    var x2 = x1 + (dy ? d2 : dx) * 40, y2 = y1 + (dx ? d2 : dy) * 40, x3 = x2 + dx * len * (1 - kink), y3 = y2 + dy * len * (1 - kink);
    g.strokeStyle = rr() < 0.25 ? '#b9c0cc' : '#cfd4dc'; g.lineWidth = 2 + rr() * 4;
    g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.lineTo(x2, y2); g.lineTo(x3, y3); g.stroke();
    g.fillStyle = '#c3c9d3'; g.beginPath(); g.arc(x3, y3, 6, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#e9ebef'; g.beginPath(); g.arc(x3, y3, 2.5, 0, Math.PI * 2); g.fill();
  }
  // silkscreen outlines
  g.strokeStyle = '#8f96a5'; g.lineWidth = 3;
  [[0, 0, 1.25, 1.25], [1.35, 0.55, 1.05, 0.72], [-1.0, -0.6, 0.7, 0.6]].forEach(function(o){ g.strokeRect(X(o[0] - o[2] / 2), Z(o[1] + o[3] / 2), o[2] * sx, o[3] * sz); });
  g.fillStyle = '#8f96a5'; g.font = '600 28px ' + FONT; g.fillText('J8', X(-1.8), Z(-0.9)); g.fillText('U1', X(-0.6), Z(0.62)); g.fillText('U2', X(0.9), Z(0.95));
  holes.forEach(function(h){ g.fillStyle = '#c9ced7'; g.beginPath(); g.arc(X(h[0]), Z(h[1]), 0.14 * sx, 0, Math.PI * 2); g.fill(); });
  var tex = new THREE.CanvasTexture(cvs); tex.encoding = THREE.sRGBEncoding; tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  tex.repeat.set(1 / PW, 1 / PD); tex.offset.set(0.5, 0.5);
  var geo = new THREE.ExtrudeGeometry(shape, {depth: PT, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 2, curveSegments: 10});
  var pcb = new THREE.Mesh(geo, [std(0xc9ccd3, {map: tex, roughness: 0.48, metalness: 0.05}), std(0xd3d6dd, {roughness: 0.5})]);
  pcb.rotation.x = -Math.PI / 2; pcb.position.y = -PT / 2; board.add(pcb);
})();
var TOP = PT / 2;

// SoC: substrate + die (rises a little) and a metal lid (rises most)
var socSub = part(0.55, [0, 0], 0.05); bx(socSub, 1.06, 0.05, 1.06, M.icLight, 0, TOP + 0.025, 0); bx(socSub, 0.5, 0.024, 0.5, M.die, 0, TOP + 0.062, 0);
for (i = 0; i < 4; i++){ var cap = bx(socSub, 0.07, 0.02, 0.04, M.gold, (i % 2 ? 1 : -1) * 0.38, TOP + 0.06, (i < 2 ? 1 : -1) * 0.38); }
var lid = part(1.35, [0, 0], 0.0);
(function(){ var geo = new THREE.ExtrudeGeometry(roundedRect(0.86, 0.86, 0.06), {depth: 0.05, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.01, bevelSegments: 3}); var m = new THREE.Mesh(geo, M.metal); m.rotation.x = -Math.PI / 2; m.position.y = TOP + 0.075; lid.add(m); })();
// RAM, PMIC, USB controller, Wi-Fi can
var ram = part(0.85); bx(ram, 0.95, 0.07, 0.6, M.ic, 1.35, TOP + 0.035, 0.55);
var pmic = part(0.6); bx(pmic, 0.32, 0.05, 0.32, M.ic, -0.9, TOP + 0.025, 0.75);
var usbc = part(0.65); bx(usbc, 0.42, 0.05, 0.42, M.ic, 0.95, TOP + 0.025, -0.45);
var wifi = part(0.75); bx(wifi, 0.6, 0.07, 0.48, M.brushed, -1.0, TOP + 0.035, -0.55);
// right edge: two USB stacks + Ethernet, with real openings
function usbStack(z){
  var g = part(0.95, [0.45, 0]); bx(g, 0.72, 0.62, 0.55, M.metal, 1.86, TOP + 0.31, z);
  [0.17, 0.45].forEach(function(y){ bx(g, 0.03, 0.15, 0.42, M.black, 2.215, TOP + y, z); bx(g, 0.04, 0.04, 0.32, M.plastic, 2.2, TOP + y - 0.02, z); });
}
usbStack(0.0); usbStack(0.72);
var eth = part(1.0, [0.45, 0]); bx(eth, 0.76, 0.56, 0.62, M.metal, 1.84, TOP + 0.28, -0.88);
bx(eth, 0.03, 0.32, 0.46, M.black, 2.215, TOP + 0.26, -0.88);
bx(eth, 0.035, 0.05, 0.08, std(0xffffff, {emissive: 0xffffff, emissiveIntensity: 1.2}), 2.215, TOP + 0.49, -1.08);
bx(eth, 0.035, 0.05, 0.08, std(0xffffff, {emissive: 0xffffff, emissiveIntensity: 0.6}), 2.215, TOP + 0.49, -0.68);
// GPIO 2×20 header along the far edge
var gpioBase = part(0.7, [0, -0.2]); bx(gpioBase, 3.45, 0.1, 0.34, M.black, -0.32, TOP + 0.05, -1.22);
var gpioPins = part(0.9, [0, -0.25]);
(function(){ var im = new THREE.InstancedMesh(new THREE.BoxGeometry(0.035, 0.34, 0.035), M.gold, 40), o = new THREE.Object3D(); for (var p = 0; p < 40; p++){ o.position.set(-1.94 + (p % 20) * 0.17, TOP + 0.17, -1.3 + Math.floor(p / 20) * 0.17); o.updateMatrix(); im.setMatrixAt(p, o.matrix); } gpioPins.add(im); })();
// near edge: USB-C power, two micro-HDMI, audio jack
var front = part(0.6, [0, 0.4]);
bx(front, 0.36, 0.13, 0.3, M.metal, -1.6, TOP + 0.065, 1.33); bx(front, 0.24, 0.05, 0.03, M.black, -1.6, TOP + 0.065, 1.485);
[-1.0, -0.45].forEach(function(x){ bx(front, 0.3, 0.12, 0.26, M.metal, x, TOP + 0.06, 1.35); bx(front, 0.2, 0.05, 0.03, M.black, x, TOP + 0.06, 1.485); });
(function(){ var c = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.32, 24), M.black); c.rotation.x = Math.PI / 2; c.position.set(0.35, TOP + 0.13, 1.3); front.add(c); var ring = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.04, 24), M.metal); ring.rotation.x = Math.PI / 2; ring.position.set(0.35, TOP + 0.13, 1.47); front.add(ring); bx(front, 0.3, 0.18, 0.2, M.black, 0.35, TOP + 0.09, 1.22); })();
// display + camera FPC connectors
var fpc = part(0.5); bx(fpc, 0.13, 0.08, 0.8, M.plastic, -1.98, TOP + 0.04, 0.1); bx(fpc, 0.8, 0.08, 0.13, M.plastic, -0.1, TOP + 0.04, 1.0);
bx(fpc, 0.1, 0.03, 0.76, M.black, -1.98, TOP + 0.09, 0.1); bx(fpc, 0.76, 0.03, 0.1, M.black, -0.1, TOP + 0.09, 1.0);
// PoE header
var poe = part(0.7); (function(){ for (var p = 0; p < 4; p++) bx(poe, 0.035, 0.3, 0.035, M.gold, 1.2 + (p % 2) * 0.17, TOP + 0.15, -0.95 + Math.floor(p / 2) * 0.17); bx(poe, 0.34, 0.08, 0.34, M.black, 1.28, TOP + 0.04, -0.87); })();
// SMD passives scattered where nothing else sits
var smd = part(0.32, [0, 0], 0.1);
(function(){
  var keep = [[0, 0, 0.7, 0.7], [1.35, 0.55, 0.55, 0.4], [1.86, 0, 0.45, 1.4], [-0.32, -1.22, 1.8, 0.25], [-1.0, -0.55, 0.38, 0.32], [-0.9, 1.33, 0.9, 0.2], [0.35, 1.3, 0.25, 0.25], [-1.98, 0.1, 0.12, 0.45], [-0.1, 1.0, 0.45, 0.12], [-1.84, 1.1, 0.16, 0.16], [1.06, 1.1, 0.16, 0.16], [-1.84, -1.1, 0.16, 0.16], [1.06, -1.1, 0.16, 0.16], [0.95, -0.45, 0.25, 0.25], [-0.9, 0.75, 0.2, 0.2], [1.28, -0.87, 0.22, 0.22]];
  var n = 320, dark = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), M.ic, n), lite = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), M.brushed, n), o = new THREE.Object3D(), nd = 0, nl = 0, tries = 0;
  while ((nd < n || nl < n) && tries < 9000){
    tries++; var x = (rnd() - 0.5) * (PW - 0.3), z = (rnd() - 0.5) * (PD - 0.3), bad = false;
    for (var k = 0; k < keep.length; k++){ var kk = keep[k]; if (Math.abs(x - kk[0]) < kk[2] && Math.abs(z - kk[1]) < kk[3]){ bad = true; break; } }
    if (bad) continue;
    var big = rnd() < 0.12, w = big ? 0.14 : 0.06, d = big ? 0.1 : 0.03, h = big ? 0.05 : 0.025;
    o.position.set(x, TOP + h / 2, z); o.rotation.set(0, rnd() < 0.5 ? 0 : Math.PI / 2, 0); o.scale.set(w, h, d); o.updateMatrix();
    if (rnd() < 0.5 && nd < n){ dark.setMatrixAt(nd++, o.matrix); } else if (nl < n){ lite.setMatrixAt(nl++, o.matrix); }
  }
  dark.count = nd; lite.count = nl; smd.add(dark); smd.add(lite);
})();
parts.forEach(function(p){ p.base = p.g.position.clone(); });

/* ---------- 3D cards: rounded slab + two text layers that crossfade with the highlight ---------- */
var cardGroup = new THREE.Group(); scene.add(cardGroup);
var cards = [], CW = 2.3, CH = CW * 656 / 466;
var BASE = new THREE.Color(0xf0f0f0), HI = new THREE.Color(0x0e4a84).convertSRGBToLinear(); BASE.convertSRGBToLinear();
function wrap(ctx, text, maxW){ var out = [], line = ''; text.split(' ').forEach(function(w){ var t = line ? line + ' ' + w : w; if (ctx.measureText(t).width > maxW && line){ out.push(line); line = w; } else line = t; }); if (line) out.push(line); return out; }
var TITLE_PX = 0;
function titleSize(g, S, maxW){
  if (TITLE_PX) return TITLE_PX;
  g.font = '600 ' + (100 * S) + 'px ' + FONT; var widest = 0;
  CARDS.forEach(function(c){ widest = Math.max(widest, g.measureText(c.t).width); });
  TITLE_PX = Math.min(40, Math.floor(100 * maxW / widest)); return TITLE_PX;
}
function paintText(cvs, c, ink, sub){
  var g = cvs.getContext('2d'), S = cvs.width / 466, pad = 56 * S, y = 60 * S, maxW = cvs.width - pad * 2, tp = titleSize(g, S, maxW);
  g.clearRect(0, 0, cvs.width, cvs.height); g.textBaseline = 'top';
  g.fillStyle = ink; g.font = '600 ' + (tp * S) + 'px ' + FONT; g.fillText(c.t, pad, y); y += tp * 1.3 * S;
  y += 12 * S; g.fillStyle = sub; g.font = '500 ' + (19 * S) + 'px ' + FONT;
  wrap(g, c.s, maxW).forEach(function(l){ g.fillText(l, pad, y); y += 30 * S; });
  y += 26 * S; g.fillStyle = ink; g.font = '500 ' + (20 * S) + 'px ' + FONT;
  c.b.forEach(function(it){ wrap(g, it, maxW).forEach(function(l){ g.fillText(l, pad, y); y += 33 * S; }); });
}
var slabGeo = new THREE.ExtrudeGeometry(roundedRect(CW, CH, 0.16), {depth: 0.03, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 3, curveSegments: 12});
CARDS.forEach(function(c, idx){
  var g = new THREE.Group(), slabMat = std(0xf0f0f0, {roughness: 0.38, metalness: 0.05, transparent: true, envMapIntensity: 0.7});
  var slab = new THREE.Mesh(slabGeo, slabMat); g.add(slab);
  var layers = ['#ffffff', '#111118'].map(function(ink){
    var cvs = document.createElement('canvas'); cvs.width = 932; cvs.height = 1312;
    var tex = new THREE.CanvasTexture(cvs); tex.encoding = THREE.sRGBEncoding; tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    var mat = new THREE.MeshBasicMaterial({map: tex, transparent: true, depthWrite: false, toneMapped: false});
    var plane = new THREE.Mesh(new THREE.PlaneGeometry(CW, CH), mat); plane.position.z = 0.045; g.add(plane);
    return {cvs: cvs, tex: tex, mat: mat, ink: ink, sub: ink === '#ffffff' ? 'rgba(255,255,255,.62)' : 'rgba(17,17,24,.6)'};
  });
  cardGroup.add(g); cards.push({g: g, slabMat: slabMat, layers: layers, c: c, emph: idx === 0 ? 0 : 0});
});
function paintCards(){ TITLE_PX = 0; cards.forEach(function(k){ k.layers.forEach(function(L){ paintText(L.cvs, k.c, L.ink, L.sub); L.tex.needsUpdate = true; }); }); }
paintCards();
if (document.fonts && document.fonts.load){ document.fonts.load('600 40px "Pretendard Variable"', CARDS.map(function(c){ return c.t + c.s + c.b.join(''); }).join('')).then(function(){ if (!disposed) paintCards(); }, function(){}); }

/* ---------- camera / model keyframes per stage ---------- */
var mobile = false, K = [];
function keys(){
  mobile = window.innerWidth / window.innerHeight < 0.85; var m = mobile;
  K = [
    {cam: [0, 0, m ? 11 : 7.2], look: [0, 0, 0], pos: m ? [0, -1.6, 0] : [2.0, -0.2, 0], sc: m ? 0.7 : 0.9, g: 0.6},
    {cam: [0, 0, m ? 11 : 7.2], look: [0, 0, 0], pos: m ? [0, -1.6, 0] : [2.0, -0.2, 0], sc: m ? 0.7 : 0.9, g: 0.85},
    {cam: [0, 0, 7], look: [0, 0, 0], pos: [0, 0.72, 0], sc: 0.4, g: 0.8},
    {cam: [0, 0, 6], look: [0, 0, -10], pos: [0, 0, 0], sc: 1, g: 0.8},
    {cam: [0, 0, m ? 11 : 7.2], look: [0, 0, 0], pos: m ? [0.9, -1.9, 0] : [2.75, -0.15, 0], sc: m ? 0.95 : 1.3, g: 0.6}
  ];
}
function size(){ var w = window.innerWidth, h = window.innerHeight; renderer.setSize(w, h, false); if (composer){ if (composer.setPixelRatio) composer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); composer.setSize(w, h); } camera.aspect = w / h; camera.updateProjectionMatrix(); keys(); measure(); frameFit(); }
on(window, 'resize', size); size();

var mouse = {x: 0, y: 0, tx: 0, ty: 0, rx: 0, ry: 0, px: 0, py: 0, active: false};
on(window, 'pointermove', function(e){ mouse.tx = (e.clientX / window.innerWidth - 0.5) * 2; mouse.ty = (e.clientY / window.innerHeight - 0.5) * 2; mouse.rx = mouse.tx; mouse.ry = mouse.ty; mouse.active = true; });
on(document, 'pointerleave', function(){ mouse.active = false; });
var invM = new THREE.Matrix4(), ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(), planeN = new THREE.Vector3(), mwld = new THREE.Vector3(), ml = new THREE.Vector3(), TN = 40, TW = new Float32Array(TN * 3), TL = new Float32Array(TN * 3), tAcc = 0, tv = new THREE.Vector3();
lenis = reduce ? null : new Lenis({lerp: 0.09});

var look = new THREE.Vector3(), spin = 0, last = performance.now(), sSm = 0, first = true, shake = 0, lastEx = 0;
function lk(a, b, t){ return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]; }
// device scene camera: a swooping orbit around the board, ending on the Frame 6 composition
function devCam(t){
  var a = lerp(-1.25, 0.62, eo(t * 1.1)), r = lerp(8.2, 5.7, eo(t)) + (mobile ? 3 : 0), h = lerp(5.6, 2.7, eio(t)) + (mobile ? 1.5 : 0);
  var cx = Math.sin(a) * r, cz = Math.cos(a) * r, off = mobile ? 0 : 1.7;
  return {cam: [cx, BOARD_Y + h, cz], look: [-Math.cos(a) * off, BOARD_Y + (mobile ? 0.9 : 0.15), Math.sin(a) * off]};
}

function frame(now){
  var dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (lenis) lenis.raf(now);
  var sT = stageValue(); sSm = first ? sT : lerp(sSm, sT, 1 - Math.exp(-dt * 4.5)); first = false;
  var s = sSm, tsec = now / 1000;
  mouse.x = lerp(mouse.x, mouse.tx, 0.05); mouse.y = lerp(mouse.y, mouse.ty, 0.05);

  // story beats
  var pour = sm((s - 0.78) / 0.42);                 // frame 2 → 3: particles stream in from behind
  var q = sm((s - 1.36) / 0.46);                    // frames 3–5: 32 → 16 → 8 bit
  var t = clamp((s - 1.85) / 0.95, 0, 1);           // frame 6 timeline
  var enter = eo(t / 0.22);                         // board rises in, lid already open
  var dRaw = clamp((t - 0.14) / 0.5, 0, 1);         // genie: particles stream into the die, nearest first
  var d = sm(dRaw * 1.6);                           // model leaves the voxel layout
  var close = clamp((t - 0.7) / 0.07, 0, 1), lidK = close * close * close;   // lid slams shut, accelerating
  var c = sm((s - 2.8) / 0.3);                      // dissolve to stars for the cards
  var e = sm((s - 3.7) / 0.3);                      // reform for contact
  var onBoard = d * (1 - c);

  // camera
  var k = Math.min(Math.floor(s), K.length - 1), k2 = Math.min(k + 1, K.length - 1), f = s - k, b = sm((f - K[k].g) / (1 - K[k].g));
  var cp = lk(K[k].cam, K[k2].cam, b), lt = lk(K[k].look, K[k2].look, b), mp = lk(K[k].pos, K[k2].pos, b), msc = lerp(K[k].sc, K[k2].sc, b);
  var wd = sm((s - 1.84) / 0.18) * (1 - sm((s - 2.78) / 0.2));
  if (wd > 0){ var dc = devCam(t); cp = lk(cp, dc.cam, wd); lt = lk(lt, dc.look, wd); }
  if (lastEx < 1 && close >= 1 && t < 0.86) shake = 1; lastEx = close;
  shake = Math.max(0, shake - dt * 2.8);
  var sh = reduce ? 0 : shake * shake * 0.05;
  camera.position.set(cp[0] + mouse.x * 0.3 + Math.sin(tsec * 63) * sh, cp[1] - mouse.y * 0.2 + Math.cos(tsec * 57) * sh, cp[2]);
  look.set(lt[0], lt[1], lt[2]); camera.lookAt(look);
  model.position.set(mp[0], mp[1], mp[2]); model.scale.setScalar(msc);

  // board motion
  board.visible = enter > 0.001 && c < 0.999;
  board.position.y = BOARD_Y - (1 - enter) * 1.2 - c * 3 - (shake * shake) * 0.03;
  board.rotation.set(0, c * 0.6, 0);
  // lid: hovers open and tilted, then drops with acceleration and a small bounce
  var bounce = close >= 1 ? Math.sin(clamp((t - 0.77) / 0.06, 0, 1) * Math.PI) * 0.06 * (1 - clamp((t - 0.77) / 0.06, 0, 1)) : 0;
  var hover = reduce ? 0 : Math.sin(tsec * 1.6) * 0.04 * (1 - lidK);
  lid.position.set(0.35 * (1 - lidK), 0.8 * (1 - lidK) + hover + bounce, -0.25 * (1 - lidK));
  lid.rotation.set(-0.55 * (1 - lidK), 0.2 * (1 - lidK), 0.25 * (1 - lidK));

  // model (spin settles to a whole turn so the grid lands square on the die)
  if (!reduce) spin += dt * 0.22 * (1 - onBoard * 0.97);
  var settle = Math.round(spin / (Math.PI * 2)) * Math.PI * 2;
  model.rotation.y = lerp(spin, settle, onBoard);
  model.rotation.x = lerp(0.18 + mouse.y * 0.1, 0, onBoard);
  // die position in world space (board-local die follows the substrate when exploded)
  var dieY = board.position.y + DIE_Y + 0.012;
  var levels = q < 0.25 ? 0 : q < 0.75 ? 9 : 4;
  model.updateMatrixWorld(); invM.copy(model.matrixWorld).invert(); var ie = invM.elements;
  ray.setFromCamera(ndc.set(mouse.rx, -mouse.ry), camera);
  plane.set(planeN.set(0, 0, 1), -model.position.z);
  var hit = ray.ray.intersectPlane(plane, mwld);
  var mw = hit && mouse.active ? 1 - onBoard : 0;
  if (hit){ ml.copy(mwld); model.worldToLocal(ml); }
  // cursor path history: sample at a fixed rate; when the trail is idle every sample sits on the cursor
  if (hit){
    // fixed 16ms samples regardless of frame rate (in-between samples are interpolated)
    var hx = TW[0], hy = TW[1], hz = TW[2], nS = 0; tAcc += dt;
    while (tAcc >= 0.016 && nS < TN){ tAcc -= 0.016; nS++; }
    for (var si = 1; si <= nS; si++){ var sf = si / nS; TW.copyWithin(3, 0, TN * 3 - 3); TW[0] = lerp(hx, mwld.x, sf); TW[1] = lerp(hy, mwld.y, sf); TW[2] = lerp(hz, mwld.z, sf); }
    TW[0] = mwld.x; TW[1] = mwld.y; TW[2] = mwld.z;
    if (follow < 0.02) for (var ti = 3; ti < TN * 3; ti += 3){ TW[ti] = mwld.x; TW[ti+1] = mwld.y; TW[ti+2] = mwld.z; }
    for (var tk = 0; tk < TN * 3; tk += 3){ tv.set(TW[tk], TW[tk+1], TW[tk+2]); model.worldToLocal(tv); TL[tk] = tv.x; TL[tk+1] = tv.y; TL[tk+2] = tv.z; }
  }
  // follow: rises quickly while the cursor moves, eases back to the sphere once it stops
  var mv = Math.hypot(mouse.rx - mouse.px, mouse.ry - mouse.py) / Math.max(dt, 0.001); mouse.px = mouse.rx; mouse.py = mouse.ry;
  var fTarget = clamp(mv * 1.6, 0, 1); follow += (fTarget - follow) * (1 - Math.exp(-dt * (fTarget > follow ? 14 : 1.6)));
  for (i = 0; i < N; i++){
    var j = i * 3, fl = reduce ? 0 : Math.sin(tsec * 1.2 + PH[i]) * 0.05 * (1 - q), pi = sm((pour - DL[i]) / 0.5);
    var x = lerp(A[j], B[j], q), y = lerp(A[j+1], B[j+1], q) + fl, z = lerp(A[j+2], B[j+2], q);
    x = lerp(P[j], x, pi); y = lerp(P[j+1], y, pi); z = lerp(P[j+2], z, pi);
    var gi = clamp((dRaw - ORD[i] * 0.55) / 0.45, 0, 1); gi = gi * gi * gi;      // accelerating pull, nearest first
    var cx = C[j], cy = dieY, cz = C[j+2];   // die target in world space → model space
    var tx = ie[0] * cx + ie[4] * cy + ie[8] * cz + ie[12], ty = ie[1] * cx + ie[5] * cy + ie[9] * cz + ie[13], tz = ie[2] * cx + ie[6] * cy + ie[10] * cz + ie[14];
    x = lerp(x, tx, gi); y = lerp(y, ty, gi); z = lerp(z, tz, gi);
    x = lerp(x, D[j], c); y = lerp(y, D[j+1], c); z = lerp(z, D[j+2], c);
    x = lerp(x, A[j], e); y = lerp(y, A[j+1], e); z = lerp(z, A[j+2], e);
    var sA = 0.055 + Math.abs(W[i]) * 0.05, sz = lerp(sA, step * 0.6, q); sz = lerp(sz, 0.008 / Math.max(0.3, model.scale.x), gi); sz = lerp(sz, 0.045, c); sz = lerp(sz, sA, e);
    if (pi < 1 && e < 0.01) sz *= lerp(1.8, 1, pi);
    // strong cursor follow only while the particles form the sphere (quantization + contact);
    // not before they have poured in, not on the board, not as stars
    var sph = pi * lerp((1 - gi) * (1 - c), 1, e);
    var fw = reduce ? 0 : follow * mw * FOL[i] * sph;
    // stars: a gentle nudge away from the cursor instead
    var pw = reduce || !hit || !mouse.active ? 0 : c * (1 - e);
    if (pw > 0.001){
      var rx = x - ml.x, ry = y - ml.y, rd2 = rx * rx + ry * ry, push = pw * 0.35 * Math.exp(-rd2 / 0.5) / Math.sqrt(rd2 + 0.02);
      x += rx * push; y += ry * push;
    }
    if (fw > 0.001){
      // ride the cursor's recent path: head of the curve is the cursor, the rest trails along where it has been
      var tu = TU[i] * (TN - 1), t0 = Math.floor(tu), t1 = Math.min(TN - 1, t0 + 1), tf = tu - t0, h0 = t0 * 3, h1 = t1 * 3;
      var px = lerp(TL[h0], TL[h1], tf), py = lerp(TL[h0+1], TL[h1+1], tf), pz = lerp(TL[h0+2], TL[h1+2], tf);
      var th = lerp(0.6, 0.18, TU[i]), sa = tsec * SW[i], cs = Math.cos(sa), sn = Math.sin(sa), ox = (JO[j] * cs - JO[j+1] * sn) * th, oy = (JO[j] * sn + JO[j+1] * cs) * th;
      x = lerp(x, px + ox, fw); y = lerp(y, py + oy, fw); z = lerp(z, pz + JO[j+2] * th, fw);
    }
    if (reduce){ CUR[j] = x; CUR[j+1] = y; CUR[j+2] = z; CURS[i] = sz; }
    else {
      // spring toward the target (slightly underdamped, so the cloud wobbles) plus a push and swirl from the cursor
      var ks = RT[i] * RT[i] * (1 + gi * 3 + fw * 3), damp = 2 * Math.sqrt(ks) * 0.7;
      var ax = (x - CUR[j]) * ks - VEL[j] * damp, ay = (y - CUR[j+1]) * ks - VEL[j+1] * damp, az = (z - CUR[j+2]) * ks - VEL[j+2] * damp;
      VEL[j] += ax * dt; VEL[j+1] += ay * dt; VEL[j+2] += az * dt;
      CUR[j] += VEL[j] * dt; CUR[j+1] += VEL[j+1] * dt; CUR[j+2] += VEL[j+2] * dt;
      CURS[i] += (sz - CURS[i]) * (1 - Math.exp(-dt * RT[i] * (1 + gi * 3)));
    }
    dummy.position.set(CUR[j], CUR[j+1], CUR[j+2]);
    dummy.rotation.set(PH[i] * (1 - q) * (1 - e) * (1 - gi) + PH[i] * e, PH[i] * (1 - q) * (1 - gi), 0);
    dummy.scale.setScalar(CURS[i]); dummy.updateMatrix(); vox.setMatrixAt(i, dummy.matrix);
    var wv = levels ? Math.round(W[i] * (levels - 1) / 2) / ((levels - 1) / 2) : W[i];
    var gb = (0.5 + 0.38 * (wv + 1) / 2) * (1 - 0.3 * q); gb = lerp(gb, 1, gi); gb = lerp(gb, 0.32, c); gb = lerp(gb, 0.5 + 0.38 * (W[i] + 1) / 2, e);
    tmpC.setRGB(gb, gb, gb * 1.02); vox.setColorAt(i, tmpC);
  }
  vox.instanceMatrix.needsUpdate = true; vox.instanceColor.needsUpdate = true;
  // hide the model while the lid sits on top of it
  vox.visible = !(lidK >= 1 && c < 0.02 && t > 0.78);

  // cards fly past; the card most in view lights up
  var travel = clamp((s - 2.95) / 0.85, 0, 1), span = CARDS.length * 4.6 + 14, best = -1, bestScore = 0;
  cardGroup.visible = s > 2.75 && s < 3.95;
  cards.forEach(function(k, idx){
    var z = -12 - idx * 4.6 + travel * span, side = idx % 2 ? 1 : -1, xs = mobile ? 0.2 : 1.35, near = sm((z + 3) / 5);
    k.g.position.set(side * xs * (1 - near * 0.4), (mobile ? -0.3 : -0.25) + Math.sin(idx * 1.7) * 0.15, z);
    k.g.rotation.set(0, side * -0.5 * (1 - near) + side * -0.12, side * 0.035 + Math.sin(tsec * 0.6 + idx) * 0.012);
    k.g.scale.setScalar(mobile ? 0.72 : 1);
    k.op = sm((z + 34) / 12) * (1 - sm((z - 1.4) / 1.6));
    k.g.visible = k.op > 0.01;
    var score = k.op * (1 - Math.min(1, Math.abs(z + 1.2) / 5));
    if (score > bestScore){ bestScore = score; best = idx; }
    k.z = z;
  });
  cards.forEach(function(k, idx){
    var target = best >= 0 && bestScore > 0.15 && (idx === best || k.z > cards[best].z) ? 1 : 0;
    k.emph += (target - k.emph) * (1 - Math.exp(-dt * 5));
    k.slabMat.color.copy(BASE).lerp(HI, k.emph); k.slabMat.opacity = k.op;
    k.layers[0].mat.opacity = k.op * k.emph; k.layers[1].mat.opacity = k.op * (1 - k.emph);
  });

  updateDom(s, q);
  if (bloom) bloom.strength = lerp(0.6, 0.18, cardGroup.visible ? 1 : 0) + onBoard * 0.1;
  if (composer) composer.render(); else renderer.render(scene, camera);
  raf = requestAnimationFrame(frame);
}
on(window, 'load', measure);
if (document.fonts && document.fonts.ready) document.fonts.ready.then(function(){ if (!disposed){ measure(); frameFit(); } });
raf = requestAnimationFrame(frame);
return dispose;
}
