import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Alert,
  ActivityIndicator,
  Modal,
  Dimensions
} from 'react-native';
import { ref, onValue, off, update, set, push } from 'firebase/database';
import { database } from '../firebase';
import { getRoleById, ROLES } from '../utils/roles';
import { useDevMode } from '../contexts/DevModeContext';
import PlayerCard from '../components/PlayerCard';
import colors from '../constants/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Phases du jeu avec détails
const PHASES = {
  role_reveal: {
    name: 'Révélation des rôles',
    icon: '🎭',
    description: 'Les joueurs découvrent leur rôle secret.',
    next: 'night_start',
    color: '#7C3AED',
  },
  night_start: {
    name: 'Début de nuit',
    icon: '🌙',
    description: 'Le village s\'endort... Les créatures de la nuit s\'éveillent.',
    next: 'night_cupid',
    color: '#1E3A8A',
  },
  night_cupid: {
    name: 'Tour de Cupidon',
    icon: '💘',
    description: 'Cupidon choisit deux amoureux qui partageront leur destin.',
    next: 'night_werewolves',
    color: '#EC4899',
    optional: true,
  },
  night_werewolves: {
    name: 'Tour des Loups-Garous',
    icon: '🐺',
    description: 'Les Loups-Garous se réveillent et choisissent une victime.',
    next: 'night_seer',
    color: '#8B0000',
  },
  night_seer: {
    name: 'Tour de la Voyante',
    icon: '🔮',
    description: 'La Voyante peut découvrir l\'identité d\'un joueur.',
    next: 'night_witch',
    color: '#8B5CF6',
    optional: true,
  },
  night_witch: {
    name: 'Tour de la Sorcière',
    icon: '🧪',
    description: 'La Sorcière peut sauver ou empoisonner un joueur.',
    next: 'day_announcement',
    color: '#059669',
    optional: true,
  },
  day_announcement: {
    name: 'Annonce du jour',
    icon: '☀️',
    description: 'Le village se réveille et découvre les victimes de la nuit.',
    next: 'day_discussion',
    color: '#F59E0B',
  },
  day_discussion: {
    name: 'Discussion',
    icon: '💬',
    description: 'Les villageois débattent pour trouver les Loups-Garous.',
    next: 'day_vote',
    color: '#3B82F6',
  },
  day_vote: {
    name: 'Vote du village',
    icon: '🗳️',
    description: 'Le village vote pour éliminer un suspect.',
    next: 'vote_result',
    color: '#EF4444',
  },
  vote_result: {
    name: 'Résultat du vote',
    icon: '⚖️',
    description: 'Le joueur le plus voté est éliminé.',
    next: 'night_start',
    color: '#6B7280',
  },
  finished: {
    name: 'Partie terminée',
    icon: '🏆',
    description: 'La partie est terminée !',
    next: null,
    color: '#10B981',
  },
};

// Durées de timer prédéfinies (en secondes)
const TIMER_PRESETS = [
  { label: '30s', value: 30 },
  { label: '1min', value: 60 },
  { label: '2min', value: 120 },
  { label: '5min', value: 300 },
  { label: '10min', value: 600 },
  { label: '∞', value: null },
];

