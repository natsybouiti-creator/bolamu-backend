const crypto = require('crypto');

function hashText(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

module.exports = { hashText };
