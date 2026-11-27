// ANT1 drawing kit: the flat ant, halftone balls, dotted trails, and the quiet page background.
export const C = {
  bg: '#07070b', ink: '#f2f2f7', mute: '#a4a4b6', dim: '#6c6c82', line: '#2a2a38', amber: '#ffb03a', amber2: '#ffd38a', red: '#ff5d6c', mint: '#7dffc4', sol: '#9ad7ff',
  // older names the app still reads
  vi: '#ffb03a', vi2: '#ffd38a', gold: '#f2f2f7', gold2: '#ffffff', deep: '#1a1408', ivory: '#f2f2f7',
};
export const RGB = { amber: '255,176,58', ink: '242,242,247', red: '255,93,108', sol: '154,215,255', dim: '108,108,130', mint: '125,255,196' };

// The ant, facing along `ang`, about 8.5u long. phase drives a tripod gait; crumb is the food in its jaws.
export function ant(c, x, y, u, ang, col = C.ink, o = {}) {
  const ph = o.phase || 0, crumb = o.crumb === undefined ? C.amber : o.crumb;
  c.save(); c.translate(x, y); c.rotate(ang);
  c.strokeStyle = col; c.fillStyle = col; c.lineCap = 'round'; c.lineJoin = 'round';
  c.lineWidth = Math.max(0.9, 0.2 * u);
  const L = [[0.35, 1.2, 1.45, 2.25, 2.45], [0, -0.1, 1.6, -0.45, 2.85], [-0.3, -1.45, 1.45, -2.65, 2.5]];
  for (let k = 0; k < 3; k++) for (const s of [-1, 1]) {
    const g = (k + (s > 0 ? 1 : 0)) % 2, sw = Math.sin(ph + g * Math.PI) * 0.5 * u, [a, kx, ky, fx, fy] = L[k];
    c.beginPath(); c.moveTo(a * u, 0); c.lineTo(kx * u + sw * 0.5, s * ky * u); c.lineTo(fx * u + sw, s * fy * u); c.stroke();
  }
  c.lineWidth = Math.max(0.8, 0.15 * u);
  for (const s of [-1, 1]) { const w = Math.sin(ph * 0.5 + s) * 0.18 * u; c.beginPath(); c.moveTo(2.3 * u, s * 0.5 * u); c.lineTo(3.05 * u, s * 1.35 * u + w); c.lineTo(3.95 * u, s * 1.05 * u + w); c.stroke(); }
  for (const [ex, rx, ry] of [[-2.6, 2.0, 1.45], [-0.72, 0.34, 0.3], [0.05, 0.95, 0.62], [1.75, 0.98, 0.9]]) { c.beginPath(); c.ellipse(ex * u, 0, rx * u, ry * u, 0, 0, 6.2832); c.fill(); }
  if (crumb) { c.fillStyle = crumb; c.beginPath(); c.arc(3.3 * u, 0, 0.62 * u, 0, 6.2832); c.fill(); }
  c.restore();
}

// A halftone ball: dots sized by how much light lands on each point of a sphere.
export function halftone(c, cx, cy, R, rgb = RGB.amber, gap = 9, light = [-0.55, -0.55, 0.63], alpha = 1) {
  const n = Math.ceil(R / gap) + 1;
  for (let j = -n; j <= n; j++) for (let i = -n; i <= n; i++) {
    const x = cx + i * gap, y = cy + j * gap, nx = (x - cx) / R, ny = (y - cy) / R, d2 = nx * nx + ny * ny; if (d2 > 1) continue;
    const nz = Math.sqrt(1 - d2), lam = Math.max(0, nx * light[0] + ny * light[1] + nz * light[2]);
    const edge = Math.min(1, (1 - Math.sqrt(d2)) * 6), r = gap * 0.46 * (0.18 + 0.82 * lam) * (0.4 + 0.6 * edge);
    if (r < 0.35) continue;
    c.fillStyle = `rgba(${rgb},${(0.25 + 0.75 * lam) * alpha})`; c.beginPath(); c.arc(x, y, r, 0, 6.2832); c.fill();
  }
}

// cached halftone sprites for balls that don't change
const cache = new Map();
export function ball(c, cx, cy, R, rgb = RGB.amber, gap) {
  gap = gap || Math.max(3.2, R / 5.5);
  const D = Math.min(2, devicePixelRatio || 1), key = Math.round(R * 2) + '|' + rgb + '|' + gap.toFixed(1) + '|' + D;
  let s = cache.get(key);
  if (!s) {
    const size = Math.ceil((R + gap) * 2 * D); s = document.createElement('canvas'); s.width = s.height = size;
    const x = s.getContext('2d'); x.scale(D, D); halftone(x, R + gap, R + gap, R, rgb, gap); cache.set(key, s);
    if (cache.size > 160) cache.delete(cache.keys().next().value);
  }
  const w = s.width / D; c.drawImage(s, cx - w / 2, cy - w / 2, w, w);
}

