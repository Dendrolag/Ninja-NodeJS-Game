/**
 * Ce que montre la fenetre d'une reparation d'Among Ninjas (etape 7.27), lu de l'etat de la
 * page: la reparation que le serveur nous dit ouverte, et ce que le flux dit du sabotage en
 * cours, sa reparation tiree et ou elle en est.
 *
 *   - Au boitier, pendant la panne: le geste de la panne que la partie a tire.
 *   - Aux deux cles: la purge de notre console, puis, purgee, la cle a tourner et tenir.
 *   - Au relais: l'interrupteur a couper quand c'est notre tour, l'attente sinon.
 *
 * Aux consoles, une ligne dit l'autre console: on ne peut pas se parler pendant le jeu.
 *
 * Ce module est pur: la fenetre (composants/reparation.ts) l'appelle a chaque image.
 */

import type { GesteDeReparation, PosteDeReparation } from '@neon-ninja/shared';
import { AMONG, REPARATIONS_DE_LA_PANNE } from '@neon-ninja/shared';

import type { EtatClient } from '../../etat.js';

import { TITRES_DES_REPARATIONS } from './gestes/reparations.js';

/** Ce que montre la fenetre: un geste, la cle a tenir, ou l'attente de son tour. */
export type EtapeDeReparation =
  | {
      readonly genre: 'geste';
      readonly geste: GesteDeReparation;
      /**
       * Ce qui distingue ce geste du precedent: au relais, chaque interrupteur est un geste neuf.
       */
      readonly cle: string;
    }
  | { readonly genre: 'cle' }
  | { readonly genre: 'attente' };

/** Ce que la fenetre montre, et ce qu'elle ecrit. */
export interface FenetreDeReparationVue {
  readonly poste: PosteDeReparation;
  readonly etape: EtapeDeReparation;
  readonly titre: string;
  /** Le poste, sous le titre. */
  readonly lieu: string;
  /** Ce que dit l'autre console, ou le relais; rien au boitier. */
  readonly statut?: string;
  /** La cle tenue tournee a notre console, d'apres le serveur. */
  readonly cleTournee: boolean;
  /** La cle tenue tournee a l'autre console. */
  readonly autreCleTournee: boolean;
  /** Le relais: les interrupteurs coupes. */
  readonly interrupteursCoupes: number;
}

/** Le nom d'un poste, sous le titre de la fenetre. */
function lieuDuPoste(poste: PosteDeReparation): string {
  return poste === 'boitier' ? 'Générateur de la rue' : `Console ${String(poste + 1)}`;
}

/** Ce que dit l'autre console des deux cles. */
function etatDeLAutreConsole(
  purgee: boolean,
  tenue: boolean,
): 'en attente' | 'purgée' | 'clé tournée' {
  if (tenue) {
    return 'clé tournée';
  }

  return purgee ? 'purgée' : 'en attente';
}

/**
 * Ce que la fenetre doit montrer, ou rien: pas de reparation ouverte, ou un sabotage qui ne lui
 * va pas, le temps que le serveur la dise fermee.
 */
export function vueDeLaReparation(etat: EtatClient): FenetreDeReparationVue | undefined {
  const ouverte = etat.among.reparationOuverte;
  const sabotage = etat.partie?.among?.sabotage;
  const reparation = sabotage?.reparation;

  if (ouverte === undefined || sabotage === undefined || reparation === undefined) {
    return undefined;
  }

  const { poste } = ouverte;
  const commun = {
    poste,
    lieu: lieuDuPoste(poste),
    cleTournee: false,
    autreCleTournee: false,
    interrupteursCoupes: sabotage.interrupteursCoupes,
  };

  if (poste === 'boitier') {
    if (sabotage.nature !== 'panne') {
      return undefined;
    }

    const geste = (REPARATIONS_DE_LA_PANNE as readonly string[]).includes(reparation)
      ? (reparation as GesteDeReparation)
      : undefined;

    return geste === undefined
      ? undefined
      : {
          ...commun,
          etape: { genre: 'geste', geste, cle: geste },
          titre: TITRES_DES_REPARATIONS[geste],
        };
  }

  if (sabotage.nature !== 'surchauffe') {
    return undefined;
  }

  const autre = poste === 0 ? 1 : 0;

  if (reparation === 'cles') {
    const statut = `Autre console : ${etatDeLAutreConsole(
      sabotage.consolesPurgees[autre],
      sabotage.consolesTenues[autre],
    )}`;

    return sabotage.consolesPurgees[poste]
      ? {
          ...commun,
          etape: { genre: 'cle' },
          titre: 'Tourner la clé',
          statut,
          cleTournee: sabotage.consolesTenues[poste],
          autreCleTournee: sabotage.consolesTenues[autre],
        }
      : {
          ...commun,
          etape: { genre: 'geste', geste: 'purge', cle: 'purge' },
          titre: TITRES_DES_REPARATIONS.purge,
          statut,
        };
  }

  if (reparation !== 'relais') {
    return undefined;
  }

  const aNous = sabotage.prochaineConsole === undefined || sabotage.prochaineConsole === poste;
  const compte = `Interrupteurs coupés : ${String(sabotage.interrupteursCoupes)} sur ${String(
    AMONG.INTERRUPTEURS_DU_RELAIS,
  )}`;

  return aNous
    ? {
        ...commun,
        etape: {
          genre: 'geste',
          geste: 'interrupteur',
          cle: `interrupteur:${String(sabotage.interrupteursCoupes)}`,
        },
        titre: TITRES_DES_REPARATIONS.interrupteur,
        statut: `${compte}. À vous`,
      }
    : {
        ...commun,
        etape: { genre: 'attente' },
        titre: 'Le relais',
        statut: `${compte}. À l’autre console`,
      };
}
