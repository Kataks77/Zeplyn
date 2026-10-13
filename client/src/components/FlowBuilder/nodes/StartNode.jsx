import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Play } from 'lucide-react';

function StartNode({ isConnectable }) {
  return (
    <div style={{
      background: 'linear-gradient(135deg, #064e3b 0%, #022c22 100%)',
      border: '2px solid #10b981',
      borderRadius: '12px',
      padding: '14px 18px',
      minWidth: '220px',
      boxShadow: '0 8px 24px -4px rgba(16, 185, 129, 0.3)',
      color: '#fff',
      fontFamily: 'inherit'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{
          width: '32px',
          height: '32px',
          borderRadius: '8px',
          background: 'rgba(16, 185, 129, 0.25)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#34d399'
        }}>
          <Play size={18} fill="#34d399" />
        </div>
        <div>
          <div style={{ fontSize: '13px', fontWeight: 700, color: '#34d399', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Início do Atendimento
          </div>
          <div style={{ fontSize: '11px', color: '#a7f3d0', marginTop: '2px' }}>
            Cliente envia mensagem
          </div>
        </div>
      </div>

      <div style={{ marginTop: '10px', fontSize: '11px', color: '#6ee7b7', background: 'rgba(0,0,0,0.2)', padding: '6px 8px', borderRadius: '6px' }}>
        Ponto de partida quando a conversa inicia ou é reiniciada.
      </div>

      {/* Saída para o próximo bloco */}
      <Handle
        type="source"
        position={Position.Right}
        id="output"
        isConnectable={isConnectable}
        style={{
          width: '12px',
          height: '12px',
          background: '#10b981',
          border: '2px solid #fff',
          right: '-7px'
        }}
      />
    </div>
  );
}

export default memo(StartNode);
