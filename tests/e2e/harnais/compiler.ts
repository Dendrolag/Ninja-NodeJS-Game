/**
 * Compilation des paquets et empaquetage du client, avant les scenarios de bout
 * en bout.
 *
 * POURQUOI C'EST NECESSAIRE. Deux sortes de scenarios chargent du code compile
 * dans un vrai navigateur. Le banc de mesure du rendu (etape 4.2) charge la
 * compilation du paquet client, module par module. Le scenario de navigation
 * (etape 4.3) charge la vraie page, servie par le vrai serveur: il lui faut la
 * compilation du serveur et le client empaquete. Les tests unitaires, eux, lisent
 * les sources grace aux alias de Vitest, et n'ont jamais eu besoin de rien de tout
 * cela. Sans cette etape, les scenarios tourneraient sur un code perime, ou n'en
 * trouveraient aucun en integration continue.
 *
 * LE COMPILATEUR EST LANCE PAR NODE LUI-MEME, pas par un interpreteur de
 * commandes. Passer par un shell, necessaire sous Windows pour trouver npx, fait
 * emettre a Node un avertissement de securite a chaque execution, parce que les
 * arguments y sont concatenes sans echappement. Retrouver le script du
 * compilateur et le donner a Node evite le shell sur toutes les plateformes.
 *
 * La compilation est incrementale: quand rien n'a change, elle coute une seconde.
 * L'empaquetage repart de zero, et coute a peu pres autant.
 */

import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

import { empaqueterLeClient } from '../../../packages/client/scripts/empaqueter.js';
import { RACINE_DEPOT } from './serveur-statique.js';

/** Compile tous les paquets du depot, puis empaquete le client. */
export default async function compilerLesPaquets(): Promise<void> {
  const compilateur = createRequire(import.meta.url).resolve('typescript/bin/tsc');

  execFileSync(process.execPath, [compilateur, '--build'], {
    cwd: RACINE_DEPOT,
    stdio: 'inherit',
  });

  await empaqueterLeClient();
}
