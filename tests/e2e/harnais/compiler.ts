/**
 * Compilation des paquets avant les scenarios de bout en bout.
 *
 * POURQUOI C'EST NECESSAIRE. Depuis l'etape 4.2, un scenario charge la
 * compilation du paquet client dans un vrai navigateur: le banc de mesure du
 * rendu. Les tests unitaires, eux, lisent les sources grace aux alias de Vitest,
 * et n'ont donc jamais eu besoin d'une compilation a jour. Sans cette etape, le
 * banc mesurerait un dist perime, ou n'en trouverait aucun en integration
 * continue, ou le travail de verification ne laisse rien derriere lui.
 *
 * LE COMPILATEUR EST LANCE PAR NODE LUI-MEME, pas par un interpreteur de
 * commandes. Passer par un shell, necessaire sous Windows pour trouver npx, fait
 * emettre a Node un avertissement de securite a chaque execution, parce que les
 * arguments y sont concatenes sans echappement. Retrouver le script du
 * compilateur et le donner a Node evite le shell sur toutes les plateformes.
 *
 * La compilation est incrementale: quand rien n'a change, elle coute une seconde.
 */

import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

import { RACINE_DEPOT } from './serveur-statique.js';

/** Compile tous les paquets du depot. */
export default function compilerLesPaquets(): void {
  const compilateur = createRequire(import.meta.url).resolve('typescript/bin/tsc');

  execFileSync(process.execPath, [compilateur, '--build'], {
    cwd: RACINE_DEPOT,
    stdio: 'inherit',
  });
}
