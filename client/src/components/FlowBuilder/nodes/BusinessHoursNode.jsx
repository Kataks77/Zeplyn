import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Clock, Trash2, Sun, Moon } from 'lucide-react';

function BusinessHoursNode({ id, data, isConnectable }) {
  const handleDelete = () => {
    if (data.onDelete) {
      data.onDelete(id);
    }
  };

  return (
    <div style={{
      background: '#1e293b',
      border: '1.5px solid #eab308',
      borderRadius: '12px',
      padding: '14px',
      minWidth: '270px',
      maxWidth: '310px',
      boxShadow: '0 8px 24px -4px rgba(234, 179, 8, 0.25)',
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
          background: '#eab308',
          border: '2px solid #fff',
          left: '-7px'
        }}
      />

      {/* Cabeçalho */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '28px',
            height: '28px',
            borderRadius: '6px',
            background: 'rgba(234, 179, 8, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#facc15'
          }}>
            <Clock size={16} />
          </div>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#fef08a' }}>
              Horário de Expediente
            </div>
            <div style={{ fontSize: '10px', color: '#94a3b8' }}>
              Bifurcação Aberto / Fechado
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

      <p style={{ fontSize: '11px', color: '#94a3b8', margin: '0 0 12px 0', lineHeight: 1.4 }}>
        Verifica os dias e horários comerciais definidos em Configurações do sistema.
      </p>

      {/* Duas saídas: Aberto (inside) e Fechado (outside) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: '#0f172a',
          padding: '6px 10px',
          borderRadius: '6px',
          border: '1px solid #10b981',
          position: 'relative'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Sun size={13} color="#34d399" />
            <span style={{ fontSize: '11px', fontWeight: 600, color: '#34d399' }}>Dentro do Horário</span>
          </div>
          <Handle
            type="source"
            position={Position.Right}
            id="inside"
            isConnectable={isConnectable}
            style={{
              width: '12px',
              height: '12px',
              background: '#10b981',
              border: '2px solid #fff',
              right: '-16px',
              top: '50%'
            }}
          />
        </div>

        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: '#0f172a',
          padding: '6px 10px',
          borderRadius: '6px',
          border: '1px solid #f59e0b',
          position: 'relative'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Moon size={13} color="#fbbf24" />
            <span style={{ fontSize: '11px', fontWeight: 600, color: '#fbbf24' }}>Fora do Expediente</span>
          </div>
          <Handle
            type="source"
            position={Position.Right}
            id="outside"
            isConnectable={isConnectable}
            style={{
              width: '12px',
              height: '12px',
              background: '#f59e0b',
              border: '2px solid #fff',
              right: '-16px',
              top: '50%'
            }}
          />
        </div>
      </div>
    </div>
  );
}

export default memo(BusinessHoursNode);
