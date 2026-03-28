/**
 * Production-safe logger.
 * В __DEV__ режим логовете се показват нормално в конзолата.
 * В production build всички log/debug съобщения се заглушават,
 * а warn/error продължават да работят.
 */

const isDev = __DEV__;

export const logger = {
  log: (...args: unknown[]) => {
    if (isDev) console.log(...args);
  },
  debug: (...args: unknown[]) => {
    if (isDev) console.debug(...args);
  },
  warn: (...args: unknown[]) => {
    console.warn(...args);
  },
  error: (...args: unknown[]) => {
    console.error(...args);
  },
};
