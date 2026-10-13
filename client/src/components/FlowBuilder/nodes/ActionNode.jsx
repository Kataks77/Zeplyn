import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Tag, Trash2, Columns3, CheckCircle2 } from 'lucide-react';

function ActionNode({ id, data, isConnectable }) {
  const handleActionTypeChange = (e) => {
    if (data.onChange) {
      data.onChange(id, { ...data, actionType: e.target.value });
    }
  };

  const handleTagValueChange = (e) => {
    if (data.onChange) {
      data.onChange(id, { ...data, tagValue: e.target.value });
    }
  };

  const handleStatusChange = (e) => {
    if (data.onChange) {
      data.onChange(id, { ...data, statusValue: e.target.value });
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
      border: '1.5px solid #ec4899',
      borderRadius: '12px',
      padding: '14px',
      minWidth: '270px',
      maxWidth: '310px',
      boxShadow: '0 8px 24px -4px rgba(236, 72, 153, 0.25)',
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
          background: '#ec4899',
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
            background: 'rgba(236, 72, 153, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#f472b6'
          }}>
            <Tag size={16} />
          </div>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#fbcfe8' }}>
              Ação no Contato
            </div>
            <div style={{ fontSize: '10px', color: '#94a3b8' }}>
              Tags & Kanban CRM
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

      {/* Tipo de Ação */}
      <div style={{ marginBottom: '10px' }}>
        <label style={{ fontSize: '11px', color: '#cbd5e1', display: 'block', marginBottom: '4px', fontWeight: 500 }}>
          Tipo de automação:
        </label>
        <select
          value={data.actionType || 'add_tag'}
          onChange={handleActionTypeChange}
          style={{
            width: '100%',
            background: '#0f172a',
            border: '1px solid #334155',
            borderRadius: '6px',
            padding: '6px 8px',
            color: '#f8fafc',
            fontSize: '11px',
            fontFamily: 'inherit',
            boxSizing: 'border-box',
            cursor: 'pointer'
          }}
        >
          <option value="add_tag">Adicionar Tag / Etiqueta</option>
          <option value="remove_tag">Remover Tag / Etiqueta</option>
          <option value="set_status">Mover no Kanban / Definir Status</option>
        </select>
      </div>

      {/* Campo dinâmico dependendo do tipo */}
      {(data.actionType === 'add_tag' || data.actionType === 'remove_tag' || !data.actionType) && (
        <div style={{ marginBottom: '8px' }}>
          <label style={{ fontSize: '11px', color: '#cbd5e1', display: 'block', marginBottom: '4px', fontWeight: 500 }}>
            Nome da Tag (Etiqueta):
          </label>
          <input
            type="text"
            value={data.tagValue || ''}
            onChange={handleTagValueChange}
            placeholder="ex: Lead Qualificado, VIP, Proposta"
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
      )}

      {data.actionType === 'set_status' && (
        <div style={{ marginBottom: '8px' }}>
          <label style={{ fontSize: '11px', color: '#cbd5e1', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px', fontWeight: 500 }}>
            <Columns3 size={12} color="#ec4899" /> Coluna / Status do Kanban:
          </label>
          <select
            value={data.statusValue || 'open'}
            onChange={handleStatusChange}
            style={{
              width: '100%',
              background: '#0f172a',
              border: '1px solid #334155',
              borderRadius: '6px',
              padding: '6px 8px',
              color: '#f8fafc',
              fontSize: '11px',
              fontFamily: 'inherit',
              boxSizing: 'border-box',
              cursor: 'pointer'
            }}
          >
            <option value="open">Aberto / Em Atendimento</option>
            <option value="pending">Pendente / Aguardando Cliente</option>
            <option value="qualified">Qualificado / Oportunidade</option>
            <option value="closed">Concluído / Venda Realizada</option>
          </select>
        </div>
      )}

      <div style={{ fontSize: '10px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px' }}>
        <CheckCircle2 size={12} color="#10b981" /> Executa instantaneamente sem travar o cliente
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
          background: '#ec4899',
          border: '2px solid #fff',
          right: '-7px'
        }}
      />
    </div>
  );
}

export default memo(ActionNode);
