import React, { useEffect, useRef, memo } from 'react';
import {
  View,
  Animated,
  Easing,
  StyleSheet,
} from 'react-native';

/**
 * Wrapper pour ajouter des animations aux cartes/composants
 *
 * @param {ReactNode} children - Contenu de la carte
 * @param {number} index - Index pour le stagger
 * @param {number} staggerDelay - Delai entre chaque carte (ms)
 * @param {string} animation - Type: 'fadeIn' | 'slideIn' | 'scaleIn' | 'none'
 * @param {boolean} isEliminated - Declenche animation d'elimination
 * @param {boolean} isSelected - Etat de selection
 * @param {function} onAnimationComplete - Callback apres animation
 */
const AnimatedCard = memo(({
  children,
  index = 0,
  staggerDelay = 50,
  animation = 'fadeIn',
  isEliminated = false,
  isSelected = false,
  onAnimationComplete,
  style,
}) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const eliminateAnim = useRef(new Animated.Value(1)).current;
  const selectAnim = useRef(new Animated.Value(1)).current;

  // Animation d'entree
  useEffect(() => {
    const delay = index * staggerDelay;

    const animations = [];

    if (animation === 'fadeIn' || animation === 'slideIn') {
      animations.push(
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          delay,
          useNativeDriver: true,
        })
      );
    }

    if (animation === 'slideIn') {
      animations.push(
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 50,
          friction: 8,
          delay,
          useNativeDriver: true,
        })
      );
    }

    if (animation === 'scaleIn') {
      animations.push(
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          delay,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 50,
          friction: 6,
          delay,
          useNativeDriver: true,
        })
      );
    }

    if (animations.length > 0) {
      Animated.parallel(animations).start(onAnimationComplete);
    } else {
      fadeAnim.setValue(1);
      scaleAnim.setValue(1);
      slideAnim.setValue(0);
    }
  }, [animation, index, staggerDelay]);

  // Animation d'elimination
  useEffect(() => {
    if (isEliminated) {
      // Shake puis fade out
      Animated.sequence([
        Animated.sequence([
          Animated.timing(shakeAnim, { toValue: 15, duration: 50, useNativeDriver: true }),
          Animated.timing(shakeAnim, { toValue: -15, duration: 50, useNativeDriver: true }),
          Animated.timing(shakeAnim, { toValue: 15, duration: 50, useNativeDriver: true }),
          Animated.timing(shakeAnim, { toValue: -15, duration: 50, useNativeDriver: true }),
          Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
        ]),
        Animated.timing(eliminateAnim, {
          toValue: 0,
          duration: 300,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start(onAnimationComplete);
    } else {
      eliminateAnim.setValue(1);
    }
  }, [isEliminated]);

  // Animation de selection
  useEffect(() => {
    Animated.spring(selectAnim, {
      toValue: isSelected ? 1.05 : 1,
      tension: 100,
      friction: 8,
      useNativeDriver: true,
    }).start();
  }, [isSelected]);

  const getTransformStyle = () => {
    const transforms = [];

    if (animation === 'slideIn') {
      transforms.push({ translateY: slideAnim });
    }

    if (animation === 'scaleIn') {
      transforms.push({ scale: scaleAnim });
    }

    // Shake pour elimination
    transforms.push({ translateX: shakeAnim });

    // Scale pour selection
    transforms.push({ scale: selectAnim });

    return transforms;
  };

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: Animated.multiply(fadeAnim, eliminateAnim),
          transform: getTransformStyle(),
        },
      ]}
    >
      {children}
    </Animated.View>
  );
});

/**
 * Animation de flip 3D (pour revelation de role)
 */
export const FlipCard = memo(({
  frontContent,
  backContent,
  isFlipped = false,
  onFlipComplete,
  style,
}) => {
  const flipAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(flipAnim, {
      toValue: isFlipped ? 1 : 0,
      tension: 30,
      friction: 8,
      useNativeDriver: true,
    }).start(onFlipComplete);
  }, [isFlipped]);

  const frontInterpolate = flipAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  const backInterpolate = flipAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['180deg', '360deg'],
  });

  const frontOpacity = flipAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [1, 0, 0],
  });

  const backOpacity = flipAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 0, 1],
  });

  return (
    <View style={[styles.flipContainer, style]}>
      <Animated.View
        style={[
          styles.flipCard,
          {
            transform: [{ rotateY: frontInterpolate }],
            opacity: frontOpacity,
          },
        ]}
      >
        {frontContent}
      </Animated.View>
      <Animated.View
        style={[
          styles.flipCard,
          styles.flipCardBack,
          {
            transform: [{ rotateY: backInterpolate }],
            opacity: backOpacity,
          },
        ]}
      >
        {backContent}
      </Animated.View>
    </View>
  );
});

/**
 * Animation de pulse (pour badges, indicateurs)
 */
export const PulseView = memo(({
  children,
  isActive = true,
  style,
}) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isActive) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.15,
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
    } else {
      pulseAnim.setValue(1);
    }
  }, [isActive]);

  return (
    <Animated.View style={[style, { transform: [{ scale: pulseAnim }] }]}>
      {children}
    </Animated.View>
  );
});

/**
 * Animation de fade in/out
 */
export const FadeView = memo(({
  children,
  visible = true,
  duration = 300,
  style,
}) => {
  const fadeAnim = useRef(new Animated.Value(visible ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: visible ? 1 : 0,
      duration,
      useNativeDriver: true,
    }).start();
  }, [visible]);

  return (
    <Animated.View style={[style, { opacity: fadeAnim }]}>
      {children}
    </Animated.View>
  );
});

/**
 * Animation de slide
 */
export const SlideView = memo(({
  children,
  visible = true,
  direction = 'up', // 'up' | 'down' | 'left' | 'right'
  distance = 50,
  duration = 300,
  style,
}) => {
  const slideAnim = useRef(new Animated.Value(visible ? 0 : distance)).current;
  const fadeAnim = useRef(new Animated.Value(visible ? 1 : 0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(slideAnim, {
        toValue: visible ? 0 : distance,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: visible ? 1 : 0,
        duration,
        useNativeDriver: true,
      }),
    ]).start();
  }, [visible]);

  const getTransform = () => {
    switch (direction) {
      case 'up':
        return [{ translateY: slideAnim }];
      case 'down':
        return [{ translateY: Animated.multiply(slideAnim, -1) }];
      case 'left':
        return [{ translateX: slideAnim }];
      case 'right':
        return [{ translateX: Animated.multiply(slideAnim, -1) }];
      default:
        return [{ translateY: slideAnim }];
    }
  };

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: fadeAnim,
          transform: getTransform(),
        },
      ]}
    >
      {children}
    </Animated.View>
  );
});

/**
 * Bouton avec feedback tactile
 */
export const PressableScale = memo(({
  children,
  onPress,
  disabled = false,
  scaleTo = 0.95,
  style,
}) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: scaleTo,
      tension: 100,
      friction: 5,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      tension: 100,
      friction: 5,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Animated.View
      style={[style, { transform: [{ scale: scaleAnim }] }]}
    >
      <View
        onTouchStart={disabled ? undefined : handlePressIn}
        onTouchEnd={disabled ? undefined : handlePressOut}
        onTouchCancel={disabled ? undefined : handlePressOut}
      >
        {typeof children === 'function'
          ? children({ pressed: false })
          : children}
      </View>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  flipContainer: {
    perspective: 1000,
  },
  flipCard: {
    backfaceVisibility: 'hidden',
  },
  flipCardBack: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
});

export default AnimatedCard;
