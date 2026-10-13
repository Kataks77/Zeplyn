const express = require('express');
const router = express.Router();
const { getDatabase } = require('../services/DatabaseService');
const BotManagerService = require('../services/BotManagerService');

/**
 * GET /api/health
 * Endpoint público de verificação de disponibilidade (sem expor versões ou métricas internas sensíveis)
 */
router.get('/health', async (req, res) => {
    const startTime = Date.now();
    let isDbHealthy = false;

    try {
        const db = getDatabase();
        if (db) {
            await db.query('SELECT 1');
            isDbHealthy = true;
        }
    } catch (err) {
        isDbHealthy = false;
    }

    const isHealthy = isDbHealthy;
    const authHeader = req.headers.authorization;
    const isInternalQuery = authHeader && authHeader.startsWith('Bearer ');

    // Se for requisição externa/pública anônima, responde apenas status básico sem fingerprinting
    if (!isInternalQuery) {
        return res.status(isHealthy ? 200 : 503).json({
            status: isHealthy ? 'healthy' : 'degraded',
            timestamp: new Date().toISOString()
        });
    }

    // Diagnóstico detalhado apenas para requisições com token
    const botStatusMap = BotManagerService.getAllStatus();
    const memoryUsage = process.memoryUsage();
    res.status(isHealthy ? 200 : 503).json({
        status: isHealthy ? 'healthy' : 'degraded',
        timestamp: new Date().toISOString(),
        uptimeSeconds: Math.floor(process.uptime()),
        database: { connected: isDbHealthy, latencyMs: Date.now() - startTime },
        bots: { total: Object.keys(botStatusMap).length },
        system: {
            memoryRssMb: (memoryUsage.rss / 1024 / 1024).toFixed(2)
        }
    });
});

module.exports = router;

