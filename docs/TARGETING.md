# Zeynara — Meta Ads targeting rejasi

Budjet: **$10/kun**. Maqsad: 30–55 yosh, sifatli lead, Toshkentsiz.
Holat: 2026-10-19.

---

## 0. Eng muhim qaror: faqat BITTA ad set

Meta ad set'ni optimizatsiya qilishi uchun unga **haftasiga ~50 ta konversiya** kerak.
$10/kun = haftasiga $70. Lead $2 bo'lsa — haftasiga 35 lead. Bitta ad setda ham zo'rg'a yetadi.

Ikkita ad setga bo'lsangiz har biriga 17 tadan tushadi. Ikkalasi ham **hech qachon**
learning phase'dan chiqmaydi, ikkalasi ham qimmat va sifatsiz lead beradi.
Aynan shu hozir sodir bo'lgan.

**Qaror:** bitta ad set yoqiq, qolganlari OFF. Video testini keyin, budjet oshgach qiling.

---

## 1. Nega "Exclude Tashkent" auditoriyani 2000 ga tushirdi

Meta'da **exclusion har doim inclusion'dan ustun**. Siz "Toshkent" ni exclude qilganingizda
u shahar sifatida `+25 mi` radius bilan tushgan — 40 km doira Toshkent viloyati va
Sirdaryoning katta qismini ham kesib tashlaydi. Qolgan auditoriya mayda-chuyda bo'lib qoladi.

Siz viloyatlarni birma-bir tanlaganingizda bu muammo yo'qoldi — **va bu to'g'ri yo'l**.

> **Qoida: exclude ishlatmang. Kerakli viloyatlarni birma-bir tanlang.**
> Toshkentni "exclude" qilmang — shunchaki tanlamang.

---

## 2. Geografiya — aniq ro'yxat

Ad set → Audience → Locations → **faqat viloyat (Region)** tanlang.
Shahar tanlamang, Drop Pin ishlatmang.

Tanlanadigan 12 ta hudud:

| | |
|---|---|
| Andijon viloyati | Qashqadaryo viloyati |
| Farg'ona viloyati | Surxondaryo viloyati |
| Namangan viloyati | Jizzax viloyati |
| Samarqand viloyati | Sirdaryo viloyati |
| Buxoro viloyati | Navoiy viloyati |
| Xorazm viloyati | Qoraqalpog'iston Respublikasi |

**Tanlanmaydi:** Toshkent shahri, Toshkent viloyati.

### Tekshirish
Ro'yxatdagi birorta qatorda **`(+25 mi)` yoki `(+21 mi)` bo'lmasligi kerak.**
Agar bor bo'lsa — siz shahar tanlagansiz. O'sha qatorni o'chiring va qidiruvda yozganda
ochilgan ro'yxatdan yonida **"Region"** deb turganini tanlang, "City" ni emas.

Hozirgi holatda bu xatolar bor va ular Andijon/Namangandan 40 km narigi
**Qirg'iziston (Oʻsh, Jalolobod)** ga reklama ko'rsatyapti — u yerga mahsulot yetkaza
olmaysiz, lekin pulni to'lab turibsiz.

### Location type — ENDI MAVJUD EMAS (2026-10-19 tekshirildi)
Avval bu yerda "People living in this location" ni tanlash kerak deb yozilgandi.
**Meta bu tanlovni Leads / conversion maqsadidagi kampaniyalardan olib tashlagan.**
Tekshirildi: viloyat qatoridagi `•••` menyusida faqat "Exclude location" va
"Report a problem" bor; "Browse" yonidagi chevron esa xaritani ochadi, location type emas.
Butun Locations panelida "living in" matni umuman yo'q.

Demak bu bandni bajarib bo'lmaydi — uni o'tkazib yuboring. Geografiya sifati endi
faqat ikki narsaga bog'liq: (1) 12 viloyat aniq Region sifatida tanlangani,
(2) **"Reach more people likely to respond to your ads"** belgilanmagani.

---

## 3. Qolgan audience sozlamalari

