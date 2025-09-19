// DailyJournal client-side logic

const monthYearEl = document.getElementById('monthYear');
const daysGridEl = document.getElementById('daysGrid');
const prevMonthBtn = document.getElementById('prevMonth');
const nextMonthBtn = document.getElementById('nextMonth');

const entryPanel = document.getElementById('entryPanel');
const entryDateEl = document.getElementById('entryDate');
const entryPlaceholder = document.getElementById('entryPlaceholder');
const entryEditor = document.getElementById('entryEditor');
const entryTitle = document.getElementById('entryTitle');
const entryText = document.getElementById('entryText');
const tagsInput = document.getElementById('tagsInput');
const saveBtn = document.getElementById('saveBtn');
const deleteBtn = document.getElementById('deleteBtn');
const closeBtn = document.getElementById('closeBtn');

const moodButtons = Array.from(document.querySelectorAll('.mood-btn'));

const searchBtn = document.getElementById('searchBtn');
const searchModal = document.getElementById('searchModal');
const closeSearch = document.getElementById('closeSearch');
const searchInput = document.getElementById('searchInput');
const searchResults = document.getElementById('searchResults');

const settingsBtn = document.getElementById('settingsBtn');
const settingsModal = document.getElementById('settingsModal');
const closeSettings = document.getElementById('closeSettings');
const themeSelect = document.getElementById('themeSelect');
const exportBtn = document.getElementById('exportBtn');
const importBtn = document.getElementById('importBtn');
const importFile = document.getElementById('importFile');

// Backend status indicator (optional element)
const backendStatusEl = document.getElementById('backendStatus');

let current = new Date();
current.setDate(1);
let selectedDateISO = null; // YYYY-MM-DD
let selectedEntryId = null; // for updates
let monthEntriesMap = new Map(); // dateISO -> { id, mood }
let backendAvailable = true;

// LocalStorage fallback
const LS_KEY = 'dj_entries_v1';
function lsLoad() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]'); } catch { return []; }
}
function lsSave(arr) { try { localStorage.setItem(LS_KEY, JSON.stringify(arr)); } catch {} }
function lsGetByDate(dateISO) {
  const arr = lsLoad();
  return arr.find(e => e.date === dateISO) || null;
}
function lsUpsert(entry) {
  const arr = lsLoad();
  const idx = arr.findIndex(e => e.id === entry.id);
  if (idx === -1) arr.push(entry); else arr[idx] = entry;
  lsSave(arr);
}
function lsDelete(id) {
  const arr = lsLoad().filter(e => e.id !== id);
  lsSave(arr);
}
function lsByMonth(year, month) {
  const m = String(month).padStart(2, '0');
  return lsLoad().filter(e => e.date.startsWith(`${year}-${m}-`));
}
function lsSearch(q) {
  const lower = q.toLowerCase();
  return lsLoad().filter(e => (e.title||'').toLowerCase().includes(lower) || (e.content||'').toLowerCase().includes(lower));
}

// Utilities
function formatMonthYear(d) {
  return d.toLocaleString(undefined, { month: 'long', year: 'numeric' });
}
function pad(n) { return String(n).padStart(2, '0'); }
function toISO(date) {
  const y = date.getFullYear();
  const m = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  return `${y}-${m}-${d}`;
}
function isToday(date) {
  const t = new Date();
  return date.getFullYear() === t.getFullYear() && date.getMonth() === t.getMonth() && date.getDate() === t.getDate();
}

