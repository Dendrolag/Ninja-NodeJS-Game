/**
 * Les preferences de son du joueur, et leur lecture depuis le navigateur.
 *
 * UN REGLAGE LOCAL, QUI NE VOYAGE PAS. Le jeu d'origine faisait transiter le
 * volume choisi par le serveur (updateAudioSettings), qui n'en avait que faire.
 * Ici il reste dans le navigateur du joueur, comme le faisait deja le
 * gestionnaire audio d'origine avec son entree audioSettings.
 *
 * LA LECTURE NE FAIT JAMAIS CONFIANCE AU CONTENU. Le stockage du navigateur est
 * modifiable a la main, partage entre versions du jeu, et parfois vide. Chaque
 * valeur illisible ou hors de l'intervalle de zero a un est remplacee par sa
 * valeur par defaut, champ par champ: une preference abimee ne doit pas rendre le
 * jeu muet, ni l'empecher de demarrer.
 */

/** Ce que le joueur regle du son. */
export interface PreferencesSon {
  /** Volume de la musique, de zero a un. */
  readonly volumeMusique: number;
  /** Volume des effets, de zero a un. */
  readonly volumeSons: number;
  /** Tout le son est coupe. */
  readonly coupe: boolean;
}

/**
 * Les preferences d'un joueur qui n'a rien regle.
 *
 * Valeurs du jeu d'origine a son demarrage (client.js:240): la musique
 * discrete, les effets a mi-volume.
 */
export const PREFERENCES_SON_PAR_DEFAUT: PreferencesSon = {
  volumeMusique: 0.3,
  volumeSons: 0.5,
  coupe: false,
};

/** La cle sous laquelle les preferences sont rangees dans le navigateur. */
export const CLE_PREFERENCES_SON = 'neon-ninja.son';

/** Lit des preferences enregistrees, en remplacant tout ce qui est illisible. */
export function lirePreferencesSon(brut: string | null | undefined): PreferencesSon {
  if (brut === null || brut === undefined) {
    return PREFERENCES_SON_PAR_DEFAUT;
  }

  let lu: unknown;

  try {
    lu = JSON.parse(brut);
  } catch {
    return PREFERENCES_SON_PAR_DEFAUT;
  }

  if (typeof lu !== 'object' || lu === null) {
    return PREFERENCES_SON_PAR_DEFAUT;
  }

  const source = lu as Record<string, unknown>;

  return {
    volumeMusique: volume(source['volumeMusique'], PREFERENCES_SON_PAR_DEFAUT.volumeMusique),
    volumeSons: volume(source['volumeSons'], PREFERENCES_SON_PAR_DEFAUT.volumeSons),
    coupe:
      typeof source['coupe'] === 'boolean' ? source['coupe'] : PREFERENCES_SON_PAR_DEFAUT.coupe,
  };
}

/** Met des preferences sous la forme ou elles sont rangees. */
export function ecrirePreferencesSon(preferences: PreferencesSon): string {
  return JSON.stringify(preferences);
}

/** Un volume lisible, ou la valeur par defaut. */
function volume(valeur: unknown, parDefaut: number): number {
  return typeof valeur === 'number' && Number.isFinite(valeur) && valeur >= 0 && valeur <= 1
    ? valeur
    : parDefaut;
}

/**
 * Ce que le joueur voit du sang, dans le mode Massacre (etape 7.4).
 *
 * Decision du porteur du projet du 16 septembre 2026: chacun choisit pour lui, sans rien
 * changer au jeu. Normal: les eclaboussures restent au sol, et les joueurs y impriment
 * leurs pas. Discret: de petites taches qui s'effacent, et aucun pas. Desactive: un eclat
 * lumineux seul a chaque mort.
 */
export const NIVEAUX_DE_SANG = ['normal', 'discret', 'desactive'] as const;

/** Un niveau de sang. */
export type NiveauDeSang = (typeof NIVEAUX_DE_SANG)[number];

/** Le sang d'un joueur qui n'a rien regle. */
export const NIVEAU_DE_SANG_PAR_DEFAUT: NiveauDeSang = 'normal';

/** La cle sous laquelle le niveau de sang est range dans le navigateur. */
export const CLE_PREFERENCE_SANG = 'neon-ninja.sang';

/** Lit un niveau de sang enregistre: tout ce qui n'en est pas un vaut le niveau par defaut. */
export function lireNiveauDeSang(brut: string | null | undefined): NiveauDeSang {
  return NIVEAUX_DE_SANG.find((niveau) => niveau === brut) ?? NIVEAU_DE_SANG_PAR_DEFAUT;
}
