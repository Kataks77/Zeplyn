import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { ListFilter, Plus, Trash2, X } from 'lucide-react';

function MenuNode({ id, data, isConnectable }) {
  const options = data.options || [
    { id: 'option-0', text: 'Opção 1' },
    { id: 'option-1', text: 'Opção 2' }
  ];

  const handleQuestionChange = (e) => {
    if (data.onChange) {
      data.onChange(id, { ...data, question: e.target.value });
    }
  };

  const handleOptionChange = (idx, text) => {
    const newOptions = [...options];
    newOptions[idx] = { ...newOptions[idx], text };
    if (data.onChange) {
      data.onChange(id, { ...data, options: newOptions });
    }
  };

  const handleAddOption = () => {
    const nextIdx = options.length;
    const newOptions = [
      ...options,
      { id: `option-${nextIdx}`, text: `Nova Opção ${nextIdx + 1}` }
    ];
    if (data.onChange) {
      data.onChange(id, { ...data, options: newOptions });
    }
  };

  const handleRemoveOption = (idx) => {
    if (options.length <= 1) return;
    const newOptions = options.filter((_, i) => i !== idx);
    if (data.onChange) {
      data.onChange(id, { ...data, options: newOptions });
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
      border: '1.5px solid #a855f7',
      borderRadius: '12px',
      padding: '14px',
      minWidth: '290px',
      maxWidth: '340px',
      boxShadow: '0 8px 24px -4px rgba(168, 85, 247, 0.25)',
      color: '#fff',
      fontFamily: 'inherit',
      position: 'relative'
    }}>
      {/* Entrada Geral */}
      <Handle
        type="target"
        position={Position.Left}
        id="input"
        isConnectable={isConnectable}
        style={{
          width: '12px',
          height: '12px',
          background: '#a855f7',
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
            background: 'rgba(168, 85, 247, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#c084fc'
          }}>
            <ListFilter size={16} />
          </div>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#d8b4fe' }}>
              Menu de Opções
            </div>
            <div style={{ fontSize: '10px', color: '#94a3b8' }}>
              Ramificação por resposta
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

      {/* Pergunta do Menu */}
      <div style={{ marginBottom: '10px' }}>
        <label style={{ fontSize: '11px', color: '#cbd5e1', display: 'block', marginBottom: '4px', fontWeight: 500 }}>
          Pergunta / Título do Menu:
        </label>
        <input
          type="text"
          value={data.question || ''}
          onChange={handleQuestionChange}
          placeholder="Como podemos te ajudar hoje?"
          style={{
            width: '100%',
            background: '#0f172a',
            border: '1px solid #334155',
            borderRadius: '6px',
            padding: '6px 10px',
            color: '#f8fafc',
            fontSize: '12px',
            fontFamily: 'inherit',
            boxSizing: 'border-box'
          }}
        />
      </div>

      {/* Lista de Opções */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '10px' }}>
        <div style={{ fontSize: '11px', color: '#cbd5e1', fontWeight: 500 }}>
          Opções e Saídas de Conexão:
        </div>

        {options.map((opt, idx) => (
          <div
            key={opt.id || `option-${idx}`}
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: '#0f172a',
              border: '1px solid #334155',
              borderRadius: '8px',
              padding: '4px 6px 4px 8px'
            }}
          >
            <span style={{
              fontSize: '11px',
              fontWeight: 700,
              color: '#c084fc',
              background: 'rgba(168, 85, 247, 0.2)',
              padding: '2px 6px',
              borderRadius: '4px'
            }}>
              {idx + 1}
            </span>

            <input
              type="text"
              value={opt.text || ''}
              onChange={(e) => handleOptionChange(idx, e.target.value)}
              placeholder={`Opção ${idx + 1}`}
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                color: '#f1f5f9',
                fontSize: '11px',
                outline: 'none',
                fontFamily: 'inherit'
              }}
            />

            {options.length > 1 && (
              <button
                onClick={() => handleRemoveOption(idx)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#64748b',
                  cursor: 'pointer',
                  padding: '2px',
                  display: 'flex'
                }}
                onMouseEnter={(e) => e.currentTarget.style.color = '#ef4444'}
                onMouseLeave={(e) => e.currentTarget.style.color = '#64748b'}
              >
                <X size={13} />
              </button>
            )}

            {/* Handle específico desta opção */}
            <Handle
              type="source"
              position={Position.Right}
              id={`option-${idx}`}
              isConnectable={isConnectable}
              style={{
                width: '12px',
                height: '12px',
                background: '#c084fc',
                border: '2px solid #fff',
                right: '-14px',
                top: '50%'
              }}
              title={`Conectar saída da Opção ${idx + 1}`}
            />
          </div>
        ))}
      </div>

      <button
        onClick={handleAddOption}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px',
          background: 'rgba(168, 85, 247, 0.15)',
          border: '1px dashed #a855f7',
          borderRadius: '6px',
          padding: '6px',
          color: '#d8b4fe',
          fontSize: '11px',
          fontWeight: 600,
          cursor: 'pointer'
        }}
        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(168, 85, 247, 0.25)'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(168, 85, 247, 0.15)'}
      >
        <Plus size={14} /> Adicionar Opção
      </button>
    </div>
  );
}

export default memo(MenuNode);
