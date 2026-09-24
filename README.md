# NML Club — Shopify theme

Online Store 2.0 theme for [nm3ls.com](https://nm3ls.com) (Nomorels / NML Club).
Clean retro look: off-white, warm black and cherry red, with a spinning record,
SOLD stamps on sold 1/1 pieces and a member-card signup.

## Run it locally

```bash
npm install
npm run dev
```

Opens a local preview at http://localhost:9292. No Shopify login needed: `dev/server.mjs`
renders the theme files with LiquidJS, using the live products and collections from
nm3ls.com. The bag, 1/1 limits, filters and signup all work, and the browser
reloads when you save a theme file. Checkout stops at a placeholder page.

The preview emulates Shopify, so a few things differ from the real store: every
collection fits on one page, the theme editor isn't available, and the signup only
logs to the terminal.

### Shareable preview (GitHub Pages)

```bash
npm run build
```

Writes a static copy of the site to `_site/` for the `gh-pages` branch. A small script
(`dev/static-shim.js`) stands in for the Shopify cart, so the bag works as a demo in the
visitor's browser; checkout, signup and accounts show a "demo preview" message.

### Real Shopify preview

```bash
npm run shopify:dev
```

Runs `shopify theme dev` against `exayxs-wj.myshopify.com` (needs a store login the first time).

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
dev/        local preview server + static export (not uploaded to Shopify)
layout/     theme.liquid, password.liquid
sections/   homepage sections, main-* page sections, header/footer groups
snippets/   product-card, price, cart-items, one-of-one, css-variables, meta-tags
templates/  JSON templates + customer account pages
assets/     theme.css, theme.js
config/     settings_schema.json, settings_data.json
```
