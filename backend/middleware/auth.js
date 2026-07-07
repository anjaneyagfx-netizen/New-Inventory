/**
 * middleware/auth.js
 * JWT auth + role guards. Populates req.user with the current user document.
 */
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const { verifyToken } = require('../utils/jwt');

async function requireAuth(req, _res, next) {
  try {
    const header = req.headers.authorization || '';
    const match = /^Bearer\s+(.+)$/i.exec(header);
    if (!match) throw ApiError.unauthorized();
    let payload;
    try {
      payload = verifyToken(match[1]);
    } catch {
      throw ApiError.unauthorized('Invalid token');
    }
    const user = await User.findOne({ _id: payload.sub }).select('-password_hash').lean();
    if (!user) throw ApiError.unauthorized('User not found');
    req.user = {
      id: user._id,
      username: user.username,
      email: user.email,
      role: user.role,
      warehouse_ids: user.warehouse_ids || [],
    };
    return next();
  } catch (err) {
    return next(err);
  }
}

function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (!roles.includes(req.user.role)) return next(ApiError.forbidden('Insufficient permissions'));
    return next();
  };
}

const requireEdit = requireRole('owner', 'manager');
const requireOwner = requireRole('owner');

function userHasWarehouse(user, warehouseId) {
  if (!user || !warehouseId) return false;
  if (user.role === 'owner') return true;
  return (user.warehouse_ids || []).includes(warehouseId);
}

module.exports = { requireAuth, requireEdit, requireOwner, userHasWarehouse };
