import react from '@vitejs/plugin-react'
import { copyFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import type { Plugin } from 'vite'

// https://vite.dev/config/
// GitHub Pages ไม่มี rewrite: เปิด /<repo>/symptoms ตรง ๆ หรือกด refresh จะหาไฟล์ไม่เจอแล้วแสดง 404.html
// จึงทำสำเนา index.html เป็น 404.html ให้แอปโหลดขึ้นมาแล้ว router อ่าน path เอง
const spaFallback404 = (): Plugin => ({
  name: 'spa-fallback-404',
  apply: 'build',
  closeBundle() {
    const dist = resolve(import.meta.dirname, 'dist')
    copyFileSync(resolve(dist, 'index.html'), resolve(dist, '404.html'))
  },
})

export default defineConfig(({ mode }) => ({
  plugins: [react(), spaFallback404()],
  // GitHub Pages ให้เว็บอยู่ใต้ /<ชื่อ repo>/ ไม่ใช่ราก จึงต้องใส่คำนำหน้านี้ให้ path ของ JS/CSS
  // ใช้ mode (ไม่ใช่ command) เพื่อให้ npm run preview ได้คำนำหน้าเดียวกับ build · npm run dev ใช้ '/' ตามปกติ
  // (ถ้าเปลี่ยนชื่อ repo หรือใช้โดเมนของตัวเอง ต้องแก้บรรทัดนี้)
  base: mode === 'production' ? '/appliance-repair-assistant/' : '/',
}))
