/**
 * controllers/userController.js
 */
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');

async function list(_req, res) {
  const users = await User.find().sort({ username: 1 });
  res.json(users.map((u) => u.toJSON()));
}

async function create(req, res) {
  const { username, email = '', password, role = 'staff', warehouse_ids = [] } = req.body || {};
  if (!username || !password) throw ApiError.badRequest('username and password required');
  if (!['owner', 'manager', 'staff'].includes(role)) throw ApiError.badRequest('invalid role');

  const exists = await User.findOne({ username });
  if (exists) throw ApiError.badRequest('Username taken');

  const password_hash = await bcrypt.hash(String(password), 10);
  const doc = await User.create({
    username: String(username).trim(),
    email,
    password_hash,
    role,
    warehouse_ids: Array.isArray(warehouse_ids) ? warehouse_ids : [],
  });
  res.status(201).json(doc.toJSON());
}

async function update(req, res) {
  const { id } = req.params;
  const b = req.body || {};
  const set = {};
  if (b.email !== undefined) set.email = b.email;
  if (b.role !== undefined) {
    if (!['owner', 'manager', 'staff'].includes(b.role)) throw ApiError.badRequest('invalid role');
    set.role = b.role;
  }
  if (b.warehouse_ids !== undefined) set.warehouse_ids = Array.isArray(b.warehouse_ids) ? b.warehouse_ids : [];
  if (b.password) set.password_hash = await bcrypt.hash(String(b.password), 10);

  const doc = await User.findOneAndUpdate({ _id: id }, set, { new: true });
  if (!doc) throw ApiError.notFound('User not found');
  res.json(doc.toJSON());
}

async function remove(req, res) {
  const { id } = req.params;
  if (id === req.user.id) throw ApiError.badRequest('Cannot delete yourself');
  const r = await User.deleteOne({ _id: id });
  if (r.deletedCount === 0) throw ApiError.notFound('User not found');
  res.json({ deleted: true });
}

module.exports = { list, create, update, remove };
