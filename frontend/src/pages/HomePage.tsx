import { useNavigate } from 'react-router-dom'
import { useGraphs } from '../api/queries'
import type { RenderedNode } from '../api/types'
import { PathRail } from '../components/step/PathRail'
import { Button } from '../components/ui/Button'
import { Icon } from '../components/ui/Icon'
import { Notice } from '../components/ui/Notice'
import { DEVICE_CATEGORY_LABELS, STEP_KIND_LABELS } from '../lib/labels'
import { formatSourceLine } from '../lib/reference'
import { groupSymptoms } from '../lib/symptoms'
import { toTrailEntry } from '../lib/trail'
import { checkpointNode, safetyGateNode } from '../mocks/fixtures'

const POWER_CHECKPOINT: RenderedNode = {
  ...checkpointNode,
  nodeId: 'n1',
  text: 'เครื่องได้รับไฟฟ้าอยู่หรือไม่? (ตรวจปลั๊ก/เต้ารับ)',
}

const SAMPLE_TRAIL = [toTrailEntry(POWER_CHECKPOINT, { type: 'answer', value: 'yes' }), toTrailEntry(checkpointNode, { type: 'answer', value: 'yes' })]

const SAMPLE_SYMPTOM_NAME = 'แอร์ไม่ทำงาน เปิดไม่ติด'
const SAMPLE_MANUAL_LABEL = 'Samsung AR70H**D1***'

export function HomePage() {
  const graphs = useGraphs()
  const navigate = useNavigate()

  const groups = graphs.isSuccess ? groupSymptoms(graphs.data) : []
  const showSupported = graphs.isPending || groups.length > 0

  return (
    <div className="grid gap-10 lg:grid-cols-2 lg:grid-rows-[auto_1fr] lg:gap-x-8 lg:gap-y-10">
      <section className="space-y-5 lg:col-start-1 lg:row-start-1">
        <h1 className="text-3xl font-semibold leading-tight md:text-4xl">
          <span className="block">ตรวจอาการทีละขั้น</span>
          <span className="block text-accent">ตามคู่มือของผู้ผลิต</span>
        </h1>

        <p className="text-ink-soft">เลือกอาการของเครื่องใช้ไฟฟ้าที่พบ แล้วตอบคำถามทีละข้อ ลำดับขั้นตอนมาจากคู่มือ ไม่ได้ให้ AI เดาเอาเอง ขั้นตอนที่เกี่ยวกับไฟฟ้าต้องยืนยันคำเตือนก่อนทุกครั้ง และทุกขั้นบอกหน้าคู่มือที่มา</p>

        <Button onClick={() => navigate('/symptoms')}>เลือกอาการที่พบ</Button>
      </section>

      <figure className="space-y-3 lg:col-start-2 lg:row-span-2 lg:row-start-1">
        <figcaption className="text-sm text-ink-soft">ตัวอย่างจากอาการ {SAMPLE_SYMPTOM_NAME}</figcaption>

        <PathRail entries={SAMPLE_TRAIL} current={safetyGateNode}>
          <div className="rounded-xl border-2 border-danger bg-panel p-5 md:p-6">
            <p className="mb-2 text-sm text-ink-soft">{STEP_KIND_LABELS.safety_instruction}</p>

            <div className="mb-4">
              <Notice tone="danger" title="คำเตือนก่อนทำขั้นตอนนี้">
                {safetyGateNode.safetyWarning}
              </Notice>
            </div>

            <p className="text-lg leading-relaxed">{safetyGateNode.text}</p>

            <p className="mt-5 text-sm text-ink-soft">ต้องยืนยันว่าอ่านคำเตือนแล้ว จึงจะไปขั้นต่อไปได้</p>

            <p className="mt-5 border-t border-line pt-3 text-sm text-ink-faint">{formatSourceLine(safetyGateNode.reference, SAMPLE_MANUAL_LABEL)}</p>
          </div>
        </PathRail>
      </figure>

      {showSupported && (
        <section className="space-y-3 lg:col-start-1 lg:row-start-2">
          <h2 className="font-semibold">รองรับตอนนี้</h2>

          {graphs.isPending && (
            <p className="flex items-center gap-2 text-ink-soft">
              <Icon name="spinner" className="h-5 w-5 animate-spin" />
              กำลังโหลด
            </p>
          )}

          <ul className="space-y-3">
            {groups.map((group) => (
              <li key={`${group.deviceCategory}|${group.brand}|${group.modelPattern}`}>
                <p>
                  {DEVICE_CATEGORY_LABELS[group.deviceCategory]} {group.brand} <code className="font-mono">{group.modelPattern}</code>
                </p>
                <p className="text-sm text-ink-soft">{group.symptoms.length} อาการ</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
