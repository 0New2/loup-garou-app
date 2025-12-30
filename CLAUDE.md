# 🐺 LOUP-GAROU APP - DOCUMENTATION COMPLÈTE

## 📋 ÉTAT ACTUEL DU PROJET

**Structure existante :**
```
/loup-garou-app
├── node_modules/
├── screens/
│   ├── MenuPrincipal.js ✅ (FAIT)
│   ├── CreerPartie.js ✅ (FAIT)
│   └── RejoindrePartie.js ✅ (FAIT)
├── constants/
│   └── colors.js ✅ (FAIT)
├── utils/
│   ├── roles.js ✅ (FAIT)
│   ├── generateCode.js ✅ (FAIT)
│   └── gameLogic.js ✅ (FAIT - structure de base)
├── .gitignore
├── App.js ✅ (FAIT)
├── app.json
├── firebase.js ✅ (FAIT)
├── index.js
├── package.json
├── package-lock.json
├── GDD.md (documents de conception)
├── ROADMAP.md
└── TODO.md
```

**Ce qui fonctionne déjà :**
- ✅ Navigation React Navigation configurée
- ✅ Firebase Realtime Database connecté
- ✅ Écran menu principal avec design
- ✅ Création de partie avec génération de code
- ✅ Rejoindre une partie avec validation
- ✅ Système de couleurs et thème sombre
- ✅ Définition des 7 rôles de base
- ✅ Fonctions utilitaires (codes, logique)

**Ce qu'il reste à faire :**
- ❌ Écran Lobby (attente des joueurs)
- ❌ Configuration des rôles par le MJ
- ❌ Distribution des rôles
- ❌ Écran révélation du rôle
- ❌ Interface Maître du Jeu
- ❌ Interface Joueur pendant la partie
- ❌ Gestion des phases (nuit, jour, vote)
- ❌ Timer fonctionnel
- ❌ Actions des rôles spéciaux
- ❌ Système de vote
- ❌ Écran de fin de partie
- ❌ Tests et optimisation

---

## 🎯 OBJECTIF DU PROJET

Application mobile Loup-Garou multijoueur temps réel pour iOS et Android. Le maître du jeu contrôle la partie depuis son téléphone, les joueurs participent depuis le leur. Tout est synchronisé via Firebase.

**Public cible :** Groupes d'amis qui jouent au Loup-Garou en personne
**USP :** Interface MJ ultra-intuitive + contrôle total du rythme

---

## 🏗️ ARCHITECTURE FIREBASE

### Structure Realtime Database

```
/games
  /{gameCode}
    /config
      - maxPlayers: 15
      - createdAt: timestamp
      - status: "lobby" | "playing" | "finished"
      - masterPlayerId: string
    
    /players
      /{playerId}
        - name: string
        - role: string | null
        - isAlive: boolean
        - isMaster: boolean
        - joinedAt: timestamp
        - hasUsedLifePotion: boolean (pour sorcière)
        - hasUsedDeathPotion: boolean (pour sorcière)
    
    /gameState
      - currentPhase: string
      - nightCount: number
      - timer: number
      - timerActive: boolean
      - lastPhaseChange: timestamp
    
    /actions
      /night-{nightCount}
        - werewolfTarget: playerId | null
        - voyanteSaw: playerId | null
        - sorciereLifeUsed: boolean
        - sorciereDeathUsed: boolean
        - sorciereTargetLife: playerId | null
        - sorciereTargetDeath: playerId | null
    
    /votes
      /{playerId}: votedForPlayerId
    
    /lovers (si Cupidon)
      - player1: playerId
      - player2: playerId
```

---

## 📱 SCREENS À CRÉER

### 1. LobbyScreen.js
**Fonctionnalités :**
- Affiche le code de la partie en gros
- Liste temps réel des joueurs connectés
- Pour le MJ : bouton "Configurer les rôles" puis "Lancer la partie"
- Pour les joueurs : écran d'attente "En attente du MJ..."
- Indicateur du nombre de joueurs (X/15)

**Firebase listeners :**
- `games/{gameCode}/players` pour la liste
- `games/{gameCode}/config/status` pour le lancement

### 2. RoleConfigScreen.js (MJ uniquement)
**Fonctionnalités :**
- Affiche les joueurs
- Liste des rôles disponibles avec compteurs +/-
- Suggestion automatique basée sur le nombre de joueurs
- Validation : nombre de rôles = nombre de joueurs
- Bouton "Distribuer les rôles"

