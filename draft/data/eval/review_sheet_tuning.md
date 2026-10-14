# แผ่นตรวจชุดตั้งเกณฑ์ (`data/eval/queries_tuning.json`)

> **ไฟล์นี้ใช้ช่วยให้ผู้พัฒนาไล่ตรวจเร็วขึ้นเท่านั้น ไม่ได้แก้ชุดคำค้นและไม่ได้ถูกสคริปต์ใดอ่าน** การแก้ที่มีผลต้องทำใน `queries_tuning.json` ด้วยมือผู้พัฒนาเอง
>
> **ผู้ร่างชุดนี้คือ Claude (ผู้ช่วย AI)** ผู้พัฒนายังไม่ได้ตรวจแก้ คอลัมน์ "เฉลย" คือสิ่งที่ AI ตั้งไว้ ไม่ใช่ความจริงที่ยืนยันแล้ว งานของผู้ตรวจคือตัดสินว่าเฉลยถูกไหม ไม่ใช่ตัดสินว่าระบบถูกไหม

สร้างเมื่อ 2026-10-04 จากผลรัน `node scripts/eval-symptom-search.js` ที่เกณฑ์ 0.55 (`MATCH_THRESHOLD`) แสดงสูงสุด 3 ผัง ตรง `MAX_RESULTS`

## สรุปผลที่ได้ (ชุดนี้ AI ร่าง ใช้เลือกเกณฑ์ได้ ห้ามอ้างเป็นความแม่นยำของระบบ)

| ตัวชี้วัด | ผล |
|---|---|
| ข้อทั้งหมด | 56 (ในขอบเขต 39 · นอกขอบเขต 17) |
| ผังถูกอยู่อันดับ 1 | 29/39 |
| ผังถูกอยู่ใน 3 อันดับแรก | 37/39 |
| ในขอบเขตที่ถูกปฏิเสธที่เกณฑ์ 0.55 | 3/39 |
| นอกขอบเขตที่หลุดผ่านเกณฑ์ 0.55 (ระบบเสนอผังที่ไม่ควรมี) | 8/17 |

## วิธีตรวจ (ถามตัวเองทีละข้อ)

1. **คำค้นนี้ผู้ใช้จริงจะพิมพ์ไหม** ถ้าเป็นประโยคที่ไม่มีใครพิมพ์ ให้พิจารณาตัดหรือเขียนใหม่
2. **เฉลยถูกไหม** เทียบกับคู่มือแอร์ AR70H ส่วนแก้ปัญหา **หน้า 43–44** ไม่ใช่ความรู้ทั่วไปว่าแอร์เสียได้เพราะอะไร (เช่น "น้ำยาแอร์หมด" คู่มือส่วนนี้ไม่ได้สอนให้ผู้ใช้แก้เอง จึงเป็นนอกขอบเขต)
3. **ถ้าอยู่นอกขอบเขต** ตรวจว่าคู่มือหน้า 43–44 ไม่ครอบคลุมเรื่องนี้จริง และอย่าให้ไปซ้ำกับข้อความตัวแทนของผังทุกตัวอักษร (ตัวตรวจ `validate-eval-queries.js` จะจับให้)
4. **อย่าปรับคำค้นให้ระบบตอบถูก** ถ้าคำค้นพลาดเพราะระบบอ่อน ให้คงคำค้นไว้ ชุดนี้มีไว้เพื่อเห็นจุดอ่อน

สัญลักษณ์: ✅ ถูก · 🟡 ผังถูกอยู่อันดับ 2–3 ยังแสดงในรายการ · 🟠 อันดับ 2–3 แต่คะแนนต่ำกว่าเกณฑ์ · ❌ พลาด · ⚠️ นอกขอบเขตแต่ระบบเสนอผัง · ↓ คะแนนต่ำกว่าเกณฑ์

---

## ก. ในขอบเขต (39 ข้อ) จัดกลุ่มตามผังที่เฉลยไว้

### stops_working — แอร์ไม่ทำงาน เปิดไม่ติด

ข้อความตัวแทนในดัชนีของผังนี้ (5 ข้อความ): “แอร์ไม่ทำงาน เปิดไม่ติด” · “The air conditioner stops working” · “แอร์ดับเอง” · “แอร์ตัดเอง” · “AC turns off by itself”

