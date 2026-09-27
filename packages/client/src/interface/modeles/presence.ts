/**
 * La presence des amis et les invitations, sous forme de donnees (etape 2.8): ce que
 * dit la ligne d'un ami, les cartes d'invitation au-dessus des menus, et la section
 * « Inviter des amis » du salon.
 *
 * TOUT VIENT DU SERVEUR. La presence est la liste qu'il a poussee, les invitations
 * recues sont celles qu'il tient: ces fonctions ne font que les mettre en mots. Une
 * partie privee n'y est jamais decrite au-dela de « privee », puisque le serveur n'en
 * dit pas plus.
 *
 * AUCUNE FORMULE NE GENRE LE JOUEUR: « Alice vous invite », « Invitation envoyée à Bob ».
 *
 * FONCTIONS PURES.
 */

import type { InvitationRecue, LieuDUnAmi, PartieDUnAmi } from '@neon-ninja/shared';
import { reperePseudo } from '@neon-ninja/shared';

import { estUnEcranDeMenu } from '../../ecrans.js';
import type { EtatClient, InvitationDuSalon } from '../../etat.js';
import { NOMS_DES_MODES } from './cartes.js';
import { initiales } from './salon.js';

/** L'etat d'un ami, pour la pastille de couleur de sa ligne. */
export type EtatDePresence = 'horsLigne' | LieuDUnAmi['etat'];

/** La presence d'un ami, telle qu'on l'affiche. */
export interface PresenceAffichee {
  readonly etat: EtatDePresence;
  /** « En ligne », « Dans un salon · Horde · 3 sur 12 ». */
  readonly texte: string;
}

/** Le lieu de l'ami qui porte ce pseudo, ou undefined s'il est hors ligne. */
export function lieuDe(etat: EtatClient, pseudo: string): LieuDUnAmi | undefined {
  const repere = reperePseudo(pseudo);

  return etat.presences.find((presence) => reperePseudo(presence.pseudo) === repere)?.lieu;
}

/** Ce que dit la presence d'un ami, en une ligne. */
export function presenceAffichee(lieu: LieuDUnAmi | undefined): PresenceAffichee {
  if (lieu === undefined) {
    return { etat: 'horsLigne', texte: 'Hors ligne' };
  }

  switch (lieu.etat) {
    case 'enLigne':
      return { etat: 'enLigne', texte: 'En ligne' };
    case 'salon':
      return {
        etat: 'salon',
        texte:
          lieu.partie.visibilite === 'privee'
            ? 'Dans le salon d’une partie privée'
            : `Dans un salon · ${descriptionPublique(lieu.partie)}`,
      };
    case 'enPartie':
      return {
        etat: 'enPartie',
        texte:
          lieu.partie.visibilite === 'privee'
            ? 'En partie privée'
            : `En partie · ${NOMS_DES_MODES[lieu.partie.mode]}`,
      };
  }
}

/**
 * La partie qu'on peut rejoindre d'un clic depuis la ligne d'un ami: le salon d'une
 * partie publique qui a de la place. Ni une partie lancee, que la liste des parties ne
 * propose pas non plus, ni une partie privee, qui demande une invitation.
 */
export function partieARejoindre(lieu: LieuDUnAmi | undefined): string | undefined {
  if (lieu?.etat !== 'salon' || lieu.partie.visibilite !== 'publique') {
    return undefined;
  }

  return lieu.partie.joueurs < lieu.partie.capacite ? lieu.partie.idRoom : undefined;
}

/** L'ordre des amis par presence: ceux qu'on peut rejoindre d'abord, les absents a la fin. */
export const RANG_DE_PRESENCE: Readonly<Record<EtatDePresence, number>> = {
  salon: 0,
  enLigne: 1,
  enPartie: 2,
  horsLigne: 3,
};

// --------------------------------------------------------------------------
// Les cartes d'invitation, au-dessus des menus
// --------------------------------------------------------------------------

/** Une invitation recue, telle que sa carte l'affiche. */
export interface CarteDInvitation {
  readonly id: string;
  /** « Alice vous invite ». */
  readonly titre: string;
  /** « Horde · partie privée · 2 sur 12 ». */
  readonly detail: string;
  /** Rejoindre est possible: un lien etabli, et aucune entree en attente. */
  readonly peutRejoindre: boolean;
  /** Pourquoi la derniere entree par cette invitation a ete refusee. */
  readonly erreur: string | undefined;
}

/**
 * Les cartes d'invitation a montrer, de la plus recente a la plus ancienne.
 *
 * AUCUNE PENDANT UNE PARTIE (etude des amis, 4.4): ni au salon, ni en jeu, ni a la fin.
 * Elles attendent le retour aux menus, si elles valent encore: le serveur retire celles
 * qui ne valent plus.
 */
export function cartesDInvitation(etat: EtatClient): readonly CarteDInvitation[] {
  if (!estUnEcranDeMenu(etat.ecran) || etat.session.nature !== 'compte') {
    return [];
  }

  const { recues, tentee } = etat.invitationsDAmis;
  const refus = etat.refus?.action === 'rejoindre' ? etat.refus : undefined;
  const peutRejoindre = etat.connexion === 'connecte' && !etat.entreeEnCours;

  return [...recues].reverse().map((invitation) => ({
    id: invitation.id,
    titre: `${invitation.de} vous invite`,
    detail: detailDeLInvitation(invitation),
    peutRejoindre,
    erreur:
      refus !== undefined && tentee === invitation.id
        ? refus.erreurs.map((erreur) => erreur.motif).join(' ')
        : undefined,
  }));
}

