/**
 * Le retour dans sa partie apres une coupure (etape 2.5).
 *
 * CE QUE LE JOUEUR VIT. Son telephone perd le reseau, ou il recharge la page, en
 * pleine partie: il la retrouve, avec sa couleur et ses ninjas, pourvu que ce soit
 * dans les trente secondes. Le serveur lui a garde sa place, immobile.
 *
 * CE QUE FAIT CE MODULE, ET RIEN D'AUTRE.
 *
 *   - Il GARDE LE JETON DE RETOUR que le serveur remet a chaque entree en partie
 *     (placeAttribuee), et l'oublie des que la place ne vaut plus rien: en quittant,
 *     a la fin de la partie, au premier refus, ou quand une autre page la reprend.
 *   - LIEN TOMBE EN PLEINE PARTIE: la partie reste affichee, et la page rouvre le
 *     lien, toutes les ATTENTE_ENTRE_DEUX_RETOURS_MS, pendant DELAI_DE_RETOUR_MS a
 *     compter de la coupure. Des que le lien s'ouvre, elle presente le jeton.
 *     Au-dela du delai, la place est perdue, et le lien seul continue d'etre
 *     retabli (retablissement.ts, etape 2.6). Si le serveur refuse le lien lui-meme
 *     (une autre version, une session expiree), la perte est definitive.
 *   - LIEN TOMBE AILLEURS (menus, salon, fin): la place ne vaut rien, et c'est le
 *     retablissement qui prend la main.
 *   - PAGE RECHARGEE: le coffre du jeton de retour vit dans le stockage de session,
 *     qui survit au rechargement. Des que le lien s'ouvre, le jeton est presente.
 *
 * CE N'EST PAS LA RECONNEXION AUTOMATIQUE DE SOCKET.IO, qui reste coupee: revenir
 * est une demande explicite, que le serveur accepte ou refuse, et tout refus se dit
 * au joueur. Ce n'est pas non plus le reveil (reveil.ts), qui attend un serveur
 * endormi avant tout lien; il se tait pendant un retour.
 *
 * LE LIEN SE ROUVRE AVEC LA SESSION GARDEE, sans passer par les commandes de la
 * session: elles oublieraient la partie en rouvrant, et c'est justement elle qu'on
 * veut retrouver.
 */

import type { AuthentificationReseau } from '@neon-ninja/shared';
import { DELAI_DE_RETOUR_MS } from '@neon-ninja/shared';

import type { CoffreDeJeton } from './comptes/coffre.js';
import type { HorlogeClient } from './horloge.js';
import type { Magasin } from './magasin.js';
import type { Annulation, Minuterie } from './minuterie.js';
import type { Reseau } from './reseau.js';
import { SERVEUR_INJOIGNABLE } from './reseau.js';

/** Entre deux essais de rouvrir le lien, apres une coupure en pleine partie. */
export const ATTENTE_ENTRE_DEUX_RETOURS_MS = 2000;

/** Ce que l'accueil dit a une page dont une autre a repris la place. */
export const AVIS_PLACE_REPRISE = 'Votre partie a été reprise dans une autre page.';

/** Ce qu'il faut pour brancher le retour. */
export interface OptionsRetour {
  readonly magasin: Magasin;
  readonly reseau: Reseau;
  readonly horloge: HorlogeClient;
  readonly minuterie: Minuterie;
  /** Le coffre du jeton de retour. */
  readonly coffre: CoffreDeJeton;
  /** Ce que le lien presente a son ouverture: la session gardee, s'il y en a une. */
  readonly authentification: () => AuthentificationReseau;
  /** Rouvre le lien comme au demarrage, quand le joueur renonce a revenir. */
  readonly rouvrir: () => void;
  /**
   * Passe la main au retablissement du lien (etape 2.6), a compter de cet instant: le
   * lien est tombe hors d'une partie en cours, ou la place n'a pas pu etre reprise a
   * temps.
   */
  readonly lienPerdu: (depuis: number) => void;
  /** Retient une ecoute posee, pour que le client la retire en se fermant. */
  readonly ecouter: (retirer: () => void) => void;
}

/** Ce que le client peut demander au retour. */
export interface CommandesDeRetour {
  /**
   * Le joueur quitte sa partie: sa place est oubliee. S'il le fait pendant un
   * retour, la page y renonce et rouvre le lien comme au demarrage.
   */
  renoncer(): void;
}

