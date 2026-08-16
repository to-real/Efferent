import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

// file:// 加载：相对基座；产物出 dist/（electron-builder 打包包含）
export default defineConfig({
  plugins: [react()],
  base: "./",
  build: { outDir: "dist", emptyOutDir: true },
})
