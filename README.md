# NML Club Storefront

Rebrand concept for [nm3ls.com](https://nm3ls.com) (Nomorels / NML Club): a retro
thrift-store / record-shop storefront built on the real product catalog.

Open `index.html` in a browser, or serve the folder:

```bash
npx serve .
```

## What's in it

- **Hero**: NML club wordmark, the store photo as a record sleeve, spinning vinyl.
- **New in**: back-to-school drop on a pegboard grid, thrift price tags, hover shows the second photo.
- **The 1/1 crate**: every 1/1 piece in one rack, with category filters, a hide-sold toggle and SOLD stamps.
- **NML Club Records**: feature band for the house-label tee.
- **Join the club**: signup that renders a member card. Nothing is sent anywhere yet.
- **Bag**: receipt-style cart. 1/1 pieces are capped at one; the cart is kept in localStorage.

## Files

```
index.html   page, styles and scripts
data.js      product data pulled from the store's /products.json
img/         product photos, resized
```

## Status

This is a static prototype. Checkout and the signup form are placeholders. Going live means
porting it to a Shopify theme (Liquid sections), so products, stock and checkout come from Shopify.
