/**
 * La fenetre d'une tache courte d'Among Ninjas (etape 7.21, rendu 1A de la planche
 * docs/design/etape-7-21/1-planche.png): une fenetre neon au centre de l'ecran, le jeu visible
 * tout autour, assombri. Le titre de la tache, sa station, la croix, le geste dans un canevas,
 * ou en est le geste, et ce qu'il faut faire, au pointeur et au clavier.
 *
 * ELLE S'OUVRE SUR CE QUE L'ETAT DIT (etat.among.tacheOuverte): notre tache, que le serveur nous
 * a dite ouverte, ou celle qu'un assassin fait semblant de faire. Elle ne juge de rien: le geste
 * est un modele pur (modeles/gestes), et le serveur juge la tache finie.
 *
 * LA FIN NE S'ANNONCE PAS AVANT LA DUREE MINIMALE. Le serveur refuse une tache finie plus tot
 * que la duree minimale de sa nature, comptee de l'ouverture chez lui. La page compte de
 * l'instant ou elle a appris l'ouverture, plus tard que le serveur: attendre la duree minimale
 * de son cote, plus une marge, suffit a ne jamais etre refusee. L'annonce se repete tant que la
 * fenetre reste ouverte, au cas ou elle se perdrait.
 *
 * PENDANT LA TACHE, ON NE BOUGE PAS: la fenetre fige les commandes du jeu (surOuverture), et
 * prend pour elle les fleches, Espace et Echap.
 */

import type { IdentifiantCarte, NatureDeTache, NomDeSon } from '@neon-ninja/shared';
import {
  DUREES_MINIMALES_DES_TACHES_MS,
  RACINE_RESSOURCES,
  cheminObjetDuDecor,
  estUneTacheLongue,
} from '@neon-ninja/shared';

import type { TacheOuverte } from '../../among.js';
import type { Client } from '../../client.js';
import { TOUCHES } from '../../controles/touches.js';
import type { EtatClient } from '../../etat.js';
import type { HorlogeClient } from '../../horloge.js';
import type { LecteurDeSons } from '../../sons/lecteur.js';
import { bouton, creer, ecrireTexte } from '../dom.js';
import type { EchoDeGeste, EtatDeGeste, ToucheDeGeste } from '../modeles/gestes/index.js';
import {
  AIDES_DES_TACHES,
  HAUTEUR_DU_GESTE,
  LARGEUR_DU_GESTE,
  TITRES_DES_TACHES,
  appliquerGeste,
  avancementDuGeste,
  creerGeste,
  gesteFini,
  graineDuGeste,
} from '../modeles/gestes/index.js';
import type { FondDesTaches } from './dessinsDesGestes.js';
import { dessinerLeGeste } from './dessinsDesGestes.js';
import { dessinerLAttente } from './dessinsDesMiniJeux.js';

/** La marge prise au-dessus de la duree minimale avant d'annoncer la tache finie. */
export const MARGE_DE_L_ANNONCE_MS = 150;

/** L'ecart entre deux annonces de la meme tache finie, tant qu'elle reste ouverte. */
const REPETITION_DE_L_ANNONCE_MS = 1000;

/** Le son de chaque echo d'un geste. */
const SONS_DES_ECHOS: Readonly<Record<EchoDeGeste, NomDeSon>> = {
  passe: 'tachePasse',
  fil: 'tacheFil',
  mine: 'tacheMine',
  cartouche: 'tacheCartouche',
  remplie: 'tacheBonusRempli',
  ratee: 'tacheRatee',
  posee: 'tacheCaissePosee',
  ligne: 'tacheLigne',
  fruit: 'tacheFruit',
  lancer: 'tacheLancer',
  abattu: 'tacheAbattu',
  eau: 'tacheALEau',
  touche: 'tacheTouche',
  perdue: 'tachePerdue',
};

