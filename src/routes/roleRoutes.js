const express = require('express');
const router = express.Router();
const RoleController = require('../controllers/RoleController');
const { requireAdmin } = require('../middlewares/authMiddleware');

router.get('/', RoleController.listRoles);
router.get('/departments', RoleController.listDepartments);
router.get('/:id', RoleController.getRole);

// Apenas administradores e superadmin podem criar, alterar ou remover cargos
router.post('/', requireAdmin, RoleController.createRole);
router.put('/:id', requireAdmin, RoleController.updateRole);
router.delete('/:id', requireAdmin, RoleController.deleteRole);

module.exports = router;

