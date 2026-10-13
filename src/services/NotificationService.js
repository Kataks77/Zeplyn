const { getDatabase } = require('./DatabaseService');
const crypto = require('crypto');

/**
 * Criar nova notificação
 */
async function createNotification(notificationData) {
    const db = getDatabase();

    const notification = {
        id: crypto.randomUUID(),
        userId: notificationData.userId,
        title: notificationData.title,
        message: notificationData.message,
        type: notificationData.type || 'Informativo',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isRead: false,
        sentBy: notificationData.sentBy || 'admin'
    };

    await db.query(`
        INSERT INTO notifications (id, "userId", title, message, type, "createdAt", "updatedAt", "isRead", "sentBy")
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `, [
        notification.id,
        notification.userId,
        notification.title,
        notification.message,
        notification.type,
        notification.createdAt,
        notification.updatedAt,
        notification.isRead,
        notification.sentBy
    ]);

    return notification;
}

/**
 * Atualizar notificação existente
 */
async function updateNotification(id, updates) {
    const db = getDatabase();
    const res = await db.query('SELECT * FROM notifications WHERE id = $1', [id]);
    const existing = res.rows[0];
    if (!existing) throw new Error('Notificação não encontrada');

    const type = updates.type !== undefined ? updates.type : existing.type;
    const title = updates.title !== undefined ? updates.title : existing.title;
    const message = updates.message !== undefined ? updates.message : existing.message;
    const updatedAt = new Date().toISOString();

    await db.query(`
        UPDATE notifications 
        SET type = $1, title = $2, message = $3, "updatedAt" = $4
        WHERE id = $5
    `, [type, title, message, updatedAt, id]);

    return { ...existing, ...updates, updatedAt };
}

/**
 * Listar todas as notificações (filtradas por empresa)
 */
async function listAllNotifications(companyId = null) {
    const db = getDatabase();
    let query = `
        SELECT n.*, u.name as "userName", u."companyId"
        FROM notifications n
        LEFT JOIN users u ON n."userId" = u.id
    `;
    const params = [];
    if (companyId) {
        query += ` WHERE u."companyId" = $1`;
        params.push(companyId);
    }
    query += ` ORDER BY n."createdAt" DESC`;
    const res = await db.query(query, params);
    return res.rows;
}

/**
 * Listar notificações de um usuário
 */
async function listNotifications(userId) {
    const db = getDatabase();
    const res = await db.query('SELECT * FROM notifications WHERE "userId" = $1 ORDER BY "createdAt" DESC', [userId]);
    return res.rows;
}

/**
 * Marcar notificação como lida (com validação de dono)
 */
async function markAsRead(notificationId, userId = null) {
    const db = getDatabase();
    let sql = 'UPDATE notifications SET "isRead" = TRUE, "updatedAt" = $1 WHERE id = $2';
    const params = [new Date().toISOString(), notificationId];
    if (userId) {
        sql += ' AND "userId" = $3';
        params.push(userId);
    }
    const res = await db.query(sql, params);
    return res.rowCount > 0;
}

/**
 * Deletar notificação (com validação de dono)
 */
async function deleteNotification(notificationId, userId = null) {
    const db = getDatabase();
    let sql = 'DELETE FROM notifications WHERE id = $1';
    const params = [notificationId];
    if (userId) {
        sql += ' AND "userId" = $2';
        params.push(userId);
    }
    const res = await db.query(sql, params);
    return res.rowCount > 0;
}

/**
 * Criar notificação em lote para todos os usuários de uma empresa (otimizada em uma única query)
 */
async function broadcastNotification({ title, message, type = 'Informativo', sentBy = 'Sistema', companyId = null }) {
    const db = getDatabase();
    const now = new Date().toISOString();
    let sql = `
        INSERT INTO notifications (id, "userId", title, message, type, "createdAt", "updatedAt", "isRead", "sentBy")
        SELECT 
            'notif_' || md5(random()::text || clock_timestamp()::text),
            id,
            $1,
            $2,
            $3,
            $4,
            $4,
            FALSE,
            $5
        FROM users
    `;
    const params = [title, message, type, now, sentBy];
    if (companyId) {
        sql += ` WHERE "companyId" = $6`;
        params.push(companyId);
    }
    await db.query(sql, params);
}

module.exports = {
    createNotification,
    updateNotification,
    listAllNotifications,
    listNotifications,
    markAsRead,
    deleteNotification,
    broadcastNotification
};


