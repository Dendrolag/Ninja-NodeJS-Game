/**
 * Le HUD, sous forme de donnees: ce que la surcouche doit montrer.
 *
 * FONCTION PURE, COMME LA SCENE. On lui donne l'etat et l'instant, elle rend la
 * description de ce qu'il faut afficher: le temps restant deja mis en forme, les
 * lignes du classement, les effets en cours avec leur reste, les points du radar, dans
 * le mode Tactique, nos charges, dans le mode Chasse, notre role, et, dans les modes
 * Massacre et Horde, notre combo.
 * Ecrire cela dans le document est le travail d'un autre fichier.
 *
 * POURQUOI CE DECOUPAGE ICI AUSSI. Le client d'origine avait quinze fonctions qui
 * ecrivaient dans le document, chacune allant chercher ses donnees dans une
 * variable globale differente: updateTimer, updatePlayerList, updateBonusTimers,
 * updateActiveBonusesDisplay, updateMalusEffects, et ainsi de suite. Le score
 * affiche pouvait donc contredire le score recu, et rien ne pouvait le detecter.
 * Ici, tout ce qui s'affiche vient d'un seul calcul, verifiable par un test.
 *
 * LE HUD EST EN SURCOUCHE, PAS DANS PIXIJS. Du texte et des boutons se font mieux
 * en DOM: c'est accessible, cela se selectionne, cela se met en forme avec une
 * feuille de style, et cela ne coute rien au GPU. PixiJS dessine le terrain, le
 * document dessine l'interface par-dessus. C'est la pile annoncee par CLAUDE.md.
 */

import type {
  CampDeChasse,
  Couleur,
  LigneClassement,
  Mode,
  NatureObjet,
  ObjetDePoche,
} from '@neon-ninja/shared';
import {
  CARTES,
  CHASSE,
  COULEURS_DES_EQUIPES,
  COMBO,
  MASSACRE,
  REGLAGES_PAR_DEFAUT,
  TACTIQUE,
  campDeCouleur,
  classementDesEquipes,
  equipeDeCouleur,
  proiesRestantes,
} from '@neon-ninja/shared';

import type { EtatClient } from '../etat.js';
import { NOMS_DES_EQUIPES } from '../interface/modeles/cartes.js';
import { APPARENCE_OBJET, adresseDeLIcone } from '../rendu/apparence.js';
import {
  bonusDOrigineEnCours,
  effetsEnCours,
  moiDansLaPartie,
  resteDeLEffet,
} from '../selecteurs.js';

/** Sous cette duree restante, le temps s'affiche en alerte. */
export const SEUIL_URGENCE_MS = 30_000;

/** Sous cette duree restante, la carte d'un effet clignote (etape 4.6). */
export const SEUIL_FIN_PROCHE_MS = 3_000;

/** Une ligne du classement, prete a etre affichee. */
export interface LigneHud {
  readonly id: string;
  readonly pseudo: string;
  readonly couleur: Couleur;
  readonly points: number;
  /** Cette ligne est la notre: l'affichage la met en avant. */
  readonly moi: boolean;
  /** Rang, a partir de un. */
  readonly rang: number;
  /**
   * Il porte le x2 de l'Evade, ou, en Equipes, un membre de son equipe le porte: ses points
   * sont deja doubles, et un badge le dit (etape 7.9).
   */
  readonly doubleur: boolean;
}

/** Un effet en cours sur nous, avec ce qu'il en reste. */
export interface EffetHud {
  readonly nature: NatureObjet;
  readonly categorie: 'bonus' | 'malus';
  readonly libelle: string;
  readonly couleur: number;
  /** Ce qu'il reste, en millisecondes. */
  readonly resteMs: number;
  /** Ce qu'il reste, en secondes arrondies vers le haut: ce que le joueur lit. */
  readonly resteS: number;
  /** Ce qu'il reste de l'effet, de zero a un: la jauge de sa carte (etape 4.6). */
  readonly part: number;
  /** L'effet touche a sa fin: sa carte clignote (etape 4.6). */
  readonly finProche: boolean;
  /**
   * Un malus que nous avons ramasse: il frappe les autres et nous epargne (comportement a
   * preserver 4). Sa carte le dit, pour qu'il ne se lise pas comme subi.
   */
  readonly auxAutres: boolean;
  /** L'adresse de l'icone de l'objet, la meme que sur la carte. */
  readonly icone: string;
}

