const express = require('express');
const router = express.Router();
const appController = require('../controllers/appController');
const { isAuthenticated } = require('../middleware/authMiddleware');
const { checkRole } = require('../middleware/roleMiddleware');

router.use(isAuthenticated);

router.get('/', appController.index);
router.get('/create', checkRole('tim_leader', 'admin'), appController.create);
router.post('/', checkRole('tim_leader', 'admin'), appController.store);
router.get('/:id', appController.show);
router.get('/:id/edit', checkRole('tim_leader', 'admin'), appController.edit);
router.put('/:id', checkRole('tim_leader', 'admin'), appController.update);
router.delete('/:id', checkRole('admin'), appController.destroy);
router.post('/:id/assign', checkRole('ketua_tester', 'admin'), appController.assignTester);
router.post('/:id/assign-ba', checkRole('tim_leader', 'admin'), appController.assignBA);
router.post('/use-case/store', checkRole('tim_leader', 'admin'), appController.storeUseCase);

module.exports = router;