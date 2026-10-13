import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { MessageSquare, Trash2 } from 'lucide-react';

function MessageNode({ id, data, isConnectable }) {
  const handleChange = (e) => {
    if (data.onChange) {
      data.onChange(id, { ...data, text: e.target.value });
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
      border: '1.5px solid #3b82f6',
      borderRadius: '12px',
      padding: '14px',
      minWidth: '260px',
      maxWidth: '300px',
      boxShadow: '0 8px 24px -4px rgba(59, 130, 246, 0.25)',
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
          background: '#3b82f6',
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
            background: 'rgba(59, 130, 246, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#60a5fa'
          }}>
            <MessageSquare size={16} />
          </div>
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#93c5fd' }}>
            Enviar Mensagem
          </span>
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
        <textarea
          value={data.text || ''}
          onChange={handleChange}
          placeholder="Digite a mensagem... (use {{nome}} para o nome do cliente)"
          rows={3}
          style={{
            width: '100%',
            background: '#0f172a',
            border: '1px solid #334155',
            borderRadius: '8px',
            padding: '8px 10px',
            color: '#f8fafc',
            fontSize: '12px',
            resize: 'vertical',
            fontFamily: 'inherit',
            boxSizing: 'border-box'
          }}
        />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10px', color: '#64748b' }}>
        <span>Variáveis: <code style={{ color: '#93c5fd' }}>{`{{nome}}`}</code></span>
        <span>{(data.text || '').length} carac.</span>
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
          background: '#3b82f6',
          border: '2px solid #fff',
          right: '-7px'
        }}
      />
    </div>
  );
}

export default memo(MessageNode);
