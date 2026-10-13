import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Clock, Trash2 } from 'lucide-react';

function DelayNode({ id, data, isConnectable }) {
  const handleSecondsChange = (e) => {
    const val = parseInt(e.target.value, 10) || 2;
    if (data.onChange) {
      data.onChange(id, { ...data, seconds: val });
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
      border: '1.5px solid #06b6d4',
      borderRadius: '12px',
      padding: '14px',
      minWidth: '220px',
      boxShadow: '0 8px 24px -4px rgba(6, 182, 212, 0.25)',
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
          background: '#06b6d4',
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
            background: 'rgba(6, 182, 212, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#22d3ee'
          }}>
            <Clock size={16} />
          </div>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#67e8f9' }}>
              Aguardar / Delay
            </div>
            <div style={{ fontSize: '10px', color: '#94a3b8' }}>
              Simular Digitando
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

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
        <input
          type="number"
          min={1}
          max={10}
          value={data.seconds || 2}
          onChange={handleSecondsChange}
          style={{
            width: '60px',
            background: '#0f172a',
            border: '1px solid #334155',
            borderRadius: '6px',
            padding: '6px 8px',
            color: '#f8fafc',
            fontSize: '13px',
            fontWeight: 700,
            textAlign: 'center',
            fontFamily: 'inherit'
          }}
        />
        <span style={{ fontSize: '12px', color: '#cbd5e1' }}>segundos digitando</span>
      </div>

      <div style={{ fontSize: '10px', color: '#67e8f9', background: 'rgba(6, 182, 212, 0.1)', padding: '6px 8px', borderRadius: '6px' }}>
        ⏳ Envia status "digitando..." no WhatsApp antes do próximo passo.
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
          background: '#06b6d4',
          border: '2px solid #fff',
          right: '-7px'
        }}
      />
    </div>
  );
}

export default memo(DelayNode);
