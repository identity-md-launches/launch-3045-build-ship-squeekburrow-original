import { dependency, dependencyPath, root } from "./deps.mjs";
import { mkdir, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";

const command = process.argv[2];
if (command === "typecheck") {
  const scratch = join(root, "test/scratch");
  await mkdir(scratch, { recursive: true });
  const reactTypes = dirname(dependencyPath("@types/react/package.json"));
  const domTypes = dirname(dependencyPath("@types/react-dom/package.json"));
  const config = join(scratch, "typecheck.json");
  await writeFile(
    config,
    JSON.stringify({
      extends: "../../tsconfig.json",
      compilerOptions: {
        typeRoots: [dirname(reactTypes)],
        paths: {
          react: [join(reactTypes, "index.d.ts")],
          "react/*": [join(reactTypes, "*")],
          "react-dom/*": [join(domTypes, "*")],
        },
      },
    }),
  );
  const compiler = join(
    dirname(dependencyPath("typescript/package.json")),
    "bin/tsc",
  );
  process.exit(
    spawnSync(process.execPath, [compiler, "--project", config], {
      stdio: "inherit",
      cwd: root,
    }).status ?? 1,
  );
} else {
  const vite = await dependency("vite");
  if (command === "build") await vite.build();
  else if (command === "dev") {
    const server = await vite.createServer({ server: { host: "0.0.0.0" } });
    await server.listen();
    server.printUrls();
  } else if (command === "preview") {
    const server = await vite.preview({
      preview: { host: "0.0.0.0", port: 4173 },
    });
    server.printUrls();
  } else throw new Error("Unknown tool command");
}
