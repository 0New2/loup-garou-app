import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  FlatList,
  Alert,
  ActivityIndicator
} from 'react-native';
import { ref, onValue, off, remove } from 'firebase/database';
import { database } from '../firebase';
import { useDevMode } from '../contexts/DevModeContext';
import colors from '../constants/colors';

export default function LobbyScreen({ navigation, route }) {
  const { gameCode, playerId: initialPlayerId, isMaster: initialIsMaster, playerName } = route.params;

  // Mode développeur
  const { setGameContext, currentPlayerId, addLog } = useDevMode();

  // Utiliser le playerId du contexte dev si disponible, sinon celui des params
  const playerId = currentPlayerId || initialPlayerId;
  const isMaster = initialIsMaster; // Le statut MJ reste lié au joueur original

  const [players, setPlayers] = useState([]);
  const [gameStatus, setGameStatus] = useState('lobby');
  const [maxPlayers, setMaxPlayers] = useState(15);
  const [isLoading, setIsLoading] = useState(true);

  // Initialiser le contexte DevMode
  useEffect(() => {
    if (__DEV__) {
      setGameContext(gameCode, initialPlayerId, initialIsMaster);
      addLog(`Lobby ouvert: ${gameCode}`);
    }
  }, [gameCode, initialPlayerId, initialIsMaster, setGameContext, addLog]);

  useEffect(() => {
    // Listener pour les joueurs
    const playersRef = ref(database, `games/${gameCode}/players`);
    const unsubscribePlayers = onValue(playersRef, (snapshot) => {
      if (snapshot.exists()) {
        const playersData = snapshot.val();
        const playersList = Object.entries(playersData).map(([id, data]) => ({
          id,
          ...data
        }));
        // Trier par date d'arrivée
        playersList.sort((a, b) => a.joinedAt - b.joinedAt);
        setPlayers(playersList);
      } else {
        setPlayers([]);
      }
      setIsLoading(false);
    });

    // Listener pour le statut de la partie
    const configRef = ref(database, `games/${gameCode}/config`);
    const unsubscribeConfig = onValue(configRef, (snapshot) => {
      if (snapshot.exists()) {
        const config = snapshot.val();
        setGameStatus(config.status);
        setMaxPlayers(config.maxPlayers || 15);

        // Si la partie a commencé, naviguer vers l'écran approprié
        if (config.status === 'playing') {
          // TODO: Naviguer vers RoleRevealScreen ou GameScreen
          console.log('La partie a commencé !');
        }
      } else {
        // La partie n'existe plus
        Alert.alert(
          'Partie terminée',
          'Cette partie n\'existe plus.',
          [{ text: 'OK', onPress: () => navigation.navigate('Menu') }]
        );
      }
    });

    // Cleanup des listeners
    return () => {
      off(playersRef);
      off(configRef);
    };
  }, [gameCode, navigation]);

  const leaveGame = async () => {
    Alert.alert(
      'Quitter la partie',
      'Voulez-vous vraiment quitter cette partie ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Quitter',
          style: 'destructive',
          onPress: async () => {
            try {
              // Supprimer le joueur de la partie
              await remove(ref(database, `games/${gameCode}/players/${playerId}`));

              // Si c'est le MJ, supprimer toute la partie
              if (isMaster) {
                await remove(ref(database, `games/${gameCode}`));
              }

              navigation.navigate('Menu');
            } catch (error) {
              console.error('Erreur quitter partie:', error);
              Alert.alert('Erreur', 'Impossible de quitter la partie.');
            }
          }
        }
      ]
    );
  };

  const goToRoleConfig = () => {
    // TODO: Naviguer vers RoleConfigScreen
    navigation.navigate('RoleConfig', { gameCode, playerId });
  };

  const renderPlayer = ({ item, index }) => {
    const isCurrentPlayer = item.id === playerId;
    const isMasterPlayer = item.isMaster;
    const isBot = item.isBot;

    return (
      <View style={[
        styles.playerCard,
        isCurrentPlayer && styles.playerCardCurrent,
        isBot && styles.playerCardBot
      ]}>
        <View style={styles.playerInfo}>
          <View style={[
            styles.playerNumberContainer,
            isBot && styles.playerNumberBot
          ]}>
            <Text style={styles.playerNumber}>
              {isBot ? '🤖' : index + 1}
            </Text>
          </View>
          <View style={styles.playerDetails}>
            <Text style={styles.playerName}>
              {item.name}
              {isCurrentPlayer && ' (Vous)'}
            </Text>
            {isMasterPlayer && (
              <View style={styles.masterBadge}>
                <Text style={styles.masterBadgeText}>MJ</Text>
              </View>
            )}
            {isBot && (
              <View style={styles.botBadge}>
                <Text style={styles.botBadgeText}>BOT</Text>
              </View>
            )}
          </View>
        </View>
        <Text style={styles.playerStatus}>En attente</Text>
      </View>
    );
  };

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
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={leaveGame}
            style={styles.backButton}
          >
            <Text style={styles.backButtonText}>← Quitter</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Lobby</Text>
        </View>

        {/* Code de la partie */}
        <View style={styles.codeContainer}>
          <Text style={styles.codeLabel}>Code de la partie</Text>
          <Text style={styles.codeValue}>{gameCode}</Text>
          <Text style={styles.codeHint}>Partagez ce code avec vos amis</Text>
        </View>

        {/* Liste des joueurs */}
        <View style={styles.playersSection}>
          <View style={styles.playersHeader}>
            <Text style={styles.playersTitle}>Joueurs</Text>
            <View style={styles.playerCountContainer}>
              <Text style={styles.playerCount}>
                {players.length}/{maxPlayers}
              </Text>
            </View>
          </View>

          <FlatList
            data={players}
            renderItem={renderPlayer}
            keyExtractor={(item) => item.id}
            style={styles.playersList}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <Text style={styles.emptyText}>Aucun joueur pour le moment...</Text>
            }
          />
        </View>

        {/* Actions */}
        <View style={styles.actionsContainer}>
          {isMaster ? (
            <>
              <TouchableOpacity
                style={[
                  styles.button,
                  styles.primaryButton,
                  players.length < 4 && styles.buttonDisabled
                ]}
                onPress={goToRoleConfig}
                disabled={players.length < 4}
                activeOpacity={0.8}
              >
                <Text style={styles.buttonText}>Configurer les rôles</Text>
              </TouchableOpacity>
              {players.length < 4 && (
                <Text style={styles.warningText}>
                  Minimum 4 joueurs requis pour lancer la partie
                </Text>
              )}
            </>
          ) : (
            <View style={styles.waitingContainer}>
              <Text style={styles.waitingEmoji}>⏳</Text>
              <Text style={styles.waitingText}>En attente du Maître du Jeu...</Text>
              <Text style={styles.waitingSubtext}>
                La partie commencera bientôt
              </Text>
            </View>
          )}
        </View>
      </View>
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
    padding: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: colors.textSecondary,
    marginTop: 10,
    fontSize: 16,
  },
  header: {
    marginBottom: 20,
  },
  backButton: {
    marginBottom: 15,
  },
  backButtonText: {
    color: colors.textSecondary,
    fontSize: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  codeContainer: {
    backgroundColor: colors.backgroundCard,
    borderRadius: 16,
    padding: 25,
    alignItems: 'center',
    marginBottom: 25,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  codeLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 10,
  },
  codeValue: {
    fontSize: 42,
    fontWeight: 'bold',
    color: colors.textPrimary,
    letterSpacing: 8,
    fontFamily: 'monospace',
  },
  codeHint: {
    fontSize: 12,
    color: colors.textDisabled,
    marginTop: 10,
  },
  playersSection: {
    flex: 1,
    marginBottom: 20,
  },
  playersHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  playersTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  playerCountContainer: {
    backgroundColor: colors.backgroundCard,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  playerCount: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  playersList: {
    flex: 1,
  },
  playerCard: {
    backgroundColor: colors.backgroundCard,
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  playerCardCurrent: {
    borderWidth: 2,
    borderColor: colors.secondary,
  },
  playerCardBot: {
    opacity: 0.8,
    borderLeftWidth: 3,
    borderLeftColor: '#FF6B00',
  },
  playerNumberBot: {
    backgroundColor: '#FF6B00',
  },
  botBadge: {
    backgroundColor: '#FF6B00',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
  },
  botBadgeText: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#FFF',
  },
  playerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  playerNumberContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  playerNumber: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.textSecondary,
  },
  playerDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  playerName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  masterBadge: {
    backgroundColor: colors.special,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginLeft: 10,
  },
  masterBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: colors.background,
  },
  playerStatus: {
    fontSize: 12,
    color: colors.textDisabled,
  },
  emptyText: {
    color: colors.textDisabled,
    textAlign: 'center',
    marginTop: 40,
    fontSize: 16,
  },
  actionsContainer: {
    paddingTop: 10,
  },
  button: {
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: colors.primary,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: 'bold',
  },
  warningText: {
    color: colors.warning,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 10,
  },
  waitingContainer: {
    alignItems: 'center',
    padding: 30,
    backgroundColor: colors.backgroundCard,
    borderRadius: 16,
  },
  waitingEmoji: {
    fontSize: 40,
    marginBottom: 15,
  },
  waitingText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 5,
  },
  waitingSubtext: {
    fontSize: 14,
    color: colors.textSecondary,
  },
});
