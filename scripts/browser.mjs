import { createServer } from "node:http";
import { mkdir, readFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { dependency } from "./deps.mjs";

export async function startPreview() {
  const root = resolve("dist");
  const server = createServer(async (req, res) => {
    const path = new URL(req.url, "http://localhost").pathname;
    if (!path.startsWith("/preview/")) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    const suffix = decodeURIComponent(path.slice("/preview".length));
    const file = resolve(
      root,
      "." + (suffix.endsWith("/") ? suffix + "index.html" : suffix),
    );
    if (!file.startsWith(root + sep)) {
      res.writeHead(403);
      res.end();
      return;
    }
    const finalPath = file;
    try {
      const data = await readFile(finalPath);
      res.writeHead(200, {
        "Content-Type":
          {
            ".html": "text/html",
            ".js": "text/javascript",
            ".css": "text/css",
            ".svg": "image/svg+xml",
            ".json": "application/json",
            ".png": "image/png",
            ".woff2": "font/woff2",
          }[extname(finalPath)] || "application/octet-stream",
      });
      res.end(data);
    } catch {
      res.writeHead(404);
      res.end("Not found");
    }
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const playwright = await dependency("playwright");
  const { chromium } = playwright.default ?? playwright;
  const downloadsPath = resolve("test/scratch/browser-downloads");
  await mkdir(downloadsPath, { recursive: true });
  let browser;
  try {
    browser = await chromium.launch({
      headless: true,
      downloadsPath,
      ...(process.env.CHROMIUM_EXECUTABLE_PATH
        ? { executablePath: process.env.CHROMIUM_EXECUTABLE_PATH }
        : {}),
    });
  } catch (error) {
    await new Promise((r) => server.close(r));
    throw error;
  }
  return {
    browser,
    url: `http://127.0.0.1:${server.address().port}/preview/`,
    close: async () => {
      await browser.close();
      await new Promise((r) => server.close(r));
    },
  };
}
