import React, { useEffect, useRef, useState, createContext, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
} from 'react-native';
import colors from '../constants/colors';

/**
 * Context pour les toasts globaux
 */
const ToastContext = createContext();

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const show = (config) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, ...config }]);

    // Auto dismiss
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, config.duration || 3000);

    return id;
  };

  const hide = (id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const success = (message, duration = 2500) => show({ type: 'success', message, duration });
  const error = (message, duration = 3500) => show({ type: 'error', message, duration });
  const warning = (message, duration = 3000) => show({ type: 'warning', message, duration });
  const info = (message, duration = 3000) => show({ type: 'info', message, duration });

  return (
    <ToastContext.Provider value={{ show, hide, success, error, warning, info }}>
      {children}
      <ToastContainer toasts={toasts} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    // Fallback si pas dans le provider
    return {
      show: () => {},
      success: () => {},
      error: () => {},
      warning: () => {},
      info: () => {},
    };
  }
  return context;
}

/**
 * Container pour afficher les toasts
 */
function ToastContainer({ toasts }) {
  return (
    <View style={styles.container} pointerEvents="none">
      {toasts.map((toast, index) => (
        <Toast key={toast.id} {...toast} index={index} />
      ))}
    </View>
  );
}

/**
 * Toast individuel
 */
function Toast({ type = 'info', message, index }) {
  const translateY = useRef(new Animated.Value(100)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.8)).current;

  const config = {
    success: {
      icon: '✓',
      backgroundColor: colors.success,
      borderColor: '#059669',
    },
    error: {
      icon: '✕',
      backgroundColor: colors.danger,
      borderColor: '#B91C1C',
    },
    warning: {
      icon: '⚠',
      backgroundColor: colors.warning,
      borderColor: '#D97706',
    },
    info: {
      icon: 'ℹ',
      backgroundColor: colors.secondary,
      borderColor: '#1E40AF',
    },
  }[type];

  useEffect(() => {
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        tension: 50,
        friction: 6,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <Animated.View
      style={[
        styles.toast,
        {
          backgroundColor: config.backgroundColor,
          borderColor: config.borderColor,
          opacity,
          transform: [
            { translateY },
            { scale },
          ],
          marginBottom: index * 10,
        },
      ]}
    >
      <View style={styles.iconContainer}>
        <Text style={styles.icon}>{config.icon}</Text>
      </View>
      <Text style={styles.message} numberOfLines={2}>
        {message}
      </Text>
    </Animated.View>
  );
}

/**
 * Toast simple sans context (usage standalone)
 */
export function SimpleToast({
  visible,
  type = 'info',
  message,
  position = 'bottom', // 'top' | 'bottom'
}) {
  const translateY = useRef(new Animated.Value(position === 'bottom' ? 100 : -100)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  const config = {
    success: { icon: '✓', backgroundColor: colors.success },
    error: { icon: '✕', backgroundColor: colors.danger },
    warning: { icon: '⚠', backgroundColor: colors.warning },
    info: { icon: 'ℹ', backgroundColor: colors.secondary },
  }[type];

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          tension: 50,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: position === 'bottom' ? 100 : -100,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  if (!visible && opacity._value === 0) return null;

  return (
    <Animated.View
      style={[
        styles.simpleToast,
        {
          backgroundColor: config.backgroundColor,
          [position]: 100,
          opacity,
          transform: [{ translateY }],
        },
      ]}
    >
      <Text style={styles.icon}>{config.icon}</Text>
      <Text style={styles.message}>{message}</Text>
    </Animated.View>
  );
}

/**
 * Feedback inline pour actions
 */
export function ActionFeedback({
  status, // 'idle' | 'loading' | 'success' | 'error'
  successMessage = 'Action reussie',
  errorMessage = 'Action echouee',
}) {
  const scaleAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (status === 'success' || status === 'error') {
      Animated.sequence([
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 50,
          friction: 5,
          useNativeDriver: true,
        }),
        Animated.delay(1500),
        Animated.timing(scaleAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [status]);

  if (status === 'idle' || status === 'loading') return null;

  return (
    <Animated.View
      style={[
        styles.actionFeedback,
        {
          backgroundColor: status === 'success' ? colors.success : colors.danger,
          transform: [{ scale: scaleAnim }],
        },
      ]}
    >
      <Text style={styles.actionFeedbackIcon}>
        {status === 'success' ? '✓' : '✕'}
      </Text>
      <Text style={styles.actionFeedbackText}>
        {status === 'success' ? successMessage : errorMessage}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 100,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 9999,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginHorizontal: 20,
    minWidth: 200,
    maxWidth: '90%',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  iconContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  icon: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  message: {
    flex: 1,
    color: '#FFF',
    fontSize: 14,
    fontWeight: '500',
  },

  // Simple toast
  simpleToast: {
    position: 'absolute',
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
    zIndex: 9999,
  },

  // Action feedback
  actionFeedback: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -75,
    marginTop: -30,
    width: 150,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
    zIndex: 9999,
  },
  actionFeedbackIcon: {
    color: '#FFF',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  actionFeedbackText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '500',
  },
});
