/**
 * La fenetre d'une reparation d'Among Ninjas (etape 7.27): la fenetre neon des taches (rendu 1A
 * de l'etape 7.21), orange pour la panne, rouge pour la surchauffe. Le titre du geste, le poste,
 * la croix, le geste dans un canevas, ce que dit l'autre console, et ce qu'il faut faire, au
 * pointeur et au clavier.
 *
 * ELLE S'OUVRE SUR CE QUE L'ETAT DIT (modeles/reparation.ts): notre reparation, que le serveur
 * nous a dite ouverte, et ou en est le sabotage. Elle se ferme quand il ne la dit plus: sortie
 * du disque, reunion, mort, ou sabotage fini, repare par un autre ou non.
 *
 * LA FIN NE S'ANNONCE PAS AVANT LA DUREE MINIMALE DU GESTE, comptee de l'instant ou la page a
 * montre le geste: plus tard que le serveur, qui compte de l'ouverture, ou, au relais, du dernier
 * interrupteur coupe. L'annonce se repete tant que le geste reste montre.
 *
 * LA CLE se tient: Espace, la touche d'action ou le doigt sur le canevas tiennent le bouton
 * d'action, que le serveur lit a la console purgee.
 *
 * PENDANT LA REPARATION, ON NE BOUGE PAS: la fenetre fige les commandes du jeu (surOuverture).
 */

import type { GesteDeReparation, NomDeSon } from '@neon-ninja/shared';
import { DUREES_MINIMALES_DES_REPARATIONS_MS } from '@neon-ninja/shared';

import type { Client } from '../../client.js';
import { TOUCHE_POCHE } from '../../controles/touches.js';
import type { EtatClient } from '../../etat.js';
import type { HorlogeClient } from '../../horloge.js';
import type { LecteurDeSons } from '../../sons/lecteur.js';
import { bouton, creer, ecrireTexte } from '../dom.js';
import { HAUTEUR_DU_GESTE, LARGEUR_DU_GESTE } from '../modeles/gestes/commun.js';
import type {
  CommandeDeReparation,
  EchoDeReparation,
  EtatDeReparation,
} from '../modeles/gestes/reparations.js';
import {
  AIDES_DES_REPARATIONS,
  appliquerReparation,
  avancementDeLaReparation,
  creerReparation,
  graineDeLaReparation,
  reparationFinie,
} from '../modeles/gestes/reparations.js';
import type { FenetreDeReparationVue } from '../modeles/reparation.js';
import { vueDeLaReparation } from '../modeles/reparation.js';

import type { DessinDeReparation } from './dessinsDesReparations.js';
import { dessinerUneReparation } from './dessinsDesReparations.js';
import { MARGE_DE_L_ANNONCE_MS, toucheDuGeste } from './tache.js';

/** L'ecart entre deux annonces du meme geste fini, tant qu'il reste montre. */
const REPETITION_DE_L_ANNONCE_MS = 1000;

/** Le son de chaque echo d'un geste de reparation. */
const SONS_DES_ECHOS: Readonly<Record<EchoDeReparation, NomDeSon>> = {
  tousse: 'reparationTousse',
  demarre: 'reparationDemarre',
  disjoncteur: 'reparationDisjoncteur',
  fusible: 'reparationFusible',
  levier: 'reparationLevier',
  accord: 'reparationAccord',
  vanne: 'reparationVanne',
  declic: 'reparationDeclic',
  ratee: 'tacheRatee',
};

/** Ce que la fenetre dit de faire a la cle, et en attendant son tour au relais. */
const AIDE_DE_LA_CLE = {
  pointeur: 'Tenez la clé tournée, ensemble avec l’autre console',
  clavier: 'Clavier : Espace ou E tenus',
} as const;
const AIDE_DE_L_ATTENTE = 'Attendez que l’autre console coupe son interrupteur';

/** Ce qu'il faut a la fenetre. */
export interface OptionsFenetreDeReparation {
  readonly document: Document;
  readonly client: Pick<Client, 'finirLaReparation' | 'fermerLaReparation' | 'tenirLAction'>;
  readonly horloge: HorlogeClient;
  /** Pour les sons des gestes, entendus de nous seuls. */
  readonly sons?: LecteurDeSons;
  /** Appelee quand la fenetre s'ouvre ou se ferme: le jeu fige ses commandes pendant ce temps. */
  readonly surOuverture?: (ouverte: boolean) => void;
  /** Sur un ecran tactile, l'aide ne dit pas le clavier. */
  readonly tactile?: boolean;
  /** Ce qui dessine la reparation: le canevas, par defaut. Remplacable dans les tests. */
  readonly peindre?: (
    toile: HTMLCanvasElement,
    dessin: DessinDeReparation,
    maintenant: number,
    interrupteursCoupes: number,
  ) => void;
  /** Ce qui rappelle a chaque image: requestAnimationFrame, par defaut. */
  readonly planifier?: (rappel: () => void) => () => void;
}

