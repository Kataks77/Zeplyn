import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Mic, Image, FileText, Trash2, Volume2 } from 'lucide-react';

function MediaNode({ id, data, isConnectable }) {
  const handleMediaTypeChange = (e) => {
    if (data.onChange) {
      data.onChange(id, { ...data, mediaType: e.target.value });
    }
  };

  const handleUrlChange = (e) => {
    if (data.onChange) {
      data.onChange(id, { ...data, url: e.target.value });
    }
  };

  const handleCaptionChange = (e) => {
    if (data.onChange) {
      data.onChange(id, { ...data, caption: e.target.value });
    }
  };

  const handleDelete = () => {
    if (data.onDelete) {
      data.onDelete(id);
    }
  };

  const mediaType = data.mediaType || 'audio_ptt';

  return (
    <div style={{
      background: '#1e293b',
      border: '1.5px solid #10b981',
      borderRadius: '12px',
      padding: '14px',
      minWidth: '270px',
      maxWidth: '310px',
      boxShadow: '0 8px 24px -4px rgba(16, 185, 129, 0.25)',
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
          background: '#10b981',
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
            background: 'rgba(16, 185, 129, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#34d399'
          }}>
            {mediaType === 'audio_ptt' ? <Mic size={16} /> : mediaType === 'image' ? <Image size={16} /> : <FileText size={16} />}
          </div>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#a7f3d0' }}>
              {mediaType === 'audio_ptt' ? 'Áudio PTT (Voz)' : mediaType === 'image' ? 'Enviar Imagem' : 'Enviar Documento'}
            </div>
            <div style={{ fontSize: '10px', color: '#94a3b8' }}>
              Mídia no WhatsApp
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

      {/* Tipo de Mídia */}
      <div style={{ marginBottom: '10px' }}>
        <label style={{ fontSize: '11px', color: '#cbd5e1', display: 'block', marginBottom: '4px', fontWeight: 500 }}>
          Tipo de Mídia:
        </label>
        <select
          value={mediaType}
          onChange={handleMediaTypeChange}
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
          <option value="audio_ptt">🎤 Áudio Gravado na Hora (PTT)</option>
          <option value="image">🖼️ Imagem (Foto / Banner)</option>
          <option value="document">📄 Documento (PDF / Arquivo)</option>
        </select>
      </div>

      {/* URL do Arquivo */}
      <div style={{ marginBottom: '8px' }}>
        <label style={{ fontSize: '11px', color: '#cbd5e1', display: 'block', marginBottom: '4px', fontWeight: 500 }}>
          URL do Arquivo ({mediaType === 'audio_ptt' ? '.mp3/.ogg' : mediaType === 'image' ? '.jpg/.png' : '.pdf'}):
        </label>
        <input
          type="text"
          value={data.url || ''}
          onChange={handleUrlChange}
          placeholder="https://exemplo.com/audio.mp3 ou /uploads/..."
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

      {/* Legenda (se for imagem ou doc) */}
      {mediaType !== 'audio_ptt' && (
        <div style={{ marginBottom: '8px' }}>
          <label style={{ fontSize: '11px', color: '#cbd5e1', display: 'block', marginBottom: '4px', fontWeight: 500 }}>
            Legenda da imagem / documento:
          </label>
          <input
            type="text"
            value={data.caption || ''}
            onChange={handleCaptionChange}
            placeholder="Texto da legenda (opcional)"
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

      {mediaType === 'audio_ptt' && (
        <div style={{
          background: 'rgba(16, 185, 129, 0.1)',
          border: '1px solid rgba(16, 185, 129, 0.3)',
          borderRadius: '6px',
          padding: '6px 8px',
          fontSize: '10px',
          color: '#6ee7b7',
          display: 'flex',
          alignItems: 'center',
          gap: '6px'
        }}>
          <Volume2 size={14} />
          <span>O cliente recebe como áudio gravado no microfone!</span>
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
          background: '#10b981',
          border: '2px solid #fff',
          right: '-7px'
        }}
      />
    </div>
  );
}

export default memo(MediaNode);
