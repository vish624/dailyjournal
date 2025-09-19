import express from 'express';
import path from 'path';
import cors from 'cors';
import morgan from 'morgan';
import { JSONFilePreset } from 'lowdb/node';
import { fileURLToPath } from 'url';
import { nanoid } from 'nanoid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(morgan('dev'));

// Static files (serve project root)
app.use(express.static(__dirname));

// Database setup (lowdb JSON)
const dbFile = path.join(__dirname, 'journal.json');
// Top-level await is available in Node 22 with ESM
const db = await JSONFilePreset(dbFile, { entries: [] });

// Helpers
function todayISO(d = new Date()) {
  const tz = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return tz.toISOString().slice(0, 10);
}

function validateDate(iso) {
  return /^\d{4}-\d{2}-\d{2}$/.test(iso);
}

// API routes
const api = express.Router();

// Get entry by date
api.get('/entries', (req, res) => {
  const { date } = req.query;
  if (!date || !validateDate(date)) return res.status(400).json({ error: 'Invalid or missing date (YYYY-MM-DD)' });
  const row = db.data.entries.find(e => e.date === date);
  if (!row) return res.status(404).json({ error: 'Not found' });
  return res.json(row);
});

// Get entries for a month (for calendar dots)
api.get('/entries/by-month', (req, res) => {
  const year = parseInt(req.query.year, 10);
  const month = parseInt(req.query.month, 10); // 1-12
  if (!year || !month || month < 1 || month > 12) return res.status(400).json({ error: 'Invalid year or month' });
  const m = String(month).padStart(2, '0');
  const rows = db.data.entries
    .filter(e => e.date.startsWith(`${year}-${m}-`))
    .map(e => ({ id: e.id, date: e.date, mood: e.mood ?? null }));
  return res.json(rows);
});

// Search entries
api.get('/entries/search', (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.json([]);
  const lower = q.toLowerCase();
  const rows = db.data.entries
    .filter(e => (e.title || '').toLowerCase().includes(lower) || (e.content || '').toLowerCase().includes(lower))
    .sort((a, b) => a.date < b.date ? 1 : -1)
    .slice(0, 100)
    .map(e => ({ id: e.id, date: e.date, title: e.title, snippet: (e.content || '').slice(0, 200), mood: e.mood ?? null }));
  return res.json(rows);
});

// Create entry
api.post('/entries', async (req, res) => {
  const { date, title = '', content = '', mood = null, tags = [] } = req.body || {};
  if (!date || !validateDate(date)) return res.status(400).json({ error: 'Invalid or missing date (YYYY-MM-DD)' });

  // If an entry already exists for this date, overwrite by creating a new id and removing the old one
  const now = new Date().toISOString();
  const id = nanoid();
  db.data.entries = db.data.entries.filter(e => e.date !== date);
  db.data.entries.push({ id, date, title, content, mood, tags, createdAt: now, updatedAt: now });
  await db.write();
  return res.status(201).json({ id });
});

// Update entry
api.put('/entries/:id', async (req, res) => {
  const { id } = req.params;
  const { title = '', content = '', mood = null, tags = [] } = req.body || {};
  const now = new Date().toISOString();
  const idx = db.data.entries.findIndex(e => e.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  db.data.entries[idx] = { ...db.data.entries[idx], title, content, mood, tags, updatedAt: now };
  await db.write();
  return res.json({ ok: true });
});

// Delete entry
api.delete('/entries/:id', async (req, res) => {
  const { id } = req.params;
  const before = db.data.entries.length;
  db.data.entries = db.data.entries.filter(e => e.id !== id);
  if (db.data.entries.length === before) return res.status(404).json({ error: 'Not found' });
  await db.write();
  return res.json({ ok: true });
});

// Export all entries
api.get('/export', (req, res) => {
  const rows = [...db.data.entries].sort((a, b) => a.date < b.date ? 1 : -1);
  res.setHeader('Content-Disposition', `attachment; filename=journal-export-${todayISO()}.json`);
  res.json({ entries: rows });
});

// Import entries (expects { entries: [...] })
api.post('/import', async (req, res) => {
  const payload = req.body;
  if (!payload || !Array.isArray(payload.entries)) return res.status(400).json({ error: 'Invalid payload' });
  let count = 0;
  for (const e of payload.entries) {
    const id = e.id || nanoid();
    const idx = db.data.entries.findIndex(x => x.id === id);
    const item = {
      id,
      date: e.date,
      title: e.title || '',
      content: e.content || '',
      mood: e.mood ?? null,
      tags: e.tags || [],
      createdAt: e.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    if (idx === -1) db.data.entries.push(item); else db.data.entries[idx] = item;
    count++;
  }
  await db.write();
  return res.json({ ok: true, count });
});

app.use('/api', api);

// Fallback to index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`DailyJournal server running on http://localhost:${PORT}`);
});
