import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';

// Import des screens
import MenuPrincipal from './screens/MenuPrincipal';
import CreerPartie from './screens/CreerPartie';
import RejoindrePartie from './screens/RejoindrePartie';
import LobbyScreen from './screens/LobbyScreen';
import RoleConfigScreen from './screens/RoleConfigScreen';
import RoleRevealScreen from './screens/RoleRevealScreen';
import GameMasterScreen from './screens/GameMasterScreen';
import PlayerGameScreen from './screens/PlayerGameScreen';

// Import du mode développeur
import { DevModeProvider, useDevMode } from './contexts/DevModeContext';
import DevPanel from './components/DevPanel';

const Stack = createNativeStackNavigator();

// Composant interne qui a accès au contexte DevMode
function AppContent() {
  const navigationRef = useNavigationContainerRef();
  const { setNavigation } = useDevMode();

  // Passer la référence de navigation au contexte Dev
  useEffect(() => {
    if (navigationRef && __DEV__) {
      setNavigation(navigationRef);
    }
  }, [navigationRef, setNavigation]);

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <NavigationContainer ref={navigationRef}>
        <Stack.Navigator
          initialRouteName="Menu"
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: '#0A0A0A' },
            animation: 'slide_from_right',
          }}
        >
          <Stack.Screen
            name="Menu"
            component={MenuPrincipal}
            options={{ title: 'Loup-Garou' }}
          />
          <Stack.Screen
            name="CreerPartie"
            component={CreerPartie}
            options={{ title: 'Créer une partie' }}
          />
          <Stack.Screen
            name="RejoindrePartie"
            component={RejoindrePartie}
            options={{ title: 'Rejoindre une partie' }}
          />
          <Stack.Screen
            name="Lobby"
            component={LobbyScreen}
            options={{ title: 'Lobby' }}
          />
          <Stack.Screen
            name="RoleConfig"
            component={RoleConfigScreen}
            options={{ title: 'Configuration des rôles' }}
          />
          <Stack.Screen
            name="RoleReveal"
            component={RoleRevealScreen}
            options={{
              title: 'Votre rôle',
              animation: 'fade',
              gestureEnabled: false
            }}
          />
          <Stack.Screen
            name="GameMaster"
            component={GameMasterScreen}
            options={{
              title: 'Maître du Jeu',
              gestureEnabled: false
            }}
          />
          <Stack.Screen
            name="PlayerGame"
            component={PlayerGameScreen}
            options={{
              title: 'Partie',
              gestureEnabled: false
            }}
          />
        </Stack.Navigator>
      </NavigationContainer>

      {/* Panneau développeur (visible uniquement en __DEV__) */}
      {__DEV__ && <DevPanel />}
    </View>
  );
}

export default function App() {
  return (
    <DevModeProvider>
      <AppContent />
    </DevModeProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
