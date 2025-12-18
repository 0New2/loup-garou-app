import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';

import MenuPrincipal from './src/screens/MenuPrincipal';
import CreerPartie from './src/screens/CreerPartie';
import RejoindrePartie from './src/screens/RejoindrePartie';
import ConfigurationRoles from './src/screens/ConfigurationRoles';

const Stack = createStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="MenuPrincipal" component={MenuPrincipal} />
        <Stack.Screen name="CreerPartie" component={CreerPartie} />
        <Stack.Screen name="RejoindrePartie" component={RejoindrePartie} />
        <Stack.Screen name="ConfigurationRoles" component={ConfigurationRoles} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
