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
import type { NiveauDeSang } from '../preferences.js';
import type { SouvenirDeVersion } from '../souvenirDeVersion.js';

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
  /** Le sang que le joueur veut voir en Massacre, lu au moment ou l'on dessine. */
  readonly niveauDeSang: () => NiveauDeSang;
  /** Recharge la page. Injectable, pour que les tests ne rechargent rien. */
  readonly recharger: () => void;
  /**
   * Ce que le joueur lit en pied d'accueil pour savoir sur quelle version il est
   * (etape 8.4). Une chaine toute faite: l'ecran l'affiche, il ne la compose pas.
   */
  readonly libelleDeVersion: string;
  /**
   * L'infobulle du pied: la date complete et l'empreinte entiere du commit. Absente
   * en developpement, ou la page n'est construite d'aucun commit.
   */
  readonly infobulleDeVersion?: string;
  /**
   * La note de la version servie, et ce que ce navigateur en a deja lu (etape 4.9).
   * Absent, l'accueil ne montre aucune note.
   */
  readonly souvenirDeVersion?: SouvenirDeVersion;
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
