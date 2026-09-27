/**
 * Le titre d'un compte en base (etape 3.9): le choisir parmi ses succes obtenus, ou le
 * retirer. Il se lit avec le compte (base/comptes.ts), sans requete de plus.
 *
 * UNE SEULE ECRITURE, CONDITIONNELLE. Choisir n'ecrit que si le succes est inscrit pour
 * ce compte: l'insertion prend sa ligne dans `succes_debloques`, et n'insere rien si elle
 * n'y est pas. Rien n'est lu avant d'ecrire, si bien que deux choix simultanes ne laissent
 * jamais un titre non obtenu. La cle etrangere de la table le garantit de toute facon:
 * ce fichier ne fait que dire si le choix a pris.
 */

import type { IdentifiantSucces } from '@neon-ninja/shared';
import { and, eq } from 'drizzle-orm';

import type { BaseDeDonnees } from './connexion.js';
import { succesDebloques, titres } from './schema.js';

/**
 * Fait de ce succes le titre du compte, a la place du precedent.
 *
 * @returns Faux si le compte n'a pas obtenu ce succes: rien n'a change.
 */
export async function choisirLeTitre(
  db: BaseDeDonnees,
  compteId: string,
  succes: IdentifiantSucces,
): Promise<boolean> {
  const choisi = await db
    .insert(titres)
    .select(
      // Le couple (compte, succes) est la cle primaire de succes_debloques: une ligne,
      // ou aucune.
      db
        .select({ compteId: succesDebloques.compteId, succes: succesDebloques.succes })
        .from(succesDebloques)
        .where(and(eq(succesDebloques.compteId, compteId), eq(succesDebloques.succes, succes))),
    )
    .onConflictDoUpdate({ target: titres.compteId, set: { succes } })
    .returning({ compteId: titres.compteId });

  return choisi.length > 0;
}

/** Retire le titre du compte. Sans titre, ne fait rien. */
export async function retirerLeTitre(db: BaseDeDonnees, compteId: string): Promise<void> {
  await db.delete(titres).where(eq(titres.compteId, compteId));
}
