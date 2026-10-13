const express = require('express');
const router = express.Router();
const ProductController = require('../controllers/ProductController');

router.get('/', ProductController.list);
router.get('/categories', ProductController.getCategories);
router.post('/', ProductController.create);
router.get('/:id', ProductController.getById);
router.put('/:id', ProductController.update);
router.delete('/:id', ProductController.delete);
router.patch('/:id/toggle-status', ProductController.toggleStatus);

module.exports = router;
