const router = require('express').Router();
const asyncHandler = require('../middleware/asyncHandler');
const { requireAuth } = require('../middleware/auth');
const c = require('../controllers/authController');

router.post('/login', asyncHandler(c.login));
router.get('/me', requireAuth, asyncHandler(c.me));

module.exports = router;
