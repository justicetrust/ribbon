# RIBBON

AI-powered music creation tool. Live at thedocumentagency.com/music

## Setup (first time)

```bash
git clone https://github.com/justicetrust/ribbon.git
cd ribbon
npm install
```

Create a `.env` file:
```
ANTHROPIC_API_KEY=your-key-here
PORT=3002
```

Run locally:
```bash
node server.js
```

Then open http://localhost:3002/music/

## Working on this project

- This is a shared repo. Push directly to `main`.
- After making changes, always commit and push so Justice can see your work.
- The production server is at thedocumentagency.com/music — Justice handles deploys.

## Stack

- **Backend:** Node.js + Express (`server.js`)
- **Frontend:** Single HTML file (`public/index.html`) + bundled JS (`public/assets/`)
- **AI:** Anthropic Claude API
- **Plugins:** JSON configs in `public/plugins/`
- **Telegram bot:** `telegram-bot.js` (optional, needs TELEGRAM_BOT_TOKEN in .env)
