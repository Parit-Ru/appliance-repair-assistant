import type { ValidationIssue, ValidationReport } from '../../../api/types'
import { issueLocation, riskWarnings } from '../../../lib/draftView'
import { Notice } from '../../ui/Notice'

function IssueList({ issues }: { issues: ValidationIssue[] }) {
  return (
    <ul className="space-y-1">
      {issues.map((issue, index) => (
        <li key={`${issue.code}-${issue.graphId ?? ''}-${issue.nodeId ?? ''}-${index}`} className="text-sm">
          <span className="font-mono text-xs text-ink-faint">[{issue.code}]</span> <span className="text-ink-soft">{issueLocation(issue)}:</span> {issue.message}
        </li>
      ))}
    </ul>
  )
}

export function ValidationReportPanel({ report }: { report: ValidationReport | null }) {
  if (report === null) {
    return (
      <Notice tone="info" title="ยังไม่มีรายงานการตรวจ">
        รายงานจะมาเมื่อ AI ร่างเสร็จ
      </Notice>
    )
  }

  const risks = riskWarnings(report)
  const others = report.warnings.filter((w) => !risks.includes(w))

  return (
    <section aria-label="รายงานการตรวจ" className="space-y-3">
      <h2 className="text-lg font-semibold">รายงานการตรวจ</h2>
      <p className="text-sm text-ink-soft">
        ตรวจ {report.stats.graphs} แผนผังขั้นตอน · {report.stats.nodes} โหนด · ข้อผิดพลาด {report.errors.length} · คำเตือน {report.warnings.length}
      </p>

      {report.errors.length === 0 ? (
        <Notice tone="info" title="ไม่พบข้อผิดพลาดเชิงโครงสร้าง">
          ระบบตรวจโครงสร้าง ลูกศร ด่านความปลอดภัยเชิงกฎ และเลขหน้าแล้ว แต่ <strong>ตรวจไม่ได้ว่าเนื้อหาและคำแปลถูกต้อง</strong> — ผู้ตรวจต้องเทียบกับหน้าต้นฉบับเอง
        </Notice>
      ) : (
        <div role="alert">
          <Notice tone="danger" title={`ข้อผิดพลาด ${report.errors.length} ข้อ — เผยแพร่ไม่ได้จนกว่าจะแก้หมด`}>
            <IssueList issues={report.errors} />
          </Notice>
        </div>
      )}

      {risks.length > 0 && (
        <Notice tone="danger" title={`คำเตือนคำเสี่ยง ${risks.length} ข้อ — อาจขาดด่านความปลอดภัย`}>
          <p className="mb-2">ข้อความในโหนดหรือหน้าต้นฉบับพูดถึงไฟฟ้า ปลั๊ก แก๊ส ความร้อน หรือการรื้อเครื่อง แต่ไม่มีขั้นตอนที่บังคับยืนยันความปลอดภัย ตรวจว่า AI ไม่ได้ข้ามคำเตือนของคู่มือ</p>
          <IssueList issues={risks} />
        </Notice>
      )}

      {others.length > 0 && (
        <Notice tone="info" title={`คำเตือนอื่น ${others.length} ข้อ`}>
          <IssueList issues={others} />
        </Notice>
      )}
    </section>
  )
}
