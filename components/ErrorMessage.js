import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Easing,
} from 'react-native';
import colors from '../constants/colors';

/**
 * Types d'erreurs predefinies
 */
export const ERROR_TYPES = {
  NETWORK: {
    icon: '📡',
    title: 'Probleme de connexion',
    message: 'Verifiez votre connexion Internet et reessayez.',
  },
  INVALID_CODE: {
    icon: '❌',
    title: 'Code invalide',
    message: 'Ce code de partie n\'existe pas. Verifiez-le et reessayez.',
  },
  GAME_FULL: {
    icon: '🚫',
    title: 'Partie complete',
    message: 'Cette partie a atteint le nombre maximum de joueurs (15).',
  },
  GAME_STARTED: {
    icon: '🎮',
    title: 'Partie en cours',
    message: 'Cette partie a deja commence. Vous ne pouvez plus la rejoindre.',
  },
  ACCESS_DENIED: {
    icon: '🔒',
    title: 'Acces refuse',
    message: 'Cette zone est reservee au Maitre du Jeu.',
  },
  DISCONNECTED: {
    icon: '🔌',
    title: 'Deconnecte',
    message: 'Vous avez ete deconnecte de la partie.',
  },
  TIMEOUT: {
    icon: '⏰',
    title: 'Temps ecoule',
    message: 'La requete a pris trop de temps. Reessayez.',
  },
  UNKNOWN: {
    icon: '⚠️',
    title: 'Erreur',
    message: 'Une erreur inattendue s\'est produite.',
  },
};

/**
 * Composant ErrorMessage reutilisable
 *
 * @param {string} type - Type d'erreur (voir ERROR_TYPES)
 * @param {string} customMessage - Message personnalise (remplace celui par defaut)
 * @param {function} onRetry - Callback pour le bouton Reessayer
 * @param {function} onDismiss - Callback pour fermer le message
 * @param {boolean} visible - Afficher ou non
 * @param {string} variant - 'card' | 'banner' | 'toast'
 */
