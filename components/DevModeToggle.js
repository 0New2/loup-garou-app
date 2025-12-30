import React, { useRef, useCallback } from 'react';
import { TouchableOpacity } from 'react-native';
import { useDevMode } from '../contexts/DevModeContext';

/**
 * Composant wrapper qui détecte le triple-tap pour ouvrir le DevPanel
 * Utilisation: Envelopper un élément (logo, titre) avec ce composant
 */
export default function DevModeToggle({ children, style }) {
  const { toggleDevPanel, isDevModeEnabled } = useDevMode();
  const tapCount = useRef(0);
  const lastTapTime = useRef(0);

  const handlePress = useCallback(() => {
    if (!isDevModeEnabled) return;

    const now = Date.now();
    const DOUBLE_TAP_DELAY = 500; // 500ms max entre les taps

    if (now - lastTapTime.current < DOUBLE_TAP_DELAY) {
      tapCount.current += 1;
    } else {
      tapCount.current = 1;
    }

    lastTapTime.current = now;

    if (tapCount.current >= 3) {
      tapCount.current = 0;
      toggleDevPanel();
    }
  }, [isDevModeEnabled, toggleDevPanel]);

  // En production, juste retourner les children
  if (!__DEV__) {
    return children;
  }

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={1}
      style={style}
    >
      {children}
    </TouchableOpacity>
  );
}