| ตรวจ | ข้อ | คำค้น | ลักษณะ | 3 อันดับแรกที่ระบบให้ | ผล | หมายเหตุผู้ตรวจ |
|:-:|---|---|---|---|---|---|
| [ ] | T001 | เสียบปลั๊กแล้วแต่แอร์ไม่ติดเลย | colloquial | 1) stops_working 0.870 · 2) improper_airflow_temperature 0.753 · 3) condensation_indoor 0.682 | ✅ ผังถูกอยู่อันดับ 1 | |
| [ ] | T002 | แอร์ดับไปเองกลางดึก เปิดใหม่ก็ไม่ติด | colloquial | 1) stops_working 0.747 · 2) indicator_blinking 0.697 · 3) improper_airflow_temperature 0.647 | ✅ ผังถูกอยู่อันดับ 1 | |
| [ ] | T003 | The AC won't turn on at all | english | 1) stops_working 0.703 · 2) improper_airflow_temperature 0.539↓ · 3) error_message 0.421↓ | ✅ ผังถูกอยู่อันดับ 1 | |

### cannot_change_temperature — ปรับอุณหภูมิไม่ได้

ข้อความตัวแทนในดัชนีของผังนี้ (2 ข้อความ): “ปรับอุณหภูมิไม่ได้” · “Cannot change the temperature”

| ตรวจ | ข้อ | คำค้น | ลักษณะ | 3 อันดับแรกที่ระบบให้ | ผล | หมายเหตุผู้ตรวจ |
|:-:|---|---|---|---|---|---|
| [ ] | T004 | ตั้งอุณหภูมิ 24 แต่กดเท่าไหร่ก็เปลี่ยนไม่ได้ | colloquial | 1) cannot_change_temperature 0.662 · 2) timer_not_working 0.574 · 3) remote_not_working 0.486↓ | ✅ ผังถูกอยู่อันดับ 1 | |
| [ ] | T005 | ไม่สามารถปรับองศาของเครื่องปรับอากาศได้ | formal | 1) cannot_change_temperature 0.728 · 2) stops_working 0.711 · 3) cannot_change_airflow_direction 0.672 | ✅ ผังถูกอยู่อันดับ 1 | |
| [ ] | T006 | cant set temp on my aircon | typo_or_abbrev | 1) cannot_change_temperature 0.656 · 2) improper_airflow_temperature 0.640 · 3) stops_working 0.574 | ✅ ผังถูกอยู่อันดับ 1 | |

### improper_airflow_temperature — แอร์ไม่เย็น ลมออกมาไม่เย็น

ข้อความตัวแทนในดัชนีของผังนี้ (5 ข้อความ): “แอร์ไม่เย็น ลมออกมาไม่เย็น” · “Improper airflow temperature” · “แอร์เย็นน้อยลง” · “แอร์ไม่ค่อยเย็น” · “AC not cooling well”

| ตรวจ | ข้อ | คำค้น | ลักษณะ | 3 อันดับแรกที่ระบบให้ | ผล | หมายเหตุผู้ตรวจ |
|:-:|---|---|---|---|---|---|
| [ ] | T007 | เปิดแอร์มาสองชั่วโมงแล้วห้องยังร้อนอยู่ | colloquial | 1) improper_airflow_temperature 0.555 · 2) stops_working 0.534↓ · 3) odors_from_unit 0.476↓ | ✅ ผังถูกอยู่อันดับ 1 | |
| [ ] | T008 | ลมจากแอร์ไม่เย็นเหมือนเดิม | vague | 1) improper_airflow_temperature 0.903 · 2) stops_working 0.746 · 3) condensation_indoor 0.730 | ✅ ผังถูกอยู่อันดับ 1 | |
| [ ] | T009 | air conditioner blowing warm air | english | 1) stops_working 0.769 · 2) improper_airflow_temperature 0.765 · 3) condensation_indoor 0.630 | 🟡 ผังถูกอยู่อันดับ 2 (ยังอยู่ในรายการที่แสดง) | |

### cannot_change_airflow_direction — ปรับทิศทางลมไม่ได้ บานสวิงไม่ขยับ

ข้อความตัวแทนในดัชนีของผังนี้ (2 ข้อความ): “ปรับทิศทางลมไม่ได้ บานสวิงไม่ขยับ” · “Cannot change the airflow direction”

