/**
 * Le compte a rebours de demarrage d'une partie.
 *
 * C'est le comportement a preserver numero 7 de CLAUDE.md: cinq secondes,
 * annulables jusqu'a deux. C'etait, jusqu'a cette etape, le seul comportement de
 * la liste dont la logique n'existait nulle part dans le nouveau code, parce
 * qu'il ne se decide ni ne s'annule dans le moteur: il vit entre le moment ou
 * l'hote appuie et le moment ou la partie commence, donc dans la couche reseau.
 *
 * LA SEQUENCE EXACTE DU LEGACY (server.js:2451), reproduite a l'identique. Une
 * premiere annonce part immediatement a cinq, puis une par seconde. Le drapeau
 * d'annulation tombe des que l'annonce porte deux ou moins. Les six annonces
 * sont donc: 5 annulable, 4 annulable, 3 annulable, 2 non, 1 non, 0 non, et
 * c'est apres la sixieme que la partie part.
 *
 * POURQUOI UNE CLASSE, ET PAS UN setTimeout POSE QUELQUE PART. Le legacy tenait
 * sa minuterie dans une variable de module, startCountdown, partagee par toutes
 * les connexions: deux salons n'auraient pas pu compter en meme temps, et une
 * minuterie oubliee continuait de tourner. Ici chaque compte a rebours appartient
 * a un objet, s'arrete quand on le lui demande, et ne peut pas survivre a la
 * partie qui l'a demarre: c'est le defaut X1 de l'audit tenu a distance une fois
 * de plus.
 *
 * L'HORLOGE EST INJECTEE, comme partout ailleurs dans ce paquet. Les tests font
 * donc passer cinq secondes instantanement, et verifient la sequence entiere sans
 * attendre.
 */

import { DUREES } from '@neon-ninja/shared';

import type { Horloge } from './horloge.js';

/**
 * Nombre de secondes restantes en dessous duquel on ne peut plus annuler.
 *
 * Valeur du legacy: le drapeau canCancel tombe des que le decompte atteint deux.
 * Passe ce seuil, les clients ont deja commence a basculer vers l'ecran de jeu et
 * revenir en arriere donnerait un salon a moitie parti.
 */
export const SEUIL_ANNULATION_S = 2;

/** Ce qu'il faut pour faire decompter une partie. */
export interface OptionsCompteARebours {
  /** Horloge du serveur. Celle de la room, pour que tests et production s'accordent. */
  readonly horloge: Horloge;
  /** Duree du decompte, en secondes. Celle du jeu par defaut. */
  readonly dureeS?: number;
  /** Appele a chaque annonce, y compris la premiere et celle a zero. */
  readonly surAnnonce: (secondesRestantes: number, annulable: boolean) => void;
  /** Appele une seule fois, quand le decompte arrive au bout sans avoir ete annule. */
  readonly surDepart: () => void;
}

/** Un decompte de demarrage, avec sa minuterie et sa regle d'annulation. */
export class CompteARebours {
  private readonly horloge: Horloge;
  private readonly dureeS: number;
  private readonly surAnnonce: (secondesRestantes: number, annulable: boolean) => void;
  private readonly surDepart: () => void;

  private restant = 0;
  private arreterLaMinuterie: (() => void) | undefined;

  constructor(options: OptionsCompteARebours) {
    this.horloge = options.horloge;
    this.dureeS = options.dureeS ?? DUREES.COMPTE_A_REBOURS_S;
    this.surAnnonce = options.surAnnonce;
    this.surDepart = options.surDepart;
  }

  /** Le decompte tourne-t-il. */
  get enCours(): boolean {
    return this.arreterLaMinuterie !== undefined;
  }

  /** Secondes restantes. Zero quand le decompte ne tourne pas. */
  get secondesRestantes(): number {
    return this.enCours ? this.restant : 0;
  }

  /** L'hote peut-il encore annuler. Faux quand le decompte ne tourne pas. */
  get annulable(): boolean {
    return this.enCours && this.restant > SEUIL_ANNULATION_S;
  }

  /**
   * Demarre le decompte, et annonce immediatement sa premiere seconde.
   *
   * Redemarrer un decompte deja en cours ne fait rien: c'est le cas d'un hote qui
   * appuie deux fois, et il ne doit pas faire partir la partie deux fois plus
   * vite.
   */
  demarrer(): void {
    if (this.enCours) {
      return;
    }

    this.restant = this.dureeS;
    this.arreterLaMinuterie = this.horloge.repeter(() => {
      this.battre();
    }, 1000);

    this.surAnnonce(this.restant, this.annulable);
  }

  /**
   * Annule le decompte, si la regle l'autorise encore.
   *
   * @returns Vrai si le decompte a bien ete annule.
   */
  annuler(): boolean {
    if (!this.annulable) {
      return false;
    }

    this.arreter();

    return true;
  }

  /**
   * Arrete le decompte sans condition, et sans rien annoncer.
   *
   * Sert a la destruction d'une partie, ou au depart de son dernier joueur.
   * L'appeler sur un decompte deja arrete ne fait rien.
   */
  arreter(): void {
    this.arreterLaMinuterie?.();
    this.arreterLaMinuterie = undefined;
    this.restant = 0;
  }

  /** Une seconde vient de passer. */
  private battre(): void {
    this.restant -= 1;
    this.surAnnonce(this.restant, this.annulable);

    if (this.restant <= 0) {
      this.arreter();
      this.surDepart();
    }
  }
}
