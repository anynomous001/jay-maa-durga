import { initCommon } from '../lib/common';
import { initMotion } from '../features/motion';
import { initHeroSeason } from '../features/countdown';
import { initFinder } from '../features/finder';
import { initShare } from '../features/reminders';
import { initSchedule } from '../features/schedule';
import { initCard } from '../features/card';
import { initPolls } from '../features/polls';
import { initSheets } from '../features/sheets';
import { initVisitors } from '../features/visitors';

initCommon();
initHeroSeason();
initFinder();
initShare();
initSchedule();
initSheets();
initCard();
initPolls();
initVisitors();

// Last, so it animates the final rendered content.
initMotion();