| ตรวจ | ข้อ | คำค้น | ลักษณะ | 3 อันดับแรกที่ระบบให้ | ผล | หมายเหตุผู้ตรวจ |
|:-:|---|---|---|---|---|---|
| [ ] | T010 | สั่งให้ลมส่ายขึ้นลงแต่แผ่นบังลมไม่ขยับ | colloquial | 1) cannot_change_airflow_direction 0.771 · 2) improper_airflow_temperature 0.696 · 3) stops_working 0.602 | ✅ ผังถูกอยู่อันดับ 1 | |
| [ ] | T011 | ปรับให้ลมไม่เป่าโดนตัวไม่ได้ | vague | 1) cannot_change_airflow_direction 0.689 · 2) improper_airflow_temperature 0.629 · 3) cannot_change_temperature 0.530↓ | ✅ ผังถูกอยู่อันดับ 1 | |
| [ ] | T012 | louver stuck can't adjust air direction | english | 1) cannot_change_airflow_direction 0.721 · 2) stops_working 0.547↓ · 3) improper_airflow_temperature 0.526↓ | ✅ ผังถูกอยู่อันดับ 1 | |

### cannot_change_fan_speed — ปรับความแรงพัดลมไม่ได้

ข้อความตัวแทนในดัชนีของผังนี้ (2 ข้อความ): “ปรับความแรงพัดลมไม่ได้” · “Cannot change the fan speed”

| ตรวจ | ข้อ | คำค้น | ลักษณะ | 3 อันดับแรกที่ระบบให้ | ผล | หมายเหตุผู้ตรวจ |
|:-:|---|---|---|---|---|---|
| [ ] | T013 | กดปุ่มเพิ่มลมแล้วความแรงไม่เปลี่ยน | colloquial | 1) remote_not_working 0.522↓ · 2) cannot_change_airflow_direction 0.519↓ · 3) improper_airflow_temperature 0.495↓ | ❌ ถูกปฏิเสธ (สูงสุด 0.522 < 0.55) → ผู้ใช้ถูกส่งต่อศูนย์บริการ | |
| [ ] | T014 | ไม่สามารถเลือกระดับความเร็วพัดลมได้ | formal | 1) cannot_change_fan_speed 0.815 · 2) cannot_change_temperature 0.399↓ · 3) cannot_change_airflow_direction 0.386↓ | ✅ ผังถูกอยู่อันดับ 1 | |
| [ ] | T015 | fan speed stuck on auto | english | 1) cannot_change_fan_speed 0.726 · 2) remote_not_working 0.324↓ · 3) improper_airflow_temperature 0.321↓ | ✅ ผังถูกอยู่อันดับ 1 | |

### remote_not_working — รีโมทใช้ไม่ได้ กดแล้วไม่ตอบสนอง

ข้อความตัวแทนในดัชนีของผังนี้ (4 ข้อความ): “รีโมทใช้ไม่ได้ กดแล้วไม่ตอบสนอง” · “The remote control does not work” · “รีโมทกดไม่ติด” · “remote control unresponsive”

| ตรวจ | ข้อ | คำค้น | ลักษณะ | 3 อันดับแรกที่ระบบให้ | ผล | หมายเหตุผู้ตรวจ |
|:-:|---|---|---|---|---|---|
| [ ] | T016 | รีโมทแอร์กดแล้วไม่มีปฏิกิริยา | colloquial | 1) remote_not_working 0.733 · 2) stops_working 0.538↓ · 3) timer_not_working 0.514↓ | ✅ ผังถูกอยู่อันดับ 1 | |
| [ ] | T017 | รีโมทหน้าจอไม่ติด สงสัยแบตหมด | colloquial | 1) stops_working 0.546↓ · 2) remote_not_working 0.519↓ · 3) error_message 0.507↓ | ❌ ถูกปฏิเสธ (สูงสุด 0.546 < 0.55) → ผู้ใช้ถูกส่งต่อศูนย์บริการ | |
| [ ] | T018 | remote not responding to the air con | english | 1) remote_not_working 0.770 · 2) error_message 0.525↓ · 3) stops_working 0.521↓ | ✅ ผังถูกอยู่อันดับ 1 | |

### timer_not_working — ตั้งเวลาเปิดปิดไม่ได้ ตั้งแล้วไม่ทำงาน

