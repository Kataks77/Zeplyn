import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Bot, 
  Check, 
  Copy, 
  Trash2, 
  Plus, 
  ArrowUp, 
  ArrowDown, 
  Sparkles, 
  Layers, 
  Headphones, 
  User, 
  Brain, 
  MessageSquare, 
  Send, 
  RotateCcw, 
  Save, 
  AlertCircle, 
  CheckCircle2, 
  Smartphone, 
  Tag, 
  ChevronRight,
  Info,
  HelpCircle,
  Hash,
  Sliders,
  PhoneCall,
  Clock,
  Settings2,
  Edit3,
  ShieldCheck,
  Timer
} from 'lucide-react';
import { api } from '../../services/api';

// Setores sugeridos padrão caso a empresa queira selecionar rapidamente
const PRESET_SECTORS = [
  'Vendas',
  'Comercial',
  'Suporte Técnico',
  'Financeiro',
  'Cobrança',
  'Atendimento / SAC',
  'Administrativo',
  'Recepção',
  'Recursos Humanos'
];

// Modelos pré-configurados para carregamento rápido em 1 clique
const PRESET_TEMPLATES = {
  exata_padrao: {
    name: 'Exata (Corporativo: Suporte, Vendas & Financeiro)',
    companyName: 'Exata',
    welcomeMessage: 'Olá, {{nome}}! Seja muito bem-vindo(a) à *Exata*.\nÉ um prazer ter você aqui conosco! 😊',
    menuQuestion: 'Com quem você deseja falar hoje?',
    invalidMessage: '❌ Opção inválida. Por favor, digite o *número* correspondente à opção desejada, ou digite *menu* para reiniciar.',
    options: [
      {
        id: 'opt-1',
        title: 'Suporte Técnico',
        actionType: 'department',
        department: 'Suporte',
        attendantId: '',
        message: 'Perfeito, {{nome}}! Estou transferindo seu atendimento para nossa equipe de *Suporte Técnico*. Um instante! 🛠️',
        tag: 'Suporte'
      },
      {
        id: 'opt-2',
        title: 'Comercial & Vendas',
        actionType: 'department',
        department: 'Vendas',
        attendantId: '',
        message: 'Excelente! Estou transferindo você para nosso setor *Comercial*. Um consultor já vai te atender! 📈',
        tag: 'Comercial'
      },
      {
        id: 'opt-3',
        title: 'Financeiro & Cobrança',
        actionType: 'department',
        department: 'Financeiro',
        attendantId: '',
        message: 'Transferindo para o setor *Financeiro*. Por favor, informe seu CPF ou CNPJ cadastrado. 💳',
        tag: 'Financeiro'
      },
      {
        id: 'opt-4',
        title: 'Tirar dúvidas com Inteligência Artificial',
        actionType: 'ai',
        department: '',
        attendantId: '',
        message: 'Nossa Inteligência Artificial está pronta para te atender. O que você gostaria de saber? 🤖',
        tag: 'Atendido por IA'
      }
    ]
  },
  clinica: {
    name: 'Clínica & Consultório Médico',
    companyName: 'Clínica Bem Estar',
    welcomeMessage: 'Olá, {{nome}}! Bem-vindo(a) à *Clínica Bem Estar*.\nCuidar de você é a nossa prioridade! 🩺',
    menuQuestion: 'Como podemos te ajudar hoje?',
    invalidMessage: '❌ Opção inválida. Por favor, digite apenas o número desejado.',
    options: [
      {
        id: 'opt-1',
        title: 'Agendamento e Cancelamento de Consultas',
        actionType: 'department',
        department: 'Agendamentos',
        attendantId: '',
        message: 'Transferindo você para nossa central de *Agendamentos*. Um momento! 📅',
        tag: 'Agendamento'
      },
      {
        id: 'opt-2',
        title: 'Resultados de Exames',
        actionType: 'department',
        department: 'Exames',
        attendantId: '',
        message: 'Transferindo para o setor de *Exames e Laudos*. Tenha seu protocolo em mãos. 🔬',
        tag: 'Exames'
      },
      {
        id: 'opt-3',
        title: 'Informações de Convênios e Horários',
        actionType: 'message',
        department: '',
        attendantId: '',
        message: '🏥 *Horário de Atendimento:* Segunda a Sexta das 07h às 19h.\nAceitamos Unimed, Bradesco Saúde, Amil e SulAmérica.\nPara agendar, digite *1*!',
        tag: 'Dúvidas'
      },
      {
        id: 'opt-4',
        title: 'Falar com a Recepção',
        actionType: 'department',
        department: 'Recepção',
        attendantId: '',
        message: 'Chamando a recepcionista para falar com você! 👩‍⚕️',
        tag: 'Recepção'
      }
    ]
  },
  imobiliaria: {
    name: 'Imobiliária & Locação',
    companyName: 'Imóveis & Cia',
    welcomeMessage: 'Olá, {{nome}}! Seja bem-vindo(a) à *Imóveis & Cia*.\nEncontre o imóvel dos seus sonhos aqui! 🏠',
    menuQuestion: 'Selecione o setor que deseja falar:',
    invalidMessage: '❌ Opção inválida. Por favor, digite o número da opção desejada.',
    options: [
      {
        id: 'opt-1',
        title: 'Quero Comprar um Imóvel',
        actionType: 'department',
        department: 'Vendas',
        attendantId: '',
        message: 'Um de nossos corretores especialistas em *Vendas* já vai te atender! 🔑',
        tag: 'Interesse Compra'
      },
      {
        id: 'opt-2',
        title: 'Quero Alugar um Imóvel',
        actionType: 'department',
        department: 'Locação',
        attendantId: '',
        message: 'Conectando você ao setor de *Locação Residencial e Comercial*! 🏢',
        tag: 'Interesse Aluguel'
      },
      {
        id: 'opt-3',
        title: '2ª Via de Boleto / Financeiro',
        actionType: 'department',
        department: 'Financeiro',
        attendantId: '',
        message: 'Transferindo para o *Financeiro*. Envie por gentileza seu CPF ou código do imóvel. 📄',
        tag: 'Financeiro'
      }
    ]
  }
};

export const DEFAULT_FALLBACK_CONFIG = {
  enabled: true,
  message: 'Nossos consultores do setor *{{setor}}* não estão disponíveis no momento. Estamos transferindo você para a nossa equipe de plantão! 🧑‍💻'
};

export const DEFAULT_TIMEOUT_CONFIG = {
  enabled: true,
  reminderMinutes: 5,
  reminderMessage: 'Olá, {{nome}}! Ainda está aí? 😊\nPor favor, digite o *número* da opção desejada acima para continuarmos seu atendimento.',
  autoCloseEnabled: true,
  closeMinutes: 15,
  closeMessage: 'Seu atendimento foi finalizado por inatividade. Quando precisar de algo, basta nos enviar uma nova mensagem! Tenha um excelente dia! 👋'
};

/**
 * Converte a configuração amigável da URA para o grafo de nós e arestas (flowData)
 * que o FlowService.js e o WhatsAppService.js executam no WhatsApp
 */
