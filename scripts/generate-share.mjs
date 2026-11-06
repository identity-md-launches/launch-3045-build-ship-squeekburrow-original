import { startPreview } from "./browser.mjs";

const preview = await startPreview();
try {
  const page = await preview.browser.newPage({
    viewport: { width: 1200, height: 630 },
    reducedMotion: "reduce",
  });
  await page.goto(preview.url);
  await page.locator(".burrow-art").waitFor();
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => {
    const art = document.querySelector(".burrow-art").outerHTML;
    document.body.innerHTML = `<div style="width:1200px;height:630px;background:#f5f3e9;display:flex;align-items:center;position:relative;overflow:hidden;padding:64px;gap:32px"><div style="z-index:1;width:460px;flex-shrink:0"><div class="brand" style="font-size:32px"><img src="./favicon.svg" width="56" height="56" alt="">SqueekBurrow</div><div style="font-family:Fraunces,Georgia,serif;font-size:72px;font-weight:600;line-height:1.08;letter-spacing:-3px;margin-top:42px">Small paws.<br>Shared survival.</div><p style="font-size:24px;line-height:1.5;color:#697060;margin-top:24px;max-width:400px">One hamster colony.<br>24 rounds to make it home.</p></div><div style="position:absolute;width:850px;left:525px;top:80px;transform:rotate(-3deg);border-radius:44px;overflow:hidden;background:#e4e7ce">${art}</div><div style="position:absolute;left:64px;bottom:36px;color:#697060;font-size:16px">Forage · Fortify · Explore · Rest</div></div>`;
  });
  await page.screenshot({ path: "public/share.png", type: "png" });
  console.log(
    "Generated public/share.png (1200 × 630) from the original burrow artwork and local fonts.",
  );
} finally {
  await preview.close();
}
