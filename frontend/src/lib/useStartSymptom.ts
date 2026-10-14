import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStartSession } from '../api/queries'

/**
 * เริ่มการตรวจจากอาการที่ผู้ใช้เลือก ใช้ร่วมกันทั้งหน้าค้นหาอาการและหน้าอาการทั้งหมด
 *
 * เริ่ม session ใน onClick (ผ่าน start) เท่านั้น ห้ามย้ายไปไว้ใน useEffect
 * เพราะ StrictMode ในโหมด dev เรียก effect สองรอบ จะได้ session สองอัน
 *
 * startingId เก็บเองเพราะ useStartSession บอกได้แค่ว่ากำลังเริ่มอยู่ แต่ไม่บอกว่าของอาการไหน
 * (ให้หน้าใช้ทำให้แถวที่กดหมุน และแถวอื่นจาง)
 *
 * ไม่ต้อง GET session ซ้ำหลังเริ่ม เพราะ useStartSession ใส่ผลลงแคชให้แล้ว
 * หน้าตรวจอาการจึงแสดงได้ทันที
 */
export function useStartSymptom() {
  const startSession = useStartSession()
  const navigate = useNavigate()
  const [startingId, setStartingId] = useState<string | null>(null)

  /** query ส่งเฉพาะตอนเริ่มจากผลค้นหา (ไว้คิดคะแนน) เริ่มจากรายการไม่ส่ง → ไม่มีคะแนน */
  function start(graphId: string, query?: string) {
    setStartingId(graphId)
    startSession.mutate({ graphId, query }, { onSuccess: (session) => navigate(`/session/${session.sessionId}`) })
  }

  return { start, startingId, isStarting: startSession.isPending, error: startSession.error }
}
