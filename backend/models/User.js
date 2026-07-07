/**
 * models/User.js
 */
const mongoose = require('mongoose');
const generateId = require('../utils/generateId');

const userSchema = new mongoose.Schema(
  {
    _id: { type: String, default: generateId },
    username: { type: String, required: true, unique: true, index: true, trim: true },
    email: { type: String, default: '' },
    password_hash: { type: String, required: true },
    role: { type: String, enum: ['owner', 'manager', 'staff'], default: 'staff' },
    warehouse_ids: { type: [String], default: [] },
    created: { type: String, default: () => new Date().toISOString() },
  },
  { versionKey: false, _id: false, id: false }
);

userSchema.set('toJSON', {
  transform(_doc, ret) {
    ret.id = ret._id;
    delete ret._id;
    delete ret.password_hash;
    return ret;
  },
});

module.exports = mongoose.model('User', userSchema);
