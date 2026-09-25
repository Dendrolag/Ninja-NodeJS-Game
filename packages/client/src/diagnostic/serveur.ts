/**
 * Les battements du serveur, dans le relevé de performance de la page (étape 8.6).
 *
 * POURQUOI. Le relevé voit quand un instantané arrive en retard, pas où il a pris ce
 * retard. Le serveur dit, par sa route de santé, l'écart réel entre ses battements: si
 * ses battements partent à l'heure et que le téléphone les reçoit en retard, le retard
 * est sur le chemin; s'ils partent déjà en retard, il est dans le serveur. Les deux se
 * lisent désormais dans le même texte.
 *
 * CE FICHIER NE FAIT QU'ÉCRIRE. La lecture sur le réseau est dans diagnostic.ts; la forme
 * de la réponse, et sa vérification, dans le paquet partagé (sante.ts).
 */

import type { Repartition, ResumeDuBattement } from '@neon-ninja/shared';

import { nombre } from './releve.js';

/** Ce que la page a lu de la route de santé, et quand. */
export type LectureDuServeur =
  | {
      /** Il y a combien de secondes, au moment de la copie. */
      readonly ageS: number;
      /** Le résumé; null quand aucune partie n'a battu dans la fenêtre du serveur. */
      readonly battement: ResumeDuBattement | null;
    }
  | {
      readonly ageS: number;
      /** Pourquoi la lecture a échoué, en clair. */
      readonly echec: string;
    };

/**
 * La section du relevé qui dit ce que le serveur a fait.
 *
 * @param lecture La dernière lecture de la route de santé, ou rien si la page ne l'a pas
 *                encore lue.
 */
export function texteDuServeur(lecture: LectureDuServeur | undefined): string {
  const lignes = ['', '== Serveur, battements de toutes ses parties'];

  if (lecture === undefined) {
    lignes.push('Pas encore lu: la page lit le serveur pendant la partie et à sa fin.');
    return `${lignes.join('\n')}\n`;
  }

  const age = `lu il y a ${nombre(lecture.ageS, 0)} s`;

  if ('echec' in lecture) {
    lignes.push(`Lecture impossible (${age}): ${lecture.echec}`);
    return `${lignes.join('\n')}\n`;
  }

  const battement = lecture.battement;

  if (battement === null) {
    lignes.push(`Aucun battement dans la fenêtre du serveur (${age}).`);
    return `${lignes.join('\n')}\n`;
  }

  lignes.push(
    `Fenêtre: les ${nombre(battement.fenetreS, 0)} dernières secondes, ${String(battement.battements)} battements (${age})`,
    `Écart entre deux battements d'une partie, 50 ms visés: ${repartition(battement.ecart)}`,
    `Battements d'au moins 100 ms: ${String(battement.enRetard)}`,
    `Durée d'un battement (moteur, codage, envoi): ${repartition(battement.duree)}`,
  );

  return `${lignes.join('\n')}\n`;
}

/** Une répartition en une ligne. */
function repartition(valeurs: Repartition): string {
  return [
    `médiane ${nombre(valeurs.mediane, 1)}`,
    `p90 ${nombre(valeurs.p90, 1)}`,
    `p99 ${nombre(valeurs.p99, 1)}`,
    `max ${nombre(valeurs.max, 1)} ms`,
  ].join(', ');
}
