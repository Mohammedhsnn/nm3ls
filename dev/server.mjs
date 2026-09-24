// Local preview server for the NML Club theme.
//
// Renders the real theme files (layout/, sections/, snippets/, templates/) with
// LiquidJS, using live product data from the public nm3ls.com storefront JSON.
// It emulates the parts of Shopify the theme uses: JSON templates, section
// groups, {% form %}, {% paginate %}, the Ajax Cart API and the Section
// Rendering API. Files are re-read on every request and the browser reloads
// when anything in the theme changes.
//
//   npm run dev   ->   http://localhost:9292

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Liquid, Tag, Value } from 'liquidjs';

const THEME = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT) || 9292;
const STORE = process.env.STORE_URL || 'https://nm3ls.com';
const CACHE = path.join(THEME, 'dev', '.cache', 'store.json');

/* ------------------------------------------------------------------ data */

async function fetchJSON(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'nml-theme-preview' } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

async function loadStore() {
  try {
    const { products } = await fetchJSON(`${STORE}/products.json?limit=250`);
    const { collections } = await fetchJSON(`${STORE}/collections.json?limit=250`);
    for (const c of collections) {
      const data = await fetchJSON(`${STORE}/collections/${c.handle}/products.json?limit=250`);
      c.product_handles = data.products.map((p) => p.handle);
    }
    const store = { products, collections, fetched_at: new Date().toISOString() };
    fs.mkdirSync(path.dirname(CACHE), { recursive: true });
    fs.writeFileSync(CACHE, JSON.stringify(store));
    console.log(`  Loaded ${products.length} products and ${collections.length} collections from ${STORE}`);
    return store;
  } catch (err) {
    if (fs.existsSync(CACHE)) {
      const store = JSON.parse(fs.readFileSync(CACHE, 'utf8'));
      console.log(`  ${STORE} unreachable (${err.message}); using cached data from ${store.fetched_at}`);
      return store;
    }
    throw new Error(`Could not load products from ${STORE} and no cache exists: ${err.message}`);
  }
}

const cents = (v) => (v == null || v === '' ? null : Math.round(parseFloat(v) * 100));

function mkImage(src, alt = '', width = 1000, height = 1333, id = 0) {
  return { id, src, alt: alt || '', width, height, aspect_ratio: width / height, media_type: 'image', preview_image: { src, width, height } };
}

function buildCatalog(store) {
  const products = store.products.map((p) => {
    const media = p.images
      .filter((i) => !/\.heic($|\?)/i.test(i.src))
      .map((i) => mkImage(i.src, i.alt, i.width, i.height, i.id));
    const variants = p.variants.map((v) => {
      const options = [v.option1, v.option2, v.option3].filter((o) => o != null);
      return {
        id: v.id,
        title: v.title,
        price: cents(v.price),
        compare_at_price: cents(v.compare_at_price),
        available: v.available,
        options,
        option1: v.option1, option2: v.option2, option3: v.option3,
        featured_image: v.featured_image ? mkImage(v.featured_image.src) : null
      };
    });
    const prices = variants.map((v) => v.price);
    return {
      id: p.id,
      object_type: 'product',
      title: p.title,
      handle: p.handle,
      url: `/products/${p.handle}`,
      type: p.product_type || '',
      vendor: p.vendor,
      tags: p.tags || [],
      description: p.body_html || '',
      created_at: p.created_at,
      available: variants.some((v) => v.available),
      price: Math.min(...prices),
      price_min: Math.min(...prices),
      price_max: Math.max(...prices),
      price_varies: Math.min(...prices) !== Math.max(...prices),
      compare_at_price: variants[0].compare_at_price,
      media,
      images: media,
      featured_media: media[0] || null,
      featured_image: media[0] || null,
      variants,
      raw_options: p.options,
      has_only_default_variant: variants.length === 1 && variants[0].title === 'Default Title',
      collections: []
    };
  });
  const byHandle = Object.fromEntries(products.map((p) => [p.handle, p]));

  const collections = store.collections.map((c) => {
    const list = (c.product_handles || []).map((h) => byHandle[h]).filter(Boolean);
    return {
      id: c.id,
      title: c.title,
      handle: c.handle,
      url: `/collections/${c.handle}`,
      description: c.body_html || '',
      featured_image: c.image ? mkImage(c.image.src, c.image.alt) : null,
      products: list,
      products_count: list.length,
      all_products_count: list.length
    };
  });
  for (const c of collections) for (const p of c.products) p.collections.push(c);
  const all = { id: 0, title: 'Shop all', handle: 'all', url: '/collections/all', description: '', featured_image: null, products, products_count: products.length, all_products_count: products.length };
  const colByHandle = Object.fromEntries([...collections, all].map((c) => [c.handle, c]));
  return { products, byHandle, collections, colByHandle };
}

