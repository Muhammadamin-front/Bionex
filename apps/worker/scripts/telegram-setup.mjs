#!/usr/bin/env node
/**
 * Connects the operators' Telegram group or channel, step by step:
 *   npm run telegram:setup
 *
 * Checks the bot token, finds the private group/channel the bot was added to, refuses a
 * public one (orders contain customers' names and numbers), sends a test message, writes
 * the values to apps/worker/.dev.vars, and (if you agree) saves them as Cloudflare secrets.
 * Messages are in Uzbek for the site owner.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';

const DEV_VARS = new URL('../.dev.vars', import.meta.url);
const rl = createInterface({ input: process.stdin, output: process.stdout });
const ask = async (q) => (await rl.question(q)).trim();

function readDevVar(name) {
  if (!existsSync(DEV_VARS)) return '';
  const line = readFileSync(DEV_VARS, 'utf8').split('\n').find((l) => l.startsWith(`${name}=`));
  return line ? line.slice(name.length + 1).trim().replace(/^["']|["']$/g, '') : '';
}

function writeDevVar(name, value) {
  let text = existsSync(DEV_VARS) ? readFileSync(DEV_VARS, 'utf8') : '';
  const re = new RegExp(`^${name}=.*$`, 'm');
  text = re.test(text) ? text.replace(re, () => `${name}=${value}`) : `${text.replace(/\n*$/, '\n')}${name}=${value}\n`;
  writeFileSync(DEV_VARS, text, { mode: 0o600 });
}

async function tg(token, method, body) {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  });
  return res.json();
}

function chatsFrom(updates) {
  const chats = new Map();
  for (const u of updates) {
    const chat = u.my_chat_member?.chat ?? u.message?.chat ?? u.channel_post?.chat;
    if (chat && ['group', 'supergroup', 'channel'].includes(chat.type)) chats.set(String(chat.id), chat);
  }
  return [...chats.values()];
}

let token = readDevVar('TELEGRAM_BOT_TOKEN');
if (token) console.log('Bot tokeni apps/worker/.dev.vars faylidan olindi.');
else token = await ask('1) @BotFather bergan bot tokenini kiriting (masalan 123456:ABC...): ');
const me = await tg(token, 'getMe');
if (!me.ok) {
  console.error('\n❌ Token noto‘g‘ri. @BotFather → /mybots → botingiz → API Token dan qayta nusxalang.');
  process.exit(1);
}
console.log(`✅ Bot topildi: @${me.result.username}\n`);

let chats = [];
for (;;) {
  const updates = await tg(token, 'getUpdates', { allowed_updates: ['message', 'channel_post', 'my_chat_member'] });
  if (updates.error_code === 409) {
    // The site already receives the bot's messages (webhook): it is connected and working.
    console.log('✅ Bot saytga allaqachon ulangan va ishlayapti. Guruhda /holat deb yozib tekshiring.');
    console.log('   Boshqa guruhga o‘tkazish kerak bo‘lsa, dasturchiga murojaat qiling.');
    process.exit(0);
  }
  chats = chatsFrom(updates.result ?? []);
  if (chats.length > 0) break;
  console.log(`2) @${me.result.username} ni kanalga (admin qilib) yoki guruhga qo‘shing va u yerga istalgan xabar yozing (masalan "salom").`);
  await ask('   Tayyor bo‘lsa Enter bosing...');
}

let chat = chats[0];
if (chats.length > 1) {
  chats.forEach((c, i) => console.log(`   ${i + 1}) ${c.title} (${c.type === 'channel' ? 'kanal' : 'guruh'})`));
  const pick = Number(await ask('Qaysi biri? Raqamini kiriting: '));
  chat = chats[pick - 1] ?? chat;
}
const chatId = String(chat.id);

// Orders contain customers' names and phone numbers: never send them to a public chat.
const info = await tg(token, 'getChat', { chat_id: chatId });
if (info.result?.username) {
  console.error(
    `\n❌ "${chat.title}" OCHIQ (@${info.result.username}): buyurtmalarni (ism va telefon raqamlarni) hamma ko‘radi.\n` +
      '   Kanal sozlamalari → Channel type → Private qiling, keyin qayta ishga tushiring.',
  );
  process.exit(1);
}
if (chat.type === 'channel') {
  const member = await tg(token, 'getChatMember', { chat_id: chatId, user_id: me.result.id });
  if (member.result?.status !== 'administrator' || member.result?.can_post_messages === false) {
    console.error('\n❌ Bot kanalda admin emas yoki xabar yoza olmaydi. Kanal → Administrators → botga "Post messages" huquqini bering.');
    process.exit(1);
  }
}

const sent = await tg(token, 'sendMessage', { chat_id: chatId, text: '✅ Зейнара сайти уланди. Янги буюртмалар шу ерга келади.' });
if (!sent.ok) {
  console.error(`\n❌ Xabar yuborib bo‘lmadi: ${sent.description}`);
  process.exit(1);
}
console.log(`\n✅ "${chat.title}" ga sinov xabari yuborildi.`);
writeDevVar('TELEGRAM_BOT_TOKEN', token);
writeDevVar('TELEGRAM_CHAT_ID', chatId);
console.log('   Qiymatlar apps/worker/.dev.vars ga yozildi (kompyuterda sinash uchun).\n');

const save = await ask('3) Ularni saytning o‘ziga (Cloudflare) ham saqlaymi? (ha / yo‘q): ');
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
  console.log('\n✅ Saqlandi. Saytdan sinov buyurtma bering — kanalga kelishi kerak.');
} else {
  console.log('Keyinroq: npm run telegram:setup (yoki npx wrangler secret put TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID)');
}
rl.close();