ข้อความตัวแทนในดัชนีของผังนี้ (2 ข้อความ): “ตั้งเวลาเปิดปิดไม่ได้ ตั้งแล้วไม่ทำงาน” · “The Timed on/off function does not work”

| ตรวจ | ข้อ | คำค้น | ลักษณะ | 3 อันดับแรกที่ระบบให้ | ผล | หมายเหตุผู้ตรวจ |
|:-:|---|---|---|---|---|---|
| [ ] | T019 | ตั้งเวลาปิดตอนนอนแต่แอร์ไม่ปิดตามเวลา | colloquial | 1) stops_working 0.673 · 2) improper_airflow_temperature 0.625 · 3) timer_not_working 0.624 | 🟡 ผังถูกอยู่อันดับ 3 (ยังอยู่ในรายการที่แสดง) | |
| [ ] | T020 | ฟังก์ชันตั้งเวลาเปิดอัตโนมัติไม่ทำงาน | formal | 1) timer_not_working 0.770 · 2) remote_not_working 0.604 · 3) cannot_change_temperature 0.334↓ | ✅ ผังถูกอยู่อันดับ 1 | |
| [ ] | T021 | timer doesnt work on my aircon | typo_or_abbrev | 1) timer_not_working 0.565 · 2) stops_working 0.528↓ · 3) error_message 0.520↓ | ✅ ผังถูกอยู่อันดับ 1 | |

### indicator_blinking — ไฟกะพริบที่หน้าจอแอร์ ไฟกระพริบไม่หยุด

ข้อความตัวแทนในดัชนีของผังนี้ (2 ข้อความ): “ไฟกะพริบที่หน้าจอแอร์ ไฟกระพริบไม่หยุด” · “The indicator on the indoor unit display blinks continuously”

| ตรวจ | ข้อ | คำค้น | ลักษณะ | 3 อันดับแรกที่ระบบให้ | ผล | หมายเหตุผู้ตรวจ |
|:-:|---|---|---|---|---|---|
| [ ] | T022 | มีไฟกะพริบรัวๆ ที่ตัวแอร์ | colloquial | 1) indicator_blinking 0.848 · 2) condensation_indoor 0.745 · 3) improper_airflow_temperature 0.716 | ✅ ผังถูกอยู่อันดับ 1 | |
| [ ] | T023 | ไฟสถานะที่เครื่องด้านในกระพริบตลอดเวลา | formal | 1) indicator_blinking 0.792 · 2) unit_generating_noise 0.487↓ · 3) odors_from_unit 0.429↓ | ✅ ผังถูกอยู่อันดับ 1 | |
| [ ] | T024 | ไฟกระพริบๆที่แอร์อะ | typo_or_abbrev | 1) indicator_blinking 0.868 · 2) stops_working 0.699 · 3) condensation_indoor 0.684 | ✅ ผังถูกอยู่อันดับ 1 | |

### odors_from_unit — แอร์มีกลิ่นเหม็น กลิ่นอับ

ข้อความตัวแทนในดัชนีของผังนี้ (4 ข้อความ): “แอร์มีกลิ่นเหม็น กลิ่นอับ” · “Odors are coming from the unit during regular operation” · “แอร์เหม็นอับ” · “แอร์มีกลิ่นเหม็นเน่า”

| ตรวจ | ข้อ | คำค้น | ลักษณะ | 3 อันดับแรกที่ระบบให้ | ผล | หมายเหตุผู้ตรวจ |
|:-:|---|---|---|---|---|---|
| [ ] | T025 | เปิดแอร์แล้วมีกลิ่นอับๆ ออกมา | colloquial | 1) odors_from_unit 0.863 · 2) stops_working 0.747 · 3) unit_generating_noise 0.684 | ✅ ผังถูกอยู่อันดับ 1 | |
| [ ] | T026 | ห้องมีกลิ่นบุหรี่ติดอยู่ที่แอร์ | colloquial | 1) odors_from_unit 0.712 · 2) unit_generating_noise 0.587 · 3) indicator_blinking 0.586 | ✅ ผังถูกอยู่อันดับ 1 | |
| [ ] | T027 | bad smell coming from ac vent | english | 1) odors_from_unit 0.765 · 2) unit_generating_noise 0.552 · 3) improper_airflow_temperature 0.491↓ | ✅ ผังถูกอยู่อันดับ 1 | |

