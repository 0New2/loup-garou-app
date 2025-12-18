import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, FlatList } from 'react-native';
import { database } from '../firebase';
import { ref, set, onValue } from 'firebase/database';

export default function CreerPartie({ navigation }) {
  const [codePartie, setCodePartie] = useState('');
  const [joueurs, setJoueurs] = useState([]);
  const [partieCreee, setPartieCreee] = useState(false);

  // Génère un code à 6 chiffres
  const genererCode = () => {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    return code;
  };

  // Crée la partie dans Firebase
  const creerPartie = () => {
    const code = genererCode();
    const partieRef = ref(database, `parties/${code}`);
    
    const nouvellePartie = {
      code: code,
      statut: 'en_attente',
      narrateur: 'Narrateur',
      joueurs: {},
      createdAt: Date.now()
    };

    set(partieRef, nouvellePartie)
      .then(() => {
        setCodePartie(code);
        setPartieCreee(true);
        // Écoute les joueurs qui rejoignent
        ecouterJoueurs(code);
      })
      .catch((error) => {
        alert('Erreur: ' + error.message);
      });
  };

  // Écoute les nouveaux joueurs en temps réel
  const ecouterJoueurs = (code) => {
    const joueursRef = ref(database, `parties/${code}/joueurs`);
    
    onValue(joueursRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const listeJoueurs = Object.keys(data).map(key => ({
          id: key,
          ...data[key]
        }));
        setJoueurs(listeJoueurs);
      }
    });
  };

  const ajouterBotTest = () => {
  const botId = Date.now().toString();
  const botRef = ref(database, `parties/${codePartie}/joueurs/${botId}`);
  set(botRef, {
    nom: `Bot ${Math.floor(Math.random() * 100)}`,
    connecte: true,
    joinedAt: Date.now()
  });
};

  // Lancer la partie
  const lancerPartie = () => {
  if (joueurs.length < 1) {
    alert('Il faut au moins 4 joueurs !');
    return;
  }
  navigation.navigate('ConfigurationRoles', { codePartie, joueurs });
};

  if (!partieCreee) {
    return (
      <View style={styles.container}>
        <Text style={styles.titre}>🎮 Créer une partie</Text>
        <Text style={styles.description}>
          En tant que narrateur, vous allez créer une nouvelle partie et obtenir un code à partager avec les joueurs.
        </Text>

        <TouchableOpacity 
          style={styles.boutonCreer}
          onPress={creerPartie}
        >
          <Text style={styles.boutonTexte}>Générer le code de partie</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.boutonRetour}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.boutonRetourTexte}>← Retour</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.titre}>🎮 Partie créée !</Text>
      
      <View style={styles.codeContainer}>
        <Text style={styles.codeLabel}>Code de la partie</Text>
        <Text style={styles.codeTexte}>{codePartie}</Text>
        <Text style={styles.codeInstruction}>
          📱 Les joueurs doivent entrer ce code pour rejoindre
        </Text>
      </View>

      <View style={styles.joueursContainer}>
        <Text style={styles.joueursTitle}>
          👥 Joueurs connectés ({joueurs.length})
        </Text>
        
        {joueurs.length === 0 ? (
          <Text style={styles.enAttente}>En attente de joueurs...</Text>
        ) : (
          <FlatList
            data={joueurs}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <View style={styles.joueurItem}>
                <Text style={styles.joueurNom}>👤 {item.nom}</Text>
                <Text style={styles.joueurStatut}>✓ Connecté</Text>
              </View>
            )}
          />
        )}
      </View>

      <TouchableOpacity 
  style={styles.boutonTest}
  onPress={ajouterBotTest}
>
  <Text style={styles.boutonTexte}>+ Ajouter bot de test</Text>
</TouchableOpacity>

      <TouchableOpacity 
        style={[
          styles.boutonLancer,
          joueurs.length < 1 && styles.boutonDesactive
        ]}
        onPress={lancerPartie}
        disabled={joueurs.length < 1}
      >
        <Text style={styles.boutonTexte}>
          {joueurs.length < 1 
            ? `Attendre des joueurs (min. 1)` 
            : `Lancer la partie avec ${joueurs.length} joueurs`}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0e27',
    padding: 20,
  },
  titre: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginTop: 60,
    marginBottom: 20,
  },
  description: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
    marginBottom: 40,
    lineHeight: 24,
  },
  boutonCreer: {
    backgroundColor: '#e74c3c',
    borderRadius: 15,
    padding: 20,
    alignItems: 'center',
    marginBottom: 20,
  },
  boutonRetour: {
    padding: 15,
    alignItems: 'center',
  },
  boutonRetourTexte: {
    color: '#888',
    fontSize: 16,
  },
  codeContainer: {
    backgroundColor: '#1a1f3a',
    borderRadius: 15,
    padding: 30,
    alignItems: 'center',
    marginBottom: 30,
    borderWidth: 2,
    borderColor: '#e74c3c',
  },
  codeLabel: {
    fontSize: 14,
    color: '#888',
    marginBottom: 10,
  },
  codeTexte: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#fff',
    letterSpacing: 8,
    marginBottom: 15,
  },
  codeInstruction: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
  },
  joueursContainer: {
    flex: 1,
    backgroundColor: '#1a1f3a',
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
  },
  joueursTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 15,
  },
  enAttente: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
    marginTop: 40,
  },
  joueurItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0a0e27',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
  },
  joueurNom: {
    fontSize: 16,
    color: '#fff',
    fontWeight: 'bold',
  },
  joueurStatut: {
    fontSize: 14,
    color: '#2ecc71',
  },
  boutonTest: {
  backgroundColor: '#9b59b6',
  padding: 15,
  borderRadius: 10,
  marginBottom: 10,
},
  boutonLancer: {
    backgroundColor: '#2ecc71',
    borderRadius: 15,
    padding: 20,
    alignItems: 'center',
  },
  boutonDesactive: {
    backgroundColor: '#555',
  },
  boutonTexte: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
});