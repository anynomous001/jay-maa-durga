import { initCommon } from '../lib/common';
import { initMotion } from '../features/motion';
import { initHeroSeason } from '../features/countdown';
import { initHop } from '../features/hop';
import { initReminders, initShare } from '../features/reminders';
import { initSchedule } from '../features/schedule';
import { initDhak } from '../features/dhak';
import { initPlaylists } from '../features/playlists';
import { initCard } from '../features/card';
import { initPolls } from '../features/polls';
import { initSheets } from '../features/sheets';
import { initVisitors } from '../features/visitors';
import { initWelcome } from '../features/welcome';

initCommon();
initHeroSeason();
initHop();
initReminders();
initShare();
initSchedule();
initDhak();
initPlaylists();
initSheets();
initCard();
initPolls();
initVisitors();
initWelcome(() => false);

// Last, so it animates the final rendered content.
initMotion();
