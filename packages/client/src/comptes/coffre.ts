/**
 * Le coffre du jeton de session: la ou le client le garde d'une visite a l'autre.
 *
 * LE STOCKAGE LOCAL DU NAVIGATEUR (journal de conception, 11 septembre 2026). Une
 * session vaut trente jours: elle doit survivre a la fermeture de l'onglet, ce que
 * le stockage de session ne permet pas. Le cookie a ete ecarte a l'etape 3.2, le
 * client et le serveur etant prevus sur deux domaines. Le risque connu du stockage
 * local, un script injecte qui lirait le jeton, est celui que ferment deja la
 * correction de la faille S1 (aucun texte de joueur n'est pose comme du balisage)
 * et la politique de securite du contenu, qui refuse tout script etranger.
 *
 * LA LECTURE NE FAIT JAMAIS CONFIANCE AU CONTENU, comme pour les preferences du son.
 * Le stockage se modifie a la main: un texte qui n'a pas la forme d'un jeton est
 * ignore, sans meme etre presente au serveur.
 *
 * UN NAVIGATEUR QUI REFUSE LE STOCKAGE N'EMPECHE PAS DE SE CONNECTER. Le jeton est
 * alors garde en memoire, le temps de la page. Aucune operation de ce fichier ne
 * leve.
 *
 * LE MEME COFFRE GARDE LE JETON DE RETOUR EN PARTIE (etape 2.5), sous une autre cle
 * et dans le STOCKAGE DE SESSION: la place ne vaut que trente secondes, elle doit
 * survivre au rechargement de l'onglet, pas a sa fermeture, et deux onglets ne
 * doivent pas se disputer la meme. Les deux jetons ont la meme forme.
 */

import { validerJeton } from '@neon-ninja/shared';

/** La cle sous laquelle le jeton de session est range dans le navigateur. */
export const CLE_JETON = 'neon-ninja.session';

/** La cle sous laquelle le jeton de retour en partie est range (etape 2.5). */
export const CLE_RETOUR = 'neon-ninja.retour';

/** Ce qui garde le jeton de session. */
export interface CoffreDeJeton {
  /** Le jeton garde, s'il y en a un et qu'il a la forme d'un jeton. */
  lire(): string | undefined;
  /** Garde ce jeton, a la place du precedent. */
  garder(jeton: string): void;
  /** Oublie le jeton. */
  oublier(): void;
}

/**
 * Cree un coffre.
 *
 * @param stockage Le stockage du navigateur. Absent, le jeton ne vit qu'en memoire.
 * @param cle      La cle du jeton dans ce stockage. Celle du jeton de session par defaut.
 */
export function creerCoffreDeJeton(stockage?: Storage, cle: string = CLE_JETON): CoffreDeJeton {
  let enMemoire: string | undefined;

  return {
    lire: () => {
      // Un stockage illisible, ou qui n'a rien garde parce que l'ecriture avait
      // echoue, laisse la place au jeton garde en memoire.
      const brut = essayer(() => stockage?.getItem(cle)) ?? enMemoire;

      if (brut === undefined) {
        return undefined;
      }

      const verdict = validerJeton(brut);

      return verdict.valide ? verdict.valeur : undefined;
    },

    garder: (jeton) => {
      enMemoire = jeton;
      essayer(() => {
        stockage?.setItem(cle, jeton);
      });
    },

    oublier: () => {
      enMemoire = undefined;
      essayer(() => {
        stockage?.removeItem(cle);
      });
    },
  };
}

/**
 * Execute une operation sur le stockage, sans jamais lever.
 *
 * Un navigateur regle pour refuser les donnees de site leve a la moindre lecture,
 * et un stockage plein leve a l'ecriture.
 */
function essayer<T>(operation: () => T | null | undefined): T | undefined {
  try {
    return operation() ?? undefined;
  } catch {
    return undefined;
  }
}
