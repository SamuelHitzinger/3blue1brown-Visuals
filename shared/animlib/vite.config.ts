import { defineConfig, searchForWorkspaceRoot } from "vite";
import { fileURLToPath } from "node:url";

export default defineConfig({
  root: "demo",
  // QuickJS's WASM lives in the workspace's hoisted node_modules directory.
  server: { fs: { allow: [searchForWorkspaceRoot(fileURLToPath(new URL(".", import.meta.url)))] }, proxy: { "/api": process.env.NARRATION_API_TARGET ?? "http://127.0.0.1:8080" } },
  build: { outDir: "../dist/demo", emptyOutDir: false, rollupOptions: { input: {
    main: fileURLToPath(new URL('./demo/index.html', import.meta.url)),
    behaviors: fileURLToPath(new URL('./demo/behaviors.html', import.meta.url)),
    quality: fileURLToPath(new URL('./demo/quality.html', import.meta.url)),
    plant: fileURLToPath(new URL('./demo/plant.html', import.meta.url)),
    lighting: fileURLToPath(new URL('./demo/lighting.html', import.meta.url)),

    explanatory: fileURLToPath(new URL('./demo/explanatory.html', import.meta.url)),
    models: fileURLToPath(new URL('./demo/model-viewer.html', import.meta.url)),
    spatial: fileURLToPath(new URL('./demo/spatial.html', import.meta.url)),
    molecules: fileURLToPath(new URL('./demo/molecules.html', import.meta.url)),
    molecularComparison: fileURLToPath(new URL('./demo/molecular-comparison.html', import.meta.url)),
    dnaSmoothComparison: fileURLToPath(new URL('./demo/dna-smooth-comparison.html', import.meta.url)),
    proofs: fileURLToPath(new URL('./demo/proofs.html', import.meta.url)),
    dnaProtein: fileURLToPath(new URL('./demo/dna-protein.html', import.meta.url)),
    showcases: fileURLToPath(new URL('./demo/showcases.html', import.meta.url)),
  } } },
});
