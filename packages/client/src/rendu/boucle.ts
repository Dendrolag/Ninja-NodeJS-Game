/**
 * La boucle de rendu: ce qui se passe a chaque image.
 *
 * ELLE TOURNE A LA CADENCE DU NAVIGATEUR, PAS A CELLE DU RESEAU. C'est le
 * changement le plus visible de cette etape. Le client d'origine dessinait DANS
 * le gestionnaire du message d'etat: le jeu plafonnait donc a vingt images par
 * seconde sur toutes les machines, et chaque hoquet du reseau se voyait a
 * l'ecran. Ici, la boucle lit l'etat courant a chaque image et affiche une
 * position lissee entre les deux derniers battements recus.
 *
 * ELLE NE S'ABONNE PAS AU MAGASIN, ELLE LE LIT. S'abonner reveillerait le rendu a
 * chaque message, c'est-a-dire recreerait le couplage qu'on vient de defaire. Les
 * menus, eux, s'abonnent, parce qu'ils ne doivent se refaire que quand quelque
 * chose change: c'est le bon usage de l'abonnement, et il arrive a l'etape 4.3.
 *
 * ELLE EST L'UNIQUE ENDROIT OU LES MORCEAUX SE RENCONTRENT, et elle ne fait rien
 * d'autre que les faire se rencontrer. Elle ne calcule aucune apparence, aucune
 * direction, aucun son: elle demande a chacun ce qu'il sait faire, dans l'ordre.
 *
 *     etat  ->  lissage  ->  scene  ->  PixiJS
 *           ->  camera
 *           ->  HUD      ->  surcouche
 *           ->  sons
 *     saisie ->  intention ->  reseau
 */

import type { DimensionsCarte } from '@neon-ninja/shared';

import type { Client } from '../client.js';
import type { Controles } from '../controles/controles.js';
import type { EtatClient } from '../etat.js';
import type { HorlogeClient } from '../horloge.js';
import type { Surcouche } from '../hud/surcouche.js';
import { construireHud } from '../hud/modele.js';
import { effetsEnCours, moiDansLaPartie } from '../selecteurs.js';
import { sonDuFait, sonsDuChangement } from '../sons/declencheurs.js';
import type { LecteurDeSons } from '../sons/lecteur.js';
import type { Camera } from './camera.js';
import { cameraSur, suivre } from './camera.js';
import { TamponDeLissage } from './interpolation.js';
import type { Rendu } from './pixi.js';
import { construireScene } from './scene.js';

/** Ce qu'il faut pour faire tourner une partie a l'ecran. */
export interface OptionsBoucle {
  readonly client: Client;
  readonly rendu: Rendu;
  readonly controles: Controles;
  readonly horloge: HorlogeClient;
  readonly carte: DimensionsCarte;
  /** La surcouche du HUD. Absente, le jeu s'affiche sans interface. */
  readonly surcouche?: Surcouche;
  /** Le lecteur de sons. Absent, le jeu est muet. */
  readonly sons?: LecteurDeSons;
  /** Le cadrage est-il celui d'un appareil tactile. */
  readonly mobile?: boolean;
  /** Taille de la zone d'affichage, relue a chaque image. */
  readonly taille: () => { readonly largeur: number; readonly hauteur: number };
  /**
   * Comment demander l'image suivante. Celui du navigateur par defaut.
   *
   * Injectable pour que le banc de mesure puisse piloter la boucle image par
   * image, et pour qu'un test puisse la faire avancer sans navigateur.
   */
  readonly demanderUneImage?: (suite: (instant: number) => void) => number;
  readonly annulerUneImage?: (identifiant: number) => void;
}

/** Une boucle en marche. */
export interface Boucle {
  /** Joue une seule image. Le banc de mesure s'en sert; la boucle aussi. */
  uneImage(instant: number): void;
  /** Arrete la boucle. Elle ne redemarre pas. */
  arreter(): void;
}

