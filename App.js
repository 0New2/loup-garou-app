import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import MenuPrincipal from './screens/MenuPrincipal';
import CreerPartie from './screens/CreerPartie';
import RejoindrePartie from './screens/RejoindrePartie';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen 
          name="MenuPrincipal" 
          component={MenuPrincipal}
          options={{ headerShown: false }}
        />
        <Stack.Screen 
          name="CreerPartie" 
          component={CreerPartie}
          options={{ headerShown: false }}
        />
        <Stack.Screen 
          name="RejoindrePartie" 
          component={RejoindrePartie}
          options={{ headerShown: false }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}