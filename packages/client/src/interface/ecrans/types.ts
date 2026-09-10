/**
 * Ce que partagent les ecrans: ce qu'on leur donne, et ce qu'ils rendent.
 *
 * UN ECRAN NE S'ABONNE PAS AU CLIENT. C'est l'application qui s'abonne, une seule
 * fois, et qui donne l'etat a l'ecran affiche. Un ecran monte puis demonte ne
 * peut donc pas laisser derriere lui un abonnement oublie: il n'en a jamais pris.
 * Le jeu d'origine ajoutait ses ecoutes a chaque entree en salle et en partie, et
 * c'etait l'une des causes de ses traitements en double.
 */

import type { Client } from '../../client.js';
import type { EtatClient } from '../../etat.js';
import type { HorlogeClient } from '../../horloge.js';
import type { LecteurDeSons } from '../../sons/lecteur.js';

/** Ce que l'application donne a chaque ecran. */
export interface ContexteEcran {
  readonly document: Document;
  readonly client: Client;
  readonly horloge: HorlogeClient;
  readonly sons: LecteurDeSons | undefined;
  /** Ouvre la fenetre d'aide, commune a toute l'application. */
  readonly ouvrirAide: () => void;
  /** Ouvre le panneau du son, commun a toute l'application. */
  readonly ouvrirSon: () => void;
  /** Recharge la page. Injectable, pour que les tests ne rechargent rien. */
  readonly recharger: () => void;
}

/** Un ecran monte. */
export interface EcranAffiche {
  /** L'element que l'application place dans la page. */
  readonly racine: HTMLElement;
  /** Met l'ecran en accord avec l'etat. Appele a chaque changement. */
  afficher(etat: EtatClient): void;
  /** Retire l'ecran et tout ce qu'il a branche. */
  demonter(): void;
}

/** Ce qui sait monter un ecran. */
export type MonteurEcran = (contexte: ContexteEcran) => EcranAffiche;
