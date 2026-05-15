# 🕉️ Mandir.World

**Digital Darshan + Donation Platform for Dharmic experiences**

> "Bringing you closer to dharma, one stream at a time."

---

## What This Is

Mandir.World is a **Phase 1** platform built for the entry stage — honest about what it does, and intentional about what it doesn't.

### ✅ What's included (Phase 1)
| Feature | Description |
|---|---|
| **Live Darshan** | Stream pages for Varanasi, Ayodhya, Haridwar |
| **Digital Sankalp** | Record name + gotra + wish tied to any event |
| **Daan** | Donate to Gau Seva, Annadaan, Ganga Safai |
| **Festival Calendar** | Upcoming + daily sacred events |
| **Receipt System** | Auto-generated sankalp + donation certificates |
| **REST API** | `/api/streams`, `/api/festivals`, `/api/stats` |

### ❌ Not in Phase 1 (intentionally)
- No fake "puja done in your name" claims
- No temple/pandit partnerships (Phase 2+)
- No physical prasad delivery (Phase 2+)

---

## Tech Stack

- **Backend**: Node.js + Express.js
- **Templates**: EJS (server-side rendering)
- **Data**: JSON files (swap for MongoDB/PostgreSQL later)
- **Sessions**: express-session (for sankalp/donation success states)
- **Styling**: Pure CSS with CSS variables (no framework)

---

## Getting Started

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Or start production
npm start
```

Server runs at **http://localhost:3000**

---

## Project Structure

```
mandir.world/
├── server.js              # Express app + all routes
├── data/
│   ├── festivals.json     # Festival & daily aarti data
│   └── streams.json       # Livestream data
├── views/
│   ├── partials/
│   │   ├── header.ejs     # Nav + head HTML
│   │   └── footer.ejs     # Footer + scripts
│   ├── index.ejs          # Homepage
│   ├── darshan.ejs        # All streams page
│   ├── stream.ejs         # Individual stream + video embed
│   ├── sankalp.ejs        # Sankalp form + certificate
│   ├── calendar.ejs       # Festival calendar
│   ├── daan.ejs           # Donation page
│   ├── about.ejs          # About + roadmap
│   └── 404.ejs            # 404 page
├── public/
│   ├── css/style.css      # Complete design system
│   └── js/main.js         # Client JS (animations, validation)
└── package.json
```

---

## Routes

| Route | Method | Description |
|---|---|---|
| `/` | GET | Homepage with live streams + upcoming festivals |
| `/darshan` | GET | All livestream pages |
| `/darshan/:id` | GET | Individual stream with embed + quick sankalp |
| `/sankalp` | GET/POST | Sankalp form + certificate on success |
| `/calendar` | GET | Festival calendar with timeline |
| `/daan` | GET/POST | Donation causes + receipt |
| `/about` | GET | Mission + roadmap |
| `/api/streams` | GET | JSON stream data |
| `/api/festivals` | GET | JSON festival data |
| `/api/stats` | GET | Live stats (viewers, sankalpas, donations) |

---

## Adding Real Streams

In `data/streams.json`, update `youtubeEmbedId` with real YouTube Live stream IDs:

```json
{
  "id": "ganga-aarti-varanasi",
  "youtubeEmbedId": "YOUR_REAL_YOUTUBE_ID",
  "isLive": true
}
```

---

## Phase 2 Roadmap (not built yet)

- Pandit partnership portal
- Physical puja booking with recorded proof
- Prasad delivery via courier
- SMS/WhatsApp notifications for festival reminders

## Phase 3 Roadmap

- Temple integration (Kashi Vishwanath API, Tirumala etc.)
- Premium ritual tiers (₹1,100 → ₹11,000+)
- App (React Native)

---

## Design Notes

- **Color palette**: Saffron (#FF6B00), Gold (#C8922A), Deep Brown (#1A0F00)
- **Fonts**: Cormorant Garamond (headings) + Source Sans 3 (body) + Noto Sans Devanagari (Hindi)
- **No external CSS frameworks** — all custom CSS with variables

---

*Built with devotion 🙏 — mandir.world*