/** La fenetre, montee. */
export interface FenetreDeReparation {
  readonly racine: HTMLElement;
  /** Met la fenetre en accord avec l'etat: l'ouvre, la garde, change d'etape, ou la ferme. */
  afficher(etat: EtatClient): void;
  demonter(): void;
}

/** Le geste montre: son etat, et ce qu'on en a entendu et annonce. */
interface GesteMontre {
  readonly cle: string;
  readonly geste: GesteDeReparation;
  etat: EtatDeReparation;
  /** L'instant local ou il a ete montre: la duree minimale se compte de la. */
  readonly depuis: number;
  entendus: number;
  finiA?: number;
  annonceA?: number;
}

/** Le dessin par defaut: le canevas, a sa taille d'affichage, dans l'espace du geste. */
function peindreSurLeCanevas(
  toile: HTMLCanvasElement,
  dessin: DessinDeReparation,
  maintenant: number,
  interrupteursCoupes: number,
): void {
  const ctx = toile.getContext('2d');

  if (ctx === null) {
    return;
  }

  const densite = toile.ownerDocument.defaultView?.devicePixelRatio ?? 1;
  const largeur = Math.max(Math.round(toile.clientWidth * densite), 1);
  const hauteur = Math.round((largeur * HAUTEUR_DU_GESTE) / LARGEUR_DU_GESTE);

  if (toile.width !== largeur || toile.height !== hauteur) {
    toile.width = largeur;
    toile.height = hauteur;
  }

  const echelle = largeur / LARGEUR_DU_GESTE;
  ctx.setTransform(echelle, 0, 0, echelle, 0, 0);
  dessinerUneReparation(ctx, dessin, maintenant, interrupteursCoupes);
}

/** Le rappel a chaque image du navigateur. */
function planifierParLeNavigateur(doc: Document): (rappel: () => void) => () => void {
  return (rappel) => {
    const fenetre = doc.defaultView;

    if (fenetre === null) {
      return () => undefined;
    }

    const numero = fenetre.requestAnimationFrame(rappel);

    return () => {
      fenetre.cancelAnimationFrame(numero);
    };
  };
}

