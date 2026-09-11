/**
 * Les comptes: les creer, les retrouver.
 *
 * UN COMPTE NAIT AVEC SA PROGRESSION, dans la meme transaction. Il n'existe donc
 * jamais de compte sans progression a gerer ailleurs.
 *
 * UN PSEUDO DEJA PRIS EST UN REFUS, PAS UNE PANNE. C'est la regle posee a l'etape
 * 2.1: ce qu'un joueur peut legitimement demander et qui peut lui etre refuse
 * rend un verdict a expliquer. L'unicite est tenue par la base elle-meme (deux
 * inscriptions simultanees ne peuvent pas passer toutes les deux), et son refus
 * est traduit en message.
 */

import type { ResultatValidation } from '@neon-ninja/shared';
import { reperePseudo, validerPseudo } from '@neon-ninja/shared';
import { eq } from 'drizzle-orm';

import type { BaseDeDonnees } from './connexion.js';
import { CODES_POSTGRES, erreurPostgres } from './erreurs.js';
import { comptes, progressions } from './schema.js';

/** Un compte, tel que le serveur le manipule. */
export interface Compte {
  readonly id: string;
  /** Le pseudo dans l'ecriture choisie a l'inscription. */
  readonly pseudo: string;
  readonly creeLe: Date;
}

/** Les colonnes lues pour decrire un compte. */
const COLONNES_COMPTE = {
  id: comptes.id,
  pseudo: comptes.pseudo,
  creeLe: comptes.creeLe,
};

/**
 * Cree un compte et sa progression, a partir du pseudo tel que le joueur l'a saisi.
 *
 * Le pseudo est valide par la meme fonction qu'a l'entree dans un salon.
 */
export async function creerCompte(
  db: BaseDeDonnees,
  pseudoSaisi: unknown,
): Promise<ResultatValidation<Compte>> {
  const pseudo = validerPseudo(pseudoSaisi);
  if (!pseudo.valide) {
    return pseudo;
  }

  try {
    const compte = await db.transaction(async (transaction) => {
      const [cree] = await transaction
        .insert(comptes)
        .values({ pseudo: pseudo.valeur, reperePseudo: reperePseudo(pseudo.valeur) })
        .returning(COLONNES_COMPTE);

      if (cree === undefined) {
        throw new Error("La base n'a rendu aucune ligne pour le compte cree.");
      }

      await transaction.insert(progressions).values({ compteId: cree.id });

      return cree;
    });

    return { valide: true, valeur: compte };
  } catch (erreur) {
    const refus = erreurPostgres(erreur);

    if (
      refus?.code === CODES_POSTGRES.unicite &&
      refus.contrainte === 'comptes_repere_pseudo_unique'
    ) {
      return { valide: false, erreurs: [{ champ: 'pseudo', motif: 'Ce pseudo est déjà pris.' }] };
    }

    throw erreur;
  }
}

/** Le compte qui porte ce pseudo, quelle que soit la facon de l'ecrire. */
export async function trouverCompteParPseudo(
  db: BaseDeDonnees,
  pseudo: string,
): Promise<Compte | undefined> {
  const [compte] = await db
    .select(COLONNES_COMPTE)
    .from(comptes)
    .where(eq(comptes.reperePseudo, reperePseudo(pseudo)));

  return compte;
}
