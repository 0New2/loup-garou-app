import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Animated,
  Share,
  Alert,
} from 'react-native';
import { ref, onValue, off, set, update, remove } from 'firebase/database';
import { database } from '../firebase';
import { getRoleById, ROLES } from '../utils/roles';
import { useDevMode } from '../contexts/DevModeContext';
import colors from '../constants/colors';

export default function EndGameScreen({ navigation, route }) {
  const { gameCode, playerId } = route.params;
  const { addLog } = useDevMode();

  // États
  const [players, setPlayers] = useState([]);
  const [gameState, setGameState] = useState(null);
  const [gameConfig, setGameConfig] = useState(null);
  const [gameResult, setGameResult] = useState(null);
  const [lovers, setLovers] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPlayer, setCurrentPlayer] = useState(null);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const confettiAnim = useRef(new Animated.Value(0)).current;

  // Charger les données Firebase
  useEffect(() => {
    const playersRef = ref(database, `games/${gameCode}/players`);
    const stateRef = ref(database, `games/${gameCode}/gameState`);
    const configRef = ref(database, `games/${gameCode}/config`);
    const resultRef = ref(database, `games/${gameCode}/result`);
    const loversRef = ref(database, `games/${gameCode}/lovers`);

    onValue(playersRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const list = Object.entries(data).map(([id, info]) => ({ id, ...info }));
        setPlayers(list);
        setCurrentPlayer(list.find(p => p.id === playerId));
      }
      setIsLoading(false);
    });

    onValue(stateRef, (snapshot) => {
      if (snapshot.exists()) {
        setGameState(snapshot.val());
      }
    });

    onValue(configRef, (snapshot) => {
      if (snapshot.exists()) {
        setGameConfig(snapshot.val());
      }
    });

    onValue(resultRef, (snapshot) => {
      if (snapshot.exists()) {
        setGameResult(snapshot.val());
      }
    });

    onValue(loversRef, (snapshot) => {
      if (snapshot.exists()) {
        setLovers(snapshot.val());
      }
    });

    return () => {
      off(playersRef);
      off(stateRef);
      off(configRef);
      off(resultRef);
      off(loversRef);
    };
  }, [gameCode, playerId]);

  // Animation d'entrée
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 5,
        useNativeDriver: true,
      }),
    ]).start();

    // Animation confettis
    Animated.loop(
      Animated.sequence([
        Animated.timing(confettiAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(confettiAnim, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  // Données calculées
  const winner = gameResult?.winner || gameState?.winner || 'village';
  const isVillageWin = winner === 'village';
  const isMaster = currentPlayer?.isMaster;
  const masterPlayer = players.find(p => p.isMaster);
  const gamePlayers = players.filter(p => !p.isMaster);
  const nightCount = gameState?.nightCount || 0;

  // Séparer par équipe
  const wolves = gamePlayers.filter(p => getRoleById(p.role)?.team === 'loups');
  const villagers = gamePlayers.filter(p => getRoleById(p.role)?.team === 'village');

  // Statistiques
  const stats = {
    totalPlayers: gamePlayers.length,
    alivePlayers: gamePlayers.filter(p => p.isAlive !== false).length,
    deadPlayers: gamePlayers.filter(p => p.isAlive === false).length,
    nightsPlayed: nightCount,
    // Détail par cause de mort (si disponible)
    devouredCount: gamePlayers.filter(p => p.deathReason === 'devoured').length,
    votedCount: gamePlayers.filter(p => p.deathReason === 'voted' || p.deathReason === 'vote').length,
    poisonedCount: gamePlayers.filter(p => p.deathReason === 'poisoned').length,
    heartbreakCount: gamePlayers.filter(p => p.deathReason === 'heartbreak').length,
  };

  // Partager les résultats
  const handleShare = async () => {
    const message = `${isVillageWin ? '🏘️' : '🐺'} ${isVillageWin ? 'Le Village' : 'Les Loups'} a gagné !\n\n` +
      `Partie de Loup-Garou terminée en ${nightCount} nuit(s)\n` +
      `${stats.totalPlayers} joueurs - ${stats.deadPlayers} éliminés\n\n` +
      `Joué avec l'app Loup-Garou 🐺`;

    try {
      await Share.share({ message });
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de partager');
    }
  };

  // Créer une nouvelle partie
  const handleNewGame = () => {
    navigation.replace('CreerPartie');
  };

  // Rejouer avec les mêmes joueurs
  const handleReplay = async () => {
    try {
      // Réinitialiser la partie
      const updates = {};

      // Reset tous les joueurs (garder les noms, reset rôles)
      players.forEach(player => {
        updates[`games/${gameCode}/players/${player.id}/role`] = null;
        updates[`games/${gameCode}/players/${player.id}/isAlive`] = true;
        updates[`games/${gameCode}/players/${player.id}/deathReason`] = null;
        updates[`games/${gameCode}/players/${player.id}/deathNight`] = null;
      });

      // Reset config et état
      updates[`games/${gameCode}/config/status`] = 'lobby';
      updates[`games/${gameCode}/gameState`] = {
        currentPhase: 'lobby',
        nightCount: 0,
        timer: 0,
        timerRunning: false,
        lastPhaseChange: Date.now(),
      };
      updates[`games/${gameCode}/result`] = null;
      updates[`games/${gameCode}/votes`] = null;
      updates[`games/${gameCode}/lovers`] = null;
      updates[`games/${gameCode}/actions`] = null;

      await update(ref(database), updates);

      if (__DEV__) addLog('Partie réinitialisée pour rejouer');

      // Retourner au lobby
      navigation.replace('Lobby', {
        gameCode,
        playerId,
        isMaster: isMaster,
        playerName: currentPlayer?.name,
      });
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de relancer la partie');
    }
  };

  // Retour au menu
  const handleBackToMenu = () => {
    navigation.replace('Menu');
  };

  // Rendu d'un joueur dans la liste
  const renderPlayerCard = (player, index) => {
    const role = getRoleById(player.role);
    const isAlive = player.isAlive !== false;
    const isLover = lovers && (lovers.player1 === player.id || lovers.player2 === player.id);

    return (
      <View key={player.id} style={[styles.playerCard, !isAlive && styles.playerCardDead]}>
        <View style={[styles.playerRoleIcon, { backgroundColor: role?.color || '#333' }]}>
          <Text style={styles.playerRoleEmoji}>{role?.icon || '❓'}</Text>
        </View>
        <View style={styles.playerInfo}>
          <View style={styles.playerNameRow}>
            <Text style={[styles.playerName, !isAlive && styles.playerNameDead]}>
              {player.name}
            </Text>
            {isLover && <Text style={styles.loverBadge}>💘</Text>}
          </View>
          <Text style={[styles.playerRole, { color: role?.color || '#888' }]}>
            {role?.name || 'Inconnu'}
          </Text>
        </View>
        <View style={styles.playerStatus}>
          {isAlive ? (
            <View style={styles.aliveBadge}>
              <Text style={styles.aliveBadgeText}>✓ Vivant</Text>
            </View>
          ) : (
            <View style={styles.deadBadge}>
              <Text style={styles.deadBadgeText}>💀 Mort</Text>
              {player.deathReason && (
                <Text style={styles.deathReason}>
                  {getDeathReasonText(player.deathReason)}
                </Text>
              )}
            </View>
          )}
        </View>
      </View>
    );
  };

  // Texte de raison de mort
  const getDeathReasonText = (reason) => {
    const reasons = {
      devoured: 'Dévoré',
      voted: 'Éliminé',
      vote: 'Éliminé',
      poisoned: 'Empoisonné',
      heartbreak: 'Chagrin',
      hunter: 'Chasseur',
    };
    return reasons[reason] || reason;
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Chargement des résultats...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[
      styles.container,
      isVillageWin ? styles.containerVillage : styles.containerWolves
    ]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* SECTION 1 - Annonce du vainqueur */}
        <Animated.View style={[
          styles.winnerSection,
          isVillageWin ? styles.winnerSectionVillage : styles.winnerSectionWolves,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          }
        ]}>
          <Animated.Text style={[
            styles.winnerEmoji,
            {
              transform: [{
                translateY: confettiAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, -10],
                })
              }]
            }
          ]}>
            {isVillageWin ? '🏘️' : '🐺'}
          </Animated.Text>
          <Text style={styles.winnerTitle}>
            {isVillageWin ? 'LE VILLAGE A GAGNÉ !' : 'LES LOUPS ONT GAGNÉ !'}
          </Text>
          <Text style={styles.winnerMessage}>
            {isVillageWin
              ? 'Tous les loups ont été éliminés'
              : 'Le village a été décimé'}
          </Text>
          {gameResult?.message && (
            <Text style={styles.winnerDetail}>{gameResult.message}</Text>
          )}
        </Animated.View>

        {/* SECTION 2 - Statistiques */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📊 Statistiques de la partie</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{stats.nightsPlayed}</Text>
              <Text style={styles.statLabel}>Nuit(s)</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{stats.totalPlayers}</Text>
              <Text style={styles.statLabel}>Joueurs</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={[styles.statValue, { color: colors.success }]}>{stats.alivePlayers}</Text>
              <Text style={styles.statLabel}>Survivants</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={[styles.statValue, { color: colors.danger }]}>{stats.deadPlayers}</Text>
              <Text style={styles.statLabel}>Éliminés</Text>
            </View>
          </View>

          {/* Détail des éliminations */}
          {stats.deadPlayers > 0 && (
            <View style={styles.deathStatsCard}>
              <Text style={styles.deathStatsTitle}>Causes des éliminations :</Text>
              <View style={styles.deathStatsList}>
                {stats.devouredCount > 0 && (
                  <View style={styles.deathStatItem}>
                    <Text style={styles.deathStatIcon}>🐺</Text>
                    <Text style={styles.deathStatText}>Dévorés : {stats.devouredCount}</Text>
                  </View>
                )}
                {stats.votedCount > 0 && (
                  <View style={styles.deathStatItem}>
                    <Text style={styles.deathStatIcon}>⚖️</Text>
                    <Text style={styles.deathStatText}>Votés : {stats.votedCount}</Text>
                  </View>
                )}
                {stats.poisonedCount > 0 && (
                  <View style={styles.deathStatItem}>
                    <Text style={styles.deathStatIcon}>🧪</Text>
                    <Text style={styles.deathStatText}>Empoisonnés : {stats.poisonedCount}</Text>
                  </View>
                )}
                {stats.heartbreakCount > 0 && (
                  <View style={styles.deathStatItem}>
                    <Text style={styles.deathStatIcon}>💔</Text>
                    <Text style={styles.deathStatText}>Chagrin : {stats.heartbreakCount}</Text>
                  </View>
                )}
              </View>
            </View>
          )}
        </View>

        {/* SECTION 3 - Révélation des rôles */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📜 Révélation des rôles</Text>

          {/* Équipe des Loups */}
          {wolves.length > 0 && (
            <View style={styles.teamSection}>
              <View style={[styles.teamHeader, { backgroundColor: colors.werewolf }]}>
                <Text style={styles.teamTitle}>🐺 Équipe des Loups</Text>
                <Text style={styles.teamCount}>{wolves.length} joueur(s)</Text>
              </View>
              {wolves.map((player, index) => renderPlayerCard(player, index))}
            </View>
          )}

          {/* Équipe du Village */}
          {villagers.length > 0 && (
            <View style={styles.teamSection}>
              <View style={[styles.teamHeader, { backgroundColor: colors.villager }]}>
                <Text style={styles.teamTitle}>🏘️ Équipe du Village</Text>
                <Text style={styles.teamCount}>{villagers.length} joueur(s)</Text>
              </View>
              {villagers.map((player, index) => renderPlayerCard(player, index))}
            </View>
          )}

          {/* Maître du Jeu */}
          {masterPlayer && (
            <View style={styles.masterSection}>
              <View style={[styles.teamHeader, { backgroundColor: colors.special }]}>
                <Text style={styles.teamTitle}>🎮 Maître du Jeu</Text>
              </View>
              <View style={styles.masterCard}>
                <Text style={styles.masterEmoji}>👑</Text>
                <View style={styles.masterInfo}>
                  <Text style={styles.masterName}>{masterPlayer.name}</Text>
                  <Text style={styles.masterSubtext}>A géré cette partie avec brio !</Text>
                </View>
              </View>
            </View>
          )}
        </View>

        {/* SECTION 4 - Actions */}
        <View style={styles.actionsSection}>
          {isMaster ? (
            <>
              <TouchableOpacity
                style={[styles.actionButton, styles.primaryButton]}
                onPress={handleReplay}
              >
                <Text style={styles.actionButtonIcon}>🔄</Text>
                <Text style={styles.actionButtonText}>Rejouer avec les mêmes joueurs</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, styles.secondaryButton]}
                onPress={handleNewGame}
              >
                <Text style={styles.actionButtonIcon}>➕</Text>
                <Text style={styles.actionButtonText}>Créer une nouvelle partie</Text>
              </TouchableOpacity>
            </>
          ) : (
            <View style={styles.playerEndSection}>
              <Text style={styles.thanksText}>Merci d'avoir joué !</Text>
              <TouchableOpacity
                style={[styles.actionButton, styles.primaryButton]}
                onPress={handleBackToMenu}
              >
                <Text style={styles.actionButtonIcon}>🏠</Text>
                <Text style={styles.actionButtonText}>Retour au menu</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Bouton partager */}
          <TouchableOpacity
            style={[styles.actionButton, styles.shareButton]}
            onPress={handleShare}
          >
            <Text style={styles.actionButtonIcon}>📤</Text>
            <Text style={styles.actionButtonText}>Partager les résultats</Text>
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Code partie : {gameCode}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  containerVillage: {
    backgroundColor: '#0A1628',
  },
  containerWolves: {
    backgroundColor: '#1A0A0A',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: colors.textPrimary,
    fontSize: 16,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },

  // Winner Section
  winnerSection: {
    padding: 40,
    alignItems: 'center',
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
  },
  winnerSectionVillage: {
    backgroundColor: colors.villager,
  },
  winnerSectionWolves: {
    backgroundColor: colors.werewolf,
  },
  winnerEmoji: {
    fontSize: 80,
    marginBottom: 20,
  },
  winnerTitle: {
    color: '#FFF',
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  winnerMessage: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 16,
    textAlign: 'center',
  },
  winnerDetail: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 10,
    fontStyle: 'italic',
  },

  // Sections
  section: {
    padding: 20,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
  },

  // Stats
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 15,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: colors.backgroundCard,
    borderRadius: 12,
    padding: 15,
    alignItems: 'center',
  },
  statValue: {
    color: colors.textPrimary,
    fontSize: 32,
    fontWeight: 'bold',
  },
  statLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 5,
  },
  deathStatsCard: {
    backgroundColor: colors.backgroundCard,
    borderRadius: 12,
    padding: 15,
  },
  deathStatsTitle: {
    color: colors.textSecondary,
    fontSize: 12,
    marginBottom: 10,
  },
  deathStatsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  deathStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  deathStatIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  deathStatText: {
    color: colors.textPrimary,
    fontSize: 13,
  },

  // Teams
  teamSection: {
    marginBottom: 20,
  },
  teamHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
  },
  teamTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  teamCount: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
  },

  // Player Cards
  playerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundCard,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  playerCardDead: {
    opacity: 0.6,
  },
  playerRoleIcon: {
    width: 50,
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  playerRoleEmoji: {
    fontSize: 24,
  },
  playerInfo: {
    flex: 1,
  },
  playerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  playerName: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  playerNameDead: {
    textDecorationLine: 'line-through',
    color: colors.textSecondary,
  },
  loverBadge: {
    marginLeft: 8,
    fontSize: 14,
  },
  playerRole: {
    fontSize: 13,
    marginTop: 2,
  },
  playerStatus: {
    alignItems: 'flex-end',
  },
  aliveBadge: {
    backgroundColor: 'rgba(5, 150, 105, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  aliveBadgeText: {
    color: colors.success,
    fontSize: 12,
    fontWeight: '600',
  },
  deadBadge: {
    alignItems: 'flex-end',
  },
  deadBadgeText: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  deathReason: {
    color: colors.textDisabled,
    fontSize: 10,
    marginTop: 2,
  },

  // Master Section
  masterSection: {
    marginTop: 10,
  },
  masterCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    borderRadius: 12,
    padding: 15,
    borderWidth: 1,
    borderColor: colors.special,
  },
  masterEmoji: {
    fontSize: 40,
    marginRight: 15,
  },
  masterInfo: {
    flex: 1,
  },
  masterName: {
    color: colors.special,
    fontSize: 18,
    fontWeight: 'bold',
  },
  masterSubtext: {
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: 2,
  },

  // Actions
  actionsSection: {
    padding: 20,
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
    borderRadius: 16,
  },
  primaryButton: {
    backgroundColor: colors.primary,
  },
  secondaryButton: {
    backgroundColor: colors.backgroundCard,
    borderWidth: 1,
    borderColor: colors.border,
  },
  shareButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.textSecondary,
  },
  actionButtonIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  actionButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  playerEndSection: {
    alignItems: 'center',
  },
  thanksText: {
    color: colors.textPrimary,
    fontSize: 18,
    marginBottom: 15,
  },

  // Footer
  footer: {
    padding: 20,
    alignItems: 'center',
  },
  footerText: {
    color: colors.textDisabled,
    fontSize: 12,
  },
});
