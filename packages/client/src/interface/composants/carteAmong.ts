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
 * LES SABOTAGES (etape 7.22). Un assassin, vivant ou fantome, y trouve le panneau des sabotages,
 * en colonne a droite (rendu 1A de la planche docs/design/etape-7-22/1-planche.png); une proie
 * fantome, celui des maledictions (rendu 5A). Le nuage noir se pose ensuite sur une station,
 * touchee ou choisie au clavier. Pendant la panne et la surchauffe, la carte marque le boitier
 * ou les deux consoles.
 *
 * Ce composant pose ce que le modele (hud/among.ts, carteAmongDe) decide, et rien d'autre.
 */

import type { DemandeSabotage, NatureDeSabotage, Nuisance } from '@neon-ninja/shared';
import { NUISANCES } from '@neon-ninja/shared';

import type { EtatClient } from '../../etat.js';
import type {
  CarteAmong,
  LigneDeTache,
  PanneauDeLaCarte,
  PointDeMinimap,
} from '../../hud/among.js';
import { carteAmongDe } from '../../hud/among.js';
import type { LecteurDeSons } from '../../sons/lecteur.js';
import { bouton, creer, ecrireTexte } from '../dom.js';

/** Ce qu'il faut a la carte. */
export interface OptionsCarteAmong {
  readonly document: Document;
  readonly sons?: LecteurDeSons;
  /** Demande un sabotage au serveur (etape 7.22). */
  readonly saboter?: (demande: DemandeSabotage) => void;
  /** Demande une malediction au serveur (etape 7.22). */
  readonly maudire?: (nature: Nuisance) => void;
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
    carte.panneau === undefined
      ? ''
      : `${carte.panneau.genre}:${carte.panneau.boutons.map((b) => b.nature).join(',')}`,
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
  const postes = creer(doc, 'div', { classe: 'carte-among-postes' });
  const plan = creer(doc, 'div', { classe: 'carte-among-plan' }, fond, postes, reperes, gong, moi);
  const titreDeLaListe = creer(doc, 'h2', { classe: 'carte-among-titre' });
  const liste = creer(doc, 'ul', { classe: 'carte-among-liste' });
  // Le panneau des sabotages ou des maledictions (etape 7.22).
  const titreDuPanneau = creer(doc, 'h3', { classe: 'carte-among-sabotages-titre' });
  const etatDuPanneau = creer(doc, 'p', { classe: 'carte-among-sabotages-etat' });
  const boutons = creer(doc, 'div', { classe: 'carte-among-sabotages-boutons' });
  const aideDuNuage = creer(doc, 'p', {
    classe: 'carte-among-sabotages-aide',
    texte: 'Touchez une station pour y poser le nuage',
  });
  aideDuNuage.hidden = true;
  const sabotages = creer(
    doc,
    'section',
    { classe: 'carte-among-sabotages' },
    titreDuPanneau,
    etatDuPanneau,
    boutons,
    aideDuNuage,
  );
  sabotages.hidden = true;
  /** Le genre du panneau monte: sabotages ou maledictions. */
  let genre: PanneauDeLaCarte['genre'] | undefined;
  /** L'assassin a choisi le nuage, et doit encore toucher une station. */
  let choixDuNuage = false;

  const choisirLeNuage = (choisi: boolean): void => {
    choixDuNuage = choisi;
    aideDuNuage.hidden = !choisi;
    racine.classList.toggle('choix-du-nuage', choisi);

    for (const repere of reperes.querySelectorAll<HTMLElement>('.carte-among-repere')) {
      repere.tabIndex = choisi ? 0 : -1;
    }
  };

