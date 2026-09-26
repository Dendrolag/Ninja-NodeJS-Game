/**
 * La fiche d'un joueur, sous forme de donnees (etape 3.5).
 *
 * CE QUE TOUT COMPTE CONNECTE PEUT LIRE D'UN AUTRE: son pseudo, depuis quand il a un
 * compte, son niveau, son palier et ses statistiques, les memes que celles de son
 * profil (statistiques.ts). Ni ses pieces, ni ses dernieres parties: le serveur ne les
 * envoie pas.
 *
 * UNE SUITE DE SECTIONS, POUR LA SUITE. L'identite, l'amitie et, pour un ami, les
 * parties jouees ensemble (etape 3.6), les statistiques, puis le tableau par mode; la
 * section des succes (etapes 3.7 et 3.8) viendra s'y ajouter.
 *
 * FONCTION PURE. Le client met en forme ce que le serveur a lu.
 */

import type { FaceAFace, FicheJoueur, LieuDUnAmi } from '@neon-ninja/shared';

import type { EtatClient, EtatDuGeste } from '../../etat.js';
import type { GestePropose } from './amis.js';
import { gesteSur, gestesDeLaRelation, modeleDuGeste, phraseDeLaRelation } from './amis.js';
import type { PresenceAffichee } from './presence.js';
import { lieuDe, presenceAffichee } from './presence.js';
import { formaterInscription } from './profil.js';
import { NOMS_DES_PALIERS } from './progression.js';
import { formaterNombre } from './progression.js';
import { initiales } from './salon.js';
import type { LigneDUnMode, StatistiqueAffichee } from './statistiques.js';
import { lignesParMode, tuilesDesStatistiques } from './statistiques.js';

/** Ce que la fenetre de la fiche affiche. */
export type ModeleFiche =
  /** Aucune fiche n'est ouverte: la fenetre est fermee. */
  | { readonly nature: 'fermee' }
  /** La fiche de ce joueur se lit. */
  | { readonly nature: 'chargement'; readonly pseudo: string }
  /** La fiche de ce joueur n'a pas pu etre lue. */
  | { readonly nature: 'echec'; readonly pseudo: string; readonly motif: string }
  | {
      readonly nature: 'chargee';
      /** Le pseudo, dans l'ecriture du compte. */
      readonly pseudo: string;
      readonly initiales: string;
      /** « Niveau 12 ». */
      readonly niveau: string;
      /** « Argent ». */
      readonly palier: string;
      /** « Membre depuis le 11 septembre 2026 ». */
      readonly inscription: string;
      readonly statistiques: readonly StatistiqueAffichee[];
      /** Les modes joues, dans l'ordre des modes du jeu. Vide sans partie. */
      readonly parMode: readonly LigneDUnMode[];
      /** L'amitie avec ce compte (etape 3.6). Absente sur sa propre fiche. */
      readonly amitie?: ModeleAmitie;
      /** Les parties jouees ensemble, pour un ami, et pour lui seul (etape 3.6). */
      readonly ensemble?: readonly StatistiqueAffichee[];
    };

/** La section Amitie de la fiche (etape 3.6). */
export interface ModeleAmitie {
  /** « Vous êtes amis. » Absente quand il n'y a aucune relation. */
  readonly phrase: string | undefined;
  /** Ou est cet ami (etape 2.8). Absente pour qui n'est pas ami. */
  readonly presence?: PresenceAffichee;
  readonly gestes: readonly GestePropose[];
  /** Un geste sur ce compte attend sa reponse: les boutons ne repartent pas. */
  readonly enCours: boolean;
  /** Pourquoi le dernier geste sur ce compte a ete refuse. */
  readonly erreur: string | undefined;
}

/** Calcule la fenetre de la fiche. */
export function modeleFiche(etat: EtatClient): ModeleFiche {
  const fiche = etat.fiche;

  switch (fiche.statut) {
    case 'fermee':
      return { nature: 'fermee' };

    case 'chargement':
      return { nature: 'chargement', pseudo: fiche.pseudo };

    case 'echec':
      return { nature: 'echec', pseudo: fiche.pseudo, motif: fiche.motif };

    case 'chargee':
      return ficheChargee(fiche.fiche, etat.amis.geste, lieuDe(etat, fiche.fiche.pseudo));
  }
}

/** La fiche lue, mise en forme, avec le dernier geste d'amitie s'il la concerne. */
function ficheChargee(
  fiche: FicheJoueur,
  geste: EtatDuGeste,
  lieu: LieuDUnAmi | undefined,
): ModeleFiche {
  const dernier = modeleDuGeste(gesteSur(geste, fiche.pseudo));

  return {
    nature: 'chargee',
    pseudo: fiche.pseudo,
    initiales: initiales(fiche.pseudo),
    niveau: `Niveau ${String(fiche.niveau)}`,
    palier: NOMS_DES_PALIERS[fiche.palier],
    inscription: formaterInscription(fiche.inscritLe),
    statistiques: tuilesDesStatistiques(fiche.statistiques),
    parMode: lignesParMode(fiche.statistiques),
    ...(fiche.relation === 'soi'
      ? {}
      : {
          amitie: {
            phrase: phraseDeLaRelation(fiche.relation),
            ...(fiche.relation === 'ami' ? { presence: presenceAffichee(lieu) } : {}),
            gestes: gestesDeLaRelation(fiche.relation),
            enCours: dernier.enCours,
            erreur: dernier.erreur,
          },
        }),
    ...(fiche.relation === 'ami' && fiche.ensemble !== undefined
      ? { ensemble: tuilesDEnsemble(fiche.pseudo, fiche.ensemble) }
      : {}),
  };
}

/**
 * Les parties jouees ensemble: combien, et qui a fini devant l'autre. Le pseudo, et non
 * « lui »: la fiche ne genre personne.
 */
function tuilesDEnsemble(pseudo: string, ensemble: FaceAFace): readonly StatistiqueAffichee[] {
  return [
    { libelle: 'Parties ensemble', valeur: formaterNombre(ensemble.partiesEnsemble) },
    { libelle: 'Vous devant', valeur: formaterNombre(ensemble.devant) },
    { libelle: `${pseudo} devant`, valeur: formaterNombre(ensemble.derriere) },
  ];
}