/**
 * Ce que nous avons en poche (etape 7.10): une carte parmi les effets, sans jauge, tant
 * que l'objet y est, et, sur un ecran tactile, un bouton pour s'en servir. Rendus A des
 * planches de docs/design/etape-7-10/, choisis par le porteur du projet.
 */
export interface PocheHud {
  readonly nature: ObjetDePoche;
  readonly libelle: string;
  readonly couleur: number;
  /** L'adresse de l'icone de l'objet, la meme que sur la carte. */
  readonly icone: string;
}

/**
 * Un joueur a poser sur le radar, place par rapport a son centre: nous, ou le milieu de la
 * carte quand nous n'y sommes pas.
 */
export interface PointRadar {
  readonly id: string;
  /** Son ecart au centre vers l'est, en part de la portee du radar: de moins un a un. */
  readonly x: number;
  /** Son ecart au centre vers le sud, en part de la portee du radar: de moins un a un. */
  readonly y: number;
  readonly couleur: Couleur;
  /** Ce point est le notre: l'affichage le grossit. */
  readonly moi: boolean;
  /** Il est plus loin que la portee: pose sur le bord du radar, dans sa direction. */
  readonly auBord: boolean;
}

/** Nos charges, dans le mode Tactique (etape 7.1). */
export interface ChargesHud {
  readonly disponibles: number;
  readonly maximum: number;
  /**
   * Ou en est la charge qui revient, de zero a un. Un aux charges pleines: rien n'est
   * en cours.
   */
  readonly recharge: number;
}

/** Notre role dans une partie Chasse, et ce qu'il reste de proies (etape 7.3). */
export interface ChasseHud {
  readonly camp: CampDeChasse;
  /** « Traqueur », « Éliminé » ou « Proie ». */
  readonly role: string;
  /** Ce que le role demande, en quelques mots. */
  readonly consigne: string;
  /** « 3 proies restantes », « 1 proie restante » ou « Plus aucune proie ». */
  readonly proies: string;
}

/** Notre combo, dans une partie Massacre (etape 7.4) ou Horde (etape 7.5). */
export interface ComboHud {
  /** Le multiplicateur en cours, deux au moins. */
  readonly multiplicateur: number;
  /** « 7 morts » en Massacre, « 7 ninjas » en Horde. */
  readonly compte: string;
  /** Ce qu'il reste a la fenetre du combo, de zero a un. */
  readonly fenetre: number;
}

/** Ce qu'il reste de ninjas a tuer, dans une partie Massacre (etape 7.4). */
export interface RestantsHud {
  readonly nombre: number;
  /** « 37 ninjas restants », « 1 ninja restant » ou « Carte nettoyée ». */
  readonly libelle: string;
}

/** Ce que porte le bouton d'action: des charges en Tactique, des vies en Chasse, un katana en Massacre. */
export type ArmeHud = 'charges' | 'vies' | 'katana';

/** Tout ce que la surcouche affiche a un instant donne. */
export interface Hud {
  /** Le temps restant, mis en forme minutes deux-points secondes. */
  readonly temps: string;
  /** Le temps restant en millisecondes, pour les animations. */
  readonly tempsRestantMs: number;
  /** La partie touche a sa fin: l'affichage passe en alerte. */
  readonly urgence: boolean;
  /** La partie est suspendue. */
  readonly enPause: boolean;
  /** Qui a suspendu la partie, quand on le sait. */
  readonly pausePar: string | undefined;
  /**
   * Le lien est tombe, et la page tente de revenir dans la partie (etape 2.5). La
   * partie affichee est figee sur ce qu'elle etait: le HUD le dit.
   */
  readonly retourEnCours: boolean;
  readonly classement: readonly LigneHud[];
  readonly effets: readonly EffetHud[];
  /** Ce que nous avons en poche. Absent: la poche est vide (etape 7.10). */
  readonly poche: PocheHud | undefined;
  /** Les joueurs sur le radar. Absent: pas de radar, hors de notre Revelation. */
  readonly radar: readonly PointRadar[] | undefined;
  /** Nos charges. Absentes hors du mode Tactique, ou tant qu'on n'est pas sur la carte. */
  readonly charges: ChargesHud | undefined;
  /** Notre role. Absent hors du mode Chasse, ou tant qu'on n'est pas au classement. */
  readonly chasse: ChasseHud | undefined;
  /**
   * Notre combo. Absent hors du Massacre et de la Horde, tant qu'on n'est pas au classement,
   * ou sous le deuxieme cran: un « x1 » n'apprend rien.
   */
  readonly combo: ComboHud | undefined;
  /** Les ninjas qui restent a tuer. Absent hors du Massacre. */
  readonly restants: RestantsHud | undefined;
  /** Ce que le bouton d'action porte, selon le mode. */
  readonly arme: ArmeHud;
}