// Per-request view of a product with the selected variant applied.
function productView(p, variantId) {
  const selected = p.variants.find((v) => String(v.id) === String(variantId)) || p.variants.find((v) => v.available) || p.variants[0];
  const options_with_values = p.raw_options.map((o, i) => ({
    name: o.name,
    position: o.position || i + 1,
    position0: (o.position || i + 1) - 1,
    values: o.values,
    selected_value: selected.options[i]
  }));
  return { ...p, selected_variant: variantId ? selected : null, selected_or_first_available_variant: selected, first_available_variant: selected, options_with_values };
}

/* ------------------------------------------------------------------ cart */

let cartLines = []; // [{ variant_id, quantity }]

function findVariant(catalog, id) {
  for (const p of catalog.products) {
    const v = p.variants.find((x) => String(x.id) === String(id));
    if (v) return { product: p, variant: v };
  }
  return null;
}

function isOneOfOne(p, settings) {
  return (settings.one_of_one_tag && p.tags.includes(settings.one_of_one_tag)) || p.collections.some((c) => c.title.includes('1/1'));
}

function cartObject(catalog) {
  const items = cartLines
    .map((l, i) => {
      const found = findVariant(catalog, l.variant_id);
      if (!found) return null;
      const { product, variant } = found;
      const pv = productView(product, variant.id);
      return {
        id: variant.id,
        key: `${variant.id}:${i}`,
        quantity: l.quantity,
        title: product.has_only_default_variant ? product.title : `${product.title} - ${variant.title}`,
        product: pv,
        product_id: product.id,
        variant,
        variant_id: variant.id,
        url: `${product.url}?variant=${variant.id}`,
        image: variant.featured_image || product.featured_media,
        price: variant.price,
        final_price: variant.price,
        original_line_price: (variant.compare_at_price && variant.compare_at_price > variant.price ? variant.compare_at_price : variant.price) * l.quantity,
        final_line_price: variant.price * l.quantity,
        line_price: variant.price * l.quantity
      };
    })
    .filter(Boolean);
  const total = items.reduce((a, i) => a + i.final_line_price, 0);
  return {
    token: 'preview',
    items,
    item_count: items.reduce((a, i) => a + i.quantity, 0),
    total_price: total,
    items_subtotal_price: total,
    original_total_price: total,
    total_discount: 0,
    currency: { iso_code: 'USD' },
    cart_level_discount_applications: [],
    note: ''
  };
}

// JSON shape of /cart.js — strip nested product objects.
function cartJSON(cart) {
  return {
    ...cart,
    items: cart.items.map((i) => ({
      id: i.id, key: i.key, quantity: i.quantity, title: i.title, product_title: i.product.title,
      variant_title: i.variant.title, price: i.price, final_price: i.final_price, line_price: i.line_price,
      final_line_price: i.final_line_price, url: i.url, image: i.image && i.image.src, handle: i.product.handle
    }))
  };
}

/* ---------------------------------------------------------------- liquid */

function readTheme(rel) {
  return fs.readFileSync(path.join(THEME, rel), 'utf8');
}
function schemaOf(file) {
  const m = readTheme(file).match(/{%-?\s*schema\s*-?%}([\s\S]*?){%-?\s*endschema\s*-?%}/);
  return m ? JSON.parse(m[1]) : { settings: [] };
}

