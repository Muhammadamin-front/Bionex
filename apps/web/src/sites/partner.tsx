// The partner site: the original page, unchanged but for the Telegram channel link on the thank-you
// screen (owner, 2026-11-07: «sherik saytidan ham shu telegram guruhga qo'shilish button chiqsin»).
// Only the link: no questions after the order and no automatic move (lib/concern.tsx).
// Display face self-hosted; unicode-range keeps the download to the subsets used.
import '@fontsource-variable/montserrat/wght.css';
import '../styles.css';
import { Landing as Page } from '../components/landing/Landing';
import { TelegramChannelContext } from '../lib/concern';

export function Landing() {
  return (
    <TelegramChannelContext.Provider value="https://t.me/zeynare">
      <Page />
    </TelegramChannelContext.Provider>
  );
}
