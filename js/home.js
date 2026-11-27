// ANT1 home: the colony hero, the drain, the farm, the swap, live queens, the vamp radar, the colony, five deep.
import { $, $$, esc, short, copy, reduced, fit, whileVisible, isAddr, clamp, ease } from './util.js';
import { C, RGB, ant, halftone, ball, bez, dotted, along, lengths } from './scenes.js';

const api = (p, o) => fetch('/api/' + p, o).then(r => r.json()).catch(() => null);
const usd = n => n == null ? '—' : n >= 1e9 ? '$' + (n / 1e9).toFixed(2) + 'B' : n >= 1e6 ? '$' + (n / 1e6).toFixed(2) + 'M' : n >= 1e3 ? '$' + (n / 1e3).toFixed(1) + 'K' : '$' + Math.round(n);
const chg = v => v == null ? '<span>—</span>' : `<span class="${v >= 0 ? 'up' : 'dn'}">${v >= 0 ? '+' : ''}${Math.abs(v) >= 100 ? Math.round(v) : v.toFixed(1)}%</span>`;
const sym = s => '$' + String(s || '?').replace(/^\$/, '');
const pic = (img, s) => `${img ? `<img src="${esc(img)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">` : ''}${esc(String(s || '?').replace(/^\$/, '').slice(0, 1).toUpperCase())}`;
const hash = s => { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967295; };

// ---------- nav: solid once you scroll, the link for the band you're in
const nav = $('#nav');
const onScroll = () => nav.classList.toggle('solid', scrollY > 40);
addEventListener('scroll', onScroll, { passive: true }); onScroll();
const links = $$('.nav .links a[href^="#"]'), secs = $$('main > section[id]');
const active = () => {
  const y = innerHeight * 0.42; let cur = null;
  for (const s of secs) { const r = s.getBoundingClientRect(); if (r.top <= y && r.bottom > y) cur = s.id; }
  links.forEach(a => a.classList.toggle('on', !!cur && a.getAttribute('href') === '#' + cur));
};
addEventListener('scroll', active, { passive: true }); active();

// ---------- reveal
const rio = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('vis'); rio.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px' });
$$('.rv').forEach(el => rio.observe(el));
setTimeout(() => $$('.rv').forEach(el => { const r = el.getBoundingClientRect(); if (r.top < innerHeight) el.classList.add('vis'); }), 2500);   // backstop

// =====================================================================================================
// HERO: the colony. Ants walk dotted trails into the queen carrying food; returning ants walk back out.
// Click anywhere to drop food: the nearest free ant fetches it.
(() => {
  const cv = $('#cvHero'); if (!cv) return;
  let W = 0, H = 0, D = 1, Q = { x: 0, y: 0, R: 100, gulp: 0 }, trails = [], ants = [], crumbs = [], rings = [], bits = [], splashes = [], tags = [], layer = null, last = 0, auto = 2.5, autoN = 0;
  const LANE = 4.2;
  const layout = () => {
    const r = cv.getBoundingClientRect(); W = r.width; H = r.height; D = Math.min(W < 760 ? 1.5 : 2, devicePixelRatio || 1);
    cv.width = Math.round(W * D); cv.height = Math.round(H * D);
    const m = W < 760;
    Q.R = m ? Math.min(W * 0.31, 128) : clamp(Math.min(H * 0.29, W * 0.19), 150, 268);
    Q.x = m ? W * 0.5 : W * 0.735; Q.y = m ? H - Q.R - 92 : H * 0.47;
    window.__ant1Q = Q;   // the intro hands the queen over to exactly this spot
    const starts = m
      ? [[-30, H * 0.62], [-30, H * 0.9], [W * 0.18, H + 30], [W * 0.82, H + 30], [W + 30, H * 0.66], [W + 30, H * 0.94]]
      : [[-30, H * 0.95], [W * 0.18, H + 30], [W * 0.42, H + 30], [W * 0.62, H + 30], [W * 0.9, H + 30], [W + 30, H * 0.8], [W + 30, H * 0.42], [W + 30, H * 0.2], [W + 30, H * 0.07], [W * 0.98, -30]];   // nothing enters under the nav links
    trails = starts.map((s, i) => {
      const a = Math.atan2(s[1] - Q.y, s[0] - Q.x), e = [Q.x + Math.cos(a) * (Q.R + 5), Q.y + Math.sin(a) * (Q.R + 5)];
      const mx = (s[0] + e[0]) / 2, my = (s[1] + e[1]) / 2, len = Math.hypot(e[0] - s[0], e[1] - s[1]);
      let ctl;
      if (s[1] > H * 0.6 && s[0] < Q.x) ctl = [mx + len * 0.1, Math.max(my, Q.y) + len * 0.16];   // low trails sag downward, away from the words
      else { const nx = -(e[1] - s[1]) / len, ny = (e[0] - s[0]) / len, k = (i % 2 ? 1 : -1) * len * (0.14 + 0.08 * hash(i)); ctl = [mx + nx * k, my + ny * k]; }
      const pts = bez(s, ctl, e, 3); return { pts, cum: lengths(pts) };
    });
    // the still layer: a faint dot grid and the trails
    layer = document.createElement('canvas'); layer.width = cv.width; layer.height = cv.height;
    const g = layer.getContext('2d'); g.scale(D, D);
    g.fillStyle = 'rgba(170,170,210,.07)'; for (let y = 12; y < H; y += 24) for (let x = 12; x < W; x += 24) { g.beginPath(); g.arc(x, y, 0.95, 0, 6.2832); g.fill(); }
    trails.forEach(t => dotted(g, t.pts, 4, 1.25, 'rgba(255,176,58,.2)'));
    const n = m ? 16 : 34;
    ants = Array.from({ length: n }, (_, i) => {
      const tr = i % trails.length, T = trails[tr], L = T.cum[T.cum.length - 1], inb = i % 3 !== 0;
      return { tr, dir: inb ? 1 : -1, s: hash(i * 7.3) * L, v: 30 + hash(i * 3.1) * 22, u: m ? 2.1 + hash(i) * 0.5 : 2.4 + hash(i) * 0.7, carry: inb, free: null, ph: hash(i) * 6 };
    });
  };
  const posOf = a => {
    if (a.free) { const [x, y, h] = along(a.free.pts, a.free.cum, a.free.s); return [x, y, h]; }
    const T = trails[a.tr], [x, y, h] = along(T.pts, T.cum, a.s), side = a.dir > 0 ? 1 : -1;
    return [x - Math.sin(h) * LANE * side, y + Math.cos(h) * LANE * side, a.dir > 0 ? h : h + Math.PI];
  };
  const deliver = (x, y, big, label) => { Q.gulp = Math.min(0.07, Q.gulp + (big ? 0.03 : 0.012)); if (big) rings.push({ t: 0 }); splashes.push({ x, y, t: 0 }); bits.push({ x, y, t: 0 }); if (label) tags.push({ x, y, t: 0, label }); };
  const drop = (x, y, label) => {
    if (Math.hypot(x - Q.x, y - Q.y) < Q.R + 10 || crumbs.length > 10) return;
    let best = null, bd = 1e9;
    for (const a of ants) { if (a.free) continue; const [ax, ay] = posOf(a), d = Math.hypot(ax - x, ay - y) + (a.carry ? 420 : 0); if (d < bd) { bd = d; best = a; } }
    const cr = { x, y, t: 0, taken: false, label: label || null }; crumbs.push(cr);
    if (!best) return;
    const [ax, ay] = posOf(best), mid = [(ax + x) / 2 + (y - ay) * 0.18, (ay + y) / 2 - (x - ax) * 0.18], pts = bez([ax, ay], mid, [x, y], 3);
    best.free = { pts, cum: lengths(pts), s: 0, stage: 'fetch', cr }; best.carry = false;
  };
  cv.addEventListener('pointerdown', e => { const r = cv.getBoundingClientRect(); drop(e.clientX - r.left, e.clientY - r.top); });
  const step = dt => {
    Q.gulp *= Math.exp(-dt * 3.2);
    for (const a of ants) {
      a.ph += dt * a.v * 0.55;
      if (a.free) {
        const f = a.free; f.s += a.v * 1.25 * dt;
        if (f.s >= f.cum[f.cum.length - 1]) {
          if (f.stage === 'fetch') {
            f.cr.taken = true; crumbs = crumbs.filter(c => c !== f.cr); a.carry = true; a.label = f.cr.label;
            const s0 = [f.cr.x, f.cr.y], ang = Math.atan2(s0[1] - Q.y, s0[0] - Q.x), e = [Q.x + Math.cos(ang) * (Q.R + 5), Q.y + Math.sin(ang) * (Q.R + 5)];
            const mid = [(s0[0] + e[0]) / 2 + (e[1] - s0[1]) * 0.12, (s0[1] + e[1]) / 2 - (e[0] - s0[0]) * 0.12], pts = bez(s0, mid, e, 3);
            a.free = { pts, cum: lengths(pts), s: 0, stage: 'home' };
          } else {
            const [x, y] = along(f.pts, f.cum, f.s); deliver(x, y, true, a.label); a.carry = false; a.label = null;
            let bi = 0, bd = 1e9; trails.forEach((t, i) => { const p = t.pts[t.pts.length - 1], d = Math.hypot(p[0] - x, p[1] - y); if (d < bd) { bd = d; bi = i; } });
            a.free = null; a.tr = bi; a.dir = -1; a.s = trails[bi].cum[trails[bi].cum.length - 1];
          }
        }
        continue;
      }
      const T = trails[a.tr], L = T.cum[T.cum.length - 1];
      a.s += a.v * dt * a.dir;
      if (a.dir > 0 && a.s >= L) { const [x, y] = posOf(a); deliver(x, y); a.dir = -1; a.carry = false; a.s = L; }
      else if (a.dir < 0 && a.s <= 0) { a.dir = 1; a.carry = true; a.s = 0; if (hash(a.ph) < 0.35) a.tr = Math.floor(hash(a.ph * 1.7) * trails.length); }
    }
    rings.forEach(r => (r.t += dt / 1.3)); rings = rings.filter(r => r.t < 1);
    splashes.forEach(p => (p.t += dt / 0.7)); splashes = splashes.filter(p => p.t < 1);
    tags.forEach(p => (p.t += dt / 1.6)); tags = tags.filter(p => p.t < 1);
    // every few seconds the colony finds food on its own, so you can see what a click does
    auto -= dt; if (auto <= 0 && !crumbs.length) { auto = 4.2; autoN++; const m = W < 760, fx = m ? [0.2, 0.8, 0.5, 0.3, 0.7] : [0.5, 0.62, 0.9, 0.42, 0.97], fy = m ? [0.68, 0.7, 0.66, 0.92, 0.9] : [0.86, 0.12, 0.9, 0.93, 0.5]; const live = trending.length ? trending[autoN % Math.min(12, trending.length)] : null; drop(W * fx[autoN % 5], H * fy[autoN % 5], live ? sym(live.symbol) : null); }
    bits.forEach(b => (b.t += dt / 0.6)); bits = bits.filter(b => b.t < 1);
    crumbs.forEach(c => (c.t += dt));
  };
  const draw = t => {
    const c = cv.getContext('2d'); c.setTransform(D, 0, 0, D, 0, 0); c.clearRect(0, 0, W, H);
    if (layer) c.drawImage(layer, 0, 0, W, H);
    // the queen breathes, gulps when fed, and her light drifts
    const R = Q.R * (1 + Math.sin(t * 1.3) * 0.012 + Q.gulp), la = -2.35 + Math.sin(t * 0.33) * 0.42;
    halftone(c, Q.x, Q.y, R, RGB.amber, W < 760 ? 7.5 : 9, [Math.cos(la) * 0.77, Math.sin(la) * 0.77, 0.63]);
    for (const r of rings) { const rr = Q.R * (1.05 + ease(r.t) * 0.42), n = 72; c.fillStyle = `rgba(255,176,58,${(1 - r.t) * 0.55})`; for (let k = 0; k < n; k++) { const a = k / n * 6.2832; c.beginPath(); c.arc(Q.x + Math.cos(a) * rr, Q.y + Math.sin(a) * rr, 1.4, 0, 6.2832); c.fill(); } }
    // a small splash on her skin where each crumb lands
    for (const p of splashes) { const rr = 4 + ease(p.t) * 20, n = 14; c.fillStyle = `rgba(255,211,138,${(1 - p.t) * 0.8})`; for (let k = 0; k < n; k++) { const a = k / n * 6.2832; c.beginPath(); c.arc(p.x + Math.cos(a) * rr, p.y + Math.sin(a) * rr, 1.2, 0, 6.2832); c.fill(); } }
    // pheromone: every carrier leaves a short warm trail behind it
    for (const a of ants) {
      if (!a.carry) continue;
      if (a.free) { for (let k = 1; k <= 9; k++) { const s2 = a.free.s - k * 6; if (s2 < 0) break; const [x, y] = along(a.free.pts, a.free.cum, s2); c.fillStyle = `rgba(255,176,58,${0.55 * (1 - k / 10)})`; c.beginPath(); c.arc(x, y, 1.5, 0, 6.2832); c.fill(); } continue; }
      const T = trails[a.tr];
      for (let k = 1; k <= 9; k++) { const s2 = a.s - k * 6 * a.dir; if (s2 < 0) break; const [x, y, h] = along(T.pts, T.cum, s2); c.fillStyle = `rgba(255,176,58,${0.5 * (1 - k / 10)})`; c.beginPath(); c.arc(x - Math.sin(h) * LANE, y + Math.cos(h) * LANE, 1.5, 0, 6.2832); c.fill(); }
    }
    for (const b of bits) { const k = ease(b.t), x = b.x + (Q.x - b.x) * k * 0.55, y = b.y + (Q.y - b.y) * k * 0.55; c.fillStyle = `rgba(255,211,138,${1 - b.t})`; c.beginPath(); c.arc(x, y, 2.6 * (1 - b.t * 0.5), 0, 6.2832); c.fill(); }
    for (const cr of crumbs) {
      const pop = Math.min(1, cr.t * 3), sc = pop < 1 ? 1 + Math.sin(pop * Math.PI) * 0.6 : 1;
      c.fillStyle = C.amber; c.beginPath(); c.arc(cr.x, cr.y, (cr.label ? 5 : 3.6) * sc * pop, 0, 6.2832); c.fill();
      const rr = 8 + (cr.t * 14 % 10); c.fillStyle = `rgba(255,176,58,${0.5 - (cr.t * 14 % 10) / 22})`; for (let k = 0; k < 16; k++) { const a = k / 16 * 6.2832; c.beginPath(); c.arc(cr.x + Math.cos(a) * rr, cr.y + Math.sin(a) * rr, 1, 0, 6.2832); c.fill(); }
      if (cr.label) { c.globalAlpha = pop; tagText(c, cr.label, cr.x, cr.y - 16 - (1 - pop) * 8); c.globalAlpha = 1; }
    }
    for (const p of tags) { const k = ease(p.t), x = p.x + (Q.x - p.x) * k * 0.25, y = p.y - k * 46; c.globalAlpha = 1 - p.t; tagText(c, '+' + p.label, x, y, true); c.globalAlpha = 1; }
    for (const a of ants) { const [x, y, h] = posOf(a); ant(c, x, y, a.u, h, a.carry ? C.ink : 'rgba(242,242,247,.62)', { phase: a.ph, crumb: a.carry ? C.amber : null }); if (a.label && a.carry) tagText(c, a.label, x, y - 15); }
  };
  // a ticker on a small dark pill, so it reads over the queen's dots
  function tagText(c, t, x, y, gold) {
    c.font = '700 11px JB, ui-monospace, monospace'; const w = c.measureText(t).width + 12;
    c.fillStyle = 'rgba(7,7,11,.82)'; c.beginPath(); c.roundRect ? c.roundRect(x - w / 2, y - 10, w, 18, 9) : c.rect(x - w / 2, y - 10, w, 18); c.fill();
    c.fillStyle = gold ? C.amber2 : C.amber; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(t, x, y); c.textBaseline = 'alphabetic';
  }
  layout(); let rt = 0; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(layout, 120); });
  if (reduced) { draw(0); return; }
  whileVisible(cv, (t, now) => { const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016); last = now; step(dt); draw(t); });
  document.addEventListener('visibilitychange', () => { last = 0; });
})();

