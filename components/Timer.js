import React, { useEffect, useRef, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  Vibration,
  Platform,
} from 'react-native';
import colors from '../constants/colors';

/**
 * Composant Timer Circulaire avec progression visuelle
 *
 * Props:
 * @param {number} duration - Duree totale en secondes
 * @param {number} remainingTime - Temps restant en secondes
 * @param {boolean} isActive - Timer en cours ou pas
 * @param {boolean} isMaster - Affiche ou non le texte "Controle par MJ"
 * @param {function} onComplete - Callback quand timer = 0
 * @param {string} size - 'small' | 'medium' | 'large'
 * @param {boolean} showLabel - Affiche le label d'etat
 * @param {boolean} enableVibration - Active les vibrations (defaut: true)
 */
export default function Timer({
  duration = 60,
  remainingTime = 60,
  isActive = false,
  isMaster = false,
  onComplete,
  size = 'medium',
  showLabel = true,
  enableVibration = true,
}) {
  // Animations
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const blinkAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const hasCalledComplete = useRef(false);
  const lastVibrationTime = useRef(0);

  // Etat pour forcer re-render propre
  const [, forceUpdate] = useState(0);

  // Dimensions selon la taille
  const dimensions = useMemo(() => {
    switch (size) {
      case 'small':
        return {
          size: 80,
          strokeWidth: 6,
          fontSize: 18,
          labelSize: 9,
          innerPadding: 8
        };
      case 'large':
        return {
          size: 160,
          strokeWidth: 10,
          fontSize: 38,
          labelSize: 13,
          innerPadding: 16
        };
      default: // medium
        return {
          size: 120,
          strokeWidth: 8,
          fontSize: 28,
          labelSize: 11,
          innerPadding: 12
        };
    }
  }, [size]);

  // Calculer le pourcentage de progression (0 a 1)
  const progress = useMemo(() => {
    if (duration <= 0) return 0;
    return Math.max(0, Math.min(1, remainingTime / duration));
  }, [remainingTime, duration]);

  // Determiner la couleur selon le temps restant
  const timerColor = useMemo(() => {
    if (remainingTime <= 0) return colors.danger;
    if (remainingTime > 30) return '#10B981'; // Vert emeraude
    if (remainingTime > 10) return '#F59E0B'; // Orange ambre
    return '#EF4444'; // Rouge vif
  }, [remainingTime]);

  // Couleur de fond du cercle selon l'etat
  const backgroundColor = useMemo(() => {
    if (!isActive) return colors.backgroundSecondary;
    if (remainingTime <= 10) return 'rgba(239, 68, 68, 0.15)';
    if (remainingTime <= 30) return 'rgba(245, 158, 11, 0.1)';
    return 'rgba(16, 185, 129, 0.1)';
  }, [isActive, remainingTime]);

  // Formater le temps en M:SS ou MM:SS
  const formattedTime = useMemo(() => {
    const totalSeconds = Math.max(0, Math.floor(remainingTime));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }, [remainingTime]);

  // Animation de pulsation et clignotement quand < 10s
  useEffect(() => {
    let pulseAnimation;
    let blinkAnimation;

    if (remainingTime <= 10 && remainingTime > 0 && isActive) {
      // Animation de pulsation
      pulseAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.08,
            duration: 400,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 400,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );
      pulseAnimation.start();

      // Animation de clignotement du texte
      blinkAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(blinkAnim, {
            toValue: 0.4,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(blinkAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      );
      blinkAnimation.start();

      // Vibration legere (throttled)
      if (enableVibration) {
        const now = Date.now();
        if (now - lastVibrationTime.current > 1000) {
          lastVibrationTime.current = now;
          Vibration.vibrate(50);
        }
      }
    } else {
      pulseAnim.setValue(1);
      blinkAnim.setValue(1);
    }

    return () => {
      if (pulseAnimation) pulseAnimation.stop();
      if (blinkAnimation) blinkAnimation.stop();
    };
  }, [remainingTime, isActive, enableVibration]);

  // Callback quand timer atteint 0
  useEffect(() => {
    if (remainingTime <= 0 && isActive && !hasCalledComplete.current) {
      hasCalledComplete.current = true;

      // Vibration de fin
      if (enableVibration && Platform.OS !== 'web') {
        Vibration.vibrate([0, 200, 100, 200, 100, 200]);
      }

      if (onComplete) {
        onComplete();
      }
    }

    // Reset le flag quand le timer repart
    if (remainingTime > 0) {
      hasCalledComplete.current = false;
    }
  }, [remainingTime, isActive, onComplete, enableVibration]);

  // Calcul des arcs pour le cercle progressif
  const radius = (dimensions.size - dimensions.strokeWidth) / 2;
  const halfSize = dimensions.size / 2;

  // Angles pour les demi-cercles
  const rightAngle = Math.min(progress * 360, 180);
  const leftAngle = Math.max(0, (progress * 360) - 180);

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.timerWrapper,
          {
            width: dimensions.size,
            height: dimensions.size,
            transform: [{ scale: pulseAnim }],
          },
        ]}
      >
        {/* Cercle de fond */}
        <View
          style={[
            styles.circleBackground,
            {
              width: dimensions.size,
              height: dimensions.size,
              borderRadius: dimensions.size / 2,
              borderWidth: dimensions.strokeWidth,
              backgroundColor: backgroundColor,
            },
          ]}
        />

        {/* Cercle de progression - Partie droite */}
        <View
          style={[
            styles.progressContainer,
            {
              width: dimensions.size,
              height: dimensions.size,
            },
          ]}
        >
          {/* Demi-cercle droit */}
          <View style={[styles.halfCircleContainer, {
            width: halfSize,
            height: dimensions.size,
            left: halfSize,
            overflow: 'hidden',
          }]}>
            <View
              style={[
                styles.halfCircle,
                {
                  width: dimensions.size,
                  height: dimensions.size,
                  borderRadius: dimensions.size / 2,
                  borderWidth: dimensions.strokeWidth,
                  borderColor: timerColor,
                  left: -halfSize,
                  transform: [{ rotate: `${rightAngle - 180}deg` }],
                  opacity: isActive ? 1 : 0.5,
                },
              ]}
            />
          </View>

          {/* Demi-cercle gauche */}
          <View style={[styles.halfCircleContainer, {
            width: halfSize,
            height: dimensions.size,
            left: 0,
            overflow: 'hidden',
          }]}>
            <View
              style={[
                styles.halfCircle,
                {
                  width: dimensions.size,
                  height: dimensions.size,
                  borderRadius: dimensions.size / 2,
                  borderWidth: dimensions.strokeWidth,
                  borderColor: timerColor,
                  left: halfSize,
                  transform: [{ rotate: `${leftAngle - 180}deg` }],
                  opacity: progress > 0.5 && isActive ? 1 : progress > 0.5 ? 0.5 : 0,
                },
              ]}
            />
          </View>
        </View>

        {/* Centre avec le temps */}
        <View style={[styles.centerContent, {
          width: dimensions.size - dimensions.strokeWidth * 2 - dimensions.innerPadding,
          height: dimensions.size - dimensions.strokeWidth * 2 - dimensions.innerPadding,
        }]}>
          <Animated.Text
            style={[
              styles.timeText,
              {
                fontSize: dimensions.fontSize,
                color: timerColor,
                opacity: remainingTime <= 10 && remainingTime > 0 && isActive ? blinkAnim : 1,
              },
            ]}
          >
            {formattedTime}
          </Animated.Text>

          {showLabel && (
            <Text
              style={[
                styles.statusText,
                {
                  fontSize: dimensions.labelSize,
                  color: isActive ? timerColor : colors.textDisabled,
                }
              ]}
            >
              {remainingTime <= 0
                ? 'Termine !'
                : !isActive
                  ? 'En pause'
                  : remainingTime <= 10
                    ? 'Attention !'
                    : 'En cours'}
            </Text>
          )}
        </View>
      </Animated.View>

      {/* Indicateur "Controle par MJ" pour les joueurs */}
      {!isMaster && (
        <Text style={styles.controlledByMJ}>
          Temps controle par le Maitre du Jeu
        </Text>
      )}
    </View>
  );
}

