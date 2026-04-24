// instrument.js — must be loaded before all other modules
const Sentry = require("@sentry/node");

Sentry.init({
  dsn: process.env.SENTRY_DSN ?? "___DSN___",

  sendDefaultPii: true,

  // 100% in dev, lower in production
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,

  // Capture local variable values in stack frames
  includeLocalVariables: true,

  enableLogs: true,
});
