/* Essay mode: SlavisTon's article beside the map, scrollytelling. Each
   section of window.ESSAY (scenes.js) carries a scene; scrolling to a
   section, or clicking it, flies the map there. */
(function () {
  'use strict';
  var E = window.ESSAY, page = window.hatPage;
  if (!E || !page) return;
  var map = page.map;
  var panel = document.getElementById('essay'), scroller = document.getElementById('essay-scroll');
  var dots = document.getElementById('essay-dots'), toggle = document.getElementById('mode-toggle');
  var fold = document.getElementById('essay-fold');
  var on = false, active = -1, pending = 0, sections = [], quietUntil = 0;
  // Scrolls the code starts itself do not pick a section on the way.
  function quiet(ms) { quietUntil = performance.now() + (ms || 1200); }

  function esc(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  /* ---------------------------------------------------------- build */
  var html = '<header class="essay-title">' +
    '<h2>' + esc(E.title) + '</h2>' +
    '<p class="byline">by <a href="' + E.authorUrl + '" target="_blank" rel="noopener">' + esc(E.author) + '</a> · ' + E.date +
    ' · <a href="' + E.postUrl + '" target="_blank" rel="noopener">original on X</a></p>' +
    '<p class="essay-note">Article text verbatim. Scroll, or click a section, and the map behind follows. Colours follow the article\'s legends; maps are recomputed live on David Ryan\'s Hat tiling.</p>' +
    '</header>';
  E.sections.forEach(function (s, i) {
    html += '<section class="essay-sec" data-i="' + i + '" id="sec-' + s.id + '" tabindex="0">';
    html += '<div class="sec-label"><span>' + (i + 1) + '</span> ' + esc(s.label || '') + '</div>';
    s.paras.forEach(function (p) { html += '<p>' + esc(p) + '</p>'; });
    s.images.forEach(function (im) {
      html += '<figure class="essay-fig' + (im.files.length > 1 ? ' multi' : '') + '">';
      im.files.forEach(function (f) { html += '<img src="' + E.imageBase + f + '" alt="' + esc(im.caption) + '">'; });
      html += '<figcaption>' + esc(im.caption) + ' <span class="src">(article image)</span></figcaption></figure>';
    });
    html += '</section>';
  });
  html += '<footer class="essay-credits"><h3>Credits</h3>' +
    '<p>Essay: <a href="' + E.articleUrl + '" target="_blank" rel="noopener">“' + esc(E.title) + '”</a> by ' + esc(E.author) + '.</p>' +
    '<p>Map engine, Tile(a, b) slider, colour schemes and sibling tilings: <a href="https://drbuild.uk/tiles" target="_blank" rel="noopener">David Ryan’s tiling explorer</a> ' +
    '(<a href="https://github.com/davidryan59/davidryan59.github.io" target="_blank" rel="noopener">source</a>, MIT licence, © 2026 David Ryan).</p>' +
    '<p>The Hat: D. Smith, J. S. Myers, C. S. Kaplan, C. Goodman-Strauss, <a href="https://arxiv.org/abs/2303.10798" target="_blank" rel="noopener">An aperiodic monotile</a> (2023). Metatile construction after Kaplan’s hatviz.</p>' +
    '<p>Probe maps are recomputed here from the tiling, not copied from the article; small differences are listed in the README.</p></footer>';
  scroller.innerHTML = html;
  sections = Array.prototype.slice.call(scroller.querySelectorAll('.essay-sec'));
  // Images change the layout as they load; keep a just-chosen section in place.
  var lastJump = 0;
  Array.prototype.forEach.call(scroller.querySelectorAll('img'), function (img) {
    img.addEventListener('load', function () {
      if (on && active >= 0 && performance.now() - lastJump < 4000) { quiet(300); scroller.scrollTop = secTop(active); }
    });
  });
  dots.innerHTML = E.sections.map(function (s, i) {
    return '<button type="button" data-i="' + i + '" title="' + esc(s.label || s.id) + '" aria-label="Section ' + (i + 1) + ': ' + esc(s.label || s.id) + '"></button>';
  }).join('');

  /* ---------------------------------------------------------- scenes */
  function narrow() { return window.innerWidth <= 720; }
  function offset() {
    if (!on || panel.classList.contains('folded')) return [0, 0];
    var r = panel.getBoundingClientRect();
    return narrow() ? [0, -r.height / 2] : [-r.width / 2, 0];
  }
  function applyScene(i, instant) {
    var s = E.sections[i] && E.sections[i].scene;
    if (!s) return;
    if (s.scheme) { map.scheme(s.scheme); if (window.probeUI) window.probeUI.schemeChanged(); }
    if (s.outlines !== undefined) map.outlines(!!s.outlines);
    if (s.ancLevel && window.probeUI) window.probeUI.setAnc(s.ancLevel);
    if (s.grainPeriod && window.probeUI) window.probeUI.setGrain(s.grainPeriod);
    if (s.shape !== undefined && Math.abs(page.deg() - s.shape) > 1e-9) page.setShape(s.shape, instant ? 0 : 900);
    if (s.v) map.flyTo(s.v, { offset: offset(), ms: instant ? 0 : (s.ms || 1400) });
  }
  function activate(i, opts) {
    opts = opts || {};
    if (i === active && !opts.force) return;
    active = i;
    sections.forEach(function (el, k) { el.classList.toggle('active', k === i); });
    Array.prototype.forEach.call(dots.children, function (b, k) { b.classList.toggle('on', k === i); });
    applyScene(i, opts.instant);
    map.changed();
  }
  function secTop(i) { return i <= 0 ? 0 : sections[i].offsetTop - scroller.offsetTop - 12; }
  function scrollTo(i) {
    var el = sections[i];
    if (!el) return;
    quiet();
    scroller.scrollTo({ top: secTop(i), behavior: 'smooth' });
  }

  // The section crossing a line 35% down the panel is the active one.
  function pick() {
    var r = scroller.getBoundingClientRect(), line = r.top + r.height * 0.35, best = 0;
    sections.forEach(function (el, k) { if (el.getBoundingClientRect().top <= line) best = k; });
    // At the very bottom, the last section wins.
    if (scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 4) best = sections.length - 1;
    return best;
  }
  scroller.addEventListener('scroll', function () {
    if (!on) return;
    clearTimeout(pending);
    if (performance.now() < quietUntil) return;
    pending = setTimeout(function () { if (performance.now() >= quietUntil) activate(pick()); }, 180);
  }, { passive: true });
  sections.forEach(function (el, k) {
    el.addEventListener('click', function (e) {
      if (e.target.closest('a')) return;
      if (k !== active) scrollTo(k);
      activate(k, { force: true });
    });
    el.addEventListener('keydown', function (e) { if (e.key === 'Enter') activate(k, { force: true }); });
  });
  dots.addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    var k = +b.dataset.i; scrollTo(k); activate(k, { force: true });
  });

  /* ---------------------------------------------------------- toggle */
  function setOn(v, opts) {
    on = !!v;
    document.body.classList.toggle('essay-on', on);
    panel.hidden = !on;
    toggle.textContent = on ? 'Explore' : 'Essay';
    toggle.setAttribute('aria-pressed', on);
    toggle.title = on ? 'Back to free Explore mode' : 'Read the article alongside the map';
    if (on) {
      if (narrow()) document.querySelector('.options').classList.add('folded');
      var i = opts && opts.index !== undefined ? opts.index : Math.max(0, active);
      active = -1;
      requestAnimationFrame(function () {
        quiet(400); lastJump = performance.now();
        scroller.scrollTop = sections[i] ? secTop(i) : 0;
        activate(i, { instant: opts && opts.instant });
      });
    }
    map.changed();
  }
  toggle.addEventListener('click', function () { setOn(!on); });
  fold.addEventListener('click', function () {
    var f = panel.classList.toggle('folded');
    document.body.classList.toggle('essay-folded', f);
    fold.setAttribute('aria-expanded', !f);
    fold.textContent = f ? '▴' : '▾';
    fold.title = f ? 'Expand the essay' : 'Collapse the essay';
  });
  document.addEventListener('keydown', function (e) {
    if (!on || e.target.closest('input, select, textarea')) return;
    if (e.key === 'PageDown' || (e.key === 'j' && !e.ctrlKey)) { e.preventDefault(); var n = Math.min(sections.length - 1, active + 1); scrollTo(n); activate(n); }
    if (e.key === 'PageUp' || (e.key === 'k' && !e.ctrlKey)) { e.preventDefault(); var p = Math.max(0, active - 1); scrollTo(p); activate(p); }
  });

  window.essayUI = {
    on: function () { return on; },
    index: function () { return Math.max(0, active); },
    set: setOn,
    go: function (i, instant) { if (!on) setOn(true, { index: i, instant: instant }); else { scrollTo(i); activate(i, { force: true, instant: instant }); } },
    fromHash: function (i) { if (!on) setOn(true, { index: isNaN(i) ? 0 : i, instant: true }); }
  };
})();
