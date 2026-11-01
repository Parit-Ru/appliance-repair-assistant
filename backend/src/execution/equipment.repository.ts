import type { Pool, RowDataPacket } from 'mysql2/promise';
import { createLogger } from '../common/logger';
import type { DeviceCategory } from '../state-machine/types';
import type { EquipmentItemDto } from './execution.dto';

interface EquipmentRow extends RowDataPacket {
  device_category: DeviceCategory;
  equipment_id: string;
  name_th: string;
  purpose_th: string;
  source_page: number | null;
  author_note: string | null;
}

export class EquipmentRepository {
  private readonly logger = createLogger('EquipmentRepository');

  private readonly byCategory = new Map<DeviceCategory, EquipmentItemDto[]>();

  constructor(private readonly pool: Pool) {}

  /** โหลดรายการอุปกรณ์เข้าหน่วยความจำ — app.ts เรียกตอนบูต ก่อนเปิดรับคำขอ */
  async load(): Promise<void> {
    await this.loadAll();
  }
  findByCategory(category: DeviceCategory): EquipmentItemDto[] {
    return [...(this.byCategory.get(category) ?? [])];
  }

  private async loadAll(): Promise<void> {
    const [rows] = await this.pool.query<EquipmentRow[]>(
      `SELECT u.device_category, u.equipment_id, e.name_th,
              u.purpose_th, u.source_page, u.author_note
         FROM equipment_usage u
         JOIN equipment e ON e.equipment_id = u.equipment_id
        ORDER BY u.device_category, u.display_order, u.equipment_id`,
    );

    this.byCategory.clear();

    for (const row of rows) {
      const item: EquipmentItemDto = {
        equipmentId: row.equipment_id,
        nameTh: row.name_th,
        purposeTh: row.purpose_th,
        sourcePage: row.source_page ?? undefined,
        authorNote: row.author_note ?? undefined,
      };

      const list = this.byCategory.get(row.device_category);
      if (list) list.push(item);
      else this.byCategory.set(row.device_category, [item]);
    }

    this.logger.log(
      `โหลดอุปกรณ์สำเร็จ ${rows.length} รายการ ใน ${this.byCategory.size} ประเภทเครื่อง`,
    );
  }
}