### 3. RoleRevealScreen.js
**Fonctionnalités :**
- Animation de révélation du rôle
- Affiche : icône, nom du rôle, description, pouvoir
- Bouton "J'ai compris" qui mène vers l'interface de jeu
- Écran noir avec "Touchez pour révéler votre rôle" en premier

### 4. GameMasterScreen.js
**Interface du MJ avec :**
- Liste de tous les joueurs avec leurs rôles (en couleur)
- Indicateur de phase actuelle (gros et visible)
- Bouton "Phase suivante" (principal)
- Contrôles timer : durée (30s/1min/2min/5min/∞) + Start/Pause/Reset
- Log des actions de la nuit
- Indicateur joueurs vivants/morts
- Bouton "Terminer la partie"

**Vue spéciale par phase :**
- Nuit des loups : qui ils ont choisi
- Voyante : qui elle a vu + résultat
- Sorcière : potions utilisées + cibles
- Vote : décompte des votes en temps réel

### 5. PlayerGameScreen.js
**Écran principal du joueur avec états conditionnels :**

**État 1 : Nuit (inactif)**
- Écran totalement noir
- Texte "Dormez... 😴" centré
- Éventuellement son de loup au loin

**État 2 : Nuit (actif - ton tour)**
- Interface selon le rôle :
  - **Loup** : Liste des non-loups vivants → sélectionner victime
  - **Voyante** : Liste joueurs vivants → sélectionner pour voir rôle
  - **Sorcière** : Notification "X a été attaqué" + choix potions
  - **Cupidon** : (première nuit) Sélectionner 2 joueurs
  - **Petite Fille** : Possibilité d'espionner (toggle "Espionner")

**État 3 : Jour (discussion)**
- Timer visible en haut
- Phase actuelle affichée
- Liste des joueurs vivants (en cartes)
- Indicateur "En attente de la phase suivante..."

**État 4 : Vote**
- Liste des joueurs vivants
- Tap pour voter
- Confirmation du vote
- Indicateur "Vous avez voté pour X"

### 6. VoteScreen.js (peut être intégré à PlayerGameScreen)
**Fonctionnalités :**
- Liste des joueurs vivants
- Radio buttons ou cartes sélectionnables
- Bouton "Confirmer le vote"
- Impossible de changer après confirmation
- Timer visible

### 7. EndGameScreen.js
**Fonctionnalités :**
- Annonce du gagnant (Village ou Loups)
- Liste complète : tous les joueurs + leurs rôles révélés
- Statistiques : nombre de nuits, joueurs éliminés par phase
- Bouton "Nouvelle partie" (retour au menu)
- Bouton "Rejouer avec les mêmes joueurs" (réutilise les noms)

---

## 🎮 FLOW DE JEU COMPLET

### Phase Lobby
1. MJ crée la partie → obtient code
2. Joueurs rejoignent avec le code
3. MJ voit la liste se remplir en temps réel
4. Quand prêt : MJ → "Configurer les rôles"
5. MJ distribue les rôles → "Lancer la partie"
6. Tous les joueurs passent à RoleRevealScreen

### Phase Révélation
1. Chaque joueur voit écran noir "Touchez pour révéler"
2. Touch → Animation → Affiche son rôle
3. "J'ai compris" → Vers PlayerGameScreen ou GameMasterScreen

### Phase Jeu - Boucle principale

**NUIT 1 (si Cupidon présent) :**
1. MJ : "Phase Cupidon" → Next
2. Cupidon se réveille, choisit 2 joueurs → Confirme
3. MJ voit le couple formé

**NUIT - Loups :**
1. MJ : "Phase Nuit - Loups" → Start timer
2. Loups voient liste, discutent, sélectionnent victime
3. MJ voit leur choix en temps réel
4. MJ : "Phase suivante"

**NUIT - Voyante :**
1. MJ : "Phase Voyante" → Start timer
2. Voyante sélectionne un joueur
3. Modal s'affiche avec le rôle
4. Voyante : "OK"
5. MJ : "Phase suivante"

**NUIT - Sorcière :**
1. MJ : "Phase Sorcière" → Start timer
2. Sorcière voit notification : "X a été attaqué"
3. Choix : Potion de vie (sauver X) | Potion de mort (tuer Y) | Rien
4. Validation
5. MJ : "Phase suivante"

