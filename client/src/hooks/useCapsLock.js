import { useState, useEffect } from 'react';

/**
 * Hook para detectar em tempo real se a tecla Caps Lock (Fixa) está ativada.
 */
export function useCapsLock() {
  const [isCapsLock, setIsCapsLock] = useState(false);

  useEffect(() => {
    const checkCapsLock = (e) => {
      if (e && typeof e.getModifierState === 'function') {
        const state = e.getModifierState('CapsLock');
        setIsCapsLock(state);
      }
    };

    window.addEventListener('keydown', checkCapsLock);
    window.addEventListener('keyup', checkCapsLock);

    return () => {
      window.removeEventListener('keydown', checkCapsLock);
      window.removeEventListener('keyup', checkCapsLock);
    };
  }, []);

  return isCapsLock;
}
