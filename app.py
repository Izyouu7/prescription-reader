#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Prescription Reader Web App — Backend (FastAPI)
"""

import os
import sys
import json
import uuid
import tempfile
import threading
from io import BytesIO
from pathlib import Path
from datetime import datetime

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from starlette.requests import Request
from PIL import Image

try:
    import pillow_heif
    pillow_heif.register_heif_opener()
    HEIC_SUPPORT = True
except ImportError:
    HEIC_SUPPORT = False

try:
    import google.generativeai as genai
except ImportError:
    print("❌ Error: 'google-generativeai' package is not installed.")
    print("pip install google-generativeai")
    sys.exit(1)

from dotenv import load_dotenv
load_dotenv()

BASE_DIR = Path(__file__).parent
UPLOAD_DIR = BASE_DIR / "private_uploads"
HISTORY_FILE = BASE_DIR / "history.json"
MAX_UPLOAD_BYTES = 10 * 1024 * 1024
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".heic"}
HISTORY_LOCK = threading.Lock()
GEMINI_API_KEY = os.environ.get("GOOGLE_API_KEY") or os.environ.get("GEMINI_API_KEY")

UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

if not GEMINI_API_KEY:
    raise RuntimeError("❌ Error: ไม่พบ API Key กรุณากำหนด environment variable GOOGLE_API_KEY หรือสร้างไฟล์ .env")

genai.configure(api_key=GEMINI_API_KEY)

SYSTEM_INSTRUCTION = """คุณคือเภสัชกรอัจฉริยะและผู้ช่วยทางการแพทย์ (Medical AI Assistant) หน้าที่ของคุณคือวิเคราะห์รูปภาพใบสั่งยา (Prescription) และสกัดข้อมูลเพื่อสร้างคู่มือการทานยาที่คนไข้ทั่วไปอ่านเข้าใจได้ทันที

กฎกติกาการสกัดข้อมูล:
1. วิเคราะห์หาข้อมูลชื่อโรงพยาบาล/คลินิก, วันที่สั่งยา (ปี ค.ศ. หรือ พ.ศ.), และชื่อผู้ป่วย
2. ดึงรายการยาทั้งหมดที่ปรากฏ ในแต่ละรายการยาให้ระบุ:
   - ชื่อยา (Drug Name) ทั้งภาษาอังกฤษและภาษาไทยถ้ามี
   - ความเข้มข้น/ความแรง (Strength) เช่น 500mg, 10ml
   - รูปแบบยา (Dosage form) เช่น เม็ด (Tablet), แคปซูล (Capsule), ยาน้ำ (Syrup)
   - จำนวนยาที่จ่าย (Quantity) เช่น 15 แคปซูล, 1 ขวด
   - วิธีใช้ยาภาษาไทยแบบเข้าใจง่าย (thai_instruction) แปลงจากอักษรย่อแพทย์ เช่น:
     * '1 cap tid pc' -> 'กินครั้งละ 1 แคปซูล วันละ 3 ครั้ง หลังอาหาร เช้า-กลางวัน-เย็น'
     * '1 tab q4-6h prn' -> 'กินครั้งละ 1 เม็ด ทุก 4-6 ชั่วโมง เมื่อมีอาการปวดหรือไข้'
   - สรรพคุณอย่างง่าย (purpose) อธิบายคำศัพท์แพทย์ง่ายๆ
   - ข้อควรระวังพิเศษ (warnings)
   - ระบุช่วงเวลาทานยา (schedule) เลือกจากรายการ: 'เช้า', 'กลางวัน', 'เย็น', 'ก่อนนอน', 'ตามอาการ'
3. สรุปตารางการรับประทานยารายวัน (daily_schedule)

