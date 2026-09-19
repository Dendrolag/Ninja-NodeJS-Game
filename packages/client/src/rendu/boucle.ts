/**
 * La boucle de rendu: ce qui se passe a chaque image.
 *
 * ELLE TOURNE A LA CADENCE DU NAVIGATEUR, PAS A CELLE DU RESEAU. C'est le
 * changement le plus visible de l'etape 4.2. Le client d'origine dessinait DANS
 * le gestionnaire du message d'etat: le jeu plafonnait donc a vingt images par
 * seconde sur toutes les machines, et chaque hoquet du reseau se voyait a
 * l'ecran. Ici, la boucle lit l'etat courant a chaque image et affiche une
 * position lissee entre les deux derniers battements recus.
 *
 * ELLE NE S'ABONNE PAS AU MAGASIN, ELLE LE LIT. S'abonner reveillerait le rendu a
 * chaque message, c'est-a-dire recreerait le couplage qu'on vient de defaire. Les
 * menus, eux, s'abonnent, parce qu'ils ne doivent se refaire que quand quelque
 * chose change: c'est le bon usage de l'abonnement.
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
 *            ->  localisation -> scene
 *
 * CE QU'ELLE NE FAIT PAS ENTENDRE: le passage d'un ecran a l'autre. Le depart et
 * la fin de la partie changent d'ecran, et c'est l'application (etape 4.3), qui
 * existe avant et apres la boucle, qui les fait entendre.
 */

import type { DimensionsCarte, Mode } from '@neon-ninja/shared';

import type { Client } from '../client.js';
import type { Controles } from '../controles/controles.js';
import type { EtatClient } from '../etat.js';
import type { FaitDeJeu } from '../faits.js';
import { faitsArrives } from '../faits.js';
import type { HorlogeClient } from '../horloge.js';
import type { NiveauDeSang } from '../interface/preferences.js';
import type { AfficheurDePoints } from '../hud/pointsFlottants.js';
import type { Surcouche } from '../hud/surcouche.js';
import { construireHud } from '../hud/modele.js';
import { pointsDuChangement, texteDesPoints } from '../pointsFlottants.js';
import { bonusDOrigineEnCours, filtreDesMalus, moiDansLaPartie } from '../selecteurs.js';
import { rechargeApresLeTir, sonDuFait, sonsDuChangement } from '../sons/declencheurs.js';
import type { LecteurDeSons } from '../sons/lecteur.js';
import { DUREES_LOCALISATION, HAUTEUR_DE_VUE_PX } from './apparence.js';
import type { Camera } from './camera.js';
import { cameraSur, suivre, versEcran } from './camera.js';
import { TamponDeLissage } from './interpolation.js';
import type { Localisation } from './localisation.js';
import { localiser, opaciteDeLocalisation } from './localisation.js';
import type { MicroArret } from './katana.js';
import { instantAffiche, suivreLeMicroArret } from './katana.js';
import type { Rendu } from './pixi.js';
import { empreinte } from './sang.js';
import { construireScene } from './scene.js';
import type { SangAuSol, SuiviDesPas } from './traces.js';
import { AUCUN_PAS, TRACES, avancerLesPas } from './traces.js';
import { creerJugeDeStabilite } from './stabilite.js';

