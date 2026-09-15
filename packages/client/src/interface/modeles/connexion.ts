/**
 * L'ecran de connexion et d'inscription, sous forme de donnees.
 *
 * LE CLIENT REFLETE LES REGLES DU SERVEUR, IL NE LES REMPLACE PAS. La saisie est
 * verifiee par validerDemandeConnexion, validerDemandeInscription et, depuis l'etape
 * 3.4, validerDemandeReinitialisation, les fonctions memes que les routes des comptes
 * appliquent: une demande que le formulaire laisse partir a la forme que le serveur
 * attend. Mais lui seul sait si le pseudo est pris, si le mot de passe ou le code de
 * secours sont les bons, ou s'il y a eu trop de tentatives; ses refus s'affichent sur
 * le formulaire.
 *
 * TROIS FORMULAIRES EN UN. Se connecter et creer un compte sont deux onglets. Le mot
 * de passe oublie (etape 3.4) est un troisieme temps, ou le joueur donne son pseudo,
 * son code de secours et un nouveau mot de passe.
 *
 * UNE FAUTE NE S'AFFICHE QU'UNE FOIS LE CHAMP VISITE. Signaler « pseudo trop
 * court » a la premiere lettre tapee reprocherait au joueur ce qu'il est en train
 * de corriger.
 *
 * UN REFUS DU SERVEUR NE CONCERNE QUE LA SAISIE QUI L'A PROVOQUE, comme sur
 * l'accueil: des que le pseudo ou le formulaire changent, il n'est plus montre.
 *
 * FONCTION PURE: l'etat du client et la saisie en entree, ce qu'il faut afficher en
 * sortie, dont la demande prete a partir.
 */

import type {
  DemandeConnexion,
  DemandeInscription,
  DemandeReinitialisation,
  ErreurValidation,
} from '@neon-ninja/shared';
import {
  BORNES_MOT_DE_PASSE,
  normaliserTexte,
  validerDemandeConnexion,
  validerDemandeInscription,
  validerDemandeReinitialisation,
} from '@neon-ninja/shared';

import type { EtatClient } from '../../etat.js';

/** Le formulaire affiche: se connecter, creer un compte, ou retrouver l'acces au sien. */
export type FormulaireDeCompte = 'connexion' | 'inscription' | 'reinitialisation';

/** Ce que le joueur a saisi. */
export interface SaisieDeCompte {
  readonly nature: FormulaireDeCompte;
  readonly pseudo: string;
  /** Le mot de passe; le nouveau, pour une reinitialisation. */
  readonly motDePasse: string;
  /** Le code de secours, pour une reinitialisation (etape 3.4). */
  readonly codeDeSecours: string;
  /** Le champ du pseudo a ete quitte, ou l'envoi tente: ses fautes peuvent s'afficher. */
  readonly pseudoVisite: boolean;
  /** De meme pour le mot de passe. */
  readonly motDePasseVisite: boolean;
  /** De meme pour le code de secours. */
  readonly codeVisite: boolean;
}

/** Une demande prete a partir. */
export type EnvoiDeCompte =
  | { readonly nature: 'connexion'; readonly demande: DemandeConnexion }
  | { readonly nature: 'inscription'; readonly demande: DemandeInscription }
  | { readonly nature: 'reinitialisation'; readonly demande: DemandeReinitialisation };

/** Ce que l'ecran de connexion affiche. */
export interface ModeleConnexion {
  readonly titre: string;
  readonly intro: string;
  /** Les onglets se connecter et creer un compte sont proposes. */
  readonly onglets: boolean;
  /** Le champ du code de secours est demande: c'est une reinitialisation. */
  readonly demandeLeCode: boolean;
  /** Le nom du champ du mot de passe. */
  readonly libelleMotDePasse: string;
  /** Le texte du bouton d'envoi. */
  readonly bouton: string;
  /** L'aide du gestionnaire de mots de passe du navigateur. */
  readonly autocompletion: 'current-password' | 'new-password';
  /** La regle du mot de passe, rappelee quand on en choisit un. */
  readonly aideMotDePasse: string | undefined;
  readonly erreurPseudo: string | undefined;
  readonly erreurMotDePasse: string | undefined;
  readonly erreurCode: string | undefined;
  /** Un refus qui ne tient a aucun champ: identifiants, code, tentatives, serveur. */
  readonly erreurGenerale: string | undefined;
  /** La demande est partie et attend sa reponse. */
  readonly enCours: boolean;
  /** La demande prete a partir, ou rien si la saisie ne le permet pas encore. */
  readonly envoi: EnvoiDeCompte | undefined;
}

/** Ce que dit l'ecran quand on se connecte ou cree un compte. */
export const INTRO_DU_COMPTE =
  'Le compte est facultatif : il garde votre XP, vos pièces et vos points de ligue. Sans compte, vous jouez en invité, avec un simple pseudo.';