| Sozlama | Qiymat | Sabab |
|---|---|---|
| Age | 30–55 | Boss talabi. Keyin 40–60 ni test qiling — qon bosimi uchun ko'proq mos. |
| Gender | All | O'zbekistonda ayollar er/ota uchun ham sotib oladi. |
| Languages | **All languages — bo'sh qoldiring** | Meta telefon interfeysi tilini oladi. O'zbeklarning yarmi rus yoki ingliz interfeysda. "Uzbek" tanlasangiz auditoriyani bejiz ikkiga bo'lasiz. |
| Detailed targeting | **Bo'sh** | $10/kun'da interest qo'shish o'ldiradi. Meta konversiya signali bo'yicha o'zi topadi — faqat signal to'g'ri bo'lsa (4-bo'lim). |
| Advantage+ audience | **OFF** | Yoqilsa Meta yosh chegarasidan chiqib ketadi. Boss 30–55 degan. |
| Advantage+ placements | ON | Bu joyida, tegmang. |
| Advantage+ leads campaign | **OFF** | 3-ad setda yoqiq — o'chiring. U geo cheklovdan chiqib ketadi. |

---

## 4. Signal to'g'ri bo'lmasa, targeting qutqarmaydi

Hozir piksel **har bir forma to'ldirilganda** `Lead` yuboryapti. Raqib kompaniya soxta
forma tashlaydi → Meta "bu yaxshi mijoz" deb o'ylaydi → **shunga o'xshagan yana odam qidiradi.**

Ya'ni siz spamga pul to'lab, Meta'ga "menga ko'proq spam ber" deb o'rgatyapsiz.
Hech qanday geo sozlama buni tuzatmaydi.

Yechim allaqachon kodda yozilgan (`apps/worker/src/meta.ts`): operator telefon qilib
tugma bosgandan keyingina `Lead` yuboriladi. **Deploy qilinmaguncha targetingni
o'zgartirishning ma'nosi kam.**

```bash
npm test --workspace=@bionex/worker
STRICT_PRODUCTION_BUILD=1 npm run build
npm run deploy
```

Keyin landing page'dagi brauzer pikselining `Lead` chaqiruvini o'chiring
(ikki marta hisoblanmasligi uchun).

---

## 5. Spam raqamlarni reklamadan butunlay chiqarish

CRM'dagi soxta raqamlarni Custom Audience qilib yuklang — o'sha odamlar reklamani
umuman ko'rmaydi.

1. Ads Manager → **Audiences** → Create audience → **Custom Audience** → **Customer list**
2. CSV tayyorlang. Birinchi qator sarlavha, ustun nomi `phone`:
   ```
   phone
   998901234567
   998931112233
   ```
   `+`, bo'shliq va chiziqcha bo'lmasin. Mamlakat kodi (998) bo'lsin.
3. Nomi: `Spam — raqib kompaniya`
4. Yuklang. Meta mos tushirish uchun **kamida ~100 ta raqam** kutadi va **24 soatgacha**
   vaqt oladi.
5. Ad set → Audience → **Exclude** → shu ro'yxatni tanlang.

Yangi spam chiqqan sari o'sha ro'yxatga qo'shib boring (Audience → Edit → Add more).

---

## 6. Budjet va jadval

- **Daily budget $10** — shundayligicha qoldiring.
- 00:00 da boshlanishi normal, muammo emas.
- **Dayparting (soat chegarasi) qilmang.** U uchun lifetime budget kerak, bu esa yana
  learning reset. $10/kun'da bunga arzimaydi.
- Bid strategy: **Highest volume** ✓ (hozir to'g'ri)
- Attribution: **Standard (7-day click, 1-day view)** ✓ (hozir to'g'ri)

---

## 7. Reklama darajasi (Ad level)

**URL parameters** maydoni hozir bo'sh. Shuni qo'ying:

```
utm_source=facebook&utm_medium=paid&utm_campaign={{campaign.name}}&utm_term={{adset.name}}&utm_content={{ad.name}}&fb_placement={{placement}}
```

Shunda Telegram mini-CRM'da har bir lead qaysi kampaniya va qaysi videodan kelganini
ko'rsatadi — spam manbasini aniqlay olasiz. **Bu learning'ni reset qilmaydi.**

