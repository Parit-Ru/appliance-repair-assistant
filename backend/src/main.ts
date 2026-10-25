/**
 * main.ts — จุดเริ่มของ backend: โหลด .env → ประกอบแอป (app.ts) → เปิดรับคำขอที่ PORT
 */
import 'dotenv/config';

import { createApp } from './app';

async function bootstrap(): Promise<void> {
  const app = await createApp();

  const port = process.env.PORT ?? 3000;
  app.listen(port, () => {
    console.log(`Appliance repair backend running on port ${port}`);
  });
}

bootstrap();
