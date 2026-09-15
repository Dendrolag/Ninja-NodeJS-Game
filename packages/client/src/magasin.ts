/**
 * Le magasin: le seul detenteur de l'etat du client.
 *
 * IL N'EXISTE AUCUNE VARIABLE GLOBALE MUTABLE DANS CE PAQUET, et ce fichier est
 * ce qui la remplace. L'etat vit dans une instance, creee par celui qui demarre
 * le client. Deux magasins peuvent donc coexister dans le meme processus sans se
 * voir, ce dont les tests profitent, et ce que le client d'origine rendait
 * impossible avec ses cent quarante variables de module.
 *
 * TROIS OPERATIONS, ET PAS UNE DE PLUS: lire l'etat courant, appliquer une
 * action, s'abonner aux changements. Il n'y a pas de moyen d'ecrire l'etat
 * directement, parce qu'il ne doit pas y en avoir: c'est le calcul de
 * reduction.ts qui produit l'etat suivant, et lui seul.
 *
 * COMMENT LE RENDU S'EN SERT (etape 4.2). Il ne s'abonne pas pour dessiner: il
 * dessine a la cadence du navigateur et LIT l'etat courant a chaque image. Le
 * legacy dessinait a la cadence des messages recus, ce qui plafonnait le jeu a
 * vingt images par seconde. L'abonnement sert aux menus (etape 4.3), qui ne se
 * redessinent que lorsque quelque chose change.
 */

import type { Action } from './actions.js';
import type { EtatClient } from './etat.js';
import { ETAT_INITIAL } from './etat.js';
import { reduire } from './reduction.js';

/** Ce qu'on observe quand on s'abonne au magasin. */
export type Observateur = (etat: EtatClient) => void;

/** Le detenteur de l'etat du client. */
export interface Magasin {
  /** L'etat courant. Toujours a jour, jamais modifiable. */
  readonly etat: EtatClient;
  /** Applique une action et previent les abonnes si l'etat a change. */
  appliquer(action: Action): void;
  /** S'abonne aux changements. Rend la fonction qui desabonne. */
  abonner(observateur: Observateur): () => void;
}

/**
 * Cree un magasin.
 *
 * @param depart Etat de depart. Celui d'un client qui vient de demarrer par
 *               defaut; un test peut en fournir un autre pour se placer
 *               directement dans la situation qu'il examine.
 */
export function creerMagasin(depart: EtatClient = ETAT_INITIAL): Magasin {
  let etat = depart;
  const observateurs = new Set<Observateur>();

  return {
    get etat() {
      return etat;
    },

    appliquer: (action) => {
      const suivant = reduire(etat, action);

      // RIEN N'EST DIFFUSE SI RIEN N'A CHANGE. Le calcul rend l'etat recu
      // lui-meme quand l'action ne change rien, par exemple un instantane
      // perime. Sans cette porte, le trafic de vingt messages par seconde
      // reveillerait les menus vingt fois par seconde pour rien.
      if (suivant === etat) {
        return;
      }

      etat = suivant;

      // On previent une COPIE de la liste: un observateur a le droit de se
      // desabonner en recevant l'etat, et modifier l'ensemble pendant qu'on le
      // parcourt sauterait le voisin.
      for (const observateur of [...observateurs]) {
        observateur(etat);
      }
    },

    abonner: (observateur) => {
      observateurs.add(observateur);

      return () => {
        observateurs.delete(observateur);
      };
    },
  };
}
