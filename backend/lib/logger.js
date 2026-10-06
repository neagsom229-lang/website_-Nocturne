export const logger = {
  info(msg, meta = {}) {
    console.info(JSON.stringify({ level: 'info', time: new Date().toISOString(), msg, ...meta }));
  },
  warn(msg, meta = {}) {
    console.warn(JSON.stringify({ level: 'warn', time: new Date().toISOString(), msg, ...meta }));
  },
  error(msg, meta = {}) {
    console.error(JSON.stringify({ level: 'error', time: new Date().toISOString(), msg, ...meta }));
  },
  debug(msg, meta = {}) {
    if (process.env.LOG_LEVEL === 'debug' || process.env.NODE_ENV !== 'production') {
      console.debug(JSON.stringify({ level: 'debug', time: new Date().toISOString(), msg, ...meta }));
    }
  }
};
