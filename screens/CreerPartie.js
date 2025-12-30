import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  Alert
} from 'react-native';
import { ref, set, get } from 'firebase/database';
import { database } from '../firebase';
import { generateGameCode } from '../utils/generateCode';
import colors from '../constants/colors';

export default function CreerPartie({ navigation }) {
  const [playerName, setPlayerName] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const createGame = async () => {
    if (!playerName.trim()) {
      Alert.alert('Erreur', 'Veuillez entrer votre nom');
      return;
    }

    setIsLoading(true);

    try {
      // Générer un code unique
      let gameCode = generateGameCode();
      let codeExists = true;

      // Vérifier que le code n'existe pas déjà
      while (codeExists) {
        const gameRef = ref(database, `games/${gameCode}`);
        const snapshot = await get(gameRef);
        if (!snapshot.exists()) {
          codeExists = false;
        } else {
          gameCode = generateGameCode();
        }
      }

      // Créer l'ID du joueur (MJ)
      const playerId = `player_${Date.now()}`;

      // Structure de la partie
      const gameData = {
        config: {
          maxPlayers: 15,
          createdAt: Date.now(),
          status: 'lobby',
          masterPlayerId: playerId,
        },
        players: {
          [playerId]: {
            name: playerName.trim(),
            role: null,
            isAlive: true,
            isMaster: true,
            joinedAt: Date.now(),
          }
        },
        gameState: {
          currentPhase: 'lobby',
          nightCount: 0,
          timer: 0,
          timerActive: false,
          lastPhaseChange: Date.now(),
        }
      };

      // Créer la partie dans Firebase
      await set(ref(database, `games/${gameCode}`), gameData);

      // Naviguer vers le lobby
      navigation.replace('Lobby', {
        gameCode,
        playerId,
        isMaster: true,
        playerName: playerName.trim()
      });

    } catch (error) {
      console.error('Erreur création partie:', error);
      Alert.alert('Erreur', 'Impossible de créer la partie. Réessayez.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <Text style={styles.backButtonText}>← Retour</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Créer une partie</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <View style={styles.iconContainer}>
            <Text style={styles.icon}>🎮</Text>
          </View>

          <Text style={styles.label}>Votre nom (Maître du jeu)</Text>
          <TextInput
            style={styles.input}
            placeholder="Entrez votre nom"
            placeholderTextColor={colors.textDisabled}
            value={playerName}
            onChangeText={setPlayerName}
            maxLength={20}
            autoCapitalize="words"
          />

          <TouchableOpacity
            style={[styles.button, isLoading && styles.buttonDisabled]}
            onPress={createGame}
            disabled={isLoading}
            activeOpacity={0.8}
          >
            {isLoading ? (
              <ActivityIndicator color={colors.textPrimary} />
            ) : (
              <Text style={styles.buttonText}>Créer la partie</Text>
            )}
          </TouchableOpacity>

          <View style={styles.infoBox}>
            <Text style={styles.infoTitle}>Vous serez le Maître du Jeu</Text>
            <Text style={styles.infoText}>
              Vous contrôlerez le déroulement de la partie, les phases de jeu et le timer.
              Vous pourrez voir tous les rôles des joueurs.
            </Text>
          </View>
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
  header: {
    marginBottom: 40,
  },
  backButton: {
    marginBottom: 20,
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
  form: {
    gap: 20,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  icon: {
    fontSize: 60,
  },
  label: {
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: -10,
  },
  input: {
    backgroundColor: colors.backgroundCard,
    borderRadius: 12,
    padding: 18,
    fontSize: 18,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: 'bold',
  },
  infoBox: {
    backgroundColor: colors.backgroundCard,
    borderRadius: 12,
    padding: 20,
    marginTop: 20,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 10,
  },
  infoText: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
});
