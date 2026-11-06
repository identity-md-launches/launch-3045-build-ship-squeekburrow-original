# SqueekBurrow design system

## Overview

SqueekBurrow is a cooperative survival game for a small group sharing a hamster home. The implemented interface pairs an original illustrated burrow with a compact assignment panel. Its cream paper surfaces, moss green actions, warm earth illustration and rounded typography keep survival decisions readable without turning the game into a financial dashboard.

`src/styles.css` is the canonical token and component source. `src/main.tsx` holds the page patterns; `src/Burrow.tsx` and `src/icons.tsx` hold original SVG assets. The desktop burrow composition is specific to the game screen. The same navigation, page heading, typography and spacing continue on Field journal and Burrowmates.

## Colors

All values below are implemented CSS custom properties in `src/styles.css`. The site has one light theme; no dark-theme palette is implied.

| Token                                      | Value                 | Role                                                                |
| ------------------------------------------ | --------------------- | ------------------------------------------------------------------- |
| `--color-page`                             | `#f5f3e9`             | Page background.                                                    |
| `--color-surface`                          | `#fffdf7`             | Header, assignment panel, dialogs, inputs and primary action text.  |
| `--color-soft`                             | `#edeedf`             | Quiet hover surface.                                                |
| `--color-ink`                              | `#303d2d`             | Main text and headings.                                             |
| `--color-muted`                            | `#697060`             | Supporting text, descriptions and secondary numbers.                |
| `--color-line`                             | `#dedfcf`             | Structural dividers and neutral panel borders.                      |
| `--color-accent`                           | `#425f3b`             | Primary button, links, current navigation, positive changes.        |
| `--color-accent-hover`                     | `#334c2d`             | Primary action hover.                                               |
| `--color-accent-soft`                      | `#eaf0df`             | Soft positive/accent surfaces.                                      |
| `--color-warning` / `--color-warning-soft` | `#92532d` / `#f7ead8` | Warning tones available in the implemented token set.               |
| `--color-danger` / `--color-danger-soft`   | `#a04232` / `#faeee6` | Error text, losses, low resources and paused-live alert background. |
| `--color-focus`                            | `#a65228`             | Keyboard focus perimeter.                                           |
| `--color-food`                             | `#7b672b`             | Food icon.                                                          |
| `--color-timber`                           | `#956242`             | Timber icon.                                                        |
| `--color-morale`                           | `#9c655d`             | Morale icon.                                                        |

Selected assignments use a pale green fill and green border, a checkmark on larger layouts, and the native radio's checked state. Warnings include words and icons, not color alone. Resource totals remain visible when progress bars are present. The illustration uses a separate earthy decorative palette directly in SVG; do not reuse those low-contrast decorative colors as interface text.

The rendered contrast probe and Axe audit results are recorded in `artifacts/validation.md`. The solid text pairs measured by the probe pass its WCAG AA thresholds. That result does not measure every pixel of the illustration, all alpha overlays, or every possible content state.

## Typography

Fonts are bundled locally in `public/fonts/` and copied to `dist/fonts/`. Vite rewrites the public font URLs relative to the export. Font licenses sit beside their files.

- **Nunito Sans**, `nunito-latin.woff2`, `system-ui, sans-serif` fallback. CSS declares the variable range 400–800; the interface uses **400**, **600**, **800**. It supplies body copy, controls, labels, resource totals and lists.
- **Fraunces**, `fraunces-latin.woff2`, `Georgia, serif` fallback, **600**. It supplies page headings, dialogue headings and season-result titles. It is not used for numeric tables or dense guidance.
- Both use `font-display: swap`. Root settings are `font-synthesis: none`, `font-optical-sizing: auto` and a **16px** base.

| Token            | Size at default root | Use                                                   |
| ---------------- | -------------------- | ----------------------------------------------------- |
| `--text-xs`      | `.8125rem` / 13px    | Labels, help, round metadata.                         |
| `--text-body`    | `1rem` / 16px        | Body and controls; all text inputs stay at this size. |
| `--text-heading` | `1.25rem` / 20px     | Section titles and assignment heading.                |
| `--text-value`   | `1.5rem` / 24px      | Compact page titles, brand, mobile resource totals.   |
| `--text-display` | `2rem` / 32px        | Desktop resource totals, dialog/result titles.        |
| `--text-hero`    | `2.5rem` / 40px      | Main desktop page heading.                            |

