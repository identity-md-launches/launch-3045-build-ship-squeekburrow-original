import { dependencyPath } from "./scripts/deps.mjs";

export default {
  base: "./",
  resolve: {
    alias: [
      { find: /^react$/, replacement: dependencyPath("react") },
      {
        find: /^react\/jsx-runtime$/,
        replacement: dependencyPath("react/jsx-runtime"),
      },
      {
        find: /^react\/jsx-dev-runtime$/,
        replacement: dependencyPath("react/jsx-dev-runtime"),
      },
      {
        find: /^react-dom\/client$/,
        replacement: dependencyPath("react-dom/client"),
      },
    ],
  },
  esbuild: { jsx: "automatic" },
  build: { target: "es2022", sourcemap: false },
  server: { proxy: { "/api": "http://127.0.0.1:8787" } },
};
