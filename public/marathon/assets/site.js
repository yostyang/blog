/* ==========================================================================
   shared chrome behaviour — nav progress, rail scroll-spy, reveal, counters
   ========================================================================== */
(function () {
  'use strict';
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var doc = document;

  /* ---------------------------------------------------------------- topnav */
  var nav = doc.querySelector('.topnav');
  var progress = nav && nav.querySelector('.progress');

  function onScroll() {
    var st = window.scrollY || doc.documentElement.scrollTop;
    var h = doc.documentElement.scrollHeight - window.innerHeight;
    var pct = h > 0 ? Math.min(1, Math.max(0, st / h)) : 0;
    if (progress) progress.style.width = (pct * 100).toFixed(2) + '%';
    if (nav) nav.classList.toggle('is-stuck', st > 8);
    var rp = doc.querySelector('.rail-prog .rp-track i');
    var rv = doc.querySelector('.rail-prog .rp-v');
    if (rp) rp.style.width = (pct * 100).toFixed(2) + '%';
    if (rv) rv.textContent = Math.round(pct * 100) + '%';
    if (spyUpdate) spyUpdate();
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  onScroll();

  /* -------------------------------------------------------------- rail nav */
  var rail = doc.querySelector('.rail');
  var railNav = rail && rail.querySelector('.railnav');
  var scrim = doc.querySelector('.rail-scrim');

  // mirror the primary nav into the mobile drawer
  var links = nav && nav.querySelector('.navlinks');
  if (rail && links) {
    var box = doc.createElement('div');
    box.className = 'rail-pages';
    box.innerHTML = '<div class="rg-lab">Pages · 全部页面</div>';
    Array.prototype.forEach.call(links.querySelectorAll('a'), function (a) {
      var c = a.cloneNode(true);
      c.className = a.classList.contains('is-active') ? 'is-active' : '';
      c.innerHTML = '<span class="sw" style="background:' + (a.dataset.color || '#ff5a1a') + '"></span>' +
        a.textContent.trim();
      box.appendChild(c);
    });
    rail.insertBefore(box, rail.firstChild);
  }

  // build section links from [data-nav] markers
  var targets = Array.prototype.slice.call(doc.querySelectorAll('[data-nav]'));
  var spyLinks = [];
  var spyUpdate = null;
  if (railNav && targets.length) {
    // take ownership of the list so inline fallback links are never duplicated
    railNav.innerHTML = '';
    targets.forEach(function (t, i) {
      if (!t.id) t.id = 'sec-' + (i + 1);
      var a = doc.createElement('a');
      a.href = '#' + t.id;
      a.innerHTML = '<span class="rn">' + String(i + 1).padStart(2, '0') + '</span>' +
        '<span>' + t.getAttribute('data-nav') + '</span>';
      railNav.appendChild(a);
      spyLinks.push({ a: a, el: t });
    });

    // smooth scroll offset handled by scroll-padding-top
    var pinned = null;
    railNav.addEventListener('click', function (e) {
      var a = e.target.closest('a');
      if (!a) return;
      // honour the click: short pages cannot scroll far enough to make every
      // heading reach the probe, so lock the highlight until the user scrolls
      pinned = a;
      spyLinks.forEach(function (s) { s.a.classList.toggle('is-active', s.a === a); });
      closeDrawer();
    });
    ['wheel', 'touchstart', 'keydown'].forEach(function (ev) {
      window.addEventListener(ev, function () { pinned = null; }, { passive: true });
    });

    // position-based scroll spy (robust for far-apart sections)
    spyUpdate = function () {
      if (pinned) return;
      var navH = nav ? nav.offsetHeight : 58;
      var probe = window.scrollY + navH + 110;
      var idx = 0;
      for (var i = 0; i < spyLinks.length; i++) {
        var top = spyLinks[i].el.getBoundingClientRect().top + window.scrollY;
        if (top <= probe) idx = i;
      }
      var doc = document.documentElement;
      if (window.innerHeight + window.scrollY >= doc.scrollHeight - 8) {
        idx = spyLinks.length - 1;
      }
      spyLinks.forEach(function (s, i) { s.a.classList.toggle('is-active', i === idx); });
    };
    spyUpdate();
  }

  /* ---------------------------------------------------------------- drawer */
  function openDrawer() {
    if (!rail) return;
    rail.classList.add('is-open');
    if (scrim) scrim.classList.add('is-open');
    doc.body.style.overflow = 'hidden';
  }
  function closeDrawer() {
    if (!rail) return;
    rail.classList.remove('is-open');
    if (scrim) scrim.classList.remove('is-open');
    doc.body.style.overflow = '';
  }
  Array.prototype.forEach.call(doc.querySelectorAll('[data-rail-toggle]'), function (b) {
    b.addEventListener('click', function () {
      rail && rail.classList.contains('is-open') ? closeDrawer() : openDrawer();
    });
  });
  if (scrim) scrim.addEventListener('click', closeDrawer);
  doc.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeDrawer(); });

  /* ---------------------------------------------------------------- reveal */
  var revealEls = Array.prototype.slice.call(doc.querySelectorAll('[data-reveal]'));
  if (reduce) {
    revealEls.forEach(function (el) { el.classList.add('in'); });
  } else if ('IntersectionObserver' in window) {
    var ro = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          en.target.classList.add('in');
          ro.unobserve(en.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.06 });
    revealEls.forEach(function (el) { ro.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add('in'); });
  }

  /* --------------------------------------------------------------- counters */
  function fmt(v, dec) {
    return dec ? v.toFixed(dec) : String(Math.round(v));
  }
  function runCount(el) {
    var raw = el.getAttribute('data-count') || el.textContent;
    var timeMatch = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(raw.trim());
    var m, num;
    if (timeMatch) {
      var total = (+timeMatch[1]) * 60 + (+timeMatch[2]);
      var end = total;
      var startT = Math.max(0, end - Math.min(end, 90));
      m = { from: startT, to: end, time: true };
    } else {
      var n = parseFloat(raw.replace(/[^0-9.\-]/g, ''));
      if (isNaN(n)) return;
      m = { from: 0, to: n, dec: (raw.split('.')[1] || '').replace(/[^0-9]/g, '').length };
    }
    var t0 = null, dur = 1100;
    function step(ts) {
      if (!t0) t0 = ts;
      var k = Math.min(1, (ts - t0) / dur);
      var e = 1 - Math.pow(1 - k, 3);
      var v = m.from + (m.to - m.from) * e;
      if (m.time) {
        var mm = Math.floor(v / 60), ss = Math.round(v % 60);
        el.textContent = mm + ':' + String(ss).padStart(2, '0');
      } else {
        el.textContent = fmt(v, m.dec);
      }
      if (k < 1) requestAnimationFrame(step);
      else el.textContent = raw.trim();
    }
    requestAnimationFrame(step);
  }
  var counters = Array.prototype.slice.call(doc.querySelectorAll('[data-count]'));
  if (counters.length && !reduce && 'IntersectionObserver' in window) {
    var co = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { runCount(en.target); co.unobserve(en.target); }
      });
    }, { threshold: 0.4 });
    counters.forEach(function (el) { co.observe(el); });
  }

  /* ------------------------------------------------------- page transition */
  if (!reduce) {
    doc.addEventListener('click', function (e) {
      var a = e.target.closest('a[href]');
      if (!a) return;
      var href = a.getAttribute('href');
      if (!href || href.charAt(0) === '#' || a.target === '_blank' ||
          /^(https?:|mailto:|tel:)/.test(href) || e.metaKey || e.ctrlKey || e.shiftKey) return;
      e.preventDefault();
      doc.body.classList.add('leaving');
      setTimeout(function () { window.location.href = href; }, 190);
    });
  }
})();
