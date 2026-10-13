const express = require('express');
const router = express.Router();
const ContactController = require('../controllers/ContactController');
const { authenticateRequest } = require('../middlewares/authMiddleware');

router.get('/contacts', authenticateRequest, ContactController.listContacts);
router.post('/contacts', authenticateRequest, ContactController.createContact);
router.post('/contacts/delete', authenticateRequest, ContactController.deleteContact);
router.post('/contacts/sync-chats', authenticateRequest, ContactController.syncFromChats);
router.post('/contacts/import-array', authenticateRequest, ContactController.importArray);
router.post('/contacts/clear', authenticateRequest, ContactController.clearContacts);
router.post('/contacts/sync-photos', authenticateRequest, ContactController.syncProfilePictures);
router.post('/contacts/refresh-photo', authenticateRequest, ContactController.refreshContactPhoto);

module.exports = router;
