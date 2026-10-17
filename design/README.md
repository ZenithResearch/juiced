# Social card

`social-card.html`, its stylesheet and module are the editable 1200 × 630 source for `src/social-card-v1.png`. It uses the shipped Manrope fonts and the actual procedural mirror renderer; there are no generated illustrations, camera input or external assets.

For a new capture, copy these three files to a temporary render folder beside copies of the built `art/` and `fonts/` folders. Serve that folder on loopback, open `social-card.html` at a 1200 × 630 viewport, check the font and WebGL state, then capture the viewport as PNG. Keep only the selected PNG under `src/`. Version its filename when updating it to avoid stale social caches.

This directory is authoring source and is excluded from the dependency-traced public build. The HTML metadata follows the [Open Graph protocol](https://ogp.me/) and includes an absolute HTTPS image URL, dimensions, MIME type and alternative text. Both landing and workspace have their own page title, description and canonical URL.
