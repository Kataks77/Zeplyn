import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Bot, Sparkles, Trash2 } from 'lucide-react';

function AiNode({ id, data, isConnectable }) {
  const handlePromptChange = (e) => {
    if (data.onChange) {
      data.onChange(id, { ...data, customPrompt: e.target.value });
    }
  };

  const handleDelete = () => {
    if (data.onDelete) {
      data.onDelete(id);
    }
  };

  return (
    <div style={{
      background: '#1e293b',
      border: '1.5px solid #8b5cf6',
      borderRadius: '12px',
      padding: '14px',
      minWidth: '260px',
      maxWidth: '300px',
      boxShadow: '0 8px 24px -4px rgba(139, 92, 246, 0.25)',
      color: '#fff',
      fontFamily: 'inherit'
    }}>
      {/* Entrada */}
      <Handle
        type="target"
        position={Position.Left}
        id="input"
        isConnectable={isConnectable}
        style={{
          width: '12px',
          height: '12px',
          background: '#8b5cf6',
          border: '2px solid #fff',
          left: '-7px'
        }}
      />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '28px',
            height: '28px',
            borderRadius: '6px',
            background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.3) 0%, rgba(236, 72, 153, 0.3) 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#c4b5fd'
          }}>
            <Bot size={16} />
          </div>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#c4b5fd', display: 'flex', alignItems: 'center', gap: '4px' }}>
              IA OpenAI <Sparkles size={12} color="#f472b6" />
            </div>
            <div style={{ fontSize: '10px', color: '#94a3b8' }}>
              ChatGPT + Base de Conhecimento
            </div>
          </div>
        </div>
        <button
          onClick={handleDelete}
          title="Excluir bloco"
          style={{
            background: 'transparent',
            border: 'none',
            color: '#64748b',
            cursor: 'pointer',
            padding: '2px',
            borderRadius: '4px',
            display: 'flex'
          }}
          onMouseEnter={(e) => e.currentTarget.style.color = '#ef4444'}
          onMouseLeave={(e) => e.currentTarget.style.color = '#64748b'}
        >
          <Trash2 size={14} />
        </button>
      </div>

      <div style={{ marginBottom: '8px' }}>
        <label style={{ fontSize: '11px', color: '#cbd5e1', display: 'block', marginBottom: '4px', fontWeight: 500 }}>
          Instrução Opcional para este Bloco:
        </label>
        <textarea
          value={data.customPrompt || ''}
          onChange={handlePromptChange}
          placeholder="Ex: Responda apenas dúvidas sobre produtos da tabela. Se não souber, oriente a falar com atendente."
          rows={3}
          style={{
            width: '100%',
            background: '#0f172a',
            border: '1px solid #334155',
            borderRadius: '8px',
            padding: '8px 10px',
            color: '#f8fafc',
            fontSize: '11px',
            resize: 'vertical',
            fontFamily: 'inherit',
            boxSizing: 'border-box'
          }}
        />
      </div>

      <div style={{ fontSize: '10px', color: '#a78bfa', background: 'rgba(139, 92, 246, 0.1)', padding: '6px 8px', borderRadius: '6px' }}>
        💡 O bot utilizará o modelo configurado, prompt do sistema e documentos RAG.
      </div>

      {/* Saída */}
      <Handle
        type="source"
        position={Position.Right}
        id="output"
        isConnectable={isConnectable}
        style={{
          width: '12px',
          height: '12px',
          background: '#8b5cf6',
          border: '2px solid #fff',
          right: '-7px'
        }}
      />
    </div>
  );
}

export default memo(AiNode);
