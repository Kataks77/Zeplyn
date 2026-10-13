import React, { useState, useCallback, useMemo, useRef } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  addEdge,
  useNodesState,
  useEdgesState,
  MarkerType
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import StartNode from './nodes/StartNode';
import MessageNode from './nodes/MessageNode';
import MenuNode from './nodes/MenuNode';
import AiNode from './nodes/AiNode';
import StickerNode from './nodes/StickerNode';
import HumanNode from './nodes/HumanNode';
import DelayNode from './nodes/DelayNode';
import ConditionNode from './nodes/ConditionNode';
import InputNode from './nodes/InputNode';
import ActionNode from './nodes/ActionNode';
import WebhookNode from './nodes/WebhookNode';
import MediaNode from './nodes/MediaNode';
import BusinessHoursNode from './nodes/BusinessHoursNode';

import FlowSidebar from './FlowSidebar';
import FlowSimulator from './FlowSimulator';

import {
  Save,
  Loader2,
  CheckCircle2,
  MessageCircle
} from 'lucide-react';
import { api } from '../../services/api';

// Template Padrão: Mini-URA Departamentos (Vendas, Suporte, Financeiro, IA)
const URA_DEPARTMENTS_NODES = [
  {
    id: 'node-start',
    type: 'start',
    position: { x: 40, y: 220 },
    data: {}
  },
  {
    id: 'node-msg-welcome',
    type: 'message',
    position: { x: 300, y: 210 },
    data: {
      text: 'Olá, {{nome}}! Seja muito bem-vindo(a) à nossa central de atendimento inteligente.'
    }
  },
  {
    id: 'node-menu-ura',
    type: 'menu',
    position: { x: 620, y: 150 },
    data: {
      question: 'Por favor, digite o número do departamento desejado:',
      options: [
        { id: 'option-0', text: 'Comercial & Vendas' },
        { id: 'option-1', text: 'Suporte Técnico' },
        { id: 'option-2', text: 'Financeiro & 2ª Via' },
        { id: 'option-3', text: 'Dúvidas Frequentes (IA 24h)' }
      ]
    }
  },
  {
    id: 'node-vendas',
    type: 'human',
    position: { x: 1040, y: 20 },
    data: {
      department: 'Vendas',
      message: 'Perfeito, {{nome}}! Estou transferindo você para nosso setor de *Vendas*. Um consultor já vai te responder! 📈'
    }
  },
  {
    id: 'node-suporte',
    type: 'human',
    position: { x: 1040, y: 190 },
    data: {
      department: 'Suporte',
      message: 'Entendido, {{nome}}! Transferindo seu chamado para o *Suporte Técnico*. Aguarde um instante! 🛠️'
    }
  },
  {
    id: 'node-financeiro',
    type: 'human',
    position: { x: 1040, y: 360 },
    data: {
      department: 'Financeiro',
      message: 'Transferindo para o departamento *Financeiro*. Tenha em mãos seu CPF ou CNPJ cadastrado. 💳'
    }
  },
  {
    id: 'node-ai',
    type: 'ai',
    position: { x: 1040, y: 530 },
    data: {
      customPrompt: 'Você é um assistente virtual inteligente e prestativo. Responda às dúvidas do cliente de forma clara e amigável.'
    }
  }
];

