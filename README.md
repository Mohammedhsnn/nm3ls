# NML Club — Shopify theme

Online Store 2.0 theme for [nm3ls.com](https://nm3ls.com) (Nomorels / NML Club).
Clean retro look: off-white, warm black and cherry red, with a spinning record,
SOLD stamps on sold 1/1 pieces and a member-card signup.

## Run it locally (live preview)

Needs Node 18+ and staff access to the store.

```bash
npm install
npm run dev
```

`npm run dev` runs `shopify theme dev` against `exayxs-wj.myshopify.com`. The first time,
it opens a browser to log in. After that it serves the theme at http://127.0.0.1:9292
with your real products, and hot-reloads on every file save. It does not change the live store.

## Put it on the store

```bash
npm run push     # uploads as a new, unpublished theme
```

Then go to **Online Store → Themes**, preview it, and click **Publish** when you're happy.
You can also connect this GitHub repo under **Online Store → Themes → Add theme → Connect from GitHub**.

`npm run check` runs Shopify Theme Check.

## Sections (all editable in the theme editor)

| Section | What it does |
| --- | --- |
| Announcement bar | Scrolling ticker, one block per message |
| Header | Text wordmark (or logo image), menu, bag count |
| Hero | Wordmark, heading, two buttons, framed photo, spinning record, sticker |
| Featured collection | Product grid with hover image swap |
| 1/1 crate | Side-scrolling rack of a collection, filter chips (blocks), hide-sold toggle, live count |
| Feature product | Record-sleeve band for one product, with spec lines |
| Club signup | Real Shopify newsletter signup (tags customers `newsletter,nml-club`) with a live member card |
| Cart drawer | Slide-out bag via the Ajax Cart API; 1/1 pieces are fixed at quantity 1 |

## 1 of 1 pieces

A product is treated as 1 of 1 when it has the tag `1of1` (changeable under
Theme settings → Products), or when it's in a collection whose title contains `1/1`.
1 of 1 pieces get the red label, no quantity picker, and a SOLD stamp once they sell.

## Colors

All colors live in **Theme settings → Colors**, so the palette can be changed without code.

## Files

```
layout/     theme.liquid, password.liquid
sections/   homepage sections, main-* page sections, header/footer groups
snippets/   product-card, price, cart-items, one-of-one, css-variables, meta-tags
templates/  JSON templates + customer account pages
assets/     theme.css, theme.js
config/     settings_schema.json, settings_data.json
```
