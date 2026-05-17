// --- Configuration & State ---
const CONFIG = {
  SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbzJRM7c7uWhI75lwppA1tsNwgjic9hShS-ICqQD1BM130qV1D-3iC93W5mZBqTn3Jx_/exec',
  REFRESH_INTERVAL: 30000,
  DEFAULT_LANGUAGE: 'en',
  DEFAULT_ZOOM: 1.0
};

const State = {
  currentSlide: 0,
  slides: [],
  data: null,
  timer: null,
  interval: 20000,
  selectedDate: new Date().toISOString().split('T')[0],
  selectedShift: 'Day',
  language: localStorage.getItem('dash_lang') || CONFIG.DEFAULT_LANGUAGE,
  zoom: parseFloat(localStorage.getItem('dash_zoom')) || CONFIG.DEFAULT_ZOOM,
  isPaused: false,
  enabledSlides: [0, 1, 2], // Summary, Extrusion, Zipper (Focus slide is hidden from auto-nav)
  focusMode: false,
  focusIndex: -1,
  focusQueue: [],
  focusDuration: 3000
};

// --- Initializer ---

function init() {
  State.slides = document.querySelectorAll('.slide');
  setupEventListeners();
  applySettingsFromUI();
  updateClock();
  setInterval(updateClock, 1000);
  startDataUpdates();
  startAutoSlide();
  // Automatically test live data connection on page load
  testLiveConnection();
}

function startDataUpdates() {
  loadData(); // First fetch immediately
  setInterval(loadData, CONFIG.REFRESH_INTERVAL); // Then every 30s
}

function startAutoSlide() {
  stopAutoSlide();
  if (State.slides.length > 1 && !State.isPaused) {
    State.timer = setInterval(nextSlide, State.interval || 15000);
  }
}

function stopAutoSlide() {
  if (State.timer) clearInterval(State.timer);
  State.timer = null;
}

function resetAutoSlide(customTime = null) {
  stopAutoSlide();
  if (State.slides.length > 1 && !State.isPaused) {
    const time = customTime || State.interval || 15000;
    State.timer = setInterval(nextSlide, time);
  }
}

function toggleSlide(id, show) {
  const el = document.getElementById(id);
  if (el) el.style.display = show ? '' : 'none';
}