/** Un HUD vide, celui d'un ecran hors partie. */
export const HUD_VIDE: Hud = {
  temps: '0:00',
  tempsRestantMs: 0,
  urgence: false,
  enPause: false,
  pausePar: undefined,
  retourEnCours: false,
  classement: [],
  effets: [],
  poche: undefined,
  radar: undefined,
  charges: undefined,
  chasse: undefined,
  combo: undefined,
  restants: undefined,
  arme: 'charges',
};

/**
 * Met en forme une duree en minutes et secondes.
 *
 * Les secondes sont arrondies VERS LE HAUT, pour que le compteur affiche « 1 »
 * pendant la derniere seconde et non « 0 » pendant qu'il reste encore du temps.
 */
export function formaterDuree(millisecondes: number): string {
  const secondes = Math.max(Math.ceil(millisecondes / 1000), 0);
  const minutes = Math.floor(secondes / 60);
  const reste = secondes % 60;

  return `${String(minutes)}:${String(reste).padStart(2, '0')}`;
}

/**
 * Construit le HUD a afficher.
 *
 * @param etat       L'etat du client.
 * @param maintenant Instant local, lu sur l'horloge du client.
 */
export function construireHud(etat: EtatClient, maintenant: number): Hud {
  const partie = etat.partie;

  if (partie === undefined) {
    return HUD_VIDE;
  }

  const mode = etat.salon?.mode;

  return {
    temps: formaterDuree(partie.tempsRestantMs),
    tempsRestantMs: partie.tempsRestantMs,
    urgence: partie.tempsRestantMs <= SEUIL_URGENCE_MS,
    enPause: partie.enPause,
    pausePar: etat.pausePar,
    retourEnCours: etat.connexion === 'retour',
    classement: classementHud(partie.classement, etat.moi, mode, doubleursDe(etat)),
    effets: effetsHud(etat, maintenant),
    poche: pocheHud(etat.poche),
    radar: radarHud(etat, mode, maintenant),
    charges: chargesHud(etat, mode),
    chasse: chasseHud(etat, mode),
    combo: comboHud(etat, mode, maintenant),
    restants: restantsHud(etat, mode),
    arme: mode === 'chasse' ? 'vies' : mode === 'massacre' ? 'katana' : 'charges',
  };
}

/**
 * Notre combo, lu dans nos coups de katana en Massacre (etape 7.4), dans nos ralliements en
 * Horde (etape 7.5).
 *
 * IL NE SE MONTRE QU'A PARTIR DU DEUXIEME CRAN, dans les deux modes: un « x1 » n'apprend
 * rien, ni hors de l'action (demande du porteur du projet, 19 septembre 2026), ni pendant
 * (9 octobre 2026, avec le compteur reduit a son multiplicateur).
 *
 * Le flux d'etat ne porte pas le combo: il ne concerne que nous. Notre dernier coup qui a
 * tue, ou notre dernier ralliement, dit ou il en est, et la fenetre de deux secondes court
 * depuis son arrivee. Il tombe plus tot si l'on s'est fait tuer, capturer ou attraper par un
 * Black Ninja depuis. Le moteur le tient au battement pres; l'ecart d'un battement ne se
 * voit pas sur une jauge.
 */
function comboHud(
  etat: EtatClient,
  mode: Mode | undefined,
  maintenant: number,
): ComboHud | undefined {
  const partie = etat.partie;

  if (
    (mode !== 'massacre' && mode !== 'classique') ||
    partie?.classement.some((ligne) => ligne.id === etat.moi) !== true
  ) {
    return undefined;
  }

  const combo = comboEnCours(etat, maintenant);

  if (combo === undefined || combo.multiplicateur < 2) {
    return undefined;
  }

  // Le deuxieme cran demande COMBO.COUPS_PAR_CRAN coups: le compte est toujours au pluriel.
  const unite = mode === 'massacre' ? 'morts' : 'ninjas';

  return {
    multiplicateur: combo.multiplicateur,
    compte: `${String(combo.coups)} ${unite}`,
    fenetre: combo.fenetre,
  };
}