/**
 * Version simplifiee du Timer (barre horizontale)
 * Ideale pour un affichage compact en haut de l'ecran
 */
export function TimerBar({
  duration = 60,
  remainingTime = 60,
  isActive = false,
  showTime = true,
  height = 8,
}) {
  const blinkAnim = useRef(new Animated.Value(1)).current;

  const progress = useMemo(() => {
    if (duration <= 0) return 0;
    return Math.max(0, Math.min(1, remainingTime / duration));
  }, [remainingTime, duration]);

  const timerColor = useMemo(() => {
    if (remainingTime <= 0) return colors.danger;
    if (remainingTime > 30) return '#10B981';
    if (remainingTime > 10) return '#F59E0B';
    return '#EF4444';
  }, [remainingTime]);

  const formattedTime = useMemo(() => {
    const totalSeconds = Math.max(0, Math.floor(remainingTime));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }, [remainingTime]);

  // Animation de clignotement
  useEffect(() => {
    let animation;
    if (remainingTime <= 10 && remainingTime > 0 && isActive) {
      animation = Animated.loop(
        Animated.sequence([
          Animated.timing(blinkAnim, {
            toValue: 0.5,
            duration: 500,
            useNativeDriver: false,
          }),
          Animated.timing(blinkAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: false,
          }),
        ])
      );
      animation.start();
    } else {
      blinkAnim.setValue(1);
    }

    return () => {
      if (animation) animation.stop();
    };
  }, [remainingTime, isActive]);

  return (
    <View style={styles.barContainer}>
      <View style={[styles.barBackground, { height }]}>
        <Animated.View
          style={[
            styles.barProgress,
            {
              width: `${progress * 100}%`,
              backgroundColor: timerColor,
              opacity: isActive ? blinkAnim : 0.5,
            },
          ]}
        />
      </View>
      {showTime && (
        <Text style={[styles.barTime, { color: timerColor }]}>
          {formattedTime}
        </Text>
      )}
    </View>
  );
}

