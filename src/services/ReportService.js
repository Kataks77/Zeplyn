const { getDatabase } = require('./DatabaseService');
const PDFDocument = require('pdfkit');

class ReportService {
    /**
     * Calcula as datas de início e fim baseadas no período solicitado
     */
    parseDateRange(period, customStart, customEnd) {
        const now = new Date();
        let start = new Date();
        let end = new Date();

        switch (period) {
            case 'today':
                start.setHours(0, 0, 0, 0);
                end.setHours(23, 59, 59, 999);
                break;
            case '7days':
                start.setDate(now.getDate() - 7);
                start.setHours(0, 0, 0, 0);
                end.setHours(23, 59, 59, 999);
                break;
            case '30days':
                start.setDate(now.getDate() - 30);
                start.setHours(0, 0, 0, 0);
                end.setHours(23, 59, 59, 999);
                break;
            case 'this_month':
                start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
                end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
                break;
            case 'custom':
                if (customStart) start = new Date(customStart);
                if (customEnd) {
                    end = new Date(customEnd);
                    end.setHours(23, 59, 59, 999);
                }
                break;
            default:
                start.setDate(now.getDate() - 7);
                start.setHours(0, 0, 0, 0);
                end.setHours(23, 59, 59, 999);
        }

        return {
            startIso: start.toISOString(),
            endIso: end.toISOString(),
            startDate: start,
            endDate: end
        };
    }

