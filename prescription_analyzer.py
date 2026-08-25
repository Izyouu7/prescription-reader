#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import sys
import json
import argparse
from pathlib import Path
from PIL import Image

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

GEMINI_API_KEY = os.environ.get("GOOGLE_API_KEY", "")

try:
    import google.generativeai as genai
except ImportError:
    print("❌ Error: 'google-generativeai' package is not installed.")
    print("Please install it using: pip install google-generativeai pillow")
    sys.exit(1)

def parse_args():
    parser = argparse.ArgumentParser(description="วิเคราะห์รูปภาพใบสั่งยาด้วย Gemini 3.5 Flash")
    parser.add_argument(
        "--image", 
        type=str, 
        default=str(Path(__file__).parent / "782168926_1411416884428109_3523294210919159118_n.jpg"),
        help="Path ไปยังรูปภาพใบสั่งยา"
    )
    
    # Allow an explicit CLI key, otherwise use the environment variable.
    api_key_default = GEMINI_API_KEY
        
    parser.add_argument(
        "--api-key",
        type=str,
        default=api_key_default,
        help="Google Gemini API Key (หากไม่มีจะดึงจาก Environment Variable: GOOGLE_API_KEY)"
    )
    return parser.parse_args()

SYSTEM_INSTRUCTION = """คุณคือเภสัชกรอัจฉริยะและผู้ช่วยทางการแพทย์ (Medical AI Assistant) หน้าที่ของคุณคือวิเคราะห์รูปภาพใบสั่งยา (Prescription) และสกัดข้อมูลเพื่อสร้างคู่มือการทานยาที่คนไข้ทั่วไปอ่านเข้าใจได้ทันที

กฎกติกาการสกัดข้อมูล:
1. วิเคราะห์หาข้อมูลชื่อโรงพยาบาล/คลินิก, วันที่สั่งยา (ปี ค.ศ. หรือ พ.ศ.), และชื่อผู้ป่วย
2. ดึงรายการยาทั้งหมดที่ปรากฏ ในแต่ละรายการยาให้ระบุ:
   - ชื่อยา (Drug Name) ทั้งภาษาอังกฤษและภาษาไทยถ้ามี
   - ความเข้มข้น/ความแรง (Strength) เช่น 500mg, 10ml
   - รูปรูปแบบยา (Dosage form) เช่น เม็ด (Tablet), แคปซูล (Capsule), ยาน้ำ (Syrup)
   - จำนวนยาที่จ่าย (Quantity) เช่น 15 แคปซูล, 1 ขวด
   - วิธีใช้ยาภาษาไทยแบบเข้าใจง่าย (thai_instruction) แปลงจากอักษรย่อแพทย์ เช่น:
     * '1 cap tid pc' -> 'กินครั้งละ 1 แคปซูล วันละ 3 ครั้ง หลังอาหาร เช้า-กลางวัน-เย็น'
     * '1 tab q4-6h prn' -> 'กินครั้งละ 1 เม็ด ทุก 4-6 ชั่วโมง เมื่อมีอาการปวดหรือไข้'
     * '1 tab ac' -> 'กินครั้งละ 1 เม็ด ก่อนอาหาร'
     * '1 tab hs' -> 'กินครั้งละ 1 เม็ด ก่อนนอน'
   - สรรพคุณอย่างง่าย (purpose) อธิบายคำศัพท์แพทย์ง่ายๆ เช่น 'ยาฆ่าเชื้อ/ยาปฏิชีวนะ', 'ยาบรรเทาอาการปวดหรือลดไข้'
   - ข้อควรระวังพิเศษ (warnings) เช่น 'ต้องทานติดต่อกันจนหมดเพื่อป้องกันการดื้อยา', 'ทานแล้วอาจง่วงนอน หลีกเลี่ยงการขับรถ'
   - ระบุช่วงเวลาทานยา (schedule) เลือกจากรายการ: 'เช้า', 'กลางวัน', 'เย็น', 'ก่อนนอน', 'ตามอาการ' (ระบุได้มากกว่า 1 ช่วงเวลา)
3. สรุปตารางการรับประทานยารายวัน (daily_schedule) โดยจัดกลุ่มยาทั้งหมดเข้าช่วงเวลาต่างๆ เช่น 'เช้า', 'กลางวัน', 'เย็น', 'ก่อนนอน', 'ตามอาการ'

คุณต้องตอบกลับเป็นข้อมูล JSON ที่ถูกต้องและครบถ้วนตามโครงสร้างด้านล่างนี้เท่านั้น ห้ามพิมพ์คำอธิบายอื่นนอกเหนือจาก JSON:
{
  "hospital_name": "ชื่อโรงพยาบาล/คลินิก",
  "prescription_date": "วันที่บนใบสั่งยา (YYYY-MM-DD หรือรูปแบบที่อ่านได้)",
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
      "schedule": ["เช้า", "กลางวัน", "เย็น", "ก่อนนอน", "ตามอาการ"]
    }
  ],
  "daily_schedule": {
    "เช้า": ["ชื่อยาและขนาดทานยา (เช่น Amoxicillin 500mg - 1 แคปซูล)"],
    "กลางวัน": [],
    "เย็น": [],
    "ก่อนนอน": [],
    "ตามอาการ": []
  }
}
"""

