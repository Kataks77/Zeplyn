import React, { useState, useEffect, useRef } from 'react';
import { Send, RefreshCw, X } from 'lucide-react';

export default function FlowSimulator({ nodes = [], edges = [], onClose }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [currentNodeId, setCurrentNodeId] = useState(null);
  const [waitingForInput, setWaitingForInput] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = useRef(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const [simVariables, setSimVariables] = useState({
    nome: 'Cliente',
    telefone: '5511999998888',
    data: new Date().toLocaleDateString('pt-BR'),
    hora: new Date().toLocaleTimeString('pt-BR')
  });

  const interpolate = (text, vars = simVariables) => {
    if (!text) return '';
    let res = String(text);
    for (const [k, v] of Object.entries(vars)) {
      res = res.replace(new RegExp(`{{\\s*${k}\\s*}}`, 'gi'), v || '');
    }
    return res;
  };

  // Iniciar simulação
  const startSimulation = () => {
    setMessages([]);
    setCurrentNodeId(null);
    setWaitingForInput(false);
    setIsTyping(false);
    const initialVars = {
      nome: 'Cliente',
      telefone: '5511999998888',
      data: new Date().toLocaleDateString('pt-BR'),
      hora: new Date().toLocaleTimeString('pt-BR')
    };
    setSimVariables(initialVars);

    const startNode = nodes.find(n => n.type === 'start') || nodes[0];
    if (!startNode) {
      setMessages([{
        sender: 'system',
        text: 'Nenhum bloco de início encontrado no fluxo. Adicione um bloco "Início".'
      }]);
      return;
    }

    setMessages([{
      sender: 'system',
      text: 'Simulação iniciada. O cliente enviou a primeira mensagem.'
    }]);

    // Executa a partir da saída do start
    executeFromNode(startNode.id, null, initialVars);
  };

  useEffect(() => {
    startSimulation();
  }, [nodes, edges]);

  const executeFromNode = async (fromId, userInput = null, currentVars = simVariables) => {
    let currentId = fromId;
    const visited = new Set();
    let vars = { ...currentVars };

    while (currentId) {
      if (visited.has(currentId)) break;
      visited.add(currentId);

      const node = nodes.find(n => n.id === currentId);
      if (!node) break;

      if (node.type === 'start') {
        const edge = edges.find(e => e.source === node.id);
        if (edge && edge.target) {
          currentId = edge.target;
          continue;
        }
        break;
      }

      // Nó MENSAGEM
      if (node.type === 'message') {
        const text = interpolate(node.data?.text || '', vars);
        if (text) {
          setMessages(prev => [...prev, { sender: 'bot', text, time: new Date().toLocaleTimeString('pt-BR') }]);
        }
        const edge = edges.find(e => e.source === node.id);
        if (edge && edge.target) {
          currentId = edge.target;
          continue;
        } else {
          setMessages(prev => [...prev, { sender: 'system', text: '🏁 Fim do fluxo.' }]);
          return;
        }
      }

      // Nó COLETA DE DADOS (Input)
      if (node.type === 'input') {
        const question = interpolate(node.data?.question || 'Por favor, digite sua resposta:', vars);
        setMessages(prev => [...prev, {
          sender: 'bot',
          text: question,
          time: new Date().toLocaleTimeString('pt-BR')
        }]);
        setCurrentNodeId(node.id);
        setWaitingForInput(true);
        return;
      }

      // Nó MENU
      if (node.type === 'menu') {
        const question = interpolate(node.data?.question || 'Como posso te ajudar hoje?', vars);
        const options = node.data?.options || [];
        
        setMessages(prev => [...prev, {
          sender: 'bot',
          isMenu: true,
          nodeId: node.id,
          text: question,
          options,
          time: new Date().toLocaleTimeString('pt-BR')
        }]);

        setCurrentNodeId(node.id);
        setWaitingForInput(true);
        return;
      }

      // Nó AÇÃO NO CONTATO (Tags / Kanban)
      if (node.type === 'action') {
        const actionType = node.data?.actionType || 'add_tag';
        let actionDesc = '';
        if (actionType === 'add_tag') {
          actionDesc = `🏷️ CRM: Tag "${node.data?.tagValue || 'Nova Tag'}" adicionada ao contato.`;
        } else if (actionType === 'remove_tag') {
          actionDesc = `🏷️ CRM: Tag "${node.data?.tagValue || 'Tag'}" removida do contato.`;
        } else if (actionType === 'set_status') {
          actionDesc = `📋 CRM: Contato movido no Kanban para "${node.data?.statusValue || 'open'}".`;
        }
        setMessages(prev => [...prev, { sender: 'system', text: actionDesc }]);

        const edge = edges.find(e => e.source === node.id);
        if (edge && edge.target) {
          currentId = edge.target;
          continue;
        } else {
          setMessages(prev => [...prev, { sender: 'system', text: '🏁 Fim do fluxo após ação no CRM.' }]);
          return;
        }
      }

      // Nó WEBHOOK / REQUISIÇÃO EXTERNA
      if (node.type === 'webhook') {
        const method = node.data?.method || 'POST';
        const url = interpolate(node.data?.url || 'https://api.exemplo.com/webhook', vars);
        setMessages(prev => [...prev, { 
          sender: 'system', 
          text: `🌐 Webhook [${method}]: Chamada disparada para ${url}` 
        }]);

        const edge = edges.find(e => e.source === node.id);
        if (edge && edge.target) {
          currentId = edge.target;
          continue;
        } else {
          setMessages(prev => [...prev, { sender: 'system', text: '🏁 Fim do fluxo após Webhook.' }]);
          return;
        }
      }

      // Nó HORÁRIO DE EXPEDIENTE
      if (node.type === 'business_hours') {
        setMessages(prev => [...prev, { 
          sender: 'system', 
          text: `⏰ Horário Comercial: Simulado como "Dentro do Expediente".` 
        }]);
        // Tenta aresta "inside" ou primeira conectada
        const edge = edges.find(e => e.source === node.id && e.sourceHandle === 'inside') || edges.find(e => e.source === node.id);
        if (edge && edge.target) {
          currentId = edge.target;
          continue;
        } else {
          setMessages(prev => [...prev, { sender: 'system', text: '🏁 Fim do fluxo de horário.' }]);
          return;
        }
      }

      // Nó IA
      if (node.type === 'ai') {
        setIsTyping(true);
        await new Promise(r => setTimeout(r, 1000));
        setIsTyping(false);
        setMessages(prev => [...prev, {
          sender: 'bot',
          text: `[Resposta simulada da IA]: Entendi sua pergunta! Estou consultando a base de dados do bot para te ajudar.`,
          time: new Date().toLocaleTimeString('pt-BR')
        }]);
        setCurrentNodeId(node.id);
        setWaitingForInput(true);
        return;
      }

      // Nó FIGURINHA OU MÍDIA
      if (node.type === 'sticker' || node.type === 'media') {
        const isAudio = node.data?.mediaType === 'audio_ptt';
        const isDoc = node.data?.mediaType === 'document';
        const url = node.data?.url || '';
        
        let mediaText = '';
        if (isAudio) {
          mediaText = `🎤 [Áudio Gravado na Hora (PTT) simulado: ${url || 'áudio_voz.ogg'}]`;
        } else if (isDoc) {
          mediaText = `📄 [Documento / PDF: ${node.data?.caption || ''} ${url || 'arquivo.pdf'}]`;
        } else if (node.type === 'sticker') {
          mediaText = `[Figurinha WhatsApp: ${url || 'sticker.webp'}]`;
        } else {
          mediaText = `🖼️ [Imagem: ${node.data?.caption || ''} ${url || 'foto.jpg'}]`;
        }

        setMessages(prev => [...prev, {
          sender: 'bot',
          isSticker: node.type === 'sticker',
          url,
          text: mediaText,
          time: new Date().toLocaleTimeString('pt-BR')
        }]);

        const edge = edges.find(e => e.source === node.id);
        if (edge && edge.target) {
          currentId = edge.target;
          continue;
        } else {
          setMessages(prev => [...prev, { sender: 'system', text: '🏁 Fim do fluxo.' }]);
          return;
        }
      }

      // Nó TRANSFERIR HUMANO
      if (node.type === 'human') {
        const dept = (node.data?.department || '').trim();
        const defaultMsg = dept 
          ? `Estou transferindo seu atendimento para o setor de *${dept}*. Aguarde um instante! 🧑‍💻`
          : 'Estou transferindo para nossa equipe humana. Aguarde um instante! 🧑‍💻';
        const transferMsg = interpolate(node.data?.message || defaultMsg, vars);
        setMessages(prev => [...prev, {
          sender: 'bot',
          text: transferMsg,
          time: new Date().toLocaleTimeString('pt-BR')
        }, {
          sender: 'system',
          text: dept 
            ? `👤 Mini-URA: Conversa encaminhada para o departamento [${dept}] com etiqueta atribuída.`
            : '👤 Conversa transferida para a fila humana do Live Chat.'
        }]);
        setWaitingForInput(false);
        return;
      }

      // Nó DELAY
      if (node.type === 'delay') {
        const sec = node.data?.seconds || 2;
        setIsTyping(true);
        await new Promise(r => setTimeout(r, sec * 1000));
        setIsTyping(false);

        const edge = edges.find(e => e.source === node.id);
        if (edge && edge.target) {
          currentId = edge.target;
          continue;
        } else {
          setMessages(prev => [...prev, { sender: 'system', text: '🏁 Fim do fluxo.' }]);
          return;
        }
      }

      // Nó CONDIÇÃO
      if (node.type === 'condition') {
        const keywords = (node.data?.keywords || '').split(',').map(k => k.trim().toLowerCase()).filter(Boolean);
        const lowerInput = (userInput || '').toLowerCase();
        const matched = keywords.some(k => lowerInput.includes(k));

        const targetHandle = matched ? 'true' : 'false';
        const edge = edges.find(e => e.source === node.id && e.sourceHandle === targetHandle) ||
                     edges.find(e => e.source === node.id);

        if (edge && edge.target) {
          currentId = edge.target;
          continue;
        } else {
          setMessages(prev => [...prev, { sender: 'system', text: '🏁 Fim do fluxo da condição.' }]);
          return;
        }
      }

      break;
    }
  };

  const handleSend = async (customText = null) => {
    const textToSend = customText || input;
    if (!textToSend.trim()) return;

    const userMsg = {
      sender: 'user',
      text: textToSend,
      time: new Date().toLocaleTimeString('pt-BR')
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');

    // Se estiver aguardando input
    if (waitingForInput && currentNodeId) {
      const currentNode = nodes.find(n => n.id === currentNodeId);
      
      // Tratamento de Nó Input (Coleta de Dados com Validação)
      if (currentNode && currentNode.type === 'input') {
        const valType = currentNode.data?.validationType || 'none';
        let isValid = true;
        const clean = textToSend.trim();

        if (valType === 'email') {
          isValid = clean.includes('@') && clean.includes('.');
        } else if (valType === 'phone') {
          isValid = clean.replace(/\D/g, '').length >= 8;
        } else if (valType === 'cpf') {
          isValid = clean.replace(/\D/g, '').length >= 11;
        } else if (valType === 'number') {
          isValid = !isNaN(Number(clean.replace(/\D/g, '')));
        }

        if (!isValid) {
          setMessages(prev => [...prev, {
            sender: 'bot',
            text: currentNode.data?.errorMessage || '❌ Formato inválido. Por favor, verifique e digite novamente:',
            time: new Date().toLocaleTimeString('pt-BR')
          }]);
          return;
        }

        // Dado válido! Salva variável
        const varName = currentNode.data?.variableName || 'resposta';
        const updatedVars = { ...simVariables, [varName]: clean };
        setSimVariables(updatedVars);

        setMessages(prev => [...prev, {
          sender: 'system',
          text: `💾 Dado coletado: {{${varName}}} = "${clean}"`
        }]);

        const nextEdge = edges.find(e => e.source === currentNode.id);
        if (nextEdge && nextEdge.target) {
          setWaitingForInput(false);
          executeFromNode(nextEdge.target, textToSend, updatedVars);
          return;
        } else {
          setWaitingForInput(false);
          setMessages(prev => [...prev, { sender: 'system', text: '🏁 Fim do fluxo após coleta.' }]);
          return;
        }
      }

      // Tratamento de Nó Menu
      if (currentNode && currentNode.type === 'menu') {
        const options = currentNode.data?.options || [];
        const num = parseInt(textToSend.trim(), 10);
        let matchedIndex = -1;

        if (!isNaN(num) && num >= 1 && num <= options.length) {
          matchedIndex = num - 1;
        } else {
          matchedIndex = options.findIndex(opt => {
            const optText = (opt.text || '').toLowerCase();
            return optText && textToSend.toLowerCase().includes(optText);
          });
        }

        if (matchedIndex >= 0) {
          const targetHandle = `option-${matchedIndex}`;
          let edge = edges.find(e => e.source === currentNode.id && e.sourceHandle === targetHandle);
          if (!edge) {
            const outgoing = edges.filter(e => e.source === currentNode.id);
            edge = outgoing[matchedIndex];
          }

          if (edge && edge.target) {
            setWaitingForInput(false);
            executeFromNode(edge.target, textToSend, simVariables);
            return;
          } else {
            setMessages(prev => [...prev, {
              sender: 'system',
              text: `Opção selecionada: "${options[matchedIndex].text}". Nenhuma conexão saindo desta opção.`
            }]);
            return;
          }
        } else {
          setMessages(prev => [...prev, {
            sender: 'bot',
            text: '❌ Opção inválida na simulação. Digite o número da opção.',
            time: new Date().toLocaleTimeString('pt-BR')
          }]);
          return;
        }
      }
    }

    // Se usuário digitou reset
    if (['inicio', 'menu', 'voltar', '0'].includes(textToSend.toLowerCase().trim())) {
      startSimulation();
    }
  };

  return (
    <div style={{
      width: '340px',
      background: '#0f172a',
      borderLeft: '1px solid #1e293b',
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      fontFamily: 'inherit'
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid #1e293b',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: '#1e293b'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }} />
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#f8fafc' }}>
            Testador do Fluxo
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            onClick={startSimulation}
            title="Reiniciar Simulação"
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: '4px',
              borderRadius: '4px',
              display: 'flex'
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = '#38bdf8'}
            onMouseLeave={(e) => e.currentTarget.style.color = '#94a3b8'}
          >
            <RefreshCw size={14} />
          </button>
          <button
            onClick={onClose}
            title="Fechar Simulação"
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: '4px',
              borderRadius: '4px',
              display: 'flex'
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = '#ef4444'}
            onMouseLeave={(e) => e.currentTarget.style.color = '#94a3b8'}
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Messages List */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '14px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px'
      }}>
        {messages.map((m, idx) => {
          if (m.sender === 'system') {
            return (
              <div key={idx} style={{
                fontSize: '11px',
                color: '#64748b',
                background: 'rgba(30, 41, 59, 0.5)',
                border: '1px dashed #334155',
                borderRadius: '6px',
                padding: '6px 10px',
                textAlign: 'center'
              }}>
                {m.text}
              </div>
            );
          }

          const isBot = m.sender === 'bot';

          return (
            <div
              key={idx}
              style={{
                alignSelf: isBot ? 'flex-start' : 'flex-end',
                maxWidth: '85%',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px'
              }}
            >
              <div style={{
                background: isBot ? '#1e293b' : '#2563eb',
                border: isBot ? '1px solid #334155' : 'none',
                color: '#f8fafc',
                padding: '10px 12px',
                borderRadius: isBot ? '12px 12px 12px 2px' : '12px 12px 2px 12px',
                fontSize: '12px',
                lineHeight: '1.4',
                boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
              }}>
                {m.isSticker ? (
                  <div>
                    <div style={{ fontSize: '10px', color: '#fbbf24', marginBottom: '4px' }}>Figurinha:</div>
                    {m.url ? (
                      <img src={m.url} alt="Sticker" style={{ width: '80px', height: '80px', objectFit: 'contain' }} />
                    ) : (
                      <span>{m.text}</span>
                    )}
                  </div>
                ) : (
                  <div style={{ whiteSpace: 'pre-wrap' }}>{m.text}</div>
                )}

                {/* Se for menu, renderiza os botões clicáveis */}
                {m.isMenu && m.options && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
                    {m.options.map((opt, optIdx) => (
                      <button
                        key={optIdx}
                        onClick={() => handleSend(`${optIdx + 1}`)}
                        style={{
                          background: 'rgba(168, 85, 247, 0.2)',
                          border: '1px solid #a855f7',
                          color: '#d8b4fe',
                          padding: '6px 10px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          textAlign: 'left',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                      >
                        <span style={{ fontWeight: 700, color: '#c084fc' }}>{optIdx + 1}</span>
                        <span>{opt.text}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <span style={{
                fontSize: '9px',
                color: '#64748b',
                alignSelf: isBot ? 'flex-start' : 'flex-end',
                padding: '0 4px'
              }}>
                {m.time}
              </span>
            </div>
          );
        })}

        {isTyping && (
          <div style={{
            alignSelf: 'flex-start',
            background: '#1e293b',
            border: '1px solid #334155',
            padding: '6px 12px',
            borderRadius: '12px',
            fontSize: '11px',
            color: '#94a3b8',
            fontStyle: 'italic'
          }}>
            Digitando...
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Input bar */}
      <div style={{
        padding: '10px',
        borderTop: '1px solid #1e293b',
        background: '#1e293b',
        display: 'flex',
        gap: '6px'
      }}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSend(); }}
          placeholder="Digite como cliente..."
          style={{
            flex: 1,
            background: '#0f172a',
            border: '1px solid #334155',
            borderRadius: '6px',
            padding: '8px 10px',
            color: '#f8fafc',
            fontSize: '12px',
            outline: 'none'
          }}
        />
        <button
          onClick={() => handleSend()}
          style={{
            background: '#2563eb',
            border: 'none',
            borderRadius: '6px',
            padding: '8px 12px',
            color: '#fff',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <Send size={14} />
        </button>
      </div>
    </div>
  );
}
