const express = require('express');
const router  = express.Router();
const { isAuthenticated } = require('../middleware/authMiddleware');
const notifController = require('../controllers/notifController');

router.use(isAuthenticated);

router.get('/', notifController.index);
router.get('/:id/read', notifController.read);
router.post('/mark-all-read', notifController.markAllRead);

module.exports = router;
