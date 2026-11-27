// The ANT1 app: launch an ant of any queen, buy any ant with SOL in one swap, the colony, and the checker.
// The launch: the image and details are stored, ant1 builds one transaction with pump.fun's own program and tries it
// against Solana, your wallet signs, this page signs for the new ant's address (a key made here that never leaves the
// page), and Solana confirms. A first buy follows in a second transaction: in SOL through one multi-hop swap when the
// queen is a pump coin, or in the queen itself when she's a listed asset like ETH or a stock.
import { $, $$, esc, short, store, toast, copy, reduced, fit, whileVisible } from './util.js';
import { pixCoin, background, C } from './scenes.js';
import { wallet } from './wallet.js';
import * as ed from '../vendor/ed25519.js';

background($('#bg'), reduced);
const SITE = location.origin, SOL58 = 'So11111111111111111111111111111111111111112';
const fromB64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
const toB64 = u => { let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };
const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function b58(bytes) { let n = 0n; for (const x of bytes) n = n * 256n + BigInt(x); let s = ''; while (n > 0n) { s = B58[Number(n % 58n)] + s; n /= 58n; } for (const x of bytes) { if (x === 0) s = '1' + s; else break; } return s; }
const sleep = ms => new Promise(r => setTimeout(r, ms));
const isAddr = s => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(String(s || '').trim());
const price = v => v == null ? '—' : v >= 1000 ? '$' + Math.round(v).toLocaleString('en-US') : v >= 1 ? '$' + v.toFixed(2) : v >= 0.01 ? '$' + v.toFixed(4) : '$' + Number(v.toPrecision(3));
const fmtN = n => n >= 1e9 ? (n / 1e9).toFixed(2) + 'B' : n >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'K' : n >= 1 ? (+n.toFixed(2)).toString() : Number(n.toPrecision(3)).toString();
const ago = t => { if (!t) return ''; const s = Math.max(0, Date.now() / 1000 - t); return s < 60 ? 'now' : s < 3600 ? Math.floor(s / 60) + 'm' : s < 86400 ? Math.floor(s / 3600) + 'h' : Math.floor(s / 86400) + 'd'; };
const icon = (src, ch) => src && /^https:\/\//.test(src) ? `<img src="${esc(src)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : esc((ch || '?').slice(0, 1));
async function api(op, body, q = '') {
  const r = await fetch('/api/' + op + q, body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : { cache: 'no-store' });
  let j = null; try { j = await r.json(); } catch { /* not JSON */ }
  if (!j || !j.ok) { const e = new Error((j && j.error) || `The server did not answer (${r.status}). Try again.`); e.code = j && j.code; throw e; }
  return j;
}

// ---------- the new coin's address signs the exact message the wallet signed
function cu16(b, o) { let len = 0, size = 0; for (;;) { const e = b[o + size]; len |= (e & 0x7f) << (size * 7); size++; if (!(e & 0x80)) break; } return [len, size]; }
async function signAsMint(tx, pub, seed) {
  const [n, s] = cu16(tx, 0), msg = tx.subarray(s + n * 64);
  let o = msg[0] & 0x80 ? 1 : 0; const nReq = msg[o]; o += 3;
  const [nk, ks] = cu16(msg, o); o += ks;
  let at = -1;
  for (let i = 0; i < Math.min(nReq, nk, n); i++) { const k = msg.subarray(o + i * 32, o + i * 32 + 32); if (k.every((x, j) => x === pub[j])) { at = i; break; } }
  if (at < 0) throw new Error('The wallet changed the launch so the new coin no longer signs it. Nothing was sent.');
  if (tx.subarray(s, s + 64).every(x => x === 0)) throw new Error('The wallet did not sign. Nothing was sent.');
  const sig = await ed.signAsync(msg, seed), full = new Uint8Array(tx);
  full.set(sig, s + at * 64); return full;
}

// ---------- nav, tabs and routes
const panels = $$('[data-panel]');
function show(name) {
  if (!panels.some(p => p.dataset.panel === name)) name = 'launch';
  panels.forEach(p => (p.hidden = p.dataset.panel !== name));
  $$('.tab').forEach(t => { const on = t.dataset.tab === name; t.classList.toggle('on', on); t.setAttribute('aria-selected', on); });
  $$('#dock a[data-tab]').forEach(a => a.classList.toggle('on', a.dataset.tab === name));
  if (name === 'colony') loadGuests();
  $('#dock').classList.remove('open');
}
function route() {
  const h = decodeURIComponent(location.hash.slice(1));
  const m = /^(?:queen|host)=([1-9A-HJ-NP-Za-km-z]{32,44})$/.exec(h);
  if (m) { show('launch'); if (!host || host.mint !== m[1]) setHost(m[1]); return; }
  const a = /^ant=([1-9A-HJ-NP-Za-km-z]{32,44})$/.exec(h);
  if (a) { show('buy'); if (bMint.value !== a[1]) { bMint.value = a[1]; lineFor(a[1]); } return; }
  const c = /^check=([1-9A-HJ-NP-Za-km-z]{32,44})$/.exec(h);
  if (c) { show('check'); ckIn.value = c[1]; ckForm.requestSubmit(); return; }
  show(h || 'launch');
}
$$('.tab').forEach(t => t.addEventListener('click', () => { history.replaceState(null, '', '#' + t.dataset.tab); route(); }));
addEventListener('hashchange', route);

