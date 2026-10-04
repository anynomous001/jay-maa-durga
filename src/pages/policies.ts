import { OPERATOR } from '../config';
import { initCommon } from '../lib/common';

initCommon();
// Operator details come from config so they're edited in one place.
document.querySelectorAll<HTMLElement>('[data-op]').forEach((el) => {
  el.textContent = OPERATOR[el.dataset.op as keyof typeof OPERATOR] ?? '';
});
