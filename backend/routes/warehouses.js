const router = require('express').Router();
const asyncHandler = require('../middleware/asyncHandler');
const { requireAuth, requireOwner } = require('../middleware/auth');
const c = require('../controllers/warehouseController');

router.use(requireAuth);

router.get('/', asyncHandler(c.list));
router.post('/', requireOwner, asyncHandler(c.create));
router.put('/:id', requireOwner, asyncHandler(c.update));
router.delete('/:id', requireOwner, asyncHandler(c.remove));

module.exports = router;
