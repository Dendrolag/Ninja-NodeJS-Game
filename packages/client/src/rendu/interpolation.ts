/**
 * Le lissage: comment afficher soixante images par seconde a partir de vingt
 * battements reseau.
 *
 * LE PROBLEME QUE CE FICHIER RESOUT. Le serveur envoie l'etat vingt fois par
 * seconde. Le client d'origine dessinait A LA RECEPTION de ces messages: le jeu
 * plafonnait donc a vingt images par seconde, quelle que soit la machine, et
 * chaque perte de message se voyait comme une saccade. Ici l'affichage tourne a
 * la cadence du navigateur et lit, a chaque image, une position INTERMEDIAIRE
 * entre les deux derniers battements recus.
 *
 * LE CLIENT NE SIMULE TOUJOURS RIEN, et c'est la distinction importante.
 * Interpoler, c'est afficher un point situe ENTRE deux etats que le serveur a
 * reellement envoyes. Extrapoler, ce serait deviner ou l'entite ira ensuite,
 * c'est-a-dire rejouer les regles du jeu chez le client, avec la desynchronisation
 * et les corrections visibles que cela suppose. On interpole, on n'extrapole
 * jamais: si les messages s'arretent, l'affichage se fige sur le dernier etat
 * connu au lieu d'inventer une suite qui n'arrivera pas.
 *
 * CONSEQUENCE ASSUMEE: L'AFFICHAGE EST EN RETARD D'UN BATTEMENT, soit cinquante
 * millisecondes. C'est le prix du lissage, et c'est le meme choix que font les
 * jeux en ligne depuis toujours. Le joueur ne le percoit pas; une saccade, si.
 *
 * UN SAUT NE SE LISSE PAS. Un joueur capture reapparait a l'autre bout de la
 * carte. Faire glisser son personnage en ligne droite a travers les murs serait
 * plus trompeur que le saut lui-meme: au-dela d'un seuil, on saute.
 */

import type { EntiteVue } from '@neon-ninja/shared';

import type { VuePartie } from '../reconstruction.js';
import { SEUIL_IMMOBILITE_PX, SEUIL_SAUT_PX } from './apparence.js';

/** Une entite prete a etre dessinee: sa position lissee, et si elle marche. */
export interface EntiteLissee {
  /** L'entite telle que le dernier battement la decrit. */
  readonly entite: EntiteVue;
  /** Position affichee, entre celle du battement precedent et celle du dernier. */
  readonly x: number;
  readonly y: number;
  /** L'entite bouge-t-elle, ce qui decide de l'animation de marche. */
  readonly enMouvement: boolean;
}

/** Ce que le rendu dessine a une image donnee. */
export interface VueLissee {
  /** Le dernier battement recu: c'est lui qui fait foi pour tout sauf les positions. */
  readonly vue: VuePartie;
  readonly entites: readonly EntiteLissee[];
}

/**
 * Le tampon des deux derniers battements, et l'instant ou ils sont arrives.
 *
 * IL A UNE MEMOIRE, ET C'EST LE SEUL DU CLIENT AVEC LE MAGASIN. Ce n'est pas une
 * entorse a la regle: le magasin detient l'ETAT DU JEU, ce tampon detient une
 * information d'AFFICHAGE qui n'existe que pour lisser, que personne d'autre ne
 * lit, et qui disparait avec le rendu. La ranger dans le magasin ferait changer
 * l'etat du jeu soixante fois par seconde pour une raison purement visuelle.
 */
export class TamponDeLissage {
  private precedente: VuePartie | undefined;
  private courante: VuePartie | undefined;
  /** Instant local d'arrivee du battement courant. */
  private arriveeCourante = 0;
  /** Duree observee entre les deux derniers battements, en millisecondes. */
  private intervalleMs = DUREE_BATTEMENT_PAR_DEFAUT_MS;

