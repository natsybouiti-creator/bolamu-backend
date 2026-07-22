// instrument.js — must be loaded before all other modules
const Sentry = require("@sentry/node");

const sentryDsn = process.env.SENTRY_DSN;

if (sentryDsn && sentryDsn.trim() && !sentryDsn.includes('___')) {
  Sentry.init({
    dsn: sentryDsn,

    sendDefaultPii: true,

    // 100% in dev, lower in production
    tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,

    // Capture local variable values in stack frames
    includeLocalVariables: true,

    enableLogs: true,
  });
} else {
  console.log('[Sentry] DSN absent ou invalide — Sentry désactivé en local');
}
