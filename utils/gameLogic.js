import { ref, set, update, get } from 'firebase/database';
import { database } from '../firebase';
import { ROLES, getDefaultRoleDistribution, getRoleById } from './roles';

/**
 * Attribue aléatoirement les rôles aux joueurs
 */
export const assignRoles = async (gameCode, players, roleConfig = null) => {
  try {
    const playerIds = Object.keys(players);
    const playerCount = playerIds.length;

    // Utilise la config par défaut si non fournie
    const distribution = roleConfig || getDefaultRoleDistribution(playerCount);

    if (!distribution) {
      throw new Error('Pas assez de joueurs pour une partie');
    }

    // Crée un tableau de rôles à distribuer
    const rolesToAssign = [];
    Object.entries(distribution).forEach(([roleId, count]) => {
      for (let i = 0; i < count; i++) {
        rolesToAssign.push(roleId);
      }
    });

    // Mélange aléatoirement
    const shuffledRoles = rolesToAssign.sort(() => Math.random() - 0.5);

    // Assigne les rôles aux joueurs
    const updates = {};
    playerIds.forEach((playerId, index) => {
      updates[`games/${gameCode}/players/${playerId}/role`] = shuffledRoles[index];
      updates[`games/${gameCode}/players/${playerId}/isAlive`] = true;
    });

    await update(ref(database), updates);
    return true;
  } catch (error) {
    console.error('Erreur assignRoles:', error);
    return false;
  }
};

/**
 * Vérifie quels rôles sont présents dans la partie
 * @returns {Object} { hasCupid, hasSeer, hasWitch, hasHunter, hasLittleGirl }
 */
export const checkPresentRoles = async (gameCode) => {
  try {
    const playersRef = ref(database, `games/${gameCode}/players`);
    const snapshot = await get(playersRef);

    if (!snapshot.exists()) {
      return { hasCupid: false, hasSeer: false, hasWitch: false, hasHunter: false, hasLittleGirl: false };
    }

    const players = snapshot.val();
    const roles = Object.values(players)
      .filter(p => !p.isMaster && p.isAlive !== false)
      .map(p => p.role);

    return {
      hasCupid: roles.includes('cupidon'),
      hasSeer: roles.includes('voyante'),
      hasWitch: roles.includes('sorciere'),
      hasHunter: roles.includes('chasseur'),
      hasLittleGirl: roles.includes('petite_fille'),
    };
  } catch (error) {
    console.error('Erreur checkPresentRoles:', error);
    return { hasCupid: false, hasSeer: false, hasWitch: false, hasHunter: false, hasLittleGirl: false };
  }
};

/**
 * Vérifie les conditions de victoire (version locale avec objet players)
 */
export const checkWinCondition = (players) => {
  const alivePlayers = Object.values(players).filter(p => p.isAlive && !p.isMaster);

  const aliveWerewolves = alivePlayers.filter(p => {
    const role = getRoleById(p.role);
    return role?.team === 'loups';
  }).length;

  const aliveVillagers = alivePlayers.filter(p => {
    const role = getRoleById(p.role);
    return role?.team === 'village';
  }).length;

  if (aliveWerewolves === 0) {
    return { winner: 'village', message: 'Le village a gagné ! Tous les loups sont éliminés.' };
  }

  if (aliveWerewolves >= aliveVillagers) {
    return { winner: 'loups', message: 'Les loups-garous ont gagné ! Ils sont en supériorité numérique.' };
  }

  return null; // Partie continue
};

/**
 * Vérifie les conditions de victoire avec Firebase
 * @returns {Object|null} { winner, message, stats } ou null si partie continue
 */
export const checkWinConditionFromFirebase = async (gameCode) => {
  try {
    const playersRef = ref(database, `games/${gameCode}/players`);
    const snapshot = await get(playersRef);

    if (!snapshot.exists()) {
      return null;
    }

    const players = snapshot.val();
    const result = checkWinCondition(players);

    if (result) {
      // Ajouter des statistiques
      const alivePlayers = Object.values(players).filter(p => p.isAlive !== false && !p.isMaster);
      const deadPlayers = Object.values(players).filter(p => p.isAlive === false && !p.isMaster);

      result.stats = {
        aliveCount: alivePlayers.length,
        deadCount: deadPlayers.length,
        aliveWerewolves: alivePlayers.filter(p => getRoleById(p.role)?.team === 'loups').length,
        aliveVillagers: alivePlayers.filter(p => getRoleById(p.role)?.team === 'village').length,
      };
    }

    return result;
  } catch (error) {
    console.error('Erreur checkWinConditionFromFirebase:', error);
    return null;
  }
};

