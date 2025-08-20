const els = {
  tzSelect: document.getElementById('tzSelect'),
  tzSearch: document.getElementById('tzSearch'),
  addClockBtn: document.getElementById('addClockBtn'),
  clocks: document.getElementById('clocks'),
  clockTpl: document.getElementById('clockCardTpl'),
  srcDate: document.getElementById('srcDate'),
  srcTime: document.getElementById('srcTime'),
  srcZone: document.getElementById('srcZone'),
  dstZone: document.getElementById('dstZone'),
  convertForm: document.getElementById('convertForm'),
  convertResult: document.getElementById('convertResult'),
  modeToggle: document.getElementById('modeToggle')
};

const STORAGE_KEYS = {
  CLOCKS: 'wtc:clocks',
  THEME: 'wtc:theme'
};

// -- Theme toggle -------------------------------------------------------------
(function initTheme() {
  const saved = localStorage.getItem(STORAGE_KEYS.THEME);
  if (saved === 'light') document.documentElement.classList.add('light');
  els.modeToggle.addEventListener('click', () => {
    document.documentElement.classList.toggle('light');
    localStorage.setItem(
      STORAGE_KEYS.THEME,
      document.documentElement.classList.contains('light') ? 'light' : 'dark'
    );
  });
})();

// -- Helpers -----------------------------------------------------------------
const fmtCache = new Map();
function formatInZone(date, timeZone, opts = {}) {
  const key = timeZone + JSON.stringify(opts);
  if (!fmtCache.has(key)) {
    fmtCache.set(key, new Intl.DateTimeFormat('en-GB', { timeZone, hour12: false, ...opts }));
  }
  return fmtCache.get(key).format(date);
}
function friendlyZoneName(tz) {
  // "Africa/Nairobi" -> "Nairobi, Africa"
  const parts = tz.split('/');
  if (parts.length === 1) return tz;
  const city = parts.pop().replaceAll('_', ' ');
  const region = parts.join(' · ').replaceAll('_', ' ');
  return `${city}, ${region}`;
}
function relativeDayLabel(date, timeZone) {
  const nowLocal = new Date();
  const dNow = Number(formatInZone(nowLocal, timeZone, { year:'numeric', month:'2-digit', day:'2-digit' }).replaceAll('/', ''));
  const dCard = Number(formatInZone(date, timeZone, { year:'numeric', month:'2-digit', day:'2-digit' }).replaceAll('/', ''));
  if (dCard === dNow) return 'Today';
  if (dCard === dNow + 1 || (dNow % 100 === 31 && dCard % 100 === 1)) return 'Tomorrow';
  if (dCard === dNow - 1 || (dCard % 100 === 31 && dNow % 100 === 1)) return 'Yesterday';
  return formatInZone(date, timeZone, { weekday: 'long' });
}

/**
 * Convert a "wall clock" date/time in a specific time zone to a UTC Date.
 * Works by comparing the local machine time to the same wall time interpreted in the target zone.
 * DST is handled by the engine.
 *
 * @param {string} dateStr - "YYYY-MM-DD"
 * @param {string} timeStr - "HH:mm"
 * @param {string} timeZone - IANA time zone, e.g., "Africa/Nairobi"
 * @returns {Date} UTC Date object representing that instant
 */
function zonedTimeToUtc(dateStr, timeStr, timeZone) {
  const safeTime = timeStr || '00:00';
  const dtLocal = new Date(`${dateStr}T${safeTime}:00`);
  // Inverse trick: interpret the same wall time in the target timeZone
  const inv = new Date(dtLocal.toLocaleString('en-US', { timeZone }));
  const diff = dtLocal.getTime() - inv.getTime();
  return new Date(dtLocal.getTime() + diff);
}

// -- Time zones list ----------------------------------------------------------
/** Load time zones from Intl or fallback API */
async function loadTimeZones() {
  try {
    if (typeof Intl.supportedValuesOf === 'function') {
      const zones = Intl.supportedValuesOf('timeZone');
      if (zones && zones.length) return zones;
    }
  } catch {}
  // Fallback to WorldTimeAPI (no key)
  const res = await fetch('https://worldtimeapi.org/api/timezone');
  if (!res.ok) throw new Error('Failed to load time zones list');
  return await res.json();
}

/** Populate all <select> with zones and wire up search filter */
function populateSelect(select, zones) {
  select.innerHTML = '';
  for (const z of zones) {
    const opt = document.createElement('option');
    opt.value = z;
    opt.textContent = friendlyZoneName(z);
    select.appendChild(opt);
  }
}

function filterZones(zones, query) {
  if (!query) return zones;
  const q = query.toLowerCase();
  return zones.filter(z =>
    z.toLowerCase().includes(q) || friendlyZoneName(z).toLowerCase().includes(q)
  );
}

