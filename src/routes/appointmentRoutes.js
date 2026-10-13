const express = require('express');
const router = express.Router();
const AppointmentController = require('../controllers/AppointmentController');

router.get('/', AppointmentController.list);
router.post('/', AppointmentController.create);
router.get('/:id', AppointmentController.getById);
router.put('/:id', AppointmentController.update);
router.delete('/:id', AppointmentController.delete);
router.post('/:id/reminder', AppointmentController.sendReminder);

module.exports = router;
