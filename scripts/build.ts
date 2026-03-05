#!/usr/bin/env bun

import { $ } from "bun"
import { rmSync, existsSync } from "fs"
import { join } from "path"

const distDir = join(import.meta.dir, "..", "dist")

// Clean dist directory
if (existsSync(distDir)) {
  console.log("🧹 Cleaning dist directory...")
  rmSync(distDir, { recursive: true, force: true })
}

console.log("📦 Building CLI...")

// Build with Bun
const result = await Bun.build({
  entrypoints: ["./src/cli.ts"],
  outdir: "./dist",
  target: "node",
  format: "esm",
  minify: false, // Keep readable for debugging
  sourcemap: "none", // Don't generate sourcemap
  splitting: false, // Bundle everything into one file
  external: [
    // External dependencies that should not be bundled
    "simple-git",
    "@clack/prompts",
    "picocolors",
    "jsonc-parser",
  ],
})

if (!result.success) {
  console.error("❌ Build failed:")
  for (const log of result.logs) {
    console.error(log)
  }
  process.exit(1)
}

console.log("✅ Build completed successfully!")
console.log(`📁 Output: ${distDir}`)

// Show output files
for (const output of result.outputs) {
  const size = (output.size / 1024).toFixed(2)
  console.log(`   - ${output.path} (${size} KB)`)
}
