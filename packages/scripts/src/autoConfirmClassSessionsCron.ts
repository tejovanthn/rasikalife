import { ClassSession } from '@rasika/core';

/**
 * Scheduled entry point for the class auto-confirm sweep. Thin on purpose — the sweep lives in
 * core so a scheduled run and a manual one can never differ.
 *
 * Runs daily rather than hourly. The deadline is midnight on the seventh day after a class, so
 * a day's granularity is all the ledger asks for, and a sweep that runs while the guru is
 * asleep is one she never races.
 */
export async function handler(): Promise<void> {
  console.log('[class-auto-confirm] starting sweep');
  try {
    const result = await ClassSession.autoConfirmDueSessions();
    console.log(
      `[class-auto-confirm] due ${result.due}; confirmed ${result.confirmed}; ` +
        `already settled ${result.alreadySettled}; failed ${result.failed}`
    );
    if (result.failed > 0) {
      // Not thrown. A failure here is one learner's credit, and taking the whole sweep down
      // would leave every other overdue session unconfirmed until tomorrow.
      console.error(`[class-auto-confirm] ${result.failed} session(s) could not be confirmed`);
    }
  } catch (error) {
    console.error('[class-auto-confirm] sweep failed:', error);
    throw error;
  }
}
