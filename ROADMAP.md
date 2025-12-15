# 🗺️ ROADMAP - LOUP-GAROU APP

**Durée estimée :** 8 semaines (2 mois)  
**Date de début :** Décembre 2025  
**Objectif :** Application fonctionnelle prête pour le Play Store

---

## 📅 Planning général

```
PHASE 1: Conception        ██████░░░░░░░░░░░░░░░░░░░░░░  (Sem. 1-2)
PHASE 2: MVP               ░░░░░░██████████████░░░░░░░░  (Sem. 3-6)
PHASE 3: Features avancées ░░░░░░░░░░░░░░░░░░████░░░░░░  (Sem. 7)
PHASE 4: Polish & Tests    ░░░░░░░░░░░░░░░░░░░░░░████░░  (Sem. 8)
```

---

## 🎯 PHASE 1 : Conception & Setup (Semaine 1-2)

### Semaine 1 : Spécifications
**Objectifs :**
- ✅ Finaliser le GDD
- ✅ Choisir la stack technique
- ✅ Créer les wireframes des écrans principaux
- ✅ Setup de l'environnement de développement

**Livrables :**
- [ ] GDD.md complété et validé
- [ ] Schéma de base de données
- [ ] Wireframes (papier ou Figma)
- [ ] Repo GitHub créé
- [ ] Environnement de dev installé

**Temps estimé :** 10-12h

---

### Semaine 2 : Architecture & Design
**Objectifs :**
- Setup du backend (Firebase ou équivalent)
- Structure du projet frontend
- Design system de base (couleurs, typo, composants)
- Premier écran de test

**Livrables :**
- [ ] Backend initialisé et testé
- [ ] Structure de dossiers créée
- [ ] Palette de couleurs définie
- [ ] Écran "Hello World" qui marche sur mobile

**Temps estimé :** 10-12h

---

## 🚀 PHASE 2 : MVP - Fonctionnel de base (Semaine 3-6)

### Semaine 3 : Création & Connexion
**Objectifs :**
- Écran d'accueil
- Système de création de partie (narrateur)
- Système de connexion avec code (joueurs)
- Lobby/salle d'attente

**Fonctionnalités :**
- [ ] Menu principal (Créer / Rejoindre)
- [ ] Génération de code unique à 6 chiffres
- [ ] Connexion temps réel avec code
- [ ] Lobby affichant tous les joueurs connectés
- [ ] Bouton "Lancer la partie" (narrateur)

**Tests :**
- [ ] 2 appareils peuvent se connecter à la même partie
- [ ] Le lobby se met à jour en temps réel

**Temps estimé :** 12-15h

---

### Semaine 4 : Attribution des rôles & Interface de base
**Objectifs :**
- Distribution automatique des rôles
- Écran joueur avec rôle affiché
- Écran narrateur avec vue d'ensemble
- Système de phases (nuit/jour)

**Fonctionnalités :**
- [ ] Logique d'attribution aléatoire des rôles
- [ ] Écran "Ton rôle" pour les joueurs (secret)
- [ ] Dashboard narrateur avec tous les rôles visibles
- [ ] Bouton pour passer de Nuit → Jour → Nuit
- [ ] Indicateur de phase visible par tous

**Tests :**
- [ ] Chaque joueur reçoit un rôle unique
- [ ] Les joueurs ne voient que leur propre rôle
- [ ] Le narrateur voit tout
- [ ] Les phases changent pour tous en même temps

**Temps estimé :** 15-18h

---

### Semaine 5 : Actions des rôles MVP
**Objectifs :**
- Implémenter les 4 rôles de base (Villageois, Loup, Voyante, Chasseur)
- Actions de nuit fonctionnelles
- Vote de jour fonctionnel

**Fonctionnalités :**

#### Loups-Garous
- [ ] Identification automatique entre loups
- [ ] Vote pour choisir une victime la nuit
- [ ] Validation par le narrateur

#### Voyante
- [ ] Sélection d'un joueur à espionner
- [ ] Révélation du rôle (villageois ou loup)

#### Villageois
- [ ] Aucune action la nuit
- [ ] Vote le jour uniquement

#### Chasseur
- [ ] Action déclenchée à sa mort
- [ ] Choisit une cible qui meurt aussi

**Tests :**
- [ ] Les loups se reconnaissent
- [ ] La voyante reçoit l'info correcte
- [ ] Le chasseur tue bien quelqu'un en mourant

**Temps estimé :** 18-20h

---

### Semaine 6 : Vote & Élimination
**Objectifs :**
- Système de vote fonctionnel
- Élimination et révélation du rôle
- Gestion des morts (joueurs ne peuvent plus agir)
- Conditions de victoire

**Fonctionnalités :**
- [ ] Vote du jour : chaque joueur vote
- [ ] Comptage des votes en temps réel (narrateur)
- [ ] Élimination du joueur le plus voté
- [ ] Révélation publique de son rôle
- [ ] Les morts ne peuvent plus voter/agir
- [ ] Détection de fin de partie (loups éliminés ou villageois éliminés)
- [ ] Écran de victoire

**Tests :**
- [ ] Une partie complète de A à Z fonctionne
- [ ] Les conditions de victoire sont détectées correctement
- [ ] Les joueurs morts sont bien bloqués

**Temps estimé :** 15-18h

---

## 🎨 PHASE 3 : Features avancées (Semaine 7)

### Semaine 7 : Rôles complémentaires & Polish
**Objectifs :**
- Ajouter Sorcière, Cupidon, Salvateur
- Améliorer l'interface
- Ajouter sons et animations