**JOUR - Discussion :**
1. MJ : "Phase Jour" → Set timer (ex: 2min) → Start
2. Tous les joueurs voient l'annonce : "X est mort cette nuit" (si applicable)
3. Écran de discussion (pas d'action)
4. Timer s'écoule ou MJ skip
5. MJ : "Phase Vote"

**JOUR - Vote :**
1. MJ : "Phase Vote" → Start timer
2. Tous les joueurs vivants sélectionnent quelqu'un
3. MJ voit le décompte en temps réel
4. Timer finit ou MJ : "Terminer le vote"
5. Résolution : joueur le plus voté est éliminé
6. Annonce : "X a été éliminé par le village"

**Vérification victoire :**
- Après chaque élimination, checkWinCondition()
- Si condition remplie → EndGameScreen
- Sinon → Retour à "NUIT - Loups"

### Phase Fin
1. Affichage EndGameScreen pour tous
2. Annonce gagnant + liste complète des rôles
3. Options : Nouvelle partie ou Rejouer

---

## 🔧 FONCTIONS IMPORTANTES (gameLogic.js)

Ces fonctions sont déjà dans gameLogic.js mais à enrichir :

```javascript
// DÉJÀ IMPLÉMENTÉ :
- assignRoles(gameCode, players, roleConfig)
- checkWinCondition(players)
- eliminatePlayer(gameCode, playerId, reason)
- nextPhase(gameCode, currentPhase)
- resolveNightActions(gameCode, actions)
- resolveVote(gameCode, votes)
- toggleTimer(gameCode)
- resetTimer(gameCode, duration)

// À AJOUTER :
- startGame(gameCode) → Change status à "playing"
- endGame(gameCode) → Change status à "finished"
- handleChasseurDeath(gameCode, chasseurId) → Active choix cible
- handleLoversEffect(gameCode, deadPlayerId) → Tue l'autre amoureux
- getAlivePlayersByRole(gameCode, roleId) → Filtre joueurs
- canPlayerAct(gameCode, playerId, currentPhase) → Vérifie si le joueur peut agir
```

---

## 🎨 DESIGN GUIDELINES

**Palette :**
- Fond noir (#0A0A0A)
- Cartes gris foncé (#252525)
- Rouge sang pour loups (#8B0000)
- Bleu pour village (#1E3A8A)
- Or pour rôles spéciaux (#FFD700)

**Typography :**
- Titres : Bold, 28-42px
- Corps : Regular, 16-18px
- Infos secondaires : 14px, gris clair

**Composants réutilisables à créer :**
- `PlayerCard` : Carte joueur avec nom, statut (vivant/mort), rôle (si visible)
- `PhaseIndicator` : Bannière indiquant la phase actuelle
- `Timer` : Composant timer avec compte à rebours circulaire
- `RoleIcon` : Affichage emoji + couleur selon rôle
- `ActionButton` : Gros bouton tactile pour actions principales

**Animations :**
- Transitions entre screens : slide
- Révélation du rôle : fade in + scale
- Éliminations : fade out + shake
- Timer : pulsation quand < 10s

---

## 🚀 PLAN D'IMPLÉMENTATION POUR CLAUDE CODE

### PRIORITÉ 1 : Lobby & Configuration
**Fichiers à créer :**
- `screens/LobbyScreen.js`
- `screens/RoleConfigScreen.js`
- `components/PlayerCard.js`

**Fonctionnalités :**
- Listeners Firebase pour liste joueurs temps réel
- Interface configuration rôles pour MJ
- Appel à assignRoles() au lancement
- Navigation vers RoleRevealScreen après distribution

### PRIORITÉ 2 : Révélation & Interfaces de base
**Fichiers à créer :**
- `screens/RoleRevealScreen.js`
- `screens/GameMasterScreen.js` (version 1)
- `screens/PlayerGameScreen.js` (version 1)
- `components/PhaseIndicator.js`
- `components/Timer.js`

**Fonctionnalités :**
- Animation révélation rôle
- Interface MJ basique (liste joueurs + phase + bouton next)
- Interface joueur basique (affichage phase + état attente)

### PRIORITÉ 3 : Game Loop - Nuit
**À implémenter :**
- Logique phases nocturnes dans gameLogic.js
- Actions Loups (sélection victime)
- Action Voyante (voir rôle)
- Action Sorcière (potions)
- Résolution nuit dans resolveNightActions()

**Composants :**
- `components/RoleAction.js` (interface action selon rôle)

### PRIORITÉ 4 : Game Loop - Jour
**À implémenter :**
- Phase discussion (passive)
- Phase vote (sélection + validation)
- Résolution vote dans resolveVote()
- Annonces éliminations
- Vérification conditions victoire

**Composants :**
- `components/VoteInterface.js`

### PRIORITÉ 5 : Rôles spéciaux
**À implémenter :**
- Cupidon (première nuit)
- Chasseur (trigger à sa mort)
- Petite Fille (espionnage)
- Gestion couples amoureux

### PRIORITÉ 6 : Timer & UX avancée
**À implémenter :**
- Timer fonctionnel avec compte à rebours
- Synchronisation timer entre tous les devices
- Contrôles MJ : start/pause/reset/adjust
- Animations timer (warning < 10s)

### PRIORITÉ 7 : Fin de partie
**Fichiers à créer :**
- `screens/EndGameScreen.js`

**Fonctionnalités :**
- Détection victoire après chaque élimination
- Affichage statistiques
- Boutons nouvelle partie / rejouer

### PRIORITÉ 8 : Polish
**À améliorer :**
- Sons/vibrations (optionnel)
- Animations transitions
- Gestion erreurs réseau
- Messages d'erreur explicites
- Loading states partout
- Optimisation performances

---

## ⚠️ POINTS D'ATTENTION

### Sécurité Firebase
- Validation côté serveur avec Rules :
  - Seul le MJ peut changer la phase
  - Les joueurs ne peuvent voter qu'une fois
  - Les actions doivent correspondre au rôle du joueur

### Gestion des erreurs
- Perte de connexion : afficher modal "Reconnexion..."
- Partie supprimée : retour au menu avec message
- MJ déconnecté : désigner nouveau MJ ou terminer partie

### Performance
- Utiliser `onValue` avec précaution (seulement sur les données nécessaires)
- Cleanup des listeners dans useEffect
- Éviter re-renders inutiles (React.memo, useMemo)

### Edge cases
- Joueur rejoint pendant la partie → refuser
- MJ quitte → transférer à un autre joueur ou fin partie
- Égalité au vote → revote ou décision MJ
- Chasseur mort vote en cours → retirer son vote

---

## 📝 PROMPT OPTIMAL POUR CLAUDE CODE

```
Je développe une application Loup-Garou avec Expo + Firebase Realtime Database.

CONTEXTE :
- Projet existant avec structure de base (voir CLAUDE.md)
- Firebase configuré et fonctionnel
- Navigation React Navigation OK
- Screens de base créés (Menu, Créer, Rejoindre)
- Utils et constants en place

OBJECTIF :
Implémenter les écrans et la logique de jeu manquants selon le plan détaillé dans CLAUDE.md.

PROCHAINE ÉTAPE : [PRIORITÉ X]
[Décrire la priorité spécifique que tu veux implémenter]

INSTRUCTIONS :
1. Lis CLAUDE.md pour comprendre l'architecture complète
2. Crée TOUS les fichiers nécessaires pour cette priorité
3. Implémente la logique Firebase avec listeners temps réel
4. Assure-toi que tout est fonctionnel et testé
5. Suit les design guidelines (thème sombre, composants réutilisables)
6. Ajoute des commentaires pour les parties complexes

CODE REQUIREMENTS :
- Utilise les couleurs de constants/colors.js
- Utilise les rôles de utils/roles.js
- Utilise les fonctions de utils/gameLogic.js
- Style cohérent avec les screens existants
- Gestion d'erreurs robuste

Commence par créer les fichiers et implémente la fonctionnalité complète.
```

---

## ✅ CHECKLIST AVANT PUBLICATION

- [ ] Toutes les phases de jeu fonctionnent
- [ ] Pas de crash avec 2-15 joueurs
- [ ] Timer synchronisé entre devices
- [ ] Tous les rôles fonctionnent correctement
- [ ] Conditions victoire validées
- [ ] UI responsive sur petits/grands écrans
- [ ] Gestion déconnexion
- [ ] Firebase Rules configurées
- [ ] Tests sur Android
- [ ] Tests sur iOS
- [ ] Icon et splash screen créés
- [ ] app.json configuré (nom, version, permissions)
- [ ] Build APK/AAB généré
- [ ] Compte Apple Developer OK (pour iOS)

---

**Bon courage pour la suite du développement ! 🐺🎮**