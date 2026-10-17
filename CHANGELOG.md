# Changelog

All notable changes to this project are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)

## [Unreleased]

### Added

- Branded Open Graph and large-image social metadata for the landing and workspace pages — shared links now carry the approved identity and a clear alpha warning.
- Editable social-card composition using the existing fonts and procedural mirror — future captures can stay consistent with the website.

### Fixed

- Allowlist Vercel build inputs explicitly — local QA, audit backups, design source and repository notes must never be uploaded by the deployment CLI.
- Pin deployment Node to 22.x — hosting and CI must use the same supported major rather than drifting automatically.

- Include same-origin social images in the dependency-traced build and serve PNG with its image MIME type — metadata assets must work in the deployed artifact as well as the source tree.

### Changed

- Document the active alpha hostname and Devgraph as the canonical work tracker — development can continue from one production repository without a second backlog.
