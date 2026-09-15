/**
 * Les jetons de session: les fabriquer, et en tirer l'empreinte a stocker.
 *
 * UN JETON EST UN SECRET TIRE AU HASARD, PAS UN MESSAGE SIGNE. Il ne contient
 * rien: ni compte, ni date. Le serveur retrouve la session en base a partir de son
 * empreinte. Deux consequences voulues: une session se ferme pour de bon en
 * effacant sa ligne, et le serveur n'a aucune cle secrete a garder, a transmettre
 * a chaque deploiement, et a changer si elle fuit.
 *
 * LA BASE NE GARDE QUE L'EMPREINTE DU JETON, comme pour un mot de passe. Qui lit
 * la table des sessions ne peut pas s'en servir pour se connecter. Un simple
 * SHA-256 suffit ici, sans le cout de scrypt: un jeton porte deux cent cinquante-six
 * bits de hasard, il ne se devine pas par essais, contrairement a un mot de passe
 * choisi par une personne.
 */

import { createHash, randomBytes } from 'node:crypto';

/** Nombre d'octets de hasard d'un jeton. */
const OCTETS_DE_HASARD = 32;

/**
 * Un jeton neuf: trente-deux octets tires par le generateur cryptographique, en
 * base 64 pour adresse (quarante-trois caracteres, sans remplissage).
 */
export function fabriquerJeton(): string {
  return randomBytes(OCTETS_DE_HASARD).toString('base64url');
}

/** L'empreinte d'un jeton, telle que la base la garde: SHA-256 en hexadecimal. */
export function empreinteDuJeton(jeton: string): string {
  return createHash('sha256').update(jeton, 'utf8').digest('hex');
}