// ---------- the host
let HOSTS = [], host = null, bal = null, checking = 0;
const hCur = $('#hCur'), hStat = $('#hStat'), hOpts = $('#hOpts'), hIn = $('#hIn');
function renderHost() {
  if (!host) { hCur.innerHTML = `<span class="ic">?</span><div><b>Pick a queen</b><span>The coin your ant is priced in.</span></div><span class="hstat" id="hStat"></span>`; }
  else {
    const where = host.source === 'pumpCoin' ? `A pump coin · your ant sits at level ${host.depth}` : host.source === 'quoteControl' ? "On pump.fun's own list" : 'Listed on pump.fun';
    hCur.innerHTML = `<span class="ic">${icon(host.icon, host.symbol)}</span><div><b>${esc(host.symbol ? '$' + host.symbol : short(host.mint, 5))}</b><span>${esc(host.name ? host.name + ' · ' : '')}${esc(where)}</span></div><span class="hstat ok" id="hStat">QUEEN</span>`;
  }
  $$('#hOpts button, #hTrend button').forEach(b => b.classList.toggle('on', !!host && b.dataset.m === host.mint));
}
async function setHost(m) {
  m = String(m || '').trim();
  const st = $('#hStat');
  if (!isAddr(m)) { st.className = 'hstat bad'; st.textContent = "That isn't a Solana address."; return; }
  if (m === SOL58) { st.className = 'hstat bad'; st.textContent = 'Every normal pump.fun coin is priced in SOL. Pick a coin to be the queen.'; return; }
  const my = ++checking; st.className = 'hstat'; st.textContent = 'Asking pump.fun…';
  try {
    const r = await api('check', null, '?mint=' + encodeURIComponent(m));
    if (my !== checking) return;
    if (!r.can) { st.className = 'hstat bad'; st.textContent = r.error || "That coin can't be a queen."; return; }
    const known = HOSTS.find(h => h.mint === m) || {};
    host = { mint: m, symbol: r.symbol || known.symbol, name: r.name || known.name, icon: r.icon || known.icon, usd: r.usd ?? known.usd, source: r.source, depth: r.depth, maxDepth: r.maxDepth, decimals: r.decimals, root: null };
    // a pump-coin queen whose own line starts at a listed asset (an ant of ETH, say) can't be bought with SOL in one swap
    if (r.source === 'pumpCoin') api('chain', null, '?mint=' + encodeURIComponent(m)).then(j => { if (host && host.mint === m) { host.root = j.root; paint(); refreshBalance(); } }).catch(() => { });
    store.set('ant1:queen', m); hIn.value = ''; bal = null; buy.value = '';
    if (location.hash !== '#queen=' + m) history.replaceState(null, '', location.pathname + '#queen=' + m);
    renderHost(); refreshBalance(); paint();
  } catch (e) { if (my === checking) { st.className = 'hstat bad'; st.textContent = e.message; } }
}
$('#hGo').addEventListener('click', () => setHost(hIn.value));
hIn.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); setHost(hIn.value); } });
hIn.addEventListener('paste', () => setTimeout(() => isAddr(hIn.value) && setHost(hIn.value), 0));
api('hosts').then(j => {
  HOSTS = j.hosts || [];
  const want = ['ETH', 'WBTC', 'PUMP', '$WIF', 'Bonk', 'TRUMP', 'SPX', 'NVDAx', 'TSLAx', 'AAPLx'];
  const pick = want.map(s => HOSTS.find(h => h.symbol === s)).filter(Boolean);
  for (const h of HOSTS) { if (pick.length >= 8) break; if (!pick.includes(h) && h.symbol) pick.push(h); }
  hOpts.innerHTML = pick.slice(0, 8).map(h => `<button type="button" data-m="${esc(h.mint)}">${h.icon ? `<img src="${esc(h.icon)}" alt="" referrerpolicy="no-referrer">` : '<i></i>'}${esc(h.symbol)}</button>`).join('');
  $$('#hOpts button').forEach(b => b.addEventListener('click', () => setHost(b.dataset.m)));
  renderHost();
}).catch(() => { hOpts.innerHTML = '<span class="hstat bad">pump.fun\'s list didn\'t load. Paste a contract instead.</span>'; });
// what's trending on pump.fun right now, one tap away
api('pump').then(j => {
  const tr = (j.trending || []).filter(c => c.symbol).slice(0, 6); if (!tr.length) return;
  const box = $('#hTrend'); box.hidden = false;
  const pc = v => v == null ? '' : `<s class="chg ${v >= 0 ? 'up' : 'dn'}">${v >= 0 ? '+' : ''}${Math.abs(v) >= 100 ? Math.round(v) : v.toFixed(1)}%</s>`;
  box.innerHTML = '<span>TRENDING</span>' + tr.map(c => `<button type="button" data-m="${esc(c.mint)}">${c.icon && /^https:\/\//.test(c.icon) ? `<img src="${esc(c.icon)}" alt="" referrerpolicy="no-referrer">` : '<i></i>'}${esc(c.symbol)} ${pc(c.ch1h)}</button>`).join('');
  $$('#hTrend button').forEach(b => b.addEventListener('click', () => setHost(b.dataset.m)));
  renderHost();
}).catch(() => { });

