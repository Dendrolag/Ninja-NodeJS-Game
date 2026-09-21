/**
 * Le relevé de performance est-il demandé, et avec quelles variantes (étape 8.5).
 *
 * IL NE S'OUVRE QUE PAR L'ADRESSE. Sans `?diagnostic=1`, cette fonction ne rend rien, et
 * rien du relevé n'existe dans la page: ni affichage, ni mesure, ni coût. Les variantes
 * ne valent qu'avec lui: une adresse partagée qui porterait `densite=1` seul ne change
 * rien au jeu de qui l'ouvre.
 *
 * LES VARIANTES SERVENT À DÉPARTAGER LES HYPOTHÈSES DE L'AUDIT sans remettre le jeu en
 * ligne: chacune retire ou change une seule chose, et le relevé écrit lesquelles étaient
 * en place. Une valeur absente ou illisible laisse le réglage du jeu.
 *
 *     ?diagnostic=1                 le jeu tel quel, mesuré
 *     &rendu=webgl ou webgpu        le dos de rendu demandé à PixiJS
 *     &densite=1                    la densité de rendu, de 0,5 à 4
 *     &cadence=60                   la cadence plafonnée, de 10 à 240 images par seconde
 *     &son=0                        sans aucun son ni musique
 *     &lueur=0                      sans le filtre de lueur des repères
 *     &hud=0                        sans le HUD ni les points gagnés
 *     &flou=0                       sans les fonds floutés de l'interface
 */

/** Les variantes du jeu que le relevé peut essayer. */
export interface Variantes {
  /** Le dos de rendu demandé. Absent: le choix de PixiJS. */
  readonly rendu?: 'webgl' | 'webgpu';
  /** La densité de rendu imposée. Absente: celle de l'écran, plafonnée (apparence.ts). */
  readonly densite?: number;
  /** La cadence plafonnée, en images par seconde. Absente: celle du navigateur. */
  readonly cadence?: number;
  /** Le son joue-t-il. */
  readonly son: boolean;
  /** Le filtre de lueur est-il posé. */
  readonly lueur: boolean;
  /** Le HUD est-il affiché. */
  readonly hud: boolean;
  /** Les fonds floutés de l'interface sont-ils gardés. */
  readonly flou: boolean;
}

/** Les bornes d'une densité acceptée. */
const DENSITE = { min: 0.5, max: 4 } as const;

/** Les bornes d'une cadence acceptée, en images par seconde. */
const CADENCE = { min: 10, max: 240 } as const;

/**
 * Les variantes demandées par cette adresse, ou rien si le relevé n'est pas demandé.
 *
 * @param recherche La partie de l'adresse qui suit le point d'interrogation, avec lui.
 */
export function lireLaDemande(recherche: string): Variantes | undefined {
  const parametres = new URLSearchParams(recherche);

  if (parametres.get('diagnostic') !== '1') {
    return undefined;
  }

  const rendu = parametres.get('rendu');
  const densite = nombreBorne(parametres.get('densite'), DENSITE);
  const cadence = nombreBorne(parametres.get('cadence'), CADENCE);

  return {
    ...(rendu === 'webgl' || rendu === 'webgpu' ? { rendu } : {}),
    ...(densite === undefined ? {} : { densite }),
    ...(cadence === undefined ? {} : { cadence }),
    son: parametres.get('son') !== '0',
    lueur: parametres.get('lueur') !== '0',
    hud: parametres.get('hud') !== '0',
    flou: parametres.get('flou') !== '0',
  };
}

/** Les variantes en place, en une ligne: « aucune » quand le jeu est tel quel. */
export function decrireLesVariantes(variantes: Variantes): string {
  const parties = [
    variantes.rendu === undefined ? undefined : `rendu ${variantes.rendu}`,
    variantes.densite === undefined ? undefined : `densité ${String(variantes.densite)}`,
    variantes.cadence === undefined ? undefined : `cadence ${String(variantes.cadence)}`,
    variantes.son ? undefined : 'sans son',
    variantes.lueur ? undefined : 'sans lueur',
    variantes.hud ? undefined : 'sans HUD',
    variantes.flou ? undefined : 'sans flou',
  ].filter((partie) => partie !== undefined);

  return parties.length === 0 ? 'aucune' : parties.join(', ');
}

/** Un nombre lu dans l'adresse, s'il est entre ces bornes. */
function nombreBorne(
  texte: string | null,
  bornes: { readonly min: number; readonly max: number },
): number | undefined {
  if (texte === null || texte.trim() === '') {
    return undefined;
  }

  const valeur = Number(texte);

  return Number.isFinite(valeur) && valeur >= bornes.min && valeur <= bornes.max
    ? valeur
    : undefined;
}
