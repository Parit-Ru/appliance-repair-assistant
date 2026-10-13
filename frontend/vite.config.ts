import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  // GitHub Pages ให้เว็บอยู่ใต้ /<ชื่อ repo>/ ไม่ใช่ราก จึงต้องใส่คำนำหน้านี้ให้ path ของ JS/CSS
  // ใช้ mode (ไม่ใช่ command) เพื่อให้ npm run preview ได้คำนำหน้าเดียวกับ build · npm run dev ใช้ '/' ตามปกติ
  // (ถ้าเปลี่ยนชื่อ repo หรือใช้โดเมนของตัวเอง ต้องแก้บรรทัดนี้)
  base: mode === 'production' ? '/appliance-repair-assistant/' : '/',
}))