/** Ce que l'invitation dit de la partie. */
function detailDeLInvitation(invitation: InvitationRecue): string {
  const morceaux = [
    NOMS_DES_MODES[invitation.mode],
    ...(invitation.visibilite === 'privee' ? ['partie privée'] : []),
    `${String(invitation.joueurs)} sur ${String(invitation.capacite)}`,
  ];

  return morceaux.join(' · ');
}

// --------------------------------------------------------------------------
// La section « Inviter des amis » du salon
// --------------------------------------------------------------------------

/** Un ami a inviter, tel que la section du salon l'affiche. */
export interface AmiAInviter {
  readonly pseudo: string;
  readonly initiales: string;
  readonly presence: PresenceAffichee;
  /** « Inviter », « Réinviter ». */
  readonly libelle: string;
  /** Une invitation a cet ami attend la reponse du serveur. */
  readonly enCours: boolean;
  /** Ce qu'il en est de la derniere invitation a cet ami: partie, ou refusee. */
  readonly note: string | undefined;
  /** La note dit un refus. */
  readonly refusee: boolean;
}

/** Ce que la section « Inviter des amis » affiche. */
export interface ModeleInvitationsDuSalon {
  readonly amis: readonly AmiAInviter[];
  /** Ce que la section dit quand aucun ami n'est a inviter. */
  readonly vide: string;
  /** Le lien est etabli: les boutons peuvent servir. */
  readonly lienEtabli: boolean;
}

/**
 * La section « Inviter des amis » du salon, ou undefined pour un invite, qui n'a pas
 * d'amis.
 *
 * Elle liste les amis en ligne qui ne sont pas deja dans la partie, dans l'ordre de la
 * presence. Un ami deja invite peut l'etre de nouveau: le serveur dit s'il est trop
 * tot.
 */
export function modeleInvitationsDuSalon(etat: EtatClient): ModeleInvitationsDuSalon | undefined {
  if (etat.session.nature !== 'compte') {
    return undefined;
  }

  const presents = new Set(
    (etat.salon?.joueurs ?? []).map((joueur) => reperePseudo(joueur.pseudo)),
  );
  const envoyees = etat.invitationsDAmis.envoyees;

  const amis = etat.presences
    .filter((presence) => !presents.has(reperePseudo(presence.pseudo)))
    .map((presence) => ({ presence, affichee: presenceAffichee(presence.lieu) }))
    .sort(
      (a, b) =>
        RANG_DE_PRESENCE[a.affichee.etat] - RANG_DE_PRESENCE[b.affichee.etat] ||
        reperePseudo(a.presence.pseudo).localeCompare(reperePseudo(b.presence.pseudo)),
    )
    .map(({ presence, affichee }) =>
      amiAInviter(presence.pseudo, affichee, envoyeeA(envoyees, presence.pseudo)),
    );

  const aucunAmi = (etat.amis.liste?.amis.length ?? 0) === 0;

  return {
    amis,
    vide: aucunAmi
      ? 'Ajoutez des amis depuis l’écran Amis pour les inviter ici.'
      : 'Aucun ami en ligne pour l’instant.',
    lienEtabli: etat.connexion === 'connecte',
  };
}

/** L'invitation envoyee a ce pseudo, s'il y en a une. */
function envoyeeA(
  envoyees: readonly InvitationDuSalon[],
  pseudo: string,
): InvitationDuSalon | undefined {
  const repere = reperePseudo(pseudo);

  return envoyees.find((envoyee) => reperePseudo(envoyee.pseudo) === repere);
}

/** Un ami a inviter, avec ce qu'il en est de la derniere invitation qu'on lui a faite. */
function amiAInviter(
  pseudo: string,
  presence: PresenceAffichee,
  envoyee: InvitationDuSalon | undefined,
): AmiAInviter {
  const commun = { pseudo, initiales: initiales(pseudo), presence };

  switch (envoyee?.statut) {
    case undefined:
      return { ...commun, libelle: 'Inviter', enCours: false, note: undefined, refusee: false };
    case 'enCours':
      return { ...commun, libelle: 'Inviter', enCours: true, note: undefined, refusee: false };
    case 'envoyee':
      return {
        ...commun,
        libelle: 'Réinviter',
        enCours: false,
        note: 'Invitation envoyée.',
        refusee: false,
      };
    case 'refusee':
      return { ...commun, libelle: 'Inviter', enCours: false, note: envoyee.motif, refusee: true };
  }
}

/** Ce qu'une ligne d'ami dit d'une partie publique: mode, joueurs, capacite. */
function descriptionPublique(partie: Extract<PartieDUnAmi, { visibilite: 'publique' }>): string {
  return `${NOMS_DES_MODES[partie.mode]} · ${String(partie.joueurs)} sur ${String(partie.capacite)}`;
}
