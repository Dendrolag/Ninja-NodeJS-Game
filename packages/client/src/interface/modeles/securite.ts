/**
 * La securite du compte, dans le profil, sous forme de donnees (etape 3.4): changer
 * son mot de passe, et obtenir un nouveau code de secours.
 *
 * LES MEMES PRINCIPES QUE L'ECRAN DE CONNEXION (modeles/connexion.ts). La saisie est
 * verifiee par les validateurs memes du serveur; une faute ne s'affiche qu'une fois
 * le champ visite; le refus du serveur ne s'affiche que sous le formulaire qui l'a
 * provoque, et plus des que le joueur retouche sa saisie.
 *
 * DEUX FORMULAIRES, UNE SEULE DEMANDE A LA FOIS. Ils partagent la demande de compte
 * de l'etat: tant que l'une attend sa reponse, aucun des deux ne peut partir.
 *
 * FONCTIONS PURES: l'etat du client et la saisie en entree, ce qu'il faut afficher
 * en sortie, dont la demande prete a partir.
 */

import type {
  DemandeChangementMotDePasse,
  DemandeCodeDeSecours,
  ErreurValidation,
} from '@neon-ninja/shared';
import {
  BORNES_MOT_DE_PASSE,
  validerDemandeChangementMotDePasse,
  validerDemandeCodeDeSecours,
} from '@neon-ninja/shared';

import type { EtatClient, NatureDemandeDeCompte } from '../../etat.js';

/** Ce que le joueur a saisi pour changer son mot de passe. */
export interface SaisieDeChangement {
  /** Le mot de passe actuel. */
  readonly motDePasse: string;
  readonly nouveauMotDePasse: string;
  readonly motDePasseVisite: boolean;
  readonly nouveauVisite: boolean;
  /** Le joueur a retouche sa saisie depuis le dernier envoi: la reponse ne la concerne plus. */
  readonly modifieeDepuisLEnvoi: boolean;
}

/** Ce que le joueur a saisi pour obtenir un nouveau code de secours. */
export interface SaisieDeCode {
  /** Le mot de passe actuel. */
  readonly motDePasse: string;
  readonly motDePasseVisite: boolean;
  readonly modifieeDepuisLEnvoi: boolean;
}

/** Ce qu'un formulaire de securite affiche. */
interface ModeleDeFormulaire<Demande> {
  readonly bouton: string;
  readonly erreurMotDePasse: string | undefined;
  /** Un refus qui ne tient a aucun champ: tentatives, serveur. */
  readonly erreurGenerale: string | undefined;
  /** La demande a abouti: ce qu'il faut en dire. */
  readonly confirmation: string | undefined;
  /** La demande de ce formulaire attend sa reponse. */
  readonly enCours: boolean;
  /** La demande prete a partir, ou rien si la saisie ou une demande en cours l'empechent. */
  readonly envoi: Demande | undefined;
}

/** Ce que le formulaire de changement du mot de passe affiche. */
export interface ModeleChangement extends ModeleDeFormulaire<DemandeChangementMotDePasse> {
  readonly erreurNouveau: string | undefined;
  readonly aideNouveau: string;
}

/** Ce que le formulaire du nouveau code de secours affiche. */
export interface ModeleCode extends ModeleDeFormulaire<DemandeCodeDeSecours> {
  /** Ce que le formulaire dit du code. */
  readonly aide: string;
  /**
   * Le profil lu dit que le compte n'a pas de code: un compte cree avant l'etape 3.4,
   * dont un mot de passe oublie ne se retrouverait pas. Le formulaire le signale.
   */
  readonly sansCode: boolean;
}

/** Ce que dit le formulaire du code, pour un compte qui en a un. */
export const AIDE_DU_CODE =
  'Il remplace votre mot de passe si vous l’oubliez. Un nouveau code annule le précédent.';

/** Ce que dit le formulaire du code, pour un compte qui n'en a pas. */
export const AIDE_SANS_CODE =
  'Ce compte n’a pas encore de code de secours : sans lui, un mot de passe oublié ne se retrouve pas. Créez-en un.';

/** Ce que dit le profil apres un changement de mot de passe. */
export const CONFIRMATION_DU_CHANGEMENT =
  'Mot de passe changé. Vos autres appareils ont été déconnectés.';

/** Ce que dit le profil apres la creation d'un nouveau code. */
export const CONFIRMATION_DU_CODE = 'Nouveau code de secours créé. L’ancien ne vaut plus rien.';

