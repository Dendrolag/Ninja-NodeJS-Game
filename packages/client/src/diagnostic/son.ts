/**
 * L'état du son, dans le relevé de performance de la page (étape 5.12).
 *
 * POURQUOI. Sur l'iPhone, le son faisait tomber la page de 60 à moins de 10 images par
 * seconde. Les relevés fluides de septembre avaient sans doute été pris son coupé par le
 * panneau du son, et rien ne le disait: on a cru le téléphone fluide. Le relevé écrit
 * désormais si le son jouait, à quel volume, et par où passaient ses effets.
 *
 * CE FICHIER NE FAIT QU'ÉCRIRE. L'état vient du lecteur de sons (sons/lecteur.ts).
 */

import type { EtatDuLecteur } from '../sons/lecteur.js';
import type { Variantes } from './demande.js';

/**
 * La ligne « Son » de l'en-tête du relevé.
 *
 * @param etat L'état du lecteur au moment de la copie, ou rien si la page n'en a pas.
 */
export function texteDuSon(variantes: Variantes, etat: EtatDuLecteur | undefined): string {
  if (!variantes.son) {
    return 'retiré par la variante';
  }

  if (etat === undefined) {
    return 'aucun lecteur';
  }

  if (etat.coupe) {
    return 'coupé par le panneau du son';
  }

  const musique = etat.musique
    ? `musique ${pourcent(etat.volumeMusique)}`
    : 'musique retirée par la variante';
  const voie =
    etat.voie.nature === 'elements'
      ? 'effets par éléments audio'
      : `effets par Web Audio (contexte ${etat.voie.contexte}, ${String(etat.voie.prets)} fichiers prêts sur ${String(etat.voie.fichiers)})`;

  return `joue, effets ${pourcent(etat.volumeSons)}, ${musique}, ${voie}`;
}

/** Un volume de zéro à un, en pour cent. */
function pourcent(volume: number): string {
  return `${String(Math.round(volume * 100))} %`;
}