function setupEventListeners() {
  const settingsBtn = document.getElementById('settingsBtn');
  const closeModalBtn = document.getElementById('closeModalBtn');
  const zoomRange = document.getElementById('zoomRange');
  const slideSpeedRange = document.getElementById('slideSpeedRange');
  const scrollSpeedRange = document.getElementById('scrollSpeedRange');
  const focusSpeedRange = document.getElementById('focusSpeedRange');
  const testConnBtn = document.getElementById('testConnBtn');
  const exportBtn = document.getElementById('exportBtn');

  if (testConnBtn) testConnBtn.onclick = testLiveConnection;

  if (settingsBtn) settingsBtn.onclick = () => document.body.classList.add('settings-open');
  if (closeModalBtn) closeModalBtn.onclick = () => document.body.classList.remove('settings-open');

  // Header Buttons
  const refreshBtn = document.getElementById('refreshBtn');
  const presModeBtn = document.getElementById('presModeBtn');
  const prevBtn = document.getElementById('prevSlideHeader');
  const nextBtn = document.getElementById('nextSlideHeader');
  const playPauseBtn = document.getElementById('playPauseBtn');

  if (refreshBtn) {
    refreshBtn.onclick = () => {
      refreshBtn.innerText = '⌛';
      loadData().finally(() => {
        refreshBtn.innerText = '🔄';
      });
    };
  }

  if (prevBtn) prevBtn.onclick = () => { prevSlide(); if(!State.isPaused) resetAutoSlide(); };
  if (nextBtn) nextBtn.onclick = () => { nextSlide(); if(!State.isPaused) resetAutoSlide(); };

  if (playPauseBtn) {
    playPauseBtn.onclick = () => {
      State.isPaused = !State.isPaused;
      playPauseBtn.innerText = State.isPaused ? '▶️' : '⏸️';
      if (State.isPaused) stopAutoSlide();
      else startAutoSlide();
    };
  }

  if (presModeBtn) {
    presModeBtn.onclick = () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen();
      } else {
        document.exitFullscreen();
      }
    };
  }

  // Shift Buttons
  const shiftDay = document.getElementById('shiftDay');
  const shiftNight = document.getElementById('shiftNight');
  const shift24h = document.getElementById('shift24h');

  if (shiftDay) shiftDay.onclick = () => setShift('Day');
  if (shiftNight) shiftNight.onclick = () => setShift('Night');
  if (shift24h) shift24h.onclick = () => setShift('24H');

  // Zoom Logic
  if (zoomRange) {
    zoomRange.oninput = (e) => {
      const val = e.target.value;
      document.getElementById('zoomVal').innerText = val + '%';
      document.querySelector('main').style.transform = `scale(${val / 100})`;
      document.querySelector('main').style.transformOrigin = 'top center';
    };
  }

  // Slide Speed
  if (slideSpeedRange) {
    slideSpeedRange.oninput = (e) => {
      const val = e.target.value;
      document.getElementById('slideSpeedVal').innerText = val + 's';
      State.interval = val * 1000;
      resetAutoSlide();
    };
  }

  // Scroll Speed (Ticker)
  if (scrollSpeedRange) {
    scrollSpeedRange.oninput = (e) => {
      const val = e.target.value;
      document.getElementById('scrollSpeedVal').innerText = val + 's';
      const ticker = document.getElementById('live-ticker');
      if (ticker) ticker.style.animationDuration = val + 's';
    };
  }

  // Focus Speed
  if (focusSpeedRange) {
    focusSpeedRange.oninput = (e) => {
      const val = e.target.value;
      document.getElementById('focusSpeedVal').innerText = val + 's';
      State.focusDuration = val * 1000;
    };
  }

  // Range Buttons
  setupRangeBtn('slideSpeedMinus', 'slideSpeedPlus', 'slideSpeedRange', (val) => {
    document.getElementById('slideSpeedVal').innerText = val + 's';
    State.interval = val * 1000;
    resetAutoSlide();
  });

  setupRangeBtn('scrollSpeedMinus', 'scrollSpeedPlus', 'scrollSpeedRange', (val) => {
    document.getElementById('scrollSpeedVal').innerText = val + 's';
    const ticker = document.getElementById('live-ticker');
    if (ticker) ticker.style.animationDuration = val + 's';
  });

  setupRangeBtn('focusSpeedMinus', 'focusSpeedPlus', 'focusSpeedRange', (val) => {
    document.getElementById('focusSpeedVal').innerText = val + 's';
    State.focusDuration = val * 1000;
  });

  // Checkboxes
  const checkSummary = document.getElementById('check-summary');
  const checkMachines = document.getElementById('check-machines');
  const checkFocus = document.getElementById('check-focus');

  if (checkSummary) {
    checkSummary.onchange = (e) => {
      toggleSlide('slide-0', e.target.checked);
      updateEnabledSlides();
    };
  }
  if (checkMachines) {
    checkMachines.onchange = (e) => {
      toggleSlide('slide-1', e.target.checked);
      toggleSlide('slide-2', e.target.checked);
      updateEnabledSlides();
    };
  }
  if (checkFocus) {
    checkFocus.onchange = (e) => {
      State.focusModeEnabled = e.target.checked;
    };
  }

  // Color Swatches
  const swatches = document.querySelectorAll('.swatch');
  swatches.forEach(s => {
    s.onclick = () => {
      swatches.forEach(sw => sw.classList.remove('active'));
      s.classList.add('active');
      const color = s.getAttribute('data-color');
      document.documentElement.style.setProperty('--accent-blue', color);
    };
  });

  // Export
  if (exportBtn) {
    exportBtn.onclick = () => {
      const config = JSON.stringify(State);
      const blob = new Blob([config], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'dashboard-config.json';
      a.click();
    };
  }
}

function setupRangeBtn(minusId, plusId, rangeId, callback) {
  const minus = document.getElementById(minusId);
  const plus = document.getElementById(plusId);
  const range = document.getElementById(rangeId);

  if (!minus || !plus || !range) return;

  minus.onclick = () => {
    const val = parseInt(range.value);
    const min = parseInt(range.min);
    if (val > min) {
      range.value = val - 1;
      callback(range.value);
    }
  };

  plus.onclick = () => {
    const val = parseInt(range.value);
    const max = parseInt(range.max);
    if (val < max) {
      range.value = val + 1;
      callback(range.value);
    }
  };
}

function updateEnabledSlides() {
  State.enabledSlides = [];
  if (document.getElementById('check-summary')?.checked) State.enabledSlides.push(0);
  if (document.getElementById('check-machines')?.checked) {
    State.enabledSlides.push(1);
    State.enabledSlides.push(2);
  }
}

