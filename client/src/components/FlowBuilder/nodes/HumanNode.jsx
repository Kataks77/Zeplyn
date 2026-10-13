import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { UserCheck, Trash2, Tag } from 'lucide-react';

const COMMON_DEPARTMENTS = ['Suporte', 'Vendas', 'Financeiro', 'Geral'];

function HumanNode({ id, data, isConnectable }) {
  const currentDept = data.department || '';

  const handleDepartmentChange = (deptValue) => {
    if (data.onChange) {
      const defaultMsg = deptValue.trim()
        ? `Estou transferindo seu atendimento para o setor de *${deptValue.trim()}*. Aguarde um instante! 🧑‍💻`
        : 'Estou transferindo seu atendimento para nossa equipe. Aguarde um instante! 🧑‍💻';
      
      // Se a mensagem estava vazia ou era o padrão anterior, sugere a nova
      const shouldUpdateMessage = !data.message || data.message.includes('transferindo seu atendimento para');

      data.onChange(id, {
        ...data,
        department: deptValue,
        message: shouldUpdateMessage ? defaultMsg : data.message
      });
    }
  };

  const handleMessageChange = (e) => {
    if (data.onChange) {
      data.onChange(id, { ...data, message: e.target.value });
    }
  };

  const handleDelete = () => {
    if (data.onDelete) {
      data.onDelete(id);
    }
  };

  return (
    <div style={{
      background: 'linear-gradient(135deg, #1e293b 0%, #064e3b 100%)',
      border: '1.5px solid #10b981',
      borderRadius: '12px',
      padding: '14px',
      minWidth: '280px',
      maxWidth: '320px',
      boxShadow: '0 8px 24px -4px rgba(16, 185, 129, 0.25)',
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
          background: '#10b981',
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
            background: 'rgba(16, 185, 129, 0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#34d399'
          }}>
            <UserCheck size={16} />
          </div>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#6ee7b7' }}>
              Transferir para Humano
            </div>
            <div style={{ fontSize: '10px', color: '#a7f3d0' }}>
              Fila do Live Chat
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

      {/* Departamento / Setor */}
      <div style={{ marginBottom: '10px' }}>
        <label style={{ fontSize: '11px', color: '#cbd5e1', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px', fontWeight: 500 }}>
          <Tag size={12} style={{ color: '#34d399' }} /> Departamento / Fila:
        </label>
        <input
          type="text"
          value={currentDept}
          onChange={(e) => handleDepartmentChange(e.target.value)}
          placeholder="Ex: Suporte, Vendas, Financeiro"
          style={{
            width: '100%',
            background: '#0f172a',
            border: '1px solid #334155',
            borderRadius: '6px',
            padding: '6px 10px',
            color: '#f8fafc',
            fontSize: '11px',
            fontFamily: 'inherit',
            boxSizing: 'border-box',
            marginBottom: '6px'
          }}
        />
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
          {COMMON_DEPARTMENTS.map((dept) => {
            const isSelected = currentDept.toLowerCase() === dept.toLowerCase();
            return (
              <button
                key={dept}
                type="button"
                onClick={() => handleDepartmentChange(dept)}
                style={{
                  background: isSelected ? '#10b981' : 'rgba(255, 255, 255, 0.08)',
                  color: isSelected ? '#022c22' : '#cbd5e1',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '2px 8px',
                  fontSize: '10px',
                  fontWeight: isSelected ? 700 : 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                {dept}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ marginBottom: '8px' }}>
        <label style={{ fontSize: '11px', color: '#cbd5e1', display: 'block', marginBottom: '4px', fontWeight: 500 }}>
          Mensagem de Transferência:
        </label>
        <textarea
          value={data.message || ''}
          onChange={handleMessageChange}
          placeholder="Estou transferindo seu atendimento para nossa equipe. Aguarde um instante! 🧑‍💻"
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

      <div style={{ fontSize: '10px', color: '#6ee7b7', background: 'rgba(16, 185, 129, 0.15)', padding: '6px 8px', borderRadius: '6px' }}>
        {currentDept ? (
          <span>🏷️ Encaminha o cliente direto para o setor <strong>{currentDept}</strong> no Live Chat.</span>
        ) : (
          <span>✅ Pausa as respostas automáticas e notifica os atendentes no painel.</span>
        )}
      </div>
    </div>
  );
}

export default memo(HumanNode);