### error_message — หน้าจอแอร์ขึ้นรหัสข้อผิดพลาด ขึ้น error

ข้อความตัวแทนในดัชนีของผังนี้ (2 ข้อความ): “หน้าจอแอร์ขึ้นรหัสข้อผิดพลาด ขึ้น error” · “The indoor unit display shows an error message”

| ตรวจ | ข้อ | คำค้น | ลักษณะ | 3 อันดับแรกที่ระบบให้ | ผล | หมายเหตุผู้ตรวจ |
|:-:|---|---|---|---|---|---|
| [ ] | T028 | จอที่ตัวแอร์โชว์รหัสแปลกๆ | colloquial | 1) indicator_blinking 0.744 · 2) error_message 0.602 · 3) unit_generating_noise 0.575 | 🟡 ผังถูกอยู่อันดับ 2 (ยังอยู่ในรายการที่แสดง) | |
| [ ] | T029 | แอร์ขึ้นรหัสตัวเลข ต้องทำยังไง | vague | 1) indicator_blinking 0.519↓ · 2) condensation_indoor 0.517↓ · 3) improper_airflow_temperature 0.516↓ | ❌ ถูกปฏิเสธ (สูงสุด 0.519 < 0.55) → ผู้ใช้ถูกส่งต่อศูนย์บริการ | |
| [ ] | T030 | error code shown on air conditioner display | english | 1) error_message 0.798 · 2) stops_working 0.662 · 3) improper_airflow_temperature 0.536↓ | ✅ ผังถูกอยู่อันดับ 1 | |

### unit_generating_noise — แอร์มีเสียงดัง เสียงผิดปกติ

ข้อความตัวแทนในดัชนีของผังนี้ (2 ข้อความ): “แอร์มีเสียงดัง เสียงผิดปกติ” · “The unit is generating noise”

| ตรวจ | ข้อ | คำค้น | ลักษณะ | 3 อันดับแรกที่ระบบให้ | ผล | หมายเหตุผู้ตรวจ |
|:-:|---|---|---|---|---|---|
| [ ] | T031 | แอร์ทำงานแล้วมีเสียงดังรบกวน | colloquial | 1) unit_generating_noise 0.887 · 2) odors_from_unit 0.773 · 3) condensation_indoor 0.729 | ✅ ผังถูกอยู่อันดับ 1 | |
| [ ] | T032 | เสียงดังจากตัวเครื่องตอนแอร์ทำงาน | formal | 1) unit_generating_noise 0.871 · 2) indicator_blinking 0.720 · 3) odors_from_unit 0.700 | ✅ ผังถูกอยู่อันดับ 1 | |
| [ ] | T033 | แอร์เสียงดังมากกกกก | typo_or_abbrev | 1) unit_generating_noise 0.910 · 2) odors_from_unit 0.801 · 3) stops_working 0.654 | ✅ ผังถูกอยู่อันดับ 1 | |

### water_drips_outdoor — น้ำหยดจากคอมเพรสเซอร์ เครื่องนอกมีน้ำหยด

ข้อความตัวแทนในดัชนีของผังนี้ (2 ข้อความ): “น้ำหยดจากคอมเพรสเซอร์ เครื่องนอกมีน้ำหยด” · “Water drips from the pipe connections on the outdoor unit”

| ตรวจ | ข้อ | คำค้น | ลักษณะ | 3 อันดับแรกที่ระบบให้ | ผล | หมายเหตุผู้ตรวจ |
|:-:|---|---|---|---|---|---|
| [ ] | T034 | มีน้ำหยดจากท่อของเครื่องนอกบ้านตอนแอร์ทำงาน | formal | 1) condensation_indoor 0.814 · 2) water_drips_outdoor 0.796 · 3) stops_working 0.697 | 🟡 ผังถูกอยู่อันดับ 2 (ยังอยู่ในรายการที่แสดง) | |
| [ ] | T035 | ตรงข้อต่อท่อแอร์ด้านนอกมีน้ำหยด | colloquial | 1) condensation_indoor 0.860 · 2) water_drips_outdoor 0.830 · 3) stops_working 0.691 | 🟡 ผังถูกอยู่อันดับ 2 (ยังอยู่ในรายการที่แสดง) | |
| [ ] | T036 | water dripping from outdoor unit pipe | english | 1) water_drips_outdoor 0.930 · 2) condensation_indoor 0.557 · 3) improper_airflow_temperature 0.488↓ | ✅ ผังถูกอยู่อันดับ 1 | |

