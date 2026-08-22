/** Configurable constants for the Rewind Letter feature.
 *  Change these in one place to tune delivery triggers. */

/** Number of days after match creation before a sealed letter auto-delivers */
export const REWIND_LETTER_DELIVERY_DAYS = 7;

/** Number of messages exchanged in the conversation before a sealed letter auto-delivers */
export const REWIND_LETTER_DELIVERY_MESSAGE_COUNT = 50;

/** Maximum character length for a rewind letter */
export const REWIND_LETTER_MAX_LENGTH = 500;

/** How often (ms) the background sweep checks for letters ready to deliver */
export const REWIND_LETTER_SWEEP_INTERVAL_MS = 60_000; // 1 minute
