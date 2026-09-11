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
import type { ValeursProgression } from './progression.js';
import { comptes, motsDePasse, progressions } from './schema.js';

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

/** Ce qui accompagne, au besoin, la creation d'un compte. */
export interface OptionsCreationCompte {
  /**
   * L'empreinte du mot de passe, deja calculee (etape 3.2).
   *
   * Ecrite dans la meme transaction que le compte: il n'existe jamais de compte
   * inscrit par mot de passe qui n'en aurait pas. Absente, le compte n'a pas de
   * mot de passe, ce que le schema permet (voir motsDePasse).
   */
  readonly empreinteMotDePasse?: string;
}

/**
 * Cree un compte et sa progression, a partir du pseudo tel que le joueur l'a saisi.
 *
 * Le pseudo est valide par la meme fonction qu'a l'entree dans un salon.
 */
export async function creerCompte(
  db: BaseDeDonnees,
  pseudoSaisi: unknown,
  options: OptionsCreationCompte = {},
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

      if (options.empreinteMotDePasse !== undefined) {
        await transaction
          .insert(motsDePasse)
          .values({ compteId: cree.id, empreinte: options.empreinteMotDePasse });
      }

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

/** Ce qu'il faut pour verifier la connexion a un compte. */
export interface Identifiants {
  readonly compteId: string;
  readonly pseudo: string;
  /** L'empreinte du mot de passe. Absente pour un compte sans mot de passe. */
  readonly empreinte: string | undefined;
  /** L'XP totale, d'ou se deduit le niveau rendu a la connexion. */
  readonly xpTotale: number;
}

/**
 * Les identifiants du compte qui porte ce pseudo, en une seule requete.
 *
 * Le mot de passe est joint a gauche: un compte sans mot de passe est rendu, avec
 * une empreinte absente, et c'est a l'appelant de refuser la connexion.
 */
export async function identifiantsParPseudo(
  db: BaseDeDonnees,
  pseudo: string,
): Promise<Identifiants | undefined> {
  const [ligne] = await db
    .select({
      compteId: comptes.id,
      pseudo: comptes.pseudo,
      empreinte: motsDePasse.empreinte,
      xpTotale: progressions.xpTotale,
    })
    .from(comptes)
    .innerJoin(progressions, eq(progressions.compteId, comptes.id))
    .leftJoin(motsDePasse, eq(motsDePasse.compteId, comptes.id))
    .where(eq(comptes.reperePseudo, reperePseudo(pseudo)));

  return ligne === undefined ? undefined : { ...ligne, empreinte: ligne.empreinte ?? undefined };
}

/** Un compte et sa progression, lus ensemble. */
export interface Profil extends Compte, ValeursProgression {}

/** Le compte et la progression de cet identifiant, ou undefined s'il n'existe pas. */
export async function profilDuCompte(
  db: BaseDeDonnees,
  compteId: string,
): Promise<Profil | undefined> {
  const [profil] = await db
    .select({
      ...COLONNES_COMPTE,
      xpTotale: progressions.xpTotale,
      pieces: progressions.pieces,
      pointsLigue: progressions.pointsLigue,
    })
    .from(comptes)
    .innerJoin(progressions, eq(progressions.compteId, comptes.id))
    .where(eq(comptes.id, compteId));

  return profil;
}