/** Ce qu'il faut pour faire tourner une partie a l'ecran. */
export interface OptionsBoucle {
  readonly client: Client;
  readonly rendu: Rendu;
  readonly controles: Controles;
  readonly horloge: HorlogeClient;
  readonly carte: DimensionsCarte;
  /** La surcouche du HUD. Absente, le jeu s'affiche sans interface. */
  readonly surcouche?: Surcouche;
  /** Le sang que le joueur veut voir, en Massacre. Normal par defaut. */
  readonly niveauDeSang?: () => NiveauDeSang;
  /** Le lecteur de sons. Absent, le jeu est muet. */
  readonly sons?: LecteurDeSons;
  /** L'affichage des points gagnes. Absent, les gains ne se voient qu'au classement. */
  readonly pointsFlottants?: Pick<AfficheurDePoints, 'montrer'>;
  /**
   * Appele une fois, quand la partie est dessinee a une cadence fluide (stabilite.ts):
   * l'ecran de jeu leve alors son ecran de preparation.
   */
  readonly surStabilite?: () => void;
  /** Le cadrage est-il celui d'un appareil tactile. */
  readonly mobile?: boolean;
  /**
   * La hauteur de carte montree sur ordinateur, en pixels. Celle de tous les modes par
   * defaut; plus courte en Tactique (etape 7.7).
   */
  readonly hauteurDeVue?: number;
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

/**
 * Ce fait nous fait-il reapparaitre ailleurs, de sorte qu'il faut nous y retrouver.
 *
 * Deux corrections de l'etape 5.5. En Chasse, une proie attrapee devient traqueur SUR
 * PLACE: les fleches la designaient alors qu'elle n'avait pas bouge. En Massacre, un
 * joueur tue reapparait ailleurs, et les fleches ne l'aidaient pas a se retrouver.
 */
export function faitQuiNousDeplace(
  fait: FaitDeJeu,
  mode: Mode | undefined,
  moi: string | undefined,
): boolean {
  switch (fait.nature) {
    case 'captureSubie':
      return mode !== 'chasse';
    case 'captureParBotNoir':
      return true;
    case 'joueurTranche':
      return fait.charge.victime === moi;
    default:
      return false;
  }
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
  let bouclesEnCours = new Set<string>();
  /** L'instant ou recharger le fusil du traqueur, apres son dernier tir (Chasse). */
  let rechargePrevue: number | undefined;
  /** Les fleches qui designent notre personnage, tant qu'elles sont visibles. */
  let localisation: Localisation | undefined;
  /** Notre personnage a-t-il deja ete montre a son apparition. */
  let apparitionMontree = false;
  let vivante = true;
  let prochaineImage: number | undefined;
  const juge = creerJugeDeStabilite();
  let stabiliteAnnoncee = false;
  /** Les pieds de chaque joueur, pour les traces de pas du Massacre (etape 7.4). */
  let suiviDesPas: SuiviDesPas = AUCUN_PAS;
  /** Le sang frais au sol, que les pieds emportent, retrouve par identifiant. */
  const sangAuSol = new Map<string, SangAuSol>();
  /** Le micro-arret d'un coup de katana qui tranche, s'il y en a un en cours. */
  let microArret: MicroArret | undefined;

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

    // Un tir demande part aussi, une seule fois (mode Tactique, etape 7.1).
    if (options.controles.prendreLaDemandeDeTir()) {
      options.client.capturer();
    }

    // 2. Les faits recus depuis l'image precedente.
    const faitsNouveaux = faitsArrives(etatPrecedent.journal, etat.journal);

    // 3. Les sons naissent de ce qui vient d'arriver.
    const precedent = etatPrecedent;
    faireEntendre(etat, precedent, faitsNouveaux, maintenant);
    etatPrecedent = etat;

    // 4. Faut-il montrer ou se trouve notre personnage.
    const moi = moiDansLaPartie(etat);
    reperer(moi !== undefined, faitsNouveaux, maintenant);

    // 5. L'affichage lit l'etat courant, sans s'y abonner. Quand notre coup de katana
    //    tranche, le mouvement se fige un instant: le micro-arret de l'impact (Massacre,
    //    etape 7.4). Seul le lissage s'arrete; le reste du jeu continue.
    microArret = suivreLeMicroArret(microArret, faitsNouveaux, etat.moi, maintenant);

    tampon.observer(etat.partie, maintenant);
    const lissee = tampon.vueLissee(instantAffiche(microArret, maintenant));
    const taille = options.taille();

    const cible = moi ?? { x: options.carte.largeur / 2, y: options.carte.hauteur / 2 };

    camera =
      camera === undefined
        ? cameraSur(
            cible,
            taille,
            options.carte,
            options.mobile ?? false,
            options.hauteurDeVue ?? HAUTEUR_DE_VUE_PX,
          )
        : suivre(camera, cible, taille, options.carte, dtMs);

    const niveauDeSang = options.niveauDeSang?.() ?? 'normal';
    const scene = construireScene(etat, lissee, maintenant, localisation, niveauDeSang);
    options.rendu.dessiner(scene, camera);
    // Vision floue et Vision negative troublent le terrain, pas le HUD (etape 7.7).
    options.rendu.filtrer(filtreDesMalus(etat, maintenant));

    // 5 bis. Le sang imprime au sol colle aux pieds de qui marche dedans (Massacre,
    //    etape 7.4). Seulement au niveau normal: discret, le sang s'efface, sans traces.
    if (niveauDeSang === 'normal' && lissee !== undefined && etat.salon?.mode === 'massacre') {
      marcherDansLeSang(scene.sang, lissee, maintenant);
    }
    options.surcouche?.afficher(construireHud(etat, maintenant));

    // Les premieres images dessinees preparent le decor et la lueur, et rament: on
    // annonce le moment ou l'affichage devient fluide (recette de l'etape 5.4).
    if (!stabiliteAnnoncee && juge.observer(instant, lissee !== undefined)) {
      stabiliteAnnoncee = true;
      options.surStabilite?.();
    }

    // 6. Les points gagnes naissent a leur place sur l'ecran, vue par la camera de
    //    cette image.
    const afficheur = options.pointsFlottants;

    if (afficheur !== undefined) {
      for (const gain of pointsDuChangement(precedent, etat)) {
        afficheur.montrer({
          texte: texteDesPoints(gain.valeur),
          genre: gain.genre,
          niveau: gain.niveau,
          ...versEcran(gain, camera, taille),
        });
      }
    }

    // 7. Les pas suivent le mouvement affiche, pas la touche enfoncee: un joueur
    //    bloque contre un mur tient sa touche sans avancer, et le jeu d'origine
    //    lui faisait entendre une course sur place.
    const monEntite = lissee?.entites.find(({ entite }) => entite.id === etat.moi);

    if (monEntite?.enMouvement === true) {
      options.sons?.jouerUnPas(maintenant, false);
    }
  };

