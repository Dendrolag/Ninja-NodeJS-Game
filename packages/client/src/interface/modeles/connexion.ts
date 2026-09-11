/**
 * L'ecran de connexion et d'inscription, sous forme de donnees.
 *
 * LE CLIENT REFLETE LES REGLES DU SERVEUR, IL NE LES REMPLACE PAS. La saisie est
 * verifiee par validerDemandeConnexion et validerDemandeInscription, les fonctions
 * memes que les routes des comptes appliquent (etape 3.2): une demande que le
 * formulaire laisse partir a la forme que le serveur attend. Mais lui seul sait si
 * le pseudo est pris, si le mot de passe est le bon, ou s'il y a eu trop de
 * tentatives; ses refus s'affichent sur le formulaire.
 *
 * UNE FAUTE NE S'AFFICHE QU'UNE FOIS LE CHAMP VISITE. Signaler « pseudo trop
 * court » a la premiere lettre tapee reprocherait au joueur ce qu'il est en train
 * de corriger.
 *
 * UN REFUS DU SERVEUR NE CONCERNE QUE LA SAISIE QUI L'A PROVOQUE, comme sur
 * l'accueil: des que le pseudo ou l'onglet changent, il n'est plus montre.
 *
 * FONCTION PURE: l'etat du client et la saisie en entree, ce qu'il faut afficher en
 * sortie, dont la demande prete a partir.
 */

import type { DemandeConnexion, DemandeInscription, ErreurValidation } from '@neon-ninja/shared';
import {
  BORNES_MOT_DE_PASSE,
  normaliserTexte,
  validerDemandeConnexion,
  validerDemandeInscription,
} from '@neon-ninja/shared';

import type { EtatClient, NatureDemandeDeCompte } from '../../etat.js';

/** Ce que le joueur a saisi. */
export interface SaisieDeCompte {
  readonly nature: NatureDemandeDeCompte;
  readonly pseudo: string;
  readonly motDePasse: string;
  /** Le champ du pseudo a ete quitte, ou l'envoi tente: ses fautes peuvent s'afficher. */
  readonly pseudoVisite: boolean;
  /** De meme pour le mot de passe. */
  readonly motDePasseVisite: boolean;
}

/** Une demande prete a partir. */
export type EnvoiDeCompte =
  | { readonly nature: 'connexion'; readonly demande: DemandeConnexion }
  | { readonly nature: 'inscription'; readonly demande: DemandeInscription };

/** Ce que l'ecran de connexion affiche. */
export interface ModeleConnexion {
  /** Le texte du bouton d'envoi. */
  readonly bouton: string;
  /** L'aide du gestionnaire de mots de passe du navigateur. */
  readonly autocompletion: 'current-password' | 'new-password';
  /** La regle du mot de passe, rappelee a l'inscription. */
  readonly aideMotDePasse: string | undefined;
  readonly erreurPseudo: string | undefined;
  readonly erreurMotDePasse: string | undefined;
  /** Un refus qui ne tient a aucun champ: identifiants, tentatives, serveur. */
  readonly erreurGenerale: string | undefined;
  /** La demande est partie et attend sa reponse. */
  readonly enCours: boolean;
  /** La demande prete a partir, ou rien si la saisie ne le permet pas encore. */
  readonly envoi: EnvoiDeCompte | undefined;
}

/** Les champs du formulaire, tels que les validateurs les nomment. */
const CHAMPS_DU_FORMULAIRE: ReadonlySet<string> = new Set(['pseudo', 'motDePasse']);

/** Calcule l'ecran de connexion. */
export function modeleConnexion(etat: EtatClient, saisie: SaisieDeCompte): ModeleConnexion {
  const brut = { pseudo: saisie.pseudo, motDePasse: saisie.motDePasse };
  const refus = refusDeLaSaisie(etat, saisie);
  const enCours = etat.demandeDeCompte.enCours;

  let envoi: EnvoiDeCompte | undefined;
  let fautes: readonly ErreurValidation[] = [];

  if (saisie.nature === 'connexion') {
    const verdict = validerDemandeConnexion(brut);

    if (verdict.valide) {
      envoi = { nature: 'connexion', demande: verdict.valeur };
    } else {
      fautes = verdict.erreurs;
    }
  } else {
    const verdict = validerDemandeInscription(brut);

    if (verdict.valide) {
      envoi = { nature: 'inscription', demande: verdict.valeur };
    } else {
      fautes = verdict.erreurs;
    }
  }

  const generales = refus.filter((erreur) => !CHAMPS_DU_FORMULAIRE.has(erreur.champ));

  return {
    bouton: saisie.nature === 'connexion' ? 'Se connecter' : 'Créer le compte',
    autocompletion: saisie.nature === 'connexion' ? 'current-password' : 'new-password',
    aideMotDePasse:
      saisie.nature === 'inscription'
        ? `Au moins ${String(BORNES_MOT_DE_PASSE.longueur.minimum)} caractères. Une phrase fait un excellent mot de passe.`
        : undefined,
    erreurPseudo:
      (saisie.pseudoVisite ? motifDu(fautes, 'pseudo') : undefined) ?? motifDu(refus, 'pseudo'),
    erreurMotDePasse:
      (saisie.motDePasseVisite ? motifDu(fautes, 'motDePasse') : undefined) ??
      motifDu(refus, 'motDePasse'),
    erreurGenerale:
      generales.length === 0 ? undefined : generales.map((erreur) => erreur.motif).join(' '),
    enCours,
    // Un mot de passe vide n'est pas refuse par la regle de connexion, qui ne borne
    // que sa longueur maximale; il ne peut pourtant ouvrir aucun compte.
    envoi: enCours || saisie.motDePasse === '' ? undefined : envoi,
  };
}

/**
 * Les motifs du dernier refus du serveur, s'il concerne cette saisie.
 *
 * Il la concerne si c'est la meme sorte de demande, pour le meme pseudo, et
 * qu'aucune autre demande n'est partie depuis.
 */
function refusDeLaSaisie(etat: EtatClient, saisie: SaisieDeCompte): readonly ErreurValidation[] {
  const demande = etat.demandeDeCompte;

  if (
    demande.enCours ||
    demande.nature !== saisie.nature ||
    demande.pseudo === undefined ||
    normaliserTexte(saisie.pseudo) !== demande.pseudo
  ) {
    return [];
  }

  return demande.erreurs;
}

/** Les motifs portes par un champ, joints en une phrase, ou rien. */
function motifDu(erreurs: readonly ErreurValidation[], champ: string): string | undefined {
  const motifs = erreurs.filter((erreur) => erreur.champ === champ).map((erreur) => erreur.motif);

  return motifs.length === 0 ? undefined : motifs.join(' ');
}