**Fonctionnalités :**
- [ ] Sorcière : potions de vie et mort
- [ ] Cupidon : désignation des amoureux
- [ ] Salvateur : protection d'un joueur
- [ ] Sons d'ambiance (loup, cloche, mort)
- [ ] Animations de transition
- [ ] Historique des événements visible
- [ ] Notifications pour les actions requises

**Tests :**
- [ ] Les nouveaux rôles fonctionnent correctement
- [ ] Les sons se déclenchent au bon moment
- [ ] L'expérience est fluide

**Temps estimé :** 15-18h

---

## 🏁 PHASE 4 : Tests, Debug & Publication (Semaine 8)

### Semaine 8 : Finalisation
**Objectifs :**
- Debug intensif
- Tests avec de vrais joueurs
- Optimisation des performances
- Préparation pour le Play Store

**Tâches :**
- [ ] Session de test avec 10+ joueurs réels
- [ ] Correction de tous les bugs trouvés
- [ ] Optimisation de la vitesse
- [ ] Test de stabilité réseau
- [ ] Icône de l'app finalisée
- [ ] Screenshots pour le Play Store
- [ ] Description de l'app rédigée
- [ ] Build de production Android (APK/AAB)
- [ ] Création du compte Google Play Developer
- [ ] Soumission sur le Play Store

**Tests critiques :**
- [ ] Aucun rôle ne fuite par erreur
- [ ] Reconnexion fonctionne
- [ ] Performance acceptable sur vieux téléphones
- [ ] Pas de crash

**Temps estimé :** 15-20h

---

## 📊 Récapitulatif du temps

| Phase | Durée | Heures estimées |
|-------|-------|-----------------|
| Phase 1 : Conception | 2 sem | 20-24h |
| Phase 2 : MVP | 4 sem | 60-71h |
| Phase 3 : Features | 1 sem | 15-18h |
| Phase 4 : Tests & Pub | 1 sem | 15-20h |
| **TOTAL** | **8 sem** | **110-133h** |

**Rythme recommandé :** 15-20h par semaine = 2-3h par jour en semaine + sessions le weekend

---

## 🎯 Jalons clés (Milestones)

### 🏆 Milestone 1 : "Tech validée" (Fin Sem. 2)
- L'environnement de dev fonctionne
- Tu peux faire communiquer 2 appareils
- **Critère de succès :** Un message envoyé d'un téléphone apparaît sur l'autre

### 🏆 Milestone 2 : "Première partie jouable" (Fin Sem. 6)
- Une partie complète avec les 4 rôles de base fonctionne de A à Z
- **Critère de succès :** Tu peux jouer une vraie partie avec des amis

### 🏆 Milestone 3 : "Version complète" (Fin Sem. 7)
- Tous les rôles principaux sont implémentés
- Interface soignée avec sons
- **Critère de succès :** L'expérience est agréable et immersive

### 🏆 Milestone 4 : "Release" (Fin Sem. 8)
- App sur le Play Store
- **Critère de succès :** N'importe qui peut télécharger et jouer

---

## ⚠️ Risques & Contingences

### Risque 1 : Temps sous-estimé
**Impact :** Retard sur le planning  
**Mitigation :** Prioriser le MVP, reporter les features avancées à v1.1

### Risque 2 : Problèmes techniques bloquants
**Impact :** Blocage du développement  
**Mitigation :** Prévoir des alternatives techniques dès le début

### Risque 3 : Bugs critiques en phase finale
**Impact :** Retard de publication  
**Mitigation :** Tester régulièrement tout au long du dev

### Risque 4 : Complexité du temps réel
**Impact :** Synchronisation défaillante  
**Mitigation :** Utiliser Firebase (solution éprouvée)

---

## 🔄 Méthodologie de travail

### Sprints hebdomadaires
Chaque semaine :
1. **Lundi** : Définir les objectifs de la semaine
2. **Mardi-Vendredi** : Développement
3. **Weekend** : Sessions plus longues + tests
4. **Dimanche soir** : Bilan de la semaine

### Checklist quotidienne
Avant de coder :
- [ ] Je sais quelle feature je développe aujourd'hui
- [ ] J'ai lu la doc si besoin
- [ ] Mon code d'hier fonctionne

Après avoir codé :
- [ ] J'ai testé mon code
- [ ] J'ai commit sur GitHub
- [ ] J'ai mis à jour le TODO.md

### Règle d'or
**"Mieux vaut un truc simple qui marche qu'un truc compliqué qui bug"**

Toujours privilégier :
1. Fonctionnel > Joli
2. Simple > Complexe
3. Testé > Théorique

---

## 📈 Évolution post-lancement

### Version 1.1 (dans 1 mois)
- Correction des bugs remontés
- Rôles supplémentaires (Corbeau, Petite Fille, etc.)
- Statistiques de partie

### Version 2.0 (dans 3 mois)
- Nouveaux modes de jeu
- Chat vocal
- Classement/Ranked

### Optionnel
- Version iOS
- Version web

---

## 📞 Support & Feedback

**Pendant le développement :**
- Documenter chaque décision importante
- Prendre des notes sur les difficultés rencontrées
- Tester régulièrement avec de vraies personnes

**Après le lancement :**
- Système de feedback dans l'app
- Email de support
- Mise à jour régulière selon les retours

---

**Dernière mise à jour :** Décembre 2025  
**Statut actuel :** 🟡 En conception

---

**BON COURAGE ! 🚀**

*N'oublie pas : un projet se construit brique par brique. Chaque ligne de code est une victoire !*