// The old coin call, now a halftone ball with a label (sol, the queen, the ant).
export function pixCoin(c, cx, cy, r, label, tone = 'vi') {
  const rgb = tone === 'sol' ? RGB.sol : tone === 'vi' ? RGB.amber : tone === 'red' ? RGB.red : RGB.ink;
  ball(c, cx, cy, r, rgb);
  if (!label) return;
  c.save(); c.font = `800 ${Math.max(10, Math.round(r * 0.36))}px Int, system-ui, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.lineWidth = 5; c.strokeStyle = 'rgba(7,7,11,.92)'; c.lineJoin = 'round'; const t = String(label).slice(0, 9);
  c.strokeText(t, cx, cy + 1); c.fillStyle = C.ink; c.fillText(t, cx, cy + 1); c.restore();
}

// points along a quadratic bezier, about `step` px apart
export function bez(p0, p1, p2, step = 3) {
  const out = []; let last = null; const L = 900;
  for (let i = 0; i <= L; i++) {
    const t = i / L, x = (1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0], y = (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1];
    if (last && Math.hypot(x - last[0], y - last[1]) < step && i < L) continue; out.push([x, y]); last = [x, y];
  }
  return out;
}
export function dotted(c, pts, every = 4, r = 1.3, col = 'rgba(255,176,58,.25)') { c.fillStyle = col; for (let i = 0; i < pts.length; i += every) { c.beginPath(); c.arc(pts[i][0], pts[i][1], r, 0, 6.2832); c.fill(); } }
// position and heading at distance s along a polyline with cumulative lengths
export function along(pts, cum, s) {
  s = Math.max(0, Math.min(cum[cum.length - 1], s)); let lo = 0, hi = cum.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cum[m] < s) lo = m; else hi = m; }
  const a = pts[lo], b = pts[hi], f = (s - cum[lo]) / Math.max(1e-6, cum[hi] - cum[lo]);
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, Math.atan2(b[1] - a[1], b[0] - a[0])];
}
export function lengths(pts) { const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])); return cum; }

// The quiet background for the app and docs: a faint dot grid and a few ants crossing it slowly.
export function background(cv, reduced) {
  if (!cv) return;
  const c = cv.getContext('2d'); let W = 0, H = 0, D = 1, grid = null, walkers = [], raf = 0, last = 0;
  const size = () => {
    D = Math.min(1.5, devicePixelRatio || 1); W = innerWidth; H = innerHeight; cv.width = Math.round(W * D); cv.height = Math.round(H * D); c.setTransform(D, 0, 0, D, 0, 0);
    grid = document.createElement('canvas'); grid.width = cv.width; grid.height = cv.height; const g = grid.getContext('2d'); g.scale(D, D); g.fillStyle = 'rgba(170,170,210,.07)';
    for (let y = 13; y < H; y += 26) for (let x = 13; x < W; x += 26) { g.beginPath(); g.arc(x, y, 0.9, 0, 6.2832); g.fill(); }
    walkers = Array.from({ length: W < 700 ? 3 : 6 }, (_, i) => spawn(i, true));
  };
  const spawn = (i, first) => {
    const fromLeft = Math.random() < 0.5, y0 = H * (0.1 + Math.random() * 0.8), y1 = H * (0.1 + Math.random() * 0.8);
    const p0 = [fromLeft ? -30 : W + 30, y0], p2 = [fromLeft ? W + 30 : -30, y1], p1 = [W * (0.3 + Math.random() * 0.4), H * Math.random()];
    const pts = bez(p0, p1, p2, 4); return { pts, cum: lengths(pts), s: first ? Math.random() * 600 : 0, v: 14 + Math.random() * 10, u: 1.7 + Math.random() * 0.6, crumb: Math.random() < 0.6 };
  };
  const draw = now => {
    raf = requestAnimationFrame(draw); if (now - last < 40) return; const dt = Math.min(0.1, (now - last) / 1000); last = now;
    c.clearRect(0, 0, W, H); if (grid) c.drawImage(grid, 0, 0, W, H);
    walkers.forEach((w, i) => {
      w.s += w.v * dt; if (w.s > w.cum[w.cum.length - 1]) { walkers[i] = spawn(i); return; }
      const [x, y, a] = along(w.pts, w.cum, w.s); ant(c, x, y, w.u, a, 'rgba(242,242,247,.16)', { phase: w.s * 0.5, crumb: w.crumb ? 'rgba(255,176,58,.35)' : null });
    });
  };
  size(); addEventListener('resize', size);
  if (reduced) { c.drawImage(grid, 0, 0, W, H); return; }
  document.addEventListener('visibilitychange', () => { if (document.hidden) { cancelAnimationFrame(raf); raf = 0; } else if (!raf) { last = performance.now(); raf = requestAnimationFrame(draw); } });
  raf = requestAnimationFrame(draw);
}