// ---------- the form
const f = $('#lform'), name = $('#lName'), tick = $('#lTick'), desc = $('#lDesc'), xh = $('#lX'), tg = $('#lTg'), web = $('#lWeb'), file = $('#lImg'), buy = $('#lBuy'), go = $('#lGo'), flow = $('#lFlow'), st = $('#lStatus');
let img = null, metaKey = null, metaUri = null, busy = false, live = null;
const T = () => tick.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
const N = () => name.value.replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 32);
const BUY = () => Math.max(0, +buy.value || 0);
const HS = () => host ? (host.symbol ? '$' + host.symbol : short(host.mint, 4)) : 'the queen';
const SOLBUY = () => !!host && host.source === 'pumpCoin' && host.root !== 'asset';   // SOL-rooted pump-coin queens: the first buy is SOL, through one swap
async function refreshBalance() {
  const el = $('#lHold');
  if (!wallet.address || !host) { el.textContent = wallet.address ? '' : 'CONNECT TO SEE YOUR BALANCE'; return; }
  el.textContent = 'READING…';
  try { const m = host.mint; const r = await api('balance', null, `?wallet=${wallet.address}&mint=${m}`); if (!host || host.mint !== m) return; bal = r; el.textContent = SOLBUY() ? (r.sol != null ? `YOU HOLD ${fmtN(r.sol)} SOL` : '') : `YOU HOLD ${fmtN(r.amount)} ${host.symbol || ''}`.trim(); paint(); }
  catch { el.textContent = ''; }
}
$('#lMax').addEventListener('click', () => {
  if (!wallet.address) { toast('Connect a wallet first'); return; }
  if (SOLBUY()) { const v = bal && bal.sol != null ? Math.max(0, Math.min(50, bal.sol - 0.04)) : 0; if (v > 0) { buy.value = String(+v.toFixed(4)); paint(); } else toast('Not enough SOL for a buy after fees'); return; }
  if (bal && bal.amount > 0) { buy.value = String(bal.amount); paint(); } else toast(`Your wallet holds no ${HS()}`);
});

function paint() {
  const t = T(), n = N(), d = desc.value.trim(), b = BUY();
  $('#cTick').textContent = t ? '$' + t : '$TICKER';
  $('#cName').textContent = n || 'Your ant';
  $('#cDesc').textContent = d || 'Your description shows here.';
  $('#cPic').innerHTML = img ? `<img src="${img}" alt="">` : `<span>${esc((t || '?').slice(0, 1))}</span>`;
  $('#cIn').textContent = host ? `ANT OF ${HS()}` : 'ANT OF · PICK A QUEEN';
  $('#cDepth').textContent = !host ? 'LEVEL —' : host.source === 'pumpCoin' ? `LEVEL ${host.depth}${host.maxDepth ? ' OF ' + host.maxDepth : ''}` : 'LEVEL 1 · ROOT QUEEN';
  const sb = SOLBUY(); $('#lBuyU').textContent = sb ? 'SOL' : host && host.symbol ? host.symbol : 'QUEEN';
  $('#lBuyL').textContent = sb ? 'Your first buy, in SOL (one swap buys the queen, then your ant)' : host ? `Your first buy, paid in ${HS()}` : 'Your first buy';
  $('#nestL').textContent = host ? `${host.source === 'pumpCoin' ? 'SOL → ' : ''}${HS()} → ${t ? '$' + t : 'YOUR ANT'}` : 'SOL → THE QUEEN → YOUR ANT';
  $('#nestR').textContent = host && host.usd ? `${HS()} ${price(host.usd)}` : '—';
  const usd = !sb && host && host.usd && b ? ` (about $${(b * host.usd).toLocaleString('en-US', { maximumFractionDigits: b * host.usd < 10 ? 2 : 0 })})` : '';
  $('#lCost').innerHTML = b
    ? `You spend about <b>0.01 SOL</b> for the new accounts and network fees, then <b>${fmtN(b)} ${sb ? 'SOL' : esc(HS())}</b>${usd} on your first buy, a second transaction right after the launch. ant1 takes nothing.`
    : `You spend about <b>0.01 SOL</b> for the new accounts and network fees, and make no first buy. ant1 takes nothing.`;
  go.innerHTML = !host ? 'Pick a queen to launch <span class="ar">→</span>' : !wallet.address ? 'Connect a wallet to launch <span class="ar">→</span>' : `Launch ${t ? '$' + esc(t) : 'your ant'}, an ant of ${esc(HS())} <span class="ar">→</span>`;
  $('#lPost').href = 'https://x.com/intent/post?text=' + encodeURIComponent(live
    ? `$${live.t} is live on ant1, an ant of ${live.hs}.\n\nEvery buy of $${live.t} buys ${live.hs} first.\n\nhttps://pump.fun/coin/${live.mint}`
    : `${t ? '$' + t + ' is' : 'My ant is'} launching on ant1, an ant of ${host ? HS() : 'a queen'}.\n\nEvery buy of it buys ${host ? HS() : 'the queen'} first. Vamps drain. Ants carry.`);
  store.set('ant1:draft', { name: name.value, tick: tick.value, desc: desc.value, x: xh.value, tg: tg.value, web: web.value, img });
  nestDirty = true;
}
const d0 = store.get('ant1:draft', null);
if (d0) { name.value = d0.name || ''; tick.value = d0.tick || ''; desc.value = d0.desc || ''; xh.value = d0.x || ''; tg.value = d0.tg || ''; web.value = d0.web || ''; img = d0.img || null; }
[name, tick, desc, xh, tg, web, buy].forEach(i => i.addEventListener('input', paint));

