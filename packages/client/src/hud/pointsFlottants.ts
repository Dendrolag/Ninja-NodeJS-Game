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
 */

import type { GenreDePoints } from '../pointsFlottants.js';

/** Un point a montrer, deja place sur l'ecran. */
export interface PointAAfficher {
  readonly texte: string;
  readonly genre: GenreDePoints;
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
      element.className = `point-flottant point-flottant-${point.genre} monte`;
      // textContent, et pas innerHTML: le texte ne doit jamais devenir du balisage.
      element.textContent = point.texte;
      element.style.left = `${String(point.x)}px`;
      element.style.top = `${String(point.y)}px`;

      element.addEventListener('animationend', () => {
        if (element.classList.contains('monte')) {
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
