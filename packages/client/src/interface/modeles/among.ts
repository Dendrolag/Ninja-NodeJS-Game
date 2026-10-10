/**
 * Les ecrans d'Among Ninjas poses par-dessus la carte (etape 7.20): la revelation du role, la
 * reunion et son vote, l'ejection, et le chat des fantomes. Le modele seul: ce qu'il faut
 * montrer, calcule a partir de l'etat du client. Le composant (composants/among.ts) le pose.
 *
 * Rendus choisis par le porteur du projet sur la planche docs/design/etape-7-20/1-planche.png:
 * la revelation en rangee de tous les joueurs (C), la reunion en table ronde autour du gong
 * (B, les votes en traits colores a ameliorer), l'ejection dans une bouche d'egout neon (B).
 *
 * LE SECRET. Rien ici ne dit le role d'un autre joueur, sauf a un assassin, qui connait les
 * siens. Une ejection ne dit jamais le role de l'ejecte.
 *
 * LE MOT DU JOUEUR EST « EXECUTION » (decision du porteur du projet du 10 octobre 2026, plus
 * dans le theme des ninjas), comme il est « Assassin »: le code garde `ejection` et `ejecte`.
 */

import type { MotifDeReunion } from '@neon-ninja/shared';
import { nomDeCouleur } from '@neon-ninja/shared';

import type { EtatClient } from '../../etat.js';

/** Un joueur tel que les ecrans du mode le montrent. */
export interface JoueurAmongVu {
  readonly id: string;
  readonly pseudo: string;
  readonly couleur: string;
  /** Le nom de sa couleur: « Orange ». */
  readonly nomCouleur: string;
  readonly moi: boolean;
  /** Mort, de ce que tout le monde sait: annonce en reunion, ou ejecte. */
  readonly mort: boolean;
  /** Pour un assassin: un des siens, lui compris. Faux pour tout autre spectateur. */
  readonly complice: boolean;
  /** Il a deja vote, pendant le vote. */
  readonly aVote: boolean;
  /** Les voix qu'il a recues, une fois le vote clos. */
  readonly voix: number;
}

/** Un trait de vote, une fois le vote clos et s'il n'est pas anonyme: de qui, vers qui. */
export interface TraitDeVote {
  readonly de: string;
  /** Un joueur, ou null pour « passer ». */
  readonly vers: string | null;
}

/** Ce que les ecrans du mode montrent a un instant donne. */
export type EcranAmong =
  | { readonly ecran: 'aucun' }
  | {
      /** La revelation attend que chacun ait charge la carte (etape 7.20). */
      readonly ecran: 'chargement';
      readonly titre: string;
      readonly consigne: string;
    }
  | {
      readonly ecran: 'revelation';
      readonly assassin: boolean;
      readonly titre: string;
      readonly consigne: string;
      readonly joueurs: readonly JoueurAmongVu[];
    }
  | {
      readonly ecran: 'reunion';
      readonly titre: string;
      readonly phase: 'discussion' | 'vote';
      readonly temps: string;
      readonly joueurs: readonly JoueurAmongVu[];
      /** Nous pouvons voter: vivants, pendant le vote, pas encore vote. */
      readonly peutVoter: boolean;
      /** Notre vote, s'il est fait: un joueur, ou null pour passer. */
      readonly monVote: string | null | undefined;
    }
  | {
      readonly ecran: 'ejection';
      readonly texte: string;
      readonly detail: string;
      readonly ejecte: JoueurAmongVu | undefined;
      readonly joueurs: readonly JoueurAmongVu[];
      readonly traits: readonly TraitDeVote[];
      /** Les voix pour passer, que « Passer » porte comme une place. */
      readonly voixPourPasser: number;
    };

/** Le temps d'une phase, en secondes arrondies vers le haut: « 0:42 ». */
function temps(millisecondes: number): string {
  const secondes = Math.max(Math.ceil(millisecondes / 1000), 0);

  return `${String(Math.floor(secondes / 60))}:${String(secondes % 60).padStart(2, '0')}`;
}

