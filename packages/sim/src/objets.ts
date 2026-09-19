/**
 * Les objets a ramasser: bonus et malus poses sur la carte.
 *
 * Portage de spawnBonus (legacy/server.js:1579), spawnMalus (:651),
 * handleBonusCollection (:1614), handleMalusCollection (:684), des deux fonctions
 * de vieillissement updateBonusItems (:1499) et updateMalusItems (:1477), et du
 * ramassage lui-meme, qui n'etait pas une fonction dans le legacy mais deux
 * filtrages ecrits en ligne au bout de detectCollisions (:1737 a 1761).
 *
 * TROIS CHOSES QU'IL FAUT SAVOIR SUR CE DOMAINE.
 *
 * 1. Un malus frappe les AUTRES joueurs, pas celui qui le ramasse. C'est
 *    contre-intuitif et c'est voulu: comportement a preserver numero 4 de
 *    CLAUDE.md. Ramasser un malus est donc une attaque, pas un accident. Qui sont
 *    « les autres » depend du mode: en Equipes, l'equipe adverse (etape 7.2).
 *
 * 2. Le ramassage n'est pas un contact entre entites. Il se joue a quinze pixels
 *    la ou deux entites se touchent a vingt, et il ne concerne que les joueurs:
 *    un bot passe sur un bonus sans le voir. C'est pour cela que ce fichier ne
 *    passe pas par le releve des contacts.
 *
 * 3. Les apparitions ne sont plus des minuteries. Voir planification.ts, qui
 *    explique comment le defaut X1 de l'audit disparait par construction.
 *
 * Ce que le portage laisse de cote: le legacy ne faisait rien si le joueur
 * n'avait pas de socket connectee. Le moteur ne connait pas les sockets; un
 * joueur present dans l'etat est un joueur qui joue.
 */

import type { Alea, EffetTactique, NatureBonus, NatureMalus, Position } from '@neon-ninja/shared';
import {
  OBJETS,
  OBJETS_TACTIQUES,
  TYPES_BONUS,
  TYPES_BONUS_TACTIQUES,
  TYPES_MALUS,
  TYPES_MALUS_TACTIQUES,
  element,
  nombre,
} from '@neon-ninja/shared';

import type { DureesRestantes } from './effets.js';
import { cumuler, remplacer } from './effets.js';
import type {
  BonusPose,
  EtatPartie,
  IdentifiantEntite,
  Joueur,
  MalusPose,
  ObjetRamassable,
} from './etat.js';
import { identifiantSuivant, positionDApparition } from './etat.js';
import {
  dureeDeLEffet,
  estUnBonusTactique,
  estUnMalusTactique,
  objetTactiqueActif,
  tauxDuBonus,
} from './objetsTactiques.js';
import { etatTactiqueDe } from './tactique.js';
import { avancerUneEcheance, intervalleVariable } from './planification.js';

/** Ce qu'il faut pour poser un objet sur la carte. */
export type OptionsPoseObjet =
  | {
      readonly categorie: 'bonus';
      readonly nature: NatureBonus;
      /** Position imposee. Sinon elle est tiree de la graine. */
      readonly position?: Position;
    }
  | {
      readonly categorie: 'malus';
      readonly nature: NatureMalus;
      readonly position?: Position;
    };

/**
 * Pose un bonus ou un malus sur la carte.
 *
 * La position tiree au sort evite les murs, mais ne s'ecarte pas des entites
 * presentes, contrairement a l'apparition d'un joueur ou d'un bot. Un bonus qui
 * apparait pres d'un joueur n'est pas un probleme, c'est meme une bonne surprise;
 * ce qu'on veut eviter, c'est de faire apparaitre quelqu'un colle a un bot noir.
 */
export function poserObjet(etat: EtatPartie, options: OptionsPoseObjet): EtatPartie {
  let alea = etat.alea;
  let position = options.position;

  if (position === undefined) {
    const tirage = positionDApparition(alea, etat.terrain);
    position = tirage.valeur;
    alea = tirage.alea;
  }

  const identifiant = identifiantSuivant(etat, options.categorie);
  const commun = {
    id: identifiant.valeur,
    position,
    dureeDeVieRestanteMs: OBJETS.DUREE_DE_VIE_MS,
  };
  const objet: ObjetRamassable =
    options.categorie === 'bonus'
      ? { ...commun, categorie: 'bonus', nature: options.nature }
      : { ...commun, categorie: 'malus', nature: options.nature };

  return {
    ...etat,
    objets: { ...etat.objets, [identifiant.valeur]: objet },
    compteurIdentifiants: identifiant.compteur,
    alea,
  };
}

