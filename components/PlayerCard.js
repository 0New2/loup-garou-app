import React, { memo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
} from 'react-native';
import { getRoleById } from '../utils/roles';
import colors from '../constants/colors';

// Raisons de mort
const DEATH_REASONS = {
  werewolves: { label: 'Devore', icon: '🐺' },
  vote: { label: 'Pendu', icon: '⚖️' },
  witch_poison: { label: 'Empoisonne', icon: '🧪' },
  hunter: { label: 'Abattu', icon: '🔫' },
  lovers: { label: 'Chagrin', icon: '💔' },
  unknown: { label: 'Mort', icon: '💀' },
};

/**
 * Carte joueur optimisee avec React.memo et animations
 */
const PlayerCard = memo(({
  player,
  onAddBonusRole,
  onToggleAlive,
  onViewRole,
  onSelect,
  showActions = true,
  compact = false,
  isSelected = false,
  index = 0,
  animated = true,
}) => {
  const role = getRoleById(player.role);
  const bonusRole = player.bonusRole ? getRoleById(player.bonusRole) : null;
  const isAlive = player.isAlive !== false;
  const deathReason = DEATH_REASONS[player.deathReason] || DEATH_REASONS.unknown;

  // Animations
  const fadeAnim = useRef(new Animated.Value(animated ? 0 : 1)).current;
  const slideAnim = useRef(new Animated.Value(animated ? 30 : 0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const eliminateAnim = useRef(new Animated.Value(isAlive ? 1 : 0.6)).current;
  const wasAlive = useRef(isAlive);

  // Animation d'entree (stagger)
  useEffect(() => {
    if (animated) {
      const delay = index * 50;
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          delay,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 50,
          friction: 8,
          delay,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [animated, index]);

  // Animation d'elimination
  useEffect(() => {
    if (wasAlive.current && !isAlive) {
      // Shake puis fade
      Animated.sequence([
        Animated.sequence([
          Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
          Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
          Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
          Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
          Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
        ]),
        Animated.timing(eliminateAnim, {
          toValue: 0.6,
          duration: 300,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start();
    } else if (!wasAlive.current && isAlive) {
      // Resurrection
      Animated.timing(eliminateAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
    wasAlive.current = isAlive;
  }, [isAlive]);

  // Animation de selection
  useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: isSelected ? 1.02 : 1,
      tension: 100,
      friction: 8,
      useNativeDriver: true,
    }).start();
  }, [isSelected]);

  // Feedback tactile pour boutons
  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.98,
      tension: 100,
      friction: 5,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: isSelected ? 1.02 : 1,
      tension: 100,
      friction: 5,
      useNativeDriver: true,
    }).start();
  };

  // Version compacte
  if (compact) {
    return (
      <Animated.View
        style={[
          styles.compactCard,
          !isAlive && styles.cardDead,
          isSelected && styles.cardSelected,
          {
            opacity: Animated.multiply(fadeAnim, eliminateAnim),
            transform: [
              { translateY: slideAnim },
              { translateX: shakeAnim },
              { scale: scaleAnim },
            ],
          },
        ]}
      >
        <TouchableOpacity
          style={styles.compactTouchable}
          onPress={() => onSelect?.(player)}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          disabled={!onSelect}
          activeOpacity={0.8}
          accessibilityLabel={`Joueur ${player.name}, ${role?.name || 'sans role'}, ${isAlive ? 'vivant' : 'elimine'}`}
          accessibilityRole="button"
        >
          <View style={[styles.compactIcon, { backgroundColor: role?.color || '#333' }]}>
            <Text style={styles.compactIconText}>{role?.icon || '❓'}</Text>
          </View>
          <View style={styles.compactInfo}>
            <Text style={[styles.compactName, !isAlive && styles.nameDead]} numberOfLines={1}>
              {player.name}
            </Text>
            <Text style={[styles.compactRole, { color: role?.color || '#888' }]} numberOfLines={1}>
              {role?.name || 'Sans role'}
            </Text>
          </View>
          {!isAlive && (
            <Text style={styles.deadBadgeCompact}>{deathReason.icon}</Text>
          )}
          {isSelected && (
            <View style={styles.selectedIndicator}>
              <Text style={styles.selectedIndicatorText}>✓</Text>
            </View>
          )}
        </TouchableOpacity>
      </Animated.View>
    );
  }

  // Version complete
  return (
    <Animated.View
      style={[
        styles.card,
        !isAlive && styles.cardDead,
        isSelected && styles.cardSelected,
        {
          opacity: Animated.multiply(fadeAnim, eliminateAnim),
          transform: [
            { translateY: slideAnim },
            { translateX: shakeAnim },
            { scale: scaleAnim },
          ],
        },
      ]}
    >
      {/* En-tete avec icone et info */}
      <TouchableOpacity
        style={styles.cardHeader}
        onPress={() => onSelect?.(player)}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={!onSelect}
        activeOpacity={0.8}
        accessibilityLabel={`Joueur ${player.name}, ${role?.name || 'sans role'}, equipe ${role?.team || 'inconnue'}, ${isAlive ? 'vivant' : 'elimine'}`}
        accessibilityRole="button"
      >
        {/* Icone du role */}
        <View style={[styles.roleIconContainer, { backgroundColor: role?.color || '#333' }]}>
          <Text style={styles.roleIcon}>{role?.icon || '❓'}</Text>
        </View>

        {/* Informations du joueur */}
        <View style={styles.playerInfo}>
          <View style={styles.nameRow}>
            <Text style={[styles.playerName, !isAlive && styles.nameDead]} numberOfLines={1}>
              {player.name}
            </Text>
            {player.isBot && <Text style={styles.botBadge}>🤖</Text>}
          </View>

          <View style={styles.roleRow}>
            <Text style={[styles.roleName, { color: role?.color || '#888' }]} numberOfLines={1}>
              {role?.name || 'Sans role'}
            </Text>
            {role && (
              <View style={[styles.teamBadge, { backgroundColor: role.team === 'loups' ? '#8B0000' : '#1E3A8A' }]}>
                <Text style={styles.teamBadgeText}>
                  {role.team === 'loups' ? 'LOUP' : 'VILLAGE'}
                </Text>
              </View>
            )}
          </View>

          {/* Role bonus si present */}
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
      </TouchableOpacity>

      {/* Indicateur de selection */}
      {isSelected && (
        <View style={styles.selectedBorder} />
      )}

      {/* Actions (si activees) */}
      {showActions && (
        <View style={styles.actionsRow}>
          {/* Voir le role */}
          {onViewRole && (
            <TouchableOpacity
              style={[styles.actionButton, styles.viewButton]}
              onPress={() => onViewRole(player)}
              accessibilityLabel={`Voir le role de ${player.name}`}
              accessibilityRole="button"
            >
              <Text style={styles.actionButtonText}>👁️ Voir</Text>
            </TouchableOpacity>
          )}

          {/* Ajouter role bonus */}
          {onAddBonusRole && isAlive && (
            <TouchableOpacity
              style={[styles.actionButton, styles.bonusButton]}
              onPress={() => onAddBonusRole(player)}
              accessibilityLabel={`Ajouter un role bonus a ${player.name}`}
              accessibilityRole="button"
            >
              <Text style={styles.actionButtonText}>+ Bonus</Text>
            </TouchableOpacity>
          )}

          {/* Toggle vivant/mort */}
          {onToggleAlive && (
            <TouchableOpacity
              style={[styles.actionButton, isAlive ? styles.killButton : styles.reviveButton]}
              onPress={() => onToggleAlive(player)}
              accessibilityLabel={isAlive ? `Eliminer ${player.name}` : `Ressusciter ${player.name}`}
              accessibilityRole="button"
            >
              <Text style={styles.actionButtonText}>
                {isAlive ? '☠️ Eliminer' : '❤️ Ressusciter'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </Animated.View>
  );
}, (prevProps, nextProps) => {
  // Comparaison personnalisee pour React.memo
  return (
    prevProps.player.id === nextProps.player.id &&
    prevProps.player.name === nextProps.player.name &&
    prevProps.player.role === nextProps.player.role &&
    prevProps.player.isAlive === nextProps.player.isAlive &&
    prevProps.player.bonusRole === nextProps.player.bonusRole &&
    prevProps.player.deathReason === nextProps.player.deathReason &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.showActions === nextProps.showActions &&
    prevProps.compact === nextProps.compact &&
    prevProps.index === nextProps.index
  );
});

PlayerCard.displayName = 'PlayerCard';

export default PlayerCard;

const styles = StyleSheet.create({
  // ==================== CARTE STANDARD ====================
  card: {
    backgroundColor: colors.backgroundCard,
    borderRadius: 16,
    padding: 15,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
    overflow: 'hidden',
  },
  cardDead: {
    borderLeftColor: colors.dead,
    backgroundColor: colors.backgroundSecondary,
  },
  cardSelected: {
    borderLeftColor: colors.success,
    borderColor: colors.success,
    borderWidth: 2,
  },
  selectedBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.success,
    pointerEvents: 'none',
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
    flex: 1,
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
    flexWrap: 'wrap',
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
    minHeight: 44, // Accessibilite: taille minimum
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
    backgroundColor: colors.backgroundCard,
    borderRadius: 10,
    marginBottom: 6,
    overflow: 'hidden',
  },
  compactTouchable: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    minHeight: 44, // Accessibilite
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
  selectedIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.success,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  selectedIndicatorText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
});
