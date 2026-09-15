/**
 * Le lien perdu hors d'une partie en cours, retabli par la page elle-meme (etape 2.6).
 *
 * CE QUE LE JOUEUR VIT. Son telephone change de reseau, son onglet s'endort, le
 * serveur redemarre pour une mise en ligne: sur l'accueil, dans les menus, dans le
 * salon ou devant le classement de fin, la page le dit (« Connexion perdue.
 * Reconnexion… ») et rouvre le lien sans qu'il ait rien a faire. Il reste sur son
 * ecran, avec ce qu'il y a saisi (decision du porteur du projet, 15 septembre 2026).
 *
 * CE QUE FAIT CE MODULE, ET RIEN D'AUTRE.
 *
 *   - IL NE DECIDE PAS QUE LE LIEN EST PERDU. retour.ts le fait, parce qu'en pleine
 *     partie une place est a reprendre; ailleurs, ou quand le delai de retour s'est
 *     ecoule, il passe la main ici par commencer().
 *   - IL ROUVRE LE LIEN aussitot, puis toutes les ATTENTE_ENTRE_DEUX_RETABLISSEMENTS_MS
 *     tant que le serveur ne repond pas, pendant DUREE_DU_RETABLISSEMENT_MS a compter
 *     de la perte: les valeurs du reveil du serveur (reveil.ts), qui se tait pendant
 *     ce temps. Au-dela, la perte est definitive et se dit, et le joueur peut relancer.
 *   - IL REESSAIE AUSSITOT quand la page revient au premier plan ou que le navigateur
 *     retrouve le reseau: un telephone sorti de la poche n'attend pas le prochain
 *     essai, et une perte definitive se relance d'elle-meme.
 *   - DANS LE SALON, IL REDEMANDE A Y ENTRER, par le code d'une partie privee ou par
 *     l'identifiant d'une publique. Le serveur n'a pas garde la place (etape 2.5): le
 *     joueur y revient comme un nouvel arrivant. Refuse, l'accueil dit pourquoi.
 *
 * UN REFUS DU SERVEUR ARRETE TOUT. Une session fermee ou une page d'une autre version
 * ne s'ouvriront pas mieux au prochain essai: le refus arrive dans l'etat, et le
 * joueur choisit la suite (decision du 11 septembre 2026).
 *
 * LE LIEN SE ROUVRE AVEC LA SESSION GARDEE, sans relire la progression. Le serveur
 * verifie le jeton a l'ouverture; relire la progression a chaque essai enverrait des
 * requetes a un serveur injoignable, sans delai de garde.
 *
 * CE N'EST PAS LA RECONNEXION AUTOMATIQUE DE SOCKET.IO, qui reste coupee: chaque essai
 * est une ouverture demandee, et revenir dans le salon est une demande d'entree que
 * le serveur accepte ou refuse.
 */

import type { AuthentificationReseau, DemandeRejoindre } from '@neon-ninja/shared';

import type { EtatClient } from './etat.js';
import type { HorlogeClient } from './horloge.js';
import type { Magasin } from './magasin.js';
import type { Annulation, Minuterie } from './minuterie.js';
import type { Reseau } from './reseau.js';
import { SERVEUR_INJOIGNABLE } from './reseau.js';
import { ATTENTE_ENTRE_DEUX_ESSAIS_MS, DUREE_DU_REVEIL_MS } from './reveil.js';
import { moiDansLeSalon } from './selecteurs.js';

/** Entre deux essais de rouvrir un lien perdu: l'attente du reveil du serveur. */
export const ATTENTE_ENTRE_DEUX_RETABLISSEMENTS_MS = ATTENTE_ENTRE_DEUX_ESSAIS_MS;

/**
 * Combien de temps la page retablit le lien d'elle-meme, a compter de sa perte: la
 * duree du reveil du serveur, une minute et demie.
 */
export const DUREE_DU_RETABLISSEMENT_MS = DUREE_DU_REVEIL_MS;

/** Ce que l'accueil dit a qui a perdu sa place en partie, faute de lien revenu a temps. */
export const AVIS_PARTIE_PERDUE =
  'La connexion n’est pas revenue à temps : votre place dans la partie est perdue.';

/** Ce que l'accueil dit quand le salon ou l'on attendait n'a pas pu etre retrouve. */
export const AVIS_SALON_PERDU = 'Le salon n’a pas pu être retrouvé.';

/** Ce qu'il faut pour brancher le retablissement. */
export interface OptionsRetablissement {
  readonly magasin: Magasin;
  readonly reseau: Reseau;
  readonly horloge: HorlogeClient;
  readonly minuterie: Minuterie;
  /** Ce que le lien presente a son ouverture: la session gardee, s'il y en a une. */
  readonly authentification: () => AuthentificationReseau;
  /**
   * Previent quand la page a une raison de croire le reseau revenu: elle repasse au
   * premier plan, ou le navigateur annonce le reseau retrouve. Rend la fonction qui
   * arrete d'ecouter. Absent, seuls les essais planifies rouvrent le lien.
   */
  readonly surReseauRetrouve?: (gestionnaire: () => void) => () => void;
  /** Retient une ecoute posee, pour que le client la retire en se fermant. */
  readonly ecouter: (retirer: () => void) => void;
}

/** Ce que le client peut demander au retablissement. */
export interface CommandesDuRetablissement {
  /** Le lien est perdu hors d'une partie en cours depuis cet instant: la page le retablit. */
  commencer(depuis: number): void;
  /** Le joueur reessaie apres une perte definitive: une nouvelle serie d'essais commence. */
  relancer(): void;
  /**
   * Le joueur quitte le salon ou il attendait: il n'y sera pas redemande, et une
   * reponse deja en route ne compte plus.
   */
  renoncerAuSalon(): void;
}