// =====================================================================================================
// 01 THE DRAIN: a vamp pulls buyers away from the original; an ant routes them through the queen.
function duel(cv, mode) {
  if (!cv) return;
  let buyers = [], hops = [], massA = 0, massB = 0, cyc = 0, spawn = 0, leak = 0, line = [], lineT = 0, lastT = 0;
  const reset = () => { buyers = []; hops = []; massA = 40; massB = mode === 'vamp' ? 4 : 10; cyc = 0; line = Array.from({ length: 90 }, () => 0.5); };
  reset();
  const draw = (t) => {
    const [c, W, H] = fit(cv, 2), dt = Math.min(0.05, lastT ? t - lastT : 0.016); lastT = t; cyc += dt;
    const A = [W * 0.3, H * 0.5], B = [W * 0.72, H * 0.5], base = Math.min(H * 0.2, 62);
    const rA = base * Math.sqrt(massA / 40), rB = base * 0.72 * Math.sqrt(massB / (mode === 'vamp' ? 10 : 12));
    spawn -= dt;
    if (spawn <= 0 && cyc < 8.5) {
      spawn = 0.22 + Math.random() * 0.2; const x0 = W * (0.12 + Math.random() * 0.76), p0 = [x0, H + 8];
      const goB = mode === 'vamp' ? Math.random() < 0.86 : false, tgt = goB ? B : A, end = [tgt[0], tgt[1] + (goB ? rB : rA) * 0.6];
      const pts = bez(p0, [(x0 + end[0]) / 2 + (Math.random() - 0.5) * 80, H * 0.86], end, 3); buyers.push({ pts, cum: lengths(pts), s: 0, to: goB ? 'B' : 'A' });
    }
    if (mode === 'vamp') { leak -= dt; if (leak <= 0 && cyc < 8.5 && massA > 8) { leak = 0.5; const pts = bez([A[0] + rA * 0.7, A[1] - rA * 0.3], [(A[0] + B[0]) / 2, A[1] - H * 0.3], [B[0] - rB * 0.7, B[1] - rB * 0.3], 3); hops.push({ pts, cum: lengths(pts), s: 0, leak: true }); massA -= 1.1; } }
    buyers.forEach(b => (b.s += 170 * dt)); hops.forEach(h => (h.s += 190 * dt));
    buyers = buyers.filter(b => {
      if (b.s < b.cum[b.cum.length - 1]) return true;
      if (b.to === 'B') massB += 1.1; else { massA += mode === 'ant' ? 0.7 : 1; if (mode === 'ant') { const pts = bez([A[0] + rA * 0.8, A[1] - rA * 0.2], [(A[0] + B[0]) / 2, A[1] - H * 0.26], [B[0] - rB * 0.8, B[1] - rB * 0.2], 3); hops.push({ pts, cum: lengths(pts), s: 0 }); } }
      return false;
    });
    hops = hops.filter(h => { if (h.s < h.cum[h.cum.length - 1]) return true; massB += h.leak ? 1.1 : 0.8; return false; });
    massA = clamp(massA, 6, 120); massB = clamp(massB, 2, 70);
    if (cyc > 10.5) reset();
    // the chart of the original along the bottom
    lineT += dt; if (lineT > 0.09) { lineT = 0; line.shift(); const prev = line[line.length - 1], drift = mode === 'vamp' ? -0.006 : 0.006; line.push(clamp(prev + drift + (Math.random() - 0.5) * 0.03, 0.05, 0.95)); }
    c.clearRect(0, 0, W, H);
    c.fillStyle = 'rgba(170,170,210,.06)'; for (let y = 10; y < H; y += 20) for (let x = 10; x < W; x += 20) { c.beginPath(); c.arc(x, y, 0.8, 0, 6.2832); c.fill(); }
    const fade = cyc > 9.6 ? 1 - (cyc - 9.6) / 0.9 : cyc < 0.4 ? cyc / 0.4 : 1; c.globalAlpha = clamp(fade, 0, 1);
    // chart
    c.strokeStyle = mode === 'vamp' ? 'rgba(255,93,108,.55)' : 'rgba(255,176,58,.6)'; c.lineWidth = 1.6; c.beginPath();
    line.forEach((v, i) => { const x = 18 + (W - 36) * i / (line.length - 1), y = H - 16 - v * 34; i ? c.lineTo(x, y) : c.moveTo(x, y); }); c.stroke();
    // trails
    for (const h of hops) { dotted(c, h.pts, 5, 1, h.leak ? 'rgba(255,93,108,.18)' : 'rgba(255,176,58,.2)'); const [x, y] = along(h.pts, h.cum, h.s); c.fillStyle = h.leak ? C.amber : C.amber; c.beginPath(); c.arc(x, y, 3.2, 0, 6.2832); c.fill(); }
    for (const b of buyers) { const [x, y] = along(b.pts, b.cum, b.s); c.fillStyle = C.ink; c.beginPath(); c.arc(x, y, 2.6, 0, 6.2832); c.fill(); }
    halftone(c, A[0], A[1], rA, RGB.amber, Math.max(4, rA / 6.5));
    halftone(c, B[0], B[1], rB, mode === 'vamp' ? RGB.red : RGB.ink, Math.max(4, rB / 6));
    c.font = '600 10.5px JB, ui-monospace, monospace'; c.textAlign = 'center'; c.fillStyle = C.dim;
    c.fillText(mode === 'vamp' ? 'THE ORIGINAL' : 'THE QUEEN', A[0], A[1] + base * 1.55 + 12); c.fillText(mode === 'vamp' ? 'THE VAMP' : 'HER ANT', B[0], B[1] + base * 1.55 + 12);
    c.globalAlpha = 1;
  };
  if (reduced) { for (let i = 0; i < 120; i++) draw(i / 30); return; }
  whileVisible(cv, t => draw(t));
}
duel($('#cvVamp'), 'vamp'); duel($('#cvAnt'), 'ant');

