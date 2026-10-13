const express = require('express');
const router = express.Router();
const QuickRepliesController = require('../controllers/QuickRepliesController');

router.get('/', QuickRepliesController.list);
router.post('/preview', QuickRepliesController.preview);
router.post('/', QuickRepliesController.create);
router.get('/:id', QuickRepliesController.getById);
router.put('/:id', QuickRepliesController.update);
router.delete('/:id', QuickRepliesController.delete);

module.exports = router;