function applySettingsFromUI() {
  const zoomRange = document.getElementById('zoomRange');
  const slideSpeedRange = document.getElementById('slideSpeedRange');
  const scrollSpeedRange = document.getElementById('scrollSpeedRange');
  const focusSpeedRange = document.getElementById('focusSpeedRange');
  
  if (zoomRange) {
    const val = zoomRange.value;
    document.getElementById('zoomVal').innerText = val + '%';
    document.querySelector('main').style.transform = `scale(${val / 100})`;
    document.querySelector('main').style.transformOrigin = 'top center';
  }
  
  if (slideSpeedRange) {
    const val = slideSpeedRange.value;
    document.getElementById('slideSpeedVal').innerText = val + 's';
    State.interval = val * 1000;
  }
  
  if (scrollSpeedRange) {
    const val = scrollSpeedRange.value;
    document.getElementById('scrollSpeedVal').innerText = val + 's';
    const ticker = document.getElementById('live-ticker');
    if (ticker) ticker.style.animationDuration = val + 's';
  }
  
  if (focusSpeedRange) {
    const val = focusSpeedRange.value;
    document.getElementById('focusSpeedVal').innerText = val + 's';
    State.focusDuration = val * 1000;
  }
  
  updateEnabledSlides();
}

function goToSlide(index) {
  if (!State.slides[index]) return;
  State.slides.forEach(s => s.classList.remove('active'));
  State.slides[index].classList.add('active');
  State.currentSlide = index;

  const titleEl = document.getElementById('mainTitle');
  if (titleEl) {
    let title = 'PRODUCTION PERFORMANCE';
    if (index === 1) title = 'EXTRUSION (EXT)';
    if (index === 2) title = 'ZIPPER (ZIP)';
    titleEl.innerHTML = `${title} <span style="font-size: 10px; opacity: 0.5;">v2.1</span>`;
  }
}

function nextSlide() {
  // If in Focus Mode, go to next machine
  if (State.focusMode) {
    State.focusIndex++;
    if (State.focusIndex < State.focusQueue.length) {
      renderFocusSlide(State.focusQueue[State.focusIndex]);
      resetAutoSlide(State.focusDuration);
      return;
    } else {
      // Focus mode finished for this section
      State.focusMode = false;
      State.focusIndex = -1;
      State.focusQueue = [];
      // Continue to next regular slide
    }
  }

  // Get current index in enabled slides
  const currentIdxInEnabled = State.enabledSlides.indexOf(State.currentSlide);
  let nextIdxInEnabled = (currentIdxInEnabled + 1) % State.enabledSlides.length;
  let next = State.enabledSlides[nextIdxInEnabled];

  // If we were on a grid slide (1 or 2), start its focus mode before moving to next
  if (State.currentSlide === 1 || State.currentSlide === 2) {
    const section = State.currentSlide === 1 ? 'Extrusion' : 'Zipper';
    if (State.data && State.data.machines[section] && State.data.machines[section].length > 0) {
      State.focusMode = true;
      State.focusIndex = 0;
      State.focusQueue = State.data.machines[section];
      goToSlide(3); // Focus Slide Index
      renderFocusSlide(State.focusQueue[0]);
      resetAutoSlide(State.focusDuration);
      return;
    }
  }

  goToSlide(next);
  resetAutoSlide();
}

function prevSlide() {
  // Simple prev, resets focus mode
  State.focusMode = false;
  const currentIdxInEnabled = State.enabledSlides.indexOf(State.currentSlide);
  let prevIdxInEnabled = (currentIdxInEnabled - 1 + State.enabledSlides.length) % State.enabledSlides.length;
  let prev = State.enabledSlides[prevIdxInEnabled];
  goToSlide(prev);
  resetAutoSlide();
}

