const router = require('express').Router();
const asyncHandler = require('../middleware/asyncHandler');
const { requireAuth, requireEdit } = require('../middleware/auth');
const c = require('../controllers/categoryController');

router.use(requireAuth);

router.get('/', asyncHandler(c.list));
router.post('/', requireEdit, asyncHandler(c.create));
router.put('/:id', requireEdit, asyncHandler(c.update));
router.delete('/:id', requireEdit, asyncHandler(c.remove));

module.exports = router;