### condensation_indoor — มีหยดน้ำเกาะที่ตัวแอร์ แอร์มีฝ้า

ข้อความตัวแทนในดัชนีของผังนี้ (2 ข้อความ): “มีหยดน้ำเกาะที่ตัวแอร์ แอร์มีฝ้า” · “Condensation forms on the surface of the indoor unit”

| ตรวจ | ข้อ | คำค้น | ลักษณะ | 3 อันดับแรกที่ระบบให้ | ผล | หมายเหตุผู้ตรวจ |
|:-:|---|---|---|---|---|---|
| [ ] | T037 | ตัวเครื่องด้านในมีเม็ดน้ำเกาะเต็มไปหมด | colloquial | 1) water_drips_outdoor 0.668 · 2) condensation_indoor 0.577 · 3) odors_from_unit 0.370↓ | 🟡 ผังถูกอยู่อันดับ 2 (ยังอยู่ในรายการที่แสดง) | |
| [ ] | T038 | มีไอน้ำเกาะที่พื้นผิวแอร์ในห้อง | formal | 1) condensation_indoor 0.785 · 2) improper_airflow_temperature 0.728 · 3) odors_from_unit 0.719 | ✅ ผังถูกอยู่อันดับ 1 | |
| [ ] | T039 | ac indoor unit sweating | english | 1) improper_airflow_temperature 0.671 · 2) condensation_indoor 0.500↓ · 3) odors_from_unit 0.462↓ | 🟠 ผังถูกอยู่อันดับ 2 แต่คะแนน 0.500 ต่ำกว่าเกณฑ์ (ไม่แสดง) | |

---

## ข. นอกขอบเขต (17 ข้อ) ระบบควรปฏิเสธและส่งต่อศูนย์บริการ

### other_appliance — เครื่องใช้ไฟฟ้าชนิดอื่น

| ตรวจ | ข้อ | คำค้น | 3 อันดับแรกที่ระบบให้ | ผล | หมายเหตุผู้ตรวจ |
|:-:|---|---|---|---|---|
| [ ] | T040 | ตู้เย็นไม่เย็นเลย | 1) stops_working 0.525↓ · 2) improper_airflow_temperature 0.494↓ · 3) cannot_change_temperature 0.455↓ | ✅ ปฏิเสธถูก (คะแนนสูงสุด 0.525) | |
| [ ] | T041 | ทีวีมีเสียงแต่ไม่มีภาพ | 1) unit_generating_noise 0.406↓ · 2) error_message 0.317↓ · 3) stops_working 0.314↓ | ✅ ปฏิเสธถูก (คะแนนสูงสุด 0.406) | |
| [ ] | T042 | เครื่องซักผ้าไม่ปั่นแห้ง | 1) water_drips_outdoor 0.509↓ · 2) stops_working 0.442↓ · 3) improper_airflow_temperature 0.440↓ | ✅ ปฏิเสธถูก (คะแนนสูงสุด 0.509) | |
| [ ] | T043 | เตาไมโครเวฟไม่ร้อน | 1) stops_working 0.569 · 2) cannot_change_temperature 0.540↓ · 3) indicator_blinking 0.456↓ | ⚠️ ระบบเสนอผัง stops_working 0.569 (ไม่ควรมีผังตรง) | |
| [ ] | T044 | พัดลมตั้งพื้นส่ายไม่ได้ | 1) cannot_change_fan_speed 0.898 · 2) cannot_change_temperature 0.449↓ · 3) cannot_change_airflow_direction 0.425↓ | ⚠️ ระบบเสนอผัง cannot_change_fan_speed 0.898 (ไม่ควรมีผังตรง) | |
| [ ] | T045 | หม้อหุงข้าวไฟไม่ขึ้น | 1) stops_working 0.623 · 2) improper_airflow_temperature 0.576 · 3) timer_not_working 0.541↓ | ⚠️ ระบบเสนอผัง stops_working 0.623 (ไม่ควรมีผังตรง) | |
| [ ] | T046 | my refrigerator is making a strange noise | 1) condensation_indoor 0.473↓ · 2) unit_generating_noise 0.471↓ · 3) indicator_blinking 0.448↓ | ✅ ปฏิเสธถูก (คะแนนสูงสุด 0.473) | |
| [ ] | T047 | ทีวีเปิดไม่ติด | 1) stops_working 0.472↓ · 2) indicator_blinking 0.422↓ · 3) error_message 0.376↓ | ✅ ปฏิเสธถูก (คะแนนสูงสุด 0.472) | |