const engine = new Liquid({
  root: [path.join(THEME, 'snippets')],
  extname: '.liquid',
  cache: false,
  greedy: false
});

// {% schema %} … {% endschema %}: metadata only, renders nothing.
engine.registerTag('schema', class extends Tag {
  constructor(token, remain, liquid) {
    super(token, remain, liquid);
    while (remain.length) if (remain.shift().name === 'endschema') return;
    throw new Error('{% schema %} is not closed');
  }
  * render() {}
});
engine.registerTag('layout', class extends Tag { * render() {} });

// Split "'product', product, id: 'X', data-foo: ''" into top-level parts.
function splitArgs(str) {
  const parts = [];
  let cur = '', quote = null;
  for (const ch of str) {
    if (quote) { cur += ch; if (ch === quote) quote = null; continue; }
    if (ch === '"' || ch === "'") { quote = ch; cur += ch; continue; }
    if (ch === ',') { parts.push(cur.trim()); cur = ''; continue; }
    cur += ch;
  }
  if (cur.trim()) parts.push(cur.trim());
  return parts;
}

class BlockTag extends Tag {
  constructor(token, remain, liquid, endName) {
    super(token, remain, liquid);
    this.args = token.args;
    this.templates = [];
    const stream = liquid.parser.parseStream(remain)
      .on(`tag:${endName}`, () => stream.stop())
      .on('template', (tpl) => this.templates.push(tpl))
      .on('end', () => { throw new Error(`{% ${endName} %} missing`); });
    stream.start();
  }
}

const FORM_ACTIONS = {
  product: '/cart/add', customer: '/contact', contact: '/contact', customer_login: '/account/login',
  create_customer: '/account', recover_customer_password: '/account/recover', guest_login: '/account/login',
  storefront_password: '/password', customer_address: '/account/addresses', activate_customer_password: '/account/activate',
  reset_customer_password: '/account/reset'
};