Default line height is **1.5**; h1 uses **1.15**, h2 **1.3**, h3 **1.4**, and longer help uses **1.6–1.7**. Headings balance text; paragraphs use `text-wrap: pretty`. H1 letter spacing is `-.035em`, h2 `-.015em`; the compact brand uses `-.045em`. Countdown, resources, ranks and contribution use tabular numerals. Long source strings and player names can wrap with `overflow-wrap: anywhere`; critical values are not ellipsized.

## Layout

The root spacing tokens are **4, 8, 12, 16, 20, 24, 32 and 40px** (`--space-1` through `--space-10`, with the implemented steps). Local components also use values suited to their contents. Use roughly twice the inner gap between groups; align page sections to the same inline edge.

`main` has a **1280px** maximum width, centered, with **32px** desktop inset. `.header-inner` caps at **1328px**. The main `.game-grid` uses `minmax(0, 1.8fr) minmax(330px, 1fr)` with a **24px** gap. The illustration and four resource columns occupy the wider side; assignment and personal information align on the other side. Journal and colony screens use a main column and a supporting column. Controls stay in normal document flow.

| Breakpoint          | Implemented behavior                                                                                                                                                                                                                                            |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `min-width: 1440px` | Main reaches its full width; larger art and assignment spacing.                                                                                                                                                                                                 |
| `max-width: 1100px` | 24px page inset, tighter two-column proportions, smaller resource totals, profile text removed.                                                                                                                                                                 |
| `max-width: 780px`  | Navigation becomes a second header row. Game stacks artwork, assignment panel, then supplies. Secondary content becomes two columns; journal/colony becomes one column. Season dots hide while textual progress stays.                                          |
| `max-width: 520px`  | 16px page inset, 24px page title, compact 113px illustration, two-by-two assignment choices, single-column secondary sections. Profile button hides; settings remains available in the footer. Primary assignment is fully visible on the first 390×844 screen. |
| `max-width: 350px`  | Tighter controls and assignment padding; redundant navigation/resource icons hide. Labels and actions remain.                                                                                                                                                   |

Layout uses logical inline/block spacing where direction matters. There are no fixed bottom controls covering game text. The app has a skip link and semantic DOM order. At narrow widths CSS moves supplies after the primary assignment so the next action remains reachable. Dialogs have a bounded viewport height and their own scroll region.

Production screenshots and overflow checks cover **320, 390, 768, 1100 and 1440 CSS pixels**. Physical phones, translated strings, RTL and browser-native 200% zoom are not established by those checks; see validation for the precise coverage.

## Elevation & Depth

The interface is deliberately flat: **no box shadows**. Hairline borders identify the assignment panel, resource separators, list rows and input boundaries. Tonal surfaces identify preparation help and the illustrated scene. Elevation is reserved for the native modal dialog, whose backdrop uses `#2831208c` and **4px** blur. A 3px focus outline sits outside controls; hover does not replace focus.

Artwork clips inside its rounded scene boundary. This is decorative clipping, separate from text containers. No texture image, external raster background or continuous animation is required.

## Shapes

- Assignment panels and artwork: **18px** desktop corners; compact mobile panels **12px**.
- Assignment choices: **12px** desktop corners, **9px** compact corners, 1px border.
- Buttons: **9px** corners; inputs **8px**; mode-switch outer **10px**, inner **7px**.
- Dialog: **22px** desktop, **18px** mobile corners; **28px** desktop padding, **22px 20px** mobile.
- Avatars, icon-only buttons and status dots: circles. Supporting icon tiles use rounded squares.

Do not turn every section into a bordered panel. Journal entries and leaderboards use spacing and separators; only the main decision surface needs strong containment.

## Components

These are implemented components or class patterns, not a separate component-library package.

