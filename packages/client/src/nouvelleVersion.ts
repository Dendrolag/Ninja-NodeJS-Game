/**
 * La page attend la nouvelle version, puis se recharge d'elle-meme (retour du porteur du projet
 * du 16 octobre 2026).
 *
 * LE DEFAUT. Une mise en ligne met d'abord le nouveau serveur en ligne, puis promeut la page sur
 * Vercel, quelques secondes plus tard (docs/deploiement.md). Entre les deux, le nouveau serveur
 * refuse l'ancienne page, qui disait « Rechargez la page »: recharger rendait encore l'ancienne
 * page, refusee a son tour, et le message revenait, plusieurs secondes durant.
 *
 * LA CORRECTION. Refusee pour sa version, la page lit, toutes les trois secondes, la version que
 * Vercel publie (version.json, ecrit par l'empaquetage a cote de la page), et se recharge des que
 * ce n'est plus la sienne: la nouvelle page est la. Elle s'arrete au bout de trois minutes, ou des
 * que le lien n'est plus refuse pour sa version; le bouton « Recharger la page » reste la. Une page
 * sans version, celle du developpement, n'attend rien: son serveur ne la refuse jamais.
 *
 * Les entrees-sorties sont injectees: lire la version publiee, recharger, attendre.
 */

import { MOTIF_VERSION_DIFFERENTE } from '@neon-ninja/shared';

import type { Client } from './client.js';
import type { EtatClient } from './etat.js';

/** L'intervalle entre deux lectures de la version publiee. */
export const INTERVALLE_DE_LECTURE_MS = 3000;

/** Combien de lectures au plus: trois minutes, bien au-dela d'une promotion de la page. */
export const LECTURES_AU_PLUS = 60;

/** Ce qu'il faut pour attendre la nouvelle version. */
export interface OptionsDeLaNouvelleVersion {
  readonly client: Pick<Client, 'etat' | 'abonner'>;
  /** La version de cette page, absente en developpement. */
  readonly versionDeLaPage: string | undefined;
  /** La version que publie le serveur de la page, ou rien s'il ne la dit pas. */
  readonly lireLaVersionPubliee: () => Promise<string | undefined>;
  readonly recharger: () => void;
  /** Rappelle apres ce delai; rend de quoi annuler. */
  readonly planifier: (rappel: () => void, delaiMs: number) => () => void;
}

/** Le lien est-il refuse parce que la page n'est pas de la version du serveur. */
export function refuseePourSaVersion(etat: EtatClient): boolean {
  return etat.connexion === 'refusee' && etat.refusDeConnexion === MOTIF_VERSION_DIFFERENTE;
}

/**
 * Attend la nouvelle version tant que le lien est refuse pour la version de la page.
 *
 * @returns De quoi cesser d'attendre.
 */
export function attendreLaNouvelleVersion(options: OptionsDeLaNouvelleVersion): () => void {
  const { versionDeLaPage } = options;

  if (versionDeLaPage === undefined || versionDeLaPage === '') {
    return () => undefined;
  }

  let annuler: (() => void) | undefined;
  let lectures = 0;

  const cesser = (): void => {
    annuler?.();
    annuler = undefined;
  };

  const lire = (): void => {
    annuler = undefined;
    lectures += 1;

    options
      .lireLaVersionPubliee()
      .catch(() => undefined)
      .then((publiee) => {
        if (!refuseePourSaVersion(options.client.etat)) {
          return;
        }

        if (publiee !== undefined && publiee !== '' && publiee !== versionDeLaPage) {
          options.recharger();
          return;
        }

        if (lectures < LECTURES_AU_PLUS) {
          annuler = options.planifier(lire, INTERVALLE_DE_LECTURE_MS);
        }
      })
      .catch(() => undefined);
  };

  const suivre = (etat: EtatClient): void => {
    if (!refuseePourSaVersion(etat)) {
      cesser();
      lectures = 0;
      return;
    }

    if (annuler === undefined && lectures === 0) {
      lire();
    }
  };

  const desabonner = options.client.abonner(suivre);
  suivre(options.client.etat);

  return () => {
    desabonner();
    cesser();
  };
}

/**
 * Lit la version que publie le serveur de la page, sans cache: celle de version.json, a cote de
 * la page. Rien si le fichier manque ou ne se lit pas.
 */
export async function lireLaVersionPubliee(adresseDeLaPage: string): Promise<string | undefined> {
  const adresse = new URL('version.json', adresseDeLaPage);
  adresse.searchParams.set('t', String(Date.now()));
  const reponse = await fetch(adresse, { cache: 'no-store' });

  if (!reponse.ok) {
    return undefined;
  }

  const contenu: unknown = await reponse.json();

  return typeof contenu === 'object' &&
    contenu !== null &&
    typeof (contenu as { version?: unknown }).version === 'string'
    ? (contenu as { version: string }).version
    : undefined;
}
