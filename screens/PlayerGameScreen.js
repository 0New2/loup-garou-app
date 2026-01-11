import React, { useState, useEffect, useRef } from 'react';
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
  FlatList,
  Animated,
} from 'react-native';
import { ref, onValue, off, update, set, get } from 'firebase/database';
import { database } from '../firebase';
import { getRoleById, ROLES } from '../utils/roles';
import { useDevMode } from '../contexts/DevModeContext';
import colors from '../constants/colors';
import Timer, { TimerBar, TimerBadge } from '../components/Timer';

// Mapping des phases pour l'UI joueur
const PHASE_INFO = {
  role_reveal: { name: 'Révélation', icon: '🎭', isNight: false },
  night_start: { name: 'La nuit tombe', icon: '🌙', isNight: true },
  night_cupid: { name: 'Tour de Cupidon', icon: '💘', isNight: true },
  night_werewolves: { name: 'Tour des Loups', icon: '🐺', isNight: true },
  night_seer: { name: 'Tour de la Voyante', icon: '🔮', isNight: true },
  night_witch: { name: 'Tour de la Sorcière', icon: '🧪', isNight: true },
  day_announcement: { name: 'Le jour se lève', icon: '☀️', isNight: false },
  day_discussion: { name: 'Discussion', icon: '💬', isNight: false },
  day_vote: { name: 'Vote', icon: '🗳️', isNight: false },
  vote_result: { name: 'Résultat du vote', icon: '⚖️', isNight: false },
  finished: { name: 'Partie terminée', icon: '🏆', isNight: false },
};

