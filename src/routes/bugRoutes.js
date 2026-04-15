const express = require('express');
const router = express.Router();
const bugController = require('../controllers/bugController');
const { isAuthenticated } = require('../middleware/authMiddleware');
const { checkRole } = require('../middleware/roleMiddleware');

router.use(isAuthenticated);

router.get('/', bugController.index);

router.get('/create', checkRole('tester', 'ketua_tester'), bugController.create);
router.post('/', checkRole('tester', 'ketua_tester'), bugController.store);

router.get('/history',
  checkRole('admin', 'tim_leader', 'business_analyst', 'ketua_tester'),
  bugController.history);

router.put('/:id/status',
  checkRole('programmer', 'dsi', 'admin', 'ketua_tester'),
  bugController.updateStatus);

router.get('/:id', bugController.show);

router.post('/:id/assign',
  checkRole('ketua_tester', 'tester'),
  bugController.assignBug);

router.post('/:id/unassign',
  checkRole('ketua_tester', 'tester'),
  bugController.unassignBug);

router.put('/:id/verify', checkRole('tester', 'ketua_tester'), bugController.closeBug);

router.get('/use-cases/:appId', bugController.getUseCases);

module.exports = router;