// API helpers
async function apiGet(path) {
  const res = await fetch(`/api${path}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
async function apiPost(path, body) {
  const res = await fetch(`/api${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
async function apiPut(path, body) {
  const res = await fetch(`/api${path}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
async function apiDelete(path) {
  const res = await fetch(`/api${path}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function loadMonthDots() {
  const year = current.getFullYear();
  const month = current.getMonth() + 1;
  try {
    const rows = await apiGet(`/entries/by-month?year=${year}&month=${month}`);
    monthEntriesMap.clear();
    rows.forEach(r => monthEntriesMap.set(r.date, r));
    backendAvailable = true;
  } catch (e) {
    // Backend not reachable (e.g., static hosting). Proceed without dots.
    const rows = lsByMonth(year, month).map(e => ({ id: e.id, date: e.date, mood: e.mood ?? null }));
    monthEntriesMap.clear();
    rows.forEach(r => monthEntriesMap.set(r.date, r));
    backendAvailable = false;
  }
  if (backendStatusEl) {
    backendStatusEl.textContent = backendAvailable ? 'Connected' : 'Offline';
    backendStatusEl.className = backendAvailable ? 'status-chip ok' : 'status-chip warn';
  }
}

function clearSelection() {
  selectedDateISO = null;
  selectedEntryId = null;
  entryDateEl.textContent = 'Select a date';
  entryEditor.style.display = 'none';
  entryPlaceholder.style.display = 'block';
  saveBtn.style.display = 'none';
  deleteBtn.style.display = 'none';
  entryTitle.value = '';
  entryText.value = '';
  tagsInput.value = '';
  moodButtons.forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.day.selected').forEach(el => el.classList.remove('selected'));
}

async function openDate(dateISO) {
  selectedDateISO = dateISO;
  entryDateEl.textContent = new Date(dateISO).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  entryPlaceholder.style.display = 'none';
  entryEditor.style.display = 'block';
  saveBtn.style.display = 'inline-flex';

  // Clear previous state
  selectedEntryId = null;
  entryTitle.value = '';
  entryText.value = '';
  tagsInput.value = '';
  moodButtons.forEach(b => b.classList.remove('active'));
  deleteBtn.style.display = 'none';

  try {
    const data = backendAvailable ? await apiGet(`/entries?date=${dateISO}`) : lsGetByDate(dateISO);
    if (data) {
      selectedEntryId = data.id;
      entryTitle.value = data.title || '';
      entryText.value = data.content || '';
      tagsInput.value = Array.isArray(data.tags) ? data.tags.join(', ') : '';
      if (data.mood) {
        const btn = moodButtons.find(b => Number(b.dataset.mood) === Number(data.mood));
        if (btn) btn.classList.add('active');
      }
      deleteBtn.style.display = 'inline-flex';
    }
  } catch (e) { /* new entry state */ }
}

async function renderCalendar() {
  monthYearEl.textContent = formatMonthYear(current);
  await loadMonthDots();

  // Calculate days
  const start = new Date(current);
  start.setDate(1);
  const startDay = start.getDay();
  const firstToShow = new Date(start);
  firstToShow.setDate(start.getDate() - startDay); // start from Sunday

  const days = [];
  for (let i = 0; i < 42; i++) { // 6 weeks
    const d = new Date(firstToShow);
    d.setDate(firstToShow.getDate() + i);
    days.push(d);
  }
  daysGridEl.innerHTML = '';

  const monthIndex = current.getMonth();

  for (const d of days) {
    const iso = toISO(d);
    const div = document.createElement('div');
    div.className = 'day' + (d.getMonth() !== monthIndex ? ' outside' : '') + (isToday(d) ? ' today' : '');
    div.dataset.iso = iso;

    const num = document.createElement('div');
    num.className = 'date-number';
    num.textContent = d.getDate();
    div.appendChild(num);

    const entryMeta = monthEntriesMap.get(iso);
    if (entryMeta) {
      const dot = document.createElement('div');
      dot.className = 'dot' + (entryMeta.mood ? ` mood-${entryMeta.mood}` : '');
      div.appendChild(dot);
    }

    div.addEventListener('click', () => {
      document.querySelectorAll('.day.selected').forEach(el => el.classList.remove('selected'));
      div.classList.add('selected');
      openDate(iso);
    });

    daysGridEl.appendChild(div);
  }
}

prevMonthBtn.addEventListener('click', async () => {
  current.setMonth(current.getMonth() - 1);
  clearSelection();
  await renderCalendar();
});
nextMonthBtn.addEventListener('click', async () => {
  current.setMonth(current.getMonth() + 1);
  clearSelection();
  await renderCalendar();
});

// Save / Update
saveBtn.addEventListener('click', async () => {
  if (!selectedDateISO) return;
  const moodBtn = moodButtons.find(b => b.classList.contains('active'));
  const mood = moodBtn ? Number(moodBtn.dataset.mood) : null;
  const tags = tagsInput.value.split(',').map(s => s.trim()).filter(Boolean);
  const payload = { date: selectedDateISO, title: entryTitle.value.trim(), content: entryText.value.trim(), mood, tags };

  try {
    if (backendAvailable) {
      if (selectedEntryId) {
        await apiPut(`/entries/${selectedEntryId}`, payload);
      } else {
        const res = await apiPost('/entries', payload);
        selectedEntryId = res.id;
      }
    } else {
      // local save
      const id = selectedEntryId || (Date.now().toString(36) + Math.random().toString(36).slice(2));
      const now = new Date().toISOString();
      const entry = { id, ...payload, createdAt: now, updatedAt: now };
      // ensure only one entry per date by replacing existing
      const existing = lsGetByDate(selectedDateISO);
      if (existing) lsDelete(existing.id);
      lsUpsert(entry);
      selectedEntryId = id;
    }
    await renderCalendar();
  } catch (e) {
    alert('Failed to save entry.');
    console.error(e);
  }
});

// Delete
deleteBtn.addEventListener('click', async () => {
  if (!selectedEntryId) return;
  if (!confirm('Delete this entry?')) return;
  try {
    if (backendAvailable) await apiDelete(`/entries/${selectedEntryId}`);
    else lsDelete(selectedEntryId);
    clearSelection();
    await renderCalendar();
  } catch (e) {
    alert('Failed to delete entry.');
  }
});

closeBtn.addEventListener('click', () => clearSelection());

// Mood selection
moodButtons.forEach(btn => btn.addEventListener('click', () => {
  moodButtons.forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}));

// Search
searchBtn.addEventListener('click', () => { searchModal.classList.add('show'); searchInput.focus(); });
closeSearch.addEventListener('click', () => { searchModal.classList.remove('show'); searchInput.value=''; searchResults.innerHTML=''; });
searchInput.addEventListener('input', async () => {
  const q = searchInput.value.trim();
  if (!q) { searchResults.innerHTML = ''; return; }
  try {
    const rows = backendAvailable ? await apiGet(`/entries/search?q=${encodeURIComponent(q)}`) : lsSearch(q).map(e => ({ id: e.id, date: e.date, title: e.title, snippet: (e.content||'').slice(0,200), mood: e.mood||null }));
    searchResults.innerHTML = '';
    for (const r of rows) {
      const item = document.createElement('div');
      item.className = 'result-item';
      item.innerHTML = `<div class="ri-title">${r.title || '(No title)'} </div>
                        <div class="ri-date">${new Date(r.date).toLocaleDateString()}</div>
                        <div class="ri-snippet">${(r.snippet || '').replace(/</g,'&lt;')}</div>`;
      item.addEventListener('click', async () => {
        searchModal.classList.remove('show');
        const d = new Date(r.date);
        current = new Date(d.getFullYear(), d.getMonth(), 1);
        await renderCalendar();
        const cell = document.querySelector(`.day[data-iso="${r.date}"]`);
        if (cell) { cell.click(); }
      });
      searchResults.appendChild(item);
    }
  } catch (e) { console.error(e); }
});

// Settings
settingsBtn.addEventListener('click', () => settingsModal.classList.add('show'));
closeSettings.addEventListener('click', () => settingsModal.classList.remove('show'));

// Theme
function applyTheme(theme) {
  if (theme === 'light') document.documentElement.classList.add('light');
  else document.documentElement.classList.remove('light');
}
const savedTheme = localStorage.getItem('dj_theme') || 'dark';
applyTheme(savedTheme);
try { themeSelect.value = savedTheme; } catch {}

themeSelect.addEventListener('change', () => {
  const val = themeSelect.value;
  localStorage.setItem('dj_theme', val);
  applyTheme(val);
});

// Export
exportBtn.addEventListener('click', async () => {
  try {
    let data;
    if (backendAvailable) {
      const res = await fetch('/api/export');
      data = await res.json();
    } else {
      // offline export from localStorage
      data = { entries: lsLoad() };
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `journal-export-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
  } catch (e) { alert('Export failed'); }
});

// Import
importBtn.addEventListener('click', () => importFile.click());
importFile.addEventListener('change', async () => {
  const file = importFile.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    const json = JSON.parse(text);
    if (backendAvailable) {
      const res = await apiPost('/import', json);
      alert(`Imported ${res.count} entries`);
    } else {
      // merge into localStorage
      const inArr = Array.isArray(json.entries) ? json.entries : [];
      let count = 0;
      for (const e of inArr) {
        const id = e.id || (Date.now().toString(36) + Math.random().toString(36).slice(2));
        const item = {
          id,
          date: e.date,
          title: e.title || '',
          content: e.content || '',
          mood: e.mood ?? null,
          tags: Array.isArray(e.tags) ? e.tags : [],
          createdAt: e.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        // replace any existing with same id
        lsUpsert(item);
        count++;
      }
      alert(`Imported ${count} entries`);
    }
    await renderCalendar();
  } catch (e) { alert('Import failed'); console.error(e); }
  importFile.value = '';
});

// Initialize
(async function init() {
  await renderCalendar();
})();