export default function ErrorMessage({
  type = 'UNKNOWN',
  customMessage,
  onRetry,
  onDismiss,
  visible = true,
  variant = 'card',
}) {
  const slideAnim = useRef(new Animated.Value(-100)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;

  const errorInfo = ERROR_TYPES[type] || ERROR_TYPES.UNKNOWN;

  useEffect(() => {
    if (visible) {
      // Animation d'entree
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 50,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();

      // Shake pour attirer l'attention
      Animated.sequence([
        Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: -100,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  if (!visible) return null;

  // Variant: Toast (petit message temporaire)
  if (variant === 'toast') {
    return (
      <Animated.View
        style={[
          styles.toast,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        <Text style={styles.toastIcon}>{errorInfo.icon}</Text>
        <Text style={styles.toastText}>
          {customMessage || errorInfo.message}
        </Text>
        {onDismiss && (
          <TouchableOpacity onPress={onDismiss} style={styles.toastClose}>
            <Text style={styles.toastCloseText}>✕</Text>
          </TouchableOpacity>
        )}
      </Animated.View>
    );
  }

  // Variant: Banner (bandeau en haut)
  if (variant === 'banner') {
    return (
      <Animated.View
        style={[
          styles.banner,
          {
            opacity: fadeAnim,
            transform: [{ translateX: shakeAnim }],
          },
        ]}
      >
        <View style={styles.bannerContent}>
          <Text style={styles.bannerIcon}>{errorInfo.icon}</Text>
          <Text style={styles.bannerText} numberOfLines={2}>
            {customMessage || errorInfo.message}
          </Text>
        </View>
        {onRetry && (
          <TouchableOpacity onPress={onRetry} style={styles.bannerButton}>
            <Text style={styles.bannerButtonText}>Reessayer</Text>
          </TouchableOpacity>
        )}
      </Animated.View>
    );
  }

  // Variant: Card (default - carte complete)
  return (
    <Animated.View
      style={[
        styles.card,
        {
          opacity: fadeAnim,
          transform: [
            { translateY: slideAnim },
            { translateX: shakeAnim },
          ],
        },
      ]}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.cardIcon}>{errorInfo.icon}</Text>
        <Text style={styles.cardTitle}>{errorInfo.title}</Text>
      </View>

      <Text style={styles.cardMessage}>
        {customMessage || errorInfo.message}
      </Text>

      <View style={styles.cardActions}>
        {onDismiss && (
          <TouchableOpacity
            style={[styles.cardButton, styles.cardButtonSecondary]}
            onPress={onDismiss}
          >
            <Text style={styles.cardButtonTextSecondary}>Fermer</Text>
          </TouchableOpacity>
        )}
        {onRetry && (
          <TouchableOpacity
            style={[styles.cardButton, styles.cardButtonPrimary]}
            onPress={onRetry}
          >
            <Text style={styles.cardButtonTextPrimary}>Reessayer</Text>
          </TouchableOpacity>
        )}
      </View>
    </Animated.View>
  );
}

/**
 * Toast automatique qui disparait apres un delai
 */
export function AutoDismissToast({
  message,
  icon = '⚠️',
  duration = 3000,
  onDismiss,
  type = 'error', // 'error' | 'success' | 'warning' | 'info'
}) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  useEffect(() => {
    // Entree
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();

    // Auto dismiss
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 50,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start(() => {
        if (onDismiss) onDismiss();
      });
    }, duration);

    return () => clearTimeout(timer);
  }, []);

  const backgroundColor = {
    error: colors.danger,
    success: colors.success,
    warning: colors.warning,
    info: colors.secondary,
  }[type];

  return (
    <Animated.View
      style={[
        styles.autoToast,
        {
          backgroundColor,
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <Text style={styles.autoToastIcon}>{icon}</Text>
      <Text style={styles.autoToastText}>{message}</Text>
    </Animated.View>
  );
}

/**
 * Composant pour afficher une erreur inline
 */
export function InlineError({ message, icon = '⚠️' }) {
  if (!message) return null;

  return (
    <View style={styles.inlineError}>
      <Text style={styles.inlineErrorIcon}>{icon}</Text>
      <Text style={styles.inlineErrorText}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // Card variant
  card: {
    backgroundColor: colors.backgroundCard,
    borderRadius: 16,
    padding: 20,
    margin: 16,
    borderLeftWidth: 4,
    borderLeftColor: colors.danger,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardIcon: {
    fontSize: 28,
    marginRight: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  cardMessage: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: 16,
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  cardButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    minWidth: 100,
    alignItems: 'center',
  },
  cardButtonPrimary: {
    backgroundColor: colors.primary,
  },
  cardButtonSecondary: {
    backgroundColor: colors.backgroundSecondary,
  },
  cardButtonTextPrimary: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 14,
  },
  cardButtonTextSecondary: {
    color: colors.textSecondary,
    fontWeight: '600',
    fontSize: 14,
  },

  // Banner variant
  banner: {
    backgroundColor: colors.danger,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    paddingHorizontal: 16,
  },
  bannerContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  bannerIcon: {
    fontSize: 20,
    marginRight: 10,
  },
  bannerText: {
    flex: 1,
    color: '#FFF',
    fontSize: 14,
  },
  bannerButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    marginLeft: 10,
  },
  bannerButtonText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 12,
  },

  // Toast variant
  toast: {
    position: 'absolute',
    top: 50,
    left: 16,
    right: 16,
    backgroundColor: colors.backgroundCard,
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    borderLeftWidth: 4,
    borderLeftColor: colors.danger,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
    zIndex: 1000,
  },
  toastIcon: {
    fontSize: 20,
    marginRight: 10,
  },
  toastText: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 14,
  },
  toastClose: {
    padding: 4,
    marginLeft: 10,
  },
  toastCloseText: {
    color: colors.textSecondary,
    fontSize: 16,
  },

  // Auto dismiss toast
  autoToast: {
    position: 'absolute',
    bottom: 100,
    left: 20,
    right: 20,
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
    zIndex: 1000,
  },
  autoToastIcon: {
    fontSize: 20,
    marginRight: 10,
  },
  autoToastText: {
    flex: 1,
    color: '#FFF',
    fontSize: 14,
    fontWeight: '500',
  },

  // Inline error
  inlineError: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(220, 38, 38, 0.1)',
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
  },
  inlineErrorIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  inlineErrorText: {
    flex: 1,
    color: colors.danger,
    fontSize: 13,
  },
});
