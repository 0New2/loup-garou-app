import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

export default function ConfigurationRoles({ route, navigation }) {
  const { codePartie, joueurs } = route.params;

  return (
    <View style={styles.container}>
      <Text style={styles.titre}>🎭 Configuration des rôles</Text>

      <Text style={styles.text}>
        Code de la partie : {codePartie}
      </Text>

      <Text style={styles.text}>
        Nombre de joueurs : {joueurs.length}
      </Text>

      <TouchableOpacity
        style={styles.bouton}
        onPress={() => navigation.goBack()}
      >
        <Text style={styles.boutonTexte}>← Retour</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0e27',
    padding: 20,
    justifyContent: 'center',
  },
  titre: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 20,
  },
  text: {
    color: '#ccc',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 10,
  },
  bouton: {
    marginTop: 30,
    padding: 15,
    backgroundColor: '#3498db',
    borderRadius: 10,
    alignItems: 'center',
  },
  boutonTexte: {
    color: '#fff',
    fontWeight: 'bold',
  },
});
