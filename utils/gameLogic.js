import { ref, set, update, get } from 'firebase/database';
import { database } from '../firebase';
import { ROLES, getDefaultRoleDistribution } from './roles';

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
 * Vérifie les conditions de victoire
 */
export const checkWinCondition = (players) => {
  const alivePlayers = Object.values(players).filter(p => p.isAlive);
  
  const aliveWerewolves = alivePlayers.filter(p => p.role === 'loup_garou').length;
  const aliveVillagers = alivePlayers.filter(p => p.role !== 'loup_garou').length;
  
  if (aliveWerewolves === 0) {
    return { winner: 'village', message: 'Le village a gagné ! Tous les loups sont éliminés.' };
  }
  
  if (aliveWerewolves >= aliveVillagers) {
    return { winner: 'loups', message: 'Les loups-garous ont gagné ! Ils sont en supériorité numérique.' };
  }
  
  return null; // Partie continue
};

/**
 * Élimine un joueur
 */
export const eliminatePlayer = async (gameCode, playerId, reason = 'eliminated') => {
  try {
    const updates = {};
    updates[`games/${gameCode}/players/${playerId}/isAlive`] = false;
    updates[`games/${gameCode}/players/${playerId}/eliminatedReason`] = reason;
    
    await update(ref(database), updates);
    return true;
  } catch (error) {
    console.error('Erreur eliminatePlayer:', error);
    return false;
  }
};

/**
 * Passe à la phase suivante
 */
export const nextPhase = async (gameCode, currentPhase) => {
  const phaseOrder = [
    'night',
    'cupidon',
    'voyante', 
    'sorciere',
    'day',
    'vote',
    'result'
  ];
  
  const currentIndex = phaseOrder.indexOf(currentPhase);
  const nextPhaseIndex = (currentIndex + 1) % phaseOrder.length;
  const nextPhaseValue = phaseOrder[nextPhaseIndex];
  
  try {
    const updates = {};
    updates[`games/${gameCode}/gameState/currentPhase`] = nextPhaseValue;
    
    // Si on retourne à la nuit, incrémente le compteur
    if (nextPhaseValue === 'night') {
      const gameStateRef = ref(database, `games/${gameCode}/gameState`);
      const snapshot = await get(gameStateRef);
      const currentNightCount = snapshot.val()?.nightCount || 0;
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
 * Résout les actions de la nuit
 */
export const resolveNightActions = async (gameCode, actions) => {
  try {
    // Récupère la victime des loups
    const werewolfTarget = actions.werewolfTarget;
    
    // Vérifie si la sorcière a utilisé sa potion de vie
    const savedByWitch = actions.sorcierePotion === 'life' && 
                         actions.sorciereTarget === werewolfTarget;
    
    // Élimine la victime des loups si pas sauvée
    if (werewolfTarget && !savedByWitch) {
      await eliminatePlayer(gameCode, werewolfTarget, 'devoured');
    }
    
    // Élimine la cible de la potion de mort
    if (actions.sorcierePotion === 'death' && actions.sorciereTarget) {
      await eliminatePlayer(gameCode, actions.sorciereTarget, 'poisoned');
    }
    
    return true;
  } catch (error) {
    console.error('Erreur resolveNightActions:', error);
    return false;
  }
};

/**
 * Résout le vote et élimine le joueur le plus voté
 */
export const resolveVote = async (gameCode, votes) => {
  try {
    // Compte les votes
    const voteCounts = {};
    Object.values(votes).forEach(votedPlayerId => {
      voteCounts[votedPlayerId] = (voteCounts[votedPlayerId] || 0) + 1;
    });
    
    // Trouve le joueur avec le plus de votes
    let maxVotes = 0;
    let eliminatedPlayerId = null;
    
    Object.entries(voteCounts).forEach(([playerId, count]) => {
      if (count > maxVotes) {
        maxVotes = count;
        eliminatedPlayerId = playerId;
      }
    });
    
    // Élimine le joueur
    if (eliminatedPlayerId) {
      await eliminatePlayer(gameCode, eliminatedPlayerId, 'voted');
    }
    
    return eliminatedPlayerId;
  } catch (error) {
    console.error('Erreur resolveVote:', error);
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
  checkWinCondition,
  eliminatePlayer,
  nextPhase,
  resolveNightActions,
  resolveVote,
  toggleTimer,
  resetTimer
};