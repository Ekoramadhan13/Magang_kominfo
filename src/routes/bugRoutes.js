const express = require('express');
const router = express.Router();
const bugController = require('../controllers/bugController');
const { isAuthenticated } = require('../middleware/authMiddleware');
const { checkRole } = require('../middleware/roleMiddleware');

router.use(isAuthenticated);

router.get('/', bugController.index);

router.get('/create', checkRole('tester'), bugController.create);
router.post('/', checkRole('tester'), bugController.store);

router.put('/:id/status',
  checkRole('programmer', 'dsi', 'admin', 'ketua_tester'),
  bugController.updateStatus);

router.get('/:id', bugController.show);

router.post('/:id/assign',
  checkRole('admin', 'ketua_tester', 'tim_leader', 'business_analyst'),
  bugController.assignBug);

router.put('/:id/verify', checkRole('tester', 'business_analyst', 'ketua_tester'), bugController.closeBug);

router.get('/use-cases/:appId', bugController.getUseCases);

module.exports = router;
