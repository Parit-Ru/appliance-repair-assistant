/**
 * admin.service.ts — ประกอบข้อมูลสำหรับ /admin/* จาก AdminStore + ผังในหน่วยความจำ (FlowRepository)
 *
 * กฎ:
 *   - ส่งเฉพาะช่องที่ประกาศใน admin.dto.ts โดยหยิบทีละช่อง ไม่ spread แถวจากฐานข้อมูล
 *     (ต่อให้ store เผลอคืนช่องเกิน เช่น email ก็ไม่หลุดออก response)
 *   - ไม่เติมตัวเลขเอง: ตัวหารเป็น 0 → null (ไม่ใช่ 0) · ผังหาย → deviceCategory/outcomeKind เป็น null
 *   - outcome ของ session ที่จบ = outcome_kind ของสถานะสุดท้าย ณ ผังปัจจุบัน (เหมือนหน้าประวัติ)
 *     ผังถูก seed ใหม่จนหาสถานะไม่เจอ → นับเป็น 'unknown'
 *
 * ข้อจำกัดที่รู้ (บันทึกใน docs/auth/auth-step3.md):
 *   - ตาราง sessions/flows ใช้ร่วมกับโปรเจกต์เก่า แยกด้วย flow_id ไม่ได้ ตัวเลขรวมจึงรวม session ของโปรเจกต์เก่าด้วย
 */


import { isoFromEpoch, round3 } from '../common/helpers';
import { getOutcomeKind } from '../state-machine/state-machine';
import { FlowRepository } from '../execution/flow.repository';
import { dayIndexToDate, dayIndexToEpoch, thaiDayIndex, TOP_LIMIT, totalPagesOf } from './admin.dto';
import type { AdminFeedbackItemDto, AdminFeedbackPageDto, AdminSummaryDto, FeedbackQuery, SummaryQuery } from './admin.dto';
import { AdminStore } from './admin.store';

export class AdminService {
  constructor(
    private readonly store: AdminStore,
    private readonly flowRepository: FlowRepository,
  ) {}

  /** GET /admin/feedback */
  async feedback(query: FeedbackQuery): Promise<AdminFeedbackPageDto> {
    const { rows, total } = await this.store.listFeedback(query, query.pageSize, (query.page - 1) * query.pageSize);

    const items = rows.map((row): AdminFeedbackItemDto => {
      const flow = this.flowRepository.findById(row.flowId);
      return {
        sessionId: row.sessionId,
        helpful: row.helpful,
        comment: row.comment,
        createdAt: isoFromEpoch(row.createdEpoch),
        updatedAt: isoFromEpoch(row.updatedEpoch),
        flowId: row.flowId,
        deviceCategory: flow?.device_category ?? null,
        brand: flow?.brand ?? null,
        ownerType: row.ownerType,
      };
    });

    return { items, total, page: query.page, pageSize: query.pageSize, totalPages: totalPagesOf(total, query.pageSize) };
  }

  /** GET /admin/analytics/summary — ช่วง N วันล่าสุด (นับวันนี้เป็นวันที่ N) ตามเวลาไทย ใช้กับทุกส่วน */
  async summary(query: SummaryQuery): Promise<AdminSummaryDto> {
    const todayIndex = thaiDayIndex(Math.floor(Date.now() / 1000));
    const firstIndex = todayIndex - (query.days - 1);
    const window = { fromEpoch: dayIndexToEpoch(firstIndex), toEpoch: dayIndexToEpoch(todayIndex + 1) };

    const [totals, feedback, flowCounts, endStates, perDay] = await Promise.all([
      this.store.sessionTotals(window),
      this.store.feedbackTotals(window),
      this.store.flowCounts(window),
      this.store.completedEndStates(window),
      this.store.perDay(window),
    ]);

    // outcomes
    const outcomes: AdminSummaryDto['outcomes'] = {
      user_fixed: 0,
      normal_behavior: 0,
      handoff_informed: 0,
      handoff_unknown: 0,
      unknown: 0,
    };
    for (const end of endStates) {
      const flow = this.flowRepository.findById(end.flowId);
      const kind = flow ? getOutcomeKind(flow, end.stateId) : null;
      outcomes[kind ?? 'unknown'] += end.count;
    }

    // top flows / devices
    const topFlows = [...flowCounts]
      .sort((a, b) => b.count - a.count || a.flowId.localeCompare(b.flowId))
      .slice(0, TOP_LIMIT)
      .map((entry) => ({
        flowId: entry.flowId,
        entrySymptomTh: this.flowRepository.findById(entry.flowId)?.entry_symptom_th ?? null,
        count: entry.count,
      }));

    const deviceTotals = new Map<string, number>();
    for (const entry of flowCounts) {
      const category = this.flowRepository.findById(entry.flowId)?.device_category ?? 'unknown';
      deviceTotals.set(category, (deviceTotals.get(category) ?? 0) + entry.count);
    }
    const topDevices = [...deviceTotals.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, TOP_LIMIT)
      .map(([deviceCategory, count]) => ({
        deviceCategory: deviceCategory as AdminSummaryDto['topDevices'][number]['deviceCategory'],
        count,
      }));

    // per day (เติมวันที่ไม่มีข้อมูลเป็น 0)
    const byDay = new Map(perDay.map((row) => [row.dayIndex, row]));
    const perDayFilled: AdminSummaryDto['perDay'] = [];
    for (let index = firstIndex; index <= todayIndex; index += 1) {
      const row = byDay.get(index);
      perDayFilled.push({ date: dayIndexToDate(index), started: row?.started ?? 0, completed: row?.completed ?? 0 });
    }

    return {
      window: { days: query.days, from: dayIndexToDate(firstIndex), to: dayIndexToDate(todayIndex) },
      sessions: {
        total: totals.total,
        completed: totals.completed,
        inProgress: totals.inProgress,
        expiredUnfinished: totals.expiredUnfinished,
        byOwner: { user: totals.byUser, guest: totals.byGuest, none: totals.byNone },
      },
      feedback: {
        total: feedback.total,
        helpful: feedback.helpful,
        notHelpful: feedback.total - feedback.helpful,
        satisfactionRate: feedback.total === 0 ? null : round3(feedback.helpful / feedback.total),
      },
      confidence: {
        average: totals.averageConfidence === null ? null : round3(totals.averageConfidence),
        sampleSize: totals.confidenceSamples,
      },
      outcomes,
      topFlows,
      topDevices,
      perDay: perDayFilled,
    };
  }
}
