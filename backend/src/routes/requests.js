const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const ctrl = require('../controllers/requestController');

router.use(authenticate);

router.get('/', ctrl.getAll);
router.post('/', ctrl.create);
router.get('/:id', ctrl.getById);
router.put('/:id', ctrl.update);
router.post('/:id/replies', ctrl.addReply);
router.delete('/:id', authorize('Admin', 'Sales Manager'), ctrl.delete);

module.exports = router;
