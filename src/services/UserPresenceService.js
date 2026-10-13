/**
 * UserPresenceService.js
 * Rastreador de presença em tempo real dos usuários e operadores autenticados via Socket.IO
 */

class UserPresenceService {
    constructor() {
        // Map: userId -> Set de socketIds
        this.userSockets = new Map();
        // Map: socketId -> { userId, companyId, userName, userRole }
        this.socketMeta = new Map();
    }

    /**
     * Registra a conexão de um socket de um usuário
     */
    addSocket(socketId, user, companyId = null) {
        if (!socketId || !user || !user.id) return { wentOnline: false };

        const userId = user.id;
        const compId = companyId || user.companyId || 'company_default';

        if (!this.userSockets.has(userId)) {
            this.userSockets.set(userId, new Set());
        }

        const socketSet = this.userSockets.get(userId);
        const wentOnline = socketSet.size === 0;
        socketSet.add(socketId);

        this.socketMeta.set(socketId, {
            userId,
            companyId: compId,
            userName: user.name || 'Usuário',
            userRole: user.role || 'operator',
            connectedAt: Date.now()
        });

        return { wentOnline, userId, companyId: compId };
    }

    /**
     * Remove o socket desconectado
     */
    removeSocket(socketId) {
        if (!socketId || !this.socketMeta.has(socketId)) return null;

        const meta = this.socketMeta.get(socketId);
        this.socketMeta.delete(socketId);

        const { userId, companyId } = meta;
        const socketSet = this.userSockets.get(userId);
        let wentOffline = false;

        if (socketSet) {
            socketSet.delete(socketId);
            if (socketSet.size === 0) {
                this.userSockets.delete(userId);
                wentOffline = true;
            }
        }

        return {
            userId,
            companyId,
            wentOffline,
            userName: meta.userName,
            userRole: meta.userRole
        };
    }

    /**
     * Verifica se determinado usuário possui ao menos um socket conectado
     */
    isUserOnline(userId) {
        if (!userId) return false;
        const set = this.userSockets.get(userId);
        return Boolean(set && set.size > 0);
    }

    /**
     * Retorna lista de IDs de usuários online (opcionalmente filtrados por empresa)
     */
    getOnlineUserIds(companyId = null) {
        const ids = new Set();
        for (const meta of this.socketMeta.values()) {
            if (!companyId || meta.companyId === companyId) {
                ids.add(meta.userId);
            }
        }
        return Array.from(ids);
    }

    /**
     * Retorna a contagem de usuários online por empresa
     */
    getOnlineCount(companyId = null) {
        return this.getOnlineUserIds(companyId).length;
    }
}

module.exports = new UserPresenceService();
