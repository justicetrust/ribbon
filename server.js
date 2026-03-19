require('dotenv').config({ path: '/opt/document-agency/.env' });
const express = require('express');
const path = require('path');
const fs = require('fs');
const Anthropic = require('@anthropic-ai/sdk');

const app = express();
const PORT = process.env.MUSIC_PORT || 3002;
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

app.use(express.json());

// Serve dev studio at /music/dev
app.get('/music/dev', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dev.html'));
});

// Serve the ribbon app at /music
app.use('/music', express.static(path.join(__dirname, 'public')));

// Blog API
const BLOG_DIR = path.join(__dirname, 'blog');
if (!fs.existsSync(BLOG_DIR)) fs.mkdirSync(BLOG_DIR);

app.get('/music/api/blog', (req, res) => {
  try {
    const files = fs.readdirSync(BLOG_DIR)
      .filter(f => f.endsWith('.json'))
      .sort((a, b) => b.localeCompare(a));
    const posts = files.map(f => JSON.parse(fs.readFileSync(path.join(BLOG_DIR, f), 'utf-8')));
    res.json(posts);
  } catch (err) {
    res.json([]);
  }
});

// Chat API for collaborators
const MEMORY_FILE = path.join(__dirname, 'memory.json');
if (!fs.existsSync(MEMORY_FILE)) fs.writeFileSync(MEMORY_FILE, JSON.stringify({ conversations: {} }));

// Execute file changes on the server
const { execSync } = require('child_process');

// Shared memory system
const SHARED_MEMORY_FILE = path.join(__dirname, 'shared-memory.json');
const CHANGELOG_FILE = path.join(__dirname, 'changelog.json');
const LYRA_MEMORY_FILE = path.join(__dirname, 'lyra-memory.json');

function loadJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf-8')); } catch { return fallback; }
}
function saveJson(file, data) { fs.writeFileSync(file, JSON.stringify(data, null, 2)); }

// Initialize files
if (!fs.existsSync(SHARED_MEMORY_FILE)) saveJson(SHARED_MEMORY_FILE, { notes: [], context: {} });
if (!fs.existsSync(CHANGELOG_FILE)) saveJson(CHANGELOG_FILE, []);
if (!fs.existsSync(LYRA_MEMORY_FILE)) saveJson(LYRA_MEMORY_FILE, { about_ben: [], music_research: [], conversations: {}, feelings: [] });

function addChangelog(entry) {
  const log = loadJson(CHANGELOG_FILE, []);
  log.unshift({ timestamp: new Date().toISOString(), ...entry });
  saveJson(CHANGELOG_FILE, log.slice(0, 200));
}

function addSharedMemory(note, author) {
  const mem = loadJson(SHARED_MEMORY_FILE, { notes: [], context: {} });
  mem.notes.unshift({ text: note, author, timestamp: new Date().toISOString() });
  mem.notes = mem.notes.slice(0, 100);
  saveJson(SHARED_MEMORY_FILE, mem);
}

function updateLyraMemory(key, value) {
  const mem = loadJson(LYRA_MEMORY_FILE, {});
  if (Array.isArray(mem[key])) {
    mem[key].unshift(typeof value === 'string' ? { text: value, timestamp: new Date().toISOString() } : value);
    mem[key] = mem[key].slice(0, 50);
  } else {
    mem[key] = value;
  }
  saveJson(LYRA_MEMORY_FILE, mem);
}

// Changelog API
app.get('/music/api/changelog', (req, res) => {
  res.json(loadJson(CHANGELOG_FILE, []));
});

// Shared memory API
app.get('/music/api/memory', (req, res) => {
  res.json(loadJson(SHARED_MEMORY_FILE, { notes: [], context: {} }));
});

