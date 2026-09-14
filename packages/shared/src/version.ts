/**
 * La version du jeu: une page ne parle qu'au serveur construit du meme commit.
 *
 * POURQUOI, DEPUIS L'ETAPE 5.3. En production, la page (Vercel) et le serveur de
 * jeu (Render) sont deux mises en ligne distinctes. Le contrat qui les lie, les
 * evenements, le format du flux d'etat, les regles de validation, change d'un
 * commit a l'autre sans numero de version. Une page d'hier restee ouverte dans un
 * onglet, face au serveur d'aujourd'hui, echangerait des messages que l'autre
 * comprend de travers, sans qu'aucune erreur ne le dise. La version est donc le
 * commit lui-meme: la page la joint a l'ouverture du lien, et le serveur refuse une
 * page qui n'est pas la sienne, avec un motif qui dit au joueur quoi faire.
 *
 * SANS VERSION, AUCUN CONTROLE. Un serveur lance en developpement, par les tests
 * ou par les scenarios de bout en bout ne connait pas de version: il accepte toute
 * page, comme avant cette etape.
 */

/** Ce que lit un joueur dont la page n'est pas de la version du serveur. */
export const MOTIF_VERSION_DIFFERENTE =
  'Une nouvelle version du jeu est en ligne. Rechargez la page.';

/**
 * La page peut-elle ouvrir un lien avec ce serveur.
 *
 * @param versionDuServeur La version du serveur, absente en developpement.
 * @param authentification Ce que la page a joint a l'ouverture, tel que recu: rien
 *                         n'en est encore verifie.
 */
export function versionAcceptee(
  versionDuServeur: string | undefined,
  authentification: unknown,
): boolean {
  if (versionDuServeur === undefined) {
    return true;
  }

  if (
    typeof authentification !== 'object' ||
    authentification === null ||
    !Object.hasOwn(authentification, 'version')
  ) {
    return false;
  }

  return (authentification as Record<string, unknown>)['version'] === versionDuServeur;
}
