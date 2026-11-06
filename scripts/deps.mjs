import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

// A scratch toolchain lets constrained builders install without modifying node_modules/.
const normal = createRequire(new URL("../package.json", import.meta.url));
const scratch = createRequire(
  new URL("../test/scratch/toolchain/package.json", import.meta.url),
);
export function dependencyPath(name) {
  try {
    return normal.resolve(name);
  } catch {
    return scratch.resolve(name);
  }
}
export function dependency(name) {
  return import(pathToFileURL(dependencyPath(name)).href);
}
export const root = resolve(new URL("..", import.meta.url).pathname);
