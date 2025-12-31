import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Alert,
  ActivityIndicator
} from 'react-native';
import { ref, onValue, off, update } from 'firebase/database';
import { database } from '../firebase';
import { ROLES, getDefaultRoleDistribution } from '../utils/roles';
import { useDevMode } from '../contexts/DevModeContext';
import colors from '../constants/colors';

export default function RoleConfigScreen({ navigation, route }) {
  const { gameCode, playerId } = route.params;
  const { addLog } = useDevMode();

  const [allPlayers, setAllPlayers] = useState([]);
  const [roleConfig, setRoleConfig] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [isDistributing, setIsDistributing] = useState(false);

  // Liste des rôles disponibles
  const availableRoles = useMemo(() => Object.values(ROLES), []);

  // IMPORTANT: Filtrer pour exclure le MJ - il ne joue pas
  const playersToAssign = useMemo(() => {
    return allPlayers.filter(p => !p.isMaster);
  }, [allPlayers]);

  // Nombre de joueurs qui recevront un rôle (sans le MJ)
  const playerCount = playersToAssign.length;

  // Nombre total de rôles configurés
  const totalRoles = useMemo(() => {
    return Object.values(roleConfig).reduce((sum, count) => sum + count, 0);
  }, [roleConfig]);

  // Validation : total = nombre de joueurs (SANS le MJ)
  const isValid = totalRoles === playerCount && playerCount >= 3;

  // Charger les joueurs
  useEffect(() => {
    const playersRef = ref(database, `games/${gameCode}/players`);
    const unsubscribe = onValue(playersRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const list = Object.entries(data).map(([id, info]) => ({ id, ...info }));
        setAllPlayers(list);

        // Configuration par défaut si pas encore configuré
        // Basée sur le nombre de joueurs SANS le MJ
        const nonMasterPlayers = list.filter(p => !p.isMaster);
        if (Object.keys(roleConfig).length === 0 && nonMasterPlayers.length > 0) {
          const defaultConfig = getDefaultRoleDistribution(nonMasterPlayers.length) || {};
          setRoleConfig(defaultConfig);
        }
      }
      setIsLoading(false);
    });

    return () => off(playersRef);
  }, [gameCode]);

  // Appliquer la suggestion par défaut
  const applyDefaultConfig = () => {
    const defaultConfig = getDefaultRoleDistribution(playerCount);
    if (defaultConfig) {
      setRoleConfig(defaultConfig);
      if (__DEV__) addLog('Config par défaut appliquée');
    }
  };

  // Réinitialiser la configuration
  const resetConfig = () => {
    const emptyConfig = {};
    availableRoles.forEach(role => {
      emptyConfig[role.id] = 0;
    });
    setRoleConfig(emptyConfig);
    if (__DEV__) addLog('Config réinitialisée');
  };

  // Modifier le nombre d'un rôle
  const updateRoleCount = (roleId, delta) => {
    setRoleConfig(prev => {
      const currentCount = prev[roleId] || 0;
      const newCount = Math.max(0, currentCount + delta);

      // Limite pour certains rôles (max 1 pour les spéciaux, sauf loups et villageois)
      const maxCount = (roleId === 'loup_garou' || roleId === 'villageois')
        ? playerCount
        : 1;

      return {
        ...prev,
        [roleId]: Math.min(newCount, maxCount)
      };
    });
  };

  // Distribuer les rôles
  const distributeRoles = async () => {
    if (!isValid) {
      Alert.alert('Erreur', 'Le nombre de rôles doit être égal au nombre de joueurs.');
      return;
    }

    setIsDistributing(true);

    try {
      // Créer la liste des rôles à distribuer
      const rolesToAssign = [];
      Object.entries(roleConfig).forEach(([roleId, count]) => {
        for (let i = 0; i < count; i++) {
          rolesToAssign.push(roleId);
        }
      });

      // Mélanger les rôles (Fisher-Yates shuffle)
      for (let i = rolesToAssign.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [rolesToAssign[i], rolesToAssign[j]] = [rolesToAssign[j], rolesToAssign[i]];
      }

      // Assigner les rôles aux joueurs NON-MJ uniquement
      const updates = {};
      playersToAssign.forEach((player, index) => {
        const assignedRole = rolesToAssign[index];
        updates[`games/${gameCode}/players/${player.id}/role`] = assignedRole;
        updates[`games/${gameCode}/players/${player.id}/isAlive`] = true;

        // Initialiser les potions pour la sorcière
        if (assignedRole === 'sorciere') {
          updates[`games/${gameCode}/players/${player.id}/hasUsedLifePotion`] = false;
          updates[`games/${gameCode}/players/${player.id}/hasUsedDeathPotion`] = false;
        }
      });

      // Le MJ reste sans rôle (null) - on ne touche pas à son role

      // Mettre à jour le statut du jeu
      updates[`games/${gameCode}/config/status`] = 'roles_distributed';
      updates[`games/${gameCode}/gameState/currentPhase`] = 'role_reveal';
      updates[`games/${gameCode}/gameState/rolesDistributedAt`] = Date.now();

      // Sauvegarder la configuration des rôles
      updates[`games/${gameCode}/roleConfig`] = roleConfig;

      await update(ref(database), updates);

      if (__DEV__) addLog(`Rôles distribués à ${playerCount} joueurs (MJ exclu)`);

      // Le MJ va vers GameMasterScreen, pas RoleRevealScreen
      navigation.replace('GameMaster', {
        gameCode,
        playerId
      });

    } catch (error) {
      console.error('Erreur distribution:', error);
      Alert.alert('Erreur', 'Impossible de distribuer les rôles. Réessayez.');
    } finally {
      setIsDistributing(false);
    }
  };

  // Rendu d'une carte de rôle
  const renderRoleCard = (role) => {
    const count = roleConfig[role.id] || 0;
    const isSelected = count > 0;

    return (
      <View
        key={role.id}
        style={[
          styles.roleCard,
          isSelected && { borderColor: role.color, borderWidth: 2 }
        ]}
      >
        <View style={styles.roleHeader}>
          <View style={[styles.roleIconContainer, { backgroundColor: role.color }]}>
            <Text style={styles.roleIcon}>{role.icon}</Text>
          </View>
          <View style={styles.roleInfo}>
            <Text style={styles.roleName}>{role.name}</Text>
            <Text style={styles.roleTeam}>
              {role.team === 'loups' ? 'Loup-Garou' : 'Village'}
            </Text>
          </View>
        </View>

        <Text style={styles.roleDescription} numberOfLines={2}>
          {role.description}
        </Text>

        <View style={styles.counterContainer}>
          <TouchableOpacity
            style={[styles.counterButton, count === 0 && styles.counterButtonDisabled]}
            onPress={() => updateRoleCount(role.id, -1)}
            disabled={count === 0}
          >
            <Text style={styles.counterButtonText}>-</Text>
          </TouchableOpacity>

          <View style={styles.countDisplay}>
            <Text style={[styles.countText, isSelected && { color: role.color }]}>
              {count}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.counterButton}
            onPress={() => updateRoleCount(role.id, 1)}
          >
            <Text style={styles.counterButtonText}>+</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Chargement...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <Text style={styles.backButtonText}>← Retour</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Configuration des rôles</Text>
        </View>

        {/* Badge MJ - Rappel que le MJ ne joue pas */}
        <View style={styles.mjBanner}>
          <Text style={styles.mjBannerIcon}>👑</Text>
          <View style={styles.mjBannerContent}>
            <Text style={styles.mjBannerTitle}>Vous êtes le Maître du Jeu</Text>
            <Text style={styles.mjBannerText}>
              Vous ne recevrez pas de rôle. Vous gérez la partie.
            </Text>
          </View>
        </View>

        {/* Indicateur de progression */}
        <View style={styles.progressContainer}>
          <View style={styles.progressInfo}>
            <Text style={styles.progressLabel}>
              {playerCount} joueur{playerCount > 1 ? 's' : ''} à qui attribuer des rôles
            </Text>
            <Text style={[
              styles.progressValue,
              isValid ? styles.progressValid : styles.progressInvalid
            ]}>
              {totalRoles} / {playerCount}
            </Text>
          </View>
          <View style={[
            styles.progressBar,
            { width: `${playerCount > 0 ? Math.min((totalRoles / playerCount) * 100, 100) : 0}%` },
            isValid ? styles.progressBarValid : styles.progressBarInvalid
          ]} />
        </View>

        {/* Boutons d'action rapide */}
        <View style={styles.quickActions}>
          <TouchableOpacity
            style={styles.quickButton}
            onPress={applyDefaultConfig}
          >
            <Text style={styles.quickButtonText}>Suggestion auto</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.quickButton, styles.quickButtonReset]}
            onPress={resetConfig}
          >
            <Text style={styles.quickButtonText}>Réinitialiser</Text>
          </TouchableOpacity>
        </View>

        {/* Liste des rôles */}
        <ScrollView
          style={styles.rolesList}
          showsVerticalScrollIndicator={false}
        >
          {/* Loups-Garous en premier */}
          <Text style={styles.sectionTitle}>Loups-Garous</Text>
          {availableRoles
            .filter(r => r.team === 'loups')
            .map(renderRoleCard)}

          {/* Rôles spéciaux du village */}
          <Text style={styles.sectionTitle}>Rôles spéciaux</Text>
          {availableRoles
            .filter(r => r.team === 'village' && r.id !== 'villageois')
            .map(renderRoleCard)}

          {/* Villageois */}
          <Text style={styles.sectionTitle}>Villageois</Text>
          {availableRoles
            .filter(r => r.id === 'villageois')
            .map(renderRoleCard)}

          <View style={{ height: 100 }} />
        </ScrollView>

        {/* Bouton distribuer */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[
              styles.distributeButton,
              (!isValid || isDistributing) && styles.distributeButtonDisabled
            ]}
            onPress={distributeRoles}
            disabled={!isValid || isDistributing}
          >
            {isDistributing ? (
              <ActivityIndicator color={colors.textPrimary} />
            ) : (
              <>
                <Text style={styles.distributeButtonText}>
                  Distribuer les rôles
                </Text>
                {!isValid && playerCount > 0 && (
                  <Text style={styles.distributeButtonHint}>
                    {totalRoles < playerCount
                      ? `Ajoutez ${playerCount - totalRoles} rôle(s)`
                      : `Retirez ${totalRoles - playerCount} rôle(s)`}
                  </Text>
                )}
                {playerCount < 3 && (
                  <Text style={styles.distributeButtonHint}>
                    Minimum 3 joueurs requis (hors MJ)
                  </Text>
                )}
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: colors.textSecondary,
    marginTop: 10,
  },
  header: {
    marginBottom: 15,
  },
  backButton: {
    marginBottom: 15,
  },
  backButtonText: {
    color: colors.textSecondary,
    fontSize: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  mjBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.special,
    borderRadius: 12,
    padding: 12,
    marginBottom: 15,
  },
  mjBannerIcon: {
    fontSize: 28,
    marginRight: 12,
  },
  mjBannerContent: {
    flex: 1,
  },
  mjBannerTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.background,
  },
  mjBannerText: {
    fontSize: 12,
    color: colors.background,
    opacity: 0.8,
  },
  progressContainer: {
    backgroundColor: colors.backgroundCard,
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
  },
  progressInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  progressLabel: {
    color: colors.textSecondary,
    fontSize: 13,
    flex: 1,
  },
  progressValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  progressValid: {
    color: colors.success,
  },
  progressInvalid: {
    color: colors.warning,
  },
  progressBar: {
    height: 4,
    borderRadius: 2,
  },
  progressBarValid: {
    backgroundColor: colors.success,
  },
  progressBarInvalid: {
    backgroundColor: colors.warning,
  },
  quickActions: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 15,
  },
  quickButton: {
    flex: 1,
    backgroundColor: colors.secondary,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  quickButtonReset: {
    backgroundColor: colors.backgroundCard,
  },
  quickButtonText: {
    color: colors.textPrimary,
    fontWeight: '600',
    fontSize: 14,
  },
  rolesList: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.textSecondary,
    marginTop: 10,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  roleCard: {
    backgroundColor: colors.backgroundCard,
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  roleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  roleIconContainer: {
    width: 45,
    height: 45,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  roleIcon: {
    fontSize: 24,
  },
  roleInfo: {
    flex: 1,
  },
  roleName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  roleTeam: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  roleDescription: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
    marginBottom: 12,
  },
  counterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 15,
  },
  counterButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  counterButtonDisabled: {
    backgroundColor: colors.backgroundSecondary,
    opacity: 0.5,
  },
  counterButtonText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  countDisplay: {
    width: 50,
    alignItems: 'center',
  },
  countText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  footer: {
    paddingTop: 15,
  },
  distributeButton: {
    backgroundColor: colors.success,
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
  },
  distributeButtonDisabled: {
    backgroundColor: colors.backgroundCard,
    opacity: 0.7,
  },
  distributeButtonText: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: 'bold',
  },
  distributeButtonHint: {
    color: colors.warning,
    fontSize: 12,
    marginTop: 5,
  },
});
