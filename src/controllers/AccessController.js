const CompanyService = require('../services/CompanyService');
const UserService = require('../services/UserService');
const AuditService = require('../services/AuditService');

const AVAILABLE_MODULES = [
    {
        id: 'dashboard',
        label: 'Dashboard Geral',
        category: 'Visão Geral',
        icon: 'LayoutDashboard',
        description: 'Visão unificada de métricas, volume de atendimentos e desempenho em tempo real.'
    },
    {
        id: 'wallboard',
        label: 'Torre de Controle (Ao Vivo)',
        category: 'Visão Geral',
        icon: 'Radio',
        description: 'Supervisão ao vivo de atendimentos, painel de fila crítica com SLA, status da equipe e modo espiar conversa.'
    },
    {
        id: 'reports',
        label: 'Relatórios & Métricas',
        category: 'Visão Geral',
        icon: 'BarChart3',
        description: 'Relatórios analíticos aprofundados, notas CSAT, tempos de resposta e exportação em CSV/PDF.'
    },
    {
        id: 'chat',
        label: 'Atendimento ao Vivo (Chat)',
        category: 'Atendimento',
        icon: 'MessageSquare',
        description: 'Central de LiveChat para interagir diretamente com clientes do WhatsApp, enviar áudios e anexos.'
    },
    {
        id: 'kanban',
        label: 'Quadro Kanban',
        category: 'Atendimento',
        icon: 'Columns3',
        description: 'Gestão visual de funis e colunas de atendimento arrastando cards por etapas e status.'
    },
    {
        id: 'contacts',
        label: 'Contatos & CRM',
        category: 'Atendimento',
        icon: 'Users',
        description: 'Listagem e gestão de contatos salvos, histórico de conversas e exportação.'
    },
    {
        id: 'quick_messages',
        label: 'Respostas Rápidas',
        category: 'Atendimento',
        icon: 'Zap',
        description: 'Configuração de mensagens rápidas e atalhos (/pix, /horario, /suporte) para os atendentes.'
    },
    {
        id: 'tags',
        label: 'Etiquetas & Status',
        category: 'Atendimento',
        icon: 'Tag',
        description: 'Criação e categorização de tags com cores personalizadas para identificar clientes e leads.'
    },
    {
        id: 'appointments',
        label: 'Agenda & Lembretes',
        category: 'Atendimento',
        icon: 'Calendar',
        description: 'Agendamento de compromissos com lembretes automáticos enviados via WhatsApp.'
    },
    {
        id: 'products',
        label: 'Produtos & Catálogo',
        category: 'Vendas & Catálogo',
        icon: 'Package',
        description: 'Catálogo de produtos da empresa, preços, estoque, fotos e códigos SKU para vendas.'
    },
    {
        id: 'connections',
        label: 'Conexões WhatsApp',
        category: 'WhatsApp & IA',
        icon: 'Smartphone',
        description: 'Gerenciamento de instâncias Baileys WhatsApp, leitura de QR Code e status de bateria/conexão.'
    },
    {
        id: 'bots',
        label: 'Bots & IA Avançada',
        category: 'WhatsApp & IA',
        icon: 'Bot',
        description: 'Criação e edição de bots inteligentes, prompts do sistema, Vector Stores e RAG de arquivos.'
    },
    {
        id: 'flows',
        label: 'Fluxos & Menus (URA)',
        category: 'WhatsApp & IA',
        icon: 'GitBranch',
        description: 'Construtor interativo de fluxos de opções automáticas, menus numéricos e transferências.'
    },
    {
        id: 'campaigns',
        label: 'Disparos em Massa',
        category: 'WhatsApp & IA',
        icon: 'Megaphone',
        description: 'Envio programado e em lote de mensagens com intervalo inteligente anti-bloqueio.'
    },
    {
        id: 'roles',
        label: 'Cargos da Empresa',
        category: 'Administração',
        icon: 'Briefcase',
        description: 'Definição de cargos, cores identificadoras e departamentos da equipe de atendimento.'
    },
    {
        id: 'users',
        label: 'Gestão de Equipe',
        category: 'Administração',
        icon: 'UserCheck',
        description: 'Cadastro, edição, reset de senha e ativação/inativação de atendentes da equipe.'
    },
    {
        id: 'audit',
        label: 'Auditoria & Logs',
        category: 'Administração',
        icon: 'ClipboardList',
        description: 'Histórico completo de auditoria das ações administrativas, disparos, contatos e configurações.'
    }
];

