import React from 'react';

/**
 * ZeplynLogo - Componente oficial de logotipo e favicon do sistema Zeplyn.
 * Suporta modo escuro (Dark) e modo claro (Light) automaticamente através de CSS variables.
 *
 * @param {number} size - Tamanho em pixels (largura/altura do ícone)
 * @param {boolean} showText - Se deve exibir o nome 'Zeplyn'
 * @param {string} subtitle - Subtítulo opcional (ex: 'Enterprise v2.0')
 * @param {string} themeMode - 'auto' (usa o tema ativo) | 'dark' | 'light'
 * @param {object} style - Estilos inline extras para o container
 */
export default function ZeplynLogo({ 
  size = 40, 
  showText = false, 
  subtitle = null, 
  themeMode = 'auto', 
  style = {}
}) {
  // Configuração de cores explícitas quando forçado por props, ou usando variáveis CSS para tema dinâmico
  const isExplicitLight = themeMode === 'light';
  const isExplicitDark = themeMode === 'dark';

  const bg = isExplicitLight 
    ? '#ffffff' 
    : isExplicitDark 
    ? '#070a10' 
    : 'var(--logo-bg, #070a10)';

  const border = isExplicitLight 
    ? 'rgba(5, 150, 105, 0.35)' 
    : isExplicitDark 
    ? 'rgba(16, 185, 129, 0.35)' 
    : 'var(--logo-border, rgba(16, 185, 129, 0.35))';

  const iconColor = isExplicitLight 
    ? '#059669' 
    : isExplicitDark 
    ? '#10b981' 
    : 'var(--logo-icon, #10b981)';

  const glowColor = isExplicitLight 
    ? 'rgba(5, 150, 105, 0.12)' 
    : isExplicitDark 
    ? 'rgba(16, 185, 129, 0.2)' 
    : 'var(--logo-glow, rgba(16, 185, 129, 0.2))';

  const shadow = isExplicitLight 
    ? '0 4px 14px rgba(0, 0, 0, 0.08), 0 0 16px rgba(5, 150, 105, 0.12)' 
    : isExplicitDark 
    ? '0 4px 14px rgba(0, 0, 0, 0.6), 0 0 16px rgba(16, 185, 129, 0.25)' 
    : 'var(--logo-shadow, 0 4px 14px rgba(0, 0, 0, 0.5))';

  return (
    <div 
      style={{ 
        display: 'inline-flex', 
        alignItems: 'center', 
        gap: '12px',
        userSelect: 'none',
        ...style 
      }}
    >
      {/* Favicon & Logo Badge (Vetor Oficial Opção 1) */}
      <div 
        style={{
          width: size,
          height: size,
          borderRadius: Math.round(size * 0.28),
          backgroundColor: bg,
          border: `1.5px solid ${border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: shadow,
          flexShrink: 0,
          position: 'relative',
          overflow: 'hidden',
          transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
        title="Zeplyn"
      >
        <svg 
          viewBox="0 0 100 100" 
          width={Math.round(size * 0.7)} 
          height={Math.round(size * 0.7)} 
          fill="none" 
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Brilho interno suave */}
          <circle cx="50" cy="50" r="34" fill={glowColor} />
          
          {/* Glifo Geométrico 'Z' + Balão de Mensagem (Opção 1) */}
          <g fill={iconColor} style={{ transition: 'fill 0.25s ease' }}>
            <path d="M 22 24 L 64 24 L 78 18 L 72 34 L 78 34 L 78 40 L 64 40 L 64 33 L 42 33 L 64 61 L 78 61 L 78 76 L 22 76 L 22 67 L 56 67 L 34 39 L 22 39 Z"/>
          </g>
        </svg>
      </div>

      {/* Tipografia da Marca */}
      {showText && (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ 
            fontWeight: 800, 
            fontSize: size > 40 ? '1.5rem' : '1.1rem', 
            letterSpacing: '-0.02em', 
            color: 'var(--text-main, #ffffff)',
            lineHeight: 1.15
          }}>
            Zep<span style={{ color: 'var(--primary, #10b981)' }}>lyn</span>
          </span>
          {subtitle && (
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted, #94a3b8)', fontWeight: 500 }}>
              {subtitle}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