// =====================================================================================================
// 02 THE FARM: five chambers carved in the soil, one tunnel, one ant carrying food through them.
(() => {
  const farm = $('#farm'), cv = $('#cvFarm'); if (!farm || !cv) return;
  const steps = $$('#farm li');
  let geo = null, soil = null, s = 0, pause = 0, lit = -1, lastT = 0, pile = 0;
  const build = () => {
    const fr = farm.getBoundingClientRect(), D = Math.min(2, devicePixelRatio || 1), W = fr.width, H = fr.height, mob = W < 700;
    const ch = steps.map(li => { const r = li.querySelector('.ch').getBoundingClientRect(); return mob ? { x: r.left - fr.left + 48, y: r.top - fr.top + r.height / 2, rx: 34, ry: 28 } : { x: r.left - fr.left + r.width / 2, y: r.top - fr.top + r.height / 2 + (r.height > 170 ? 14 : 0), rx: Math.min(r.width * 0.42, 86), ry: 42 }; });
    const SURF = 30, pts = [];
    // the ant comes down from the surface into the first chamber
    const first = mob ? [ch[0].x, SURF] : [ch[0].x - Math.min(110, ch[0].rx + 40), SURF];
    pts.push(...bez(first, mob ? [ch[0].x + 26, (SURF + ch[0].y) / 2] : [first[0] - 10, ch[0].y], [ch[0].x, ch[0].y], 3));
    for (let i = 0; i < ch.length - 1; i++) { const a = ch[i], b = ch[i + 1], mid = mob ? [a.x + 34 * (i % 2 ? -1 : 1), (a.y + b.y) / 2] : [(a.x + b.x) / 2, Math.max(a.y, b.y) + 70]; pts.push(...bez([a.x, a.y], mid, [b.x, b.y], 3).slice(1)); }
    const cum = lengths(pts);
    const stops = ch.map(cc => { let bi = 0, bd = 1e9; pts.forEach((p, i) => { const d = Math.hypot(p[0] - cc.x, p[1] - cc.y); if (d < bd) { bd = d; bi = i; } }); return cum[bi]; });
    soil = document.createElement('canvas'); soil.width = Math.round(W * D); soil.height = Math.round(H * D); const g = soil.getContext('2d'); g.scale(D, D);
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    // the sky above ground, then the earth in layers
    g.fillStyle = '#07070b'; g.fillRect(0, 0, W, SURF);
    const bands = ['#120f0a', '#100d09', '#0e0b08', '#0c0a07', '#0b0906', '#0a0806'];
    for (let b = 0; b < bands.length; b++) {
      const y0 = SURF + (H - SURF) * b / bands.length, amp = 4 + b * 1.5, f = 0.012 + b * 0.003;
      g.fillStyle = bands[b]; g.beginPath(); g.moveTo(0, H);
      for (let x = 0; x <= W; x += 8) g.lineTo(x, y0 + Math.sin(x * f + b * 1.7) * amp); g.lineTo(W, H); g.closePath(); g.fill();
      if (b) { g.fillStyle = 'rgba(255,200,140,.07)'; for (let x = 0; x <= W; x += 7) { g.beginPath(); g.arc(x, y0 + Math.sin(x * f + b * 1.7) * amp, 0.8, 0, 6.2832); g.fill(); } }
    }
    // the surface: a hairline of ground with grass tufts
    g.fillStyle = 'rgba(255,200,140,.18)'; g.fillRect(0, SURF - 1, W, 1.2);
    g.strokeStyle = 'rgba(242,242,247,.16)'; g.lineWidth = 1; g.lineCap = 'round';
    for (let x = 6; x < W; x += 9 + rnd() * 16) { const n = 2 + (rnd() * 3 | 0); for (let k = 0; k < n; k++) { const hh = 4 + rnd() * 8, lean = (rnd() - 0.5) * 5; g.beginPath(); g.moveTo(x + k * 2, SURF - 1); g.quadraticCurveTo(x + k * 2 + lean * 0.3, SURF - hh * 0.6, x + k * 2 + lean, SURF - hh); g.stroke(); } }
    // grain and pebbles
    for (let k = 0; k < W * H / 80; k++) { const y = SURF + rnd() * (H - SURF); g.fillStyle = `rgba(255,${200 + rnd() * 40 | 0},${150 + rnd() * 50 | 0},${0.02 + rnd() * 0.05})`; g.beginPath(); g.arc(rnd() * W, y, 0.5 + rnd() * 1.2, 0, 6.2832); g.fill(); }
    for (let k = 0; k < W / 18; k++) { const x = rnd() * W, y = SURF + 14 + rnd() * (H - SURF - 20), rx = 2 + rnd() * 5, ry = rx * (0.55 + rnd() * 0.3); g.fillStyle = 'rgba(255,215,170,.06)'; g.beginPath(); g.ellipse(x, y, rx, ry, rnd() * 3, 0, 6.2832); g.fill(); g.fillStyle = 'rgba(255,225,190,.1)'; g.beginPath(); g.arc(x - rx * 0.3, y - ry * 0.35, 0.8, 0, 6.2832); g.fill(); }
    // tunnels carved out: a lit rim, then the hollow
    const tw = mob ? 15 : 20, path = () => { g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); };
    g.lineCap = 'round'; g.lineJoin = 'round';
    g.strokeStyle = 'rgba(255,190,120,.16)'; g.lineWidth = tw + 4; path(); g.stroke();
    ch.forEach(cc => { g.fillStyle = 'rgba(255,190,120,.16)'; g.beginPath(); g.ellipse(cc.x, cc.y, cc.rx + 2.5, cc.ry + 2.5, 0, 0, 6.2832); g.fill(); });
    g.strokeStyle = '#050403'; g.lineWidth = tw; path(); g.stroke();
    ch.forEach(cc => {
      g.fillStyle = '#050403'; g.beginPath(); g.ellipse(cc.x, cc.y, cc.rx, cc.ry, 0, 0, 6.2832); g.fill();
      g.save(); g.beginPath(); g.ellipse(cc.x, cc.y, cc.rx, cc.ry, 0, 0, 6.2832); g.clip(); g.fillStyle = 'rgba(255,190,120,.07)'; g.beginPath(); g.ellipse(cc.x, cc.y + cc.ry * 0.95, cc.rx * 0.95, cc.ry * 0.42, 0, 0, 6.2832); g.fill(); g.restore();   // the chamber floor
    });
    dotted(g, pts, 6, 0.9, 'rgba(255,176,58,.14)');
    geo = { W, H, D, ch, pts, cum, stops, mob };
  };
  const icon = (c, i, cc, on, t) => {
    const k = on ? 1 : 0.62; c.globalAlpha = k;
    if (i === 0) halftone(c, cc.x, cc.y, cc.ry * 0.72, RGB.amber, 4);
    if (i === 1) { halftone(c, cc.x - cc.ry * 0.52, cc.y, cc.ry * 0.56, RGB.amber, 3.6); halftone(c, cc.x + cc.ry * 0.62, cc.y + 4, cc.ry * 0.38, RGB.ink, 3.2); }
    if (i === 2) { const p = (t * 0.8) % 1; for (let j = 0; j < 3; j++) { const x = cc.x - cc.rx * 0.6 + cc.rx * 1.2 * ((p + j / 3) % 1); c.fillStyle = j === 0 ? C.ink : C.amber; c.beginPath(); c.arc(x, cc.y + Math.sin(x * 0.08) * 4, 3, 0, 6.2832); c.fill(); } }
    if (i === 3) { const n = Math.min(26, 6 + Math.floor(pile)); for (let j = 0; j < n; j++) { const row = Math.floor(Math.sqrt(j * 2)), x = cc.x + (hash(j) - 0.5) * cc.rx * (0.4 + row * 0.12), y = cc.y + cc.ry * 0.45 - row * 5.2; c.fillStyle = j % 4 ? C.amber : C.amber2; c.beginPath(); c.arc(x, y, 2.6, 0, 6.2832); c.fill(); } }
    if (i === 4) { const sz = [cc.ry * 0.34, cc.ry * 0.24, cc.ry * 0.17]; let y = cc.y - cc.ry * 0.38; sz.forEach((r, j) => { halftone(c, cc.x + (j - 1) * cc.ry * 0.55, y, r, j ? RGB.ink : RGB.amber, 3); y += cc.ry * 0.36; }); }
    c.globalAlpha = 1;
  };
  const draw = t => {
    if (!geo) build(); const dt = Math.min(0.05, lastT ? t - lastT : 0.016); lastT = t;
    const [c, W, H] = fit(cv, 2); if (Math.abs(W - geo.W) > 2 || Math.abs(H - geo.H) > 2) build();
    const L = geo.cum[geo.cum.length - 1];
    if (pause > 0) pause -= dt; else {
      const ns = s + 62 * dt; const hit = geo.stops.findIndex(st => s < st && ns >= st);
      s = ns; if (hit >= 0) { pause = 1.25; lit = hit; steps.forEach((li, i) => li.classList.toggle('lit', i === hit)); if (hit === 3) pile += 3; }
      if (s > L + 60) { s = 0; lit = -1; if (pile > 22) pile = 0; }
    }
    c.clearRect(0, 0, W, H); c.drawImage(soil, 0, 0, W, H);
    geo.ch.forEach((cc, i) => {
      const on = i === lit; c.fillStyle = on ? 'rgba(255,176,58,.55)' : 'rgba(255,176,58,.16)'; const n = 54;
      for (let k = 0; k < n; k++) { const a = k / n * 6.2832; c.beginPath(); c.arc(cc.x + Math.cos(a) * (cc.rx + 3), cc.y + Math.sin(a) * (cc.ry + 3), on ? 1.5 : 1.1, 0, 6.2832); c.fill(); }
      icon(c, i, cc, on, t);
    });
    if (s <= L) {
      for (let k = 1; k <= 10; k++) { const s2 = s - k * 7; if (s2 < 0) break; const [x, y] = along(geo.pts, geo.cum, s2); c.fillStyle = `rgba(255,176,58,${0.45 * (1 - k / 11)})`; c.beginPath(); c.arc(x, y, 1.6, 0, 6.2832); c.fill(); }
      const [x, y, h] = along(geo.pts, geo.cum, s); ant(c, x, y, geo.mob ? 2.7 : 3.5, h, C.ink, { phase: pause > 0 ? Math.sin(t * 6) * 0.4 : s * 0.5, crumb: C.amber });
    }
  };
  let rt = 0; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => (geo = null), 150); });
  if (reduced) { steps.forEach(li => li.classList.add('lit')); build(); draw(0); return; }
  whileVisible(farm, t => draw(t));
})();