/**
 * Timer compact pour l'affichage joueur
 * Badge discret avec le temps
 */
export function TimerBadge({
  remainingTime = 60,
  isActive = false,
}) {
  const timerColor = useMemo(() => {
    if (remainingTime <= 0) return colors.danger;
    if (remainingTime > 30) return '#10B981';
    if (remainingTime > 10) return '#F59E0B';
    return '#EF4444';
  }, [remainingTime]);

  const formattedTime = useMemo(() => {
    const totalSeconds = Math.max(0, Math.floor(remainingTime));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }, [remainingTime]);

  return (
    <View style={[styles.badgeContainer, {
      backgroundColor: `${timerColor}20`,
      borderColor: timerColor,
    }]}>
      <Text style={[styles.badgeIcon, { opacity: isActive ? 1 : 0.5 }]}>
        {isActive ? '⏱️' : '⏸️'}
      </Text>
      <Text style={[styles.badgeTime, { color: timerColor }]}>
        {formattedTime}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  timerWrapper: {
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  circleBackground: {
    position: 'absolute',
    borderColor: colors.backgroundSecondary,
  },
  progressContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  halfCircleContainer: {
    position: 'absolute',
    top: 0,
  },
  halfCircle: {
    position: 'absolute',
    top: 0,
    borderLeftColor: 'transparent',
    borderBottomColor: 'transparent',
    transformOrigin: 'center center',
  },
  centerContent: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
  },
  timeText: {
    fontWeight: 'bold',
    fontVariant: ['tabular-nums'],
    letterSpacing: 1,
  },
  statusText: {
    marginTop: 2,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  controlledByMJ: {
    color: colors.textDisabled,
    fontSize: 11,
    marginTop: 12,
    fontStyle: 'italic',
    textAlign: 'center',
  },

  // Timer Bar styles
  barContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  barBackground: {
    flex: 1,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 4,
    overflow: 'hidden',
  },
  barProgress: {
    height: '100%',
    borderRadius: 4,
  },
  barTime: {
    marginLeft: 12,
    fontSize: 16,
    fontWeight: 'bold',
    fontVariant: ['tabular-nums'],
    minWidth: 50,
    textAlign: 'right',
  },

  // Timer Badge styles
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  badgeIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  badgeTime: {
    fontSize: 14,
    fontWeight: 'bold',
    fontVariant: ['tabular-nums'],
  },
});
