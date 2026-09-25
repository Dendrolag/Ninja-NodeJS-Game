/**
 * Les annonces: ce qui vient d'arriver, dit au joueur en une phrase.
 *
 * Le jeu d'origine affichait ces phrases par trois mecanismes, chacun avec sa
 * propre minuterie: une notification de salon (showNotification), un bandeau en
 * jeu pour les captures (showCaptureNotification) et le meme bandeau, pilote
 * autrement, pour les bonus et les malus. Ses textes sont repris ici, le
 * mecanisme devient unique.
 *
 * L'ETAPE 4.2 N'AVAIT PORTE QUE LE SON de ces evenements: une capture
 * s'entendait, mais le joueur ne savait pas qui l'avait capture. Le texte est
 * rattrape a l'etape 4.3.
 *
 * FONCTIONS PURES. On leur donne deux etats successifs, elles rendent les phrases
 * a montrer. Les faire apparaitre puis disparaitre est le travail de la page
 * (interface/composants/annonces.ts), qui ne decide d'aucun texte.
 *
 * CE QUI N'EST PAS ANNONCE ICI. Un refus d'entree s'affiche sous le champ du
 * pseudo, un refus de chat sous le champ du message: ils concernent un champ que
 * le joueur a sous les yeux, et le lui dire ailleurs le ferait chercher.
 */

import type {
  EvadeVu,
  Mode,
  NatureBonus,
  NatureMalus,
  NatureObjet,
  Refus,
} from '@neon-ninja/shared';
import { OBJETS_TACTIQUES, VITESSES, multiplicateurDuCombo } from '@neon-ninja/shared';

import type { EtatClient } from './etat.js';
import type { FaitDeJeu } from './faits.js';
import { faitsArrives } from './faits.js';
import { APPARENCE_EVADE, APPARENCE_OBJET, adresseDeLIcone } from './rendu/apparence.js';
import { jeSuisHote } from './selecteurs.js';

/** Le ton d'une annonce, qui decide de sa couleur. */
export type TonAnnonce =
  /** Une bonne nouvelle pour nous. */
  | 'succes'
  /** Une mauvaise nouvelle pour nous. */
  | 'alerte'
  /** Une information neutre. */
  | 'info';

/**
 * Le grand titre d'une annonce d'objet, au centre de l'ecran (etape 4.6, direction B des
 * planches de `docs/design/etape-4-6/`, choisie par le porteur du projet).
 */
export interface GrandTitre {
  /** Au-dessus du titre: « Bonus », « Malus » ou « Malus envoyé ». */
  readonly surtitre: string;
  /** Le nom de l'objet, en tres grand. */
  readonly titre: string;
  /** Sous le titre: ce que fait l'objet, ou qui nous l'inflige. */
  readonly ligne: string;
  /** La couleur de l'objet, celle qu'il a sur la carte. */
  readonly couleur: number;
  /**
   * L'adresse de son icone. Absente pour l'Evade (etape 7.9), qui n'a pas d'image: son
   * disque est raye, et porte « x2 ».
   */
  readonly icone: string | undefined;
  /** Un malus qui nous frappe: le titre se penche et se brouille. */
  readonly brouille: boolean;
  /** Le titre de l'Evade est raye rouge et blanc, comme lui (etape 7.9). */
  readonly raye?: true;
}

/** Une phrase a montrer au joueur. */
export interface Annonce {
  readonly texte: string;
  readonly ton: TonAnnonce;
  /**
   * Present, l'annonce prend la forme d'un grand titre au lieu d'une bulle du fil (etape
   * 4.6). Seuls les objets le prennent; le texte reste la phrase entiere.
   */
  readonly grandTitre?: GrandTitre;
}

/**
 * Ce que fait chaque bonus, en quelques mots, sous le grand titre de son annonce (etape 4.6).
 * La duree s'y ajoute: elle vient de l'effet recu, l'hote reglant les durees.
 */
const EFFETS_DES_BONUS: Readonly<Record<NatureBonus, string>> = {
  vitesse: `Vitesse x${String(VITESSES.MULTIPLICATEUR_BONUS).replace('.', ',')}`,
  invincibilite: 'Personne ne peut vous capturer',
  revelation: 'Les vrais joueurs se dévoilent',
  rafale: 'Vos tirs ne coûtent plus de charge',
  rechargeRapide: `Une charge revient en ${String(OBJETS_TACTIQUES.RECHARGE_RAPIDE_MS / 1000).replace('.', ',')} s`,
  viseeLarge: 'Votre cône s’ouvre et porte plus loin',
};

/** Une duree d'effet, en secondes entieres: « pendant 10 s ». */
function pendant(dureeMs: number): string {
  return `pendant ${String(Math.round(dureeMs / 1000))} s`;
}

