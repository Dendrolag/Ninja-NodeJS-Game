/**
 * La carte plein ecran d'Among Ninjas (etape 7.21, rendu 2A de la planche
 * docs/design/etape-7-21/1-planche.png): Tokyo assombri et sans couleur, nos stations en neon
 * avec le nom de leur tache, nos taches faites cochees, le gong et nous, et notre liste a cote.
 * Un assassin y voit toutes les stations actives, en rouge, et les taches qu'on peut y faire.
 * JAMAIS LES AUTRES JOUEURS, ni les cadavres.
 *
 * Elle s'ouvre et se ferme par la touche M, la mini-carte touchee, ou la croix; Echap la ferme.
 * LE JEU CONTINUE DERRIERE: la carte laisse passer le clavier et le doigt, et l'on peut se
 * deplacer en la lisant, au risque de ne pas voir venir un assassin. Elle se ferme d'elle-meme
 * hors de la phase de jeu, et quand une tache s'ouvre.
 *
 * Ce composant pose ce que le modele (hud/among.ts, carteAmongDe) decide, et rien d'autre.
 */

import type { EtatClient } from '../../etat.js';
import type { CarteAmong, LigneDeTache, PointDeMinimap } from '../../hud/among.js';
import { carteAmongDe } from '../../hud/among.js';
import type { LecteurDeSons } from '../../sons/lecteur.js';
import { bouton, creer, ecrireTexte } from '../dom.js';

/** Ce qu'il faut a la carte. */
export interface OptionsCarteAmong {
  readonly document: Document;
  readonly sons?: LecteurDeSons;
}

/** La carte, montee. */
export interface CarteAmongMontee {
  readonly racine: HTMLElement;
  /**
   * L'ouvre si elle est fermee, la ferme sinon. Elle ne s'ouvre qu'en phase de jeu: en
   * reunion, la touche M l'ouvrait une demi-seconde, le temps que l'affichage suivant la
   * referme (retour d'essai du porteur du projet, 10 octobre 2026).
   */
  basculer(etat: EtatClient): void;
  fermer(): void;
  estOuverte(): boolean;
  /** La met en accord avec l'etat, si elle est ouverte. */
  afficher(etat: EtatClient): void;
  demonter(): void;
}

/** Place un element en part de la carte, par le CSSOM: la page refuse les styles en ligne. */
function placer(element: HTMLElement, point: PointDeMinimap): void {
  element.style.left = `${String(point.x * 100)}%`;
  element.style.top = `${String(point.y * 100)}%`;
}

/** Ce qui distingue deux contenus de la carte, hors de notre place. */
function signature(carte: CarteAmong): string {
  return [
    carte.fond,
    String(carte.miroir),
    carte.titreDeLaListe,
    ...carte.reperes.map(
      (repere) =>
        `${String(repere.x)}:${String(repere.y)}:${repere.titre}:${repere.station}:${String(repere.faite)}`,
    ),
  ].join('|');
}

