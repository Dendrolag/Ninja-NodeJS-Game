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

import type { Mode, Refus, TypeMalus } from '@neon-ninja/shared';
import { multiplicateurDuCombo } from '@neon-ninja/shared';

import type { EtatClient } from './etat.js';
import type { FaitDeJeu } from './faits.js';
import { faitsArrives } from './faits.js';
import { APPARENCE_OBJET } from './rendu/apparence.js';
import { jeSuisHote } from './selecteurs.js';

/** Le ton d'une annonce, qui decide de sa couleur. */
export type TonAnnonce =
  /** Une bonne nouvelle pour nous. */
  | 'succes'
  /** Une mauvaise nouvelle pour nous. */
  | 'alerte'
  /** Une information neutre. */
  | 'info';

/** Une phrase a montrer au joueur. */
export interface Annonce {
  readonly texte: string;
  readonly ton: TonAnnonce;
}

/**
 * Les textes des malus, repris du jeu d'origine (MALUS_MESSAGES, client.js:148).
 *
 * Deux textes par malus: celui de qui le declenche, et celui de qui le subit, ou
 * le nom du coupable remplace {joueur}.
 */
const TEXTES_MALUS: Readonly<
  Record<TypeMalus, { readonly declenche: string; readonly subi: string }>
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
        ? { texte: 'C’était un faux ninja : éliminé, vous regardez la suite', ton: 'alerte' }
        : {
            texte: `C’était un faux ninja : ${String(fait.charge.viesRestantes)} ${fait.charge.viesRestantes > 1 ? 'vies' : 'vie'} restante${fait.charge.viesRestantes > 1 ? 's' : ''}`,
            ton: 'alerte',
          };

    case 'botNoirDetruit':
      return {
        texte: `Black Ninja détruit : +${String(fait.charge.points)} points`,
        ton: 'succes',
      };

    case 'bonusActive':
      return { texte: `Bonus : ${APPARENCE_OBJET[fait.charge.nature].libelle}`, ton: 'succes' };

    case 'malusRamasse':
      return { texte: TEXTES_MALUS[fait.charge.nature].declenche, ton: 'succes' };

    case 'malusSubi':
      return {
        texte: TEXTES_MALUS[fait.charge.nature].subi.replace('{joueur}', fait.charge.parPseudo),
        ton: 'alerte',
      };

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
