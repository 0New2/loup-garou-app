# 🐺 LOUP-GAROU APP - Game Design Document

**Version :** 1.0  
**Date :** Décembre 2025  
**Auteur :** Coco / INNOVART

---

## 📋 Vue d'ensemble

### Concept
Application mobile pour jouer au Loup-Garou de Thiercelieux avec un système narrateur/joueurs synchronisé en temps réel.

### Objectif principal
Permettre à un groupe de joueurs de jouer au Loup-Garou sans cartes physiques, avec un narrateur qui contrôle le déroulement via l'appli.

### Public cible
- Joueurs de Loup-Garou (8-18 joueurs typiquement)
- Soirées entre amis, événements, animations
- Âge : 10 ans et +

---

## 🎮 Gameplay

### Rôles du système

#### 1. NARRATEUR (Maître du jeu)
**Responsabilités :**
- Créer la partie et définir les paramètres
- Distribuer les rôles secrètement
- Gérer les phases (nuit/jour)
- Annoncer les événements
- Valider les actions des joueurs
- Révéler les morts et victoires

**Interface spécifique :**
- Dashboard de contrôle complet
- Vue de tous les rôles (cachée aux joueurs)
- Boutons de contrôle des phases
- Historique des actions

#### 2. JOUEURS
**Interaction :**
- Rejoindre une partie via code
- Recevoir leur rôle (secret)
- Effectuer leurs actions selon leur rôle
- Voter pendant les phases de jour
- Voir l'historique de la partie

---

## 👥 Rôles de jeu

### VERSION MVP (Phase 1 - Rôles de base)

#### Villageois simples
- **Nombre :** Variable
- **Pouvoir :** Aucun
- **Objectif :** Éliminer tous les Loups-Garous
- **Action :** Vote le jour uniquement

#### Loup-Garou
- **Nombre :** 2-4 selon nombre de joueurs
- **Pouvoir :** Dévore un villageois chaque nuit
- **Objectif :** Éliminer tous les villageois
- **Action :** Vote collectif la nuit + vote le jour

#### Voyante
- **Nombre :** 1
- **Pouvoir :** Découvre la vraie nature d'un joueur chaque nuit
- **Objectif :** Aider les villageois
- **Action :** Choisit un joueur à espionner chaque nuit

#### Chasseur
- **Nombre :** 1
- **Pouvoir :** Tire sur quelqu'un en mourant
- **Objectif :** Éliminer les Loups-Garous
- **Action :** Désigne une cible à sa mort

### VERSION COMPLÈTE (Phase 2 - Tous les rôles)

#### Sorcière
- **Nombre :** 1
- **Pouvoirs :** 
  - Potion de vie (1 usage) : ressuscite la victime des loups
  - Potion de mort (1 usage) : tue un joueur
- **Objectif :** Aider les villageois

#### Cupidon
- **Nombre :** 1
- **Pouvoir :** Désigne 2 amoureux au premier tour
- **Spécial :** Si un amoureux meurt, l'autre meurt aussi

