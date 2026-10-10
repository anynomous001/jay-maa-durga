/** Share buttons: WhatsApp, Facebook, the phone's share sheet and copy link. Each gets its own ?ref= tag. */
import { SITE_URL } from '../config';
import { onLangChange, t } from '../lib/i18n';

export const whatsappShareUrl = (text: string) => `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;

export function initShare(): void {
  const wa = document.getElementById('wa-share') as HTMLAnchorElement;
  const fb = document.getElementById('fb-share') as HTMLAnchorElement;
  const native = document.getElementById('native-share') as HTMLButtonElement;
  const copy = document.getElementById('copy-link') as HTMLButtonElement;
  const links = () => {
    wa.href = whatsappShareUrl(t('rem.waText', { url: SITE_URL + '/?ref=s-wa' }));
    fb.href = 'https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(SITE_URL + '/?ref=s-fb');
  };
  links();
  onLangChange(links);
  if (typeof navigator.share === 'function') {
    native.hidden = false;
    native.addEventListener('click', () => {
      navigator
        .share({ title: t('share.title'), text: t('share.text'), url: SITE_URL + '/?ref=s-native' })
        .catch(() => {}); // user dismissed the sheet
    });
  }
  const label = copy.querySelector('span')!;
  copy.addEventListener('click', async () => {
    const url = SITE_URL + '/?ref=s-copy';
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const ta = Object.assign(document.createElement('textarea'), { value: url });
      document.body.append(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    label.textContent = t('share.copied');
    setTimeout(() => (label.textContent = t('share.copy')), 2000);
  });
}
