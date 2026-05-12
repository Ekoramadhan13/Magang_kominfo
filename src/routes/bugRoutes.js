const express = require('express');
const router  = express.Router();
const bugController = require('../controllers/bugController');
const { isAuthenticated } = require('../middleware/authMiddleware');
const { checkRole }       = require('../middleware/roleMiddleware');

router.use(isAuthenticated);

// Daftar & Create
router.get('/', bugController.index);
router.get('/create', checkRole('tester', 'ketua_tester'), bugController.create);
router.post('/',      checkRole('tester', 'ketua_tester'), bugController.store);

// Riwayat
router.get('/history',
  checkRole('admin', 'tim_leader', 'business_analyst', 'ketua_tester', 'tester', 'programmer', 'dsi'),
  bugController.history);

// Get use cases (AJAX)
router.get('/use-cases/:appId', bugController.getUseCases);

// Detail
router.get('/:id', bugController.show);

// Kerjakan (Programmer/DSI klik → ubah status ke in_progress)
router.post('/:id/kerjakan',
  checkRole('programmer', 'dsi', 'admin'),
  bugController.kerjakan);

// Selesai Testing dari halaman bug
router.post('/:id/selesai-testing',
  checkRole('ketua_tester', 'tester'),
  bugController.selesaiTesting);

// Update status oleh Programmer/DSI (in_progress → fixed)
router.put('/:id/status',
  checkRole('programmer', 'dsi', 'admin'),
  bugController.updateStatus);

// Verifikasi oleh Tester/Ketua Tester (fixed → verified/closed/rejected)
router.put('/:id/verify',
  checkRole('tester', 'ketua_tester'),
  bugController.closeBug);

// Hapus bug
router.delete('/:id',
  checkRole('admin', 'tester', 'ketua_tester'),
  bugController.destroy);

module.exports = router;