/** Ce qu'il faut a la fenetre. */
export interface OptionsFenetreDeTache {
  readonly document: Document;
  readonly client: Pick<Client, 'finirLaTache' | 'fermerLaTache'>;
  readonly horloge: HorlogeClient;
  /** Pour les sons des gestes, entendus de nous seuls. */
  readonly sons?: LecteurDeSons;
  /** Appelee quand la fenetre s'ouvre ou se ferme: le jeu fige ses commandes pendant ce temps. */
  readonly surOuverture?: (ouverte: boolean) => void;
  /** Sur un ecran tactile, l'aide ne dit pas le clavier. */
  readonly tactile?: boolean;
  /**
   * Ce qui dessine le geste: le canevas, par defaut. Remplacable dans les tests. L'attente, de
   * zero a un, dit ou en est l'ecran gagne d'un mini-jeu fini avant la duree minimale.
   */
  readonly peindre?: (
    toile: HTMLCanvasElement,
    geste: EtatDeGeste,
    maintenant: number,
    attente?: number,
    fond?: FondDesTaches,
  ) => void;
  /** Ce qui rappelle a chaque image: requestAnimationFrame, par defaut. */
  readonly planifier?: (rappel: () => void) => () => void;
}

/** La fenetre, montee. */
export interface FenetreDeTache {
  readonly racine: HTMLElement;
  /** Met la fenetre en accord avec l'etat: l'ouvre, la garde ou la ferme. */
  afficher(etat: EtatClient): void;
  demonter(): void;
}

/** La touche d'un geste pour une touche du clavier, ou rien. */
export function toucheDuGeste(cle: string): ToucheDeGeste | undefined {
  const touche = cle.toLowerCase();

  if (touche === ' ' || touche === 'spacebar') {
    return 'espace';
  }

  for (const sens of ['haut', 'bas', 'gauche', 'droite'] as const) {
    if (TOUCHES[sens].includes(touche)) {
      return sens;
    }
  }

  return undefined;
}

/** Ce qui distingue une ouverture d'une autre: deux ouvertures de la meme tache aussi. */
function cleDeLOuverture(ouverte: TacheOuverte): string {
  return `${ouverte.nature}|${ouverte.station.nom}|${String(ouverte.depuis)}`;
}

/** Le dessin par defaut: le canevas, a sa taille d'affichage, dans l'espace du geste. */
function peindreSurLeCanevas(
  toile: HTMLCanvasElement,
  geste: EtatDeGeste,
  maintenant: number,
  attente?: number,
  fond?: FondDesTaches,
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
  dessinerLeGeste(ctx, geste, maintenant, fond);

  if (attente !== undefined && estUneTacheLongue(geste.nature)) {
    dessinerLAttente(ctx, geste.nature, attente);
  }
}

/** L'instant ou la page peut annoncer la tache finie: la duree minimale, et une marge. */
function annoncePermise(depuis: number, nature: NatureDeTache): number {
  return depuis + DUREES_MINIMALES_DES_TACHES_MS[nature] + MARGE_DE_L_ANNONCE_MS;
}

/**
 * Ou en est l'attente d'un mini-jeu fini avant la duree minimale, de zero a un; rien pour une
 * tache courte, pas encore finie, ou finie apres (rangee 5 de la planche de l'etape 7.24).
 */
