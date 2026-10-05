/**
 * Les notes de version (etape 4.9): ce qu'une version mineure apporte de nouveau.
 *
 * UNE NOTE PAR VERSION MINEURE. Le deuxieme chiffre du numero avance pour une
 * nouveaute majeure, et s'accompagne toujours d'une note (regle ecrite a cote du
 * numero, dans packages/shared/src/version.ts). Un correctif garde la note de sa
 * version mineure: 1.5.2 rouvre la note 1.5.
 *
 * CE SONT DES DONNEES, que la fenetre des nouveautes se contente d'afficher. Ajouter la
 * note 1.8, c'est ajouter une entree a cette liste, sans toucher a la fenetre.
 *
 * LE TON, arrete avec le porteur du projet le 5 octobre 2026: une note annonce, elle
 * n'explique pas. Une ligne par nouveaute, un ton un peu decale, et le plaisir de la
 * decouverte laisse au joueur: les regles exactes sont dans l'aide. Chaque note porte
 * un titre a elle, que la fenetre ecrit derriere son numero. Les textes des notes 1.5
 * a 1.7 sont ceux de ce jour-la.
 */

import { versionMineure } from '@neon-ninja/shared';

/** Une ligne de la note: un intitule en gras, s'il y en a un, puis le texte. */
export interface PuceDeNote {
  readonly intitule?: string;
  readonly texte: string;
}

/** La note d'une version mineure. */
export interface NoteDeVersion {
  /** La version mineure annoncee, « 1.5 ». */
  readonly version: string;
  /** Son titre, « Coups fourrés », que la fenetre ecrit « 1.5 · Coups fourrés ». */
  readonly titre: string;
  readonly puces: readonly PuceDeNote[];
}

/** Toutes les notes, de la plus ancienne a la plus recente. */
export const NOTES_DE_VERSION: readonly NoteDeVersion[] = [
  {
    version: '1.5',
    titre: 'Coups fourrés',
    puces: [
      {
        intitule: 'La poche.',
        texte:
          'Ramassez un objet et utilisez-le quand vous le voulez avec la touche E, ou le bouton sur smartphone.',
      },
      {
        intitule: 'La fumée.',
        texte: 'Pouf. Un bon ninja sait disparaître au bon moment.',
      },
      {
        intitule: 'La mine.',
        texte:
          'Posez-la, éloignez-vous, attendez. Un bon ninja sait tout faire péter au bon moment.',
      },
      {
        intitule: 'Les mines de zone.',
        texte: 'Activez des zones avec différents effets, soyez stratégique !',
      },
      {
        intitule: 'L’Évadé.',
        texte: 'Un ninja au style particulier cherche à vous échapper, attrapez-le pour voir…',
      },
    ],
  },
  {
    version: '1.6',
    titre: 'On a marché sur la Lune',
    puces: [
      {
        intitule: 'La Station lunaire.',
        texte: 'Une nouvelle carte en zone réduite pour un concentré d’action.',
      },
      {
        intitule: 'Jour ou nuit.',
        texte: 'Deux ambiances au choix.',
      },
      {
        intitule: 'Un vaisseau.',
        texte: 'Utilisez à bon escient le vaisseau pour vous camoufler de vos adversaires.',
      },
    ],
  },
  {
    version: '1.7',
    titre: 'Le lundi, c’est défis',
    puces: [
      {
        intitule: 'Trois défis par semaine.',
        texte: 'Les mêmes pour tout le monde, renouvelés chaque lundi.',
      },
      {
        intitule: 'De l’XP en rab.',
        texte: 'Jusqu’à 1 200 de plus par semaine. De quoi laisser vos amis derrière.',
      },
      {
        texte:
          'Pour les joueurs connectés, sur des parties d’au moins trois minutes jouées jusqu’au bout.',
      },
    ],
  },
];

/** La note de la version mineure d'un numero, s'il y en a une. */
export function noteDeLaVersion(
  numero: string,
  notes: readonly NoteDeVersion[] = NOTES_DE_VERSION,
): NoteDeVersion | undefined {
  const mineure = versionMineure(numero);

  return notes.find((note) => note.version === mineure);
}

/**
 * Les notes parues jusqu'a ce numero, la plus recente en tete: l'historique que la
 * fenetre des nouveautes fait defiler. Une note d'une version a venir n'y est pas.
 */
export function notesParues(
  numero: string,
  notes: readonly NoteDeVersion[] = NOTES_DE_VERSION,
): readonly NoteDeVersion[] {
  const courante = chiffres(versionMineure(numero));

  return notes
    .filter((note) => comparer(chiffres(note.version), courante) <= 0)
    .sort((a, b) => comparer(chiffres(b.version), chiffres(a.version)));
}

/** Les chiffres d'une version, « 1.10 » donnant [1, 10]: 1.10 vient apres 1.9. */
function chiffres(version: string): readonly number[] {
  return version.split('.').map(Number);
}

/** Negatif si a precede b, nul si elles sont egales, positif sinon. */
function comparer(a: readonly number[], b: readonly number[]): number {
  for (let rang = 0; rang < Math.max(a.length, b.length); rang += 1) {
    const ecart = (a[rang] ?? 0) - (b[rang] ?? 0);

    if (ecart !== 0) {
      return ecart;
    }
  }

  return 0;
}
