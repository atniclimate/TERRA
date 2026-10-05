/* TERRA showcase interactions. Progressive enhancement: every piece of content
   is in the HTML; this script only adds navigation state, the plate reader, the
   convergence toggle and focus panel, illustrative flow marks on recorded lines,
   the CAST to SHIELD demonstration, the on-demand DDM embed and the TSDF request
   figure. Reduced motion: no movement, final states shown. */
(function () {
  "use strict";
  var RM = window.matchMedia("(prefers-reduced-motion: reduce)");
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* ---------------------------------------------------- menu */
  var btn = $(".menu-btn"), nav = $("#site-nav");
  if (btn && nav) {
    btn.addEventListener("click", function () {
      var open = nav.classList.toggle("open");
      btn.setAttribute("aria-expanded", open ? "true" : "false");
    });
    var closeMenu = function () { nav.classList.remove("open"); btn.setAttribute("aria-expanded", "false"); };
    nav.addEventListener("click", function (e) {
      var a = e.target.closest("a");
      if (!a) return;
      closeMenu();
      // Land focus on the section heading so keyboard users continue from there.
      var sec = document.getElementById(a.getAttribute("href").slice(1));
      var h = sec && sec.querySelector("h2, h1");
      if (h) { h.setAttribute("tabindex", "-1"); setTimeout(function () { h.focus({ preventScroll: true }); }, 0); }
    });
    nav.addEventListener("focusout", function (e) {
      if (nav.classList.contains("open") && !nav.contains(e.relatedTarget) && e.relatedTarget !== btn) closeMenu();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && nav.classList.contains("open")) { nav.classList.remove("open"); btn.setAttribute("aria-expanded", "false"); btn.focus(); }
    });
  }

  /* ---------------------------------------------------- countdown to the projected release candidates */
  // The static figure counts from the newest record (10/05/2026); in a browser it counts from today.
  $$("[data-countdown]").forEach(function (el) {
    var p = el.getAttribute("data-countdown").split("-");
    var target = Date.UTC(+p[0], +p[1] - 1, +p[2]);
    var now = new Date();
    var today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
    var d = Math.round((target - today) / 86400000);
    el.textContent = String(Math.max(0, d));
  });

  /* ---------------------------------------------------- current section in nav */
  if ("IntersectionObserver" in window) {
    var links = {};
    $$(".site-nav a").forEach(function (a) { links[a.getAttribute("href").slice(1)] = a; });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        var a = links[en.target.id];
        if (!a) return;
        if (en.isIntersecting) {
          Object.keys(links).forEach(function (k) { links[k].removeAttribute("aria-current"); });
          a.setAttribute("aria-current", "true");
        }
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    Object.keys(links).forEach(function (id) { var s = document.getElementById(id); if (s) io.observe(s); });
  }

  /* ---------------------------------------------------- plate reader */
  var reader = $(".reader");
  var plates = $$(".plate");
  var ixLinks = $$(".reader-index a[data-app]");
  function selectPlate(id, focus) {
    var target = document.getElementById("app-" + id);
    if (!target || !reader) return false;
    plates.forEach(function (p) { p.hidden = p !== target; });
    ixLinks.forEach(function (a) {
      if (a.getAttribute("data-app") === id) a.setAttribute("aria-current", "true");
      else a.removeAttribute("aria-current");
    });
    if (focus) {
      target.setAttribute("tabindex", "-1");
      var top = reader.getBoundingClientRect().top + window.pageYOffset - 72;
      if (window.innerWidth < 1024) top = target.getBoundingClientRect().top + window.pageYOffset - 72;
      window.scrollTo({ top: top, behavior: RM.matches ? "auto" : "smooth" });
      target.focus({ preventScroll: true });
    }
    return true;
  }
  if (reader && plates.length) {
    reader.classList.add("tabbed");
    var initial = (location.hash.match(/^#app-([\w-]+)$/) || [])[1];
    selectPlate(initial && document.getElementById("app-" + initial) ? initial : plates[0].id.slice(4), false);
    if (initial) setTimeout(function () { selectPlate(initial, true); }, 60);
    document.addEventListener("click", function (e) {
      var a = e.target.closest('a[href^="#app-"]');
      if (!a) return;
      var id = a.getAttribute("href").slice(5);
      if (!document.getElementById("app-" + id)) return;
      e.preventDefault();
      if (history.pushState) history.pushState(null, "", "#app-" + id);
      selectPlate(id, true);
    });
    window.addEventListener("popstate", function () {
      var m = location.hash.match(/^#app-([\w-]+)$/);
      if (m) selectPlate(m[1], true);
    });
  }

  /* ---------------------------------------------------- convergence */
  var stage = $(".conv-stage");
  var data = {};
  try { data = JSON.parse(($("#conv-data") || {}).textContent || "{}"); } catch (e) { data = {}; }
  if (stage) {
    // Planned lines fade in one after another; they never move and never turn solid.
    $$(".proj", stage).forEach(function (g) {
      Array.prototype.forEach.call(g.children, function (el, i) { el.style.setProperty("--i", i); });
    });
    // In "Today" the planned layer is a faint ghost: hidden from assistive technology too.
    var setState = function (st) {
      stage.setAttribute("data-state", st);
      $$(".proj, .stamp-proj", stage).forEach(function (g) {
        if (st === "proj") g.removeAttribute("aria-hidden"); else g.setAttribute("aria-hidden", "true");
      });
      $$(".conv-toggle button", stage).forEach(function (o) { o.setAttribute("aria-pressed", o.getAttribute("data-set") === st ? "true" : "false"); });
    };
    setState(stage.getAttribute("data-state") || "now");
    $$(".conv-toggle button", stage).forEach(function (b) {
      b.addEventListener("click", function () { setState(b.getAttribute("data-set")); });
    });
    var info = $(".conv-info", stage);
    var hint = info ? info.innerHTML : "";
    var esc = function (s) { var d = document.createElement("div"); d.textContent = s == null ? "" : String(s); return d.innerHTML; };
    var focusNode = function (id) {
      var d = data[id];
      stage.classList.add("focus");
      $$(".node", stage).forEach(function (n) { n.classList.toggle("on", n.getAttribute("data-node") === id); });
      $$(".ln", stage).forEach(function (l) {
        var on = l.getAttribute("data-from") === id || l.getAttribute("data-to") === id;
        l.classList.toggle("on", on);
      });
      if (info && d) {
        info.className = "conv-info acc-" + d.accent;
        info.innerHTML = "<h4>" + esc(d.name) + "</h4><p><b>" + esc(d.stage) + "</b> · " + esc(data._labels.newest) + " " + esc(d.record) + "</p>" +
          "<p>" + esc(d.kind) + ": " + esc(d.spring) + "</p>" +
          '<p><a class="text-link" href="' + esc(d.href) + '">' + esc(d.name === "SHIELD" ? data.cast.name : d.name) + "</a></p>";
      }
    };
    var clear = function () {
      stage.classList.remove("focus");
      $$(".on", stage).forEach(function (n) { n.classList.remove("on"); });
    };
    $$(".node", stage).forEach(function (n) {
      var id = n.getAttribute("data-node");
      n.addEventListener("mouseenter", function () { focusNode(id); });
      n.addEventListener("focus", function () { focusNode(id); });
      n.addEventListener("mouseleave", clear);
      n.addEventListener("blur", clear);
    });

    // Illustrative flow marks, only on solid (recorded) lines, only while visible.
    var flows = [], running = false, raf = 0, t0 = 0;
    var NS = "http://www.w3.org/2000/svg";
    $$(".spring.ln-solid", stage).forEach(function (p, i) {
      var len = p.getTotalLength();
      if (!len) return;
      for (var k = 0; k < 2; k++) {
        var c = document.createElementNS(NS, "circle");
        c.setAttribute("r", "3.2");
        c.setAttribute("class", "flow");
        c.setAttribute("aria-hidden", "true");
        p.parentNode.appendChild(c);
        flows.push({ p: p, c: c, len: len, off: (k * 0.5 + i * 0.13) % 1 });
      }
    });
    var place = function (now) {
      var t = (now - t0) / 2600;
      for (var i = 0; i < flows.length; i++) {
        var f = flows[i], u = (t + f.off) % 1, pt = f.p.getPointAtLength(u * f.len);
        f.c.setAttribute("cx", pt.x.toFixed(1));
        f.c.setAttribute("cy", pt.y.toFixed(1));
        f.c.setAttribute("opacity", (Math.sin(u * Math.PI)).toFixed(2));
      }
      if (running) raf = requestAnimationFrame(place);
    };
    var setRun = function (on) {
      if (RM.matches) on = false;
      if (on && !running) { running = true; t0 = performance.now(); raf = requestAnimationFrame(place); }
      if (!on && running) { running = false; cancelAnimationFrame(raf); }
      if (!on) flows.forEach(function (f) { f.c.setAttribute("opacity", "0"); });
    };
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (en) { setRun(en[0].isIntersecting); }, { threshold: 0.05 }).observe(stage);
    }
    RM.addEventListener && RM.addEventListener("change", function () { setRun(!RM.matches); });
  }

  /* ---------------------------------------------------- CAST to SHIELD demonstration */
  var demo = $("#shield-demo");
  if (demo) {
    var status = $(".board-status", demo), reset = $(".demo-reset", demo);
    var quiet = status ? status.getAttribute("data-quiet") : "";
    var routedLabel = reset ? reset.getAttribute("data-routed") : "";
    var routed = [];
    var render = function () {
      $$(".bc", demo).forEach(function (bc) {
        var n = routed.filter(function (r) { return r.mod === bc.getAttribute("data-mod"); }).length;
        bc.querySelector("b").textContent = String(n);
        bc.classList.toggle("hot", n > 0);
      });
      if (status) status.textContent = routed.length ? routed.map(function (r) { return r.title; }).join(" · ") : quiet;
    };
    $$(".route", demo).forEach(function (b) {
      var label = b.textContent;
      b.setAttribute("data-label", label);
      b.addEventListener("click", function () {
        var li = b.closest("li");
        routed.push({ mod: li.getAttribute("data-mod"), title: $(".a-t", li).textContent });
        b.disabled = true;
        b.textContent = routedLabel || label;
        render();
      });
    });
    if (reset) reset.addEventListener("click", function () {
      routed = [];
      $$(".route", demo).forEach(function (b) { b.disabled = false; b.textContent = b.getAttribute("data-label"); });
      render();
    });
  }

  /* ---------------------------------------------------- DDM live embed, on request only */
  $$("[data-embed]").forEach(function (b) {
    b.addEventListener("click", function () {
      var slot = b.closest(".live").querySelector(".embed-slot");
      if (!slot || slot.querySelector("iframe")) return;
      var f = document.createElement("iframe");
      f.src = b.getAttribute("data-embed");
      f.title = slot.getAttribute("data-title") || "Dynamic Drought Module";
      f.loading = "lazy";
      f.referrerPolicy = "no-referrer";
      f.setAttribute("allow", "fullscreen");
      slot.insertBefore(f, slot.firstChild);
      slot.hidden = false;
      var st = slot.querySelector(".embed-status");
      f.addEventListener("load", function () { if (st) st.textContent = st.getAttribute("data-loaded") || ""; });
      b.setAttribute("aria-disabled", "true");
      b.disabled = true;
      f.focus();
    });
  });

  /* ---------------------------------------------------- TSDF request figure */
  var fig = $(".tiers-fig");
  if (fig) {
    var dot = $(".req-dot", fig), win = $(".window", fig), tile = $(".view-tile", fig), cap = $(".t3-cap", fig);
    var svgW = 560;
    var tiers = $$(".tier", fig), items = $$(".tier-item");
    var hl = function (t) {
      tiers.forEach(function (r) { r.classList.toggle("hl", r.getAttribute("data-tier") === t); });
      items.forEach(function (r) { r.classList.toggle("hl", r.getAttribute("data-tier") === t); });
    };
    var finalState = function () {
      dot.setAttribute("cx", String(svgW / 2 + 64));
      dot.style.opacity = "0.35";
      win.style.opacity = "1";
      tile.style.opacity = "1";
      tile.setAttribute("x", String(svgW - 34));
      if (cap) cap.style.opacity = "1";
      hl("t3");
    };
    var play = function () {
      if (RM.matches || !dot.animate) { finalState(); return; }
      dot.style.opacity = "1"; win.style.opacity = "0"; tile.style.opacity = "0"; tile.setAttribute("x", String(svgW - 160)); hl("t0");
      var start = svgW - 14, stop = svgW / 2 + 64, dur = 3600, t = performance.now();
      var step = function (now) {
        var u = Math.min(1, (now - t) / dur), x = start + (stop - start) * (1 - Math.pow(1 - u, 2));
        dot.setAttribute("cx", x.toFixed(1));
        var tier = x > svgW - 80 ? "t0" : x > svgW - 150 ? "t1" : x > svgW - 220 ? "t2" : "t3";
        hl(tier);
        if (x < svgW - 150) {
          win.style.opacity = "1"; tile.style.opacity = "1";
          var v = Math.min(1, (svgW - 150 - x) / 70);
          tile.setAttribute("x", (svgW - 160 + v * 126).toFixed(1));
        }
        if (u < 1) requestAnimationFrame(step);
        else { dot.animate([{ opacity: 1 }, { opacity: 0.35 }], { duration: 700, fill: "forwards" }); }
      };
      requestAnimationFrame(step);
    };
    var playBtn = $("#req-play");
    if (playBtn) playBtn.addEventListener("click", play);
    tiers.concat(items).forEach(function (el) {
      el.addEventListener("mouseenter", function () { hl(el.getAttribute("data-tier")); });
    });
    if ("IntersectionObserver" in window && !RM.matches) {
      var once = new IntersectionObserver(function (en) { if (en[0].isIntersecting) { once.disconnect(); setTimeout(play, 400); } }, { threshold: 0.5 });
      once.observe(fig);
    } else finalState();
  }

  /* ---------------------------------------------------- gentle reveal */
  if ("IntersectionObserver" in window && !RM.matches) {
    var rv = $$(".sec-head, .figures, .obj, .princ li, .t-item");
    rv.forEach(function (el) { el.classList.add("rv"); });
    var ro = new IntersectionObserver(function (en) {
      en.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("in"); ro.unobserve(e.target); } });
    }, { rootMargin: "0px 0px -8% 0px" });
    rv.forEach(function (el) { ro.observe(el); });
  }
})();
