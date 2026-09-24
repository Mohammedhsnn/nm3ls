/* Static demo shim — only loaded in the GitHub Pages export (dev/build.mjs).
   Replaces the Shopify endpoints a static host doesn't have:
   - /cart/add.js and /cart/change.js -> a localStorage bag that renders the
     same markup as sections/cart-drawer.liquid and snippets/cart-items.liquid
   - checkout and club signup -> demo messages
   - search and collection sorting -> done in the browser */
(() => {
  const BASE = window.STATIC_BASE || '/';
  const KEY = 'nml-demo-cart';
  const nativeFetch = window.fetch.bind(window);
  let catalog = null;
  const ready = nativeFetch(BASE + 'assets/catalog.json').then((r) => r.json()).then((c) => { catalog = c; return c; });

  const money = (c) => '$' + (Number(c) / 100).toFixed(2);
  const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const img = (src, w) => (src ? src + (src.includes('?') ? '&' : '?') + 'width=' + w : '');

  function load() { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (_) { return []; } }
  let lines = load();
  function save() { try { localStorage.setItem(KEY, JSON.stringify(lines)); } catch (_) { /* private mode */ } }

  function items() {
    return lines.map((l) => ({ ...catalog.variants[l.id], id: l.id, quantity: l.quantity })).filter((i) => i.product_title);
  }
  const count = () => items().reduce((a, i) => a + i.quantity, 0);
  const total = () => items().reduce((a, i) => a + i.price * i.quantity, 0);

  function itemsHTML() {
    return '<div class="cart-items">' + items().map((i, idx) => `
      <div class="cart-item" data-line="${idx + 1}">
        <a href="${i.url}" tabindex="-1" aria-hidden="true">${i.image ? `<img src="${img(i.image, 200)}" alt="">` : ''}</a>
        <div>
          <a class="cart-item__title" href="${i.url}">${esc(i.product_title)}</a>
          <p class="cart-item__meta">${i.has_only_default ? '' : esc(i.variant_title)}${i.one ? ' · 1 of 1' : ''}</p>
          <div class="cart-item__actions">
            ${i.one ? '<span class="cart-item__meta">Qty 1</span>' : `
            <div class="qty">
              <button type="button" data-qty-change="${i.quantity - 1}" aria-label="Decrease quantity of ${esc(i.product_title)}">−</button>
              <input type="number" value="${i.quantity}" min="0" data-qty-input aria-label="Quantity of ${esc(i.product_title)}">
              <button type="button" data-qty-change="${i.quantity + 1}" aria-label="Increase quantity of ${esc(i.product_title)}">+</button>
            </div>`}
            <button type="button" class="cart-item__remove" data-qty-change="0">Remove</button>
          </div>
        </div>
        <div class="cart-item__price">${money(i.price * i.quantity)}</div>
      </div>`).join('') + '</div>';
  }

  function drawerHTML() {
    const n = count();
    const body = n
      ? itemsHTML()
      : `<div class="cart-empty"><p>Your bag is empty.</p><a class="btn btn--outline" href="${BASE}collections/all">Start digging</a></div>`;
    const foot = n
      ? `<form class="cart-drawer__foot" action="${BASE}cart" method="post" data-cart-foot>
          <div class="cart-row cart-row--total"><span>Subtotal</span><span>${money(total())} USD</span></div>
          <p class="cart-note">Demo preview — shipping and taxes are calculated at checkout in the live store.</p>
          <button type="submit" name="checkout" class="btn btn--full">Checkout</button>
        </form>`
      : '';
    return `<div id="shopify-section-cart-drawer" class="shopify-section">
      <div class="drawer-scrim" data-drawer-scrim></div>
      <aside class="cart-drawer" id="CartDrawer" role="dialog" aria-modal="true" aria-labelledby="CartDrawerTitle" data-cart-drawer>
        <div class="cart-drawer__head">
          <h2 id="CartDrawerTitle">Your bag <span class="cart-count" data-cart-count>${n}</span></h2>
          <button type="button" class="cart-drawer__close" data-drawer-close>Close</button>
        </div>
        <div class="cart-drawer__body" data-cart-body>${body}</div>
        ${foot}
      </aside></div>`;
  }

  function paint() {
    const wrapper = document.getElementById('shopify-section-cart-drawer');
    if (wrapper) {
      const open = wrapper.querySelector('.cart-drawer.is-open');
      wrapper.outerHTML = drawerHTML();
      if (open) {
        document.querySelector('[data-cart-drawer]').classList.add('is-open');
        document.querySelector('[data-drawer-scrim]').classList.add('is-open');
      }
    }
    document.querySelectorAll('.site-header [data-cart-count]').forEach((el) => { el.textContent = count(); });
    paintCartPage();
  }

  function paintCartPage() {
    const page = document.querySelector('[data-cart-page]');
    if (!page) return;
    const head = '<div class="page-head" style="padding-top:0"><h1>Your bag</h1></div>';
    page.innerHTML = head + (count()
      ? `<div class="cart-page__grid"><div data-cart-body>${itemsHTML()}</div>
          <form class="cart-page__summary" action="${BASE}cart" method="post">
            <div class="cart-row"><span>Items</span><span>${count()}</span></div>
            <div class="cart-row cart-row--total"><span>Subtotal</span><span>${money(total())} USD</span></div>
            <p class="cart-note">Demo preview — checkout runs on Shopify in the live store.</p>
            <button type="submit" name="checkout" class="btn btn--full">Checkout</button>
          </form></div>`
      : `<div class="cart-empty"><p>Your bag is empty.</p><a class="btn btn--outline" href="${BASE}collections/all">Start digging</a></div>`);
  }

  const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  const sections = () => ({ 'cart-drawer': drawerHTML() });

  window.fetch = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input.url;
    if (/\/cart\/add(\.js)?$/.test(url)) {
      await ready;
      const body = init.body instanceof FormData ? Object.fromEntries(init.body.entries()) : JSON.parse(init.body || '{}');
      const v = catalog.variants[body.id];
      const qty = Math.max(1, parseInt(body.quantity, 10) || 1);
      if (!v) return json(404, { description: 'Cannot find this item.' });
      if (!v.available) return json(422, { description: `${v.product_title} is sold out.` });
      const line = lines.find((l) => String(l.id) === String(body.id));
      if (v.one && (line ? line.quantity : 0) + qty > 1) return json(422, { description: `All 1 ${v.product_title} are in your cart.` });
      if (line) line.quantity += qty; else lines.push({ id: String(body.id), quantity: qty });
      save();
      setTimeout(() => document.querySelectorAll('.site-header [data-cart-count]').forEach((el) => { el.textContent = count(); }));
      return json(200, { id: body.id, quantity: qty, sections: sections() });
    }
    if (/\/cart\/change(\.js)?$/.test(url)) {
      await ready;
      const body = JSON.parse(init.body || '{}');
      const idx = Number(body.line) - 1;
      const qty = Math.max(0, parseInt(body.quantity, 10) || 0);
      if (!lines[idx]) return json(400, { description: 'That line is no longer in your bag.' });
      const v = catalog.variants[lines[idx].id];
      if (v && v.one && qty > 1) return json(422, { description: `All 1 ${v.product_title} are in your cart.` });
      if (qty === 0) lines.splice(idx, 1); else lines[idx].quantity = qty;
      save();
      if (document.querySelector('[data-cart-page]')) { paintCartPage(); return json(200, { sections: sections() }); }
      setTimeout(() => document.querySelectorAll('.site-header [data-cart-count]').forEach((el) => { el.textContent = count(); }));
      return json(200, { item_count: count(), sections: sections() });
    }
    return nativeFetch(input, init);
  };

  // theme.js reloads the cart page after a change; repaint in place instead.
  const nativeReload = window.location.reload.bind(window.location);
  try { window.location.reload = () => (document.querySelector('[data-cart-page]') ? paintCartPage() : nativeReload()); } catch (_) { /* read-only in some browsers */ }

  function toast(message) {
    const el = document.getElementById('Toast');
    if (!el) return;
    el.textContent = message;
    el.classList.add('is-visible');
    clearTimeout(toast.t);
    toast.t = setTimeout(() => el.classList.remove('is-visible'), 3200);
  }

  document.addEventListener('submit', (e) => {
    const form = e.target;
    const type = form.querySelector('[name="form_type"]');
    if (form.matches('[data-cart-foot], .cart-page__summary')) {
      e.preventDefault();
      toast('Demo preview — in the live store this opens Shopify checkout.');
    } else if (type && type.value === 'customer') {
      e.preventDefault();
      let msg = form.querySelector('.form-message');
      if (!msg) { msg = document.createElement('p'); form.appendChild(msg); }
      msg.className = 'form-message form-message--success';
      msg.setAttribute('role', 'status');
      msg.textContent = "You're in. (Demo preview — signups go live with the Shopify store.)";
    } else if (type && /customer_login|create_customer|recover_customer_password/.test(type.value)) {
      e.preventDefault();
      toast('Demo preview — accounts work once the theme is on Shopify.');
    }
  }, true);

  function cardHTML(p) {
    return `<a href="${p.url}" class="card${p.available ? '' : ' card--sold'}">
      <div class="card__media">${p.one ? '<span class="badge badge--one">1 of 1</span>' : ''}
        ${p.image ? `<img src="${img(p.image, 720)}" alt="${esc(p.title)}" loading="lazy">` : ''}
        ${p.image2 ? `<img class="card__alt" src="${img(p.image2, 720)}" alt="" loading="lazy">` : ''}
        ${p.available ? '' : '<span class="stamp">SOLD</span>'}</div>
      <div class="card__info"><div><h3 class="card__title">${esc(p.title)}</h3>${p.sizes ? `<p class="card__sizes">${esc(p.sizes)}</p>` : ''}</div>
      <span class="price-tag">${money(p.price)}</span></div></a>`;
  }

  async function staticSearch() {
    const input = document.getElementById('SearchQ');
    const q = new URLSearchParams(location.search).get('q');
    if (!input || !q) return;
    await ready;
    input.value = q;
    const words = q.toLowerCase();
    const hits = catalog.products.filter((p) => `${p.title} ${p.tags.join(' ')} ${p.type}`.toLowerCase().includes(words));
    const box = document.createElement('div');
    box.innerHTML = `<p class="eyebrow" style="margin-bottom:24px">${hits.length} ${hits.length === 1 ? 'result' : 'results'} for “${esc(q)}”</p>` +
      (hits.length ? `<div class="grid" style="--cols: 4">${hits.map(cardHTML).join('')}</div>` : '<div class="empty-state"><p>No matches. Try a shorter word, like “jort” or “tee”.</p></div>');
    input.closest('.page-head').after(box);
  }

  function staticSort() {
    const select = document.querySelector('[data-sort]');
    const sort = new URLSearchParams(location.search).get('sort_by');
    if (!select || !sort) return;
    select.value = sort;
    const grid = select.closest('section').querySelector('.grid');
    const cards = [...grid.children];
    const price = (c) => parseFloat((c.querySelector('[data-price]') || {}).textContent?.replace(/[^0-9.]/g, '') || '0');
    const title = (c) => c.querySelector('.card__title').textContent.trim();
    const by = {
      'price-ascending': (a, b) => price(a) - price(b),
      'price-descending': (a, b) => price(b) - price(a),
      'title-ascending': (a, b) => title(a).localeCompare(title(b)),
      'title-descending': (a, b) => title(b).localeCompare(title(a))
    }[sort];
    if (by) cards.sort(by).forEach((c) => grid.appendChild(c));
  }

  ready.then(() => { paint(); staticSearch(); staticSort(); });
})();