const URA_DEPARTMENTS_EDGES = [
  {
    id: 'e-start-msg',
    source: 'node-start',
    sourceHandle: 'output',
    target: 'node-msg-welcome',
    targetHandle: 'input',
    animated: true,
    style: { stroke: '#10b981', strokeWidth: 2 }
  },
  {
    id: 'e-msg-menu',
    source: 'node-msg-welcome',
    sourceHandle: 'output',
    target: 'node-menu-ura',
    targetHandle: 'input',
    animated: true,
    style: { stroke: '#3b82f6', strokeWidth: 2 }
  },
  {
    id: 'e-menu-opt0',
    source: 'node-menu-ura',
    sourceHandle: 'option-0',
    target: 'node-vendas',
    targetHandle: 'input',
    animated: true,
    style: { stroke: '#10b981', strokeWidth: 2 }
  },
  {
    id: 'e-menu-opt1',
    source: 'node-menu-ura',
    sourceHandle: 'option-1',
    target: 'node-suporte',
    targetHandle: 'input',
    animated: true,
    style: { stroke: '#3b82f6', strokeWidth: 2 }
  },
  {
    id: 'e-menu-opt2',
    source: 'node-menu-ura',
    sourceHandle: 'option-2',
    target: 'node-financeiro',
    targetHandle: 'input',
    animated: true,
    style: { stroke: '#f59e0b', strokeWidth: 2 }
  },
  {
    id: 'e-menu-opt3',
    source: 'node-menu-ura',
    sourceHandle: 'option-3',
    target: 'node-ai',
    targetHandle: 'input',
    animated: true,
    style: { stroke: '#a855f7', strokeWidth: 2 }
  }
];

// Template 2: Mini-URA Clínica & Consultório
const URA_CLINIC_NODES = [
  { id: 'node-start', type: 'start', position: { x: 40, y: 220 }, data: {} },
  { id: 'node-msg-welcome', type: 'message', position: { x: 300, y: 210 }, data: { text: 'Olá, {{nome}}! Seja bem-vindo(a) à nossa clínica de saúde e bem-estar. 🏥' } },
  {
    id: 'node-menu-ura',
    type: 'menu',
    position: { x: 620, y: 150 },
    data: {
      question: 'Como podemos te ajudar hoje? Digite o número desejado:',
      options: [
        { id: 'option-0', text: 'Agendar / Confirmar Consulta' },
        { id: 'option-1', text: 'Resultados de Exames' },
        { id: 'option-2', text: 'Convênios & Pagamentos' },
        { id: 'option-3', text: 'Horários & Especialidades (IA)' }
      ]
    }
  },
  { id: 'node-agendamento', type: 'human', position: { x: 1040, y: 20 }, data: { department: 'Agendamento', message: 'Transferindo para nossa central de *Agendamento*. Tenha sua carteirinha em mãos! 📅' } },
  { id: 'node-exames', type: 'human', position: { x: 1040, y: 190 }, data: { department: 'Exames', message: 'Transferindo para o setor de *Resultados e Laudos*. Aguarde um instante! 🔬' } },
  { id: 'node-financeiro', type: 'human', position: { x: 1040, y: 360 }, data: { department: 'Financeiro', message: 'Transferindo para o setor *Financeiro / Convênios*. 💳' } },
  { id: 'node-ai', type: 'ai', position: { x: 1040, y: 530 }, data: { customPrompt: 'Atue como atendente virtual da clínica, informando horários, médicos e orientações gerais.' } }
];

const URA_CLINIC_EDGES = [
  { id: 'e-start-msg', source: 'node-start', sourceHandle: 'output', target: 'node-msg-welcome', targetHandle: 'input', animated: true, style: { stroke: '#10b981', strokeWidth: 2 } },
  { id: 'e-msg-menu', source: 'node-msg-welcome', sourceHandle: 'output', target: 'node-menu-ura', targetHandle: 'input', animated: true, style: { stroke: '#3b82f6', strokeWidth: 2 } },
  { id: 'e-opt0', source: 'node-menu-ura', sourceHandle: 'option-0', target: 'node-agendamento', targetHandle: 'input', animated: true, style: { stroke: '#10b981', strokeWidth: 2 } },
  { id: 'e-opt1', source: 'node-menu-ura', sourceHandle: 'option-1', target: 'node-exames', targetHandle: 'input', animated: true, style: { stroke: '#3b82f6', strokeWidth: 2 } },
  { id: 'e-opt2', source: 'node-menu-ura', sourceHandle: 'option-2', target: 'node-financeiro', targetHandle: 'input', animated: true, style: { stroke: '#f59e0b', strokeWidth: 2 } },
  { id: 'e-opt3', source: 'node-menu-ura', sourceHandle: 'option-3', target: 'node-ai', targetHandle: 'input', animated: true, style: { stroke: '#a855f7', strokeWidth: 2 } }
];