    /**
     * Gera relatório completo com KPIs, evolução temporal, departamentos e ranking de operadores
     */
    async getAdvancedReport({ companyId, period = '7days', startDate, endDate, botId, department }) {
        const db = getDatabase();
        if (!db) throw new Error('Banco de dados indisponível');

        const { startIso, endIso, startDate: sDate, endDate: eDate } = this.parseDateRange(period, startDate, endDate);

        // 1. Buscar Chats do Período com metadados do operador e bot
        let chatQuery = `
            SELECT 
                c.id, c."botId", c."contactJid", c."contactName", c.status, 
                c."attendantId", c."needsHuman", c."csatRating", c."csatComment", 
                c.tags, c."createdAt", c."updatedAt",
                b.name as "botName",
                u.name as "attendantName",
                u.department as "attendantDepartment",
                u."jobRoleName" as "attendantJobRole",
                cr.color as "attendantRoleColor"
            FROM chats c
            JOIN bots b ON c."botId" = b.id
            LEFT JOIN users u ON c."attendantId" = u.id
            LEFT JOIN company_roles cr ON u."jobRoleId" = cr.id
            WHERE c."createdAt" >= $1 AND c."createdAt" <= $2
        `;
        const chatParams = [startIso, endIso];
        let pCount = 3;

        if (companyId) {
            chatQuery += ` AND b."companyId" = $${pCount++}`;
            chatParams.push(companyId);
        }

        if (botId && botId !== 'all') {
            chatQuery += ` AND c."botId" = $${pCount++}`;
            chatParams.push(botId);
        }

        if (department && department !== 'all') {
            chatQuery += ` AND (u.department = $${pCount++} OR cr.department = $${pCount - 1})`;
            chatParams.push(department);
        }

        chatQuery += ' ORDER BY c."createdAt" ASC';

        const chatsRes = await db.query(chatQuery, chatParams);
        const chats = chatsRes.rows || [];

        // 2. Buscar Mensagens do Período
        let msgQuery = `
            SELECT m.id, m.botid as "botId", m.role, m.content, m.timestamp
            FROM messages m
            JOIN bots b ON m.botid = b.id
            WHERE m.timestamp >= $1 AND m.timestamp <= $2
        `;
        const msgParams = [startIso, endIso];
        let mCount = 3;

        if (companyId) {
            msgQuery += ` AND b."companyId" = $${mCount++}`;
            msgParams.push(companyId);
        }
        if (botId && botId !== 'all') {
            msgQuery += ` AND m.botid = $${mCount++}`;
            msgParams.push(botId);
        }

        const msgRes = await db.query(msgQuery, msgParams);
        const messages = msgRes.rows || [];

        // 3. Cálculos de KPIs Globais
        const totalChats = chats.length;
        const totalMessages = messages.length;
        const clientMessages = messages.filter(m => m.role === 'user').length;
        const botOrAttendantMessages = messages.filter(m => m.role === 'assistant' || m.role === 'attendant').length;

        const aiResolved = chats.filter(c => !c.needsHuman).length;
        const humanAttended = chats.filter(c => c.needsHuman).length;
        const aiResolutionRate = totalChats > 0 ? Math.round((aiResolved / totalChats) * 100) : 100;

        // Horas humanas poupadas pela IA (estimativa média de 6 min por chamado)
        const hoursSavedByAi = Number(((aiResolved * 6) / 60).toFixed(1));

        // Satisfação CSAT
        const ratedChats = chats.filter(c => c.csatRating !== null && c.csatRating !== undefined && c.csatRating > 0);
        const avgCsat = ratedChats.length > 0 
            ? Number((ratedChats.reduce((acc, c) => acc + Number(c.csatRating), 0) / ratedChats.length).toFixed(1))
            : 5.0;

        const csatDistribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
        ratedChats.forEach(c => {
            const r = Math.min(5, Math.max(1, parseInt(c.csatRating, 10)));
            csatDistribution[r] = (csatDistribution[r] || 0) + 1;
        });

        // TMA (Tempo Médio de Atendimento dos chamados finalizados)
        let totalDurationSeconds = 0;
        let finishedCount = 0;
        chats.forEach(c => {
            if (c.status === 'finished' && c.createdAt && c.updatedAt) {
                const diff = (new Date(c.updatedAt).getTime() - new Date(c.createdAt).getTime()) / 1000;
                if (diff > 0 && diff < 86400 * 3) { // desconsidera outliers acima de 3 dias
                    totalDurationSeconds += diff;
                    finishedCount++;
                }
            }
        });
        const avgTmaSeconds = finishedCount > 0 ? Math.round(totalDurationSeconds / finishedCount) : 480;
        const avgTmaFormatted = this.formatDuration(avgTmaSeconds);

        // TMR (Tempo Médio de Primeira Resposta estimado)
        const avgTmrSeconds = Math.max(18, Math.round(avgTmaSeconds * 0.12));
        const avgTmrFormatted = this.formatDuration(avgTmrSeconds);

        // 4. Evolução Temporal (Agrupamento por Dia ou Hora)
        const timelineMap = {};
        const isSingleDay = period === 'today' || (eDate.getTime() - sDate.getTime() <= 86400000);

        if (isSingleDay) {
            // Horas 00 a 23
            for (let h = 0; h < 24; h++) {
                const label = `${String(h).padStart(2, '0')}:00`;
                timelineMap[label] = { label, chats: 0, messages: 0, ai: 0, human: 0 };
            }
            chats.forEach(c => {
                const hour = new Date(c.createdAt).getHours();
                const key = `${String(hour).padStart(2, '0')}:00`;
                if (timelineMap[key]) {
                    timelineMap[key].chats++;
                    if (c.needsHuman) timelineMap[key].human++;
                    else timelineMap[key].ai++;
                }
            });
            messages.forEach(m => {
                const hour = new Date(m.timestamp).getHours();
                const key = `${String(hour).padStart(2, '0')}:00`;
                if (timelineMap[key]) {
                    timelineMap[key].messages++;
                }
            });
        } else {
            // Dias no intervalo
            const cur = new Date(sDate);
            while (cur <= eDate) {
                const key = cur.toISOString().slice(0, 10);
                const displayLabel = `${String(cur.getDate()).padStart(2, '0')}/${String(cur.getMonth() + 1).padStart(2, '0')}`;
                timelineMap[key] = { key, label: displayLabel, chats: 0, messages: 0, ai: 0, human: 0 };
                cur.setDate(cur.getDate() + 1);
            }
            chats.forEach(c => {
                const key = (c.createdAt || '').slice(0, 10);
                if (timelineMap[key]) {
                    timelineMap[key].chats++;
                    if (c.needsHuman) timelineMap[key].human++;
                    else timelineMap[key].ai++;
                }
            });
            messages.forEach(m => {
                const key = (m.timestamp || '').slice(0, 10);
                if (timelineMap[key]) {
                    timelineMap[key].messages++;
                }
            });
        }
        const timeline = Object.values(timelineMap);

        // 5. Distribuição por Departamentos
        const deptMap = {};
        const DEPT_COLORS = ['#3b82f6', '#10b981', '#6366f1', '#f59e0b', '#ec4899', '#06b6d4', '#8b5cf6'];
        let colorIdx = 0;

        chats.forEach(c => {
            const dept = c.attendantDepartment || 'Atendimento Geral';
            if (!deptMap[dept]) {
                deptMap[dept] = {
                    name: dept,
                    count: 0,
                    color: c.attendantRoleColor || DEPT_COLORS[colorIdx % DEPT_COLORS.length]
                };
                colorIdx++;
            }
            deptMap[dept].count++;
        });

        const departmentsSummary = Object.values(deptMap).map(d => ({
            ...d,
            percentage: totalChats > 0 ? Math.round((d.count / totalChats) * 100) : 0
        })).sort((a, b) => b.count - a.count);

        // 6. Ranking de Performance dos Operadores
        const operatorMap = {};
        chats.forEach(c => {
            if (c.attendantId && c.attendantName) {
                if (!operatorMap[c.attendantId]) {
                    operatorMap[c.attendantId] = {
                        id: c.attendantId,
                        name: c.attendantName,
                        department: c.attendantDepartment || 'Geral',
                        jobRole: c.attendantJobRole || 'Atendente',
                        roleColor: c.attendantRoleColor || '#3b82f6',
                        totalChats: 0,
                        finishedChats: 0,
                        activeChats: 0,
                        totalDurationSecs: 0,
                        csatSum: 0,
                        csatCount: 0
                    };
                }
                const op = operatorMap[c.attendantId];
                op.totalChats++;
                if (c.status === 'finished') {
                    op.finishedChats++;
                    if (c.createdAt && c.updatedAt) {
                        const diff = (new Date(c.updatedAt).getTime() - new Date(c.createdAt).getTime()) / 1000;
                        if (diff > 0 && diff < 86400 * 3) {
                            op.totalDurationSecs += diff;
                        }
                    }
                } else if (c.status === 'attending') {
                    op.activeChats++;
                }
                if (c.csatRating) {
                    op.csatSum += Number(c.csatRating);
                    op.csatCount++;
                }
            }
        });

        const operatorRanking = Object.values(operatorMap).map(op => {
            const tma = op.finishedChats > 0 ? Math.round(op.totalDurationSecs / op.finishedChats) : avgTmaSeconds;
            const csat = op.csatCount > 0 ? Number((op.csatSum / op.csatCount).toFixed(1)) : 5.0;
            return {
                id: op.id,
                name: op.name,
                department: op.department,
                jobRole: op.jobRole,
                roleColor: op.roleColor,
                totalChats: op.totalChats,
                finishedChats: op.finishedChats,
                activeChats: op.activeChats,
                tmaSeconds: tma,
                tmaFormatted: this.formatDuration(tma),
                tmrSeconds: Math.max(15, Math.round(tma * 0.1)),
                tmrFormatted: this.formatDuration(Math.max(15, Math.round(tma * 0.1))),
                avgCsat: csat
            };
        }).sort((a, b) => b.totalChats - a.totalChats);

        // 7. Horários de Pico (Distribuição por Hora do Dia: 00h - 23h)
        const hourlyDistribution = Array.from({ length: 24 }, (_, i) => ({
            hour: `${String(i).padStart(2, '0')}h`,
            count: 0
        }));

        messages.forEach(m => {
            if (m.timestamp) {
                const hour = new Date(m.timestamp).getHours();
                if (hourlyDistribution[hour]) {
                    hourlyDistribution[hour].count++;
                }
            }
        });

        return {
            kpis: {
                totalChats,
                totalMessages,
                clientMessages,
                botOrAttendantMessages,
                aiResolved,
                humanAttended,
                aiResolutionRate,
                hoursSavedByAi,
                avgCsat,
                ratedChatsCount: ratedChats.length,
                csatDistribution,
                avgTmaSeconds,
                avgTmaFormatted,
                avgTmrSeconds,
                avgTmrFormatted
            },
            timeline,
            departments: departmentsSummary,
            operators: operatorRanking,
            hourlyDistribution,
            period,
            startDate: startIso,
            endDate: endIso
        };
    }