/** Ce que dit l'ecran du mot de passe oublie. */
export const INTRO_DU_MOT_DE_PASSE_OUBLIE =
  'Entrez le code de secours reçu à la création du compte ou au dernier changement de mot de passe, puis choisissez un nouveau mot de passe. Sans ce code, un mot de passe oublié ne se retrouve pas.';

/** Les champs du formulaire, tels que les validateurs les nomment. */
const CHAMPS_DU_FORMULAIRE: ReadonlySet<string> = new Set([
  'pseudo',
  'motDePasse',
  'codeDeSecours',
]);

/** Calcule l'ecran de connexion. */
export function modeleConnexion(etat: EtatClient, saisie: SaisieDeCompte): ModeleConnexion {
  const refus = refusDeLaSaisie(etat, saisie).map(nouveauCommeMotDePasse);
  const enCours = etat.demandeDeCompte.enCours;
  const verdict = verdictDeLaSaisie(saisie);
  const fautes = verdict.envoi === undefined ? verdict.fautes : [];
  const generales = refus.filter((erreur) => !CHAMPS_DU_FORMULAIRE.has(erreur.champ));
  const oubli = saisie.nature === 'reinitialisation';

  return {
    titre: oubli ? 'Mot de passe oublié' : 'Votre compte',
    intro: oubli ? INTRO_DU_MOT_DE_PASSE_OUBLIE : INTRO_DU_COMPTE,
    onglets: !oubli,
    demandeLeCode: oubli,
    libelleMotDePasse: oubli ? 'Nouveau mot de passe' : 'Mot de passe',
    bouton: TEXTES_DU_BOUTON[saisie.nature],
    autocompletion: saisie.nature === 'connexion' ? 'current-password' : 'new-password',
    aideMotDePasse:
      saisie.nature === 'connexion'
        ? undefined
        : `Au moins ${String(BORNES_MOT_DE_PASSE.longueur.minimum)} caractères. Une phrase fait un excellent mot de passe.`,
    erreurPseudo:
      (saisie.pseudoVisite ? motifDu(fautes, 'pseudo') : undefined) ?? motifDu(refus, 'pseudo'),
    erreurMotDePasse:
      (saisie.motDePasseVisite ? motifDu(fautes, 'motDePasse') : undefined) ??
      motifDu(refus, 'motDePasse'),
    erreurCode:
      (saisie.codeVisite ? motifDu(fautes, 'codeDeSecours') : undefined) ??
      motifDu(refus, 'codeDeSecours'),
    erreurGenerale:
      generales.length === 0 ? undefined : generales.map((erreur) => erreur.motif).join(' '),
    enCours,
    // Un mot de passe vide n'est pas refuse par la regle de connexion, qui ne borne
    // que sa longueur maximale; il ne peut pourtant ouvrir aucun compte.
    envoi: enCours || saisie.motDePasse === '' ? undefined : verdict.envoi,
  };
}

/** Le texte du bouton d'envoi de chaque formulaire. */
const TEXTES_DU_BOUTON: Readonly<Record<FormulaireDeCompte, string>> = {
  connexion: 'Se connecter',
  inscription: 'Créer le compte',
  reinitialisation: 'Changer le mot de passe',
};

/** La demande que la saisie permet d'envoyer, ou ses fautes, sous les noms des champs. */
function verdictDeLaSaisie(saisie: SaisieDeCompte): {
  readonly envoi: EnvoiDeCompte | undefined;
  readonly fautes: readonly ErreurValidation[];
} {
  const { pseudo, motDePasse } = saisie;

  switch (saisie.nature) {
    case 'connexion': {
      const verdict = validerDemandeConnexion({ pseudo, motDePasse });
      return verdict.valide
        ? { envoi: { nature: 'connexion', demande: verdict.valeur }, fautes: [] }
        : { envoi: undefined, fautes: verdict.erreurs };
    }

    case 'inscription': {
      const verdict = validerDemandeInscription({ pseudo, motDePasse });
      return verdict.valide
        ? { envoi: { nature: 'inscription', demande: verdict.valeur }, fautes: [] }
        : { envoi: undefined, fautes: verdict.erreurs };
    }

    case 'reinitialisation': {
      const verdict = validerDemandeReinitialisation({
        pseudo,
        codeDeSecours: saisie.codeDeSecours,
        nouveauMotDePasse: motDePasse,
      });
      return verdict.valide
        ? { envoi: { nature: 'reinitialisation', demande: verdict.valeur }, fautes: [] }
        : { envoi: undefined, fautes: verdict.erreurs.map(nouveauCommeMotDePasse) };
    }
  }
}

/**
 * Le nouveau mot de passe d'une reinitialisation s'affiche sous le champ du mot de
 * passe: c'est le meme champ a l'ecran.
 */
function nouveauCommeMotDePasse(erreur: ErreurValidation): ErreurValidation {
  return erreur.champ === 'nouveauMotDePasse' ? { ...erreur, champ: 'motDePasse' } : erreur;
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