/**
 * Termine la partie avec un gagnant
 */
export const endGameWithWinner = async (gameCode, winner, message = '') => {
  try {
    const updates = {};
    updates[`games/${gameCode}/config/status`] = 'finished';
    updates[`games/${gameCode}/gameState/currentPhase`] = 'finished';
    updates[`games/${gameCode}/gameState/endedAt`] = Date.now();
    updates[`games/${gameCode}/result/winner`] = winner;
    updates[`games/${gameCode}/result/message`] = message;

    await update(ref(database), updates);
    return true;
  } catch (error) {
    console.error('Erreur endGameWithWinner:', error);
    return false;
  }
};

/**
 * Élimine un joueur
 */
export const eliminatePlayer = async (gameCode, playerId, reason = 'eliminated') => {
  try {
    const updates = {};
    updates[`games/${gameCode}/players/${playerId}/isAlive`] = false;
    updates[`games/${gameCode}/players/${playerId}/deathReason`] = reason;

    await update(ref(database), updates);
    return true;
  } catch (error) {
    console.error('Erreur eliminatePlayer:', error);
    return false;
  }
};

/**
 * Définition du flux de phases complet
 */
export const PHASE_FLOW = {
  'role_reveal': 'night_start',
  'night_start': 'night_cupid',
  'night_cupid': 'night_werewolves',
  'night_werewolves': 'night_seer',
  'night_seer': 'night_witch',
  'night_witch': 'day_announcement',
  'day_announcement': 'day_discussion',
  'day_discussion': 'day_vote',
  'day_vote': 'vote_result',
  'vote_result': 'night_start',
  'finished': 'finished',
};

/**
 * Phases qui correspondent à des rôles spéciaux (peuvent être skip)
 */
const ROLE_PHASES = {
  'night_cupid': 'cupidon',
  'night_seer': 'voyante',
  'night_witch': 'sorciere',
};

/**
 * Détermine si une phase doit être sautée
 * @param {string} phase - La phase à vérifier
 * @param {Object} presentRoles - Rôles présents dans la partie
 * @param {number} nightCount - Numéro de la nuit actuelle
 * @returns {boolean} - true si la phase doit être sautée
 */
export const shouldSkipPhase = (phase, presentRoles, nightCount = 0) => {
  // Les phases obligatoires ne sont jamais sautées
  const mandatoryPhases = [
    'role_reveal', 'night_start', 'night_werewolves',
    'day_announcement', 'day_discussion', 'day_vote', 'vote_result', 'finished'
  ];

  if (mandatoryPhases.includes(phase)) {
    return false;
  }

  // Vérifier les phases de rôles spéciaux
  switch (phase) {
    case 'night_cupid':
      // Cupidon ne joue que la première nuit ET s'il est présent ET vivant
      return !presentRoles.hasCupid || nightCount > 0;

    case 'night_seer':
      // Voyante doit être présente et vivante
      return !presentRoles.hasSeer;

    case 'night_witch':
      // Sorcière doit être présente et vivante
      return !presentRoles.hasWitch;

    default:
      return false;
  }
};

/**
 * Retourne la liste des phases valides pour cette partie
 * @param {Object} presentRoles - Rôles présents dans la partie
 * @param {number} nightCount - Numéro de la nuit actuelle
 * @returns {Array} - Liste des phases valides
 */
export const getValidPhasesForGame = (presentRoles, nightCount = 0) => {
  const allPhases = [
    'night_start',
    'night_cupid',
    'night_werewolves',
    'night_seer',
    'night_witch',
    'day_announcement',
    'day_discussion',
    'day_vote',
    'vote_result',
  ];

  return allPhases.filter(phase => !shouldSkipPhase(phase, presentRoles, nightCount));
};

