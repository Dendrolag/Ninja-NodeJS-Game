/**
 * Les branches Neon des tests: en creer une, attendre qu'elle soit prete, la
 * supprimer.
 *
 * Une branche Neon est une base a part, creee en une seconde a partir d'une autre.
 * Chaque execution des tests de la base a la sienne, supprimee a la fin: rien ne
 * passe d'une execution a l'autre, et deux executions simultanees (deux poussees
 * en CI) ne se voient pas.
 *
 * DEUX PRECAUTIONS.
 *
 *   1. La branche est creee SANS LES DONNEES de sa parente: aucune donnee de la
 *      base principale n'arrive dans un test.
 *   2. Elle porte une date d'expiration. Si le processus meurt avant de la
 *      supprimer, Neon la supprime lui-meme. Le plan gratuit limite un projet a
 *      dix branches: des branches oubliees finiraient par empecher les tests de
 *      tourner.
 *
 * La cle d'API n'apparait dans aucun message d'erreur.
 */

const API_NEON = 'https://console.neon.tech/api/v2';

/** Attente entre deux essais, en millisecondes. */
const PAS_D_ATTENTE_MS = 1_000;

/** Nombre d'essais quand Neon repond que le projet est occupe par une operation. */
const ESSAIS_SI_OCCUPE = 30;

/** De quoi parler a l'API Neon pour un projet. */
export interface AccesNeon {
  readonly cleApi: string;
  readonly projet: string;
}

/** Une branche creee pour les tests. */
export interface BrancheNeon {
  readonly id: string;
  readonly nom: string;
  /** Adresse directe de la base de la branche, mot de passe compris. */
  readonly adresse: string;
}

/** Un refus de l'API Neon, avec son statut HTTP. */
export class ErreurNeon extends Error {
  constructor(
    readonly statut: number,
    message: string,
  ) {
    super(message);
    this.name = 'ErreurNeon';
  }
}

/** La forme, partielle, de ce que l'API rend pour une branche. */
interface ReponseBranche {
  readonly branch?: { readonly id?: unknown; readonly current_state?: unknown };
  readonly connection_uris?: readonly { readonly connection_uri?: unknown }[];
}

/** L'acces a Neon depuis les variables d'environnement, ou undefined s'il manque. */
export function accesNeonDepuisEnvironnement(): AccesNeon | undefined {
  const cleApi = process.env['NEON_API_KEY'] ?? '';
  const projet = process.env['NEON_PROJECT_ID'] ?? '';

  return cleApi !== '' && projet !== '' ? { cleApi, projet } : undefined;
}

/**
 * Cree une branche vide de donnees, qui expirera d'elle-meme apres cette duree.
 */
export async function creerBranche(
  acces: AccesNeon,
  nom: string,
  dureeDeVieMs: number,
): Promise<BrancheNeon> {
  // L'API attend une date sans millisecondes.
  const expiration = new Date(Date.now() + dureeDeVieMs).toISOString().replace(/\.\d{3}Z$/u, 'Z');

  const reponse = (await appelerNeon(acces, 'POST', '/branches', {
    branch: { name: nom, init_source: 'schema-only', expires_at: expiration },
    endpoints: [{ type: 'read_write' }],
  })) as ReponseBranche;

  const id = reponse.branch?.id;
  const adresse = reponse.connection_uris?.[0]?.connection_uri;

  if (typeof id !== 'string' || typeof adresse !== 'string') {
    throw new Error("L'API Neon n'a rendu ni l'identifiant ni l'adresse de la branche creee.");
  }

  return { id, nom, adresse };
}

/** Attend que la branche soit prete, ou leve apres ce delai. */
export async function attendreBranche(
  acces: AccesNeon,
  id: string,
  delaiMaximumMs: number,
): Promise<void> {
  const limite = Date.now() + delaiMaximumMs;

  while (Date.now() < limite) {
    const reponse = (await appelerNeon(
      acces,
      'GET',
      `/branches/${encodeURIComponent(id)}`,
    )) as ReponseBranche;

    if (reponse.branch?.current_state === 'ready') {
      return;
    }

    await attendre(PAS_D_ATTENTE_MS);
  }

  throw new Error(`La branche Neon ${id} n'est pas prete apres ${delaiMaximumMs / 1_000} s.`);
}

/** Supprime la branche. Une branche deja supprimee (ou expiree) n'est pas une erreur. */
export async function supprimerBranche(acces: AccesNeon, id: string): Promise<void> {
  try {
    await appelerNeon(acces, 'DELETE', `/branches/${encodeURIComponent(id)}`);
  } catch (erreur) {
    if (erreur instanceof ErreurNeon && erreur.statut === 404) {
      return;
    }

    throw erreur;
  }
}

/**
 * Un appel a l'API Neon pour ce projet.
 *
 * Neon refuse avec le statut 423 une demande qui arrive pendant qu'une operation
 * tourne encore sur le projet (la creation de la branche, par exemple): on
 * reessaie alors.
 */
async function appelerNeon(
  acces: AccesNeon,
  methode: 'GET' | 'POST' | 'DELETE',
  chemin: string,
  corps?: unknown,
): Promise<unknown> {
  const adresse = `${API_NEON}/projects/${encodeURIComponent(acces.projet)}${chemin}`;
  const enTetes: Record<string, string> = {
    Authorization: `Bearer ${acces.cleApi}`,
    Accept: 'application/json',
  };

  if (corps !== undefined) {
    enTetes['Content-Type'] = 'application/json';
  }

  for (let essai = 1; ; essai += 1) {
    const reponse = await fetch(adresse, {
      method: methode,
      headers: enTetes,
      ...(corps === undefined ? {} : { body: JSON.stringify(corps) }),
    });

    if (reponse.ok) {
      return reponse.json();
    }

    if (reponse.status === 423 && essai < ESSAIS_SI_OCCUPE) {
      await attendre(PAS_D_ATTENTE_MS);
      continue;
    }

    const detail = (await reponse.text()).slice(0, 300);
    throw new ErreurNeon(
      reponse.status,
      `L'API Neon a refuse ${methode} ${chemin} (statut ${reponse.status}): ${detail}`,
    );
  }
}

/** Une pause, en millisecondes. */
function attendre(ms: number): Promise<void> {
  return new Promise((resoudre) => {
    setTimeout(resoudre, ms);
  });
}
