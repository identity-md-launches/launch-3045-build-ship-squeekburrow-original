# Third-party notices

SqueekBurrow's original application code, game rules and SVG illustrations are covered by the root MIT license. Squeekchain is an upstream data source; this project is an independent game and does not claim endorsement.

## Bundled fonts

- **Nunito Sans**, local Latin variable WOFF2; SIL Open Font License 1.1. See `public/fonts/nunito-OFL.txt` and the identical production copy in `dist/fonts/`.
- **Fraunces**, local Latin WOFF2; SIL Open Font License 1.1. See `public/fonts/fraunces-OFL.txt` and the identical production copy in `dist/fonts/`.

Font files were obtained from Google Fonts. Runtime font loading is entirely local. No Google Fonts request is required by the website.

## Design references used

The pinned Better Interface and Impeccable guidance informed the interface and documentation; no upstream website template or game was copied.

- Jakub Krehel, **Better Interface**, MIT, copyright 2026. Reference commit `267330e1adfc66a718fb65fa6918c1f06d0a689e`: <https://github.com/jakubkrehel/skills/tree/267330e1adfc66a718fb65fa6918c1f06d0a689e/skills/better-interface>.
- Paul Bakaus, **Impeccable** documentation guidance, Apache-2.0, copyright 2025. Reference commit `9d715cc4f5564a990ca8345abfdd5df6dc9b41c8`: <https://github.com/pbakaus/impeccable/blob/9d715cc4f5564a990ca8345abfdd5df6dc9b41c8/skill/reference/document.md>.

The assignment supplied adaptations for IMD; the implementation and `DESIGN.md` apply them to this new game. The supplied combined license text is preserved in `licenses/design-guidance.txt`. Each included work retains its own license.

React, React DOM and Scheduler are MIT licensed. Their license notices are included in `public/licenses/` and copied to `dist/licenses/` with the production export. Development dependencies and their licenses are available through the pinned npm packages; no dependency archive or registry mirror is included.
