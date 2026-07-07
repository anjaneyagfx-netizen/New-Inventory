/**
 * utils/jwt.js
 * JWT sign / verify helpers.
 */
const jwt = require('jsonwebtoken');

function getSecret() {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error('JWT_SECRET is not configured');
  return s;
}

function signToken(userId) {
  return jwt.sign({ sub: userId }, getSecret(), {
    algorithm: 'HS256',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}

function verifyToken(token) {
  return jwt.verify(token, getSecret(), { algorithms: ['HS256'] });
}

module.exports = { signToken, verifyToken };
