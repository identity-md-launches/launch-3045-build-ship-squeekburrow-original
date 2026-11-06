# SqueekBurrow

**A cooperative hamster colony survival game, one Squeekchain round at a time.**

Keep Bramblewood fed, sheltered and hopeful for **24 rounds**. Choose one assignment each round, balance personal stamina against shared supplies, and let certified wheel work decide the harvest and weather. The burrow, hamster characters and interface artwork are original SVG illustrations.

## Play and delivery status

The complete static website is in **`dist/`**, including locally bundled fonts, favicon and share image. Open it through an HTTP server; ES modules do not work by opening the file directly. Its relative assets and hash navigation support a gateway subpath.

- **Practice** is immediately playable: 24 recorded, real Squeekchain rounds, two explicitly identified computer helpers, instant resolution, and progress saved on this device. Practice is unranked and never presented as live multiplayer.
- **Live colony** uses the included Node service. Everyone connected to that service shares one durable colony, with server-owned assignments and settlement. The service actually reads the official API and confirmed contract history. A missing or unavailable service produces a visible error and recovery controls, never invented live rounds.

**Public shared backend deployment remains outstanding.** A static IPFS export cannot own a shared database or protect settlement. This submission includes a working, locally validated backend; it does not claim a publicly running backend. IMD publishes the submitted repository and static export after the job. Requested site label: **`squeekburrow`**, or a close available label. No public GitHub or HTTPS demo URL has been assigned in this workspace, and none is fabricated here.

## Install, build and preview

Use **Node.js 24 or newer** and npm. The backend uses Node's built-in TypeScript stripping and `node:sqlite`; it requires no database account, API key, wallet or paid service.

```sh
npm ci
npm run typecheck
npm test
npm run build
npm run preview
```

Preview opens at `http://localhost:4173`. `npm run dev` starts Vite for source development. The committed `package-lock.json` pins dependencies. `dist/` is the production deliverable and is intentionally not ignored. Rebuild it after changing source or `public/`.

For shared play on your own machine:

```sh
npm run build
npm start
```

Visit `http://localhost:8787` in two independent browser profiles. The server serves the production website, advertises same-origin live play through `/config.json`, polls the official source every 15 seconds, and stores the colony in `runtime/colony.sqlite`. The first player starts a season at the current eligible round; joining after cutoff starts it in the following round. Live rounds take ten minutes, plus confirmation delay. Shared play continues when browsers are closed, while the server is running.

## How to play

1. Choose a name and join the colony. Watch food, timber, shelter, morale and your own stamina.
2. Pick **exactly one** assignment. Live assignments become immutable on commit and close **15 seconds before round end**, using the server's clock. You may skip a round, but the colony still consumes supplies.
3. Wait for Squeekchain to certify the outcome. No player can resolve a live round manually. Practice has a clearly labeled **Resolve practice round** button.
4. Read the latest consequences and personal contribution. The **Field journal** retains every processed round with certified work, estimated travel and its source. **Burrowmates** ranks contribution within this colony and season.
5. Survive all 24 rounds to win. Food, shelter or morale reaching zero loses immediately, including on the last round. Save the JSON recap before beginning another season.

### Rules implemented in `shared/game.ts`

Starting supplies: **72 food, 28 timber, 86 shelter, 80 morale**. Every new hamster has **100 stamina**. Shelter, morale and stamina cap at 100; food and timber cap at 9,999. Timber reaching zero does not itself end a season.

| Assignment | Stamina | Effect before weather and upkeep                                                                                                                                                                              |
| ---------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Forage     | −22     | `9 + min(16, floor(distanceMm / 22000)) + luck % 7` food; those food units also count as contribution.                                                                                                        |
| Fortify    | −18     | Spend up to 5 timber; repair `4 + 2 × timber` shelter and add `5 + timber` protection for this round. Contribution is 6 + actual repair + timber spent.                                                       |
| Explore    | −28     | Find `6 + luck % 7 + min(4, floor(distanceMm / 70000))` timber. A seeded thorn event costs another 8 stamina and 3 morale; otherwise a seeded discovery can add blankets, braces or herbs and 8 contribution. |
| Rest       | 0       | Recover up to 38 stamina and add 2 morale; only 1 contribution.                                                                                                                                               |
| Absent     | 0       | Recover 8 stamina, with no contribution or assignment effects.                                                                                                                                                |

`luck` is a stable hash of the authoritative round and server-issued player ID. It is not `Math.random()`. Scarce timber is allocated in stable player-ID order, independent of HTTP request order.

Each round has a deterministic quiet evening, storm, cold night or tunnel collapse. Severity is 4–9, with an additional 3 for zero-work rounds. Storms and collapses damage shelter after Fortify protection; collapses also consume timber. Cold nights use extra food, moderated by shelter and a blanket. Quiet evenings add 2 morale. A brace can stop a collapse; herbs automatically restore 10 morale when morale drops below 55.

After weather, supper costs **`8 + 3 × active hamsters` food**, with a minimum of one active mouth; players become dormant after three rounds without an assignment. Shelter weathers by 2 each round. Food below 15 costs 6 morale; shelter below 25 costs 4 morale. Inventory is consumed automatically when useful. The reducer clamps state, checks loss first, then checks the 24-round victory.

