// Génère un code unique pour une partie

/**
 * Génère un code aléatoire de 6 caractères (lettres majuscules et chiffres)
 * Format: ABC123
 */
export const generateGameCode = () => {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  
  for (let i = 0; i < 6; i++) {
    const randomIndex = Math.floor(Math.random() * characters.length);
    code += characters[randomIndex];
  }
  
  return code;
};

/**
 * Vérifie si un code a le format correct (6 caractères alphanumériques)
 */
export const isValidGameCode = (code) => {
  if (!code || typeof code !== 'string') return false;
  return /^[A-Z0-9]{6}$/.test(code.toUpperCase());
};

/**
 * Formate un code en majuscules (pour l'affichage)
 */
export const formatGameCode = (code) => {
  if (!code) return '';
  return code.toUpperCase().trim();
};

export default {
  generateGameCode,
  isValidGameCode,
  formatGameCode
};