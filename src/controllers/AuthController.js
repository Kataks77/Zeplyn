const UserService = require('../services/UserService');
const { generateSignedToken, revokeToken } = require('../middlewares/authMiddleware');

class AuthController {
    async login(req, res) {
        try {
            const { email, password } = req.body || {};
            if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
                return res.status(400).json({ error: 'Email e senha são obrigatórios e devem ser válidos.' });
            }

            const cleanEmail = email.trim().toLowerCase();
            if (cleanEmail.length > 255 || password.length > 128) {
                return res.status(400).json({ error: 'Credenciais com tamanho inválido.' });
            }

            const user = await UserService.authenticateUser(cleanEmail, password);
            if (!user) return res.status(401).json({ error: 'Credenciais inválidas' });

            const token = generateSignedToken({ userId: user.id, role: user.role, companyId: user.companyId || 'company_default' });
            const expiresAt = Date.now() + (24 * 60 * 60 * 1000); // 24h

            const { password: _, ...userNoPass } = user;

            try {
                const AuditService = require('../services/AuditService');
                const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || req.connection?.remoteAddress;
                AuditService.logAction({
                    companyId: user.companyId || 'company_default',
                    companyName: user.companyName || null,
                    userId: user.id,
                    userName: user.name,
                    userEmail: user.email,
                    userRole: user.role,
                    action: 'USER_LOGIN',
                    description: `Usuário "${user.name}" (${user.email}) efetuou login no sistema`,
                    category: 'auth',
                    details: { email: user.email, role: user.role },
                    ipAddress: ip
                });
            } catch (_) {}

            res.json({
                success: true,
                user: userNoPass,
                token,
                sessionToken: token,
                expiresAt
            });
        } catch (error) {
            console.error('Erro AuthController.login:', error);
            if (error.code === 'COMPANY_SUSPENDED' || error.code === 'USER_INACTIVE') {
                return res.status(403).json({ error: error.message, suspended: true });
            }
            res.status(500).json({ error: 'Erro ao processar login' });
        }
    }

    async register(req, res) {
        // Regra Zero Trust: Registro público desativado. Novos acessos devem vir exclusivamente do Superadmin autenticado.
        return res.status(403).json({
            error: 'O cadastro público de contas está desativado. O acesso ao sistema deve ser concedido exclusivamente pelo Superadministrador da plataforma.'
        });
    }

    async logout(req, res) {
        try {
            if (req.sessionToken) {
                await revokeToken(req.sessionToken, req.user?.id);
            }

            // Encerra imediatamente conexões WebSocket ativas do usuário ao sair
            if (req.user?.id) {
                try {
                    const BotManagerService = require('../services/BotManagerService');
                    BotManagerService.disconnectUserSockets(req.user.id);
                } catch (_) {}
            }

            try {
                const AuditService = require('../services/AuditService');
                AuditService.logRequest(req, {
                    action: 'USER_LOGOUT',
                    description: `Usuário "${req.user?.name || 'Operador'}" encerrou a sessão (logout)`,
                    category: 'auth',
                    details: { userId: req.user?.id, email: req.user?.email }
                });
            } catch (_) {}

            res.json({ success: true, message: 'Logout realizado com sucesso' });
        } catch (err) {
            console.error('Erro AuthController.logout:', err);
            res.json({ success: true, message: 'Logout realizado' });
        }
    }
}

module.exports = new AuthController();
