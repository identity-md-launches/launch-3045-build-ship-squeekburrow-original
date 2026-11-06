import assert from "node:assert/strict";
import { resolve } from "node:path";
import { dependency } from "./deps.mjs";

/** Exercise the unmodified production UI against the actual local live service. */
export async function validateLiveBrowsers(base, output, check, report) {
  const playwright = await dependency("playwright");
  const { chromium } = playwright.default ?? playwright;
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.CHROMIUM_EXECUTABLE_PATH }
      : {}),
  });
  try {
    const pages = [];
    const errors = [];
    for (const [name, width] of [
      ["Browser Hazel", 1440],
      ["Browser Pip", 390],
    ]) {
      const context = await browser.newContext({
        viewport: { width, height: 900 },
        reducedMotion: "reduce",
      });
      const page = await context.newPage();
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(base);
      await page
        .getByRole("button", { name: "Join the colony", exact: true })
        .waitFor();
      assert.equal(
        await page
          .getByRole("button", { name: "Live colony", exact: true })
          .getAttribute("aria-pressed"),
        "true",
      );
      await page
        .getByRole("button", { name: "Join the colony", exact: true })
        .click();
      await page.getByLabel("Your burrowmate name").fill(name);
      await page
        .getByRole("button", { name: "Join the shared colony", exact: true })
        .click();
      await page.getByRole("dialog").waitFor({ state: "detached" });
      await page.locator(".your-paws h2").filter({ hasText: name }).waitFor();
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        true,
      );
      assert.equal(
        await page.locator(".wheel-status").innerText(),
        "Squeekchain wheel connected",
      );
      pages.push(page);
    }
    check(
      "Two independent production browsers discover live play, join the same colony, and retain distinct identities",
    );
    const first = pages[0],
      second = pages[1];
    const state = await (await fetch(base + "/api/state")).json();
    if (
      Date.now() + 3000 < state.live.cutoffAt &&
      state.live.currentRound >= state.colony.startRound
    ) {
      await first.locator('input[value="fortify"]').check();
      await first
        .getByRole("button", { name: "Fortify the burrow", exact: true })
        .click();
      await first
        .getByRole("button", { name: "Fortify locked in", exact: true })
        .waitFor();
      await second.reload();
      await second.locator(".assignment-options").waitFor();
      assert.equal(
        await second
          .locator(".assignment-option.fortify .option-count")
          .innerText(),
        "1",
      );
      assert.equal(
        await second.locator(".resource-food .resource-value").innerText(),
        "72",
      );
      await first.reload();
      await first
        .getByRole("button", { name: "Fortify locked in", exact: true })
        .waitFor();
      assert.equal(
        await first
          .locator('input[name="assignment"]')
          .evaluateAll((inputs) =>
            inputs.every((input) => input.matches(":disabled")),
          ),
        true,
      );
      check(
        "An actual live choice locks through reload and its assignment count appears in the other browser",
      );
    } else
      report.limitations.push(
        "Live browser assignment was skipped because the actual cutoff had passed; no timer wait or invented round was used.",
      );
    for (let i = 0; i < pages.length; i++)
      await pages[i].screenshot({
        path: resolve(output, `live-${i === 0 ? "desktop" : "mobile"}.jpg`),
        type: "jpeg",
        quality: 85,
        fullPage: true,
      });
    await second
      .getByRole("button", { name: "Live colony", exact: true })
      .click();
    await second.route("**/api/state", (route) =>
      route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "Live service temporarily unavailable" }),
      }),
    );
    await second.reload();
    await second
      .getByRole("heading", {
        name: "The shared burrow is resting.",
        exact: true,
      })
      .waitFor();
    assert.equal(await second.locator(".resource").count(), 0);
    await second.unroute("**/api/state");
    await second
      .getByRole("button", { name: "Retry connection", exact: true })
      .click();
    await second
      .locator(".your-paws h2")
      .filter({ hasText: "Browser Pip" })
      .waitFor();
    check(
      "A browser receives a visible service failure, then recovers the same live player and shared state",
    );
    assert.deepEqual(errors, []);
    check(
      "Live multiplayer browser interactions produce no uncaught exceptions",
    );
  } finally {
    await browser.close();
  }
}