| Component / source                                                                         | Use and behavior                                                                                                                                                                                                                                                                |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.button.primary`, `.button.secondary`, `.text-button`, `.icon-button` in `src/styles.css` | One primary action per decision surface. Primary is moss green; secondary is bordered; text action stays visibly interactive. Main buttons are at least 44px tall. Disabled controls show a static locked/unavailable state. Icon-only buttons have accessible names.           |
| Header/navigation in `src/main.tsx`                                                        | Real hash links with `aria-current="page"`; product logo returns to the burrow. Same destinations persist across responsive layouts.                                                                                                                                            |
| Assignment fieldset in `src/main.tsx`                                                      | Four native radios, one named group, full choice labels. Native arrow-key behavior, selected-state outline/check, associated descriptions and stamina costs. A fieldset disables committed/cutoff/unavailable choices. Stamina can disable an individual choice.                |
| `ModalDialog` in `src/main.tsx`                                                            | Native `dialog.showModal()` gives modal semantics and background inertness. Close button, backdrop click and Escape close it; cleanup restores focus to its opener. Scroll stays contained. Used for onboarding, field guide, service settings and practice-reset confirmation. |
| Join/settings forms in `src/main.tsx`                                                      | Persistent labels, 48px minimum-height inputs, adjacent hint/error text, `aria-invalid` and alert feedback. Invalid onboarding focuses its name field. Busy controls name the operation in progress.                                                                            |
| `Resources` in `src/main.tsx`                                                              | Four supply columns with exact totals; shelter/morale have labeled native progress bars. Low state retains text, and desktop adds a visible Low label.                                                                                                                          |
| `ResolutionView` in `src/main.tsx`                                                         | Weather symbol, round ID, plain result, signed supply changes; native `details/summary` reveals consequences and exact source. Works as a compact latest result and a full journal entry.                                                                                       |
| `Leaderboard` in `src/main.tsx`                                                            | Ordered contribution list, stable rank, wrapping name, personal identification and numbers. Practice helpers are explicitly named as such.                                                                                                                                      |
| `Burrow`, `Hamster`, `Avatar` in `src/Burrow.tsx`                                          | Original scalable art. Burrow has a title/description, chosen chamber highlight and shelter/night variants. Avatars are decorative beside names and hide from accessibility APIs.                                                                                               |
| `Icon` in `src/icons.tsx`                                                                  | One locally implemented outline icon set, `currentColor`, consistent stroke weight, decorative when accompanied by text. No icon-font dependency.                                                                                                                               |
| Live unavailable / season result in `src/main.tsx`                                         | Visible reason and recovery controls. Unavailable shared state is not replaced by practice data. Ended seasons show reason, rounds, contribution, recap and next-season controls.                                                                                               |

`aria-live="polite"` announces game updates without announcing a countdown every second. The focus system uses a **3px `--color-focus`** outline with **4px** offset; radio labels have a corresponding `:has(input:focus-visible)` treatment. Forced-colors rules retain selection and control boundaries.

Motion is opt-in under `prefers-reduced-motion: no-preference`: buttons/choices use named **120ms ease-out** transitions, and press feedback scales to **0.96**. Chamber/scene changes use **150ms ease-out**. There are no endless animations. No-motion users receive the same state through labels, values, selection and icons.

## Do's and Don'ts

- Start an additional page with the existing header, `main`, `.page-heading` and section-heading pattern. Use hash navigation unless static route exports are added deliberately.
- Use the six existing type sizes and semantic color roles. Keep numeric gameplay information in Nunito Sans with tabular numerals.
- Put the assignment action before secondary information on small screens. Preserve full labels, stamina cost, lock status and mode provenance when compacting.
- Keep errors calm and actionable. Use Practice, Live colony, assignment, contribution and Field journal consistently.
- Reuse `Resources`, `ResolutionView`, `Leaderboard`, native radios and native dialog before adding custom interactions.
- Avoid adding dashboard charts, financial cues, extra font families, ornamental uppercase labels, nested shadow panels or client-random outcomes.
- Verify final production assets and 390px action visibility after any layout or copy change. Update this document from source, and put findings and limitations in `artifacts/validation.md`.
