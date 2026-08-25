# 💊 Prescription Reader — ระบบวิเคราะห์ใบสั่งยาอัจฉริยะ

ระบบแอปพลิเคชันเว็บอัจฉริยะสำหรับอ่านและวิเคราะห์รูปภาพใบสั่งยา (Prescription) ด้วยปัญญาประดิษฐ์ (AI) เพื่อแปลงข้อมูลทางการแพทย์ที่ซับซ้อนให้กลายเป็น **"คู่มือการทานยาและตารางปฏิทินยา"** ที่คนไข้ทั่วไปอ่านเข้าใจได้ง่ายทันทีในแบบโหมดสว่าง/มืด (Light & Dark Mode) 

---

## 🚀 ฟีเจอร์หลัก (Key Features)

* **📷 Prescription Scan (OCR & AI Extraction)**: อัปโหลดรูปภาพใบสั่งยา (รองรับไฟล์ `.jpg`, `.jpeg`, `.png`, `.webp` และไฟล์ `.heic` จาก iOS) ระบบ AI (Gemini 1.5 Flash) จะสกัดข้อมูล ยา, สรรพคุณ, วิธีกินยาอย่างละเอียด, และคำเตือนความปลอดภัยทางการแพทย์โดยอัตโนมัติ
* **📄 Detailed Medication Cards**: แสดงข้อมูลรายละเอียดการทานยาแยกเป็นการ์ดรายตัวอย่างชัดเจน พร้อมสีสัญลักษณ์แสดงข้อควรระวัง/คำเตือนพิเศษทางการแพทย์อย่างโดดเด่น
* **🗓️ Daily Pill Planner**: แสดงตารางเวลาทานยาตามช่วงเวลาของแต่ละวัน (เช้า, กลางวัน, เย็น, ก่อนนอน, ทานเมื่อมีอาการ) ในรูปแบบปฏิทินแบบมีแถบวันที่แนวนอน (Date Strip Navigator) 
* **📋 Scan History**: บันทึกประวัติการสแกนใบสั่งยาพร้อมรูปภาพพรีวิวต้นฉบับ สามารถกดดูข้อมูลย้อนหลัง หรือกดเรียกดูรูปภาพใบสั่งยาจริงแบบเต็มจอผ่านกล่อง Modal ได้
* **🌓 Light & Dark Theme**: รองรับการสลับโหมดหน้าจอสีสว่าง/มืด ปรับปรุงการแสดงผลและสีสันของตัวหนังสือให้อ่านง่าย สบายตา สอดคล้องกับมาตรฐาน Web Legibility

---

## 🛠️ เทคโนโลยีที่ใช้ (Tech Stack)

* **Backend**: Python 3.10+, FastAPI (เฟรมเวิร์กเว็บ API ความเร็วสูง)
* **AI Engine**: Google Gemini API (`google-generativeai` SDK) ใช้โมเดล **Gemini 1.5 Flash** ในการทำ Vision OCR และประมวลผลข้อมูลโครงสร้าง
* **Frontend**: HTML5, Vanilla CSS3 (CSS Custom Variables สำหรับจัดการระบบธีม), Vanilla JavaScript (ES6, Stateful Application)
* **Local Database**: บันทึกข้อมูลประวัติผู้ป่วยและยาในรูปแบบ JSON (`history.json`)
* **Local Storage**: เก็บไฟล์รูปภาพต้นฉบับของผู้ป่วยในเครื่องจำลอง (`private_uploads/`)

---

## 💻 การติดตั้งและเปิดใช้งานในเครื่อง (Local Setup)

### 1. โคลนคลังข้อมูล (Clone Repository)
```bash
git clone https://github.com/yourusername/prescription-reader.git
cd prescription-reader
```

### 2. ติดตั้ง Dependencies
```bash
pip install -r requirements.txt
```

### 3. ตั้งค่า Environment Variable (API Key)
1. ก๊อปปี้ไฟล์ `.env.example` แล้วเปลี่ยนชื่อเป็น `.env`:
   ```bash
   cp .env.example .env
   ```
2. เปิดไฟล์ `.env` แล้วนำ **Gemini API Key** ของคุณมาใส่:
   ```env
   GOOGLE_API_KEY="AIzaSy..."
   ```

### 4. รันแอปพลิเคชัน
```bash
python3 app.py
```
*เปิดเว็บเบราว์เซอร์แล้วเข้าไปใช้งานที่: **[http://localhost:8000](http://localhost:8000)***

---
## 🔒 ความปลอดภัยของข้อมูลคนไข้ (Data Privacy)

* ไฟล์รูปภาพคนไข้ทั้งหมดจะเก็บอยู่ในโฟลเดอร์ `private_uploads/` และข้อมูลประวัติทั้งหมดจะบันทึกใน `history.json`
* ทั้งสองโฟลเดอร์นี้ถูกตั้งค่าละเว้นไว้ในไฟล์ `.gitignore` เรียบร้อยแล้ว ข้อมูลสุขภาพจริงของผู้ป่วยจะไม่หลุดขึ้นไปยัง GitHub สาธารณะเด็ดขาด