  /**
   * Prend note d'une vue lue dans l'etat, si c'est une nouvelle.
   *
   * La comparaison se fait par IDENTITE D'OBJET, ce que la reconstruction rend
   * possible: elle rend la meme vue quand rien n'a change et un objet neuf
   * sinon. Comparer les contenus couterait un parcours complet a chaque image.
   *
   * @param maintenant Instant local, lu sur l'horloge du client.
   */
  observer(vue: VuePartie | undefined, maintenant: number): void {
    if (vue === undefined) {
      this.oublier();
      return;
    }

    if (vue === this.courante) {
      return;
    }

    if (this.courante !== undefined && vue.tick <= this.courante.tick) {
      // Une partie neuve repart du battement zero: le tampon doit repartir avec
      // elle, sinon il lisserait entre la fin de l'ancienne partie et le debut
      // de la nouvelle.
      this.oublier();
    }

    if (this.courante !== undefined) {
      this.precedente = this.courante;
      this.intervalleMs = Math.max(maintenant - this.arriveeCourante, 1);
    }

    this.courante = vue;
    this.arriveeCourante = maintenant;
  }

  /** Efface tout: plus rien a lisser, la prochaine vue repart de zero. */
  oublier(): void {
    this.precedente = undefined;
    this.courante = undefined;
    this.arriveeCourante = 0;
    this.intervalleMs = DUREE_BATTEMENT_PAR_DEFAUT_MS;
  }

  /**
   * Ce qu'il faut dessiner a cet instant.
   *
   * @param maintenant Instant local, lu sur l'horloge du client.
   * @returns Rien tant qu'aucun battement n'est arrive.
   */
  vueLissee(maintenant: number): VueLissee | undefined {
    const courante = this.courante;

    if (courante === undefined) {
      return undefined;
    }

    const precedente = this.precedente;

    if (precedente === undefined) {
      return {
        vue: courante,
        entites: courante.entites.map((entite) => ({
          entite,
          x: entite.x,
          y: entite.y,
          enMouvement: false,
        })),
      };
    }

    // Bornee a un: passe ce point, on tient la derniere position connue plutot
    // que de prolonger le mouvement. C'est la difference entre lisser et deviner.
    const avancement = Math.min((maintenant - this.arriveeCourante) / this.intervalleMs, 1);

    return {
      vue: courante,
      entites: courante.entites.map((entite) =>
        lisserUneEntite(entite, positionPrecedente(precedente, entite.id), avancement),
      ),
    };
  }
}

/** Duree supposee entre deux battements tant qu'aucune n'a ete observee. */
const DUREE_BATTEMENT_PAR_DEFAUT_MS = 50;

/** Retrouve ou etait une entite au battement precedent, si elle y etait. */
function positionPrecedente(
  precedente: VuePartie,
  id: string,
): { readonly x: number; readonly y: number } | undefined {
  const trouvee = precedente.entites.find((entite) => entite.id === id);

  return trouvee === undefined ? undefined : { x: trouvee.x, y: trouvee.y };
}

/**
 * Place une entite entre ses deux dernieres positions connues.
 *
 * Exportee pour etre testee seule: c'est la regle la plus subtile du lissage, et
 * elle vaut d'etre verifiee cas par cas.
 */
export function lisserUneEntite(
  entite: EntiteVue,
  depart: { readonly x: number; readonly y: number } | undefined,
  avancement: number,
): EntiteLissee {
  if (depart === undefined) {
    // Une entite qui vient d'apparaitre n'a pas de passe: elle s'affiche ou elle
    // est. Lui inventer un point de depart la ferait surgir en glissant.
    return { entite, x: entite.x, y: entite.y, enMouvement: false };
  }

  const ecartX = entite.x - depart.x;
  const ecartY = entite.y - depart.y;
  const distance = Math.hypot(ecartX, ecartY);

  if (distance > SEUIL_SAUT_PX) {
    return { entite, x: entite.x, y: entite.y, enMouvement: false };
  }

  return {
    entite,
    x: depart.x + ecartX * avancement,
    y: depart.y + ecartY * avancement,
    enMouvement: distance > SEUIL_IMMOBILITE_PX,
  };
}