#### Petite Fille
- **Nombre :** 1
- **Pouvoir :** Peut espionner les loups la nuit (risque d'être découverte)

#### Salvateur
- **Nombre :** 1
- **Pouvoir :** Protège quelqu'un chaque nuit (pas 2 fois de suite la même personne)

#### Capitaine
- **Rôle additionnel :** Peut se cumuler avec un autre rôle
- **Pouvoir :** Voix compte double lors des votes
- **Transmission :** Désigne son successeur à sa mort

#### Corbeau
- **Nombre :** 1
- **Pouvoir :** Ajoute 2 voix contre un joueur lors du vote du jour

#### Voleur
- **Nombre :** 1
- **Pouvoir :** Choisit son rôle parmi 2 cartes au début
- **Spécial :** Les 2 cartes peuvent être loup-garou

---

## 🌙 Déroulement d'une partie

### Phase de setup
1. Le narrateur crée la partie
2. Définit le nombre de joueurs et la composition des rôles
3. Génère un code de partie
4. Les joueurs rejoignent via le code
5. Distribution automatique des rôles (secret)

### Cycle de jeu : NUIT → JOUR → NUIT → JOUR...

#### 🌙 PHASE DE NUIT
**Ordre des réveils (géré par le narrateur) :**

1. **Cupidon** (premier tour uniquement)
   - Désigne 2 amoureux
   
2. **Voleur** (premier tour uniquement)
   - Choisit sa carte

3. **Voyante**
   - Sélectionne un joueur
   - Reçoit sa vraie identité

4. **Loups-Garous**
   - Votent pour désigner une victime
   - Chat privé entre loups

5. **Sorcière**
   - Voit qui a été tué
   - Décide d'utiliser potion de vie et/ou mort

6. **Salvateur**
   - Protège un joueur

#### ☀️ PHASE DE JOUR
1. **Réveil du village**
   - Annonce des morts de la nuit
   - Dernières paroles éventuelles (Chasseur)

2. **Débat**
   - Discussion libre entre joueurs (pas géré par l'appli)
   
3. **Vote**
   - Chaque joueur vote pour éliminer quelqu'un
   - Capitaine compte double
   - Corbeau ajoute ses voix secrètement

4. **Élimination**
   - Le joueur le plus voté est éliminé
   - Révélation de son rôle

5. **Chasseur** (si tué)
   - Tire sur quelqu'un

### Conditions de victoire

#### Villageois gagnent si :
- Tous les Loups-Garous sont éliminés

#### Loups-Garous gagnent si :
- Nombre de loups ≥ nombre de villageois

#### Amoureux gagnent si :
- 1 loup + 1 villageois amoureux
- Ils sont les 2 derniers survivants

---

## 📱 Fonctionnalités de l'application

### Écrans principaux

#### MENU PRINCIPAL
- Créer une partie (Narrateur)
- Rejoindre une partie (Joueur)
- Règles du jeu
- Paramètres

#### LOBBY (Salle d'attente)
- Liste des joueurs connectés
- Code de la partie affiché
- Bouton "Lancer la partie" (narrateur uniquement)

#### ÉCRAN NARRATEUR
- Dashboard avec tous les rôles visibles
- Contrôle des phases (boutons Nuit/Jour)
- Validation des actions
- Historique temps réel
- Annonces à faire aux joueurs

#### ÉCRAN JOUEUR
- Rôle personnel (secret)
- Description des pouvoirs
- Actions disponibles selon la phase
- Vote
- Historique visible (morts, événements)
- Statut (vivant/mort)

#### ÉCRAN DE FIN
- Équipe gagnante
- Révélation de tous les rôles
- Statistiques (durée, nombre de tours, etc.)
- Rejouer / Quitter

---

## 🎨 Ambiance & Design

### Style visuel
- Thème sombre/nuit (bleu nuit, noir)
- Accents oranges/rouges pour les loups
- Bleu/blanc pour les villageois
- Icônes stylisées pour chaque rôle

### Sons & Ambiance
- Musique d'ambiance médiévale/mystérieuse
- Son de loup (phase de nuit)
- Son de cloche (phase de jour)
- Son de mort
- Vibreur pour les actions

### UX
- Simple et intuitif
- Notifications push pour les actions requises
- Animations fluides
- Feedback visuel clair

---

## 🔧 Aspects techniques

### Fonctionnalités réseau
- **Synchronisation temps réel** : tous les joueurs voient les changements instantanément
- **Gestion de salon** : code unique de 6 caractères
- **Reconnexion** : si un joueur perd la connexion, il peut revenir
- **Sécurité** : les rôles sont chiffrés côté client

### Performances
- Support de 8 à 18 joueurs simultanés
- Latence max acceptable : 500ms
- Fonctionnement offline pour le narrateur (mode solo)

---

## 📈 Évolution future (post-lancement)

### Version 2.0
- Nouveaux rôles (Loup blanc, Enfant sauvage, etc.)
- Modes de jeu alternatifs
- Système de réputation/stats joueurs
- Chat vocal intégré
- Parties classées/ranked

### Monétisation potentielle
- Version gratuite : rôles de base
- Version premium : tous les rôles + thèmes
- Pas de pub intrusive

---

## 📝 Notes de conception

### Points d'attention
- **Équilibrage** : composition des rôles doit être équilibrée selon le nombre de joueurs
- **Clarté** : interface doit être lisible même de loin (parties en soirée)
- **Fiabilité** : aucun bug acceptable qui révélerait un rôle par erreur
- **Accessibilité** : mode daltonien, taille de texte ajustable

### Challenges techniques
- Synchronisation temps réel fiable
- Gestion des déconnexions
- Secret des rôles garanti
- Latence minimale pour les votes

---

**FIN DU GDD v1.0**

*Document vivant à mettre à jour au fur et à mesure du développement*
