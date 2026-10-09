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
 * LA MINE (etape 7.11) en ajoute deux: ce qu'elle rapporte a son poseur, la ou elle a saute,
 * en or quand elle detruit des Black Ninjas, en violet quand elle tue en Massacre; et, en
 * Horde, les ninjas qu'elle nous fait perdre, en rouge et en negatif, sous notre ninja.
 *
 * LA HORDE (etape 7.5) remplace la premiere occasion par ses ralliements, que le serveur
 * annonce avec le multiplicateur du combo: le point y vaut ce multiplicateur, et monte en
 * couleur et en taille avec lui, comme les morts du Massacre.
 *
 * LES PALIERS DE COMBO (9 octobre 2026, a la demande du porteur du projet) flottent au-dessus
 * de notre ninja, « Combo x3 », quand un ralliement de la Horde ou un coup de katana du
 * Massacre fait monter notre multiplicateur d'un cran. Avant, une bulle les annoncait en haut
 * de l'ecran.
 *
 * FONCTIONS PURES, COMME LES ANNONCES. On leur donne deux etats successifs, elles
 * rendent les points a montrer, en coordonnees de carte. Les placer a l'ecran et
 * les animer est le travail de la boucle et de hud/pointsFlottants.ts.
 */

import type { EntiteVue } from '@neon-ninja/shared';
import { MASSACRE, multiplicateurDuCombo } from '@neon-ninja/shared';

import type { EtatClient } from './etat.js';
import type { FaitDeJeu } from './faits.js';
import { faitsArrives } from './faits.js';
import type { VuePartie } from './reconstruction.js';

/** D'ou viennent des points, ce qui decide de leur apparence. */
export type GenreDePoints =
  /** Un faux ninja rallie. */
  | 'bot'
  /** Un Black Ninja detruit. */
  | 'botNoir'
  /** Un joueur capture. */
  | 'joueur'
  /** Des ninjas qu'une mine vient de nous faire perdre, en Horde (etape 7.11). */
  | 'perte'
  /** Notre combo passe un palier: sa valeur est le nouveau multiplicateur. */
  | 'combo';

/** Des points a montrer, a un endroit de la carte. */
export interface PointsGagnes {
  readonly valeur: number;
  readonly genre: GenreDePoints;
  /**
   * Le multiplicateur du combo qui les a rapportes, de un a cinq: la couleur et la taille
   * du point montent avec lui (etape 7.5). Un hors de tout combo.
   */
  readonly niveau: number;
  readonly x: number;
  readonly y: number;
}

/** Le texte d'un gain: avec son signe, sauf zero, comme dans le jeu d'origine. */
export function texteDesPoints(valeur: number): string {
  return valeur > 0 ? `+${String(valeur)}` : String(valeur);
}

/** Le texte a montrer pour des points: le palier d'un combo, ou le gain lui-meme. */
export function texteDuGain(gain: Pick<PointsGagnes, 'valeur' | 'genre'>): string {
  return gain.genre === 'combo' ? `Combo x${String(gain.valeur)}` : texteDesPoints(gain.valeur);
}