function renderFocusSlide(m) {
  const container = document.getElementById('focus-container');
  if (!container) return;

  const pct = m.target > 0 ? Math.round((m.prod / m.target) * 100) : 0;
  const statusClass = m.status.includes('idle') ? 'tag-idle' : (m.status.includes('bd') || m.status.includes('breakdown') ? 'tag-bd' : 'tag-run');
  
  const hasReason = (m.status.includes('breakdown') || m.status.includes('bd') || m.status.includes('idle')) && m.reason;
  
  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });

  container.innerHTML = `
    <div class="focus-card-premium ${statusClass}">
      <div class="focus-accent-bar"></div>
      <div class="focus-header">
        <div class="focus-title">${m.id}</div>
        <div class="focus-status-pill ${statusClass}">
          <span class="status-dot"></span>
          <span>${m.status.toUpperCase()}</span>
        </div>
        <div class="focus-update-time">🕒 UPDATED: ${timeStr}</div>
      </div>
      <div class="focus-body">
        <div class="focus-left">
          <div class="focus-circle-wrap">
            <svg viewBox="0 0 36 36" style="width:100%; height:100%;">
              <path class="m-circle-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" style="stroke-width:2;" />
              <path id="focus-path-anim" class="m-circle-fg" stroke="${getProgColor(pct)}" stroke-dasharray="0, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" style="stroke-width:2; transition: stroke-dasharray 1s ease-out;" />
            </svg>
            <div class="focus-pct-val">
              <span id="focus-pct-anim">0%</span>
              <div style="font-size:12px; font-weight:800; color:var(--text-muted); margin-top:5px;">ACHIEVEMENT</div>
            </div>
          </div>
        </div>
        <div class="focus-right">
          <div class="focus-lbl">PRODUCTION UNITS</div>
          <div class="focus-big-val" id="focus-prod-anim">0 KGS</div>
          
          <div class="focus-lbl" style="margin-top:20px;">DAILY TARGET</div>
          <div class="focus-sub-val">${m.target.toLocaleString()} <span style="font-size:24px; color:var(--text-muted);">KGS</span></div>
          
          ${hasReason ? `<div class="focus-reason-box ${statusClass}">${m.reason}</div>` : ''}
        </div>
      </div>
      <div class="focus-footer">
        MACHINE MONITORING ${State.focusIndex + 1} OF ${State.focusQueue.length}
      </div>
    </div>
  `;

  // Trigger animations
  setTimeout(() => {
    const path = document.getElementById('focus-path-anim');
    if (path) path.style.strokeDasharray = `${pct}, 100`;
    
    animateValue('focus-pct-anim', 0, pct, 1000, '%');
    animateValue('focus-prod-anim', 0, m.prod, 1000, ' KGS');
  }, 50);
}

function animateValue(id, start, end, duration, suffix = '') {
  const obj = document.getElementById(id);
  if (!obj) return;
  let startTimestamp = null;
  const step = (timestamp) => {
    if (!startTimestamp) startTimestamp = timestamp;
    const progress = Math.min((timestamp - startTimestamp) / duration, 1);
    const current = Math.floor(progress * (end - start) + start);
    obj.innerHTML = current.toLocaleString() + suffix;
    if (progress < 1) {
      window.requestAnimationFrame(step);
    }
  };
  window.requestAnimationFrame(step);
}

function setShift(s) {
  State.selectedShift = s;
  const ids = ['shiftDay', 'shiftNight', 'shift24h'];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('active', id.toLowerCase().includes(s.toLowerCase()));
  });
  loadData();
}

