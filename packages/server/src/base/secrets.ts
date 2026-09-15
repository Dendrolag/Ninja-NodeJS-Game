/**
 * Les secrets d'un compte en base: remplacer son mot de passe, son code de secours,
 * et fermer ses sessions (etape 3.4).
 *
 * CE FICHIER NE MANIPULE QUE DES EMPREINTES, comme sessions.ts: le hachage du mot de
 * passe, du code et du jeton est fait dans comptes/, avant d'arriver ici.
 *
 * CHAQUE REMPLACEMENT EST CONDITIONNEL. Un mot de passe n'est remplace que si son
 * empreinte est encore celle qui vient d'etre verifiee, un code que s'il est encore
 * celui qui vient d'etre presente. Deux demandes simultanees qui ont verifie le meme
 * secret n'aboutissent donc pas toutes les deux: c'est ce qui rend le code de
 * secours reellement a usage unique. La reponse dit si le remplacement a eu lieu.
 *
 * TOUT OU RIEN. Mot de passe, code et sessions changent dans une seule transaction:
 * un mot de passe change sans que les autres sessions soient fermees laisserait
 * l'intrus connecte, et un code consomme sans nouveau mot de passe ferait perdre
 * le compte.
 *
 * L'HEURE EST CELLE DE LA BASE (now()), comme pour les sessions et la progression.
 */

import { and, eq, ne, sql } from 'drizzle-orm';

import type { BaseDeDonnees } from './connexion.js';
import { codesDeSecours, comptes, motsDePasse, progressions, sessions } from './schema.js';

/** Ce qu'il faut pour verifier le mot de passe d'un compte connecte. */
export interface SecretsDuCompte {
  readonly pseudo: string;
  /** L'empreinte du mot de passe. Absente pour un compte sans mot de passe. */
  readonly empreinteMotDePasse: string | undefined;
}

/** Le pseudo et l'empreinte du mot de passe de ce compte, ou undefined s'il n'existe pas. */
export async function secretsDuCompte(
  db: BaseDeDonnees,
  compteId: string,
): Promise<SecretsDuCompte | undefined> {
  const [ligne] = await db
    .select({ pseudo: comptes.pseudo, empreinteMotDePasse: motsDePasse.empreinte })
    .from(comptes)
    .leftJoin(motsDePasse, eq(motsDePasse.compteId, comptes.id))
    .where(eq(comptes.id, compteId));

  return ligne === undefined
    ? undefined
    : { pseudo: ligne.pseudo, empreinteMotDePasse: ligne.empreinteMotDePasse ?? undefined };
}

/** Ce qu'il faut pour verifier le code de secours d'un compte designe par son pseudo. */
export interface CodeDuCompte {
  readonly compteId: string;
  readonly pseudo: string;
  /** L'XP totale, d'ou se deduit le niveau rendu avec la session. */
  readonly xpTotale: number;
  /** L'empreinte du code de secours. Absente pour un compte qui n'en a pas. */
  readonly empreinteCode: string | undefined;
}

/**
 * Le compte qui porte ce pseudo, quelle que soit son ecriture, et l'empreinte de son
 * code de secours, en une seule requete.
 */
export async function codeParPseudo(
  db: BaseDeDonnees,
  reperePseudo: string,
): Promise<CodeDuCompte | undefined> {
  const [ligne] = await db
    .select({
      compteId: comptes.id,
      pseudo: comptes.pseudo,
      xpTotale: progressions.xpTotale,
      empreinteCode: codesDeSecours.empreinte,
    })
    .from(comptes)
    .innerJoin(progressions, eq(progressions.compteId, comptes.id))
    .leftJoin(codesDeSecours, eq(codesDeSecours.compteId, comptes.id))
    .where(eq(comptes.reperePseudo, reperePseudo));

  return ligne === undefined
    ? undefined
    : { ...ligne, empreinteCode: ligne.empreinteCode ?? undefined };
}

