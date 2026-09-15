/**
 * Ce que la page sait de sa mise en ligne: ou est le serveur de jeu, et de quel
 * commit elle est construite (etape 5.3).
 *
 * DEUX VALEURS FIXEES A L'EMPAQUETAGE, PAS LUES A L'EXECUTION. La page ne peut rien
 * demander avant de savoir a qui le demander: l'adresse du serveur est donc ecrite
 * dans son code par l'empaqueteur (packages/client/scripts/empaqueter.ts), comme la
 * version. Une chaine vide veut dire « rien »: c'est ce que produit un empaquetage
 * de developpement, ou le serveur de jeu sert la page lui-meme et ne connait pas de
 * version.
 */

/** La configuration de la page, telle que le transport et les comptes la lisent. */
export interface ConfigurationDeLaPage {
  /** L'origine du serveur de jeu. Absente: celle de la page. */
  readonly url?: string;
  /** Le commit dont la page est construite. Absent en developpement. */
  readonly version?: string;
}

/**
 * La configuration de la page, a partir des valeurs ecrites par l'empaqueteur.
 *
 * @param serveurDeJeu L'origine du serveur de jeu, ou une chaine vide.
 * @param version      Le commit de la page, ou une chaine vide.
 */
export function configurationDeLaPage(
  serveurDeJeu: string,
  version: string,
): ConfigurationDeLaPage {
  return {
    ...(serveurDeJeu === '' ? {} : { url: serveurDeJeu }),
    ...(version === '' ? {} : { version }),
  };
}
