const LOG_LEVELS = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 } as const;

type LogLevel = keyof typeof LOG_LEVELS;

function log(level: LogLevel, message: string, ...args: unknown[]): void {
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [${level}]`;
  switch (level) {
    case 'ERROR':
      console.error(prefix, message, ...args);
      break;
    case 'WARN':
      console.warn(prefix, message, ...args);
      break;
    default:
      console.log(prefix, message, ...args);
  }
}

export const logger = {
  debug: (msg: string, ...args: unknown[]) => log('DEBUG', msg, ...args),
  info: (msg: string, ...args: unknown[]) => log('INFO', msg, ...args),
  warn: (msg: string, ...args: unknown[]) => log('WARN', msg, ...args),
  error: (msg: string, ...args: unknown[]) => log('ERROR', msg, ...args),
};
