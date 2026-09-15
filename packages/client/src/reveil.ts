/**
 * Le reveil du serveur: quand le lien ne s'ouvre pas faute de reponse, la page
 * reessaie d'elle-meme un moment, avant de rendre la main au joueur (etape 5.3).
 *
 * POURQUOI. En production, le serveur de jeu tourne sur une offre gratuite qui
 * l'endort apres quinze minutes sans trafic. La premiere page qui l'appelle le
 * reveille, mais le reveil prend du temps (quinze secondes mesurees le 14 septembre
 * 2026, jusqu'a une minute selon l'hebergeur), et la tentative de la page echoue
 * avant. Sans ce module, le joueur lisait « Le serveur de jeu ne repond pas », sans
 * que rien ne se passe ensuite: il fallait deviner qu'un nouvel essai, un peu plus
 * tard, aboutirait.
 *
 * CE QUI EST REESSAYE, ET CE QUI NE L'EST PAS. Seul le motif d'un serveur qui ne
 * repond pas (SERVEUR_INJOIGNABLE, une panne de transport) donne lieu a de nouveaux
 * essais: toutes les ATTENTE_ENTRE_DEUX_ESSAIS_MS, pendant DUREE_DU_REVEIL_MS a
 * compter du premier echec. Un refus du serveur (session invalide, page d'une autre
 * version) arrive aussitot dans l'etat: reessayer ne le changerait pas.
 *
 * CE N'EST PAS LA RECONNEXION AUTOMATIQUE DE SOCKET.IO, coupee depuis l'etape 4.1
 * pour de bonnes raisons: un lien perdu en pleine partie ne se retablit pas en
 * silence. Ici, aucun lien n'a jamais ete etabli; on attend qu'il puisse l'etre.
 */

import type { HorlogeClient } from './horloge.js';
import type { Magasin } from './magasin.js';
import type { Annulation, Minuterie } from './minuterie.js';
import type { Reseau } from './reseau.js';
import { SERVEUR_INJOIGNABLE } from './reseau.js';

/** Entre deux essais d'ouverture, quand le serveur ne repond pas. */
export const ATTENTE_ENTRE_DEUX_ESSAIS_MS = 3000;

/**
 * Combien de temps la page reessaie d'elle-meme, a compter du premier echec.
 *
 * Une minute et demie: la minute que l'hebergeur annonce pour un reveil, et une
 * marge. Au-dela, ce n'est plus un reveil, et le joueur doit l'apprendre.
 */
export const DUREE_DU_REVEIL_MS = 90_000;

/** Ce qu'il faut pour brancher le reveil. */
export interface OptionsReveil {
  readonly magasin: Magasin;
  readonly reseau: Reseau;
  readonly horloge: HorlogeClient;
  readonly minuterie: Minuterie;
  /** Rouvre le lien, avec la session gardee: la commande reessayer de la session. */
  readonly reessayer: () => void;
  /** Retient une ecoute posee, pour que le client la retire en se fermant. */
  readonly ecouter: (retirer: () => void) => void;
}

/** Branche le reveil sur le transport: c'est lui qui traduit les refus du lien en etat. */
export function brancherLeReveil(options: OptionsReveil): void {
  const { magasin, reseau, horloge, minuterie } = options;

  /** L'instant du premier echec de la serie en cours, s'il y en a une. */
  let premierEchec: number | undefined;
  let annulerLEssai: Annulation | undefined;

  /** Oublie la serie d'echecs, et l'essai planifie. */
  const oublier = (): void => {
    annulerLEssai?.();
    annulerLEssai = undefined;
    premierEchec = undefined;
  };

  options.ecouter(reseau.surConnexion(oublier));

  options.ecouter(
    reseau.surRefus((motif) => {
      // Pendant un retour en partie (etape 2.5), c'est retour.ts qui reessaie: un
      // serveur qui ne repond pas n'y est pas un serveur qui dort.
      if (magasin.etat.connexion === 'retour') {
        return;
      }

      const maintenant = horloge.maintenant();

      if (motif === SERVEUR_INJOIGNABLE) {
        premierEchec ??= maintenant;

        if (maintenant - premierEchec < DUREE_DU_REVEIL_MS) {
          magasin.appliquer({ type: 'serveurEnReveil' });
          annulerLEssai?.();
          annulerLEssai = minuterie.planifier(ATTENTE_ENTRE_DEUX_ESSAIS_MS, () => {
            annulerLEssai = undefined;

            // Le joueur a pu rouvrir le lien lui-meme pendant l'attente, en changeant
            // de session: un second essai fermerait le sien.
            if (magasin.etat.connexion === 'reveil') {
              options.reessayer();
            }
          });
          return;
        }
      }

      // Le joueur reprend la main: son prochain essai ouvrira une nouvelle serie.
      oublier();
      magasin.appliquer({ type: 'connexionRefusee', motif });
    }),
  );

  options.ecouter(oublier);
}
