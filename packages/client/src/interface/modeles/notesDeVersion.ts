/**
 * Les notes de version (etape 4.9): ce qu'une version mineure apporte de nouveau.
 *
 * UNE NOTE PAR VERSION MINEURE. Le deuxieme chiffre du numero avance pour une
 * nouveaute majeure, et s'accompagne toujours d'une note (regle ecrite a cote du
 * numero, dans packages/shared/src/version.ts). Un correctif garde la note de sa
 * version mineure: 1.5.2 rouvre la note 1.5.
 *
 * CE SONT DES DONNEES, que la fenetre de la note se contente d'afficher. Ajouter la
 * note 1.6, c'est ajouter une entree a cette liste, sans toucher a la fenetre.
 *
 * LE TEXTE DE LA NOTE 1.5 est celui arrete avec le porteur du projet le 2 octobre
 * 2026. Le nouveau decor de Spirit & Time n'y figure pas, il garde son badge
 * « Prototype », et les modes n'y sont pas nommes.
 */

import { versionMineure } from '@neon-ninja/shared';

/** Une ligne de la note: un intitule en gras, s'il y en a un, puis le texte. */
export interface PuceDeNote {
  readonly intitule?: string;
  readonly texte: string;
}

/** Un groupe de nouveautes, sous son titre. */
export interface SectionDeNote {
  readonly titre: string;
  readonly puces: readonly PuceDeNote[];
}

/** La note d'une version mineure. */
export interface NoteDeVersion {
  /** La version mineure annoncee, « 1.5 ». */
  readonly version: string;
  readonly titre: string;
  readonly sections: readonly SectionDeNote[];
}

/** Toutes les notes, de la plus ancienne a la plus recente. */
export const NOTES_DE_VERSION: readonly NoteDeVersion[] = [
  {
    version: '1.5',
    titre: 'Nouveautés de la version 1.5',
    sections: [
      {
        titre: 'Objets, poche et mines',
        puces: [
          {
            intitule: 'La poche.',
            texte:
              'Elle garde un objet ramassé jusqu’à ce que vous vous en serviez, avec la touche E ou le bouton de poche sur téléphone.',
          },
          {
            intitule: 'La fumée.',
            texte:
              'Vous disparaissez dans un nuage et réapparaissez loin de toute menace. De quoi semer un poursuivant et tromper l’adversaire.',
          },
          {
            intitule: 'La mine.',
            texte:
              'Posez-la sous vos pieds. Un adversaire qui marche dessus l’arme et elle saute une seconde et demie plus tard, en lui coûtant une partie de ses ninjas. Elle détruit aussi un Black Ninja.',
          },
          {
            intitule: 'Les mines de zone.',
            texte:
              'Les zones à effet ne surgissent plus seules. Elles dorment sous des mines visibles de tous et s’ouvrent quand quelqu’un marche dessus. À vous de choisir le bon moment.',
          },
        ],
      },
      {
        titre: 'L’Évadé',
        puces: [
          {
            texte:
              'Un ninja rayé rouge et blanc surgit une fois par partie. Il court plus vite que vous et repart au bout de 45 secondes. Qui l’attrape double son score jusqu’à la fin… à moins de se faire capturer à son tour.',
          },
        ],
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
