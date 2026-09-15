/**
 * Ce que partagent les tests de la base.
 *
 * L'adresse de la branche Neon de l'execution, preparee par branche-de-test.ts,
 * et quelques outils. Les tests d'une meme execution partagent cette base et
 * tournent en parallele: chacun cree ses propres comptes, sous des pseudos neufs,
 * et ne compte jamais sur ce que la base contient d'autre.
 */

import { randomInt } from 'node:crypto';

import type { BaseDeDonnees, BaseOuverte } from '@neon-ninja/server';
import { ouvrirBase } from '@neon-ninja/server';
import type { ResultatValidation } from '@neon-ninja/shared';
import { afterAll, beforeAll, inject } from 'vitest';

declare module 'vitest' {
  export interface ProvidedContext {
    /** Adresse par le pooler de la branche de l'execution. Vide: pas de base. */
    adresseBase: string;
  }
}

/** L'adresse de la base de test. */
export function adresseBase(): string {
  return inject('adresseBase');
}

/** Les tests de la base peuvent-ils tourner. */
export function baseDisponible(): boolean {
  return adresseBase() !== '';
}

/**
 * Ouvre la base pour les tests du fichier, et la referme apres eux.
 *
 * A appeler dans un describe. Rend une fonction, parce que la base n'est ouverte
 * qu'au moment ou les tests commencent.
 */
export function baseDeTest(): () => BaseDeDonnees {
  let base: BaseOuverte | undefined;

  beforeAll(() => {
    base = ouvrirBase(adresseBase(), { maximumConnexions: 2 });
  });

  afterAll(async () => {
    await base?.fermer();
  });

  return () => {
    if (base === undefined) {
      throw new Error("La base de test n'est pas ouverte: appeler baseDeTest dans un describe.");
    }

    return base.db;
  };
}

/** Un pseudo que personne n'a encore pris: le prefixe suivi de sept chiffres. */
export function pseudoNeuf(prefixe: string): string {
  return `${prefixe}${randomInt(1_000_000, 10_000_000)}`;
}

/** La valeur d'un resultat accepte, ou un echec de test explicite. */
export function accepte<T>(resultat: ResultatValidation<T>): T {
  if (!resultat.valide) {
    throw new Error(
      `Attendu accepte, recu refuse: ${resultat.erreurs.map((e) => `${e.champ} ${e.motif}`).join(' | ')}`,
    );
  }

  return resultat.valeur;
}

/** L'erreur levee par cette operation, ou un echec de test si elle a reussi. */
export async function erreurDe(operation: Promise<unknown>): Promise<unknown> {
  try {
    await operation;
  } catch (erreur) {
    return erreur;
  }

  throw new Error('Attendu un refus, recu un succes.');
}
