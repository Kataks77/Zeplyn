const express = require('express');
const router = express.Router();
const AccessController = require('../controllers/AccessController');

// Obter matriz de telas, módulos, empresas e usuários
router.get('/matrix', (req, res) => AccessController.getMatrix(req, res));

// Atualizar permissões de módulos para uma empresa (Apenas Superadmin)
router.put('/company/:companyId', (req, res) => AccessController.updateCompanyAccess(req, res));

// Atualizar telas permitidas para um usuário (Superadmin ou Admin da Empresa)
router.put('/user/:userId', (req, res) => AccessController.updateUserAccess(req, res));

module.exports = router;
