/**
 * admin.service.ts — ประกอบข้อมูลสำหรับ /admin/* จาก AdminStore + ผังในหน่วยความจำ (GraphRepository)
 *
 * กฎ:
 *   - ส่งเฉพาะช่องที่ประกาศใน admin.dto.ts โดยหยิบทีละช่อง ไม่ spread แถวจากฐานข้อมูล
 *     (ต่อให้ store เผลอคืนช่องเกิน เช่น email ก็ไม่หลุดออก response)
 *   - ไม่เติมตัวเลขเอง: ตัวหารเป็น 0 → null (ไม่ใช่ 0) · ผังหาย → deviceCategory/outcomeKind เป็น null
 *   - outcome ของ session ที่จบ = outcome_kind ของโหนดสุดท้าย ณ ผังปัจจุบัน (เหมือนหน้าประวัติ)
 *     ผังถูก seed ใหม่จนหาโหนดไม่เจอ → นับเป็น 'unknown'
 *
 * ข้อจำกัดที่รู้ (บันทึกใน docs/auth-step3.md):
 *   - ตาราง sessions/graphs ใช้ร่วมกับโปรเจกต์เก่า แยกด้วย graph_id ไม่ได้ ตัวเลขรวมจึงรวม session ของโปรเจกต์เก่าด้วย
 */

import { Injectable } from '@nestjs/common';

import type { OutcomeKind, TroubleshootingGraph } from '../traversal-engine/types';
import { GraphRepository } from '../traversal/graph.repository';
import {
  dayIndexToDate,
  dayIndexToEpoch,
  thaiDayIndex,
  TOP_LIMIT,
  totalPagesOf,
} from './admin.dto';
import type {
  AdminFeedbackItemDto,
  AdminSessionItemDto,
  AdminSummaryDto,
  FeedbackQuery,
  PagedDto,
  SessionsQuery,
  SummaryQuery,
} from './admin.dto';
import { AdminStore } from './admin.store';

const isoOf = (epochSeconds: number): string => new Date(epochSeconds * 1000).toISOString();
const round3 = (value: number): number => Math.round(value * 1000) / 1000;

/** outcome_kind ของโหนดสุดท้าย · null = ผัง/โหนดหาย หรือไม่ใช่โหนดสิ้นสุด */
function outcomeKindOf(graph: TroubleshootingGraph | undefined, nodeId: string): OutcomeKind | null {
  const node = graph?.nodes.find((candidate) => candidate.node_id === nodeId);
  if (node && (node.type === 'resolution' || node.type === 'escalation')) {
    return node.outcome_kind;
  }
  return null;
}

@Injectable()
export class AdminService {
  /** นาฬิกา (วินาที) — เป็น field ให้เทสต์เปลี่ยนเวลาได้ถ้ากู้เทสต์กลับมา · ไม่อยู่ใน constructor เพื่อไม่ให้ Nest พยายามฉีดเป็น dependency */
  nowEpoch: () => number = () => Math.floor(Date.now() / 1000);

  constructor(
    private readonly store: AdminStore,
    private readonly graphRepository: GraphRepository,
  ) {}

  /** GET /admin/feedback */
  async feedback(query: FeedbackQuery): Promise<PagedDto<AdminFeedbackItemDto>> {
    const { rows, total } = await this.store.listFeedback(query, query.pageSize, (query.page - 1) * query.pageSize);

    const items = rows.map((row): AdminFeedbackItemDto => {
      const graph = this.graphRepository.findById(row.graphId);
      return {
        sessionId: row.sessionId,
        helpful: row.helpful,
        comment: row.comment,
        createdAt: isoOf(row.createdEpoch),
        updatedAt: isoOf(row.updatedEpoch),
        graphId: row.graphId,
        deviceCategory: graph?.device_category ?? null,
        brand: graph?.brand ?? null,
        ownerType: row.ownerType,
      };
    });

    return { items, total, page: query.page, pageSize: query.pageSize, totalPages: totalPagesOf(total, query.pageSize) };
  }

  /** GET /admin/sessions */
  async sessions(query: SessionsQuery): Promise<PagedDto<AdminSessionItemDto>> {
    const { rows, total } = await this.store.listSessions(query, query.pageSize, (query.page - 1) * query.pageSize);

    const items = rows.map((row): AdminSessionItemDto => {
      const graph = this.graphRepository.findById(row.graphId);
      return {
        sessionId: row.sessionId,
        graphId: row.graphId,
        deviceCategory: graph?.device_category ?? null,
        brand: graph?.brand ?? null,
        status: row.status,
        expired: row.expired,
        confidence: row.confidence,
        modelSelection: row.modelSelection,
        outcomeKind: row.status === 'completed' ? outcomeKindOf(graph, row.currentNodeId) : null,
        hasFeedback: row.hasFeedback,
        ownerType: row.ownerType,
        createdAt: isoOf(row.createdEpoch),
      };
    });

    return { items, total, page: query.page, pageSize: query.pageSize, totalPages: totalPagesOf(total, query.pageSize) };
  }

  /** GET /admin/analytics/summary — ช่วง N วันล่าสุด (นับวันนี้เป็นวันที่ N) ตามเวลาไทย ใช้กับทุกส่วน */
  async summary(query: SummaryQuery): Promise<AdminSummaryDto> {
    const todayIndex = thaiDayIndex(this.nowEpoch());
    const firstIndex = todayIndex - (query.days - 1);
    const window = { fromEpoch: dayIndexToEpoch(firstIndex), toEpoch: dayIndexToEpoch(todayIndex + 1) };

    const [totals, feedback, graphCounts, endNodes, perDay] = await Promise.all([
      this.store.sessionTotals(window),
      this.store.feedbackTotals(window),
      this.store.graphCounts(window),
      this.store.completedEndNodes(window),
      this.store.perDay(window),
    ]);

    // ---- outcomes ----
    const outcomes: AdminSummaryDto['outcomes'] = {
      user_fixed: 0,
      normal_behavior: 0,
      handoff_informed: 0,
      handoff_unknown: 0,
      unknown: 0,
    };
    for (const end of endNodes) {
      const kind = outcomeKindOf(this.graphRepository.findById(end.graphId), end.nodeId);
      outcomes[kind ?? 'unknown'] += end.count;
    }

    // ---- top graphs / devices ----
    const topGraphs = [...graphCounts]
      .sort((a, b) => b.count - a.count || a.graphId.localeCompare(b.graphId))
      .slice(0, TOP_LIMIT)
      .map((entry) => ({
        graphId: entry.graphId,
        entrySymptomTh: this.graphRepository.findById(entry.graphId)?.entry_symptom_th ?? null,
        count: entry.count,
      }));

    const deviceTotals = new Map<string, number>();
    for (const entry of graphCounts) {
      const category = this.graphRepository.findById(entry.graphId)?.device_category ?? 'unknown';
      deviceTotals.set(category, (deviceTotals.get(category) ?? 0) + entry.count);
    }
    const topDevices = [...deviceTotals.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, TOP_LIMIT)
      .map(([deviceCategory, count]) => ({
        deviceCategory: deviceCategory as AdminSummaryDto['topDevices'][number]['deviceCategory'],
        count,
      }));

    // ---- per day (เติมวันที่ไม่มีข้อมูลเป็น 0) ----
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
      topGraphs,
      topDevices,
      perDay: perDayFilled,
    };
  }
}
