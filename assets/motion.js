/* NML Club motion layer. No dependencies; one rAF loop drives everything
   scroll-linked. Loaded only when Theme settings > Motion > Scroll animations
   is on. Respects prefers-reduced-motion and the theme editor. */
(() => {
  const root = document.documentElement;
  window.__nmlMotion = true;

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const design = root.classList.contains('design-mode');
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const still = reduce || design;

  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
  const lerp = (a, b, t) => a + (b - a) * t;

  /* ---------- scroll reveals ---------- */
  let io = null;
  const triggers = new Map(); // observed element -> elements it reveals
  function initReveals(scope = document) {
    scope.querySelectorAll('[data-reveal-group]').forEach((group) => {
      Array.from(group.children).forEach((child, i) => {
        if (!child.hasAttribute('data-reveal')) child.setAttribute('data-reveal', 'up');
        child.style.setProperty('--i', i % 6);
      });
    });
    const targets = scope.querySelectorAll('[data-reveal]:not(.is-in)');
    if (still || !('IntersectionObserver' in window)) {
      targets.forEach((el) => el.classList.add('is-in'));
      return;
    }
    io = io || new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        (triggers.get(entry.target) || []).forEach((el) => el.classList.add('is-in'));
        triggers.delete(entry.target);
        io.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.08 });
    targets.forEach((el) => {
      // Watch a stand-in when the element itself can't intersect: cards in a
      // sideways-scrolling rack sit off-screen horizontally, and a clip-path
      // reveal is fully clipped (so never "visible") until it's revealed.
      let trigger = el;
      if (el.parentElement && el.parentElement.matches('[data-rack], .rack, [data-swipe], [data-gallery]')) trigger = el.parentElement;
      else if (el.dataset.reveal === 'clip') trigger = el.parentElement || el;
      if (!triggers.has(trigger)) triggers.set(trigger, []);
      triggers.get(trigger).push(el);
      io.observe(trigger);
    });
  }

  /* ---------- scroll-linked effects ---------- */
  const header = document.querySelector('.site-header');
  const progress = document.querySelector('[data-scroll-progress]');
  let parallax = [];
  let marquees = [];
  let spinners = [];
  let vinyls = [];

  function initScrollFx(scope = document) {
    parallax = Array.from(document.querySelectorAll('[data-parallax]')).map((el) => ({ el, speed: parseFloat(el.dataset.parallax) || 0.1, visible: true }));
    if ('IntersectionObserver' in window) {
      const vis = new IntersectionObserver((entries) => entries.forEach((e) => {
        const p = parallax.find((x) => x.el === e.target);
        if (p) p.visible = e.isIntersecting;
      }), { rootMargin: '20% 0px' });
      parallax.forEach((p) => vis.observe(p.el));
    }

    scope.querySelectorAll('[data-marquee]').forEach((m) => {
      const track = m.querySelector('[data-marquee-track]');
      if (!track || track.dataset.ready) return;
      track.dataset.ready = '1';
      track.innerHTML += track.innerHTML; // two identical halves -> seamless wrap
      track.style.animation = 'none';
      marquees.push({ track, x: 0, dir: Number(m.dataset.dir) || -1, speed: (Number(m.dataset.speed) || 2) * 0.35, half: 0 });
    });
    marquees = marquees.filter((m) => document.contains(m.track));

    spinners = Array.from(document.querySelectorAll('[data-spin-on-scroll]'));
    vinyls = Array.from(document.querySelectorAll('[data-vinyl]'))
      .map((el) => (el.getAnimations ? el.getAnimations()[0] : null))
      .filter(Boolean);
  }

  function measureMarquees() {
    marquees.forEach((m) => { m.half = m.track.scrollWidth / 2; });
  }

  let lastY = window.scrollY;
  let velocity = 0;
  let headerHidden = false;

  function frame() {
    const y = window.scrollY;
    const dy = y - lastY;
    lastY = y;
    velocity = lerp(velocity, dy, 0.15);
    const vh = window.innerHeight;

    if (progress) {
      const max = document.documentElement.scrollHeight - vh;
      progress.style.setProperty('--progress', max > 0 ? (y / max).toFixed(4) : 0);
    }

    if (header && !document.documentElement.style.overflow) {
      const hide = y > 240 && dy > 2;
      const show = dy < -2 || y < 120;
      if (hide && !headerHidden) { header.classList.add('is-hidden'); headerHidden = true; }
      else if (show && headerHidden) { header.classList.remove('is-hidden'); headerHidden = false; }
    }

    for (const p of parallax) {
      if (!p.visible) continue;
      const r = p.el.getBoundingClientRect();
      const offset = (r.top + r.height / 2 - vh / 2) * -p.speed;
      if (p.el.classList.contains('hero__img')) {
        const img = p.el.firstElementChild;
        if (img) img.style.transform = `translate3d(0, ${offset.toFixed(1)}px, 0) scale(1.12)`;
      } else {
        p.el.style.translate = `0 ${offset.toFixed(1)}px`;
      }
    }

    const boost = clamp(Math.abs(velocity) * 0.45, 0, 14);
    for (const m of marquees) {
      if (!m.half) continue;
      const dir = velocity < -0.5 ? -m.dir : m.dir; // scrolling up reverses the tapes
      m.x += (m.speed + boost) * dir;
      if (m.x <= -m.half) m.x += m.half;
      if (m.x > 0) m.x -= m.half;
      m.track.style.transform = `translate3d(${m.x.toFixed(1)}px, 0, 0) skewX(${clamp(-velocity * 0.25, -8, 8).toFixed(2)}deg)`;
    }

    for (const s of spinners) s.style.transform = `rotate(${(-14 + y * 0.12).toFixed(1)}deg)`;
    for (const a of vinyls) a.playbackRate = 1 + clamp(Math.abs(velocity) / 6, 0, 7);

    requestAnimationFrame(frame);
  }

  /* ---------- custom cursor ---------- */
  function initCursor() {
    if (!finePointer || still || !root.hasAttribute('data-cursor')) return;
    const cursor = document.createElement('div');
    cursor.className = 'cursor';
    cursor.setAttribute('aria-hidden', 'true');
    cursor.innerHTML = '<span class="cursor__label">View</span>';
    document.body.appendChild(cursor);
    let mx = -100, my = -100, cx = -100, cy = -100;
    window.addEventListener('mousemove', (e) => {
      mx = e.clientX; my = e.clientY;
      cursor.classList.add('is-active');
      const t = e.target;
      const view = t.closest && t.closest('.card, [data-cursor-label]');
      const link = !view && t.closest && t.closest('a, button, label, select, input, textarea, summary');
      cursor.classList.toggle('is-view', !!view);
      cursor.classList.toggle('is-link', !!link);
      if (view) cursor.firstChild.textContent = view.dataset.cursorLabel || (view.classList.contains('card--sold') ? 'Sold' : 'View');
    }, { passive: true });
    document.addEventListener('mouseleave', () => cursor.classList.remove('is-active'));
    window.addEventListener('mousedown', () => cursor.classList.add('is-down'));
    window.addEventListener('mouseup', () => cursor.classList.remove('is-down'));
    (function loop() {
      cx = lerp(cx, mx, 0.22); cy = lerp(cy, my, 0.22);
      cursor.style.translate = `${cx.toFixed(1)}px ${cy.toFixed(1)}px`;
      requestAnimationFrame(loop);
    })();
  }

  /* ---------- magnetic buttons ---------- */
  function initMagnetic() {
    if (!finePointer || still) return;
    document.addEventListener('mousemove', (e) => {
      const btn = e.target.closest && e.target.closest('.btn');
      document.querySelectorAll('.btn.is-magnet').forEach((b) => {
        if (b !== btn) { b.classList.remove('is-magnet'); b.style.translate = ''; }
      });
      if (!btn || btn.disabled) return;
      const r = btn.getBoundingClientRect();
      const x = (e.clientX - (r.left + r.width / 2)) * 0.18;
      const y = (e.clientY - (r.top + r.height / 2)) * 0.28;
      btn.classList.add('is-magnet');
      btn.style.translate = `${x.toFixed(1)}px ${y.toFixed(1)}px`;
    }, { passive: true });
  }

  /* ---------- boot ---------- */
  function init(scope) {
    initReveals(scope);
    if (!still) {
      initScrollFx(scope);
      requestAnimationFrame(measureMarquees);
    }
  }

  init(document);
  if (!still) {
    root.classList.add('motion-ready');
    window.addEventListener('resize', measureMarquees, { passive: true });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(measureMarquees);
    requestAnimationFrame(frame);
    initCursor();
    initMagnetic();
  }

  // Theme editor: re-run on section changes so new content isn't left hidden.
  document.addEventListener('shopify:section:load', (e) => init(e.target));
})();
