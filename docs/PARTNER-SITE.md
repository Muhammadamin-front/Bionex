# Ikkinchi sayt (targetolog uchun): zeynaraa-uz.pages.dev

Tashqi targetolog o'z reklamasini **alohida saytga** yuboradi. Dizayn xuddi asosiy saytniki,
lekin manzili, Pixel'i va Google jadvali boshqa. U asosiy sayt, bizning Pixel yoki boshqa
kampaniyalar haqida hech narsa ko'rmaydi. Uning lidlari **faqat uning Google jadvaliga**
tushadi: bizning Telegram guruh, CRM panel, ro'yxatlar va hisobotlarga umuman tushmaydi.
Qo'ng'iroqni uning odamlari jadvaldan qiladi.

```
Mijoz → zeynaraa-uz.pages.dev (Cloudflare Pages, faqat uning Pixel'i 1783794022832394)
          │  POST /api/leads → service binding (Cloudflare ichida, brauzerda ko'rinmaydi)
          ▼
        asosiy Worker «zeynara» → PartnerSite → acceptPartner
          ├─► Google jadval «Lidlar» varag'i: №, sana, ism, TELEFON, kampaniya, ad set, video
          │     «Holat» = «Keraksiz» ← server har 5 daqiqada o'qiydi → spam belgisi (tarmoq + qurilma)
          └─► Lead darhol UNING Pixel'iga (META_T2_CAPI_TOKEN) — operator tugmasi yo'q
        ✗ Telegram guruh, CRM panel, /royxat, kunlik hisobot — tushmaydi
```

| | Asosiy sayt | 2-sayt |
|---|---|---|
| Manzil | `zeynara.8pj6jsdbgr.workers.dev` | `zeynaraa-uz.pages.dev` |
| Pixel (brauzer) | `1109358048693673` | `1783794022832394` |
| Lead / Purchase (server) | `META_PIXEL_ID` + `META_CAPI_TOKEN` | `META_T2_PIXEL_ID` + `META_T2_CAPI_TOKEN` |
| Lead qachon ketadi | operator ✅/❌ bosganda | forma yuborilgan zahoti |
| Lidlar qayerga tushadi | Telegram guruh + CRM panel | faqat Google jadval (`SHEETS_T2_URL` + `SHEETS_T2_SECRET`) |
| Dublikat (24 soat) | o'z ichida | o'z ichida — bir saytdagi buyurtma ikkinchisida takror hisoblanmaydi |
| Turnstile, IP cheklovlari | bor | bor |

Kod: `apps/partner/` (Pages), `apps/worker/src/sites.ts`, `sheets.ts`, `index.ts` → `PartnerSite`,
`registry.ts` → `acceptPartner` (jadval `partner_leads`: faqat hash'lar, 30 kun). Frontend: `apps/web/.env.t2` (gitignored, qiymatlari
ochiq) va `npm run build:t2` → `apps/web/dist-t2`.

---

## Sozlash — qadamma-qadam (bir marta)