// =====================================================================================================
// 03 ONE SWAP: SOL → the queen → the ant (→ its ant), a packet running each hop.
(() => {
  const cv = $('#cvSwap'); if (!cv) return;
  let lvl = 1, lastT = 0, p = 0, pulse = [0, 0, 0, 0], fill = [0, 0, 0, 0];
  $$('#lv button').forEach(b => b.addEventListener('click', () => { lvl = +b.dataset.l; $$('#lv button').forEach(x => x.classList.toggle('on', x === b)); p = 0; fill = [0, 0, 0, 0]; }));
  const draw = t => {
    const [c, W, H] = fit(cv, 2), dt = Math.min(0.05, lastT ? t - lastT : 0.016); lastT = t;
    const n = lvl + 2, mob = W < 520, names = ['SOL', '$QUEEN', '$ANT', '$ANT²'], rgbs = [RGB.sol, RGB.amber, RGB.ink, RGB.ink];
    const xs = Array.from({ length: n }, (_, i) => W * (0.12 + 0.76 * i / (n - 1))), y = H * 0.44;
    const rs = (mob ? [18, 34, 26, 22] : [24, 48, 36, 30]).slice(0, n);
    const hops = n - 1, per = 1.05; p += dt / per; if (p > hops + 0.9) { p = 0; fill = fill.map(f => (f > 0.92 ? 0 : f)); }
    pulse = pulse.map(v => v * Math.exp(-dt * 5));
    c.clearRect(0, 0, W, H);
    c.fillStyle = 'rgba(170,170,210,.06)'; for (let yy = 10; yy < H; yy += 20) for (let x = 10; x < W; x += 20) { c.beginPath(); c.arc(x, yy, 0.8, 0, 6.2832); c.fill(); }
    c.font = '600 10.5px JB, ui-monospace, monospace'; c.textAlign = 'center';
    for (let i = 0; i < hops; i++) {
      const a = [xs[i] + rs[i] + 6, y], b = [xs[i + 1] - rs[i + 1] - 6, y], ctl = [(a[0] + b[0]) / 2, y - H * 0.2], pts = bez(a, ctl, b, 3), cum = lengths(pts);
      dotted(c, pts, 4, 1.2, 'rgba(255,176,58,.28)');
      c.fillStyle = C.dim; c.fillText('HOP ' + (i + 1), ctl[0], y - H * 0.13);
      const k = p - i; if (k > 0 && k < 1) { const [x, yy] = along(pts, cum, cum[cum.length - 1] * ease(k)); c.fillStyle = i === 0 ? C.ink : C.amber; c.beginPath(); c.arc(x, yy, 4.2, 0, 6.2832); c.fill(); }
      if (k >= 1 && k < 1 + dt / per * 1.5) { pulse[i + 1] = 1; fill[i + 1] = Math.min(1, fill[i + 1] + 0.14); }
    }
    xs.forEach((x, i) => {
      const r = rs[i] * (1 + pulse[i] * 0.08); halftone(c, x, y, r, rgbs[i], Math.max(3.2, r / 6));
      c.fillStyle = i === 1 ? C.amber : C.mute; c.font = `700 ${mob ? 10.5 : 12}px JB, ui-monospace, monospace`; c.fillText(names[i], x, y + rs[i] + 24);
      if (i >= 2) { // the ant's curve, filling with queen food
        const bw = mob ? 34 : 46, bh = 7, bx = x - bw / 2, by = y + rs[i] + 36; c.fillStyle = '#1a1a24'; c.fillRect(bx, by, bw, bh); c.fillStyle = C.amber; c.fillRect(bx, by, bw * fill[i], bh);
        c.fillStyle = C.dim; c.font = '600 9.5px JB, ui-monospace, monospace'; c.fillText('FOOD', x, by + 20);
      }
    });
    c.textAlign = 'left'; c.font = '600 11px JB, ui-monospace, monospace'; c.fillStyle = C.amber; c.fillText('1 TRANSACTION · ' + hops + ' HOPS', 18, 26);
  };
  if (reduced) { p = 1.5; draw(0); return; }
  whileVisible(cv, t => draw(t));
})();

// =====================================================================================================
// 07 FIVE DEEP: a tree of ants of ants; a buy at a leaf climbs to the root, buying each coin on the way.
(() => {
  const cv = $('#cvTree'); if (!cv) return;
  const N = [{ l: 0, x: .5, p: -1 }, { l: 1, x: .2, p: 0 }, { l: 1, x: .5, p: 0 }, { l: 1, x: .8, p: 0 }, { l: 2, x: .1, p: 1 }, { l: 2, x: .3, p: 1 }, { l: 2, x: .6, p: 2 }, { l: 2, x: .87, p: 3 }, { l: 3, x: .22, p: 5 }, { l: 3, x: .56, p: 6 }, { l: 3, x: .8, p: 7 }, { l: 4, x: .38, p: 8 }, { l: 4, x: .64, p: 9 }, { l: 5, x: .5, p: 11 }];
  const leaves = N.map((n, i) => i).filter(i => !N.some(m => m.p === i));
  let runs = [], next = 0, lastT = 0; const flash = N.map(() => 0);
  const route = i => { const r = []; while (i >= 0) { r.push(i); i = N[i].p; } return r; };
  const draw = t => {
    const [c, W, H] = fit(cv, 2), dt = Math.min(0.05, lastT ? t - lastT : 0.016); lastT = t;
    const top = 44, bot = H - 40, X = n => 70 + (W - 100) * n.x, Y = n => top + (bot - top) * n.l / 5;
    next -= dt; if (next <= 0) { next = 1.5; runs.push({ r: route(leaves[Math.floor(Math.random() * leaves.length)]), k: 0 }); }
    c.clearRect(0, 0, W, H);
    c.font = '600 10.5px JB, ui-monospace, monospace'; c.textAlign = 'left';
    const LV = ['QUEEN', 'ANT', 'ANT²', 'ANT³', 'ANT⁴', 'ANT⁵'];
    for (let l = 0; l <= 5; l++) { const y = top + (bot - top) * l / 5; c.fillStyle = l ? C.mute : C.amber; c.fillText(LV[l], 14, y + 4); c.fillStyle = 'rgba(42,42,56,.8)'; for (let x = 70; x < W - 20; x += 8) c.fillRect(x, y, 1.2, 1.2); }
    N.forEach((n, i) => { if (n.p < 0) return; const a = N[n.p]; const pts = bez([X(n), Y(n)], [(X(n) + X(a)) / 2, (Y(n) + Y(a)) / 2 + 6], [X(a), Y(a)], 3); dotted(c, pts, 3, 1.15, 'rgba(242,242,247,.34)'); });
    // the line a buy has already climbed glows amber
    runs.forEach(rn => { const seg = Math.floor(rn.k); for (let j = 0; j < Math.min(seg, rn.r.length - 1); j++) { const a = N[rn.r[j]], b = N[rn.r[j + 1]]; dotted(c, bez([X(a), Y(a)], [(X(a) + X(b)) / 2, (Y(a) + Y(b)) / 2 + 6], [X(b), Y(b)], 3), 3, 1.6, 'rgba(255,176,58,.7)'); } });
    runs.forEach(rn => {
      rn.k += dt * 2.6; const seg = Math.floor(rn.k), f = rn.k - seg;
      if (seg < rn.r.length - 1) { const a = N[rn.r[seg]], b = N[rn.r[seg + 1]]; const x = X(a) + (X(b) - X(a)) * f, y = Y(a) + (Y(b) - Y(a)) * f; c.fillStyle = C.amber; c.beginPath(); c.arc(x, y, 3.6, 0, 6.2832); c.fill(); if (f < dt * 2.6 * 1.2) flash[rn.r[seg]] = 1; }
      else if (!rn.done) { flash[rn.r[rn.r.length - 1]] = 1; rn.done = true; }
    });
    runs = runs.filter(rn => !rn.done);
    N.forEach((n, i) => {
      flash[i] *= Math.exp(-dt * 3); const base = n.l ? Math.max(8, 17 - n.l * 1.8) : 26, r = base * (1 + flash[i] * 0.22);
      halftone(c, X(n), Y(n), r, flash[i] > 0.3 && n.l ? RGB.amber : n.l ? RGB.ink : RGB.amber, Math.max(2.6, r / 4.6), undefined, n.l ? 0.78 + flash[i] * 0.22 : 1);
      if (flash[i] > 0.05) { c.fillStyle = `rgba(255,176,58,${flash[i] * 0.7})`; for (let k = 0; k < 24; k++) { const a = k / 24 * 6.2832; c.beginPath(); c.arc(X(n) + Math.cos(a) * (r + 6), Y(n) + Math.sin(a) * (r + 6), 1.1, 0, 6.2832); c.fill(); } }
    });
  };
  if (reduced) { draw(0); return; }
  whileVisible(cv, t => draw(t));
})();

// =====================================================================================================
// THE END: a line of ants marching along the bottom, each with its crumb
(() => {
  const cv = $('#cvEnd'); if (!cv) return;
  const draw = t => {
    const [c, W, H] = fit(cv, 2); c.clearRect(0, 0, W, H); const y = H - 34, gap = 46, off = (t * 34) % gap;
    c.fillStyle = 'rgba(255,176,58,.3)'; for (let x = 0; x < W; x += 9) c.fillRect(x, y + 14, 1.5, 1.5);
    for (let x = -gap + off; x < W + gap; x += gap) { const i = Math.round((x - off) / gap); ant(c, x, y + Math.sin(i * 1.7) * 2, 2.4, 0, i % 5 ? 'rgba(242,242,247,.75)' : C.ink, { phase: t * 18 + i, crumb: i % 3 ? C.amber : null }); }
  };
  if (reduced) { draw(0); return; }
  whileVisible(cv, t => draw(t));
})();