export function buildFlowDataFromMenu(menuConfig, botName = 'Assistente') {
  const nodes = [];
  const edges = [];

  // 1. Nó de Início
  nodes.push({
    id: 'node-start',
    type: 'start',
    position: { x: 50, y: 220 },
    data: {}
  });

  // 2. Nó de Boas-Vindas
  const welcomeText = (menuConfig.welcomeMessage || 'Olá, {{nome}}! Seja bem-vindo(a).').trim();
  nodes.push({
    id: 'node-msg-welcome',
    type: 'message',
    position: { x: 280, y: 220 },
    data: {
      text: welcomeText
    }
  });

  edges.push({
    id: 'e-start-welcome',
    source: 'node-start',
    sourceHandle: 'output',
    target: 'node-msg-welcome',
    targetHandle: 'input',
    animated: true,
    style: { stroke: '#10b981', strokeWidth: 2 }
  });

  // 3. Nó de Menu / URA
  const menuOptions = (menuConfig.options || []).map((opt, idx) => ({
    id: `option-${idx}`,
    text: opt.title || `Opção ${idx + 1}`
  }));

  nodes.push({
    id: 'node-menu-ura',
    type: 'menu',
    position: { x: 620, y: 220 },
    data: {
      question: (menuConfig.menuQuestion || 'Com quem deseja falar?').trim(),
      invalidMessage: (menuConfig.invalidMessage || '❌ Opção inválida. Por favor, digite o número correspondente.').trim(),
      options: menuOptions
    }
  });

  edges.push({
    id: 'e-welcome-menu',
    source: 'node-msg-welcome',
    sourceHandle: 'output',
    target: 'node-menu-ura',
    targetHandle: 'input',
    animated: true,
    style: { stroke: '#3b82f6', strokeWidth: 2 }
  });

  // 4. Nós de Destino para cada Opção
  const baseY = Math.max(80, 220 - ((menuConfig.options.length - 1) * 70));

  menuConfig.options.forEach((opt, idx) => {
    const yPos = baseY + (idx * 140);
    const destNodeId = `node-dest-${idx}`;
    const handleId = `option-${idx}`;

    if (opt.actionType === 'ai') {
      nodes.push({
        id: destNodeId,
        type: 'ai',
        position: { x: 1040, y: yPos },
        data: {
          customPrompt: `Você é o atendente virtual da empresa ${menuConfig.companyName || botName}. Responda o cliente de forma amigável, educada e prestativa.`
        }
      });
    } else if (opt.actionType === 'message') {
      nodes.push({
        id: destNodeId,
        type: 'message',
        position: { x: 1040, y: yPos },
        data: {
          text: opt.message || 'Obrigado pelo contato! Se precisar de algo mais, digite *menu*.'
        }
      });
    } else {
      // department ou attendant
      const deptName = opt.department || (opt.actionType === 'attendant' ? (opt.attendantName || 'Atendente') : 'Geral');
      const defaultTransfer = `Perfeito, {{nome}}! Estou transferindo você para nosso setor de *${deptName}*. Aguarde um instante! 🧑‍💻`;
      nodes.push({
        id: destNodeId,
        type: 'human',
        position: { x: 1040, y: yPos },
        data: {
          department: deptName,
          attendantId: opt.attendantId || null,
          message: (opt.message || defaultTransfer).trim()
        }
      });
    }

    edges.push({
      id: `e-menu-${handleId}`,
      source: 'node-menu-ura',
      sourceHandle: handleId,
      target: destNodeId,
      targetHandle: 'input',
      animated: true,
      style: { stroke: '#c084fc', strokeWidth: 2 }
    });
  });

  return {
    nodes,
    edges,
    menuConfig: {
      ...menuConfig,
      fallbackConfig: {
        ...DEFAULT_FALLBACK_CONFIG,
        ...(menuConfig.fallbackConfig || {})
      },
      timeoutConfig: {
        ...DEFAULT_TIMEOUT_CONFIG,
        ...(menuConfig.timeoutConfig || {})
      }
    }
  };
}

/**
 * Reconstrói ou extrai o menuConfig a partir do bot salvo
 */
export function extractMenuConfigFromBot(bot) {
  // 1. Se já tiver menuConfig salvo no flowData
  if (bot?.flowData?.menuConfig) {
    const raw = bot.flowData.menuConfig;
    return {
      ...raw,
      fallbackConfig: {
        ...DEFAULT_FALLBACK_CONFIG,
        ...(raw.fallbackConfig || {})
      },
      timeoutConfig: {
        ...DEFAULT_TIMEOUT_CONFIG,
        ...(raw.timeoutConfig || {})
      }
    };
  }

  // 2. Se tiver flowData legada com nós (ex: nó menu + nó message + nós human)
  if (bot?.flowData?.nodes && bot.flowData.nodes.length > 0) {
    const nodes = bot.flowData.nodes;
    const edges = bot.flowData.edges || [];

    const welcomeNode = nodes.find(n => n.type === 'message');
    const menuNode = nodes.find(n => n.type === 'menu');

    if (menuNode) {
      const rawOptions = menuNode.data?.options || [];
      const extractedOptions = rawOptions.map((opt, idx) => {
        const handleId = opt.id || `option-${idx}`;
        const edge = edges.find(e => e.source === menuNode.id && (e.sourceHandle === handleId || e.sourceHandle === `option-${idx}`));
        const targetNode = edge ? nodes.find(n => n.id === edge.target) : null;

        let actionType = 'department';
        let department = 'Geral';
        let attendantId = '';
        let message = '';
        let tag = '';

        if (targetNode) {
          if (targetNode.type === 'ai') {
            actionType = 'ai';
            message = 'Atendimento com Inteligência Artificial ativado.';
          } else if (targetNode.type === 'message') {
            actionType = 'message';
            message = targetNode.data?.text || '';
          } else if (targetNode.type === 'human') {
            actionType = 'department';
            department = targetNode.data?.department || 'Geral';
            attendantId = targetNode.data?.attendantId || '';
            message = targetNode.data?.message || '';
            tag = department;
          }
        }

        return {
          id: `opt-${idx + 1}`,
          title: opt.text || opt.label || `Opção ${idx + 1}`,
          actionType,
          department,
          attendantId,
          message,
          tag
        };
      });

      return {
        companyName: bot.name || 'Minha Empresa',
        welcomeMessage: welcomeNode?.data?.text || `Olá, {{nome}}! Seja muito bem-vindo(a) à *${bot.name || 'nossa empresa'}*!`,
        menuQuestion: menuNode.data?.question || 'Com quem você deseja falar hoje?',
        invalidMessage: menuNode.data?.invalidMessage || '❌ Opção inválida. Por favor, digite o número da opção desejada.',
        options: extractedOptions.length > 0 ? extractedOptions : PRESET_TEMPLATES.exata_padrao.options,
        fallbackConfig: DEFAULT_FALLBACK_CONFIG,
        timeoutConfig: DEFAULT_TIMEOUT_CONFIG
      };
    }
  }

  // 3. Padrão inicial Exata
  return {
    ...PRESET_TEMPLATES.exata_padrao,
    companyName: bot?.name || 'Exata',
    fallbackConfig: DEFAULT_FALLBACK_CONFIG,
    timeoutConfig: DEFAULT_TIMEOUT_CONFIG
  };
}

