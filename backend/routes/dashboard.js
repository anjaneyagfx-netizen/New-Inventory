const router = require('express').Router();
const asyncHandler = require('../middleware/asyncHandler');
const { requireAuth } = require('../middleware/auth');
const c = require('../controllers/dashboardController');

router.use(requireAuth);
router.get('/', asyncHandler(c.dashboard));

module.exports = router;
