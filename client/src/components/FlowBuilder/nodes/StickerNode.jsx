import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Smile, Trash2 } from 'lucide-react';

function StickerNode({ id, data, isConnectable }) {
  const handleUrlChange = (e) => {
    if (data.onChange) {
      data.onChange(id, { ...data, url: e.target.value });
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
      border: '1.5px solid #f59e0b',
      borderRadius: '12px',
      padding: '14px',
      minWidth: '240px',
      maxWidth: '280px',
      boxShadow: '0 8px 24px -4px rgba(245, 158, 11, 0.25)',
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
          background: '#f59e0b',
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
            background: 'rgba(245, 158, 11, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fbbf24'
          }}>
            <Smile size={16} />
          </div>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#fcd34d' }}>
              Enviar Figurinha
            </div>
            <div style={{ fontSize: '10px', color: '#94a3b8' }}>
              Sticker WhatsApp / Mídia
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
          URL da Figurinha ou Arquivo:
        </label>
        <input
          type="text"
          value={data.url || ''}
          onChange={handleUrlChange}
          placeholder="/uploads/bot_...webp ou link"
          style={{
            width: '100%',
            background: '#0f172a',
            border: '1px solid #334155',
            borderRadius: '6px',
            padding: '6px 10px',
            color: '#f8fafc',
            fontSize: '11px',
            fontFamily: 'inherit',
            boxSizing: 'border-box'
          }}
        />
      </div>

      {data.url && (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          background: '#0f172a',
          borderRadius: '8px',
          padding: '8px',
          marginBottom: '8px'
        }}>
          <img
            src={data.url}
            alt="Preview"
            style={{ width: '60px', height: '60px', objectFit: 'contain' }}
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
        </div>
      )}

      {/* Saída */}
      <Handle
        type="source"
        position={Position.Right}
        id="output"
        isConnectable={isConnectable}
        style={{
          width: '12px',
          height: '12px',
          background: '#f59e0b',
          border: '2px solid #fff',
          right: '-7px'
        }}
      />
    </div>
  );
}

export default memo(StickerNode);
