/* TERRA command deck kernel (session 5). One state, hash routes, roving focus, focus-scoped digits,
   an opt-in shortcut layer, and one binding table that drives the listener and the key map.
   Every console is in the HTML at rest; without this script, in Document view and in print the
   whole deck reads as one page. Nothing here ticks, counts or simulates activity. */
(() => {
  'use strict';
  const H = document.documentElement;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const D = JSON.parse($('#deck-data').textContent);
  const T = D.copy;
  const fill = (t, o) => String(t).replace(/\{(\w+)\}/g, (m, k) => (k in o ? o[k] : m));
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const store = {
    get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } },
  };
  const VKEY = 'terra-deck-view:' + D.skin, SKEY = 'terra-deck-shortcuts';
  const mqStage = matchMedia('(min-width: 64em) and (min-height: 36em)');
  const mqReduce = matchMedia('(prefers-reduced-motion: reduce)');
  const IDS = D.consoles.map((c) => c.id);
  const APPS = D.apps.map((a) => a.id);
  const field = $('#d-field');
  const live = $('.d-live');
  const st = { console: 'standby', app: APPS[0], pad: 'today', step: 5, tl: D.records.length - 1, tier: 3 };
  let shortcuts = store.get(SKEY) === 'on';
  let gPending = 0;

  const stageOn = () => H.dataset.view === 'stage' && mqStage.matches && !H.dataset.print;
  const reduce = () => mqReduce.matches;
  const hide = (el, on) => { if (on) el.setAttribute('hidden', 'until-found'); else el.removeAttribute('hidden'); };

  // ---------------------------------------------------------------- routes
  const routeInt = (value, fallback, min, max) => clamp(Number.isFinite(+value) ? Math.trunc(+value) : fallback, min, max);
  function parse(hash) {
    let h;
    try { h = decodeURIComponent((hash || '').replace(/^#/, '')); }
    catch (e) { return null; }
    let m;
    if (!h) return { console: 'standby' };
    if (h[0] === '/') {
      const p = h.slice(1).split('/');
      const r = { console: IDS.includes(p[0]) ? p[0] : 'board' };
      if (r.console === 'apps') {
        if (APPS.includes(p[1])) r.app = p[1];
        if (D.pads.includes(p[2])) r.pad = p[2];
      }
      if (r.console === 'system' && p[1]) r.step = routeInt(p[1], 5, 1, 5);
      if (r.console === 'timeline' && p[1]) r.tl = routeInt(p[1], 1, 1, D.records.length) - 1;
      if (r.console === 'sovereignty' && p[1]) r.tier = routeInt(p[1], 0, 0, 3);
      return r;
    }
    if ((m = h.match(/^c-(\w+)$/)) && IDS.includes(m[1])) return { console: m[1] };
    if ((m = h.match(/^bay-(\w+?)(?:-p-(\w+))?$/)) && APPS.includes(m[1])) return { console: 'apps', app: m[1], pad: D.pads.includes(m[2]) ? m[2] : 'today' };
    return null;
  }
  function hashOf(s) {
    if (s.console === 'apps') return `#/apps/${s.app}/${s.pad}`;
    if (s.console === 'system') return `#/system/${s.step}`;
    if (s.console === 'timeline') return `#/timeline/${s.tl + 1}`;
    if (s.console === 'sovereignty') return `#/sovereignty/${s.tier}`;
    return `#/${s.console}`;
  }

  // ---------------------------------------------------------------- announcements
  function say(msg) {
    if (document.ariaNotify) document.ariaNotify(msg);
    else { live.textContent = ''; requestAnimationFrame(() => { live.textContent = msg; }); }
  }
  const conOf = (id) => D.consoles.find((c) => c.id === id);
  const appOf = (id) => D.apps.find((a) => a.id === id);

  // ---------------------------------------------------------------- apply state to the DOM
  function apply(next, opts = {}) {
    const prev = { ...st };
    Object.assign(st, next || {});
    const stage = stageOn();
    H.dataset.console = st.console;
    for (const el of $$('.console')) hide(el, stage && el.dataset.console !== st.console);
    for (const b of $$('.bay')) {
      const on = b.dataset.app === st.app;
      hide(b, stage && !on);
      for (const p of $$('.panel', b)) hide(p, stage && p.dataset.pad !== st.pad);
      for (const a of $$('.pad', b)) {
        const cur = a.dataset.pad === st.pad;
        a.toggleAttribute('aria-current', cur);
        if (cur) a.setAttribute('aria-current', 'true');
        a.tabIndex = cur ? 0 : -1;
      }
    }
    for (const a of $$('.d-rail a')) {
      const cur = a.dataset.console === st.console;
      if (cur) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
      a.tabIndex = cur ? 0 : -1;
    }
    for (const a of $$('.d-pad9 a')) {
      const cur = a.dataset.app === st.app;
      if (cur && st.console === 'apps') a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
      a.tabIndex = cur ? 0 : -1;
    }
    // System: the step is a camera move over the whole picture; nothing is withheld from it.
    $('.sy-svg').dataset.step = st.step;
    for (const t of $$('.sy-tx')) hide(t, stage && +t.dataset.step !== st.step);
    for (const a of $$('.sy-st')) { if (+a.dataset.step === st.step) a.setAttribute('aria-current', 'step'); else a.removeAttribute('aria-current'); }
    pos('.sy-ctrl', T['deck.sys.step'], { n: st.step, total: 5 });
    camera(stage ? st.step : 5, opts.instant || reduce() || prev.console !== 'system');
    // Timeline cursor and sovereignty tier: emphasis only, every record and tier stays on screen.
    for (const li of $$('.t-rec')) { if (+li.dataset.i === st.tl) li.setAttribute('aria-current', 'true'); else li.removeAttribute('aria-current'); }
    pos('.tl-ctrl', T['deck.tl.pos'], { n: st.tl + 1, total: D.records.length });
    $('.sv-fig').dataset.tier = 't' + st.tier;
    for (const li of $$('.sv-tier')) { if (li.dataset.tier === 't' + st.tier) li.setAttribute('aria-current', 'true'); else li.removeAttribute('aria-current'); }
    pos('.sv-ctrl', T['deck.sov.tier.pos'], { n: st.tier + 1, total: 4 });
    // Crumb, title, announcement
    const con = conOf(st.console);
    const name = st.console === 'apps' ? appOf(st.app).name : con.name;
    $('.d-crumb-code').textContent = con.code;
    $('.d-crumb-name').textContent = name;
    document.title = fill(T['deck.doctitle'], { name });
    const moved = prev.console !== st.console || (st.console === 'apps' && prev.app !== st.app);
    if (opts.announce !== false && (moved || prev.pad !== st.pad)) {
      say(st.console === 'apps' ? fill(T['deck.announce.app'], { name, pad: T['deck.pad.' + st.pad] }) : fill(T['deck.announce'], { code: con.code, name }));
    }
    if (opts.focus && moved) {
      const h = st.console === 'apps' ? $(`#bay-${st.app}-h`) : $(`#h-${st.console}`);
      if (!stage) (st.console === 'apps' && opts.pad ? $(`#bay-${st.app}-p-${st.pad}`) : h.closest('.bay, .console')).scrollIntoView({ block: 'start', behavior: reduce() ? 'auto' : 'smooth' });
      h.focus({ preventScroll: stage });
    } else if (opts.focus && !stage && opts.pad) {
      $(`#bay-${st.app}-p-${st.pad}`).scrollIntoView({ block: 'start', behavior: reduce() ? 'auto' : 'smooth' });
    }
    document.dispatchEvent(new CustomEvent('deck:change', { detail: { ...st, mode: H.dataset.mode, view: H.dataset.view, stage } }));
  }
  function pos(sel, tpl, o) { const p = $(sel + ' .d-pos'); if (p) p.textContent = fill(tpl, o); }

  // ---------------------------------------------------------------- navigation (shutter, morph)
  function go(next, opts = {}) {
    const target = { ...st, ...next };
    if (target.console === 'apps' && !next.pad && next.app && next.app !== st.app) target.pad = 'today';
    const url = hashOf(target);
    if (location.hash !== url) history.pushState(null, '', location.pathname + location.search + url);
    swap(() => apply(target, { focus: true, ...opts }), opts);
  }
  function swap(fn, opts) {
    const changes = opts.console !== false;
    if (!stageOn() || reduce() || opts.instant || !changes) { fn(); return; }
    if (!document.startViewTransition) {
      fn();
      field.classList.remove('is-open'); void field.offsetWidth; field.classList.add('is-open');
      return;
    }
    const from = opts.from;
    if (from) from.style.viewTransitionName = 'bayframe';
    const vt = document.startViewTransition(() => {
      if (from) from.style.viewTransitionName = '';
      fn();
      const head = from && $(`#bay-${st.app} .bay-head`);
      if (head) { head.style.viewTransitionName = 'bayframe'; vt.finished.finally(() => { head.style.viewTransitionName = ''; }); }
    });
  }

  // ---------------------------------------------------------------- the stage camera (viewBox moves)
  const wide = $('.sys-wide');
  const full = wide ? wide.getAttribute('viewBox').split(' ').map(Number) : null;
  let cam = full && full.slice(), camRaf = 0;
  if (wide) wide.style.aspectRatio = `${full[2]} / ${full[3]}`;
  function box(sel) {
    const b = $$(sel, wide).map((g) => g.getBBox()).filter((r) => r.width);
    if (!b.length) return full;
    const x0 = Math.min(...b.map((r) => r.x)), y0 = Math.min(...b.map((r) => r.y));
    const x1 = Math.max(...b.map((r) => r.x + r.width)), y1 = Math.max(...b.map((r) => r.y + r.height));
    const p = 28;
    return [x0 - p, y0 - p, x1 - x0 + 2 * p, y1 - y0 + 2 * p];
  }
  function camera(step, instant) {
    if (!wide || !wide.getClientRects().length) { if (wide) { cam = full.slice(); wide.setAttribute('viewBox', full.join(' ')); } return; }
    // Frame the tiles and domain labels (L1 also carries the date key in the far corner).
    const to = { 1: () => box('.sys-L1 .sys-app, .sys-L1 .dom'), 2: () => box('.sys-L1 .sys-app, .sys-L1 .dom, .sys-L2'), 3: () => box('.sys-L3, .sys-L1 .sys-app'), 4: () => box('.sys-L4'), 5: () => full }[step]();
    cancelAnimationFrame(camRaf);
    const done = () => document.dispatchEvent(new CustomEvent('deck:camera', { detail: { step } }));
    if (instant) { cam = to.slice(); wide.setAttribute('viewBox', cam.join(' ')); done(); return; }
    const from = cam.slice(), t0 = performance.now(), dur = 420;
    const ease = (t) => 1 - Math.pow(1 - t, 3.2);
    const tick = (now) => {
      const k = ease(Math.min(1, (now - t0) / dur));
      cam = from.map((v, i) => v + (to[i] - v) * k);
      wide.setAttribute('viewBox', cam.map((v) => v.toFixed(1)).join(' '));
      if (k < 1) camRaf = requestAnimationFrame(tick); else done();
    };
    camRaf = requestAnimationFrame(tick);
  }

  // ---------------------------------------------------------------- switches
  function setMode(m) {
    H.dataset.mode = m;
    for (const b of $$('[data-set-mode]')) b.setAttribute('aria-pressed', String(b.dataset.setMode === m));
    const q = new URLSearchParams(location.search);
    if (m === 'projected') q.set('mode', m); else q.delete('mode');
    history.replaceState(null, '', location.pathname + (q.toString() ? '?' + q : '') + location.hash);
    document.dispatchEvent(new CustomEvent('deck:mode', { detail: { mode: m } }));
  }
  function setView(v, focus) {
    H.dataset.view = v;
    store.set(VKEY, v);
    for (const b of $$('[data-set-view]')) b.setAttribute('aria-pressed', String(b.dataset.setView === v));
    apply({}, { announce: false, instant: true, focus });
    if (focus) (st.console === 'apps' ? $(`#bay-${st.app}-h`) : $(`#h-${st.console}`)).focus();
  }
  function setShortcuts(on) {
    shortcuts = on;
    store.set(SKEY, on ? 'on' : 'off');
    const b = $('[data-act="shortcuts"]');
    b.setAttribute('aria-pressed', String(on));
    $('.d-sc-state', b).textContent = on ? T['deck.shortcuts.on'] : T['deck.shortcuts.off'];
    for (const bd of BIND) {
      if (!bd.target) continue;
      for (const el of $$(bd.target)) { if (on) el.setAttribute('aria-keyshortcuts', bd.aria); else el.removeAttribute('aria-keyshortcuts'); }
    }
  }

  // ---------------------------------------------------------------- one binding table (idea 24)
  const step = (d) => {
    const i = IDS.indexOf(st.console);
    go({ console: IDS[(i + d + IDS.length) % IDS.length] });
  };
  const BIND = [
    { id: 'tab', keys: ['Tab', 'Shift Tab'] },
    { id: 'arrows-rail', keys: ['↑', '↓'] },
    { id: 'arrows-pad9', keys: ['←', '↑', '→', '↓'] },
    { id: 'digits-pad9', keys: ['1', '9'], range: true },
    { id: 'arrows-pads', keys: ['←', '→'] },
    { id: 'digits-pads', keys: ['1', '6'], range: true },
    { id: 'enter', keys: ['Enter', 'Space'] },
    { id: 'esc', keys: ['Esc'] },
    { id: 'prev', keys: ['['], layer: 1, match: (k) => k === '[', run: () => step(-1) },
    { id: 'next', keys: [']'], layer: 1, match: (k) => k === ']', run: () => step(1) },
    { id: 'goto', keys: ['G', D.consoles.map((c) => c.letter).join(' ')], layer: 1 },
    { id: 'mode', keys: ['T'], layer: 1, match: (k) => k === 't' || k === 'T', run: () => setMode(H.dataset.mode === 'projected' ? 'today' : 'projected'), target: '[data-set-mode]', aria: 'T' },
    { id: 'ask', keys: ['/'], layer: 1, match: (k) => k === '/', run: () => $('#d-ask-q').focus(), target: '#d-ask-q', aria: '/' },
    { id: 'help', keys: ['?'], layer: 1, match: (k) => k === '?', run: () => openKeys(), target: '[data-act="keys"]', aria: '?' },
    { id: 'home', keys: ['Esc'], layer: 1, match: (k) => k === 'Escape', run: () => go({ console: 'board' }) },
  ];
  function keyMap() {
    const kbd = (b) => b.range ? `<kbd>${b.keys[0]}</kbd> to <kbd>${b.keys[1]}</kbd>` : b.keys.map((k) => `<kbd>${k}</kbd>`).join(' ');
    const rows = (layer) => BIND.filter((b) => !!b.layer === layer).map((b) => `<div class="km-row"><dt>${kbd(b)}</dt><dd>${esc(T['deck.key.' + b.id])}</dd></div>`).join('');
    return `<h2 id="d-keys-h" class="km-h">${esc(T['deck.keys.title'])}</h2><p class="km-lede">${esc(T['deck.keys.lede'])}</p>` +
      `<h3 class="km-s">${esc(T['deck.keys.always'])}</h3><dl class="km">${rows(false)}</dl>` +
      `<h3 class="km-s">${esc(T['deck.keys.layer'])}</h3><p class="km-note">${esc(T['deck.shortcuts.note'])}</p><dl class="km">${rows(true)}</dl>` +
      `<form method="dialog"><button class="btn">${esc(T['deck.keys.close'])}</button></form>`;
  }
  const esc = (s) => String(s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  const dlg = $('#d-keys');
  function openKeys() { if (!dlg.open) { dlg.innerHTML = keyMap(); dlg.showModal(); } }

  // ---------------------------------------------------------------- roving focus groups and scoped keys
  function rove(items, i, e) {
    e.preventDefault();
    const n = clamp(i, 0, items.length - 1);
    items.forEach((el, k) => { el.tabIndex = k === n ? 0 : -1; });
    items[n].focus();
  }
  function scoped(e) {
    const t = e.target, k = e.key;
    if (e.ctrlKey || e.altKey || e.metaKey) return false;
    const inRail = t.closest('.d-rail a'), in9 = t.closest('.d-pad9 a'), inPad = t.closest('.pads a');
    if (inRail) {
      const items = $$('.d-rail a'), i = items.indexOf(inRail);
      const d = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[k];
      if (d) { rove(items, i + d, e); return true; }
      if (k === 'Home' || k === 'End') { rove(items, k === 'Home' ? 0 : items.length - 1, e); return true; }
    }
    if (in9) {
      const items = $$('.d-pad9 a'), i = items.indexOf(in9);
      const d = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 3, ArrowUp: -3 }[k];
      if (d) { rove(items, i + d, e); return true; }
      if (k === 'Home' || k === 'End') { rove(items, k === 'Home' ? 0 : items.length - 1, e); return true; }
      if (/^[1-9]$/.test(k)) { e.preventDefault(); const a = items[+k - 1]; a.focus(); go({ console: 'apps', app: a.dataset.app }, { from: a }); return true; }
    }
    if (inPad) {
      const items = $$('.pads a', inPad.closest('.bay')), i = items.indexOf(inPad);
      const d = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[k];
      if (d) { rove(items, i + d, e); return true; }
      if (k === 'Home' || k === 'End') { rove(items, k === 'Home' ? 0 : items.length - 1, e); return true; }
      if (/^[1-6]$/.test(k)) { e.preventDefault(); const a = items[+k - 1]; a.focus(); go({ pad: a.dataset.pad }, { pad: true, console: false, focus: false }); return true; }
    }
    const lr = { ArrowRight: 1, ArrowLeft: -1 }[k];
    if (lr && t.closest('.sy-stepper, .sy-ctrl')) { e.preventDefault(); go({ step: clamp(st.step + lr, 1, 5) }, { console: false }); return true; }
    if (lr && t.closest('.tl-ctrl, .tl-list')) { e.preventDefault(); go({ tl: clamp(st.tl + lr, 0, D.records.length - 1) }, { console: false }); return true; }
    if (lr && t.closest('.sv-ctrl')) { e.preventDefault(); go({ tier: clamp(st.tier + lr, 0, 3) }, { console: false }); return true; }
    return false;
  }
  const editable = (t) => t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName);
  document.addEventListener('keydown', (e) => {
    if (e.defaultPrevented || scoped(e)) return;
    if (!shortcuts || e.ctrlKey || e.altKey || e.metaKey || e.isComposing || e.keyCode === 229) return;
    if (editable(e.target) || dlg.open || $(':popover-open')) return;
    const k = e.key;
    if (gPending) {
      gPending = 0;
      const c = D.consoles.find((x) => x.letter === k.toUpperCase());
      if (c) { e.preventDefault(); go({ console: c.id }); }
      return;
    }
    if (k === 'g' || k === 'G') { gPending = 1; setTimeout(() => { gPending = 0; }, 1500); return; }
    const b = BIND.find((x) => x.layer && x.match && x.match(k));
    if (b) { e.preventDefault(); b.run(); }
  });

  // ---------------------------------------------------------------- clicks and forms
  document.addEventListener('click', (e) => {
    const t = e.target.closest('a, button');
    if (!t || e.defaultPrevented || e.button || e.ctrlKey || e.metaKey || e.shiftKey) return;
    if (t.dataset.setMode) { setMode(t.dataset.setMode); return; }
    if (t.dataset.setView) { setView(t.dataset.setView, true); return; }
    const act = t.dataset.act;
    if (act === 'keys') return openKeys();
    if (act === 'shortcuts') return setShortcuts(!shortcuts);
    const nav = { 'sys-prev': { step: st.step - 1 }, 'sys-next': { step: st.step + 1 }, 'tl-prev': { tl: st.tl - 1 }, 'tl-next': { tl: st.tl + 1 }, 'sv-prev': { tier: st.tier - 1 }, 'sv-next': { tier: st.tier + 1 } }[act];
    if (nav) {
      const n = { step: clamp(nav.step ?? st.step, 1, 5), tl: clamp(nav.tl ?? st.tl, 0, D.records.length - 1), tier: clamp(nav.tier ?? st.tier, 0, 3) };
      return go(n, { console: false });
    }
    if (t.dataset.filter) return filter(t);
    if (t.tagName !== 'A') return;
    const href = t.getAttribute('href') || '';
    if (t.classList.contains('sy-st')) { e.preventDefault(); return go({ console: 'system', step: +t.dataset.step }, { console: st.console !== 'system' }); }
    if (href === '#d-rail') return;
    const r = href[0] === '#' && parse(href);
    if (!r) return;
    e.preventDefault();
    const same = r.console === st.console && (r.console !== 'apps' || r.app === st.app);
    go(r, { from: t.closest('.d-pad9') ? t : null, console: !same, pad: !!r.pad, focus: !t.classList.contains('pad') });
  });
  function filter(btn) {
    const k = btn.dataset.filter, kinds = { recorded: 'solid', demo: 'dashed', planned: 'dotted' };
    for (const b of $$('[data-filter]')) b.setAttribute('aria-pressed', String(b === btn));
    for (const li of $$('.lg-row')) li.hidden = k !== 'all' && li.dataset.kind !== kinds[k];
  }
  $('.trace').addEventListener('submit', (e) => {
    e.preventDefault();
    const f = e.target, a = f.from.value, b = f.to.value, out = $('.trace-out', f);
    const A = appOf(a).name, B = appOf(b).name;
    if (a === b) { out.textContent = fill(T['deck.trace.same'], { from: A, to: B }); return; }
    const l = D.links.find((x) => (x.a === a && x.b === b) || (x.a === b && x.b === a));
    if (!l) { out.textContent = fill(T['deck.trace.result.none'], { from: A, to: B, state: T['deck.unlit.noconn'] }); return; }
    const state = l.date ? `${l.state}, ${l.date.slice(5, 7)}/${l.date.slice(8)}/${l.date.slice(0, 4)}` : `${l.state}, ${T['conv.when.planned']}`;
    out.textContent = fill(T[l.kind === 'dotted' ? 'deck.trace.result.dotted' : 'deck.trace.result.dashed'], { from: A, to: B, state }) + ' ' + l.text;
  });
  // Ask the record: a closed vocabulary over the facts in the page, no model; a miss says so.
  $('.d-ask').addEventListener('submit', (e) => {
    e.preventDefault();
    const q = e.target.q.value.trim().toLowerCase(), out = $('.d-ask-out');
    if (!q) { out.textContent = T['deck.ask.help']; return; }
    const app = D.apps.find((a) => [a.id, a.name, a.short].some((n) => q.includes(n.toLowerCase())) || (q.includes('shield') && a.id === 'cast'));
    const dom = D.domains.find((x) => q.includes(x.id) || q.includes(x.label.toLowerCase()));
    const dm = q.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?|(\d{4})-(\d\d)-(\d\d)/);
    let ans;
    // SHIELD is CAST's presentation shell on fictional samples: answer with its own record, never CAST's stage.
    if (/shield/.test(q) && !/cast/.test(q)) ans = D.shield;
    else if (app) ans = fill(T['deck.ask.ans.app'], { name: app.name, stage: app.stage, date: app.recordUS });
    else if (dom) ans = fill(T['deck.ask.ans.domain'], { domain: dom.label, list: D.apps.filter((a) => a.domain === dom.id).map((a) => a.name).join(', ') });
    else if (dm) {
      const isoD = dm[4] ? `${dm[4]}-${dm[5]}-${dm[6]}` : `${dm[3] || D.recordsAsOf.slice(0, 4)}-${dm[1].padStart(2, '0')}-${dm[2].padStart(2, '0')}`;
      const hits = D.records.filter((r) => r.date === isoD).map((r) => r.text);
      const us = `${isoD.slice(5, 7)}/${isoD.slice(8)}/${isoD.slice(0, 4)}`;
      ans = hits.length ? fill(T['deck.ask.ans.date'], { date: us, list: hits.join(' ') }) : null;
    } else if (/deploy|public|live/.test(q)) {
      const a = D.apps.find((x) => x.cls === 'exists');
      ans = fill(T['deck.ask.ans.deployed'], { name: a.name, date: D.deployedUS, n: D.counts.public, total: D.counts.apps });
    } else if (/flow|connect|link|data between/.test(q)) ans = fill(T['deck.ask.ans.flows'], { n: D.counts.flows, demos: D.counts.demos });
    else if (/project|release|december|candidate|\brc\b|0\.9/.test(q)) ans = fill(T['deck.ask.ans.projected'], { label: D.rcLabel, when: D.rcWhen, n: D.rcDays, date: D.recordsUS });
    out.textContent = ans || `${T['deck.ask.miss']}. ${T['deck.ask.miss.note']}`;
  });

  // ---------------------------------------------------------------- history, find-in-page, print, media
  addEventListener('popstate', () => { const r = parse(location.hash); if (r) apply(r, { focus: true }); });
  addEventListener('hashchange', () => { const r = parse(location.hash); if (r && hashOf({ ...st, ...r }) !== hashOf(st)) apply(r, { focus: true }); });
  document.addEventListener('beforematch', (e) => {
    const el = e.target;
    const r = el.classList.contains('console') ? { console: el.dataset.console } : el.classList.contains('bay') ? { console: 'apps', app: el.dataset.app }
      : el.classList.contains('panel') ? { console: 'apps', app: el.closest('.bay').dataset.app, pad: el.dataset.pad } : el.classList.contains('sy-tx') ? { console: 'system', step: +el.dataset.step } : null;
    if (r) { history.pushState(null, '', hashOf({ ...st, ...r })); apply(r, { instant: true }); }
  });
  addEventListener('beforeprint', () => { H.dataset.print = '1'; apply({}, { announce: false, instant: true }); });
  addEventListener('afterprint', () => { delete H.dataset.print; apply({}, { announce: false, instant: true }); });
  mqStage.addEventListener('change', () => apply({}, { announce: false, instant: true }));

  // ---------------------------------------------------------------- embedded displays (D47g)
  // A heavy embedded view (GeoBase's 3D display) loads only once its figure is shown and near
  // the viewport; hidden consoles and panels never intersect, so nothing loads at rest elsewhere.
  const lazyFrames = $$('iframe[data-src]');
  if (lazyFrames.length && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver((es) => {
      for (const e of es) if (e.isIntersecting) { e.target.src = e.target.dataset.src; io.unobserve(e.target); }
    }, { rootMargin: '200px' });
    for (const f of lazyFrames) io.observe(f);
  } else for (const f of lazyFrames) f.src = f.dataset.src;

  // ---------------------------------------------------------------- start
  for (const b of $$('[data-set-view]')) b.setAttribute('aria-pressed', String(b.dataset.setView === H.dataset.view));
  if (H.dataset.mode === 'projected') setMode('projected');
  setShortcuts(shortcuts);
  const start = parse(location.hash) || { console: 'standby' };
  if (H.dataset.station && IDS.includes(H.dataset.station) && !location.hash) start.console = H.dataset.station;
  apply(start, { announce: false, instant: true });
  if (location.hash && !stageOn()) {
    const el = start.console === 'apps' ? $(start.pad ? `#bay-${st.app}-p-${st.pad}` : `#bay-${st.app}`) : $(`#c-${st.console}`);
    if (el) el.scrollIntoView({ block: 'start' });
  }
  window.TERRADeck = { state: st, go, setMode, setView, reduce };
})();
