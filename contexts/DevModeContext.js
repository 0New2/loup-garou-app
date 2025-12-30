import React, { createContext, useContext, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const DevModeContext = createContext(null);

// Noms pour les bots
const BOT_NAMES = [
  'Alice', 'Bob', 'Charlie', 'Diana', 'Eve',
  'Frank', 'Grace', 'Henry', 'Ivy', 'Jack',
  'Kate', 'Leo', 'Maya', 'Noah', 'Olivia'
];

export function DevModeProvider({ children }) {
  // État du mode dev
  const [isDevPanelVisible, setIsDevPanelVisible] = useState(false);
  const [isDevModeEnabled, setIsDevModeEnabled] = useState(__DEV__);

  // État du jeu actuel pour le debug
  const [currentGameCode, setCurrentGameCode] = useState(null);
  const [currentPlayerId, setCurrentPlayerId] = useState(null);
  const [originalPlayerId, setOriginalPlayerId] = useState(null);
  const [isMaster, setIsMaster] = useState(false);

  // Logs d'événements
  const [eventLogs, setEventLogs] = useState([]);

  // Enregistrer le contexte de jeu
  const setGameContext = useCallback((gameCode, playerId, master) => {
    setCurrentGameCode(gameCode);
    setCurrentPlayerId(playerId);
    setOriginalPlayerId(playerId);
    setIsMaster(master);
    addLog(`Contexte initialisé: ${gameCode} - ${playerId} (MJ: ${master})`);
  }, []);

  // Ajouter un log
  const addLog = useCallback((message) => {
    const timestamp = new Date().toLocaleTimeString('fr-FR');
    setEventLogs(prev => [{
      id: Date.now(),
      time: timestamp,
      message
    }, ...prev].slice(0, 50)); // Garder les 50 derniers logs
  }, []);

  // Effacer les logs
  const clearLogs = useCallback(() => {
    setEventLogs([]);
  }, []);

  // Switcher vers un autre joueur
  const switchToPlayer = useCallback(async (playerId, playerName) => {
    setCurrentPlayerId(playerId);
    await AsyncStorage.setItem('dev_active_player', playerId);
    addLog(`Switch vers: ${playerName} (${playerId})`);
  }, [addLog]);

  // Revenir au joueur original
  const resetToOriginalPlayer = useCallback(async () => {
    if (originalPlayerId) {
      setCurrentPlayerId(originalPlayerId);
      await AsyncStorage.removeItem('dev_active_player');
      addLog('Retour au joueur original');
    }
  }, [originalPlayerId, addLog]);

  // Toggle le panneau dev
  const toggleDevPanel = useCallback(() => {
    setIsDevPanelVisible(prev => !prev);
  }, []);

  // Générer un nom de bot unique
  const getNextBotName = useCallback((existingPlayers) => {
    const usedNames = existingPlayers.map(p => p.name);
    for (const name of BOT_NAMES) {
      if (!usedNames.includes(name)) {
        return name;
      }
    }
    return `Bot${existingPlayers.length + 1}`;
  }, []);

  const value = {
    // État
    isDevModeEnabled,
    isDevPanelVisible,
    currentGameCode,
    currentPlayerId,
    originalPlayerId,
    isMaster,
    eventLogs,

    // Actions
    setGameContext,
    toggleDevPanel,
    setIsDevPanelVisible,
    switchToPlayer,
    resetToOriginalPlayer,
    addLog,
    clearLogs,
    getNextBotName,
  };

  // Ne rendre le provider que si on est en mode dev
  if (!__DEV__) {
    return children;
  }

  return (
    <DevModeContext.Provider value={value}>
      {children}
    </DevModeContext.Provider>
  );
}

export function useDevMode() {
  const context = useContext(DevModeContext);

  // En production, retourner un objet vide avec des fonctions no-op
  if (!__DEV__ || !context) {
    return {
      isDevModeEnabled: false,
      isDevPanelVisible: false,
      currentGameCode: null,
      currentPlayerId: null,
      originalPlayerId: null,
      isMaster: false,
      eventLogs: [],
      setGameContext: () => {},
      toggleDevPanel: () => {},
      setIsDevPanelVisible: () => {},
      switchToPlayer: () => {},
      resetToOriginalPlayer: () => {},
      addLog: () => {},
      clearLogs: () => {},
      getNextBotName: () => 'Bot',
    };
  }

  return context;
}
