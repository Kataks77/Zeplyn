import React, { memo } from 'react';
import { Bot, CheckCheck, Lock } from 'lucide-react';

const ChatMessageItem = memo(function ChatMessageItem({
  msg,
  msgKey,
  dayDividerEl,
  isMatched,
  isCurrentSelectedMatch,
  isMe,
  isBot,
  isAttendant,
  handleContextMenu,
  handleReact,
  renderContent
}) {
  // 1. Mensagens e Marcadores de Sistema (ex: Encerramento ou Abertura de Atendimento)
  if (msg.role === 'system' || (msg.content && (msg.content.startsWith('🏁 Atendimento Finalizado') || msg.content.startsWith('🚀 Novo Atendimento')))) {
    const isFinish = msg.content && msg.content.includes('Finalizado');
    return (
      <React.Fragment key={msgKey}>
        {dayDividerEl}
        <div 
          id={`msg-${msgKey}`}
          style={{
            display: 'flex',
            justifyContent: 'center',
            margin: '18px 0',
            width: '100%'
          }}
        >
          <div 
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 18px',
              borderRadius: '24px',
              backgroundColor: isFinish ? 'rgba(239, 68, 68, 0.12)' : 'rgba(16, 185, 129, 0.12)',
              border: isFinish ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(16, 185, 129, 0.3)',
              color: isFinish ? '#ef4444' : '#10b981',
              fontSize: '0.8rem',
              fontWeight: 600,
              boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
            }}
          >
            <span>{msg.content}</span>
            <span style={{ fontSize: '0.7rem', opacity: 0.75, marginLeft: '4px' }}>
              {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
            </span>
          </div>
        </div>
      </React.Fragment>
    );
  }

  // 2. Notas Internas Privadas da Equipe
  if (msg.role === 'internal_note') {
    return (
      <React.Fragment key={msgKey}>
        {dayDividerEl}
        <div 
          id={`msg-${msgKey}`}
          style={{
            display: 'flex',
            justifyContent: 'center',
            margin: '6px 0',
            width: '100%',
            padding: isMatched ? '4px' : '0',
            borderRadius: '12px',
            backgroundColor: isCurrentSelectedMatch 
              ? 'rgba(59, 130, 246, 0.25)' 
              : (isMatched ? 'rgba(59, 130, 246, 0.1)' : 'transparent'),
            transition: 'all 0.2s ease'
          }}
        >
          <div 
            onContextMenu={(e) => handleContextMenu && handleContextMenu(e, msg)}
            className="glass-panel animate-fade-in"
            style={{
              maxWidth: '85%',
              width: '100%',
              backgroundColor: 'rgba(245, 158, 11, 0.08)',
              border: isCurrentSelectedMatch ? '2px solid #3b82f6' : '1px solid rgba(245, 158, 11, 0.35)',
              borderLeft: '4px solid #f59e0b',
              borderRadius: '12px',
              padding: '12px 16px',
              boxShadow: '0 4px 14px rgba(245, 158, 11, 0.08)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px', flexWrap: 'wrap', gap: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#f59e0b', fontWeight: 700, fontSize: '0.78rem' }}>
                <Lock size={13} />
                <span>NOTA INTERNA PRIVADA</span>
                <span style={{ opacity: 0.6, fontWeight: 400 }}>•</span>
                <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>{msg.senderName || 'Equipe'}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{
                  fontSize: '0.66rem',
                  fontWeight: 700,
                  backgroundColor: 'rgba(245, 158, 11, 0.18)',
                  color: '#f59e0b',
                  padding: '2px 8px',
                  borderRadius: '20px'
                }}>
                  🔒 Somente Equipe
                </span>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                </span>
              </div>
            </div>
            <div style={{ fontSize: '0.88rem', color: 'var(--text-main)', whiteSpace: 'pre-wrap', lineHeight: '1.55' }}>
              {msg.content}
            </div>
            <div style={{ fontSize: '0.68rem', color: '#f59e0b', opacity: 0.8, marginTop: '6px', fontStyle: 'italic' }}>
              * Esta nota é visível somente internamente para a equipe e não foi enviada para o cliente no WhatsApp.
            </div>
          </div>
        </div>
      </React.Fragment>
    );
  }

  // 3. Balão de Mensagem Padrão (Cliente, IA ou Atendente)
  return (
    <React.Fragment key={msgKey}>
      {dayDividerEl}
      <div
        id={`msg-${msgKey}`}
        onContextMenu={(e) => handleContextMenu && handleContextMenu(e, msg)}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: isMe ? 'flex-end' : 'flex-start',
          position: 'relative',
          padding: isMatched ? '4px 6px' : '0',
          borderRadius: '12px',
          backgroundColor: isCurrentSelectedMatch 
            ? 'rgba(59, 130, 246, 0.22)' 
            : (isMatched ? 'rgba(59, 130, 246, 0.08)' : 'transparent'),
          transition: 'all 0.2s ease'
        }}
      >
        <div
          onContextMenu={(e) => handleContextMenu && handleContextMenu(e, msg)}
          style={{
            maxWidth: '68%',
            padding: '10px 15px',
            borderRadius: isMe ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
            backgroundColor: isMe ? (isBot ? 'rgba(16, 185, 129, 0.18)' : 'var(--primary)') : 'var(--bg-tertiary)',
            color: isMe && !isBot ? '#ffffff' : 'var(--text-main)',
            border: isBot ? '1px solid rgba(16, 185, 129, 0.35)' : '1px solid var(--border-subtle)',
            boxShadow: 'var(--shadow-sm)',
            fontSize: '0.9rem',
            lineHeight: '1.45',
            wordBreak: 'break-word',
            position: 'relative'
          }}
        >
          {isBot && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem', color: '#10b981', fontWeight: 700, marginBottom: '4px' }}>
              <Bot size={13} /> Resposta Automática (IA)
            </div>
          )}
          {isAttendant && (
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'rgba(255,255,255,0.88)', marginBottom: '3px' }}>
              {msg.senderName}
            </div>
          )}
          {!isMe && msg.senderName && (
            <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '3px' }}>
              {msg.senderName}
            </div>
          )}
          
          {renderContent ? renderContent(msg.content, isMe, msg) : msg.content}

          <div 
            style={{
              fontSize: '0.68rem',
              color: isMe && !isBot ? 'rgba(255,255,255,0.75)' : 'var(--text-muted)',
              textAlign: 'right',
              marginTop: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '4px'
            }}
          >
            {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
            {isMe && <CheckCheck size={13} />}
          </div>

          {/* Badge de Reação com Emoji */}
          {msg.reaction && (
            <span
              onClick={() => handleReact && handleReact(msg.id, '')}
              title="Clique para remover reação"
              style={{
                position: 'absolute',
                bottom: '-9px',
                right: isMe ? '12px' : 'auto',
                left: isMe ? 'auto' : '12px',
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '12px',
                padding: '1px 6px',
                fontSize: '0.85rem',
                cursor: 'pointer',
                boxShadow: 'var(--shadow-sm)',
                zIndex: 2,
                userSelect: 'none'
              }}
            >
              {msg.reaction}
            </span>
          )}
        </div>
      </div>
    </React.Fragment>
  );
});

export default ChatMessageItem;