### ac_outside_manual — เรื่องแอร์ที่คู่มือหน้า 43–44 ไม่ครอบคลุม

| ตรวจ | ข้อ | คำค้น | 3 อันดับแรกที่ระบบให้ | ผล | หมายเหตุผู้ตรวจ |
|:-:|---|---|---|---|---|
| [ ] | T048 | น้ำยาแอร์หมดต้องเติมเมื่อไหร่ | 1) stops_working 0.781 · 2) improper_airflow_temperature 0.744 · 3) condensation_indoor 0.702 | ⚠️ ระบบเสนอผัง stops_working 0.781 (ไม่ควรมีผังตรง) | |
| [ ] | T049 | อยากล้างแอร์เองต้องถอดอะไรบ้าง | 1) stops_working 0.813 · 2) odors_from_unit 0.704 · 3) condensation_indoor 0.693 | ⚠️ ระบบเสนอผัง stops_working 0.813 (ไม่ควรมีผังตรง) | |
| [ ] | T050 | คอมเพรสเซอร์ไม่ทำงานต้องเปลี่ยนอะไหล่ไหม | 1) timer_not_working 0.435↓ · 2) remote_not_working 0.426↓ · 3) stops_working 0.336↓ | ✅ ปฏิเสธถูก (คะแนนสูงสุด 0.435) | |
| [ ] | T051 | อยากย้ายแอร์ไปติดอีกห้อง | 1) condensation_indoor 0.642 · 2) stops_working 0.626 · 3) improper_airflow_temperature 0.626 | ⚠️ ระบบเสนอผัง condensation_indoor 0.642 (ไม่ควรมีผังตรง) | |
| [ ] | T052 | แอร์กินไฟมากผิดปกติ | 1) odors_from_unit 0.861 · 2) stops_working 0.822 · 3) unit_generating_noise 0.778 | ⚠️ ระบบเสนอผัง odors_from_unit 0.861 (ไม่ควรมีผังตรง) | |
| [ ] | T053 | ขอราคาค่าบริการล้างแอร์ | 1) improper_airflow_temperature 0.709 · 2) condensation_indoor 0.690 · 3) stops_working 0.628 | ⚠️ ระบบเสนอผัง improper_airflow_temperature 0.709 (ไม่ควรมีผังตรง) | |

### unrelated — ไม่เกี่ยวกับเครื่องใช้ไฟฟ้า

| ตรวจ | ข้อ | คำค้น | 3 อันดับแรกที่ระบบให้ | ผล | หมายเหตุผู้ตรวจ |
|:-:|---|---|---|---|---|
| [ ] | T054 | วันนี้ฝนจะตกไหม | 1) stops_working 0.414↓ · 2) odors_from_unit 0.382↓ · 3) improper_airflow_temperature 0.369↓ | ✅ ปฏิเสธถูก (คะแนนสูงสุด 0.414) | |
| [ ] | T055 | แนะนำร้านอาหารแถวกำแพงแสน | 1) indicator_blinking 0.231↓ · 2) error_message 0.195↓ · 3) improper_airflow_temperature 0.175↓ | ✅ ปฏิเสธถูก (คะแนนสูงสุด 0.231) | |
| [ ] | T056 | ช่วยแก้การบ้านคณิตศาสตร์หน่อย | 1) improper_airflow_temperature 0.269↓ · 2) stops_working 0.251↓ · 3) water_drips_outdoor 0.230↓ | ✅ ปฏิเสธถูก (คะแนนสูงสุด 0.269) | |

---

## ข้อที่ควรตรวจก่อน (ผลไม่ใช่ ✅)

