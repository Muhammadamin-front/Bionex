#!/usr/bin/env node
/**
 * Connects the operators' Telegram group, step by step:
 *   npm run telegram:setup
 *
 * Checks the bot token, finds the group the bot was added to, sends a test message there,
 * and (if you agree) saves TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID as Cloudflare secrets.
 * Messages are in Uzbek for the site owner.
 */
import { spawnSync } from 'node:child_process';
import { createInterface } from 'node:readline/promises';

const rl = createInterface({ input: process.stdin, output: process.stdout });
const ask = async (q) => (await rl.question(q)).trim();

async function tg(token, method, body) {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  });
  return res.json();
}

function groupsFrom(updates) {
  const chats = new Map();
  for (const u of updates) {
    const chat = u.my_chat_member?.chat ?? u.message?.chat ?? u.channel_post?.chat;
    if (chat && (chat.type === 'group' || chat.type === 'supergroup')) chats.set(String(chat.id), chat.title ?? String(chat.id));
  }
  return [...chats];
}

const token = await ask('1) @BotFather bergan bot tokenini kiriting (masalan 123456:ABC...): ');
const me = await tg(token, 'getMe');
if (!me.ok) {
  console.error('\n❌ Token noto‘g‘ri. @BotFather → /mybots → botingiz → API Token dan qayta nusxalang.');
  process.exit(1);
}
console.log(`✅ Bot topildi: @${me.result.username}\n`);

let groups = [];
for (;;) {
  const updates = await tg(token, 'getUpdates', { allowed_updates: ['message', 'my_chat_member'] });
  groups = groupsFrom(updates.result ?? []);
  if (groups.length > 0) break;
  console.log(`2) @${me.result.username} ni operatorlar guruhiga qo‘shing va guruhga istalgan xabar yozing (masalan "salom").`);
  await ask('   Tayyor bo‘lsa Enter bosing...');
}

let chatId = groups[0][0];
if (groups.length > 1) {
  groups.forEach(([id, title], i) => console.log(`   ${i + 1}) ${title}  (${id})`));
  const pick = Number(await ask('Qaysi guruh? Raqamini kiriting: '));
  chatId = groups[pick - 1]?.[0] ?? chatId;
}

const sent = await tg(token, 'sendMessage', {
  chat_id: chatId,
  text: '✅ Зейнара сайти уланди. Янги буюртмалар шу гуруҳга келади.',
});
if (!sent.ok) {
  console.error(`\n❌ Guruhga yozib bo‘lmadi: ${sent.description}. Botni guruhdan chiqarib, qayta qo‘shing.`);
  process.exit(1);
}
console.log(`\n✅ Guruhga sinov xabari yuborildi. Guruh ID: ${chatId}\n`);

const save = await ask('3) Token va guruh ID ni Cloudflare’ga saqlaymi? (ha / yo‘q): ');
if (/^h/i.test(save)) {
  for (const [name, value] of [
    ['TELEGRAM_BOT_TOKEN', token],
    ['TELEGRAM_CHAT_ID', chatId],
  ]) {
    const r = spawnSync('npx', ['wrangler', 'secret', 'put', name], { input: value, stdio: ['pipe', 'inherit', 'inherit'] });
    if (r.status !== 0) {
      console.error(`\n❌ ${name} saqlanmadi. Avval "npx wrangler login" va "npm run deploy" ni bajaring, keyin qayta urining.`);
      process.exit(1);
    }
  }
  console.log('\n✅ Saqlandi. Saytdan sinov buyurtma bering — guruhga kelishi kerak.');
} else {
  console.log('Keyinroq saqlash uchun:\n  npx wrangler secret put TELEGRAM_BOT_TOKEN\n  npx wrangler secret put TELEGRAM_CHAT_ID');
}
rl.close();
