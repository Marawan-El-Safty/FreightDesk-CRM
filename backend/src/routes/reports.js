const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const ctrl = require('../controllers/reportController');

router.use(authenticate);

router.get('/exchange-rate', ctrl.getExchangeRate);
router.get('/dashboard', ctrl.getDashboard);
router.get('/performance', authorize('Admin', 'Sales Manager'), ctrl.getPerformance);
router.get('/pipeline', authorize('Admin', 'Sales Manager'), ctrl.getPipeline);
router.get('/export/performance', authorize('Admin', 'Sales Manager'), ctrl.exportPerformance);

module.exports = router;
