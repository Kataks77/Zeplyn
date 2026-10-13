const ReportService = require('../services/ReportService');

class ReportController {
    constructor() {
        this.getAdvancedMetrics = this.getAdvancedMetrics.bind(this);
        this.exportReport = this.exportReport.bind(this);
    }

    async getAdvancedMetrics(req, res) {
        try {
            const isSuperAdmin = req.user && req.user.role === 'superadmin';
            const companyId = isSuperAdmin ? (req.query.companyId || null) : (req.user?.companyId || 'company_default');

            const { period, startDate, endDate, botId, department } = req.query;

            const report = await ReportService.getAdvancedReport({
                companyId,
                period: period || '7days',
                startDate,
                endDate,
                botId,
                department
            });

            res.json({ success: true, report });
        } catch (error) {
            console.error('❌ Erro no ReportController.getAdvancedMetrics:', error);
            res.status(500).json({ error: error.message || 'Erro ao gerar relatório avançado' });
        }
    }

    async exportReport(req, res) {
        try {
            const isSuperAdmin = req.user && req.user.role === 'superadmin';
            const companyId = isSuperAdmin ? (req.query.companyId || null) : (req.user?.companyId || 'company_default');

            const { period, startDate, endDate, botId, department, format = 'csv' } = req.query;

            if (format === 'csv') {
                const csvData = await ReportService.generateCsvReport({
                    companyId,
                    period: period || '7days',
                    startDate,
                    endDate,
                    botId,
                    department
                });

                res.setHeader('Content-Type', 'text/csv; charset=utf-8');
                res.setHeader('Content-Disposition', `attachment; filename="relatorio_metricas_${period || '7d'}_${Date.now()}.csv"`);
                return res.send(csvData);
            }

            if (format === 'pdf') {
                const pdfBuffer = await ReportService.generatePdfReport({
                    companyId,
                    period: period || '7days',
                    startDate,
                    endDate,
                    botId,
                    department
                });

                res.setHeader('Content-Type', 'application/pdf');
                res.setHeader('Content-Disposition', `attachment; filename="relatorio_performance_${period || '7d'}_${Date.now()}.pdf"`);
                return res.send(pdfBuffer);
            }

            res.status(400).json({ error: 'Formato não suportado. Utilize format=pdf ou format=csv' });
        } catch (error) {
            console.error('❌ Erro no ReportController.exportReport:', error);
            res.status(500).json({ error: error.message || 'Erro ao exportar relatório' });
        }
    }
}

module.exports = new ReportController();