/** Retire un objet de la carte. Sans effet s'il n'y etait pas. */
export function retirerObjet(etat: EtatPartie, id: IdentifiantEntite): EtatPartie {
  if (etat.objets[id] === undefined) {
    return etat;
  }

  const objets = { ...etat.objets };
  delete objets[id];

  return { ...etat, objets };
}

/**
 * Fait vieillir les objets poses et retire ceux dont le temps est passe.
 *
 * Un objet vit huit secondes, comme dans le legacy, ou isExpired comparait la
 * date de creation a l'horloge. Ici c'est un compte a rebours.
 */
export function fairePasserLeTempsSurLesObjets(etat: EtatPartie, dtMs: number): EtatPartie {
  const objets: Record<IdentifiantEntite, ObjetRamassable> = {};

  for (const [id, objet] of Object.entries(etat.objets)) {
    const restante = objet.dureeDeVieRestanteMs - dtMs;
    if (restante > 0) {
      objets[id] = { ...objet, dureeDeVieRestanteMs: restante };
    }
  }

  return { ...etat, objets };
}

/**
 * Fait apparaitre les bonus et les malus dont c'est l'heure.
 *
 * Les deux familles ont leur propre compte a rebours, comme le legacy avait deux
 * chaines de minuteries independantes.
 */
export function faireApparaitreLesObjets(etat: EtatPartie, dtMs: number): EtatPartie {
  const apresBonus = avancerUneEcheance(
    etat,
    dtMs,
    'bonusMs',
    (alea) => intervalleVariable(alea, etat.reglages.bonus.intervalleApparitionS),
    tenterUneApparitionDeBonus,
  );

  return avancerUneEcheance(
    apresBonus,
    dtMs,
    'malusMs',
    (alea) => intervalleVariable(alea, etat.reglages.malus.intervalleApparitionS),
    tenterUneApparitionDeMalus,
  );
}

/**
 * Une tentative d'apparition de bonus: chaque nature active tente sa chance.
 *
 * Un seul passage peut donc poser plusieurs bonus, comme dans le legacy. Les natures
 * desactivees ne consomment aucun tirage, ce qui compte: c'est ce qui garantit qu'une
 * meme graine donne la meme partie quel que soit le nombre de bonus actives.
 *
 * En Tactique (etape 7.7), ses trois bonus tentent leur chance a la suite des trois du jeu
 * d'origine, et les six a la moitie de leur taux: deux fois plus de natures, autant de
 * bonus sur la carte (decision du porteur du projet du 19 septembre 2026). Hors du
 * Tactique, rien ne change, pas meme le nombre de tirages.
 */
function tenterUneApparitionDeBonus(etat: EtatPartie): EtatPartie {
  let courant = etat;
  const tactique = etat.mode === 'tactique';
  const part = tactique ? OBJETS_TACTIQUES.PART_DU_TAUX_DES_BONUS : 1;

  for (const [nature, taux] of chancesDesBonus(etat, tactique)) {
    const tirage = tirerUneChance(courant.alea, taux * part);
    courant = { ...courant, alea: tirage.alea };

    if (tirage.reussi) {
      courant = poserObjet(courant, { categorie: 'bonus', nature });
    }
  }

  return courant;
}

/** Les bonus actifs de la partie et leur taux, dans l'ordre ou ils tentent leur chance. */
function chancesDesBonus(
  etat: EtatPartie,
  tactique: boolean,
): readonly (readonly [NatureBonus, number])[] {
  const chances: (readonly [NatureBonus, number])[] = [];

  for (const nature of TYPES_BONUS) {
    const reglage = etat.reglages.bonus.types[nature];
    if (reglage.actif) {
      chances.push([nature, reglage.tauxApparitionPourCent]);
    }
  }

  if (tactique) {
    for (const nature of TYPES_BONUS_TACTIQUES) {
      if (objetTactiqueActif(etat.reglages, nature)) {
        chances.push([nature, tauxDuBonus(etat.reglages, nature)]);
      }
    }
  }

  return chances;
}