/** Les joueurs de la partie, dans l'ordre du classement recu, tels que les ecrans les montrent. */
export function joueursAmong(etat: EtatClient): readonly JoueurAmongVu[] {
  const prive = etat.among.prive;
  const reunion = etat.among.reunion;
  const assassin = prive?.role === 'tueur';
  const decompte = reunion?.resultat?.decompte ?? [];

  return (etat.partie?.classement ?? []).map((ligne) => ({
    id: ligne.id,
    pseudo: ligne.pseudo,
    couleur: ligne.couleur,
    nomCouleur: nomDeCouleur(ligne.couleur) ?? ligne.pseudo,
    moi: ligne.id === etat.moi,
    mort: etat.among.morts.includes(ligne.id) || (ligne.id === etat.moi && prive?.fantome === true),
    complice: assassin && (ligne.id === etat.moi || (prive?.complices ?? []).includes(ligne.id)),
    aVote: reunion?.votants.includes(ligne.id) === true,
    voix: decompte.find((option) => option.cible === ligne.id)?.voix ?? 0,
  }));
}

/** Le titre d'une reunion: ce qui l'a ouverte. */
function titreDeReunion(
  motif: MotifDeReunion,
  par: string | undefined,
  cadavre: string | undefined,
  joueurs: readonly JoueurAmongVu[],
): string {
  const nom = (id: string | undefined): string =>
    joueurs.find((joueur) => joueur.id === id)?.pseudo ?? 'quelqu’un';

  switch (motif) {
    case 'cadavre':
      return `${nom(par)} a trouvé le corps de ${nom(cadavre)}`;
    case 'gong':
      return `${nom(par)} a sonné le gong`;
    case 'temps':
      return 'Le temps du tour est écoulé';
  }
}

/** Ce que les ecrans du mode montrent maintenant. */
export function ecranAmong(etat: EtatClient): EcranAmong {
  const partie = etat.partie;
  const phase = partie?.among?.phase;
  const prive = etat.among.prive;

  if (etat.salon?.mode !== 'among' || phase === undefined || prive === undefined) {
    return { ecran: 'aucun' };
  }

  const joueurs = joueursAmong(etat);
  const reunion = etat.among.reunion;

  if (phase === 'chargement') {
    return {
      ecran: 'chargement',
      titre: 'Préparation de la partie',
      consigne: 'En attente des autres joueurs…',
    };
  }

  if (phase === 'revelation') {
    const assassin = prive.role === 'tueur';

    return {
      ecran: 'revelation',
      assassin,
      titre: assassin ? 'Tu es un ASSASSIN' : 'Tu es une PROIE',
      consigne: assassin
        ? 'Élimine les proies au contact, sans te faire voir.'
        : 'Fais tes tâches, et démasque les assassins.',
      joueurs,
    };
  }

  if ((phase === 'discussion' || phase === 'vote') && reunion !== undefined) {
    const vivant = !prive.fantome;

    return {
      ecran: 'reunion',
      titre: titreDeReunion(reunion.motif, reunion.par, reunion.cadavre, joueurs),
      phase,
      temps: temps(partie?.among?.restantMs ?? 0),
      joueurs,
      peutVoter:
        phase === 'vote' &&
        vivant &&
        reunion.monVote === undefined &&
        !reunion.votants.includes(etat.moi ?? ''),
      monVote: reunion.monVote,
    };
  }

  if (phase === 'ejection' && reunion?.resultat !== undefined) {
    const resultat = reunion.resultat;
    const ejecte = joueurs.find((joueur) => joueur.id === resultat.ejecte);
    const passer = resultat.decompte.find((option) => option.cible === null)?.voix ?? 0;
    const voix = resultat.decompte
      .filter((option) => option.cible !== null)
      .map(
        (option) =>
          `${joueurs.find((joueur) => joueur.id === option.cible)?.pseudo ?? '?'} ${String(option.voix)}`,
      );

    return {
      ecran: 'ejection',
      // Jamais le role de l'ejecte (decision du porteur du projet du 6 octobre 2026).
      texte:
        ejecte === undefined
          ? 'Personne n’a été exécuté.'
          : `${ejecte.pseudo} (${ejecte.nomCouleur}) a été exécuté.`,
      detail: [...voix, `passer ${String(passer)}`].join(' · '),
      ejecte,
      joueurs,
      traits:
        resultat.votes === undefined
          ? []
          : Object.entries(resultat.votes).map(([de, vers]) => ({ de, vers })),
      voixPourPasser: passer,
    };
  }

  return { ecran: 'aucun' };
}

/** Le chat des fantomes se montre-t-il: a un fantome, pendant le jeu. */
export function chatDesFantomes(etat: EtatClient): boolean {
  return (
    etat.salon?.mode === 'among' &&
    etat.among.prive?.fantome === true &&
    etat.partie?.among?.phase === 'jeu'
  );
}