  /** Suit les pieds des joueurs affiches, et imprime leurs pas dans le sang. */
  const marcherDansLeSang = (
    taches: readonly {
      readonly id: string;
      readonly x: number;
      readonly y: number;
      readonly instant: number;
    }[],
    lissee: NonNullable<ReturnType<TamponDeLissage['vueLissee']>>,
    maintenant: number,
  ): void => {
    for (const tache of taches) {
      sangAuSol.set(tache.id, tache);
    }

    for (const [id, tache] of sangAuSol) {
      if (maintenant - tache.instant > TRACES.fraicheurMs) {
        sangAuSol.delete(id);
      }
    }

    const marcheurs = lissee.entites
      .filter(({ entite }) => entite.type === 'joueur')
      .map(({ entite, x, y }) => ({ id: entite.id, x, y }));
    const avance = avancerLesPas(suiviDesPas, marcheurs, [...sangAuSol.values()], maintenant);
    suiviDesPas = avance.suivi;

    if (avance.pas.length > 0) {
      options.rendu.imprimer(
        avance.pas.map((pas) => ({
          id: pas.id,
          formes: empreinte(pas.x, pas.y, pas.angle, pas.opacite),
        })),
      );
    }
  };

  /**
   * Decide s'il faut faire apparaitre les fleches autour de notre personnage.
   *
   * Trois occasions, celles du jeu d'origine: la premiere fois qu'il apparait, a
   * chaque capture qui le fait reapparaitre ailleurs, et quand le joueur le
   * demande. Une demande faite pendant que les fleches sont deja la est ignoree,
   * comme dans le jeu d'origine: maintenir F ne les fait pas clignoter.
   */
  const reperer = (
    present: boolean,
    faitsNouveaux: readonly FaitDeJeu[],
    maintenant: number,
  ): void => {
    const demandee = options.controles.prendreLaDemandeDeLocalisation();

    if (!present) {
      return;
    }

    const etat = options.client.etat;
    const deplace = faitsNouveaux.some((fait) =>
      faitQuiNousDeplace(fait, etat.salon?.mode, etat.moi),
    );

    if (!apparitionMontree || deplace) {
      apparitionMontree = true;
      localisation = localiser(maintenant, DUREES_LOCALISATION.automatiqueMs);
      return;
    }

    if (demandee && opaciteDeLocalisation(localisation, maintenant) === 0) {
      localisation = localiser(maintenant, DUREES_LOCALISATION.demandeeMs);
    }
  };

  /** Joue les sons que meritent les faits recus et les changements d'etat. */
  const faireEntendre = (
    etat: EtatClient,
    precedent: EtatClient,
    faitsNouveaux: readonly FaitDeJeu[],
    maintenant: number,
  ): void => {
    const sons = options.sons;

    if (sons === undefined) {
      return;
    }

    for (const nom of sonsDuChangement(precedent, etat)) {
      sons.jouer(nom);
    }

    for (const fait of faitsNouveaux) {
      const nom = sonDuFait(fait, etat.moi, etat.salon?.mode);

      if (nom !== undefined) {
        sons.jouer(nom);
      }

      rechargePrevue = rechargeApresLeTir(fait, etat.moi, etat.salon?.mode) ?? rechargePrevue;
    }

    // Le fusil du traqueur se recharge quand il peut tirer de nouveau (Chasse, etape 5.5).
    if (rechargePrevue !== undefined && maintenant >= rechargePrevue) {
      rechargePrevue = undefined;
      sons.jouer('rechargeFusil');
    }

    // Les boucles de bonus se demarrent et s'arretent sur le passage: comparer
    // l'ensemble courant a l'ensemble precedent evite d'avoir a se souvenir de
    // qui a demarre quoi. On lit les effets EN COURS a cet instant, et non la
    // liste du magasin: celui-ci ne retire un effet expire qu'a l'arrivee du
    // suivant, et la boucle sonore d'un bonus fini tournerait sinon jusque-la.
    // Seuls les bonus du jeu d'origine ont un son en boucle (etape 7.7).
    const actives = new Set<string>(bonusDOrigineEnCours(etat, maintenant));

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
