# DailyJournal

A calendar-based daily journal web app built with Node.js + Express and a lightweight JSON database (LowDB). Click any day on the calendar to create or edit an entry. Inspired by a clean, dark calendar UI.

## Features
- Calendar month view with navigation
- Dot indicators on days that have entries (colored by mood)
- Rich entry editor: title, content, mood, tags
- Full-text search across entries
- Light/Dark themes
- Import/Export entries as JSON
- Responsive layout (desktop and mobile)

## Project Structure
```
/ (project root)
├── index.html       # App shell (calendar + entry panel + modals)
├── styles.css       # Styling, dark/light themes
├── script.js        # Client-side logic (calendar, editor, API calls)
├── server.js        # Express server + JSON DB (LowDB)
├── journal.json     # Data file created on first run
├── package.json     # Dependencies and scripts
└── README.md        # This file
```

## Prerequisites
- Node.js 18+ (tested with Node 22)
- Windows, macOS, or Linux

No native build tools are required (uses LowDB, not native SQLite).

## Setup
1. Install dependencies
   ```powershell
   npm install
   ```
2. Start the server
   ```powershell
   npm start
   ```
3. Open the app
   - http://localhost:3000

If the browser shows "refused to connect", ensure the server started successfully (see terminal output), and that you are using http (not https).

## Usage
- Navigate months using the left/right arrow buttons.
- Click any day to open the editor, then write your entry.
- Pick a mood and optionally add comma-separated tags.
- Click Save. A dot appears on that day (color reflects the chosen mood).
- Use the search icon in the header to find entries by text.
- Open Settings to switch theme and Import/Export data.

## Data Storage
- Entries are stored in `journal.json` at the project root.
- Export creates a portable JSON snapshot you can store elsewhere.
- Import merges entries into your current data set (same `id` will be updated; others are added). Import does not delete existing entries.

### Entry Schema
```json
{
  "id": "string",
  "date": "YYYY-MM-DD",
  "title": "string",
  "content": "string",
  "mood": 1,
  "tags": ["tag1", "tag2"],
  "createdAt": "ISO timestamp",
  "updatedAt": "ISO timestamp"
}
```

## API (for reference)
Base URL: `/api`

- `GET /entries?date=YYYY-MM-DD` — fetch entry for a date
- `GET /entries/by-month?year=YYYY&month=1-12` — list entries in a month (for dots)
- `GET /entries/search?q=...` — search by title/content
- `POST /entries` — create/replace entry for date
- `PUT /entries/:id` — update entry by id
- `DELETE /entries/:id` — delete entry by id
- `GET /export` — download all entries as JSON
- `POST /import` — import entries `{ entries: [...] }`

## Troubleshooting
- "Localhost refused to connect":
  - Ensure server is running: `npm start`
  - Visit http://localhost:3000 (not https)
  - Check the terminal for errors; paste them into an issue or share in chat
- Port 3000 already in use:
  ```powershell
  netstat -ano | findstr :3000
  taskkill /PID <PID> /F
  ```
- Clearing a broken install:
  ```powershell
  if (Test-Path package-lock.json) { Remove-Item -Force package-lock.json }
  npm cache verify
  npm install
  ```

## Roadmap (from context)
- Phase 1 (MVP): Calendar + text entries + local storage (done)
- Phase 2: Media attachments, cloud sync, search enhancements
- Phase 3: Personalization options, stats, export to PDF/Text

## License
MIT