### Makro yetarli emas: `utm_content` ni qo'lda yozing

`{{ad.name}}` reklama nomini oladi, lekin kampaniyani dublikat qilganda nusxa **asl
nomlarni saqlab qoladi** — ikkala reklama bir xil nom bilan qoladi, demak ikkala lead
Telegram'da bir xil ko'rinadi. Shuning uchun har bir reklamaga `utm_content` ni makro
emas, **o'zgarmas aniq qiymat** qilib yozing:

| Reklama | `utm_content` |
|---|---|
| `Zeynara \| Video 1` (eski video) | `old-video` |
| `Zeynara \| Reel` (yangi Reel) | `new-reel` |

Qolgani makro bo'lib qolsin. Ad set nomlarini ham farqlang (hozir ikkisi ham
`UZ \| 30-55 \| Qon bosimi`) — aks holda `{{adset.name}}` ham ikkalasida bir xil.

Makro publish paytida almashadi: keyin nomni o'zgartirsang, allaqachon yig'ilgan data
tuzalmaydi. Qo'lda yozilgan qiymat esa doim aniq.

⚠️ Ad darajasida URL parametrini o'zgartirish **draft** yaratadi. Uni publish qilish
learning phase'ni qaytadan boshlaydi, shuning uchun ikkala reklamani **bitta o'tirishda**
tuzatib, bir marta publish qiling.

**Sayt manzili** hozir `https://zeynara.8pj6jsdbgr.workers.dev/`. O'z domeningizni
ulang — o'zbek xaridori `workers.dev` manzilga ishonmaydi va konversiya tushadi.

---

## 8. Bajarish tartibi

Hammasini **bitta o'tirishda** qiling, keyin **7 kun tegmang**.
Har bir o'zgartirish learning phase'ni noldan boshlaydi.

