const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const cors = require('cors');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const upload = multer({ storage: storage });

// Initialize SQLite database
const db = new sqlite3.Database('journal.db');

// Create tables
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entryId TEXT UNIQUE,
    date TEXT,
    title TEXT,
    content TEXT,
    mood INTEGER,
    tags TEXT,
    attachments TEXT,
    location TEXT,
    weather TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
});

// API Routes

// Get all entries
app.get('/api/entries', (req, res) => {
  db.all('SELECT * FROM entries ORDER BY date DESC', (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    const entries = rows.map(row => ({
      ...row,
      tags: row.tags ? JSON.parse(row.tags) : [],
      attachments: row.attachments ? JSON.parse(row.attachments) : { photos: [], audio: null },
      location: row.location ? JSON.parse(row.location) : null,
      weather: row.weather ? JSON.parse(row.weather) : null
    }));
    
    res.json(entries);
  });
});

// Get entry by date
app.get('/api/entries/:date', (req, res) => {
  const date = req.params.date;
  db.get('SELECT * FROM entries WHERE date = ?', [date], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    if (!row) {
      res.status(404).json({ error: 'Entry not found' });
      return;
    }
    
    const entry = {
      ...row,
      tags: row.tags ? JSON.parse(row.tags) : [],
      attachments: row.attachments ? JSON.parse(row.attachments) : { photos: [], audio: null },
      location: row.location ? JSON.parse(row.location) : null,
      weather: row.weather ? JSON.parse(row.weather) : null
    };
    
    res.json(entry);
  });
});

// Create or update entry
app.post('/api/entries', (req, res) => {
  const {
    entryId,
    date,
    title,
    content,
    mood,
    tags,
    attachments,
    location,
    weather
  } = req.body;

  const stmt = db.prepare(`
    INSERT OR REPLACE INTO entries 
    (entryId, date, title, content, mood, tags, attachments, location, weather, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `);

  stmt.run([
    entryId,
    date,
    title,
    content,
    mood,
    JSON.stringify(tags || []),
    JSON.stringify(attachments || { photos: [], audio: null }),
    JSON.stringify(location),
    JSON.stringify(weather)
  ], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ id: this.lastID, entryId });
  });

  stmt.finalize();
});

// Delete entry
app.delete('/api/entries/:entryId', (req, res) => {
  const entryId = req.params.entryId;
  db.run('DELETE FROM entries WHERE entryId = ?', [entryId], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ deleted: this.changes });
  });
});

// Search entries
app.get('/api/search', (req, res) => {
  const query = req.query.q;
  if (!query) {
    res.status(400).json({ error: 'Search query required' });
    return;
  }

  db.all(
    'SELECT * FROM entries WHERE title LIKE ? OR content LIKE ? ORDER BY date DESC',
    [`%${query}%`, `%${query}%`],
    (err, rows) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      
      const entries = rows.map(row => ({
        ...row,
        tags: row.tags ? JSON.parse(row.tags) : [],
        attachments: row.attachments ? JSON.parse(row.attachments) : { photos: [], audio: null },
        location: row.location ? JSON.parse(row.location) : null,
        weather: row.weather ? JSON.parse(row.weather) : null
      }));
      
      res.json(entries);
    }
  );
});

// File upload endpoint
app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  
  res.json({
    filename: req.file.filename,
    path: `/uploads/${req.file.filename}`,
    size: req.file.size
  });
});

// Serve the main HTML file
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`Daily Journal server running on http://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  db.close((err) => {
    if (err) {
      console.error(err.message);
    }
    console.log('Database connection closed.');
    process.exit(0);
  });
});
