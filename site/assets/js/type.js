/* TERRA typography pass: hand-tuned pair kerning on display type and
   orphan control on running text. Runs once, before first paint where possible.
   Kerning values are em deltas on top of the font's own GPOS kerning, measured
   against League Spartan SemiBold (see BUILD-LOG). Text stays one string for
   assistive technology: only plain inline spans are added, no ARIA. */
(function () {
  "use strict";

  // Pair deltas (em). Positive loosens, negative tightens. Applied to the first glyph.
  var PAIRS = {
    "TE": -0.015, "TN": -0.02, "CA": -0.02, "AS": -0.01, "LD": -0.035, "LT": -0.07,
    "TS": -0.012, "AV": -0.03, "VA": -0.03, "LY": -0.05, "PA": -0.025, "FA": -0.02,
    "Da": -0.02, "La": -0.035, "Pa": -0.015, "Fa": -0.02, "Ta": -0.02, "Va": -0.02,
    "Yo": -0.015, "Ve": -0.015, "We": -0.01, "ry": -0.01, "rv": -0.008, "f.": -0.02,
    "ER": 0.005, "RR": 0.01, "RA": -0.012, "Th": -0.015, "St": -0.005, "Ye": -0.015, "NI": 0.01,
    "r.": -0.03, "r,": -0.03, "y.": -0.02, "y,": -0.02
  };

  var MEASURE = document.createElement("canvas").getContext("2d");

  function kern(el) {
    var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
    var nodes = [];
    for (var n = walker.nextNode(); n; n = walker.nextNode()) nodes.push(n);
    nodes.forEach(function (node) {
      var t = node.data;
      if (t.length < 2) return;
      var frag = document.createDocumentFragment();
      var buf = "";
      var changed = false;
      for (var i = 0; i < t.length; i++) {
        var pair = t.charAt(i) + t.charAt(i + 1);
        var k = PAIRS[pair];
        if (k) {
          if (buf) { frag.appendChild(document.createTextNode(buf)); buf = ""; }
          var s = document.createElement("span");
          s.className = "k";
          s.style.setProperty("--k", k);
          s.textContent = t.charAt(i);
          frag.appendChild(s);
          changed = true;
        } else {
          buf += t.charAt(i);
        }
      }
      if (!changed) return;
      if (buf) frag.appendChild(document.createTextNode(buf));
      node.parentNode.replaceChild(frag, node);
    });
  }

  // Bind the last two words of a block with a no-break space so no line ends
  // on a single stranded word. Text-node aware, so markup inside survives.
  var FACTOR = 0.72; // before web fonts load, fallback metrics differ; stay cautious

  function widont(el) {
    var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
    var last = null;
    for (var n = walker.nextNode(); n; n = walker.nextNode()) if (/\S/.test(n.data)) last = n;
    if (!last) return;
    var words = el.textContent.trim().split(/\s+/);
    if (words.length < 4) return;
    // Only bind when the joined ending is comfortably narrower than the block itself,
    // measured in the element's own font, so it can never force an overflow.
    // Measure the box the closing words actually wrap in (a grid cell may be narrower than el).
    var box = last.parentElement;
    while (box && box !== el && getComputedStyle(box).display === "inline") box = box.parentElement;
    var cs = getComputedStyle(box || el);
    var avail = (box || el).clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    MEASURE.font = cs.fontStyle + " " + cs.fontWeight + " " + cs.fontSize + " " + cs.fontFamily;
    // A hyphen stays a break opportunity, so only the part after it must fit.
    var unit = words.slice(-2).join(" ").replace(/^.*-(?=[^-]*\s)/, "");
    if (!avail || MEASURE.measureText(unit).width > avail * FACTOR) return false;
    var d = last.data.replace(/\s+$/, "");
    var idx = d.lastIndexOf(" ");
    if (idx > 0) { last.data = d.slice(0, idx) + " " + d.slice(idx + 1); return true; }
    if (idx === 0) { last.data = " " + d.slice(1); return true; }
    // Last text node is a single word: fix the space at the end of the previous node.
    var prev = null;
    walker.currentNode = el;
    for (var m = walker.nextNode(); m && m !== last; m = walker.nextNode()) if (/\S/.test(m.data)) prev = m;
    if (prev && / $/.test(prev.data)) prev.data = prev.data.replace(/ $/, " ");
  }

  // Keep short hyphenated compounds (e.g. "sovereignty-centered") from breaking at the
  // hyphen; the fonts carry no non-breaking hyphen glyph, so a no-wrap span is used.
  var MONTHS = /\b(January|February|March|April|May|June|July|August|September|October|November|December) (\d{4})\b/g;

  function compounds(el) {
    // Keep "December 2026" together.
    // Dates set in their own <time> column stay free to wrap.
    var skipTime = { acceptNode: function (n) { return n.parentElement && n.parentElement.closest("time") ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT; } };
    var tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, skipTime);
    for (var t0 = tw.nextNode(); t0; t0 = tw.nextNode()) if (MONTHS.test(t0.data)) { MONTHS.lastIndex = 0; t0.data = t0.data.replace(MONTHS, "$1 $2"); }
    var tail = el.textContent.trim().split(/\s+/).slice(-2).join(" ");
    if (tail.length <= 20) tail = ""; // a short closing phrase may stay whole
    var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
    var nodes = [];
    for (var n = walker.nextNode(); n; n = walker.nextNode()) if (/\w-\w/.test(n.data)) nodes.push(n);
    nodes.forEach(function (node) {
      var re = /([A-Za-z0-9.]+(?:-[A-Za-z0-9]+)+)/g, t = node.data, last = 0, m, frag = document.createDocumentFragment(), hit = false;
      while ((m = re.exec(t))) {
        // Long compounds, and compounds in the closing words, stay free to break at the hyphen.
        if (m[0].length > 21 || tail.indexOf(m[0]) !== -1) continue;
        hit = true;
        frag.appendChild(document.createTextNode(t.slice(last, m.index)));
        var s = document.createElement("span");
        s.className = "nw";
        s.textContent = m[0];
        frag.appendChild(s);
        last = m.index + m[0].length;
      }
      if (!hit) return;
      frag.appendChild(document.createTextNode(t.slice(last)));
      node.parentNode.replaceChild(frag, node);
    });
  }

  function run(root) {
    root = root || document;
    var cp = root.querySelectorAll(".lede, .hero-status, p, li, dd, h2, h3");
    for (var k = 0; k < cp.length; k++) if (!cp[k].hasAttribute("data-cp")) { compounds(cp[k]); cp[k].setAttribute("data-cp", ""); }
    // Orphan control first (whole words), then kerning (which splits text nodes).
    var p = root.querySelectorAll("p, li, dd, figcaption, .lede, h2, h3");
    for (var j = 0; j < p.length; j++) if (!p[j].hasAttribute("data-wido")) p[j].setAttribute("data-wido", widont(p[j]) ? "1" : "0");
    var d = root.querySelectorAll("h1, h2, h3, .display, .kern");
    for (var i = 0; i < d.length; i++) if (!d[i].hasAttribute("data-kerned")) { kern(d[i]); d[i].setAttribute("data-kerned", ""); }
  }

  window.TERRAType = { run: run, kern: kern, widont: widont };
  run(document);
  // Second pass with the real font metrics: endings skipped before the fonts loaded get another try.
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () {
    FACTOR = 0.97; // real metrics now: any unit narrower than its box cannot overflow
    var rest = document.querySelectorAll('[data-wido="0"]');
    for (var i = 0; i < rest.length; i++) if (widont(rest[i])) rest[i].setAttribute("data-wido", "1");
  });
})();