/** Le grand titre de l'annonce d'un objet. */
function grandTitre(
  nature: NatureObjet,
  surtitre: string,
  ligne: string,
  brouille: boolean,
): GrandTitre {
  const apparence = APPARENCE_OBJET[nature];

  return {
    surtitre,
    titre: apparence.libelle,
    ligne,
    couleur: apparence.couleur,
    icone: adresseDeLIcone(nature),
    brouille,
  };
}

/**
 * Les textes des malus, repris du jeu d'origine (MALUS_MESSAGES, client.js:148).
 *
 * Deux textes par malus: celui de qui le declenche, et celui de qui le subit, ou
 * le nom du coupable remplace {joueur}.
 */
const TEXTES_MALUS: Readonly<
  Record<NatureMalus, { readonly declenche: string; readonly subi: string }>
> = {
  flou: {
    declenche: 'Vous volez les lunettes de vos adversaires',
    subi: '{joueur} vous a volé vos lunettes',
  },
  controlesInverses: {
    declenche: 'Vous avez inversé les contrôles de vos adversaires',
    subi: '{joueur} a trafiqué vos contrôles',
  },
  negatif: {
    declenche: 'Vous avez privé vos adversaires de couleurs',
    subi: '{joueur} vous prive de couleurs',
  },
  // Les malus du Tactique (etape 7.7), sur le meme ton.
  tirUnique: {
    declenche: 'Vos adversaires n’ont plus qu’une charge',
    subi: '{joueur} vous laisse une seule charge',
  },
  rechargeLente: {
    declenche: 'Vous ralentissez la recharge de vos adversaires',
    subi: '{joueur} a ralenti votre recharge',
  },
  viseeEtroite: {
    declenche: 'Vous resserrez la visée de vos adversaires',
    subi: '{joueur} a resserré votre visée',
  },
};

/** Un nombre de ninjas, accorde: zero et un restent au singulier en francais. */
function ninjas(nombre: number): string {
  return `${String(nombre)} ${nombre > 1 ? 'ninjas' : 'ninja'}`;
}

/**
 * La phrase qui annonce un fait recu, ou rien.
 *
 * Tous les faits en ont une, sauf le tir du mode Tactique: il se voit sur le terrain,
 * et, s'il prend un joueur, la capture s'annonce elle-meme. Une phrase de plus a
 * chaque tir noierait les autres.
 *
 * EN CHASSE (etape 7.3), une capture est une infection: la proie attrapee devient
 * traqueur, et aucun ninja ne change de main. Les phrases le disent.
 *
 * EN HORDE (etape 7.5), nos ralliements ne s'annoncent qu'a un nouveau palier de combo.
 *
 * EN MASSACRE (etape 7.4), un coup de katana ne s'annonce que lorsqu'il fait passer notre
 * multiplicateur a un nouveau palier; un joueur tue ne s'annonce qu'au tueur et a sa
 * victime; la carte videe s'annonce a tous, avec son bonus.
 *
 * @param mode Le mode de la partie, quand on le connait.
 * @param moi  Notre identifiant, quand on le connait.
 */
