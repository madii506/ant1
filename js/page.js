// Docs and 404: the quiet background, the contents that follow your reading, and the live numbers.
import { $, $$, reduced } from './util.js';
import { background } from './scenes.js';

background($('#bg'), reduced);
const nav = $('#dock'); if (nav) { const f = () => nav.classList.toggle('solid', scrollY > 10); addEventListener('scroll', f, { passive: true }); f(); }

const toc = $$('.toc a');
if (toc.length) {
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) toc.forEach(a => a.classList.toggle('on', a.getAttribute('href') === '#' + e.target.id)); }), { rootMargin: '-40% 0px -55% 0px' });
  $$('.doc article section').forEach(s => io.observe(s));
}
if ($('[data-live]')) {
  fetch('/api/hosts').then(r => r.json()).then(j => {
    if (!j || !j.ok) return;
    $$('[data-live="hosts"]').forEach(e => (e.textContent = (j.count || j.hosts.length).toLocaleString('en-US')));
    if (j.maxDepth != null) $$('[data-live="depth"]').forEach(e => (e.textContent = j.maxDepth));
  }).catch(() => { });
  fetch('/api/config').then(r => r.json()).then(j => { if (j && j.ok && j.tag) $$('[data-live="tag"]').forEach(e => (e.textContent = j.tag)); }).catch(() => { });
}
