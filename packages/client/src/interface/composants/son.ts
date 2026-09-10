/**
 * Le panneau du son: le volume de la musique, celui des effets, et la coupure.
 *
 * Portage du panneau audioControls du jeu d'origine (index.html:24), qui
 * enregistrait deja ses reglages dans le navigateur. Le volume est un reglage
 * local: il ne passe plus par le serveur (voir sons/lecteur.ts).
 *
 * LE STOCKAGE PEUT MANQUER. Un navigateur en navigation privee, ou regle pour
 * refuser les donnees de site, leve une erreur a la simple lecture de
 * localStorage. Toutes les lectures et ecritures sont donc protegees: sans
 * stockage, le panneau marche, il oublie seulement les reglages a la fermeture de
 * l'onglet.
 */

import type { LecteurDeSons } from '../../sons/lecteur.js';
import { creer, ecrireTexte } from '../dom.js';
import type { PreferencesSon } from '../preferences.js';
import {
  CLE_PREFERENCES_SON,
  PREFERENCES_SON_PAR_DEFAUT,
  ecrirePreferencesSon,
  lirePreferencesSon,
} from '../preferences.js';
import type { Fenetre } from './fenetre.js';
import { monterFenetre } from './fenetre.js';

/** Ce qu'il faut pour monter le panneau du son. */
export interface OptionsPanneauSon {
  readonly document: Document;
  /** Le lecteur a regler. Absent, le panneau ne regle rien, mais s'affiche. */
  readonly sons: LecteurDeSons | undefined;
  /** Le stockage du navigateur, s'il est disponible. */
  readonly stockage: Storage | undefined;
  /** Appele apres chaque changement, une fois le lecteur regle. */
  readonly surChangement?: (preferences: PreferencesSon) => void;
}

/** Le panneau du son, monte. */
export interface PanneauSon extends Fenetre {
  /** Les preferences en vigueur. */
  readonly preferences: PreferencesSon;
}

/** Monte le panneau du son, et applique tout de suite les preferences enregistrees. */
export function monterPanneauSon(options: OptionsPanneauSon): PanneauSon {
  const doc = options.document;
  const fenetre = monterFenetre({ document: doc, titre: 'Son', classe: 'fenetre-son' });

  let preferences = lire(options.stockage);
  appliquer(options.sons, preferences);

  const musique = curseur(doc, 'Musique', preferences.volumeMusique);
  const effets = curseur(doc, 'Effets', preferences.volumeSons);
  const coupure = creer(doc, 'input', { attributs: { type: 'checkbox' } });
  coupure.checked = preferences.coupe;

  fenetre.corps.append(
    musique.racine,
    effets.racine,
    creer(
      doc,
      'label',
      { classe: 'interrupteur' },
      coupure,
      creer(doc, 'span', { classe: 'interrupteur-piste' }),
      creer(doc, 'span', { texte: 'Couper tout le son' }),
    ),
  );

  const surSaisie = (): void => {
    preferences = {
      volumeMusique: Number(musique.saisie.value) / 100,
      volumeSons: Number(effets.saisie.value) / 100,
      coupe: coupure.checked,
    };

    musique.majValeur();
    effets.majValeur();
    appliquer(options.sons, preferences);
    enregistrer(options.stockage, preferences);
    options.surChangement?.(preferences);
  };

  fenetre.corps.addEventListener('input', surSaisie);
  fenetre.corps.addEventListener('change', surSaisie);

  return {
    ...fenetre,

    get ouverte() {
      return fenetre.ouverte;
    },

    get preferences() {
      return preferences;
    },

    demonter() {
      fenetre.corps.removeEventListener('input', surSaisie);
      fenetre.corps.removeEventListener('change', surSaisie);
      fenetre.demonter();
    },
  };
}

/** Un curseur de volume, de zero a cent, avec sa valeur ecrite a cote. */
function curseur(
  doc: Document,
  libelle: string,
  volume: number,
): { racine: HTMLElement; saisie: HTMLInputElement; majValeur: () => void } {
  const saisie = creer(doc, 'input', {
    attributs: { type: 'range', min: '0', max: '100', step: '1', 'aria-label': libelle },
  });
  saisie.value = String(Math.round(volume * 100));
  const valeur = creer(doc, 'output', { classe: 'champ-valeur' });

  const majValeur = (): void => {
    ecrireTexte(valeur, `${saisie.value} %`);
  };

  majValeur();

  return {
    racine: creer(
      doc,
      'label',
      { classe: 'champ-entier' },
      creer(doc, 'span', { classe: 'champ-libelle', texte: libelle }),
      creer(doc, 'span', { classe: 'champ-saisie' }, saisie, valeur),
    ),
    saisie,
    majValeur,
  };
}

/** Regle le lecteur selon les preferences. */
function appliquer(sons: LecteurDeSons | undefined, preferences: PreferencesSon): void {
  if (sons === undefined) {
    return;
  }

  sons.reglerLeVolumeDeLaMusique(preferences.volumeMusique);
  sons.reglerLeVolumeDesSons(preferences.volumeSons);
  sons.couperLeSon(preferences.coupe);
}

/** Lit les preferences enregistrees, sans jamais lever d'erreur. */
function lire(stockage: Storage | undefined): PreferencesSon {
  try {
    return lirePreferencesSon(stockage?.getItem(CLE_PREFERENCES_SON));
  } catch {
    return PREFERENCES_SON_PAR_DEFAUT;
  }
}

/** Enregistre les preferences, sans jamais lever d'erreur. */
function enregistrer(stockage: Storage | undefined, preferences: PreferencesSon): void {
  try {
    stockage?.setItem(CLE_PREFERENCES_SON, ecrirePreferencesSon(preferences));
  } catch {
    // Stockage plein ou refuse: les reglages vivront le temps de l'onglet.
  }
}
