/**
 * Une fenetre posee par-dessus l'ecran: l'aide, le son, les reglages, une
 * confirmation.
 *
 * UN SEUL MODELE DE FENETRE POUR TOUTE L'INTERFACE. Le jeu d'origine en avait
 * quatre, chacune affichee et masquee a sa maniere (style.display a certains
 * endroits, une classe hidden a d'autres, un element retire du document pour la
 * fin de partie), si bien qu'aucune ne se fermait de la meme facon.
 *
 * ELLE SE FERME COMME ON S'Y ATTEND: par son bouton, par la touche Echap, ou d'un
 * clic a cote. A la fermeture, le focus revient la ou il etait, pour qu'un joueur
 * au clavier ne se retrouve pas en haut de la page.
 *
 * L'element <dialog> du navigateur ferait une partie de ce travail, mais il n'est
 * pas implemente par l'environnement de test: une fenetre qu'on ne peut pas
 * tester se regresse sans bruit.
 */

import { bouton, creer, montrer } from '../dom.js';

/** Ce qu'il faut pour monter une fenetre. */
export interface OptionsFenetre {
  readonly document: Document;
  readonly titre: string;
  /** Une classe de plus, pour la mise en forme propre a cette fenetre. */
  readonly classe?: string;
  /** Appele a chaque fermeture, quelle qu'en soit la cause. */
  readonly surFermeture?: () => void;
}

/** Une fenetre montee, que son proprietaire remplit et place dans le document. */
export interface Fenetre {
  /** L'element a placer dans le document. Cache tant que la fenetre est fermee. */
  readonly racine: HTMLElement;
  /** Ce que la fenetre contient. */
  readonly corps: HTMLElement;
  /** Les boutons d'action, en bas. */
  readonly pied: HTMLElement;
  readonly ouverte: boolean;
  ouvrir(): void;
  fermer(): void;
  /** Retire la fenetre du document et ses ecoutes. */
  demonter(): void;
}

/** Monte une fenetre, fermee. */
export function monterFenetre(options: OptionsFenetre): Fenetre {
  const doc = options.document;
  let focusPrecedent: Element | null = null;

  const corps = creer(doc, 'div', { classe: 'fenetre-corps' });
  const pied = creer(doc, 'div', { classe: 'fenetre-pied' });

  const cadre = creer(
    doc,
    'section',
    {
      classe: options.classe === undefined ? 'fenetre' : `fenetre ${options.classe}`,
      attributs: {
        role: 'dialog',
        'aria-modal': 'true',
        'aria-label': options.titre,
        tabindex: '-1',
      },
    },
    creer(
      doc,
      'header',
      { classe: 'fenetre-entete' },
      creer(doc, 'h2', { texte: options.titre }),
      bouton(doc, { classe: 'bouton-icone', icone: 'fermer', etiquette: 'Fermer' }, () => {
        fermer();
      }),
    ),
    corps,
    pied,
  );

  const racine = creer(doc, 'div', { classe: 'fenetre-fond' }, cadre);
  racine.hidden = true;

  const fermer = (): void => {
    if (racine.hidden) {
      return;
    }

    montrer(racine, false);
    options.surFermeture?.();

    if (focusPrecedent instanceof HTMLElement || focusPrecedent instanceof SVGElement) {
      focusPrecedent.focus();
    }

    focusPrecedent = null;
  };

  const surTouche = (evenement: KeyboardEvent): void => {
    if (evenement.key === 'Escape') {
      evenement.stopPropagation();
      fermer();
    }
  };

  // Un clic sur le fond, et non dans la fenetre, ferme: c'est le geste attendu
  // pour se debarrasser d'une fenetre sans chercher sa croix.
  const surClicFond = (evenement: MouseEvent): void => {
    if (evenement.target === racine) {
      fermer();
    }
  };

  racine.addEventListener('keydown', surTouche);
  racine.addEventListener('click', surClicFond);

  return {
    racine,
    corps,
    pied,

    get ouverte() {
      return !racine.hidden;
    },

    ouvrir() {
      if (!racine.hidden) {
        return;
      }

      focusPrecedent = doc.activeElement;
      montrer(racine, true);
      // Sans preventScroll, le navigateur peut faire defiler la page derriere la
      // fenetre pour amener le cadre a l'ecran, et la page reste decalee apres la
      // fermeture.
      cadre.focus({ preventScroll: true });
    },

    fermer,

    demonter() {
      racine.removeEventListener('keydown', surTouche);
      racine.removeEventListener('click', surClicFond);
      racine.remove();
    },
  };
}