// Template 3: Mini-URA Loja & E-Commerce
const URA_ECOMMERCE_NODES = [
  { id: 'node-start', type: 'start', position: { x: 40, y: 220 }, data: {} },
  { id: 'node-msg-welcome', type: 'message', position: { x: 300, y: 210 }, data: { text: 'Olá, {{nome}}! Seja bem-vindo(a) à nossa loja oficial. 🛍️' } },
  {
    id: 'node-menu-ura',
    type: 'menu',
    position: { x: 620, y: 150 },
    data: {
      question: 'Digite o número do assunto desejado:',
      options: [
        { id: 'option-0', text: 'Comprar & Catálogo' },
        { id: 'option-1', text: 'Rastrear Meu Pedido' },
        { id: 'option-2', text: 'Trocas & Devoluções' },
        { id: 'option-3', text: 'Falar com Atendente' }
      ]
    }
  },
  { id: 'node-vendas', type: 'human', position: { x: 1040, y: 20 }, data: { department: 'Vendas', message: 'Transferindo para nossa equipe comercial de *Vendas*! 🛒' } },
  { id: 'node-rastreio', type: 'human', position: { x: 1040, y: 190 }, data: { department: 'Logística', message: 'Transferindo para o suporte de *Entregas e Rastreamento*. Informe o número do pedido. 📦' } },
  { id: 'node-trocas', type: 'human', position: { x: 1040, y: 360 }, data: { department: 'Pós-Venda', message: 'Transferindo para o setor de *Trocas e Garantia*. 🔄' } },
  { id: 'node-geral', type: 'human', position: { x: 1040, y: 530 }, data: { department: 'Geral', message: 'Aguarde um instante, um atendente já vai falar com você! 🧑‍💻' } }
];

const URA_ECOMMERCE_EDGES = [
  { id: 'e-start-msg', source: 'node-start', sourceHandle: 'output', target: 'node-msg-welcome', targetHandle: 'input', animated: true, style: { stroke: '#10b981', strokeWidth: 2 } },
  { id: 'e-msg-menu', source: 'node-msg-welcome', sourceHandle: 'output', target: 'node-menu-ura', targetHandle: 'input', animated: true, style: { stroke: '#3b82f6', strokeWidth: 2 } },
  { id: 'e-opt0', source: 'node-menu-ura', sourceHandle: 'option-0', target: 'node-vendas', targetHandle: 'input', animated: true, style: { stroke: '#10b981', strokeWidth: 2 } },
  { id: 'e-opt1', source: 'node-menu-ura', sourceHandle: 'option-1', target: 'node-rastreio', targetHandle: 'input', animated: true, style: { stroke: '#3b82f6', strokeWidth: 2 } },
  { id: 'e-opt2', source: 'node-menu-ura', sourceHandle: 'option-2', target: 'node-trocas', targetHandle: 'input', animated: true, style: { stroke: '#f59e0b', strokeWidth: 2 } },
  { id: 'e-opt3', source: 'node-menu-ura', sourceHandle: 'option-3', target: 'node-geral', targetHandle: 'input', animated: true, style: { stroke: '#a855f7', strokeWidth: 2 } }
];

// Template 4: Menu Rápido Básico (IA + Humano)
const STANDARD_FLOW_NODES = [
  { id: 'node-start', type: 'start', position: { x: 50, y: 150 }, data: {} },
  { id: 'node-msg-welcome', type: 'message', position: { x: 330, y: 140 }, data: { text: 'Olá, {{nome}}! Seja muito bem-vindo ao nosso atendimento virtual. 😊' } },
  {
    id: 'node-menu-main',
    type: 'menu',
    position: { x: 670, y: 120 },
    data: {
      question: 'Como podemos te ajudar hoje?',
      options: [
        { id: 'option-0', text: 'Tirar dúvidas com IA' },
        { id: 'option-1', text: 'Falar com atendente humano' }
      ]
    }
  },
  { id: 'node-ai-assist', type: 'ai', position: { x: 1080, y: 40 }, data: { customPrompt: 'Atue como um atendente prestativo respondendo dúvidas.' } },
  { id: 'node-transfer-human', type: 'human', position: { x: 1080, y: 280 }, data: { department: 'Geral', message: 'Aguarde um momento, {{nome}}. Estou chamando nossa equipe para te atender! 🧑‍💻' } }
];

