/* I-2 Dot Matrix instrument (Stage view only; CSS draws a static dot ground elsewhere). One canvas
   behind the deck: an even dot grid is Today; on Projected the dots migrate once into the dotted
   outlines of the projected elements on the current console, then hold; back to Today they return
   once. The console code is lit in the grid. Pointer wake over empty field only, behind the Motion
   toggle. Nothing moves at rest; reduced motion gets the static frames. */
(() => {
'use strict';
const H = document.documentElement, $ = (s) => document.querySelector(s), $$ = (s) => [...document.querySelectorAll(s)];
const cv = $('.dm-cv'), ctx = cv && cv.getContext('2d'), data = $('#deck-data'), field = $('#d-field');
if (!ctx || !data || !field) return;
const T = JSON.parse(data.textContent).copy;
const mqS = matchMedia('(min-width: 64em) and (min-height: 36em)'), mqR = matchMedia('(prefers-reduced-motion: reduce)');
const TAU = Math.PI * 2, KEY = 'terra-deck-motion', DUR = 560, M = Math;
// projected outlines the dots form; content the dots stay quiet under (text by its inked extent, controls by box)
const TGT = '.bd-proj, .bd-proj .station, .pj-proj, .t-proj, .sys-wide .sys-L4 .svc-box, .sys-wide .sys-L4 .station, .sys-wide .sys-L5 .tsdf-b';
const BLK = '.d-status > *, .d-truths li, .d-truths p, .d-rail a, .d-tape > *, .d-pad9 a, .d-foot > :not(output), .c-head > *, .c-body > :not(.bay), .c-notshown, .bay-head, .bay-cav, .pads, .panel > *';
const CTL = 'a, button, input, form, .d-switch, .pads, .bd-scroll, .ob-scroll';
// 5x7 digits: seven rows of five bits
const FONT = '0E11131519110E040C040404040E0E11010204081F1F02040201110E02060A121F02021F101E0101110E0608101E11110E1F0102040808080E11110E11110E0E11110F01020C';
// grid, grid under content, wake 1-3, code, outline (fog-2, stone, fog on ATNI black)
const C = ['rgb(177 177 172/.3)', 'rgb(177 177 172/.12)', 'rgb(149 154 156/.55)', 'rgb(177 177 172/.62)', 'rgb(207 201 187/.7)', 'rgb(185 192 198/.66)', 'rgb(207 201 187/.95)'];
const RW = [1.5, 2.1, 2.8];
const store = (v) => { try { if (v) localStorage.setItem(KEY, v); return localStorage.getItem(KEY); } catch (e) { return null; } };
const seen = (e) => (e.checkVisibility ? e.checkVisibility() : !e.closest('[hidden]'));
const ease = (t) => 1 - M.pow(1 - t, 5);
let motion = store() ? store() === 'on' : !mqR.matches;
let W = 0, Ht = 0, P = 16, cols = 0, rows = 0, N = 0, ox = 0, oy = 0, fr = null, img = null;
let x, y, fx, fy, tx, ty, a, kind, pk, blk, gl, hc, hr;
let live = false, raf = 0, last = 0, mig = -1, vis = true, follow = 0, waking = false, ptr = null, bx = 0, by = 0, spd = 0, lastIn = 0;
const PAL = [], PK = new Map();

function alloc(c, r, gx, gy) {
  cols = c; rows = r; ox = gx; oy = gy; N = c * r; mig = -1;
  const F = () => new Float32Array(N), U = () => new Uint8Array(N);
  x = F(); y = F(); fx = F(); fy = F(); tx = F(); ty = F(); a = F(); hr = F();
  kind = U(); pk = U(); blk = U(); gl = U(); hc = U();
  for (let i = 0; i < N; i++) { x[i] = tx[i] = hx(i); y[i] = ty[i] = hy(i); }
}
const hx = (i) => ox + (i % cols + 0.5) * P, hy = (i) => oy + ((i / cols | 0) + 0.5) * P;
const cx = (v) => M.floor((v - ox) / P), cy = (v) => M.floor((v - oy) / P);
function mark(r) {
  if (!r.width || !r.height) return;
  const c0 = M.max(0, cx(r.left)), c1 = M.min(cols - 1, cx(r.right)), r1 = M.min(rows - 1, cy(r.bottom));
  for (let j = M.max(0, cy(r.top)); j <= r1; j++) for (let k = c0; k <= c1; k++) blk[j * cols + k] = 1;
}

// Read the deck once, then write only to the canvas.
function layout(anim) {
  const on = H.dataset.view === 'stage' && mqS.matches && !H.dataset.print;
  if (on !== live) { live = on; H.classList.toggle('dm-live', on); if (!on) H.classList.remove('dm-ht'); }
  if (!live) { stop(); return; }
  fr = field.getBoundingClientRect();
  const rg = document.createRange();
  const blocks = $$(BLK).filter(seen).map((e) => { if (e.matches(CTL)) return e.getBoundingClientRect(); rg.selectNodeContents(e); return rg.getBoundingClientRect(); });
  const proj = H.dataset.mode === 'projected' ? $$(TGT).filter(seen).map((e) => { const s = e.closest('svg'); return [e.getBoundingClientRect(), s && s.getBoundingClientRect(), s ? 0 : 0.75]; }) : [];
  const con = H.dataset.console, code = ($('.d-crumb-code') || {}).textContent || '';
  const gx = (fr.left % P) - P, gy = (fr.top % P) - P;
  const c2 = M.ceil((W - gx) / P), r2 = M.ceil((Ht - gy) / P);
  if (c2 !== cols || r2 !== rows || gx !== ox || gy !== oy) alloc(c2, r2, gx, gy);
  blk.fill(0); gl.fill(0); hc.fill(0);
  blocks.forEach(mark);
  for (let i = 0; i < N; i++) { const X = hx(i), Y = hy(i); if (!blk[i] && (X < fr.left || X > fr.right || Y < fr.top || Y > fr.bottom)) blk[i] = 2; }
  glyph(code);
  H.classList.toggle('dm-ht', con === 'standby' && !!img);
  if (con === 'standby' && img) tone();
  assign(proj, anim && !mqR.matches);
}

// The console code at the field's top right, only where no text sits; its box stays plain grid.
function glyph(code) {
  if (!/^\d+$/.test(code)) return;
  const w = code.length * 6 - 1, c0 = cx(fr.right) - 2 - w, r0 = cy(fr.top) + 2, box = [];
  for (let r = 0; r < 7; r++) for (let k = 0; k < w; k++) {
    const b = k % 6, bits = parseInt(FONT.substr(+code[k / 6 | 0] * 14 + r * 2, 2), 16);
    box.push([(r0 + r) * cols + c0 + k, b < 5 && bits >> (4 - b) & 1 ? 1 : 2]);
  }
  if (c0 >= 0 && box.every(([i]) => i >= 0 && i < N && !blk[i])) for (const [i, v] of box) gl[i] = v;
}

// Standby only: a halftone of one photograph in its own sampled colors, a dim backplate, never under text.
function tone() {
  const cA = M.max(0, cx(fr.left)), cB = M.min(cols - 1, cx(fr.right)), rA = M.max(0, cy(fr.top)), rB = M.min(rows - 1, cy(fr.bottom));
  const fc = cB - cA + 1, fh = rB - rA + 1, o = document.createElement('canvas');
  o.width = fc; o.height = fh;
  const g = o.getContext('2d', { willReadFrequently: true });
  if (!g) return;
  const iw = img.naturalWidth, ih = img.naturalHeight, s = M.max(fc / iw, fh / ih), sw = fc / s, sh = fh / s;
  let px;
  g.imageSmoothingQuality = 'high';
  try { g.drawImage(img, (iw - sw) * 0.5, (ih - sh) * 0.58, sw, sh, 0, 0, fc, fh); px = g.getImageData(0, 0, fc, fh).data; } catch (e) { return; }
  for (let r = 0; r < fh; r++) for (let c = 0; c < fc; c++) {
    const i = (rA + r) * cols + cA + c, p = (r * fc + c) * 4;
    if (blk[i] || gl[i]) continue;
    const R = px[p] >> 5, G = px[p + 1] >> 5, B = px[p + 2] >> 5, q = R << 6 | G << 3 | B;
    const L = (0.2126 * px[p] + 0.7152 * px[p + 1] + 0.0722 * px[p + 2]) / 255;
    const rad = (0.5 + M.pow(L, 1.5) * P * 0.36) * M.min(1, M.max(0, (c / fc - 0.18) / 0.4));
    if (rad < 0.45) continue;
    if (!PK.has(q)) { if (PAL.length > 250) continue; PAL.push(`rgb(${R * 32 + 16} ${G * 32 + 16} ${B * 32 + 16}/.5)`); PK.set(q, PAL.length); }
    hc[i] = PK.get(q); hr[i] = rad;
  }
}

// Each outline slot takes the nearest free grid dot; the grid gives those dots up.
function assign(proj, anim) {
  const S = P / 2, sl = [];
  for (const [r, s, k] of proj) {
    if (!r.width || !r.height) continue;
    const L = M.max(fr.left, s ? s.left : -1e9) - 1, R = M.min(fr.right, s ? s.right : 1e9) + 1, Tp = M.max(fr.top, s ? s.top : -1e9) - 1, B = M.min(fr.bottom, s ? s.bottom : 1e9) + 1;
    const x0 = r.left + k, y0 = r.top + k, w = r.width - 2 * k, h = r.height - 2 * k, nx = M.max(1, M.round(w / S)), ny = M.max(1, M.round(h / S));
    const put = (X, Y) => { if (X >= L && X <= R && Y >= Tp && Y <= B) sl.push(X, Y); };
    for (let i = 0; i < nx; i++) { put(x0 + i * w / nx, y0); put(x0 + w - i * w / nx, y0 + h); }
    for (let j = 0; j < ny; j++) { put(x0 + w, y0 + j * h / ny); put(x0, y0 + h - j * h / ny); }
  }
  pk.set(kind); kind.fill(0);
  for (let i = 0; i < N; i++) { tx[i] = hx(i); ty[i] = hy(i); }
  for (let s = 0; s < sl.length; s += 2) {
    const X = sl[s], Y = sl[s + 1], c = cx(X), r = cy(Y);
    let best = -1, bd = 1e9;
    for (let d = 0; d < 7 && best < 0; d++) for (let j = r - d; j <= r + d; j++) for (let k = c - d; k <= c + d; k++) {
      if (j < 0 || k < 0 || j >= rows || k >= cols || (M.abs(j - r) < d && M.abs(k - c) < d)) continue;
      const i = j * cols + k, q = (hx(i) - X) ** 2 + (hy(i) - Y) ** 2;
      if (!kind[i] && q < bd) { bd = q; best = i; }
    }
    if (best >= 0) { kind[best] = 1; tx[best] = X; ty[best] = Y; }
  }
  let moved = false;
  for (let i = 0; i < N && !moved; i++) moved = kind[i] !== pk[i] || (kind[i] && (x[i] !== tx[i] || y[i] !== ty[i]));
  if (anim && moved) { fx.set(x); fy.set(y); mig = performance.now(); kick(); return; }
  mig = -1; x.set(tx); y.set(ty); draw(1);
}

// One path per fill style. k is the migration progress (1 = held).
function draw(k) {
  ctx.clearRect(0, 0, W, Ht);
  const G = Array.from({ length: 9 }, () => new Path2D()), HT = new Map();
  const dot = (p, X, Y, r) => { p.moveTo(X + r, Y); p.arc(X, Y, r, 0, TAU); };
  for (let i = 0; i < N; i++) {
    const X = x[i], Y = y[i], v = a[i];
    if (kind[i]) dot(k < 1 ? G[7] : G[6], X, Y, 1 + 0.35 * k);
    else if (k < 1 && pk[i]) dot(G[8], X, Y, 1.35 - 0.35 * k);
    else if (v >= 0.12) { const l = v >= 0.7 ? 4 : v >= 0.35 ? 3 : 2; dot(G[l], X, Y, RW[l - 2]); }
    else if (gl[i] === 1) dot(G[5], X, Y, 2.3);
    else if (hc[i]) { let p = HT.get(hc[i]); if (!p) HT.set(hc[i], p = new Path2D()); dot(p, X, Y, hr[i]); }
    else dot(G[blk[i] === 1 ? 1 : 0], X, Y, 1);
  }
  HT.forEach((p, q) => { ctx.fillStyle = PAL[q - 1]; ctx.fill(p); });
  const F = C.concat(`rgb(207 201 187/${0.3 + 0.65 * k})`, `rgb(207 201 187/${0.95 - 0.65 * k})`);
  G.forEach((p, j) => { ctx.fillStyle = F[j]; ctx.fill(p); });
}

// The loop runs only while something moves: a migration, a camera follow or a decaying wake.
const wakeOn = () => motion && live && vis && !document.hidden;
function kick() { if (!raf && live && vis && !document.hidden) raf = requestAnimationFrame(frame); }
function stop() { cancelAnimationFrame(raf); raf = 0; last = 0; }
function settle() { if (mig >= 0) { mig = -1; x.set(tx); y.set(ty); } }
function calm() { waking = false; ptr = null; if (a) a.fill(0); }
function frame(now) {
  raf = 0;
  if (!live || !vis || document.hidden) { last = 0; return; }
  const dt = last ? M.min(0.1, (now - last) / 1000) : 0;
  let busy = false, k = 1;
  last = now;
  if (follow && now < follow) { layout(false); busy = true; } else follow = 0;
  if (mig >= 0) {
    const t = M.min(1, (now - mig) / DUR);
    k = ease(t);
    for (let i = 0; i < N; i++) { x[i] = fx[i] + (tx[i] - fx[i]) * k; y[i] = fy[i] + (ty[i] - fy[i]) * k; }
    if (t >= 1) { mig = -1; k = 1; } else busy = true;
  }
  if (waking) {
    const fresh = ptr && wakeOn() && now - lastIn < 120;
    let act = false;
    spd *= M.exp(-3 * dt);
    for (let i = 0; i < N; i++) if (a[i] > 0) { a[i] = M.max(0, a[i] - dt / 3.2); act = act || a[i] > 0; }
    if (fresh) {
      const q = 1 - M.exp(-7 * dt), pi = cy(ptr.y) * cols + cx(ptr.x);
      bx += (ptr.x - bx) * q; by += (ptr.y - by) * q;
      if (pi >= 0 && pi < N && !blk[pi]) {
        const sg = M.min(10, 3 + 0.012 * spd) * P, s2 = 2 * sg * sg, R = 3 * sg, c0 = M.max(0, cx(bx - R)), c1 = M.min(cols - 1, cx(bx + R)), r1 = M.min(rows - 1, cy(by + R));
        for (let j = M.max(0, cy(by - R)); j <= r1; j++) for (let c = c0; c <= c1; c++) {
          const i = j * cols + c, d2 = (hx(i) - bx) ** 2 + (hy(i) - by) ** 2;
          if (!blk[i] && !kind[i] && d2 < R * R) a[i] = M.max(a[i], M.exp(-d2 / s2));
        }
        act = true;
      }
    }
    waking = act || fresh;
    busy = busy || waking;
  }
  draw(k);
  if (busy) raf = requestAnimationFrame(frame); else last = 0;
}

// Pointer wake: pointer only (never touch), passive.
addEventListener('pointermove', (e) => {
  if (e.pointerType === 'touch' || !wakeOn()) return;
  const now = performance.now(), p = { x: e.clientX, y: e.clientY };
  if (ptr) spd = 0.82 * spd + 0.18 * M.hypot(p.x - ptr.x, p.y - ptr.y) / M.max(0.001, (now - lastIn) / 1000);
  else { bx = p.x; by = p.y; }
  ptr = p; lastIn = now; waking = true; kick();
}, { passive: true });
H.addEventListener('pointerleave', () => { ptr = null; }, { passive: true });

// The Motion toggle, in the footer after Shortcuts; words from the deck's copy.
const sc = $('.d-foot [data-act="shortcuts"]');
if (sc) {
  const b = document.createElement('button'), n = document.createElement('span'), l = document.createElement('span'), st = document.createElement('b');
  b.type = 'button'; b.className = 'btn btn-quiet d-sc dm-mo'; b.setAttribute('aria-describedby', 'dm-mo-n');
  l.textContent = T['deck.motion.label']; b.append(l, ' ', st);
  n.id = 'dm-mo-n'; n.className = 'sr-only'; n.textContent = T['deck.motion.note'];
  const sync = () => { b.setAttribute('aria-pressed', String(motion)); st.textContent = T[motion ? 'deck.motion.on' : 'deck.motion.off']; };
  b.addEventListener('click', () => { motion = !motion; store(motion ? 'on' : 'off'); sync(); if (!motion && live) { calm(); settle(); draw(1); } });
  sync(); sc.after(b, n);
}

// Sizing (re-reads devicePixelRatio), events, start.
function resize() {
  const dpr = M.min(2, devicePixelRatio || 1);
  P = parseFloat(getComputedStyle(H).fontSize) || 16; W = innerWidth; Ht = innerHeight;
  cv.width = M.round(W * dpr); cv.height = M.round(Ht * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  cols = 0; calm(); layout(false);
}
const sched = (fn) => { let q = 0; return () => { if (!q) q = requestAnimationFrame(() => { q = 0; fn(); }); }; };
const onResize = sched(resize), onScroll = sched(() => { settle(); layout(false); });
const dprWatch = () => matchMedia(`(resolution: ${devicePixelRatio || 1}dppx)`).addEventListener('change', () => { onResize(); dprWatch(); }, { once: true });
addEventListener('resize', onResize, { passive: true });
field.addEventListener('scroll', onScroll, { passive: true });
mqS.addEventListener('change', onResize);
mqR.addEventListener('change', () => { settle(); layout(false); });
let prev = {};
document.addEventListener('deck:change', (e) => {
  const d = e.detail, cam = d.console === 'system' && prev.console === 'system' && d.step !== prev.step;
  prev = d; calm();
  // a stage step moves the camera for 420 ms: the outline follows it rather than migrating
  if (cam && live && H.dataset.mode === 'projected' && !mqR.matches) { settle(); follow = performance.now() + 480; kick(); } else layout(true);
});
document.addEventListener('deck:mode', () => layout(true));
document.addEventListener('visibilitychange', () => { if (document.hidden) { stop(); calm(); } else if (live) { settle(); draw(1); } });
new IntersectionObserver(([e]) => { vis = e.isIntersecting; if (!vis) stop(); else if (live) { settle(); draw(1); } }).observe(cv);
const im = new Image();
im.onload = () => { img = im; layout(false); };
im.src = new URL('../../assets/photos/overcast-horizon-720.jpg', location.href).href;
dprWatch(); resize();
})();
