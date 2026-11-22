// The main site's own wording (owner, 2026-11-14). Not «буюртма» (it put older visitors off), and not «бепул маслаҳат»
// either (tried the same day; the owner: it draws people who only ask the price): «Зейнарага ариза қолдириш», the owner's
// pick of three. The hours the specialist rings, and the number read back before it is sent (many orders came with a
// wrong number).
//
// «Мутахассис», not «кардиолог»: the owner asked for «Кардиолог билан боғланинг» or something like it. Write
// «кардиолог» only if a cardiologist really makes or joins these calls: a customer told a doctor will ring, and then
// rung by a sales operator, stops trusting the page, and a БАД presented with a doctor's advice can break Meta's
// health-ad policy and the advertising rules for supplements. Then change WHO and WHOS below.
import { formatUzPhone } from '@bionex/shared/phone';
import type { PageCopy } from '../../lib/copy';
import { product } from '../../config/product';

const WHO = 'мутахассис';
const WHOS = 'мутахассисимиз';
const HOURS = '9:00–21:00 оралиғида';
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const ORDER_FAQ = 'Буюртма берсам нима бўлади?';

export const MAIN_COPY: PageCopy = {
  // «Батафсил маълумот олиш» again (owner, 2026-11-22). Meta once had an automatic-events rule on exactly this
  // text that sent a Lead for every press (#27); it was deleted, and the Pixel's config has no `estRules` now.
  // Never turn on Events Manager's «track events automatically without code».
  submit: 'Батафсил маълумот олиш',
  sectionButton: 'Батафсил маълумот олиш',
  bar: 'Батафсил маълумот олиш',
  underButton: `Олдиндан тўлов йўқ. ${cap(WHOS)} ${HOURS} қўнғироқ қилиб, манзилингизни аниқлайди.`,
  numberCheck: (phone) => `${cap(WHO)} шу рақамга қўнғироқ қилади: ${formatUzPhone(phone)}. Рақамингиз тўғрими?`,
  thanks: {
    accepted: `Раҳмат! ${cap(WHOS)} сиз билан боғланади.`,
    duplicate: `Аризангиз аллақачон қабул қилинган. ${cap(WHOS)} ${HOURS} сизга қўнғироқ қилади.`,
    firstStep: `Телефонингизни ёнингизда сақланг: ${WHOS} ${HOURS} қўнғироқ қилади. Кечқурун қолдирсангиз, эртасига эрталаб.`,
  },
  urgencyTitle: 'Нега кечиктирмаслик керак?',
  stepsTitle: 'Ариза қолдириш жуда осон',
  steps: [
    'Исмингиз ва телефон рақамингизни қолдиринг',
    `${cap(WHOS)} ${HOURS} қўнғироқ қилиб, манзилингизни аниқлайди`,
    'Маҳсулот 1–3 кунда уйингизгача бепул етказилади',
    'Тўловни маҳсулотни олганингиздан кейин қиласиз',
  ],
  faq: {
    [ORDER_FAQ]: {
      q: 'Ариза қолдирсам нима бўлади?',
      a: `${cap(WHOS)} ${HOURS} қўнғироқ қилади, маҳсулот ҳақида тўлиқ маълумот беради ва манзилингизни аниқлайди. Маҳсулот 1–3 кунда етказилади. Тўловни курьердан олганда қиласиз. Қадоқ ташқаридан нима эканлиги кўринмайди.`,
    },
  },
};

// The FAQ entry to replace must still exist in product.ts, or the replacement would silently do nothing.
if (!product.faq.some((f) => f.q === ORDER_FAQ)) throw new Error(`sites/classic/copy.ts: no FAQ «${ORDER_FAQ}» in product.ts`);
