/**
 * Get a unique message ID for SES.
 * @returns {string} The unique message ID.
 */
export const getMessageId = (): string => `ses-${Math.floor((Math.random() * 900000000) + 100000000)}`;

/**
 * Get the current timestamp in seconds.
 * @returns {number} The current timestamp in seconds.
 */
export const getCurrentTimestamp = (): number => Math.floor(Date.now() / 1000);
