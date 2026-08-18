/**
 * Le fil des faits: ce qui vient d'arriver, et que le joueur doit voir passer.
 *
 * Le serveur envoie deux natures de messages descendants, et cette distinction
 * gouverne tout le client. Le FLUX D'ETAT dit ce qui EST: il est reconstruit dans
 * une VuePartie et remplace la precedente a chaque battement. Les NOTIFICATIONS
 * DISCRETES disent ce qui VIENT D'ARRIVER: elles ne remplacent rien, elles
 * s'ajoutent. Un fil de faits est donc une liste qui s'allonge, la ou l'etat de
 * partie est une valeur qui se remplace.
 *
 * POURQUOI DATER CHAQUE FAIT. Un fait sert a afficher quelque chose pendant
 * quelques secondes: un bandeau de capture, une ligne dans le fil. L'affichage a
 * donc besoin de savoir depuis combien de temps il est la. La date est locale et
 * posee a l'ARRIVEE: le serveur, lui, n'envoie aucune heure, et il a raison, la
 * sienne n'a pas de sens sur une autre machine.
 *
 * POURQUOI LES ARRIVEES ET LES DEPARTS SONT DES FAITS. Ils ne changent rien a
 * l'etat du salon, qui est reemis en entier a chaque changement. Ils servent a
 * annoncer: « Alice a rejoint la partie ». C'est exactement ce qu'est un fait.
 */

import type {
  BonusActive,
  BotNoirDetruit,
  CaptureParBotNoirSubie,
  CaptureReussie,
  CaptureSubie,
  JoueurDuSalon,
  MalusRamasseParMoi,
  MalusSubi,
} from '@neon-ninja/shared';

/**
 * Les faits que le client sait recevoir, et la charge utile de chacun.
 *
 * La table est ecrite une fois et le type FaitDeJeu s'en deduit. Ajouter un fait
 * revient donc a ajouter une ligne ici: le magasin, le cablage et les tests
 * cessent de compiler tant qu'ils ne l'ont pas traite, ce qui est le but.
 *
 * Chaque nom est celui de l'evenement reseau correspondant, sans exception: un
 * lecteur qui tient le contrat de @neon-ninja/shared d'un cote et ce fichier de
 * l'autre n'a aucune traduction a faire de tete.
 */
export interface ChargesDeFait {
  /** Ce joueur vient de se faire capturer par un autre. */
  captureSubie: CaptureSubie;
  /** Ce joueur vient d'en capturer un autre. */
  captureReussie: CaptureReussie;
  /** Un bot noir vient de capturer ce joueur. */
  captureParBotNoir: CaptureParBotNoirSubie;
  /** Ce joueur, invincible, vient de detruire un bot noir. */
  botNoirDetruit: BotNoirDetruit;
  /** Ce joueur vient de ramasser un bonus. */
  bonusActive: BonusActive;
  /** Ce joueur vient de ramasser un malus, dont il est le seul epargne. */
  malusRamasse: MalusRamasseParMoi;
  /** Ce joueur subit le malus qu'un autre a ramasse. */
  malusSubi: MalusSubi;
  /** Quelqu'un vient d'entrer dans la partie. */
  joueurArrive: JoueurDuSalon;
  /** Quelqu'un vient de quitter la partie. */
  joueurParti: JoueurDuSalon;
}

/** Le nom d'un fait, c'est-a-dire celui de l'evenement reseau qui l'apporte. */
export type NatureDeFait = keyof ChargesDeFait;

/**
 * Un fait recu, date a son arrivee.
 *
 * C'est une union discriminee par le champ nature: un code qui teste la nature
 * connait aussitot le type exact de la charge, sans conversion ni verification a
 * l'execution.
 */
export type FaitDeJeu = {
  [Nature in NatureDeFait]: {
    readonly nature: Nature;
    /** Instant local d'arrivee, lu sur l'horloge du client. */
    readonly instant: number;
    readonly charge: ChargesDeFait[Nature];
  };
}[NatureDeFait];

/**
 * Fabrique un fait date. Le cablage reseau est le seul a s'en servir.
 *
 * La conversion finale est la seule du paquet, et elle est sans risque: le
 * couple nature-charge vient d'etre construit a partir de la meme variable de
 * type, donc il est juste par construction. TypeScript ne sait pas rapprocher un
 * membre generique d'une union de ce genre, et c'est la sa limite, pas la notre.
 */
export function fait<Nature extends NatureDeFait>(
  nature: Nature,
  charge: ChargesDeFait[Nature],
  instant: number,
): FaitDeJeu {
  return { nature, charge, instant } as FaitDeJeu;
}
