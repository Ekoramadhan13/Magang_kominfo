const express = require('express');
const router  = express.Router();
const { isAuthenticated } = require('../middleware/authMiddleware');
const { checkRole }       = require('../middleware/roleMiddleware');
const appController       = require('../controllers/appController');

router.use(isAuthenticated);

router.get('/',             appController.index);
router.get('/create',       checkRole('tim_leader', 'admin'), appController.create);
router.post('/',            checkRole('tim_leader', 'admin'), appController.store);
router.get('/:id',          appController.show);
router.get('/:id/edit',     checkRole('tim_leader', 'admin'), appController.edit);
router.put('/:id',          checkRole('tim_leader', 'admin'), appController.update);
router.delete('/:id',       checkRole('admin', 'tim_leader'), appController.destroy);

// Ketua Tester menugaskan tester (checkbox only, tanpa ketua_tester_id)
router.post('/:id/assign',           checkRole('ketua_tester', 'tim_leader', 'admin'), appController.assignTester);
router.post('/:id/start-testing',    checkRole('tester'), appController.startTesting);
router.post('/:id/finish-testing',   checkRole('tester', 'ketua_tester'), appController.finishTesting);
router.post('/:id/finish-app-testing', checkRole('ketua_tester', 'tim_leader', 'admin'), appController.finishAppTesting);

// Use case tambahan dihapus karena sudah diatur saat Add Aplikasi

module.exports = router;