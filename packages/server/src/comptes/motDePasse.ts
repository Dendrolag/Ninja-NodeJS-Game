/**
 * Le hachage des mots de passe.
 *
 * UN MOT DE PASSE NE SE STOCKE JAMAIS, SEULE SON EMPREINTE SE STOCKE. L'empreinte
 * permet de verifier un mot de passe propose, et pas de retrouver le mot de passe:
 * une base volee ne livre donc aucun mot de passe en clair.
 *
 * SCRYPT, DE node:crypto. C'est un algorithme concu pour etre couteux en calcul
 * ET en memoire, ce qui rend les essais en masse lents meme sur des cartes
 * graphiques. Il est fourni par Node lui-meme: aucune dependance a ajouter, a
 * compiler pour chaque systeme et a surveiller (faille S5 de l'audit). Argon2id,
 * l'autre choix recommande, demande un module natif.
 *
 * LES PARAMETRES sont l'une des combinaisons recommandees par l'OWASP pour
 * scrypt: N = 2^15, r = 8, p = 3. Environ 32 Mo de memoire et une centaine de
 * millisecondes par hachage sur un processeur courant: imperceptible pour une
 * connexion, ruineux pour qui essaie des millions de mots de passe.
 *
 * L'EMPREINTE DECRIT SA PROPRE RECETTE: « scrypt$N$r$p$sel$empreinte ». Le jour
 * ou les parametres montent, les empreintes existantes se verifient encore avec
 * les leurs, et les nouvelles prennent les nouveaux. Le sel, seize octets tires
 * au hasard par empreinte, empeche de reconnaitre deux comptes au meme mot de
 * passe et de preparer des tables a l'avance.
 */

import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

/** Les parametres de scrypt. */
export interface ParametresScrypt {
  /** Cout en calcul et en memoire. Une puissance de deux. */
  readonly N: number;
  /** Taille de bloc. */
  readonly r: number;
  /** Parallelisme: Node calcule les passes l'une apres l'autre, le temps se multiplie. */
  readonly p: number;
}

/** Les parametres des nouvelles empreintes. */
export const PARAMETRES_SCRYPT: ParametresScrypt = { N: 2 ** 15, r: 8, p: 3 };

/** Longueur du sel, en octets. */
const LONGUEUR_SEL = 16;

/** Longueur de l'empreinte, en octets. */
const LONGUEUR_EMPREINTE = 32;

/**
 * Plafond de memoire accorde a scrypt, en octets.
 *
 * Node refuse par defaut de depasser 32 Mo, et scrypt en demande 128 * N * r,
 * soit un peu plus avec ces parametres. 64 Mo laissent la marge.
 */
const MEMOIRE_MAXIMUM = 64 * 1024 * 1024;

/** Le prefixe qui nomme l'algorithme dans une empreinte. */
const ALGORITHME = 'scrypt';

/**
 * Calcule l'empreinte d'un mot de passe, a stocker a sa place.
 *
 * @param motDePasse Le mot de passe, deja valide (et donc en composition Unicode).
 * @param parametres Les parametres de scrypt. Ceux du projet par defaut.
 */
export async function hacherMotDePasse(
  motDePasse: string,
  parametres: ParametresScrypt = PARAMETRES_SCRYPT,
): Promise<string> {
  const sel = randomBytes(LONGUEUR_SEL);
  const empreinte = await deriver(motDePasse, sel, parametres);

  return [
    ALGORITHME,
    String(parametres.N),
    String(parametres.r),
    String(parametres.p),
    sel.toString('base64'),
    empreinte.toString('base64'),
  ].join('$');
}

/**
 * Ce mot de passe correspond-il a cette empreinte.
 *
 * La comparaison se fait en temps constant: une comparaison ordinaire s'arrete au
 * premier octet different, et le temps de reponse renseignerait sur la
 * ressemblance.
 *
 * @throws Si l'empreinte n'a pas la forme de celles que ce module ecrit: elle
 *         vient de la base, ce serait une faute du serveur, pas une reponse.
 */
export async function verifierMotDePasse(motDePasse: string, empreinte: string): Promise<boolean> {
  const recette = lireEmpreinte(empreinte);
  const calculee = await deriver(motDePasse, recette.sel, recette.parametres);

  return (
    calculee.length === recette.empreinte.length && timingSafeEqual(calculee, recette.empreinte)
  );
}

/** Les morceaux d'une empreinte. */
interface Recette {
  readonly parametres: ParametresScrypt;
  readonly sel: Buffer;
  readonly empreinte: Buffer;
}

/** Relit une empreinte ecrite par hacherMotDePasse. */
function lireEmpreinte(texte: string): Recette {
  const morceaux = texte.split('$');
  const [algorithme, N, r, p, sel, empreinte] = morceaux;

  if (
    morceaux.length !== 6 ||
    algorithme !== ALGORITHME ||
    sel === undefined ||
    empreinte === undefined
  ) {
    throw new Error("Empreinte de mot de passe illisible: ce n'est pas une empreinte scrypt.");
  }

  const parametres = { N: Number(N), r: Number(r), p: Number(p) };

  if (![parametres.N, parametres.r, parametres.p].every((n) => Number.isInteger(n) && n > 0)) {
    throw new Error('Empreinte de mot de passe illisible: parametres invalides.');
  }

  return {
    parametres,
    sel: Buffer.from(sel, 'base64'),
    empreinte: Buffer.from(empreinte, 'base64'),
  };
}

/** Derive l'empreinte d'un mot de passe avec ce sel et ces parametres. */
async function deriver(
  motDePasse: string,
  sel: Buffer,
  parametres: ParametresScrypt,
): Promise<Buffer> {
  return new Promise((resoudre, rejeter) => {
    scrypt(
      motDePasse,
      sel,
      LONGUEUR_EMPREINTE,
      { ...parametres, maxmem: MEMOIRE_MAXIMUM },
      (erreur, cle) => {
        if (erreur === null) {
          resoudre(cle);
        } else {
          rejeter(erreur);
        }
      },
    );
  });
}