คุณต้องตอบกลับเป็นข้อมูล JSON ที่ถูกต้องและครบถ้วนตามโครงสร้างด้านล่างนี้เท่านั้น ห้ามพิมพ์คำอธิบายอื่นนอกเหนือจาก JSON:
{
  "hospital_name": "ชื่อโรงพยาบาล/คลินิก",
  "prescription_date": "วันที่บนใบสั่งยา",
  "patient_name": "ชื่อผู้ป่วย",
  "medications": [
    {
      "name": "ชื่อยา",
      "strength": "ความแรงยา",
      "dosage_form": "รูปแบบยา",
      "quantity": "จำนวนที่ได้รับ",
      "thai_instruction": "วิธีใช้ภาษาไทยเข้าใจง่าย",
      "purpose": "สรรพคุณอย่างง่าย",
      "warnings": "ข้อควรระวัง/คำเตือนพิเศษ",
      "schedule": ["เช้า", "กลางวัน", "เย็น", "ก่อนนอน", "ตามอาการ"],
      "duration_days": 0
    }
  ],
  "daily_schedule": {
    "เช้า": [],
    "กลางวัน": [],
    "เย็น": [],
    "ก่อนนอน": [],
    "ตามอาการ": []
  }
}
"""

app = FastAPI(title="Prescription Reader")
app.mount("/static", StaticFiles(directory=str(BASE_DIR / "static")), name="static")
templates = Jinja2Templates(directory=str(BASE_DIR / "templates"))


def load_history():
    if HISTORY_FILE.exists():
        try:
            with open(HISTORY_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except json.JSONDecodeError as exc:
            raise HTTPException(status_code=500, detail="ไม่สามารถอ่านประวัติที่บันทึกไว้ได้") from exc
    return []


def save_history(history):
    # Write-and-replace prevents a partially written JSON file after an interruption.
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=BASE_DIR, delete=False) as f:
        json.dump(history, f, ensure_ascii=False, indent=2)
        temp_path = Path(f.name)
    temp_path.replace(HISTORY_FILE)


def analyze_image(image_path):
    with Image.open(image_path) as image:
        model = genai.GenerativeModel(
            model_name="gemini-3.5-flash-lite",
            system_instruction=SYSTEM_INSTRUCTION
        )
        response = model.generate_content(
            [image, "โปรดวิเคราะห์ใบสั่งยานี้และดึงข้อมูลตามคำสั่ง"],
            generation_config={"response_mime_type": "application/json"}
        )
    result = json.loads(response.text)
    if not isinstance(result, dict) or not isinstance(result.get("medications", []), list):
        raise ValueError("ผลลัพธ์จาก AI ไม่อยู่ในรูปแบบที่คาดไว้")
    return result


def find_history_entry(entry_id):
    for entry in load_history():
        if entry["id"] == entry_id:
            return entry
    return None


@app.get("/", response_class=HTMLResponse)
async def home(request: Request):
    return templates.TemplateResponse(request, "index.html")


@app.post("/api/analyze")
def api_analyze(file: UploadFile = File(...)):
    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"ไม่รองรับไฟล์ประเภท {ext}")

    if ext == ".heic" and not HEIC_SUPPORT:
        raise HTTPException(
            status_code=400,
            detail="เครื่องเซิร์ฟเวอร์ยังไม่ได้ติดตั้งการรองรับไฟล์ .heic (จาก iPhone) กรุณาอัปโหลดเป็นไฟล์ JPG/PNG หรือติดตั้งด้วยคำสั่ง: pip install pillow-heif"
        )

    content = file.file.read(MAX_UPLOAD_BYTES + 1)
    if not content:
        raise HTTPException(status_code=400, detail="ไฟล์ว่างเปล่า")
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="ไฟล์มีขนาดเกิน 10 MB")

    # Verify image bytes rather than trusting the user-supplied filename.
    expected_formats = {
        ".jpg": {"JPEG"}, ".jpeg": {"JPEG"}, ".png": {"PNG"},
        ".webp": {"WEBP"}, ".heic": {"HEIF", "HEIC"},
    }
    try:
        with Image.open(BytesIO(content)) as image:
            if image.format not in expected_formats[ext]:
                raise ValueError("ชนิดข้อมูลรูปภาพไม่ตรงกับนามสกุลไฟล์")
            image.verify()
    except Exception as exc:
        raise HTTPException(status_code=400, detail="ไฟล์ที่อัปโหลดไม่ใช่รูปภาพที่รองรับ") from exc

    file_id = str(uuid.uuid4())
    filename = f"{file_id}{ext}"
    file_path = UPLOAD_DIR / filename
    file_path.write_bytes(content)

    try:
        result = analyze_image(file_path)
    except Exception as exc:
        file_path.unlink(missing_ok=True)
        raise HTTPException(status_code=502, detail="วิเคราะห์ใบสั่งยาไม่สำเร็จ กรุณาลองใหม่อีกครั้ง") from exc

    with HISTORY_LOCK:
        history = load_history()
        entry = {
            "id": file_id,
            "filename": filename,
            "original_name": Path(file.filename or "").name,
            "timestamp": datetime.now().isoformat(),
            "patient_name": result.get("patient_name", "ไม่ระบุ"),
            "hospital_name": result.get("hospital_name", "ไม่ระบุ"),
            "medication_count": len(result.get("medications", [])),
            "result": result
        }
        history.insert(0, entry)
        save_history(history)

    return JSONResponse(content={"success": True, "data": entry})


@app.get("/api/history")
async def api_history():
    history = load_history()
    summaries = []
    for h in history:
        summaries.append({
            "id": h["id"],
            "filename": h["filename"],
            "original_name": h.get("original_name", ""),
            "timestamp": h["timestamp"],
            "patient_name": h.get("patient_name", ""),
            "hospital_name": h.get("hospital_name", ""),
            "medication_count": h.get("medication_count", 0),
        })
    return JSONResponse(content=summaries)


@app.get("/api/history/{entry_id}")
async def api_history_detail(entry_id: str):
    entry = find_history_entry(entry_id)
    if entry:
        return JSONResponse(content=entry)
    raise HTTPException(status_code=404, detail="ไม่พบรายการนี้")


@app.get("/api/uploads/{entry_id}")
async def api_upload(entry_id: str):
    entry = find_history_entry(entry_id)
    if not entry:
        raise HTTPException(status_code=404, detail="ไม่พบรูปภาพ")
    file_path = UPLOAD_DIR / Path(entry["filename"]).name
    if not file_path.is_file():
        raise HTTPException(status_code=404, detail="ไม่พบรูปภาพ")
    return FileResponse(file_path)


@app.delete("/api/history/{entry_id}")
async def api_history_delete(entry_id: str):
    with HISTORY_LOCK:
        history = load_history()
        entry = next((h for h in history if h["id"] == entry_id), None)
        if not entry:
            raise HTTPException(status_code=404, detail="ไม่พบรายการนี้")
        file_path = UPLOAD_DIR / Path(entry["filename"]).name
        file_path.unlink(missing_ok=True)
        save_history([h for h in history if h["id"] != entry_id])
    return JSONResponse(content={"success": True})


if __name__ == "__main__":
    import uvicorn
    print("🚀 Starting Prescription Reader Web App...")
    print("📱 เปิดเบราว์เซอร์ที่: http://localhost:8000")
    uvicorn.run(app, host="127.0.0.1", port=8000)
