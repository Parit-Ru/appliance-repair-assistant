/**
 * role.enum.ts — บทบาทของผู้ใช้ (แหล่งความจริงเดียวฝั่ง backend)
 *
 * ค่าต้องตรงกับ ENUM('user','admin') ของคอลัมน์ users.role ใน migration 010
 * ถ้าจะเพิ่มบทบาท: แก้ที่นี่ + migration ใหม่ที่ ALTER ENUM (ห้ามแก้ 010 ที่รันไปแล้ว)
 */

export enum Role {
  User = 'user',
  Admin = 'admin',
}

const ROLE_VALUES: readonly string[] = Object.values(Role);

/** ตรวจค่าที่มาจากภายนอก (เช่น payload ของ JWT) ว่าเป็น Role จริง */
export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && ROLE_VALUES.includes(value);
}
