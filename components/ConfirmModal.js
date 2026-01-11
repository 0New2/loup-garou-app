import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Animated,
  Easing,
} from 'react-native';
import colors from '../constants/colors';

/**
 * Types de confirmation predefinies
 */
export const CONFIRM_TYPES = {
  LEAVE_GAME: {
    icon: '🚪',
    title: 'Quitter la partie ?',
    message: 'Etes-vous sur de vouloir quitter cette partie ?',
    confirmText: 'Quitter',
    confirmStyle: 'danger',
  },
  END_GAME: {
    icon: '🏁',
    title: 'Terminer la partie ?',
    message: 'Tous les joueurs seront deconnectes et la partie sera terminee.',
    confirmText: 'Terminer',
    confirmStyle: 'danger',
  },
  SKIP_TIMER: {
    icon: '⏱️',
    title: 'Timer en cours',
    message: 'Le timer n\'est pas termine. Voulez-vous forcer le passage a la phase suivante ?',
    confirmText: 'Forcer',
    confirmStyle: 'warning',
  },
  VOTE_CONFIRM: {
    icon: '🗳️',
    title: 'Confirmer votre vote',
    message: 'Vous ne pourrez pas changer votre vote.',
    confirmText: 'Voter',
    confirmStyle: 'primary',
  },
  ELIMINATE_PLAYER: {
    icon: '💀',
    title: 'Eliminer ce joueur ?',
    message: 'Cette action est irreversible.',
    confirmText: 'Eliminer',
    confirmStyle: 'danger',
  },
  RESET_GAME: {
    icon: '🔄',
    title: 'Reinitialiser ?',
    message: 'Toutes les donnees de la partie seront effacees.',
    confirmText: 'Reinitialiser',
    confirmStyle: 'danger',
  },
  GENERIC: {
    icon: '❓',
    title: 'Confirmation',
    message: 'Etes-vous sur ?',
    confirmText: 'Confirmer',
    confirmStyle: 'primary',
  },
};

/**
 * Modal de confirmation reutilisable
 *
 * @param {boolean} visible - Afficher ou non
 * @param {string} type - Type de confirmation (voir CONFIRM_TYPES)
 * @param {string} customTitle - Titre personnalise
 * @param {string} customMessage - Message personnalise
 * @param {string} targetName - Nom de la cible (ex: nom du joueur)
 * @param {function} onConfirm - Callback de confirmation
 * @param {function} onCancel - Callback d'annulation
 * @param {boolean} isLoading - Afficher un loading pendant l'action
 */
export default function ConfirmModal({
  visible = false,
  type = 'GENERIC',
  customTitle,
  customMessage,
  targetName,
  onConfirm,
  onCancel,
  isLoading = false,
}) {
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const confirmInfo = CONFIRM_TYPES[type] || CONFIRM_TYPES.GENERIC;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 50,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      scaleAnim.setValue(0.8);
      fadeAnim.setValue(0);
    }
  }, [visible]);

  const getConfirmButtonStyle = () => {
    switch (confirmInfo.confirmStyle) {
      case 'danger':
        return styles.confirmButtonDanger;
      case 'warning':
        return styles.confirmButtonWarning;
      default:
        return styles.confirmButtonPrimary;
    }
  };

  // Remplacer {name} dans le message
  const finalMessage = (customMessage || confirmInfo.message)
    .replace('{name}', targetName || '');

  const finalTitle = (customTitle || confirmInfo.title)
    .replace('{name}', targetName || '');

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onCancel}
    >
      <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
        <Animated.View
          style={[
            styles.modalContent,
            { transform: [{ scale: scaleAnim }] },
          ]}
        >
          <View style={styles.iconContainer}>
            <Text style={styles.icon}>{confirmInfo.icon}</Text>
          </View>

          <Text style={styles.title}>{finalTitle}</Text>
          <Text style={styles.message}>{finalMessage}</Text>

          <View style={styles.buttonsContainer}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={onCancel}
              disabled={isLoading}
            >
              <Text style={styles.cancelButtonText}>Annuler</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, getConfirmButtonStyle()]}
              onPress={onConfirm}
              disabled={isLoading}
            >
              {isLoading ? (
                <Text style={styles.confirmButtonText}>...</Text>
              ) : (
                <Text style={styles.confirmButtonText}>
                  {confirmInfo.confirmText}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

/**
 * Hook pour gerer les confirmations facilement
 */
export function useConfirmation() {
  const [state, setState] = React.useState({
    visible: false,
    type: 'GENERIC',
    customTitle: null,
    customMessage: null,
    targetName: null,
    onConfirm: null,
    isLoading: false,
  });

  const show = ({
    type = 'GENERIC',
    customTitle,
    customMessage,
    targetName,
  }) => {
    return new Promise((resolve) => {
      setState({
        visible: true,
        type,
        customTitle,
        customMessage,
        targetName,
        onConfirm: () => {
          setState((prev) => ({ ...prev, visible: false }));
          resolve(true);
        },
        isLoading: false,
      });
    });
  };

  const hide = () => {
    setState((prev) => ({ ...prev, visible: false }));
  };

  const setLoading = (loading) => {
    setState((prev) => ({ ...prev, isLoading: loading }));
  };

  const ConfirmModalComponent = (
    <ConfirmModal
      visible={state.visible}
      type={state.type}
      customTitle={state.customTitle}
      customMessage={state.customMessage}
      targetName={state.targetName}
      onConfirm={state.onConfirm}
      onCancel={hide}
      isLoading={state.isLoading}
    />
  );

  return { show, hide, setLoading, ConfirmModal: ConfirmModalComponent };
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: colors.backgroundCard,
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 320,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 20,
  },
  iconContainer: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: colors.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  icon: {
    fontSize: 36,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  buttonsContainer: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: colors.backgroundSecondary,
  },
  cancelButtonText: {
    color: colors.textSecondary,
    fontSize: 16,
    fontWeight: '600',
  },
  confirmButtonPrimary: {
    backgroundColor: colors.primary,
  },
  confirmButtonDanger: {
    backgroundColor: colors.danger,
  },
  confirmButtonWarning: {
    backgroundColor: colors.warning,
  },
  confirmButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
