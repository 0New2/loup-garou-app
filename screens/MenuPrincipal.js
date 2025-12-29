import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';

export default function MenuPrincipal({ navigation }) {
  return (
    <View style={styles.container}>
      <Text style={styles.titre}>🐺 LOUP-GAROU</Text>

      <TouchableOpacity
        style={styles.bouton}
        onPress={() => navigation.navigate('CreerPartie')}
      >
        <Text style={styles.texteBouton}>Créer une partie</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.bouton}
        onPress={() => navigation.navigate('RejoindrePartie')}
      >
        <Text style={styles.texteBouton}>Rejoindre une partie</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0a0e27',
  },
  titre: {
    fontSize: 32,
    color: '#fff',
    marginBottom: 40,
  },
  bouton: {
    backgroundColor: '#1a1f3a',
    padding: 20,
    borderRadius: 10,
    marginBottom: 20,
    width: 220,
  },
  texteBouton: {
    color: '#fff',
    textAlign: 'center',
    fontSize: 18,
  },
});
