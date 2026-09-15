/**
 * Les codes de secours: les fabriquer, et en tirer l'empreinte a stocker (etape 3.4).
 *
 * CE QUI REMPLACE LE MOT DE PASSE OUBLIE. Les comptes n'ont aucun moyen de joindre
 * le joueur: a chaque nouveau mot de passe, il recoit un code a noter, qui permet
 * d'en choisir un autre sans session. Voir BORNES_CODE_DE_SECOURS dans le paquet
 * partage pour sa forme, et la facon dont sa saisie est normalisee.
 *
 * QUATRE-VINGTS BITS DE HASARD, TIRES PAR LE GENERATEUR CRYPTOGRAPHIQUE. Dix octets,
 * lus cinq bits a la fois, donnent exactement seize caracteres d'un alphabet de
 * trente-deux: chaque caractere a la meme chance, sans le biais d'un modulo.
 *
 * LA BASE NE GARDE QUE L'EMPREINTE, comme pour un jeton de session, et pour la meme
 * raison un simple SHA-256 suffit: un code tire au hasard sur quatre-vingts bits ne
 * se devine pas par essais, surtout derriere les limites de tentatives de la
 * connexion. Le code montre au joueur ne peut donc pas etre relu.
 */

import { createHash, randomBytes } from 'node:crypto';

import { BORNES_CODE_DE_SECOURS } from '@neon-ninja/shared';

/** Nombre d'octets de hasard d'un code: seize caracteres de cinq bits. */
const OCTETS_DE_HASARD = (BORNES_CODE_DE_SECOURS.longueur * 5) / 8;

/** Bits portes par un caractere de l'alphabet. */
const BITS_PAR_CARACTERE = 5;

/**
 * Un code de secours neuf, sous sa forme normalisee: seize caracteres, sans tiret.
 *
 * C'est la forme dont on tire l'empreinte; formaterCodeDeSecours l'ecrit pour le
 * joueur.
 */
export function fabriquerCodeDeSecours(): string {
  const { alphabet } = BORNES_CODE_DE_SECOURS;
  let code = '';
  let reserve = 0;
  let bits = 0;

  for (const octet of randomBytes(OCTETS_DE_HASARD)) {
    reserve = (reserve << 8) | octet;
    bits += 8;

    while (bits >= BITS_PAR_CARACTERE) {
      bits -= BITS_PAR_CARACTERE;
      code += alphabet.charAt((reserve >> bits) & 0b11111);
      reserve &= (1 << bits) - 1;
    }
  }

  return code;
}

/**
 * L'empreinte d'un code de secours normalise, telle que la base la garde: SHA-256 en
 * hexadecimal.
 *
 * Le code doit deja etre normalise (validerCodeDeSecours): deux saisies d'un meme
 * code, en minuscules ou avec des tirets, ont ainsi la meme empreinte.
 */
export function empreinteDuCode(code: string): string {
  return createHash('sha256').update(code, 'utf8').digest('hex');
}