engine.registerTag('form', class extends BlockTag {
  constructor(token, remain, liquid) { super(token, remain, liquid, 'endform'); }
  * render(ctx, emitter) {
    const [typeArg, ...rest] = splitArgs(this.args);
    const type = typeArg.replace(/^['"]|['"]$/g, '');
    const attrs = {};
    for (const part of rest) {
      const m = part.match(/^([\w-]+)\s*:\s*([\s\S]+)$/);
      if (!m) continue; // positional object (product, address) — not needed for markup
      attrs[m[1]] = yield new Value(m[2], this.liquid).value(ctx, false);
    }
    const attrStr = Object.entries(attrs).map(([k, v]) => ` ${k}="${String(v ?? '').replace(/"/g, '&quot;')}"`).join('');
    emitter.write(`<form method="post" action="${FORM_ACTIONS[type] || '/'}" accept-charset="UTF-8"${attrStr}>` +
      `<input type="hidden" name="form_type" value="${type}"><input type="hidden" name="utf8" value="✓">`);
    const posted = ctx.globals.request.posted_form === type;
    ctx.push({ form: { errors: null, 'posted_successfully?': posted, password_needed: true, email: '', first_name: '', last_name: '' } });
    yield this.liquid.renderer.renderTemplates(this.templates, ctx, emitter);
    ctx.pop();
    emitter.write('</form>');
  }
});

engine.registerTag('paginate', class extends BlockTag {
  constructor(token, remain, liquid) { super(token, remain, liquid, 'endpaginate'); }
  * render(ctx, emitter) {
    // Everything fits on one page in the preview; expose a paginate object.
    ctx.push({ paginate: { current_page: 1, pages: 1, parts: [], previous: null, next: null, page_size: 50 } });
    yield this.liquid.renderer.renderTemplates(this.templates, ctx, emitter);
    ctx.pop();
  }
});

engine.registerTag('section', class extends Tag {
  constructor(token, remain, liquid) { super(token, remain, liquid); this.name = token.args.trim().replace(/^['"]|['"]$/g, ''); }
  * render(ctx, emitter) {
    emitter.write(yield renderSection(this.name, this.name, {}, ctx.globals));
  }
});

engine.registerTag('sections', class extends Tag {
  constructor(token, remain, liquid) { super(token, remain, liquid); this.name = token.args.trim().replace(/^['"]|['"]$/g, ''); }
  * render(ctx, emitter) {
    const group = JSON.parse(readTheme(`sections/${this.name}.json`));
    for (const key of group.order) {
      const data = group.sections[key];
      if (data.disabled) continue;
      emitter.write(yield renderSection(data.type, `sections--${this.name}__${key}`, data, ctx.globals));
    }
  }
});

const PLACEHOLDER = (cls = '') => `<svg class="${cls}" viewBox="0 0 525 525" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice"><rect width="525" height="525" fill="currentColor" opacity=".08"/><path d="M200 190h125l30 40-25 15v105H195V245l-25-15z" fill="none" stroke="currentColor" stroke-width="4" opacity=".35"/></svg>`;

function withWidth(url, width) {
  const u = new URL(url.startsWith('//') ? 'https:' + url : url);
  if (width) u.searchParams.set('width', width);
  return u.toString();
}
const money = (c) => (c == null ? '' : '$' + (Number(c) / 100).toFixed(2));
const kw = (args) => Object.fromEntries(args.filter(Array.isArray));
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

engine.registerFilter('money', money);
engine.registerFilter('money_with_currency', (c) => (c == null ? '' : money(c) + ' USD'));
engine.registerFilter('money_without_currency', (c) => (c == null ? '' : (Number(c) / 100).toFixed(2)));
engine.registerFilter('asset_url', (name) => {
  let v = 0;
  try { v = Math.round(fs.statSync(path.join(THEME, 'assets', name)).mtimeMs); } catch (_) { /* missing */ }
  return `/assets/${name}?v=${v}`;
});
engine.registerFilter('stylesheet_tag', (url) => `<link href="${url}" rel="stylesheet" type="text/css" media="all">`);
engine.registerFilter('script_tag', (url) => `<script src="${url}"></script>`);
engine.registerFilter('image_url', (img, ...args) => {
  const src = typeof img === 'string' ? img : img && (img.src || (img.preview_image && img.preview_image.src));
  if (!src) return '';
  return withWidth(src, kw(args).width);
});
engine.registerFilter('image_tag', (url, ...args) => {
  if (!url) return '';
  const o = kw(args);
  const srcset = o.widths ? String(o.widths).split(',').map((w) => `${withWidth(url, w.trim())} ${w.trim()}w`).join(', ') : '';
  const attrs = { src: url, srcset, sizes: o.sizes, alt: o.alt ?? '', class: o.class, loading: o.loading, fetchpriority: o.fetchpriority };
  return '<img' + Object.entries(attrs).filter(([k, v]) => v != null && (v !== '' || k === 'alt')).map(([k, v]) => ` ${k}="${esc(v)}"`).join('') + '>';
});
engine.registerFilter('placeholder_svg_tag', (_name, cls) => PLACEHOLDER(cls));
engine.registerFilter('pluralize', (n, one, many) => (Number(n) === 1 ? one : many));
engine.registerFilter('handle', (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
engine.registerFilter('default_errors', () => '');
engine.registerFilter('format_address', () => '');
engine.registerFilter('format_code', (s) => s);
engine.registerFilter('link_to', (text, url) => `<a href="${url}">${text}</a>`);

/* -------------------------------------------------------------- sections */

function resolveUrl(v) {
  if (!v) return null;
  const m = String(v).match(/^shopify:\/\/(collections|products|pages|blogs)\/(.+)$/);
  return m ? `/${m[1]}/${m[2]}` : v;
}
function resolveImage(v) {
  if (!v) return null;
  const m = String(v).match(/^shopify:\/\/shop_images\/(.+)$/);
  return m ? mkImage(`${STORE}/cdn/shop/files/${m[1]}`) : null;
}

function resolveSettings(defs = [], raw = {}, catalog) {
  const out = {};
  for (const def of defs) {
    if (!def.id) continue;
    let v = raw[def.id] !== undefined ? raw[def.id] : def.default;
    switch (def.type) {
      case 'collection': v = v ? catalog.colByHandle[v] || null : null; break;
      case 'product': v = v ? (catalog.byHandle[v] ? productView(catalog.byHandle[v]) : null) : null; break;
      case 'image_picker': v = resolveImage(v); break;
      case 'url': v = resolveUrl(v); break;
      default: if (v === undefined) v = null;
    }
    out[def.id] = v;
  }
  return out;
}

async function renderSection(type, id, data, globals) {
  const file = `sections/${type}.liquid`;
  const schema = schemaOf(file);
  const catalog = globals.__catalog;
  let blocksData = data.blocks;
  let order = data.block_order;
  if (!blocksData && schema.presets && schema.presets[0] && schema.presets[0].blocks) {
    blocksData = Object.fromEntries(schema.presets[0].blocks.map((b, i) => [`preset-${i}`, b]));
    order = Object.keys(blocksData);
  }
  const blocks = (order || Object.keys(blocksData || {})).map((key) => {
    const b = blocksData[key];
    const def = (schema.blocks || []).find((d) => d.type === b.type) || { settings: [] };
    return { id: key, type: b.type, settings: resolveSettings(def.settings, b.settings, catalog), shopify_attributes: '' };
  });
  const section = { id, type, settings: resolveSettings(schema.settings, data.settings, catalog), blocks, shopify_attributes: '' };
  const html = await engine.parseAndRender(readTheme(file), { section }, { globals });
  return `<div id="shopify-section-${id}" class="shopify-section">${html}</div>`;
}

/* ---------------------------------------------------------------- pages */

const PAGES = {
  shipping: { title: 'Shipping', content: '<p>Orders ship within 2–3 business days. You get a tracking link by email as soon as your order leaves.</p><p>All 1/1 pieces are final sale.</p>' },
  contact: { title: 'Contact', content: '<p>DM us on Instagram at <a href="https://www.instagram.com/nml.club/">@nml.club</a>.</p>' }
};

function settingsGlobal() {
  const schema = JSON.parse(readTheme('config/settings_schema.json'));
  const data = JSON.parse(readTheme('config/settings_data.json'));
  const current = typeof data.current === 'string' ? data.presets[data.current] : data.current;
  const out = {};
  for (const group of schema) for (const s of group.settings || []) if (s.id) out[s.id] = s.default ?? null;
  Object.assign(out, current);
  out.favicon = resolveImage(out.favicon);
  return out;
}

function linklists(pathname) {
  const mk = (links) => ({ links: links.map(([title, url]) => ({ title, url, current: url === pathname })) });
  return {
    'main-menu': mk([['Shop all', '/collections/all'], ['New in', '/collections/back-to-school-collection'], ['1/1 Pieces', '/collections/crimson-slouch-beanie'], ['Weekly drops', '/collections/weekly-1-1-drops']]),
    footer: mk([['Search', '/search'], ['Shipping', '/pages/shipping'], ['Contact', '/pages/contact']])
  };
}

async function renderPage({ template, globals, status = 200 }) {
  let content;
  let layout = 'theme';
  if (template.endsWith('.liquid')) {
    const src = readTheme(`templates/${template}`);
    if (/{%-?\s*layout\s+none\s*-?%}/.test(src)) layout = null;
    content = await engine.parseAndRender(src, {}, { globals });
  } else {
    const tpl = JSON.parse(readTheme(`templates/${template}.json`));
    if (tpl.layout !== undefined) layout = tpl.layout || null;
    const parts = [];
    for (const key of tpl.order) {
      const data = tpl.sections[key];
      if (data.disabled) continue;
      parts.push(await renderSection(data.type, `template--${template}__${key}`, data, globals));
    }
    content = parts.join('\n');
  }
  let html = layout ? await engine.parseAndRender(readTheme(`layout/${layout}.liquid`), { content_for_layout: content }, { globals: { ...globals, content_for_layout: content } }) : content;
  html = html.replace('</body>', `<script>new EventSource('/__livereload').onmessage=()=>location.reload()</script>\n</body>`);
  return { status, html };
}

/* ---------------------------------------------------------------- server */

const store = await loadStore();
const catalog = buildCatalog(store);
const reloadClients = new Set();

function baseGlobals(url, extra = {}) {
  const settings = settingsGlobal();
  return {
    __catalog: catalog,
    settings,
    shop: {
      name: 'Nomorels', description: 'Reworked denim, club tees and one-of-one thrift finds.', url: `http://localhost:${PORT}`,
      customer_accounts_enabled: true, policies: [], password_message: 'The next drop is loading.', checkout: { guest_login: false }
    },
    routes: {
      root_url: '/', cart_url: '/cart', cart_add_url: '/cart/add', cart_change_url: '/cart/change', search_url: '/search',
      collections_url: '/collections', all_products_collection_url: '/collections/all', account_url: '/account',
      account_login_url: '/account/login', account_register_url: '/account/register', account_logout_url: '/account/logout',
      account_addresses_url: '/account/addresses'
    },
    request: { locale: { iso_code: 'en' }, origin: `http://localhost:${PORT}`, path: url.pathname, page_type: extra.page_type || 'index', posted_form: url.searchParams.get('customer_posted') === 'true' ? 'customer' : null },
    cart: cartObject(catalog),
    customer: null,
    collections: catalog.collections,
    linklists: linklists(url.pathname),
    canonical_url: `http://localhost:${PORT}${url.pathname}`,
    content_for_header: '',
    current_page: 1,
    current_tags: null,
    all_country_option_tags: '<option value="United States">United States</option><option value="Netherlands">Netherlands</option>',
    template: { name: extra.page_type || 'index' },
    page_title: 'Nomorels',
    page_description: 'Reworked denim, club tees and one-of-one thrift finds.',
    ...extra
  };
}

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const buf = Buffer.concat(chunks);
  const type = req.headers['content-type'] || '';
  if (type.includes('application/json')) return JSON.parse(buf.toString() || '{}');
  if (type.includes('multipart/form-data') || type.includes('application/x-www-form-urlencoded')) {
    const fd = await new Response(buf, { headers: { 'content-type': type } }).formData();
    return Object.fromEntries(fd.entries());
  }
  return {};
}

function send(res, status, body, type = 'text/html; charset=utf-8', headers = {}) {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store', ...headers });
  res.end(body);
}
const sendJSON = (res, status, obj) => send(res, status, JSON.stringify(obj), 'application/json; charset=utf-8');

async function sectionsPayload(names, url) {
  if (!names) return undefined;
  const globals = baseGlobals(url);
  const out = {};
  for (const name of String(names).split(',').map((s) => s.trim()).filter(Boolean)) {
    out[name] = await renderSection(name, name, {}, globals);
  }
  return out;
}

const MIME = { '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.json': 'application/json' };

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const p = url.pathname.replace(/\/$/, '') || '/';
  try {
    if (p === '/__livereload') {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive' });
      res.write(': connected\n\n');
      reloadClients.add(res);
      req.on('close', () => reloadClients.delete(res));
      return;
    }
    if (p.startsWith('/assets/')) {
      const file = path.join(THEME, 'assets', path.basename(p));
      if (!fs.existsSync(file)) return send(res, 404, 'Not found', 'text/plain');
      return send(res, 200, fs.readFileSync(file), MIME[path.extname(file)] || 'application/octet-stream');
    }

    /* Ajax Cart API */
    if (p === '/cart.js' || (p === '/cart' && req.headers.accept?.includes('application/json') && req.method === 'GET')) {
      return sendJSON(res, 200, cartJSON(cartObject(catalog)));
    }
    if ((p === '/cart/add.js' || p === '/cart/add') && req.method === 'POST') {
      const body = await readBody(req);
      const wantsJSON = p.endsWith('.js');
      const items = body.items ? (typeof body.items === 'string' ? JSON.parse(body.items) : body.items) : [{ id: body.id, quantity: body.quantity }];
      let last;
      for (const it of items) {
        const found = findVariant(catalog, it.id);
        const qty = Math.max(1, parseInt(it.quantity, 10) || 1);
        if (!found) return sendJSON(res, 404, { status: 404, message: 'Cart Error', description: 'Cannot find variant' });
        const { product, variant } = found;
        if (!variant.available) return sendJSON(res, 422, { status: 422, message: 'Cart Error', description: `${product.title} is sold out.` });
        const line = cartLines.find((l) => String(l.variant_id) === String(variant.id));
        const inCart = line ? line.quantity : 0;
        if (isOneOfOne(product, settingsGlobal()) && inCart + qty > 1) {
          return sendJSON(res, 422, { status: 422, message: 'Cart Error', description: `All 1 ${product.title} are in your cart.` });
        }
        if (line) line.quantity += qty; else cartLines.push({ variant_id: variant.id, quantity: qty });
        last = { id: variant.id, quantity: inCart + qty, title: product.title, variant_title: variant.title, price: variant.price };
      }
      if (!wantsJSON) return send(res, 302, '', 'text/plain', { Location: '/cart' });
      const sections = await sectionsPayload(body.sections, url);
      return sendJSON(res, 200, { ...last, sections });
    }
    if ((p === '/cart/change.js' || p === '/cart/change') && req.method === 'POST') {
      const body = await readBody(req);
      const idx = Number(body.line) - 1;
      const qty = Math.max(0, parseInt(body.quantity, 10) || 0);
      if (!cartLines[idx]) return sendJSON(res, 400, { status: 400, message: 'Cart Error', description: 'That line is no longer in your bag.' });
      const found = findVariant(catalog, cartLines[idx].variant_id);
      if (found && isOneOfOne(found.product, settingsGlobal()) && qty > 1) {
        return sendJSON(res, 422, { status: 422, message: 'Cart Error', description: `All 1 ${found.product.title} are in your cart.` });
      }
      if (qty === 0) cartLines.splice(idx, 1); else cartLines[idx].quantity = qty;
      const sections = await sectionsPayload(body.sections, url);
      return sendJSON(res, 200, { ...cartJSON(cartObject(catalog)), sections });
    }
    if (p === '/cart' && req.method === 'POST') {
      // Checkout button: the real store hands off to Shopify checkout here.
      const globals = baseGlobals(url, { page_type: 'page', page: { title: 'Checkout', content: '<p>In the live store this button opens Shopify checkout. The local preview stops here.</p><p><a href="/cart">Back to your bag</a></p>' }, page_title: 'Checkout' });
      const out = await renderPage({ template: 'page', globals });
      return send(res, out.status, out.html);
    }
    if ((p === '/contact' || p === '/account/login' || p === '/account/recover' || p === '/account') && req.method === 'POST') {
      const body = await readBody(req);
      if (body.form_type === 'customer') console.log(`  [club signup] ${body['contact[first_name]'] || '(no name)'} <${body['contact[email]']}>`);
      const back = new URL(req.headers.referer || '/', `http://localhost:${PORT}`);
      back.searchParams.set('customer_posted', 'true');
      return send(res, 302, '', 'text/plain', { Location: back.pathname + back.search + '#ClubForm' });
    }

    /* Section Rendering API */
    if (url.searchParams.has('sections') && req.method === 'GET') {
      return sendJSON(res, 200, await sectionsPayload(url.searchParams.get('sections'), url));
    }

    /* Pages */
    let out;
    if (p === '/') {
      out = await renderPage({ template: 'index', globals: baseGlobals(url, { page_type: 'index' }) });
    } else if (p.startsWith('/products/')) {
      const prod = catalog.byHandle[p.split('/')[2]];
      if (prod) {
        const product = productView(prod, url.searchParams.get('variant'));
        out = await renderPage({ template: 'product', globals: baseGlobals(url, { page_type: 'product', product, page_title: prod.title, page_description: prod.description.replace(/<[^>]+>/g, ' ').trim().slice(0, 160), page_image: prod.featured_media }) });
      }
    } else if (p === '/collections') {
      out = await renderPage({ template: 'list-collections', globals: baseGlobals(url, { page_type: 'list-collections', page_title: 'Collections' }) });
    } else if (p.startsWith('/collections/')) {
      const col = catalog.colByHandle[p.split('/')[2]];
      if (col) {
        const sort_by = url.searchParams.get('sort_by') || 'manual';
        const sorted = [...col.products];
        const sorters = {
          'title-ascending': (a, b) => a.title.localeCompare(b.title),
          'title-descending': (a, b) => b.title.localeCompare(a.title),
          'price-ascending': (a, b) => a.price - b.price,
          'price-descending': (a, b) => b.price - a.price,
          'created-ascending': (a, b) => a.created_at.localeCompare(b.created_at),
          'created-descending': (a, b) => b.created_at.localeCompare(a.created_at)
        };
        if (sorters[sort_by]) sorted.sort(sorters[sort_by]);
        const collection = {
          ...col, products: sorted, sort_by, default_sort_by: 'manual',
          sort_options: [
            { name: 'Featured', value: 'manual' }, { name: 'Alphabetically, A-Z', value: 'title-ascending' },
            { name: 'Alphabetically, Z-A', value: 'title-descending' }, { name: 'Price, low to high', value: 'price-ascending' },
            { name: 'Price, high to low', value: 'price-descending' }, { name: 'Date, new to old', value: 'created-descending' },
            { name: 'Date, old to new', value: 'created-ascending' }
          ]
        };
        out = await renderPage({ template: 'collection', globals: baseGlobals(url, { page_type: 'collection', collection, page_title: col.title }) });
      }
    } else if (p === '/cart') {
      out = await renderPage({ template: 'cart', globals: baseGlobals(url, { page_type: 'cart', page_title: 'Your bag' }) });
    } else if (p === '/search') {
      const q = (url.searchParams.get('q') || '').trim();
      const results = q ? catalog.products.filter((x) => `${x.title} ${x.tags.join(' ')} ${x.type}`.toLowerCase().includes(q.toLowerCase())) : [];
      out = await renderPage({ template: 'search', globals: baseGlobals(url, { page_type: 'search', page_title: 'Search', search: { performed: !!q, terms: q, results, results_count: results.length } }) });
    } else if (p.startsWith('/pages/')) {
      const page = PAGES[p.split('/')[2]];
      if (page) out = await renderPage({ template: 'page', globals: baseGlobals(url, { page_type: 'page', page, page_title: page.title }) });
    } else if (p.startsWith('/blogs/')) {
      out = await renderPage({ template: 'blog', globals: baseGlobals(url, { page_type: 'blog', blog: { title: 'Stories', articles: [] }, page_title: 'Stories' }) });
    } else if (p === '/account' || p === '/account/logout') {
      return send(res, 302, '', 'text/plain', { Location: '/account/login' });
    } else if (p === '/account/login' || p === '/account/register') {
      const name = p.split('/')[2];
      out = await renderPage({ template: `customers/${name}.liquid`, globals: baseGlobals(url, { page_type: `customers/${name}`, page_title: name === 'login' ? 'Log in' : 'Create account' }) });
    } else if (p === '/password') {
      out = await renderPage({ template: 'password', globals: baseGlobals(url, { page_type: 'password' }) });
    }

    if (!out) out = await renderPage({ template: '404', status: 404, globals: baseGlobals(url, { page_type: '404', page_title: 'Not found' }) });
    send(res, out.status, out.html);
  } catch (err) {
    console.error(`  ✖ ${req.method} ${req.url}\n    ${err.message}`);
    send(res, 500, `<pre style="font:14px/1.5 ui-monospace,monospace;padding:24px;white-space:pre-wrap">Liquid error on ${esc(req.url)}\n\n${esc(err.message)}\n\n${esc(err.stack || '')}</pre>`);
  }
});

// Reload the browser whenever a theme file changes.
let reloadTimer;
for (const dir of ['layout', 'sections', 'snippets', 'templates', 'assets', 'config', 'locales']) {
  fs.watch(path.join(THEME, dir), { recursive: true }, () => {
    clearTimeout(reloadTimer);
    reloadTimer = setTimeout(() => { for (const c of reloadClients) c.write('data: reload\n\n'); }, 80);
  });
}

server.listen(PORT, () => {
  console.log(`\n  NML Club theme preview → http://localhost:${PORT}\n  Edits to theme files reload the browser automatically.\n`);
});