export default function GameMasterScreen({ navigation, route }) {
  const { gameCode, playerId } = route.params;
  const { addLog, setGameContext } = useDevMode();

  // États principaux
  const [players, setPlayers] = useState([]);
  const [gameState, setGameState] = useState(null);
  const [gameConfig, setGameConfig] = useState(null);
  const [actions, setActions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  // États du timer
  const [timerValue, setTimerValue] = useState(null);
  const [timerDuration, setTimerDuration] = useState(120);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [autoNextPhase, setAutoNextPhase] = useState(false);
  const timerRef = useRef(null);

  // États des modals
  const [showBonusModal, setShowBonusModal] = useState(false);
  const [selectedPlayerForBonus, setSelectedPlayerForBonus] = useState(null);
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [showPlayerModal, setShowPlayerModal] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState(null);

  // Initialiser le contexte dev
  useEffect(() => {
    if (__DEV__) {
      setGameContext(gameCode, playerId, true);
      addLog('GameMasterScreen ouvert');
    }
  }, []);

  // Charger les données Firebase
  useEffect(() => {
    const playersRef = ref(database, `games/${gameCode}/players`);
    const stateRef = ref(database, `games/${gameCode}/gameState`);
    const configRef = ref(database, `games/${gameCode}/config`);
    const actionsRef = ref(database, `games/${gameCode}/actions`);

    const unsubPlayers = onValue(playersRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const list = Object.entries(data).map(([id, info]) => ({ id, ...info }));
        // Trier : vivants d'abord, puis alphabétique
        list.sort((a, b) => {
          if (a.isMaster !== b.isMaster) return a.isMaster ? 1 : -1;
          if (a.isAlive !== b.isAlive) return a.isAlive ? -1 : 1;
          return a.name.localeCompare(b.name);
        });
        setPlayers(list);
      }
      setIsLoading(false);
    });

    const unsubState = onValue(stateRef, (snapshot) => {
      if (snapshot.exists()) {
        setGameState(snapshot.val());
        // Synchroniser le timer si présent
        const state = snapshot.val();
        if (state.timer !== undefined) {
          setTimerValue(state.timer);
        }
        if (state.timerRunning !== undefined) {
          setIsTimerRunning(state.timerRunning);
        }
      }
    });

    const unsubConfig = onValue(configRef, (snapshot) => {
      setGameConfig(snapshot.exists() ? snapshot.val() : null);
    });

    const unsubActions = onValue(actionsRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        // Convertir en tableau et trier par timestamp
        const actionsList = [];
        Object.entries(data).forEach(([nightKey, nightActions]) => {
          Object.entries(nightActions).forEach(([actionId, action]) => {
            actionsList.push({
              id: actionId,
              night: nightKey,
              ...action,
            });
          });
        });
        actionsList.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        setActions(actionsList.slice(0, 20)); // Garder les 20 dernières
      }
    });

    return () => {
      off(playersRef);
      off(stateRef);
      off(configRef);
      off(actionsRef);
    };
  }, [gameCode]);

  // Gestion du timer local
  useEffect(() => {
    if (isTimerRunning && timerValue !== null && timerValue > 0) {
      timerRef.current = setInterval(() => {
        setTimerValue((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            setIsTimerRunning(false);
            // Synchroniser avec Firebase
            update(ref(database), {
              [`games/${gameCode}/gameState/timer`]: 0,
              [`games/${gameCode}/gameState/timerRunning`]: false,
            });
            // Auto next phase si activé
            if (autoNextPhase) {
              setTimeout(() => nextPhase(), 1000);
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isTimerRunning, timerValue, autoNextPhase]);

  // Joueurs sans le MJ
  const gamePlayers = players.filter(p => !p.isMaster);
  const alivePlayers = gamePlayers.filter(p => p.isAlive !== false);
  const deadPlayers = gamePlayers.filter(p => p.isAlive === false);

  // Statistiques
  const werewolvesAlive = alivePlayers.filter(p => {
    const role = getRoleById(p.role);
    return role?.team === 'loups';
  }).length;
  const villagersAlive = alivePlayers.filter(p => {
    const role = getRoleById(p.role);
    return role?.team === 'village';
  }).length;

  // Phase actuelle
  const currentPhase = gameState?.currentPhase || 'role_reveal';
  const phaseInfo = PHASES[currentPhase] || PHASES.role_reveal;
  const nightCount = gameState?.nightCount || 0;

  // ==================== ACTIONS ====================

  // Passer à la phase suivante
  const nextPhase = async () => {
    const next = phaseInfo.next;
    if (!next) {
      Alert.alert('Fin de partie', 'La partie est terminée.');
      return;
    }

    setIsProcessing(true);
    try {
      const updates = {};
      updates[`games/${gameCode}/gameState/currentPhase`] = next;
      updates[`games/${gameCode}/gameState/lastPhaseChange`] = Date.now();

      // Incrémenter le compteur de nuits si on recommence
      if (next === 'night_start') {
        updates[`games/${gameCode}/gameState/nightCount`] = nightCount + 1;
      }

      // Mettre à jour le statut si nécessaire
      if (gameConfig?.status === 'roles_distributed') {
        updates[`games/${gameCode}/config/status`] = 'playing';
      }

      // Réinitialiser le timer
      updates[`games/${gameCode}/gameState/timer`] = timerDuration;
      updates[`games/${gameCode}/gameState/timerRunning`] = false;

      await update(ref(database), updates);

      // Logger l'action
      await logAction(`Phase: ${phaseInfo.name} → ${PHASES[next]?.name}`);

      if (__DEV__) addLog(`Phase: ${currentPhase} → ${next}`);
    } catch (error) {
      console.error('Erreur changement phase:', error);
      Alert.alert('Erreur', 'Impossible de changer de phase.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Forcer une phase spécifique
  const forcePhase = async (phase) => {
    setIsProcessing(true);
    try {
      await update(ref(database), {
        [`games/${gameCode}/gameState/currentPhase`]: phase,
        [`games/${gameCode}/gameState/lastPhaseChange`]: Date.now(),
      });
      await logAction(`Phase forcée: ${PHASES[phase]?.name}`);
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de forcer la phase.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Logger une action
  const logAction = async (message, type = 'system') => {
    try {
      const nightKey = `night-${nightCount || 1}`;
      const actionRef = ref(database, `games/${gameCode}/actions/${nightKey}`);
      await push(actionRef, {
        message,
        type,
        timestamp: Date.now(),
      });
    } catch (error) {
      console.error('Erreur log action:', error);
    }
  };

  // ==================== TIMER ====================

  const startTimer = async () => {
    if (timerDuration === null) return; // Timer infini

    const newValue = timerValue || timerDuration;
    setTimerValue(newValue);
    setIsTimerRunning(true);

    await update(ref(database), {
      [`games/${gameCode}/gameState/timer`]: newValue,
      [`games/${gameCode}/gameState/timerRunning`]: true,
    });
  };

  const pauseTimer = async () => {
    setIsTimerRunning(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    await update(ref(database), {
      [`games/${gameCode}/gameState/timerRunning`]: false,
    });
  };

  const resetTimer = async () => {
    setIsTimerRunning(false);
    setTimerValue(timerDuration);
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    await update(ref(database), {
      [`games/${gameCode}/gameState/timer`]: timerDuration,
      [`games/${gameCode}/gameState/timerRunning`]: false,
    });
  };

  const setTimerPreset = (value) => {
    setTimerDuration(value);
    setTimerValue(value);
    setIsTimerRunning(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
  };

  // Formater le temps
  const formatTime = (seconds) => {
    if (seconds === null) return '∞';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // ==================== JOUEURS ====================

  // Éliminer/Ressusciter un joueur
  const togglePlayerAlive = async (player, reason = 'unknown') => {
    const newIsAlive = player.isAlive === false;

    try {
      const updates = {};
      updates[`games/${gameCode}/players/${player.id}/isAlive`] = newIsAlive;
      if (!newIsAlive) {
        updates[`games/${gameCode}/players/${player.id}/deathReason`] = reason;
      } else {
        updates[`games/${gameCode}/players/${player.id}/deathReason`] = null;
      }

      await update(ref(database), updates);

      const actionMessage = newIsAlive
        ? `${player.name} a été ressuscité`
        : `${player.name} a été éliminé (${reason})`;
      await logAction(actionMessage, newIsAlive ? 'revive' : 'death');

      if (__DEV__) addLog(actionMessage);
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de modifier le statut du joueur.');
    }
  };

  // Ajouter un rôle bonus
  const addBonusRole = async (playerId, roleId) => {
    try {
      await set(ref(database, `games/${gameCode}/players/${playerId}/bonusRole`), roleId);

      const player = players.find(p => p.id === playerId);
      const role = getRoleById(roleId);
      await logAction(`${player?.name} a reçu le rôle bonus: ${role?.name}`, 'bonus');

      setShowBonusModal(false);
      setSelectedPlayerForBonus(null);

      if (__DEV__) addLog(`Rôle bonus: ${player?.name} → ${role?.name}`);
    } catch (error) {
      Alert.alert('Erreur', 'Impossible d\'ajouter le rôle bonus.');
    }
  };

  // ==================== ACTIONS RAPIDES ====================

  // Mettre la partie en pause
  const togglePause = async () => {
    const newPaused = !gameState?.isPaused;

    try {
      await update(ref(database), {
        [`games/${gameCode}/gameState/isPaused`]: newPaused,
      });

      if (newPaused) {
        pauseTimer();
        await logAction('Partie mise en pause', 'system');
      } else {
        await logAction('Partie reprise', 'system');
      }
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de modifier le statut de la partie.');
    }
  };

  // Terminer la partie
  const endGame = () => {
    Alert.alert(
      'Terminer la partie',
      'Voulez-vous vraiment terminer cette partie ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Terminer',
          style: 'destructive',
          onPress: async () => {
            try {
              await update(ref(database), {
                [`games/${gameCode}/config/status`]: 'finished',
                [`games/${gameCode}/gameState/currentPhase`]: 'finished',
                [`games/${gameCode}/gameState/endedAt`]: Date.now(),
              });
              navigation.replace('Menu');
            } catch (error) {
              Alert.alert('Erreur', 'Impossible de terminer la partie.');
            }
          }
        }
      ]
    );
  };

  // ==================== MODALS ====================

  // Modal rôle bonus
  const renderBonusModal = () => (
    <Modal
      visible={showBonusModal}
      transparent
      animationType="slide"
      onRequestClose={() => setShowBonusModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>🎁 Rôle Bonus</Text>
            <TouchableOpacity onPress={() => setShowBonusModal(false)}>
              <Text style={styles.modalClose}>✕</Text>
            </TouchableOpacity>
          </View>

          {!selectedPlayerForBonus ? (
            <>
              <Text style={styles.modalSubtitle}>Sélectionnez un joueur</Text>
              <ScrollView style={styles.modalList}>
                {alivePlayers.map(player => (
                  <TouchableOpacity
                    key={player.id}
                    style={styles.modalItem}
                    onPress={() => setSelectedPlayerForBonus(player)}
                  >
                    <Text style={styles.modalItemIcon}>
                      {getRoleById(player.role)?.icon || '❓'}
                    </Text>
                    <Text style={styles.modalItemText}>{player.name}</Text>
                    {player.bonusRole && (
                      <Text style={styles.modalItemBadge}>Déjà un bonus</Text>
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </>
          ) : (
            <>
              <Text style={styles.modalSubtitle}>
                Rôle bonus pour {selectedPlayerForBonus.name}
              </Text>
              <ScrollView style={styles.modalList}>
                {Object.values(ROLES).map(role => (
                  <TouchableOpacity
                    key={role.id}
                    style={[styles.modalItem, { borderLeftColor: role.color }]}
                    onPress={() => addBonusRole(selectedPlayerForBonus.id, role.id)}
                  >
                    <Text style={styles.modalItemIcon}>{role.icon}</Text>
                    <View style={styles.modalItemInfo}>
                      <Text style={[styles.modalItemText, { color: role.color }]}>
                        {role.name}
                      </Text>
                      <Text style={styles.modalItemDesc} numberOfLines={1}>
                        {role.power}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <TouchableOpacity
                style={styles.modalBackButton}
                onPress={() => setSelectedPlayerForBonus(null)}
              >
                <Text style={styles.modalBackButtonText}>← Retour</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </Modal>
  );

  // Modal règles
  const renderRulesModal = () => (
    <Modal
      visible={showRulesModal}
      transparent
      animationType="slide"
      onRequestClose={() => setShowRulesModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>📜 Règles</Text>
            <TouchableOpacity onPress={() => setShowRulesModal(false)}>
              <Text style={styles.modalClose}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.rulesContent}>
            <Text style={styles.rulesTitle}>🐺 Loups-Garous</Text>
            <Text style={styles.rulesText}>
              Chaque nuit, les Loups-Garous se réveillent et choisissent une victime à dévorer.
            </Text>

            <Text style={styles.rulesTitle}>🏘️ Villageois</Text>
            <Text style={styles.rulesText}>
              Les Villageois doivent trouver et éliminer tous les Loups-Garous avant d'être tous dévorés.
            </Text>

            <Text style={styles.rulesTitle}>🔮 Voyante</Text>
            <Text style={styles.rulesText}>
              Chaque nuit, la Voyante peut découvrir le rôle d'un joueur.
            </Text>

            <Text style={styles.rulesTitle}>🧪 Sorcière</Text>
            <Text style={styles.rulesText}>
              La Sorcière possède deux potions : une de vie (sauve la victime) et une de mort.
            </Text>

            <Text style={styles.rulesTitle}>🏹 Chasseur</Text>
            <Text style={styles.rulesText}>
              Quand il meurt, le Chasseur emporte quelqu'un avec lui.
            </Text>

            <Text style={styles.rulesTitle}>💘 Cupidon</Text>
            <Text style={styles.rulesText}>
              La première nuit, Cupidon désigne deux amoureux. Si l'un meurt, l'autre aussi.
            </Text>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  // Modal détails joueur
  const renderPlayerModal = () => (
    <Modal
      visible={showPlayerModal}
      transparent
      animationType="slide"
      onRequestClose={() => setShowPlayerModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {selectedPlayer && (
            <>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {getRoleById(selectedPlayer.role)?.icon} {selectedPlayer.name}
                </Text>
                <TouchableOpacity onPress={() => setShowPlayerModal(false)}>
                  <Text style={styles.modalClose}>✕</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.playerModalContent}>
                <View style={[
                  styles.playerModalRole,
                  { backgroundColor: getRoleById(selectedPlayer.role)?.color || '#333' }
                ]}>
                  <Text style={styles.playerModalRoleIcon}>
                    {getRoleById(selectedPlayer.role)?.icon || '❓'}
                  </Text>
                  <Text style={styles.playerModalRoleName}>
                    {getRoleById(selectedPlayer.role)?.name || 'Sans rôle'}
                  </Text>
                </View>

                <Text style={styles.playerModalInfo}>
                  {getRoleById(selectedPlayer.role)?.description}
                </Text>

                <Text style={styles.playerModalPower}>
                  ✨ {getRoleById(selectedPlayer.role)?.power}
                </Text>

                <View style={styles.playerModalActions}>
                  <TouchableOpacity
                    style={[styles.playerModalBtn, styles.killBtn]}
                    onPress={() => {
                      togglePlayerAlive(selectedPlayer, 'werewolves');
                      setShowPlayerModal(false);
                    }}
                  >
                    <Text style={styles.playerModalBtnText}>🐺 Dévoré</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.playerModalBtn, styles.voteBtn]}
                    onPress={() => {
                      togglePlayerAlive(selectedPlayer, 'vote');
                      setShowPlayerModal(false);
                    }}
                  >
                    <Text style={styles.playerModalBtnText}>⚖️ Pendu</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.playerModalBtn, styles.poisonBtn]}
                    onPress={() => {
                      togglePlayerAlive(selectedPlayer, 'witch_poison');
                      setShowPlayerModal(false);
                    }}
                  >
                    <Text style={styles.playerModalBtnText}>🧪 Poison</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );

  // ==================== RENDU ====================

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Chargement...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Indicateur de pause */}
      {gameState?.isPaused && (
        <View style={styles.pauseBanner}>
          <Text style={styles.pauseText}>⏸️ PARTIE EN PAUSE</Text>
        </View>
      )}

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* ==================== HEADER ==================== */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View style={styles.mjBadge}>
              <Text style={styles.mjBadgeText}>🎮 MAÎTRE DU JEU</Text>
            </View>
            <View style={styles.gameCodeBadge}>
              <Text style={styles.gameCodeText}>{gameCode}</Text>
            </View>
          </View>

          {/* Phase actuelle */}
          <View style={[styles.phaseCard, { backgroundColor: phaseInfo.color }]}>
            <Text style={styles.phaseIcon}>{phaseInfo.icon}</Text>
            <View style={styles.phaseInfo}>
              <Text style={styles.phaseName}>{phaseInfo.name}</Text>
              <Text style={styles.phaseDescription}>{phaseInfo.description}</Text>
            </View>
          </View>

          {/* Stats rapides */}
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{alivePlayers.length}</Text>
              <Text style={styles.statLabel}>Vivants</Text>
            </View>
            <View style={[styles.statBox, styles.statBoxWolf]}>
              <Text style={styles.statValue}>{werewolvesAlive}</Text>
              <Text style={styles.statLabel}>🐺</Text>
            </View>
            <View style={[styles.statBox, styles.statBoxVillage]}>
              <Text style={styles.statValue}>{villagersAlive}</Text>
              <Text style={styles.statLabel}>🏘️</Text>
            </View>
            <View style={[styles.statBox, styles.statBoxNight]}>
              <Text style={styles.statValue}>{nightCount}</Text>
              <Text style={styles.statLabel}>Nuit</Text>
            </View>
          </View>
        </View>

        {/* ==================== CONTRÔLES DE PHASE ==================== */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>⚡ Contrôles</Text>

          <TouchableOpacity
            style={[styles.nextPhaseButton, isProcessing && styles.buttonDisabled]}
            onPress={nextPhase}
            disabled={isProcessing || currentPhase === 'finished'}
          >
            {isProcessing ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <>
                <Text style={styles.nextPhaseButtonText}>PHASE SUIVANTE</Text>
                <Text style={styles.nextPhaseArrow}>→ {PHASES[phaseInfo.next]?.name || 'Fin'}</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Sélecteur de phases */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.phasesScroll}
          >
            {Object.entries(PHASES).map(([key, phase]) => (
              <TouchableOpacity
                key={key}
                style={[
                  styles.phaseChip,
                  currentPhase === key && styles.phaseChipActive,
                  { borderColor: phase.color }
                ]}
                onPress={() => forcePhase(key)}
              >
                <Text style={styles.phaseChipIcon}>{phase.icon}</Text>
                <Text style={[
                  styles.phaseChipText,
                  currentPhase === key && { color: phase.color }
                ]}>
                  {phase.name.split(' ')[0]}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* ==================== TIMER ==================== */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>⏱️ Timer</Text>

          <View style={styles.timerCard}>
            <Text style={[
              styles.timerDisplay,
              timerValue !== null && timerValue <= 10 && styles.timerWarning
            ]}>
              {formatTime(timerValue || timerDuration)}
            </Text>

            <View style={styles.timerPresets}>
              {TIMER_PRESETS.map(preset => (
                <TouchableOpacity
                  key={preset.label}
                  style={[
                    styles.timerPreset,
                    timerDuration === preset.value && styles.timerPresetActive
                  ]}
                  onPress={() => setTimerPreset(preset.value)}
                >
                  <Text style={[
                    styles.timerPresetText,
                    timerDuration === preset.value && styles.timerPresetTextActive
                  ]}>
                    {preset.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.timerControls}>
              {!isTimerRunning ? (
                <TouchableOpacity
                  style={[styles.timerButton, styles.startButton]}
                  onPress={startTimer}
                  disabled={timerDuration === null}
                >
                  <Text style={styles.timerButtonText}>▶ START</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[styles.timerButton, styles.pauseButton]}
                  onPress={pauseTimer}
                >
                  <Text style={styles.timerButtonText}>⏸ PAUSE</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.timerButton, styles.resetButton]}
                onPress={resetTimer}
              >
                <Text style={styles.timerButtonText}>↺ RESET</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.autoNextRow}
              onPress={() => setAutoNextPhase(!autoNextPhase)}
            >
              <View style={[styles.checkbox, autoNextPhase && styles.checkboxActive]}>
                {autoNextPhase && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={styles.autoNextText}>
                Phase suivante auto quand timer = 0
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ==================== JOUEURS ==================== */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              👥 Joueurs ({alivePlayers.length}/{gamePlayers.length})
            </Text>
            <TouchableOpacity
              style={styles.bonusButton}
              onPress={() => setShowBonusModal(true)}
            >
              <Text style={styles.bonusButtonText}>🎁 Bonus</Text>
            </TouchableOpacity>
          </View>

          {/* Joueurs vivants */}
          {alivePlayers.map(player => (
            <PlayerCard
              key={player.id}
              player={player}
              onAddBonusRole={() => {
                setSelectedPlayerForBonus(player);
                setShowBonusModal(true);
              }}
              onToggleAlive={(p) => {
                setSelectedPlayer(p);
                setShowPlayerModal(true);
              }}
              onViewRole={(p) => {
                setSelectedPlayer(p);
                setShowPlayerModal(true);
              }}
            />
          ))}

          {/* Joueurs morts */}
          {deadPlayers.length > 0 && (
            <>
              <Text style={styles.deadSectionTitle}>💀 Éliminés ({deadPlayers.length})</Text>
              {deadPlayers.map(player => (
                <PlayerCard
                  key={player.id}
                  player={player}
                  onToggleAlive={(p) => togglePlayerAlive(p)}
                  showActions={true}
                />
              ))}
            </>
          )}
        </View>

        {/* ==================== LOG DES ACTIONS ==================== */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📜 Actions de la nuit</Text>

          <View style={styles.logCard}>
            {actions.length === 0 ? (
              <Text style={styles.logEmpty}>Aucune action enregistrée</Text>
            ) : (
              actions.slice(0, 10).map((action, index) => (
                <View key={action.id || index} style={styles.logItem}>
                  <Text style={styles.logTime}>
                    {action.night?.replace('night-', 'N')}
                  </Text>
                  <Text style={styles.logMessage}>{action.message}</Text>
                </View>
              ))
            )}
          </View>
        </View>

        {/* ==================== ACTIONS RAPIDES ==================== */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>⚙️ Actions rapides</Text>

          <View style={styles.quickActions}>
            <TouchableOpacity
              style={[styles.quickAction, gameState?.isPaused && styles.quickActionActive]}
              onPress={togglePause}
            >
              <Text style={styles.quickActionIcon}>
                {gameState?.isPaused ? '▶️' : '⏸️'}
              </Text>
              <Text style={styles.quickActionText}>
                {gameState?.isPaused ? 'Reprendre' : 'Pause'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickAction}
              onPress={() => setShowRulesModal(true)}
            >
              <Text style={styles.quickActionIcon}>📖</Text>
              <Text style={styles.quickActionText}>Règles</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.quickAction, styles.endGameAction]}
              onPress={endGame}
            >
              <Text style={styles.quickActionIcon}>🛑</Text>
              <Text style={styles.quickActionText}>Terminer</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ height: 50 }} />
      </ScrollView>

      {/* Modals */}
      {renderBonusModal()}
      {renderRulesModal()}
      {renderPlayerModal()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    padding: 15,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: colors.textSecondary,
    marginTop: 10,
  },

  // Pause banner
  pauseBanner: {
    backgroundColor: colors.warning,
    padding: 10,
    alignItems: 'center',
  },
  pauseText: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 16,
  },

  // Header
  header: {
    marginBottom: 20,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  mjBadge: {
    backgroundColor: colors.special,
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
  },
  mjBadgeText: {
    color: colors.background,
    fontWeight: 'bold',
    fontSize: 14,
  },
  gameCodeBadge: {
    backgroundColor: colors.backgroundCard,
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 10,
  },
  gameCodeText: {
    color: colors.textPrimary,
    fontWeight: 'bold',
    fontSize: 16,
    fontFamily: 'monospace',
    letterSpacing: 2,
  },
  phaseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    padding: 15,
    marginBottom: 15,
  },
  phaseIcon: {
    fontSize: 40,
    marginRight: 15,
  },
  phaseInfo: {
    flex: 1,
  },
  phaseName: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  phaseDescription: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  statBox: {
    flex: 1,
    backgroundColor: colors.backgroundCard,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  statBoxWolf: {
    backgroundColor: 'rgba(139, 0, 0, 0.3)',
  },
  statBoxVillage: {
    backgroundColor: 'rgba(30, 58, 138, 0.3)',
  },
  statBoxNight: {
    backgroundColor: 'rgba(124, 58, 237, 0.3)',
  },
  statValue: {
    color: colors.textPrimary,
    fontSize: 24,
    fontWeight: 'bold',
  },
  statLabel: {
    color: colors.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },

  // Sections
  section: {
    marginBottom: 25,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },

  // Phase controls
  nextPhaseButton: {
    backgroundColor: colors.success,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 15,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  nextPhaseButtonText: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: 'bold',
  },
  nextPhaseArrow: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    marginTop: 5,
  },
  phasesScroll: {
    marginTop: 5,
  },
  phaseChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundCard,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  phaseChipActive: {
    backgroundColor: colors.backgroundSecondary,
  },
  phaseChipIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  phaseChipText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
  },

  // Timer
  timerCard: {
    backgroundColor: colors.backgroundCard,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
  },
  timerDisplay: {
    fontSize: 60,
    fontWeight: 'bold',
    color: colors.textPrimary,
    fontFamily: 'monospace',
  },
  timerWarning: {
    color: colors.danger,
  },
  timerPresets: {
    flexDirection: 'row',
    marginTop: 15,
    marginBottom: 15,
    gap: 8,
  },
  timerPreset: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.backgroundSecondary,
  },
  timerPresetActive: {
    backgroundColor: colors.primary,
  },
  timerPresetText: {
    color: colors.textSecondary,
    fontWeight: '600',
  },
  timerPresetTextActive: {
    color: '#FFF',
  },
  timerControls: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  timerButton: {
    flex: 1,
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
  },
  startButton: {
    backgroundColor: colors.success,
  },
  pauseButton: {
    backgroundColor: colors.warning,
  },
  resetButton: {
    backgroundColor: colors.backgroundSecondary,
  },
  timerButtonText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  autoNextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 15,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: colors.backgroundSecondary,
    width: '100%',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.textSecondary,
    marginRight: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxActive: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  checkmark: {
    color: '#FFF',
    fontWeight: 'bold',
  },
  autoNextText: {
    color: colors.textSecondary,
    fontSize: 13,
  },

  // Bonus button
  bonusButton: {
    backgroundColor: colors.special,
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
  },
  bonusButtonText: {
    color: colors.background,
    fontWeight: 'bold',
    fontSize: 12,
  },

  // Dead section
  deadSectionTitle: {
    color: colors.dead,
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 10,
  },

  // Log
  logCard: {
    backgroundColor: colors.backgroundCard,
    borderRadius: 12,
    padding: 15,
    maxHeight: 200,
  },
  logEmpty: {
    color: colors.textDisabled,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  logItem: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.backgroundSecondary,
  },
  logTime: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: 'bold',
    width: 35,
  },
  logMessage: {
    color: colors.textPrimary,
    fontSize: 13,
    flex: 1,
  },

  // Quick actions
  quickActions: {
    flexDirection: 'row',
    gap: 10,
  },
  quickAction: {
    flex: 1,
    backgroundColor: colors.backgroundCard,
    borderRadius: 12,
    padding: 15,
    alignItems: 'center',
  },
  quickActionActive: {
    backgroundColor: colors.warning,
  },
  quickActionIcon: {
    fontSize: 24,
    marginBottom: 5,
  },
  quickActionText: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '600',
  },
  endGameAction: {
    backgroundColor: 'rgba(220, 38, 38, 0.3)',
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.backgroundCard,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  modalTitle: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: 'bold',
  },
  modalClose: {
    color: colors.textSecondary,
    fontSize: 24,
    padding: 5,
  },
  modalSubtitle: {
    color: colors.textSecondary,
    fontSize: 14,
    marginBottom: 15,
  },
  modalList: {
    maxHeight: 400,
  },
  modalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  modalItemIcon: {
    fontSize: 24,
    marginRight: 15,
  },
  modalItemInfo: {
    flex: 1,
  },
  modalItemText: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  modalItemDesc: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  modalItemBadge: {
    color: colors.warning,
    fontSize: 11,
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  modalBackButton: {
    marginTop: 15,
    padding: 15,
    alignItems: 'center',
  },
  modalBackButtonText: {
    color: colors.textSecondary,
    fontSize: 14,
  },

  // Rules modal
  rulesContent: {
    maxHeight: 400,
  },
  rulesTitle: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 15,
    marginBottom: 5,
  },
  rulesText: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },

  // Player modal
  playerModalContent: {
    alignItems: 'center',
    padding: 10,
  },
  playerModalRole: {
    width: '100%',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 20,
  },
  playerModalRoleIcon: {
    fontSize: 50,
    marginBottom: 10,
  },
  playerModalRoleName: {
    color: '#FFF',
    fontSize: 24,
    fontWeight: 'bold',
  },
  playerModalInfo: {
    color: colors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 15,
  },
  playerModalPower: {
    color: colors.special,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
    fontStyle: 'italic',
  },
  playerModalActions: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  playerModalBtn: {
    flex: 1,
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
  },
  killBtn: {
    backgroundColor: '#8B0000',
  },
  voteBtn: {
    backgroundColor: '#6B7280',
  },
  poisonBtn: {
    backgroundColor: '#059669',
  },
  playerModalBtnText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 12,
  },
});
