const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const ctrl = require('../controllers/quotationController');

router.use(authenticate);

router.get('/', ctrl.getAll);
router.post('/', ctrl.create);
router.get('/:id', ctrl.getById);
router.put('/:id', ctrl.update);
router.patch('/:id/submit',  ctrl.submit);
router.patch('/:id/approve', authorize('Admin', 'Sales Manager'), ctrl.approve);
router.patch('/:id/return',  authorize('Admin', 'Sales Manager'), ctrl.returnForRevision);
router.get('/:id/pdf', ctrl.generatePdf);
router.delete('/:id', ctrl.delete);

module.exports = router;
