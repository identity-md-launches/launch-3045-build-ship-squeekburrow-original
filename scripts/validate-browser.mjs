import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { startPreview } from "./browser.mjs";
import { dependency } from "./deps.mjs";
import { replayPractice } from "../src/practice.ts";

const output = "test/scratch/browser-validation";
await mkdir(output, { recursive: true });
const preview = await startPreview();
const report = {
  viewports: [],
  checks: [],
  consoleErrors: [],
  externalFailures: [],
  accessibility: [],
  limitations: [],
};
const record = (name, extra = {}) => {
  report.checks.push({ name, passed: true, ...extra });
  console.log("PASS", name);
};
let page;
try {
  const context = await preview.browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: "reduce",
    acceptDownloads: true,
  });
  page = await context.newPage();
  page.on("pageerror", (e) => report.consoleErrors.push(e.message));
  page.on("requestfailed", (req) => {
    if (!req.url().startsWith(preview.url))
      report.externalFailures.push(req.url());
  });
  await page.goto(preview.url);
  await page.locator(".assignment-commit").waitFor();
  await page.evaluate(() => document.fonts.ready);
  for (const width of [320, 390, 768, 1100, 1440]) {
    await page.setViewportSize({ width, height: width < 600 ? 844 : 1000 });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
      `overflow at ${width}`,
    );
    report.viewports.push(width);
    await page.screenshot({
      path: `${output}/${width}.jpg`,
      type: "jpeg",
      quality: 85,
      fullPage: true,
    });
    if (width === 390) {
      const box = await page.locator(".assignment-commit").boundingBox();
      assert.ok(
        box.y + box.height <= 844,
        `main action bottom ${box.y + box.height}`,
      );
      record("Main action is fully on the first 390 × 844 screen", {
        actionBottom: box.y + box.height,
      });
    }
  }
  record(
    "Production export loads at a subpath, with no horizontal overflow at five widths",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByRole("button", { name: "Burrow settings", exact: true })
    .last()
    .click();
  await page.getByRole("dialog").waitFor();
  assert.equal(
    await page.getByLabel("Service URL", { exact: true }).isVisible(),
    true,
  );
  await page.keyboard.press("Escape");
  record("Burrow settings remains reachable on mobile");
  await page.locator('input[value="forage"]').focus();
  await page.keyboard.press("ArrowRight");
  assert.equal(await page.locator('input[value="fortify"]').isChecked(), true);
  await page.screenshot({
    path: `${output}/keyboard-focus.jpg`,
    type: "jpeg",
    quality: 85,
    fullPage: true,
  });
  await page.keyboard.press("ArrowLeft");
  assert.equal(await page.locator('input[value="forage"]').isChecked(), true);
  record(
    "Native radio assignments support keyboard arrows and a visible focus perimeter",
  );
  await page
    .getByRole("button", { name: "Forage for the colony", exact: true })
    .click();
  await page.getByRole("dialog").waitFor();
  await page
    .getByRole("button", { name: "Join & forage", exact: true })
    .click();
  assert.equal(
    await page.locator("#nickname").getAttribute("aria-invalid"),
    "true",
  );
  assert.equal(
    await page
      .locator("#nickname")
      .evaluate((el) => document.activeElement === el),
    true,
  );
  await page.getByLabel("Your burrowmate name").fill("Hazel");
  await page
    .getByRole("button", { name: "Join & forage", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Resolve practice round", exact: true })
    .waitFor();
  assert.equal(
    await page
      .locator('input[name="assignment"]')
      .evaluateAll((inputs) =>
        inputs.every((input) => input.matches(":disabled")),
      ),
    true,
  );
  record(
    "Onboarding validates an empty name, focuses its error, and locks exactly one assignment",
  );
  await page
    .getByRole("button", { name: "Resolve practice round", exact: true })
    .click();
  let log = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("squeekburrow.practice.v1")),
  );
  assert.equal(log.actions.length, 1);
  const expected = replayPractice(log);
  assert.equal(
    await page.locator(".resource-food .resource-value").innerText(),
    String(expected.resources.food),
  );
  await page.reload();
  await page.locator(".assignment-commit").waitFor();
  assert.equal(
    await page.locator(".season-progress strong").textContent(),
    "2",
  );
  record(
    "A recorded round applies the deterministic result and survives a full reload",
  );
  for (const action of ["fortify", "explore", "rest"]) {
    await page.locator(`input[value="${action}"]`).check();
    await page.locator(".assignment-commit").click();
    await page
      .getByRole("button", { name: "Resolve practice round", exact: true })
      .click();
  }
  log = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("squeekburrow.practice.v1")),
  );
  assert.deepEqual(log.actions, ["forage", "fortify", "explore", "rest"]);
  record(
    "Forage, Fortify, Explore and Rest all commit and resolve through real controls",
  );

  await page
    .getByRole("link", { name: "Field journal", exact: true })
    .first()
    .click();
  await page.locator(".journal-main").waitFor();
  assert.equal(await page.locator(".resolution").count(), 4);
  await page.locator(".resolution summary").first().click();
  assert.equal(
    await page.locator(".resolution details").first().getAttribute("open"),
    "",
  );
  assert.match(
    await page.locator(".source-note").first().innerText(),
    /Certified work/,
  );
  record(
    "Journal navigation reveals all four results, exact source data and expandable consequences",
  );
  await page.getByRole("link", { name: "Burrowmates", exact: true }).click();
  await page.locator(".colony-board").waitFor();
  assert.match(await page.locator(".colony-board").innerText(), /Hazel/);
  assert.match(
    await page.locator(".colony-board").innerText(),
    /Practice helper/,
  );
  record(
    "Leaderboard names the player and explicitly identifies computer helpers",
  );
  await page.getByRole("link", { name: "The burrow", exact: true }).click();
  await page.locator(".assignment-commit").waitFor();
  const help = page
    .getByRole("button", { name: "How to play", exact: true })
    .first();
  await help.focus();
  await page.keyboard.press("Enter");
  await page.getByRole("dialog").waitFor();
  assert.equal(
    await page.evaluate(() =>
      document.querySelector("dialog").contains(document.activeElement),
    ),
    true,
  );
  await page.keyboard.press("Escape");
  await page.getByRole("dialog").waitFor({ state: "detached" });
  assert.equal(
    await help.evaluate((el) => document.activeElement === el),
    true,
  );
  record("Keyboard opens the field guide; Escape closes it and restores focus");

  const axeModule = await dependency("@axe-core/playwright");
  const AxeBuilder =
    axeModule.default?.default ?? axeModule.default ?? axeModule.AxeBuilder;
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    const audit = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    report.accessibility.push({
      width,
      violations: audit.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        nodes: v.nodes.map((n) => n.target),
      })),
    });
    assert.equal(
      audit.violations.length,
      0,
      JSON.stringify(
        audit.violations.map((v) => ({
          id: v.id,
          nodes: v.nodes.map((n) => n.target),
        })),
      ),
    );
  }
  record(
    "Axe reports no WCAG A/AA violations on the played burrow at 390 and 1440",
  );

  // Finish a whole season using the UI. The policy reads only the persisted action log,
  // reconstructing resources through the shipped reducer instead of injecting state.
  for (let i = 0; i < 24; i++) {
    log = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("squeekburrow.practice.v1")),
    );
    const state = replayPractice(log);
    if (state.status !== "surviving") break;
    const p = state.players[0],
      r = state.resources;
    if (p.stamina < 22)
      assert.match(
        await page.locator(".commit-note").innerText(),
        /Choose Rest/,
      );
    let action =
      p.stamina < 28
        ? "rest"
        : r.food < 45
          ? "forage"
          : r.shelter < 65
            ? "fortify"
            : r.timber < 14
              ? "explore"
              : "forage";
    await page.locator(`input[value="${action}"]`).check();
    await page.locator(".assignment-commit").click();
    await page
      .getByRole("button", { name: "Resolve practice round", exact: true })
      .click();
  }
  log = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("squeekburrow.practice.v1")),
  );
  assert.equal(replayPractice(log).status, "won");
  await page
    .getByRole("heading", { name: "We made it through.", exact: true })
    .waitFor();
  const downloadEvent = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Save season recap", exact: true })
    .click();
  const download = await downloadEvent;
  assert.match(
    download.suggestedFilename(),
    /^squeekburrow-practice-season-1.json$/,
  );
  const recap = await page.evaluate(
    async (url) => (await fetch(url)).json(),
    download.url(),
  );
  assert.equal(recap.product, "SqueekBurrow");
  assert.equal(recap.mode, "practice");
  assert.deepEqual(recap.colony, replayPractice(log));
  await writeFile(
    `${output}/recap.json`,
    JSON.stringify(recap, null, 2) + "\n",
  );
  const nativeDownloadError = await download.failure();
  if (nativeDownloadError) {
    report.limitations.push(
      `Native browser file saving was unavailable: ${nativeDownloadError}. The real download event, filename and complete Blob payload were validated; the browser's filesystem save is not claimed.`,
    );
    console.log("LIMITATION Native browser save:", nativeDownloadError);
  } else {
    await download.saveAs(`${output}/recap-native.json`);
    record("The browser saves the season recap file");
  }
  record(
    "All 24 rounds are playable, victory is shown, and the recap payload matches the complete colony",
  );
  await page.screenshot({
    path: `${output}/season-win.jpg`,
    type: "jpeg",
    quality: 85,
    fullPage: true,
  });

  await page
    .getByRole("button", { name: "Start a new season", exact: true })
    .click();
  for (let i = 0; i < 24; i++) {
    log = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("squeekburrow.practice.v1")),
    );
    if (replayPractice(log).status !== "surviving") break;
    await page.locator('input[value="rest"]').check();
    await page.locator(".assignment-commit").click();
    await page
      .getByRole("button", { name: "Resolve practice round", exact: true })
      .click();
  }
  log = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("squeekburrow.practice.v1")),
  );
  assert.equal(replayPractice(log).status, "lost");
  await page
    .getByRole("heading", { name: "Every burrow has a story.", exact: true })
    .waitFor();
  assert.match(
    await page.locator(".season-result").innerText(),
    /pantry ran out of food/,
  );
  await page.screenshot({
    path: `${output}/season-loss.jpg`,
    type: "jpeg",
    quality: 85,
    fullPage: true,
  });
  record(
    "A fresh season with neglected supplies loses and explains its survival failure",
  );

  await page.getByRole("button", { name: "Live colony", exact: true }).click();
  await page
    .getByRole("heading", {
      name: "The shared burrow is resting.",
      exact: true,
    })
    .waitFor();
  assert.equal(await page.locator(".resource").count(), 0);
  assert.equal(
    await page
      .getByRole("button", { name: "Play a practice season", exact: true })
      .isEnabled(),
    true,
  );
  record(
    "An unconfigured live service shows a visible recovery action and no fabricated colony state",
  );
  await page
    .getByRole("button", { name: "Connect colony service", exact: true })
    .click();
  await page
    .getByLabel("Service URL", { exact: true })
    .fill("http://untrusted.example");
  await page
    .getByRole("button", { name: "Connect colony service", exact: true })
    .last()
    .click();
  assert.match(await page.locator("#service-error").innerText(), /HTTPS/);
  await page.keyboard.press("Escape");
  record("Service settings reject insecure remote origins");
  assert.equal(report.consoleErrors.length, 0, report.consoleErrors.join("\n"));
  record("No uncaught browser exceptions during the complete interaction flow");
  report.limitations.push(
    "Chromium automation and emulated viewports do not establish screen-reader, physical-device, native 200% zoom, or WebKit behavior.",
    "Practice tests use the shipped recorded rounds. They do not claim a deployed shared live service.",
    "Official API network availability is independent; blocked external requests are reported separately.",
  );
} catch (error) {
  report.failure = error.stack ?? String(error);
  if (page)
    await page
      .screenshot({
        path: `${output}/failure.jpg`,
        type: "jpeg",
        quality: 85,
        fullPage: true,
      })
      .catch(() => {});
  throw error;
} finally {
  await writeFile(
    `${output}/results.json`,
    JSON.stringify(report, null, 2) + "\n",
  );
  await preview.close();
}