const STANDARD_FLOW_EDGES = [
  { id: 'e-start-msg', source: 'node-start', sourceHandle: 'output', target: 'node-msg-welcome', targetHandle: 'input', animated: true, style: { stroke: '#10b981', strokeWidth: 2 } },
  { id: 'e-msg-menu', source: 'node-msg-welcome', sourceHandle: 'output', target: 'node-menu-main', targetHandle: 'input', animated: true, style: { stroke: '#3b82f6', strokeWidth: 2 } },
  { id: 'e-menu-opt0', source: 'node-menu-main', sourceHandle: 'option-0', target: 'node-ai-assist', targetHandle: 'input', animated: true, style: { stroke: '#c084fc', strokeWidth: 2 } },
  { id: 'e-menu-opt1', source: 'node-menu-main', sourceHandle: 'option-1', target: 'node-transfer-human', targetHandle: 'input', animated: true, style: { stroke: '#c084fc', strokeWidth: 2 } }
];

// Template 5: Captura e Qualificação de Leads (com Coleta de Dados + Tags CRM)
const URA_LEAD_CAPTURE_NODES = [
  { id: 'node-start', type: 'start', position: { x: 40, y: 220 }, data: {} },
  { id: 'node-msg-welcome', type: 'message', position: { x: 280, y: 210 }, data: { text: 'Olá, {{nome}}! Seja bem-vindo(a). Vamos iniciar seu atendimento.' } },
  { id: 'node-input-email', type: 'input', position: { x: 590, y: 190 }, data: { question: 'Para localizarmos seu cadastro e enviar sua proposta, qual seu melhor e-mail comercial?', validationType: 'email', variableName: 'email' } },
  { id: 'node-action-tag', type: 'action', position: { x: 930, y: 200 }, data: { actionType: 'add_tag', tagValue: 'Lead Qualificado' } },
  { id: 'node-menu', type: 'menu', position: { x: 1250, y: 160 }, data: { question: 'Perfeito! E-mail {{email}} confirmado. Como deseja prosseguir?', options: [{ id: 'option-0', text: 'Falar com Consultor' }, { id: 'option-1', text: 'Tirar dúvidas com IA' }] } },
  { id: 'node-human', type: 'human', position: { x: 1600, y: 70 }, data: { department: 'Comercial', message: 'Chamando um consultor comercial agora mesmo! 🚀' } },
  { id: 'node-ai', type: 'ai', position: { x: 1600, y: 270 }, data: { customPrompt: 'Responda dúvidas sobre produtos e serviços.' } }
];

const URA_LEAD_CAPTURE_EDGES = [
  { id: 'e-1', source: 'node-start', sourceHandle: 'output', target: 'node-msg-welcome', targetHandle: 'input', animated: true, style: { stroke: '#10b981', strokeWidth: 2 } },
  { id: 'e-2', source: 'node-msg-welcome', sourceHandle: 'output', target: 'node-input-email', targetHandle: 'input', animated: true, style: { stroke: '#3b82f6', strokeWidth: 2 } },
  { id: 'e-3', source: 'node-input-email', sourceHandle: 'output', target: 'node-action-tag', targetHandle: 'input', animated: true, style: { stroke: '#06b6d4', strokeWidth: 2 } },
  { id: 'e-4', source: 'node-action-tag', sourceHandle: 'output', target: 'node-menu', targetHandle: 'input', animated: true, style: { stroke: '#ec4899', strokeWidth: 2 } },
  { id: 'e-5', source: 'node-menu', sourceHandle: 'option-0', target: 'node-human', targetHandle: 'input', animated: true, style: { stroke: '#10b981', strokeWidth: 2 } },
  { id: 'e-6', source: 'node-menu', sourceHandle: 'option-1', target: 'node-ai', targetHandle: 'input', animated: true, style: { stroke: '#a855f7', strokeWidth: 2 } }
];

