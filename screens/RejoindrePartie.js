import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, Alert } from 'react-native';
import { database } from '../firebase';
import { ref, get, set } from 'firebase/database';

export default function RejoindrePartie({ navigation }) {
  const [codePartie, setCodePartie] = useState('');
  const [nomJoueur, setNomJoueur] = useState('');
  const [loading, setLoading] = useState(false);

  const rejoindrePartie = async () => {
    // Vérifications
    if (!codePartie || codePartie.length !== 6) {
      Alert.alert('Erreur', 'Le code doit contenir 6 chiffres');
      return;
    }

    if (!nomJoueur || nomJoueur.trim() === '') {
      Alert.alert('Erreur', 'Veuillez entrer votre nom');
      return;
    }

    setLoading(true);

    try {
      // Vérifie si la partie existe
      const partieRef = ref(database, `parties/${codePartie}`);
      const snapshot = await get(partieRef);

      if (!snapshot.exists()) {
        Alert.alert('Erreur', 'Cette partie n\'existe pas');
        setLoading(false);
        return;
      }

      const partie = snapshot.val();

      if (partie.statut !== 'en_attente') {
        Alert.alert('Erreur', 'Cette partie a déjà commencé');
        setLoading(false);
        return;
      }

      // Ajoute le joueur
      const joueurId = Date.now().toString();
      const joueurRef = ref(database, `parties/${codePartie}/joueurs/${joueurId}`);
      
      await set(joueurRef, {
        nom: nomJoueur.trim(),
        connecte: true,
        joinedAt: Date.now()
      });

      Alert.alert(
        'Succès !', 
        `Tu as rejoint la partie de ${partie.narrateur}`,
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );

    } catch (error) {
      Alert.alert('Erreur', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.titre}>👥 Rejoindre une partie</Text>
      <Text style={styles.description}>
        Entre le code de la partie que le narrateur t'a donné
      </Text>

      <View style={styles.formulaire}>
        <Text style={styles.label}>Code de la partie</Text>
        <TextInput
          style={styles.input}
          placeholder="123456"
          placeholderTextColor="#555"
          value={codePartie}
          onChangeText={setCodePartie}
          keyboardType="number-pad"
          maxLength={6}
        />

        <Text style={styles.label}>Ton nom</Text>
        <TextInput
          style={styles.input}
          placeholder="Pseudo"
          placeholderTextColor="#555"
          value={nomJoueur}
          onChangeText={setNomJoueur}
          maxLength={20}
        />

        <TouchableOpacity 
          style={[styles.boutonRejoindre, loading && styles.boutonDesactive]}
          onPress={rejoindrePartie}
          disabled={loading}
        >
          <Text style={styles.boutonTexte}>
            {loading ? 'Connexion...' : 'Rejoindre la partie 🚀'}
          </Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity 
        style={styles.boutonRetour}
        onPress={() => navigation.goBack()}
      >
        <Text style={styles.boutonRetourTexte}>← Retour</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0e27',
    padding: 20,
  },
  titre: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginTop: 60,
    marginBottom: 20,
  },
  description: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
    marginBottom: 40,
    lineHeight: 24,
  },
  formulaire: {
    backgroundColor: '#1a1f3a',
    borderRadius: 15,
    padding: 25,
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    color: '#888',
    marginBottom: 10,
    marginTop: 15,
  },
  input: {
    backgroundColor: '#0a0e27',
    borderRadius: 10,
    padding: 15,
    fontSize: 18,
    color: '#fff',
    borderWidth: 2,
    borderColor: '#3498db',
  },
  boutonRejoindre: {
    backgroundColor: '#3498db',
    borderRadius: 15,
    padding: 20,
    alignItems: 'center',
    marginTop: 25,
  },
  boutonDesactive: {
    backgroundColor: '#555',
  },
  boutonTexte: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  boutonRetour: {
    padding: 15,
    alignItems: 'center',
  },
  boutonRetourTexte: {
    color: '#888',
    fontSize: 16,
  },
});