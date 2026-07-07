/**
 * middleware/errorHandler.js
 * 404 fallback + centralized JSON error responder.
 */
const ApiError = require('../utils/ApiError');

function notFound(req, _res, next) {
  next(new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`));
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, _next) {
  let status = err.status || err.statusCode || 500;
  let message = err.message || 'Internal server error';

  // Mongoose duplicate key
  if (err && err.code === 11000) {
    status = 400;
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    message = `Duplicate value for ${field}`;
  }
  // Mongoose validation error
  if (err && err.name === 'ValidationError') {
    status = 400;
    message = Object.values(err.errors || {})
      .map((e) => e.message)
      .join('; ') || 'Validation failed';
  }
  if (err && err.name === 'CastError') {
    status = 400;
    message = `Invalid ${err.path}`;
  }

  if (status >= 500) {
    // eslint-disable-next-line no-console
    console.error('[stockflow] Error:', err);
  }

  const body = { detail: message };
  if (err.details !== undefined) body.errors = err.details;
  res.status(status).json(body);
}

module.exports = { notFound, errorHandler };