class AccessController {
    /**
     * Retorna a matriz completa de módulos, empresas e usuários autorizados
     */
    async getMatrix(req, res) {
        try {
            const currentUser = req.user;
            if (!currentUser) {
                return res.status(401).json({ error: 'Não autenticado' });
            }

            const isSuperAdmin = currentUser.role === 'superadmin';
            const isAdmin = currentUser.role === 'admin';

            if (!isSuperAdmin && !isAdmin) {
                return res.status(403).json({ error: 'Acesso negado: apenas administradores podem gerenciar acessos.' });
            }

            let companies = [];
            let users = [];

            if (isSuperAdmin) {
                companies = await CompanyService.listCompanies();
                users = await UserService.listUsers();
            } else {
                const comp = await CompanyService.getCompanyById(currentUser.companyId);
                if (comp) companies = [comp];
                users = await UserService.listUsers(currentUser.companyId);
            }

            // Remove senhas e dados confidenciais dos usuários retornados
            const safeUsers = users.map(u => {
                const { password, ...safe } = u;
                return safe;
            });

            return res.json({
                modules: AVAILABLE_MODULES,
                companies,
                users: safeUsers,
                currentRole: currentUser.role,
                companyId: currentUser.companyId
            });
        } catch (error) {
            console.error('Erro em AccessController.getMatrix:', error);
            return res.status(500).json({ error: error.message || 'Erro ao carregar matriz de acessos' });
        }
    }

    /**
     * Atualiza telas permitidas para uma Empresa (Apenas Superadmin)
     */
    async updateCompanyAccess(req, res) {
        try {
            const currentUser = req.user;
            if (currentUser.role !== 'superadmin') {
                return res.status(403).json({ error: 'Apenas o Superadministrador pode alterar módulos da empresa.' });
            }

            const { companyId } = req.params;
            const { allowedScreens } = req.body;

            if (!Array.isArray(allowedScreens)) {
                return res.status(400).json({ error: 'Formato inválido: allowedScreens deve ser um array.' });
            }

            const updated = await CompanyService.updateCompany(companyId, { allowedScreens });

            AuditService.logRequest(req, {
                action: 'ACCESS_COMPANY_UPDATE',
                description: `Atualizou os módulos permitidos da empresa (${allowedScreens.length} módulos)`,
                category: 'access',
                details: { companyId, allowedScreens }
            }).catch(() => {});

            return res.json({
                success: true,
                message: 'Permissões da empresa atualizadas com sucesso.',
                company: updated
            });
        } catch (error) {
            console.error('Erro em AccessController.updateCompanyAccess:', error);
            return res.status(500).json({ error: error.message || 'Erro ao atualizar acessos da empresa' });
        }
    }

    /**
     * Atualiza telas permitidas para um Usuário (Superadmin ou Admin da Empresa)
     */
    async updateUserAccess(req, res) {
        try {
            const currentUser = req.user;
            const { userId } = req.params;
            const { allowedScreens } = req.body;

            if (!Array.isArray(allowedScreens)) {
                return res.status(400).json({ error: 'Formato inválido: allowedScreens deve ser um array.' });
            }

            const targetUser = await UserService.findUserById(userId);
            if (!targetUser) {
                return res.status(404).json({ error: 'Usuário não encontrado.' });
            }

            // Validação de permissões de quem está editando
            if (currentUser.role !== 'superadmin') {
                if (currentUser.role !== 'admin') {
                    return res.status(403).json({ error: 'Permissão insuficiente.' });
                }
                // Admin só pode editar usuários da sua própria empresa
                if (targetUser.companyId !== currentUser.companyId) {
                    return res.status(403).json({ error: 'Você só pode gerenciar usuários da sua própria empresa.' });
                }
                // Não pode alterar superadmins
                if (targetUser.role === 'superadmin') {
                    return res.status(403).json({ error: 'Não é permitido alterar acessos do Superadministrador.' });
                }

                // Se a empresa possui telas restritas pelo Superadmin, o Admin não pode conceder telas fora do plano da empresa
                const company = await CompanyService.getCompanyById(currentUser.companyId);
                if (company && Array.isArray(company.allowedScreens) && company.allowedScreens.length > 0) {
                    const invalidScreens = allowedScreens.filter(s => !company.allowedScreens.includes(s));
                    if (invalidScreens.length > 0) {
                        return res.status(400).json({
                            error: `Sua empresa não possui permissão para os seguintes módulos: ${invalidScreens.join(', ')}`
                        });
                    }
                }
            }

            const updatedUser = await UserService.updateUser(userId, { allowedScreens });
            const { password, ...safeUser } = updatedUser;

            AuditService.logRequest(req, {
                action: 'ACCESS_USER_UPDATE',
                description: `Atualizou as telas permitidas do operador ${targetUser.name || userId} (${allowedScreens.length} telas)`,
                category: 'access',
                details: { userId, userName: targetUser.name, allowedScreens }
            }).catch(() => {});

            return res.json({
                success: true,
                message: 'Acessos do usuário atualizados com sucesso.',
                user: safeUser
            });
        } catch (error) {
            console.error('Erro em AccessController.updateUserAccess:', error);
            return res.status(500).json({ error: error.message || 'Erro ao atualizar acessos do usuário' });
        }
    }
}

module.exports = new AccessController();