export function partDeLAttente(
  nature: NatureDeTache,
  depuis: number,
  finiA: number | undefined,
  maintenant: number,
): number | undefined {
  const permis = annoncePermise(depuis, nature);

  if (!estUneTacheLongue(nature) || finiA === undefined || finiA >= permis) {
    return undefined;
  }

  return Math.min((maintenant - finiA) / (permis - finiA), 1);
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

/** Ce que la fenetre tient d'une tache ouverte. */
interface TacheAffichee {
  readonly cle: string;
  readonly ouverte: TacheOuverte;
  geste: EtatDeGeste;
  /** Les echos deja entendus. */
  entendus: number;
  /** Le geste fini, a cet instant. */
  finiA?: number;
  /** La derniere annonce de la fin. */
  annonceA?: number;
  /** La recharge de la fumee s'entend: la jauge monte (16 octobre 2026). */
  recharge?: boolean;
  /** L'image du decor au fond de la tache, si sa station en a une (16 octobre 2026). */
  readonly fond?: FondDesTaches;
}

/** La jauge d'un bonus fumee monte-t-elle: le bouton est tenu. */
function fumeeQuiMonte(geste: EtatDeGeste): boolean {
  return geste.nature === 'fumee' && geste.tenuDepuis !== undefined;
}

/** L'image d'un objet du decor de cette carte, qui se charge pour le fond d'une tache. */
function imageDuFond(doc: Document, carte: IdentifiantCarte, image: string): FondDesTaches {
  const fond = doc.createElement('img');
  fond.src = `${RACINE_RESSOURCES}/${cheminObjetDuDecor(carte, image)}`;
  return fond;
}

/** Monte la fenetre, cachee. */
export function monterFenetreDeTache(options: OptionsFenetreDeTache): FenetreDeTache {
  const doc = options.document;
  const peindre = options.peindre ?? peindreSurLeCanevas;
  const planifier = options.planifier ?? planifierParLeNavigateur(doc);

  const titre = creer(doc, 'h2', { classe: 'tache-titre', attributs: { id: 'tache-titre' } });
  const station = creer(doc, 'p', { classe: 'tache-station' });
  const toile = creer(doc, 'canvas', {
    classe: 'tache-geste',
    attributs: { 'aria-hidden': 'true' },
  });
  const avancement = creer(doc, 'p', { classe: 'tache-avancement', attributs: { role: 'status' } });
  const aide = creer(doc, 'p', { classe: 'tache-aide' });
  const fermer = bouton(
    doc,
    { classe: 'bouton-icone tache-fermer', icone: 'fermer', etiquette: 'Fermer la tâche' },
    () => {
      fermerLaTache();
    },
  );
  const fenetre = creer(
    doc,
    'section',
    {
      classe: 'tache-fenetre',
      attributs: { role: 'dialog', 'aria-labelledby': 'tache-titre' },
    },
    creer(doc, 'header', { classe: 'tache-entete' }, creer(doc, 'div', {}, titre, station), fermer),
    toile,
    avancement,
    aide,
  );
  const racine = creer(doc, 'div', { classe: 'tache-ecran' }, fenetre);
  racine.hidden = true;

  let affichee: TacheAffichee | undefined;
  let arreterLImage: (() => void) | undefined;

  /** Le geste recoit une commande, maintenant; ce qu'il fait entendre se joue. */
  const commander = (commande: Parameters<typeof appliquerGeste>[1]): void => {
    if (affichee === undefined) {
      return;
    }

    affichee.geste = appliquerGeste(affichee.geste, commande, options.horloge.maintenant());
    faireEntendre(affichee);
  };

  const faireEntendre = (tache: TacheAffichee): void => {
    for (const echo of tache.geste.echos.slice(tache.entendus)) {
      options.sons?.jouer(SONS_DES_ECHOS[echo]);
    }

    tache.entendus = tache.geste.echos.length;

    // La recharge de la fumee s'entend tant que la jauge monte, et se coupe au relacher.
    const monte = fumeeQuiMonte(tache.geste);

    if (monte !== (tache.recharge === true)) {
      tache.recharge = monte;

      if (monte) {
        options.sons?.jouer('tacheRechargeFumee');
      } else {
        options.sons?.arreter('tacheRechargeFumee');
      }
    }
  };

  /** Une image: le temps passe, le dessin, la fin et son annonce. */
  const uneImage = (): void => {
    arreterLImage = undefined;

    if (affichee === undefined) {
      return;
    }

    const maintenant = options.horloge.maintenant();
    commander({ type: 'temps' });

    if (affichee.finiA === undefined && gesteFini(affichee.geste, maintenant)) {
      affichee.finiA = maintenant;
      options.sons?.jouer('tacheReussie');
      fenetre.classList.add('reussie');
    }

    const attente = partDeLAttente(
      affichee.ouverte.nature,
      affichee.ouverte.depuis,
      affichee.finiA,
      maintenant,
    );
    peindre(toile, affichee.geste, maintenant, attente, affichee.fond);
    const { faits, total } = avancementDuGeste(affichee.geste);
    ecrireTexte(
      avancement,
      attente === undefined ? `${String(faits)} sur ${String(total)}` : 'Enregistrement du score',
    );

    annoncerSiPermis(affichee, maintenant);
    arreterLImage = planifier(uneImage);
  };

  const annoncerSiPermis = (tache: TacheAffichee, maintenant: number): void => {
    const permis = annoncePermise(tache.ouverte.depuis, tache.ouverte.nature);

    if (
      tache.finiA === undefined ||
      maintenant < permis ||
      (tache.annonceA !== undefined && maintenant - tache.annonceA < REPETITION_DE_L_ANNONCE_MS)
    ) {
      return;
    }

    tache.annonceA = maintenant;
    options.client.finirLaTache();
  };

  const ouvrir = (ouverte: TacheOuverte, moi: string, carte: IdentifiantCarte): void => {
    const image = ouverte.station.fondDesTaches;
    affichee = {
      cle: cleDeLOuverture(ouverte),
      ouverte,
      geste: creerGeste(ouverte.nature, graineDuGeste(moi, ouverte.station.nom, ouverte.nature)),
      entendus: 0,
      ...(image === undefined ? {} : { fond: imageDuFond(doc, carte, image) }),
    };
    ecrireTexte(titre, TITRES_DES_TACHES[ouverte.nature]);
    ecrireTexte(station, ouverte.station.nom);
    const consignes = AIDES_DES_TACHES[ouverte.nature];
    ecrireTexte(
      aide,
      options.tactile === true ? consignes.pointeur : `${consignes.pointeur}. ${consignes.clavier}`,
    );
    fenetre.dataset['nature'] = ouverte.nature;
    fenetre.classList.remove('reussie');
    racine.hidden = false;
    options.sons?.jouer('tacheOuverte');
    options.surOuverture?.(true);
    doc.addEventListener('keydown', surTouche);
    doc.addEventListener('keyup', surTouche);
    arreterLImage?.();
    uneImage();
  };

  const cacher = (): void => {
    if (affichee === undefined) {
      return;
    }

    if (affichee.recharge === true) {
      options.sons?.arreter('tacheRechargeFumee');
    }

    affichee = undefined;
    racine.hidden = true;
    arreterLImage?.();
    arreterLImage = undefined;
    doc.removeEventListener('keydown', surTouche);
    doc.removeEventListener('keyup', surTouche);
    options.surOuverture?.(false);
  };

  const fermerLaTache = (): void => {
    if (affichee === undefined) {
      return;
    }

    cacher();
    options.client.fermerLaTache();
  };

  /** Les fleches, Espace et Echap vont a la tache, pas au jeu ni a la page derriere. */
  function surTouche(evenement: KeyboardEvent): void {
    if (evenement.key === 'Escape') {
      if (evenement.type === 'keydown') {
        evenement.preventDefault();
        fermerLaTache();
      }
      return;
    }

    const touche = toucheDuGeste(evenement.key);

    if (touche === undefined) {
      return;
    }

    evenement.preventDefault();

    if (evenement.type === 'keydown' && evenement.repeat) {
      return;
    }

    commander({ type: 'touche', touche, enfoncee: evenement.type === 'keydown' });
  }

  /** Le pointeur, ramene dans l'espace du geste. */
  const pointer = (phase: 'bas' | 'deplace' | 'haut', evenement: PointerEvent): void => {
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
      const ouverte = etat.among.tacheOuverte;

      if (ouverte === undefined || etat.salon?.mode !== 'among') {
        cacher();
        return;
      }

      if (affichee?.cle !== cleDeLOuverture(ouverte)) {
        ouvrir(ouverte, etat.moi ?? '', etat.salon.reglages.carte);
      }
    },

    demonter() {
      cacher();
      racine.remove();
    },
  };
}
