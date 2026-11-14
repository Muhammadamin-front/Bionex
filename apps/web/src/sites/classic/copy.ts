// The main site's own wording (owner, 2026-11-14): not «буюртма» — a free consultation with a specialist, the hours
// they ring, and the number read back before it is sent (many orders came with a wrong number). Older visitors are
// asked for a phone call, not a purchase.
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
const HOURS = '9:00 дан 21:00 гача';
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const ORDER_FAQ = 'Буюртма берсам нима бўлади?';

export const MAIN_COPY: PageCopy = {
  submit: 'Бепул маслаҳат олиш',
  sectionButton: 'Бепул маслаҳат олиш',
  underButton: `${cap(WHOS)} ${HOURS} қўнғироқ қилиб, сиз учун вақт ажратади ва бепул маслаҳат беради.`,
  numberCheck: (phone) => `${cap(WHO)} шу рақамга қўнғироқ қилади: ${formatUzPhone(phone)}. Рақамингиз тўғрими?`,
  thanks: {
    accepted: `Раҳмат! ${cap(WHOS)} сиз билан боғланади.`,
    duplicate: `Сўровингиз аллақачон қабул қилинган. ${cap(WHOS)} ${HOURS} сизга қўнғироқ қилади.`,
    firstStep: `Телефонингизни ёнингизда сақланг: ${WHOS} ${HOURS} қўнғироқ қилади. Кечқурун қолдирсангиз, эртасига эрталаб.`,
  },
  urgencyTitle: 'Нега маслаҳатни кечиктирмаслик керак?',
  stepsTitle: 'Маслаҳат олиш жуда осон',
  steps: [
    'Исмингиз ва телефон рақамингизни қолдиринг',
    `${cap(WHOS)} ${HOURS} қўнғироқ қилиб, бепул маслаҳат беради`,
    'Олишга қарор қилсангиз, маҳсулот 1–3 кунда уйингизгача бепул етказилади',
    'Тўловни маҳсулотни олганингиздан кейин қиласиз',
  ],
  faq: {
    [ORDER_FAQ]: {
      q: 'Рақамимни қолдирсам нима бўлади?',
      a: `${cap(WHOS)} ${HOURS} қўнғироқ қилади, саволларингизга жавоб беради ва маҳсулот ҳақида тўлиқ маълумот беради. Олиш-олмасликни ўзингиз ҳал қиласиз. Олсангиз, маҳсулот 1–3 кунда етказилади, тўловни курьердан олганда қиласиз. Қадоқ ташқаридан нима эканлиги кўринмайди.`,
    },
  },
};

// The FAQ entry to replace must still exist in product.ts, or the replacement would silently do nothing.
if (!product.faq.some((f) => f.q === ORDER_FAQ)) throw new Error(`sites/classic/copy.ts: no FAQ «${ORDER_FAQ}» in product.ts`);
