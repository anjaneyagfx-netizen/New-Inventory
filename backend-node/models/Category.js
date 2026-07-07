/**
 * models/Category.js
 */
const mongoose = require('mongoose');
const generateId = require('../utils/generateId');

const categorySchema = new mongoose.Schema(
  {
    _id: { type: String, default: generateId },
    name: { type: String, required: true, trim: true },
    warehouse_id: { type: String, required: true, index: true },
    created: { type: String, default: () => new Date().toISOString() },
  },
  { versionKey: false, _id: false, id: false }
);

categorySchema.index({ warehouse_id: 1, name: 1 }, { unique: true });

categorySchema.set('toJSON', {
  transform(_doc, ret) {
    ret.id = ret._id;
    delete ret._id;
    return ret;
  },
});

module.exports = mongoose.model('Category', categorySchema);
