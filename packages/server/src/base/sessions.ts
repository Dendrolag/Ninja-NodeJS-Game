/**
 * Les sessions de compte en base: les ouvrir, les retrouver, les fermer.
 *
 * Ce fichier ne manipule que des EMPREINTES de jetons, jamais les jetons: c'est
 * comptes/jetons.ts qui les fabrique et en tire l'empreinte. Ce qui est ecrit ici
 * ne permet donc a personne de se connecter.
 *
 * L'HEURE EST CELLE DE LA BASE. L'expiration est calculee et comparee par
 * PostgreSQL (now()), comme l'heure de mise a jour de la progression: deux
 * serveurs dont les horloges different d'une minute ne peuvent pas diverger sur la
 * question de savoir si une session est encore ouverte.
 */

import { and, eq, gt, lte, sql } from 'drizzle-orm';

import type { BaseDeDonnees } from './connexion.js';
import { sessions } from './schema.js';

/**
 * Ouvre une session pour ce compte, valable pendant la duree donnee.
 *
 * Les sessions expirees de tous les comptes sont effacees au passage. Elles
 * n'ouvrent plus rien, mais sans ce menage, la table grossirait des sessions de
 * tous ceux qui ne reviennent jamais. L'index sur l'expiration rend ce menage
 * peu couteux.
 */
export async function ouvrirSession(
  db: BaseDeDonnees,
  compteId: string,
  empreinteJeton: string,
  dureeMs: number,
): Promise<void> {
  if (!Number.isFinite(dureeMs) || dureeMs <= 0) {
    throw new Error(`La duree d'une session doit etre positive, recu ${String(dureeMs)}.`);
  }

  await db.delete(sessions).where(lte(sessions.expireLe, sql`now()`));
  await db.insert(sessions).values({
    empreinteJeton,
    compteId,
    expireLe: sql`now() + make_interval(secs => ${dureeMs / 1000})`,
  });
}

/** Le compte dont cette empreinte ouvre une session encore valable, ou undefined. */
export async function compteDeLaSession(
  db: BaseDeDonnees,
  empreinteJeton: string,
): Promise<string | undefined> {
  const [session] = await db
    .select({ compteId: sessions.compteId })
    .from(sessions)
    .where(and(eq(sessions.empreinteJeton, empreinteJeton), gt(sessions.expireLe, sql`now()`)));

  return session?.compteId;
}

/** Ferme la session de cette empreinte. Fermer une session deja fermee ne fait rien. */
export async function fermerSession(db: BaseDeDonnees, empreinteJeton: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.empreinteJeton, empreinteJeton));
}
