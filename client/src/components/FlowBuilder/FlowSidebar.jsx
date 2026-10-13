import React from 'react';
import { 
  MessageSquare, 
  ListFilter, 
  Bot, 
  Smile, 
  UserCheck, 
  Clock, 
  GitBranch,
  Plus,
  TextCursorInput,
  Tag,
  Globe,
  Mic,
  CalendarClock
} from 'lucide-react';

const BLOCK_TYPES = [
  {
    type: 'message',
    label: 'Enviar Mensagem',
    desc: 'Texto com variáveis {{nome}}',
    icon: MessageSquare,
    color: '#3b82f6',
    bgColor: 'rgba(59, 130, 246, 0.15)'
  },
  {
    type: 'input',
    label: 'Coleta de Dados',
    desc: 'Pergunta com validação (CPF/E-mail)',
    icon: TextCursorInput,
    color: '#06b6d4',
    bgColor: 'rgba(6, 182, 212, 0.15)'
  },
  {
    type: 'menu',
    label: 'Menu de Opções',
    desc: 'Ramificação 1, 2, 3...',
    icon: ListFilter,
    color: '#a855f7',
    bgColor: 'rgba(168, 85, 247, 0.15)'
  },
  {
    type: 'ai',
    label: 'IA OpenAI',
    desc: 'ChatGPT + Base RAG',
    icon: Bot,
    color: '#8b5cf6',
    bgColor: 'rgba(139, 92, 246, 0.15)'
  },
  {
    type: 'media',
    label: 'Áudio PTT & Mídia',
    desc: 'Áudio como gravado na hora / Imagem',
    icon: Mic,
    color: '#10b981',
    bgColor: 'rgba(16, 185, 129, 0.15)'
  },
  {
    type: 'action',
    label: 'Ação no Contato',
    desc: 'Adicionar Tag / Mover no Kanban',
    icon: Tag,
    color: '#ec4899',
    bgColor: 'rgba(236, 72, 153, 0.15)'
  },
  {
    type: 'webhook',
    label: 'Requisição / Webhook',
    desc: 'Webhook, Zapier ou API Externa',
    icon: Globe,
    color: '#6366f1',
    bgColor: 'rgba(99, 102, 241, 0.15)'
  },
  {
    type: 'business_hours',
    label: 'Horário Comercial',
    desc: 'Bifurcação Aberto / Fechado',
    icon: CalendarClock,
    color: '#eab308',
    bgColor: 'rgba(234, 179, 8, 0.15)'
  },
  {
    type: 'sticker',
    label: 'Figurinha WhatsApp',
    desc: 'Stickers animados ou estáticos',
    icon: Smile,
    color: '#f59e0b',
    bgColor: 'rgba(245, 158, 11, 0.15)'
  },
  {
    type: 'condition',
    label: 'Condição / Palavra',
    desc: 'Ramifica por palavras-chave',
    icon: GitBranch,
    color: '#f97316',
    bgColor: 'rgba(249, 115, 22, 0.15)'
  },
  {
    type: 'delay',
    label: 'Aguardar / Delay',
    desc: 'Simula "digitando..."',
    icon: Clock,
    color: '#14b8a6',
    bgColor: 'rgba(20, 184, 166, 0.15)'
  },
  {
    type: 'human',
    label: 'Transferir Humano',
    desc: 'Pausa bot e manda pro chat',
    icon: UserCheck,
    color: '#059669',
    bgColor: 'rgba(5, 150, 105, 0.15)'
  }
];

export default function FlowSidebar({ onAddNode }) {
  const onDragStart = (event, nodeType) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <aside style={{
      width: '270px',
      minWidth: '270px',
      background: '#0f172a',
      borderRight: '1px solid #1e293b',
      padding: '16px 12px',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      overflowY: 'auto',
      maxHeight: '100%'
    }}>
      <div>
        <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#f8fafc', margin: '0 0 4px 0' }}>
          Bloquinhos do Fluxo
        </h3>
        <p style={{ fontSize: '11px', color: '#64748b', margin: 0 }}>
          Clique ou arraste para o canvas para montar seu atendimento.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {BLOCK_TYPES.map((block) => {
          const Icon = block.icon;
          return (
            <div
              key={block.type}
              draggable
              onDragStart={(e) => onDragStart(e, block.type)}
              onClick={() => onAddNode(block.type)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '9px 11px',
                background: '#1e293b',
                border: '1px solid #334155',
                borderRadius: '10px',
                cursor: 'grab',
                transition: 'all 0.2s ease',
                userSelect: 'none'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = block.color;
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = `0 4px 12px -2px ${block.bgColor}`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#334155';
                e.currentTarget.style.transform = 'none';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  minWidth: '32px',
                  borderRadius: '8px',
                  background: block.bgColor,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: block.color
                }}>
                  <Icon size={17} />
                </div>
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#f1f5f9' }}>
                    {block.label}
                  </div>
                  <div style={{ fontSize: '10px', color: '#94a3b8', lineHeight: 1.2 }}>
                    {block.desc}
                  </div>
                </div>
              </div>
              <Plus size={14} color="#64748b" />
            </div>
          );
        })}
      </div>

      <div style={{
        marginTop: 'auto',
        background: '#1e293b',
        border: '1px solid #334155',
        borderRadius: '8px',
        padding: '10px',
        fontSize: '11px',
        color: '#94a3b8',
        lineHeight: '1.4'
      }}>
        💡 <strong style={{ color: '#f1f5f9' }}>Dica visual:</strong> Puxe uma linha conectando os pontos coloridos de saída e entrada entre os blocos.
      </div>
    </aside>
  );
}
