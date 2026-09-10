import { spawn } from "child_process"
import { watch } from "fs"
import server from "./server.ts"

console.log("Starting development environment...")

// 1. Run Tailwind watcher
const tailwind = spawn("bunx", ["tailwindcss", "-i", "./src/globals.css", "-o", "./public/styles.css", "--watch"], {
  stdio: "inherit",
})

// 2. Build React
const buildUI = async () => {
  try {
    const result = await Bun.build({
      entrypoints: ["./src/index.tsx"],
      outdir: "./public",
      target: "browser",
      sourcemap: "linked",
      minify: false,
    })
    if (result.success) {
      console.log("React UI Built successfully")
    } else {
      console.error("React UI Build Failed", result.logs)
    }
  } catch(e) {
    console.error(e)
  }
}

// Initial build
buildUI()

// Watch for src changes
watch("./src", { recursive: true }, (event, filename) => {
  if (filename && (filename.endsWith(".ts") || filename.endsWith(".tsx"))) {
    console.log(`[${event}] ${filename} changed, rebuilding React...`)
    buildUI()
  }
})

// 3. Export the Hono server so Bun runs it
export default server