// -- Clocks board -------------------------------------------------------------
let zonesData = [];
let activeClocks = new Set(JSON.parse(localStorage.getItem(STORAGE_KEYS.CLOCKS) || '[]'));

function saveClocks() {
  localStorage.setItem(STORAGE_KEYS.CLOCKS, JSON.stringify([...activeClocks]));
}

function renderClockCard(timeZone) {
  const node = els.clockTpl.content.firstElementChild.cloneNode(true);
  const cityEl = node.querySelector('.city');
  const timeEl = node.querySelector('.time');
  const zoneEl = node.querySelector('.zone');
  const dayEl = node.querySelector('.day');
  cityEl.textContent = friendlyZoneName(timeZone);
  zoneEl.textContent = timeZone;
  node.dataset.tz = timeZone;

  node.querySelector('.remove').addEventListener('click', () => {
    activeClocks.delete(timeZone);
    saveClocks();
    node.remove();
  });

  function tick() {
    const now = new Date();
    timeEl.textContent = formatInZone(now, timeZone, {
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      year: 'numeric', month: '2-digit', day: '2-digit'
    }).split(', ')[1]; // keep HH:MM:SS
    dayEl.textContent = relativeDayLabel(now, timeZone);
  }
  tick();
  node._tick = tick;
  return node;
}

function mountClocks() {
  els.clocks.innerHTML = '';
  for (const tz of activeClocks) {
    els.clocks.appendChild(renderClockCard(tz));
  }
}

function startTicker() {
  // Update all cards once a second
  setInterval(() => {
    for (const card of els.clocks.children) {
      if (typeof card._tick === 'function') card._tick();
    }
  }, 1000);
}

// -- Converter form -----------------------------------------------------------
function setTodayDefaults() {
  const now = new Date();
  els.srcDate.value = formatInZone(now, Intl.DateTimeFormat().resolvedOptions().timeZone, {
    year:'numeric', month:'2-digit', day:'2-digit'
  }).split('/').reverse().join('-'); // -> YYYY-MM-DD
  els.srcTime.value = formatInZone(now, Intl.DateTimeFormat().resolvedOptions().timeZone, {
    hour:'2-digit', minute:'2-digit'
  }).replace(' ', '');
}

function handleConvert(e) {
  e.preventDefault();
  const date = els.srcDate.value;
  const time = els.srcTime.value;
  const from = els.srcZone.value;
  const to = els.dstZone.value;
  if (!date || !time || !from || !to) return;

  const utc = zonedTimeToUtc(date, time, from);
  const dstStr = formatInZone(utc, to, {
    weekday: 'short',
    year: 'numeric', month: 'short', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  });

  const fromStr = `${date} ${time}`;
  els.convertResult.innerHTML = `
    <strong>${fromStr} (${friendlyZoneName(from)})</strong>
    &nbsp;⟶&nbsp;
    <strong>${dstStr} (${friendlyZoneName(to)})</strong>
  `;
}

// -- Search / add clock -------------------------------------------------------
function refreshSelectsBasedOnSearch() {
  const q = els.tzSearch.value.trim();
  const filtered = filterZones(zonesData, q);
  populateSelect(els.tzSelect, filtered);
}

function initAddClock() {
  els.addClockBtn.addEventListener('click', () => {
    const tz = els.tzSelect.value || els.tzSearch.value.trim();
    if (!tz) return;
    // Basic validation: must look like IANA zone "Region/City"
    if (!/^[A-Za-z_]+\/[A-Za-z_+-]+(\/[A-Za-z_+-]+)?$/.test(tz)) {
      alert('Please choose a valid IANA time zone like "Africa/Nairobi" or "Europe/London".');
      return;
    }
    if (activeClocks.has(tz)) return;
    activeClocks.add(tz);
    saveClocks();
    els.clocks.appendChild(renderClockCard(tz));
  });

  els.tzSearch.addEventListener('input', refreshSelectsBasedOnSearch);
}

// -- Boot ---------------------------------------------------------------------
(async function boot() {
  try {
    zonesData = await loadTimeZones();
  } catch (e) {
    // Minimum fallback if everything fails
    zonesData = ['Africa/Nairobi','Europe/London','America/New_York','Asia/Tokyo','Australia/Sydney'];
    console.warn('Falling back to a short zones list:', e);
  }

  // Populate selects
  populateSelect(els.tzSelect, zonesData);
  populateSelect(els.srcZone, zonesData);
  populateSelect(els.dstZone, zonesData);

  // Defaults
  setTodayDefaults();

  // Restore saved clocks
  mountClocks();
  startTicker();

  // Wire events
  initAddClock();
  els.convertForm.addEventListener('submit', handleConvert);
})();
