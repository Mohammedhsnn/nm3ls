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
npm run deploy
```

Live at https://mohammedhsnn.github.io/nm3ls/. `npm run build` alone writes a static copy of the site to `_site/`; `deploy` also force-pushes it to the `gh-pages` branch. A small script
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
| Tape marquee | Crossed scrolling tapes; front/back text, colors, tilt and speed |
| Cart drawer | Slide-out bag via the Ajax Cart API; 1/1 pieces are fixed at quantity 1 |

## Motion

Theme settings → **Motion** switches each part on or off:

- **Intro**: black screen, "NML" rises letter by letter, "club" stamps in, a counter
  runs to 100 and the screen wipes up. Plays once per browser session; click to skip.
- **Scroll animations**: headings clip in, cards stagger up, photos parallax, records
  spin faster while scrolling, the footer wordmark rises letter by letter, a progress
  bar runs along the top and the header hides on scroll down.
- **Tape marquee** section: crossed tapes that speed up and reverse with scroll.
- **Custom cursor** (desktop): says "View" over products, "Sold" over sold pieces.
- **Film grain** overlay.

None of it runs in the theme editor or for visitors with reduced motion turned on in
their OS; if `motion.js` fails to load, everything is shown after 3 seconds. Locally,
open http://localhost:9292/?motion=1 to preview animations on a Mac with reduced
motion on (`?motion=0` turns that off).

## Phones

`assets/mobile.css` reshapes the site below 860px:

- Poster hero: full-bleed photo first with the wordmark set over it
- Product rows become swipeable with a progress bar (toggle per section: "Swipe row on phones")
- Full-screen menu with large links
- Floating Shop all / 1/1 crate / Bag bar after the hero (Header → Mobile)
- Product pages: swipe gallery with a photo counter and a sticky Add to bag bar

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