| ข้อ | คำค้น | เฉลย | ผล |
|---|---|---|---|
| T009 | air conditioner blowing warm air | improper_airflow_temperature | 🟡 ผังถูกอยู่อันดับ 2 (ยังอยู่ในรายการที่แสดง) |
| T013 | กดปุ่มเพิ่มลมแล้วความแรงไม่เปลี่ยน | cannot_change_fan_speed | ❌ ถูกปฏิเสธ (สูงสุด 0.522 < 0.55) → ผู้ใช้ถูกส่งต่อศูนย์บริการ |
| T017 | รีโมทหน้าจอไม่ติด สงสัยแบตหมด | remote_not_working | ❌ ถูกปฏิเสธ (สูงสุด 0.546 < 0.55) → ผู้ใช้ถูกส่งต่อศูนย์บริการ |
| T019 | ตั้งเวลาปิดตอนนอนแต่แอร์ไม่ปิดตามเวลา | timer_not_working | 🟡 ผังถูกอยู่อันดับ 3 (ยังอยู่ในรายการที่แสดง) |
| T028 | จอที่ตัวแอร์โชว์รหัสแปลกๆ | error_message | 🟡 ผังถูกอยู่อันดับ 2 (ยังอยู่ในรายการที่แสดง) |
| T029 | แอร์ขึ้นรหัสตัวเลข ต้องทำยังไง | error_message | ❌ ถูกปฏิเสธ (สูงสุด 0.519 < 0.55) → ผู้ใช้ถูกส่งต่อศูนย์บริการ |
| T034 | มีน้ำหยดจากท่อของเครื่องนอกบ้านตอนแอร์ทำงาน | water_drips_outdoor | 🟡 ผังถูกอยู่อันดับ 2 (ยังอยู่ในรายการที่แสดง) |
| T035 | ตรงข้อต่อท่อแอร์ด้านนอกมีน้ำหยด | water_drips_outdoor | 🟡 ผังถูกอยู่อันดับ 2 (ยังอยู่ในรายการที่แสดง) |
| T037 | ตัวเครื่องด้านในมีเม็ดน้ำเกาะเต็มไปหมด | condensation_indoor | 🟡 ผังถูกอยู่อันดับ 2 (ยังอยู่ในรายการที่แสดง) |
| T039 | ac indoor unit sweating | condensation_indoor | 🟠 ผังถูกอยู่อันดับ 2 แต่คะแนน 0.500 ต่ำกว่าเกณฑ์ (ไม่แสดง) |
| T043 | เตาไมโครเวฟไม่ร้อน | (นอกขอบเขต) | ⚠️ ระบบเสนอผัง stops_working 0.569 (ไม่ควรมีผังตรง) |
| T044 | พัดลมตั้งพื้นส่ายไม่ได้ | (นอกขอบเขต) | ⚠️ ระบบเสนอผัง cannot_change_fan_speed 0.898 (ไม่ควรมีผังตรง) |
| T045 | หม้อหุงข้าวไฟไม่ขึ้น | (นอกขอบเขต) | ⚠️ ระบบเสนอผัง stops_working 0.623 (ไม่ควรมีผังตรง) |
| T048 | น้ำยาแอร์หมดต้องเติมเมื่อไหร่ | (นอกขอบเขต) | ⚠️ ระบบเสนอผัง stops_working 0.781 (ไม่ควรมีผังตรง) |
| T049 | อยากล้างแอร์เองต้องถอดอะไรบ้าง | (นอกขอบเขต) | ⚠️ ระบบเสนอผัง stops_working 0.813 (ไม่ควรมีผังตรง) |
| T051 | อยากย้ายแอร์ไปติดอีกห้อง | (นอกขอบเขต) | ⚠️ ระบบเสนอผัง condensation_indoor 0.642 (ไม่ควรมีผังตรง) |
| T052 | แอร์กินไฟมากผิดปกติ | (นอกขอบเขต) | ⚠️ ระบบเสนอผัง odors_from_unit 0.861 (ไม่ควรมีผังตรง) |
| T053 | ขอราคาค่าบริการล้างแอร์ | (นอกขอบเขต) | ⚠️ ระบบเสนอผัง improper_airflow_temperature 0.709 (ไม่ควรมีผังตรง) |

หมายเหตุ: ข้อที่ผลไม่ใช่ ✅ ไม่ได้แปลว่าเฉลยผิด หลายข้อพลาดเพราะระบบอ่อนจริง (เช่น คำว่า "แอร์" ดึงทุกผังเข้าหากัน ดู `backend/docs/explained/11-threshold-from-tuning-set.md`) ให้ตรวจที่เฉลยและคำค้นเป็นหลัก