// =====================================================================================================
// LIVE DATA
// the queens: what's trending on pump.fun this hour
let trending = [];
api('pump').then(j => {
  const pill = $('#qLive'), grid = $('#qGrid');
  trending = (j && j.ok && j.trending) || [];
  if (!trending.length) {
    pill.classList.add('off'); pill.innerHTML = '<i></i>FEED OFFLINE';
    grid.innerHTML = `<div class="empty" style="grid-column:1/-1"><b>pump.fun's trending feed didn't answer.</b>Paste any coin in the app to launch its ant.<br><a class="btn g" href="/app">open the app <span class="ar">→</span></a></div>`;
    radarInit(); return;
  }
  pill.classList.add('on'); pill.innerHTML = '<i></i>LIVE · PUMP.FUN THIS HOUR';
  grid.innerHTML = trending.slice(0, 8).map((q, i) => `<a class="qc rv" style="--d:${i}" data-m="${esc(q.mint)}" href="/app?queen=${encodeURIComponent(q.mint)}#launch">
      <span class="rank num">#${i + 1}</span>
      <div class="top"><span class="pic">${pic(q.icon, q.symbol)}</span><div class="nm"><b>${esc(sym(q.symbol))}</b><span>${esc(q.name || '')}</span></div></div>
      <div class="st"><span class="mc">${usd(q.mcap)}</span><span class="c1">${chg(q.ch1h)}</span></div>
      <div class="vrow"><span class="vamps" data-m="${esc(q.mint)}"></span></div>
      <div class="go"><span>launch an ant</span><span class="ar">→</span></div></a>`).join('');
  $$('#qGrid .qc').forEach(el => rio.observe(el)); tiltCards();
  freshList = (j && j.fresh) || []; rebuildPops();
  // the tape under the hero
  const items = trending.slice(0, 12).map(q => `<a class="it" href="/app?queen=${encodeURIComponent(q.mint)}#launch"><b>${esc(sym(q.symbol))}</b>${usd(q.mcap)} ${chg(q.ch1h)}</a>`).join('');
  $('#tapeRun').innerHTML = items + items; $('#tape').hidden = false;
  radarInit();
});

// the listed assets
api('hosts').then(j => {
  if (!j || !j.ok) { $('#aGrid').innerHTML = '<p class="fmsg">pump.fun\'s list didn\'t load just now. You can still paste any coin in the app.</p>'; return; }
  HOSTS = j.hosts || []; renderAssets();
  const n = j.count || (j.hosts || []).length; $$('[data-live="hosts"]').forEach(e => (e.textContent = n.toLocaleString('en-US')));
  const k = j.counts || (j.hosts || []).reduce((o, h) => (o[h.cat] = (o[h.cat] || 0) + 1, o), {});
  $('#qCats').innerHTML = [['crypto', 'crypto'], ['meme', 'memes'], ['stock', 'stocks']].filter(([c]) => k[c]).map(([c, l]) => `<span><b>${k[c]}</b> ${l}</span>`).join('');
  if (j.maxDepth) $$('[data-live="depth"]').forEach(e => (e.textContent = j.maxDepth));
});

// the tag and the depth, from the chain
api('config').then(j => {
  if (!j || !j.ok) return;
  if (j.tag) { $$('[data-live="tag"]').forEach(e => (e.textContent = j.tag)); $('#tagAddr').textContent = short(j.tag, 6); $('#tagLink').href = 'https://solscan.io/account/' + j.tag; $('#tagCopy').onclick = () => copy(j.tag, 'Tag address copied'); }
  if (j.maxDepth) $$('[data-live="depth"]').forEach(e => (e.textContent = j.maxDepth));
});

// the colony: every ant launched through ant1
api('list').then(j => {
  const box = $('#colList'), pill = $('#cLive');
  if (!j || !j.ok) { pill.classList.add('off'); pill.innerHTML = '<i></i>SOLANA DIDN\'T ANSWER'; box.innerHTML = `<div class="empty"><b>The chain didn't answer just now.</b>The colony reads ant1's tag address from Solana. Try again in a minute.</div>`; return; }
  pill.classList.add('on'); pill.innerHTML = `<i></i>LIVE · ${j.count || 0} ANT${j.count === 1 ? '' : 'S'}`;
  const coins = (j.coins || []).filter(c => c.host); colonyCoins = coins; rebuildPops();
  if (!coins.length) { box.innerHTML = `<div class="empty"><canvas class="enest" aria-hidden="true"></canvas><b>No ants yet.</b>The first one carries for whichever queen you pick.<br><a class="btn g" href="/app">launch the first ant <span class="ar">→</span></a></div>`; emptyNest($('#colList .enest')); return; }
  const groups = new Map(); coins.forEach(c => { if (!groups.has(c.host)) groups.set(c.host, []); groups.get(c.host).push(c); });
  box.innerHTML = [...groups.entries()].sort((a, b) => b[1].length - a[1].length).slice(0, 8).map(([host, list]) => {
    const h = list[0], food = list.reduce((a, c) => a + (c.food || 0), 0);
    return `<div class="cq rv vis"><div class="qh"><span class="dot"></span><b>${esc(sym(h.hostSymbol || short(host)))}</b><span>${list.length} ant${list.length === 1 ? '' : 's'} · ${fmt(food)} ${esc(sym(h.hostSymbol || ''))} in their curves</span></div>
      ${list.slice(0, 6).map(c => `<a class="arow" href="https://pump.fun/coin/${encodeURIComponent(c.mint)}" target="_blank" rel="noopener"><span class="pic">${pic(c.image, c.symbol)}</span><div><b>${esc(sym(c.symbol))}</b><small>${esc(c.name || short(c.mint))}</small></div><div class="hm"><small>FOOD</small><span class="num">${fmt(c.food)} ${esc(sym(h.hostSymbol || ''))}</span></div><div class="hm"><small>CURVE ${c.curve != null ? Math.round(c.curve) + '%' : '—'}</small><div class="bar"><i style="width:${clamp(c.curve || 0, 0, 100)}%"></i></div></div><span class="num">${usd(c.mcap)}</span></a>`).join('')}</div>`;
  }).join('');
});
function fmt(n) { if (n == null || !isFinite(n)) return '—'; if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B'; if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M'; if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K'; return n >= 1 ? n.toFixed(2) : n.toPrecision(2); }

// =====================================================================================================
// 05 THE VAMP RADAR
let rdata = null;
const radarCv = $('#cvRadar');
(() => {
  if (!radarCv) return;
  let lastT = 0, sweep = 0; const flash = new Map();
  const draw = t => {
    const [c, W, H] = fit(radarCv, 2), dt = Math.min(0.05, lastT ? t - lastT : 0.016); lastT = t; sweep = (sweep + dt * 1.6) % 6.2832;
    const cx = W / 2, cy = H / 2, R = Math.min(W, H) / 2 - 14;
    c.clearRect(0, 0, W, H);
    for (let k = 1; k <= 4; k++) { const r = R * k / 4, n = Math.round(r / 5); c.fillStyle = k === 4 ? 'rgba(255,93,108,.3)' : 'rgba(170,170,210,.16)'; for (let i = 0; i < n; i++) { const a = i / n * 6.2832; c.beginPath(); c.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 0.9, 0, 6.2832); c.fill(); } }
    c.strokeStyle = 'rgba(170,170,210,.08)'; c.lineWidth = 1; c.beginPath(); c.moveTo(cx - R, cy); c.lineTo(cx + R, cy); c.moveTo(cx, cy - R); c.lineTo(cx, cy + R); c.stroke();
    for (let k = 0; k < 18; k++) { const a = sweep - k * 0.035; c.strokeStyle = `rgba(255,93,108,${0.42 * (1 - k / 18)})`; c.lineWidth = 1.4; c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); c.stroke(); }
    const vs = (rdata && rdata.vamps) || [];
    if (vs.length) {
      const logs = vs.map(v => Math.log10(Math.max(10, v.mcap || 10))), lo = Math.min(...logs), hi = Math.max(...logs, lo + 0.5);
      vs.forEach((v, i) => {
        const a = hash(v.mint) * 6.2832, nrm = (logs[i] - lo) / (hi - lo), rr = R * (0.32 + 0.58 * (1 - nrm)), x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
        const d = ((sweep - a) % 6.2832 + 6.2832) % 6.2832; if (d < 0.08) flash.set(v.mint, 1);
        const f = flash.get(v.mint) || 0; flash.set(v.mint, f * Math.exp(-dt * 1.1));
        const s = 3 + nrm * 6; c.fillStyle = `rgba(255,93,108,${0.35 + f * 0.65})`; c.beginPath(); c.arc(x, y, s, 0, 6.2832); c.fill();
        if (f > 0.25) {
          c.font = '600 10.5px JB, ui-monospace, monospace'; const lab = (v.name || '?').slice(0, 16) + ' · ' + usd(v.mcap), w = c.measureText(lab).width;
          let lx = x > cx ? x + s + 6 : x - s - 6 - w; const half = Math.sqrt(Math.max(0, R * R - (y - cy) * (y - cy))) * 0.92; lx = Math.max(cx - half + 4, Math.min(cx + half - w - 4, lx));
          c.fillStyle = `rgba(7,7,11,${f * 0.8})`; c.fillRect(lx - 3, y - 8, w + 6, 15); c.fillStyle = `rgba(242,242,247,${f})`; c.textAlign = 'left'; c.fillText(lab, lx, y + 3.5);
        }
      });
    }
    ball(c, cx, cy, 26, RGB.amber, 4.4);
    if (rdata && rdata.symbol) { c.fillStyle = C.amber; c.font = '700 12px JB, ui-monospace, monospace'; c.textAlign = 'center'; c.fillText(sym(rdata.symbol), cx, cy + 46); }
  };
  if (reduced) { draw(0); setInterval(() => draw(performance.now() / 1000), 1500); return; }
  whileVisible(radarCv, t => draw(t));
})();