/** Calcule le formulaire de changement du mot de passe. */
export function modeleChangementMotDePasse(
  etat: EtatClient,
  saisie: SaisieDeChangement,
): ModeleChangement {
  const suivi = suiviDeLaDemande(etat, 'motDePasse', saisie.modifieeDepuisLEnvoi);
  const verdict = validerDemandeChangementMotDePasse({
    motDePasse: saisie.motDePasse,
    nouveauMotDePasse: saisie.nouveauMotDePasse,
  });
  const fautes = verdict.valide ? [] : verdict.erreurs;

  return {
    bouton: suivi.enCours ? 'Un instant…' : 'Changer le mot de passe',
    erreurMotDePasse:
      (saisie.motDePasseVisite ? motifDu(fautes, 'motDePasse') : undefined) ??
      motifDu(suivi.refus, 'motDePasse'),
    erreurNouveau:
      (saisie.nouveauVisite ? motifDu(fautes, 'nouveauMotDePasse') : undefined) ??
      motifDu(suivi.refus, 'nouveauMotDePasse'),
    aideNouveau: `Au moins ${String(BORNES_MOT_DE_PASSE.longueur.minimum)} caractères. Vos autres appareils seront déconnectés, et vous recevrez un nouveau code de secours.`,
    erreurGenerale: motifsGeneraux(suivi.refus, ['motDePasse', 'nouveauMotDePasse']),
    confirmation: suivi.acceptee ? CONFIRMATION_DU_CHANGEMENT : undefined,
    enCours: suivi.enCours,
    envoi:
      suivi.bloquee || saisie.motDePasse === '' || !verdict.valide ? undefined : verdict.valeur,
  };
}

/** Calcule le formulaire du nouveau code de secours. */
export function modeleNouveauCode(etat: EtatClient, saisie: SaisieDeCode): ModeleCode {
  const suivi = suiviDeLaDemande(etat, 'codeDeSecours', saisie.modifieeDepuisLEnvoi);
  const verdict = validerDemandeCodeDeSecours({ motDePasse: saisie.motDePasse });
  const fautes = verdict.valide ? [] : verdict.erreurs;
  // Tant que le profil n'est pas lu, rien ne dit que le code manque.
  const sansCode = etat.profil.statut === 'charge' && !etat.profil.profil.codeDeSecours;

  return {
    aide: sansCode ? AIDE_SANS_CODE : AIDE_DU_CODE,
    sansCode,
    bouton: suivi.enCours ? 'Un instant…' : 'Créer un nouveau code',
    erreurMotDePasse:
      (saisie.motDePasseVisite ? motifDu(fautes, 'motDePasse') : undefined) ??
      motifDu(suivi.refus, 'motDePasse'),
    erreurGenerale: motifsGeneraux(suivi.refus, ['motDePasse']),
    confirmation: suivi.acceptee ? CONFIRMATION_DU_CODE : undefined,
    enCours: suivi.enCours,
    envoi:
      suivi.bloquee || saisie.motDePasse === '' || !verdict.valide ? undefined : verdict.valeur,
  };
}

/** Ou en est la demande d'un formulaire. */
interface SuiviDeLaDemande {
  /** La demande de ce formulaire attend sa reponse. */
  readonly enCours: boolean;
  /** Une demande de compte, de ce formulaire ou d'un autre, attend sa reponse. */
  readonly bloquee: boolean;
  /** Les motifs du refus de ce formulaire, s'ils concernent encore la saisie. */
  readonly refus: readonly ErreurValidation[];
  /** La demande de ce formulaire a abouti, et la saisie n'a pas change depuis. */
  readonly acceptee: boolean;
}

/** Ou en est la derniere demande de compte, vue d'un formulaire du profil. */
function suiviDeLaDemande(
  etat: EtatClient,
  nature: NatureDemandeDeCompte,
  modifiee: boolean,
): SuiviDeLaDemande {
  const demande = etat.demandeDeCompte;
  const concerne = demande.nature === nature;
  const repondue = concerne && !demande.enCours && !modifiee;

  return {
    enCours: concerne && demande.enCours,
    bloquee: demande.enCours,
    refus: repondue ? demande.erreurs : [],
    acceptee: repondue && demande.acceptee,
  };
}

/** Les motifs qui ne tiennent a aucun des champs du formulaire, joints en une phrase. */
function motifsGeneraux(
  erreurs: readonly ErreurValidation[],
  champs: readonly string[],
): string | undefined {
  const generales = erreurs.filter((erreur) => !champs.includes(erreur.champ));

  return generales.length === 0 ? undefined : generales.map((erreur) => erreur.motif).join(' ');
}

/** Les motifs portes par un champ, joints en une phrase, ou rien. */
function motifDu(erreurs: readonly ErreurValidation[], champ: string): string | undefined {
  const motifs = erreurs.filter((erreur) => erreur.champ === champ).map((erreur) => erreur.motif);

  return motifs.length === 0 ? undefined : motifs.join(' ');
}
