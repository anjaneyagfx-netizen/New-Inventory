/**
 * controllers/authController.js
 */
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const { signToken } = require('../utils/jwt');

async function login(req, res) {
  const { username, password } = req.body || {};
  if (!username || !password) throw ApiError.badRequest('username and password required');

  const user = await User.findOne({ username });
  if (!user) throw ApiError.unauthorized('Invalid credentials');

  const ok = await bcrypt.compare(String(password), user.password_hash);
  if (!ok) throw ApiError.unauthorized('Invalid credentials');

  const token = signToken(user._id);
  res.json({
    token,
    user: {
      id: user._id,
      username: user.username,
      email: user.email || '',
      role: user.role,
      warehouse_ids: user.warehouse_ids || [],
    },
  });
}

async function me(req, res) {
  res.json(req.user);
}

module.exports = { login, me };
