/* I-1 Field Station: the world behind the glass. In Stage view the current console's own photograph
   (the kernel's .c-photo, cloned with its sources and focal point) fills the whole station behind the
   HUD; the chrome is glass over it. Moment 1: when the photograph changes, the next one is decoded
   first, then crossfades in 650 ms over the last; instant under reduced motion. Only a person's
   action changes it; nothing here runs at rest. Document view, print and no-JS keep the kernel's
   per-console photographs. */
(() => {
  'use strict';
  const H = document.documentElement;
  const sky = document.querySelector('.decor-deck_start .fs-sky');
  if (!sky) return;
  const layers = [...sky.querySelectorAll('.fs-layer')];
  const mqStage = matchMedia('(min-width: 64em) and (min-height: 36em)');
  const mqReduce = matchMedia('(prefers-reduced-motion: reduce)');
  let vis = layers[0], shown, settle = 0, ticket = 0;

  const sourceOf = (s) => document.querySelector(s.console === 'apps' ? `#bay-${s.app} > .c-photo` : `#c-${s.console} > .c-photo`);

  function swap(next, prev, instant) {
    clearTimeout(settle);
    vis = next;
    next.style.transition = 'none';
    next.classList.remove('is-on');
    prev.classList.remove('is-top');
    next.classList.add('is-top');
    void next.offsetWidth;
    next.style.transition = instant ? 'none' : '';
    next.classList.add('is-on');
    settle = setTimeout(() => { prev.classList.remove('is-on'); prev.replaceChildren(); }, instant ? 0 : 700);
  }

  function show(s, first) {
    const stage = H.dataset.view === 'stage' && mqStage.matches && !H.dataset.print;
    H.classList.toggle('fs-sky-on', stage);
    if (!stage) return;
    const src = sourceOf(s);
    const key = src ? src.dataset.photo : 'none';
    if (key === shown) return;
    shown = key;
    const my = ++ticket;
    const prev = vis, next = vis === layers[0] ? layers[1] : layers[0];
    const instant = first || mqReduce.matches;
    next.replaceChildren();
    if (!src) { swap(next, prev, instant); return; }
    const pic = src.querySelector('picture').cloneNode(true);
    const img = pic.querySelector('img');
    img.loading = 'eager';
    img.decoding = 'async';
    next.style.setProperty('--focus', src.style.getPropertyValue('--focus') || '50% 50%');
    next.append(pic);
    const ready = img.decode ? img.decode().catch(() => {}) : Promise.resolve();
    // Never wait long: a slow photograph must not hold the old one on screen.
    Promise.race([ready, new Promise((r) => setTimeout(r, 900))]).then(() => { if (my === ticket) swap(next, prev, instant); });
  }

  document.addEventListener('deck:change', (e) => show(e.detail, false));
  const D = window.TERRADeck;
  show(D ? D.state : { console: 'standby' }, true);
})();
