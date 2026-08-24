/** Configurable constants for the Rewind Letter feature.
 *  Change these in one place to tune delivery triggers. */

/** Default number of days after match creation before a sealed letter auto-delivers */
export const REWIND_LETTER_DEFAULT_DELIVERY_DAYS = 7;
export const REWIND_LETTER_DELIVERY_DAYS = 7;

/** Minimum and maximum selectable unlock duration in days */
export const REWIND_LETTER_MIN_DELIVERY_DAYS = 7;
export const REWIND_LETTER_MAX_DELIVERY_DAYS = 90;

/** Allowed window in hours after writing for the author to edit content (48 hours = 2 days) */
export const REWIND_LETTER_EDIT_WINDOW_HOURS = 48;

/** Maximum character length for a rewind letter */
export const REWIND_LETTER_MAX_LENGTH = 500;

/** How often (ms) the background sweep checks for letters ready to deliver */
export const REWIND_LETTER_SWEEP_INTERVAL_MS = 60_000; // 1 minute