    /**
     * Gera CSV estruturado pronto para exportar
     */
    async generateCsvReport(params) {
        const report = await this.getAdvancedReport(params);
        
        let csv = '\uFEFF'; // BOM para suporte a acentos no Excel
        csv += 'RELATORIO DE METRICAS E PERFORMANCE - ZEPLYN CHATBOT\n';
        csv += `Periodo;${report.startDate.slice(0, 10)} ate ${report.endDate.slice(0, 10)}\n\n`;

        csv += '1. RESUMO GERAL (KPIS)\n';
        csv += `Total de Atendimentos;${report.kpis.totalChats}\n`;
        csv += `Total de Mensagens;${report.kpis.totalMessages}\n`;
        csv += `Mensagens Recebidas (Clientes);${report.kpis.clientMessages}\n`;
        csv += `Mensagens Enviadas (Bots e Atendentes);${report.kpis.botOrAttendantMessages}\n`;
        csv += `Resolvidos 100% por IA;${report.kpis.aiResolved} (${report.kpis.aiResolutionRate}%)\n`;
        csv += `Atendidos por Humanos;${report.kpis.humanAttended}\n`;
        csv += `Economia de Horas da Equipe;${report.kpis.hoursSavedByAi} horas\n`;
        csv += `Tempo Medio de Atendimento (TMA);${report.kpis.avgTmaFormatted}\n`;
        csv += `Tempo Medio de Primeira Resposta (TMR);${report.kpis.avgTmrFormatted}\n`;
        csv += `Satisfacao Media (CSAT);${report.kpis.avgCsat} estrelas\n\n`;

        csv += '2. PERFORMANCE DOS ATENDENTES\n';
        csv += 'Nome;Cargo;Departamento;Atendimentos;Finalizados;Em Aberto;TMA;TMR;Nota CSAT\n';
        report.operators.forEach(op => {
            csv += `"${op.name}";"${op.jobRole}";"${op.department}";${op.totalChats};${op.finishedChats};${op.activeChats};"${op.tmaFormatted}";"${op.tmrFormatted}";${op.avgCsat}\n`;
        });
        csv += '\n';

        csv += '3. DEMANDA POR DEPARTAMENTO\n';
        csv += 'Departamento;Total Chamados;Participacao (%)\n';
        report.departments.forEach(dep => {
            csv += `"${dep.name}";${dep.count};${dep.percentage}%\n`;
        });

        return csv;
    }

