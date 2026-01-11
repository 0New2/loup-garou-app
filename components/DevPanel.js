import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  Dimensions,
  ActivityIndicator,
  Alert,
  Switch
} from 'react-native';
import { ref, onValue, off, set, remove, update } from 'firebase/database';
import { database } from '../firebase';
import { useDevMode } from '../contexts/DevModeContext';
import { ROLES, getDefaultRoleDistribution, getRoleById } from '../utils/roles';
import { countVotes, resolveVote, clearVotes, checkWinCondition } from '../utils/gameLogic';
import colors from '../constants/colors';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function DevPanel() {
  const {
    isDevPanelVisible,
    setIsDevPanelVisible,
    currentGameCode,
    currentPlayerId,
    originalPlayerId,
    eventLogs,
    switchToPlayer,
    resetToOriginalPlayer,
    addLog,
    clearLogs,
    getNextBotName,
    skipAnimationEnabled,
    toggleSkipAnimation,
    testRoleReveal,
    getNavigation,
  } = useDevMode();

  const [activeTab, setActiveTab] = useState('players');
  const [players, setPlayers] = useState([]);
  const [gameState, setGameState] = useState(null);
  const [gameConfig, setGameConfig] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedPlayerForRole, setSelectedPlayerForRole] = useState(null);
  const [isTestingAllRoles, setIsTestingAllRoles] = useState(false);
  const testAllRolesRef = useRef(null);

  // États pour les tests de vote
  const [votes, setVotes] = useState({});
  const [voteStats, setVoteStats] = useState({ voteCounts: {}, totalVotes: 0, hasTie: false, tiedPlayers: [] });
  const [lovers, setLovers] = useState(null);
  const [simulateLoversEnabled, setSimulateLoversEnabled] = useState(false);

  // Liste des rôles disponibles
  const availableRoles = Object.values(ROLES);

  // Écouter les données du jeu
  useEffect(() => {
    if (!currentGameCode || !isDevPanelVisible) return;

    const playersRef = ref(database, `games/${currentGameCode}/players`);
    const stateRef = ref(database, `games/${currentGameCode}/gameState`);
    const configRef = ref(database, `games/${currentGameCode}/config`);

    const unsubPlayers = onValue(playersRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const list = Object.entries(data).map(([id, info]) => ({ id, ...info }));
        list.sort((a, b) => a.joinedAt - b.joinedAt);
        setPlayers(list);
      } else {
        setPlayers([]);
      }
    });

    const unsubState = onValue(stateRef, (snapshot) => {
      setGameState(snapshot.exists() ? snapshot.val() : null);
    });

    const unsubConfig = onValue(configRef, (snapshot) => {
      setGameConfig(snapshot.exists() ? snapshot.val() : null);
    });

    // Écouter les votes
    const votesRef = ref(database, `games/${currentGameCode}/votes`);
    const unsubVotes = onValue(votesRef, (snapshot) => {
      if (snapshot.exists()) {
        const votesData = snapshot.val();
        setVotes(votesData);
        setVoteStats(countVotes(votesData));
      } else {
        setVotes({});
        setVoteStats({ voteCounts: {}, totalVotes: 0, hasTie: false, tiedPlayers: [] });
      }
    });

    // Écouter les amoureux
    const loversRef = ref(database, `games/${currentGameCode}/lovers`);
    const unsubLovers = onValue(loversRef, (snapshot) => {
      setLovers(snapshot.exists() ? snapshot.val() : null);
    });

    return () => {
      off(playersRef);
      off(stateRef);
      off(configRef);
      off(votesRef);
      off(loversRef);
    };
  }, [currentGameCode, isDevPanelVisible]);

  // Cleanup test all roles on unmount
  useEffect(() => {
    return () => {
      if (testAllRolesRef.current) {
        clearTimeout(testAllRolesRef.current);
      }
    };
  }, []);

  // Joueurs non-MJ (ceux qui reçoivent des rôles)
  const gamePlayers = players.filter(p => !p.isMaster);

  // ==================== NAVIGATION FORCÉE ====================

  // Naviguer vers un écran spécifique avec un joueur donné
  const navigateAsPlayer = (playerId, screenName) => {
    const nav = getNavigation();
    if (!nav || !currentGameCode) {
      addLog('Erreur: Navigation ou GameCode non disponible');
      return;
    }

    const player = players.find(p => p.id === playerId);
    if (!player) {
      addLog('Erreur: Joueur non trouvé');
      return;
    }

    // Mettre à jour le joueur actif dans le contexte
    switchToPlayer(playerId, player.name);

    // Fermer le panneau dev
    setIsDevPanelVisible(false);

    // Naviguer vers l'écran demandé
    setTimeout(() => {
      nav.reset({
        index: 0,
        routes: [{
          name: screenName,
          params: {
            gameCode: currentGameCode,
            playerId: playerId,
            isMaster: player.isMaster,
            playerName: player.name,
          }
        }],
      });
      addLog(`Navigation: ${player.name} → ${screenName}`);
    }, 300);
  };

  // Voir la révélation du rôle d'un joueur spécifique
  const viewPlayerRoleReveal = (playerId) => {
    const player = players.find(p => p.id === playerId);
    if (!player) return;

    if (player.isMaster) {
      Alert.alert('Erreur', 'Le MJ n\'a pas de rôle à révéler');
      return;
    }

    navigateAsPlayer(playerId, 'RoleReveal');
  };

  // Aller au Lobby en tant que joueur
  const goToLobbyAsPlayer = (playerId) => {
    navigateAsPlayer(playerId, 'Lobby');
  };

  // Aller à GameMaster
  const goToGameMaster = () => {
    const mj = players.find(p => p.isMaster);
    if (!mj) {
      Alert.alert('Erreur', 'Aucun MJ dans la partie');
      return;
    }
    navigateAsPlayer(mj.id, 'GameMaster');
  };

  // Ajouter un bot
  const addBot = async () => {
    if (!currentGameCode) return;

    setIsLoading(true);
    try {
      const botName = getNextBotName(players);
      const botId = `bot_${Date.now()}`;

      await set(ref(database, `games/${currentGameCode}/players/${botId}`), {
        name: botName,
        role: null,
        isAlive: true,
        isMaster: false,
        isBot: true,
        joinedAt: Date.now(),
      });

      addLog(`Bot ajouté: ${botName}`);
    } catch (error) {
      addLog(`Erreur ajout bot: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Supprimer tous les bots
  const removeAllBots = async () => {
    if (!currentGameCode) return;

    setIsLoading(true);
    try {
      const bots = players.filter(p => p.isBot);
      for (const bot of bots) {
        await remove(ref(database, `games/${currentGameCode}/players/${bot.id}`));
      }
      addLog(`${bots.length} bots supprimés`);
    } catch (error) {
      addLog(`Erreur suppression bots: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Forcer un changement de phase
  const forcePhase = async (phase) => {
    if (!currentGameCode) return;

    try {
      await set(ref(database, `games/${currentGameCode}/gameState/currentPhase`), phase);
      await set(ref(database, `games/${currentGameCode}/gameState/lastPhaseChange`), Date.now());
      addLog(`Phase forcée: ${phase}`);
    } catch (error) {
      addLog(`Erreur changement phase: ${error.message}`);
    }
  };

  // Forcer le statut du jeu
  const forceStatus = async (status) => {
    if (!currentGameCode) return;

    try {
      await set(ref(database, `games/${currentGameCode}/config/status`), status);
      addLog(`Statut forcé: ${status}`);
    } catch (error) {
      addLog(`Erreur changement statut: ${error.message}`);
    }
  };

  // ==================== FONCTIONS VOTE TEST ====================

  // Simuler la phase de vote
  const simulateVotePhase = async () => {
    if (!currentGameCode) return;

    setIsLoading(true);
    try {
      // Forcer la phase de vote
      await update(ref(database), {
        [`games/${currentGameCode}/gameState/currentPhase`]: 'day_vote',
        [`games/${currentGameCode}/gameState/lastPhaseChange`]: Date.now(),
      });
      addLog('Phase vote simulée');
    } catch (error) {
      addLog(`Erreur: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Remplir des votes aléatoires
  const fillRandomVotes = async () => {
    if (!currentGameCode) return;

    const alivePlayers = gamePlayers.filter(p => p.isAlive !== false);
    if (alivePlayers.length < 2) {
      Alert.alert('Erreur', 'Pas assez de joueurs vivants');
      return;
    }

    setIsLoading(true);
    try {
      const newVotes = {};
      for (const voter of alivePlayers) {
        // Voter pour un joueur aléatoire (différent de soi-même)
        const validTargets = alivePlayers.filter(p => p.id !== voter.id);
        const randomTarget = validTargets[Math.floor(Math.random() * validTargets.length)];
        newVotes[voter.id] = randomTarget.id;
      }

      await set(ref(database, `games/${currentGameCode}/votes`), newVotes);
      addLog(`${alivePlayers.length} votes aléatoires créés`);
    } catch (error) {
      addLog(`Erreur votes aléatoires: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Créer une égalité au vote
  const createTieVotes = async () => {
    if (!currentGameCode) return;

    const alivePlayers = gamePlayers.filter(p => p.isAlive !== false);
    if (alivePlayers.length < 4) {
      Alert.alert('Erreur', 'Minimum 4 joueurs vivants pour créer une égalité');
      return;
    }

    setIsLoading(true);
    try {
      const target1 = alivePlayers[0];
      const target2 = alivePlayers[1];
      const voters = alivePlayers.slice(2);

      const newVotes = {};
      voters.forEach((voter, index) => {
        // Alterner les votes entre les deux cibles
        newVotes[voter.id] = index % 2 === 0 ? target1.id : target2.id;
      });
      // Les deux cibles votent l'une pour l'autre
      newVotes[target1.id] = target2.id;
      newVotes[target2.id] = target1.id;

      await set(ref(database, `games/${currentGameCode}/votes`), newVotes);
      addLog(`Égalité créée entre ${target1.name} et ${target2.name}`);
    } catch (error) {
      addLog(`Erreur création égalité: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Effacer tous les votes
  const handleClearVotes = async () => {
    if (!currentGameCode) return;

    try {
      await clearVotes(currentGameCode);
      addLog('Votes effacés');
    } catch (error) {
      addLog(`Erreur effacement votes: ${error.message}`);
    }
  };

  // Simuler des amoureux
  const simulateLovers = async () => {
    if (!currentGameCode) return;

    const alivePlayers = gamePlayers.filter(p => p.isAlive !== false);
    if (alivePlayers.length < 2) {
      Alert.alert('Erreur', 'Minimum 2 joueurs vivants');
      return;
    }

    setIsLoading(true);
    try {
      const lover1 = alivePlayers[0];
      const lover2 = alivePlayers[1];

      await set(ref(database, `games/${currentGameCode}/lovers`), {
        player1: lover1.id,
        player1Name: lover1.name,
        player2: lover2.id,
        player2Name: lover2.name,
        formedAt: Date.now(),
      });
      addLog(`Amoureux créés: ${lover1.name} + ${lover2.name}`);
    } catch (error) {
      addLog(`Erreur création amoureux: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Supprimer les amoureux
  const removeLovers = async () => {
    if (!currentGameCode) return;

    try {
      await remove(ref(database, `games/${currentGameCode}/lovers`));
      addLog('Amoureux supprimés');
    } catch (error) {
      addLog(`Erreur suppression amoureux: ${error.message}`);
    }
  };

  // Tester scénario victoire village
  const testVillageWins = async () => {
    if (!currentGameCode) return;

    setIsLoading(true);
    try {
      // Tuer tous les loups
      const updates = {};
      gamePlayers.forEach(player => {
        const role = getRoleById(player.role);
        if (role?.team === 'loups') {
          updates[`games/${currentGameCode}/players/${player.id}/isAlive`] = false;
        }
      });

      if (Object.keys(updates).length === 0) {
        Alert.alert('Erreur', 'Aucun loup dans la partie');
        return;
      }

      await update(ref(database), updates);
      addLog('Tous les loups tués - Test victoire village');

      // Vérifier la condition
      const result = checkWinCondition(gamePlayers.reduce((acc, p) => {
        const role = getRoleById(p.role);
        acc[p.id] = { ...p, isAlive: role?.team !== 'loups' };
        return acc;
      }, {}));

      if (result) {
        Alert.alert('Résultat', `${result.winner === 'village' ? '✓ Village gagne' : 'Loups gagnent'}\n\n${result.message}`);
      }
    } catch (error) {
      addLog(`Erreur: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Tester scénario victoire loups
  const testWolvesWin = async () => {
    if (!currentGameCode) return;

    setIsLoading(true);
    try {
      // Compter les loups et villageois
      const wolves = gamePlayers.filter(p => getRoleById(p.role)?.team === 'loups');
      const villagers = gamePlayers.filter(p => getRoleById(p.role)?.team === 'village');

      if (wolves.length === 0) {
        Alert.alert('Erreur', 'Aucun loup dans la partie');
        return;
      }

      // Tuer des villageois jusqu'à égalité
      const villagersToKill = villagers.slice(0, villagers.length - wolves.length + 1);

      const updates = {};
      villagersToKill.forEach(player => {
        updates[`games/${currentGameCode}/players/${player.id}/isAlive`] = false;
      });

      await update(ref(database), updates);
      addLog(`${villagersToKill.length} villageois tués - Test victoire loups`);

      // Vérifier la condition
      const survivingPlayers = gamePlayers.reduce((acc, p) => {
        const isKilled = villagersToKill.some(k => k.id === p.id);
        acc[p.id] = { ...p, isAlive: !isKilled && p.isAlive !== false };
        return acc;
      }, {});

      const result = checkWinCondition(survivingPlayers);
      if (result) {
        Alert.alert('Résultat', `${result.winner === 'loups' ? '✓ Loups gagnent' : 'Village gagne'}\n\n${result.message}`);
      }
    } catch (error) {
      addLog(`Erreur: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Ressusciter tous les joueurs
  const reviveAllPlayers = async () => {
    if (!currentGameCode) return;

    setIsLoading(true);
    try {
      const updates = {};
      gamePlayers.forEach(player => {
        updates[`games/${currentGameCode}/players/${player.id}/isAlive`] = true;
      });

      await update(ref(database), updates);
      addLog('Tous les joueurs ressuscités');
    } catch (error) {
      addLog(`Erreur: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // ==================== FONCTIONS TEST FIN DE PARTIE ====================

  // Simuler victoire village avec historique
  const simulateVillageVictory = async () => {
    if (!currentGameCode) return;

    setIsLoading(true);
    try {
      const updates = {};

      // Tuer tous les loups
      gamePlayers.forEach(player => {
        const role = getRoleById(player.role);
        if (role?.team === 'loups') {
          updates[`games/${currentGameCode}/players/${player.id}/isAlive`] = false;
          updates[`games/${currentGameCode}/players/${player.id}/deathReason`] = 'voted';
          updates[`games/${currentGameCode}/players/${player.id}/deathNight`] = 3;
        }
      });

      // Créer l'état de fin
      updates[`games/${currentGameCode}/config/status`] = 'finished';
      updates[`games/${currentGameCode}/gameState/currentPhase`] = 'finished';
      updates[`games/${currentGameCode}/gameState/nightCount`] = 5;
      updates[`games/${currentGameCode}/gameState/endedAt`] = Date.now();
      updates[`games/${currentGameCode}/result/winner`] = 'village';
      updates[`games/${currentGameCode}/result/message`] = 'Tous les loups ont été éliminés !';

      await update(ref(database), updates);
      addLog('Victoire village simulée');

      // Naviguer vers EndGame
      const nav = getNavigation();
      if (nav) {
        setIsDevPanelVisible(false);
        setTimeout(() => {
          nav.replace('EndGame', { gameCode: currentGameCode, playerId: currentPlayerId });
        }, 300);
      }
    } catch (error) {
      addLog(`Erreur: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Simuler victoire loups avec historique
  const simulateWolvesVictory = async () => {
    if (!currentGameCode) return;

    setIsLoading(true);
    try {
      const updates = {};

      // Tuer assez de villageois pour que les loups gagnent
      const wolves = gamePlayers.filter(p => getRoleById(p.role)?.team === 'loups');
      const villagers = gamePlayers.filter(p => getRoleById(p.role)?.team === 'village');

      // Tuer des villageois jusqu'à égalité ou moins
      const villagersToKill = villagers.slice(0, villagers.length - wolves.length + 1);

      villagersToKill.forEach((player, index) => {
        updates[`games/${currentGameCode}/players/${player.id}/isAlive`] = false;
        updates[`games/${currentGameCode}/players/${player.id}/deathReason`] = index % 2 === 0 ? 'devoured' : 'voted';
        updates[`games/${currentGameCode}/players/${player.id}/deathNight`] = Math.floor(index / 2) + 1;
      });

      // Créer l'état de fin
      updates[`games/${currentGameCode}/config/status`] = 'finished';
      updates[`games/${currentGameCode}/gameState/currentPhase`] = 'finished';
      updates[`games/${currentGameCode}/gameState/nightCount`] = 4;
      updates[`games/${currentGameCode}/gameState/endedAt`] = Date.now();
      updates[`games/${currentGameCode}/result/winner`] = 'loups';
      updates[`games/${currentGameCode}/result/message`] = 'Les loups sont en supériorité numérique !';

      await update(ref(database), updates);
      addLog('Victoire loups simulée');

      // Naviguer vers EndGame
      const nav = getNavigation();
      if (nav) {
        setIsDevPanelVisible(false);
        setTimeout(() => {
          nav.replace('EndGame', { gameCode: currentGameCode, playerId: currentPlayerId });
        }, 300);
      }
    } catch (error) {
      addLog(`Erreur: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Simuler fin avec configuration personnalisée
  const simulateCustomEndGame = async (winner, nightsPlayed = 5) => {
    if (!currentGameCode) return;

    setIsLoading(true);
    try {
      const updates = {};

      // Tuer des joueurs aléatoirement
      const playersToKill = gamePlayers.slice(0, Math.floor(gamePlayers.length / 2));
      const deathReasons = ['devoured', 'voted', 'poisoned', 'heartbreak'];

      playersToKill.forEach((player, index) => {
        updates[`games/${currentGameCode}/players/${player.id}/isAlive`] = false;
        updates[`games/${currentGameCode}/players/${player.id}/deathReason`] = deathReasons[index % deathReasons.length];
        updates[`games/${currentGameCode}/players/${player.id}/deathNight`] = (index % nightsPlayed) + 1;
      });

      // Créer l'état de fin
      updates[`games/${currentGameCode}/config/status`] = 'finished';
      updates[`games/${currentGameCode}/gameState/currentPhase`] = 'finished';
      updates[`games/${currentGameCode}/gameState/nightCount`] = nightsPlayed;
      updates[`games/${currentGameCode}/gameState/endedAt`] = Date.now();
      updates[`games/${currentGameCode}/result/winner`] = winner;
      updates[`games/${currentGameCode}/result/message`] = winner === 'village'
        ? 'Tous les loups ont été éliminés !'
        : 'Les loups dominent le village !';

      await update(ref(database), updates);
      addLog(`Fin personnalisée: ${winner}, ${nightsPlayed} nuits`);

      // Naviguer vers EndGame
      const nav = getNavigation();
      if (nav) {
        setIsDevPanelVisible(false);
        setTimeout(() => {
          nav.replace('EndGame', { gameCode: currentGameCode, playerId: currentPlayerId });
        }, 300);
      }
    } catch (error) {
      addLog(`Erreur: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Ouvrir EndGameScreen directement (pour tester la vue)
  const openEndGameScreen = () => {
    const nav = getNavigation();
    if (nav) {
      setIsDevPanelVisible(false);
      setTimeout(() => {
        nav.navigate('EndGame', { gameCode: currentGameCode, playerId: currentPlayerId });
      }, 300);
    }
  };

  // Basculer vers vue MJ ou joueur pour tester EndGame
  const testEndGameAsRole = (asMaster) => {
    const targetPlayer = asMaster
      ? players.find(p => p.isMaster)
      : players.find(p => !p.isMaster);

    if (!targetPlayer) {
      Alert.alert('Erreur', asMaster ? 'Aucun MJ trouvé' : 'Aucun joueur trouvé');
      return;
    }

    switchToPlayer(targetPlayer.id, targetPlayer.name);
    openEndGameScreen();
  };

  // ==================== FONCTIONS RÔLES ====================

  // Distribution automatique des rôles
  const distributeRolesAuto = async () => {
    if (!currentGameCode || gamePlayers.length < 3) {
      Alert.alert('Erreur', 'Minimum 3 joueurs (hors MJ) requis');
      return;
    }

    setIsLoading(true);
    try {
      const roleConfig = getDefaultRoleDistribution(gamePlayers.length);
      if (!roleConfig) {
        throw new Error('Configuration introuvable');
      }

      // Créer la liste des rôles à distribuer
      const rolesToAssign = [];
      Object.entries(roleConfig).forEach(([roleId, count]) => {
        for (let i = 0; i < count; i++) {
          rolesToAssign.push(roleId);
        }
      });

      // Mélanger (Fisher-Yates)
      for (let i = rolesToAssign.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [rolesToAssign[i], rolesToAssign[j]] = [rolesToAssign[j], rolesToAssign[i]];
      }

      // Assigner les rôles
      const updates = {};
      gamePlayers.forEach((player, index) => {
        const assignedRole = rolesToAssign[index];
        updates[`games/${currentGameCode}/players/${player.id}/role`] = assignedRole;
        updates[`games/${currentGameCode}/players/${player.id}/isAlive`] = true;
      });

      // Mettre à jour le statut
      updates[`games/${currentGameCode}/config/status`] = 'roles_distributed';
      updates[`games/${currentGameCode}/gameState/currentPhase`] = 'role_reveal';
      updates[`games/${currentGameCode}/roleConfig`] = roleConfig;

      await update(ref(database), updates);
      addLog(`Rôles distribués automatiquement à ${gamePlayers.length} joueurs`);
    } catch (error) {
      addLog(`Erreur distribution: ${error.message}`);
      Alert.alert('Erreur', error.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Forcer un rôle spécifique pour un joueur
  const forceRoleForPlayer = async (playerId, roleId) => {
    if (!currentGameCode) return;

    setIsLoading(true);
    try {
      await set(ref(database, `games/${currentGameCode}/players/${playerId}/role`), roleId);
      const player = players.find(p => p.id === playerId);
      const role = getRoleById(roleId);
      addLog(`Rôle forcé: ${player?.name} → ${role?.name}`);
      setSelectedPlayerForRole(null);
    } catch (error) {
      addLog(`Erreur forcer rôle: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Réinitialiser tous les rôles
  const resetAllRoles = async () => {
    if (!currentGameCode) return;

    setIsLoading(true);
    try {
      const updates = {};
      gamePlayers.forEach(player => {
        updates[`games/${currentGameCode}/players/${player.id}/role`] = null;
        updates[`games/${currentGameCode}/players/${player.id}/isAlive`] = true;
      });
      updates[`games/${currentGameCode}/config/status`] = 'lobby';
      updates[`games/${currentGameCode}/gameState/currentPhase`] = 'lobby';

      await update(ref(database), updates);
      addLog('Tous les rôles réinitialisés');
    } catch (error) {
      addLog(`Erreur réinitialisation: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Basculer MJ <-> Joueur
  const toggleMasterStatus = async (playerId) => {
    if (!currentGameCode) return;

    const player = players.find(p => p.id === playerId);
    if (!player) return;

    setIsLoading(true);
    try {
      const newIsMaster = !player.isMaster;

      // Si on devient MJ, retirer le rôle
      const updates = {};
      updates[`games/${currentGameCode}/players/${playerId}/isMaster`] = newIsMaster;
      if (newIsMaster) {
        updates[`games/${currentGameCode}/players/${playerId}/role`] = null;
      }

      await update(ref(database), updates);
      addLog(`${player.name}: ${newIsMaster ? 'Devient MJ' : 'Devient Joueur'}`);
    } catch (error) {
      addLog(`Erreur toggle MJ: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Tuer/Ressusciter un joueur
  const togglePlayerAlive = async (playerId) => {
    if (!currentGameCode) return;

    const player = players.find(p => p.id === playerId);
    if (!player) return;

    setIsLoading(true);
    try {
      await set(
        ref(database, `games/${currentGameCode}/players/${playerId}/isAlive`),
        !player.isAlive
      );
      addLog(`${player.name}: ${player.isAlive ? 'Éliminé' : 'Ressuscité'}`);
    } catch (error) {
      addLog(`Erreur toggle vivant: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // ==================== FONCTIONS TEST RÉVÉLATION ====================

  // Tester un rôle spécifique (simulation sans joueur réel)
  const handleTestRole = (roleId) => {
    setIsDevPanelVisible(false);
    setTimeout(() => {
      testRoleReveal(roleId, skipAnimationEnabled);
    }, 300);
  };

  // Tester tous les rôles en boucle
  const testAllRoles = () => {
    if (isTestingAllRoles) {
      // Arrêter le test
      if (testAllRolesRef.current) {
        clearTimeout(testAllRolesRef.current);
        testAllRolesRef.current = null;
      }
      setIsTestingAllRoles(false);
      addLog('Test tous rôles: ARRÊTÉ');
      return;
    }

    setIsTestingAllRoles(true);
    setIsDevPanelVisible(false);
    addLog('Test tous rôles: DÉMARRÉ');

    let index = 0;
    const roles = Object.values(ROLES);

    const showNextRole = () => {
      if (index < roles.length) {
        testRoleReveal(roles[index].id, true); // Skip animation pour aller vite
        index++;
        testAllRolesRef.current = setTimeout(showNextRole, 2500); // 2.5s par rôle
      } else {
        setIsTestingAllRoles(false);
        addLog('Test tous rôles: TERMINÉ');
      }
    };

    showNextRole();
  };

  // ==================== RENDU DES ONGLETS ====================

  // Onglet Joueurs (AMÉLIORÉ avec navigation)
  const renderPlayersTab = () => (
    <View style={styles.tabContent}>
      {/* Actions rapides */}
      <View style={styles.actionRow}>
        <TouchableOpacity
          style={[styles.actionButton, styles.greenButton]}
          onPress={addBot}
          disabled={isLoading}
        >
          <Text style={styles.actionButtonText}>+ Bot</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.redButton]}
          onPress={removeAllBots}
          disabled={isLoading}
        >
          <Text style={styles.actionButtonText}>Suppr. Bots</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.purpleButton]}
          onPress={goToGameMaster}
        >
          <Text style={styles.actionButtonText}>Vue MJ</Text>
        </TouchableOpacity>
      </View>

      {/* Instructions */}
      <View style={styles.instructionBox}>
        <Text style={styles.instructionText}>
          Tap sur un joueur pour naviguer vers sa vue
        </Text>
      </View>

      <ScrollView style={styles.playersList}>
        {players.map((player) => {
          const isActive = player.id === currentPlayerId;
          const isOriginal = player.id === originalPlayerId;
          const role = getRoleById(player.role);

          return (
            <View key={player.id} style={styles.playerItemContainer}>
              <TouchableOpacity
                style={[
                  styles.playerItem,
                  isActive && styles.playerItemActive,
                  player.isMaster && styles.playerItemMaster,
                ]}
                onPress={() => {
                  if (player.isMaster) {
                    goToGameMaster();
                  } else {
                    goToLobbyAsPlayer(player.id);
                  }
                }}
              >
                <View style={styles.playerInfo}>
                  <View style={styles.playerNameRow}>
                    {player.isBot && <Text style={styles.botIcon}>🤖</Text>}
                    {player.isMaster && <Text style={styles.mjIcon}>👑</Text>}
                    <Text style={[
                      styles.playerName,
                      !player.isAlive && styles.playerNameDead
                    ]}>
                      {player.name}
                      {isOriginal && ' (Vous)'}
                    </Text>
                  </View>
                  <Text style={[styles.playerDetails, { color: role?.color || '#888' }]}>
                    {player.isMaster ? 'Maître du Jeu' : (role?.name || 'Sans rôle')}
                    {!player.isMaster && !player.isAlive && ' • ☠️ Mort'}
                  </Text>
                </View>
                {isActive && (
                  <View style={styles.activeBadge}>
                    <Text style={styles.activeBadgeText}>ACTIF</Text>
                  </View>
                )}
              </TouchableOpacity>

              {/* Boutons d'action rapide pour les joueurs (non-MJ) */}
              {!player.isMaster && (
                <View style={styles.playerQuickActions}>
                  <TouchableOpacity
                    style={[styles.quickActionBtn, styles.revealBtn]}
                    onPress={() => viewPlayerRoleReveal(player.id)}
                  >
                    <Text style={styles.quickActionText}>🎴</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.quickActionBtn, styles.lobbyBtn]}
                    onPress={() => goToLobbyAsPlayer(player.id)}
                  >
                    <Text style={styles.quickActionText}>🏠</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );

  // Onglet Rôles
  const renderRolesTab = () => (
    <View style={styles.tabContent}>
      {/* Actions rapides */}
      <View style={styles.actionRow}>
        <TouchableOpacity
          style={[styles.actionButton, styles.greenButton]}
          onPress={distributeRolesAuto}
          disabled={isLoading || gamePlayers.length < 3}
        >
          <Text style={styles.actionButtonText}>Distrib. Auto</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.redButton]}
          onPress={resetAllRoles}
          disabled={isLoading}
        >
          <Text style={styles.actionButtonText}>Reset Rôles</Text>
        </TouchableOpacity>
      </View>

      {/* Info */}
      <View style={styles.infoBox}>
        <Text style={styles.infoText}>
          {gamePlayers.length} joueur(s) hors MJ
        </Text>
        <Text style={styles.infoTextSmall}>
          Tap sur un joueur pour forcer son rôle
        </Text>
      </View>

      {/* Modal sélection rôle */}
      {selectedPlayerForRole && (
        <View style={styles.roleSelector}>
          <View style={styles.roleSelectorHeader}>
            <Text style={styles.roleSelectorTitle}>
              Rôle pour: {players.find(p => p.id === selectedPlayerForRole)?.name}
            </Text>
            <TouchableOpacity onPress={() => setSelectedPlayerForRole(null)}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {availableRoles.map(role => (
              <TouchableOpacity
                key={role.id}
                style={[styles.roleChip, { borderColor: role.color }]}
                onPress={() => forceRoleForPlayer(selectedPlayerForRole, role.id)}
              >
                <Text style={styles.roleChipIcon}>{role.icon}</Text>
                <Text style={[styles.roleChipText, { color: role.color }]}>
                  {role.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Liste des joueurs avec rôles */}
      <ScrollView style={styles.playersList}>
        {gamePlayers.map((player) => {
          const role = getRoleById(player.role);

          return (
            <View key={player.id} style={styles.rolePlayerItem}>
              <TouchableOpacity
                style={styles.rolePlayerMain}
                onPress={() => setSelectedPlayerForRole(player.id)}
              >
                <View style={[
                  styles.roleIconBox,
                  { backgroundColor: role?.color || '#333' }
                ]}>
                  <Text style={styles.roleIconText}>{role?.icon || '❓'}</Text>
                </View>
                <View style={styles.rolePlayerInfo}>
                  <Text style={[
                    styles.rolePlayerName,
                    !player.isAlive && styles.playerNameDead
                  ]}>
                    {player.isBot && '🤖 '}{player.name}
                  </Text>
                  <Text style={[styles.rolePlayerRole, { color: role?.color || '#666' }]}>
                    {role?.name || 'Aucun rôle'}
                    {role && ` • ${role.team === 'loups' ? 'Loup' : 'Village'}`}
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Actions */}
              <View style={styles.rolePlayerActions}>
                <TouchableOpacity
                  style={[styles.miniButton, styles.revealMiniBtn]}
                  onPress={() => viewPlayerRoleReveal(player.id)}
                >
                  <Text style={styles.miniButtonText}>🎴</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.miniButton, player.isAlive ? styles.redMiniButton : styles.greenMiniButton]}
                  onPress={() => togglePlayerAlive(player.id)}
                >
                  <Text style={styles.miniButtonText}>
                    {player.isAlive ? '☠️' : '❤️'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.miniButton, styles.yellowMiniButton]}
                  onPress={() => toggleMasterStatus(player.id)}
                >
                  <Text style={styles.miniButtonText}>👑</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}

        {/* MJ séparé */}
        {players.filter(p => p.isMaster).map(mj => (
          <View key={mj.id} style={[styles.rolePlayerItem, styles.mjItem]}>
            <View style={styles.rolePlayerMain}>
              <View style={[styles.roleIconBox, { backgroundColor: colors.special }]}>
                <Text style={styles.roleIconText}>👑</Text>
              </View>
              <View style={styles.rolePlayerInfo}>
                <Text style={styles.rolePlayerName}>{mj.name}</Text>
                <Text style={[styles.rolePlayerRole, { color: colors.special }]}>
                  Maître du Jeu (ne joue pas)
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={[styles.miniButton, styles.grayMiniButton]}
              onPress={() => toggleMasterStatus(mj.id)}
            >
              <Text style={styles.miniButtonText}>↓</Text>
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>
    </View>
  );

  // Onglet Test Révélation
  const renderTestTab = () => (
    <View style={styles.tabContent}>
      {/* Options de test */}
      <View style={styles.testOptionsSection}>
        <Text style={styles.sectionTitle}>Options de test</Text>

        <View style={styles.optionRow}>
          <View style={styles.optionInfo}>
            <Text style={styles.optionLabel}>Skip animation</Text>
            <Text style={styles.optionDesc}>Passer directement au rôle révélé</Text>
          </View>
          <Switch
            value={skipAnimationEnabled}
            onValueChange={toggleSkipAnimation}
            trackColor={{ false: '#333', true: '#059669' }}
            thumbColor={skipAnimationEnabled ? '#10B981' : '#666'}
          />
        </View>
      </View>

      {/* Actions groupées */}
      <View style={styles.testActionsSection}>
        <Text style={styles.sectionTitle}>Actions rapides</Text>

        <TouchableOpacity
          style={[
            styles.testActionButton,
            isTestingAllRoles ? styles.testActionButtonActive : styles.purpleButton
          ]}
          onPress={testAllRoles}
        >
          <Text style={styles.testActionIcon}>{isTestingAllRoles ? '⏹️' : '▶️'}</Text>
          <View style={styles.testActionInfo}>
            <Text style={styles.testActionLabel}>
              {isTestingAllRoles ? 'Arrêter le test' : 'Tester tous les rôles'}
            </Text>
            <Text style={styles.testActionDesc}>
              {isTestingAllRoles ? 'Test en cours...' : 'Affiche chaque rôle 2.5s'}
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Liste des rôles à tester */}
      <View style={styles.testRolesSection}>
        <Text style={styles.sectionTitle}>Tester un rôle spécifique</Text>
        <Text style={styles.sectionHint}>Tap pour voir la révélation (simulation)</Text>

        <ScrollView style={styles.testRolesList}>
          {/* Loups */}
          <Text style={styles.teamLabel}>🐺 Loups-Garous</Text>
          <View style={styles.testRolesGrid}>
            {availableRoles.filter(r => r.team === 'loups').map(role => (
              <TouchableOpacity
                key={role.id}
                style={[styles.testRoleCard, { borderColor: role.color }]}
                onPress={() => handleTestRole(role.id)}
              >
                <View style={[styles.testRoleIconBg, { backgroundColor: role.color }]}>
                  <Text style={styles.testRoleIcon}>{role.icon}</Text>
                </View>
                <Text style={styles.testRoleName}>{role.name}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Village */}
          <Text style={styles.teamLabel}>🏘️ Village</Text>
          <View style={styles.testRolesGrid}>
            {availableRoles.filter(r => r.team === 'village').map(role => (
              <TouchableOpacity
                key={role.id}
                style={[styles.testRoleCard, { borderColor: role.color }]}
                onPress={() => handleTestRole(role.id)}
              >
                <View style={[styles.testRoleIconBg, { backgroundColor: role.color }]}>
                  <Text style={styles.testRoleIcon}>{role.icon}</Text>
                </View>
                <Text style={styles.testRoleName}>{role.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>
    </View>
  );

  // Onglet Debug
  const renderDebugTab = () => (
    <View style={styles.tabContent}>
      <View style={styles.debugSection}>
        <Text style={styles.debugTitle}>État du jeu</Text>
        <View style={styles.debugInfo}>
          <Text style={styles.debugLabel}>Code:</Text>
          <Text style={styles.debugValue}>{currentGameCode || '-'}</Text>
        </View>
        <View style={styles.debugInfo}>
          <Text style={styles.debugLabel}>Statut:</Text>
          <Text style={styles.debugValue}>{gameConfig?.status || '-'}</Text>
        </View>
        <View style={styles.debugInfo}>
          <Text style={styles.debugLabel}>Phase:</Text>
          <Text style={styles.debugValue}>{gameState?.currentPhase || '-'}</Text>
        </View>
        <View style={styles.debugInfo}>
          <Text style={styles.debugLabel}>Nuit #:</Text>
          <Text style={styles.debugValue}>{gameState?.nightCount ?? '-'}</Text>
        </View>
        <View style={styles.debugInfo}>
          <Text style={styles.debugLabel}>Joueurs:</Text>
          <Text style={styles.debugValue}>
            {gamePlayers.filter(p => p.isAlive).length}/{gamePlayers.length} (hors MJ)
          </Text>
        </View>
        <View style={styles.debugInfo}>
          <Text style={styles.debugLabel}>Vue active:</Text>
          <Text style={styles.debugValue}>
            {players.find(p => p.id === currentPlayerId)?.name || '-'}
          </Text>
        </View>
      </View>

      <Text style={styles.debugTitle}>Forcer le statut</Text>
      <View style={styles.actionRow}>
        <TouchableOpacity
          style={[styles.actionButton, styles.grayButton]}
          onPress={() => forceStatus('lobby')}
        >
          <Text style={styles.actionButtonText}>Lobby</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.blueButton]}
          onPress={() => forceStatus('roles_distributed')}
        >
          <Text style={styles.actionButtonText}>Rôles OK</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.greenButton]}
          onPress={() => forceStatus('playing')}
        >
          <Text style={styles.actionButtonText}>Playing</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.debugTitle}>Forcer la phase</Text>
      <View style={styles.phaseButtons}>
        {['role_reveal', 'night_start', 'night_werewolves', 'night_seer', 'night_witch', 'day_discussion', 'day_vote'].map((phase) => (
          <TouchableOpacity
            key={phase}
            style={[styles.phaseButton, gameState?.currentPhase === phase && styles.phaseButtonActive]}
            onPress={() => forcePhase(phase)}
          >
            <Text style={styles.phaseButtonText}>{phase.replace(/_/g, '\n')}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  // Onglet Vote Test
  const renderVoteTab = () => {
    const alivePlayers = gamePlayers.filter(p => p.isAlive !== false);

    return (
      <View style={styles.tabContent}>
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Section : État actuel des votes */}
          <View style={styles.voteTestSection}>
            <Text style={styles.sectionTitle}>📊 État actuel des votes</Text>
            <View style={styles.voteStatsCard}>
              <View style={styles.voteStatRow}>
                <Text style={styles.voteStatLabel}>Phase:</Text>
                <Text style={[styles.voteStatValue, gameState?.currentPhase === 'day_vote' && { color: colors.primary }]}>
                  {gameState?.currentPhase || '-'}
                </Text>
              </View>
              <View style={styles.voteStatRow}>
                <Text style={styles.voteStatLabel}>Votes enregistrés:</Text>
                <Text style={styles.voteStatValue}>{voteStats.totalVotes} / {alivePlayers.length}</Text>
              </View>
              <View style={styles.voteStatRow}>
                <Text style={styles.voteStatLabel}>Égalité:</Text>
                <Text style={[styles.voteStatValue, voteStats.hasTie && { color: colors.warning }]}>
                  {voteStats.hasTie ? `Oui (${voteStats.tiedPlayers.length} joueurs)` : 'Non'}
                </Text>
              </View>
              {lovers && (
                <View style={styles.voteStatRow}>
                  <Text style={styles.voteStatLabel}>💕 Amoureux:</Text>
                  <Text style={[styles.voteStatValue, { color: '#EC4899' }]}>
                    {lovers.player1Name} + {lovers.player2Name}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Section : Actions phase vote */}
          <View style={styles.voteTestSection}>
            <Text style={styles.sectionTitle}>🗳️ Actions Vote</Text>
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.actionButton, styles.blueButton]}
                onPress={simulateVotePhase}
                disabled={isLoading}
              >
                <Text style={styles.actionButtonText}>Forcer Phase Vote</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.actionButton, styles.greenButton]}
                onPress={fillRandomVotes}
                disabled={isLoading}
              >
                <Text style={styles.actionButtonText}>Votes Aléatoires</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.yellowButton]}
                onPress={createTieVotes}
                disabled={isLoading}
              >
                <Text style={styles.actionButtonText}>Créer Égalité</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={[styles.actionButton, styles.redButton, { marginTop: 8 }]}
              onPress={handleClearVotes}
            >
              <Text style={styles.actionButtonText}>Effacer Votes</Text>
            </TouchableOpacity>
          </View>

          {/* Section : Amoureux */}
          <View style={styles.voteTestSection}>
            <Text style={styles.sectionTitle}>💕 Test Amoureux</Text>
            <View style={styles.actionRow}>
              {!lovers ? (
                <TouchableOpacity
                  style={[styles.actionButton, styles.pinkButton]}
                  onPress={simulateLovers}
                  disabled={isLoading}
                >
                  <Text style={styles.actionButtonText}>Créer Couple</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[styles.actionButton, styles.redButton]}
                  onPress={removeLovers}
                >
                  <Text style={styles.actionButtonText}>Supprimer Couple</Text>
                </TouchableOpacity>
              )}
            </View>
            <Text style={styles.hintText}>
              Testez la mort par chagrin en éliminant un amoureux
            </Text>
          </View>

          {/* Section : Conditions de victoire */}
          <View style={styles.voteTestSection}>
            <Text style={styles.sectionTitle}>🏆 Test Victoire</Text>
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.actionButton, styles.blueButton]}
                onPress={testVillageWins}
                disabled={isLoading}
              >
                <Text style={styles.actionButtonText}>🏘️ Village</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.redDarkButton]}
                onPress={testWolvesWin}
                disabled={isLoading}
              >
                <Text style={styles.actionButtonText}>🐺 Loups</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={[styles.actionButton, styles.greenButton, { marginTop: 8 }]}
              onPress={reviveAllPlayers}
              disabled={isLoading}
            >
              <Text style={styles.actionButtonText}>❤️ Ressusciter Tous</Text>
            </TouchableOpacity>
          </View>

          {/* Section : Test Écran de Fin */}
          <View style={styles.voteTestSection}>
            <Text style={styles.sectionTitle}>🎬 Test Écran de Fin</Text>
            <Text style={styles.hintText}>
              Simule une fin de partie et ouvre l'écran EndGame
            </Text>

            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.actionButton, styles.blueButton]}
                onPress={simulateVillageVictory}
                disabled={isLoading}
              >
                <Text style={styles.actionButtonText}>🏘️ Fin Village</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.redDarkButton]}
                onPress={simulateWolvesVictory}
                disabled={isLoading}
              >
                <Text style={styles.actionButtonText}>🐺 Fin Loups</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.endGameViewToggle}>
              <Text style={styles.endGameViewLabel}>Tester la vue :</Text>
              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.yellowButton, { flex: 1 }]}
                  onPress={() => testEndGameAsRole(true)}
                >
                  <Text style={styles.actionButtonText}>👑 MJ</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, styles.grayButton, { flex: 1 }]}
                  onPress={() => testEndGameAsRole(false)}
                >
                  <Text style={styles.actionButtonText}>👤 Joueur</Text>
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.actionButton, styles.purpleButton, { marginTop: 8 }]}
              onPress={openEndGameScreen}
            >
              <Text style={styles.actionButtonText}>👁️ Voir EndGame (sans simuler)</Text>
            </TouchableOpacity>
          </View>

          {/* Détail des votes actuels */}
          {Object.keys(votes).length > 0 && (
            <View style={styles.voteTestSection}>
              <Text style={styles.sectionTitle}>📋 Détail des votes</Text>
              {Object.entries(votes).map(([voterId, targetId]) => {
                const voter = players.find(p => p.id === voterId);
                const target = players.find(p => p.id === targetId);
                return (
                  <View key={voterId} style={styles.voteDetailRow}>
                    <Text style={styles.voteDetailVoter}>{voter?.name || 'Inconnu'}</Text>
                    <Text style={styles.voteDetailArrow}>→</Text>
                    <Text style={styles.voteDetailTarget}>{target?.name || 'Inconnu'}</Text>
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>
      </View>
    );
  };

  // Onglet Logs
  const renderLogsTab = () => (
    <View style={styles.tabContent}>
      <TouchableOpacity
        style={[styles.actionButton, styles.grayButton, { alignSelf: 'flex-end', marginBottom: 10, flex: 0, paddingHorizontal: 20 }]}
        onPress={clearLogs}
      >
        <Text style={styles.actionButtonText}>Effacer</Text>
      </TouchableOpacity>
      <ScrollView style={styles.logsList}>
        {eventLogs.length === 0 ? (
          <Text style={styles.emptyLogs}>Aucun log</Text>
        ) : (
          eventLogs.map((log) => (
            <View key={log.id} style={styles.logItem}>
              <Text style={styles.logTime}>{log.time}</Text>
              <Text style={styles.logMessage}>{log.message}</Text>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );

  // ==================== FONCTIONS TEST TIMER ====================

  // Forcer une valeur de timer
  const setTimerTest = async (seconds, duration = null, running = false) => {
    if (!currentGameCode) return;

    setIsLoading(true);
    try {
      const updates = {};
      updates[`games/${currentGameCode}/gameState/timer`] = seconds;
      updates[`games/${currentGameCode}/gameState/timerDuration`] = duration || seconds;
      updates[`games/${currentGameCode}/gameState/timerRunning`] = running;

      await update(ref(database), updates);
      addLog(`Timer set: ${seconds}s (running: ${running})`);
    } catch (error) {
      addLog(`Erreur timer: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Demarrer le timer
  const startTimerTest = async () => {
    if (!currentGameCode || !gameState?.timer) return;

    try {
      await update(ref(database), {
        [`games/${currentGameCode}/gameState/timerRunning`]: true,
        [`games/${currentGameCode}/gameState/timerStartedAt`]: Date.now(),
      });
      addLog('Timer demarre');
    } catch (error) {
      addLog(`Erreur: ${error.message}`);
    }
  };

  // Arreter le timer
  const stopTimerTest = async () => {
    if (!currentGameCode) return;

    try {
      await update(ref(database), {
        [`games/${currentGameCode}/gameState/timerRunning`]: false,
      });
      addLog('Timer arrete');
    } catch (error) {
      addLog(`Erreur: ${error.message}`);
    }
  };

  // Reset le timer
  const resetTimerTest = async () => {
    if (!currentGameCode) return;

    const duration = gameState?.timerDuration || 60;
    try {
      await update(ref(database), {
        [`games/${currentGameCode}/gameState/timer`]: duration,
        [`games/${currentGameCode}/gameState/timerRunning`]: false,
      });
      addLog(`Timer reset a ${duration}s`);
    } catch (error) {
      addLog(`Erreur: ${error.message}`);
    }
  };

  // Naviguer vers GameMaster pour tester timer
  const testTimerAsMJ = () => {
    const mj = players.find(p => p.isMaster);
    if (!mj) {
      addLog('Erreur: Aucun MJ trouve');
      return;
    }

    navigateAsPlayer(mj.id, 'GameMaster');
    addLog('Navigation MJ pour test timer');
  };

  // Onglet Timer Test
  const renderTimerTab = () => {
    const timerValue = gameState?.timer;
    const timerDuration = gameState?.timerDuration;
    const timerRunning = gameState?.timerRunning;

    const formatTime = (seconds) => {
      if (seconds === null || seconds === undefined) return '--:--';
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // Couleur selon le temps
    const getTimerColor = () => {
      if (timerValue === null || timerValue === undefined) return '#666';
      if (timerValue > 30) return '#10B981';
      if (timerValue > 10) return '#F59E0B';
      return '#EF4444';
    };

    return (
      <View style={styles.tabContent}>
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Section : Etat actuel du timer */}
          <View style={styles.voteTestSection}>
            <Text style={styles.sectionTitle}>Etat actuel du Timer</Text>
            <View style={styles.voteStatsCard}>
              <View style={[styles.timerDisplayLarge, { borderColor: getTimerColor() }]}>
                <Text style={[styles.timerDisplayValue, { color: getTimerColor() }]}>
                  {formatTime(timerValue)}
                </Text>
                <Text style={styles.timerDisplayLabel}>
                  / {formatTime(timerDuration)}
                </Text>
              </View>
              <View style={styles.voteStatRow}>
                <Text style={styles.voteStatLabel}>Statut:</Text>
                <Text style={[styles.voteStatValue, { color: timerRunning ? '#10B981' : '#F59E0B' }]}>
                  {timerRunning ? ' En cours' : ' En pause'}
                </Text>
              </View>
              <View style={styles.voteStatRow}>
                <Text style={styles.voteStatLabel}>Couleur:</Text>
                <View style={[styles.colorIndicator, { backgroundColor: getTimerColor() }]} />
                <Text style={[styles.voteStatValue, { color: getTimerColor() }]}>
                  {timerValue > 30 ? 'Vert' : timerValue > 10 ? 'Orange' : 'Rouge'}
                </Text>
              </View>
            </View>
          </View>

          {/* Section : Controles rapides */}
          <View style={styles.voteTestSection}>
            <Text style={styles.sectionTitle}>Controles Timer</Text>
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.actionButton, styles.greenButton]}
                onPress={startTimerTest}
                disabled={isLoading || !timerValue}
              >
                <Text style={styles.actionButtonText}> START</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.yellowButton]}
                onPress={stopTimerTest}
                disabled={isLoading}
              >
                <Text style={styles.actionButtonText}> PAUSE</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.blueButton]}
                onPress={resetTimerTest}
                disabled={isLoading}
              >
                <Text style={styles.actionButtonText}> RESET</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Section : Tests rapides */}
          <View style={styles.voteTestSection}>
            <Text style={styles.sectionTitle}>Tests rapides</Text>
            <Text style={styles.hintText}>
              Configure et lance des timers de test
            </Text>

            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.actionButton, styles.redButton]}
                onPress={() => setTimerTest(3, 3, true)}
                disabled={isLoading}
              >
                <Text style={styles.actionButtonText}>3s (auto)</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.yellowButton]}
                onPress={() => setTimerTest(10, 10, true)}
                disabled={isLoading}
              >
                <Text style={styles.actionButtonText}>10s (auto)</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.greenButton]}
                onPress={() => setTimerTest(30, 30, false)}
                disabled={isLoading}
              >
                <Text style={styles.actionButtonText}>30s</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.actionButton, styles.blueButton]}
                onPress={() => setTimerTest(60, 60, false)}
                disabled={isLoading}
              >
                <Text style={styles.actionButtonText}>1min</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.purpleButton]}
                onPress={() => setTimerTest(120, 120, false)}
                disabled={isLoading}
              >
                <Text style={styles.actionButtonText}>2min</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.grayButton]}
                onPress={() => setTimerTest(0, 60, false)}
                disabled={isLoading}
              >
                <Text style={styles.actionButtonText}>Forcer 0</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Section : Tests couleurs */}
          <View style={styles.voteTestSection}>
            <Text style={styles.sectionTitle}>Tests Couleurs</Text>
            <Text style={styles.hintText}>
              Testez les differentes couleurs du timer
            </Text>

            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: '#10B981' }]}
                onPress={() => setTimerTest(45, 60, false)}
                disabled={isLoading}
              >
                <Text style={styles.actionButtonText}>Vert (&gt;30s)</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: '#F59E0B' }]}
                onPress={() => setTimerTest(20, 60, false)}
                disabled={isLoading}
              >
                <Text style={styles.actionButtonText}>Orange (10-30s)</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: '#EF4444' }]}
                onPress={() => setTimerTest(5, 60, true)}
                disabled={isLoading}
              >
                <Text style={styles.actionButtonText}>Rouge (&lt;10s)</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Section : Navigation test */}
          <View style={styles.voteTestSection}>
            <Text style={styles.sectionTitle}>Vues Timer</Text>
            <Text style={styles.hintText}>
              Ouvrez les differentes vues pour tester le timer
            </Text>

            <TouchableOpacity
              style={[styles.actionButton, styles.purpleButton, { marginBottom: 10 }]}
              onPress={testTimerAsMJ}
            >
              <Text style={styles.actionButtonText}>Ouvrir vue MJ (controles)</Text>
            </TouchableOpacity>

            {gamePlayers.length > 0 && (
              <TouchableOpacity
                style={[styles.actionButton, styles.blueButton]}
                onPress={() => {
                  const firstPlayer = gamePlayers[0];
                  if (firstPlayer) {
                    navigateAsPlayer(firstPlayer.id, 'PlayerGame');
                    addLog('Navigation joueur pour test timer');
                  }
                }}
              >
                <Text style={styles.actionButtonText}>Ouvrir vue Joueur (lecture seule)</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Section : Infos */}
          <View style={styles.voteTestSection}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <View style={styles.infoBox}>
              <Text style={styles.infoText}>
                 Le MJ controle le timer (start/pause/reset)
              </Text>
              <Text style={styles.infoTextSmall}>
                 Les joueurs voient le timer en lecture seule
              </Text>
              <Text style={styles.infoTextSmall}>
                 Couleur: Vert &gt; 30s, Orange 10-30s, Rouge &lt; 10s
              </Text>
              <Text style={styles.infoTextSmall}>
                 Vibration + clignotement sous 10s
              </Text>
            </View>
          </View>
        </ScrollView>
      </View>
    );
  };

  // ==================== FONCTIONS TEST UX ====================

  // Simuler une erreur reseau
  const simulateNetworkError = () => {
    Alert.alert(
      '📡 Erreur de connexion',
      'Verifiez votre connexion Internet et reessayez.',
      [
        { text: 'Reessayer', onPress: () => addLog('Retry simule') },
        { text: 'Fermer', style: 'cancel' }
      ]
    );
    addLog('Erreur reseau simulee');
  };

  // Simuler code invalide
  const simulateInvalidCode = () => {
    Alert.alert(
      '❌ Code invalide',
      'Ce code de partie n\'existe pas. Verifiez-le et reessayez.',
      [{ text: 'OK' }]
    );
    addLog('Code invalide simule');
  };

  // Simuler partie pleine
  const simulateGameFull = () => {
    Alert.alert(
      '🚫 Partie complete',
      'Cette partie a atteint le nombre maximum de joueurs (15).',
      [{ text: 'OK' }]
    );
    addLog('Partie pleine simulee');
  };

  // Simuler partie deja lancee
  const simulateGameStarted = () => {
    Alert.alert(
      '🎮 Partie en cours',
      'Cette partie a deja commence. Vous ne pouvez plus la rejoindre.',
      [{ text: 'OK' }]
    );
    addLog('Partie lancee simulee');
  };

  // Simuler acces refuse
  const simulateAccessDenied = () => {
    Alert.alert(
      '🔒 Acces refuse',
      'Cette zone est reservee au Maitre du Jeu.',
      [{ text: 'OK' }]
    );
    addLog('Acces refuse simule');
  };

  // Tester toutes les confirmations
  const testAllConfirmations = async () => {
    const confirmations = [
      { title: '🚪 Quitter la partie ?', message: 'Etes-vous sur de vouloir quitter ?' },
      { title: '🏁 Terminer la partie ?', message: 'Tous les joueurs seront deconnectes.' },
      { title: '⏱️ Timer en cours', message: 'Forcer le passage a la phase suivante ?' },
      { title: '🗳️ Confirmer votre vote', message: 'Voter pour Jean ?' },
      { title: '💀 Eliminer ce joueur ?', message: 'Eliminer Marie ?' },
    ];

    for (const conf of confirmations) {
      await new Promise(resolve => {
        Alert.alert(
          conf.title,
          conf.message,
          [
            { text: 'Annuler', style: 'cancel', onPress: resolve },
            { text: 'Confirmer', onPress: resolve }
          ]
        );
      });
      await new Promise(r => setTimeout(r, 500));
    }
    addLog('Toutes les confirmations testees');
  };

  // Test loading avec duree
  const testLoadingState = (label, duration = 2000) => {
    setIsLoading(true);
    addLog(`Loading: ${label} (${duration}ms)`);
    setTimeout(() => {
      setIsLoading(false);
      addLog(`Loading termine: ${label}`);
    }, duration);
  };

  // Ajouter 15 joueurs bots
  const addMaxPlayers = async () => {
    if (!currentGameCode) return;

    setIsLoading(true);
    try {
      const updates = {};
      const botNames = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank', 'Grace', 'Henry', 'Ivy', 'Jack', 'Kate', 'Leo', 'Mia', 'Noah', 'Olivia'];

      for (let i = 0; i < 15; i++) {
        const botId = `bot_${Date.now()}_${i}`;
        updates[`games/${currentGameCode}/players/${botId}`] = {
          name: botNames[i],
          isBot: true,
          isAlive: true,
          isMaster: false,
          joinedAt: Date.now() + i,
        };
      }

      await update(ref(database), updates);
      addLog('15 joueurs ajoutes pour test perf');
    } catch (error) {
      addLog(`Erreur: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Ajouter 100 logs
  const addManyLogs = () => {
    for (let i = 0; i < 100; i++) {
      addLog(`Test log #${i + 1} - ${Date.now()}`);
    }
    addLog('100 logs ajoutes pour test scroll');
  };

  // Onglet UX Test
  const renderUXTab = () => {
    return (
      <View style={styles.tabContent}>
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Section : Tests erreurs */}
          <View style={styles.voteTestSection}>
            <Text style={styles.sectionTitle}>Tests Erreurs</Text>
            <Text style={styles.hintText}>
              Simule differentes erreurs pour tester les messages
            </Text>

            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.actionButton, styles.redButton]}
                onPress={simulateNetworkError}
              >
                <Text style={styles.actionButtonText}>Erreur reseau</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.redButton]}
                onPress={simulateInvalidCode}
              >
                <Text style={styles.actionButtonText}>Code invalide</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.actionButton, styles.yellowButton]}
                onPress={simulateGameFull}
              >
                <Text style={styles.actionButtonText}>Partie pleine</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.yellowButton]}
                onPress={simulateGameStarted}
              >
                <Text style={styles.actionButtonText}>Partie lancee</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.actionButton, styles.purpleButton, { marginTop: 8 }]}
              onPress={simulateAccessDenied}
            >
              <Text style={styles.actionButtonText}>Acces refuse (MJ)</Text>
            </TouchableOpacity>
          </View>

          {/* Section : Tests confirmations */}
          <View style={styles.voteTestSection}>
            <Text style={styles.sectionTitle}>Tests Confirmations</Text>
            <Text style={styles.hintText}>
              Teste toutes les boites de dialogue de confirmation
            </Text>

            <TouchableOpacity
              style={[styles.actionButton, styles.blueButton]}
              onPress={testAllConfirmations}
            >
              <Text style={styles.actionButtonText}>Tester toutes les confirmations</Text>
            </TouchableOpacity>
          </View>

          {/* Section : Tests loading */}
          <View style={styles.voteTestSection}>
            <Text style={styles.sectionTitle}>Tests Loading States</Text>
            <Text style={styles.hintText}>
              Teste les differents etats de chargement
            </Text>

            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.actionButton, styles.grayButton]}
                onPress={() => testLoadingState('Creation partie', 2000)}
                disabled={isLoading}
              >
                <Text style={styles.actionButtonText}>2s</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.grayButton]}
                onPress={() => testLoadingState('Connexion', 4000)}
                disabled={isLoading}
              >
                <Text style={styles.actionButtonText}>4s</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.grayButton]}
                onPress={() => testLoadingState('Distribution roles', 6000)}
                disabled={isLoading}
              >
                <Text style={styles.actionButtonText}>6s</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Section : Tests performance */}
          <View style={styles.voteTestSection}>
            <Text style={styles.sectionTitle}>Tests Performance</Text>
            <Text style={styles.hintText}>
              Teste les performances avec beaucoup de donnees
            </Text>

            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.actionButton, styles.greenButton]}
                onPress={addMaxPlayers}
                disabled={isLoading}
              >
                <Text style={styles.actionButtonText}>+15 joueurs</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.redButton]}
                onPress={removeAllBots}
                disabled={isLoading}
              >
                <Text style={styles.actionButtonText}>Suppr bots</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.actionButton, styles.yellowButton, { marginTop: 8 }]}
              onPress={addManyLogs}
            >
              <Text style={styles.actionButtonText}>+100 logs (test scroll)</Text>
            </TouchableOpacity>

            <View style={styles.perfStats}>
              <Text style={styles.perfStatText}>
                Joueurs: {players.length} | Bots: {players.filter(p => p.isBot).length}
              </Text>
              <Text style={styles.perfStatText}>
                Logs: {eventLogs.length}
              </Text>
            </View>
          </View>

          {/* Section : Skip animations */}
          <View style={styles.voteTestSection}>
            <Text style={styles.sectionTitle}>Options Dev</Text>

            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Skip animations (test rapide)</Text>
              <Switch
                value={skipAnimationEnabled}
                onValueChange={toggleSkipAnimation}
                trackColor={{ false: '#333', true: colors.success }}
                thumbColor={skipAnimationEnabled ? '#FFF' : '#888'}
              />
            </View>
          </View>

          {/* Section : Infos UX */}
          <View style={styles.voteTestSection}>
            <Text style={styles.sectionTitle}>Guide UX</Text>
            <View style={styles.infoBox}>
              <Text style={styles.infoText}>
                Composants disponibles:
              </Text>
              <Text style={styles.infoTextSmall}>
                - Loading.js : spinner, dots, pulse, skeleton
              </Text>
              <Text style={styles.infoTextSmall}>
                - ErrorMessage.js : card, banner, toast
              </Text>
              <Text style={styles.infoTextSmall}>
                - ConfirmModal.js : modals de confirmation
              </Text>
              <Text style={styles.infoTextSmall}>
                - FeedbackToast.js : success/error toasts
              </Text>
              <Text style={styles.infoTextSmall}>
                - AnimatedCard.js : animations stagger, flip, pulse
              </Text>
            </View>
          </View>
        </ScrollView>
      </View>
    );
  };

  if (!__DEV__) return null;

  return (
    <>
      {/* Bouton flottant */}
      <TouchableOpacity
        style={styles.floatingButton}
        onPress={() => setIsDevPanelVisible(true)}
      >
        <Text style={styles.floatingButtonText}>DEV</Text>
      </TouchableOpacity>

      {/* Modal du panneau */}
      <Modal
        visible={isDevPanelVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsDevPanelVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.panel}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.headerTitle}>Mode Développeur</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setIsDevPanelVisible(false)}
              >
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Info joueur actif */}
            {currentPlayerId && (
              <View style={styles.activePlayerBanner}>
                <Text style={styles.activePlayerText}>
                  Vue: {players.find(p => p.id === currentPlayerId)?.name || 'Inconnu'}
                  {players.find(p => p.id === currentPlayerId)?.isMaster && ' (MJ)'}
                </Text>
              </View>
            )}

            {/* Tabs - 8 onglets */}
            <View style={styles.tabs}>
              {[
                { key: 'players', label: 'Joueurs' },
                { key: 'roles', label: 'Roles' },
                { key: 'vote', label: 'Vote' },
                { key: 'timer', label: 'Timer' },
                { key: 'ux', label: 'UX' },
                { key: 'test', label: 'Test' },
                { key: 'debug', label: 'Debug' },
                { key: 'logs', label: 'Logs' },
              ].map((tab) => (
                <TouchableOpacity
                  key={tab.key}
                  style={[styles.tab, activeTab === tab.key && styles.tabActive]}
                  onPress={() => setActiveTab(tab.key)}
                >
                  <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Contenu des tabs */}
            {isLoading && (
              <ActivityIndicator style={styles.loader} color={colors.primary} />
            )}
            {activeTab === 'players' && renderPlayersTab()}
            {activeTab === 'roles' && renderRolesTab()}
            {activeTab === 'vote' && renderVoteTab()}
            {activeTab === 'timer' && renderTimerTab()}
            {activeTab === 'ux' && renderUXTab()}
            {activeTab === 'test' && renderTestTab()}
            {activeTab === 'debug' && renderDebugTab()}
            {activeTab === 'logs' && renderLogsTab()}
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  floatingButton: {
    position: 'absolute',
    bottom: 100,
    right: 20,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#FF6B00',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    zIndex: 9999,
  },
  floatingButtonText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  panel: {
    backgroundColor: '#1A1A1A',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: SCREEN_HEIGHT * 0.85,
    padding: 15,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FF6B00',
  },
  closeButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#FFF',
    fontSize: 16,
  },
  activePlayerBanner: {
    backgroundColor: '#2563EB',
    padding: 8,
    borderRadius: 8,
    marginBottom: 10,
  },
  activePlayerText: {
    color: '#FFF',
    fontWeight: '600',
    textAlign: 'center',
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#252525',
    borderRadius: 10,
    marginBottom: 15,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: '#FF6B00',
    borderRadius: 10,
  },
  tabText: {
    color: '#888',
    fontWeight: '600',
    fontSize: 11,
  },
  tabTextActive: {
    color: '#FFF',
  },
  tabContent: {
    flex: 1,
  },
  loader: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    zIndex: 10,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 15,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 12,
  },
  greenButton: {
    backgroundColor: '#059669',
  },
  redButton: {
    backgroundColor: '#DC2626',
  },
  blueButton: {
    backgroundColor: '#2563EB',
  },
  grayButton: {
    backgroundColor: '#4B5563',
  },
  purpleButton: {
    backgroundColor: '#7C3AED',
  },
  instructionBox: {
    backgroundColor: '#252525',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
    alignItems: 'center',
    borderLeftWidth: 3,
    borderLeftColor: '#FF6B00',
  },
  instructionText: {
    color: '#888',
    fontSize: 12,
  },
  playersList: {
    flex: 1,
  },
  playerItemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  playerItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#252525',
    padding: 12,
    borderRadius: 8,
  },
  playerItemActive: {
    borderWidth: 2,
    borderColor: '#FF6B00',
  },
  playerItemMaster: {
    borderLeftWidth: 3,
    borderLeftColor: colors.special,
  },
  playerInfo: {
    flex: 1,
  },
  playerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  botIcon: {
    marginRight: 5,
  },
  mjIcon: {
    marginRight: 5,
  },
  playerName: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 14,
  },
  playerNameDead: {
    textDecorationLine: 'line-through',
    color: '#666',
  },
  playerDetails: {
    fontSize: 12,
    marginTop: 2,
  },
  activeBadge: {
    backgroundColor: '#FF6B00',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  activeBadgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  playerQuickActions: {
    flexDirection: 'row',
    marginLeft: 8,
    gap: 4,
  },
  quickActionBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  revealBtn: {
    backgroundColor: '#7C3AED',
  },
  lobbyBtn: {
    backgroundColor: '#2563EB',
  },
  quickActionText: {
    fontSize: 16,
  },

  // Styles pour l'onglet Rôles
  infoBox: {
    backgroundColor: '#252525',
    borderRadius: 8,
    padding: 10,
    marginBottom: 15,
    alignItems: 'center',
  },
  infoText: {
    color: '#FFF',
    fontWeight: '600',
  },
  infoTextSmall: {
    color: '#888',
    fontSize: 11,
    marginTop: 3,
  },
  roleSelector: {
    backgroundColor: '#333',
    borderRadius: 10,
    padding: 10,
    marginBottom: 15,
  },
  roleSelectorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  roleSelectorTitle: {
    color: '#FFF',
    fontWeight: '600',
  },
  closeText: {
    color: '#888',
    fontSize: 18,
    padding: 5,
  },
  roleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#252525',
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
  },
  roleChipIcon: {
    fontSize: 16,
    marginRight: 5,
  },
  roleChipText: {
    fontWeight: '600',
    fontSize: 12,
  },
  rolePlayerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#252525',
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  mjItem: {
    borderWidth: 1,
    borderColor: colors.special,
    marginTop: 10,
  },
  rolePlayerMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  roleIconBox: {
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  roleIconText: {
    fontSize: 20,
  },
  rolePlayerInfo: {
    flex: 1,
  },
  rolePlayerName: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 14,
  },
  rolePlayerRole: {
    fontSize: 12,
    marginTop: 2,
  },
  rolePlayerActions: {
    flexDirection: 'row',
    gap: 5,
  },
  miniButton: {
    width: 32,
    height: 32,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  miniButtonText: {
    fontSize: 14,
  },
  redMiniButton: {
    backgroundColor: 'rgba(220, 38, 38, 0.3)',
  },
  greenMiniButton: {
    backgroundColor: 'rgba(5, 150, 105, 0.3)',
  },
  yellowMiniButton: {
    backgroundColor: 'rgba(255, 215, 0, 0.3)',
  },
  grayMiniButton: {
    backgroundColor: 'rgba(107, 114, 128, 0.3)',
  },
  revealMiniBtn: {
    backgroundColor: 'rgba(124, 58, 237, 0.3)',
  },

  // Styles pour l'onglet Test
  testOptionsSection: {
    marginBottom: 15,
  },
  sectionTitle: {
    color: '#FF6B00',
    fontWeight: 'bold',
    fontSize: 14,
    marginBottom: 10,
  },
  sectionHint: {
    color: '#666',
    fontSize: 11,
    marginBottom: 10,
    marginTop: -5,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#252525',
    padding: 12,
    borderRadius: 10,
  },
  optionInfo: {
    flex: 1,
  },
  optionLabel: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 14,
  },
  optionDesc: {
    color: '#888',
    fontSize: 11,
    marginTop: 2,
  },
  testActionsSection: {
    marginBottom: 15,
  },
  testActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#252525',
    padding: 15,
    borderRadius: 12,
  },
  testActionButtonActive: {
    backgroundColor: '#DC2626',
  },
  testActionIcon: {
    fontSize: 24,
    marginRight: 15,
  },
  testActionInfo: {
    flex: 1,
  },
  testActionLabel: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 14,
  },
  testActionDesc: {
    color: '#888',
    fontSize: 11,
    marginTop: 2,
  },
  testRolesSection: {
    flex: 1,
  },
  testRolesList: {
    flex: 1,
  },
  teamLabel: {
    color: '#888',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 5,
  },
  testRolesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 15,
  },
  testRoleCard: {
    width: '30%',
    backgroundColor: '#252525',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 2,
  },
  testRoleIconBg: {
    width: 45,
    height: 45,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  testRoleIcon: {
    fontSize: 24,
  },
  testRoleName: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },

  // Debug
  debugSection: {
    backgroundColor: '#252525',
    borderRadius: 10,
    padding: 12,
    marginBottom: 15,
  },
  debugTitle: {
    color: '#FF6B00',
    fontWeight: 'bold',
    fontSize: 14,
    marginBottom: 10,
  },
  debugInfo: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  debugLabel: {
    color: '#888',
    width: 80,
  },
  debugValue: {
    color: '#FFF',
    fontWeight: '500',
    flex: 1,
  },
  phaseButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  phaseButton: {
    backgroundColor: '#333',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 6,
    minWidth: 70,
    alignItems: 'center',
  },
  phaseButtonActive: {
    backgroundColor: '#FF6B00',
  },
  phaseButtonText: {
    color: '#FFF',
    fontSize: 9,
    textAlign: 'center',
  },

  // Logs
  logsList: {
    flex: 1,
  },
  emptyLogs: {
    color: '#666',
    textAlign: 'center',
    marginTop: 20,
  },
  logItem: {
    flexDirection: 'row',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  logTime: {
    color: '#666',
    fontSize: 11,
    width: 70,
  },
  logMessage: {
    color: '#FFF',
    fontSize: 12,
    flex: 1,
  },

  // Vote Tab styles
  voteTestSection: {
    backgroundColor: '#252525',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
  },
  voteStatsCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 8,
    padding: 10,
  },
  voteStatRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
  },
  voteStatLabel: {
    color: '#888',
    fontSize: 13,
  },
  voteStatValue: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '600',
  },
  hintText: {
    color: '#666',
    fontSize: 11,
    fontStyle: 'italic',
    marginTop: 8,
    textAlign: 'center',
  },
  yellowButton: {
    backgroundColor: '#F59E0B',
  },
  pinkButton: {
    backgroundColor: '#EC4899',
  },
  redDarkButton: {
    backgroundColor: '#8B0000',
  },
  voteDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  voteDetailVoter: {
    color: '#FFF',
    fontSize: 13,
    flex: 1,
  },
  voteDetailArrow: {
    color: '#888',
    fontSize: 16,
    marginHorizontal: 10,
  },
  voteDetailTarget: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
  },

  // End Game Test styles
  endGameViewToggle: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  endGameViewLabel: {
    color: '#888',
    fontSize: 12,
    marginBottom: 8,
  },

  // Timer Tab styles
  timerDisplayLarge: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    borderWidth: 3,
    borderRadius: 16,
    marginBottom: 15,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  timerDisplayValue: {
    fontSize: 42,
    fontWeight: 'bold',
    fontVariant: ['tabular-nums'],
  },
  timerDisplayLabel: {
    color: '#888',
    fontSize: 14,
    marginTop: 4,
  },
  colorIndicator: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginRight: 8,
  },

  // UX Tab styles
  perfStats: {
    marginTop: 12,
    padding: 10,
    backgroundColor: '#1A1A1A',
    borderRadius: 8,
  },
  perfStatText: {
    color: '#888',
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  switchLabel: {
    color: colors.textPrimary,
    fontSize: 14,
    flex: 1,
    marginRight: 10,
  },
});