/** Les ninjas qui restent a tuer, en Massacre (etape 7.4), tant qu'on est au classement. */
function restantsHud(etat: EtatClient, mode: Mode | undefined): RestantsHud | undefined {
  const partie = etat.partie;

  if (mode !== 'massacre' || partie?.classement.some((ligne) => ligne.id === etat.moi) !== true) {
    return undefined;
  }

  const nombre = partie.entites.filter((entite) => entite.type === 'bot').length;

  return {
    nombre,
    libelle:
      nombre === 0
        ? 'Carte nettoyée'
        : `${String(nombre)} ${nombre > 1 ? 'ninjas restants' : 'ninja restant'}`,
  };
}

/** Le combo en cours, d'apres le journal, ou rien s'il est tombe. */
function comboEnCours(
  etat: EtatClient,
  maintenant: number,
):
  | { readonly coups: number; readonly multiplicateur: number; readonly fenetre: number }
  | undefined {
  for (let rang = etat.journal.length - 1; rang >= 0; rang -= 1) {
    const fait = etat.journal[rang];

    if (fait === undefined) {
      continue;
    }

    // Tue, capture, ou attrape par un Black Ninja: le combo est tombe.
    if (
      fait.nature === 'captureParBotNoir' ||
      fait.nature === 'captureSubie' ||
      (fait.nature === 'joueurTranche' && fait.charge.victime === etat.moi)
    ) {
      return undefined;
    }

    const dernier =
      fait.nature === 'coupDeKatana' &&
      fait.charge.frappeur === etat.moi &&
      fait.charge.morts.length > 0
        ? fait.charge
        : fait.nature === 'ralliement'
          ? fait.charge
          : undefined;

    if (dernier !== undefined) {
      const fenetre = 1 - (maintenant - fait.instant) / COMBO.FENETRE_MS;

      return fenetre > 0
        ? {
            coups: dernier.combo,
            multiplicateur: dernier.multiplicateur,
            fenetre: Math.min(fenetre, 1),
          }
        : undefined;
    }
  }

  return undefined;
}

/**
 * Les joueurs qui portent le x2 de l'Evade (etape 7.9). Le flux d'etat le porte sur le
 * joueur, pas sur sa ligne du classement: c'est la que la page le lit.
 */
function doubleursDe(etat: EtatClient): ReadonlySet<string> {
  const doubleurs = new Set<string>();

  for (const entite of etat.partie?.entites ?? []) {
    if (entite.type === 'joueur' && entite.doubleur === true) {
      doubleurs.add(entite.id);
    }
  }

  return doubleurs;
}

/**
 * Le classement, numerote et marque a notre nom.
 *
 * DANS UNE PARTIE EQUIPES (etape 7.2), ce sont les equipes qui sont classees, et la
 * notre qui est marquee. Les points d'un joueur y comptent tous les ninjas de son
 * equipe: affiches ligne par ligne, ils se liraient comme un score personnel, et les
 * memes points seraient comptes autant de fois que l'equipe a de membres.
 */
function classementHud(
  classement: readonly LigneClassement[],
  moi: string | undefined,
  mode: Mode | undefined,
  doubleurs: ReadonlySet<string>,
): readonly LigneHud[] {
  if (mode === 'equipes') {
    return classementDesEquipesHud(classement, moi, doubleurs);
  }

  return classement.map((ligne, index) => ({
    id: ligne.id,
    pseudo: ligne.pseudo,
    couleur: ligne.couleur,
    points: ligne.points,
    moi: ligne.id === moi,
    rang: index + 1,
    doubleur: doubleurs.has(ligne.id),
  }));
}

