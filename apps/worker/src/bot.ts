/**
 * Ordering through the Telegram bot, in a private chat: Start → share the phone with one
 * button → type a name → the order goes to the operators like any order from the website.
 *
 * Written for older customers: one question at a time, big reply-keyboard buttons, the
 * name pre-offered from their Telegram profile so it is one tap. Texts in Uzbek Cyrillic.
 */

export type ReplyKeyboard =
  | {
      keyboard: Array<Array<{ text: string; request_contact?: boolean }>>;
      resize_keyboard: true;
      one_time_keyboard?: boolean;
      is_persistent?: boolean;
    }
  | { remove_keyboard: true };

export interface BotReply {
  text: string;
  keyboard: ReplyKeyboard;
}

const SHARE_BUTTON = '📱 Рақамни юбориш';

const shareKeyboard: ReplyKeyboard = {
  keyboard: [[{ text: SHARE_BUTTON, request_contact: true }]],
  resize_keyboard: true,
  is_persistent: true,
};

export const BOT_TEXT = {
  welcome: (name: string) =>
    `Ассалому алайкум${name ? `, ${name}` : ''}! 👋\n\n` +
    'Зейнара буюртма бериш учун пастдаги «📱 Рақамни юбориш» тугмасини босинг.\n\n' +
    'Оператор сизга қўнғироқ қилиб, барча саволларга жавоб беради. Тўловни маҳсулотни олганингизда қиласиз.',
  askPhoneAgain:
    'Илтимос, пастдаги «📱 Рақамни юбориш» тугмасини босинг.\n\nЁки рақамингизни шундай ёзинг: 90 123 45 67',
  notOwnContact: 'Илтимос, ўзингизнинг рақамингизни юборинг: пастдаги «📱 Рақамни юбориш» тугмасини босинг.',
  badPhone: (why: string) => `${why}\n\nПастдаги «📱 Рақамни юбориш» тугмасини босинг ёки рақамни 90 123 45 67 кўринишида ёзинг.`,
  askName: 'Раҳмат! Энди исмингизни ёзинг (ёки пастдаги тугмани босинг):',
  badName: (why: string) => `${why}. Исмингизни қайта ёзинг:`,
  accepted: (n: number) =>
    `✅ Раҳмат! Буюртмангиз қабул қилинди (№${n}).\n\nОператор тез орада сизга қўнғироқ қилади. Телефонингизни ёнингизда сақланг.`,
  duplicate: '✅ Буюртмангиз аллақачон қабул қилинган. Оператор тез орада сизга қўнғироқ қилади.',
  limited: 'Бугун бу ҳисобдан жуда кўп буюртма юборилди. Илтимос, эртага қайта уриниб кўринг.',
  again: 'Яна буюртма бериш учун /start ни босинг.',
};

export function welcome(firstName: string): BotReply {
  return { text: BOT_TEXT.welcome(firstName), keyboard: shareKeyboard };
}

export function askPhone(text: string): BotReply {
  return { text, keyboard: shareKeyboard };
}

/** The name question, with the Telegram profile name as a one-tap answer when it looks like a name. */
export function askName(suggested: string | null): BotReply {
  return {
    text: BOT_TEXT.askName,
    keyboard: suggested
      ? { keyboard: [[{ text: suggested }]], resize_keyboard: true, one_time_keyboard: true }
      : { remove_keyboard: true },
  };
}

export function done(text: string): BotReply {
  return { text: `${text}\n\n${BOT_TEXT.again}`, keyboard: { remove_keyboard: true } };
}