- [x] **1.** CAPI deploy + brauzer piksel `Lead` ini o'chirish (4-bo'lim)
- [ ] **2.** Spam raqamlar CSV → Custom Audience yuklash (5-bo'lim) — 24 soat kutadi
- [ ] **3.** Bitta ad setni asosiy qilib tanlash, qolganlarini OFF — hozir 2 ta ishlayapti
- [x] **4.** Geo: 12 ta viloyat, `(+25 mi)` siz (2-bo'lim) — ikkala ad setda ham
- [~] **5.** ~~Location type~~ — Meta bu tanlovni olib tashlagan, bajarib bo'lmaydi
- [x] **6.** Languages → bo'sh, Detailed targeting → bo'sh
- [x] **7.** Advantage+ audience OFF, Advantage+ leads campaign OFF
- [ ] **8.** Exclude → `Spam — raqib kompaniya`
- [x] **9.** Ad level: URL parameters qo'shish — ikkala reklamada ham to'liq (141 belgi)
- [x] **10.** Publish → **7 kun hech narsaga tegmaslik**

### 2026-10-19 audit natijasi

Ikkala jonli kampaniya to'liq tekshirildi. **Bloklovchi xato yo'q.** Topilgan farqlar:

| Narsa | Original `…180134` | Copy `…560134` |
|---|---|---|
| 12 viloyat, `(+25 mi)` yo'q | ✅ | ✅ |
| "Reach more people…" | ❌ belgilanmagan (to'g'ri) | ❌ belgilanmagan (to'g'ri) |
| Auditoriya | 5.1–5.9M | 5.1–5.9M |
| Yosh / Jins | 30–55 / All | 30–55 / All |
| Piksel + `Lead` + Standard attribution | ✅ | ✅ |
| Website URL | ✅ workers.dev | ✅ workers.dev |
| URL parameters (141 belgi) | ✅ | ✅ |
| Advantage+ audience / leads campaign | Off / Off | Off / Off |
| Advantage+ creative | 0/4 — hammasi Off | ~~Standard + Add product browsing~~ → **tuzatildi, 0/6 hammasi Off** |
| Multi-advertiser ads | On | On |
| Ad set nomi / reklama nomi | `UZ \| 30-55 \| Qon bosimi` / `Zeynara \| Qon-bosimi \| sayt-lid` | **aynan bir xil** |

Tuzatish kerak bo'lgan 4 ta kamchilik:

1. **Original postdagi `[ҲАВОЛА / ТЕЛЕФОН]` placeholder** hali ham jonli matnda turibdi
   (post `17902462656372197`). Mijoz shuni ko'radi. Instagram'dan caption'ni tahrirlang —
   reklama o'chmaydi, chunki reklama mavjud postga ishora qiladi.
2. **Ad set va reklama nomlari ikkalasida bir xil** → `{{adset.name}}` va `{{ad.name}}`
   UTM qiymatlari bir xil chiqadi, faqat `{{campaign.name}}` farq qiladi (`- Copy`).
   Saytdagi statistikada ikki kreativni ajratish qiyin bo'ladi. Copy'da nomlarni
   `UZ | 30-55 | Reel-27s` / `Zeynara | Reel-27s | sayt-lid` ga o'zgartirish kerak —
   lekin **faqat learning phase tugagandan keyin**, nom o'zgartirish ham edit hisoblanadi.
3. ~~**Advantage+ creative bir xil emas**~~ — **2026-10-19 da tuzatildi.** Copy'dagi
   "Add product browsing" (Essential enhancements ichida, "On by default") o'chirildi va
   publish qilindi ("Ad updated"). Endi ikkala reklamada ham barcha Advantage+ creative va
   Essential enhancement'lar Off. Yo'li: reklama editori → Advantage+ creative bo'limi →
   `Edit` → modal ichida pastga scroll → "Essential enhancements" → katakchani olib tashlash
   → chiqqan oynada **Turn off** (sabab yozish shart emas) → `Save` → `Publish`.
4. **0-bo'lim ogohlantirishi kuchda**: $10 + $10 = ikkala ad set ham haftasiga 50 ta
   konversiyaga yetmaydi, ya'ni ikkalasi ham learning phase'dan chiqmasligi mumkin.

Yana: **2 ta "phantom draft"** ("Updated: Creative") topildi va `Discard drafts` bilan
tozalandi. Ular editor oynasini ochganda avtomatik paydo bo'lgan edi (URL parameters
maydonidagi "Values previously set"). Ularni Publish qilish learning phase'ni behuda
qayta boshlagan bo'lardi. **Qoida: editor'ni ochib yopgandan keyin yuqoridagi
"Review and publish (N)" tugmasini tekshiring — N > 0 bo'lsa va siz hech narsa
o'zgartirmagan bo'lsangiz, Discard qiling.**

7 kundan keyin qarang: CPL (lead narxi) va eng muhimi — **operator tasdiqlagan**
leadlar soni. Endi Meta aynan shularni qidiradi.

---

## 9. Keyingi qadam: formaga SMS tasdiqlash

Eng kuchli anti-spam chorasi — targetingdan ham samaraliroq.

Raqib kompaniya 100 ta soxta raqam yoza oladi, lekin **100 ta SMS kodini kiritolmaydi**.
Hozirgi rate-limit (`IP_ORDERS_PER_HOUR=3`) IP bo'yicha ishlaydi — VPN bilan aylanib
o'tiladi. SMS kodi esa haqiqiy telefon raqamini talab qiladi.

Bundan tashqari CAPI'ga yuboriladigan `ph` maydoni tasdiqlangan raqam bo'ladi —
Meta'ning match quality ko'rsatkichi ham ko'tariladi.

---

## 10. Nega 7 lead'dan 0 savdo chiqdi

Reach 3,707, 7 lead — lead chiqish foizi yomon emas. Muammo targetingda emas, **sifatda**:

1. Raqib kompaniya ataylab soxta forma tashlagan (`docs/SPAM.md`: dastlabki 8 leaddan
   5 tasi mijoz emas edi)
2. Piksel har formaga `Lead` otgani uchun Meta o'sha spam beruvchilarga o'xshash
   odamlarni qidirgan
3. `+25 mi` radius Qirg'izistonga chiqib, yetkazib bera olmaydigan odamlarga
   reklama ko'rsatgan

Uchalasi ham yuqoridagi reja bilan yopiladi.
