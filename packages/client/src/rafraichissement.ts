/**
 * La liste des parties vivante: tant que l'ecran des parties est affiche, la liste se
 * redemande d'elle-meme (recette de l'etape 5.4).
 *
 * POURQUOI. Jusque-la, elle ne se redemandait qu'a l'arrivee sur l'ecran et sur le
 * bouton « Actualiser ». Un joueur qui attendait devant elle voyait des salons deja
 * pleins ou lances, et jamais ceux qui venaient de s'ouvrir.
 *
 * DISCRETEMENT. La demande automatique ne passe pas par l'etat « recherche en
 * cours »: l'ecran garderait sinon, toutes les cinq secondes, un message de recherche
 * et une liste vide qui clignotent. La liste affichee reste en place jusqu'a la
 * reponse, qui la remplace.
 *
 * SANS S'EMPILER. Une demande n'en suit une autre qu'une fois sa reponse arrivee, et
 * seulement quand le lien est etabli: un serveur lent ne recoit pas une file de
 * demandes en retard.
 */

import type { EtatClient } from './etat.js';
import type { Magasin } from './magasin.js';
import type { Annulation, Minuterie } from './minuterie.js';

/** Entre deux demandes automatiques de la liste. */
export const INTERVALLE_DE_RAFRAICHISSEMENT_MS = 5000;

/** Ce qu'il faut pour brancher le rafraichissement. */
export interface OptionsRafraichissement {
  readonly magasin: Magasin;
  readonly minuterie: Minuterie;
  /**
   * Redemande la liste sans montrer de recherche en cours.
   *
   * @param reponseArrivee A appeler a l'arrivee de la reponse.
   */
  readonly redemander: (reponseArrivee: () => void) => void;
  /** Retient une ecoute posee, pour que le client la retire en se fermant. */
  readonly ecouter: (retirer: () => void) => void;
}

/** Branche le rafraichissement de la liste sur les changements d'ecran. */
export function brancherLeRafraichissement(options: OptionsRafraichissement): void {
  const { magasin, minuterie } = options;

  let annulerLeProchain: Annulation | undefined;
  let reponseAttendue = false;

  const arreter = (): void => {
    annulerLeProchain?.();
    annulerLeProchain = undefined;
  };

  /** La liste peut-elle etre redemandee maintenant. */
  const peutRedemander = (etat: EtatClient): boolean =>
    !reponseAttendue && !etat.listeEnCours && etat.connexion === 'connecte';

  const planifier = (): void => {
    annulerLeProchain = minuterie.planifier(INTERVALLE_DE_RAFRAICHISSEMENT_MS, () => {
      annulerLeProchain = undefined;

      if (magasin.etat.ecran !== 'parties') {
        return;
      }

      if (peutRedemander(magasin.etat)) {
        reponseAttendue = true;
        options.redemander(() => {
          reponseAttendue = false;
        });
      }

      planifier();
    });
  };

  const suivreLEcran = (etat: EtatClient): void => {
    if (etat.ecran !== 'parties') {
      arreter();
    } else if (annulerLeProchain === undefined) {
      planifier();
    }
  };

  options.ecouter(magasin.abonner(suivreLEcran));
  options.ecouter(arreter);
  suivreLEcran(magasin.etat);
}
