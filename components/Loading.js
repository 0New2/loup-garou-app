import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Animated,
  Easing,
  Modal,
} from 'react-native';
import colors from '../constants/colors';

/**
 * Composant Loading reutilisable
 *
 * @param {boolean} visible - Afficher ou non le loading
 * @param {string} message - Message a afficher
 * @param {boolean} overlay - Afficher en overlay modal
 * @param {string} size - Taille du spinner: 'small' | 'large'
 * @param {string} type - Type d'animation: 'spinner' | 'dots' | 'pulse'
 */
export default function Loading({
  visible = true,
  message = 'Chargement...',
  overlay = false,
  size = 'large',
  type = 'spinner',
}) {
  const dotAnim1 = useRef(new Animated.Value(0)).current;
  const dotAnim2 = useRef(new Animated.Value(0)).current;
  const dotAnim3 = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Animation des points
  useEffect(() => {
    if (type === 'dots' && visible) {
      const animateDot = (anim, delay) => {
        return Animated.loop(
          Animated.sequence([
            Animated.delay(delay),
            Animated.timing(anim, {
              toValue: 1,
              duration: 300,
              easing: Easing.ease,
              useNativeDriver: true,
            }),
            Animated.timing(anim, {
              toValue: 0,
              duration: 300,
              easing: Easing.ease,
              useNativeDriver: true,
            }),
          ])
        );
      };

      const anim1 = animateDot(dotAnim1, 0);
      const anim2 = animateDot(dotAnim2, 150);
      const anim3 = animateDot(dotAnim3, 300);

      anim1.start();
      anim2.start();
      anim3.start();

      return () => {
        anim1.stop();
        anim2.stop();
        anim3.stop();
      };
    }
  }, [type, visible]);

  // Animation pulse
  useEffect(() => {
    if (type === 'pulse' && visible) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 600,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 600,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [type, visible]);

  if (!visible) return null;

  const renderLoader = () => {
    switch (type) {
      case 'dots':
        return (
          <View style={styles.dotsContainer}>
            {[dotAnim1, dotAnim2, dotAnim3].map((anim, index) => (
              <Animated.View
                key={index}
                style={[
                  styles.dot,
                  {
                    transform: [
                      {
                        translateY: anim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0, -10],
                        }),
                      },
                    ],
                    opacity: anim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.5, 1],
                    }),
                  },
                ]}
              />
            ))}
          </View>
        );

      case 'pulse':
        return (
          <Animated.View
            style={[
              styles.pulseCircle,
              { transform: [{ scale: pulseAnim }] },
            ]}
          >
            <Text style={styles.pulseIcon}>🐺</Text>
          </Animated.View>
        );

      default:
        return (
          <ActivityIndicator
            size={size}
            color={colors.primary}
          />
        );
    }
  };

  const content = (
    <View style={[styles.container, overlay && styles.overlayContainer]}>
      <View style={styles.loadingBox}>
        {renderLoader()}
        {message && (
          <Text style={styles.message}>{message}</Text>
        )}
      </View>
    </View>
  );

  if (overlay) {
    return (
      <Modal
        transparent
        visible={visible}
        animationType="fade"
        statusBarTranslucent
      >
        {content}
      </Modal>
    );
  }

  return content;
}

/**
 * Loading inline (sans overlay)
 */
export function LoadingInline({ message = 'Chargement...' }) {
  return (
    <View style={styles.inlineContainer}>
      <ActivityIndicator size="small" color={colors.primary} />
      <Text style={styles.inlineMessage}>{message}</Text>
    </View>
  );
}

/**
 * Loading skeleton pour les cartes
 */
export function LoadingSkeleton({ count = 3, style }) {
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const shimmer = Animated.loop(
      Animated.timing(shimmerAnim, {
        toValue: 1,
        duration: 1500,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    shimmer.start();
    return () => shimmer.stop();
  }, []);

  const translateX = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-200, 200],
  });

  return (
    <View style={style}>
      {Array(count).fill(0).map((_, index) => (
        <View key={index} style={styles.skeletonCard}>
          <View style={styles.skeletonContent}>
            <View style={styles.skeletonAvatar} />
            <View style={styles.skeletonLines}>
              <View style={[styles.skeletonLine, { width: '60%' }]} />
              <View style={[styles.skeletonLine, { width: '40%' }]} />
            </View>
          </View>
          <Animated.View
            style={[
              styles.shimmer,
              { transform: [{ translateX }] },
            ]}
          />
        </View>
      ))}
    </View>
  );
}

/**
 * Messages de loading predefinies
 */
export const LOADING_MESSAGES = {
  creating: 'Creation de la partie...',
  joining: 'Connexion en cours...',
  distributing: 'Le MJ distribue les roles...',
  voting: 'Envoi du vote...',
  loading: 'Chargement...',
  syncing: 'Synchronisation...',
  connecting: 'Connexion au serveur...',
  saving: 'Sauvegarde en cours...',
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  overlayContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  loadingBox: {
    backgroundColor: colors.backgroundCard,
    padding: 30,
    borderRadius: 16,
    alignItems: 'center',
    minWidth: 150,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  message: {
    color: colors.textPrimary,
    fontSize: 16,
    marginTop: 16,
    textAlign: 'center',
  },

  // Dots animation
  dotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 30,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.primary,
    marginHorizontal: 4,
  },

  // Pulse animation
  pulseCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.primary,
  },
  pulseIcon: {
    fontSize: 30,
  },

  // Inline
  inlineContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
  },
  inlineMessage: {
    color: colors.textSecondary,
    fontSize: 14,
    marginLeft: 10,
  },

  // Skeleton
  skeletonCard: {
    backgroundColor: colors.backgroundCard,
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    overflow: 'hidden',
  },
  skeletonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  skeletonAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.backgroundSecondary,
  },
  skeletonLines: {
    flex: 1,
    marginLeft: 12,
  },
  skeletonLine: {
    height: 12,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 6,
    marginBottom: 8,
  },
  shimmer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
});