/** Branche le retour sur le transport et le magasin. */
export function brancherLeRetour(options: OptionsRetour): CommandesDeRetour {
  const { magasin, reseau, horloge, minuterie, coffre } = options;

  /** L'instant de la coupure en cours, tant que la page tente de revenir en partie. */
  let coupureDepuis: number | undefined;
  let annulerLEssai: Annulation | undefined;

  /** Numero de la derniere demande de retour: une reponse plus ancienne ne compte plus. */
  let derniereDemande = 0;

  /** Arrete tout retour en cours: essai planifie, coupure, demande en attente. */
  const arreter = (): void => {
    annulerLEssai?.();
    annulerLEssai = undefined;
    coupureDepuis = undefined;
    derniereDemande += 1;
  };

  /** La place ne vaut plus rien: on l'oublie, et plus rien du retour ne court. */
  const oublierLaPlace = (): void => {
    arreter();
    coffre.oublier();
  };

  /** Rouvre le lien, si la coupure court encore. */
  const essayer = (): void => {
    annulerLEssai = undefined;

    if (coupureDepuis !== undefined) {
      reseau.ouvrir(options.authentification());
    }
  };

  /** Planifie le prochain essai, ou renonce si le delai de retour est ecoule. */
  const planifierUnEssai = (): void => {
    if (coupureDepuis === undefined) {
      return;
    }

    // La place est perdue, mais le lien, lui, peut encore revenir: le retablissement
    // continue a compter de la coupure (etape 2.6).
    if (horloge.maintenant() - coupureDepuis >= DELAI_DE_RETOUR_MS) {
      const depuis = coupureDepuis;

      oublierLaPlace();
      options.lienPerdu(depuis);
      return;
    }

    annulerLEssai?.();
    annulerLEssai = minuterie.planifier(ATTENTE_ENTRE_DEUX_RETOURS_MS, essayer);
  };

  /** Presente le jeton de retour sur le lien qui vient de s'ouvrir. */
  const demanderLeRetour = (jeton: string): void => {
    derniereDemande += 1;
    const numero = derniereDemande;

    reseau.emettre('revenir', { jeton }, (reponse) => {
      if (numero !== derniereDemande) {
        return;
      }

      arreter();

      if (reponse.valide) {
        magasin.appliquer({ type: 'retourAccepte', salon: reponse.valeur });
        return;
      }

      coffre.oublier();
      magasin.appliquer({
        type: 'retourRefuse',
        motif: reponse.erreurs.map((erreur) => erreur.motif).join(' '),
      });
    });
  };

  options.ecouter(
    reseau.sur('placeAttribuee', (place) => {
      coffre.garder(place.jetonDeRetour);
      magasin.appliquer({ type: 'placeAttribuee', joueur: place.joueur });
    }),
  );

  // Une partie finie ne se reprend plus: son classement est deja parti.
  options.ecouter(
    reseau.sur('partieTerminee', () => {
      coffre.oublier();
    }),
  );

  options.ecouter(
    reseau.sur('placeReprise', () => {
      arreter();
      coffre.oublier();
      magasin.appliquer({ type: 'retourRefuse', motif: AVIS_PLACE_REPRISE });
    }),
  );

  options.ecouter(
    reseau.surConnexion(() => {
      const jeton = coffre.lire();

      // Hors d'une coupure, seule une page qui vient de se charger avec une place
      // gardee a quelque chose a reprendre.
      if (
        jeton === undefined ||
        (coupureDepuis === undefined && magasin.etat.salon !== undefined)
      ) {
        return;
      }

      // Le lien est ouvert, mais la place n'est pas encore rendue: tant que le
      // serveur n'a pas repondu, on ne joue pas, ni ici ni ailleurs.
      magasin.appliquer({ type: 'retourDemande' });

      annulerLEssai?.();
      annulerLEssai = undefined;
      demanderLeRetour(jeton);
    }),
  );

  options.ecouter(
    reseau.surDeconnexion(() => {
      if (coupureDepuis !== undefined) {
        // Une demande partie sur le lien qui vient de tomber n'aura jamais de reponse
        // valable: celle qui arriverait quand meme ne doit rien decider.
        derniereDemande += 1;
        planifierUnEssai();
        return;
      }

      // Seule une partie en cours garde la place: ailleurs, dans le salon, ou pendant un
      // retour demande au chargement, la place ne vaut plus rien, et c'est le lien seul
      // qui se retablit (etape 2.6).
      if (coffre.lire() === undefined || magasin.etat.ecran !== 'jeu') {
        oublierLaPlace();
        options.lienPerdu(horloge.maintenant());
        return;
      }

      coupureDepuis = horloge.maintenant();
      magasin.appliquer({ type: 'lienPerduEnPartie' });
      essayer();
    }),
  );

  options.ecouter(
    reseau.surRefus((motif) => {
      if (coupureDepuis === undefined) {
        return;
      }

      if (motif === SERVEUR_INJOIGNABLE) {
        planifierUnEssai();
        return;
      }

      // Le serveur refuse le lien lui-meme: reessayer ne changera rien.
      oublierLaPlace();
      magasin.appliquer({ type: 'connexionRefusee', motif });
    }),
  );

  options.ecouter(arreter);

  return {
    renoncer: () => {
      const enCoupure = coupureDepuis !== undefined;

      arreter();
      coffre.oublier();

      if (enCoupure) {
        options.rouvrir();
      }
    },
  };
}