/** Le classement des equipes, la gagnante d'abord, la notre marquee (etape 7.2). */
function classementDesEquipesHud(
  classement: readonly LigneClassement[],
  moi: string | undefined,
  doubleurs: ReadonlySet<string>,
): readonly LigneHud[] {
  const notreLigne = classement.find((ligne) => ligne.id === moi);
  const notre = notreLigne === undefined ? undefined : equipeDeCouleur(notreLigne.couleur);
  // Le porteur du x2 double le score de son equipe (etape 7.9): le classement des equipes
  // le lit sur ses lignes.
  const lignes = classement.map((ligne) => ({ ...ligne, doubleur: doubleurs.has(ligne.id) }));

  return classementDesEquipes(lignes).equipes.map((ligne, index) => ({
    id: `equipe-${ligne.equipe}`,
    pseudo: `Équipe ${NOMS_DES_EQUIPES[ligne.equipe]}`,
    couleur: COULEURS_DES_EQUIPES[ligne.equipe],
    points: ligne.points,
    moi: ligne.equipe === notre,
    rang: index + 1,
    doubleur: ligne.doubleur === true,
  }));
}

/** Ce que nous avons en poche, tel que le HUD le montre (etape 7.10). */
function pocheHud(poche: ObjetDePoche | undefined): PocheHud | undefined {
  if (poche === undefined) {
    return undefined;
  }

  const apparence = APPARENCE_OBJET[poche];

  return {
    nature: poche,
    libelle: apparence.libelle,
    couleur: apparence.couleur,
    icone: adresseDeLIcone(poche),
  };
}

/**
 * Les effets a montrer, du plus proche de sa fin au plus lointain.
 *
 * L'ordre compte: la jauge qui va disparaitre est celle que le joueur regarde.
 */
function effetsHud(etat: EtatClient, maintenant: number): readonly EffetHud[] {
  return effetsEnCours(etat, maintenant)
    .map((effet) => {
      const resteMs = resteDeLEffet(effet, maintenant);
      const apparence = APPARENCE_OBJET[effet.nature];

      return {
        nature: effet.nature,
        categorie: effet.categorie,
        libelle: apparence.libelle,
        couleur: apparence.couleur,
        resteMs,
        resteS: Math.ceil(resteMs / 1000),
        part: effet.dureeMs > 0 ? Math.min(Math.max(resteMs / effet.dureeMs, 0), 1) : 0,
        finProche: resteMs <= SEUIL_FIN_PROCHE_MS,
        auxAutres: effet.categorie === 'malus' && !effet.surMoi,
        icone: adresseDeLIcone(effet.nature),
      };
    })
    .sort((gauche, droite) => gauche.resteMs - droite.resteMs);
}

/**
 * Les points du radar (9 octobre 2026, a la place de la minimap, a la demande du porteur du
 * projet): les joueurs autour de nous, nous au centre.
 *
 * IL NE SE MONTRE QUE PENDANT NOTRE REVELATION (meme jour, apres essai du porteur du projet):
 * toujours affiche, il defaisait le camouflage, qui fait l'interet du jeu. La Revelation, elle,
 * devoile deja les vrais joueurs par un halo; le radar dit ou chercher ceux qui sont hors de
 * l'ecran. Il montre donc tous les joueurs que le serveur nous envoie, camps de la Chasse
 * compris, comme les halos: un traqueur sous Revelation recoit les proies (etape 2.9).
 *
 * ON N'Y MET QUE LES JOUEURS, pas les bots. Une carte couverte de cent points
 * blancs ne dit rien; les joueurs, eux, sont ce que l'on cherche du regard. Le
 * jeu d'origine n'avait pas de minimap du tout: elle vient des maquettes.
 *
 * UN JOUEUR HORS DE PORTEE SE POSE SUR LE BORD, dans sa direction: on sait toujours de quel
 * cote chercher. Sans nous sur la carte, le radar part du milieu de la carte, et sa portee
 * la couvre toute.
 *
 * EN TACTIQUE, ON N'Y MET QUE LES JOUEURS PROCHES (etape 7.7, decision du porteur du projet
 * du 19 septembre 2026): la vue plus proche ne cacherait rien si le radar montrait tout le
 * monde, meme sur son bord. C'est un filtre d'affichage, le flux reste complet.
 */