/** Lance la boucle de rendu. */
export function lancerLaBoucle(options: OptionsBoucle): Boucle {
  const demander = options.demanderUneImage ?? ((suite) => requestAnimationFrame(suite));
  const annuler =
    options.annulerUneImage ??
    ((identifiant) => {
      cancelAnimationFrame(identifiant);
    });

  const tampon = new TamponDeLissage();

  let camera: Camera | undefined;
  let instantPrecedent: number | undefined;
  let etatPrecedent: EtatClient = options.client.etat;
  /** Les faits deja entendus: le journal s'allonge, on ne rejoue pas le passe. */
  let faitsEntendus = etatPrecedent.journal.length;
  let bouclesEnCours = new Set<string>();
  let vivante = true;
  let prochaineImage: number | undefined;

  const uneImage = (instant: number): void => {
    const etat = options.client.etat;
    const maintenant = options.horloge.maintenant();
    const dtMs = instantPrecedent === undefined ? 0 : instant - instantPrecedent;
    instantPrecedent = instant;

    // 1. Ce que le joueur demande part d'abord: une image de retard sur la saisie
    //    se sent, une image de retard sur l'affichage ne se voit pas.
    const intention = options.controles.aEmettre();

    if (intention !== undefined) {
      options.client.deplacer(intention);
    }

    // 2. Les sons naissent de ce qui vient d'arriver.
    faireEntendre(etat, etatPrecedent, maintenant);
    etatPrecedent = etat;

    // 3. L'affichage lit l'etat courant, sans s'y abonner.
    tampon.observer(etat.partie, maintenant);
    const lissee = tampon.vueLissee(maintenant);
    const taille = options.taille();

    const moi = moiDansLaPartie(etat);
    const cible = moi ?? { x: options.carte.largeur / 2, y: options.carte.hauteur / 2 };

    camera =
      camera === undefined
        ? cameraSur(cible, taille, options.carte, options.mobile ?? false)
        : suivre(camera, cible, taille, options.carte, dtMs);

    options.rendu.dessiner(construireScene(etat, lissee, maintenant), camera);
    options.surcouche?.afficher(construireHud(etat, maintenant));

    // 4. Les pas suivent le mouvement affiche, pas la touche enfoncee: un joueur
    //    bloque contre un mur tient sa touche sans avancer, et le jeu d'origine
    //    lui faisait entendre une course sur place.
    const monEntite = lissee?.entites.find(({ entite }) => entite.id === etat.moi);

    if (monEntite?.enMouvement === true) {
      options.sons?.jouerUnPas(maintenant, false);
    }
  };

  /** Joue les sons que meritent les faits recus et les changements d'etat. */
  const faireEntendre = (etat: EtatClient, precedent: EtatClient, maintenant: number): void => {
    const sons = options.sons;

    if (sons === undefined) {
      return;
    }

    for (const nom of sonsDuChangement(precedent, etat)) {
      sons.jouer(nom);
    }

    // Le journal est borne: quand il deborde, sa longueur cesse de croitre et les
    // faits nouveaux poussent les anciens dehors. On repart donc du plus petit
    // des deux comptes, ce qui peut faire manquer un son en cas de rafale, jamais
    // en rejouer un.
    const debut = Math.min(faitsEntendus, etat.journal.length);

    for (const fait of etat.journal.slice(debut)) {
      const nom = sonDuFait(fait);

      if (nom !== undefined) {
        sons.jouer(nom);
      }
    }

    faitsEntendus = etat.journal.length;

    // Les boucles de bonus se demarrent et s'arretent sur le passage: comparer
    // l'ensemble courant a l'ensemble precedent evite d'avoir a se souvenir de
    // qui a demarre quoi. On lit les effets EN COURS a cet instant, et non la
    // liste du magasin: celui-ci ne retire un effet expire qu'a l'arrivee du
    // suivant, et la boucle sonore d'un bonus fini tournerait sinon jusque-la.
    const actives = new Set(
      effetsEnCours(etat, maintenant)
        .filter((effet) => effet.categorie === 'bonus')
        .map((effet) => effet.nature as string),
    );

    for (const nature of actives) {
      if (!bouclesEnCours.has(nature)) {
        sons.demarrerLaBoucle(nature as never);
      }
    }

    for (const nature of bouclesEnCours) {
      if (!actives.has(nature)) {
        sons.arreterLaBoucle(nature as never);
      }
    }

    bouclesEnCours = actives;
  };

  const prochaine = (instant: number): void => {
    if (!vivante) {
      return;
    }

    uneImage(instant);
    prochaineImage = demander(prochaine);
  };

  prochaineImage = demander(prochaine);

  return {
    uneImage,

    arreter() {
      vivante = false;

      if (prochaineImage !== undefined) {
        annuler(prochaineImage);
      }

      options.sons?.toutArreter();
    },
  };
}