/** Tous les points a montrer en passant d'un etat au suivant. */
export function pointsDuChangement(avant: EtatClient, apres: EtatClient): readonly PointsGagnes[] {
  // La Horde (etape 7.5) annonce ses ralliements, avec leur multiplicateur: ses points
  // viennent des faits, pas des couleurs.
  return apres.salon?.mode === 'classique'
    ? pointsDesFaits(avant, apres)
    : [
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
  const points: PointsGagnes[] = [];

  for (const fait of faitsArrives(avant.journal, apres.journal)) {
    // Le Massacre (etape 7.4): chaque mort de notre coup de katana, la ou elle est tombee,
    // et les points voles a un joueur tue, la ou il se trouvait.
    if (fait.nature === 'coupDeKatana' && fait.charge.frappeur === apres.moi) {
      for (const mort of fait.charge.morts) {
        points.push({
          valeur: mort.points,
          genre: mort.noir ? 'botNoir' : 'bot',
          // Le multiplicateur de cette mort-la: un meme coup peut franchir un palier.
          niveau:
            mort.points / (mort.noir ? MASSACRE.POINTS_PAR_BOT_NOIR : MASSACRE.POINTS_PAR_BOT),
          x: mort.x,
          y: mort.y,
        });
      }
    }

    // La Horde (etape 7.5): chaque ninja que nous avons rallie vaut son multiplicateur, le
    // ninja lui-meme plus sa prime.
    if (fait.nature === 'ralliement') {
      for (const ninja of fait.charge.ninjas) {
        points.push({
          valeur: ninja.multiplicateur,
          genre: 'bot',
          niveau: ninja.multiplicateur,
          x: ninja.x,
          y: ninja.y,
        });
      }
    }

    const palier = palierDuFait(fait, apres.moi);
    const moi = (apres.partie ?? avant.partie)?.entites.find((entite) => entite.id === apres.moi);

    if (palier !== undefined && moi !== undefined) {
      points.push({ valeur: palier, genre: 'combo', niveau: palier, x: moi.x, y: moi.y });
    }

    if (fait.nature === 'joueurTranche' && fait.charge.attaquant === apres.moi) {
      const { pointsVoles: valeur, x, y } = fait.charge;
      points.push({ valeur, genre: 'joueur', niveau: 1, x, y });
    }

    if (fait.nature === 'mineExplosee') {
      points.push(...pointsDeLaMine(fait.charge, avant, apres));
    }

    if (fait.nature === 'botNoirDetruit') {
      const { points: valeur, x, y } = fait.charge;
      points.push({ valeur, genre: 'botNoir', niveau: 1, x, y });
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
          niveau: 1,
          x: victime.x,
          y: victime.y,
        });
      }
    }
  }

  return points;
}

/**
 * Le nouveau multiplicateur, quand ce fait fait monter notre combo d'un cran: un ralliement de
 * la Horde, qui n'est envoye qu'a nous, ou notre coup de katana qui a tue. Rien sinon.
 */
function palierDuFait(fait: FaitDeJeu, moi: string | undefined): number | undefined {
  const coups =
    fait.nature === 'ralliement'
      ? { charge: fait.charge, gagnes: fait.charge.ninjas.length }
      : fait.nature === 'coupDeKatana' && fait.charge.frappeur === moi
        ? { charge: fait.charge, gagnes: fait.charge.morts.length }
        : undefined;

  if (coups === undefined || coups.gagnes === 0) {
    return undefined;
  }

  const { multiplicateur } = coups.charge;
  const avant = multiplicateurDuCombo(coups.charge.combo - coups.gagnes);

  // Le premier palier est x2: un combo a x1 n'en a franchi aucun.
  return multiplicateur >= 2 && multiplicateur > avant ? multiplicateur : undefined;
}

/**
 * Ce qu'une explosion de mine montre en points flottants: le gain de son poseur, si c'est
 * nous, et notre perte de ninjas en Horde, si elle nous a touches. Notre perte se pose a notre
 * place d'avant l'explosion.
 */
function pointsDeLaMine(
  explosion: Extract<FaitDeJeu, { nature: 'mineExplosee' }>['charge'],
  avant: EtatClient,
  apres: EtatClient,
): readonly PointsGagnes[] {
  const points: PointsGagnes[] = [];

  if (explosion.poseur === apres.moi && explosion.points > 0) {
    const tue = explosion.touches.some((touche) => touche.effet === 'tue');
    points.push({
      valeur: explosion.points,
      genre: tue ? 'joueur' : 'botNoir',
      niveau: 1,
      x: explosion.x,
      y: explosion.y,
    });
  }

  const perte = explosion.touches.find(
    (touche) => touche.joueur === apres.moi && touche.effet === 'ninjasPerdus',
  );
  const moi = (avant.partie ?? apres.partie)?.entites.find((entite) => entite.id === apres.moi);

  if (
    apres.salon?.mode === 'classique' &&
    perte !== undefined &&
    perte.quantite > 0 &&
    moi !== undefined
  ) {
    points.push({ valeur: -perte.quantite, genre: 'perte', niveau: 1, x: moi.x, y: moi.y });
  }

  return points;
}

/**
 * Un point par faux ninja neutre passe a notre couleur entre deux battements.
 *
 * Exportee pour le son des captures (etape 5.5), qui suit la meme regle que le point
 * « +1 », celle du jeu d'origine.
 */
export function pointsDesRalliements(
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
      points.push({ valeur: 1, genre: 'bot', niveau: 1, x: entite.x, y: entite.y });
    }
  }

  return points;
}
