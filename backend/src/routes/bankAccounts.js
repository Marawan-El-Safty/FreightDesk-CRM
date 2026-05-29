const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const ctrl = require('../controllers/bankAccountController');

router.use(authenticate);

// GET (list) — Admin + Finance can read
router.get('/',    ctrl.getAll);
router.get('/:id', ctrl.getById);

// Write — Admin only
router.post('/',      authorize('Admin'), ctrl.create);
router.put('/:id',    authorize('Admin'), ctrl.update);
router.delete('/:id', authorize('Admin'), ctrl.delete);

module.exports = router;
