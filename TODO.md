# ✅ TODO - LOUP-GAROU APP

**Dernière mise à jour :** Décembre 2025  
**Sprint actuel :** Semaine 1 - Conception

---

## 🎯 Priorité IMMÉDIATE (À faire maintenant)

### Setup initial du projet
- [ ] Lire le GDD.md en entier
- [ ] Lire la ROADMAP.md en entier
- [ ] Créer un repo GitHub "loup-garou-app"
- [ ] Uploader ces 3 fichiers (GDD, ROADMAP, TODO) sur le repo
- [ ] Décider de la stack technique (voir section "Choix techniques" ci-dessous)

**Temps estimé :** 2h

---

## 📋 SEMAINE 1 : Conception & Setup

### Tâche 1 : Validation du concept
- [ ] Lister les features absolument essentielles pour le MVP
- [ ] Lister les features "nice to have" pour plus tard
- [ ] Valider que le projet est faisable en 8 semaines

### Tâche 2 : Choix de la stack technique
**Options à évaluer :**

#### Option A : React Native + Firebase (RECOMMANDÉ)
**Avantages :**
- Tu connais déjà React/JS
- Une seule codebase pour Android + iOS
- Firebase = temps réel facile
- Beaucoup de tutos disponibles

**Inconvénients :**
- Courbe d'apprentissage moyenne
- Nécessite Node.js

**À faire si choix de cette option :**
- [ ] Installer Node.js (si pas déjà fait)
- [ ] Installer Expo CLI : `npm install -g expo-cli`
- [ ] Créer un compte Firebase
- [ ] Suivre le tuto "React Native + Firebase" (1-2h)

---

#### Option B : Flutter + Firebase
**Avantages :**
- Très performant
- Joli par défaut
- Une codebase Android + iOS

**Inconvénients :**
- Nouveau langage (Dart)
- Plus compliqué si débutant

**À faire si choix de cette option :**
- [ ] Installer Flutter SDK
- [ ] Suivre le tuto officiel Flutter (2-3h)
- [ ] Créer un compte Firebase

---

#### Option C : PWA (Progressive Web App)
**Avantages :**
- Tu connais déjà HTML/CSS/JS
- Pas besoin d'apprendre un framework mobile
- Fonctionne sur tous les devices
- Plus simple techniquement

**Inconvénients :**
- Moins d'intégration native
- Performance légèrement inférieure
- Publication Play Store plus complexe

**À faire si choix de cette option :**
- [ ] Setup d'un projet web classique
- [ ] Ajouter Firebase
- [ ] Tester la PWA sur mobile

---

### Tâche 3 : Wireframes (schémas des écrans)
**Outils possibles :**
- Papier + crayon (le plus rapide)
- Excalidraw (gratuit, simple)
- Figma (plus pro)

**Écrans à dessiner :**
- [ ] Menu principal (Créer / Rejoindre)
- [ ] Écran "Créer une partie" (narrateur)
- [ ] Écran "Rejoindre avec code" (joueur)
- [ ] Lobby / Salle d'attente
- [ ] Écran du narrateur pendant la partie
- [ ] Écran du joueur avec son rôle
- [ ] Écran de vote

**Temps estimé :** 3-4h

---

### Tâche 4 : Base de données - Structure
**À définir :**

#### Collection "parties"
```javascript
{
  id: "ABC123",
  narrateur_id: "user_xyz",
  statut: "en_attente" | "en_cours" | "terminee",
  joueurs: [
    {
      id: "player1",
      nom: "Alice",
      role: "loup",
      vivant: true
    },
    // ...
  ],
  phase: "nuit" | "jour",
  tour: 1,
  historique: []
}
```

**À faire :**
- [ ] Schématiser la structure complète de la BDD
- [ ] Lister tous les champs nécessaires
- [ ] Définir les relations entre les données

**Temps estimé :** 2-3h

---

## 📋 SEMAINE 2 : Setup technique

### Tâche 5 : Installation & Configuration
- [ ] Installer tous les outils nécessaires
- [ ] Créer le projet (React Native / Flutter / Web)
- [ ] Setup Firebase dans le projet
- [ ] Tester la connexion Firebase
- [ ] Créer la structure de dossiers du projet

**Structure de dossiers recommandée :**
```
loup-garou-app/
├── docs/
│   ├── GDD.md
│   ├── ROADMAP.md
│   └── TODO.md
├── src/
│   ├── screens/         # Écrans de l'app
│   ├── components/      # Composants réutilisables
│   ├── services/        # Firebase, API, etc.
│   ├── utils/           # Fonctions utilitaires
│   └── assets/          # Images, sons
├── README.md
└── package.json (ou équivalent)
```