/**
 * Une tentative d'apparition de malus: une seule chance, puis un tirage de nature.
 *
 * Le plafond de cinq malus simultanes est celui du legacy. Il n'existe pas de
 * plafond equivalent pour les bonus. En Tactique, ses trois malus s'ajoutent aux natures
 * tirees: il ne tombe pas plus de malus, chacun tombe moins souvent (etape 7.7).
 */
function tenterUneApparitionDeMalus(etat: EtatPartie): EtatPartie {
  const reglages = etat.reglages.malus;
  const naturesActives: NatureMalus[] = TYPES_MALUS.filter(
    (nature) => reglages.types[nature].actif,
  );

  if (etat.mode === 'tactique') {
    naturesActives.push(
      ...TYPES_MALUS_TACTIQUES.filter((nature) => objetTactiqueActif(etat.reglages, nature)),
    );
  }

  if (!reglages.actifs || naturesActives.length === 0) {
    return etat;
  }

  if (nombreDeMalusPoses(etat) >= OBJETS.MALUS_SIMULTANES_MAXIMUM) {
    return etat;
  }

  const chance = tirerUneChance(etat.alea, reglages.tauxApparitionPourCent);
  if (!chance.reussi) {
    return { ...etat, alea: chance.alea };
  }

  const choix = element(chance.alea, naturesActives);

  return poserObjet({ ...etat, alea: choix.alea }, { categorie: 'malus', nature: choix.valeur });
}

/** Combien de malus attendent d'etre ramasses. */
export function nombreDeMalusPoses(etat: EtatPartie): number {
  return Object.values(etat.objets).filter((objet) => objet.categorie === 'malus').length;
}

/** Tire une chance sur cent, comme le legacy: Math.random() * 100 < taux. */
function tirerUneChance(
  alea: Alea,
  tauxPourCent: number,
): { readonly reussi: boolean; readonly alea: Alea } {
  const tirage = nombre(alea);

  return { reussi: tirage.valeur * 100 < tauxPourCent, alea: tirage.alea };
}

/**
 * Un malus ramasse frappe-t-il cet autre joueur ?
 *
 * C'est une decision du mode de jeu (JeuDeRegles, dans moteur.ts). Le ramasseur, lui,
 * n'est jamais frappe: la question n'est posee que pour les autres.
 */
export type VictimeDuMalus = (ramasseur: Joueur, autre: Joueur) => boolean;

/** Le malus du Classique et du Tactique: tous les autres joueurs le subissent. */
export const malusClassique: VictimeDuMalus = () => true;

/**
 * Ramasse tous les objets sur lesquels un joueur se trouve.
 *
 * Les joueurs sont parcourus dans leur ordre d'arrivee, et chacun peut ramasser
 * plusieurs objets d'un coup s'il en couvre plusieurs, comme dans le legacy.
 *
 * Qui subit un malus depend du mode: le moteur passe la regle de son jeu de regles, et
 * celle du Classique vaut par defaut (etape 7.2).
 */
export function ramasserLesObjets(
  etat: EtatPartie,
  victime: VictimeDuMalus = malusClassique,
  horsJeu: ReadonlySet<IdentifiantEntite> = new Set(),
): EtatPartie {
  let courant = etat;

  // Les positions sont celles de ce battement et aucun ramassage ne les change:
  // on peut parcourir les joueurs tels qu'ils sont a l'entree.
  for (const joueur of Object.values(etat.joueurs)) {
    // Un joueur hors jeu (un traqueur elimine, en Chasse, etape 7.3) ne ramasse rien.
    if (horsJeu.has(joueur.id)) {
      continue;
    }

    for (const objet of Object.values(courant.objets)) {
      if (aPortee(joueur.position, objet.position)) {
        courant = ramasser(
          courant,
          joueur.id,
          objet.id,
          (ramasseur, autre) => !horsJeu.has(autre.id) && victime(ramasseur, autre),
        );
      }
    }
  }

  return courant;
}

/** Le joueur est-il assez pres de l'objet pour le ramasser ? */
function aPortee(joueur: Position, objet: Position): boolean {
  return Math.hypot(joueur.x - objet.x, joueur.y - objet.y) < OBJETS.SEUIL_RAMASSAGE_PX;
}

/**
 * Un joueur ramasse un objet donne.
 *
 * Renvoie l'etat inchange si le joueur ou l'objet n'existe pas. La distance n'est
 * pas verifiee: c'est l'appelant qui constate le ramassage, comme pour les
 * captures ou la geometrie et la regle sont separees.
 */
