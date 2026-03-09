const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { isAuthenticated } = require('../middleware/authMiddleware');
const { checkRole } = require('../middleware/roleMiddleware');

router.use(isAuthenticated);

router.get('/', checkRole('admin'), userController.index);
router.get('/create', checkRole('admin'), userController.create);
router.post('/', checkRole('admin'), userController.store);
router.get('/change-password', userController.showChangePassword);
router.post('/change-password', userController.changePassword);
router.get('/:id/edit', checkRole('admin'), userController.edit);
router.put('/:id', checkRole('admin'), userController.update);
router.delete('/:id', checkRole('admin'), userController.destroy);

module.exports = router;