/**
 * Détermine la prochaine phase valide en sautant les rôles absents
 * @param {string} currentPhase - Phase actuelle
 * @param {Object} presentRoles - Rôles présents dans la partie
 * @param {number} nightCount - Numéro de la nuit actuelle
 * @returns {string} - Prochaine phase valide
 */
export const getNextValidPhase = (currentPhase, presentRoles, nightCount = 0) => {
  let nextPhase = PHASE_FLOW[currentPhase] || 'night_start';

  // Boucle pour trouver la prochaine phase valide
  let iterations = 0;
  const maxIterations = 10; // Sécurité contre boucle infinie

  while (iterations < maxIterations) {
    // Vérifier si la phase doit être sautée
    if (!shouldSkipPhase(nextPhase, presentRoles, nightCount)) {
      return nextPhase;
    }

    // Passer à la phase suivante
    nextPhase = PHASE_FLOW[nextPhase] || 'night_start';
    iterations++;
  }

  return nextPhase;
};

/**
 * Passe à la phase suivante (avec skip automatique des rôles absents)
 */
export const nextPhase = async (gameCode, currentPhase) => {
  try {
    // Récupérer les rôles présents
    const presentRoles = await checkPresentRoles(gameCode);

    // Récupérer le nightCount actuel
    const gameStateRef = ref(database, `games/${gameCode}/gameState`);
    const snapshot = await get(gameStateRef);
    const currentNightCount = snapshot.val()?.nightCount || 0;

    // Déterminer la prochaine phase valide
    const nextPhaseValue = getNextValidPhase(currentPhase, presentRoles, currentNightCount);

    const updates = {};
    updates[`games/${gameCode}/gameState/currentPhase`] = nextPhaseValue;
    updates[`games/${gameCode}/gameState/lastPhaseChange`] = Date.now();

    // Si on retourne à la nuit, incrémente le compteur
    if (nextPhaseValue === 'night_start' && currentPhase !== 'role_reveal') {
      updates[`games/${gameCode}/gameState/nightCount`] = currentNightCount + 1;
    }

    await update(ref(database), updates);
    return nextPhaseValue;
  } catch (error) {
    console.error('Erreur nextPhase:', error);
    return null;
  }
};

/**
 * Récupère les amoureux de la partie
 * @returns {Object|null} { player1, player1Name, player2, player2Name } ou null
 */
export const getLovers = async (gameCode) => {
  try {
    const loversRef = ref(database, `games/${gameCode}/lovers`);
    const snapshot = await get(loversRef);

    if (!snapshot.exists()) {
      return null;
    }

    return snapshot.val();
  } catch (error) {
    console.error('Erreur getLovers:', error);
    return null;
  }
};

/**
 * Vérifie si un joueur fait partie du couple et retourne l'autre amoureux
 * @returns {Object|null} { id, name } de l'autre amoureux ou null
 */
export const getOtherLover = async (gameCode, playerId) => {
  try {
    const lovers = await getLovers(gameCode);

    if (!lovers) return null;

    if (lovers.player1 === playerId) {
      return { id: lovers.player2, name: lovers.player2Name };
    }
    if (lovers.player2 === playerId) {
      return { id: lovers.player1, name: lovers.player1Name };
    }

    return null;
  } catch (error) {
    console.error('Erreur getOtherLover:', error);
    return null;
  }
};

/**
 * Récupère les victimes de la dernière nuit
 * @returns {Array} Liste des victimes avec nom et raison
 */
