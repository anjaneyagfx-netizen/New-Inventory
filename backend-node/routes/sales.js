const router = require('express').Router();
const asyncHandler = require('../middleware/asyncHandler');
const { requireAuth, requireEdit } = require('../middleware/auth');
const c = require('../controllers/salesController');

router.use(requireAuth);

router.get('/', asyncHandler(c.list));
router.post('/', requireEdit, asyncHandler(c.create));
router.put('/bill/:bill_number', requireEdit, asyncHandler(c.updateBill));
router.delete('/bill/:bill_number', requireEdit, asyncHandler(c.deleteBill));

module.exports = router;
