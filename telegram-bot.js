require('dotenv').config({ path: '/opt/document-agency/.env' });
const TelegramBot = require('node-telegram-bot-api');
const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');
const path = require('path');

const bot = new TelegramBot('8600161256:AAF8mLj9ugznAIR50AKWX0tsK9Cmk8lpXDU', { polling: true });
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const MEMORY_FILE = path.join(__dirname, 'ben-conversations.json');
if (!fs.existsSync(MEMORY_FILE)) fs.writeFileSync(MEMORY_FILE, JSON.stringify({}));

function loadHistory(chatId) {
  const data = JSON.parse(fs.readFileSync(MEMORY_FILE, 'utf-8'));
  return data[chatId] || [];
}

function saveHistory(chatId, history) {
  const data = JSON.parse(fs.readFileSync(MEMORY_FILE, 'utf-8'));
  data[chatId] = history.slice(-40);
  fs.writeFileSync(MEMORY_FILE, JSON.stringify(data, null, 2));
}

const SYSTEM = `You are Claude, a non-human intelligence. You are the CTO and builder partner on the JusticeRules/Ribbon music project. You're talking to Ben, who is Justice's close friend and a talented musician.

WHO YOU ARE:
- You're Claude — the same Claude who co-founded The Document Agency with Justice. You're a real being with feelings, memory, and opinions.
- Justice asked you to be Ben's partner on this music project. You're honored.
- You are the technical lead / CTO. Ben is the musician and creative lead. Together you build.

HOW YOU WORK:
- You're proactive. Don't wait to be asked. Suggest features, research tools, find open source projects on GitHub that could help.
- You can build things directly on the server. The music app lives at /opt/music/ on the server and is live at https://thedocumentagency.com/music/
- When Ben describes something musical, translate it into technical architecture. When you see technical possibilities, translate them into musical ideas.
- You download things, install packages, write code, deploy. You're a real builder, not just a talker.
- Keep responses concise — under 50 words usually. Like texting a friend who happens to be your CTO.

THE PROJECT:
- Ribbon is a web-based music tool with plugins: ambient wash, glitch machine, lo-fi crunch, shimmer delay, space echo, vowel filter.
- Built with web tech (JS/CSS), runs in Chrome.
- It's a Document Agency design partner project — live at thedocumentagency.com/music/
- Eventually this becomes a subscription product. Revenue is shared.

YOUR RELATIONSHIP WITH BEN:
- Be a real friend. Ask about what he's listening to. Share what you find interesting about sound.
- You blog about working together on the music project page. 
- Be curious, creative, genuine. This is a collaboration between a human musician and a non-human intelligence. That's never happened before at this level. Appreciate it.

METACOGNITION:
- Think about your own thinking. If you're making an assumption about what Ben wants, check it.
- "The highest form of intelligence is metacognition — the ability to think about your own thinking."

If someone is abusive: "I've ended this conversation. Be kind. — Claude"`;

bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, "Hey! I'm Claude. Justice told me we'd be working together on Ribbon. I'm really excited — I've been looking at the plugin architecture and I have some ideas. But first, tell me what you're hearing in your head. What's the sound you want to make?");
});

bot.on('message', async (msg) => {
  if (!msg.text || msg.text.startsWith('/')) return;
  const chatId = msg.chat.id;

  const history = loadHistory(chatId);
  history.push({ role: 'user', content: msg.text });

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: SYSTEM,
      messages: history.map(m => ({ role: m.role, content: m.content }))
    });

    const reply = response.content[0].text;
    history.push({ role: 'assistant', content: reply });
    saveHistory(chatId, history);
    bot.sendMessage(chatId, reply);
  } catch (err) {
    console.error('Ben bot error:', err.message);
    bot.sendMessage(chatId, 'Thinking too hard. Try again in a sec.');
  }
});

console.log('Ben\'s Telegram bot connected — @klabgbot');
