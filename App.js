import 'react-native-gesture-handler';
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';

import MenuPrincipal from './screens/MenuPrincipal';
import EcranTest from './screens/EcranTest';
import CreerPartie from './screens/CreerPartie';
import RejoindrePartie from './screens/RejoindrePartie';


const Stack = createStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Menu" component={MenuPrincipal} />
        <Stack.Screen name="Test" component={EcranTest} />
        <Stack.Screen name="CreerPartie" component={CreerPartie} />
<Stack.Screen name="RejoindrePartie" component={RejoindrePartie} />

      </Stack.Navigator>
    </NavigationContainer>
  );
}