function radarHud(
  etat: EtatClient,
  mode: Mode | undefined,
  maintenant: number,
): readonly PointRadar[] | undefined {
  if (!bonusDOrigineEnCours(etat, maintenant).includes('revelation')) {
    return undefined;
  }

  const visibles = (etat.partie?.entites ?? []).filter((entite) => entite.type === 'joueur');
  const moi = moiDansLaPartie(etat);
  const carte = CARTES[(etat.salon?.reglages ?? REGLAGES_PAR_DEFAUT).carte];
  const centre = moi ?? { x: carte.largeur / 2, y: carte.hauteur / 2 };
  const portee =
    moi === undefined
      ? Math.hypot(carte.largeur, carte.hauteur) / 2
      : mode === 'tactique'
        ? PORTEE_DU_RADAR_TACTIQUE_PX
        : PORTEE_DU_RADAR_PX;

  return visibles.flatMap((entite): PointRadar[] => {
    const x = (entite.x - centre.x) / portee;
    const y = (entite.y - centre.y) / portee;
    const distance = Math.hypot(x, y);
    const point = { id: entite.id, couleur: entite.couleur, moi: entite.id === etat.moi };

    if (distance <= 1) {
      return [{ ...point, x, y, auBord: false }];
    }

    return mode === 'tactique'
      ? []
      : [{ ...point, x: x / distance, y: y / distance, auBord: true }];
  });
}

/**
 * La portee du radar, en pixels de carte: un peu plus que ce que l'ecran montre de haut
 * (HAUTEUR_DE_VUE_PX, 900), pour voir venir.
 */
export const PORTEE_DU_RADAR_PX = 1200;

/** La portee du radar en Tactique, ou rien ne se montre au-dela (etape 7.7). */
export const PORTEE_DU_RADAR_TACTIQUE_PX = 900;

/**
 * Notre role dans une partie Chasse, lu a notre couleur dans le classement (etape 7.3).
 *
 * Un traqueur au classement qui n'est plus sur la carte a ete elimine: il regarde la suite.
 */
function chasseHud(etat: EtatClient, mode: Mode | undefined): ChasseHud | undefined {
  const classement = etat.partie?.classement ?? [];
  const notre = classement.find((ligne) => ligne.id === etat.moi);

  if (mode !== 'chasse' || notre === undefined) {
    return undefined;
  }

  const camp = campDeCouleur(notre.couleur);
  const restantes = proiesRestantes(classement);
  const elimine = camp === 'traqueurs' && moiDansLaPartie(etat) === undefined;

  return {
    camp,
    role: camp === 'proies' ? 'Proie' : elimine ? 'Éliminé' : 'Traqueur',
    consigne:
      camp === 'proies'
        ? 'Cachez-vous, et bougez pour marquer'
        : elimine
          ? 'Vous regardez la suite'
          : 'Visez les vrais joueurs',
    proies:
      restantes === 0
        ? 'Plus aucune proie'
        : `${String(restantes)} ${restantes > 1 ? 'proies restantes' : 'proie restante'}`,
  };
}

/**
 * Nos charges, d'apres le flux d'etat.
 *
 * L'attente de la prochaine vient du dernier battement recu: elle avance par
 * vingtiemes de seconde, ce qui ne se voit pas sur une jauge de cinq secondes.
 *
 * EN CHASSE (etape 7.3), l'arme d'un traqueur voyage de la meme facon, et ses charges sont
 * ses vies: trois au plus, et aucune ne revient. Une proie n'en a pas.
 */
function chargesHud(etat: EtatClient, mode: Mode | undefined): ChargesHud | undefined {
  const moi = moiDansLaPartie(etat);

  if (moi?.type !== 'joueur' || moi.tactique === undefined) {
    return undefined;
  }

  const { charges, avantProchaineChargeMs } = moi.tactique;

  if (mode === 'chasse') {
    return { disponibles: charges, maximum: CHASSE.VIES_DES_TRAQUEURS, recharge: 0 };
  }

  // En Massacre (etape 7.4), une seule charge: le coup est pret, ou revient en 400 ms.
  if (mode === 'massacre') {
    return {
      disponibles: charges,
      maximum: 1,
      recharge:
        charges > 0
          ? 1
          : Math.min(Math.max(1 - avantProchaineChargeMs / MASSACRE.DELAI_ENTRE_COUPS_MS, 0), 1),
    };
  }

  const enCours = 1 - avantProchaineChargeMs / TACTIQUE.RECHARGE_MS;

  return {
    disponibles: charges,
    maximum: TACTIQUE.CHARGES_MAXIMUM,
    recharge: charges >= TACTIQUE.CHARGES_MAXIMUM ? 1 : Math.min(Math.max(enCours, 0), 1),
  };
}
