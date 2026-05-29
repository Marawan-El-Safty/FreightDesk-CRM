const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const ctrl = require('../controllers/invoiceController');

router.use(authenticate);
router.use(authorize('Admin', 'Finance'));

router.get('/',         ctrl.getAll);
router.post('/',        ctrl.create);
router.get('/:id',      ctrl.getById);
router.get('/:id/pdf',  ctrl.generatePdf);
router.put('/:id',      ctrl.update);
router.delete('/:id',   ctrl.delete);

module.exports = router;
