# Juiced

**v0.1.0-alpha.1 — Alpha testing. Not ready for production. Do not use for real work or add sensitive information; feel free to play around.**

Clean frontend foundation for the accepted Juiced site and brand workspace. No framework or runtime package installation is needed; use Node.js 22 or later.

```sh
npm run dev
```

Open http://127.0.0.1:4323. The development command builds the same `dist/` artifact used for release, then serves it locally. Re-run the build and refresh after source changes.

```sh
npm test
npm run build
npm run preview
```

Deploy **only `dist/`** to a static host. `npm start` also serves that artifact with Node and honours `PORT` and `HOST`; the default is loopback port 4323. The supplied `_headers` is suitable for hosts supporting that format; configure equivalent headers on other hosts. HTTPS is required for a deployed camera reflection. No publication, remote repository or hosting resources are created automatically.

## What is here

- `src/index.html`: accepted public landing, mirror and layered j.
- `src/workspace.html`: brand assets, files, discovery, creative team, creator profile and Voices flows.
- `src/styles`: shared tokens, one authoritative site stylesheet and the cleaned workspace stylesheet.
- `src/art`: approved procedural artwork and explicit local camera reflection; no calibration or review fixtures.
- `src/ui`: portable component source retained for ongoing adoption. Unused UI source is excluded from the release.
- `tests`: domain, export safety, camera lifecycle and release-boundary regressions.
- `scripts`: dependency-traced build and static server, with no provider or API proxy.

The build starts at two approved pages plus the error page and robots file. It copies only their local import/resource graph. Workshop boards, review pages, naming comparisons, component demonstrations, tests, source maps, credentials and archived AI/hand-tracking code are not public release files. Unknown paths return 404.

## Current service boundary

The frontend is release-buildable. The workspace still saves drafts and original files in this browser. Creator publishing, live matching, invitation delivery and roundtable dispatch are not connected, and the UI says so. The first release can remain agency-led; those services can be connected independently.

This is a new origin on port 4323, so it does not automatically inherit the reference prototype's IndexedDB at port 4321. Existing browser data stays there. Copying source files does not migrate customer files; arrange a deliberate complete export/import before retiring the old origin.

`MIGRATION.json` records the retained runtime and removed prototype scaffolding. The old repositories remain unchanged. This repository contains no workshop history or account credentials.

## Alpha release

Every page carries a permanent alpha notice. Titles, robots metadata, robots.txt and HTTP headers discourage indexing. The warning is informational: this is a public playground, not private access control. Drafts and original files remain in the visitor’s browser, and the shared services listed above are unconnected.

GitHub CI tests the source and retains the approved static build. The Vercel configuration publishes only dist/ with the same security/no-index headers as the local server. The verified public alpha is https://juiced.zenith-research.ca/ with trusted HTTPS. Only dist/ is hosted; workshop and design-source pages are excluded.

Promotion beyond alpha requires real intake/registration, recovery and operator handoffs plus deployed journey/device qualification. The alpha label is not evidence that those gates have passed.

## Continuing development

Use this repository on main. Devgraph Project `juiced-production-launch` is the canonical tracker for release hardening, private brand intake, Voice registration, device qualification and deferred ideas. Do not create a second checklist here or publish private tracker exports. The sibling workshop and prototype repositories are historical references and must not be deployed.

The social preview is `src/social-card-v1.png`; editable capture source and instructions live in `design/`. Keep the alpha warning and matching metadata when updating it.