/** Un changement de mot de passe, par un compte connecte. */
export interface ChangementDeMotDePasse {
  /** L'empreinte verifiee: le remplacement n'a lieu que si elle est toujours en place. */
  readonly ancienneEmpreinte: string;
  readonly nouvelleEmpreinte: string;
  /** L'empreinte du nouveau code de secours, qui remplace le precedent. */
  readonly empreinteCode: string;
  /** L'empreinte du jeton de la session qui demande: la seule qui reste ouverte. */
  readonly sessionGardee: string;
}

/**
 * Change le mot de passe d'un compte, remplace son code de secours et ferme toutes
 * ses autres sessions, en une seule transaction.
 *
 * @returns false si le mot de passe a change entre-temps: rien n'a ete ecrit.
 */
export async function remplacerMotDePasse(
  db: BaseDeDonnees,
  compteId: string,
  changement: ChangementDeMotDePasse,
): Promise<boolean> {
  return db.transaction(async (transaction) => {
    const remplaces = await transaction
      .update(motsDePasse)
      .set({ empreinte: changement.nouvelleEmpreinte, modifieLe: sql`now()` })
      .where(
        and(
          eq(motsDePasse.compteId, compteId),
          eq(motsDePasse.empreinte, changement.ancienneEmpreinte),
        ),
      )
      .returning({ compteId: motsDePasse.compteId });

    if (remplaces.length === 0) {
      return false;
    }

    await ecrireCode(transaction, compteId, changement.empreinteCode);
    await transaction
      .delete(sessions)
      .where(
        and(eq(sessions.compteId, compteId), ne(sessions.empreinteJeton, changement.sessionGardee)),
      );

    return true;
  });
}

/** Une reinitialisation du mot de passe par le code de secours. */
export interface Reinitialisation {
  /** L'empreinte du code presente: le remplacement n'a lieu que si elle est toujours en place. */
  readonly ancienCode: string;
  readonly nouveauCode: string;
  readonly empreinteMotDePasse: string;
}

/**
 * Consomme le code de secours d'un compte, en ecrit un nouveau, remplace son mot de
 * passe et ferme TOUTES ses sessions, en une seule transaction.
 *
 * Le mot de passe est ecrit qu'il y en ait deja un ou non: un compte sans mot de
 * passe, mais avec un code, en recoit un.
 *
 * @returns false si le code a deja servi: rien n'a ete ecrit.
 */
export async function consommerCodeDeSecours(
  db: BaseDeDonnees,
  compteId: string,
  reinitialisation: Reinitialisation,
): Promise<boolean> {
  return db.transaction(async (transaction) => {
    const consommes = await transaction
      .update(codesDeSecours)
      .set({ empreinte: reinitialisation.nouveauCode, creeLe: sql`now()` })
      .where(
        and(
          eq(codesDeSecours.compteId, compteId),
          eq(codesDeSecours.empreinte, reinitialisation.ancienCode),
        ),
      )
      .returning({ compteId: codesDeSecours.compteId });

    if (consommes.length === 0) {
      return false;
    }

    await transaction
      .insert(motsDePasse)
      .values({ compteId, empreinte: reinitialisation.empreinteMotDePasse })
      .onConflictDoUpdate({
        target: motsDePasse.compteId,
        set: { empreinte: reinitialisation.empreinteMotDePasse, modifieLe: sql`now()` },
      });
    await transaction.delete(sessions).where(eq(sessions.compteId, compteId));

    return true;
  });
}

/** Ecrit le code de secours d'un compte, a la place du precedent s'il en avait un. */
export async function remplacerCodeDeSecours(
  db: BaseDeDonnees,
  compteId: string,
  empreinteCode: string,
): Promise<void> {
  await ecrireCode(db, compteId, empreinteCode);
}

/** Ce qu'une ecriture accepte: la base, ou une transaction ouverte sur elle. */
type Ecrivain = Pick<BaseDeDonnees, 'insert'>;

/** Ecrit ou remplace le code d'un compte. */
async function ecrireCode(ecrivain: Ecrivain, compteId: string, empreinte: string): Promise<void> {
  await ecrivain
    .insert(codesDeSecours)
    .values({ compteId, empreinte })
    .onConflictDoUpdate({
      target: codesDeSecours.compteId,
      set: { empreinte, creeLe: sql`now()` },
    });
}