## Exact Squeekchain integration

Integration was inspected and exercised on **6 November 2026**. The official deployment is currently **Sepolia**, not Ethereum mainnet. Authoritative identifiers are pinned in [`shared/live.ts`](shared/live.ts); a deployment change deliberately pauses play until the integration is reviewed.

| Input                   | Exact endpoint or binding                                            | Gameplay use                                                                                                   |
| ----------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Hardware status         | `https://api.squeekchain.com/v1/status`                              | Hardware provenance, freshness, oracle acceptance, live wheel readings.                                        |
| Core state              | `https://api.squeekchain.com/v1/core`                                | Installation, chain, implementation, stream, genesis, round duration, safe block and certified round frontier. |
| Measurement calibration | `https://api.squeekchain.com/v1/measurement/stats?range=7d`          | Derive millimetres per accepted wheel passage from lifetime totals.                                            |
| Confirmed round records | `https://ethereum-sepolia-rpc.publicnode.com`                        | Read `roundPage(uint64,uint64,uint256)` from the pinned core at the API's `safeThroughBlock`.                  |
| Chain                   | `11155111`                                                           | Sepolia; verified with `eth_chainId`.                                                                          |
| Installation            | `sepolia-core-sepolia-20261103`                                      | Must match all three API responses.                                                                            |
| Core proxy              | `0xfd6c166d4b8e2962e65746a13e5a0797cd4de0c4`                         | Read-only contract target.                                                                                     |
| Implementation          | `0x6869d6102696243fd17013ab955d99cd0c522ad3`                         | Must match the official core response.                                                                         |
| Stream                  | `0xa78faebd5aad38b4f90c7f61b9c5c10e8d9b9afe74ebfc2e82ca98b7e57ed562` | Must match the installation's configured stream.                                                               |

