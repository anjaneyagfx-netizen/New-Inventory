const router = require('express').Router();
const asyncHandler = require('../middleware/asyncHandler');
const { requireAuth, requireOwner } = require('../middleware/auth');
const c = require('../controllers/userController');

router.use(requireAuth, requireOwner);

router.get('/', asyncHandler(c.list));
router.post('/', asyncHandler(c.create));
router.put('/:id', asyncHandler(c.update));
router.delete('/:id', asyncHandler(c.remove));

module.exports = router;
