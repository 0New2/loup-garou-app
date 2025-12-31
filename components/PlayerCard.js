import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { getRoleById } from '../utils/roles';
import colors from '../constants/colors';

// Raisons de mort
const DEATH_REASONS = {
  werewolves: { label: 'Dévoré', icon: '🐺' },
  vote: { label: 'Pendu', icon: '⚖️' },
  witch_poison: { label: 'Empoisonné', icon: '🧪' },
  hunter: { label: 'Abattu', icon: '🔫' },
  lovers: { label: 'Chagrin', icon: '💔' },
  unknown: { label: 'Mort', icon: '💀' },
};

export default function PlayerCard({
  player,
  onAddBonusRole,
  onToggleAlive,
  onViewRole,
  showActions = true,
  compact = false,
}) {
  const role = getRoleById(player.role);
  const bonusRole = player.bonusRole ? getRoleById(player.bonusRole) : null;
  const isAlive = player.isAlive !== false;
  const deathReason = DEATH_REASONS[player.deathReason] || DEATH_REASONS.unknown;

  if (compact) {
    return (
      <View style={[styles.compactCard, !isAlive && styles.cardDead]}>
        <View style={[styles.compactIcon, { backgroundColor: role?.color || '#333' }]}>
          <Text style={styles.compactIconText}>{role?.icon || '❓'}</Text>
        </View>
        <View style={styles.compactInfo}>
          <Text style={[styles.compactName, !isAlive && styles.nameDead]}>
            {player.name}
          </Text>
          <Text style={[styles.compactRole, { color: role?.color || '#888' }]}>
            {role?.name || 'Sans rôle'}
          </Text>
        </View>
        {!isAlive && (
          <Text style={styles.deadBadgeCompact}>{deathReason.icon}</Text>
        )}
      </View>
    );
  }

  return (
    <View style={[styles.card, !isAlive && styles.cardDead]}>
      {/* En-tête avec icône et info */}
      <View style={styles.cardHeader}>
        {/* Icône du rôle */}
        <View style={[styles.roleIconContainer, { backgroundColor: role?.color || '#333' }]}>
          <Text style={styles.roleIcon}>{role?.icon || '❓'}</Text>
        </View>

        {/* Informations du joueur */}
        <View style={styles.playerInfo}>
          <View style={styles.nameRow}>
            <Text style={[styles.playerName, !isAlive && styles.nameDead]}>
              {player.name}
            </Text>
            {player.isBot && <Text style={styles.botBadge}>🤖</Text>}
          </View>

          <View style={styles.roleRow}>
            <Text style={[styles.roleName, { color: role?.color || '#888' }]}>
              {role?.name || 'Sans rôle'}
            </Text>
            {role && (
              <View style={[styles.teamBadge, { backgroundColor: role.team === 'loups' ? '#8B0000' : '#1E3A8A' }]}>
                <Text style={styles.teamBadgeText}>
                  {role.team === 'loups' ? 'LOUP' : 'VILLAGE'}
                </Text>
              </View>
            )}
          </View>

          {/* Rôle bonus si présent */}
          {bonusRole && (
            <View style={styles.bonusRow}>
              <Text style={styles.bonusLabel}>Bonus:</Text>
              <Text style={[styles.bonusRole, { color: bonusRole.color }]}>
                {bonusRole.icon} {bonusRole.name}
              </Text>
            </View>
          )}
        </View>

        {/* Statut vivant/mort */}
        <View style={styles.statusContainer}>
          {isAlive ? (
            <View style={styles.aliveBadge}>
              <Text style={styles.aliveBadgeText}>✓</Text>
            </View>
          ) : (
            <View style={styles.deadBadge}>
              <Text style={styles.deadBadgeIcon}>{deathReason.icon}</Text>
              <Text style={styles.deadBadgeText}>{deathReason.label}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Actions (si activées) */}
      {showActions && (
        <View style={styles.actionsRow}>
          {/* Voir le rôle */}
          {onViewRole && (
            <TouchableOpacity
              style={[styles.actionButton, styles.viewButton]}
              onPress={() => onViewRole(player)}
            >
              <Text style={styles.actionButtonText}>👁️ Voir</Text>
            </TouchableOpacity>
          )}

          {/* Ajouter rôle bonus */}
          {onAddBonusRole && isAlive && (
            <TouchableOpacity
              style={[styles.actionButton, styles.bonusButton]}
              onPress={() => onAddBonusRole(player)}
            >
              <Text style={styles.actionButtonText}>+ Bonus</Text>
            </TouchableOpacity>
          )}

          {/* Toggle vivant/mort */}
          {onToggleAlive && (
            <TouchableOpacity
              style={[styles.actionButton, isAlive ? styles.killButton : styles.reviveButton]}
              onPress={() => onToggleAlive(player)}
            >
              <Text style={styles.actionButtonText}>
                {isAlive ? '☠️ Éliminer' : '❤️ Ressusciter'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // ==================== CARTE STANDARD ====================
  card: {
    backgroundColor: colors.backgroundCard,
    borderRadius: 16,
    padding: 15,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  cardDead: {
    opacity: 0.6,
    borderLeftColor: colors.dead,
    backgroundColor: colors.backgroundSecondary,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  roleIconContainer: {
    width: 55,
    height: 55,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  roleIcon: {
    fontSize: 28,
  },
  playerInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  playerName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  nameDead: {
    textDecorationLine: 'line-through',
    color: colors.textDisabled,
  },
  botBadge: {
    marginLeft: 8,
    fontSize: 14,
  },
  roleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  roleName: {
    fontSize: 14,
    fontWeight: '600',
  },
  teamBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  teamBadgeText: {
    color: '#FFF',
    fontSize: 9,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  bonusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  bonusLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    marginRight: 6,
  },
  bonusRole: {
    fontSize: 12,
    fontWeight: '600',
  },
  statusContainer: {
    alignItems: 'flex-end',
  },
  aliveBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.success,
    justifyContent: 'center',
    alignItems: 'center',
  },
  aliveBadgeText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  deadBadge: {
    alignItems: 'center',
    backgroundColor: 'rgba(220, 38, 38, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  deadBadgeIcon: {
    fontSize: 18,
  },
  deadBadgeText: {
    color: colors.danger,
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },

  // ==================== ACTIONS ====================
  actionsRow: {
    flexDirection: 'row',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.backgroundSecondary,
    gap: 8,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
  viewButton: {
    backgroundColor: colors.primary,
  },
  bonusButton: {
    backgroundColor: colors.special,
  },
  killButton: {
    backgroundColor: colors.danger,
  },
  reviveButton: {
    backgroundColor: colors.success,
  },

  // ==================== CARTE COMPACTE ====================
  compactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundCard,
    borderRadius: 10,
    padding: 10,
    marginBottom: 6,
  },
  compactIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  compactIconText: {
    fontSize: 18,
  },
  compactInfo: {
    flex: 1,
  },
  compactName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  compactRole: {
    fontSize: 11,
    marginTop: 1,
  },
  deadBadgeCompact: {
    fontSize: 16,
  },
});
