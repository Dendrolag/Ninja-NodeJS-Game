/**
 * Les points flottants: le gain de points montre la ou il a eu lieu, avant de
 * filer vers notre ligne du classement.
 *
 * C'EST LE RETOUR D'UN AFFICHAGE DU JEU D'ORIGINE, perdu au portage et releve a la
 * recette de l'etape 5.4 (createFloatingPoints, legacy/client.js:1155). Il servait
 * de preuve immediate: on voit le point naitre sous le ninja que l'on vient de
 * toucher, et rejoindre le score. Trois occasions, avec les regles d'origine:
 *
 *   - un faux ninja passe a notre couleur, et il n'appartenait a aucun joueur:
 *     un point, en blanc. Un ninja pris a un joueur ne se compte pas un a un, la
 *     capture le montre avec tous les autres (client.js:2531);
 *   - un Black Ninja detruit: ses points, en or, la ou il a ete detruit;
 *   - un joueur capture: les ninjas gagnes, en violet, la ou il se trouvait.
 *
 * FONCTIONS PURES, COMME LES ANNONCES. On leur donne deux etats successifs, elles
 * rendent les points a montrer, en coordonnees de carte. Les placer a l'ecran et
 * les animer est le travail de la boucle et de hud/pointsFlottants.ts.
 */

import type { EntiteVue } from '@neon-ninja/shared';

import type { EtatClient } from './etat.js';
import type { VuePartie } from './reconstruction.js';

/** D'ou viennent des points, ce qui decide de leur apparence. */
export type GenreDePoints =
  /** Un faux ninja rallie. */
  | 'bot'
  /** Un Black Ninja detruit. */
  | 'botNoir'
  /** Un joueur capture. */
  | 'joueur';

/** Des points a montrer, a un endroit de la carte. */
export interface PointsGagnes {
  readonly valeur: number;
  readonly genre: GenreDePoints;
  readonly x: number;
  readonly y: number;
}

/** Le texte d'un gain: avec son signe, sauf zero, comme dans le jeu d'origine. */
export function texteDesPoints(valeur: number): string {
  return valeur > 0 ? `+${String(valeur)}` : String(valeur);
}

/** Tous les points a montrer en passant d'un etat au suivant. */
export function pointsDuChangement(avant: EtatClient, apres: EtatClient): readonly PointsGagnes[] {
  return [
    ...pointsDesFaits(avant, apres),
    ...pointsDesRalliements(avant.partie, apres.partie, apres.moi),
  ];
}

/**
 * Les points annonces par les faits nouveaux: Black Ninja detruit, joueur capture.
 *
 * Le joueur capture est cherche dans l'etat d'AVANT: dans l'etat d'apres, il a
 * peut-etre deja reapparu a l'autre bout de la carte.
 */
function pointsDesFaits(avant: EtatClient, apres: EtatClient): readonly PointsGagnes[] {
  if (avant.journal === apres.journal) {
    return [];
  }

  const connus = new Set(avant.journal);
  const points: PointsGagnes[] = [];

  for (const fait of apres.journal) {
    if (connus.has(fait)) {
      continue;
    }

    if (fait.nature === 'botNoirDetruit') {
      const { points: valeur, x, y } = fait.charge;
      points.push({ valeur, genre: 'botNoir', x, y });
    }

    // En Chasse, attraper une proie ne rapporte aucun ninja: aucun point ne s'envole.
    if (fait.nature === 'captureReussie' && apres.salon?.mode !== 'chasse') {
      const victime = (avant.partie ?? apres.partie)?.entites.find(
        (entite) => entite.type === 'joueur' && entite.pseudo === fait.charge.victimePseudo,
      );

      if (victime !== undefined) {
        points.push({
          valeur: fait.charge.botsGagnes,
          genre: 'joueur',
          x: victime.x,
          y: victime.y,
        });
      }
    }
  }

  return points;
}

/** Un point par faux ninja neutre passe a notre couleur entre deux battements. */
function pointsDesRalliements(
  avant: VuePartie | undefined,
  apres: VuePartie | undefined,
  moi: string | undefined,
): readonly PointsGagnes[] {
  if (avant === undefined || apres === undefined || avant === apres) {
    return [];
  }

  const maCouleur = apres.entites.find((entite) => entite.id === moi)?.couleur;

  if (maCouleur === undefined) {
    return [];
  }

  const couleursDesJoueurs = new Set(
    avant.entites.filter((entite) => entite.type === 'joueur').map((entite) => entite.couleur),
  );
  const anciens = new Map<string, EntiteVue>(avant.entites.map((entite) => [entite.id, entite]));
  const points: PointsGagnes[] = [];

  for (const entite of apres.entites) {
    const ancien = anciens.get(entite.id);

    if (
      entite.type === 'bot' &&
      ancien !== undefined &&
      ancien.couleur !== maCouleur &&
      entite.couleur === maCouleur &&
      !couleursDesJoueurs.has(ancien.couleur)
    ) {
      points.push({ valeur: 1, genre: 'bot', x: entite.x, y: entite.y });
    }
  }

  return points;
}