export const getLastNightVictims = async (gameCode, nightCount) => {
  try {
    const nightKey = `night-${nightCount}`;
    const actionsRef = ref(database, `games/${gameCode}/actions/${nightKey}`);
    const playersRef = ref(database, `games/${gameCode}/players`);

    const [actionsSnapshot, playersSnapshot] = await Promise.all([
      get(actionsRef),
      get(playersRef),
    ]);

    const victims = [];
    const victimIds = new Set(); // Pour éviter les doublons

    if (!actionsSnapshot.exists()) {
      return victims;
    }

    const actions = actionsSnapshot.val();
    const players = playersSnapshot.exists() ? playersSnapshot.val() : {};

    // Victime des loups
    const werewolfTargetId = actions.werewolfTarget;
    const werewolfTargetName = actions.werewolfTargetName;

    // Vérifier si la sorcière a sauvé
    const witchSaved = actions.witchSaved === true;

    // Victime de la potion de mort
    const witchKillTargetId = actions.witchKillTarget;
    const witchKillTargetName = actions.witchKillTargetName;

    // Ajouter la victime des loups si pas sauvée
    if (werewolfTargetId && !witchSaved) {
      victims.push({
        id: werewolfTargetId,
        name: werewolfTargetName || players[werewolfTargetId]?.name || 'Inconnu',
        reason: 'werewolves',
        icon: '🐺',
        message: 'a été dévoré(e) par les loups-garous',
      });
      victimIds.add(werewolfTargetId);
    }

    // Ajouter la victime de la sorcière
    if (witchKillTargetId && !victimIds.has(witchKillTargetId)) {
      victims.push({
        id: witchKillTargetId,
        name: witchKillTargetName || players[witchKillTargetId]?.name || 'Inconnu',
        reason: 'witch_poison',
        icon: '🧪',
        message: 'a été empoisonné(e) par la sorcière',
      });
      victimIds.add(witchKillTargetId);
    }

    // Vérifier les amoureux - si un amoureux meurt, l'autre meurt de chagrin
    const lovers = await getLovers(gameCode);
    if (lovers) {
      for (const victimId of victimIds) {
        let otherLoverId = null;
        let otherLoverName = null;

        if (lovers.player1 === victimId) {
          otherLoverId = lovers.player2;
          otherLoverName = lovers.player2Name;
        } else if (lovers.player2 === victimId) {
          otherLoverId = lovers.player1;
          otherLoverName = lovers.player1Name;
        }

        // Ajouter l'autre amoureux s'il meurt de chagrin (et n'est pas déjà victime)
        if (otherLoverId && !victimIds.has(otherLoverId)) {
          // Vérifier qu'il est encore vivant
          if (players[otherLoverId]?.isAlive !== false) {
            victims.push({
              id: otherLoverId,
              name: otherLoverName || players[otherLoverId]?.name || 'Inconnu',
              reason: 'heartbreak',
              icon: '💔',
              message: 'est mort(e) de chagrin (amoureux)',
            });
            victimIds.add(otherLoverId);
          }
        }
      }
    }

    return victims;
  } catch (error) {
    console.error('Erreur getLastNightVictims:', error);
    return [];
  }
};

/**
 * Résout les actions de la nuit et élimine les victimes
 * @returns {Array} Liste des victimes éliminées
 */
export const resolveNightActions = async (gameCode, nightCount) => {
  try {
    // Récupérer les victimes
    const victims = await getLastNightVictims(gameCode, nightCount);

    // Éliminer chaque victime
    for (const victim of victims) {
      await eliminatePlayer(gameCode, victim.id, victim.reason);
    }

    // Marquer la nuit comme résolue
    const nightKey = `night-${nightCount}`;
    await update(ref(database), {
      [`games/${gameCode}/actions/${nightKey}/resolved`]: true,
      [`games/${gameCode}/actions/${nightKey}/resolvedAt`]: Date.now(),
    });

    return victims;
  } catch (error) {
    console.error('Erreur resolveNightActions:', error);
    return [];
  }
};

/**
 * Récupère les actions de la nuit pour le MJ (temps réel)
 */