def print_styled_dashboard(data):
    print("\n" + "="*70)
    print(f"🏥 สรุปใบสั่งยาอัจฉริยะ | {data.get('hospital_name', 'ไม่ระบุโรงพยาบาล')}")
    print("="*70)
    print(f"👤 คนไข้: {data.get('patient_name', 'ไม่ระบุชื่อ')}")
    print(f"📅 วันที่สั่งยา: {data.get('prescription_date', 'ไม่ระบุวันที่')}")
    print("-"*70)
    
    print("\n💊 รายการยาและสรรพคุณ:")
    for idx, med in enumerate(data.get("medications", []), 1):
        print(f" {idx}. {med.get('name')} {med.get('strength', '')} ({med.get('quantity', '')} {med.get('dosage_form', '')})")
        print(f"    • สรรพคุณ: {med.get('purpose')}")
        print(f"    • วิธีทาน: {med.get('thai_instruction')}")
        if med.get('warnings'):
            print(f"    • ⚠️ ข้อควรระวัง: {med.get('warnings')}")
        print("-" * 50)
        
    print("\n📅 ตารางเวลาทานยารายวัน (Daily Pill Schedule):")
    daily = data.get("daily_schedule", {})
    
    time_emojis = {
        "เช้า": "☀️ เช้า (หลังอาหาร/ก่อนอาหาร)",
        "กลางวัน": "🌤️ กลางวัน (หลังอาหาร/ก่อนอาหาร)",
        "เย็น": "🌙 เย็น (หลังอาหาร/ก่อนอาหาร)",
        "ก่อนนอน": "💤 ก่อนนอน",
        "ตามอาการ": "🤒 ทานเมื่อมีอาการ"
    }
    
    has_schedule = False
    for time_key, emoji_title in time_emojis.items():
        meds = daily.get(time_key, [])
        if meds:
            has_schedule = True
            print(f" [{emoji_title}]")
            for item in meds:
                print(f"   - {item}")
    
    if not has_schedule:
        print("   (ไม่พบตารางการทานยาปกติ ให้ทานตามวิธีกินยาของแต่ละรายการ)")
        
    print("="*70)

def main():
    args = parse_args()
    
    api_key = args.api_key
    if not api_key:
        print("❌ Error: ไม่พบ Gemini API Key")
        print("กรุณากำหนด Environment Variable: export GOOGLE_API_KEY='your_key'")
        print("หรือส่งผ่าน --api-key")
        sys.exit(1)
        
    image_path = Path(args.image)
    if not image_path.exists():
        print(f"❌ Error: ไม่พบไฟล์รูปภาพที่: {image_path}")
        sys.exit(1)
        
    print(f"🔄 กำลังโหลดรูปภาพ: {image_path.name}")
    try:
        image = Image.open(image_path)
    except Exception as e:
        print(f"❌ Error: ไม่สามารถเปิดรูปภาพได้: {e}")
        sys.exit(1)
        
    print("🔄 กำลังติดต่อ Gemini API (gemini-3.5-flash)...")
    genai.configure(api_key=api_key)
    
    model = genai.GenerativeModel(
        model_name="gemini-3.5-flash-lite",
        system_instruction=SYSTEM_INSTRUCTION
    )
    
    try:
        response = model.generate_content(
            [image, "โปรดวิเคราะห์ใบสั่งยานี้และดึงข้อมูลตามคำสั่ง"],
            generation_config={"response_mime_type": "application/json"}
        )
        
        # Parse output JSON
        result_json = json.loads(response.text)
        
        # พิมพ์หน้าจอแบบสวยงาม
        print_styled_dashboard(result_json)
        
        # บันทึกผลลัพธ์เป็นไฟล์ JSON เผื่อใช้ต่อ
        output_json_path = image_path.with_suffix(".json")
        with open(output_json_path, "w", encoding="utf-8") as f:
            json.dump(result_json, f, ensure_ascii=False, indent=2)
        print(f"\n💾 บันทึกผลลัพธ์โครงสร้าง JSON เรียบร้อยแล้วที่: {output_json_path.name}")
        
    except Exception as e:
        print(f"❌ เกิดข้อผิดพลาดในการเรียกใช้งานโมเดล: {e}")
        print("ข้อมูลตอบกลับดิบจากโมเดล (หากมี):")
        try:
            print(response.text)
        except:
            pass
        sys.exit(1)

if __name__ == "__main__":
    main()