/** Monte la fenetre, cachee. */
export function monterFenetreDeReparation(
  options: OptionsFenetreDeReparation,
): FenetreDeReparation {
  const doc = options.document;
  const peindre = options.peindre ?? peindreSurLeCanevas;
  const planifier = options.planifier ?? planifierParLeNavigateur(doc);

  const titre = creer(doc, 'h2', {
    classe: 'reparation-titre',
    attributs: { id: 'reparation-titre' },
  });
  const lieu = creer(doc, 'p', { classe: 'reparation-poste' });
  const toile = creer(doc, 'canvas', {
    classe: 'reparation-geste',
    attributs: { 'aria-hidden': 'true' },
  });
  const avancement = creer(doc, 'p', {
    classe: 'reparation-avancement',
    attributs: { role: 'status' },
  });
  const statut = creer(doc, 'p', { classe: 'reparation-statut' });
  const aide = creer(doc, 'p', { classe: 'reparation-aide' });
  const fermer = bouton(
    doc,
    {
      classe: 'bouton-icone reparation-fermer',
      icone: 'fermer',
      etiquette: 'Fermer la réparation',
    },
    () => {
      fermerLaReparation();
    },
  );
  const fenetre = creer(
    doc,
    'section',
    {
      classe: 'reparation-fenetre',
      attributs: { role: 'dialog', 'aria-labelledby': 'reparation-titre' },
    },
    creer(
      doc,
      'header',
      { classe: 'reparation-entete' },
      creer(doc, 'div', {}, titre, lieu),
      fermer,
    ),
    toile,
    avancement,
    statut,
    aide,
  );
  const racine = creer(doc, 'div', { classe: 'reparation-ecran' }, fenetre);
  racine.hidden = true;

  /** La vue montree, lue de l'etat au dernier affichage. */
  let vue: FenetreDeReparationVue | undefined;
  let montre: GesteMontre | undefined;
  /** La cle tenue par nous, dans la page. */
  let cleTenue = false;
  let moi = '';
  let arreterLImage: (() => void) | undefined;

  const tenirLaCle = (tenue: boolean): void => {
    if (cleTenue === tenue) {
      return;
    }

    cleTenue = tenue;
    options.client.tenirLAction(tenue);

    if (tenue) {
      options.sons?.jouer('reparationCle');
    }
  };

  const faireEntendre = (geste: GesteMontre): void => {
    for (const echo of geste.etat.echos.slice(geste.entendus)) {
      options.sons?.jouer(SONS_DES_ECHOS[echo]);
    }

    geste.entendus = geste.etat.echos.length;
  };

  /** Le geste recoit une commande, maintenant; ce qu'il fait entendre se joue. */
  const commander = (commande: CommandeDeReparation): void => {
    if (montre === undefined) {
      return;
    }

    montre.etat = appliquerReparation(montre.etat, commande, options.horloge.maintenant());
    faireEntendre(montre);
  };

  const annoncerSiPermis = (geste: GesteMontre, maintenant: number): void => {
    const permis =
      geste.depuis + DUREES_MINIMALES_DES_REPARATIONS_MS[geste.geste] + MARGE_DE_L_ANNONCE_MS;

    if (
      geste.finiA === undefined ||
      maintenant < permis ||
      (geste.annonceA !== undefined && maintenant - geste.annonceA < REPETITION_DE_L_ANNONCE_MS)
    ) {
      return;
    }

    geste.annonceA = maintenant;
    options.client.finirLaReparation();
  };

  /** Ce que la toile doit montrer. */
  const dessinCourant = (): DessinDeReparation | undefined => {
    if (vue === undefined) {
      return undefined;
    }

    switch (vue.etape.genre) {
      case 'geste':
        return montre === undefined ? undefined : { genre: 'geste', geste: montre.etat };
      case 'cle':
        return {
          genre: 'cle',
          tournee: cleTenue || vue.cleTournee,
          autreTournee: vue.autreCleTournee,
        };
      case 'attente':
        return { genre: 'attente', interrupteursCoupes: vue.interrupteursCoupes };
    }
  };

  /** Une image: le temps passe, le dessin, la fin et son annonce. */
  const uneImage = (): void => {
    arreterLImage = undefined;

    if (vue === undefined) {
      return;
    }

    const maintenant = options.horloge.maintenant();
    commander({ type: 'temps' });

    if (
      montre !== undefined &&
      montre.finiA === undefined &&
      reparationFinie(montre.etat, maintenant)
    ) {
      montre.finiA = maintenant;
      fenetre.classList.add('reussie');
    }

    const dessin = dessinCourant();
    if (dessin !== undefined) {
      peindre(toile, dessin, maintenant, vue.interrupteursCoupes);
    }

    if (montre === undefined) {
      ecrireTexte(avancement, '');
    } else {
      const { faits, total } = avancementDeLaReparation(montre.etat);
      ecrireTexte(avancement, `${String(faits)} sur ${String(total)}`);
      annoncerSiPermis(montre, maintenant);
    }

    arreterLImage = planifier(uneImage);
  };

  /** Montre l'etape de cette vue: un geste neuf s'il change, la cle ou l'attente sinon. */
  const montrer = (nouvelle: FenetreDeReparationVue): void => {
    const etape = nouvelle.etape;

    if (etape.genre === 'geste') {
      if (montre?.cle !== etape.cle) {
        montre = {
          cle: etape.cle,
          geste: etape.geste,
          etat: creerReparation(
            etape.geste,
            graineDeLaReparation(moi, nouvelle.poste, etape.geste),
          ),
          depuis: options.horloge.maintenant(),
          entendus: 0,
        };
        fenetre.classList.remove('reussie');
      }
    } else {
      montre = undefined;
      fenetre.classList.toggle('reussie', etape.genre === 'cle' && nouvelle.cleTournee);
    }

    if (etape.genre !== 'cle') {
      tenirLaCle(false);
    }

    ecrireTexte(titre, nouvelle.titre);
    ecrireTexte(lieu, nouvelle.lieu);
    ecrireTexte(statut, nouvelle.statut ?? '');
    statut.hidden = nouvelle.statut === undefined;
    const consignes =
      etape.genre === 'geste'
        ? AIDES_DES_REPARATIONS[etape.geste]
        : etape.genre === 'cle'
          ? AIDE_DE_LA_CLE
          : undefined;
    ecrireTexte(
      aide,
      consignes === undefined
        ? AIDE_DE_L_ATTENTE
        : options.tactile === true
          ? consignes.pointeur
          : `${consignes.pointeur}. ${consignes.clavier}`,
    );
    fenetre.dataset['etape'] = etape.genre === 'geste' ? etape.geste : etape.genre;
    fenetre.dataset['sabotage'] = nouvelle.poste === 'boitier' ? 'panne' : 'surchauffe';
  };

  const ouvrir = (): void => {
    racine.hidden = false;
    options.sons?.jouer('tacheOuverte');
    options.surOuverture?.(true);
    doc.addEventListener('keydown', surTouche);
    doc.addEventListener('keyup', surTouche);
    doc.addEventListener('wheel', surMolette, { passive: false });
    arreterLImage?.();
    uneImage();
  };

  const cacher = (): void => {
    if (vue === undefined) {
      return;
    }

    vue = undefined;
    montre = undefined;
    tenirLaCle(false);
    racine.hidden = true;
    arreterLImage?.();
    arreterLImage = undefined;
    doc.removeEventListener('keydown', surTouche);
    doc.removeEventListener('keyup', surTouche);
    doc.removeEventListener('wheel', surMolette);
    options.surOuverture?.(false);
  };

  const fermerLaReparation = (): void => {
    if (vue === undefined) {
      return;
    }

    cacher();
    options.client.fermerLaReparation();
  };

  /**
   * Les fleches, Espace et Echap vont a la reparation; a la cle, Espace et la touche d'action la
   * tiennent, y compris quand le clavier repete une touche deja enfoncee a l'ouverture.
   */
  function surTouche(evenement: KeyboardEvent): void {
    if (evenement.key === 'Escape') {
      if (evenement.type === 'keydown') {
        evenement.preventDefault();
        fermerLaReparation();
      }
      return;
    }

    const touche = toucheDuGeste(evenement.key);
    const action = evenement.key.toLowerCase() === TOUCHE_POCHE;

    if (vue?.etape.genre === 'cle' && (touche === 'espace' || action)) {
      evenement.preventDefault();
      tenirLaCle(evenement.type === 'keydown');
      return;
    }

    if (touche === undefined) {
      return;
    }

    evenement.preventDefault();

    if (evenement.type === 'keydown' && evenement.repeat) {
      return;
    }

    commander({ type: 'touche', touche, enfoncee: evenement.type === 'keydown' });
  }

  /** La molette tourne le cadran, sans faire defiler la page. */
  function surMolette(evenement: WheelEvent): void {
    if (montre === undefined) {
      return;
    }

    evenement.preventDefault();
    commander({ type: 'molette', crans: evenement.deltaY < 0 ? 1 : -1 });
  }

  /** Le pointeur, ramene dans l'espace du geste; a la cle, il la tient. */
  const pointer = (phase: 'bas' | 'deplace' | 'haut', evenement: PointerEvent): void => {
    if (vue?.etape.genre === 'cle') {
      if (phase !== 'deplace') {
        tenirLaCle(phase === 'bas');
      }
      return;
    }

    const cadre = toile.getBoundingClientRect();

    if (cadre.width === 0 || cadre.height === 0) {
      return;
    }

    commander({
      type: 'pointeur',
      phase,
      x: ((evenement.clientX - cadre.left) / cadre.width) * LARGEUR_DU_GESTE,
      y: ((evenement.clientY - cadre.top) / cadre.height) * HAUTEUR_DU_GESTE,
    });
  };

  toile.addEventListener('pointerdown', (evenement) => {
    evenement.preventDefault();
    toile.setPointerCapture?.(evenement.pointerId);
    pointer('bas', evenement);
  });
  toile.addEventListener('pointermove', (evenement) => {
    pointer('deplace', evenement);
  });
  toile.addEventListener('pointerup', (evenement) => {
    pointer('haut', evenement);
  });
  toile.addEventListener('pointercancel', (evenement) => {
    pointer('haut', evenement);
  });

  return {
    racine,

    afficher(etat) {
      const nouvelle = etat.salon?.mode === 'among' ? vueDeLaReparation(etat) : undefined;

      if (nouvelle === undefined) {
        cacher();
        return;
      }

      moi = etat.moi ?? '';
      const ouverte = vue !== undefined;
      vue = nouvelle;
      montrer(nouvelle);

      if (!ouverte) {
        ouvrir();
      }
    },

    demonter() {
      cacher();
      racine.remove();
    },
  };
}
