/**
 * Les amis, sous forme de donnees (etape 3.6): l'ecran Amis, la pastille de la
 * navigation, et les gestes que la fiche d'un joueur propose.
 *
 * LES GESTES PROPOSES SUIVENT LA RELATION, telle que le serveur l'a dite: on ne propose
 * pas d'ajouter un ami, ni d'accepter une demande qui n'existe pas. Le serveur decide
 * de toute facon; le client ne propose que ce qui a un sens.
 *
 * AUCUNE FORMULE NE GENRE LE JOUEUR: « ce compte », le pseudo, jamais « il » ni « lui ».
 *
 * FONCTIONS PURES.
 */

import type { GesteDAmitie, ListeDAmis, PersonneListee, RelationDAmitie } from '@neon-ninja/shared';
import { BORNES_AMITIES, reperePseudo } from '@neon-ninja/shared';

import type { EtatClient, EtatDuGeste } from '../../etat.js';
import { formaterNombre } from './progression.js';
import { initiales } from './salon.js';

/**
 * Ce qu'un bouton de geste est: le geste principal de la relation, un geste
 * secondaire, ou un geste qui defait (retirer, bloquer), tenu a part.
 */
export type NatureDUnGeste = 'principal' | 'secondaire' | 'defait';

/** Un geste propose, tel qu'on l'affiche. */
export interface GestePropose {
  readonly geste: GesteDAmitie;
  readonly libelle: string;
  readonly nature: NatureDUnGeste;
}

/** Les libelles des gestes, sur les boutons. */
const LIBELLES: Readonly<Record<GesteDAmitie, string>> = {
  demander: 'Ajouter en ami',
  accepter: 'Accepter',
  refuser: 'Refuser',
  annuler: 'Annuler la demande',
  retirer: 'Retirer des amis',
  bloquer: 'Bloquer',
  debloquer: 'Débloquer',
};

/** Un geste propose, avec son libelle. */
function propose(geste: GesteDAmitie, nature: NatureDUnGeste): GestePropose {
  return { geste, libelle: LIBELLES[geste], nature };
}

/** Les gestes que la fiche propose pour cette relation. Aucun sur son propre compte. */
export function gestesDeLaRelation(relation: RelationDAmitie): readonly GestePropose[] {
  switch (relation) {
    case 'soi':
      return [];
    case 'aucune':
      return [propose('demander', 'principal'), propose('bloquer', 'defait')];
    case 'demandeEnvoyee':
      return [propose('annuler', 'secondaire'), propose('bloquer', 'defait')];
    case 'demandeRecue':
      return [
        propose('accepter', 'principal'),
        propose('refuser', 'secondaire'),
        propose('bloquer', 'defait'),
      ];
    case 'ami':
      return [propose('retirer', 'defait'), propose('bloquer', 'defait')];
    case 'bloque':
      return [propose('debloquer', 'secondaire')];
  }
}

/** Ce que la fiche dit de la relation, en une phrase. Rien quand il n'y en a pas. */
export function phraseDeLaRelation(relation: RelationDAmitie): string | undefined {
  switch (relation) {
    case 'ami':
      return 'Vous êtes amis.';
    case 'demandeEnvoyee':
      return 'Demande envoyée, en attente de réponse.';
    case 'demandeRecue':
      return 'Ce compte vous demande d’être amis.';
    case 'bloque':
      return 'Vous avez bloqué ce compte : ses demandes sont ignorées.';
    case 'soi':
    case 'aucune':
      return undefined;
  }
}

/** Ce qu'un geste fait annonce au joueur. */
export function annonceDuGeste(
  geste: GesteDAmitie,
  pseudo: string,
  relation: RelationDAmitie,
): string {
  if (relation === 'ami' && (geste === 'demander' || geste === 'accepter')) {
    return `${pseudo} et vous êtes amis.`;
  }

  switch (geste) {
    case 'demander':
      return `Votre demande à ${pseudo} est envoyée.`;
    case 'accepter':
      return `${pseudo} et vous êtes amis.`;
    case 'refuser':
      return `Demande de ${pseudo} refusée.`;
    case 'annuler':
      return `Demande à ${pseudo} annulée.`;
    case 'retirer':
      return `${pseudo} ne fait plus partie de vos amis.`;
    case 'bloquer':
      return `Compte de ${pseudo} bloqué.`;
    case 'debloquer':
      return `Compte de ${pseudo} débloqué.`;
  }
}

/** Le dernier geste, s'il visait ce pseudo, quelle que soit son ecriture. */
export function gesteSur(geste: EtatDuGeste, pseudo: string): EtatDuGeste {
  return geste.statut !== 'aucun' && reperePseudo(geste.pseudo) === reperePseudo(pseudo)
    ? geste
    : { statut: 'aucun' };
}

