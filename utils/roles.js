// Définition de tous les rôles du jeu Loup-Garou

export const ROLES = {
  LOUP_GAROU: {
    id: 'loup_garou',
    name: 'Loup-Garou',
    team: 'loups',
    description: 'Chaque nuit, vous vous réveillez avec les autres loups pour choisir une victime à dévorer.',
    power: 'Désigner une victime chaque nuit',
    wakeOrder: 1, // Ordre de réveil la nuit (1 = premier)
    actionPhase: 'night',
    icon: '🐺',
    color: '#8B0000'
  },
  
  VILLAGEOIS: {
    id: 'villageois',
    name: 'Villageois',
    team: 'village',
    description: 'Simple villageois sans pouvoir spécial. Votre force est dans le vote et la déduction.',
    power: 'Aucun pouvoir spécial',
    wakeOrder: null, // Ne se réveille pas la nuit
    actionPhase: null,
    icon: '👤',
    color: '#1E3A8A'
  },
  
  VOYANTE: {
    id: 'voyante',
    name: 'Voyante',
    team: 'village',
    description: 'Chaque nuit, vous pouvez voir le rôle d\'un joueur.',
    power: 'Voir le rôle d\'un joueur chaque nuit',
    wakeOrder: 2,
    actionPhase: 'voyante',
    icon: '🔮',
    color: '#FFD700'
  },
  
  SORCIERE: {
    id: 'sorciere',
    name: 'Sorcière',
    team: 'village',
    description: 'Vous possédez deux potions : une potion de vie pour ressusciter la victime des loups, et une potion de mort pour éliminer quelqu\'un. Chaque potion ne peut être utilisée qu\'une seule fois dans la partie.',
    power: 'Une potion de vie et une potion de mort (usage unique)',
    wakeOrder: 3,
    actionPhase: 'sorciere',
    icon: '🧪',
    color: '#FFD700',
    hasLifePotion: true,
    hasDeathPotion: true
  },
  
  CHASSEUR: {
    id: 'chasseur',
    name: 'Chasseur',
    team: 'village',
    description: 'Si vous êtes éliminé (de jour ou de nuit), vous pouvez immédiatement désigner un joueur qui mourra avec vous.',
    power: 'Éliminer quelqu\'un en mourant',
    wakeOrder: null,
    actionPhase: 'death', // Se déclenche à sa mort
    icon: '🏹',
    color: '#FFD700'
  },
  
  CUPIDON: {
    id: 'cupidon',
    name: 'Cupidon',
    team: 'village',
    description: 'La première nuit, vous désignez deux joueurs qui deviennent amoureux. Si l\'un meurt, l\'autre meurt de chagrin. Les amoureux peuvent être de camps différents.',
    power: 'Créer un couple d\'amoureux (première nuit uniquement)',
    wakeOrder: 0, // Premier à se réveiller, avant tout le monde
    actionPhase: 'cupidon',
    oneTimeUse: true,
    icon: '💘',
    color: '#FFD700'
  },
  
  PETITE_FILLE: {
    id: 'petite_fille',
    name: 'Petite Fille',
    team: 'village',
    description: 'Vous pouvez espionner les loups pendant leur tour. Attention, si vous vous faites prendre, vous mourrez immédiatement.',
    power: 'Peut espionner les loups (à vos risques et périls)',
    wakeOrder: null,
    actionPhase: 'night', // Peut regarder pendant le tour des loups
    icon: '👧',
    color: '#FFD700'
  }
};

// Fonction pour obtenir un rôle par son ID
export const getRoleById = (roleId) => {
  return Object.values(ROLES).find(role => role.id === roleId);
};

// Fonction pour obtenir tous les rôles d'une équipe
export const getRolesByTeam = (team) => {
  return Object.values(ROLES).filter(role => role.team === team);
};

// Configuration par défaut pour une partie équilibrée selon le nombre de joueurs
export const getDefaultRoleDistribution = (playerCount) => {
  if (playerCount < 4) return null; // Minimum 4 joueurs
  
  const distributions = {
    4: { loup_garou: 1, voyante: 1, villageois: 2 },
    5: { loup_garou: 1, voyante: 1, villageois: 3 },
    6: { loup_garou: 1, voyante: 1, chasseur: 1, villageois: 3 },
    7: { loup_garou: 2, voyante: 1, chasseur: 1, villageois: 3 },
    8: { loup_garou: 2, voyante: 1, sorciere: 1, chasseur: 1, villageois: 3 },
    9: { loup_garou: 2, voyante: 1, sorciere: 1, chasseur: 1, villageois: 4 },
    10: { loup_garou: 2, voyante: 1, sorciere: 1, chasseur: 1, cupidon: 1, villageois: 4 },
    11: { loup_garou: 2, voyante: 1, sorciere: 1, chasseur: 1, cupidon: 1, villageois: 5 },
    12: { loup_garou: 3, voyante: 1, sorciere: 1, chasseur: 1, cupidon: 1, villageois: 5 },
    13: { loup_garou: 3, voyante: 1, sorciere: 1, chasseur: 1, cupidon: 1, petite_fille: 1, villageois: 5 },
    14: { loup_garou: 3, voyante: 1, sorciere: 1, chasseur: 1, cupidon: 1, petite_fille: 1, villageois: 6 },
    15: { loup_garou: 3, voyante: 1, sorciere: 1, chasseur: 1, cupidon: 1, petite_fille: 1, villageois: 7 }
  };
  
  return distributions[playerCount] || distributions[15];
};

export default ROLES;