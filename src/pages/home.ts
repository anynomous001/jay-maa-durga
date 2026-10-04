import { initCommon } from '../lib/common';
import { initMotion } from '../features/motion';
import { initCountdown } from '../features/countdown';
import { initRadio } from '../features/radio';
import { initWake } from '../features/wake';
import { initReminders } from '../features/reminders';
import { initSchedule } from '../features/schedule';
import { initDhak } from '../features/dhak';
import { initPlaylists } from '../features/playlists';

initCommon();
initCountdown();
const radio = initRadio();
initWake(radio);
initReminders();
initSchedule();
initDhak();
initPlaylists();

// Last, so it animates the final rendered content.
initMotion();
