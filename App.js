import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, Button } from 'react-native';
import { database } from './firebase';
import { ref, set, onValue } from 'firebase/database';
import { useState, useEffect } from 'react';

export default function App() {
  const [compteur, setCompteur] = useState(0);
  const [dernierClic, setDernierClic] = useState('Personne');
  
  // Écoute les changements en temps réel
  useEffect(() => {
    const compteurRef = ref(database, 'test/compteur');
    
    onValue(compteurRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setCompteur(data.nombre || 0);
        setDernierClic(data.qui || 'Personne');
      }
    });
  }, []);
  
  // Fonction pour incrémenter
  const incrementer = () => {
    const compteurRef = ref(database, 'test/compteur');
    const nouveauCompteur = compteur + 1;
    
    set(compteurRef, {
      nombre: nouveauCompteur,
      qui: 'Téléphone ' + Math.floor(Math.random() * 100),
      timestamp: Date.now()
    });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🔥 Test Temps Réel</Text>
      
      <View style={styles.compteurBox}>
        <Text style={styles.compteurLabel}>Compteur</Text>
        <Text style={styles.compteurValeur}>{compteur}</Text>
        <Text style={styles.dernierClic}>Dernier clic: {dernierClic}</Text>
      </View>
      
      <Button 
        title="Cliquer ici 🚀" 
        onPress={incrementer}
      />
      
      <Text style={styles.instruction}>
        👉 Clique sur UN téléphone et regarde l'AUTRE se mettre à jour !
      </Text>
      
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 40,
  },
  compteurBox: {
    backgroundColor: '#16213e',
    padding: 30,
    borderRadius: 20,
    marginBottom: 30,
    alignItems: 'center',
    minWidth: 200,
  },
  compteurLabel: {
    fontSize: 18,
    color: '#888',
    marginBottom: 10,
  },
  compteurValeur: {
    fontSize: 72,
    fontWeight: 'bold',
    color: '#0f4c75',
  },
  dernierClic: {
    fontSize: 14,
    color: '#bbb',
    marginTop: 10,
  },
  instruction: {
    fontSize: 14,
    color: '#bbb',
    textAlign: 'center',
    marginTop: 30,
  },
});