/** Le nombre de demandes recues, pour la pastille de la navigation. Zero pour un invite. */
export function demandesEnAttente(etat: EtatClient): number {
  return etat.session.nature === 'compte' ? (etat.amis.liste?.recues.length ?? 0) : 0;
}

// --------------------------------------------------------------------------
// L'ecran Amis
// --------------------------------------------------------------------------

/** Un compte d'une liste de l'ecran Amis, tel qu'on l'affiche. */
export interface LigneDAmi {
  readonly pseudo: string;
  readonly initiales: string;
  /** « Niv. 4 ». */
  readonly niveau: string;
  readonly gestes: readonly GestePropose[];
}

/** Une section de l'ecran Amis. */
export interface SectionDAmis {
  readonly titre: string;
  readonly lignes: readonly LigneDAmi[];
  /** Ce que la section dit quand elle est vide. Absent: la section vide se cache. */
  readonly vide?: string;
}

/** Ce que l'ecran Amis affiche. */
export type ModeleAmis =
  /** La premiere liste se lit. */
  | { readonly nature: 'chargement' }
  /** La premiere liste n'a pas pu etre lue. */
  | { readonly nature: 'echec'; readonly motif: string }
  | {
      readonly nature: 'chargee';
      /** Demandes recues, amis, demandes envoyees, comptes bloques, dans cet ordre. */
      readonly recues: SectionDAmis;
      readonly amis: SectionDAmis;
      readonly envoyees: SectionDAmis;
      readonly bloques: SectionDAmis;
      /** « 3 sur 200 ». */
      readonly compte: string;
    };

/** Ce que le formulaire d'ajout et le dernier geste affichent. */
export interface ModeleDuGeste {
  /** Un geste attend sa reponse: les boutons ne repartent pas. */
  readonly enCours: boolean;
  /** Ce que le dernier geste a fait, annonce au joueur. */
  readonly annonce: string | undefined;
  /** Pourquoi le dernier geste a ete refuse. */
  readonly erreur: string | undefined;
}

/** Ce que dit le dernier geste, ou qu'il attend. */
export function modeleDuGeste(geste: EtatDuGeste): ModeleDuGeste {
  switch (geste.statut) {
    case 'aucun':
      return { enCours: false, annonce: undefined, erreur: undefined };
    case 'enCours':
      return { enCours: true, annonce: undefined, erreur: undefined };
    case 'fait':
      return {
        enCours: false,
        annonce: annonceDuGeste(geste.geste, geste.pseudo, geste.relation),
        erreur: undefined,
      };
    case 'refuse':
      return { enCours: false, annonce: undefined, erreur: geste.motif };
  }
}

/** Calcule l'ecran Amis. */
export function modeleAmis(etat: EtatClient): ModeleAmis {
  const { liste, motifDEchec } = etat.amis;

  if (liste === undefined) {
    return motifDEchec === undefined
      ? { nature: 'chargement' }
      : { nature: 'echec', motif: motifDEchec };
  }

  return listeChargee(liste);
}

/** La liste lue, mise en forme. */
function listeChargee(liste: ListeDAmis): ModeleAmis {
  const lignes = (
    personnes: readonly PersonneListee[],
    gestes: readonly GestePropose[],
  ): readonly LigneDAmi[] =>
    personnes.map((personne) => ({
      pseudo: personne.pseudo,
      initiales: initiales(personne.pseudo),
      niveau: `Niv. ${String(personne.niveau)}`,
      gestes,
    }));

  return {
    nature: 'chargee',
    recues: {
      titre: 'Demandes reçues',
      lignes: lignes(liste.recues, [
        propose('accepter', 'principal'),
        propose('refuser', 'secondaire'),
        propose('bloquer', 'defait'),
      ]),
    },
    amis: {
      titre: 'Amis',
      lignes: lignes(liste.amis, []),
      vide: 'Aucun ami pour l’instant. Ajoutez un joueur par son pseudo, ou depuis sa fiche, au salon ou à la fin d’une partie.',
    },
    envoyees: {
      titre: 'Demandes envoyées',
      lignes: lignes(liste.envoyees, [propose('annuler', 'secondaire')]),
    },
    bloques: {
      titre: 'Comptes bloqués',
      lignes: lignes(liste.bloques, [propose('debloquer', 'secondaire')]),
    },
    compte: `${formaterNombre(liste.amis.length)} sur ${formaterNombre(BORNES_AMITIES.amisMaximum)}`,
  };
}
