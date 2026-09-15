/**
 * Reconnaitre ce que PostgreSQL a refuse.
 *
 * Une erreur de la base porte un code de cinq caracteres (23505 pour une valeur
 * deja prise, par exemple) et, le cas echeant, le nom de la contrainte en cause.
 * Drizzle enveloppe l'erreur du pilote dans la sienne: le code se trouve alors
 * dans la cause. Ce fichier va le chercher, pour que le reste du code distingue
 * un refus attendu (un pseudo deja pris) d'une panne.
 */

/** Les codes d'erreur de PostgreSQL que le serveur sait interpreter. */
export const CODES_POSTGRES = {
  /** Une valeur deja presente la ou elle doit etre unique. */
  unicite: '23505',
  /** Un lien vers une ligne qui n'existe pas. */
  cleEtrangere: '23503',
  /** La suppression d'une ligne encore referencee par un lien qui l'interdit. */
  restriction: '23001',
  /** Une valeur refusee par une contrainte de controle. */
  controle: '23514',
} as const;

/** Ce qu'on retient d'une erreur de PostgreSQL. */
export interface ErreurPostgres {
  readonly code: string;
  readonly contrainte: string | undefined;
}

/** Profondeur maximale des causes examinees. Il n'y a jamais plus de deux niveaux. */
const PROFONDEUR_MAXIMALE = 5;

/** Forme d'un code d'erreur SQL: cinq chiffres ou majuscules. */
const FORME_CODE = /^[0-9A-Z]{5}$/u;

/**
 * L'erreur de PostgreSQL contenue dans cette erreur, ou undefined s'il n'y en a
 * pas (une panne reseau, une faute du code).
 */
export function erreurPostgres(erreur: unknown): ErreurPostgres | undefined {
  let courante: unknown = erreur;

  for (let niveau = 0; niveau < PROFONDEUR_MAXIMALE; niveau += 1) {
    if (typeof courante !== 'object' || courante === null) {
      return undefined;
    }

    const { code, constraint, cause } = courante as {
      code?: unknown;
      constraint?: unknown;
      cause?: unknown;
    };

    if (typeof code === 'string' && FORME_CODE.test(code)) {
      return { code, contrainte: typeof constraint === 'string' ? constraint : undefined };
    }

    courante = cause;
  }

  return undefined;
}
