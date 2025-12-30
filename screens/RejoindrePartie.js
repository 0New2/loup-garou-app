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
import { ref, get, set } from 'firebase/database';
import { database } from '../firebase';
import { formatGameCode, isValidGameCode } from '../utils/generateCode';
import colors from '../constants/colors';

export default function RejoindrePartie({ navigation }) {
  const [playerName, setPlayerName] = useState('');
  const [gameCode, setGameCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const joinGame = async () => {
    if (!playerName.trim()) {
      Alert.alert('Erreur', 'Veuillez entrer votre nom');
      return;
    }

    if (!gameCode.trim()) {
      Alert.alert('Erreur', 'Veuillez entrer le code de la partie');
      return;
    }

    const formattedCode = formatGameCode(gameCode);

    if (!isValidGameCode(formattedCode)) {
      Alert.alert('Erreur', 'Le code doit contenir 6 caractères (lettres et chiffres)');
      return;
    }

    setIsLoading(true);

    try {
      // Vérifie si la partie existe
      const gameRef = ref(database, `games/${formattedCode}`);
      const snapshot = await get(gameRef);

      if (!snapshot.exists()) {
        Alert.alert('Erreur', 'Cette partie n\'existe pas. Vérifiez le code.');
        setIsLoading(false);
        return;
      }

      const gameData = snapshot.val();

      // Vérifie le statut de la partie
      if (gameData.config.status !== 'lobby') {
        Alert.alert('Erreur', 'Cette partie a déjà commencé ou est terminée.');
        setIsLoading(false);
        return;
      }

      // Vérifie le nombre de joueurs
      const playerCount = Object.keys(gameData.players || {}).length;
      if (playerCount >= gameData.config.maxPlayers) {
        Alert.alert('Erreur', 'Cette partie est complète (15 joueurs max).');
        setIsLoading(false);
        return;
      }

      // Crée l'ID du nouveau joueur
      const playerId = `player_${Date.now()}`;

      // Ajoute le joueur à la partie
      const newPlayerData = {
        name: playerName.trim(),
        role: null,
        isAlive: true,
        isMaster: false,
        joinedAt: Date.now(),
      };

      await set(ref(database, `games/${formattedCode}/players/${playerId}`), newPlayerData);

      // Navigation vers le lobby
      navigation.replace('Lobby', {
        gameCode: formattedCode,
        playerId,
        isMaster: false,
        playerName: playerName.trim()
      });

    } catch (error) {
      console.error('Erreur rejoindre partie:', error);
      Alert.alert('Erreur', 'Impossible de rejoindre la partie. Réessayez.');
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
          <Text style={styles.title}>Rejoindre une partie</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <View style={styles.iconContainer}>
            <Text style={styles.icon}>🚪</Text>
          </View>

          <Text style={styles.label}>Votre nom</Text>
          <TextInput
            style={styles.input}
            placeholder="Entrez votre nom"
            placeholderTextColor={colors.textDisabled}
            value={playerName}
            onChangeText={setPlayerName}
            maxLength={20}
            autoCapitalize="words"
          />

          <Text style={styles.label}>Code de la partie</Text>
          <TextInput
            style={[styles.input, styles.codeInput]}
            placeholder="ABC123"
            placeholderTextColor={colors.textDisabled}
            value={gameCode}
            onChangeText={(text) => setGameCode(text.toUpperCase())}
            maxLength={6}
            autoCapitalize="characters"
            autoCorrect={false}
          />

          <TouchableOpacity 
            style={[styles.button, isLoading && styles.buttonDisabled]}
            onPress={joinGame}
            disabled={isLoading}
            activeOpacity={0.8}
          >
            {isLoading ? (
              <ActivityIndicator color={colors.textPrimary} />
            ) : (
              <Text style={styles.buttonText}>Rejoindre</Text>
            )}
          </TouchableOpacity>

          <View style={styles.infoBox}>
            <Text style={styles.infoTitle}>💡 Astuce</Text>
            <Text style={styles.infoText}>
              Demandez le code de 6 caractères au maître du jeu qui a créé la partie.
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
  codeInput: {
    fontFamily: 'monospace',
    fontSize: 24,
    textAlign: 'center',
    letterSpacing: 4,
    fontWeight: 'bold',
  },
  button: {
    backgroundColor: colors.secondary,
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
    borderLeftColor: colors.secondary,
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