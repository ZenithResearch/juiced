# Juiced

Clean production frontend for the accepted Juiced site and brand workspace. No framework or runtime package installation is needed; use Node.js 22 or later.

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