export const getNightActionsForMJ = async (gameCode, nightCount) => {
  try {
    const nightKey = `night-${nightCount}`;
    const actionsRef = ref(database, `games/${gameCode}/actions/${nightKey}`);
    const snapshot = await get(actionsRef);

    if (!snapshot.exists()) {
      return [];
    }

    const actions = snapshot.val();
    const formattedActions = [];

    // Action de Cupidon (première nuit)
    if (actions.cupidAction === 'formed') {
      formattedActions.push({
        type: 'cupid',
        icon: '💘',
        message: `Cupidon a formé un couple : ${actions.cupidLover1Name || '?'} ❤️ ${actions.cupidLover2Name || '?'}`,
        timestamp: actions.cupidTimestamp || Date.now(),
      });
    }

    // Action des loups
    if (actions.werewolfTarget) {
      formattedActions.push({
        type: 'werewolf',
        icon: '🐺',
        message: `Les loups ont choisi ${actions.werewolfTargetName || 'une victime'}`,
        timestamp: actions.werewolfTimestamp || Date.now(),
      });
    }

    // Action de la voyante
    if (actions.seerTarget) {
      formattedActions.push({
        type: 'seer',
        icon: '🔮',
        message: `La voyante a vu ${actions.seerTargetName || 'un joueur'}`,
        timestamp: actions.seerTimestamp || Date.now(),
      });
    }

    // Action de la sorcière - Potion de vie
    if (actions.witchSaved) {
      formattedActions.push({
        type: 'witch_life',
        icon: '💚',
        message: 'La sorcière a utilisé sa potion de vie',
        timestamp: actions.witchTimestamp || Date.now(),
      });
    }

    // Action de la sorcière - Potion de mort
    if (actions.witchKillTarget) {
      formattedActions.push({
        type: 'witch_death',
        icon: '💀',
        message: `La sorcière a empoisonné ${actions.witchKillTargetName || 'un joueur'}`,
        timestamp: actions.witchTimestamp || Date.now(),
      });
    }

    // Action de la sorcière - Rien
    if (actions.witchAction === 'nothing') {
      formattedActions.push({
        type: 'witch_nothing',
        icon: '🧪',
        message: 'La sorcière n\'a rien fait',
        timestamp: actions.witchTimestamp || Date.now(),
      });
    }

    return formattedActions.sort((a, b) => a.timestamp - b.timestamp);
  } catch (error) {
    console.error('Erreur getNightActionsForMJ:', error);
    return [];
  }
};

/**
 * Compte les votes et retourne les statistiques
 * @returns {Object} { voteCounts, totalVotes, maxVotes, tiedPlayers, winner }
 */
export const countVotes = (votes) => {
  const voteCounts = {};
  let totalVotes = 0;

  // Compter les votes
  Object.values(votes).forEach(votedPlayerId => {
    if (votedPlayerId) {
      voteCounts[votedPlayerId] = (voteCounts[votedPlayerId] || 0) + 1;
      totalVotes++;
    }
  });

  // Trouver le maximum
  let maxVotes = 0;
  Object.values(voteCounts).forEach(count => {
    if (count > maxVotes) maxVotes = count;
  });

  // Trouver les joueurs à égalité
  const tiedPlayers = Object.entries(voteCounts)
    .filter(([_, count]) => count === maxVotes)
    .map(([playerId]) => playerId);

  return {
    voteCounts,
    totalVotes,
    maxVotes,
    tiedPlayers,
    winner: tiedPlayers.length === 1 ? tiedPlayers[0] : null,
    hasTie: tiedPlayers.length > 1,
  };
};

/**
 * Récupère les votes actuels depuis Firebase
 */
export const getVotes = async (gameCode) => {
  try {
    const votesRef = ref(database, `games/${gameCode}/votes`);
    const snapshot = await get(votesRef);

    if (!snapshot.exists()) {
      return {};
    }

    return snapshot.val();
  } catch (error) {
    console.error('Erreur getVotes:', error);
    return {};
  }
};

/**
 * Résout le vote et élimine le joueur le plus voté
 * @param {string} gameCode
 * @param {Object} votes - Votes { voterId: targetId }
 * @param {string|null} forcedWinner - Si égalité, le MJ peut forcer un gagnant
 * @returns {Object} { eliminated, voteCounts, hasTie, tiedPlayers }
 */