const DEFAULT_FLOW_NODES = URA_DEPARTMENTS_NODES;
const DEFAULT_FLOW_EDGES = URA_DEPARTMENTS_EDGES;

export default function FlowBuilder({ bot, onUpdateBot }) {
  const reactFlowWrapper = useRef(null);
  const [reactFlowInstance, setReactFlowInstance] = useState(null);

  // Carregar nós e arestas iniciais
  const initialNodes = useMemo(() => {
    if (bot?.flowData?.nodes && bot.flowData.nodes.length > 0) {
      return bot.flowData.nodes;
    }
    return DEFAULT_FLOW_NODES;
  }, [bot?.flowData?.nodes]);

  const initialEdges = useMemo(() => {
    if (bot?.flowData?.edges && bot.flowData.edges.length > 0) {
      return bot.flowData.edges;
    }
    return DEFAULT_FLOW_EDGES;
  }, [bot?.flowData?.edges]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const [flowEnabled, setFlowEnabled] = useState(bot?.flowEnabled ?? false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showSimulator, setShowSimulator] = useState(false);

  // Callback para atualizar dados de um nó
  const handleNodeDataChange = useCallback((nodeId, newData) => {
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === nodeId) {
          return {
            ...node,
            data: { ...newData, onChange: handleNodeDataChange, onDelete: handleNodeDelete }
          };
        }
        return node;
      })
    );
  }, [setNodes]);

  // Callback para deletar um nó
  const handleNodeDelete = useCallback((nodeId) => {
    setNodes((nds) => nds.filter((n) => n.id !== nodeId));
    setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
  }, [setNodes, setEdges]);

  // Injetar onChange e onDelete nos nós carregados
  const enrichedNodes = useMemo(() => {
    return nodes.map((node) => ({
      ...node,
      data: {
        ...node.data,
        onChange: handleNodeDataChange,
        onDelete: handleNodeDelete
      }
    }));
  }, [nodes, handleNodeDataChange, handleNodeDelete]);

  // Registro de Nós Customizados
  const nodeTypes = useMemo(() => ({
    start: StartNode,
    message: MessageNode,
    input: InputNode,
    menu: MenuNode,
    ai: AiNode,
    media: MediaNode,
    action: ActionNode,
    webhook: WebhookNode,
    business_hours: BusinessHoursNode,
    sticker: StickerNode,
    human: HumanNode,
    delay: DelayNode,
    condition: ConditionNode
  }), []);

  // Helper para dados iniciais de cada tipo de nó
  const getNodeDefaultData = (type) => {
    switch (type) {
      case 'message':
        return { text: 'Olá, {{nome}}!' };
      case 'input':
        return { question: 'Por favor, digite seu e-mail comercial:', validationType: 'email', variableName: 'email' };
      case 'menu':
        return { question: 'Escolha uma opção:', options: [{ id: 'option-0', text: 'Opção 1' }, { id: 'option-1', text: 'Opção 2' }] };
      case 'ai':
        return { customPrompt: 'Atue como um atendente prestativo respondendo dúvidas.' };
      case 'media':
        return { mediaType: 'audio_ptt', url: '' };
      case 'action':
        return { actionType: 'add_tag', tagValue: 'Lead Qualificado' };
      case 'webhook':
        return { method: 'POST', url: 'https://webhook.site/exemplo', bodyJson: '{\n  "nome": "{{nome}}",\n  "telefone": "{{telefone}}"\n}' };
      case 'business_hours':
        return {};
      case 'human':
        return { department: 'Suporte', message: 'Transferindo para o setor de Suporte... 🧑‍💻' };
      case 'delay':
        return { seconds: 2 };
      case 'condition':
        return { keywords: 'suporte, ajuda' };
      case 'sticker':
        return { url: '' };
      default:
        return {};
    }
  };

  // Ao conectar dois nós com uma linha (edge)
  const onConnect = useCallback((params) => {
    setEdges((eds) =>
      addEdge({
        ...params,
        animated: true,
        style: { stroke: '#38bdf8', strokeWidth: 2 },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: '#38bdf8'
        }
      }, eds)
    );
  }, [setEdges]);

  // Adicionar novo bloco pelo clique na barra lateral
  const handleAddNode = useCallback((type) => {
    const id = `node-${type}-${Date.now().toString(36)}`;
    const x = 300 + Math.random() * 200;
    const y = 150 + Math.random() * 150;

    const newNode = {
      id,
      type,
      position: { x, y },
      data: {
        onChange: handleNodeDataChange,
        onDelete: handleNodeDelete,
        ...getNodeDefaultData(type)
      }
    };

    setNodes((nds) => [...nds, newNode]);
  }, [setNodes, handleNodeDataChange, handleNodeDelete]);

  // Drag and Drop de bloquinhos do Sidebar para o Canvas
  const onDragOver = useCallback((event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback((event) => {
    event.preventDefault();
    const type = event.dataTransfer.getData('application/reactflow');
    if (!type) return;

    const bounds = reactFlowWrapper.current.getBoundingClientRect();
    const position = reactFlowInstance
      ? reactFlowInstance.screenToFlowPosition({
          x: event.clientX,
          y: event.clientY
        })
      : {
          x: event.clientX - bounds.left,
          y: event.clientY - bounds.top
        };

    const id = `node-${type}-${Date.now().toString(36)}`;
    const newNode = {
      id,
      type,
      position,
      data: {
        onChange: handleNodeDataChange,
        onDelete: handleNodeDelete,
        ...getNodeDefaultData(type)
      }
    };

    setNodes((nds) => [...nds, newNode]);
  }, [reactFlowInstance, setNodes, handleNodeDataChange, handleNodeDelete]);

  // Aplicar modelo pré-pronto
  const handleApplyTemplate = (templateName) => {
    if (nodes.length > 2 && !window.confirm('Aplicar este modelo substituirá os blocos atuais. Deseja continuar?')) {
      return;
    }

    if (templateName === 'ura_departments') {
      setNodes(URA_DEPARTMENTS_NODES);
      setEdges(URA_DEPARTMENTS_EDGES);
    } else if (templateName === 'ura_clinic') {
      setNodes(URA_CLINIC_NODES);
      setEdges(URA_CLINIC_EDGES);
    } else if (templateName === 'ura_ecommerce') {
      setNodes(URA_ECOMMERCE_NODES);
      setEdges(URA_ECOMMERCE_EDGES);
    } else if (templateName === 'lead_capture') {
      setNodes(URA_LEAD_CAPTURE_NODES);
      setEdges(URA_LEAD_CAPTURE_EDGES);
    } else if (templateName === 'standard') {
      setNodes(STANDARD_FLOW_NODES);
      setEdges(STANDARD_FLOW_EDGES);
    } else if (templateName === 'ai_direct') {
      const aiNodes = [
        { id: 'node-start', type: 'start', position: { x: 50, y: 150 }, data: {} },
        { id: 'node-delay', type: 'delay', position: { x: 330, y: 140 }, data: { seconds: 2 } },
        { id: 'node-ai', type: 'ai', position: { x: 620, y: 130 }, data: { customPrompt: 'Atenda o cliente com as informações da base de conhecimento.' } }
      ];
      const aiEdges = [
        { id: 'e-1', source: 'node-start', sourceHandle: 'output', target: 'node-delay', targetHandle: 'input', animated: true, style: { stroke: '#10b981', strokeWidth: 2 } },
        { id: 'e-2', source: 'node-delay', sourceHandle: 'output', target: 'node-ai', targetHandle: 'input', animated: true, style: { stroke: '#06b6d4', strokeWidth: 2 } }
      ];
      setNodes(aiNodes);
      setEdges(aiEdges);
    } else if (templateName === 'clear') {
      setNodes([
        { id: 'node-start', type: 'start', position: { x: 100, y: 200 }, data: {} }
      ]);
      setEdges([]);
    }
  };

  // Salvar no Banco de Dados
  const handleSaveFlow = async () => {
    if (!bot?.id) return;
    setSaving(true);
    setSaveSuccess(false);

    try {
      // Limpar callbacks circulares antes de serializar
      const cleanNodes = nodes.map(n => {
        const { onChange: _onChange, onDelete: _onDelete, ...cleanData } = n.data || {};
        return {
          ...n,
          data: cleanData
        };
      });

      const flowPayload = {
        nodes: cleanNodes,
        edges
      };

      await api.updateBot(bot.id, {
        flowData: flowPayload,
        flowEnabled
      });

      if (onUpdateBot) {
        onUpdateBot({
          ...bot,
          flowData: flowPayload,
          flowEnabled
        });
      }

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      alert(`Erro ao salvar fluxo: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '75vh',
      minHeight: '600px',
      background: '#090d16',
      borderRadius: '12px',
      overflow: 'hidden',
      border: '1px solid #1e293b'
    }}>
      {/* Topbar do Flow Builder */}
      <div style={{
        padding: '12px 18px',
        background: '#0f172a',
        borderBottom: '1px solid #1e293b',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        {/* Lado Esquerdo: Título e Status de Ativação */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div>
            <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#f8fafc', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              Construtor de Fluxo Visual
              <span style={{
                fontSize: '11px',
                fontWeight: 600,
                background: 'rgba(56, 189, 248, 0.15)',
                color: '#38bdf8',
                padding: '2px 8px',
                borderRadius: '12px',
                border: '1px solid rgba(56, 189, 248, 0.3)'
              }}>
                Fluxo & URA
              </span>
            </h2>
            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
              Robô: <strong style={{ color: '#cbd5e1' }}>{bot?.name}</strong> • Conecte os nós arrastando as linhas
            </div>
          </div>

          {/* Switch de Ativação do Fluxo */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: '#1e293b',
            padding: '6px 12px',
            borderRadius: '20px',
            border: flowEnabled ? '1px solid #10b981' : '1px solid #334155'
          }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: flowEnabled ? '#34d399' : '#94a3b8' }}>
              {flowEnabled ? 'Fluxo Ativo no WhatsApp' : 'Fluxo Pausado'}
            </span>
            <label style={{ position: 'relative', display: 'inline-block', width: '36px', height: '20px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={flowEnabled}
                onChange={(e) => setFlowEnabled(e.target.checked)}
                style={{ opacity: 0, width: 0, height: 0 }}
              />
              <span style={{
                position: 'absolute',
                top: 0, left: 0, right: 0, bottom: 0,
                backgroundColor: flowEnabled ? '#10b981' : '#475569',
                borderRadius: '20px',
                transition: '0.2s'
              }}>
                <span style={{
                  position: 'absolute',
                  content: '""',
                  height: '14px',
                  width: '14px',
                  left: flowEnabled ? '19px' : '3px',
                  bottom: '3px',
                  backgroundColor: '#fff',
                  borderRadius: '50%',
                  transition: '0.2s'
                }} />
              </span>
            </label>
          </div>
        </div>

        {/* Lado Direito: Ações (Templates, Testador, Salvar) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Menu de Templates */}
          <div style={{ position: 'relative' }}>
            <select
              onChange={(e) => {
                if (e.target.value) {
                  handleApplyTemplate(e.target.value);
                  e.target.value = '';
                }
              }}
              defaultValue=""
              style={{
                background: '#1e293b',
                border: '1px solid #334155',
                color: '#cbd5e1',
                padding: '7px 12px',
                borderRadius: '8px',
                fontSize: '12px',
                cursor: 'pointer',
                outline: 'none'
              }}
            >
              <option value="" disabled>📋 Modelos de Mini-URA & Fluxos...</option>
              <option value="ura_departments">🏢 Mini-URA Departamentos (Vendas, Suporte, Financeiro, IA)</option>
              <option value="lead_capture">🎯 Captura & Qualificação de Leads (Coleta + Tags CRM)</option>
              <option value="ura_clinic">🩺 Mini-URA Clínica & Saúde (Agendamento, Exames, Financeiro)</option>
              <option value="ura_ecommerce">🛍️ Mini-URA E-Commerce (Catálogo, Rastreio, Trocas)</option>
              <option value="standard">⚡ Menu Básico (Dúvidas IA + Atendente)</option>
              <option value="ai_direct">🤖 Atendimento 100% IA (Sem Menu)</option>
              <option value="clear">🗑️ Limpar Canvas (Em Branco)</option>
            </select>
          </div>

          {/* Botão de Simulação */}
          <button
            onClick={() => setShowSimulator(prev => !prev)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: showSimulator ? '#2563eb' : '#1e293b',
              border: showSimulator ? '1px solid #3b82f6' : '1px solid #334155',
              color: showSimulator ? '#fff' : '#cbd5e1',
              padding: '7px 14px',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            <MessageCircle size={15} />
            {showSimulator ? 'Ocultar Teste' : 'Testar Fluxo'}
          </button>

          {/* Botão Salvar */}
          <button
            onClick={handleSaveFlow}
            disabled={saving}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: saveSuccess ? '#059669' : '#10b981',
              border: 'none',
              color: '#fff',
              padding: '7px 16px',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: saving ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              boxShadow: '0 4px 14px -2px rgba(16, 185, 129, 0.4)'
            }}
          >
            {saving ? (
              <><Loader2 size={15} className="animate-spin" /> Salvando...</>
            ) : saveSuccess ? (
              <><CheckCircle2 size={15} /> Salvo com Sucesso!</>
            ) : (
              <><Save size={15} /> Salvar Fluxo</>
            )}
          </button>
        </div>
      </div>

      {/* Área Central: Sidebar + ReactFlow Canvas + Testador */}
      <div style={{ display: 'flex', flex: 1, position: 'relative', overflow: 'hidden' }}>
        {/* Barra Lateral com os Bloquinhos */}
        <FlowSidebar onAddNode={handleAddNode} />

        {/* Canvas do ReactFlow */}
        <div ref={reactFlowWrapper} style={{ flex: 1, height: '100%', position: 'relative' }}>
          <ReactFlow
            nodes={enrichedNodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onInit={setReactFlowInstance}
            onDrop={onDrop}
            onDragOver={onDragOver}
            nodeTypes={nodeTypes}
            fitView
            colorMode="dark"
            style={{ background: '#090d16' }}
          >
            <Background color="#334155" gap={16} size={1} />
            <Controls
              style={{
                background: '#1e293b',
                border: '1px solid #334155',
                borderRadius: '8px',
                fill: '#f8fafc',
                overflow: 'hidden'
              }}
            />
            <MiniMap
              nodeColor={(node) => {
                switch (node.type) {
                  case 'start': return '#10b981';
                  case 'message': return '#3b82f6';
                  case 'menu': return '#a855f7';
                  case 'ai': return '#8b5cf6';
                  case 'sticker': return '#f59e0b';
                  case 'human': return '#10b981';
                  case 'delay': return '#06b6d4';
                  case 'condition': return '#f97316';
                  default: return '#64748b';
                }
              }}
              style={{
                background: '#0f172a',
                border: '1px solid #1e293b',
                borderRadius: '8px'
              }}
            />
          </ReactFlow>
        </div>

        {/* Painel Lateral do Testador / Simulador */}
        {showSimulator && (
          <FlowSimulator
            nodes={nodes}
            edges={edges}
            onClose={() => setShowSimulator(false)}
          />
        )}
      </div>
    </div>
  );
}
