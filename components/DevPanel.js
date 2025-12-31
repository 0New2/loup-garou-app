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

    return () => {
      off(playersRef);
      off(stateRef);
      off(configRef);
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

            {/* Tabs - 5 onglets */}
            <View style={styles.tabs}>
              {[
                { key: 'players', label: 'Joueurs' },
                { key: 'roles', label: 'Rôles' },
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
});
