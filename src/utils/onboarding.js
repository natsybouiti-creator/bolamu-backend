const crypto = require('crypto');

function generateOnboardingToken() {
  return crypto.randomBytes(32).toString('hex');
}

function getOnboardingExpiry() {
  return new Date(Date.now() + 72 * 60 * 60 * 1000); // 72h
}

function buildOnboardingLink(token) {
  const base = process.env.FRONTEND_URL || 'https://www.bolamu.co';
  return `${base}/login?token=${token}`;
}

module.exports = { generateOnboardingToken, getOnboardingExpiry, buildOnboardingLink };
