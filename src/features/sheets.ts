/**
 * Bottom sheets (native <dialog>) for the home dock: schedule, songs, dhak, FAQ.
 * Esc and the ✕ close; clicking the dimmed backdrop closes; focus returns to
 * the opener. Page scrolling (incl. Lenis) is paused while a sheet is open.
 */
export function initSheets(): void {
  let opener: HTMLElement | null = null;
  const lockScroll = (on: boolean) => {
    document.documentElement.classList.toggle('sheet-open', on);
    window.dispatchEvent(new CustomEvent(on ? 'sheet:open' : 'sheet:close'));
  };

  document.querySelectorAll<HTMLButtonElement>('[data-open]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const dlg = document.getElementById(btn.dataset.open!) as HTMLDialogElement | null;
      if (!dlg) return;
      opener = btn;
      dlg.showModal();
      lockScroll(true);
    });
  });

  document.querySelectorAll<HTMLDialogElement>('dialog.sheet').forEach((dlg) => {
    dlg.querySelector('[data-close]')?.addEventListener('click', () => dlg.close());
    // A click whose target is the <dialog> itself landed on the backdrop.
    dlg.addEventListener('click', (e) => {
      if (e.target === dlg) dlg.close();
    });
    dlg.addEventListener('close', () => {
      lockScroll(false);
      opener?.focus();
      // Stop any video playing inside the sheet (the audio mini player lives outside it).
      dlg.querySelectorAll('iframe').forEach((f) => f.remove());
    });
  });
}
