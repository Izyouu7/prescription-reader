/* ═══════════════════════════════════════════════════════
   Prescription Reader — Frontend Logic (v3)
   + Monthly Calendar Grid
   + Date Range Medication Mapping
   + Interactive Pop-up Modals
   ═══════════════════════════════════════════════════════ */

const escapeHtml = (value) => String(value ?? '').replace(/[&<>'\"]/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
})[char]);

const App = {
  selectedFile: null,
  lastResult: null,
  currentDate: new Date(), // For monthly calendar navigation
  historyEntries: [],

  // ─── Navigation ──────────────────────────────────────
  navigate(page) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

    const pageEl = document.getElementById(`page-${page}`);
    const navEl = document.querySelector(`.nav-item[data-page="${page}"]`);

    if (pageEl) pageEl.classList.add('active');
    if (navEl) navEl.classList.add('active');

    if (page === 'result') {
      const emptyStateEl = document.getElementById('result-empty-state');
      const contentWrapEl = document.getElementById('result-content-wrap');
      if (this.lastResult) {
        if (emptyStateEl) emptyStateEl.style.display = 'none';
        if (contentWrapEl) contentWrapEl.style.display = 'block';
      } else {
        if (emptyStateEl) emptyStateEl.style.display = 'block';
        if (contentWrapEl) contentWrapEl.style.display = 'none';
      }
    }

    if (page === 'history') this.loadHistory();
    if (page === 'calendar') this.loadCalendar();
  },

  goToUpload() { this.navigate('upload'); },
  goToResult() { this.navigate('result'); },
  goToHistory() { this.navigate('history'); },
  goToCalendar() { this.navigate('calendar'); },

  // ─── File Handling & Init ────────────────────────────
  init() {
    this.initTheme();
    const uploadZone = document.getElementById('upload-zone');
    const fileInput = document.getElementById('file-input');
    const cameraInput = document.getElementById('camera-input');
    const btnBrowse = document.getElementById('btn-browse');
    const btnCamera = document.getElementById('btn-camera');
    const btnAnalyze = document.getElementById('btn-analyze');
    const btnRemove = document.getElementById('btn-remove');

    uploadZone.addEventListener('click', () => fileInput.click());

    uploadZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      uploadZone.classList.add('dragover');
    });

    uploadZone.addEventListener('dragleave', () => {
      uploadZone.classList.remove('dragover');
    });

    uploadZone.addEventListener('drop', (e) => {
      e.preventDefault();
      uploadZone.classList.remove('dragover');
      const files = e.dataTransfer.files;
      if (files.length > 0) this.setFile(files[0]);
    });

    btnBrowse.addEventListener('click', () => fileInput.click());
    btnCamera.addEventListener('click', () => cameraInput.click());
    btnAnalyze.addEventListener('click', () => this.analyzeImage());
    btnRemove.addEventListener('click', () => this.clearFile());

    fileInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) this.setFile(e.target.files[0]);
    });

    cameraInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) this.setFile(e.target.files[0]);
    });
  },

  setFile(file) {
    this.selectedFile = file;
    const uploadZone = document.getElementById('upload-zone');
    const previewContainer = document.getElementById('preview-container');
    const previewImage = document.getElementById('preview-image');
    const previewFilename = document.getElementById('preview-filename');
    const btnAnalyze = document.getElementById('btn-analyze');

    const reader = new FileReader();
    reader.onload = (e) => {
      previewImage.src = e.target.result;
      uploadZone.style.display = 'none';
      previewContainer.classList.add('active');
      previewFilename.textContent = file.name;
      btnAnalyze.disabled = false;
    };
    reader.readAsDataURL(file);
  },

  clearFile() {
    this.selectedFile = null;
    document.getElementById('upload-zone').style.display = '';
    document.getElementById('preview-container').classList.remove('active');
    document.getElementById('btn-analyze').disabled = true;
    document.getElementById('file-input').value = '';
    document.getElementById('camera-input').value = '';
  },

  // ─── API Call ────────────────────────────────────────
  async analyzeImage() {
    if (!this.selectedFile) return;

    const loading = document.getElementById('loading-overlay');
    loading.classList.add('active');

    const formData = new FormData();
    formData.append('file', this.selectedFile);

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.detail || 'เกิดข้อผิดพลาด');
      }

      const data = await response.json();
      this.lastResult = data.data;
      this.renderResult(data.data);
      this.clearFile();
      this.navigate('result');

    } catch (err) {
      alert('❌ ' + err.message);
    } finally {
      loading.classList.remove('active');
    }
  },


  // ─── Render Result ───────────────────────────────────
  renderResult(entry) {
    const result = entry.result;

    // Patient info
    const patientEl = document.getElementById('result-patient');
    patientEl.innerHTML = `
      <div class="patient-info">
        <div class="info-row">
          <span class="info-icon">🏥</span>
          <span class="info-label">สถานพยาบาล</span>
          <span class="info-value">${escapeHtml(result.hospital_name || 'ไม่ระบุ')}</span>
        </div>
        <div class="info-row">
          <span class="info-icon">👤</span>
          <span class="info-label">คนไข้</span>
          <span class="info-value">${escapeHtml(result.patient_name || 'ไม่ระบุ')}</span>
        </div>
        <div class="info-row">
          <span class="info-icon">📅</span>
          <span class="info-label">วันที่สั่งยา</span>
          <span class="info-value">${escapeHtml(result.prescription_date || 'ไม่ระบุ')}</span>
        </div>
      </div>
    `;

    // Image Preview
    const imgCard = document.getElementById('result-image-card');
    const imgEl = document.getElementById('result-prescription-img');
    if (entry.id) {
      imgEl.src = `/api/uploads/${encodeURIComponent(entry.id)}`;
      imgCard.style.display = '';
    } else {
      imgCard.style.display = 'none';
    }

    // Medications list (detailed cards layout)
    const medsEl = document.getElementById('result-medications');
    const meds = result.medications || [];
    let medsHTML = '<div class="section-title">💊 รายการยาและวิธีกิน</div>';

    meds.forEach((med, i) => {
      const warningHTML = med.warnings
        ? `<div class="med-warning"><span>⚠️</span><span>${escapeHtml(med.warnings)}</span></div>`
        : '';

      medsHTML += `
        <div class="glass-card med-card animate-in" style="animation-delay:${i * 0.1}s">
          <div class="med-name">${escapeHtml(med.name)} ${escapeHtml(med.strength)}</div>
          <div class="med-detail"><span class="detail-icon">💊</span>${escapeHtml(med.dosage_form || '')} — จำนวน ${escapeHtml(med.quantity || 'ไม่ระบุ')}</div>
          <div class="med-detail"><span class="detail-icon">📌</span>${escapeHtml(med.purpose || '')}</div>
          <div class="med-instruction">
            <strong>วิธีทาน:</strong> ${escapeHtml(med.thai_instruction || 'ไม่ระบุ')}
          </div>
          ${warningHTML}
        </div>
      `;
    });
    medsEl.innerHTML = medsHTML;
  },

  // ─── Daily Pill Planner ──────────────────────────────
  selectedDate: new Date(),
  weekOffset: 0,
  plannerMeds: [],

  shiftWeek(direction) {
    this.weekOffset += direction;
    // Shift selected date by 7 days so it stays in the visible week strip
    const newSel = new Date(this.selectedDate);
    newSel.setDate(newSel.getDate() + (direction * 7));
    this.selectedDate = newSel;
    this.renderDateStrip();
    this.renderDailySchedule();
  },

  selectDate(dateStr) {
    this.selectedDate = new Date(dateStr);
    // Recalculate weekOffset so the selected date is visible
    this.renderDateStrip();
    this.renderDailySchedule();
  },

  goToToday() {
    this.selectedDate = new Date();
    this.weekOffset = 0;
    this.renderDateStrip();
    this.renderDailySchedule();
  },

  async loadCalendar() {
    try {
      const response = await fetch('/api/history');
      const items = await response.json();
      this.historyEntries = items;

      const allMeds = [];
      for (const item of items) {
        const detailRes = await fetch(`/api/history/${item.id}`);
        const detail = await detailRes.json();
        if (detail.result && detail.result.medications) {
          detail.result.medications.forEach(med => {
            allMeds.push({
              ...med,
              patient: detail.result.patient_name,
              hospital: detail.result.hospital_name,
              scanTimestamp: detail.timestamp,
              prescriptionDate: detail.result.prescription_date
            });
          });
        }
      }

      this.plannerMeds = allMeds;
      this.allMeds = allMeds;
      this.renderDateStrip();
      this.renderDailySchedule();
    } catch (err) {
      console.error('Calendar load failed:', err);
    }
  },

  parseDate(dateStr, fallbackIso) {
    if (!dateStr) return new Date(fallbackIso);
    const thaiDate = String(dateStr).trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (thaiDate) {
      const [, day, month, rawYear] = thaiDate;
      const year = Number(rawYear) > 2400 ? Number(rawYear) - 543 : Number(rawYear);
      const d = new Date(year, Number(month) - 1, Number(day));
      if (d.getFullYear() === year && d.getMonth() === Number(month) - 1 && d.getDate() === Number(day)) return d;
    }
    let d = new Date(dateStr);
    if (!isNaN(d.getTime())) return d;
    return new Date(fallbackIso);
  },

  calculateDuration(med) {
    const duration = Number(med.duration_days);
    return Number.isInteger(duration) && duration > 0 ? duration : 7;
  },

  getActiveMedsForDate(targetDate) {
    const active = [];
    const seenActive = new Set();
    const td = new Date(targetDate);
    td.setHours(0, 0, 0, 0);

    this.plannerMeds.forEach(med => {
      const startDate = this.parseDate(med.prescriptionDate, med.scanTimestamp);
      startDate.setHours(0, 0, 0, 0);
      const duration = this.calculateDuration(med);
      const endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + duration - 1);
      endDate.setHours(23, 59, 59, 999);

      if (td >= startDate && td <= endDate) {
        // Deduplicate overlapping medications with identical names, strengths, and instructions
        const key = `${med.name}-${med.strength || ''}-${med.thai_instruction || ''}`;
        if (!seenActive.has(key)) {
          seenActive.add(key);
          active.push(med);
        }
      }
    });
    return active;
  },

  renderDateStrip() {
    const strip = document.getElementById('date-strip');
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const daysThai = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];

    // Calculate the start of the 7-day window
    const baseDate = new Date(today);
    baseDate.setDate(baseDate.getDate() + (this.weekOffset * 7));
    // Start from Monday of that week
    const dayOfWeek = baseDate.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const weekStart = new Date(baseDate);
    weekStart.setDate(baseDate.getDate() + mondayOffset);

    let html = '';
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      d.setHours(0, 0, 0, 0);

      const isToday = d.toDateString() === today.toDateString();
      const isSelected = d.toDateString() === this.selectedDate.toDateString();
      const activeMeds = this.getActiveMedsForDate(d);
      const hasMeds = activeMeds.length > 0;

      html += `
        <button class="date-chip ${isSelected ? 'selected' : ''} ${isToday ? 'is-today' : ''}"
                onclick="App.selectDate('${d.toISOString()}')">
          <span class="date-chip-day">${daysThai[d.getDay()]}</span>
          <span class="date-chip-num">${d.getDate()}</span>
          ${hasMeds ? `<span class="date-chip-dot">${activeMeds.length}</span>` : ''}
        </button>
      `;
    }

    strip.innerHTML = html;
  },

  renderDailySchedule() {
    const container = document.getElementById('planner-daily-schedule');
    const dateLabel = document.getElementById('planner-date-label');

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const sel = new Date(this.selectedDate);
    sel.setHours(0, 0, 0, 0);

    const isToday = sel.toDateString() === today.toDateString();

    // Date label
    const monthsThai = [
      'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
      'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
    ];
    const dateText = `${sel.getDate()} ${monthsThai[sel.getMonth()]} ${sel.getFullYear() + 543}`;
    const todayBadge = isToday ? '<span class="today-badge">วันนี้</span>' : '';
    const todayBtn = !isToday ? '<button class="btn-go-today" onclick="App.goToToday()">กลับวันนี้</button>' : '';
    dateLabel.innerHTML = `<div class="planner-date-text">${todayBadge} ${dateText}</div>${todayBtn}`;

    // Get active meds
    const activeMeds = this.getActiveMedsForDate(sel);

    if (this.plannerMeds.length === 0) {
      container.innerHTML = `
        <div class="planner-empty glass-card">
          <span class="planner-empty-icon">💊</span>
          <p>ยังไม่มีข้อมูลยา</p>
          <p class="planner-empty-hint">สแกนใบสั่งยาเพื่อสร้างตารางกินยาอัตโนมัติ</p>
          <button class="btn btn-primary" onclick="App.goToUpload()">📷 สแกนใบสั่งยา</button>
        </div>
      `;
      return;
    }

    if (activeMeds.length === 0) {
      container.innerHTML = `
        <div class="planner-empty glass-card">
          <span class="planner-empty-icon">✅</span>
          <p>ไม่มียาที่ต้องทานในวันนี้</p>
          <p class="planner-empty-hint">ไม่มีรายการยาที่ยังอยู่ในช่วงที่ต้องรับประทาน</p>
        </div>
      `;
      return;
    }

    // Group by schedule
    const slots = [
      { key: 'เช้า', icon: '☀️', label: 'เช้า', sublabel: 'หลังตื่นนอน / ก่อน-หลังอาหาร', cls: 'morning' },
      { key: 'กลางวัน', icon: '🌤️', label: 'กลางวัน', sublabel: 'ก่อน-หลังอาหารกลางวัน', cls: 'noon' },
      { key: 'เย็น', icon: '🌙', label: 'เย็น', sublabel: 'ก่อน-หลังอาหารเย็น', cls: 'evening' },
      { key: 'ก่อนนอน', icon: '💤', label: 'ก่อนนอน', sublabel: 'ก่อนเข้านอน', cls: 'bedtime' },
      { key: 'ตามอาการ', icon: '🤒', label: 'เมื่อมีอาการ', sublabel: 'ทานเฉพาะเมื่อจำเป็น', cls: 'as-needed' },
    ];

    let html = '<div class="schedule-cards-grid">';
    let renderedAny = false;

    slots.forEach(slot => {
      const medsInSlot = activeMeds.filter(m => (m.schedule || []).includes(slot.key));
      if (medsInSlot.length === 0) return;
      renderedAny = true;

      let pillsHTML = '';
      medsInSlot.forEach(med => {
        const medIndex = this.plannerMeds.indexOf(med);
        pillsHTML += `
          <div class="sched-pill" style="cursor:pointer" onclick="App.showMedModal(${medIndex})">
            <span class="sched-pill-icon">💊</span>
            <div class="sched-pill-info">
              <div class="sched-pill-name">${escapeHtml(med.name)} ${escapeHtml(med.strength)}</div>
              <div class="sched-pill-dose">${escapeHtml(med.thai_instruction)}</div>
            </div>
            <span class="summary-med-arrow">›</span>
          </div>
        `;
      });

      html += `
        <div class="sched-card sched-card--${slot.cls} animate-in">
          <div class="sched-card-header">
            <span class="sched-card-icon">${slot.icon}</span>
            <div class="sched-card-titles">
              <div class="sched-card-label">${slot.label}</div>
              <div class="sched-card-sublabel">${slot.sublabel}</div>
            </div>
            <div class="sched-card-count">${medsInSlot.length} รายการ</div>
          </div>
          <div class="sched-card-body">
            ${pillsHTML}
          </div>
        </div>
      `;
    });

    // If no slot matched (meds without schedule info), show them ungrouped
    if (!renderedAny) {
      let pillsHTML = '';
      activeMeds.forEach(med => {
        const medIndex = this.plannerMeds.indexOf(med);
        pillsHTML += `
          <div class="sched-pill" style="cursor:pointer" onclick="App.showMedModal(${medIndex})">
            <span class="sched-pill-icon">💊</span>
            <div class="sched-pill-info">
              <div class="sched-pill-name">${escapeHtml(med.name)} ${escapeHtml(med.strength)}</div>
              <div class="sched-pill-dose">${escapeHtml(med.thai_instruction)}</div>
            </div>
            <span class="summary-med-arrow">›</span>
          </div>
        `;
      });

      html += `
        <div class="sched-card sched-card--morning animate-in">
          <div class="sched-card-header">
            <span class="sched-card-icon">💊</span>
            <div class="sched-card-titles">
              <div class="sched-card-label">รายการยาประจำวัน</div>
              <div class="sched-card-sublabel">ทานตามคำแนะนำของแพทย์</div>
            </div>
            <div class="sched-card-count">${activeMeds.length} รายการ</div>
          </div>
          <div class="sched-card-body">${pillsHTML}</div>
        </div>
      `;
    }

    html += '</div>';
    container.innerHTML = html;
  },


  // ─── Modal Interactivity ─────────────────────────────

  showMedModal(medIndex, event) {
    if (event) event.stopPropagation();
    const med = this.allMeds[medIndex];
    if (!med) return;
    this.displayMedModal(med, med.hospital, med.patient);
  },

  displayMedModal(med, hospital, patient) {
    const modal = document.getElementById('med-modal');
    const content = document.getElementById('modal-content');

    const warningHTML = med.warnings
      ? `<div class="med-warning" style="margin-top:12px"><span>⚠️</span><span><strong>คำเตือน:</strong> ${escapeHtml(med.warnings)}</span></div>`
      : '';

    const schedSlots = [
      { key: 'เช้า', icon: '☀️', cls: 'morning' },
      { key: 'กลางวัน', icon: '🌤️', cls: 'noon' },
      { key: 'เย็น', icon: '🌙', cls: 'evening' },
      { key: 'ก่อนนอน', icon: '💤', cls: 'bedtime' },
      { key: 'ตามอาการ', icon: '🤒', cls: 'as-needed' },
    ];
    let schedBadges = '';
    (med.schedule || []).forEach(s => {
      const slot = schedSlots.find(sl => sl.key === s);
      if (slot) {
        schedBadges += `<span class="sched-tag sched-tag--${slot.cls}" style="font-size:0.75rem; padding:4px 10px">${slot.icon} ${s}</span>`;
      }
    });

    content.innerHTML = `
      <div class="modal-title">💊 รายละเอียดการทานยา</div>
      <div class="modal-detail-row">
        <div class="modal-detail-label">ชื่อยา (Medication)</div>
        <div class="modal-detail-val" style="font-size:1.15rem; font-weight:700; color:var(--primary-light)">${escapeHtml(med.name)} ${escapeHtml(med.strength)}</div>
      </div>
      ${schedBadges ? `
      <div class="modal-detail-row">
        <div class="modal-detail-label">ช่วงเวลาทานยา</div>
        <div style="margin-top:4px; display:flex; flex-wrap:wrap; gap:4px">${schedBadges}</div>
      </div>` : ''}
      <div class="modal-detail-row">
        <div class="modal-detail-label">รูปแบบ & จำนวนที่ได้รับ</div>
        <div class="modal-detail-val">${escapeHtml(med.dosage_form || 'ไม่ระบุ')} — จำนวน: ${escapeHtml(med.quantity || 'ไม่ระบุ')}</div>
      </div>
      <div class="modal-detail-row">
        <div class="modal-detail-label">สรรพคุณยา</div>
        <div class="modal-detail-val">${escapeHtml(med.purpose || 'ไม่ระบุ')}</div>
      </div>
      <div class="modal-detail-row">
        <div class="modal-detail-label">วิธีกินยาอย่างละเอียด (Directions)</div>
        <div class="modal-instruction-box">
          ${escapeHtml(med.thai_instruction || 'ไม่ระบุ')}
        </div>
      </div>
      ${warningHTML}
      ${hospital || patient ? `
      <div class="modal-detail-row" style="margin-top:14px; padding-top:10px; border-top:1px solid rgba(74, 144, 217, 0.15)">
        <div class="modal-detail-val" style="font-size:0.8rem; color:var(--text-secondary); display:flex; justify-content:space-between">
          <span>🏥 ${escapeHtml(hospital || 'ไม่ระบุสถานพยาบาล')}</span>
          <span>👤 ${escapeHtml(patient || 'ไม่ระบุชื่อ')}</span>
        </div>
      </div>` : ''}
    `;

    modal.classList.add('active');
  },

  closeMedModal(event) {
    const modal = document.getElementById('med-modal');
    modal.classList.remove('active');
  },

  toggleResultImage() {
    const container = document.getElementById('result-image-container');
    const toggleIcon = document.getElementById('result-img-toggle-icon') || { textContent: '' };
    if (container.style.display === 'none') {
      container.style.display = 'block';
      toggleIcon.textContent = 'ซ่อน/แสดง';
    } else {
      container.style.display = 'none';
      toggleIcon.textContent = 'ซ่อน/แสดง';
    }
  },

  showFullPrescriptionImage() {
    if (!this.lastResult || !this.lastResult.id) return;
    this.previewImage(this.lastResult.id);
  },

  previewImage(id) {
    const modal = document.getElementById('med-modal');
    const content = document.getElementById('modal-content');
    content.innerHTML = `
      <div style="text-align:center;">
        <h3 class="modal-title" style="margin-bottom:12px; display:flex; align-items:center; gap:6px; justify-content:center;">📷 ใบสั่งยาต้นฉบับ</h3>
        <div style="background:rgba(0,0,0,0.2); padding:10px; border-radius:8px;">
          <img src="/api/uploads/${encodeURIComponent(id)}" alt="Full Prescription" style="max-width:100%; max-height:65vh; object-fit:contain; border-radius:4px; box-shadow:0 4px 16px rgba(0,0,0,0.5);">
        </div>
      </div>
    `;
    modal.classList.add('active');
  },

  // ─── History Log ─────────────────────────────────────
  async loadHistory() {
    try {
      const response = await fetch('/api/history');
      const items = await response.json();

      const badge = document.getElementById('history-badge');
      badge.textContent = `${items.length} รายการ`;

      const listEl = document.getElementById('history-list');

      if (items.length === 0) {
        listEl.innerHTML = `
          <div class="history-empty">
            <span class="empty-icon">📋</span>
            <div>ยังไม่มีประวัติการสแกน</div>
            <div style="margin-top:8px; font-size:0.82rem">ลองสแกนใบสั่งยาใบแรกของคุณ!</div>
          </div>
        `;
        return;
      }

      let html = '';
      items.forEach(item => {
        const date = new Date(item.timestamp);
        const dateStr = date.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
        const timeStr = date.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });

        html += `
          <div class="glass-card history-item" onclick="App.viewHistoryDetail('${item.id}')">
            <img class="history-thumb" src="/api/uploads/${encodeURIComponent(item.id)}" alt="prescription" loading="lazy" onclick="event.stopPropagation(); App.previewImage('${item.id}')" title="ดูรูปเต็ม" style="cursor:zoom-in;">
            <div class="history-info">
              <div class="history-patient">${escapeHtml(item.patient_name || 'ไม่ระบุชื่อ')}</div>
              <div class="history-hospital">${escapeHtml(item.hospital_name || 'ไม่ระบุสถานพยาบาล')}</div>
              <div class="history-meta">${dateStr} ${timeStr} — ยา ${item.medication_count} รายการ</div>
            </div>
            <button class="history-delete" onclick="event.stopPropagation(); App.deleteHistory('${item.id}')" title="ลบ">🗑️</button>
            <span class="history-arrow">›</span>
          </div>
        `;
      });

      listEl.innerHTML = html;
    } catch (err) {
      console.error('Load history failed:', err);
    }
  },

  async viewHistoryDetail(id) {
    try {
      const response = await fetch(`/api/history/${id}`);
      const data = await response.json();
      this.lastResult = data;
      this.renderResult(data);
      this.navigate('result');
    } catch (err) {
      alert('❌ ไม่สามารถโหลดข้อมูลได้');
    }
  },

  async deleteHistory(id) {
    if (!confirm('ต้องการลบรายการนี้?')) return;
    try {
      await fetch(`/api/history/${id}`, { method: 'DELETE' });
      this.loadHistory();
    } catch (err) {
      alert('❌ ลบไม่สำเร็จ');
    }
  },

  // ─── Theme Management ──────────────────────────────
  initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    this.updateThemeIcon(savedTheme);
  },

  toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    this.updateThemeIcon(newTheme);
  },

  updateThemeIcon(theme) {
    const iconEl = document.getElementById('theme-icon');
    if (iconEl) {
      iconEl.textContent = theme === 'dark' ? '☀️' : '🌙';
    }
  },
};

document.addEventListener('DOMContentLoaded', () => App.init());