async function scan(mint) {
  const res = $('#rRes'); res.innerHTML = '<p class="msg">Sweeping Solana for copies…</p>';
  const j = await api('vamps?mint=' + encodeURIComponent(mint));
  if (!j || !j.ok) { rdata = null; res.innerHTML = `<p class="msg">${esc((j && j.error) || "The radar couldn't reach the token list just now.")}</p>`; return j; }
  rdata = j; renderRadar(j); return j;
}
function renderRadar(j) {
  const res = $('#rRes'); $$('#rChips button').forEach(b => b.classList.toggle('on', b.dataset.mint === j.mint));
  if (!j.symbol) { res.innerHTML = `<p class="msg">${esc(j.note || 'No ticker found for that coin.')}</p>`; return; }
  const n = j.count || 0;
  res.innerHTML = `<div class="big"><b>${n}${j.capped ? '+' : ''}</b><span>vamp${n === 1 ? '' : 's'} of <strong>${esc(sym(j.symbol))}</strong>${j.mcap ? ' · the original is ' + usd(j.mcap) : ''}</span></div>
    <p class="held">${n ? `Holding <b>${usd(j.vampsMcap)}</b> between them: market cap that could have fed the original.` : 'No copies wearing this ticker right now. A clean colony.'}</p>
    <ul class="vlist">${(j.vamps || []).slice(0, 6).map(v => `<li><i></i><span>${esc(v.name || '?')}<small>${esc(short(v.mint))}</small></span><em>${usd(v.mcap)}</em></li>`).join('')}</ul>
    <div class="act"><a class="btn g" href="/app?queen=${encodeURIComponent(j.mint)}#launch">launch an ant of ${esc(sym(j.symbol))} instead <span class="ar">→</span></a>${n ? `<a class="btn o" target="_blank" rel="noopener" href="https://x.com/intent/post?text=${encodeURIComponent(`${sym(j.symbol)} has ${n}${j.capped ? '+' : ''} vamps on Solana, holding ${usd(j.vampsMcap)} between them.\n\nVamps drain. Ants carry. Launch an ant of ${sym(j.symbol)} instead:\n${location.origin}/app?queen=${j.mint}`)}">post it on X</a>` : ''}</div>`;
}
async function radarInit() {
  const chips = $('#rChips');
  chips.innerHTML = trending.slice(0, 7).map(q => `<button type="button" data-mint="${esc(q.mint)}">${esc(sym(q.symbol))}</button>`).join('');
  $$('#rChips button').forEach(b => b.addEventListener('click', () => scan(b.dataset.mint)));
  $('#rForm').addEventListener('submit', e => { e.preventDefault(); const v = $('#rIn').value.trim(); if (!isAddr(v)) { $('#rRes').innerHTML = '<p class="msg">That isn\'t a Solana address. Paste a coin\'s contract.</p>'; return; } scan(v); });
  // sweep what's trending, rank it by vamps, and open the radar on the most vamped coin
  const res = await sweep(); lastSweep = res; rebuildPops();
  let shown = res.find(r => r.count > 0) || null;
  if (shown) { rdata = shown; renderRadar(shown); }
  else if (trending.length) { const j = await scan(trending[0].mint); if (j && j.ok) shown = null; }
  else $('#rRes').innerHTML = '<p class="msg">Paste any coin above to sweep for its vamps.</p>';
  const swept = res.filter(r => r && r.ok), vampsN = swept.reduce((a, r) => a + (r.count || 0), 0), held = swept.reduce((a, r) => a + (r.vampsMcap || 0), 0), hit = swept.filter(r => r.count > 0).length;
  if (swept.length) {
    const nl = $('#nowLine'); nl.hidden = false;
    nl.innerHTML = `<span class="k">● live</span><span>Of the <b>${swept.length}</b> coins trending on pump.fun we just swept, <b>${hit}</b> ${hit === 1 ? 'has' : 'have'} vamps: <span class="r">${vampsN}${swept.some(r => r.capped) ? '+' : ''} copies</span> holding <b>${usd(held)}</b> between them.${shown ? ` The most vamped is <b>${esc(sym(shown.symbol))}</b>.` : ''}</span>`;
  }
}

// =====================================================================================================
// count-ups: numbers roll up from zero the first time they're seen
const cio = new IntersectionObserver(es => es.forEach(e => {
  if (!e.isIntersecting) return; cio.unobserve(e.target); const el = e.target, end = parseFloat(String(el.textContent).replace(/[^0-9.]/g, '')); if (!isFinite(end) || reduced) return;
  const t0 = performance.now(), d = 1100, step = now => { const k = Math.min(1, (now - t0) / d), v = Math.round(end * ease(k)); el.textContent = v.toLocaleString('en-US'); if (k < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}), { threshold: 0.6 });
$$('.cu').forEach(el => cio.observe(el));

// =====================================================================================================
// 03 ANATOMY: each part of the ant is one piece of the mechanic. Hover or tap a line; it cycles on its own.
(() => {
  const svg = $('#bigAnt'), items = $$('.anat-list li'), ring = $('#aRing'); if (!svg) return;
  const R = { coin: [1.75, 0, 1.35, 1.25], food: [3.3, 0, 0.95, 0.95], curve: [-0.2, 0, 1.45, 1.05], legs: [-0.2, 0, 3.25, 3.15], pool: [-2.6, 0, 2.45, 1.9], tag: [3.25, 0, 1.2, 1.8] };
  let idx = 0, hold = 0;
  const set = p => {
    svg.classList.add('has-on'); $$('.pt', svg).forEach(el => el.classList.toggle('on', el.dataset.p === p)); items.forEach(li => li.classList.toggle('on', li.dataset.p === p));
    const r = R[p]; if (r) { ring.setAttribute('cx', r[0]); ring.setAttribute('cy', r[1]); ring.setAttribute('rx', r[2]); ring.setAttribute('ry', r[3]); }
  };
  items.forEach((li, i) => { const go = () => { idx = i; hold = Date.now() + 6000; set(li.dataset.p); }; li.addEventListener('mouseenter', go); li.addEventListener('click', go); });
  $$('.pt', svg).forEach(el => el.addEventListener('click', () => { const i = items.findIndex(li => li.dataset.p === el.dataset.p); if (i >= 0) { idx = i; hold = Date.now() + 6000; set(el.dataset.p); } }));
  set(items[0].dataset.p);
  let vis = false; new IntersectionObserver(([e]) => (vis = e.isIntersecting)).observe(svg);
  // the ant itself is drawn in halftone on a canvas laid exactly over the svg (the svg stays for clicks and the ring)
  const cv = $('#antCv'), fig = svg.parentElement, NAME = { coin: 'YOUR COIN', food: 'FOOD', curve: 'THE CURVE', legs: 'THE SWAP', pool: 'THE POOL', tag: 'THE TAG' };
  const halfEll = (c, cx, cy, rx, ry, rgb, gap, alpha) => {
    for (let y = cy - ry; y <= cy + ry; y += gap) for (let x = cx - rx; x <= cx + rx; x += gap) {
      const nx = (x - cx) / rx, ny = (y - cy) / ry, d2 = nx * nx + ny * ny; if (d2 > 1) continue;
      const nz = Math.sqrt(1 - d2), lam = Math.max(0, nx * -0.5 + ny * -0.6 + nz * 0.62), rr = gap * 0.47 * (0.22 + 0.78 * lam) * (0.45 + 0.55 * Math.min(1, (1 - Math.sqrt(d2)) * 5));
      c.fillStyle = `rgba(${rgb},${(0.3 + 0.7 * lam) * alpha})`; c.beginPath(); c.arc(x, y, rr, 0, 6.2832); c.fill();
    }
  };
  const drawAnt = t => {
    const fr = fig.getBoundingClientRect(), sr = svg.getBoundingClientRect();
    cv.style.left = (sr.left - fr.left) + 'px'; cv.style.top = (sr.top - fr.top) + 'px'; cv.style.width = sr.width + 'px'; cv.style.height = sr.height + 'px';
    const [c, W] = fit(cv, 2), k = W / 11, X = x => (x + 5.7) * k, Y = y => (y + 3.7) * k, gap = Math.max(3.2, k * 0.11);
    c.clearRect(0, 0, W, cv.height);
    const on = ($('.pt.on', svg) || {}).dataset ? $('.pt.on', svg).dataset.p : null, A = p => (on === p ? RGB.amber : RGB.ink), al = p => (!on || on === p ? 1 : 0.42);
    c.lineCap = 'round'; c.lineJoin = 'round';
    // legs, walking in place on a tripod gait
    const L = [[0.35, 1.2, 1.45, 2.25, 2.45], [0, -0.1, 1.6, -0.45, 2.85], [-0.3, -1.45, 1.45, -2.65, 2.5]], ph = t * 7;
    c.lineWidth = 0.15 * k; c.strokeStyle = `rgba(${A('legs')},${0.85 * al('legs')})`;
    for (let q = 0; q < 3; q++) for (const sd of [-1, 1]) { const gg = (q + (sd > 0 ? 1 : 0)) % 2, sw = Math.sin(ph + gg * Math.PI) * 0.16, [a0, kx, ky, fx, fy] = L[q]; c.beginPath(); c.moveTo(X(a0), Y(0)); c.lineTo(X(kx + sw * 0.5), Y(sd * ky)); c.lineTo(X(fx + sw), Y(sd * fy)); c.stroke(); }
    // antennae, feeling the air
    c.lineWidth = 0.11 * k; c.strokeStyle = `rgba(${A('tag')},${0.85 * al('tag')})`;
    for (const sd of [-1, 1]) { const w = Math.sin(t * 2.2 + sd) * 0.14; c.beginPath(); c.moveTo(X(2.3), Y(sd * 0.5)); c.lineTo(X(3.05), Y(sd * 1.35 + w)); c.lineTo(X(3.95 + w * 0.3), Y(sd * 1.05 + w)); c.stroke(); }
    halfEll(c, X(-2.6), Y(0), 2 * k, 1.45 * k, A('pool'), gap, al('pool'));
    halfEll(c, X(-0.72), Y(0), 0.34 * k, 0.3 * k, A('curve'), gap * 0.8, al('curve'));
    halfEll(c, X(0.05), Y(0), 0.95 * k, 0.62 * k, A('curve'), gap, al('curve'));
    halfEll(c, X(1.75), Y(0), 0.98 * k, 0.9 * k, A('coin'), gap, al('coin'));
    halfEll(c, X(3.3), Y(0), 0.62 * k, 0.62 * k, on === 'food' ? '255,211,138' : RGB.amber, gap * 0.85, on && on !== 'food' ? 0.6 : 1);
    if (on) { const r = R[on]; c.font = `700 ${Math.max(10, k * 0.16)}px JB, ui-monospace, monospace`; c.textAlign = 'center'; c.fillStyle = C.amber; c.fillText(NAME[on], X(r[0]), Y(-r[3]) - 10); }
  };
  if (reduced) drawAnt(0); else whileVisible(fig, t => drawAnt(t));
  setInterval(() => { if (!vis || Date.now() < hold) return; idx = (idx + 1) % items.length; set(items[idx].dataset.p); }, 2600);
})();

// =====================================================================================================
// QUEEN CHECK: paste any coin; see its own line down to SOL, and whether a new ant can be priced in it
$('#qkForm') && $('#qkForm').addEventListener('submit', async e => {
  e.preventDefault(); const out = $('#qkOut'), v = $('#qkIn').value.trim(); out.hidden = false;
  if (!isAddr(v)) { out.innerHTML = '<p class="msg">That isn\'t a Solana address. Paste a coin\'s contract.</p>'; return; }
  out.innerHTML = '<p class="msg">Asking pump.fun\'s program…</p>';
  const [ck, ch] = await Promise.all([api('check?mint=' + encodeURIComponent(v)), api('chain?mint=' + encodeURIComponent(v))]);
  if (!ck || !ck.ok) { out.innerHTML = `<p class="msg">${esc((ck && ck.error) || "Solana didn't answer. Try again in a moment.")}</p>`; return; }
  const name = sym(ck.symbol || (ch && ch.line && ch.line[ch.line.length - 1].symbol) || short(v));
  const line = ch && ch.ok && ch.line && ch.line.length ? ch.line : [{ mint: v, symbol: ck.symbol }];
  const chips = line.map((x, i) => `<span class="${i === line.length - 1 ? 'me' : ''}">${esc(x.symbol === 'SOL' ? 'SOL' : sym(x.symbol || short(x.mint)))}</span>`).join('<em>›</em>') + (ck.can ? '<em>›</em><span class="nx">your ant</span>' : '');
  const lvl = ck.depth || 1;
  out.innerHTML = `<div class="qline">${chips}</div><p class="qverd">${ck.can ? `<span class="ok">Can be a queen.</span> Your ant would sit at <b>level ${lvl}</b> of ${ck.maxDepth || 5}${ck.source === 'quoteControl' ? ', on pump.fun\'s own list' : ''}.` : `<span class="no">Can't be a queen.</span> ${esc(ck.error || 'pump.fun won\'t price a curve in it.')}`}</p>${ck.can ? `<a class="btn g" href="/app?queen=${encodeURIComponent(v)}#launch">launch an ant of ${esc(name)} <span class="ar">→</span></a>` : ''}`;
});

