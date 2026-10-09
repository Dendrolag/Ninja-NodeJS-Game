/**
 * L'affichage des points flottants, pose dans le document au-dessus du terrain.
 *
 * AUCUNE REGLE ICI, comme dans la surcouche. Quels points montrer et ou se decide
 * dans src/pointsFlottants.ts et dans la boucle; ce fichier ne fait que les poser,
 * les animer et les retirer.
 *
 * DEUX TEMPS, CEUX DU JEU D'ORIGINE: le point monte au-dessus de l'endroit du
 * gain, puis file vers notre score et s'efface. La fin de chaque animation,
 * annoncee par le navigateur, declenche la suite: aucune minuterie a tenir ni a
 * annuler. La distance a parcourir se mesure au moment de filer, pas avant: le
 * classement a pu bouger pendant la montee.
 *
 * LE PALIER D'UN COMBO NE FILE PAS (9 octobre 2026): il nait au-dessus de notre ninja, monte
 * un peu et s'efface. Si un grand titre de bonus ou de malus occupe deja cette hauteur, ce
 * qui arrive sur un telephone tenu a l'horizontale, ou le titre descend pres du ninja, il se
 * pose sous notre ninja: les deux ne se couvrent jamais.
 */

import type { GenreDePoints } from '../pointsFlottants.js';

/** Un point a montrer, deja place sur l'ecran. */
export interface PointAAfficher {
  readonly texte: string;
  readonly genre: GenreDePoints;
  /** Le multiplicateur du combo, de un a cinq, qui decide de la couleur et de la taille. */
  readonly niveau: number;
  /** Position en pixels, dans le repere de l'element hote. */
  readonly x: number;
  readonly y: number;
}

/** Ce qu'il faut pour monter l'affichage. */
export interface OptionsPointsFlottants {
  /** L'element qui recoit les points, pose exactement sur le terrain. */
  readonly hote: HTMLElement;
  /** Le document a utiliser. Celui de la page par defaut. */
  readonly document?: Document;
  /** Notre score affiche, vers lequel filent les points. Rien s'il n'est pas affiche. */
  readonly cible: () => HTMLElement | null;
}

/** Un affichage de points monte. */
export interface AfficheurDePoints {
  /** Fait naitre un point. */
  montrer(point: PointAAfficher): void;
  /** Retire tout du document. */
  demonter(): void;
}

/** Monte l'affichage des points flottants dans l'element hote. */
export function monterPointsFlottants(options: OptionsPointsFlottants): AfficheurDePoints {
  const doc = options.document ?? document;
  const calque = doc.createElement('div');
  calque.className = 'points-flottants';
  options.hote.append(calque);

  return {
    montrer(point) {
      const element = doc.createElement('div');
      const palier = point.genre === 'combo';
      element.className = `point-flottant point-flottant-${point.genre} ${palier ? 'palier' : 'monte'}`;
      element.classList.toggle('dessous', palier && grandTitreAuDessus(doc, options.hote, point.y));
      // Le niveau du combo (etape 7.5): du blanc au magenta, de plus en plus grand.
      element.dataset['niveau'] = String(point.niveau);
      // textContent, et pas innerHTML: le texte ne doit jamais devenir du balisage.
      element.textContent = point.texte;
      element.style.left = `${String(point.x)}px`;
      element.style.top = `${String(point.y)}px`;

      element.addEventListener('animationend', () => {
        if (!palier && element.classList.contains('monte')) {
          filerVersLeScore(element, point, options);
        } else {
          element.remove();
        }
      });

      calque.append(element);
    },

    demonter() {
      calque.remove();
    },
  };
}

/**
 * La hauteur qu'occupe le palier d'un combo au-dessus du centre de notre ninja, en pixels: son
 * ecart, sa taille et sa montee, au plus grand cran.
 */
const HAUTEUR_DU_PALIER_PX = 120;

/**
 * Un grand titre (une annonce de bonus ou de malus, interface/composants/annonces.ts) occupe
 * deja la hauteur ou naitrait le palier d'un combo, au-dessus de ce point.
 */
function grandTitreAuDessus(doc: Document, hote: HTMLElement, y: number): boolean {
  const repere = hote.getBoundingClientRect();
  const bas = repere.top + y;
  const haut = bas - HAUTEUR_DU_PALIER_PX;

  return Array.from(doc.querySelectorAll('.grand-titre')).some((titre) => {
    const boite = titre.getBoundingClientRect();

    return boite.bottom > haut && boite.top < bas;
  });
}

/**
 * Lance la seconde animation: du haut de la montee jusqu'au milieu de notre score.
 * Sans score affiche, le point s'en va tout de suite.
 */
function filerVersLeScore(
  element: HTMLElement,
  point: PointAAfficher,
  options: OptionsPointsFlottants,
): void {
  const score = options.cible();

  if (score === null) {
    element.remove();
    return;
  }

  const repere = options.hote.getBoundingClientRect();
  const arrivee = score.getBoundingClientRect();

  element.style.setProperty(
    '--cible-x',
    `${String(arrivee.left + arrivee.width / 2 - repere.left - point.x)}px`,
  );
  element.style.setProperty(
    '--cible-y',
    `${String(arrivee.top + arrivee.height / 2 - repere.top - point.y)}px`,
  );
  element.classList.replace('monte', 'rejoint');
}