/** Branche le retablissement sur le transport et le magasin. */
export function brancherLeRetablissement(
  options: OptionsRetablissement,
): CommandesDuRetablissement {
  const { magasin, reseau, horloge, minuterie } = options;

  /** L'instant de la perte en cours, tant que la page retablit le lien. */
  let perteDepuis: number | undefined;
  let annulerLEssai: Annulation | undefined;

  /** Numero de la derniere demande d'entree dans le salon: une reponse plus ancienne ne compte plus. */
  let derniereDemande = 0;

  const annulerLEssaiPlanifie = (): void => {
    annulerLEssai?.();
    annulerLEssai = undefined;
  };

  /** Arrete tout: essai planifie, perte en cours, demande en attente. */
  const arreter = (): void => {
    annulerLEssaiPlanifie();
    perteDepuis = undefined;
    derniereDemande += 1;
  };

  /** Rouvre le lien, si la perte court encore. */
  const essayer = (): void => {
    annulerLEssai = undefined;

    if (perteDepuis !== undefined) {
      reseau.ouvrir(options.authentification());
    }
  };

  const commencer = (depuis: number): void => {
    annulerLEssaiPlanifie();
    derniereDemande += 1;
    perteDepuis = depuis;

    // Depuis l'ecran de jeu, c'est la place en partie qui vient d'etre perdue.
    magasin.appliquer(
      magasin.etat.ecran === 'jeu'
        ? { type: 'lienPerdu', avis: AVIS_PARTIE_PERDUE }
        : { type: 'lienPerdu' },
    );
    essayer();
  };

  /** La minute et demie est ecoulee: la perte est definitive, et se dit. */
  const abandonner = (): void => {
    const dansLeSalon = magasin.etat.ecran === 'salon';

    arreter();
    magasin.appliquer(
      dansLeSalon
        ? { type: 'connexionPerdue', avis: AVIS_SALON_PERDU }
        : { type: 'connexionPerdue' },
    );
  };

  /** Le lien est revenu: la page redemande a entrer dans le salon qu'elle montrait. */
  const redemanderLeSalon = (): void => {
    const demande = demandeDeRetourAuSalon(magasin.etat);

    if (demande === undefined) {
      return;
    }

    derniereDemande += 1;
    const numero = derniereDemande;

    magasin.appliquer({ type: 'salonRedemande' });

    reseau.emettre('rejoindre', demande, (reponse) => {
      if (numero !== derniereDemande) {
        return;
      }

      if (reponse.valide) {
        magasin.appliquer({ type: 'retourAccepte', salon: reponse.valeur });
        return;
      }

      magasin.appliquer({
        type: 'retourRefuse',
        motif: [AVIS_SALON_PERDU, ...reponse.erreurs.map((erreur) => erreur.motif)].join(' '),
      });
    });
  };

  options.ecouter(
    reseau.surConnexion(() => {
      if (perteDepuis === undefined) {
        return;
      }

      annulerLEssaiPlanifie();
      perteDepuis = undefined;

      if (magasin.etat.ecran === 'salon') {
        redemanderLeSalon();
      }
    }),
  );

  options.ecouter(
    reseau.surRefus((motif) => {
      if (perteDepuis === undefined) {
        return;
      }

      if (motif !== SERVEUR_INJOIGNABLE) {
        // Le serveur refuse le lien lui-meme: reessayer ne changera rien.
        arreter();
        magasin.appliquer({ type: 'connexionRefusee', motif });
        return;
      }

      if (horloge.maintenant() - perteDepuis >= DUREE_DU_RETABLISSEMENT_MS) {
        abandonner();
        return;
      }

      annulerLEssaiPlanifie();
      annulerLEssai = minuterie.planifier(ATTENTE_ENTRE_DEUX_RETABLISSEMENTS_MS, essayer);
    }),
  );

  if (options.surReseauRetrouve !== undefined) {
    options.ecouter(
      options.surReseauRetrouve(() => {
        if (magasin.etat.connexion === 'perdue') {
          commencer(horloge.maintenant());
          return;
        }

        // Un essai planifie part tout de suite; un essai deja en route suit son cours.
        if (perteDepuis !== undefined && annulerLEssai !== undefined) {
          annulerLEssaiPlanifie();
          essayer();
        }
      }),
    );
  }

  options.ecouter(arreter);

  return {
    commencer,

    relancer: () => {
      if (magasin.etat.connexion === 'perdue') {
        commencer(horloge.maintenant());
      }
    },

    renoncerAuSalon: () => {
      derniereDemande += 1;
    },
  };
}

/**
 * La demande qui fait revenir dans le salon affiche.
 *
 * Une partie privee ne se rejoint que par son code: le serveur refuse son
 * identifiant. Un invite y revient sous le pseudo que le serveur lui avait retenu; un
 * compte entre sous le sien, sans en envoyer.
 */
function demandeDeRetourAuSalon(etat: EtatClient): DemandeRejoindre | undefined {
  const salon = etat.salon;

  if (salon === undefined) {
    return undefined;
  }

  const acces =
    salon.visibilite === 'privee' && salon.code !== undefined
      ? { code: salon.code }
      : { idRoom: salon.idRoom };

  const pseudo =
    etat.session.nature === 'invite'
      ? (moiDansLeSalon(etat)?.pseudo ?? etat.pseudoDemande)
      : undefined;

  return pseudo === undefined ? acces : { ...acces, pseudo };
}