/** Monte la carte, fermee. */
export function monterCarteAmong(options: OptionsCarteAmong): CarteAmongMontee {
  const doc = options.document;

  const fond = doc.createElement('img');
  fond.className = 'carte-among-fond';
  fond.alt = '';
  const reperes = creer(doc, 'div', { classe: 'carte-among-reperes' });
  const gong = creer(
    doc,
    'span',
    { classe: 'carte-among-gong' },
    creer(doc, 'span', { texte: 'Gong' }),
  );
  const moi = creer(
    doc,
    'span',
    { classe: 'carte-among-moi' },
    creer(doc, 'span', { texte: 'Vous' }),
  );
  const plan = creer(doc, 'div', { classe: 'carte-among-plan' }, fond, reperes, gong, moi);
  const titreDeLaListe = creer(doc, 'h2', { classe: 'carte-among-titre' });
  const liste = creer(doc, 'ul', { classe: 'carte-among-liste' });
  const fermer = bouton(
    doc,
    {
      classe: 'bouton-icone carte-among-fermer',
      icone: 'fermer',
      etiquette: 'Fermer la carte (M)',
    },
    () => {
      fermerLaCarte();
    },
  );
  const panneau = creer(
    doc,
    'aside',
    { classe: 'carte-among-panneau' },
    titreDeLaListe,
    liste,
    creer(doc, 'p', { classe: 'carte-among-aide', texte: 'M ou Échap pour fermer' }),
  );
  const racine = creer(
    doc,
    'div',
    { classe: 'carte-among', attributs: { role: 'dialog', 'aria-label': 'Carte' } },
    plan,
    panneau,
    fermer,
  );
  racine.hidden = true;

  let derniere: string | undefined;

  const surTouche = (evenement: KeyboardEvent): void => {
    if (evenement.key === 'Escape') {
      fermerLaCarte();
    }
  };

  function ouvrir(): void {
    racine.hidden = false;
    options.sons?.jouer('carteOuverte');
    doc.addEventListener('keydown', surTouche);
  }

  function fermerLaCarte(): void {
    if (racine.hidden) {
      return;
    }

    racine.hidden = true;
    options.sons?.jouer('carteOuverte');
    doc.removeEventListener('keydown', surTouche);
  }

  function basculer(etat: EtatClient): void {
    if (racine.hidden) {
      if (etat.partie?.among?.phase === 'jeu') {
        ouvrir();
      }
    } else {
      fermerLaCarte();
    }
  }

  /** Les reperes et la liste, reecrits seulement si le contenu a change. */
  const ecrire = (carte: CarteAmong): void => {
    const nouvelle = signature(carte);

    if (nouvelle === derniere) {
      return;
    }

    derniere = nouvelle;

    if (fond.getAttribute('src') !== carte.fond) {
      fond.setAttribute('src', carte.fond);
    }

    plan.style.setProperty('--proportions', String(carte.proportions));
    plan.classList.toggle('miroir', carte.miroir);
    racine.dataset['camp'] = carte.camp;
    placer(gong, carte.gong);
    reperes.replaceChildren(
      ...carte.reperes.map((repere) => {
        const element = creer(
          doc,
          'span',
          { classe: repere.faite ? 'carte-among-repere faite' : 'carte-among-repere' },
          creer(doc, 'span', { classe: 'carte-among-repere-titre', texte: repere.titre }),
        );
        element.title = repere.station;
        placer(element, repere);
        return element;
      }),
    );
    ecrireTexte(titreDeLaListe, carte.titreDeLaListe);
    liste.replaceChildren(...carte.liste.map((ligne) => ligneDeListe(doc, ligne)));
    liste.hidden = carte.liste.length === 0;
  };

  return {
    racine,
    basculer,
    fermer: fermerLaCarte,

    estOuverte() {
      return !racine.hidden;
    },

    afficher(etat) {
      const carte = carteAmongDe(etat);

      // Hors du jeu (revelation, reunion, execution), la carte n'a rien a faire a l'ecran.
      if (carte === undefined || etat.partie?.among?.phase !== 'jeu') {
        fermerLaCarte();
        return;
      }

      if (racine.hidden) {
        return;
      }

      ecrire(carte);
      moi.hidden = carte.moi === undefined;

      if (carte.moi !== undefined) {
        placer(moi, carte.moi);
        moi.style.setProperty('--couleur-joueur', carte.moi.couleur);
      }
    },

    demonter() {
      fermerLaCarte();
      racine.remove();
    },
  };
}

/** Une ligne de notre liste: la tache, sa station dessous, cochee une fois faite. */
function ligneDeListe(doc: Document, ligne: LigneDeTache): HTMLElement {
  return creer(
    doc,
    'li',
    { classe: ligne.faite ? 'carte-among-ligne faite' : 'carte-among-ligne' },
    creer(doc, 'strong', { texte: ligne.titre }),
    creer(doc, 'span', { texte: ligne.station }),
  );
}