export function ramasser(
  etat: EtatPartie,
  joueurId: IdentifiantEntite,
  objetId: IdentifiantEntite,
  victime: VictimeDuMalus = malusClassique,
): EtatPartie {
  const joueur = etat.joueurs[joueurId];
  const objet = etat.objets[objetId];

  if (joueur === undefined || objet === undefined) {
    return etat;
  }

  const sansObjet = retirerObjet(etat, objetId);

  return objet.categorie === 'bonus'
    ? accorderLeBonus(sansObjet, joueur, objet)
    : infligerLeMalus(sansObjet, joueur, objet, victime);
}

/**
 * Le ramasseur recoit le bonus, et personne d'autre.
 *
 * La duree s'ajoute a ce qui reste: ramasser deux bonus de vitesse coup sur coup
 * donne vingt secondes. Comportement a preserver numero 10 de CLAUDE.md.
 */
function accorderLeBonus(etat: EtatPartie, joueur: Joueur, bonus: BonusPose): EtatPartie {
  const nature = bonus.nature;
  const dureeMs = estUnBonusTactique(nature)
    ? dureeDeLEffet(etat.reglages, nature)
    : etat.reglages.bonus.types[nature].dureeS * 1000;
  const apresEffet = estUnBonusTactique(nature)
    ? modifierLesEffetsTactiques(etat, joueur.id, (effets) => cumuler(effets, nature, dureeMs))
    : {
        ...etat,
        joueurs: {
          ...etat.joueurs,
          [joueur.id]: {
            ...joueur,
            bonusRestantsMs: cumuler(joueur.bonusRestantsMs, nature, dureeMs),
          },
        },
      };

  return {
    ...apresEffet,
    evenements: [
      ...apresEffet.evenements,
      {
        type: 'bonusRamasse',
        joueur: joueur.id,
        nature,
        dureeMs,
        position: bonus.position,
      },
    ],
  };
}

/**
 * Change les effets du Tactique d'un joueur (etape 7.7). Ils vivent dans son etat
 * tactique, et non dans Joueur: une partie d'un autre mode n'en porte aucune trace.
 */
function modifierLesEffetsTactiques(
  etat: EtatPartie,
  id: IdentifiantEntite,
  modifier: (effets: DureesRestantes<EffetTactique>) => DureesRestantes<EffetTactique>,
): EtatPartie {
  const arme = etatTactiqueDe(etat, id);

  return {
    ...etat,
    tactique: { ...etat.tactique, [id]: { ...arme, effets: modifier(arme.effets) } },
  };
}

/**
 * Le ramasseur est epargne, tous les autres subissent.
 *
 * C'est le comportement a preserver numero 4 de CLAUDE.md. La duree repart de
 * zero pour chaque victime au lieu de s'ajouter, ce qui est la regle du malus
 * dans le legacy: son client inscrivait une fin a « maintenant plus la duree »,
 * ecrasant la precedente.
 *
 * Parmi les autres, le mode dit qui subit: tous en Classique, l'equipe adverse en
 * Equipes.
 */
function infligerLeMalus(
  etat: EtatPartie,
  ramasseur: Joueur,
  malus: MalusPose,
  victime: VictimeDuMalus,
): EtatPartie {
  const nature = malus.nature;
  const tactique = estUnMalusTactique(nature);
  const dureeMs = tactique
    ? dureeDeLEffet(etat.reglages, nature)
    : etat.reglages.malus.types[nature].dureeS * 1000;
  let courant = etat;
  const joueurs: Record<IdentifiantEntite, Joueur> = { ...etat.joueurs };
  const victimes: IdentifiantEntite[] = [];

  for (const [id, joueur] of Object.entries(etat.joueurs)) {
    if (id === ramasseur.id || !victime(ramasseur, joueur)) {
      continue;
    }

    if (tactique) {
      courant = modifierLesEffetsTactiques(courant, id, (effets) =>
        remplacer(effets, nature, dureeMs),
      );
    } else {
      joueurs[id] = {
        ...joueur,
        malusRestantsMs: remplacer(joueur.malusRestantsMs, nature, dureeMs),
      };
    }
    victimes.push(id);
  }

  return {
    ...courant,
    joueurs,
    evenements: [
      ...courant.evenements,
      {
        type: 'malusRamasse',
        joueur: ramasseur.id,
        nature,
        dureeMs,
        victimes,
        position: malus.position,
      },
    ],
  };
}
