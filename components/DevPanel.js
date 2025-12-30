import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  Dimensions,
  ActivityIndicator
} from 'react-native';
import { ref, onValue, off, set, remove, get } from 'firebase/database';
import { database } from '../firebase';
import { useDevMode } from '../contexts/DevModeContext';
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
  } = useDevMode();

  const [activeTab, setActiveTab] = useState('players');
  const [players, setPlayers] = useState([]);
  const [gameState, setGameState] = useState(null);
  const [gameConfig, setGameConfig] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

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

    return () => {
      off(playersRef);
      off(stateRef);
      off(configRef);
    };
  }, [currentGameCode, isDevPanelVisible]);

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

  // Onglet Joueurs
  const renderPlayersTab = () => (
    <View style={styles.tabContent}>
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
          style={[styles.actionButton, styles.blueButton]}
          onPress={resetToOriginalPlayer}
        >
          <Text style={styles.actionButtonText}>Reset</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.playersList}>
        {players.map((player) => {
          const isActive = player.id === currentPlayerId;
          const isOriginal = player.id === originalPlayerId;

          return (
            <TouchableOpacity
              key={player.id}
              style={[
                styles.playerItem,
                isActive && styles.playerItemActive,
              ]}
              onPress={() => switchToPlayer(player.id, player.name)}
            >
              <View style={styles.playerInfo}>
                <Text style={styles.playerName}>
                  {player.isBot && '🤖 '}
                  {player.name}
                  {isOriginal && ' (Vous)'}
                </Text>
                <Text style={styles.playerDetails}>
                  {player.isMaster && 'MJ • '}
                  {player.role || 'Sans rôle'}
                  {!player.isAlive && ' • Mort'}
                </Text>
              </View>
              {isActive && (
                <View style={styles.activeBadge}>
                  <Text style={styles.activeBadgeText}>ACTIF</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
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
            {players.filter(p => p.isAlive).length}/{players.length}
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
          style={[styles.actionButton, styles.greenButton]}
          onPress={() => forceStatus('playing')}
        >
          <Text style={styles.actionButtonText}>Playing</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.redButton]}
          onPress={() => forceStatus('finished')}
        >
          <Text style={styles.actionButtonText}>Finished</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.debugTitle}>Forcer la phase</Text>
      <View style={styles.phaseButtons}>
        {['lobby', 'night_werewolves', 'night_seer', 'night_witch', 'day_discussion', 'day_vote'].map((phase) => (
          <TouchableOpacity
            key={phase}
            style={[styles.phaseButton, gameState?.currentPhase === phase && styles.phaseButtonActive]}
            onPress={() => forcePhase(phase)}
          >
            <Text style={styles.phaseButtonText}>{phase.replace('_', '\n')}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  // Onglet Logs
  const renderLogsTab = () => (
    <View style={styles.tabContent}>
      <TouchableOpacity
        style={[styles.actionButton, styles.grayButton, { alignSelf: 'flex-end', marginBottom: 10 }]}
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
                  Contrôle: {players.find(p => p.id === currentPlayerId)?.name || currentPlayerId}
                </Text>
              </View>
            )}

            {/* Tabs */}
            <View style={styles.tabs}>
              {['players', 'debug', 'logs'].map((tab) => (
                <TouchableOpacity
                  key={tab}
                  style={[styles.tab, activeTab === tab && styles.tabActive]}
                  onPress={() => setActiveTab(tab)}
                >
                  <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                    {tab === 'players' ? 'Joueurs' : tab === 'debug' ? 'Debug' : 'Logs'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Contenu des tabs */}
            {isLoading && (
              <ActivityIndicator style={styles.loader} color={colors.primary} />
            )}
            {activeTab === 'players' && renderPlayersTab()}
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
    height: SCREEN_HEIGHT * 0.75,
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
  playersList: {
    flex: 1,
  },
  playerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#252525',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  playerItemActive: {
    borderWidth: 2,
    borderColor: '#FF6B00',
  },
  playerInfo: {
    flex: 1,
  },
  playerName: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 14,
  },
  playerDetails: {
    color: '#888',
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
  },
  phaseButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  phaseButton: {
    backgroundColor: '#333',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    minWidth: 80,
    alignItems: 'center',
  },
  phaseButtonActive: {
    backgroundColor: '#FF6B00',
  },
  phaseButtonText: {
    color: '#FFF',
    fontSize: 10,
    textAlign: 'center',
  },
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
});
