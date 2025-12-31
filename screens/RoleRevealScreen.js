import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Animated,
  Dimensions,
  ActivityIndicator,
  Easing
} from 'react-native';
import { ref, onValue, off } from 'firebase/database';
import { database } from '../firebase';
import { getRoleById } from '../utils/roles';
import { useDevMode } from '../contexts/DevModeContext';
import colors from '../constants/colors';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH * 0.85;
const CARD_HEIGHT = CARD_WIDTH * 1.4;

// États de l'écran
const STATES = {
  HIDDEN: 'hidden',      // Écran noir, attente du tap
  FLIPPING: 'flipping',  // Animation en cours
  REVEALED: 'revealed',  // Rôle affiché
};

export default function RoleRevealScreen({ navigation, route }) {
  const { gameCode, playerId: initialPlayerId } = route.params;
  const { currentPlayerId, addLog, isDevModeEnabled } = useDevMode();

  // Utiliser le playerId du mode dev si disponible
  const playerId = currentPlayerId || initialPlayerId;

  // Mode dev : rôle simulé passé en paramètre
  const simulatedRole = route.params?.simulatedRole;
  const skipAnimation = route.params?.skipAnimation;

  const [playerData, setPlayerData] = useState(null);
  const [screenState, setScreenState] = useState(
    skipAnimation ? STATES.REVEALED : STATES.HIDDEN
  );
  const [isLoading, setIsLoading] = useState(!simulatedRole);

  // Animations
  const flipAnimation = useRef(new Animated.Value(0)).current;
  const pulseAnimation = useRef(new Animated.Value(1)).current;
  const fadeInAnimation = useRef(new Animated.Value(0)).current;
  const scaleAnimation = useRef(new Animated.Value(0.8)).current;

  // Charger les données du joueur (sauf si rôle simulé)
  useEffect(() => {
    if (simulatedRole) {
      setPlayerData({ role: simulatedRole, name: 'Test' });
      setIsLoading(false);
      return;
    }

    const playerRef = ref(database, `games/${gameCode}/players/${playerId}`);
    const unsubscribe = onValue(playerRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        setPlayerData(data);

        // RÈGLE CRITIQUE : Si c'est le MJ, rediriger vers GameMasterScreen
        if (data.isMaster) {
          if (__DEV__) addLog('MJ détecté - Redirection vers GameMaster');
          navigation.replace('GameMaster', { gameCode, playerId: initialPlayerId });
          return;
        }
      }
      setIsLoading(false);
    });

    return () => off(playerRef);
  }, [gameCode, playerId, simulatedRole]);

  // Animation de pulsation pour l'état caché
  useEffect(() => {
    if (screenState === STATES.HIDDEN) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnimation, {
            toValue: 1.15,
            duration: 1200,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnimation, {
            toValue: 1,
            duration: 1200,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [screenState, pulseAnimation]);

  // Lancer l'animation de flip
  const startReveal = () => {
    if (screenState !== STATES.HIDDEN) return;

    setScreenState(STATES.FLIPPING);
    if (__DEV__) addLog(`Révélation du rôle: ${playerData?.role}`);

    // Animation de flip (rotation Y simulée)
    Animated.sequence([
      // Phase 1 : La carte tourne (dos visible → tranche)
      Animated.timing(flipAnimation, {
        toValue: 0.5,
        duration: 400,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }),
      // Phase 2 : La carte continue (tranche → face visible)
      Animated.timing(flipAnimation, {
        toValue: 1,
        duration: 400,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start(() => {
      setScreenState(STATES.REVEALED);

      // Animation d'apparition du contenu
      Animated.parallel([
        Animated.timing(fadeInAnimation, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnimation, {
          toValue: 1,
          friction: 6,
          tension: 40,
          useNativeDriver: true,
        }),
      ]).start();
    });
  };

  // Continuer vers l'écran de jeu
  const continueToGame = () => {
    // TODO: Créer PlayerGameScreen - pour l'instant retour au lobby
    // navigation.replace('PlayerGame', { gameCode, playerId: initialPlayerId });

    // Temporairement : attendre dans le lobby
    navigation.replace('Lobby', {
      gameCode,
      playerId: initialPlayerId,
      isMaster: false,
      playerName: playerData?.name
    });
  };

  // Retour dev (bouton caché)
  const goBackDev = () => {
    navigation.goBack();
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Chargement de votre rôle...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const role = playerData?.role ? getRoleById(playerData.role) : null;
  const roleColor = role?.color || colors.primary;
  const teamColor = role?.team === 'loups' ? '#8B0000' : '#1E3A8A';

  // Interpolations pour l'animation de flip
  const frontInterpolate = flipAnimation.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ['0deg', '90deg', '90deg'],
  });

  const backInterpolate = flipAnimation.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ['90deg', '90deg', '0deg'],
  });

  const frontOpacity = flipAnimation.interpolate({
    inputRange: [0, 0.5],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const backOpacity = flipAnimation.interpolate({
    inputRange: [0.5, 1],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  // ==================== ÉTAT 1 : ÉCRAN CACHÉ ====================
  if (screenState === STATES.HIDDEN) {
    return (
      <TouchableOpacity
        style={styles.hiddenContainer}
        onPress={startReveal}
        activeOpacity={1}
      >
        <SafeAreaView style={styles.hiddenContent}>
          {/* Bouton dev caché (triple tap en haut à droite) */}
          {__DEV__ && (
            <TouchableOpacity
              style={styles.devBackButton}
              onPress={goBackDev}
            >
              <Text style={styles.devBackButtonText}>←</Text>
            </TouchableOpacity>
          )}

          {/* Carte dos */}
          <Animated.View
            style={[
              styles.cardBack,
              { transform: [{ scale: pulseAnimation }] }
            ]}
          >
            <Text style={styles.cardBackIcon}>🎴</Text>
            <View style={styles.cardBackPattern}>
              {[...Array(9)].map((_, i) => (
                <Text key={i} style={styles.patternIcon}>🐺</Text>
              ))}
            </View>
          </Animated.View>

          <Text style={styles.hiddenTitle}>Votre rôle vous attend...</Text>
          <Text style={styles.hiddenSubtitle}>Touchez l'écran pour révéler</Text>

          <View style={styles.warningBox}>
            <Text style={styles.warningIcon}>👀</Text>
            <Text style={styles.warningText}>
              Assurez-vous que personne ne regarde votre écran !
            </Text>
          </View>
        </SafeAreaView>
      </TouchableOpacity>
    );
  }

  // ==================== ÉTATS 2 & 3 : ANIMATION & RÉVÉLATION ====================
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: teamColor }]}>
      <View style={styles.revealContent}>
        {/* Bouton dev caché */}
        {__DEV__ && (
          <TouchableOpacity
            style={styles.devBackButton}
            onPress={goBackDev}
          >
            <Text style={styles.devBackButtonText}>←</Text>
          </TouchableOpacity>
        )}

        {/* Nom du joueur */}
        <Animated.Text
          style={[
            styles.playerNameHeader,
            {
              opacity: screenState === STATES.REVEALED ? fadeInAnimation : 0
            }
          ]}
        >
          {playerData?.name}
        </Animated.Text>

        {/* Container des cartes (flip) */}
        <View style={styles.cardContainer}>
          {/* Face arrière (dos de carte) */}
          <Animated.View
            style={[
              styles.card,
              styles.cardBackFace,
              {
                opacity: frontOpacity,
                transform: [
                  { perspective: 1000 },
                  { rotateY: frontInterpolate },
                ],
              },
            ]}
          >
            <Text style={styles.cardBackIcon}>🎴</Text>
            <View style={styles.cardBackPattern}>
              {[...Array(9)].map((_, i) => (
                <Text key={i} style={styles.patternIcon}>🐺</Text>
              ))}
            </View>
          </Animated.View>

          {/* Face avant (rôle révélé) */}
          <Animated.View
            style={[
              styles.card,
              styles.cardFrontFace,
              { backgroundColor: roleColor },
              {
                opacity: backOpacity,
                transform: [
                  { perspective: 1000 },
                  { rotateY: backInterpolate },
                ],
              },
            ]}
          >
            <Animated.View
              style={[
                styles.cardContent,
                {
                  opacity: fadeInAnimation,
                  transform: [{ scale: scaleAnimation }],
                },
              ]}
            >
              {/* Badge équipe */}
              <View style={[styles.teamBadge, { backgroundColor: teamColor }]}>
                <Text style={styles.teamBadgeText}>
                  {role?.team === 'loups' ? '🐺 LOUP-GAROU' : '🏘️ VILLAGE'}
                </Text>
              </View>

              {/* Icône du rôle */}
              <View style={styles.roleIconWrapper}>
                <Text style={styles.roleIcon}>{role?.icon || '❓'}</Text>
              </View>

              {/* Nom du rôle */}
              <Text style={styles.roleName}>{role?.name || 'Inconnu'}</Text>

              {/* Description */}
              <View style={styles.infoSection}>
                <Text style={styles.infoTitle}>Votre mission</Text>
                <Text style={styles.infoText}>{role?.description}</Text>
              </View>

              {/* Pouvoir */}
              <View style={[styles.infoSection, styles.powerSection]}>
                <Text style={styles.powerTitle}>✨ Pouvoir</Text>
                <Text style={styles.powerText}>{role?.power}</Text>
              </View>
            </Animated.View>
          </Animated.View>
        </View>

        {/* Bouton continuer (visible seulement après révélation) */}
        {screenState === STATES.REVEALED && (
          <Animated.View
            style={[
              styles.continueContainer,
              { opacity: fadeInAnimation }
            ]}
          >
            <TouchableOpacity
              style={styles.continueButton}
              onPress={continueToGame}
            >
              <Text style={styles.continueButtonText}>J'ai compris mon rôle</Text>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* Indicateur pendant l'animation */}
        {screenState === STATES.FLIPPING && (
          <View style={styles.flippingIndicator}>
            <Text style={styles.flippingText}>Révélation en cours...</Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: colors.textSecondary,
    marginTop: 15,
    fontSize: 16,
  },

  // ==================== ÉTAT CACHÉ ====================
  hiddenContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  hiddenContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  devBackButton: {
    position: 'absolute',
    top: 50,
    left: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  devBackButtonText: {
    color: '#666',
    fontSize: 20,
  },
  cardBack: {
    width: CARD_WIDTH * 0.6,
    height: CARD_HEIGHT * 0.6,
    backgroundColor: '#1a1a2e',
    borderRadius: 20,
    borderWidth: 3,
    borderColor: '#FFD700',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 40,
    overflow: 'hidden',
  },
  cardBackIcon: {
    fontSize: 60,
    position: 'absolute',
    zIndex: 1,
  },
  cardBackPattern: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    opacity: 0.15,
    padding: 20,
  },
  patternIcon: {
    fontSize: 30,
    margin: 8,
  },
  hiddenTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 10,
  },
  hiddenSubtitle: {
    fontSize: 18,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 40,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 193, 7, 0.15)',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 193, 7, 0.3)',
  },
  warningIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  warningText: {
    color: colors.warning,
    fontSize: 14,
    flex: 1,
    textAlign: 'center',
  },

  // ==================== ÉTAT RÉVÉLATION ====================
  revealContent: {
    flex: 1,
    alignItems: 'center',
    padding: 20,
    paddingTop: 60,
  },
  playerNameHeader: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 20,
    fontWeight: '600',
  },
  cardContainer: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    marginBottom: 30,
  },
  card: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: 24,
    backfaceVisibility: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 15,
  },
  cardBackFace: {
    backgroundColor: '#1a1a2e',
    borderWidth: 4,
    borderColor: '#FFD700',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  cardFrontFace: {
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.3)',
    overflow: 'hidden',
  },
  cardContent: {
    flex: 1,
    alignItems: 'center',
    padding: 20,
    paddingTop: 15,
  },
  teamBadge: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 15,
  },
  teamBadgeText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 12,
    letterSpacing: 1,
  },
  roleIconWrapper: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  roleIcon: {
    fontSize: 55,
  },
  roleName: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFF',
    textAlign: 'center',
    marginBottom: 20,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  infoSection: {
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 12,
    padding: 12,
    width: '100%',
    marginBottom: 12,
  },
  infoTitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '600',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  infoText: {
    fontSize: 14,
    color: '#FFF',
    lineHeight: 20,
  },
  powerSection: {
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.4)',
  },
  powerTitle: {
    fontSize: 12,
    color: '#FFD700',
    fontWeight: '600',
    marginBottom: 6,
  },
  powerText: {
    fontSize: 13,
    color: '#FFF',
    lineHeight: 18,
  },

  // ==================== BOUTONS ====================
  continueContainer: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
  },
  continueButton: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  continueButtonText: {
    color: '#1a1a2e',
    fontSize: 18,
    fontWeight: 'bold',
  },
  flippingIndicator: {
    position: 'absolute',
    bottom: 60,
  },
  flippingText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 16,
  },
});