**Temps estimé :** 4-6h

---

### Tâche 6 : Premier écran de test
**Objectif :** Afficher "Hello World" sur ton téléphone

- [ ] Créer un écran basique
- [ ] Lancer l'app sur ton téléphone
- [ ] Modifier le texte et voir le changement en direct
- [ ] Tester un bouton qui fait une action

**Critère de succès :** Tu peux voir l'app tourner sur ton tel et interagir avec

**Temps estimé :** 2-3h

---

### Tâche 7 : Test Firebase
**Objectif :** Envoyer et recevoir des données en temps réel

- [ ] Créer une collection "test" dans Firebase
- [ ] Enregistrer une donnée depuis l'app
- [ ] Afficher cette donnée dans l'app
- [ ] Tester la synchro temps réel (2 appareils)

**Critère de succès :** Ce que tu écris sur un tel apparaît sur l'autre instantanément

**Temps estimé :** 3-4h

---

## 📋 SEMAINE 3 : Développement MVP - Partie 1

### Tâche 8 : Menu principal
- [ ] Créer l'écran d'accueil
- [ ] Bouton "Créer une partie"
- [ ] Bouton "Rejoindre une partie"
- [ ] Bouton "Règles" (optionnel pour MVP)
- [ ] Design basique mais propre

**Temps estimé :** 3-4h

---

### Tâche 9 : Système de code de partie
- [ ] Fonction pour générer un code aléatoire à 6 caractères
- [ ] Vérifier que le code n'existe pas déjà
- [ ] Stocker le code dans Firebase
- [ ] Écran de saisie du code pour rejoindre

**Temps estimé :** 3-4h

---

### Tâche 10 : Lobby / Salle d'attente
- [ ] Créer l'écran du lobby
- [ ] Afficher le code de la partie en grand
- [ ] Liste des joueurs connectés (mise à jour en temps réel)
- [ ] Champ pour entrer son nom
- [ ] Bouton "Lancer la partie" (visible uniquement pour le narrateur)
- [ ] Tester avec 2-3 appareils

**Temps estimé :** 5-6h

---

## 🎯 PROCHAINES ÉTAPES (Semaine 4+)

### À venir :
- Distribution des rôles
- Interface narrateur
- Interface joueur
- Actions de nuit
- Vote de jour
- Conditions de victoire

*Ces tâches seront détaillées une fois les tâches de la semaine 3 terminées*

---

## 📊 Suivi de progression

### Légende
- ⬜ À faire
- 🟡 En cours
- ✅ Terminé
- ❌ Bloqué (préciser pourquoi)

### Stats actuelles
**Progression globale :** 0%  
**Phase actuelle :** Conception  
**Prochaine deadline :** Fin semaine 1

---

## 🐛 Bugs & Problèmes rencontrés

### Template pour ajouter un bug
```
### Bug #X : [Titre court]
**Date :** XX/XX/2025
**Gravité :** Bloquant / Majeur / Mineur
**Description :** 
**Comment reproduire :**
**Solution tentée :**
**Statut :** Ouvert / Résolu
```

*Aucun bug pour le moment (pas encore de code !)*

---

## 💡 Idées & Notes

### Fonctionnalités à ajouter plus tard
- Mode tutoriel pour les nouveaux joueurs
- Personnalisation des avatars
- Thèmes visuels (classique, moderne, horreur)
- Enregistrement audio des discussions
- Replay de partie

### Questions en suspens
- [ ] Combien de joueurs max ? (18 semble un bon max)
- [ ] Durée limite des votes ? (minuteur optionnel)
- [ ] Mode solo pour s'entraîner ?

---

## 🎓 Ressources utiles

### Tutos recommandés
- **React Native + Firebase :** [https://www.youtube.com/watch?v=...](lien à chercher)
- **Flutter pour débutants :** [https://flutter.dev/docs/get-started](https://flutter.dev/docs/get-started)
- **Firebase temps réel :** [https://firebase.google.com/docs/database](https://firebase.google.com/docs/database)

### Communautés
- Reddit : r/reactnative, r/FlutterDev
- Stack Overflow
- Discord des développeurs React Native/Flutter

---

## 📝 Journal de bord

### Format pour chaque session
```
## Session du [DATE]
**Durée :** Xh
**Objectif :** 
**Réalisé :**
- 
**Difficultés :**
- 
**Prochaine session :**
- 
```

---

**Prochain point à faire :** Choisir ta stack technique ! 🚀

*Ce fichier est ton tableau de bord. Mets-le à jour après chaque session de dev.*