// the image, cropped square in the browser
const drop = $('#lDrop');
const take = fl => {
  if (!fl || !/^image\//.test(fl.type)) { toast('Pick an image file'); return; }
  const r = new FileReader(); r.onload = () => { const im = new Image(); im.onload = () => {
    const s = Math.min(im.width, im.height), cv = document.createElement('canvas'), c = cv.getContext('2d'); cv.width = cv.height = 512;
    c.fillStyle = '#07070b'; c.fillRect(0, 0, 512, 512); c.imageSmoothingQuality = 'high';
    c.drawImage(im, (im.width - s) / 2, (im.height - s) / 2, s, s, 0, 0, 512, 512);
    img = cv.toDataURL('image/jpeg', 0.9); paint();
  }; im.onerror = () => toast("That image didn't open"); im.src = r.result; }; r.readAsDataURL(fl);
};
file.addEventListener('change', () => take(file.files[0]));
['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('over'); }));
drop.addEventListener('drop', e => take(e.dataTransfer.files[0]));

// ---------- the nest: SOL → the queen → your ant, with a buy running down it
let nestDirty = true;
function pathScene(cv, labels) {
  whileVisible(cv, t => {
    const [c, W, H] = fit(cv, 2), L = labels();
    c.clearRect(0, 0, W, H);
    c.fillStyle = 'rgba(170,170,210,.06)'; for (let y = 10; y < H; y += 20) for (let x = 10; x < W; x += 20) { c.beginPath(); c.arc(x, y, 0.8, 0, 6.2832); c.fill(); }
    const pts = [[W * 0.16, H * 0.46], [W * 0.5, H * 0.46], [W * 0.84, H * 0.46]], r = Math.min(H * 0.24, W * 0.11);
    c.fillStyle = 'rgba(255,176,58,.3)';
    for (const [a, b] of [[pts[0], pts[1]], [pts[1], pts[2]]]) for (let x = a[0] + r + 6; x < b[0] - r - 6; x += 9) { const q = (x - a[0] - r) / (b[0] - a[0] - 2 * r); c.beginPath(); c.arc(x, a[1] - Math.sin(q * Math.PI) * H * 0.08, 1.2, 0, 6.2832); c.fill(); }
    if (!reduced) for (let k = 0; k < 5; k++) {
      const p = ((t * 0.32 + k / 5) % 1), seg = p < 0.5 ? 0 : 1, q = (p % 0.5) / 0.5, a = pts[seg], b = pts[seg + 1];
      const x = a[0] + r + 6 + (b[0] - a[0] - 2 * r - 12) * q, y = a[1] - Math.sin(q * Math.PI) * H * 0.08;
      c.fillStyle = seg ? C.amber : C.ink; c.globalAlpha = Math.sin(q * Math.PI); c.beginPath(); c.arc(x, y, 3.4, 0, 6.2832); c.fill(); c.globalAlpha = 1;
    }
    pixCoin(c, pts[0][0], pts[0][1], r * 0.72, 'SOL', 'sol');
    pixCoin(c, pts[1][0], pts[1][1], r * (1 + Math.sin(t * 2) * 0.015), L[0], 'vi');
    pixCoin(c, pts[2][0], pts[2][1], r * 0.84, L[1], 'gold');
    c.font = `600 ${Math.max(10, Math.min(12, H * 0.045))}px JB, monospace`; c.textAlign = 'center'; c.fillStyle = C.dim;
    c.fillText('YOU PAY', pts[0][0], pts[0][1] + r + 22); c.fillText('THE QUEEN', pts[1][0], pts[1][1] + r + 22); c.fillText(L[2], pts[2][0], pts[2][1] + r + 22);
  });
}
pathScene($('#nestCv'), () => [host ? (host.symbol || '?').replace(/^\$/, '').slice(0, 6).toUpperCase() : '?', (T() || 'ANT').slice(0, 6), 'YOUR ANT']);

// ---------- the launch
const say = (html, err) => { st.className = 'lstatus' + (err ? ' err' : ''); st.innerHTML = html; st.hidden = false; };
const step = (k, state, note) => { const li = flow.querySelector(`[data-k="${k}"]`); if (!li) return; li.className = state; const n = li.querySelector('small'); if (n) n.innerHTML = note || ''; };
const lock = on => { busy = on; [name, tick, desc, xh, tg, web, file, buy, hIn].forEach(i => (i.disabled = on)); go.disabled = on; f.classList.toggle('busy', on); };
async function land(sig, b64, lastValid) {
  const t0 = Date.now(); let n = 0;
  while (Date.now() - t0 < 100000) {
    await sleep(1200); n++;
    let s = null; try { s = await api('status', null, `?sig=${sig}&h=${lastValid}`); } catch { continue; }
    if (s.state === 'confirmed') return s.slot;
    if (s.state === 'failed') throw new Error('It landed but failed on chain, so nothing changed hands. Solana kept only the network fee. ' + esc(s.err || ''));
    if (s.state === 'expired') throw new Error('Solana did not take it in time, so nothing happened and nothing was spent. Try again.');
    if (n % 3 === 0) api('send', { tx: b64 }).catch(() => { });
  }
  throw new Error(`No answer from Solana yet. It may still land: check <a href="https://solscan.io/tx/${sig}" target="_blank" rel="noopener">the transaction ↗</a> before you try again.`);
}
// A buy with SOL, run as however many transactions the ant's line needs. One multi_hop_swap covers up to two hops
// (an ant of a SOL coin); a deeper ant is bought in steps of two hops, each one paying with what the last one bought.
// say(stage, note) reports progress: stage is build, sign, send or land; n > 1 means a multi-step buy.
async function swapRun(mint, sol, slippage, say) {
  let step = 0, amount = null, n = 1, first = null; const sigs = [];
  for (;;) {
    const pre = () => (n > 1 ? `Step ${step + 1} of ${n}: ` : '');
    say('build', pre() + 'building the route and trying it against Solana…', step, n);
    let q = null;
    for (let i = 0; i < 6 && !q; i++) {
      try { q = await api('swap', { wallet: wallet.address, mint, sol, slippage, step, amount }); }
      catch (e) { if (!/not found|no tradable|account/i.test(e.message || '') || i === 5) throw e; await sleep(2000); }
    }
    n = q.steps; if (!first) first = q;
    say('sign', pre() + `${q.hops} hop${q.hops === 1 ? '' : 's'}, about ${fmtN(q.tokens || 0)} out. Approve it in your wallet.`, step, n, q);
    let signed;
    try { signed = await wallet.signTx(fromB64(q.tx)); }
    catch (e) { throw new Error(/reject|cancel|denied|declin/i.test(e && e.message || '') ? (step ? `You cancelled step ${step + 1}. What the earlier steps bought is in your wallet.` : 'You cancelled in your wallet. Nothing was sent.') : esc((e && e.message) || 'The wallet did not sign.')); }
    const b64 = toB64(signed), { sig } = await api('send', { tx: b64 }); sigs.push(sig);
    say('send', pre() + `<a href="https://solscan.io/tx/${sig}" target="_blank" rel="noopener">${esc(short(sig, 6))} ↗</a>`, step, n, q);
    const slot = await land(sig, b64, q.lastValid);
    say('land', pre() + `Block ${slot.toLocaleString('en-US')}`, step, n, q);
    if (!q.next) return { q, first, sigs, steps: n };
    step = q.next.step; amount = q.next.amount;
  }
}
// the first buy: its own transaction, right after the coin is live (create and buy together don't fit in one)
async function firstBuy(mint, hm, b, hs, t, sb) {
  const li = flow.querySelector('[data-k="buy"]'); li.hidden = false;
  try {
    if (sb) {
      const r = await swapRun(mint, b, 5, (k, note) => step('buy', 'run', note));
      const last = r.sigs[r.sigs.length - 1];
      step('buy', 'ok', `${fmtN(r.q.tokens || 0)} $${esc(t)} for ${fmtN(b)} SOL${r.steps > 1 ? ` in ${r.steps} steps` : ''} · <a href="https://solscan.io/tx/${last}" target="_blank" rel="noopener">${esc(short(last, 6))} ↗</a>`);
      return { ok: true, sig: last };
    }
    step('buy', 'run', `Building a buy of ${fmtN(b)} ${esc(hs)}…`);
    let q = null;
    for (let i = 0; i < 6 && !q; i++) {
      try { q = await api('buy', { wallet: wallet.address, mint, host: hm, amount: b }); }
      catch (e) { if ((e.code !== 'pending' && !/not found|no tradable|account/i.test(e.message || '')) || i === 5) throw e; await sleep(2000); }
    }
    step('buy', 'run', 'Approve the buy in your wallet.');
    let signed;
    try { signed = await wallet.signTx(fromB64(q.tx)); }
    catch (e) { throw new Error(/reject|cancel|denied|declin/i.test(e && e.message || '') ? 'You cancelled the buy in your wallet.' : esc((e && e.message) || 'The wallet did not sign.')); }
    const b64 = toB64(signed), { sig } = await api('send', { tx: b64 });
    step('buy', 'run', 'Waiting for Solana…');
    await land(sig, b64, q.lastValid);
    step('buy', 'ok', `${fmtN(q.tokens || 0)} $${esc(t)} for ${fmtN(b)} ${esc(hs)} · <a href="https://solscan.io/tx/${sig}" target="_blank" rel="noopener">${esc(short(sig, 6))} ↗</a>`);
    return { ok: true, sig };
  } catch (e) {
    step('buy', 'bad', `${(e && e.message) || esc(String(e))} Your ant is live: you can buy it on the Buy tab or on pump.fun.`);
    return { ok: false };
  }
}
async function launch() {
  if (busy) return;
  const t = T(), n = N(), b = BUY();
  const miss = !host ? 'Pick a queen first.' : !n ? 'Give your ant a name.' : !t ? 'Give your ant a ticker.' : !img ? 'Add an image.' : null;
  if (miss) { say(esc(miss), true); return; }
  if (!wallet.address) { wallet.open(); return; }
  const sb = SOLBUY();
  if (b && sb && b > 50) { say('Keep a first buy at 50 SOL or less.', true); return; }
  if (b && sb && bal && bal.sol != null && b + 0.03 > bal.sol) { say(`Your wallet holds ${fmtN(bal.sol)} SOL: not enough for a ${fmtN(b)} SOL buy plus the launch.`, true); return; }
  if (b && !sb && bal && b > bal.amount) { say(`Your wallet holds ${fmtN(bal.amount)} ${esc(HS())}, less than the ${fmtN(b)} you want to buy with.`, true); return; }
  lock(true); flow.hidden = false; st.hidden = true;
  flow.querySelectorAll('li').forEach(li => { li.className = ''; const s = li.querySelector('small'); if (s) s.textContent = ''; });
  flow.querySelector('[data-k="buy"]').hidden = !(b > 0);
  flow.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  const hs = HS(), hm = host.mint;
  try {
    step('meta', 'run', 'Storing your image and details…');
    const key = JSON.stringify([n, t, desc.value.trim(), xh.value.trim(), tg.value.trim(), web.value.trim(), img.length, img.slice(-64)]);
    if (key !== metaKey || !metaUri) { const m = await api('meta', { name: n, symbol: t, desc: desc.value.trim(), image: img, x: xh.value.trim(), telegram: tg.value.trim(), website: web.value.trim() }); metaUri = m.uri; metaKey = key; }
    step('meta', 'ok', `<a href="${esc(metaUri)}" target="_blank" rel="noopener">${esc(short(metaUri.replace(/^https:\/\//, ''), 14))} ↗</a>`);

    step('build', 'run', 'Building the launch and trying it against Solana…');
    const seed = ed.utils.randomPrivateKey(), pub = await ed.getPublicKeyAsync(seed), mint = b58(pub);
    const r = await api('build', { wallet: wallet.address, mint, host: hm, name: n, symbol: t, uri: metaUri, buyHost: 0 });
    step('build', 'ok', `${r.cost != null ? `About ${r.cost.toFixed(4)} SOL for the new accounts and fees` : 'Tried against Solana: it works'} · your ant sits at level ${r.depth}`);

    step('sign', 'run', 'Approve the launch in your wallet.');
    let signed;
    try { signed = await wallet.signTx(fromB64(r.tx)); }
    catch (e) { throw new Error(/reject|cancel|denied|declin/i.test(e && e.message || '') ? 'You cancelled in your wallet. Nothing was sent.' : esc((e && e.message) || 'The wallet did not sign.')); }
    const full = await signAsMint(signed, pub, seed), b64 = toB64(full);
    step('sign', 'ok');

    step('send', 'run');
    const { sig } = await api('send', { tx: b64 });
    step('send', 'ok', `<a href="https://solscan.io/tx/${sig}" target="_blank" rel="noopener">${esc(short(sig, 6))} ↗</a>`);
    const mine = store.get('ant1:mine', []); mine.unshift({ mint: r.mint, queen: hm, sig, t, n, at: Date.now() }); store.set('ant1:mine', mine.slice(0, 40));

    step('land', 'run', 'Waiting for Solana…');
    const slot = await land(sig, b64, r.lastValid);
    step('land', 'ok', `Block ${slot.toLocaleString('en-US')}`);
    live = { t, n, mint: r.mint, sig, hs, buy: null };
    if (b > 0) live.buy = await firstBuy(r.mint, hm, b, hs, t, sb);
    showLive(); metaUri = null; metaKey = null;
  } catch (e) {
    const li = flow.querySelector('li.run'); if (li) li.className = 'bad';
    say((e && e.message) || esc(String(e)), true);
  }
  lock(false); paint();
}
function showLive() {
  const box = $('#lDone');
  box.innerHTML = `<b>$${esc(live.t)} is live: an ant of ${esc(live.hs)}.</b><p>Every buy of $${esc(live.t)} buys ${esc(live.hs)} first. It's on pump.fun now${live.buy ? (live.buy.ok ? ', with your first buy in.' : '. Your first buy didn\'t go through, so buy it on the Buy tab.') : '.'}</p>
    <button class="ca" type="button" id="lMint"><span>ANT</span><code>${esc(live.mint)}</code><em>COPY</em></button>
    <div class="prow"><a class="btn g" href="https://pump.fun/coin/${esc(live.mint)}" target="_blank" rel="noopener">Open on pump.fun ↗</a><a class="btn o" href="https://solscan.io/tx/${esc(live.sig)}" target="_blank" rel="noopener">Solscan ↗</a><a class="btn o" href="#ant=${esc(live.mint)}">Buy more</a><button class="btn o" type="button" id="lAgain">Launch another</button></div>`;
  box.hidden = false;
  $('#lMint').onclick = () => copy(live.mint, 'Coin address copied');
  $('#lAgain').onclick = () => { live = null; box.hidden = true; flow.hidden = true; st.hidden = true; [name, tick, desc, xh, tg, web, buy].forEach(i => (i.value = '')); img = null; paint(); scrollTo({ top: 0, behavior: 'smooth' }); };
  box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  loadGuests(true);
}
f.addEventListener('submit', e => { e.preventDefault(); launch(); });
$('#lReset').addEventListener('click', () => { if (busy) return; [name, tick, desc, xh, tg, web, buy].forEach(i => (i.value = '')); img = null; metaUri = null; st.hidden = true; paint(); });

// ---------- guests
let gLast = 0;
async function loadGuests(force) {
  if (!force && Date.now() - gLast < 10000) return; gLast = Date.now();
  const box = $('#guestList');
  try {
    const j = await api('list');
    $('#gCount').textContent = j.count ? `${j.count} ant${j.count === 1 ? '' : 's'} · read from Solana` : 'Read from Solana';
    if (!j.coins.length) { box.innerHTML = `<div class="gempty"><b>No ants yet.</b><span>The first ant launched through ant1 shows up here, with the queen it feeds and the food in its curve.</span><a class="btn g" href="#launch">Launch the first one <span class="ar">→</span></a></div>`; return; }
    box.innerHTML = j.coins.map(c => `<div class="grow"><span class="ic">${icon(c.image, c.symbol)}</span><span class="nm"><b>${esc(c.symbol ? '$' + c.symbol : short(c.mint, 4))}</b><i>${esc(c.name || '')}</i></span><span class="in">ant of <b>${esc(c.hostSymbol ? '$' + c.hostSymbol : short(c.host, 4))}</b>${c.food != null ? `<small>${fmtN(c.food)} ${esc(c.hostSymbol || '')} food</small>` : ''}</span><span class="bar"><i style="width:${Math.max(2, c.curve || 0)}%"></i><em>${c.complete ? 'GRADUATED' : c.curve != null ? Math.round(c.curve) + '% TO GRADUATE' : 'ON THE CURVE'}</em></span><span class="gact"><a class="btn g sm" href="#ant=${esc(c.mint)}">Buy</a><a class="btn o sm" href="https://pump.fun/coin/${esc(c.mint)}" target="_blank" rel="noopener">pump ↗</a></span></div>`).join('');
  } catch (e) { box.innerHTML = `<div class="gempty"><b>The chain didn't answer.</b><span>${esc(e.message || '')}</span></div>`; gLast = 0; }
}

// ---------- check a coin
const ckForm = $('#ckForm'), ckIn = $('#ckIn'), ckOut = $('#ckOut');
ckForm.addEventListener('submit', async e => {
  e.preventDefault(); const m = ckIn.value.trim();
  if (!isAddr(m)) { ckOut.innerHTML = '<div class="ckres"><span class="ic">?</span><div><b>That isn\'t a Solana address.</b><span>Paste a coin\'s contract address.</span></div></div>'; return; }
  const btn = ckForm.querySelector('button'), label = btn.innerHTML; btn.disabled = true; btn.innerHTML = 'Asking pump.fun…';
  try {
    const r = await api('check', null, '?mint=' + encodeURIComponent(m));
    const nm = r.symbol ? '$' + r.symbol : short(m, 5);
    ckOut.innerHTML = r.can
      ? `<div class="ckres"><span class="ic">${icon(r.icon, r.symbol)}</span><div><b>${esc(nm)} can be a queen.</b><span>${esc(r.name || '')}</span></div><span class="verdict y">QUEEN</span>
         <div class="facts"><div><small>From</small><strong>${r.source === 'pumpCoin' ? 'a pump coin' : r.source === 'quoteControl' ? "pump.fun's list" : 'pump.fun'}</strong></div><div><small>Its ant's level</small><strong>${r.source === 'pumpCoin' ? `${r.depth} of ${r.maxDepth || 5}` : '1 · a root queen'}</strong></div><div><small>Price</small><strong>${price(r.usd)}</strong></div><div><small>Contract</small><strong>${esc(short(m, 6))}</strong></div></div>
         <div class="act"><a class="btn g" href="#queen=${esc(m)}">Launch an ant of ${esc(nm)} <span class="ar">→</span></a><a class="btn o" href="https://pump.fun/coin/${esc(m)}" target="_blank" rel="noopener">${esc(nm)} on pump.fun ↗</a></div></div>`
      : `<div class="ckres"><span class="ic">✕</span><div><b>${esc(nm)} can't be a queen.</b><span>${esc(r.error || '')}</span></div><span class="verdict n">NOT A QUEEN</span></div>`;
  } catch (x) { ckOut.innerHTML = `<div class="ckres"><span class="ic">!</span><div><b>The check didn't finish.</b><span>${esc(x.message || '')}</span></div></div>`; }
  btn.disabled = false; btn.innerHTML = label;
});

// ---------- buy an ant with SOL: one multi-hop swap through every queen above it
const bForm = $('#bForm'), bMint = $('#bMint'), bSol = $('#bSol'), bGo = $('#bGo'), bFlow = $('#bFlow'), bSt = $('#bStatus');
let bLineData = null, bBusy = false, lineReq = 0;
async function lineFor(m) {
  const box = $('#bLine'); m = String(m || '').trim();
  if (!isAddr(m)) { bLineData = null; box.innerHTML = '<span class="msg">Its line shows here: SOL, its queen, the ant.</span>'; return; }
  const my = ++lineReq; box.innerHTML = '<span class="msg">Reading its line from Solana…</span>';
  try {
    const j = await api('chain', null, '?mint=' + encodeURIComponent(m)); if (my !== lineReq) return;
    bLineData = j; const L = j.line || [];
    const chips = L.map((x, i) => `<span class="${i === L.length - 1 ? 'me' : x.symbol === 'SOL' ? 'sol' : ''}">${esc(x.symbol === 'SOL' ? 'SOL' : x.symbol ? '$' + x.symbol : short(x.mint, 4))}</span>`).join('<em>›</em>');
    const note = j.root !== 'sol' ? `<span class="msg">Its line starts at ${esc(L[0] && L[0].symbol ? '$' + L[0].symbol : 'a listed asset')}, not SOL, so it's bought with that asset on pump.fun.</span>` : L.length < 3 ? '<span class="msg">A SOL coin, not an ant: this is a plain buy.</span>' : `<span class="msg">${L.length - 1} hops in one swap.</span>`;
    box.innerHTML = chips + note;
  } catch (e) { if (my === lineReq) { bLineData = null; box.innerHTML = `<span class="msg">${esc(e.message)}</span>`; } }
}
bMint.addEventListener('input', () => { clearTimeout(bMint._t); bMint._t = setTimeout(() => lineFor(bMint.value), 250); });
bMint.addEventListener('change', () => history.replaceState(null, '', location.pathname + (isAddr(bMint.value.trim()) ? '#ant=' + bMint.value.trim() : '#buy')));
$$('#bQuick button').forEach(b => b.addEventListener('click', () => { bSol.value = b.dataset.v; $$('#bQuick button').forEach(x => x.classList.toggle('on', x === b)); }));
const bstep = (k, state, note) => { const li = bFlow.querySelector(`[data-k="${k}"]`); if (!li) return; li.className = state; const n = li.querySelector('small'); if (n) n.innerHTML = note || ''; };
const bsay = (h, err) => { bSt.className = 'lstatus' + (err ? ' err' : ''); bSt.innerHTML = h; bSt.hidden = false; };
async function buyAnt() {
  if (bBusy) return; const m = bMint.value.trim(), sol = +bSol.value || 0;
  if (!isAddr(m)) return bsay("Paste an ant's contract address.", true);
  if (!(sol > 0)) return bsay('Enter how much SOL to spend.', true);
  if (sol > 50) return bsay('Keep a single buy at 50 SOL or less.', true);
  if (!wallet.address) { wallet.open(); return; }
  bBusy = true; bGo.disabled = true; bFlow.hidden = false; bSt.hidden = true;
  bFlow.querySelectorAll('li').forEach(li => { li.className = ''; const n = li.querySelector('small'); if (n) n.textContent = ''; });
  try {
    const order = ['build', 'sign', 'send', 'land'];
    const r = await swapRun(m, sol, +$('#bSlip').value || 5, (k, note) => { const at = order.indexOf(k); order.forEach((o, x) => { if (x < at) bstep(o, 'ok', bFlow.querySelector(`[data-k="${o}"] small`).innerHTML); }); bstep(k, k === 'land' ? 'ok' : 'run', note); });
    order.forEach(o => bstep(o, 'ok', bFlow.querySelector(`[data-k="${o}"] small`).innerHTML));
    bsay(`<b>Bought.</b> About ${fmtN(r.q.tokens || 0)} tokens for ${fmtN(sol)} SOL${r.steps > 1 ? `, in ${r.steps} steps` : ''}. Every queen above it was bought on the way.`);
  } catch (e) { const li = bFlow.querySelector('li.run'); if (li) li.className = 'bad'; bsay((e && e.message) || esc(String(e)), true); }
  bBusy = false; bGo.disabled = false;
}
bForm.addEventListener('submit', e => { e.preventDefault(); buyAnt(); });
pathScene($('#swapCv'), () => { const L = (bLineData && bLineData.line) || [], q = L.length >= 2 ? L[L.length - 2] : null, a = L.length ? L[L.length - 1] : null; return [q ? String(q.symbol || '?').slice(0, 6).toUpperCase() : '?', a ? String(a.symbol || 'ANT').slice(0, 6) : 'ANT', 'THE ANT']; });

// start: the queen or ant from the link (?queen= / ?ant= from the home page), or the queen used last
{
  const qs = new URLSearchParams(location.search), qq = qs.get('queen'), qa = qs.get('ant');
  if (qq && isAddr(qq)) history.replaceState(null, '', location.pathname + '#queen=' + qq);
  else if (qa && isAddr(qa)) history.replaceState(null, '', location.pathname + '#ant=' + qa);
  else if (!/^#(queen|host)=/.test(location.hash)) { const last = store.get('ant1:queen', null); if (last && isAddr(last)) setHost(last); }
}
// the wallet button (wired last: a wallet can answer the moment it is asked)
wallet.on(s => {
  const b = $('#wNav'); b.classList.toggle('on', !!s.address); b.textContent = s.address ? short(s.address, 4) : 'Connect';
  bal = null; refreshBalance(); paint();
});
$('#wNav').addEventListener('click', () => wallet.open());

paint(); route();
