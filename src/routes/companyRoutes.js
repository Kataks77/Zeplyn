const express = require('express');
const router = express.Router();
const CompanyController = require('../controllers/CompanyController');

router.get('/', CompanyController.list);
router.get('/:companyId', CompanyController.getById);
router.get('/:companyId/details', CompanyController.getDetails);
router.post('/', CompanyController.create);
router.put('/:companyId', CompanyController.update);
router.delete('/:companyId', CompanyController.delete);

module.exports = router;