export function annonceDuFait(fait: FaitDeJeu, mode?: Mode, moi?: string): Annonce | undefined {
  switch (fait.nature) {
    case 'tirDeCapture':
      return undefined;

    case 'coupDeKatana':
      return annonceDuCoup(fait.charge, moi);

    case 'ralliement':
      return annonceDuRalliement(fait.charge);

    case 'joueurTranche':
      return annonceDeLaMiseAMort(fait.charge, moi);

    case 'carteVidee':
      return {
        texte: `Carte nettoyée : +${String(fait.charge.bonus)} points de temps`,
        ton: 'succes',
      };

    case 'captureSubie':
      return mode === 'chasse'
        ? { texte: `${fait.charge.parPseudo} vous a attrapé : vous êtes traqueur !`, ton: 'alerte' }
        : { texte: `Capturé par ${fait.charge.parPseudo} !`, ton: 'alerte' };

    case 'captureReussie':
      return mode === 'chasse'
        ? { texte: `${fait.charge.victimePseudo} rejoint les traqueurs`, ton: 'succes' }
        : {
            texte: `Vous avez capturé ${fait.charge.victimePseudo} : +${ninjas(fait.charge.botsGagnes)}`,
            ton: 'succes',
          };

    case 'captureParBotNoir':
      return mode === 'massacre'
        ? { texte: 'Un Black Ninja vous a eu : points perdus, combo brisé', ton: 'alerte' }
        : {
            texte: `Un Black Ninja vous a capturé : ${ninjas(fait.charge.botsPerdus)} perdus`,
            ton: 'alerte',
          };

    case 'vieDeTraqueurPerdue':
      return fait.charge.viesRestantes === 0
        ? { texte: 'C’était un PNJ. Éliminé, vous regardez la suite', ton: 'alerte' }
        : {
            texte: `C’était un PNJ, ${String(fait.charge.viesRestantes)} ${fait.charge.viesRestantes > 1 ? 'vies' : 'vie'} restante${fait.charge.viesRestantes > 1 ? 's' : ''}`,
            ton: 'alerte',
          };

    case 'botNoirDetruit':
      return {
        texte: `Black Ninja détruit : +${String(fait.charge.points)} points`,
        ton: 'succes',
      };

    case 'bonusActive':
      return {
        texte: `Bonus : ${APPARENCE_OBJET[fait.charge.nature].libelle}`,
        ton: 'succes',
        grandTitre: grandTitre(
          fait.charge.nature,
          'Bonus',
          `${EFFETS_DES_BONUS[fait.charge.nature]} ${pendant(fait.charge.dureeMs)}`,
          false,
        ),
      };

    case 'malusRamasse': {
      const texte = TEXTES_MALUS[fait.charge.nature].declenche;

      // Un malus ramasse frappe les autres (comportement a preserver 4): c'est une bonne
      // nouvelle pour nous, et le titre ne se brouille pas.
      return {
        texte,
        ton: 'succes',
        grandTitre: grandTitre(fait.charge.nature, 'Malus envoyé', texte, false),
      };
    }

    case 'malusSubi': {
      const texte = TEXTES_MALUS[fait.charge.nature].subi.replace(
        '{joueur}',
        fait.charge.parPseudo,
      );

      return {
        texte,
        ton: 'alerte',
        grandTitre: grandTitre(fait.charge.nature, 'Malus', texte, true),
      };
    }

    case 'evade':
      return annonceDeLEvade(fait.charge, mode, moi);

    case 'joueurArrive':
      return { texte: `${fait.charge.pseudo} a rejoint la partie`, ton: 'info' };

    case 'joueurParti':
      return {
        texte: `${fait.charge.pseudo} a quitté la partie${fait.charge.hote ? ' (était hôte)' : ''}`,
        ton: 'info',
      };
  }
}

/**
 * Ce qui arrive a l'Evade et a son x2 (etape 7.9), en grand titre raye, a tous les joueurs:
 * le porteur devient la cible, et chacun doit savoir qui il est. Chacun lit la phrase qui le
 * concerne: celui qui attrape, qui vole ou qui perd le x2 lit « vous ».
 *
 * EN EQUIPES, le x2 double le score de toute l'equipe du porteur (decision 6 du porteur du
 * projet); EN MASSACRE, on n'attrape pas, on elimine.
 */
function annonceDeLEvade(evade: EvadeVu, mode?: Mode, moi?: string): Annonce {
  const votreScore = mode === 'equipes' ? 'le score de votre équipe' : 'votre score';
  const attrape = mode === 'massacre' ? 'éliminé' : 'attrapé';

  switch (evade.quoi) {
    case 'apparu':
      return titreDeLEvade('info', 'Attrapez-le', 'L’Évadé rôde !', `Son x2 double ${votreScore}`);

    case 'attrape':
      return evade.par === moi
        ? titreDeLEvade(
            'succes',
            `L’Évadé ${attrape}`,
            'x2',
            `Tout ${votreScore} compte double. Tout le monde vous voit`,
          )
        : titreDeLEvade(
            'info',
            `L’Évadé ${attrape}`,
            'x2 pris',
            `${evade.parPseudo} porte le x2 : prenez-le lui`,
          );

    case 'vole':
      if (evade.par === moi) {
        return titreDeLEvade('succes', 'x2 volé', 'x2', `Vous prenez le x2 de ${evade.dePseudo}`);
      }
      return evade.de === moi
        ? titreDeLEvade(
            'alerte',
            'x2 perdu',
            'Volé !',
            `${evade.parPseudo} vous a pris le x2`,
            true,
          )
        : titreDeLEvade(
            'info',
            'x2 volé',
            'x2 pris',
            `${evade.parPseudo} prend le x2 de ${evade.dePseudo}`,
          );

    case 'perdu':
      return evade.de === moi
        ? titreDeLEvade('alerte', 'x2 perdu', 'Détruit', 'Un Black Ninja a détruit votre x2', true)
        : titreDeLEvade(
            'info',
            'x2 perdu',
            'Détruit',
            `Un Black Ninja a détruit le x2 de ${evade.dePseudo}`,
          );

    case 'enfui':
      return titreDeLEvade('info', 'L’Évadé', 'Envolé', 'Personne ne l’a attrapé à temps');
  }
}

