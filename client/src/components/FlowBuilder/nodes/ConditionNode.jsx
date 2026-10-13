import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { GitBranch, Trash2 } from 'lucide-react';

function ConditionNode({ id, data, isConnectable }) {
  const handleKeywordsChange = (e) => {
    if (data.onChange) {
      data.onChange(id, { ...data, keywords: e.target.value });
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
      border: '1.5px solid #f97316',
      borderRadius: '12px',
      padding: '14px',
      minWidth: '260px',
      maxWidth: '300px',
      boxShadow: '0 8px 24px -4px rgba(249, 115, 22, 0.25)',
      color: '#fff',
      fontFamily: 'inherit',
      position: 'relative'
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
          background: '#f97316',
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
            background: 'rgba(249, 115, 22, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fb923c'
          }}>
            <GitBranch size={16} />
          </div>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#fdba74' }}>
              Condição / Palavra-chave
            </div>
            <div style={{ fontSize: '10px', color: '#94a3b8' }}>
              Filtro Se / Senão
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

      <div style={{ marginBottom: '12px' }}>
        <label style={{ fontSize: '11px', color: '#cbd5e1', display: 'block', marginBottom: '4px', fontWeight: 500 }}>
          Se a mensagem contiver (separar por vírgula):
        </label>
        <input
          type="text"
          value={data.keywords || ''}
          onChange={handleKeywordsChange}
          placeholder="ex: boleto, 2 via, fatura"
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

      {/* Duas saídas com rótulo */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: '#0f172a',
          padding: '4px 8px',
          borderRadius: '6px',
          border: '1px solid #10b981',
          position: 'relative'
        }}>
          <span style={{ fontSize: '11px', fontWeight: 600, color: '#34d399' }}>✓ Se encontrar (Sim)</span>
          <Handle
            type="source"
            position={Position.Right}
            id="true"
            isConnectable={isConnectable}
            style={{
              width: '12px',
              height: '12px',
              background: '#10b981',
              border: '2px solid #fff',
              right: '-14px',
              top: '50%'
            }}
          />
        </div>

        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: '#0f172a',
          padding: '4px 8px',
          borderRadius: '6px',
          border: '1px solid #ef4444',
          position: 'relative'
        }}>
          <span style={{ fontSize: '11px', fontWeight: 600, color: '#f87171' }}>✕ Se não encontrar (Não)</span>
          <Handle
            type="source"
            position={Position.Right}
            id="false"
            isConnectable={isConnectable}
            style={{
              width: '12px',
              height: '12px',
              background: '#ef4444',
              border: '2px solid #fff',
              right: '-14px',
              top: '50%'
            }}
          />
        </div>
      </div>
    </div>
  );
}

export default memo(ConditionNode);
