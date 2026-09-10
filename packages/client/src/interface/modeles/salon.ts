/**
 * Le salon, sous forme de donnees: qui est la, qui commande, ce qui est regle.
 *
 * FONCTION PURE. Le jeu d'origine reconstruisait sa liste de joueurs a chaque
 * message en concatenant du HTML, pseudos compris (updateWaitingRoomPlayers):
 * c'etait l'un des trois points d'entree de la faille S1. Ici le modele ne
 * contient que des chaines, et l'ecran les pose avec textContent.
 *
 * CE QUI N'EXISTE PAS ENCORE, et n'est donc pas ici: l'etat « pret », les places
 * libres et la capacite, le code d'invitation. Ils dependent du matchmaking de
 * l'etape 2.4. Voir la reconciliation de la fiche 4.3.
 */

import type { ReglagesPartie } from '@neon-ninja/shared';
import { TYPES_BONUS, TYPES_MALUS, TYPES_ZONE } from '@neon-ninja/shared';

import type { EtatClient } from '../../etat.js';
import { formaterDuree } from '../../hud/modele.js';
import { jeSuisHote } from '../../selecteurs.js';
import { NOM_DU_MODE, nomDeCarte } from './cartes.js';

/** Un joueur du salon, tel qu'on l'affiche. */
export interface JoueurAffiche {
  readonly id: string;
  readonly pseudo: string;
  /** Une ou deux lettres, pour l'avatar. */
  readonly initiales: string;
  readonly hote: boolean;
  /** Ce joueur, c'est nous. */
  readonly moi: boolean;
}

/** Une ligne du recapitulatif des reglages. */
export interface LigneRecapitulatif {
  readonly libelle: string;
  readonly valeur: string;
}

/** Un message du chat, tel qu'on l'affiche. */
export interface MessageDuChat {
  /** Cle stable, pour retrouver l'element deja affiche. */
  readonly cle: string;
  readonly pseudo: string;
  readonly texte: string;
  /** Ce message est le notre: il s'aligne de l'autre cote. */
  readonly moi: boolean;
}

/** Le compte a rebours de demarrage, tel qu'on l'affiche. */
export interface CompteAffiche {
  readonly secondes: number;
  /** Le bouton d'annulation est-il propose: a l'hote seul, et tant qu'il est temps. */
  readonly peutAnnuler: boolean;
}

/** Tout ce que le salon affiche. */
export interface ModeleSalon {
  readonly titre: string;
  readonly sousTitre: string;
  readonly joueurs: readonly JoueurAffiche[];
  /** Le nombre de joueurs, en toutes lettres: « 3 joueurs ». */
  readonly effectif: string;
  readonly jeSuisHote: boolean;
  /** Le bouton de lancement est-il propose. Reserve a l'hote. */
  readonly peutLancer: boolean;
  /** La phrase qui dit ce qu'on attend. */
  readonly consigne: string;
  readonly recapitulatif: readonly LigneRecapitulatif[];
  readonly compteARebours: CompteAffiche | undefined;
  readonly messages: readonly MessageDuChat[];
}

/**
 * Les initiales d'un pseudo, pour son avatar.
 *
 * Deux mots donnent leurs deux premieres lettres, et une majuscule au milieu d'un
 * mot compte comme un nouveau mot: « ShadowFox » donne SF, comme dans la
 * maquette. Un mot seul donne ses deux premieres lettres. Les lettres sont
 * comptees comme des caracteres, pas comme des unites de codage: un pseudo ecrit
 * dans un autre alphabet ne se coupe pas au milieu d'une lettre.
 */
export function initiales(pseudo: string): string {
  const mots = pseudo.split(/[\s_.-]+|(?<=\p{Ll})(?=\p{Lu})/u).filter((mot) => mot.length > 0);
  const [premier = '', second] = mots;

  const lettres =
    second === undefined ? [...premier].slice(0, 2) : [[...premier][0], [...second][0]];

  return lettres.join('').toLocaleUpperCase('fr');
}

