/**
 * utils/generateId.js
 * Compact 15-character hex identifier (matches the legacy Python backend's format).
 */
const crypto = require('crypto');

function generateId() {
  return crypto.randomBytes(16).toString('hex').slice(0, 15);
}

module.exports = generateId;
