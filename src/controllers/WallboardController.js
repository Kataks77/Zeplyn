const { getDatabase } = require('../services/DatabaseService');
const ChatService = require('../services/ChatService');
const UserPresenceService = require('../services/UserPresenceService');

class WallboardController {
    constructor() {
        this.getLiveSnapshot = this.getLiveSnapshot.bind(this);
    }

    async getLiveSnapshot(req, res) {
        try {
            const db = getDatabase();
            if (!db) {
                return res.status(500).json({ error: 'Banco de dados não disponível' });
            }

            const isSuperAdmin = req.user?.role === 'superadmin';
            const companyId = isSuperAdmin ? (req.query.companyId || null) : (req.user?.companyId || 'company_default');

            const now = Date.now();

            // 1. Obter todos os chats via ChatService (já desduplicados e normalizados com contatos e empresa)
            const allChats = await ChatService.listChats(null, companyId);

            // 2. Filtrar Fila de Espera / Solicitações de Humano
            const waitingChats = allChats
                .filter(c => c.status === 'waiting' || (c.needsHuman === true && c.status !== 'attending' && c.status !== 'finished'))
                .map(c => {
                    const time = new Date(c.updatedAt || c.createdAt).getTime();
                    const waitSeconds = Math.max(0, Math.floor((now - time) / 1000));
                    return {
                        ...c,
                        waitSeconds,
                        isWarning: waitSeconds >= 300 && waitSeconds < 600, // 5 a 10 min
                        isCritical: waitSeconds >= 600 // > 10 min
                    };
                })
                .sort((a, b) => b.waitSeconds - a.waitSeconds);

            // 3. Filtrar Atendimentos Ativos em Curso
            const activeChats = allChats
                .filter(c => c.status === 'attending')
                .map(c => {
                    const time = new Date(c.updatedAt || c.createdAt).getTime();
                    const durationSeconds = Math.max(0, Math.floor((now - time) / 1000));
                    return {
                        ...c,
                        durationSeconds
                    };
                })
                .sort((a, b) => b.durationSeconds - a.durationSeconds);

            // 4. Buscar atendentes da empresa e estado de presença em tempo real
            let attendantsSql = `
                SELECT 
                    u.id, 
                    u.name, 
                    u.email, 
                    u.role, 
                    u."jobRoleName", 
                    u.department, 
                    u."companyId",
                    COALESCE(u."isAvailable", TRUE) as "isAvailable",
                    COUNT(ch.id) FILTER (WHERE ch.status = 'attending') as "activeChatsCount",
                    COUNT(ch.id) FILTER (WHERE ch.status = 'finished') as "finishedChatsCount"
                FROM users u
                LEFT JOIN chats ch ON u.id = ch."attendantId"
                WHERE u."isActive" = TRUE
            `;

            const attendantsParams = [];
            if (companyId) {
                attendantsParams.push(companyId);
                attendantsSql += ` AND u."companyId" = $1`;
            }

            attendantsSql += `
                GROUP BY u.id, u.name, u.email, u.role, u."jobRoleName", u.department, u."companyId", u."isAvailable"
                ORDER BY u.name ASC
            `;

            const attendantsRes = await db.query(attendantsSql, attendantsParams);

            const attendants = attendantsRes.rows.map(att => {
                const isOnline = UserPresenceService.isUserOnline(att.id);
                const activeCount = parseInt(att.activeChatsCount, 10) || 0;
                const finishedCount = parseInt(att.finishedChatsCount, 10) || 0;

                let liveStatus = 'offline';
                if (isOnline) {
                    if (!att.isAvailable) {
                        liveStatus = 'paused';
                    } else if (activeCount > 0) {
                        liveStatus = 'busy';
                    } else {
                        liveStatus = 'available';
                    }
                }

                return {
                    id: att.id,
                    name: att.name,
                    email: att.email,
                    role: att.role,
                    jobRoleName: att.jobRoleName,
                    department: att.department,
                    companyId: att.companyId,
                    isAvailable: att.isAvailable,
                    isOnline,
                    liveStatus,
                    activeChatsCount: activeCount,
                    finishedChatsCount: finishedCount
                };
            });

            // 5. Métricas agregadas e SLA
            const waitingCount = waitingChats.length;
            const criticalWaitingCount = waitingChats.filter(w => w.isCritical).length;
            const warningWaitingCount = waitingChats.filter(w => w.isWarning).length;
            const longestWaitSeconds = waitingChats.length > 0 ? waitingChats[0].waitSeconds : 0;
            const totalWaitSeconds = waitingChats.reduce((acc, c) => acc + c.waitSeconds, 0);
            const avgWaitSeconds = waitingCount > 0 ? Math.round(totalWaitSeconds / waitingCount) : 0;

            const onlineAttendantsCount = attendants.filter(a => a.isOnline).length;
            const availableAttendantsCount = attendants.filter(a => a.liveStatus === 'available').length;
            const busyAttendantsCount = attendants.filter(a => a.liveStatus === 'busy').length;
            const pausedAttendantsCount = attendants.filter(a => a.liveStatus === 'paused').length;
            const offlineAttendantsCount = attendants.filter(a => a.liveStatus === 'offline').length;

            const totalCapacity = (availableAttendantsCount + busyAttendantsCount) * 3;
            const capacityOccupancyPercent = totalCapacity > 0 ? Math.min(100, Math.round((activeChats.length / totalCapacity) * 100)) : 0;

            return res.json({
                success: true,
                timestamp: now,
                kpis: {
                    waitingCount,
                    criticalWaitingCount,
                    warningWaitingCount,
                    longestWaitSeconds,
                    avgWaitSeconds,
                    activeChatsCount: activeChats.length,
                    totalAttendants: attendants.length,
                    onlineAttendantsCount,
                    availableAttendantsCount,
                    busyAttendantsCount,
                    pausedAttendantsCount,
                    offlineAttendantsCount,
                    capacityOccupancyPercent
                },
                waitingChats,
                activeChats,
                attendants
            });
        } catch (error) {
            console.error('❌ Erro no WallboardController.getLiveSnapshot:', error);
            res.status(500).json({ error: 'Erro ao carregar dados da Torre de Controle: ' + error.message });
        }
    }
}

module.exports = new WallboardController();
