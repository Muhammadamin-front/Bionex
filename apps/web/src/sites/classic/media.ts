// The main site's media and the customers' words, shared by its two pages: zeynara.com.uz (index.tsx) and the
// workers.dev poster page (../plakat). The files live only on the Mac that deploys (.gitignore): the public repo never
// carries customers' faces, and a missing file just leaves its part out.
const media = import.meta.glob<string>('./media/*.{mp4,jpg,webp}', { eager: true, query: '?url', import: 'default' });
export const file = (name: string) => media[`./media/${name}`];
/** A picture: its WebP copy when there is one (2026-11-14: the covers and the certificate as JPEG were ~2× larger). */
export const pic = (name: string) => file(`${name}.webp`) ?? file(`${name}.jpg`);

/**
 * In the order shown: the filmed stories with the box in hand first (vertical, `cover`), then the
 * Telegram video messages (square, `contain` keeps the round message whole).
 */
export const videos = [
  { name: 'story-0', length: '0:46', fit: 'object-cover' },
  { name: 'story-1', length: '0:41', fit: 'object-cover' },
  { name: 'story-2', length: '1:48', fit: 'object-cover' },
  { name: 'story-3', length: '3:00', fit: 'object-cover' },
  { name: 'review-1', length: '1:00', fit: 'object-contain' },
  { name: 'review-2', length: '0:35', fit: 'object-contain' },
  { name: 'review-3', length: '0:36', fit: 'object-contain' },
]
  .map((v) => ({ ...v, src: file(`${v.name}.mp4`), poster: pic(v.name) }))
  .filter((v): v is typeof v & { src: string } => Boolean(v.src));
export const certificate = { full: pic('certificate'), small: pic('certificate-small') };

/**
 * The owner's own photos of the box (2026-11-06; the sharp ones of ten, cropped and shrunk to WebP without
 * their metadata, see AGENTS.md #63). `name-<width>.webp` for each width; a missing file leaves the photo out.
 */
export function photoSet(name: string, widths: number[]) {
  const files = widths.map((w) => file(`${name}-${w}.webp`));
  if (files.some((f) => !f)) return undefined;
  return {
    src: files[Math.min(1, files.length - 1)]!,
    srcSet: files.map((f, i) => `${f} ${widths[i]}w`).join(', '),
    full: files[files.length - 1]!,
  };
}
export const front = photoSet('pack-front', [360, 540, 720]);
export const packPhotos = [
  { name: 'pack-angle', widths: [400, 600, 800], width: 800, height: 1067, alt: 'Зейнара қутиси ён томондан', caption: 'Зейнара сиропи, 330 мл', top: false },
  { name: 'pack-latin', widths: [400, 600, 800], width: 800, height: 1067, alt: 'Зейнара қутисининг лотин ёзувли тури', caption: 'Лотин ёзувли қадоғи', top: false },
  // Ingredients and how to take it: cut above the maker's address and phone.
  { name: 'pack-back', widths: [600, 1000], width: 1000, height: 1479, alt: 'Қути орқасидаги таркиб ва ичиш тартиби', caption: 'Таркиби ва ичиш тартиби (қути орқасида)', top: true },
]
  .map((p) => ({ ...p, set: photoSet(p.name, p.widths) }))
  .filter((p): p is typeof p & { set: NonNullable<typeof p.set> } => Boolean(p.set));

/**
 * What the customers in the videos say, written out (owner, 2026-11-14: «videodagi mijozlarning review larini yozma
 * tarzda qo'shish»). Their own words, lightly shortened: Gulchehra opa's from the ad's captions; the others heard with
 * whisper.cpp (large-v3, on this Mac) and read back by the agent, so a word may be off — the owner checks them against
 * the videos. Names only where the video says them. Not the two Telegram video messages of the older men (review-2,
 * review-3): too unclear to write down without inventing words. No company name: the visitor never learns it (#16).
 */
export const writtenReviews: Array<{ video: string; who: string; text: string }> = [
  {
    video: 'story-0',
    who: 'Гулчеҳра опа, 55 ёш',
    text: 'Тез чарчоқ, уйқусизлик мени безовта қиларди. Бир танишим менга Зейнара маҳсулотини тавсия қилди. Ҳозир ўзимни жуда яхши ҳис қиламан. Бунинг учун Зейнарага раҳмат!',
  },
  {
    video: 'story-2',
    who: 'Мижозимиз, 58 ёш',
    text: 'Қон босимим 180 га 100, 170 га 100 бўлиб юрардим, қанча касалхоналарда ётиб чиқдим. Юрак оғриқларим жуда кўп эди. Бир куни Instagram’да Зейнарани кўриб қолдим. Ичгандан бери анча яхшиман: босимим 140 га 100, 130 га 90 бўлди. Ҳолсизлик кетди, ўзимда куч сезяпман. Ҳаммага тавсия қиламан.',
  },
  {
    video: 'story-1',
    who: 'Мижозимиз, Сурхондарё вилояти',
    text: 'Бир неча ой олдин юрак уриши, қон босими, юракда безовталик, асабийлашиш пайдо бўлди. Бир неча шифокорга мурожаат қилиб, дори-дармон қилдим, лекин унча фойда кўрмадим. Instagram’да Зейнара рекламасини кўриб, харид қилдим ва ича бошладим. Яхши тарафга ўзгарди, раҳмат!',
  },
  {
    video: 'story-3',
    who: 'Мижозимиз, 65 ёш, Самарқанд вилояти',
    text: 'Қон босимим кўтарилиб, ҳолатим, кучим йўқ эди. Зейнарани эшитиб, аввал оламми-олмайми деб ўйландим. Бир ҳафтадан кейин фарқини сездим. Жуда яхши. Дугоналаримга ҳам тавсия қиламан, улар ҳам баҳра топсин.',
  },
  {
    video: 'review-1',
    who: 'Мижозимиз, Тошкент шаҳри',
    text: 'Тошкентдан буюртма қилиб олиб, ичяпман. Илгари нафас етишмасди, ентикиб қолардим, юриш ҳам қийин эди. Ҳозир юришда қийинчилик йўқ, анча ўзгариш бор. Фойдаси жуда-жуда зўр!',
  },
];

