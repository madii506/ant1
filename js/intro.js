// The intro, wordless: dotted trails draw in from every edge, ants race down them with food, the queen grows from
// what they carry, then she glides into her place in the hero and the site appears around her.
// Click, tap, scroll or any key skips straight to the hand-off. Skipped entirely when the device asks for less motion.
import { ant, halftone, bez, lengths, along, RGB, C } from './scenes.js';

const el = document.getElementById('intro');
const root = document.documentElement;
const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
let finished = false;
const finish = () => { if (finished) return; finished = true; root.classList.remove('intro-lock'); if (el) el.remove(); dispatchEvent(new Event('ant1:intro-done')); };

if (!el) finish();
else if (reduced) finish();
else {
  root.classList.add('intro-lock');
  scrollTo(0, 0);
  const cv = el.querySelector('canvas'), c = cv.getContext('2d');
  let W = 0, H = 0, D = 1, trails = [], ants = [], total = 0;
  const cl = x => Math.max(0, Math.min(1, x)), eo = x => 1 - Math.pow(1 - x, 3), eio = x => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  const size = () => {
    D = Math.min(2, devicePixelRatio || 1); W = innerWidth; H = innerHeight; cv.width = Math.round(W * D); cv.height = Math.round(H * D); c.setTransform(D, 0, 0, D, 0, 0);
    const cx = W / 2, cy = H / 2, n = W < 700 ? 9 : 14; trails = []; ants = [];
    for (let i = 0; i < n; i++) {
      const a = i / n * 6.2832 + 0.21, far = Math.hypot(W, H) * 0.62, s = [cx + Math.cos(a) * far, cy + Math.sin(a) * far];
      const e = [cx + Math.cos(a) * 8, cy + Math.sin(a) * 8], k = (i % 2 ? 1 : -1) * far * 0.22, ctl = [(s[0] + e[0]) / 2 - Math.sin(a) * k, (s[1] + e[1]) / 2 + Math.cos(a) * k];
      const pts = bez(s, ctl, e, 3); trails.push({ pts, cum: lengths(pts), t0: 0.08 + (i % 4) * 0.06 });
      for (let j = 0; j < 3; j++) ants.push({ tr: i, start: 0.5 + j * 0.24 + (i % 5) * 0.05, dur: 0.95 + ((i * 7 + j * 3) % 5) * 0.08, u: W < 700 ? 2.2 : 2.7, done: false });
    }
    total = ants.length;
  };
  size(); addEventListener('resize', size);

  const T_FULL = 2.45, T_HAND = 2.8, T_END = 3.65;
  let t0 = 0, shift = 0, delivered = 0;
  const skip = () => { const t = (performance.now() - t0) / 1000 + shift; if (t < T_HAND) shift += T_HAND - t; };
  ['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach(ev => addEventListener(ev, skip, { passive: true, once: true }));
  setTimeout(finish, 7000);   // backstop: the site never stays hidden

  const frame = now => {
    if (finished) return;
    const t = (now - t0) / 1000 + shift, cx = W / 2, cy = H / 2;
    c.clearRect(0, 0, W, H);
    const R0 = Math.min(W, H) * (W < 700 ? 0.24 : 0.2);
    // the dot grid ripples in from the middle
    const gridA = cl(t / 0.6) * (1 - cl((t - T_HAND) / 0.5));
    if (gridA > 0) { c.fillStyle = `rgba(170,170,210,${0.08 * gridA})`; const rr = Math.hypot(W, H) * eo(cl(t / 0.9)); for (let y = 12; y < H; y += 24) for (let x = 12; x < W; x += 24) { if (Math.hypot(x - cx, y - cy) < rr) { c.beginPath(); c.arc(x, y, 0.95, 0, 6.2832); c.fill(); } } }
    // trails draw themselves toward the middle, then fade at the hand-off
    const fadeOut = 1 - cl((t - T_FULL) / 0.45);
    for (const tr of trails) {
      const k = eo(cl((t - tr.t0) / 0.85)), upto = Math.floor(tr.pts.length * k);
      c.fillStyle = `rgba(255,176,58,${0.3 * fadeOut})`;
      for (let i = 0; i < upto; i += 4) { c.beginPath(); c.arc(tr.pts[i][0], tr.pts[i][1], 1.3, 0, 6.2832); c.fill(); }
    }
    // ants race in with food; each delivery feeds the queen (an ant that reaches her rim has delivered)
    const rimNow = 5 + (R0 - 5) * eo(delivered / total) + 6; delivered = 0;
    for (const a of ants) {
      const T = trails[a.tr], L = T.cum[T.cum.length - 1], p = (t - a.start) / a.dur;
      if (p >= 1 || t >= T_HAND) { delivered++; continue; }
      if (p <= 0) continue;
      const [x, y, h] = along(T.pts, T.cum, L * eio(p) * 0.985);
      if (Math.hypot(x - cx, y - cy) < rimNow) { a.start = t - a.dur; delivered++; continue; }
      ant(c, x, y, a.u, h, C.ink, { phase: t * 26 + a.tr, crumb: C.amber });
    }
    // the queen: a dot that grows with every crumb, a ring when she's whole, then she glides into the hero
    const fed = t >= T_HAND ? 1 : delivered / total, grow = eo(fed);
    let qx = cx, qy = cy, qr = 5 + (R0 - 5) * grow + Math.sin(t * 9) * (fed < 1 ? 0.8 : 0);
    const Q = window.__ant1Q;
    if (t > T_HAND && Q) { const k = eio(cl((t - T_HAND) / (T_END - T_HAND - 0.25))); qx = cx + (Q.x - cx) * k; qy = cy + (Q.y - cy) * k; qr = R0 + (Q.R - R0) * k; }
    if (qr > 14) halftone(c, qx, qy, qr, RGB.amber, Q && t > T_HAND ? (W < 760 ? 7.5 : 9) : Math.max(5, qr / 14));
    else { c.fillStyle = C.amber; c.beginPath(); c.arc(qx, qy, qr * 0.6, 0, 6.2832); c.fill(); }
    if (t > T_FULL && t < T_FULL + 1.2) { const q = (t - T_FULL) / 1.2, rr = R0 * (1.08 + eo(q) * 1.1), n = 120; c.fillStyle = `rgba(255,176,58,${(1 - q) * 0.7})`; for (let i = 0; i < n; i++) { const a = i / n * 6.2832; c.beginPath(); c.arc(qx + Math.cos(a) * rr, qy + Math.sin(a) * rr, 1.6, 0, 6.2832); c.fill(); } }
    // the ground fades away under her and the site is there
    const reveal = cl((t - (T_HAND + 0.25)) / (T_END - T_HAND - 0.25));
    el.style.backgroundColor = `rgba(7,7,11,${1 - reveal})`;
    if (reveal > 0) root.classList.remove('intro-lock');
    if (t >= T_END) { el.style.opacity = '0'; setTimeout(finish, 220); return; }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(now => { t0 = now; frame(now); });
}