// =====================================================================================================
// MOST VAMPED RIGHT NOW: sweep the trending coins (three at a time), rank them by vamps
async function sweep() {
  const rows = $('#lbRows'), pill = $('#lbLive'), qs = trending.slice(0, 8);
  if (!qs.length) { pill.classList.add('off'); pill.innerHTML = '<i></i>FEED OFFLINE'; rows.innerHTML = '<div class="lbe">pump.fun\'s trending feed didn\'t answer, so there\'s nothing to sweep. Paste any coin into the radar above.</div>'; return []; }
  const out = new Array(qs.length).fill(null); let k = 0;
  await Promise.all([0, 1, 2].map(async () => { while (k < qs.length) { const i = k++; const j = await api('vamps?mint=' + encodeURIComponent(qs[i].mint)); out[i] = j && j.ok && j.symbol ? j : null; } }));
  const res = out.filter(Boolean);
  res.forEach(r => { const el = document.querySelector(`.qc .vamps[data-m="${r.mint}"]`); if (el) { el.innerHTML = r.count ? `${r.count}${r.capped ? '+' : ''} vamps<i> · ${usd(r.vampsMcap)} held</i>` : 'no vamps found'; el.classList.toggle('none', !r.count); el.classList.add('on'); } });
  const top = res.filter(r => r.count > 0).sort((a, b) => b.count - a.count || (b.vampsMcap || 0) - (a.vampsMcap || 0)).slice(0, 6);
  pill.classList.add(res.length ? 'on' : 'off'); pill.innerHTML = res.length ? `<i></i>LIVE · ${res.length} OF ${qs.length} SWEPT` : '<i></i>SEARCH OFFLINE';
  if (!res.length) { rows.innerHTML = '<div class="lbe">Jupiter\'s token search didn\'t answer just now. The radar above still works on any coin you paste.</div>'; return []; }
  if (!top.length) { rows.innerHTML = '<div class="lbe">None of the coins trending right now have copies wearing their ticker. A clean hour.</div>'; return res; }
  const max = Math.max(...top.map(r => r.count));
  rows.innerHTML = top.map((r, i) => `<div class="lbr"><span class="rk">${String(i + 1).padStart(2, '0')}</span><span class="nm"><b>${esc(sym(r.symbol))}</b><small>${esc(r.name || '')} · ${usd(r.mcap)}</small></span><span class="vc"><b>${r.count}${r.capped ? '+' : ''}</b>vamps</span><span class="hd"><b>${usd(r.vampsMcap)}</b> held</span><span class="bar"><i style="width:0" data-w="${Math.max(4, Math.round(r.count / max * 100))}"></i></span><span class="ac"><button type="button" data-scan="${esc(r.mint)}">scan</button><a href="/app?queen=${encodeURIComponent(r.mint)}#launch">launch an ant</a></span></div>`).join('');
  setTimeout(() => $$('#lbRows .bar i').forEach(i => (i.style.width = i.dataset.w + '%')), 60);
  $$('#lbRows [data-scan]').forEach(b => b.addEventListener('click', () => { scan(b.dataset.scan); $('#radar').scrollIntoView({ behavior: 'smooth' }); }));
  return top.concat(res.filter(r => !r.count));
}

// =====================================================================================================
// FOR COMMUNITIES: three small loops, one per step
$$('.cmini').forEach(cv => {
  const k = cv.dataset.k;
  const draw = t => {
    const [c, W, H] = fit(cv, 2), cx = W / 2, cy = H / 2; c.clearRect(0, 0, W, H);
    c.fillStyle = 'rgba(170,170,210,.06)'; for (let y = 8; y < H; y += 16) for (let x = 8; x < W; x += 16) { c.beginPath(); c.arc(x, y, 0.8, 0, 6.2832); c.fill(); }
    if (k === 'scan') {
      const R = H * 0.42, sw = (t * 1.7) % 6.2832;
      for (let q = 1; q <= 2; q++) { const n = 40 * q; c.fillStyle = 'rgba(255,93,108,.25)'; for (let i = 0; i < n; i++) { const a = i / n * 6.2832; c.beginPath(); c.arc(cx + Math.cos(a) * R * q / 2, cy + Math.sin(a) * R * q / 2, 0.9, 0, 6.2832); c.fill(); } }
      for (let j = 0; j < 12; j++) { const a = sw - j * 0.04; c.strokeStyle = `rgba(255,93,108,${0.4 * (1 - j / 12)})`; c.lineWidth = 1.3; c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); c.stroke(); }
      [[0.6, 0.7], [2.2, 0.45], [3.6, 0.85], [5.1, 0.6]].forEach(([a, d]) => { const f = Math.max(0, 1 - (((sw - a) % 6.2832) + 6.2832) % 6.2832 / 3); c.fillStyle = `rgba(255,93,108,${0.35 + f * 0.65})`; c.beginPath(); c.arc(cx + Math.cos(a) * R * d, cy + Math.sin(a) * R * d, 3.5, 0, 6.2832); c.fill(); });
      ball(c, cx, cy, 12, RGB.amber, 3);
    }
    if (k === 'launch') {
      const p = (t % 2.6) / 2.6, pop = ease(clamp((p - 0.25) / 0.35)), qx = cx - W * 0.16;
      halftone(c, qx, cy, H * 0.3, RGB.amber, 5);
      const ax = qx + (W * 0.34) * pop; dotted(c, bez([qx + H * 0.3, cy], [(qx + ax) / 2, cy - H * 0.2], [ax, cy], 3), 4, 1, 'rgba(255,176,58,.4)');
      if (pop > 0.02) halftone(c, ax, cy, H * 0.17 * pop, RGB.ink, 3.4);
    }
    if (k === 'feed') {
      const R = H * 0.24 * (1 + Math.sin(t * 3) * 0.02); halftone(c, cx, cy, R, RGB.amber, 4.6);
      for (let j = 0; j < 6; j++) { const side = j % 2 ? 1 : -1, p = ((t * 0.3 + j / 6) % 1), x = cx + side * (W * 0.5 - (W * 0.5 - R - 10) * p), y = cy + (j % 3 - 1) * H * 0.22 * (1 - p); ant(c, x, y, 1.9, side > 0 ? Math.PI : 0, C.ink, { phase: t * 20 + j, crumb: C.amber }); }
    }
  };
  if (reduced) { draw(1); return; }
  whileVisible(cv, t => draw(t));
});

// the empty colony: a queen waiting, one scout circling her, sniffing the air
function emptyNest(cv) {
  if (!cv) return;
  const draw = t => {
    const [c, W, H] = fit(cv, 2), cx = W / 2, cy = H / 2 + 4, R = Math.min(48, H * 0.36); c.clearRect(0, 0, W, H);
    const n = 64; c.fillStyle = 'rgba(255,176,58,.22)'; for (let k = 0; k < n; k++) { const a = k / n * 6.2832; c.beginPath(); c.arc(cx + Math.cos(a) * R * 1.7, cy + Math.sin(a) * R * 0.72, 1, 0, 6.2832); c.fill(); }
    halftone(c, cx, cy, 15 * (1 + Math.sin(t * 2) * 0.03), RGB.amber, 3.4);
    const sp = t * 0.55, stop = Math.sin(t * 0.9) > 0.75, a = stop ? Math.floor(sp / 1.1) * 1.1 : sp, x = cx + Math.cos(a) * R * 1.7, y = cy + Math.sin(a) * R * 0.72;
    ant(c, x, y, 2.3, a + Math.PI / 2 + (stop ? Math.sin(t * 9) * 0.25 : 0), C.ink, { phase: stop ? 0 : t * 16, crumb: null });
  };
  if (reduced) { draw(0); return; }
  whileVisible(cv, t => draw(t));
}

// =====================================================================================================
// WHAT YOUR BUY FEEDS: Jupiter's live price for SOL into a queen, the first hop of every ant buy
(() => {
  const box = $('#fQueens'), sol = $('#fSol'), outEl = $('#fOut'), pill = $('#fLive'); if (!box) return;
  let cur = null, req = 0, timer = 0;
  const run = async () => {
    if (!cur) return; const amt = Math.min(50, Math.max(0.01, +sol.value || 0)), my = ++req;
    outEl.innerHTML = '<p class="fmsg">Asking Jupiter…</p>';
    const j = await api(`quote?mint=${encodeURIComponent(cur.mint)}&sol=${amt}`); if (my !== req) return;
    if (!j || !j.ok) { pill.className = 'live-pill off'; pill.innerHTML = '<i></i>PRICE OFFLINE'; outEl.innerHTML = `<p class="fmsg">${esc((j && j.error) || "Jupiter didn't answer just now.")}</p>`; return; }
    pill.className = 'live-pill on'; pill.innerHTML = '<i></i>LIVE · JUPITER';
    const S = esc(sym(j.symbol || cur.symbol));
    outEl.innerHTML = `<div class="big">≈ ${fmt(j.out)}<small>${S}</small></div>
      <p>bought first with your <b>${fmt(amt)} SOL</b>, then carried into your ant's curve as food${j.usd ? `: about <b>${usd(j.usd)}</b> of buying on ${S}` : ''}.</p>
      ${j.impact != null ? `<p>price impact on ${S} right now: <b>${j.impact < 0.01 ? '<0.01' : j.impact.toFixed(2)}%</b></p>` : ''}
      <div class="fpath"><span>SOL</span>›<span class="q">${S}</span>›<span class="a">your ant</span></div>`;
  };
  const pick = q => { cur = q; $$('#fQueens button').forEach(b => b.classList.toggle('on', b.dataset.m === q.mint)); run(); };
  sol.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(run, 400); });
  const wait = () => {
    if (!trending.length) { if (wait.n++ < 40) return setTimeout(wait, 250); box.innerHTML = '<span class="fmsg">The trending feed didn\'t answer, so there are no queens to price.</span>'; return; }
    const qs = trending.slice(0, 6);
    box.innerHTML = qs.map(q => `<button type="button" data-m="${esc(q.mint)}">${esc(sym(q.symbol))}</button>`).join('');
    $$('#fQueens button').forEach((b, i) => b.addEventListener('click', () => pick(qs[i])));
    pick(qs.find(q => q.symbol === 'FIONA') || qs[0]);
  };
  wait.n = 0;
  new IntersectionObserver(([e], o) => { if (e.isIntersecting) { o.disconnect(); wait(); } }, { rootMargin: '200px' }).observe(box);
})();

