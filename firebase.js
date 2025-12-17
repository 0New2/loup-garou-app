// Import des fonctions Firebase nécessaires
import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';

// Ta configuration Firebase
const firebaseConfig = {
  apiKey: "AIzaSyDytCWplYhzd0CpSFxWseH4lANSinde-A0",
  authDomain: "app-loup-garou-fdefa.firebaseapp.com",
  databaseURL: "https://app-loup-garou-fdefa-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "app-loup-garou-fdefa",
  storageBucket: "app-loup-garou-fdefa.firebasestorage.app",
  messagingSenderId: "55070535284",
  appId: "1:55070535284:web:94313419181717398a6b21",
  measurementId: "G-YRRV6W8Y3S"
};

// Initialise Firebase
const app = initializeApp(firebaseConfig);

// Initialise la Realtime Database
const database = getDatabase(app);

// Exporte la database pour l'utiliser dans toute l'app
export { database };