Official references: [API](https://docs.squeekchain.com/developers/api/), [core and round archive](https://docs.squeekchain.com/developers/core/), [measurement](https://docs.squeekchain.com/system/measurement/).

`server/chain.mjs` calls only `eth_chainId`, `eth_getBlockByNumber` and `eth_call`. Selector **`0xc8b9e08f`** was generated from `roundPage(uint64,uint64,uint256)`. The arguments are after-round, through-round and maximum 16 records. The decoder reads the returned certified frontier, cumulative work at each checkpoint, ending cumulative work and checkpoint data hashes. It advances using the returned frontier; omitted rounds inside that certified interval are zero-work rounds, not missing-data guesses. It checks nonnegative bounded work, cumulative totals and the pinned block hash before returning the entire requested interval.

Block hex is generated from the decimal safe block with `BigInt`, and the RPC's returned block number is converted back and compared. API responses advertise 12 confirmations. The implementation trusts the official API's safe frontier and public RPC, rather than independently running an Ethereum consensus client.

**Distance:** certified round work is the difference between cumulative accepted wheel passages. Estimated travel is `roundWork × circumferenceMm`. Calibration is validated from official `observedDistanceMm / acceptedWorkUnits`; the captured installation gives **878 mm per passage**. This is Squeekchain's wheel-circumference estimate, not an independent measurement of animal movement. Distance changes Forage and Explore yields. Work, travel and checkpoint hash also seed weather and discoveries. A zero-work round uses the pinned stream plus `certified-zero:<roundId>` as its deterministic identity.

**Seed:** unsigned FNV-1a over `roundId|work|distanceMm|dataHash|salt`. Weather uses salt `weather`; personal outcomes use player ID. The round outcome is the certified work and checkpoint identity; SqueekBurrow does not invent a wheel-spin result or use any token price.

**Timing and outages:** current round is derived from official genesis and 600-second duration. Data must be hardware-originated, online, accepted by the oracle, unpaused, from the pinned deployment, and no more than 120 seconds old. Assignment requests require a successful service snapshot less than 45 seconds old. HTTP errors, timeouts, invalid data, changed deployments and archive verification errors pause assignments and settlement visibly. On recovery the service processes every certified missing round in order, using committed choices or absence; outages do not create a free survival pause. Previously saved values remain visible as paused state. The optional wheel readout is separate from authoritative settlement.

**Practice provenance:** [`src/practice-rounds.json`](src/practice-rounds.json) contains actual certified rounds **335–358**, captured at safe block **12075934** on 6 November 2026. It includes 7,231 accepted work units, zero-work rounds, source URLs and exact checkpoint hashes. `scripts/capture-practice.mjs` can recapture this interval from the live deployment; this is a maintenance operation, not part of the build. These records are never a fallback for live play.

## Hosting the shared service

Use one long-running Node 24 process, a persistent local disk and an HTTPS reverse proxy. The backend has no runtime npm dependency beyond Node. It serves `dist/` and the following JSON endpoints:

| Endpoint          | Method | Purpose                                                                                |
| ----------------- | ------ | -------------------------------------------------------------------------------------- |
| `/api/state`      | GET    | Colony, caller's identity/assignment, assignment counts, availability and server time. |
| `/api/join`       | POST   | Join with `{ "name": "Hazel" }`; returns a private bearer session.                     |
| `/api/assignment` | POST   | Commit exactly `{ "action": "forage", "roundId": <current round> }`.                   |
| `/api/refresh`    | POST   | Request an immediate source refresh; rate limited.                                     |
| `/api/season`     | POST   | Authenticated player begins a new season only after the previous one ends.             |

Settings are ordinary process environment variables; no secret keys are needed:

| Variable              | Default   | Purpose                                                                                                 |
| --------------------- | --------- | ------------------------------------------------------------------------------------------------------- |
| `PORT`                | `8787`    | HTTP listening port behind your HTTPS proxy.                                                            |
| `SQUEEKBURROW_DATA`   | `runtime` | Durable directory for SQLite, WAL and shared-memory files. Keep it private and back it up consistently. |
| `SQUEEKBURROW_ORIGIN` | unset     | Allowlisted static website origin for cross-origin API use. Same-origin requests work without it.       |

Serving the frontend from the same process needs no configuration edits. To host the static export separately, set `serviceUrl` in **`public/config.json`** to your real HTTPS service origin and rebuild; set `SQUEEKBURROW_ORIGIN` to the frontend's exact origin on the service. The shipped value is `null`, which explicitly disables automatic service discovery on a static host. Players may also connect a trusted origin through **Burrow settings**. Browser sessions are stored separately for each service origin. The service URL is public configuration, not a credential. Do not expose the SQLite directory through your web server.

### Integrity and privacy

- Live resources, stamina, contribution, assignments and `lastProcessedRound` live in SQLite. The browser cannot submit resource totals, seeds, round facts or settlement requests.
- Each player has a cryptographically random 256-bit bearer token. Only its SHA-256 hash is persisted by the server. Names and contributions are public to the colony; tokens are not.
- Assignment uniqueness is enforced by `(season, roundId, playerId)`. Settlement inserts a unique `(season, roundId)` row and updates the colony in the same `BEGIN IMMEDIATE` transaction. The pure reducer independently rejects duplicates, gaps and ended seasons.
- Unconfirmed earlier choices reserve worst-case stamina, including Explore risks, so later assignments cannot make settlement impossible.
- The browser saves its opaque session in local storage. Clearing it loses access; there is no account recovery. Treat trusted service selection and device access accordingly.
- Practice stores decisions and rebuilds state by replay. Injected resource totals are ignored, but a device owner can edit their own practice decisions. Practice has no shared rankings.
- This is a cooperative, no-stakes game: rate limits and a 64-player colony cap do not provide personhood or Sybil resistance. Server operators and upstream providers remain trusted. Keep the host clock synchronized. Do not use multiple replicas with separate databases for one colony.

No tokens, wallet connections, custody, approvals, transactions, transfers, wagering, financial rewards or paid mechanics are present.

## Validation and project map

Run the deterministic unit/integration suite with `npm test`. For production-browser checks:

```sh
npx playwright install chromium
npm run build
npm run test:browser
```

`CHROMIUM_EXECUTABLE_PATH` may point to an already installed Chromium. The bounded browser script owns and closes its preview and browser. It validates the actual export at `/preview/`, all four actions, save/reload, keyboard dialogs, leaderboard/journal, a complete winning season, recap export, unavailable service behavior and automated accessibility checks. A network-dependent real-service check is available as `node scripts/smoke-live.mjs`; add `--browser` to also exercise two independent browsers against the actual production service. It does not wait for a live ten-minute round to end.

Actual commands, results, design review, screenshots and limitations are recorded in [`artifacts/validation.md`](artifacts/validation.md). [`DESIGN.md`](DESIGN.md) documents the implemented visual system. Automated results are worker observations, not independent certification.

**Observed results:** production build and strict typecheck passed; **31 automated tests**, **16 browser interaction checks**, **10 real-service checks**, and **16/16 design-probe checks** passed. Axe found zero violations in the checked mobile/desktop played screens. The browser sandbox canceled native file saving; the recap's real download event and complete JSON payload were verified separately. Public shared-backend hosting, physical-device/screen-reader testing and a timed full live season remain unverified.

| Location         | Responsibility                                                                                |
| ---------------- | --------------------------------------------------------------------------------------------- |
| `src/`           | React interface, original burrow illustration, practice replay and CSS.                       |
| `shared/game.ts` | Pure deterministic survival rules.                                                            |
| `shared/live.ts` | Official API validation, schedule, binding and ABI codec.                                     |
| `server/`        | Verified chain reads, shared service, SQLite and HTTP boundary.                               |
| `tests/`         | Determinism, action effects, hazards, win/loss, duplicate protection, durability and outages. |
| `public/`        | Fonts and licenses, favicon, share card and public service configuration.                     |
| `dist/`          | Complete production static export for IMD.                                                    |
| `scripts/`       | Build/typecheck/browser helpers and optional live verification.                               |

Original source and illustrations are MIT licensed. Font and design-guidance notices are listed in [`THIRD_PARTY.md`](THIRD_PARTY.md).