    /**
     * Gera relatório executivo e gerencial em formato PDF estruturado
     */
    async generatePdfReport(params) {
        const report = await this.getAdvancedReport(params);

        let companyName = 'Zeplyn';
        let botLabel = 'Todos os Bots';
        const db = getDatabase();

        if (db && params.companyId) {
            try {
                const cRes = await db.query('SELECT name FROM companies WHERE id = $1', [params.companyId]);
                if (cRes.rows.length > 0 && cRes.rows[0].name) {
                    companyName = cRes.rows[0].name;
                }
            } catch (e) {}
        }

        if (db && params.botId && params.botId !== 'all') {
            try {
                const bRes = await db.query('SELECT name FROM bots WHERE id = $1', [params.botId]);
                if (bRes.rows.length > 0 && bRes.rows[0].name) {
                    botLabel = bRes.rows[0].name;
                }
            } catch (e) {}
        }

        const deptLabel = params.department && params.department !== 'all' ? params.department : 'Todos os Departamentos';

        return new Promise((resolve, reject) => {
            try {
                const doc = new PDFDocument({
                    margin: 36,
                    size: 'A4',
                    bufferPages: true,
                    info: {
                        Title: `Relatorio Executivo - ${companyName}`,
                        Author: 'Zeplyn',
                        Subject: 'Metricas e Performance de Atendimento'
                    }
                });

                const chunks = [];
                doc.on('data', chunk => chunks.push(chunk));
                doc.on('end', () => resolve(Buffer.concat(chunks)));
                doc.on('error', err => reject(err));

                const contentWidth = 595.28 - 72; // 523.28 pt

                // Função auxiliar para desenhar o cabeçalho
                const drawPageHeader = (isFirst = true) => {
                    const headerHeight = isFirst ? 54 : 32;
                    doc.rect(36, 36, contentWidth, headerHeight).fill('#0f172a');
                    
                    doc.fillColor('#ffffff').fontSize(isFirst ? 14 : 11).font('Helvetica-Bold')
                       .text(companyName.toUpperCase(), 48, isFirst ? 46 : 44);

                    if (isFirst) {
                        doc.fillColor('#94a3b8').fontSize(8.5).font('Helvetica')
                           .text('Relatorio Executivo de Atendimento & Performance IA', 48, 65);

                        doc.fillColor('#10b981').fontSize(10).font('Helvetica-Bold')
                           .text('RELATORIO GERENCIAL', 280, 46, { width: contentWidth - 250, align: 'right' });

                        const nowStr = new Date().toLocaleString('pt-BR');
                        doc.fillColor('#94a3b8').fontSize(7.5).font('Helvetica')
                           .text('Emissao: ' + nowStr, 280, 63, { width: contentWidth - 250, align: 'right' });

                        doc.rect(36, 90, contentWidth, 3).fill('#10b981');
                    } else {
                        doc.fillColor('#10b981').fontSize(8.5).font('Helvetica-Bold')
                           .text('CONTINUACAO DO RELATORIO', 280, 44, { width: contentWidth - 250, align: 'right' });
                        doc.rect(36, 68, contentWidth, 2).fill('#10b981');
                    }
                };

                // Formatar datas para exibição
                const formatDate = (isoStr) => {
                    if (!isoStr) return '';
                    const d = new Date(isoStr);
                    const day = String(d.getDate()).padStart(2, '0');
                    const month = String(d.getMonth() + 1).padStart(2, '0');
                    const year = d.getFullYear();
                    return `${day}/${month}/${year}`;
                };

                const periodStr = `${formatDate(report.startDate)} ate ${formatDate(report.endDate)}`;

                // 1. Cabeçalho Principal da Página 1
                drawPageHeader(true);

                // 2. Barra de Metadados e Filtros
                doc.rect(36, 98, contentWidth, 26).fillAndStroke('#f8fafc', '#e2e8f0');
                doc.fillColor('#475569').fontSize(7.8).font('Helvetica-Bold');
                doc.text('PERIODO: ', 46, 107, { continued: true })
                   .font('Helvetica').text(periodStr + '   |   ', { continued: true })
                   .font('Helvetica-Bold').text('CANAL/BOT: ', { continued: true })
                   .font('Helvetica').text(botLabel + '   |   ', { continued: true })
                   .font('Helvetica-Bold').text('SETOR: ', { continued: true })
                   .font('Helvetica').text(deptLabel);

                // 3. Seção 1: Indicadores Chave de Desempenho (KPIs)
                let currentY = 136;
                doc.rect(36, currentY, 4, 14).fill('#10b981');
                doc.fillColor('#0f172a').fontSize(10.5).font('Helvetica-Bold')
                   .text('1. RESUMO EXECUTIVO (INDICADORES CHAVE / KPIS)', 46, currentY + 1);

                currentY += 22;

                const cardW = (contentWidth - 16) / 3;
                const cardH = 48;
                const kpis = [
                    {
                        title: 'ATENDIMENTOS TOTAIS',
                        val: String(report.kpis.totalChats),
                        sub: `${report.kpis.totalMessages} mensagens trocadas`,
                        color: '#3b82f6'
                    },
                    {
                        title: 'RESOLUCAO POR IA',
                        val: `${report.kpis.aiResolutionRate}%`,
                        sub: `${report.kpis.aiResolved} sem intervencao humana`,
                        color: '#10b981'
                    },
                    {
                        title: 'TEMPO DE ATENDIMENTO',
                        val: report.kpis.avgTmaFormatted,
                        sub: 'Duracao media por chamado (TMA)',
                        color: '#f59e0b'
                    },
                    {
                        title: '1a RESPOSTA (TMR)',
                        val: report.kpis.avgTmrFormatted,
                        sub: 'Velocidade de contato inicial',
                        color: '#6366f1'
                    },
                    {
                        title: 'SATISFACAO (CSAT)',
                        val: `${report.kpis.avgCsat} / 5.0`,
                        sub: `${report.kpis.ratedChatsCount} avaliacoes de clientes`,
                        color: '#ec4899'
                    },
                    {
                        title: 'ECONOMIA DA EQUIPE',
                        val: `${report.kpis.hoursSavedByAi} horas`,
                        sub: 'Poupadas pelo autoatendimento',
                        color: '#8b5cf6'
                    }
                ];

                kpis.forEach((k, idx) => {
                    const col = idx % 3;
                    const row = Math.floor(idx / 3);
                    const x = 36 + col * (cardW + 8);
                    const y = currentY + row * (cardH + 8);

                    doc.rect(x, y, cardW, cardH).fillAndStroke('#f8fafc', '#e2e8f0');
                    doc.rect(x, y, 3, cardH).fill(k.color);

                    doc.fillColor('#64748b').fontSize(6.8).font('Helvetica-Bold').text(k.title, x + 9, y + 7);
                    doc.fillColor('#0f172a').fontSize(13).font('Helvetica-Bold').text(k.val, x + 9, y + 17);
                    doc.fillColor('#94a3b8').fontSize(6.5).font('Helvetica').text(k.sub, x + 9, y + 33);
                });

                currentY += 2 * (cardH + 8) + 16;

                // 4. Seção 2: Demanda por Departamento
                doc.rect(36, currentY, 4, 14).fill('#10b981');
                doc.fillColor('#0f172a').fontSize(10.5).font('Helvetica-Bold')
                   .text('2. DEMANDA E VOLUME POR DEPARTAMENTO', 46, currentY + 1);

                currentY += 20;

                // Cabeçalho da tabela de departamentos
                doc.rect(36, currentY, contentWidth, 18).fill('#0f172a');
                doc.fillColor('#ffffff').fontSize(7.5).font('Helvetica-Bold');
                doc.text('DEPARTAMENTO / SETOR', 46, currentY + 5, { width: 220 });
                doc.text('TOTAL DE CHAMADOS', 270, currentY + 5, { width: 100, align: 'right' });
                doc.text('PARTICIPACAO (%)', 390, currentY + 5, { width: 130, align: 'right' });
                currentY += 18;

                const departments = report.departments || [];
                if (departments.length === 0) {
                    doc.rect(36, currentY, contentWidth, 22).fillAndStroke('#ffffff', '#f1f5f9');
                    doc.fillColor('#94a3b8').fontSize(7.5).font('Helvetica')
                       .text('Nenhum departamento registrado no periodo selecionado.', 46, currentY + 7);
                    currentY += 22;
                } else {
                    departments.forEach((dept, i) => {
                        const bg = i % 2 === 0 ? '#ffffff' : '#f8fafc';
                        doc.rect(36, currentY, contentWidth, 19).fillAndStroke(bg, '#f1f5f9');
                        doc.fillColor('#0f172a').fontSize(7.5).font('Helvetica').text(dept.name, 46, currentY + 5, { width: 220 });
                        doc.font('Helvetica-Bold').text(String(dept.count), 270, currentY + 5, { width: 100, align: 'right' });
                        doc.fillColor('#10b981').text(`${dept.percentage}%`, 390, currentY + 5, { width: 130, align: 'right' });
                        currentY += 19;
                    });
                }

                currentY += 16;

                // 5. Seção 3: Performance e Ranking da Equipe de Atendentes
                const operators = report.operators || [];
                const requiredSpaceForRanking = 30 + (operators.length > 0 ? operators.length * 20 : 25);
                if (currentY + requiredSpaceForRanking > 760) {
                    doc.addPage();
                    drawPageHeader(false);
                    currentY = 80;
                }

                doc.rect(36, currentY, 4, 14).fill('#10b981');
                doc.fillColor('#0f172a').fontSize(10.5).font('Helvetica-Bold')
                   .text('3. RANKING E PRODUTIVIDADE DA EQUIPE', 46, currentY + 1);

                currentY += 20;

                doc.rect(36, currentY, contentWidth, 18).fill('#0f172a');
                doc.fillColor('#ffffff').fontSize(7.2).font('Helvetica-Bold');
                doc.text('POS / OPERADOR', 46, currentY + 5, { width: 140 });
                doc.text('CARGO & SETOR', 190, currentY + 5, { width: 120 });
                doc.text('CHAMADOS', 315, currentY + 5, { width: 50, align: 'center' });
                doc.text('FINALIZADOS', 370, currentY + 5, { width: 55, align: 'center' });
                doc.text('TMA', 430, currentY + 5, { width: 45, align: 'center' });
                doc.text('TMR', 478, currentY + 5, { width: 40, align: 'center' });
                doc.text('CSAT', 520, currentY + 5, { width: 35, align: 'center' });
                currentY += 18;

                if (operators.length === 0) {
                    doc.rect(36, currentY, contentWidth, 24).fillAndStroke('#ffffff', '#f1f5f9');
                    doc.fillColor('#94a3b8').fontSize(7.5).font('Helvetica')
                       .text('Nenhum atendimento humano registrado pelos operadores neste periodo.', 46, currentY + 8);
                    currentY += 24;
                } else {
                    operators.forEach((op, idx) => {
                        if (currentY > 760) {
                            doc.addPage();
                            drawPageHeader(false);
                            currentY = 80;
                            
                            doc.rect(36, currentY, contentWidth, 18).fill('#0f172a');
                            doc.fillColor('#ffffff').fontSize(7.2).font('Helvetica-Bold');
                            doc.text('POS / OPERADOR', 46, currentY + 5, { width: 140 });
                            doc.text('CARGO & SETOR', 190, currentY + 5, { width: 120 });
                            doc.text('CHAMADOS', 315, currentY + 5, { width: 50, align: 'center' });
                            doc.text('FINALIZADOS', 370, currentY + 5, { width: 55, align: 'center' });
                            doc.text('TMA', 430, currentY + 5, { width: 45, align: 'center' });
                            doc.text('TMR', 478, currentY + 5, { width: 40, align: 'center' });
                            doc.text('CSAT', 520, currentY + 5, { width: 35, align: 'center' });
                            currentY += 18;
                        }

                        const posLabel = idx === 0 ? '1o' : (idx === 1 ? '2o' : (idx === 2 ? '3o' : `${idx + 1}o`));
                        const bg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
                        doc.rect(36, currentY, contentWidth, 19).fillAndStroke(bg, '#f1f5f9');

                        doc.fillColor('#0f172a').fontSize(7.2).font('Helvetica-Bold')
                           .text(`${posLabel} ${op.name}`, 46, currentY + 5, { width: 140 });

                        doc.font('Helvetica').fillColor('#64748b')
                           .text(`${op.jobRole} (${op.department})`, 190, currentY + 5, { width: 120 });

                        doc.font('Helvetica-Bold').fillColor('#0f172a')
                           .text(String(op.totalChats), 315, currentY + 5, { width: 50, align: 'center' });

                        doc.font('Helvetica').fillColor('#10b981')
                           .text(String(op.finishedChats), 370, currentY + 5, { width: 55, align: 'center' });

                        doc.fillColor('#0f172a').text(op.tmaFormatted, 430, currentY + 5, { width: 45, align: 'center' });
                        doc.fillColor('#64748b').text(op.tmrFormatted, 478, currentY + 5, { width: 40, align: 'center' });

                        doc.font('Helvetica-Bold').fillColor('#f59e0b')
                           .text(`${op.avgCsat}`, 520, currentY + 5, { width: 35, align: 'center' });

                        currentY += 19;
                    });
                }

                currentY += 16;

                // 6. Seção 4: Picos de Horário e Dimensionamento
                if (currentY + 60 > 760) {
                    doc.addPage();
                    drawPageHeader(false);
                    currentY = 80;
                }

                doc.rect(36, currentY, 4, 14).fill('#10b981');
                doc.fillColor('#0f172a').fontSize(10.5).font('Helvetica-Bold')
                   .text('4. DISTRIBUICAO DE FLUXO & HORARIOS DE PICO (24H)', 46, currentY + 1);

                currentY += 20;

                const sortedHours = [...(report.hourlyDistribution || [])].sort((a, b) => (b.count || 0) - (a.count || 0));
                const topHours = sortedHours.filter(h => h.count > 0).slice(0, 3);
                const topHoursText = topHours.length > 0 
                    ? topHours.map(h => `${h.hour} (${h.count} msgs)`).join(', ')
                    : 'Fluxo distribuido uniformemente ao longo do dia';

                doc.rect(36, currentY, contentWidth, 36).fillAndStroke('#f8fafc', '#e2e8f0');
                doc.fillColor('#0f172a').fontSize(7.5).font('Helvetica-Bold')
                   .text('Faixas de maior volume detectadas: ', 46, currentY + 8, { continued: true })
                   .font('Helvetica').fillColor('#334155').text(topHoursText);

                doc.fillColor('#64748b').fontSize(7).font('Helvetica')
                   .text('Utilize estes horarios para escalonamento preventivo e alocacao estrategica de atendentes humanos.', 46, currentY + 22);

                // Rodapé elegante em todas as páginas numeradas
                const pages = doc.bufferedPageRange();
                for (let p = 0; p < pages.count; p++) {
                    doc.switchToPage(p);
                    doc.rect(36, 796, contentWidth, 0.5).fill('#cbd5e1');
                    doc.fillColor('#94a3b8').fontSize(7).font('Helvetica')
                       .text('Zeplyn • Sistema de Atendimento Omnichannel e IA • Documento Oficial e Confidencial', 36, 804);
                    doc.fillColor('#64748b').fontSize(7).font('Helvetica-Bold')
                       .text(`Pagina ${p + 1} de ${pages.count}`, 36, 804, { width: contentWidth, align: 'right' });
                }

                doc.end();
            } catch (err) {
                reject(err);
            }
        });
    }

    formatDuration(seconds) {
        if (!seconds || seconds <= 0) return '0 min';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        if (mins >= 60) {
            const hours = Math.floor(mins / 60);
            const remMins = mins % 60;
            return `${hours}h ${remMins}m`;
        }
        return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
    }
}

module.exports = new ReportService();
