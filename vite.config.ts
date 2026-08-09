import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // ExcelJS 的浏览器包较大，但仅在 Excel 操作时懒加载，并作为稳定 vendor 长期缓存。
    chunkSizeWarningLimit: 950,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/node_modules/exceljs/')) return 'exceljs-vendor'
        },
      },
    },
  },
})
