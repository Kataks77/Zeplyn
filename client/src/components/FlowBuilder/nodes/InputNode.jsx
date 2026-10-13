import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { TextCursorInput, Trash2, ShieldCheck } from 'lucide-react';

function InputNode({ id, data, isConnectable }) {
  const handleQuestionChange = (e) => {
    if (data.onChange) {
      data.onChange(id, { ...data, question: e.target.value });
    }
  };

  const handleVariableChange = (e) => {
    if (data.onChange) {
      const cleanVar = e.target.value.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase();
      data.onChange(id, { ...data, variableName: cleanVar });
    }
  };

  const handleValidationChange = (e) => {
    if (data.onChange) {
      data.onChange(id, { ...data, validationType: e.target.value });
    }
  };

  const handleErrorMessageChange = (e) => {
    if (data.onChange) {
      data.onChange(id, { ...data, errorMessage: e.target.value });
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
      minWidth: '270px',
      maxWidth: '310px',
      boxShadow: '0 8px 24px -4px rgba(6, 182, 212, 0.25)',
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
          background: '#06b6d4',
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
            background: 'rgba(6, 182, 212, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#22d3ee'
          }}>
            <TextCursorInput size={16} />
          </div>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#67e8f9' }}>
              Coleta de Dados
            </div>
            <div style={{ fontSize: '10px', color: '#94a3b8' }}>
              Pergunta com Validação
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

      {/* Pergunta enviada ao cliente */}
      <div style={{ marginBottom: '10px' }}>
        <label style={{ fontSize: '11px', color: '#cbd5e1', display: 'block', marginBottom: '4px', fontWeight: 500 }}>
          Pergunta ao cliente:
        </label>
        <textarea
          value={data.question || ''}
          onChange={handleQuestionChange}
          placeholder="ex: Por favor, digite seu e-mail comercial:"
          rows={2}
          style={{
            width: '100%',
            background: '#0f172a',
            border: '1px solid #334155',
            borderRadius: '6px',
            padding: '6px 8px',
            color: '#f8fafc',
            fontSize: '11px',
            resize: 'vertical',
            fontFamily: 'inherit',
            boxSizing: 'border-box'
          }}
        />
      </div>

      {/* Tipo de validação */}
      <div style={{ marginBottom: '10px' }}>
        <label style={{ fontSize: '11px', color: '#cbd5e1', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px', fontWeight: 500 }}>
          <ShieldCheck size={12} color="#22d3ee" /> Formato esperado:
        </label>
        <select
          value={data.validationType || 'none'}
          onChange={handleValidationChange}
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
          <option value="none">Texto Livre (Sem validação)</option>
          <option value="email">E-mail (ex: cliente@email.com)</option>
          <option value="phone">Telefone / WhatsApp</option>
          <option value="cpf">CPF / CNPJ</option>
          <option value="number">Apenas Números</option>
        </select>
      </div>

      {/* Nome da variável */}
      <div style={{ marginBottom: '8px' }}>
        <label style={{ fontSize: '11px', color: '#cbd5e1', display: 'block', marginBottom: '4px', fontWeight: 500 }}>
          Salvar na variável:
        </label>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ fontSize: '11px', color: '#67e8f9', fontWeight: 600 }}>{`{{`}</span>
          <input
            type="text"
            value={data.variableName || 'resposta'}
            onChange={handleVariableChange}
            placeholder="ex: email, cpf, empresa"
            style={{
              flex: 1,
              background: '#0f172a',
              border: '1px solid #334155',
              borderRadius: '6px',
              padding: '6px 8px',
              color: '#38bdf8',
              fontSize: '11px',
              fontWeight: 600,
              fontFamily: 'monospace',
              boxSizing: 'border-box'
            }}
          />
          <span style={{ fontSize: '11px', color: '#67e8f9', fontWeight: 600 }}>{`}}`}</span>
        </div>
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

export default memo(InputNode);
