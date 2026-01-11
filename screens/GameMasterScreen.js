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
import {
  checkPresentRoles,
  getNextValidPhase,
  getValidPhasesForGame,
  shouldSkipPhase,
  resolveNightActions,
  getLastNightVictims,
  getLovers,
  countVotes,
  resolveVote,
  clearVotes,
  checkWinConditionFromFirebase,
  endGameWithWinner,
  handleLoversEffect
} from '../utils/gameLogic';
import { useDevMode } from '../contexts/DevModeContext';
import PlayerCard from '../components/PlayerCard';
import Timer from '../components/Timer';
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
  const [currentNightActions, setCurrentNightActions] = useState([]);
  const [presentRoles, setPresentRoles] = useState({});
  const [lovers, setLovers] = useState(null);
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

  // États pour les votes
  const [votes, setVotes] = useState({});
  const [voteStats, setVoteStats] = useState({ voteCounts: {}, totalVotes: 0, hasTie: false, tiedPlayers: [] });
  const [showTieModal, setShowTieModal] = useState(false);
  const [lastVoteResult, setLastVoteResult] = useState(null);
  const [showVictoryModal, setShowVictoryModal] = useState(false);
  const [victoryResult, setVictoryResult] = useState(null);

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
      if (snapshot.exists()) {
        const config = snapshot.val();
        setGameConfig(config);

        // Si la partie est terminée par un autre moyen, naviguer vers EndGame
        if (config.status === 'finished') {
          navigation.replace('EndGame', { gameCode, playerId });
        }
      } else {
        setGameConfig(null);
      }
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

    // Écouter les amoureux
    const loversRef = ref(database, `games/${gameCode}/lovers`);
    const unsubLovers = onValue(loversRef, (snapshot) => {
      if (snapshot.exists()) {
        setLovers(snapshot.val());
      } else {
        setLovers(null);
      }
    });

    // Écouter les votes
    const votesRef = ref(database, `games/${gameCode}/votes`);
    const unsubVotes = onValue(votesRef, (snapshot) => {
      if (snapshot.exists()) {
        const votesData = snapshot.val();
        setVotes(votesData);
        // Calculer les stats en temps réel
        setVoteStats(countVotes(votesData));
      } else {
        setVotes({});
        setVoteStats({ voteCounts: {}, totalVotes: 0, hasTie: false, tiedPlayers: [] });
      }
    });

    return () => {
      off(playersRef);
      off(stateRef);
      off(configRef);
      off(actionsRef);
      off(loversRef);
      off(votesRef);
    };
  }, [gameCode]);

  // Vérifier les rôles présents quand les joueurs changent
  useEffect(() => {
    const checkRoles = async () => {
      const roles = await checkPresentRoles(gameCode);
      setPresentRoles(roles);
    };
    if (players.length > 0) {
      checkRoles();
    }
  }, [players, gameCode]);

  // Listener pour les actions de la nuit courante
  useEffect(() => {
    if (!gameState?.nightCount && gameState?.nightCount !== 0) return;

    const nightKey = `night-${gameState.nightCount}`;
    const currentNightRef = ref(database, `games/${gameCode}/actions/${nightKey}`);

    const unsubCurrentNight = onValue(currentNightRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const formattedActions = [];

        // Action de Cupidon (première nuit)
        if (data.cupidAction === 'formed') {
          formattedActions.push({
            type: 'cupid',
            icon: '💘',
            message: `Cupidon a formé un couple : ${data.cupidLover1Name || '?'} ❤️ ${data.cupidLover2Name || '?'}`,
            timestamp: data.cupidTimestamp || Date.now(),
          });
        }

        // Action des loups
        if (data.werewolfTarget) {
          formattedActions.push({
            type: 'werewolf',
            icon: '🐺',
            message: `Les loups ont choisi ${data.werewolfTargetName || 'une victime'}`,
            timestamp: data.werewolfTimestamp || Date.now(),
          });
        }

        // Action de la voyante
        if (data.seerTarget) {
          formattedActions.push({
            type: 'seer',
            icon: '🔮',
            message: `La voyante a vu ${data.seerTargetName || 'un joueur'}`,
            timestamp: data.seerTimestamp || Date.now(),
          });
        }

        // Action de la sorcière - Potion de vie
        if (data.witchSaved) {
          formattedActions.push({
            type: 'witch_life',
            icon: '💚',
            message: 'La sorcière a utilisé sa potion de vie',
            timestamp: data.witchTimestamp || Date.now(),
          });
        }

        // Action de la sorcière - Potion de mort
        if (data.witchKillTarget) {
          formattedActions.push({
            type: 'witch_death',
            icon: '💀',
            message: `La sorcière a empoisonné ${data.witchKillTargetName || 'un joueur'}`,
            timestamp: data.witchTimestamp || Date.now(),
          });
        }

        // Action de la sorcière - Rien
        if (data.witchAction === 'nothing') {
          formattedActions.push({
            type: 'witch_nothing',
            icon: '🧪',
            message: 'La sorcière n\'a rien fait',
            timestamp: data.witchTimestamp || Date.now(),
          });
        }

        setCurrentNightActions(formattedActions.sort((a, b) => a.timestamp - b.timestamp));
      } else {
        setCurrentNightActions([]);
      }
    });

    return () => off(currentNightRef);
  }, [gameCode, gameState?.nightCount]);

  // Gestion du timer local avec synchronisation Firebase temps reel
  useEffect(() => {
    if (isTimerRunning && timerValue !== null && timerValue > 0) {
      timerRef.current = setInterval(() => {
        setTimerValue((prev) => {
          const newValue = prev - 1;

          if (newValue <= 0) {
            clearInterval(timerRef.current);
            setIsTimerRunning(false);
            // Synchroniser avec Firebase
            update(ref(database), {
              [`games/${gameCode}/gameState/timer`]: 0,
              [`games/${gameCode}/gameState/timerRunning`]: false,
            });
            // Auto next phase si active
            if (autoNextPhase) {
              setTimeout(() => nextPhase(), 1000);
            }
            return 0;
          }

          // Synchroniser avec Firebase chaque seconde pour les joueurs
          update(ref(database), {
            [`games/${gameCode}/gameState/timer`]: newValue,
          });

          return newValue;
        });
      }, 1000);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isTimerRunning, autoNextPhase]);

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

  // Calculer la vraie prochaine phase (en tenant compte des rôles absents)
  const actualNextPhase = getNextValidPhase(currentPhase, presentRoles, nightCount);
  const actualNextPhaseInfo = PHASES[actualNextPhase];

  // ==================== ACTIONS ====================

  // Passer à la phase suivante (avec skip automatique des rôles absents)
  const nextPhase = async () => {
    if (currentPhase === 'finished') {
      Alert.alert('Fin de partie', 'La partie est terminée.');
      return;
    }

    setIsProcessing(true);
    try {
      // Utiliser la nouvelle fonction qui skip automatiquement les phases des rôles absents
      const next = getNextValidPhase(currentPhase, presentRoles, nightCount);

      const updates = {};
      updates[`games/${gameCode}/gameState/currentPhase`] = next;
      updates[`games/${gameCode}/gameState/lastPhaseChange`] = Date.now();

      // Incrémenter le compteur de nuits si on recommence une nouvelle nuit
      if (next === 'night_start' && currentPhase !== 'role_reveal') {
        updates[`games/${gameCode}/gameState/nightCount`] = nightCount + 1;
      }

      // Résoudre les actions de la nuit quand on passe au jour
      if (next === 'day_announcement' && nightCount >= 0) {
        const victims = await resolveNightActions(gameCode, nightCount);
        if (victims.length > 0) {
          // Stocker les victimes pour l'annonce
          updates[`games/${gameCode}/gameState/lastNightVictims`] = victims;
        } else {
          updates[`games/${gameCode}/gameState/lastNightVictims`] = null;
        }
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

  // ==================== VOTES ====================

  // Résoudre le vote
  const handleResolveVote = async (forcedWinnerId = null) => {
    setIsProcessing(true);
    try {
      const result = await resolveVote(gameCode, votes, forcedWinnerId);

      if (result.hasTie && !forcedWinnerId) {
        // Égalité : afficher le modal pour que le MJ choisisse
        setShowTieModal(true);
        setIsProcessing(false);
        return;
      }

      if (result.eliminated) {
        const eliminatedPlayer = players.find(p => p.id === result.eliminated);
        const eliminatedRole = getRoleById(eliminatedPlayer?.role);

        // Stocker le résultat pour l'affichage
        setLastVoteResult({
          player: eliminatedPlayer,
          role: eliminatedRole,
          voteCounts: result.voteCounts,
        });

        // Log de l'action
        await logAction(`⚖️ ${eliminatedPlayer?.name} éliminé par le vote (${result.maxVotes} votes)`);

        // Passer à la phase result
        await update(ref(database), {
          [`games/${gameCode}/gameState/currentPhase`]: 'vote_result',
          [`games/${gameCode}/gameState/lastPhaseChange`]: Date.now(),
          [`games/${gameCode}/gameState/lastEliminatedId`]: result.eliminated,
          [`games/${gameCode}/gameState/lastEliminatedName`]: eliminatedPlayer?.name,
          [`games/${gameCode}/gameState/lastEliminatedRole`]: eliminatedPlayer?.role,
        });

        if (__DEV__) addLog(`Vote résolu: ${eliminatedPlayer?.name} éliminé`);
      }

      setShowTieModal(false);
    } catch (error) {
      console.error('Erreur résolution vote:', error);
      Alert.alert('Erreur', 'Impossible de résoudre le vote.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Réinitialiser les votes pour une nouvelle phase
  const handleClearVotes = async () => {
    try {
      await clearVotes(gameCode);
      setVotes({});
      setVoteStats({ voteCounts: {}, totalVotes: 0, hasTie: false, tiedPlayers: [] });
      if (__DEV__) addLog('Votes réinitialisés');
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de réinitialiser les votes.');
    }
  };

  // ==================== VICTOIRE ====================

  // Vérifier les conditions de victoire
  const handleCheckVictory = async () => {
    setIsProcessing(true);
    try {
      const result = await checkWinConditionFromFirebase(gameCode);

      if (result) {
        setVictoryResult(result);
        setShowVictoryModal(true);
      } else {
        Alert.alert('Partie en cours', 'Aucune condition de victoire atteinte.\n\nLe jeu continue !');
      }
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de vérifier la victoire.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Confirmer la fin de partie avec un gagnant
  const confirmVictory = async () => {
    if (!victoryResult) return;

    setIsProcessing(true);
    try {
      await endGameWithWinner(gameCode, victoryResult.winner, victoryResult.message);
      await logAction(`🏆 Partie terminée: ${victoryResult.winner === 'village' ? 'Village' : 'Loups'} gagne!`);
      setShowVictoryModal(false);

      // Redirection vers l'écran de fin
      navigation.replace('EndGame', { gameCode, playerId });
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de terminer la partie.');
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
      [`games/${gameCode}/gameState/timerDuration`]: timerDuration,
      [`games/${gameCode}/gameState/timerRunning`]: true,
      [`games/${gameCode}/gameState/timerStartedAt`]: Date.now(),
    });
  };

  const pauseTimer = async () => {
    setIsTimerRunning(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    await update(ref(database), {
      [`games/${gameCode}/gameState/timer`]: timerValue,
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
      [`games/${gameCode}/gameState/timerDuration`]: timerDuration,
      [`games/${gameCode}/gameState/timerRunning`]: false,
    });
  };

  const setTimerPreset = async (value) => {
    setTimerDuration(value);
    setTimerValue(value);
    setIsTimerRunning(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    // Synchroniser le preset avec Firebase pour les joueurs
    await update(ref(database), {
      [`games/${gameCode}/gameState/timer`]: value,
      [`games/${gameCode}/gameState/timerDuration`]: value,
      [`games/${gameCode}/gameState/timerRunning`]: false,
    });
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

          {/* Affichage des amoureux si formés */}
          {lovers && (
            <View style={styles.loversCard}>
              <Text style={styles.loversIcon}>💘</Text>
              <View style={styles.loversInfo}>
                <Text style={styles.loversTitle}>Amoureux</Text>
                <Text style={styles.loversNames}>
                  {lovers.player1Name} ❤️ {lovers.player2Name}
                </Text>
              </View>
            </View>
          )}
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
                <Text style={styles.nextPhaseArrow}>→ {actualNextPhaseInfo?.name || 'Fin'}</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Sélecteur de phases (affiche uniquement les phases valides) */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.phasesScroll}
          >
            {Object.entries(PHASES)
              .filter(([key]) => !shouldSkipPhase(key, presentRoles, nightCount))
              .map(([key, phase]) => (
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
          <View style={styles.timerHeader}>
            <Text style={styles.sectionTitle}>⏱️ Gestion du Timer</Text>
            <View style={[
              styles.timerStatusBadge,
              isTimerRunning ? styles.timerStatusActive : styles.timerStatusPaused
            ]}>
              <Text style={styles.timerStatusText}>
                {isTimerRunning ? '⚡ Actif' : '⏸️ En pause'}
              </Text>
            </View>
          </View>

          <View style={styles.timerCard}>
            {/* Timer visuel circulaire */}
            <View style={styles.timerVisualContainer}>
              {timerDuration !== null ? (
                <Timer
                  duration={timerDuration}
                  remainingTime={timerValue || timerDuration}
                  isActive={isTimerRunning}
                  isMaster={true}
                  size="large"
                  showLabel={true}
                  onComplete={() => {
                    if (autoNextPhase) {
                      nextPhase();
                    } else {
                      Alert.alert('Timer terminé !', 'Le temps est écoulé. Passez à la phase suivante.');
                    }
                  }}
                />
              ) : (
                <View style={styles.timerInfinite}>
                  <Text style={styles.timerInfiniteIcon}>∞</Text>
                  <Text style={styles.timerInfiniteText}>Timer désactivé</Text>
                </View>
              )}
            </View>

            {/* Présets de durée */}
            <View style={styles.timerPresetsContainer}>
              <Text style={styles.timerPresetsLabel}>Durée :</Text>
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
            </View>

            {/* Contrôles du timer */}
            <View style={styles.timerControlsRow}>
              {!isTimerRunning ? (
                <TouchableOpacity
                  style={[styles.timerControlButton, styles.startButton]}
                  onPress={startTimer}
                  disabled={timerDuration === null}
                >
                  <Text style={styles.timerControlIcon}>▶️</Text>
                  <Text style={styles.timerControlText}>START</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[styles.timerControlButton, styles.pauseButton]}
                  onPress={pauseTimer}
                >
                  <Text style={styles.timerControlIcon}>⏸️</Text>
                  <Text style={styles.timerControlText}>PAUSE</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.timerControlButton, styles.resetButton]}
                onPress={resetTimer}
              >
                <Text style={styles.timerControlIcon}>🔄</Text>
                <Text style={styles.timerControlText}>RESET</Text>
              </TouchableOpacity>
            </View>

            {/* Option auto-phase */}
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

        {/* ==================== VOTES (visible pendant phase vote/result) ==================== */}
        {(currentPhase === 'day_vote' || currentPhase === 'vote_result') && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🗳️ Votes en cours</Text>

            {/* Compteur de votes */}
            <View style={styles.voteCounterCard}>
              <View style={styles.voteCounterMain}>
                <Text style={styles.voteCounterNumber}>{voteStats.totalVotes}</Text>
                <Text style={styles.voteCounterLabel}>/ {alivePlayers.length} ont voté</Text>
              </View>
              {voteStats.totalVotes === alivePlayers.length && (
                <View style={styles.allVotedBadge}>
                  <Text style={styles.allVotedText}>✓ Tous</Text>
                </View>
              )}
            </View>

            {/* Liste des votes par cible */}
            {Object.keys(voteStats.voteCounts).length > 0 ? (
              <View style={styles.voteResultsCard}>
                <Text style={styles.voteResultsTitle}>Décompte par joueur :</Text>
                {Object.entries(voteStats.voteCounts)
                  .sort(([, a], [, b]) => b - a)
                  .map(([playerId, count]) => {
                    const player = players.find(p => p.id === playerId);
                    const isLeading = count === voteStats.maxVotes;
                    const isTied = voteStats.tiedPlayers.includes(playerId);
                    return (
                      <View
                        key={playerId}
                        style={[
                          styles.voteResultItem,
                          isLeading && styles.voteResultItemLeading,
                          isTied && voteStats.hasTie && styles.voteResultItemTied,
                        ]}
                      >
                        <Text style={styles.voteResultName}>
                          {player?.name || 'Inconnu'}
                          {isTied && voteStats.hasTie && ' ⚠️'}
                        </Text>
                        <View style={styles.voteResultCount}>
                          <Text style={styles.voteResultCountText}>{count}</Text>
                          <Text style={styles.voteResultCountLabel}>vote{count > 1 ? 's' : ''}</Text>
                        </View>
                      </View>
                    );
                  })}

                {/* Alerte égalité */}
                {voteStats.hasTie && (
                  <View style={styles.tieWarning}>
                    <Text style={styles.tieWarningIcon}>⚠️</Text>
                    <Text style={styles.tieWarningText}>
                      Égalité ! Vous devrez choisir qui éliminer.
                    </Text>
                  </View>
                )}
              </View>
            ) : (
              <View style={styles.noVotesCard}>
                <Text style={styles.noVotesIcon}>🗳️</Text>
                <Text style={styles.noVotesText}>Aucun vote pour le moment</Text>
              </View>
            )}

            {/* Détail des votes (qui a voté pour qui) */}
            {Object.keys(votes).length > 0 && (
              <View style={styles.voteDetailsCard}>
                <Text style={styles.voteDetailsTitle}>Détail des votes :</Text>
                {Object.entries(votes).map(([voterId, targetId]) => {
                  const voter = players.find(p => p.id === voterId);
                  const target = players.find(p => p.id === targetId);
                  return (
                    <Text key={voterId} style={styles.voteDetailItem}>
                      {voter?.name || 'Inconnu'} → {target?.name || 'Inconnu'}
                    </Text>
                  );
                })}
              </View>
            )}

            {/* Boutons d'action */}
            <View style={styles.voteActionsRow}>
              <TouchableOpacity
                style={[styles.resolveVoteButton, voteStats.totalVotes === 0 && styles.buttonDisabled]}
                onPress={() => handleResolveVote()}
                disabled={voteStats.totalVotes === 0 || isProcessing}
              >
                {isProcessing ? (
                  <ActivityIndicator color="#FFF" size="small" />
                ) : (
                  <>
                    <Text style={styles.resolveVoteIcon}>⚖️</Text>
                    <Text style={styles.resolveVoteText}>Résoudre le vote</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.clearVotesButton}
                onPress={handleClearVotes}
              >
                <Text style={styles.clearVotesText}>↺ Reset</Text>
              </TouchableOpacity>
            </View>

            {/* Bouton vérifier victoire */}
            <TouchableOpacity
              style={styles.checkVictoryButton}
              onPress={handleCheckVictory}
              disabled={isProcessing}
            >
              <Text style={styles.checkVictoryIcon}>🏆</Text>
              <Text style={styles.checkVictoryText}>Vérifier conditions de victoire</Text>
            </TouchableOpacity>
          </View>
        )}

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
          <Text style={styles.sectionTitle}>📜 Actions de la nuit {nightCount}</Text>

          <View style={styles.logCard}>
            {currentNightActions.length === 0 ? (
              <Text style={styles.logEmpty}>Aucune action enregistrée cette nuit</Text>
            ) : (
              currentNightActions.map((action, index) => (
                <View key={`${action.type}-${index}`} style={styles.logItem}>
                  <Text style={styles.logIcon}>{action.icon}</Text>
                  <Text style={styles.logMessage}>{action.message}</Text>
                </View>
              ))
            )}
          </View>

          {/* Indicateur des rôles présents */}
          <View style={styles.rolesPresent}>
            <Text style={styles.rolesPresentTitle}>Rôles actifs cette nuit :</Text>
            <View style={styles.rolesBadges}>
              {presentRoles.hasCupid && nightCount === 0 && (
                <View style={[styles.roleBadge, { backgroundColor: '#EC4899' }]}>
                  <Text style={styles.roleBadgeText}>💘 Cupidon</Text>
                </View>
              )}
              <View style={[styles.roleBadge, { backgroundColor: '#8B0000' }]}>
                <Text style={styles.roleBadgeText}>🐺 Loups</Text>
              </View>
              {presentRoles.hasSeer && (
                <View style={[styles.roleBadge, { backgroundColor: '#8B5CF6' }]}>
                  <Text style={styles.roleBadgeText}>🔮 Voyante</Text>
                </View>
              )}
              {presentRoles.hasWitch && (
                <View style={[styles.roleBadge, { backgroundColor: '#059669' }]}>
                  <Text style={styles.roleBadgeText}>🧪 Sorcière</Text>
                </View>
              )}
            </View>
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

      {/* Modal égalité */}
      <Modal
        visible={showTieModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowTieModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>⚠️ Égalité au vote</Text>
              <TouchableOpacity onPress={() => setShowTieModal(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.tieModalSubtitle}>
              Plusieurs joueurs ont le même nombre de votes. Choisissez qui éliminer :
            </Text>

            <ScrollView style={styles.tiePlayersList}>
              {voteStats.tiedPlayers.map(playerId => {
                const player = players.find(p => p.id === playerId);
                const role = getRoleById(player?.role);
                return (
                  <TouchableOpacity
                    key={playerId}
                    style={styles.tiePlayerItem}
                    onPress={() => handleResolveVote(playerId)}
                  >
                    <View style={[styles.tiePlayerIcon, { backgroundColor: role?.color || '#333' }]}>
                      <Text style={styles.tiePlayerIconText}>{role?.icon || '❓'}</Text>
                    </View>
                    <View style={styles.tiePlayerInfo}>
                      <Text style={styles.tiePlayerName}>{player?.name || 'Inconnu'}</Text>
                      <Text style={styles.tiePlayerVotes}>
                        {voteStats.voteCounts[playerId]} votes
                      </Text>
                    </View>
                    <Text style={styles.tiePlayerArrow}>→</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <TouchableOpacity
              style={styles.tieCancelButton}
              onPress={() => setShowTieModal(false)}
            >
              <Text style={styles.tieCancelText}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal victoire */}
      <Modal
        visible={showVictoryModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowVictoryModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.victoryModalContent}>
            <View style={[
              styles.victoryHeader,
              { backgroundColor: victoryResult?.winner === 'village' ? '#1E3A8A' : '#8B0000' }
            ]}>
              <Text style={styles.victoryEmoji}>
                {victoryResult?.winner === 'village' ? '🏘️' : '🐺'}
              </Text>
              <Text style={styles.victoryTitle}>
                {victoryResult?.winner === 'village' ? 'Le Village gagne !' : 'Les Loups gagnent !'}
              </Text>
            </View>

            <View style={styles.victoryBody}>
              <Text style={styles.victoryMessage}>
                {victoryResult?.message}
              </Text>

              {victoryResult?.stats && (
                <View style={styles.victoryStats}>
                  <Text style={styles.victoryStatsTitle}>Statistiques :</Text>
                  <Text style={styles.victoryStat}>
                    🐺 Loups vivants : {victoryResult.stats.aliveWerewolves}
                  </Text>
                  <Text style={styles.victoryStat}>
                    🏘️ Villageois vivants : {victoryResult.stats.aliveVillagers}
                  </Text>
                  <Text style={styles.victoryStat}>
                    💀 Morts : {victoryResult.stats.deadCount}
                  </Text>
                </View>
              )}

              <View style={styles.victoryButtons}>
                <TouchableOpacity
                  style={styles.victoryCancelButton}
                  onPress={() => setShowVictoryModal(false)}
                >
                  <Text style={styles.victoryCancelText}>Continuer la partie</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.victoryConfirmButton,
                    { backgroundColor: victoryResult?.winner === 'village' ? '#1E3A8A' : '#8B0000' }
                  ]}
                  onPress={confirmVictory}
                >
                  <Text style={styles.victoryConfirmText}>🏆 Terminer la partie</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>
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

  // Amoureux
  loversCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(236, 72, 153, 0.2)',
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#EC4899',
  },
  loversIcon: {
    fontSize: 28,
    marginRight: 12,
  },
  loversInfo: {
    flex: 1,
  },
  loversTitle: {
    color: '#EC4899',
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  loversNames: {
    color: colors.textPrimary,
    fontSize: 14,
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
  timerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  timerStatusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  timerStatusActive: {
    backgroundColor: 'rgba(5, 150, 105, 0.2)',
  },
  timerStatusPaused: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
  },
  timerStatusText: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '600',
  },
  timerCard: {
    backgroundColor: colors.backgroundCard,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
  },
  timerVisualContainer: {
    marginBottom: 20,
    alignItems: 'center',
  },
  timerInfinite: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: colors.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 8,
    borderColor: colors.textDisabled,
  },
  timerInfiniteIcon: {
    fontSize: 60,
    color: colors.textDisabled,
  },
  timerInfiniteText: {
    color: colors.textDisabled,
    fontSize: 12,
    marginTop: 5,
  },
  timerPresetsContainer: {
    width: '100%',
    marginBottom: 15,
  },
  timerPresetsLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    marginBottom: 8,
  },
  timerPresets: {
    flexDirection: 'row',
    flexWrap: 'wrap',
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
  timerControlsRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
    marginBottom: 15,
  },
  timerControlButton: {
    flex: 1,
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerControlIcon: {
    fontSize: 20,
    marginBottom: 4,
  },
  timerControlText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 12,
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
  logIcon: {
    fontSize: 18,
    marginRight: 10,
    width: 25,
  },

  // Rôles présents
  rolesPresent: {
    marginTop: 15,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: colors.backgroundSecondary,
  },
  rolesPresentTitle: {
    color: colors.textSecondary,
    fontSize: 12,
    marginBottom: 10,
  },
  rolesBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  roleBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
  },
  roleBadgeText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '600',
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

  // ==================== STYLES VOTES ====================
  voteCounterCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
  },
  voteCounterMain: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  voteCounterNumber: {
    color: colors.primary,
    fontSize: 36,
    fontWeight: 'bold',
  },
  voteCounterLabel: {
    color: colors.textSecondary,
    fontSize: 16,
    marginLeft: 5,
  },
  allVotedBadge: {
    backgroundColor: '#059669',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  allVotedText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 12,
  },
  voteResultsCard: {
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
  },
  voteResultsTitle: {
    color: colors.textSecondary,
    fontSize: 12,
    marginBottom: 10,
    fontWeight: '600',
  },
  voteResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.backgroundCard,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  voteResultItemLeading: {
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  voteResultItemTied: {
    borderLeftWidth: 3,
    borderLeftColor: colors.warning,
  },
  voteResultName: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  voteResultCount: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  voteResultCountText: {
    color: colors.primary,
    fontSize: 24,
    fontWeight: 'bold',
  },
  voteResultCountLabel: {
    color: colors.textSecondary,
    fontSize: 11,
    marginLeft: 4,
  },
  tieWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  tieWarningIcon: {
    fontSize: 20,
    marginRight: 10,
  },
  tieWarningText: {
    color: colors.warning,
    fontSize: 13,
    flex: 1,
  },
  noVotesCard: {
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 12,
    padding: 30,
    alignItems: 'center',
    marginBottom: 15,
  },
  noVotesIcon: {
    fontSize: 40,
    marginBottom: 10,
    opacity: 0.5,
  },
  noVotesText: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  voteDetailsCard: {
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
  },
  voteDetailsTitle: {
    color: colors.textSecondary,
    fontSize: 12,
    marginBottom: 10,
    fontWeight: '600',
  },
  voteDetailItem: {
    color: colors.textPrimary,
    fontSize: 13,
    paddingVertical: 4,
  },
  voteActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 15,
  },
  resolveVoteButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: 12,
    padding: 15,
  },
  resolveVoteIcon: {
    fontSize: 20,
    marginRight: 10,
  },
  resolveVoteText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  clearVotesButton: {
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 12,
    padding: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearVotesText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  checkVictoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
    borderWidth: 1,
    borderColor: colors.special,
    borderRadius: 12,
    padding: 15,
  },
  checkVictoryIcon: {
    fontSize: 20,
    marginRight: 10,
  },
  checkVictoryText: {
    color: colors.special,
    fontSize: 14,
    fontWeight: '600',
  },

  // ==================== MODAL ÉGALITÉ ====================
  tieModalSubtitle: {
    color: colors.textSecondary,
    fontSize: 14,
    marginBottom: 20,
    textAlign: 'center',
  },
  tiePlayersList: {
    maxHeight: 300,
  },
  tiePlayerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
  },
  tiePlayerIcon: {
    width: 50,
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  tiePlayerIconText: {
    fontSize: 24,
  },
  tiePlayerInfo: {
    flex: 1,
  },
  tiePlayerName: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: 'bold',
  },
  tiePlayerVotes: {
    color: colors.primary,
    fontSize: 12,
    marginTop: 2,
  },
  tiePlayerArrow: {
    color: colors.textSecondary,
    fontSize: 24,
  },
  tieCancelButton: {
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 12,
    padding: 15,
    alignItems: 'center',
    marginTop: 10,
  },
  tieCancelText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },

  // ==================== MODAL VICTOIRE ====================
  victoryModalContent: {
    backgroundColor: colors.backgroundCard,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  victoryHeader: {
    padding: 30,
    alignItems: 'center',
  },
  victoryEmoji: {
    fontSize: 60,
    marginBottom: 15,
  },
  victoryTitle: {
    color: '#FFF',
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  victoryBody: {
    padding: 20,
  },
  victoryMessage: {
    color: colors.textPrimary,
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  victoryStats: {
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 12,
    padding: 15,
    marginBottom: 20,
  },
  victoryStatsTitle: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 10,
  },
  victoryStat: {
    color: colors.textPrimary,
    fontSize: 14,
    paddingVertical: 3,
  },
  victoryButtons: {
    gap: 10,
  },
  victoryCancelButton: {
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 12,
    padding: 15,
    alignItems: 'center',
  },
  victoryCancelText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  victoryConfirmButton: {
    borderRadius: 12,
    padding: 15,
    alignItems: 'center',
  },
  victoryConfirmText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