### 1. Google jadval (sizning akkauntingizda)
1. [sheets.new](https://sheets.new) — yangi jadval, nomi masalan «Zeynara — 2-sayt lidlari».
2. **Extensions → Apps Script**. Bor kodni o'chirib, pastdagi skriptni qo'ying, 💾 saqlang.
3. Terminalda kalit yarating: `openssl rand -hex 24` — natijani nusxalab qo'ying.
4. Apps Script'da ⚙️ **Project Settings → Script properties → Add script property**:
   nomi `SECRET`, qiymati — 3-banddagi kalit. **Save**.
5. **Deploy → New deployment** → ⚙️ → **Web app**. Execute as: **Me**. Who has access:
   **Anyone**. **Deploy**.
6. **Authorize access** → akkaunt → **Advanced → Go to … (unsafe) → Allow** (skript sizniki).
7. **Web app URL** ni (`https://script.google.com/macros/s/…/exec`) nusxalang.
8. Jadvalni targetologga **Viewer** (faqat ko'rish) huquqi bilan ulashing.

```js
// Server shu yerga murojaat qiladi: yangi lidni yozish yoki «Holat» ustunini o'qish.
function doPost(e) {
  const data = JSON.parse(e.postData.contents);
  if (data.secret !== secret()) return ContentService.createTextOutput('forbidden');
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (data.action === 'statuses') return statuses(ss.getSheetByName(data.sheet));
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    let sh = ss.getSheetByName(data.sheet);
    if (!sh) {
      sh = ss.insertSheet(data.sheet);
      sh.appendRow(data.headers);
      sh.setFrozenRows(1);
    }
    sh.appendRow(byHeader(sh, data));
    copyDropdown(sh, sh.getLastRow());
    return ContentService.createTextOutput('ok');
  } finally {
    lock.releaseLock();
  }
}

// Har bir lidning № va «Holat»i: server har 5 daqiqada so'raydi («Keraksiz» = spam).
function statuses(sh) {
  let rows = [];
  if (sh && sh.getLastRow() > 1) {
    const values = sh.getRange(1, 1, sh.getLastRow(), sh.getLastColumn()).getValues();
    const n = values[0].indexOf('№');
    const h = values[0].indexOf('Holat');
    if (n >= 0 && h >= 0) rows = values.slice(1).map(function (r) { return [r[n], r[h]]; });
  }
  return ContentService.createTextOutput(JSON.stringify(rows)).setMimeType(ContentService.MimeType.JSON);
}

// Har bir qiymatni o'z sarlavhasi ostiga qo'yadi: ustunlar tartibini bemalol o'zgartirish mumkin.
function byHeader(sh, data) {
  const head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  return head.map(function (h) {
    const i = data.headers.indexOf(String(h).trim());
    return i >= 0 ? data.row[i] : '';
  });
}

function holatColumn(sh) {
  return sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].indexOf('Holat') + 1;
}

// Yangi qatorda «Holat» dropdown'i bo'lmasa, qo'shni qatordagisini (sizning ro'yxatingizni) nusxalaydi.
function copyDropdown(sh, row) {
  const col = holatColumn(sh);
  if (!col || sh.getRange(row, col).getDataValidation()) return;
  const rule = sh.getRange(row > 2 ? row - 1 : row + 1, col).getDataValidation();
  if (rule) sh.getRange(row, col).setDataValidation(rule);
}

function secret() {
  return PropertiesService.getScriptProperties().getProperty('SECRET');
}

// Avvalgi versiyadan trigger qolib ketgan bo'lsa, xato bermasligi uchun. Endi ishlatilmaydi.
function onHolatEdit() {}
```

Kodni qo'yib saqlagach: **Manage deployments → ✏️ → New version → Deploy** (URL o'zgarmaydi).
Trigger, `setup` yoki qo'shimcha ruxsat kerak emas: server har 5 daqiqada «Holat» ustunini shu
skript orqali o'qiydi.

Ustunlar sarlavha nomi bo'yicha to'ldiriladi (№, Sana, Ism, Telefon, Kampaniya, Ad set, Video,
Belgi, Holat, Izoh) — tartibini o'zgartirsa bo'ladi, nomini emas. «Holat» dropdown'i jadval
egasiniki; skript uni yangi qatorga qo'shni qatordan nusxalaydi va o'zgartirmaydi. Unda **Keraksiz** varianti bo'lishi kerak (katta-kichik
harf, lotin/kirill farqi yo'q); «Spam» ham xuddi shunday hisoblanadi). «Keraksiz» —
Telegram guruhdagi 🚫 Спам bilan bir xil: o'sha lidning tarmog'i va qurilmasi 30 kun eslab
qolinadi, keyingi buyurtmalari ikkala saytda ham ⚠️ belgi bilan keladi va uning Pixel'iga
Lead yuborilmaydi (5 daqiqagacha kechikish bilan). Boshqa holatga o'zgartirilsa, belgi olib
tashlanadi.

Ustunlarni server yuboradi (varaq nomi, sarlavha, qator); skript faqat «Holat» ustunini nomidan
topadi.

Skriptni keyin o'zgartirsangiz: **Deploy → Manage deployments → ✏️ → Version: New version →
Deploy** (URL o'zgarmaydi). Yangi «New deployment» qilsangiz URL o'zgaradi va 3-qadamdagi
`SHEETS_T2_URL` ni ham yangilash kerak bo'ladi.

Jadvalga «Lidlar» varag'iga har bir buyurtma uchun bitta qator yoziladi: o'z tartib raqami
(1, 2, 3 …), sana, to'liq ism, **telefon**, kampaniya, ad set, video, «Belgi» (bot bo'lishi
mumkin / raqam soxtaga o'xshaydi / «bot emasman» tekshiruvi o'tmadi). «Holat» va «Izoh»
ustunlari bo'sh — ularni targetologning odamlari o'zi to'ldiradi. Server qatorni bir marta
yozadi va keyin unga tegmaydi.

### 2. Turnstile'ga yangi manzil
Cloudflare → **Turnstile** → hozirgi widget → **Hostnames** → `zeynaraa-uz.pages.dev` qo'shing
→ **Save**. Busiz forma «бот эмасман» tekshiruvidan o'tmaydi (buyurtma baribir keladi, lekin
«⚠️ текширув ўтмади» belgisi bilan).