export default function PlayerGameScreen({ navigation, route }) {
  const { gameCode, playerId } = route.params;
  const { addLog } = useDevMode();

  // États principaux
  const [player, setPlayer] = useState(null);
  const [players, setPlayers] = useState([]);
  const [gameState, setGameState] = useState(null);
  const [gameConfig, setGameConfig] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // États des actions
  const [hasVoted, setHasVoted] = useState(false);
  const [votedFor, setVotedFor] = useState(null);
  const [selectedTarget, setSelectedTarget] = useState(null);
  const [hasActed, setHasActed] = useState(false);
  const [nightActions, setNightActions] = useState(null);
  const [lastNightVictims, setLastNightVictims] = useState([]);

  // États Cupidon
  const [selectedLovers, setSelectedLovers] = useState([]);
  const [loversFormed, setLoversFormed] = useState(false);

  // États Sorcière
  const [witchAction, setWitchAction] = useState(null); // 'save', 'kill', 'nothing'
  const [witchKillTarget, setWitchKillTarget] = useState(null);

  // États modaux
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [showSeerResultModal, setShowSeerResultModal] = useState(false);
  const [seerResult, setSeerResult] = useState(null);

  // État du résultat du vote
  const [lovers, setLovers] = useState(null);

  // Timer (lecture seule - controle par le MJ)
  const [timerValue, setTimerValue] = useState(null);
  const [timerDuration, setTimerDuration] = useState(null);
  const [isTimerRunning, setIsTimerRunning] = useState(false);

  // Animation
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Animation de pulsation pour la nuit
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  // Charger les données Firebase
  useEffect(() => {
    const playerRef = ref(database, `games/${gameCode}/players/${playerId}`);
    const playersRef = ref(database, `games/${gameCode}/players`);
    const stateRef = ref(database, `games/${gameCode}/gameState`);
    const configRef = ref(database, `games/${gameCode}/config`);
    const nightKey = `night-${gameState?.nightCount || 1}`;
    const actionsRef = ref(database, `games/${gameCode}/actions/${nightKey}`);

    // Écouter le joueur actuel
    const unsubPlayer = onValue(playerRef, (snapshot) => {
      if (snapshot.exists()) {
        setPlayer({ id: playerId, ...snapshot.val() });
      } else {
        Alert.alert('Erreur', 'Vous avez été retiré de la partie.');
        navigation.replace('Menu');
      }
    });

    // Écouter tous les joueurs
    const unsubPlayers = onValue(playersRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const list = Object.entries(data).map(([id, info]) => ({ id, ...info }));
        setPlayers(list);
      }
      setIsLoading(false);
    });

    // Écouter l'état du jeu
    const unsubState = onValue(stateRef, (snapshot) => {
      if (snapshot.exists()) {
        const state = snapshot.val();
        setGameState(state);

        // Réinitialiser les actions quand la phase change
        if (state.currentPhase !== gameState?.currentPhase) {
          setHasActed(false);
          setSelectedTarget(null);
          setWitchAction(null);
          setWitchKillTarget(null);
        }

        // Réinitialiser le vote à chaque nouvelle phase de vote
        if (state.currentPhase === 'day_vote' && gameState?.currentPhase !== 'day_vote') {
          setHasVoted(false);
          setVotedFor(null);
        }

        // Récupérer les victimes de la nuit pour l'annonce
        if (state.lastNightVictims) {
          setLastNightVictims(state.lastNightVictims);
        } else {
          setLastNightVictims([]);
        }

        // Synchroniser le timer (lecture seule depuis Firebase)
        if (state.timer !== undefined) {
          setTimerValue(state.timer);
        }
        if (state.timerDuration !== undefined) {
          setTimerDuration(state.timerDuration);
        }
        if (state.timerRunning !== undefined) {
          setIsTimerRunning(state.timerRunning);
        }
      }
    });

    // Écouter la config
    const unsubConfig = onValue(configRef, (snapshot) => {
      if (snapshot.exists()) {
        setGameConfig(snapshot.val());

        // Si la partie est terminée, naviguer vers EndGame
        if (snapshot.val().status === 'finished') {
          navigation.replace('EndGame', { gameCode, playerId });
        }
      }
    });

    // Écouter les actions de la nuit
    const unsubActions = onValue(actionsRef, (snapshot) => {
      if (snapshot.exists()) {
        setNightActions(snapshot.val());
      }
    });

    // Écouter les amoureux
    const loversRef = ref(database, `games/${gameCode}/lovers`);
    const unsubLovers = onValue(loversRef, (snapshot) => {
      if (snapshot.exists()) {
        setLoversFormed(true);
        setLovers(snapshot.val());
      }
    });

    return () => {
      off(playerRef);
      off(playersRef);
      off(stateRef);
      off(configRef);
      off(actionsRef);
      off(loversRef);
    };
  }, [gameCode, playerId, gameState?.nightCount]);

  // Note: Le timer est maintenant en lecture seule
  // Le MJ controle le timer et le synchronise via Firebase
  // Le joueur voit simplement la valeur mise a jour en temps reel

  // Helpers
  const currentPhase = gameState?.currentPhase || 'role_reveal';
  const phaseInfo = PHASE_INFO[currentPhase] || PHASE_INFO.role_reveal;
  const playerRole = player ? getRoleById(player.role) : null;
  const isAlive = player?.isAlive !== false;
  const nightCount = gameState?.nightCount || 0;

  const alivePlayers = players.filter(
    (p) => p.isAlive !== false && !p.isMaster && p.id !== playerId
  );
  const alivePlayersForVote = players.filter(
    (p) => p.isAlive !== false && !p.isMaster
  );

  // Vérifier si c'est le tour du joueur d'agir
  const isMyTurn = () => {
    if (!isAlive || !playerRole) return false;

    switch (currentPhase) {
      case 'night_cupid':
        return playerRole.id === 'cupidon' && nightCount === 0;
      case 'night_werewolves':
        return playerRole.team === 'loups';
      case 'night_seer':
        return playerRole.id === 'voyante';
      case 'night_witch':
        return playerRole.id === 'sorciere';
      case 'day_vote':
        return isAlive;
      default:
        return false;
    }
  };

  // Formater le temps
  const formatTime = (seconds) => {
    if (seconds === null || seconds === undefined) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // ==================== ACTIONS ====================

  // Action des loups-garous
  const submitWerewolfTarget = async () => {
    if (!selectedTarget || hasActed) return;

    try {
      const nightKey = `night-${nightCount || 1}`;
      await update(ref(database), {
        [`games/${gameCode}/actions/${nightKey}/werewolfTarget`]: selectedTarget.id,
        [`games/${gameCode}/actions/${nightKey}/werewolfTargetName`]: selectedTarget.name,
        [`games/${gameCode}/actions/${nightKey}/werewolfTimestamp`]: Date.now(),
      });

      setHasActed(true);
      if (__DEV__) addLog(`Loup cible: ${selectedTarget.name}`);
      Alert.alert('Cible choisie', `Vous avez choisi ${selectedTarget.name}`);
    } catch (error) {
      Alert.alert('Erreur', 'Impossible d\'enregistrer votre choix.');
    }
  };

  // Action de la voyante
  const submitSeerAction = async () => {
    if (!selectedTarget || hasActed) return;

    try {
      const targetRole = getRoleById(selectedTarget.role);
      const nightKey = `night-${nightCount || 1}`;

      await update(ref(database), {
        [`games/${gameCode}/actions/${nightKey}/seerTarget`]: selectedTarget.id,
        [`games/${gameCode}/actions/${nightKey}/seerTargetName`]: selectedTarget.name,
        [`games/${gameCode}/actions/${nightKey}/seerTimestamp`]: Date.now(),
      });

      setSeerResult({
        player: selectedTarget,
        role: targetRole,
      });
      setShowSeerResultModal(true);
      setHasActed(true);

      if (__DEV__) addLog(`Voyante voit: ${selectedTarget.name} = ${targetRole?.name}`);
    } catch (error) {
      Alert.alert('Erreur', 'Impossible d\'enregistrer votre vision.');
    }
  };

  // Action de la sorcière
  const submitWitchAction = async (action, target = null) => {
    if (hasActed) return;

    try {
      const nightKey = `night-${nightCount || 1}`;
      const updates = {};

      // Toujours ajouter le timestamp
      updates[`games/${gameCode}/actions/${nightKey}/witchTimestamp`] = Date.now();

      if (action === 'save') {
        updates[`games/${gameCode}/actions/${nightKey}/witchSaved`] = true;
        updates[`games/${gameCode}/players/${playerId}/hasUsedLifePotion`] = true;
        Alert.alert('Potion de vie', 'Vous avez sauvé la victime !');
      } else if (action === 'kill' && target) {
        updates[`games/${gameCode}/actions/${nightKey}/witchKillTarget`] = target.id;
        updates[`games/${gameCode}/actions/${nightKey}/witchKillTargetName`] = target.name;
        updates[`games/${gameCode}/players/${playerId}/hasUsedDeathPotion`] = true;
        Alert.alert('Potion de mort', `Vous avez empoisonné ${target.name} !`);
      } else if (action === 'nothing') {
        updates[`games/${gameCode}/actions/${nightKey}/witchAction`] = 'nothing';
        Alert.alert('Pas d\'action', 'Vous n\'utilisez aucune potion.');
      }

      await update(ref(database), updates);
      setHasActed(true);

      if (__DEV__) addLog(`Sorcière: ${action}`);
    } catch (error) {
      Alert.alert('Erreur', 'Impossible d\'enregistrer votre action.');
    }
  };

  // Action de Cupidon
  const submitCupidAction = async () => {
    if (selectedLovers.length !== 2 || hasActed || loversFormed) return;

    try {
      const [lover1, lover2] = selectedLovers;

      await update(ref(database), {
        [`games/${gameCode}/lovers/player1`]: lover1.id,
        [`games/${gameCode}/lovers/player1Name`]: lover1.name,
        [`games/${gameCode}/lovers/player2`]: lover2.id,
        [`games/${gameCode}/lovers/player2Name`]: lover2.name,
        [`games/${gameCode}/lovers/formedAt`]: Date.now(),
      });

      // Log dans les actions de la nuit
      const nightKey = `night-${nightCount || 0}`;
      await update(ref(database), {
        [`games/${gameCode}/actions/${nightKey}/cupidAction`]: 'formed',
        [`games/${gameCode}/actions/${nightKey}/cupidLover1`]: lover1.id,
        [`games/${gameCode}/actions/${nightKey}/cupidLover1Name`]: lover1.name,
        [`games/${gameCode}/actions/${nightKey}/cupidLover2`]: lover2.id,
        [`games/${gameCode}/actions/${nightKey}/cupidLover2Name`]: lover2.name,
        [`games/${gameCode}/actions/${nightKey}/cupidTimestamp`]: Date.now(),
      });

      setHasActed(true);
      setLoversFormed(true);

      Alert.alert(
        '💘 Couple formé !',
        `${lover1.name} et ${lover2.name} sont maintenant amoureux.\n\nLe Maître du Jeu passera à la phase suivante.`
      );

      if (__DEV__) addLog(`Cupidon: ${lover1.name} ❤️ ${lover2.name}`);
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de former le couple.');
    }
  };

  // Toggle sélection amoureux
  const toggleLoverSelection = (player) => {
    setSelectedLovers((prev) => {
      const isSelected = prev.find((p) => p.id === player.id);
      if (isSelected) {
        return prev.filter((p) => p.id !== player.id);
      } else if (prev.length < 2) {
        return [...prev, player];
      }
      return prev;
    });
  };

  // Vote du village
  const submitVote = async () => {
    if (!selectedTarget || hasVoted) return;

    try {
      await set(ref(database, `games/${gameCode}/votes/${playerId}`), selectedTarget.id);

      setHasVoted(true);
      setVotedFor(selectedTarget);

      if (__DEV__) addLog(`Vote: ${selectedTarget.name}`);
      Alert.alert('Vote enregistré', `Vous avez voté contre ${selectedTarget.name}`);
    } catch (error) {
      Alert.alert('Erreur', 'Impossible d\'enregistrer votre vote.');
    }
  };

  // ==================== RENDUS CONDITIONNELS ====================

  // Écran de nuit (dormez)
  const renderNightSleep = () => (
    <View style={styles.nightScreen}>
      <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
        <Text style={styles.sleepEmoji}>😴</Text>
      </Animated.View>
      <Text style={styles.sleepText}>Dormez paisiblement...</Text>
      <Text style={styles.sleepSubtext}>
        La nuit suit son cours. Attendez votre tour ou le lever du jour.
      </Text>
      <View style={styles.phaseIndicatorNight}>
        <Text style={styles.phaseIndicatorIcon}>{phaseInfo.icon}</Text>
        <Text style={styles.phaseIndicatorText}>{phaseInfo.name}</Text>
      </View>
    </View>
  );

  // Écran de mort
  const renderDeadScreen = () => (
    <View style={styles.deadScreen}>
      <Text style={styles.deadEmoji}>💀</Text>
      <Text style={styles.deadTitle}>Vous êtes mort</Text>
      <Text style={styles.deadSubtext}>
        Vous ne pouvez plus participer aux votes, mais vous pouvez suivre la partie.
      </Text>
      <View style={styles.deadRoleCard}>
        <Text style={styles.deadRoleLabel}>Vous étiez :</Text>
        <Text style={styles.deadRoleIcon}>{playerRole?.icon}</Text>
        <Text style={styles.deadRoleName}>{playerRole?.name}</Text>
      </View>
      <Text style={styles.deathReason}>
        Cause du décès : {player?.deathReason === 'werewolves' ? '🐺 Dévoré par les loups' :
          player?.deathReason === 'vote' ? '⚖️ Pendu par le village' :
          player?.deathReason === 'witch_poison' ? '🧪 Empoisonné' :
          player?.deathReason === 'heartbreak' ? '💔 Mort de chagrin (amoureux)' : '💀 Inconnu'}
      </Text>
    </View>
  );

  // Interface de sélection de cible
  const renderTargetSelection = (title, onConfirm, targets = alivePlayers) => (
    <View style={styles.actionContainer}>
      <Text style={styles.actionTitle}>{title}</Text>
      <Text style={styles.actionSubtitle}>Sélectionnez un joueur</Text>

      <FlatList
        data={targets}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[
              styles.targetCard,
              selectedTarget?.id === item.id && styles.targetCardSelected,
            ]}
            onPress={() => setSelectedTarget(item)}
          >
            <Text style={styles.targetName}>{item.name}</Text>
            {selectedTarget?.id === item.id && (
              <Text style={styles.targetCheck}>✓</Text>
            )}
          </TouchableOpacity>
        )}
        style={styles.targetList}
      />

      <TouchableOpacity
        style={[
          styles.confirmButton,
          !selectedTarget && styles.confirmButtonDisabled,
        ]}
        onPress={onConfirm}
        disabled={!selectedTarget || hasActed}
      >
        <Text style={styles.confirmButtonText}>
          {hasActed ? 'Action enregistrée ✓' : 'Confirmer'}
        </Text>
      </TouchableOpacity>
    </View>
  );

  // Interface Cupidon
  const renderCupidInterface = () => {
    const eligiblePlayers = players.filter(
      (p) => !p.isMaster && p.isAlive !== false
    );

    return (
      <View style={styles.cupidContainer}>
        <View style={styles.cupidHeader}>
          <Text style={styles.cupidEmoji}>💘</Text>
          <Text style={styles.cupidTitle}>Vous êtes Cupidon</Text>
        </View>

        <Text style={styles.cupidSubtext}>
          Choisissez deux joueurs qui seront amoureux.{'\n'}
          Si l'un meurt, l'autre mourra de chagrin.
        </Text>

        {loversFormed || hasActed ? (
          <View style={styles.cupidDone}>
            <Text style={styles.cupidDoneIcon}>✓</Text>
            <Text style={styles.cupidDoneText}>
              Le couple est formé !
            </Text>
            <Text style={styles.cupidDoneSubtext}>
              Le Maître du Jeu passera à la phase suivante.
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.cupidSelection}>
              <Text style={styles.cupidSelectionTitle}>
                Sélectionnés : {selectedLovers.length}/2
              </Text>
              {selectedLovers.length > 0 && (
                <View style={styles.cupidSelectedList}>
                  {selectedLovers.map((p) => (
                    <View key={p.id} style={styles.cupidSelectedBadge}>
                      <Text style={styles.cupidSelectedName}>💕 {p.name}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>

            <ScrollView style={styles.cupidPlayerList}>
              {eligiblePlayers.map((p) => {
                const isSelected = selectedLovers.find((s) => s.id === p.id);
                return (
                  <TouchableOpacity
                    key={p.id}
                    style={[
                      styles.cupidPlayerCard,
                      isSelected && styles.cupidPlayerCardSelected,
                    ]}
                    onPress={() => toggleLoverSelection(p)}
                  >
                    <Text style={styles.cupidPlayerName}>{p.name}</Text>
                    {isSelected && (
                      <Text style={styles.cupidPlayerCheck}>💕</Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <TouchableOpacity
              style={[
                styles.cupidButton,
                selectedLovers.length !== 2 && styles.cupidButtonDisabled,
              ]}
              onPress={submitCupidAction}
              disabled={selectedLovers.length !== 2}
            >
              <Text style={styles.cupidButtonText}>
                💘 Créer le couple
              </Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    );
  };

  // Interface Loup-Garou
  const renderWerewolfInterface = () => {
    // Afficher les autres loups
    const otherWerewolves = players.filter(
      (p) => p.id !== playerId && getRoleById(p.role)?.team === 'loups' && p.isAlive !== false
    );

    return (
      <View style={styles.wolfContainer}>
        <View style={styles.wolfHeader}>
          <Text style={styles.wolfEmoji}>🐺</Text>
          <Text style={styles.wolfTitle}>Tour des Loups-Garous</Text>
        </View>

        {otherWerewolves.length > 0 && (
          <View style={styles.wolfPackInfo}>
            <Text style={styles.wolfPackLabel}>Votre meute :</Text>
            {otherWerewolves.map((wolf) => (
              <Text key={wolf.id} style={styles.wolfPackMember}>
                🐺 {wolf.name}
              </Text>
            ))}
          </View>
        )}

        {renderTargetSelection('Choisissez votre victime', submitWerewolfTarget)}
      </View>
    );
  };

  // Interface Voyante
  const renderSeerInterface = () => (
    <View style={styles.seerContainer}>
      <View style={styles.seerHeader}>
        <Text style={styles.seerEmoji}>🔮</Text>
        <Text style={styles.seerTitle}>Votre vision</Text>
      </View>
      <Text style={styles.seerSubtext}>
        Choisissez un joueur pour découvrir son véritable rôle
      </Text>

      {renderTargetSelection('Qui voulez-vous observer ?', submitSeerAction)}
    </View>
  );

  // Interface Sorcière
  const renderWitchInterface = () => {
    const werewolfTarget = nightActions?.werewolfTargetName;
    const hasLifePotion = !player?.hasUsedLifePotion;
    const hasDeathPotion = !player?.hasUsedDeathPotion;

    return (
      <View style={styles.witchContainer}>
        <View style={styles.witchHeader}>
          <Text style={styles.witchEmoji}>🧪</Text>
          <Text style={styles.witchTitle}>Tour de la Sorcière</Text>
        </View>

        {werewolfTarget && hasLifePotion && (
          <View style={styles.witchAlert}>
            <Text style={styles.witchAlertIcon}>⚠️</Text>
            <Text style={styles.witchAlertText}>
              Les loups ont attaqué : {werewolfTarget}
            </Text>
            <TouchableOpacity
              style={styles.witchSaveButton}
              onPress={() => submitWitchAction('save')}
              disabled={hasActed}
            >
              <Text style={styles.witchSaveButtonText}>💚 Sauver</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.witchPotions}>
          <View style={[styles.potionCard, !hasLifePotion && styles.potionUsed]}>
            <Text style={styles.potionIcon}>💚</Text>
            <Text style={styles.potionName}>Vie</Text>
            <Text style={styles.potionStatus}>
              {hasLifePotion ? 'Disponible' : 'Utilisée'}
            </Text>
          </View>
          <View style={[styles.potionCard, !hasDeathPotion && styles.potionUsed]}>
            <Text style={styles.potionIcon}>💀</Text>
            <Text style={styles.potionName}>Mort</Text>
            <Text style={styles.potionStatus}>
              {hasDeathPotion ? 'Disponible' : 'Utilisée'}
            </Text>
          </View>
        </View>

        {hasDeathPotion && !hasActed && (
          <>
            <Text style={styles.witchKillTitle}>Potion de mort</Text>
            {renderTargetSelection(
              'Qui voulez-vous empoisonner ?',
              () => submitWitchAction('kill', selectedTarget)
            )}
          </>
        )}

        <TouchableOpacity
          style={styles.witchSkipButton}
          onPress={() => submitWitchAction('nothing')}
          disabled={hasActed}
        >
          <Text style={styles.witchSkipButtonText}>
            {hasActed ? 'Action enregistrée ✓' : 'Ne rien faire'}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  // Interface d'annonce du jour (victimes de la nuit)
  const renderDayAnnouncement = () => (
    <View style={styles.announcementContainer}>
      <View style={styles.announcementHeader}>
        <Text style={styles.announcementEmoji}>☀️</Text>
        <Text style={styles.announcementTitle}>Le jour se lève...</Text>
      </View>

      {lastNightVictims.length === 0 ? (
        <View style={styles.noVictimCard}>
          <Text style={styles.noVictimEmoji}>🎉</Text>
          <Text style={styles.noVictimTitle}>Miracle !</Text>
          <Text style={styles.noVictimText}>
            Personne n'est mort cette nuit.
          </Text>
        </View>
      ) : (
        <View style={styles.victimsContainer}>
          <Text style={styles.victimsTitle}>
            Cette nuit, le village a perdu...
          </Text>
          {lastNightVictims.map((victim, index) => (
            <View key={victim.id || index} style={styles.victimCard}>
              <Text style={styles.victimIcon}>{victim.icon}</Text>
              <View style={styles.victimInfo}>
                <Text style={styles.victimName}>{victim.name}</Text>
                <Text style={styles.victimReason}>{victim.message}</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      <Text style={styles.announcementHint}>
        Le Maître du Jeu passera bientôt à la phase de discussion.
      </Text>
    </View>
  );

  // Interface de discussion (jour)
  const renderDayDiscussion = () => (
    <View style={styles.dayContainer}>
      <View style={styles.dayHeader}>
        <Text style={styles.dayEmoji}>☀️</Text>
        <Text style={styles.dayTitle}>Le village débat</Text>
      </View>

      {timerValue !== null && timerDuration !== null && (
        <View style={styles.timerContainer}>
          <Timer
            duration={timerDuration}
            remainingTime={timerValue}
            isActive={isTimerRunning}
            isMaster={false}
            size="small"
            showLabel={true}
            enableVibration={true}
          />
        </View>
      )}

      <Text style={styles.daySubtext}>
        Discutez entre vous pour trouver les Loups-Garous !
      </Text>

      <View style={styles.alivePlayersSection}>
        <Text style={styles.aliveSectionTitle}>
          Joueurs en vie ({alivePlayersForVote.length})
        </Text>
        <ScrollView style={styles.alivePlayersList}>
          {alivePlayersForVote.map((p) => (
            <View key={p.id} style={styles.alivePlayerCard}>
              <Text style={styles.alivePlayerName}>
                {p.name} {p.id === playerId ? '(Vous)' : ''}
              </Text>
            </View>
          ))}
        </ScrollView>
      </View>
    </View>
  );

  // Interface de vote
  const renderVoteInterface = () => (
    <View style={styles.voteContainer}>
      <View style={styles.voteHeader}>
        <Text style={styles.voteEmoji}>🗳️</Text>
        <Text style={styles.voteTitle}>Vote du village</Text>
      </View>

      {timerValue !== null && timerDuration !== null && (
        <View style={styles.timerContainer}>
          <Timer
            duration={timerDuration}
            remainingTime={timerValue}
            isActive={isTimerRunning}
            isMaster={false}
            size="small"
            showLabel={true}
            enableVibration={true}
          />
        </View>
      )}

      {hasVoted ? (
        <View style={styles.votedContainer}>
          <Text style={styles.votedIcon}>✓</Text>
          <Text style={styles.votedText}>
            Vous avez voté contre {votedFor?.name}
          </Text>
          <Text style={styles.votedSubtext}>
            En attente des autres votes...
          </Text>
        </View>
      ) : (
        renderTargetSelection(
          'Qui doit être éliminé ?',
          submitVote,
          alivePlayersForVote.filter((p) => p.id !== playerId)
        )
      )}
    </View>
  );

  // Interface résultat du vote
  const renderVoteResult = () => {
    const eliminatedId = gameState?.lastEliminatedId;
    const eliminatedName = gameState?.lastEliminatedName;
    const eliminatedRoleId = gameState?.lastEliminatedRole;
    const eliminatedRole = eliminatedRoleId ? getRoleById(eliminatedRoleId) : null;

    // Vérifier si l'éliminé est un amoureux
    let otherLoverDied = null;
    if (lovers && eliminatedId) {
      if (lovers.player1 === eliminatedId) {
        otherLoverDied = {
          id: lovers.player2,
          name: lovers.player2Name,
        };
      } else if (lovers.player2 === eliminatedId) {
        otherLoverDied = {
          id: lovers.player1,
          name: lovers.player1Name,
        };
      }
    }

    return (
      <View style={styles.voteResultContainer}>
        <View style={styles.voteResultHeader}>
          <Text style={styles.voteResultEmoji}>⚖️</Text>
          <Text style={styles.voteResultTitle}>Verdict du village</Text>
        </View>

        {eliminatedId ? (
          <>
            {/* Carte de l'éliminé */}
            <View style={[
              styles.eliminatedCard,
              { borderColor: eliminatedRole?.color || colors.danger }
            ]}>
              <Text style={styles.eliminatedCardLabel}>Le village a décidé...</Text>
              <View style={[
                styles.eliminatedRoleIcon,
                { backgroundColor: eliminatedRole?.color || colors.danger }
              ]}>
                <Text style={styles.eliminatedRoleEmoji}>{eliminatedRole?.icon || '❓'}</Text>
              </View>
              <Text style={styles.eliminatedName}>{eliminatedName}</Text>
              <Text style={styles.eliminatedReason}>a été éliminé(e) par le vote</Text>
              <View style={styles.eliminatedRoleReveal}>
                <Text style={styles.eliminatedRoleLabel}>était</Text>
                <Text style={[styles.eliminatedRoleName, { color: eliminatedRole?.color }]}>
                  {eliminatedRole?.name || 'Inconnu'}
                </Text>
                <Text style={styles.eliminatedRoleTeam}>
                  {eliminatedRole?.team === 'loups' ? '🐺 Loup-Garou' : '🏘️ Village'}
                </Text>
              </View>
            </View>

            {/* Si un amoureux meurt de chagrin */}
            {otherLoverDied && (
              <View style={styles.heartbreakCard}>
                <Text style={styles.heartbreakIcon}>💔</Text>
                <Text style={styles.heartbreakText}>
                  {otherLoverDied.name} est mort(e) de chagrin
                </Text>
                <Text style={styles.heartbreakSubtext}>
                  Il/Elle était l'amoureux(se) de {eliminatedName}
                </Text>
              </View>
            )}
          </>
        ) : (
          <View style={styles.noEliminationCard}>
            <Text style={styles.noEliminationIcon}>🎉</Text>
            <Text style={styles.noEliminationText}>Aucune élimination</Text>
            <Text style={styles.noEliminationSubtext}>
              Le vote n'a pas abouti à une élimination.
            </Text>
          </View>
        )}

        <Text style={styles.voteResultHint}>
          Le Maître du Jeu va vérifier les conditions de victoire...
        </Text>
      </View>
    );
  };

  // Modal résultat voyante
  const renderSeerResultModal = () => (
    <Modal
      visible={showSeerResultModal}
      transparent
      animationType="fade"
      onRequestClose={() => setShowSeerResultModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.seerResultModal}>
          <Text style={styles.seerResultTitle}>🔮 Vision révélée</Text>
          <Text style={styles.seerResultPlayer}>{seerResult?.player?.name}</Text>
          <View style={[
            styles.seerResultRole,
            { backgroundColor: seerResult?.role?.color || '#333' }
          ]}>
            <Text style={styles.seerResultIcon}>{seerResult?.role?.icon}</Text>
            <Text style={styles.seerResultRoleName}>{seerResult?.role?.name}</Text>
          </View>
          <Text style={styles.seerResultTeam}>
            {seerResult?.role?.team === 'loups' ? '🐺 LOUP-GAROU' : '🏘️ VILLAGE'}
          </Text>
          <TouchableOpacity
            style={styles.seerResultButton}
            onPress={() => setShowSeerResultModal(false)}
          >
            <Text style={styles.seerResultButtonText}>Compris</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  // Modal rôle
  const renderRoleModal = () => (
    <Modal
      visible={showRoleModal}
      transparent
      animationType="slide"
      onRequestClose={() => setShowRoleModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.roleModalContent}>
          <View style={[
            styles.roleModalHeader,
            { backgroundColor: playerRole?.color || '#333' }
          ]}>
            <Text style={styles.roleModalIcon}>{playerRole?.icon}</Text>
            <Text style={styles.roleModalName}>{playerRole?.name}</Text>
            <Text style={styles.roleModalTeam}>
              {playerRole?.team === 'loups' ? '🐺 Équipe Loups' : '🏘️ Équipe Village'}
            </Text>
          </View>
          <View style={styles.roleModalBody}>
            <Text style={styles.roleModalDescription}>{playerRole?.description}</Text>
            <Text style={styles.roleModalPower}>✨ {playerRole?.power}</Text>
          </View>
          <TouchableOpacity
            style={styles.roleModalClose}
            onPress={() => setShowRoleModal(false)}
          >
            <Text style={styles.roleModalCloseText}>Fermer</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  // ==================== RENDU PRINCIPAL ====================

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

  // Partie en pause
  if (gameState?.isPaused) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.pauseScreen}>
          <Text style={styles.pauseEmoji}>⏸️</Text>
          <Text style={styles.pauseTitle}>Partie en pause</Text>
          <Text style={styles.pauseSubtext}>
            Le Maître du Jeu a mis la partie en pause
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // Joueur mort
  if (!isAlive) {
    return (
      <SafeAreaView style={styles.container}>
        {renderDeadScreen()}
        <TouchableOpacity
          style={styles.floatingRoleButton}
          onPress={() => setShowRoleModal(true)}
        >
          <Text style={styles.floatingRoleIcon}>{playerRole?.icon}</Text>
        </TouchableOpacity>
        {renderRoleModal()}
      </SafeAreaView>
    );
  }

  // Déterminer le contenu à afficher
  const renderContent = () => {
    // Phases de nuit où ce n'est pas mon tour
    if (phaseInfo.isNight && !isMyTurn()) {
      return renderNightSleep();
    }

    // Actions de nuit selon le rôle
    switch (currentPhase) {
      case 'night_cupid':
        if (playerRole?.id === 'cupidon' && nightCount === 0) {
          return renderCupidInterface();
        }
        return renderNightSleep();

      case 'night_werewolves':
        if (playerRole?.team === 'loups') {
          return renderWerewolfInterface();
        }
        return renderNightSleep();

      case 'night_seer':
        if (playerRole?.id === 'voyante') {
          return renderSeerInterface();
        }
        return renderNightSleep();

      case 'night_witch':
        if (playerRole?.id === 'sorciere') {
          return renderWitchInterface();
        }
        return renderNightSleep();

      case 'day_announcement':
        return renderDayAnnouncement();

      case 'day_discussion':
        return renderDayDiscussion();

      case 'day_vote':
        return renderVoteInterface();

      case 'vote_result':
        return renderVoteResult();

      default:
        // Phase par défaut (jour, annonce, etc.)
        return (
          <View style={styles.defaultContainer}>
            <View style={styles.phaseCard}>
              <Text style={styles.phaseIcon}>{phaseInfo.icon}</Text>
              <Text style={styles.phaseName}>{phaseInfo.name}</Text>
            </View>
            <Text style={styles.defaultText}>
              En attente de la prochaine phase...
            </Text>
          </View>
        );
    }
  };

  return (
    <SafeAreaView style={[
      styles.container,
      phaseInfo.isNight && styles.containerNight
    ]}>
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {renderContent()}
      </ScrollView>

      {/* Bouton flottant pour voir son rôle */}
      <TouchableOpacity
        style={styles.floatingRoleButton}
        onPress={() => setShowRoleModal(true)}
      >
        <Text style={styles.floatingRoleIcon}>{playerRole?.icon}</Text>
      </TouchableOpacity>

      {/* Modals */}
      {renderRoleModal()}
      {renderSeerResultModal()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  containerNight: {
    backgroundColor: '#0A0A15',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 100,
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

  // Écran de nuit (sommeil)
  nightScreen: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 100,
  },
  sleepEmoji: {
    fontSize: 80,
    marginBottom: 30,
  },
  sleepText: {
    color: colors.textPrimary,
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  sleepSubtext: {
    color: colors.textSecondary,
    fontSize: 16,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  phaseIndicatorNight: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    marginTop: 40,
  },
  phaseIndicatorIcon: {
    fontSize: 20,
    marginRight: 10,
  },
  phaseIndicatorText: {
    color: colors.textSecondary,
    fontSize: 14,
  },

  // Écran de mort
  deadScreen: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  deadEmoji: {
    fontSize: 80,
    marginBottom: 20,
  },
  deadTitle: {
    color: colors.dead,
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  deadSubtext: {
    color: colors.textSecondary,
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 30,
  },
  deadRoleCard: {
    backgroundColor: colors.backgroundCard,
    borderRadius: 16,
    padding: 25,
    alignItems: 'center',
    marginBottom: 20,
  },
  deadRoleLabel: {
    color: colors.textSecondary,
    fontSize: 14,
    marginBottom: 10,
  },
  deadRoleIcon: {
    fontSize: 50,
    marginBottom: 10,
  },
  deadRoleName: {
    color: colors.textPrimary,
    fontSize: 24,
    fontWeight: 'bold',
  },
  deathReason: {
    color: colors.textDisabled,
    fontSize: 14,
    fontStyle: 'italic',
  },

  // Écran pause
  pauseScreen: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pauseEmoji: {
    fontSize: 80,
    marginBottom: 20,
  },
  pauseTitle: {
    color: colors.warning,
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  pauseSubtext: {
    color: colors.textSecondary,
    fontSize: 16,
  },

  // Annonce du jour
  announcementContainer: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 20,
  },
  announcementHeader: {
    alignItems: 'center',
    marginBottom: 30,
  },
  announcementEmoji: {
    fontSize: 80,
    marginBottom: 15,
  },
  announcementTitle: {
    color: '#F59E0B',
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  noVictimCard: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderRadius: 20,
    padding: 30,
    alignItems: 'center',
    marginBottom: 30,
    borderWidth: 2,
    borderColor: colors.success,
  },
  noVictimEmoji: {
    fontSize: 50,
    marginBottom: 15,
  },
  noVictimTitle: {
    color: colors.success,
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  noVictimText: {
    color: colors.textSecondary,
    fontSize: 16,
    textAlign: 'center',
  },
  victimsContainer: {
    width: '100%',
    marginBottom: 30,
  },
  victimsTitle: {
    color: colors.textSecondary,
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  victimCard: {
    backgroundColor: 'rgba(220, 38, 38, 0.2)',
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: colors.danger,
  },
  victimIcon: {
    fontSize: 40,
    marginRight: 15,
  },
  victimInfo: {
    flex: 1,
  },
  victimName: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  victimReason: {
    color: colors.danger,
    fontSize: 14,
  },
  announcementHint: {
    color: colors.textDisabled,
    fontSize: 14,
    textAlign: 'center',
    fontStyle: 'italic',
  },

  // Container d'action
  actionContainer: {
    flex: 1,
  },
  actionTitle: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 5,
    textAlign: 'center',
  },
  actionSubtitle: {
    color: colors.textSecondary,
    fontSize: 14,
    marginBottom: 20,
    textAlign: 'center',
  },
  targetList: {
    maxHeight: 300,
  },
  targetCard: {
    backgroundColor: colors.backgroundCard,
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  targetCardSelected: {
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
  },
  targetName: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  targetCheck: {
    color: colors.primary,
    fontSize: 20,
    fontWeight: 'bold',
  },
  confirmButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    marginTop: 20,
  },
  confirmButtonDisabled: {
    opacity: 0.5,
  },
  confirmButtonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
  },

  // Interface Loup
  wolfContainer: {
    flex: 1,
  },
  wolfHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  wolfEmoji: {
    fontSize: 60,
    marginBottom: 10,
  },
  wolfTitle: {
    color: '#8B0000',
    fontSize: 24,
    fontWeight: 'bold',
  },
  wolfPackInfo: {
    backgroundColor: 'rgba(139, 0, 0, 0.2)',
    borderRadius: 12,
    padding: 15,
    marginBottom: 20,
  },
  wolfPackLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    marginBottom: 8,
  },
  wolfPackMember: {
    color: '#DC2626',
    fontSize: 14,
    marginBottom: 4,
  },

  // Interface Cupidon
  cupidContainer: {
    flex: 1,
  },
  cupidHeader: {
    alignItems: 'center',
    marginBottom: 15,
  },
  cupidEmoji: {
    fontSize: 60,
    marginBottom: 10,
  },
  cupidTitle: {
    color: '#EC4899',
    fontSize: 24,
    fontWeight: 'bold',
  },
  cupidSubtext: {
    color: colors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 22,
  },
  cupidDone: {
    backgroundColor: 'rgba(236, 72, 153, 0.2)',
    borderRadius: 16,
    padding: 30,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#EC4899',
  },
  cupidDoneIcon: {
    fontSize: 50,
    color: '#EC4899',
    marginBottom: 15,
  },
  cupidDoneText: {
    color: '#EC4899',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  cupidDoneSubtext: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  cupidSelection: {
    marginBottom: 15,
    alignItems: 'center',
  },
  cupidSelectionTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
  },
  cupidSelectedList: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 10,
  },
  cupidSelectedBadge: {
    backgroundColor: 'rgba(236, 72, 153, 0.3)',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#EC4899',
  },
  cupidSelectedName: {
    color: '#EC4899',
    fontSize: 14,
    fontWeight: '600',
  },
  cupidPlayerList: {
    maxHeight: 280,
    marginBottom: 15,
  },
  cupidPlayerCard: {
    backgroundColor: colors.backgroundCard,
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cupidPlayerCardSelected: {
    backgroundColor: 'rgba(236, 72, 153, 0.2)',
    borderWidth: 2,
    borderColor: '#EC4899',
  },
  cupidPlayerName: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  cupidPlayerCheck: {
    fontSize: 20,
  },
  cupidButton: {
    backgroundColor: '#EC4899',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
  },
  cupidButtonDisabled: {
    opacity: 0.5,
  },
  cupidButtonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
  },

  // Interface Voyante
  seerContainer: {
    flex: 1,
  },
  seerHeader: {
    alignItems: 'center',
    marginBottom: 10,
  },
  seerEmoji: {
    fontSize: 60,
    marginBottom: 10,
  },
  seerTitle: {
    color: '#8B5CF6',
    fontSize: 24,
    fontWeight: 'bold',
  },
  seerSubtext: {
    color: colors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
  },

  // Interface Sorcière
  witchContainer: {
    flex: 1,
  },
  witchHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  witchEmoji: {
    fontSize: 60,
    marginBottom: 10,
  },
  witchTitle: {
    color: '#059669',
    fontSize: 24,
    fontWeight: 'bold',
  },
  witchAlert: {
    backgroundColor: 'rgba(220, 38, 38, 0.2)',
    borderRadius: 12,
    padding: 15,
    alignItems: 'center',
    marginBottom: 20,
  },
  witchAlertIcon: {
    fontSize: 30,
    marginBottom: 8,
  },
  witchAlertText: {
    color: colors.danger,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 15,
  },
  witchSaveButton: {
    backgroundColor: colors.success,
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 25,
  },
  witchSaveButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  witchPotions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginBottom: 20,
  },
  potionCard: {
    backgroundColor: colors.backgroundCard,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    width: 120,
  },
  potionUsed: {
    opacity: 0.4,
  },
  potionIcon: {
    fontSize: 30,
    marginBottom: 8,
  },
  potionName: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  potionStatus: {
    color: colors.textSecondary,
    fontSize: 11,
  },
  witchKillTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  witchSkipButton: {
    backgroundColor: colors.backgroundCard,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  witchSkipButtonText: {
    color: colors.textSecondary,
    fontSize: 16,
  },

  // Jour Discussion
  dayContainer: {
    flex: 1,
  },
  dayHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  dayEmoji: {
    fontSize: 60,
    marginBottom: 10,
  },
  dayTitle: {
    color: '#F59E0B',
    fontSize: 24,
    fontWeight: 'bold',
  },
  daySubtext: {
    color: colors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
  },
  timerContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  timerLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    marginBottom: 5,
  },
  timerValue: {
    color: colors.textPrimary,
    fontSize: 48,
    fontWeight: 'bold',
    fontFamily: 'monospace',
  },
  timerWarning: {
    color: colors.danger,
  },
  alivePlayersSection: {
    flex: 1,
  },
  aliveSectionTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  alivePlayersList: {
    maxHeight: 250,
  },
  alivePlayerCard: {
    backgroundColor: colors.backgroundCard,
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
  },
  alivePlayerName: {
    color: colors.textPrimary,
    fontSize: 15,
  },

  // Vote
  voteContainer: {
    flex: 1,
  },
  voteHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  voteEmoji: {
    fontSize: 60,
    marginBottom: 10,
  },
  voteTitle: {
    color: '#EF4444',
    fontSize: 24,
    fontWeight: 'bold',
  },
  votedContainer: {
    alignItems: 'center',
    padding: 30,
    backgroundColor: colors.backgroundCard,
    borderRadius: 16,
  },
  votedIcon: {
    fontSize: 50,
    color: colors.success,
    marginBottom: 15,
  },
  votedText: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 10,
  },
  votedSubtext: {
    color: colors.textSecondary,
    fontSize: 14,
  },

  // Phase par défaut
  defaultContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 100,
  },
  phaseCard: {
    backgroundColor: colors.backgroundCard,
    borderRadius: 20,
    padding: 30,
    alignItems: 'center',
    marginBottom: 20,
  },
  phaseIcon: {
    fontSize: 60,
    marginBottom: 15,
  },
  phaseName: {
    color: colors.textPrimary,
    fontSize: 24,
    fontWeight: 'bold',
  },
  defaultText: {
    color: colors.textSecondary,
    fontSize: 16,
  },

  // Bouton flottant rôle
  floatingRoleButton: {
    position: 'absolute',
    bottom: 30,
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.backgroundCard,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
  },
  floatingRoleIcon: {
    fontSize: 30,
  },

  // Modal résultat voyante
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  seerResultModal: {
    backgroundColor: colors.backgroundCard,
    borderRadius: 24,
    padding: 30,
    alignItems: 'center',
    width: '85%',
  },
  seerResultTitle: {
    color: '#8B5CF6',
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  seerResultPlayer: {
    color: colors.textPrimary,
    fontSize: 20,
    marginBottom: 20,
  },
  seerResultRole: {
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    width: '100%',
    marginBottom: 15,
  },
  seerResultIcon: {
    fontSize: 50,
    marginBottom: 10,
  },
  seerResultRoleName: {
    color: '#FFF',
    fontSize: 24,
    fontWeight: 'bold',
  },
  seerResultTeam: {
    color: colors.textSecondary,
    fontSize: 14,
    marginBottom: 25,
  },
  seerResultButton: {
    backgroundColor: '#8B5CF6',
    paddingHorizontal: 40,
    paddingVertical: 15,
    borderRadius: 25,
  },
  seerResultButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },

  // Modal rôle
  roleModalContent: {
    backgroundColor: colors.backgroundCard,
    borderRadius: 24,
    width: '85%',
    overflow: 'hidden',
  },
  roleModalHeader: {
    padding: 30,
    alignItems: 'center',
  },
  roleModalIcon: {
    fontSize: 60,
    marginBottom: 15,
  },
  roleModalName: {
    color: '#FFF',
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  roleModalTeam: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
  },
  roleModalBody: {
    padding: 25,
  },
  roleModalDescription: {
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 15,
  },
  roleModalPower: {
    color: colors.special,
    fontSize: 14,
    fontStyle: 'italic',
  },
  roleModalClose: {
    borderTopWidth: 1,
    borderTopColor: colors.backgroundSecondary,
    padding: 18,
    alignItems: 'center',
  },
  roleModalCloseText: {
    color: colors.textSecondary,
    fontSize: 16,
  },

  // ==================== STYLES VOTE RESULT ====================
  voteResultContainer: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 20,
  },
  voteResultHeader: {
    alignItems: 'center',
    marginBottom: 30,
  },
  voteResultEmoji: {
    fontSize: 70,
    marginBottom: 15,
  },
  voteResultTitle: {
    color: colors.textPrimary,
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  eliminatedCard: {
    backgroundColor: colors.backgroundCard,
    borderRadius: 20,
    padding: 30,
    alignItems: 'center',
    width: '100%',
    marginBottom: 20,
    borderWidth: 2,
  },
  eliminatedCardLabel: {
    color: colors.textSecondary,
    fontSize: 14,
    marginBottom: 20,
  },
  eliminatedRoleIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  eliminatedRoleEmoji: {
    fontSize: 50,
  },
  eliminatedName: {
    color: colors.textPrimary,
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  eliminatedReason: {
    color: colors.danger,
    fontSize: 16,
    marginBottom: 25,
  },
  eliminatedRoleReveal: {
    alignItems: 'center',
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 12,
    padding: 15,
    width: '100%',
  },
  eliminatedRoleLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    marginBottom: 5,
  },
  eliminatedRoleName: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  eliminatedRoleTeam: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  heartbreakCard: {
    backgroundColor: 'rgba(236, 72, 153, 0.2)',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    width: '100%',
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#EC4899',
  },
  heartbreakIcon: {
    fontSize: 50,
    marginBottom: 10,
  },
  heartbreakText: {
    color: '#EC4899',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 5,
    textAlign: 'center',
  },
  heartbreakSubtext: {
    color: colors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
  },
  noEliminationCard: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderRadius: 20,
    padding: 30,
    alignItems: 'center',
    width: '100%',
    marginBottom: 20,
    borderWidth: 2,
    borderColor: colors.success,
  },
  noEliminationIcon: {
    fontSize: 50,
    marginBottom: 15,
  },
  noEliminationText: {
    color: colors.success,
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  noEliminationSubtext: {
    color: colors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
  },
  voteResultHint: {
    color: colors.textDisabled,
    fontSize: 14,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});
