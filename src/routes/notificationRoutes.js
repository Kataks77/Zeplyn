const express = require('express');
const router = express.Router();
const NotificationController = require('../controllers/NotificationController');

router.get('/', NotificationController.list);
router.get('/all', NotificationController.listAll);
router.post('/', NotificationController.create);
router.post('/generate', NotificationController.generateIA);
router.put('/:id/read', NotificationController.markAsRead);
router.delete('/:id', NotificationController.delete);

module.exports = router;
