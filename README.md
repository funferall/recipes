# Recipes

A tiny personal cookbook: cards with emoji or a photo, search across names, methods and
ingredients, ingredient chips, and multi-select that merges everything into one shopping list.

- `index.html` — the page and its styles
- `app.js` — logic; no build step, no framework
- `data.json` — the store (source of truth); the browser caches it in localStorage

Reads are plain HTTP. Writes need a fine-grained GitHub token (Contents: read and write on
this repo) pasted once into the page's Settings — the token lives only in that browser.
