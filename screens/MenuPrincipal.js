import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';
import colors from '../constants/colors';
import DevModeToggle from '../components/DevModeToggle';

export default function MenuPrincipal({ navigation }) {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Titre - Triple-tap sur le logo pour ouvrir le mode dev */}
        <View style={styles.titleContainer}>
          <DevModeToggle>
            <Text style={styles.emoji}>🐺</Text>
          </DevModeToggle>
          <Text style={styles.title}>LOUP-GAROU</Text>
          <Text style={styles.subtitle}>Qui est le traître ?</Text>
          {__DEV__ && (
            <Text style={styles.devHint}>Triple-tap sur le loup = Mode Dev</Text>
          )}
        </View>

        {/* Boutons */}
        <View style={styles.buttonsContainer}>
          <TouchableOpacity 
            style={[styles.button, styles.primaryButton]}
            onPress={() => navigation.navigate('CreerPartie')}
            activeOpacity={0.8}
          >
            <Text style={styles.buttonText}>🎮 Créer une partie</Text>
            <Text style={styles.buttonSubtext}>En tant que Maître du jeu</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.button, styles.secondaryButton]}
            onPress={() => navigation.navigate('RejoindrePartie')}
            activeOpacity={0.8}
          >
            <Text style={styles.buttonText}>🚪 Rejoindre une partie</Text>
            <Text style={styles.buttonSubtext}>Entrez le code de la partie</Text>
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Version 1.0.0</Text>
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
    justifyContent: 'space-between',
    padding: 20,
  },
  titleContainer: {
    alignItems: 'center',
    marginTop: 60,
  },
  emoji: {
    fontSize: 80,
    marginBottom: 20,
  },
  title: {
    fontSize: 42,
    fontWeight: 'bold',
    color: colors.textPrimary,
    letterSpacing: 2,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 18,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  devHint: {
    fontSize: 10,
    color: '#FF6B00',
    marginTop: 15,
    opacity: 0.7,
  },
  buttonsContainer: {
    gap: 20,
  },
  button: {
    borderRadius: 15,
    padding: 25,
    alignItems: 'center',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
  },
  primaryButton: {
    backgroundColor: colors.primary,
  },
  secondaryButton: {
    backgroundColor: colors.secondary,
  },
  buttonText: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 5,
  },
  buttonSubtext: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  footer: {
    alignItems: 'center',
    paddingBottom: 20,
  },
  footerText: {
    fontSize: 12,
    color: colors.textDisabled,
  },
});