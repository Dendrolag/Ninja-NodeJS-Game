/**
 * La page publique sur Vercel (etape 5.3).
 *
 * La page est empaquetee pour un commit et un serveur de jeu, envoyee a Vercel
 * sans etre promue, puis promue: l'adresse publique la sert alors en quelques
 * secondes.
 *
 * LES SECRETS NE PASSENT JAMAIS EN ARGUMENT. L'outil de Vercel lit VERCEL_TOKEN,
 * VERCEL_ORG_ID et VERCEL_PROJECT_ID dans l'environnement, qu'il herite. Rien n'est
 * affiche d'eux.
 */

import { execFile } from 'node:child_process';

import { preparerLaSortieVercel } from '../packages/client/scripts/sortieVercel.ts';
import type { PagePublique } from './miseEnLigne.ts';
import type { PageLue } from './verifications.ts';
import { adresseDuDeploiementVercel } from './verifications.ts';

/** La version de l'outil de Vercel, epinglee: une mise a jour ne doit pas changer une mise en ligne. */
const OUTIL_VERCEL = 'vercel@59.16.0';

/**
 * Lance l'outil de Vercel avec ces arguments, et rend ce qu'il ecrit.
 *
 * PAR NPX, ET NON PAR « PNPM DLX ». L'outil n'est pas une dependance du depot: il
 * tire une quarantaine de paquets dont le jeu n'a aucun usage. pnpm le range a sa
 * facon, stricte, et l'outil n'y retrouve pas l'une de ses propres dependances
 * (@vercel/cli-auth, constate le 14 septembre 2026); npx l'installe a plat, comme
 * il s'attend a l'etre.
 */
async function lancerVercel(argumentsVercel: readonly string[]): Promise<string> {
  const commande = ['--yes', OUTIL_VERCEL, ...argumentsVercel, '--non-interactive'];

  // Sous Windows, npx est un script de commandes que seul l'interpreteur sait
  // lancer. Aucun argument ne porte de secret.
  const [programme, argumentsDuProgramme] =
    process.platform === 'win32'
      ? ['cmd.exe', ['/d', '/s', '/c', 'npx', ...commande]]
      : ['npx', commande];

  return new Promise((resoudre, rejeter) => {
    execFile(
      programme,
      argumentsDuProgramme,
      { maxBuffer: 16 * 1024 * 1024 },
      (erreur, sortie, erreurs) => {
        process.stderr.write(erreurs);

        if (erreur !== null) {
          rejeter(new Error(`L'outil de Vercel a echoue (${argumentsVercel.join(' ')}).`));
          return;
        }

        resoudre(sortie);
      },
    );
  });
}

/** Lit la page publique et son code, sans cache. */
export async function lireLaPage(pageDuJeu: string): Promise<PageLue> {
  const page = await fetch(`${pageDuJeu}/`, { cache: 'no-store' });
  const code = await fetch(`${pageDuJeu}/app.js`, { cache: 'no-store' });

  return {
    statutDeLaPage: page.status,
    politique: page.headers.get('content-security-policy'),
    statutDuCode: code.status,
    code: await code.text(),
  };
}

/**
 * La page publique a cette adresse, servie par Vercel.
 *
 * @param pageDuJeu    L'origine publique de la page, https://ninja.dendrolag.fr.
 * @param dateDuCommit La date d'un commit, que le pied de l'accueil presente
 *                     (etape 8.4), ou rien si on ne sait pas la dire.
 */
export function pageVercel(
  pageDuJeu: string,
  dateDuCommit: (commit: string) => Promise<string | undefined>,
): PagePublique {
  return {
    lire: async () => lireLaPage(pageDuJeu),
    async envoyer(serveurDeJeu, version) {
      const horodatage = await dateDuCommit(version);
      await preparerLaSortieVercel({
        serveurDeJeu,
        version,
        ...(horodatage === undefined ? {} : { horodatage }),
      });

      const adresse = adresseDuDeploiementVercel(
        await lancerVercel(['deploy', '--prebuilt', '--prod', '--skip-domain', '--yes']),
      );

      if (adresse === undefined) {
        throw new Error("L'outil de Vercel n'a pas donne l'adresse du deploiement.");
      }

      return adresse;
    },
    async promouvoir(deploiement) {
      await lancerVercel(['promote', deploiement, '--yes']);
    },
  };
}
