import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';

export default function MenuPrincipal({ navigation }) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.titre}>🐺</Text>
        <Text style={styles.sousTitre}>LOUP-GAROU</Text>
        <Text style={styles.tagline}>Party Game</Text>
      </View>

      <View style={styles.menuContainer}>
        <TouchableOpacity 
          style={[styles.bouton, styles.boutonCreer]}
          onPress={() => navigation.navigate('CreerPartie')}
        >
          <Text style={styles.boutonIcone}>🎮</Text>
          <Text style={styles.boutonTexte}>Créer une partie</Text>
          <Text style={styles.boutonDescription}>En tant que narrateur</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.bouton, styles.boutonRejoindre]}
          onPress={() => navigation.navigate('RejoindrePartie')}
        >
          <Text style={styles.boutonIcone}>👥</Text>
          <Text style={styles.boutonTexte}>Rejoindre une partie</Text>
          <Text style={styles.boutonDescription}>Avec un code</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.version}>Version 0.1 - Dev</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0e27',
    padding: 20,
  },
  header: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 60,
  },
  titre: {
    fontSize: 80,
    marginBottom: 10,
  },
  sousTitre: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#fff',
    letterSpacing: 4,
    marginBottom: 5,
  },
  tagline: {
    fontSize: 16,
    color: '#888',
    letterSpacing: 2,
  },
menuContainer: {
  flex: 2,
  justifyContent: 'center',
},
bouton: {
  backgroundColor: '#1a1f3a',
  borderRadius: 15,
  padding: 25,
  alignItems: 'center',
  borderWidth: 2,
  marginBottom: 20,
},
  boutonCreer: {
    borderColor: '#e74c3c',
  },
  boutonRejoindre: {
    borderColor: '#3498db',
  },
  boutonIcone: {
    fontSize: 40,
    marginBottom: 10,
  },
  boutonTexte: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5,
  },
  boutonDescription: {
    fontSize: 14,
    color: '#888',
  },
  version: {
    textAlign: 'center',
    color: '#444',
    fontSize: 12,
    marginTop: 20,
  },
});