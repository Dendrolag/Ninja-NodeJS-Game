/**
 * De quoi fabriquer, dans les tests de la page, un client en pleine partie Massacre (etape
 * 7.4): un salon, une vue de la partie, et les faits d'un coup de katana ou d'un joueur tue.
 *
 * Ce fichier ne sert qu'aux tests. Il n'est importe par aucun module de la page.
 */

import type {
  CoupDeKatanaVu,
  EntiteVue,
  InfosSalon,
  JoueurTrancheVu,
  LigneClassement,
  Mode,
} from '@neon-ninja/shared';
import { REGLAGES_PAR_DEFAUT } from '@neon-ninja/shared';

import type { EtatClient } from './etat.js';
import { ETAT_INITIAL } from './etat.js';
import type { FaitDeJeu } from './faits.js';
import { fait } from './faits.js';
import type { VuePartie } from './reconstruction.js';

/** Une ligne de classement. */
export function ligneDeMassacre(id: string, points = 0): LigneClassement {
  return {
    id,
    pseudo: id,
    couleur: '#FF0000',
    points,
    botsPortes: 0,
    pointsBotsNoirs: 0,
    captures: 0,
    botsNoirsDetruits: 0,
  };
}

/** Un joueur sur la carte, avec l'arme d'un joueur du Massacre. */
export function guerrierVu(id: string, x = 100, y = 100, pret = true): EntiteVue {
  return {
    type: 'joueur',
    id,
    x,
    y,
    couleur: '#FF0000',
    direction: 'est',
    pseudo: id,
    invincible: false,
    protege: false,
    tactique: {
      orientation: 'est',
      charges: pret ? 1 : 0,
      avantProchaineChargeMs: pret ? 0 : 100,
    },
  };
}

/** Un faux ninja sur la carte. */
export function ninjaVu(id: string, x = 300, y = 300): EntiteVue {
  return { type: 'bot', id, x, y, couleur: '#123456', direction: 'sud' };
}

/** Le salon d'une partie en cours dans ce mode. */
export function salonEnCours(mode: Mode): InfosSalon {
  return {
    idRoom: 'room-1',
    statut: 'enCours',
    mode,
    visibilite: 'publique',
    capacite: 8,
    joueurs: [],
    reglages: REGLAGES_PAR_DEFAUT,
  };
}

/**
 * Un client en jeu dans une partie Massacre, sous le nom d'Alice, avec Bob, et autant de
 * faux ninjas que demande.
 */
export function etatDeMassacre(
  options: {
    readonly ninjas?: number;
    readonly journal?: readonly FaitDeJeu[];
    readonly mode?: Mode;
    readonly pret?: boolean;
  } = {},
): EtatClient {
  const partie: VuePartie = {
    tick: 1,
    tempsRestantMs: 90_000,
    enPause: false,
    entites: [
      guerrierVu('alice', 100, 100, options.pret ?? true),
      guerrierVu('bob', 400, 400),
      ...Array.from({ length: options.ninjas ?? 3 }, (_, rang) => ninjaVu(`b${String(rang)}`)),
    ],
    objets: [],
    zones: [],
    classement: [ligneDeMassacre('alice', 50), ligneDeMassacre('bob', 20)],
  };

  return {
    ...ETAT_INITIAL,
    ecran: 'jeu',
    moi: 'alice',
    partie,
    salon: salonEnCours(options.mode ?? 'massacre'),
    journal: options.journal ?? [],
  };
}

/** Un coup de katana recu a cet instant. */
export function coup(
  instant: number,
  charge: Partial<CoupDeKatanaVu> = {},
): Extract<FaitDeJeu, { nature: 'coupDeKatana' }> {
  return fait(
    'coupDeKatana',
    {
      frappeur: 'alice',
      x: 100,
      y: 100,
      orientation: 'est',
      morts: [{ id: 'b9', x: 130, y: 100, noir: false, points: 10 }],
      combo: 1,
      multiplicateur: 1,
      ...charge,
    },
    instant,
  ) as Extract<FaitDeJeu, { nature: 'coupDeKatana' }>;
}

/** Un joueur tue recu a cet instant. */
export function miseAMort(
  instant: number,
  charge: Partial<JoueurTrancheVu> = {},
): Extract<FaitDeJeu, { nature: 'joueurTranche' }> {
  return fait(
    'joueurTranche',
    {
      attaquant: 'alice',
      attaquantPseudo: 'Alice',
      victime: 'bob',
      victimePseudo: 'Bob',
      x: 400,
      y: 400,
      orientation: 'est',
      pointsVoles: 10,
      ...charge,
    },
    instant,
  ) as Extract<FaitDeJeu, { nature: 'joueurTranche' }>;
}