### 3. Pages loyihasini yaratish (bir marta)
```bash
cd "/Users/macbookpro/Desktop/Important Projects/Bionex/apps/partner"
npx wrangler pages project create zeynaraa-uz --production-branch main
```
Nom band bo'lsa Cloudflare boshqa manzil beradi (masalan `zeynaraa-uz-abc.pages.dev`). Unda
`apps/web/.env.t2` dagi `VITE_SITE_URL` ni va 2-qadamdagi Turnstile hostname'ni shu manzilga
o'zgartiring.

### 4. Maxfiy kalitlar
```bash
cd "/Users/macbookpro/Desktop/Important Projects/Bionex/apps/worker"
npx wrangler secret put SHEETS_T2_URL        # 1-qadamdagi Web app URL
npx wrangler secret put SHEETS_T2_SECRET     # 1-qadamdagi SECRET kaliti
npx wrangler secret put META_T2_CAPI_TOKEN   # targetologning Conversions API tokeni
```
Token hali kelmagan bo'lsa, uni keyinroq qo'yasiz — sayt va jadval tokensiz ham ishlaydi, faqat
Lead uning Pixel'iga ketmaydi. Kalit qo'yilgandan keyin qayta deploy shart emas.

### 5. Deploy — avval asosiy, keyin 2-sayt
```bash
cd "/Users/macbookpro/Desktop/Important Projects/Bionex"
npm run deploy --workspace=@bionex/worker      # asosiy Worker (PartnerSite shu yerda)
npm run deploy:t2 --workspace=@bionex/worker   # 2-sayt (Pages)
```
Tartib muhim: 2-sayt asosiy Worker'dagi `PartnerSite` ga ulanadi, u avval mavjud bo'lishi kerak.

### 6. Tekshirish
1. `https://zeynara.8pj6jsdbgr.workers.dev/api/health` → `partnerSheet: true`, token qo'yilgan
   bo'lsa `partnerMeta: true`. (Bu manzilni targetologga bermang.)
2. `https://zeynaraa-uz.pages.dev` ni telefonda oching, test buyurtma qoldiring.
3. Jadvalda «Lidlar» varag'ida qator paydo bo'ladi (ism va telefon bilan).
4. Telegram guruhda va CRM panelda **hech narsa chiqmasligi** kerak.
5. Targetolog Events Manager'da o'z Pixel'ida `PageView` va `Lead` ni ko'radi (30 daqiqagacha
   kechikishi mumkin).

Lead tekshiruvini Meta hisobiga kirmaydigan qilib o'tkazish uchun: targetologdan Events Manager
→ **Test events** dagi `TEST…` kodini oling, `npx wrangler secret put META_T2_TEST_EVENT_CODE`,
sinovdan keyin `npx wrangler secret delete META_T2_TEST_EVENT_CODE`.

---

## Targetologga nima beriladi
- Sayt: `https://zeynaraa-uz.pages.dev`
- Ad darajasida **Destination: Website**, Conversion location: **Website** — Instant Forms emas
  (aks holda lidlar Meta ichida qoladi: na guruhga, na jadvalga tushadi).
- **URL parameters** (Tracking bo'limi):
  `utm_source=facebook&utm_campaign={{campaign.name}}&utm_term={{adset.name}}&utm_content={{ad.name}}`
- Jadvalga **Viewer** huquqi.
- U bergan Pixel kodi saytga qo'yilmaydi va kerak emas: Pixel ID allaqachon saytda.

Undan olinadigan yagona narsa — **Conversions API token** (Events Manager → Pixel → Settings →
Conversions API → Set up direct integration → Generate access token).

## O'chirish
Jadvalga yozishni to'xtatish: `npx wrangler secret delete SHEETS_T2_URL`. Lead'ni uning Pixel'iga
yuborishni to'xtatish: `npx wrangler secret delete META_T2_CAPI_TOKEN`. Saytning o'zi:
Cloudflare → Workers & Pages → `zeynaraa-uz` → Settings → Delete project.
