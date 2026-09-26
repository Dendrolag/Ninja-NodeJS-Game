/**
 * Partager un lien: par le partage du systeme sur un appareil tactile, par le
 * presse-papiers ailleurs (etape 2.7).
 *
 * POURQUOI PAS LE PARTAGE PARTOUT. Sur telephone, le partage du systeme ouvre la
 * liste des messageries: c'est le geste attendu. Sur ordinateur, quand il existe, il
 * ouvre une fenetre que peu de joueurs connaissent, alors que copier le lien pour le
 * coller dans une conversation est ce qu'on attend. Le pointeur principal le
 * departage: tactile, on partage; souris, on copie.
 *
 * CE QUI PEUT MAL TOURNER. Le joueur peut fermer la liste des messageries sans rien
 * choisir: ce n'est pas un echec, rien ne se dit. Le partage peut echouer autrement
 * (donnees refusees, page sans chiffrement): on se rabat sur la copie. La copie peut
 * etre refusee a son tour: l'ecran le dit, et montre le lien a selectionner.
 */

/** Ce qu'un partage a donne. */
export type IssueDuPartage =
  /** Le systeme a partage le lien. */
  | 'partage'
  /** Le lien est dans le presse-papiers. */
  | 'copie'
  /** Le joueur a ferme le partage sans rien choisir. */
  | 'annule'
  /** Ni le partage ni la copie n'ont abouti. */
  | 'impossible';

/** Ce qu'on partage. */
export interface DonneesDuPartage {
  readonly titre: string;
  readonly texte: string;
  readonly url: string;
}

/**
 * Cette fenetre partage-t-elle par le systeme, plutot que de copier.
 *
 * Il faut que le navigateur sache partager, et que son pointeur principal soit
 * tactile.
 */
export function partageDuSysteme(fenetre: Window | null): boolean {
  if (fenetre === null || typeof fenetre.navigator.share !== 'function') {
    return false;
  }

  // Certains navigateurs n'ont pas matchMedia (un document d'essai, par exemple).
  return (
    typeof fenetre.matchMedia === 'function' && fenetre.matchMedia('(pointer: coarse)').matches
  );
}

/**
 * Partage le lien, ou le copie.
 *
 * @param fenetre La fenetre de la page, dont on lit le navigateur.
 */
export async function partagerLeLien(
  fenetre: Window | null,
  donnees: DonneesDuPartage,
): Promise<IssueDuPartage> {
  if (fenetre !== null && partageDuSysteme(fenetre)) {
    const aPartager: ShareData = { title: donnees.titre, text: donnees.texte, url: donnees.url };
    const navigateur = fenetre.navigator;

    // canShare est plus recent que share: absent, on essaie.
    if (typeof navigateur.canShare !== 'function' || navigateur.canShare(aPartager)) {
      try {
        await navigateur.share(aPartager);
        return 'partage';
      } catch (erreur) {
        if (erreur instanceof Error && erreur.name === 'AbortError') {
          return 'annule';
        }
        // Tout autre echec se rabat sur la copie.
      }
    }
  }

  return copier(fenetre, donnees.url);
}

/** Copie un texte dans le presse-papiers. */
async function copier(fenetre: Window | null, texte: string): Promise<IssueDuPartage> {
  const pressePapiers = fenetre?.navigator.clipboard;

  if (pressePapiers === undefined) {
    return 'impossible';
  }

  try {
    await pressePapiers.writeText(texte);
    return 'copie';
  } catch {
    return 'impossible';
  }
}
