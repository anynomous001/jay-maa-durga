import { initCommon } from '../lib/common';
import { initMotion } from '../features/motion';
import { initCountdown } from '../features/countdown';
import { initRadio } from '../features/radio';
import { initWake } from '../features/wake';
import { initReminders, initShare } from '../features/reminders';
import { initSchedule } from '../features/schedule';
import { initDhak } from '../features/dhak';
import { closeMiniPlayer, initPlaylists } from '../features/playlists';
import { initCard } from '../features/card';
import { initPolls } from '../features/polls';
import { initSheets } from '../features/sheets';
import { initVisitors } from '../features/visitors';
import { initWelcome } from '../features/welcome';

initCommon();
initCountdown();
const radio = initRadio();
initWake(radio);
initReminders();
initShare();
initSchedule();
initDhak();
initPlaylists();
initSheets();
initCard();
initPolls();
const visitors = initVisitors(() => radio.isActive());
initWelcome(() => radio.isActive());
// One sound at a time: a song pauses the radio; the radio closes the song mini player.
addEventListener('media:start', () => radio.isActive() && radio.pause());
radio.onState((s) => s === 'loading' && closeMiniPlayer());
// Tell the counter right away when someone starts or stops listening.
radio.onState((s) => (s === 'playing' || s === 'paused') && visitors.ping());

// Last, so it animates the final rendered content.
initMotion();