// =====================================================================================================
// PUMP.FUN'S LIST OF QUEENS: every listed asset, live, by kind, searchable
let HOSTS = [], aCat = 'all';
function renderAssets() {
  const grid = $('#aGrid'); if (!grid) return;
  const term = ($('#aIn').value || '').trim().toLowerCase().replace(/^\$/, '');
  const list = HOSTS.filter(h => (aCat === 'all' || h.cat === aCat) && (!term || (h.symbol || '').toLowerCase().includes(term) || (h.name || '').toLowerCase().includes(term)));
  const price = v => v == null ? '—' : v >= 1000 ? '$' + Math.round(v).toLocaleString('en-US') : v >= 1 ? '$' + v.toFixed(2) : '$' + Number(v.toPrecision(3));
  grid.innerHTML = list.length ? list.slice(0, 160).map(h => `<a href="/app?queen=${encodeURIComponent(h.mint)}#launch" title="Launch an ant of ${esc(h.symbol || '')}"><span class="ai">${h.icon && /^https:\/\//.test(h.icon) ? `<img src="${esc(h.icon)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">` : ''}${esc((h.symbol || '?').replace(/^\$/, '').slice(0, 1))}</span><span><b>${esc(sym(h.symbol))}</b><small>${esc(h.name || '')}</small></span><span class="ap">${price(h.usd)}<br>${h.ch24h == null ? '' : `<span class="${h.ch24h >= 0 ? 'up' : 'dn'}">${h.ch24h >= 0 ? '+' : ''}${h.ch24h.toFixed(1)}%</span>`}</span></a>`).join('') : '<p class="fmsg">Nothing on the list matches that.</p>';
  $('#aNote').textContent = `${list.length} of ${HOSTS.length} listed assets · read live from pump.fun's on-chain list · tap one to launch its ant`;
}
$$('#aTabs button').forEach(b => b.addEventListener('click', () => { aCat = b.dataset.c; $$('#aTabs button').forEach(x => x.classList.toggle('on', x === b)); renderAssets(); }));
$('#aIn') && $('#aIn').addEventListener('input', renderAssets);

// copy buttons on the program IDs
$$('.pids [data-copy]').forEach(b => b.addEventListener('click', () => { const v = b.dataset.copy === 'tag' ? ($('.pids [data-live="tag"]').textContent || '').trim() : b.dataset.copy; copy(v, 'Copied'); }));

// =====================================================================================================
// LIVE POP-UPS: real coins from pump.fun, the vamp sweep and the colony, one at a time, bottom left
let freshList = [], lastSweep = [], colonyCoins = [];
const POPS = { list: [], i: 0, on: true, started: false };
const ago2 = iso => { const t = Date.parse(iso); if (!t) return ''; const x = Math.max(0, (Date.now() - t) / 1000); return x < 60 ? 'just now' : x < 3600 ? Math.floor(x / 60) + ' min ago' : x < 86400 ? Math.floor(x / 3600) + ' h ago' : Math.floor(x / 86400) + ' d ago'; };
function rebuildPops() {
  const tr = trending.slice(0, 8).map(q => ({ k: 'hot', tag: 'TRENDING ON PUMP.FUN', sym: sym(q.symbol), icon: q.icon, line: `${chg(q.ch1h)} this hour · ${usd(q.mcap)}`, href: `/app?queen=${encodeURIComponent(q.mint)}#launch`, go: 'ant it →' }));
  const fr = freshList.slice(0, 8).map(q => ({ k: 'new', tag: 'JUST LAUNCHED', sym: sym(q.symbol), icon: q.icon, line: `on pump.fun ${ago2(q.at)}${q.mcap ? ' · ' + usd(q.mcap) : ''}`, scan: q.mint, go: 'scan →' }));
  const vp = (lastSweep || []).filter(x => x && x.count > 0).slice(0, 4).map(x => ({ k: 'vamp', tag: 'VAMPED RIGHT NOW', sym: sym(x.symbol), icon: x.icon, line: `${x.count}${x.capped ? '+' : ''} copies holding ${usd(x.vampsMcap)}`, scan: x.mint, go: 'see them →' }));
  const an = colonyCoins.slice(0, 4).map(x => ({ k: 'ant', tag: 'NEW ANT ON ANT1', sym: sym(x.symbol), icon: x.image, line: `ant of ${sym(x.hostSymbol || '')}${x.food ? ' · ' + fmt(x.food) + ' food' : ''}`, href: `https://pump.fun/coin/${encodeURIComponent(x.mint)}`, go: 'pump ↗' }));
  const out = []; for (let i = 0; i < 8; i++) [an, vp, fr, tr].forEach(L => { if (L[i]) out.push(L[i]); });
  POPS.list = out; if (!POPS.started && out.length) startPops();
}
function startPops() {
  POPS.started = true;
  try { if (sessionStorage.getItem('ant1:pops') === 'off') { POPS.on = false; return; } } catch { }
  const go = () => setTimeout(showPop, 2200);
  if (document.getElementById('intro')) addEventListener('ant1:intro-done', go, { once: true }); else go();
}
function showPop() {
  const box = $('#pops'); if (!box || !POPS.on) return;
  if (!POPS.list.length || document.hidden) { setTimeout(showPop, 3000); return; }
  const e = POPS.list[POPS.i++ % POPS.list.length], LIFE = 4600, ext = e.href && /^https:/.test(e.href);
  box.innerHTML = `<a class="pop k-${e.k}" href="${esc(e.href || '#radar')}"${ext ? ' target="_blank" rel="noopener"' : ''} style="--life:${LIFE}ms"><span class="pp-ic">${pic(e.icon, e.sym)}</span><span class="pp-t"><em>${e.tag}</em><b>${esc(e.sym)}</b><small>${e.line}</small></span><span class="pp-go">${e.go}</span><i class="pp-bar"></i></a><button class="pp-x" type="button" aria-label="Hide live pop-ups">✕</button>`;
  const card = box.querySelector('.pop'); let hover = false, left = LIFE;
  card.addEventListener('mouseenter', () => (hover = true)); card.addEventListener('mouseleave', () => (hover = false));
  if (e.scan) card.addEventListener('click', ev => { ev.preventDefault(); scan(e.scan); $('#radar').scrollIntoView({ behavior: 'smooth' }); });
  box.querySelector('.pp-x').addEventListener('click', () => { POPS.on = false; box.innerHTML = ''; try { sessionStorage.setItem('ant1:pops', 'off'); } catch { } });
  const iv = setInterval(() => {
    if (!POPS.on) return clearInterval(iv);
    if (!hover && !document.hidden) left -= 100;
    if (left <= 0) { clearInterval(iv); card.classList.add('out'); setTimeout(() => { if (box.contains(card)) box.innerHTML = ''; setTimeout(showPop, 900); }, 380); }
  }, 100);
}

// every minute, pump.fun's board again: the cards, the tape and the pop-ups move with it, values flash when they change
setInterval(async () => {
  if (document.hidden) return;
  const j = await api('pump'); if (!j || !j.ok || !(j.trending || []).length) return;
  trending = j.trending; freshList = j.fresh || freshList;
  $$('#qGrid .qc[data-m]').forEach(el => {
    const q = trending.find(x => x.mint === el.dataset.m); if (!q) return;
    const mc = el.querySelector('.mc'), c1 = el.querySelector('.c1'), was = mc.textContent, now = usd(q.mcap);
    if (was !== now) { mc.textContent = now; mc.classList.remove('flash-up', 'flash-dn'); void mc.offsetWidth; mc.classList.add(parseFloat(now.replace(/[^0-9.]/g, '')) >= parseFloat(was.replace(/[^0-9.]/g, '')) ? 'flash-up' : 'flash-dn'); }
    c1.innerHTML = chg(q.ch1h);
  });
  const items = trending.slice(0, 12).map(q => `<a class="it" href="/app?queen=${encodeURIComponent(q.mint)}#launch"><b>${esc(sym(q.symbol))}</b>${usd(q.mcap)} ${chg(q.ch1h)}</a>`).join('');
  if ($('#tapeRun')) $('#tapeRun').innerHTML = items + items;
  rebuildPops();
}, 60000);

// a slight tilt on the queen cards, following the pointer
function tiltCards() {
  if (reduced || matchMedia('(hover: none)').matches) return;
  $$('#qGrid .qc').forEach(el => {
    el.addEventListener('pointermove', e => { const r = el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5; el.classList.add('tilt'); el.style.transform = `perspective(700px) rotateY(${x * 8}deg) rotateX(${-y * 8}deg) translateY(-3px)`; });
    el.addEventListener('pointerleave', () => { el.classList.remove('tilt'); el.style.transform = ''; });
  });
}

// headings rise word by word: wrap every word (inside <em> too) in a clip and a riser
(() => {
  let n = 0;
  const wrap = node => {
    [...node.childNodes].forEach(ch => {
      if (ch.nodeType === 3) {
        const parts = ch.textContent.split(/(\s+)/), frag = document.createDocumentFragment();
        parts.forEach(w => { if (!w) return; if (/^\s+$/.test(w)) { frag.appendChild(document.createTextNode(w)); return; } const o = document.createElement('span'), i = document.createElement('span'); o.className = 'w'; i.textContent = w; i.style.setProperty('--i', n++); o.appendChild(i); frag.appendChild(o); });
        ch.replaceWith(frag);
      } else if (ch.nodeType === 1 && ch.tagName !== 'BR') wrap(ch);
    });
  };
  $$('.h2').forEach(h => { n = 0; wrap(h); });
})();