export default function CentralMenuBuilder({ bot, onUpdateBot }) {
  // Estado de configuração do Menu
  const [menuConfig, setMenuConfig] = useState(() => extractMenuConfigFromBot(bot));
  const [flowEnabled, setFlowEnabled] = useState(bot?.flowEnabled !== false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  // Dados auxiliares para seleção
  const [departments, setDepartments] = useState([]);
  const [attendants, setAttendants] = useState([]);
  const [existingTags, setExistingTags] = useState([]);
  const [loadingDepts, setLoadingDepts] = useState(false);
  const [manualDeptMode, setManualDeptMode] = useState({});

  // Estados do Simulador Interativo do WhatsApp
  const [simMessages, setSimMessages] = useState([]);
  const [simInput, setSimInput] = useState('');
  const [simTyping, setSimTyping] = useState(false);
  const simChatEndRef = useRef(null);

  // Recarregar quando o bot mudar
  useEffect(() => {
    if (bot) {
      setMenuConfig(extractMenuConfigFromBot(bot));
      setFlowEnabled(bot.flowEnabled !== false);
      resetSimulator(extractMenuConfigFromBot(bot));
    }
  }, [bot?.id]);

  // Carregar Departamentos/Setores da Empresa, Atendentes e Tags do sistema
  useEffect(() => {
    async function loadAuxiliaryData() {
      try {
        setLoadingDepts(true);
        let companyId = bot?.companyId || bot?.company_id || '';
        if (!companyId) {
          try {
            const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
            companyId = storedUser?.companyId || '';
          } catch {}
        }

        const [deptsRes, rolesRes, attendantsRes, tagsRes] = await Promise.allSettled([
          api.getCompanyDepartments?.(companyId),
          api.getRoles?.(companyId),
          api.getAttendants?.(companyId),
          api.getUserTags?.()
        ]);

        const deptsMap = new Map();

        // 1. Do endpoint dedicado de setores vinculados à empresa
        if (deptsRes.status === 'fulfilled' && Array.isArray(deptsRes.value)) {
          deptsRes.value.forEach(d => {
            const name = typeof d === 'string' ? d : d.name;
            const count = typeof d === 'object' ? (d.attendantCount || 0) : 0;
            if (name && name.trim()) {
              deptsMap.set(name.trim(), { name: name.trim(), attendantCount: count });
            }
          });
        }

        // 2. Dos cargos e setores cadastrados da empresa (campo department)
        if (rolesRes.status === 'fulfilled' && Array.isArray(rolesRes.value)) {
          rolesRes.value.forEach(r => {
            if (r.department && r.department.trim()) {
              const dName = r.department.trim();
              if (!deptsMap.has(dName)) {
                deptsMap.set(dName, { name: dName, attendantCount: 0 });
              }
            }
          });
        }

        // 3. Dos atendentes da empresa (campo department)
        if (attendantsRes.status === 'fulfilled' && Array.isArray(attendantsRes.value)) {
          setAttendants(attendantsRes.value);
          attendantsRes.value.forEach(a => {
            if (a.department && a.department.trim()) {
              const dName = a.department.trim();
              const existing = deptsMap.get(dName);
              if (existing) {
                existing.attendantCount = Math.max(existing.attendantCount || 0, 1);
              } else {
                deptsMap.set(dName, { name: dName, attendantCount: 1 });
              }
            }
          });
        }

        // Se a empresa ainda não tiver nenhum setor cadastrado no banco, fornece padrões operacionais
        if (deptsMap.size === 0) {
          ['Vendas', 'Suporte Técnico', 'Financeiro / Cobrança', 'Comercial', 'Atendimento / SAC', 'Administrativo'].forEach(d => {
            deptsMap.set(d, { name: d, attendantCount: 0 });
          });
        }

        setDepartments(Array.from(deptsMap.values()));

        if (tagsRes.status === 'fulfilled' && Array.isArray(tagsRes.value)) {
          setExistingTags(tagsRes.value.map(t => t.name || t));
        }
      } catch (err) {
        console.warn('Aviso ao carregar dados auxiliares:', err);
      } finally {
        setLoadingDepts(false);
      }
    }
    loadAuxiliaryData();
  }, [bot?.id, bot?.companyId]);

  // Formata o texto final do menu do WhatsApp para exibição no simulador
  const formattedMenuText = useMemo(() => {
    let txt = '';
    if (menuConfig.welcomeMessage) {
      txt += `${menuConfig.welcomeMessage}\n\n`;
    }
    if (menuConfig.menuQuestion) {
      txt += `*${menuConfig.menuQuestion}*\n\n`;
    }
    (menuConfig.options || []).forEach((opt, idx) => {
      txt += `${idx + 1}️⃣ ${opt.title || `Opção ${idx + 1}`}\n`;
    });
    txt += `\n💬 _Digite o número da opção desejada_`;
    return txt.replace(/{{nome}}/g, 'João').replace(/{{empresa}}/g, menuConfig.companyName || 'Exata');
  }, [menuConfig]);

  // Inicializa o simulador com a mensagem de abertura do WhatsApp
  const resetSimulator = (currentCfg = menuConfig) => {
    let welcome = '';
    if (currentCfg.welcomeMessage) {
      welcome += `${currentCfg.welcomeMessage}\n\n`;
    }
    if (currentCfg.menuQuestion) {
      welcome += `*${currentCfg.menuQuestion}*\n\n`;
    }
    (currentCfg.options || []).forEach((opt, idx) => {
      welcome += `${idx + 1}️⃣ ${opt.title || `Opção ${idx + 1}`}\n`;
    });
    welcome += `\n💬 _Digite o número da opção desejada_`;

    setSimMessages([
      {
        id: 'msg-client-init',
        sender: 'user',
        text: 'Olá, bom dia!',
        time: 'Agora'
      },
      {
        id: 'msg-bot-menu',
        sender: 'bot',
        text: welcome.replace(/{{nome}}/g, 'João').replace(/{{empresa}}/g, currentCfg.companyName || 'Exata'),
        time: 'Agora'
      }
    ]);
    setSimInput('');
    setSimTyping(false);
  };

  useEffect(() => {
    resetSimulator();
  }, [menuConfig.welcomeMessage, menuConfig.menuQuestion, menuConfig.companyName, menuConfig.options.length]);

  useEffect(() => {
    simChatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [simMessages, simTyping]);

  // Manipulação de Opções
  const handleAddOption = () => {
    const nextIdx = menuConfig.options.length + 1;
    const defaultDept = departments.length > 0 ? departments[0].name : 'Suporte';
    const newOption = {
      id: `opt-${Date.now().toString(36)}`,
      title: `Novo Departamento / Opção ${nextIdx}`,
      actionType: 'department',
      department: defaultDept,
      attendantId: '',
      message: `Aguarde um instante, {{nome}}. Transferindo para nosso setor de *${defaultDept}*! 🧑‍💻`,
      tag: defaultDept
    };
    setMenuConfig(prev => ({
      ...prev,
      options: [...prev.options, newOption]
    }));
  };

  const handleUpdateOption = (index, field, value) => {
    setMenuConfig(prev => {
      const newOpts = [...prev.options];
      newOpts[index] = { ...newOpts[index], [field]: value };
      return { ...prev, options: newOpts };
    });
  };

  const handleRemoveOption = (index) => {
    if (menuConfig.options.length <= 1) {
      alert('O menu precisa ter pelo menos 1 opção de atendimento.');
      return;
    }
    setMenuConfig(prev => ({
      ...prev,
      options: prev.options.filter((_, i) => i !== index)
    }));
  };

  const handleMoveOption = (index, direction) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= menuConfig.options.length) return;

    setMenuConfig(prev => {
      const newOpts = [...prev.options];
      const temp = newOpts[index];
      newOpts[index] = newOpts[targetIndex];
      newOpts[targetIndex] = temp;
      return { ...prev, options: newOpts };
    });
  };

  const handleApplyPreset = (presetKey) => {
    const preset = PRESET_TEMPLATES[presetKey];
    if (!preset) return;
    if (window.confirm(`Deseja carregar o modelo "${preset.name}"? As alterações não salvas serão substituídas.`)) {
      setMenuConfig({
        ...preset,
        companyName: preset.companyName || bot?.name || 'Exata'
      });
    }
  };

  // Enviar Mensagem no Simulador do WhatsApp
  const handleSimSubmit = (e) => {
    e?.preventDefault();
    const clean = simInput.trim();
    if (!clean || simTyping) return;

    // Adiciona fala do usuário
    const userMsg = {
      id: `usr-${Date.now()}`,
      sender: 'user',
      text: clean,
      time: 'Agora'
    };
    setSimMessages(prev => [...prev, userMsg]);
    setSimInput('');
    setSimTyping(true);

    // Resposta do Robô
    setTimeout(() => {
      setSimTyping(false);
      const lower = clean.toLowerCase();

      // Comandos de Reinício
      if (['menu', 'voltar', 'inicio', 'início', '0'].includes(lower)) {
        setSimMessages(prev => [
          ...prev,
          {
            id: `bot-${Date.now()}`,
            sender: 'bot',
            text: formattedMenuText,
            time: 'Agora'
          }
        ]);
        return;
      }

      // Tenta casar por número digitado (1, 2, 3...)
      const num = parseInt(clean, 10);
      let matchedOpt = null;
      if (!isNaN(num) && num >= 1 && num <= menuConfig.options.length) {
        matchedOpt = menuConfig.options[num - 1];
      } else {
        // Tenta casar por título
        matchedOpt = menuConfig.options.find(opt => 
          opt.title.toLowerCase().includes(lower) || lower.includes(opt.title.toLowerCase())
        );
      }

      if (matchedOpt) {
        let reply = matchedOpt.message;
        if (!reply) {
          if (matchedOpt.actionType === 'ai') {
            reply = 'Olá! Sou a Inteligência Artificial. Como posso esclarecer sua dúvida? 🤖';
          } else {
            const dest = matchedOpt.department || 'nosso setor responsável';
            reply = `Transferindo seu chamado para o setor de *${dest}*. Aguarde um momento! 🧑‍💻`;
          }
        }
        reply = reply.replace(/{{nome}}/g, 'João').replace(/{{empresa}}/g, menuConfig.companyName || 'Exata');

        setSimMessages(prev => [
          ...prev,
          {
            id: `bot-${Date.now()}`,
            sender: 'bot',
            text: reply,
            time: 'Agora'
          }
        ]);
      } else {
        // Opção inválida
        const errReply = (menuConfig.invalidMessage || '❌ Opção inválida. Digite o número correspondente.').replace(/{{nome}}/g, 'João');
        setSimMessages(prev => [
          ...prev,
          {
            id: `bot-${Date.now()}`,
            sender: 'bot',
            text: errReply,
            time: 'Agora'
          }
        ]);
      }
    }, 700);
  };

  // Salvar no Backend / Bot
  const handleSave = async () => {
    if (!bot?.id) return;
    setSaving(true);
    setErrorMsg(null);
    setSaveSuccess(false);

    try {
      // 1. Gera a estrutura visual compatível com o backend
      const flowData = buildFlowDataFromMenu(menuConfig, bot.name);

      // 2. Salva no banco de dados via API
      await api.updateBot(bot.id, {
        flowEnabled,
        flowData
      });

      if (onUpdateBot) {
        onUpdateBot({
          ...bot,
          flowEnabled,
          flowData
        });
      }

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3500);
    } catch (err) {
      console.error('Erro ao salvar centralização de atendimentos:', err);
      setErrorMsg(err.message || 'Falha ao salvar configurações.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      backgroundColor: 'var(--bg-main)',
      overflow: 'hidden'
    }}>
      {/* BARRA SUPERIOR: Status, Modelos Prontos & Ação de Salvar */}
      <div style={{
        padding: '14px 24px',
        backgroundColor: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px',
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)'
          }}>
            <PhoneCall size={22} />
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
                Centralização de Atendimentos & Autoatendimento
              </h2>
              <span style={{
                fontSize: '0.72rem',
                fontWeight: 700,
                padding: '3px 8px',
                borderRadius: '6px',
                backgroundColor: flowEnabled ? 'rgba(16, 185, 129, 0.15)' : 'rgba(148, 163, 184, 0.15)',
                color: flowEnabled ? '#10b981' : 'var(--text-muted)',
                border: `1px solid ${flowEnabled ? 'rgba(16, 185, 129, 0.3)' : 'var(--border-subtle)'}`
              }}>
                {flowEnabled ? '● AUTOATENDIMENTO ATIVO' : '○ DESATIVADO'}
              </span>
            </div>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
              Configure a triagem inicial do WhatsApp com menus numéricos (1, 2, 3...) e direcione os clientes para os departamentos e atendentes.
            </p>
          </div>
        </div>

        {/* Lado Direito: Toggle Ativo, Carregar Modelos & Botão Salvar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          {/* Switch de Ativação do Menu */}
          <label style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            cursor: 'pointer',
            padding: '7px 12px',
            borderRadius: '8px',
            backgroundColor: 'var(--bg-main)',
            border: '1px solid var(--border-subtle)',
            fontSize: '0.84rem',
            fontWeight: 600,
            color: 'var(--text-main)',
            userSelect: 'none'
          }}>
            <input
              type="checkbox"
              checked={flowEnabled}
              onChange={(e) => setFlowEnabled(e.target.checked)}
              style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: '#10b981' }}
            />
            <span>Ativar no WhatsApp</span>
          </label>

          {/* Seletor de Modelos Rápidos */}
          <div style={{ position: 'relative' }}>
            <select
              onChange={(e) => {
                if (e.target.value) {
                  handleApplyPreset(e.target.value);
                  e.target.value = '';
                }
              }}
              defaultValue=""
              style={{
                backgroundColor: 'var(--bg-main)',
                color: 'var(--text-main)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '8px',
                padding: '8px 14px',
                fontSize: '0.84rem',
                fontWeight: 600,
                cursor: 'pointer',
                outline: 'none'
              }}
            >
              <option value="" disabled>⚡ Modelos Prontos...</option>
              <option value="exata_padrao">Exata (Suporte, Vendas, Financeiro & IA)</option>
              <option value="clinica">Clínica & Consultório Médico</option>
              <option value="imobiliaria">Imobiliária & Locação</option>
            </select>
          </div>

          {/* Botão de Salvar Alterações */}
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn btn-primary"
            style={{
              padding: '8px 20px',
              fontSize: '0.88rem',
              fontWeight: 700,
              gap: '8px',
              backgroundColor: saveSuccess ? '#10b981' : undefined,
              borderColor: saveSuccess ? '#10b981' : undefined,
              cursor: saving ? 'wait' : 'pointer'
            }}
          >
            {saving ? (
              <>Salvando...</>
            ) : saveSuccess ? (
              <><CheckCircle2 size={17} /> Salvo com Sucesso!</>
            ) : (
              <><Save size={17} /> Salvar Configuração</>
            )}
          </button>
        </div>
      </div>

      {/* FEEDBACK DE ERRO SE HOUVER */}
      {errorMsg && (
        <div style={{
          padding: '10px 24px',
          backgroundColor: '#ef4444',
          color: '#fff',
          fontSize: '0.85rem',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <AlertCircle size={16} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* CORPO PRINCIPAL COM 2 COLUNAS: CONFIGURAÇÃO À ESQUERDA | SIMULADOR WHATSAPP À DIREITA */}
      <div style={{
        flex: 1,
        minHeight: 0,
        display: 'grid',
        gridTemplateColumns: 'minmax(480px, 1fr) 420px',
        overflow: 'hidden'
      }}>
        {/* COLUNA ESQUERDA: FORMULÁRIO INTERATIVO */}
        <div style={{
          overflowY: 'auto',
          padding: '24px 28px',
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
          backgroundColor: 'var(--bg-main)'
        }}>
          {/* CARD 1: IDENTIFICAÇÃO & SAUDAÇÃO INICIAL */}
          <div className="card" style={{
            padding: '22px',
            borderRadius: '14px',
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-subtle)',
            boxShadow: '0 4px 16px rgba(0,0,0,0.06)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                backgroundColor: 'rgba(59, 130, 246, 0.12)',
                color: '#3b82f6',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <MessageSquare size={17} />
              </div>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
                1. Boas-Vindas & Saudação Inicial
              </h3>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
                  Nome de Exibição da Empresa / Negócio:
                </label>
                <input
                  type="text"
                  value={menuConfig.companyName}
                  onChange={(e) => setMenuConfig(prev => ({ ...prev, companyName: e.target.value }))}
                  placeholder="Ex: Exata Contabilidade, Zeplyn, etc."
                  style={{
                    width: '100%',
                    padding: '9px 14px',
                    borderRadius: '8px',
                    backgroundColor: 'var(--bg-main)',
                    color: 'var(--text-main)',
                    border: '1px solid var(--border-subtle)',
                    fontSize: '0.88rem',
                    outline: 'none'
                  }}
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                    Mensagem de Boas-Vindas:
                  </label>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Variáveis disponíveis: <code style={{ color: '#38bdf8' }}>{`{{nome}}`}</code>, <code style={{ color: '#38bdf8' }}>{`{{empresa}}`}</code>
                  </span>
                </div>
                <textarea
                  rows={3}
                  value={menuConfig.welcomeMessage}
                  onChange={(e) => setMenuConfig(prev => ({ ...prev, welcomeMessage: e.target.value }))}
                  placeholder="Ex: Olá, {{nome}}! Seja muito bem-vindo(a) à Exata."
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    backgroundColor: 'var(--bg-main)',
                    color: 'var(--text-main)',
                    border: '1px solid var(--border-subtle)',
                    fontSize: '0.88rem',
                    lineHeight: '1.5',
                    outline: 'none',
                    resize: 'vertical'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
                  Chamada / Pergunta do Menu:
                </label>
                <input
                  type="text"
                  value={menuConfig.menuQuestion}
                  onChange={(e) => setMenuConfig(prev => ({ ...prev, menuQuestion: e.target.value }))}
                  placeholder="Ex: Com quem deseja falar? ou Escolha uma das opções abaixo:"
                  style={{
                    width: '100%',
                    padding: '9px 14px',
                    borderRadius: '8px',
                    backgroundColor: 'var(--bg-main)',
                    color: 'var(--text-main)',
                    border: '1px solid var(--border-subtle)',
                    fontSize: '0.88rem',
                    outline: 'none'
                  }}
                />
              </div>
            </div>
          </div>

          {/* CARD 2: OPÇÕES NUMÉRICAS DO MENU (A URA INTERATIVA) */}
          <div className="card" style={{
            padding: '22px',
            borderRadius: '14px',
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-subtle)',
            boxShadow: '0 4px 16px rgba(0,0,0,0.06)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(16, 185, 129, 0.12)',
                  color: '#10b981',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Hash size={17} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
                    2. Opções do Menu (1, 2, 3...)
                  </h3>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>
                    O cliente digita o número e o sistema transfere na hora para a fila ou atendente.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleAddOption}
                className="btn btn-secondary"
                style={{
                  padding: '7px 14px',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  gap: '6px',
                  borderColor: 'rgba(16, 185, 129, 0.4)',
                  color: '#10b981',
                  backgroundColor: 'rgba(16, 185, 129, 0.08)'
                }}
              >
                <Plus size={16} /> Adicionar Nova Opção
              </button>
            </div>

            {/* LISTA DE OPÇÕES */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {menuConfig.options.map((opt, idx) => {
                const digitNum = idx + 1;
                return (
                  <div
                    key={opt.id || idx}
                    style={{
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '12px',
                      backgroundColor: 'var(--bg-main)',
                      padding: '16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '14px',
                      position: 'relative',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
                    }}
                  >
                    {/* Header do Card da Opção */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: '28px',
                          height: '28px',
                          borderRadius: '8px',
                          backgroundColor: '#10b981',
                          color: '#fff',
                          fontWeight: 800,
                          fontSize: '0.9rem',
                          flexShrink: 0
                        }}>
                          {digitNum}
                        </span>

                        <input
                          type="text"
                          value={opt.title}
                          onChange={(e) => handleUpdateOption(idx, 'title', e.target.value)}
                          placeholder={`Nome da opção ${digitNum} (Ex: Suporte Técnico)`}
                          style={{
                            flex: 1,
                            padding: '8px 12px',
                            borderRadius: '8px',
                            backgroundColor: 'var(--bg-secondary)',
                            color: 'var(--text-main)',
                            border: '1px solid var(--border-subtle)',
                            fontSize: '0.9rem',
                            fontWeight: 600,
                            outline: 'none'
                          }}
                        />
                      </div>

                      {/* Botões de Ação da Opção: Mover para cima/baixo, Excluir */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <button
                          type="button"
                          onClick={() => handleMoveOption(idx, -1)}
                          disabled={idx === 0}
                          className="btn-icon"
                          title="Mover para cima"
                          style={{ width: '28px', height: '28px', opacity: idx === 0 ? 0.3 : 1 }}
                        >
                          <ArrowUp size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveOption(idx, 1)}
                          disabled={idx === menuConfig.options.length - 1}
                          className="btn-icon"
                          title="Mover para baixo"
                          style={{ width: '28px', height: '28px', opacity: idx === menuConfig.options.length - 1 ? 0.3 : 1 }}
                        >
                          <ArrowDown size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveOption(idx)}
                          className="btn-icon text-danger"
                          title="Excluir opção"
                          style={{ width: '28px', height: '28px', color: '#ef4444' }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    {/* Configuração de Ação / Destino */}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'minmax(200px, 1fr) minmax(200px, 1.2fr)',
                      gap: '12px',
                      alignItems: 'start'
                    }}>
                      {/* Tipo de Destino */}
                      <div>
                        <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '5px' }}>
                          Ação ao escolher esta opção:
                        </label>
                        <select
                          value={opt.actionType || 'department'}
                          onChange={(e) => handleUpdateOption(idx, 'actionType', e.target.value)}
                          style={{
                            width: '100%',
                            padding: '8px 10px',
                            borderRadius: '8px',
                            backgroundColor: 'var(--bg-secondary)',
                            color: 'var(--text-main)',
                            border: '1px solid var(--border-subtle)',
                            fontSize: '0.84rem',
                            fontWeight: 600,
                            outline: 'none',
                            cursor: 'pointer'
                          }}
                        >
                          <option value="department">🎧 Transferir para Departamento / Fila</option>
                          <option value="attendant">🧑‍💼 Transferir para Atendente Específico</option>
                          <option value="ai">🤖 Conectar com Robô / IA (OpenAI)</option>
                          <option value="message">💬 Responder com Mensagem Direta</option>
                        </select>
                      </div>

                      {/* Campo Específico do Destino: Departamento / Setor */}
                      {opt.actionType === 'department' && (
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '5px' }}>
                            <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                              Departamento / Setor de Destino:
                            </label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{
                                fontSize: '0.70rem',
                                color: departments.length > 0 ? '#10b981' : 'var(--text-muted)',
                                fontWeight: 600,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}>
                                <span style={{
                                  width: '6px',
                                  height: '6px',
                                  borderRadius: '50%',
                                  backgroundColor: departments.length > 0 ? '#10b981' : '#f59e0b',
                                  display: 'inline-block'
                                }}></span>
                                {loadingDepts ? 'Carregando setores...' : `${departments.length} setor${departments.length !== 1 ? 'es' : ''} da empresa`}
                              </span>
                              <button
                                type="button"
                                onClick={() => window.dispatchEvent(new CustomEvent('app:navigate', { detail: 'roles' }))}
                                title="Gerenciar Cargos e Setores da Empresa"
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: 'var(--primary)',
                                  fontSize: '0.70rem',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  padding: 0,
                                  textDecoration: 'underline'
                                }}
                              >
                                + Gerenciar
                              </button>
                            </div>
                          </div>

                          {manualDeptMode[idx] ? (
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <input
                                type="text"
                                value={opt.department || ''}
                                onChange={(e) => handleUpdateOption(idx, 'department', e.target.value)}
                                placeholder="Digite o nome do setor (ex: Suporte, Vendas, SAC)..."
                                autoFocus
                                style={{
                                  width: '100%',
                                  padding: '8px 10px',
                                  borderRadius: '8px',
                                  backgroundColor: 'var(--bg-secondary)',
                                  color: 'var(--text-main)',
                                  border: '1px solid var(--primary)',
                                  fontSize: '0.84rem',
                                  outline: 'none'
                                }}
                              />
                              <button
                                type="button"
                                onClick={() => setManualDeptMode(prev => ({ ...prev, [idx]: false }))}
                                title="Voltar para seleção de setores da empresa"
                                style={{
                                  padding: '8px 12px',
                                  borderRadius: '8px',
                                  backgroundColor: 'var(--bg-hover)',
                                  color: 'var(--text-main)',
                                  border: '1px solid var(--border-subtle)',
                                  fontSize: '0.78rem',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  whiteSpace: 'nowrap'
                                }}
                              >
                                📋 Lista
                              </button>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <select
                                value={opt.department || ''}
                                onChange={(e) => {
                                  if (e.target.value === '__custom__') {
                                    setManualDeptMode(prev => ({ ...prev, [idx]: true }));
                                  } else {
                                    handleUpdateOption(idx, 'department', e.target.value);
                                  }
                                }}
                                style={{
                                  width: '100%',
                                  padding: '8px 10px',
                                  borderRadius: '8px',
                                  backgroundColor: 'var(--bg-secondary)',
                                  color: 'var(--text-main)',
                                  border: '1px solid var(--border-subtle)',
                                  fontSize: '0.84rem',
                                  fontWeight: 600,
                                  outline: 'none',
                                  cursor: 'pointer'
                                }}
                              >
                                <option value="" disabled>Selecione um setor da empresa...</option>
                                
                                {/* Setores reais vinculados à empresa */}
                                {departments.length > 0 && (
                                  <optgroup label="🏢 Setores Vinculados à Empresa">
                                    {departments.map((d, i) => (
                                      <option key={`dept-${i}`} value={d.name}>
                                        🏢 {d.name} {d.attendantCount > 0 ? `(${d.attendantCount} atendente${d.attendantCount > 1 ? 's' : ''})` : '(0 atendentes)'}
                                      </option>
                                    ))}
                                  </optgroup>
                                )}

                                {/* Se a opção atual já tiver um setor configurado que não esteja na lista de setores */}
                                {opt.department && !departments.some(d => d.name.toLowerCase() === opt.department.toLowerCase()) && (
                                  <optgroup label="📌 Setor Configurado Nesta Opção">
                                    <option value={opt.department}>
                                      🏢 {opt.department} (Configurado)
                                    </option>
                                  </optgroup>
                                )}

                                {/* Setores padrão / sugeridos caso a empresa ainda não tenha todos cadastrados */}
                                {PRESET_SECTORS.filter(s => 
                                  !departments.some(d => d.name.toLowerCase() === s.toLowerCase()) &&
                                  (!opt.department || opt.department.toLowerCase() !== s.toLowerCase())
                                ).length > 0 && (
                                  <optgroup label="💡 Outros Setores Comuns">
                                    {PRESET_SECTORS.filter(s => 
                                      !departments.some(d => d.name.toLowerCase() === s.toLowerCase()) &&
                                      (!opt.department || opt.department.toLowerCase() !== s.toLowerCase())
                                    ).map((s, i) => (
                                      <option key={`preset-${i}`} value={s}>
                                        💡 {s}
                                      </option>
                                    ))}
                                  </optgroup>
                                )}

                                <optgroup label="⚙️ Personalizado">
                                  <option value="__custom__">
                                    ✏️ Digitar outro setor manualmente...
                                  </option>
                                </optgroup>
                              </select>

                              <button
                                type="button"
                                onClick={() => setManualDeptMode(prev => ({ ...prev, [idx]: true }))}
                                title="Digitar nome de setor manualmente"
                                style={{
                                  padding: '8px 10px',
                                  borderRadius: '8px',
                                  backgroundColor: 'var(--bg-secondary)',
                                  color: 'var(--text-muted)',
                                  border: '1px solid var(--border-subtle)',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  transition: 'all 0.15s ease'
                                }}
                              >
                                <Edit3 size={15} />
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      {opt.actionType === 'attendant' && (
                        <div>
                          <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '5px' }}>
                            Atendente da Equipe:
                          </label>
                          <select
                            value={opt.attendantId || ''}
                            onChange={(e) => {
                              const selectedUser = attendants.find(a => String(a.id) === e.target.value);
                              handleUpdateOption(idx, 'attendantId', e.target.value);
                              if (selectedUser) {
                                handleUpdateOption(idx, 'attendantName', selectedUser.name);
                              }
                            }}
                            style={{
                              width: '100%',
                              padding: '8px 10px',
                              borderRadius: '8px',
                              backgroundColor: 'var(--bg-secondary)',
                              color: 'var(--text-main)',
                              border: '1px solid var(--border-subtle)',
                              fontSize: '0.84rem',
                              outline: 'none',
                              cursor: 'pointer'
                            }}
                          >
                            <option value="">Selecione um atendente...</option>
                            {attendants.map((att) => (
                              <option key={att.id} value={att.id}>
                                {att.name} ({att.email || att.role})
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {opt.actionType === 'ai' && (
                        <div>
                          <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '5px' }}>
                            Modo Inteligente:
                          </label>
                          <div style={{
                            padding: '8px 10px',
                            borderRadius: '8px',
                            backgroundColor: 'rgba(168, 85, 247, 0.1)',
                            border: '1px solid rgba(168, 85, 247, 0.25)',
                            color: '#c084fc',
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}>
                            <Brain size={15} /> A IA deste bot assumirá as respostas
                          </div>
                        </div>
                      )}

                      {opt.actionType === 'message' && (
                        <div>
                          <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '5px' }}>
                            Tipo:
                          </label>
                          <div style={{
                            padding: '8px 10px',
                            borderRadius: '8px',
                            backgroundColor: 'rgba(56, 189, 248, 0.1)',
                            border: '1px solid rgba(56, 189, 248, 0.25)',
                            color: '#38bdf8',
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}>
                            <MessageSquare size={15} /> Resposta Informativa Automática
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Mensagem de Transição / Resposta */}
                    <div>
                      <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '5px' }}>
                        Mensagem enviada ao cliente ao selecionar a opção {digitNum}:
                      </label>
                      <input
                        type="text"
                        value={opt.message}
                        onChange={(e) => handleUpdateOption(idx, 'message', e.target.value)}
                        placeholder="Ex: Transferindo você para o setor de Suporte. Um instante! 🧑‍💻"
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          borderRadius: '8px',
                          backgroundColor: 'var(--bg-secondary)',
                          color: 'var(--text-main)',
                          border: '1px solid var(--border-subtle)',
                          fontSize: '0.84rem',
                          outline: 'none'
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* CARD 3: OPÇÃO INVÁLIDA & COMANDOS DE REINÍCIO */}
          <div className="card" style={{
            padding: '20px 22px',
            borderRadius: '14px',
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-subtle)',
            boxShadow: '0 4px 16px rgba(0,0,0,0.06)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                backgroundColor: 'rgba(239, 68, 68, 0.12)',
                color: '#ef4444',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <AlertCircle size={17} />
              </div>
              <h3 style={{ fontSize: '0.96rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
                3. Respostas do Sistema & Opção Inválida
              </h3>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
                Mensagem quando o cliente digita um número inexistente ou opção inválida:
              </label>
              <input
                type="text"
                value={menuConfig.invalidMessage}
                onChange={(e) => setMenuConfig(prev => ({ ...prev, invalidMessage: e.target.value }))}
                placeholder="Ex: ❌ Opção inválida. Por favor, digite o número correspondente à opção desejada."
                style={{
                  width: '100%',
                  padding: '9px 14px',
                  borderRadius: '8px',
                  backgroundColor: 'var(--bg-main)',
                  color: 'var(--text-main)',
                  border: '1px solid var(--border-subtle)',
                  fontSize: '0.88rem',
                  outline: 'none'
                }}
              />
            </div>

            <div style={{
              marginTop: '14px',
              padding: '10px 14px',
              borderRadius: '8px',
              backgroundColor: 'rgba(56, 189, 248, 0.08)',
              border: '1px solid rgba(56, 189, 248, 0.2)',
              color: 'var(--text-muted)',
              fontSize: '0.8rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <Info size={16} style={{ color: '#38bdf8', flexShrink: 0 }} />
              <span>
                <strong>Dica:</strong> Se o cliente digitar <strong>"menu"</strong>, <strong>"voltar"</strong> ou <strong>"0"</strong> a qualquer momento, o sistema reenviará o menu inicial automaticamente!
              </span>
            </div>
          </div>

          {/* CARD 4: TRANSBORDO INTELIGENTE DE FILA (FALLBACK DA URA) */}
          <div className="card" style={{
            padding: '20px 22px',
            borderRadius: '14px',
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-subtle)',
            boxShadow: '0 4px 16px rgba(0,0,0,0.06)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(16, 185, 129, 0.12)',
                  color: '#10b981',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <ShieldCheck size={18} />
                </div>
                <div>
                  <h3 style={{ fontSize: '0.96rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
                    4. Transbordo Inteligente de Fila (Fallback)
                  </h3>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    Evita que o cliente fique preso em setores sem atendentes disponíveis
                  </span>
                </div>
              </div>

              {/* Toggle Habilitar Fallback */}
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                userSelect: 'none',
                padding: '5px 10px',
                borderRadius: '8px',
                backgroundColor: 'var(--bg-main)',
                border: '1px solid var(--border-subtle)',
                fontSize: '0.78rem',
                fontWeight: 600,
                color: (menuConfig.fallbackConfig?.enabled ?? true) ? '#10b981' : 'var(--text-muted)'
              }}>
                <input
                  type="checkbox"
                  checked={menuConfig.fallbackConfig?.enabled ?? true}
                  onChange={(e) => setMenuConfig(prev => ({
                    ...prev,
                    fallbackConfig: {
                      ...(prev.fallbackConfig || DEFAULT_FALLBACK_CONFIG),
                      enabled: e.target.checked
                    }
                  }))}
                  style={{ width: '15px', height: '15px', cursor: 'pointer', accentColor: '#10b981' }}
                />
                <span>{(menuConfig.fallbackConfig?.enabled ?? true) ? 'Ativo' : 'Desativado'}</span>
              </label>
            </div>

            {(menuConfig.fallbackConfig?.enabled ?? true) && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                      Mensagem de Transbordo Automático:
                    </label>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      Use <code style={{ backgroundColor: 'var(--bg-main)', padding: '2px 5px', borderRadius: '4px' }}>&#123;&#123;setor&#125;&#125;</code> para o nome do setor
                    </span>
                  </div>
                  <textarea
                    rows={2}
                    value={menuConfig.fallbackConfig?.message ?? DEFAULT_FALLBACK_CONFIG.message}
                    onChange={(e) => setMenuConfig(prev => ({
                      ...prev,
                      fallbackConfig: {
                        ...(prev.fallbackConfig || DEFAULT_FALLBACK_CONFIG),
                        message: e.target.value
                      }
                    }))}
                    placeholder="Nossos consultores do setor {{setor}} não estão disponíveis no momento..."
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      backgroundColor: 'var(--bg-main)',
                      color: 'var(--text-main)',
                      border: '1px solid var(--border-subtle)',
                      fontSize: '0.84rem',
                      outline: 'none',
                      resize: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                <div style={{
                  padding: '10px 14px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(16, 185, 129, 0.08)',
                  border: '1px solid rgba(16, 185, 129, 0.2)',
                  color: 'var(--text-muted)',
                  fontSize: '0.78rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <Info size={16} style={{ color: '#10b981', flexShrink: 0 }} />
                  <span>
                    Se nenhum operador do setor escolhido estiver ativo ou na fila, o cliente recebe essa mensagem no WhatsApp e é redirecionado instantaneamente para a <strong>Fila Geral de Plantão</strong>.
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* CARD 5: TIMEOUT & LEMBRETE DE INATIVIDADE NA URA */}
          <div className="card" style={{
            padding: '20px 22px',
            borderRadius: '14px',
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-subtle)',
            boxShadow: '0 4px 16px rgba(0,0,0,0.06)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(245, 158, 11, 0.12)',
                  color: '#f59e0b',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Timer size={18} />
                </div>
                <div>
                  <h3 style={{ fontSize: '0.96rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
                    5. Lembrete & Timeout por Inatividade
                  </h3>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    Reengaja clientes distraídos e encerra sessões abandonadas na URA
                  </span>
                </div>
              </div>

              {/* Toggle Habilitar Lembrete */}
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                userSelect: 'none',
                padding: '5px 10px',
                borderRadius: '8px',
                backgroundColor: 'var(--bg-main)',
                border: '1px solid var(--border-subtle)',
                fontSize: '0.78rem',
                fontWeight: 600,
                color: (menuConfig.timeoutConfig?.enabled ?? true) ? '#f59e0b' : 'var(--text-muted)'
              }}>
                <input
                  type="checkbox"
                  checked={menuConfig.timeoutConfig?.enabled ?? true}
                  onChange={(e) => setMenuConfig(prev => ({
                    ...prev,
                    timeoutConfig: {
                      ...(prev.timeoutConfig || DEFAULT_TIMEOUT_CONFIG),
                      enabled: e.target.checked
                    }
                  }))}
                  style={{ width: '15px', height: '15px', cursor: 'pointer', accentColor: '#f59e0b' }}
                />
                <span>{(menuConfig.timeoutConfig?.enabled ?? true) ? 'Ativo' : 'Desativado'}</span>
              </label>
            </div>

            {(menuConfig.timeoutConfig?.enabled ?? true) && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {/* 1. Lembrete Amigável */}
                <div style={{ padding: '12px 14px', borderRadius: '10px', backgroundColor: 'var(--bg-main)', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-main)' }}>
                      Primeiro Lembrete Amigável
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Enviar após:</span>
                      <input
                        type="number"
                        min={1}
                        max={120}
                        value={menuConfig.timeoutConfig?.reminderMinutes ?? 5}
                        onChange={(e) => setMenuConfig(prev => ({
                          ...prev,
                          timeoutConfig: {
                            ...(prev.timeoutConfig || DEFAULT_TIMEOUT_CONFIG),
                            reminderMinutes: Math.max(1, parseInt(e.target.value, 10) || 5)
                          }
                        }))}
                        style={{
                          width: '54px',
                          padding: '3px 6px',
                          borderRadius: '6px',
                          backgroundColor: 'var(--bg-secondary)',
                          color: 'var(--text-main)',
                          border: '1px solid var(--border-subtle)',
                          fontSize: '0.82rem',
                          textAlign: 'center',
                          outline: 'none'
                        }}
                      />
                      <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>min</span>
                    </div>
                  </div>

                  <textarea
                    rows={2}
                    value={menuConfig.timeoutConfig?.reminderMessage ?? DEFAULT_TIMEOUT_CONFIG.reminderMessage}
                    onChange={(e) => setMenuConfig(prev => ({
                      ...prev,
                      timeoutConfig: {
                        ...(prev.timeoutConfig || DEFAULT_TIMEOUT_CONFIG),
                        reminderMessage: e.target.value
                      }
                    }))}
                    placeholder="Olá, {{nome}}! Ainda está aí? 😊..."
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      backgroundColor: 'var(--bg-secondary)',
                      color: 'var(--text-main)',
                      border: '1px solid var(--border-subtle)',
                      fontSize: '0.82rem',
                      outline: 'none',
                      resize: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                {/* 2. Auto Encerramento */}
                <div style={{ padding: '12px 14px', borderRadius: '10px', backgroundColor: 'var(--bg-main)', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-main)' }}>
                      <input
                        type="checkbox"
                        checked={menuConfig.timeoutConfig?.autoCloseEnabled ?? true}
                        onChange={(e) => setMenuConfig(prev => ({
                          ...prev,
                          timeoutConfig: {
                            ...(prev.timeoutConfig || DEFAULT_TIMEOUT_CONFIG),
                            autoCloseEnabled: e.target.checked
                          }
                        }))}
                        style={{ width: '15px', height: '15px', cursor: 'pointer', accentColor: 'var(--primary)' }}
                      />
                      <span>Encerrar conversa automaticamente se persistir sem resposta</span>
                    </label>

                    {(menuConfig.timeoutConfig?.autoCloseEnabled ?? true) && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Após mais:</span>
                        <input
                          type="number"
                          min={1}
                          max={180}
                          value={menuConfig.timeoutConfig?.closeMinutes ?? 15}
                          onChange={(e) => setMenuConfig(prev => ({
                            ...prev,
                            timeoutConfig: {
                              ...(prev.timeoutConfig || DEFAULT_TIMEOUT_CONFIG),
                              closeMinutes: Math.max(1, parseInt(e.target.value, 10) || 15)
                            }
                          }))}
                          style={{
                            width: '54px',
                            padding: '3px 6px',
                            borderRadius: '6px',
                            backgroundColor: 'var(--bg-secondary)',
                            color: 'var(--text-main)',
                            border: '1px solid var(--border-subtle)',
                            fontSize: '0.82rem',
                            textAlign: 'center',
                            outline: 'none'
                          }}
                        />
                        <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>min</span>
                      </div>
                    )}
                  </div>

                  {(menuConfig.timeoutConfig?.autoCloseEnabled ?? true) && (
                    <textarea
                      rows={2}
                      value={menuConfig.timeoutConfig?.closeMessage ?? DEFAULT_TIMEOUT_CONFIG.closeMessage}
                      onChange={(e) => setMenuConfig(prev => ({
                        ...prev,
                        timeoutConfig: {
                          ...(prev.timeoutConfig || DEFAULT_TIMEOUT_CONFIG),
                          closeMessage: e.target.value
                        }
                      }))}
                      placeholder="Seu atendimento foi finalizado por inatividade..."
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        backgroundColor: 'var(--bg-secondary)',
                        color: 'var(--text-main)',
                        border: '1px solid var(--border-subtle)',
                        fontSize: '0.82rem',
                        outline: 'none',
                        resize: 'none',
                        boxSizing: 'border-box'
                      }}
                    />
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* COLUNA DIREITA: SIMULADOR INTERATIVO WHATSAPP EM TEMPO REAL */}
        <div style={{
          backgroundColor: '#0c1317',
          borderLeft: '1px solid var(--border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px 16px',
          overflow: 'hidden'
        }}>
          {/* Aparelho Smartphone Mockup */}
          <div style={{
            width: '360px',
            height: '620px',
            maxHeight: '92vh',
            borderRadius: '36px',
            border: '8px solid #202c33',
            boxShadow: '0 20px 50px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.08)',
            backgroundColor: '#0b141a',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            position: 'relative'
          }}>
            {/* Notch / Câmera Superior */}
            <div style={{
              width: '120px',
              height: '16px',
              backgroundColor: '#202c33',
              borderRadius: '0 0 12px 12px',
              margin: '0 auto',
              zIndex: 10
            }} />

            {/* Header do WhatsApp */}
            <div style={{
              padding: '8px 12px 10px 12px',
              backgroundColor: '#202c33',
              color: '#e9edef',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              zIndex: 5,
              borderBottom: '1px solid rgba(255,255,255,0.05)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  backgroundColor: '#00a884',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: '0.95rem'
                }}>
                  {menuConfig.companyName ? menuConfig.companyName.charAt(0).toUpperCase() : 'E'}
                </div>
                <div>
                  <div style={{ fontSize: '0.86rem', fontWeight: 600, color: '#e9edef', lineHeight: 1.2 }}>
                    {menuConfig.companyName || bot?.name || 'Exata'}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#00a884', fontWeight: 500 }}>
                    online
                  </div>
                </div>
              </div>

              {/* Botão de Reset da Simulação */}
              <button
                type="button"
                onClick={() => resetSimulator()}
                title="Reiniciar Simulação"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#8696a0',
                  cursor: 'pointer',
                  padding: '6px',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '0.72rem'
                }}
              >
                <RotateCcw size={14} />
              </button>
            </div>

            {/* Chat Body com Fundo WhatsApp */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              backgroundImage: 'radial-gradient(circle at 50% 50%, rgba(17, 27, 33, 0.8) 0%, rgba(11, 20, 26, 0.95) 100%)'
            }}>
              {/* Data 'HOJE' */}
              <div style={{
                textAlign: 'center',
                margin: '4px 0 10px 0'
              }}>
                <span style={{
                  backgroundColor: '#182229',
                  color: '#8696a0',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  fontSize: '0.68rem',
                  fontWeight: 600,
                  textTransform: 'uppercase'
                }}>
                  Hoje
                </span>
              </div>

              {/* Lista de Mensagens Simuladas */}
              {simMessages.map((msg) => {
                const isBot = msg.sender === 'bot';
                return (
                  <div
                    key={msg.id}
                    style={{
                      display: 'flex',
                      justifyContent: isBot ? 'flex-start' : 'flex-end',
                      animation: 'fadeIn 0.2s ease'
                    }}
                  >
                    <div style={{
                      maxWidth: '86%',
                      padding: '8px 12px',
                      borderRadius: isBot ? '0 10px 10px 10px' : '10px 0 10px 10px',
                      backgroundColor: isBot ? '#202c33' : '#005c4b',
                      color: '#e9edef',
                      fontSize: '0.8rem',
                      lineHeight: '1.45',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.3)',
                      position: 'relative'
                    }}>
                      {msg.text}
                      <div style={{
                        textAlign: 'right',
                        fontSize: '0.62rem',
                        color: isBot ? '#8696a0' : '#8cdfc4',
                        marginTop: '3px'
                      }}>
                        {msg.time} {isBot ? '' : '✓✓'}
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Indicador de Digitando */}
              {simTyping && (
                <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                  <div style={{
                    padding: '8px 12px',
                    borderRadius: '0 10px 10px 10px',
                    backgroundColor: '#202c33',
                    color: '#8696a0',
                    fontSize: '0.75rem',
                    fontStyle: 'italic'
                  }}>
                    digitando...
                  </div>
                </div>
              )}

              <div ref={simChatEndRef} />
            </div>

            {/* Botoeira Rápida de Opções para Teste */}
            <div style={{
              padding: '6px 8px',
              backgroundColor: '#182229',
              borderTop: '1px solid rgba(255,255,255,0.05)',
              display: 'flex',
              gap: '6px',
              overflowX: 'auto',
              scrollbarWidth: 'none'
            }}>
              {menuConfig.options.map((opt, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    setSimInput(String(i + 1));
                    setTimeout(() => {
                      const fakeEvent = { preventDefault: () => {} };
                      // Simula envio do dígito
                      const userMsg = {
                        id: `usr-${Date.now()}`,
                        sender: 'user',
                        text: String(i + 1),
                        time: 'Agora'
                      };
                      setSimMessages(prev => [...prev, userMsg]);
                      setSimTyping(true);

                      setTimeout(() => {
                        setSimTyping(false);
                        let reply = opt.message || `Transferindo para ${opt.department || 'atendimento'}. Aguarde! 🧑‍💻`;
                        reply = reply.replace(/{{nome}}/g, 'João').replace(/{{empresa}}/g, menuConfig.companyName || 'Exata');
                        setSimMessages(prev => [
                          ...prev,
                          {
                            id: `bot-${Date.now()}`,
                            sender: 'bot',
                            text: reply,
                            time: 'Agora'
                          }
                        ]);
                      }, 600);
                    }, 50);
                  }}
                  style={{
                    padding: '4px 8px',
                    borderRadius: '6px',
                    backgroundColor: '#202c33',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: '#00a884',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    whiteSpace: 'nowrap',
                    cursor: 'pointer'
                  }}
                >
                  {i + 1}️⃣ {opt.title.substring(0, 14)}...
                </button>
              ))}
            </div>

            {/* Campo de Envio do WhatsApp */}
            <form
              onSubmit={handleSimSubmit}
              style={{
                padding: '8px 10px',
                backgroundColor: '#202c33',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <input
                type="text"
                value={simInput}
                onChange={(e) => setSimInput(e.target.value)}
                placeholder="Digite 1, 2, 3 ou 'menu'..."
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: '20px',
                  backgroundColor: '#2a3942',
                  border: 'none',
                  color: '#e9edef',
                  fontSize: '0.8rem',
                  outline: 'none'
                }}
              />
              <button
                type="submit"
                disabled={!simInput.trim() || simTyping}
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '50%',
                  backgroundColor: '#00a884',
                  border: 'none',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: simInput.trim() ? 'pointer' : 'default',
                  opacity: simInput.trim() ? 1 : 0.6
                }}
              >
                <Send size={15} />
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