  // Un bouton du panneau: un sabotage, ou une malediction. Le nuage attend sa station.
  boutons.addEventListener('click', (evenement) => {
    const cible = (evenement.target as HTMLElement).closest<HTMLButtonElement>('button');
    const nature = cible?.dataset['nature'] as NatureDeSabotage | undefined;

    if (cible === null || cible === undefined || cible.disabled || nature === undefined) {
      return;
    }

    if (genre === 'maledictions') {
      if ((NUISANCES as readonly string[]).includes(nature)) {
        options.maudire?.(nature as Nuisance);
      }
      return;
    }

    if (nature === 'nuage') {
      choisirLeNuage(!choixDuNuage);
      return;
    }

    choisirLeNuage(false);
    options.saboter?.({ nature });
  });

  // Une station touchee, ou choisie au clavier, recoit le nuage.
  const poserLeNuage = (evenement: Event): void => {
    const repere = (evenement.target as HTMLElement).closest<HTMLElement>('.carte-among-repere');
    const rang = Number(repere?.dataset['rang']);

    if (!choixDuNuage || repere === null || !Number.isInteger(rang)) {
      return;
    }

    choisirLeNuage(false);
    options.saboter?.({ nature: 'nuage', station: rang });
  };
  reperes.addEventListener('click', poserLeNuage);
  reperes.addEventListener('keydown', (evenement) => {
    if (evenement.key === 'Enter' || evenement.key === ' ') {
      evenement.preventDefault();
      poserLeNuage(evenement);
    }
  });
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
    sabotages,
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
    choisirLeNuage(false);
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
      ...carte.reperes.map((repere, rang) => {
        const element = creer(
          doc,
          'span',
          { classe: repere.faite ? 'carte-among-repere faite' : 'carte-among-repere' },
          creer(doc, 'span', { classe: 'carte-among-repere-titre', texte: repere.titre }),
        );
        element.title = repere.station;
        // Le rang de la station: un assassin y pose le nuage noir (etape 7.22).
        element.dataset['rang'] = String(rang);
        element.setAttribute('role', 'button');
        element.tabIndex = choixDuNuage ? 0 : -1;
        placer(element, repere);
        return element;
      }),
    );
    ecrireTexte(titreDeLaListe, carte.titreDeLaListe);
    liste.replaceChildren(...carte.liste.map((ligne) => ligneDeListe(doc, ligne)));
    liste.hidden = carte.liste.length === 0;
    genre = carte.panneau?.genre;
    sabotages.hidden = carte.panneau === undefined;
    sabotages.dataset['genre'] = carte.panneau?.genre ?? '';
    boutons.replaceChildren(
      ...(carte.panneau?.boutons ?? []).map((choix) => {
        const element = bouton(doc, {
          classe: 'carte-among-sabotage',
          texte: choix.libelle,
        });
        element.dataset['nature'] = choix.nature;
        return element;
      }),
    );
  };

  /** L'etat du panneau et de ses boutons, a chaque image: la recharge court. */
  const afficherLePanneau = (panneau: PanneauDeLaCarte | undefined): void => {
    if (panneau === undefined) {
      return;
    }

    ecrireTexte(titreDuPanneau, panneau.titre);
    ecrireTexte(etatDuPanneau, panneau.etat);

    panneau.boutons.forEach((choix, rang) => {
      const element = boutons.children[rang] as HTMLButtonElement | undefined;

      if (element !== undefined && element.disabled === choix.pret) {
        element.disabled = !choix.pret;
      }
    });

    if (choixDuNuage && panneau.boutons.every((choix) => !choix.pret)) {
      choisirLeNuage(false);
    }
  };

  /** Les postes du sabotage en cours, marques sur le plan. */
  const afficherLesPostes = (carte: CarteAmong): void => {
    while (postes.children.length < carte.postes.length) {
      postes.append(creer(doc, 'span', { classe: 'carte-among-poste' }));
    }

    [...postes.children].forEach((point, rang) => {
      const place = carte.postes[rang];
      (point as HTMLElement).hidden = place === undefined;

      if (place !== undefined) {
        placer(point as HTMLElement, place);
      }
    });
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
      afficherLePanneau(carte.panneau);
      afficherLesPostes(carte);
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
