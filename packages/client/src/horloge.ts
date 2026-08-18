/**
 * L'horloge du client: la seule chose qui lui dise l'heure.
 *
 * Le client a besoin du temps pour deux choses, et deux seulement: dater un
 * message de chat a son arrivee, et savoir quand un effet ramasse cessera. Il
 * n'a jamais besoin de faire avancer le jeu, qui avance chez le serveur.
 *
 * POURQUOI UNE HORLOGE INJECTEE PLUTOT QU'UN APPEL DIRECT. Meme raison que dans
 * packages/server: un magasin qui lit l'heure lui-meme ne se teste qu'en
 * attendant. Ici il la recoit, et un test verifie en une milliseconde qu'un
 * bonus de dix secondes expire bien au bout de dix secondes.
 *
 * POURQUOI ELLE NE RESSEMBLE PAS A CELLE DU SERVEUR. Celle du serveur sait aussi
 * rappeler a intervalle regulier, parce qu'elle fait battre les parties. Le
 * client ne fait battre personne: sa boucle de rendu (etape 4.2) est cadencee
 * par le navigateur, pas par une minuterie. Deux besoins differents, deux
 * interfaces differentes; les reunir aurait donne au client une capacite dont il
 * n'a pas l'usage.
 *
 * LA VALEUR N'EST PAS UNE HEURE DU MUR. performance.now() est monotone, ce que
 * Date.now() n'est pas: cette derniere peut reculer quand le systeme se
 * resynchronise, et une duree calculee dessus devient alors negative. Seuls les
 * ECARTS entre deux lectures ont donc un sens ici. Le jour ou un ecran voudra
 * afficher « 14:32 » a cote d'un message, il convertira lui-meme, en comparant
 * une lecture de chaque horloge au moment de l'affichage.
 */

/** Ce que le client attend d'une horloge: savoir depuis combien de temps. */
export interface HorlogeClient {
  /**
   * Nombre de millisecondes ecoulees depuis un point de reference fixe.
   *
   * Seuls les ecarts entre deux lectures ont un sens. La valeur absolue n'en a
   * aucun et ne doit jamais etre affichee ni enregistree.
   */
  maintenant(): number;
}

/** L'horloge du navigateur: celle de la production. */
export const horlogeNavigateur: HorlogeClient = {
  maintenant: () => performance.now(),
};

/** Une horloge que l'on avance a la main. Pour les tests, et pour eux seuls. */
export interface HorlogeClientManuelle extends HorlogeClient {
  /** Fait passer le temps. */
  avancerDe(dtMs: number): void;
}

/**
 * Cree une horloge arretee, que le test fait avancer lui-meme.
 *
 * @param depart Instant de depart. Sa valeur n'a aucune importance, seuls les
 *               ecarts comptent; une valeur non nulle par defaut evite qu'un
 *               test passe par accident en confondant l'instant zero et rien.
 */
export function creerHorlogeClientManuelle(depart = 1000): HorlogeClientManuelle {
  let instant = depart;

  return {
    maintenant: () => instant,
    avancerDe: (dtMs) => {
      if (!Number.isFinite(dtMs) || dtMs < 0) {
        throw new Error(
          `Une horloge ne peut avancer que d'un temps positif, recu ${String(dtMs)}.`,
        );
      }

      instant += dtMs;
    },
  };
}