/** Le grand titre raye d'une annonce de l'Evade, et sa phrase entiere pour le fil. */
function titreDeLEvade(
  ton: TonAnnonce,
  surtitre: string,
  titre: string,
  ligne: string,
  brouille = false,
): Annonce {
  // « L'Évadé rôde ! » porte deja sa ponctuation.
  const point = /[!?.]$/u.test(titre) ? '' : '.';

  return {
    texte: `${surtitre} : ${titre}${point} ${ligne}`,
    ton,
    grandTitre: {
      surtitre,
      titre,
      ligne,
      couleur: APPARENCE_EVADE.rouge,
      icone: undefined,
      brouille,
      raye: true,
    },
  };
}

/**
 * Un coup de katana ne s'annonce que chez celui qui l'a donne, et seulement quand ses morts
 * font passer le multiplicateur a un nouveau palier: « Combo x3 ».
 */
function annonceDuCoup(
  coup: Extract<FaitDeJeu, { nature: 'coupDeKatana' }>['charge'],
  moi: string | undefined,
): Annonce | undefined {
  const avant = multiplicateurDuCombo(coup.combo - coup.morts.length);

  return coup.frappeur === moi && coup.morts.length > 0 && coup.multiplicateur > avant
    ? { texte: `Combo x${String(coup.multiplicateur)} !`, ton: 'succes' }
    : undefined;
}

/**
 * Nos ralliements de la Horde (etape 7.5) ne s'annoncent que lorsqu'ils font passer notre
 * multiplicateur a un nouveau palier, comme les coups du Massacre. Ils ne sont envoyes qu'a
 * nous.
 */
function annonceDuRalliement(
  ralliement: Extract<FaitDeJeu, { nature: 'ralliement' }>['charge'],
): Annonce | undefined {
  const avant = multiplicateurDuCombo(ralliement.combo - ralliement.ninjas.length);

  return ralliement.multiplicateur > avant
    ? { texte: `Combo x${String(ralliement.multiplicateur)} !`, ton: 'succes' }
    : undefined;
}

/** Un joueur tue ne s'annonce qu'a son tueur et a sa victime. */
function annonceDeLaMiseAMort(
  mise: Extract<FaitDeJeu, { nature: 'joueurTranche' }>['charge'],
  moi: string | undefined,
): Annonce | undefined {
  if (mise.victime === moi) {
    return {
      texte: `Tranché par ${mise.attaquantPseudo} : -${String(mise.pointsVoles)} points`,
      ton: 'alerte',
    };
  }

  return mise.attaquant === moi
    ? {
        texte: `Vous avez tranché ${mise.victimePseudo} : +${String(mise.pointsVoles)} points`,
        ton: 'succes',
      }
    : undefined;
}

/**
 * Les refus qui s'affichent a cote de leur champ, et pas en annonce.
 *
 * L'entree en partie montre son refus sous le pseudo, le chat sous le message, et
 * la creation d'une partie sous son formulaire (ecran du jalon 3).
 */
const REFUS_AFFICHES_SUR_PLACE: ReadonlySet<Refus['action']> = new Set([
  'rejoindre',
  'creerPartie',
  'chat',
]);

/** La phrase qui annonce un refus, ou rien s'il s'affiche a cote de son champ. */
export function annonceDuRefus(refus: Refus): Annonce | undefined {
  if (REFUS_AFFICHES_SUR_PLACE.has(refus.action)) {
    return undefined;
  }

  return { texte: refus.erreurs.map((erreur) => erreur.motif).join(' '), ton: 'alerte' };
}

/**
 * Tout ce qu'il faut annoncer en passant d'un etat au suivant.
 *
 * COMPARER DEUX ETATS, COMME POUR LE SON. Les faits nouveaux sont ceux du
 * journal courant qui n'etaient pas dans le precedent (faitsArrives); au
 * lancement d'une partie, le journal repart vide, et ce cas ne produit donc
 * aucune annonce. Un refus est nouveau quand ce n'est plus le meme
 * objet. Rien n'est retenu entre deux appels.
 */
export function annoncesDuChangement(avant: EtatClient, apres: EtatClient): readonly Annonce[] {
  const annonces: Annonce[] = [];

  for (const fait of faitsArrives(avant.journal, apres.journal)) {
    const annonce = annonceDuFait(fait, apres.salon?.mode, apres.moi);

    if (annonce !== undefined) {
      annonces.push(annonce);
    }
  }

  if (apres.refus !== undefined && apres.refus !== avant.refus) {
    const annonce = annonceDuRefus(apres.refus);

    if (annonce !== undefined) {
      annonces.push(annonce);
    }
  }

  // Le transfert de propriete du salon (comportement a preserver numero 8) se
  // voyait dans le jeu d'origine par une notification. On ne l'annonce pas a
  // l'entree dans un salon que l'on vient d'ouvrir: on y etait deja hote.
  if (avant.salon !== undefined && !jeSuisHote(avant) && jeSuisHote(apres)) {
    annonces.push({ texte: "Vous êtes maintenant l'hôte de la partie", ton: 'info' });
  }

  return annonces;
}
