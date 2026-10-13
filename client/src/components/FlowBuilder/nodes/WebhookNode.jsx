import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Globe, Trash2, ArrowUpRight, Code } from 'lucide-react';

function WebhookNode({ id, data, isConnectable }) {
  const handleUrlChange = (e) => {
    if (data.onChange) {
      data.onChange(id, { ...data, url: e.target.value });
    }
  };

  const handleMethodChange = (e) => {
    if (data.onChange) {
      data.onChange(id, { ...data, method: e.target.value });
    }
  };

  const handleHeadersChange = (e) => {
    if (data.onChange) {
      data.onChange(id, { ...data, headersJson: e.target.value });
    }
  };

  const handleBodyChange = (e) => {
    if (data.onChange) {
      data.onChange(id, { ...data, bodyJson: e.target.value });
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
      border: '1.5px solid #6366f1',
      borderRadius: '12px',
      padding: '14px',
      minWidth: '280px',
      maxWidth: '320px',
      boxShadow: '0 8px 24px -4px rgba(99, 102, 241, 0.25)',
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
          background: '#6366f1',
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
            background: 'rgba(99, 102, 241, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#818cf8'
          }}>
            <Globe size={16} />
          </div>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#c7d2fe' }}>
              Requisição / Webhook
            </div>
            <div style={{ fontSize: '10px', color: '#94a3b8' }}>
              Webhook, Zapier ou API Externa
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

      {/* Método e URL */}
      <div style={{ marginBottom: '10px' }}>
        <div style={{ display: 'flex', gap: '6px', marginBottom: '4px' }}>
          <select
            value={data.method || 'POST'}
            onChange={handleMethodChange}
            style={{
              width: '80px',
              background: '#0f172a',
              border: '1px solid #334155',
              borderRadius: '6px',
              padding: '6px 4px',
              color: '#818cf8',
              fontWeight: 700,
              fontSize: '11px',
              fontFamily: 'inherit',
              cursor: 'pointer'
            }}
          >
            <option value="POST">POST</option>
            <option value="GET">GET</option>
            <option value="PUT">PUT</option>
          </select>
          <input
            type="text"
            value={data.url || ''}
            onChange={handleUrlChange}
            placeholder="https://seu-webhook.com/api"
            style={{
              flex: 1,
              background: '#0f172a',
              border: '1px solid #334155',
              borderRadius: '6px',
              padding: '6px 8px',
              color: '#f8fafc',
              fontSize: '11px',
              fontFamily: 'inherit',
              boxSizing: 'border-box'
            }}
          />
        </div>
        <span style={{ fontSize: '10px', color: '#64748b' }}>
          Suporta variáveis na URL: <code style={{ color: '#818cf8' }}>{`{{telefone}}`}</code>
        </span>
      </div>

      {/* Body JSON (se for POST ou PUT) */}
      {(data.method !== 'GET') && (
        <div style={{ marginBottom: '8px' }}>
          <label style={{ fontSize: '11px', color: '#cbd5e1', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px', fontWeight: 500 }}>
            <Code size={12} color="#818cf8" /> Payload JSON enviado:
          </label>
          <textarea
            value={data.bodyJson !== undefined ? data.bodyJson : '{\n  "nome": "{{nome}}",\n  "telefone": "{{telefone}}"\n}'}
            onChange={handleBodyChange}
            rows={3}
            style={{
              width: '100%',
              background: '#0f172a',
              border: '1px solid #334155',
              borderRadius: '6px',
              padding: '6px 8px',
              color: '#a5b4fc',
              fontSize: '10px',
              fontFamily: 'monospace',
              resize: 'vertical',
              boxSizing: 'border-box'
            }}
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
          background: '#6366f1',
          border: '2px solid #fff',
          right: '-7px'
        }}
      />
    </div>
  );
}

export default memo(WebhookNode);
