import { createServer } from "node:http";
import { mkdir, readFile } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { Store } from "./store.mjs";
import { Service } from "./service.mjs";

const port = Number(process.env.PORT || 8787);
const dataDirectory = resolve(process.env.SQUEEKBURROW_DATA || "runtime");
await mkdir(dataDirectory, { recursive: true });
const store = new Store(resolve(dataDirectory, "colony.sqlite"));
const service = new Service(store);
const publicOrigin = process.env.SQUEEKBURROW_ORIGIN;
const limits = new Map();
const types = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
  ".txt": "text/plain",
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  const isApi = url.pathname.startsWith("/api/");
  const origin = req.headers.origin;
  const sameOrigin =
    origin &&
    (() => {
      try {
        return new URL(origin).host === req.headers.host;
      } catch {
        return false;
      }
    })();
  if (origin && (origin === publicOrigin || sameOrigin))
    res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary", "Origin");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  if (req.method === "OPTIONS") {
    res.writeHead(origin === publicOrigin || sameOrigin ? 204 : 403, {
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    });
    res.end();
    return;
  }
  const json = (status, body) => {
    res.writeHead(status, {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    });
    res.end(JSON.stringify(body));
  };
  try {
    if (isApi) {
      if (origin && origin !== publicOrigin && !sameOrigin)
        return json(403, {
          error: "This site is not allowed to use the colony service.",
        });
      const token = req.headers.authorization?.startsWith("Bearer ")
        ? req.headers.authorization.slice(7)
        : null;
      if (req.method === "GET" && url.pathname === "/api/state") {
        json(200, service.view(token));
        return;
      }
      if (req.method !== "POST") {
        json(404, { error: "Unknown colony endpoint." });
        return;
      }
      const key = req.socket.remoteAddress + ":" + url.pathname,
        now = Date.now();
      const recent = (limits.get(key) ?? []).filter((t) => now - t < 60000);
      if (recent.length >= (url.pathname === "/api/join" ? 8 : 30))
        return json(429, {
          error: "Too many requests. Try again in a minute.",
        });
      limits.set(key, [...recent, now]);
      if (!req.headers["content-type"]?.startsWith("application/json"))
        return json(415, { error: "Send JSON to the colony service." });
      let raw = "";
      for await (const chunk of req) {
        raw += chunk;
        if (raw.length > 2048)
          return json(413, { error: "Request is too large." });
      }
      let body;
      try {
        body = JSON.parse(raw);
      } catch {
        return json(400, { error: "Invalid JSON." });
      }
      if (!body || Array.isArray(body) || typeof body !== "object")
        return json(400, { error: "Expected a JSON object." });
      if (url.pathname === "/api/refresh") {
        await service.refresh();
        json(service.available() ? 200 : 503, service.view(token));
      } else if (url.pathname === "/api/join")
        json(200, service.join(body.name, token));
      else if (url.pathname === "/api/assignment")
        json(200, service.assign(token, body));
      else if (url.pathname === "/api/season") {
        service.requireLive();
        service.auth(token);
        store.transaction(() =>
          store.nextSeason(
            service.live.currentRound +
              (Date.now() >= service.live.cutoffAt ? 1 : 0),
          ),
        );
        json(200, service.view(token));
      } else json(404, { error: "Unknown colony endpoint." });
      return;
    }
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.writeHead(405);
      res.end();
      return;
    }
    if (url.pathname === "/config.json") {
      json(200, { serviceUrl: "" });
      return;
    }
    const root = resolve("dist"),
      path = resolve(
        root,
        "." +
          decodeURIComponent(
            url.pathname === "/" ? "/index.html" : url.pathname,
          ),
      );
    if (!path.startsWith(root + sep)) {
      res.writeHead(403);
      res.end();
      return;
    }
    const data = await readFile(path);
    res.writeHead(200, {
      "Content-Type": types[extname(path)] || "application/octet-stream",
    });
    res.end(req.method === "HEAD" ? undefined : data);
  } catch (error) {
    if (isApi)
      json(error.status ?? 500, {
        error: error.status
          ? error.message
          : "The colony service could not finish that request. Progress is safe; retry shortly.",
      });
    else {
      res.writeHead(404);
      res.end("Not found");
    }
  }
});
await service.refresh();
const interval = setInterval(() => {
  void service.refresh();
  for (const [key, times] of limits)
    if (Date.now() - times.at(-1) > 60000) limits.delete(key);
}, 15000);
server.listen(port, "0.0.0.0", () =>
  console.log(
    `SqueekBurrow listening on ${port}. Live source: ${service.available() ? "connected" : service.error}`,
  ),
);
function stop() {
  clearInterval(interval);
  server.close(() => {
    store.close();
    process.exit(0);
  });
}
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