function updateClock() {
  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-US', { hour12: true, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const clockEl = document.getElementById('liveTime');
  if (clockEl) clockEl.innerText = timeStr;
  
  const dateEl = document.getElementById('headerDate');
  if (dateEl) dateEl.innerText = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

async function loadData() {
  console.log('Fetching live data from:', CONFIG.SCRIPT_URL);
  try {
    const response = await fetch(CONFIG.SCRIPT_URL);
    if (!response.ok) throw new Error('Network response was not ok');
    
    const result = await response.json();
    console.log('Data Received:', result);
    
    State.data = processRawData(result);
    renderAllSlides();
  } catch (err) {
    console.error('Error loading data:', err);
    // Fallback to mock data if fetch fails during dev
    if (!State.data) {
      State.data = getMockData();
      renderAllSlides();
    }
  }
}

// Test live data connection
function testLiveConnection() {
  const statusEl = document.getElementById('connectionStatus');
  if (!statusEl) return;
  statusEl.style.display = 'block';
  statusEl.style.color = 'var(--accent-cyan)';
  statusEl.innerText = 'Connecting...';
  fetch(CONFIG.SCRIPT_URL)
    .then(res => {
      if (!res.ok) throw new Error('Network response not ok: ' + res.status);
      return res.json();
    })
    .then(data => {
      console.log('Test connection data:', data);
      statusEl.style.color = 'var(--accent-green)';
      statusEl.innerText = '✅ Live data connection successful!';
    })
    .catch(err => {
      console.error('Connection test error:', err);
      statusEl.style.color = 'var(--accent-red)';
      statusEl.innerText = '❌ Connection failed: ' + err.message;
    });
}


function processRawData(response) {
  if (!response || !response.rawData) return response;
  const processed = {
    machines: { "Extrusion": [], "Zipper": [] },
    hourlyTrends: response.hourlyTrends || [], // Captured from live sheet
    rawFiltered: [],
    lastUpdated: new Date().toLocaleTimeString()
  };

  response.rawData.forEach(row => {
    let rawId = row["Machine No"] || row["id"];
    if (!rawId || String(rawId).trim() === '') return; // Skip empty rows

    let rawStatus = String(row["Machine Status"] || '').trim().toLowerCase();
    if (rawStatus === '') rawStatus = 'idle';

    let m = { 
      id: rawId, 
      prod: parseFloat(row["Total Production Kgs"]) || 0, 
      target: parseFloat(row["Target Kgs"]) || 0, 
      status: rawStatus,
      reason: row["Reason of Idle"] || row["Breakdown Type"] || ''
    };
    
    // Update the row object so other functions relying on rawFiltered have the correct status
    row["Machine Status"] = rawStatus === 'idle' ? 'Idle' : row["Machine Status"];
    processed.rawFiltered.push(row);

    if (m.id.toUpperCase().includes('EXT')) processed.machines.Extrusion.push(m);
    else if (m.id.toUpperCase().includes('ZIP')) processed.machines.Zipper.push(m);
  });

  // Sorting by achievement percentage (large to small)
  const sortFn = (a, b) => {
    const pctA = a.target > 0 ? (a.prod / a.target) : 0;
    const pctB = b.target > 0 ? (b.prod / b.target) : 0;
    return pctB - pctA;
  };
  processed.machines.Extrusion.sort(sortFn);
  processed.machines.Zipper.sort(sortFn);

  // Store totals for syncing other components
  let tTgt = 0, tPrd = 0;
  processed.rawFiltered.forEach(r => {
    tTgt += parseFloat(r["Target Kgs"]) || 0;
    tPrd += parseFloat(r["Total Production Kgs"]) || 0;
  });
  processed.totalTarget = tTgt;
  processed.totalProd = tPrd;

  return processed;
}

function renderAllSlides() {
  const data = State.data;
  if (!data) return;

  const lastUpdateEl = document.getElementById('lastUpdated');
  if (lastUpdateEl) lastUpdateEl.innerText = data.lastUpdated;

  // Calculate Totals
  let tTarget = 0, tProd = 0, tRun = 0, tIdle = 0, tBD = 0;
  data.rawFiltered.forEach(r => {
    const target = parseFloat(r["Target Kgs"]) || 0;
    const prod = parseFloat(r["Total Production Kgs"]) || 0;
    const status = String(r["Machine Status"] || '').toLowerCase();
    
    tTarget += target;
    tProd += prod;
    if (status.includes('run')) tRun++;
    else if (status.includes('idle')) tIdle++;
    else if (status.includes('breakdown') || status.includes('bd')) tBD++;
  });

  const tPct = tTarget > 0 ? Math.round((tProd / tTarget) * 100) : 0;
  const tRem = tTarget - tProd;

  safeSetText('sum-total-target', tTarget.toLocaleString());
  safeSetText('sum-total-prod', tProd.toLocaleString());
  safeSetText('sum-total-pct', tPct + '%');
  safeSetText('sum-total-rem', tRem.toLocaleString());

  safeSetText('stat-total', data.rawFiltered.length);
  safeSetText('stat-run', tRun);
  safeSetText('stat-idle', tIdle);
  safeSetText('stat-bd', tBD);
  safeSetText('stat-eff', tPct + '%');

  // Breakdown Analysis Chart Update
  const bdEx = data.machines.Extrusion.filter(m => m.status.includes('breakdown') || m.status.includes('bd')).length;
  const bdZp = data.machines.Zipper.filter(m => m.status.includes('breakdown') || m.status.includes('bd')).length;
  const bdTotal = bdEx + bdZp;
  
  const circleEx = document.getElementById('bd-circle-ex');
  const circleZp = document.getElementById('bd-circle-zp');
  const bdTimeText = document.getElementById('stat-bd-time');

  if (bdTotal > 0) {
    const exPct = (bdEx / bdTotal) * 100;
    const zpPct = (bdZp / bdTotal) * 100;
    if (circleEx) circleEx.setAttribute('stroke-dasharray', `${exPct}, 100`);
    if (circleZp) {
       circleZp.setAttribute('stroke-dasharray', `${zpPct}, 100`);
       circleZp.setAttribute('stroke-dashoffset', -exPct);
    }
    if (bdTimeText) bdTimeText.innerText = bdTotal + (bdTotal > 1 ? ' Units' : ' Unit');
  } else {
    if (circleEx) circleEx.setAttribute('stroke-dasharray', `0, 100`);
    if (circleZp) circleZp.setAttribute('stroke-dasharray', `0, 100`);
    if (bdTimeText) bdTimeText.innerText = '0 Units';
  }

  renderMachineGrid('ex-grid', data.machines.Extrusion);
  renderMachineGrid('zp-grid', data.machines.Zipper);
  
  renderMasterDataTable(data.rawFiltered);
  renderLiveTicker();
  renderHourlyChart(data.hourlyTrends);
  renderComparisonChart();
  applyLanguage();
}

function renderComparisonChart() {
  const container = document.getElementById('comparison-bars');
  if (!container || !State.data) return;

  const data = State.data;
  const sections = {
    "EXT": { t: 0, p: 0 },
    "ZIP": { t: 0, p: 0 }
  };

  data.rawFiltered.forEach(m => {
    const id = (m["Machine No"] || m["id"] || "").toUpperCase();
    let key = "EXT";
    if (id.includes("ZIP")) key = "ZIP";
    
    if (sections[key]) {
      sections[key].t += parseFloat(m["Target Kgs"]) || 0;
      sections[key].p += parseFloat(m["Total Production Kgs"]) || 0;
    }
  });

  // Dynamically find max target for scaling (so target bar looks "full")
  const targets = Object.values(sections).map(s => s.t);
  const maxVal = Math.max(...targets, 1000); 

  // Update Y-Axis labels dynamically based on maxVal
  const labelIds = [150, 120, 90, 60, 30];
  labelIds.forEach(l => {
    const el = document.getElementById(`y-label-${l}`);
    if (el) {
      const val = Math.round(maxVal * (l / 150));
      el.innerText = val >= 1000 ? (val/1000).toFixed(1) + 'K' : val;
    }
  });

  container.innerHTML = Object.keys(sections).map(key => {
    const s = sections[key];
    const tH = (s.t / maxVal) * 100;
    const pH = (s.p / maxVal) * 100;

    return `
      <div style="display:flex; align-items:flex-end; gap:10px; height:100%; width:40%;">
        <div style="flex:1; display:flex; flex-direction:column; align-items:center; height:100%; justify-content:flex-end;">
          <div style="font-size:10px; font-weight:800; color:var(--accent-blue); margin-bottom:4px;">${Math.round(s.t).toLocaleString()}</div>
          <div style="width:100%; height:${tH}%; background:var(--accent-blue); border-radius:4px 4px 0 0; box-shadow:0 0 10px var(--glow-blue);"></div>
        </div>
        <div style="flex:1; display:flex; flex-direction:column; align-items:center; height:100%; justify-content:flex-end;">
          <div style="font-size:10px; font-weight:800; color:var(--accent-green); margin-bottom:4px;">${Math.round(s.p).toLocaleString()}</div>
          <div style="width:100%; height:${pH}%; background:var(--accent-green); border-radius:4px 4px 0 0; box-shadow:0 0 10px var(--glow-green);"></div>
        </div>
      </div>
    `;
  }).join('');
}

function renderHourlyChart(hourlyData) {
  const svg = document.getElementById('hourly-chart-svg');
  if (!svg) return;

  // If no live hourly data, use scaled mock data based on live totals
  if (!hourlyData || hourlyData.length === 0) {
    const liveTgt = (State.data && State.data.totalTarget) ? State.data.totalTarget : 15000;
    const liveProd = (State.data && State.data.totalProd) ? State.data.totalProd : 1500;
    
    // Create a trend that ends or peaks at current live values
    hourlyData = [
      { h: '06:00', p: liveProd * 0.2, t: liveTgt * 0.3 },
      { h: '08:00', p: liveProd * 0.5, t: liveTgt * 0.5 },
      { h: '10:00', p: liveProd * 0.8, t: liveTgt * 0.8 },
      { h: '12:00', p: liveProd, t: liveTgt }, // Current point matches live totals
      { h: '14:00', p: liveProd * 0.9, t: liveTgt * 1.1 },
      { h: '16:00', p: liveProd * 0.7, t: liveTgt * 0.9 },
      { h: '18:00', p: liveProd * 0.8, t: liveTgt * 1.2 }
    ];
  }

  const pPath = document.getElementById('hourly-prod-path');
  const pArea = document.getElementById('hourly-prod-area');
  const tPath = document.getElementById('hourly-target-path');
  
  if (!pPath || !tPath) return;

  const width = 400;
  const height = 120;
  
  // Dynamically find max value for scaling
  const allVals = hourlyData.flatMap(d => [d.p, d.t]);
  const maxVal = Math.max(...allVals, 1000) * 1.2; 

  const getX = (i) => (i / (hourlyData.length - 1)) * width;
  const getY = (v) => height - (v / maxVal) * height;

  let pD = `M ${getX(0)},${getY(hourlyData[0].p)}`;
  let tD = `M ${getX(0)},${getY(hourlyData[0].t)}`;

  for (let i = 1; i < hourlyData.length; i++) {
    // Using simple L (Line) for now, can be changed to C (Curve) for smoother look
    pD += ` L ${getX(i)},${getY(hourlyData[i].p)}`;
    tD += ` L ${getX(i)},${getY(hourlyData[i].t)}`;
  }

  pPath.setAttribute('d', pD);
  tPath.setAttribute('d', tD);
  if (pArea) pArea.setAttribute('d', pD + ` L ${width},${height} L 0,${height} Z`);

  // Active Focus Point (Highlighting the 4th point - 12:00 PM)
  const focusIdx = Math.min(3, hourlyData.length - 1);
  const fx = getX(focusIdx);
  const fy = getY(hourlyData[focusIdx].p);
  
  const fLine = document.getElementById('hourly-focus-line');
  const fDot = document.getElementById('hourly-focus-dot');
  if (fLine) { fLine.setAttribute('x1', fx); fLine.setAttribute('x2', fx); }
  if (fDot) { fDot.setAttribute('cx', fx); fDot.setAttribute('cy', fy); }

  // Update Tooltip
  const tt = document.getElementById('hourly-tooltip');
  if (tt) {
    tt.style.display = 'block';
    tt.style.left = (fx + 10) + 'px';
    tt.style.top = (fy - 80) + 'px';
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
    document.getElementById('tt-time').innerText = timeStr;
    document.getElementById('tt-prod').innerText = 'Production: ' + hourlyData[focusIdx].p.toLocaleString();
    document.getElementById('tt-tgt').innerText = 'Target: ' + hourlyData[focusIdx].t.toLocaleString();
  }
}

function safeSetText(id, txt) {
  const el = document.getElementById(id);
  if (el) el.innerText = txt;
}

function renderMachineGrid(id, machines) {
  const el = document.getElementById(id);
  if (!el) return;

  // If grid is empty, do a full render
  if (el.children.length === 0 || el.children.length !== machines.length) {
    el.innerHTML = machines.map(m => createMachineCardHTML(m)).join('');
    return;
  }

  // Otherwise, update existing cards to prevent flicker
  machines.forEach((m, idx) => {
    const card = el.children[idx];
    if (!card) return;

    const pct = m.target > 0 ? Math.round((m.prod / m.target) * 100) : 0;
    let statusClass = 'tag-run';
    if (m.status.includes('idle')) statusClass = 'tag-idle';
    if (m.status.includes('breakdown') || m.status.includes('bd')) statusClass = 'tag-bd';

    // Update ID and Status
    card.querySelector('.m-card-title').innerText = m.id;
    const statusPill = card.querySelector('.m-card-status-pill');
    statusPill.className = `m-card-status-pill ${statusClass}`;
    statusPill.querySelector('span:last-child').innerText = m.status.toUpperCase();

    // Update Progress Circle
    const circleFg = card.querySelector('.m-circle-fg');
    circleFg.setAttribute('stroke', getProgColor(pct));
    circleFg.setAttribute('stroke-dasharray', `${pct}, 100`);
    card.querySelector('.m-card-pct').innerText = `${pct}%`;

    // Update Values
    card.querySelector('.big-val').innerText = m.prod.toLocaleString();
    card.querySelector('.target-lbl').innerText = `TARGET: ${m.target.toLocaleString()} KGS`;

    // Update Reason
    let reasonEl = card.querySelector('.footer-reason');
    const hasReason = (m.status.includes('breakdown') || m.status.includes('bd') || m.status.includes('idle')) && m.reason;
    if (hasReason) {
      if (!reasonEl) {
        reasonEl = document.createElement('div');
        reasonEl.className = `footer-reason ${statusClass}`;
        card.querySelector('.m-card-footer').appendChild(reasonEl);
      }
      reasonEl.innerText = m.reason;
      reasonEl.className = `footer-reason ${statusClass}`;
    } else if (reasonEl) {
      reasonEl.remove();
    }
  });
}

function createMachineCardHTML(m) {
  const pct = m.target > 0 ? Math.round((m.prod / m.target) * 100) : 0;
  let statusClass = 'tag-run';
  if (m.status.includes('idle')) statusClass = 'tag-idle';
  if (m.status.includes('breakdown') || m.status.includes('bd')) statusClass = 'tag-bd';

  const hasReason = (m.status.includes('breakdown') || m.status.includes('bd') || m.status.includes('idle')) && m.reason;
  
  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });

  return `
    <div class="m-card-premium ${statusClass}" data-id="${m.id}">
      <div class="m-card-accent-bar"></div>
      <div class="m-card-header">
        <div class="m-card-title">${m.id}</div>
        <div class="m-card-status-pill ${statusClass}">
          <span class="status-dot"></span>
          <span>${m.status.toUpperCase()}</span>
        </div>
      </div>
      <div class="m-card-body">
        <div class="m-card-main-val">
          <div class="big-val">${m.prod.toLocaleString()}</div>
          <div class="unit-lbl">KGS</div>
          <div class="target-lbl">TARGET: ${m.target.toLocaleString()} KGS</div>
        </div>
        <div class="m-card-circle-wrap">
          <svg class="m-circle-svg" viewBox="0 0 36 36">
            <path class="m-circle-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
            <path class="m-circle-fg" stroke="${getProgColor(pct)}" stroke-dasharray="${pct}, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
          </svg>
          <div class="m-card-pct">${pct}%</div>
        </div>
      </div>
      <div class="m-card-footer">
        <div class="footer-time">🕒 ${timeStr}</div>
        ${hasReason ? `<div class="footer-reason ${statusClass}">${m.reason}</div>` : ''}
      </div>
    </div>
  `;
}