export const resolveVote = async (gameCode, votes, forcedWinner = null) => {
  try {
    const voteStats = countVotes(votes);
    let eliminatedPlayerId = null;

    // S'il y a égalité et pas de forcedWinner, retourner les infos pour le MJ
    if (voteStats.hasTie && !forcedWinner) {
      return {
        eliminated: null,
        voteCounts: voteStats.voteCounts,
        hasTie: true,
        tiedPlayers: voteStats.tiedPlayers,
        maxVotes: voteStats.maxVotes,
      };
    }

    // Déterminer qui éliminer
    eliminatedPlayerId = forcedWinner || voteStats.winner;

    // Éliminer le joueur
    if (eliminatedPlayerId) {
      await eliminatePlayer(gameCode, eliminatedPlayerId, 'vote');

      // Gérer l'effet des amoureux
      await handleLoversEffect(gameCode, eliminatedPlayerId);

      // Stocker le résultat du vote
      await update(ref(database), {
        [`games/${gameCode}/gameState/lastVoteResult`]: {
          eliminatedId: eliminatedPlayerId,
          voteCounts: voteStats.voteCounts,
          totalVotes: voteStats.totalVotes,
          timestamp: Date.now(),
        },
      });
    }

    return {
      eliminated: eliminatedPlayerId,
      voteCounts: voteStats.voteCounts,
      hasTie: false,
      tiedPlayers: [],
      maxVotes: voteStats.maxVotes,
    };
  } catch (error) {
    console.error('Erreur resolveVote:', error);
    return { eliminated: null, voteCounts: {}, hasTie: false, tiedPlayers: [] };
  }
};

/**
 * Réinitialise les votes pour une nouvelle phase
 */
export const clearVotes = async (gameCode) => {
  try {
    await set(ref(database, `games/${gameCode}/votes`), null);
    return true;
  } catch (error) {
    console.error('Erreur clearVotes:', error);
    return false;
  }
};

/**
 * Gère l'effet de la mort d'un amoureux (l'autre meurt aussi)
 * @returns {Object|null} L'autre amoureux tué ou null
 */
export const handleLoversEffect = async (gameCode, deadPlayerId) => {
  try {
    const lovers = await getLovers(gameCode);
    if (!lovers) return null;

    let otherLoverId = null;
    let otherLoverName = null;

    // Vérifier si le joueur mort est un amoureux
    if (lovers.player1 === deadPlayerId) {
      otherLoverId = lovers.player2;
      otherLoverName = lovers.player2Name;
    } else if (lovers.player2 === deadPlayerId) {
      otherLoverId = lovers.player1;
      otherLoverName = lovers.player1Name;
    }

    if (!otherLoverId) return null;

    // Vérifier si l'autre est encore vivant
    const otherPlayerRef = ref(database, `games/${gameCode}/players/${otherLoverId}`);
    const snapshot = await get(otherPlayerRef);

    if (snapshot.exists() && snapshot.val().isAlive !== false) {
      // L'autre amoureux meurt de chagrin
      await eliminatePlayer(gameCode, otherLoverId, 'heartbreak');

      return {
        id: otherLoverId,
        name: otherLoverName,
        reason: 'heartbreak',
      };
    }

    return null;
  } catch (error) {
    console.error('Erreur handleLoversEffect:', error);
    return null;
  }
};

/**
 * Active/désactive le timer
 */
export const toggleTimer = async (gameCode) => {
  try {
    const timerRef = ref(database, `games/${gameCode}/gameState/timerActive`);
    const snapshot = await get(timerRef);
    const currentState = snapshot.val();

    await set(timerRef, !currentState);
    return !currentState;
  } catch (error) {
    console.error('Erreur toggleTimer:', error);
    return null;
  }
};

/**
 * Reset le timer avec une durée spécifique
 */
export const resetTimer = async (gameCode, duration) => {
  try {
    const updates = {};
    updates[`games/${gameCode}/gameState/timer`] = duration;
    updates[`games/${gameCode}/gameState/timerActive`] = false;

    await update(ref(database), updates);
    return true;
  } catch (error) {
    console.error('Erreur resetTimer:', error);
    return false;
  }
};

export default {
  assignRoles,
  checkPresentRoles,
  checkWinCondition,
  checkWinConditionFromFirebase,
  endGameWithWinner,
  eliminatePlayer,
  PHASE_FLOW,
  shouldSkipPhase,
  getValidPhasesForGame,
  getNextValidPhase,
  nextPhase,
  getLovers,
  getOtherLover,
  getLastNightVictims,
  resolveNightActions,
  getNightActionsForMJ,
  countVotes,
  getVotes,
  resolveVote,
  clearVotes,
  handleLoversEffect,
  toggleTimer,
  resetTimer
};
