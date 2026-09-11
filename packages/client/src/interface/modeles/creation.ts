/**
 * La creation d'une partie, sous forme de donnees.
 *
 * CE QUE DIT LE CADRAGE (section 3, creer une partie): le mode (la tuile Classique,
 * et une tuile « a venir »), la carte avec son apercu et le miroir, la visibilite
 * publique ou privee, tous les reglages de la section 4, et un recapitulatif avec la
 * capacite deduite du mode. Mode et visibilite se choisissent ici et ne changent
 * plus; les reglages restent modifiables par l'hote dans le salon.
 *
 * LA VALIDATION EST CELLE DU SERVEUR. Les reglages sont verifies par
 * verifierLesValeurs (validerReglages), et la demande entiere par
 * validerDemandeCreation, la fonction que la couche reseau applique a la reception.
 * Une demande que ce modele laisse partir a la forme que le serveur accepte; un
 * test d'integration le verifie contre un vrai serveur.
 *
 * FONCTION PURE: l'etat du client et la saisie en entree, ce qu'il faut afficher en
 * sortie, dont la demande prete a partir.
 */

import type { ConfigurationPartie, IdentifiantCarte, Mode, Visibilite } from '@neon-ninja/shared';
import { CAPACITES, CARTES, MODES, validerDemandeCreation } from '@neon-ninja/shared';

import type { EtatClient } from '../../etat.js';
import { formaterDuree } from '../../hud/modele.js';
import { NOMS_DES_MODES, nomDeCarte } from './cartes.js';
import { pseudoDEntree } from './pseudo.js';
import type { ValeursFormulaire } from './reglages.js';
import { erreursParChamp, verifierLesValeurs } from './reglages.js';
import type { LigneRecapitulatif } from './salon.js';

/** Le mode des parties creees. Un seul existe en v1. */
export const MODE_DE_CREATION: Mode = MODES[0];

/** Ce que le joueur a choisi. */
export interface SaisieDeCreation {
  readonly visibilite: Visibilite;
  /** Les valeurs du formulaire des reglages, telles que saisies. */
  readonly valeurs: ValeursFormulaire;
}

/** Une demande de creation prete a partir. */
export interface EnvoiDeCreation {
  /** Absent pour un compte, qui entre sous son pseudo. */
  readonly pseudo: string | undefined;
  readonly configuration: ConfigurationPartie;
}

/** Ce que l'ecran de creation affiche. */
export interface ModeleCreation {
  /** « Classique · Rainy Tokyo ». */
  readonly titre: string;
  readonly recapitulatif: readonly LigneRecapitulatif[];
  readonly pseudoRequis: boolean;
  readonly erreurPseudo: string | undefined;
  readonly aidePseudo: string | undefined;
  /** Tous les reglages sont acceptes par la regle du serveur. */
  readonly reglagesValides: boolean;
  /** Le refus de creation du serveur. */
  readonly refus: string | undefined;
  /** Une demande attend sa reponse. */
  readonly enAttente: boolean;
  readonly lienEtabli: boolean;
  /** La demande prete a partir, ou rien si la saisie ne le permet pas. */
  readonly envoi: EnvoiDeCreation | undefined;
}

/** Ce que le recapitulatif dit de chaque visibilite. */
const VISIBILITES_AFFICHEES: Readonly<Record<Visibilite, string>> = {
  publique: 'Publique',
  privee: 'Privée, sur code d’invitation',
};

/** Calcule l'ecran de creation. */
export function modeleCreation(etat: EtatClient, saisie: SaisieDeCreation): ModeleCreation {
  const verdict = verifierLesValeurs(saisie.valeurs);
  const fautes = verdict.valide ? new Map<string, string>() : erreursParChamp(verdict.erreurs);
  const pseudo = pseudoDEntree(etat);
  const lienEtabli = etat.connexion === 'connecte';

  const configuration: ConfigurationPartie | undefined = verdict.valide
    ? { mode: MODE_DE_CREATION, visibilite: saisie.visibilite, reglages: verdict.valeur }
    : undefined;

  // La derniere verification est celle du serveur, sur la demande entiere.
  const demandeAcceptee =
    configuration !== undefined &&
    validerDemandeCreation({
      ...(pseudo.valeur === undefined ? {} : { pseudo: pseudo.valeur }),
      configuration,
    }).valide;

  return {
    titre: `${NOMS_DES_MODES[MODE_DE_CREATION]} · ${carteSaisie(saisie.valeurs)}`,
    recapitulatif: [
      { libelle: 'Visibilité', valeur: VISIBILITES_AFFICHEES[saisie.visibilite] },
      {
        libelle: 'Durée',
        valeur: fautes.has('dureePartieS')
          ? '—'
          : formaterDuree(Number(saisie.valeurs['dureePartieS']) * 1000),
      },
      {
        libelle: 'Faux ninjas',
        valeur: fautes.has('nombreBotsInitial') ? '—' : String(saisie.valeurs['nombreBotsInitial']),
      },
      { libelle: 'Capacité', valeur: `${String(CAPACITES[MODE_DE_CREATION])} joueurs` },
    ],
    pseudoRequis: pseudo.requis,
    erreurPseudo: pseudo.erreur,
    aidePseudo: pseudo.manquant ? 'Choisissez un pseudo pour créer une partie.' : undefined,
    reglagesValides: verdict.valide,
    refus:
      etat.refus?.action === 'creerPartie'
        ? etat.refus.erreurs.map((erreur) => erreur.motif).join(' ')
        : undefined,
    enAttente: etat.entreeEnCours,
    lienEtabli,
    envoi:
      lienEtabli &&
      !etat.entreeEnCours &&
      pseudo.pret &&
      configuration !== undefined &&
      demandeAcceptee
        ? { pseudo: pseudo.valeur, configuration }
        : undefined,
  };
}

/** Le nom de la carte choisie, miroir compris, ou un tiret si le choix est illisible. */
function carteSaisie(valeurs: ValeursFormulaire): string {
  const carte = String(valeurs['carte'] ?? '');

  return Object.hasOwn(CARTES, carte)
    ? nomDeCarte(carte as IdentifiantCarte, valeurs['modeMiroir'] === true)
    : '—';
}