function getProgColor(pct) {
  return 'var(--accent-green)';
}

function renderMasterDataTable(rows) {
  const head = document.getElementById('master-data-head');
  const body = document.getElementById('master-data-body');
  if (!head || !body || rows.length === 0) return;
  
  const headers = ["Machine No", "Target Kgs", "Total Production Kgs", "Machine Status"];
  head.innerHTML = headers.map(h => `<th>${h}</th>`).join('');
  body.innerHTML = rows.slice(0, 10).map(row => `
    <tr>
      <td>${row["Machine No"]}</td>
      <td style="color:var(--accent-blue)">${row["Target Kgs"]}</td>
      <td style="color:var(--accent-green)">${row["Total Production Kgs"]}</td>
      <td>${row["Machine Status"]}</td>
    </tr>
  `).join('');
}

function applyLanguage() {
  const elements = document.querySelectorAll('[data-en]');
  elements.forEach(el => {
    const text = el.getAttribute(`data-${State.language}`);
    if (text && el.innerText !== text) el.innerText = text;
  });
}

function getMockData() {
  const today = new Date().toISOString().split('T')[0];
  const rawData = [
    { "Machine No": "EXT-01", "Target Kgs": 4500, "Total Production Kgs": 4200, "Machine Status": "Running" },
    { "Machine No": "EXT-02", "Target Kgs": 4500, "Total Production Kgs": 3960, "Machine Status": "Running" },
    { "Machine No": "EXT-03", "Target Kgs": 4500, "Total Production Kgs": 2925, "Machine Status": "Idle", "Reason of Idle": "No Operator" },
    { "Machine No": "EXT-04", "Target Kgs": 4500, "Total Production Kgs": 810, "Machine Status": "Breakdown", "Breakdown Type": "Mechanical" },
    { "Machine No": "ZIP-01", "Target Kgs": 3200, "Total Production Kgs": 2720, "Machine Status": "Running" },
    { "Machine No": "ZIP-02", "Target Kgs": 3200, "Total Production Kgs": 2500, "Machine Status": "Running" },
    { "Machine No": "ZIP-03", "Target Kgs": 3200, "Total Production Kgs": 1280, "Machine Status": "Idle" }
  ];
  return processRawData({ rawData: rawData });
}

/**
 * Renders the scrolling live ticker with machine-wise data
 */
function renderLiveTicker() {
  const ticker = document.getElementById('live-ticker');
  if (!ticker) return;
  
  const data = State.data ? State.data.rawFiltered : [];
  if (data.length === 0) return;
  
  let html = '';
  data.forEach(m => {
    const name = m['Machine No'] || 'N/A';
    const tgt = Math.round(parseFloat(m['Target Kgs']) || 0);
    const prd = Math.round(parseFloat(m['Total Production Kgs']) || 0);
    const ach = tgt > 0 ? Math.round((prd / tgt) * 100) : 0;
    
    html += `
      <div class="ticker-item">
        <span class="t-m-name">${name}</span>
        <span class="t-tgt">TGT: ${tgt}</span>
        <span class="t-prd">PRD: ${prd}</span>
        <span class="t-ach">${ach}%</span>
      </div>
    `;
  });
  
  // Double content for infinite loop effect
  ticker.innerHTML = html + html;
}

document.addEventListener('DOMContentLoaded', init);
