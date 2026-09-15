/**
 * Les pieces d'essai des tests de l'interface. Pour les tests, et pour eux seuls.
 *
 * Elles remplacent ce qui ne peut pas tourner sans navigateur complet (le
 * haut-parleur, l'ecran de jeu PixiJS), et fournissent les gestes d'un joueur
 * (saisir, cliquer, soumettre) tels que le document les recoit. Rien ici ne
 * simule le serveur: les tests delivrent eux-memes ses messages par le banc
 * d'essai de reseau.ts.
 *
 * CE FICHIER N'EST PAS UN TEST, et il ne tourne que sous l'environnement de
 * document des tests (jsdom). Il n'est ni exporte par le paquet, ni importe par
 * le code de production.
 */

import type { NomDeSon, PisteMusicale } from '@neon-ninja/shared';

import type { Client } from '../client.js';
import { creerHorlogeClientManuelle } from '../horloge.js';
import type { LecteurDeSons } from '../sons/lecteur.js';
import type { ContexteEcran, EcranAffiche, MonteurEcran } from './ecrans/types.js';

/** Un lecteur de sons muet, qui retient ce qu'on lui a demande. */
export interface SonsDEssai extends LecteurDeSons {
  readonly joues: NomDeSon[];
  readonly musiques: PisteMusicale[];
}

/** Fabrique un lecteur de sons muet. */
export function sonsDEssai(): SonsDEssai {
  const joues: NomDeSon[] = [];
  const musiques: PisteMusicale[] = [];

  return {
    joues,
    musiques,
    jouer: (nom) => {
      joues.push(nom);
    },
    jouerUnPas: () => undefined,
    demarrerLaBoucle: () => undefined,
    arreterLaBoucle: () => undefined,
    demarrerLaMusique: (piste) => {
      musiques.push(piste);
    },
    arreterLaMusique: () => undefined,
    toutArreter: () => undefined,
    reglerLeVolumeDesSons: () => undefined,
    reglerLeVolumeDeLaMusique: () => undefined,
    couperLeSon: () => undefined,
  };
}

/** Un ecran de jeu qui n'affiche rien, et compte ses montages. */
export interface JeuDEssai {
  readonly monteur: MonteurEcran;
  readonly montages: number;
  readonly demontages: number;
}

/** Fabrique un ecran de jeu d'essai, a la place de celui qui monte PixiJS. */
export function jeuDEssai(): JeuDEssai {
  let montages = 0;
  let demontages = 0;

  return {
    monteur: (contexte: ContexteEcran): EcranAffiche => {
      montages += 1;
      const racine = contexte.document.createElement('section');
      racine.className = 'ecran ecran-jeu';

      return {
        racine,
        afficher: () => undefined,
        demonter: () => {
          demontages += 1;
          racine.remove();
        },
      };
    },
    get montages() {
      return montages;
    },
    get demontages() {
      return demontages;
    },
  };
}

/** Un contexte d'ecran pret a l'emploi, pour monter un ecran seul. */
export function contexteDEssai(client: Client): ContexteEcran & { recharges: number } {
  const contexte = {
    document,
    client,
    horloge: creerHorlogeClientManuelle(),
    sons: undefined,
    recharges: 0,
    ouvrirAide: () => undefined,
    ouvrirSon: () => undefined,
    recharger: () => {
      contexte.recharges += 1;
    },
  };

  return contexte;
}

/** Saisit un texte dans un champ, comme au clavier: la valeur change, puis l'evenement part. */
export function saisir(champ: HTMLInputElement, valeur: string): void {
  champ.value = valeur;
  champ.dispatchEvent(new Event('input', { bubbles: true }));
}

/** Coche ou decoche une case ou un bouton radio, comme d'un clic. */
export function cocher(champ: HTMLInputElement, coche: boolean): void {
  champ.checked = coche;
  champ.dispatchEvent(new Event('change', { bubbles: true }));
}

/** Soumet un formulaire, comme la touche Entree dans un de ses champs. */
export function soumettre(formulaire: HTMLFormElement): void {
  formulaire.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
}

/**
 * Le bouton visible qui porte ce texte ou ce nom, ou rien.
 *
 * Un bouton cache ne compte pas: un joueur ne peut pas le trouver, un test non
 * plus.
 */
export function boutonNomme(racine: ParentNode, nom: string): HTMLButtonElement | undefined {
  return [...racine.querySelectorAll('button')].find(
    (bouton) =>
      !estCache(bouton) &&
      (bouton.textContent?.trim() === nom || bouton.getAttribute('aria-label') === nom),
  );
}

/** Le bouton qui porte ce nom, en echouant clairement s'il n'est pas visible. */
export function boutonObligatoire(racine: ParentNode, nom: string): HTMLButtonElement {
  const trouve = boutonNomme(racine, nom);

  if (trouve === undefined) {
    throw new Error(`Aucun bouton visible nomme « ${nom} ».`);
  }

  return trouve;
}

/** Un element est-il cache, par lui-meme ou par l'un de ses ancetres. */
export function estCache(element: Element): boolean {
  for (let courant: Element | null = element; courant !== null; courant = courant.parentElement) {
    if (courant instanceof HTMLElement && courant.hidden) {
      return true;
    }
  }

  return false;
}

/** L'element qui repond a ce selecteur, en echouant clairement s'il manque. */
export function obligatoire<T extends Element = HTMLElement>(
  racine: ParentNode,
  selecteur: string,
): T {
  const trouve = racine.querySelector<T>(selecteur);

  if (trouve === null) {
    throw new Error(`Aucun element ne repond a « ${selecteur} ».`);
  }

  return trouve;
}
