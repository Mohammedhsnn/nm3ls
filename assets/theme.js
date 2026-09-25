/* NML Club theme scripts. No dependencies. */
(() => {
  const theme = window.theme || { routes: { root: '/' }, cartType: 'drawer' };
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  /* ---------- toast ---------- */
  let toastTimer;
  function toast(message) {
    const el = $('#Toast');
    if (!el) return;
    el.textContent = message;
    el.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('is-visible'), 2800);
  }

  /* ---------- mobile menu (full-screen overlay) ---------- */
  function setMenu(open) {
    const btn = $('[data-menu-toggle]');
    const menu = $('[data-mobile-menu]');
    if (!btn || !menu) return;
    btn.setAttribute('aria-expanded', String(open));
    btn.textContent = open ? 'Close' : 'Menu';
    menu.classList.toggle('is-open', open);
    document.documentElement.classList.toggle('menu-open', open);
    document.documentElement.style.overflow = open ? 'hidden' : '';
  }
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-menu-toggle]')) {
      setMenu($('[data-menu-toggle]').getAttribute('aria-expanded') !== 'true');
    } else if (e.target.closest('[data-mobile-menu] a')) {
      setMenu(false);
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.documentElement.classList.contains('menu-open')) setMenu(false);
  });
  window.matchMedia('(min-width: 861px)').addEventListener('change', (e) => { if (e.matches) setMenu(false); });

  /* ---------- fit big wordmarks to their box ----------
     CSS sizes them for the default words; if a longer word is set in the
     theme editor, shrink it so it stays on one line inside its column. */
  const fitTargets = $$('[data-fit-text]');
  function fitText() {
    fitTargets.forEach((el) => {
      el.style.fontSize = '';
      const box = el.parentElement.closest('.hero__inner > *, .page-width') || el.parentElement;
      const cs = getComputedStyle(box);
      const avail = box.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      const chars = el.querySelectorAll('.char');
      const width = chars.length
        ? chars[chars.length - 1].getBoundingClientRect().right - chars[0].getBoundingClientRect().left
        : el.scrollWidth;
      if (width > avail && width > 0) {
        el.style.fontSize = (parseFloat(getComputedStyle(el).fontSize) * (avail / width) * 0.98).toFixed(1) + 'px';
      }
    });
  }
  if (fitTargets.length) {
    fitText();
    window.addEventListener('resize', fitText, { passive: true });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitText);
  }

  /* ---------- swipe rows: progress thumb under sideways scrollers ---------- */
  $$('[data-swipe]').forEach((row) => {
    const bar = row.parentElement.querySelector('[data-swipe-thumb]');
    if (!bar) return;
    const update = () => {
      const visible = row.clientWidth / row.scrollWidth;
      const max = row.scrollWidth - row.clientWidth;
      bar.parentElement.hidden = visible >= 0.999;
      bar.style.width = (visible * 100).toFixed(2) + '%';
      bar.style.transform = `translateX(${max > 0 ? ((row.scrollLeft / max) * (1 / visible - 1) * 100).toFixed(2) : 0}%)`;
    };
    row.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update, { passive: true });
    new MutationObserver(update).observe(row, { attributes: true, subtree: true, attributeFilter: ['hidden'] });
    update();
  });

  /* ---------- floating shop bar (phones) ---------- */
  const mobileBar = $('[data-mobile-bar]');
  if (mobileBar) {
    const hero = $('[data-hero]');
    const footer = $('.site-footer');
    const toggleBar = () => {
      const past = window.scrollY > (hero ? hero.offsetTop + hero.offsetHeight * 0.7 : 400);
      const atFooter = footer && footer.getBoundingClientRect().top < window.innerHeight - 40;
      mobileBar.classList.toggle('is-visible', past && !atFooter);
    };
    window.addEventListener('scroll', toggleBar, { passive: true });
    toggleBar();
  }

  /* ---------- product gallery counter (swipe gallery on phones) ---------- */
  $$('[data-gallery]').forEach((gallery) => {
    const out = gallery.parentElement.querySelector('[data-gallery-index]');
    if (!out) return;
    gallery.addEventListener('scroll', () => {
      out.textContent = Math.round(gallery.scrollLeft / gallery.clientWidth) + 1;
    }, { passive: true });
  });

  /* ---------- cart drawer ---------- */
  let lastFocus = null;
  const drawer = () => $('[data-cart-drawer]');
  const scrim = () => $('[data-drawer-scrim]');
  const drawerOpen = () => drawer() && drawer().classList.contains('is-open');

  function openDrawer() {
    if (!drawer()) return false;
    lastFocus = document.activeElement;
    drawer().classList.add('is-open');
    scrim().classList.add('is-open');
    document.documentElement.style.overflow = 'hidden';
    const close = $('[data-drawer-close]', drawer());
    if (close) setTimeout(() => close.focus(), 50);
    return true;
  }
  function closeDrawer() {
    if (!drawer()) return;
    drawer().classList.remove('is-open');
    scrim().classList.remove('is-open');
    document.documentElement.style.overflow = '';
    if (lastFocus) lastFocus.focus();
  }

  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-cart-open]') && theme.cartType === 'drawer' && !document.querySelector('[data-cart-page]')) {
      if (openDrawer()) e.preventDefault();
    }
    if (e.target.closest('[data-drawer-close]') || e.target.closest('[data-drawer-scrim]')) closeDrawer();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && drawerOpen()) closeDrawer();
  });

  function setCount(count) {
    $$('[data-cart-count]').forEach((el) => {
      el.textContent = count;
      el.classList.remove('bump');
      void el.offsetWidth;
      el.classList.add('bump');
    });
  }

  function renderDrawer(html) {
    const wrapper = document.getElementById('shopify-section-cart-drawer');
    if (!wrapper || !html) return;
    const wasOpen = drawerOpen();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const fresh = doc.getElementById('shopify-section-cart-drawer') || doc.body.firstElementChild;
    wrapper.innerHTML = fresh ? fresh.innerHTML : html;
    if (wasOpen) {
      drawer().classList.add('is-open');
      scrim().classList.add('is-open');
    }
    const count = $('[data-cart-count]', wrapper);
    if (count) setCount(count.textContent.trim());
  }

  async function changeLine(line, quantity) {
    const body = document.querySelector('[data-cart-page]') ? null : $('[data-cart-body]', drawer());
    if (body) body.classList.add('is-loading');
    try {
      const res = await fetch(theme.routes.cartChange + '.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ line, quantity, sections: 'cart-drawer', sections_url: window.location.pathname })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.description || data.message || 'Could not update your bag.');
      if (document.querySelector('[data-cart-page]')) {
        window.location.reload();
        return;
      }
      renderDrawer(data.sections && data.sections['cart-drawer']);
      if (quantity === 0) toast('Removed from your bag');
    } catch (err) {
      toast(err.message);
      if (body) body.classList.remove('is-loading');
    }
  }

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-qty-change]');
    if (!btn) return;
    const item = btn.closest('[data-line]');
    if (item) changeLine(Number(item.dataset.line), Math.max(0, Number(btn.dataset.qtyChange)));
  });
  document.addEventListener('change', (e) => {
    const input = e.target.closest('[data-qty-input]');
    if (!input) return;
    const item = input.closest('[data-line]');
    if (item) changeLine(Number(item.dataset.line), Math.max(0, parseInt(input.value, 10) || 0));
  });

  /* ---------- product form ---------- */
  function money(cents) {
    const format = (window.Shopify && window.Shopify.currency && window.Shopify.currency.active) || 'USD';
    try {
      return new Intl.NumberFormat(document.documentElement.lang || 'en', { style: 'currency', currency: format }).format(cents / 100);
    } catch (_) {
      return '$' + (cents / 100).toFixed(2);
    }
  }

  $$('[data-product-section]').forEach((section) => {
    const form = $('[data-product-form]', section);
    const json = $('[data-product-json]', section);
    if (!form || !json) return;
    const variants = JSON.parse(json.textContent);
    const idInput = $('[data-variant-id]', form);
    const button = $('[data-add-button]', form);
    const priceEl = $('[data-product-price]', section);
    const errorEl = $('[data-form-error]', form);
    const sticky = $('[data-sticky-atc]', section);
    const stickyBtn = sticky && $('[data-sticky-add]', sticky);
    const stickyPrice = sticky && $('[data-sticky-price]', sticky);

    // Sticky add-to-bag bar on phones: shows once the real button scrolls away.
    if (sticky && 'IntersectionObserver' in window) {
      new IntersectionObserver(([entry]) => {
        const show = !entry.isIntersecting && entry.boundingClientRect.top < 0;
        sticky.classList.toggle('is-visible', show);
        sticky.setAttribute('aria-hidden', String(!show));
        stickyBtn.tabIndex = show ? 0 : -1;
      }).observe(button);
      stickyBtn.addEventListener('click', () => {
        if (form.requestSubmit) form.requestSubmit(); else button.click();
      });
    }

    function selected() {
      const values = [];
      $$('[data-option]:checked', form).forEach((input) => { values[Number(input.dataset.option)] = input.value; });
      return values;
    }

    function update() {
      const values = selected();
      const variant = variants.find((v) => v.options.every((opt, i) => values[i] === undefined || values[i] === opt));
      if (errorEl) errorEl.hidden = true;
      if (!variant) {
        button.disabled = true;
        button.textContent = 'Unavailable';
        return;
      }
      idInput.value = variant.id;
      button.disabled = !variant.available;
      button.textContent = variant.available ? 'Add to bag' : 'Sold out';
      if (priceEl) {
        priceEl.innerHTML = money(variant.price) + (variant.compare_at_price > variant.price ? `<s>${money(variant.compare_at_price)}</s>` : '');
      }
      if (stickyBtn) {
        stickyBtn.disabled = !variant.available;
        stickyBtn.textContent = button.textContent;
        stickyPrice.textContent = money(variant.price);
      }
      const url = new URL(window.location.href);
      url.searchParams.set('variant', variant.id);
      window.history.replaceState({}, '', url.toString());
    }

    form.addEventListener('change', (e) => { if (e.target.matches('[data-option]')) update(); });

    form.addEventListener('click', (e) => {
      const step = e.target.closest('[data-step]');
      if (!step) return;
      const q = $('[data-quantity]', form);
      q.value = Math.max(1, (parseInt(q.value, 10) || 1) + Number(step.dataset.step));
    });

    form.addEventListener('submit', async (e) => {
      if (theme.cartType !== 'drawer') return; // let the form post to /cart/add
      e.preventDefault();
      const label = button.textContent;
      button.disabled = true;
      button.textContent = 'Adding…';
      const body = new FormData(form);
      body.append('sections', 'cart-drawer');
      body.append('sections_url', window.location.pathname);
      try {
        const res = await fetch(theme.routes.cartAdd + '.js', { method: 'POST', headers: { Accept: 'application/json' }, body });
        const data = await res.json();
        if (!res.ok) throw new Error(data.description || data.message || 'Could not add this to your bag.');
        renderDrawer(data.sections && data.sections['cart-drawer']);
        openDrawer();
      } catch (err) {
        if (errorEl) {
          errorEl.textContent = err.message;
          errorEl.hidden = false;
        } else {
          toast(err.message);
        }
      } finally {
        button.disabled = false;
        button.textContent = label;
      }
    });
  });

  /* ---------- 1/1 crate filters ---------- */
  $$('[data-crate]').forEach((crate) => {
    const key = 'nml-crate-' + crate.id;
    const cards = $$('[data-rack] [data-card]', crate);
    const chips = $$('[data-filter]', crate);
    const hide = $('[data-hide-sold]', crate);
    const empty = $('[data-rack-empty]', crate);
    let filter = '';

    try {
      const saved = JSON.parse(localStorage.getItem(key) || '{}');
      if (typeof saved.f === 'string') filter = saved.f;
      if (hide && saved.h) hide.checked = true;
    } catch (_) { /* storage unavailable */ }

    function apply() {
      const words = filter.split(',').map((w) => w.trim()).filter(Boolean);
      let shown = 0;
      cards.forEach((card) => {
        const text = card.dataset.keywords || '';
        const matches = !words.length || words.some((w) => text.includes(w));
        const visible = matches && !(hide && hide.checked && card.dataset.available !== 'true');
        card.hidden = !visible;
        if (visible) shown++;
      });
      chips.forEach((chip) => chip.setAttribute('aria-pressed', String(chip.dataset.filter === filter)));
      if (empty) empty.hidden = shown > 0;
      try { localStorage.setItem(key, JSON.stringify({ f: filter, h: hide && hide.checked })); } catch (_) { /* ignore */ }
    }

    chips.forEach((chip) => chip.addEventListener('click', () => { filter = chip.dataset.filter; apply(); }));
    if (hide) hide.addEventListener('change', apply);
    apply();
  });

  /* ---------- club member card ---------- */
  $$('[data-club-form]').forEach((form) => {
    const section = form.closest('.club');
    const card = section && $('[data-member-card]', section);
    if (!card) return;
    const nameIn = $('[data-club-name]', form);
    const emailIn = $('[data-club-email]', form);
    const nameOut = $('[data-card-name]', card);
    const noOut = $('[data-card-no]', card);

    function number(email) {
      let h = 0;
      for (const c of email.toLowerCase()) h = (h * 31 + c.charCodeAt(0)) >>> 0;
      return String((h % 9000) + 1000);
    }
    function sync() {
      nameOut.textContent = nameIn.value.trim() || 'Your name here';
      noOut.textContent = emailIn.value.includes('@') ? number(emailIn.value.trim()) : '0000';
    }
    nameIn.addEventListener('input', sync);
    emailIn.addEventListener('input', sync);
    form.addEventListener('submit', () => {
      card.classList.remove('is-fresh');
      void card.offsetWidth;
      card.classList.add('is-fresh');
    });
    sync();
  });

  /* ---------- collection sort ---------- */
  document.addEventListener('change', (e) => {
    const select = e.target.closest('[data-sort]');
    if (!select) return;
    const url = new URL(window.location.href);
    url.searchParams.set('sort_by', select.value);
    url.searchParams.delete('page');
    window.location.href = url.toString();
  });
})();
