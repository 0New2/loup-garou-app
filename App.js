import React from 'react';
import { View, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';

// Import des screens
import MenuPrincipal from './screens/MenuPrincipal';
import CreerPartie from './screens/CreerPartie';
import RejoindrePartie from './screens/RejoindrePartie';
import LobbyScreen from './screens/LobbyScreen';

// Import du mode développeur
import { DevModeProvider } from './contexts/DevModeContext';
import DevPanel from './components/DevPanel';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <DevModeProvider>
      <View style={styles.container}>
        <StatusBar style="light" />
        <NavigationContainer>
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
          </Stack.Navigator>
        </NavigationContainer>

        {/* Panneau développeur (visible uniquement en __DEV__) */}
        {__DEV__ && <DevPanel />}
      </View>
    </DevModeProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