/** Calcule le salon, ou rien si l'on n'est dans aucune partie. */
export function modeleSalon(etat: EtatClient): ModeleSalon | undefined {
  const salon = etat.salon;

  if (salon === undefined) {
    return undefined;
  }

  const hote = salon.joueurs.find((joueur) => joueur.hote);
  const commande = jeSuisHote(etat);
  const compte = etat.compteARebours;
  const nombre = salon.joueurs.length;

  return {
    titre: hote === undefined ? 'Salon' : `Salon de ${hote.pseudo}`,
    sousTitre: `${NOM_DU_MODE} · ${nomDeCarte(salon.reglages.carte, salon.reglages.modeMiroir)}`,
    joueurs: salon.joueurs.map((joueur) => ({
      id: joueur.id,
      pseudo: joueur.pseudo,
      initiales: initiales(joueur.pseudo),
      hote: joueur.hote,
      moi: joueur.id === etat.moi,
    })),
    effectif: `${String(nombre)} ${nombre > 1 ? 'joueurs' : 'joueur'}`,
    jeSuisHote: commande,
    peutLancer: commande && salon.statut === 'salon' && compte === undefined,
    consigne: consigne(commande, compte !== undefined, hote?.pseudo),
    recapitulatif: recapitulatif(salon.reglages),
    compteARebours:
      compte === undefined
        ? undefined
        : { secondes: compte.secondesRestantes, peutAnnuler: commande && compte.annulable },
    messages: etat.messages.map((message, index) => ({
      cle: `${String(message.recuA)}:${String(index)}`,
      pseudo: message.pseudo,
      texte: message.texte,
      moi: message.auteur === etat.moi,
    })),
  };
}

/** La phrase qui dit ce qu'on attend, selon qui l'on est. */
function consigne(hote: boolean, decompte: boolean, pseudoHote: string | undefined): string {
  if (decompte) {
    return 'La partie va commencer.';
  }

  if (hote) {
    return 'Vous êtes l’hôte : lancez la partie quand tout le monde est là.';
  }

  return pseudoHote === undefined
    ? 'En attente de l’hôte.'
    : `En attente de ${pseudoHote}, qui lancera la partie.`;
}

/**
 * Le recapitulatif des reglages, lisible par tous.
 *
 * Tout le monde le voit, hote ou non: dans le jeu d'origine, seuls le nom de la
 * carte et le mode etaient visibles des invites, qui decouvraient le reste en
 * jouant.
 */
function recapitulatif(reglages: ReglagesPartie): readonly LigneRecapitulatif[] {
  const bonusActifs = TYPES_BONUS.filter((nature) => reglages.bonus.types[nature].actif).length;
  const malusActifs = TYPES_MALUS.filter((nature) => reglages.malus.types[nature].actif).length;
  const zonesActives = TYPES_ZONE.filter((nature) => reglages.zones.types[nature]).length;
  const noirs = reglages.botsNoirs;

  return [
    { libelle: 'Carte', valeur: nomDeCarte(reglages.carte, reglages.modeMiroir) },
    { libelle: 'Durée', valeur: formaterDuree(reglages.dureePartieS * 1000) },
    { libelle: 'Faux ninjas', valeur: String(reglages.nombreBotsInitial) },
    {
      libelle: 'Black Ninjas',
      valeur: noirs.actifs
        ? `${String(noirs.nombre)}, à ${String(noirs.momentApparitionPourCent)} % de la partie`
        : 'Désactivés',
    },
    {
      libelle: 'Bonus',
      valeur:
        bonusActifs === 0 ? 'Désactivés' : `${String(bonusActifs)}/${String(TYPES_BONUS.length)}`,
    },
    {
      libelle: 'Malus',
      valeur:
        !reglages.malus.actifs || malusActifs === 0
          ? 'Désactivés'
          : `${String(malusActifs)}/${String(TYPES_MALUS.length)}`,
    },
    {
      libelle: 'Zones spéciales',
      valeur:
        !reglages.zones.actives || zonesActives === 0
          ? 'Désactivées'
          : `${String(zonesActives)}/${String(TYPES_ZONE.length)}`,
    },
  ];
}