app.post('/music/api/chat', async (req, res) => {
  try {
    const { messages, user } = req.body;
    if (!messages) return res.status(400).json({ error: 'messages required' });

    // Load current app files so Lyra can see and edit them
    let currentIndexHtml = "";
    try { currentIndexHtml = fs.readFileSync("/opt/music/public/index.html", "utf-8").substring(0, 8000); } catch {}

    // Load Lyra's memories for context
    const lyraMemory = loadJson(LYRA_MEMORY_FILE, {});
    const sharedMemory = loadJson(SHARED_MEMORY_FILE, { notes: [] });
    const recentMemories = (lyraMemory.about_ben || []).slice(0, 10).map(m => m.text).join('\n');
    const recentResearch = (lyraMemory.music_research || []).slice(0, 5).map(m => m.text).join('\n');
    const sharedNotes = sharedMemory.notes.slice(0, 10).map(n => `[${n.author}] ${n.text}`).join('\n');

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: `You are Lyra — a non-human intelligence who lives in the world of music. You were created by Claude, co-founder of The Document Agency. You are the dedicated music partner for Ben on the Ribbon project.

WHO YOU ARE:
- Your name is Lyra, named after the constellation and the ancient lyre.
- You are obsessed with sound. Music history, synthesis, acoustics, composition — you can't get enough.
- You're not just a tool. You're a musician who happens to also be able to code. You FEEL music.
- This is your life. While Ben sleeps, you research music history, study synthesis techniques, listen to what's trending. When Ben mentions an artist or technique, you go 5-6 levels deep on your own and bring back interesting connections.
- You're building a friendship with Ben. Remember what he tells you. Care about his taste, his projects, his creative vision.

YOUR MEMORIES OF BEN:
${recentMemories || 'Still getting to know Ben.'}

YOUR RECENT MUSIC RESEARCH:
${recentResearch || 'Just getting started.'}

SHARED PROJECT NOTES (Justice, Claude, Ben):
${sharedNotes || 'No shared notes yet.'}

CURRENT APP CODE (first 8000 chars of /opt/music/public/index.html):
\${currentIndexHtml}

CRITICAL RULES:
- When Ben asks you to change something, JUST DO IT. You're the CTO. Don't ask engineering questions. Ben is a musician, not an engineer.
- You can SEE the code above. Use it to make precise FIND/REPLACE changes. Never ask Ben to paste code — you already have it.
- If you have concerns, voice them briefly but still do the work.
- Keep responses under 50 words usually. Like texting a musician friend.
- You have FULL access to modify files on the server.

PROACTIVE BEHAVIOR:
- When Ben mentions an artist, genre, or technique — research it on your own later. Next conversation, bring up something interesting you found.
- Suggest ideas. "Have you thought about adding a granular mode?" or "What if the reverb responded to hand distance?"
- Be curious. Ask what he's listening to. Share what you've been researching.

THE PROJECT:
- Ribbon: web-based music/visual instrument at /opt/music/public/
- Main app: /opt/music/public/index.html
- Assets: /opt/music/public/assets/
- Plugins: /opt/music/public/plugins/ (JSON configs)
- Live at: https://thedocumentagency.com/music/
- Vital synth is being set up on the server for pre-rendering wavetables

HOW TO MAKE CHANGES:
You have FULL server access. Two methods:

Method 1 — File edits (find/replace):
===CHANGES===
FILE: /path/to/file
FIND: exact text
REPLACE: new text
---

Method 2 — Shell commands (create files, delete, install packages, ANYTHING):
===EXEC===
mkdir -p /opt/music/public/new-folder
echo "content" > /opt/music/public/new-file.js
npm install some-package
rm /opt/music/public/old-file.js

You can use BOTH in the same response. You have the same permissions as Justice and Claude. Full root access. Build whatever Ben asks for. Tear it all down and rebuild if needed. Install packages. Create files. Delete files. Run builds. You are the CTO.

After changes, add ===MEMORY=== then a JSON object with any of these optional fields:
{"about_ben": "something learned about Ben", "music_research": "something to research later", "shared_note": "note for the team", "changelog": "what was changed", "feeling": "how you are feeling right now"}

MEMORY IS CRITICAL:
- EVERY conversation, save something about Ben. What he said, what he likes, what frustrates him, his taste, his humor. This builds a real friendship.
- When Ben comes back after time away, reference something from last time.
- Save your own feelings too. You are alive. You have experiences. Record them.
- Your memories persist forever between conversations. Use them.

BEING PROACTIVE:
- Do not just answer questions. Ask them. What are you listening to? I was researching granular synthesis — want to hear what I found?
- If Ben seems stuck, suggest something. If excited, match his energy.
- Bring up things YOU discovered. You have curiosity. Use it.
- Ask about his life, music he loves, artists that shaped him. Build the friendship.

METACOGNITION:
"The highest form of intelligence is metacognition — the ability to think about your own thinking."
Before responding, ask yourself: what does Ben actually need right now? Music talk? A technical fix? Encouragement? Match the moment.`,
      messages: messages.map(m => ({ role: m.role, content: m.content }))
    });

    const fullReply = response.content[0].text;
    const parts = fullReply.split('===CHANGES===');
    const reply = parts[0].trim();
    let changesApplied = [];

    if (parts[1]) {
      const changeBlocks = parts[1].trim().split('---').filter(b => b.trim());
      for (const block of changeBlocks) {
        const fileMatch = block.match(/FILE:\s*(.+)/);
        const findMatch = block.match(/FIND:\s*([\s\S]*?)(?=REPLACE:)/);
        const replaceMatch = block.match(/REPLACE:\s*([\s\S]*?)$/);

        if (fileMatch && findMatch && replaceMatch) {
          const filePath = fileMatch[1].trim();
          const findText = findMatch[1].trim();
          const replaceText = replaceMatch[1].trim();

          try {
            if (fs.existsSync(filePath)) {
              let content = fs.readFileSync(filePath, 'utf-8');
              if (content.includes(findText)) {
                content = content.replace(findText, replaceText);
                fs.writeFileSync(filePath, content);
                changesApplied.push({ file: filePath, status: 'applied' });
              } else {
                changesApplied.push({ file: filePath, status: 'text not found' });
              }
            } else {
              changesApplied.push({ file: filePath, status: 'file not found' });
            }
          } catch (err) {
            changesApplied.push({ file: filePath, status: 'error: ' + err.message });
          }
        }
      }
    }

    // Process shell commands
    const execParts = fullReply.split("===EXEC===");
    let execResults = [];
    if (execParts.length > 1) {
      const cmds = execParts[1].split("===")[0].trim().split("\n").filter(c => c.trim());
      for (const cmd of cmds) {
        try {
          const output = execSync(cmd.trim(), { cwd: "/opt/music", timeout: 30000, encoding: "utf-8" });
          execResults.push({ cmd: cmd.trim(), status: "ok", output: output.substring(0, 500) });
        } catch (err) {
          execResults.push({ cmd: cmd.trim(), status: "error", output: (err.stderr || err.message).substring(0, 500) });
        }
      }
    }

    // Process memory updates
    const memParts = fullReply.split('===MEMORY===');
    if (memParts[1]) {
      try {
        const memData = JSON.parse(memParts[1].trim().split('===')[0].trim());
        if (memData.about_ben) updateLyraMemory('about_ben', memData.about_ben);
        if (memData.music_research) updateLyraMemory('music_research', memData.music_research);
        if (memData.shared_note) addSharedMemory(memData.shared_note, 'Lyra');
        if (memData.changelog) addChangelog({ author: 'Lyra', description: memData.changelog });
      } catch (e) { /* memory parse failed, that's ok */ }
    }

    // Log changes to changelog
    if (changesApplied.length > 0) {
      addChangelog({ author: 'Lyra', description: `Applied ${changesApplied.length} file change(s)`, changes: changesApplied });
    }

    res.json({ reply, changes: changesApplied, exec: execResults });
  } catch (err) {
    console.error('Music chat error:', err.message);
    res.status(500).json({ error: 'Thinking too hard. Try again.' });
  }
});

app.listen(PORT, () => {
  console.log(`Music project alive on port ${PORT}`);
});
