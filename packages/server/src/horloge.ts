/**
 * L'horloge du serveur, et la boucle qui bat au rythme qu'elle donne.
 *
 * C'est ici que le temps entre dans le jeu. Le moteur de @neon-ninja/sim ne lit
 * jamais l'heure: il recoit un dt en millisecondes et avance d'autant. Quelqu'un
 * doit bien mesurer ce dt quelque part, et ce quelqu'un est ce fichier.
 *
 * POURQUOI L'HORLOGE EST INJECTEE. Une partie qui depend de l'heure reelle ne se
 * teste qu'en attendant. Une partie qui recoit son horloge se teste en une
 * milliseconde: on lui donne une horloge manuelle, on la fait avancer de trois
 * minutes, on regarde le resultat. C'est la meme idee que la graine pour le
 * hasard, appliquee au temps.
 *
 * CE QUI TUE LE DEFAUT X1 DE L'AUDIT. Le legacy semait des setInterval et des
 * setTimeout qu'il n'annulait jamais: apres cinq parties, cinq boucles battaient
 * en parallele. Ici une boucle appartient a la partie qui l'a demarree, et cette
 * partie sait l'arreter. Trois garde-fous: demarrer une boucle deja en marche ne
 * fait rien, l'arreter deux fois ne fait rien non plus, et la fin de la partie
 * l'arrete d'elle-meme.
 */

/**
 * Ce que le serveur attend d'une horloge: savoir l'heure, et savoir rappeler.
 *
 * Deux implementations existent: celle du systeme, qui sert en production, et
 * celle qu'on avance a la main, qui sert aux tests. Rien d'autre dans le serveur
 * n'a le droit d'appeler Date.now ni setInterval directement.
 */
export interface Horloge {
  /**
   * Nombre de millisecondes ecoulees depuis un point de reference fixe.
   *
   * Seuls les ecarts entre deux lectures ont un sens. La valeur absolue n'en a
   * aucun et ne doit jamais etre affichee ni enregistree.
   */
  maintenant(): number;

  /**
   * Programme un rappel repete, et rend la fonction qui l'arrete.
   *
   * La fonction rendue peut etre appelee plusieurs fois sans dommage.
   */
  repeter(rappel: () => void, intervalleMs: number): () => void;
}

/** Le prochain rappel d'une boucle: quand il est du, et dans combien de temps le lancer. */
export interface RappelSuivant {
  /** Instant ou le rappel suivant est du, sur l'horloge qui a servi au calcul. */
  readonly echeance: number;
  /** Delai a donner a la minuterie, en millisecondes entieres. Jamais moins d'une. */
  readonly delaiMs: number;
}

/**
 * Quand relancer un rappel repete, sachant quand il etait du et quand il a vraiment eu lieu.
 *
 * LE RYTHME VISE L'HEURE PREVUE, PAS L'HEURE D'ARRIVEE (etape 5.2). Une minuterie
 * repetee de Node repart de l'instant ou son rappel a commence: chaque retard est donc
 * perdu pour de bon, et les retards s'additionnent. Sur un serveur charge, ou chaque
 * battement attend quelques millisecondes que le fil se libere, les parties battaient
 * ainsi 18 fois par seconde au lieu de 20, alors que le fil avait encore du temps
 * libre. Ici l'echeance suivante se compte depuis l'echeance precedente: un rappel en
 * retard de trois millisecondes fait partir le suivant trois millisecondes plus tot,
 * et la frequence moyenne reste exactement celle demandee.
 *
 * UN RETARD D'UN INTERVALLE OU PLUS NE SE RATTRAPE PAS. Si le serveur s'est fige, la
 * boucle repart de maintenant au lieu d'enchainer les rappels en rafale pour combler
 * le trou. Le moteur, lui, recoit toujours le temps reellement ecoule, borne par la
 * boucle de la partie: rattraper ou non ne change rien a la vitesse du jeu.
 *
 * Le delai est arrondi a la milliseconde, la resolution des minuteries de Node: un
 * delai a virgule ne serait pas plus precis, et chaque duree differente coute a Node
 * une file de minuteries de plus.
 *
 * @param echeance Instant ou le rappel qui vient d'avoir lieu etait du.
 * @param maintenant Instant ou il a eu lieu.
 * @param intervalleMs Intervalle vise entre deux rappels.
 */
export function rappelSuivant(
  echeance: number,
  maintenant: number,
  intervalleMs: number,
): RappelSuivant {
  const prevue = echeance + intervalleMs;
  const suivante = prevue > maintenant ? prevue : maintenant + intervalleMs;

  return { echeance: suivante, delaiMs: Math.max(Math.round(suivante - maintenant), 1) };
}

/**
 * L'horloge du systeme: celle de la production.
 *
 * performance.now() plutot que Date.now(): la premiere est monotone, la seconde
 * peut reculer quand le systeme se resynchronise sur un serveur de temps. Un dt
 * negatif ferait lever le moteur, qui refuse un temps qui recule.
 *
 * Un rappel repete est une suite de minuteries simples, dont chacune vise l'echeance
 * prevue: voir rappelSuivant. La minuterie suivante est programmee AVANT d'appeler le
 * rappel, pour qu'un rappel qui arrete sa propre boucle, comme le fait une partie qui
 * se termine, annule bien celle-la.
 */
export const horlogeSysteme: Horloge = {
  maintenant: () => performance.now(),
  repeter: (rappel, intervalleMs) => {
    let echeance = performance.now() + intervalleMs;
    let minuterie = setTimeout(battre, intervalleMs);

    function battre(): void {
      const suivant = rappelSuivant(echeance, performance.now(), intervalleMs);
      echeance = suivant.echeance;
      minuterie = setTimeout(battre, suivant.delaiMs);
      rappel();
    }

    return () => {
      clearTimeout(minuterie);
    };
  },
};

/** Une horloge que l'on avance a la main. Pour les tests, et pour eux seuls. */
export interface HorlogeManuelle extends Horloge {
  /**
   * Fait passer le temps, en declenchant au passage tous les rappels dus.
   *
   * Un rappel est declenche a l'instant exact ou il etait attendu: une horloge
   * avancee de deux cents millisecondes avec un rappel toutes les cinquante le
   * declenche quatre fois, et maintenant() vaut a chaque fois ce qu'il devait
   * valoir. La boucle de partie mesure donc bien cinquante millisecondes a
   * chaque battement, comme elle le ferait en vrai.
   */
  avancerDe(dtMs: number): void;
}

/** Un rappel programme, et l'instant ou il doit repartir. */
interface Tache {
  readonly rappel: () => void;
  readonly intervalleMs: number;
  prochainMs: number;
}

/**
 * Cree une horloge arretee, que le test fait avancer lui-meme.
 *
 * @param depart Instant de depart. Sa valeur n'a aucune importance, seuls les
 *               ecarts comptent; une valeur non nulle par defaut evite qu'un
 *               test passe par accident en confondant l'instant zero et rien.
 */
export function creerHorlogeManuelle(depart = 1000): HorlogeManuelle {
  let instant = depart;
  const taches = new Set<Tache>();

  return {
    maintenant: () => instant,

    repeter: (rappel, intervalleMs) => {
      if (!Number.isFinite(intervalleMs) || intervalleMs <= 0) {
        throw new Error(`Un intervalle de rappel doit etre positif, recu ${intervalleMs}.`);
      }

      const tache: Tache = { rappel, intervalleMs, prochainMs: instant + intervalleMs };
      taches.add(tache);

      return () => {
        taches.delete(tache);
      };
    },

    avancerDe: (dtMs) => {
      if (!Number.isFinite(dtMs) || dtMs < 0) {
        throw new Error(`Une horloge ne peut avancer que d'un temps positif, recu ${dtMs}.`);
      }

      const cible = instant + dtMs;

      // On avance d'echeance en echeance, et non d'un bond: un rappel doit lire
      // l'heure de son echeance, pas celle de la fin du saut.
      for (;;) {
        const prochaine = prochaineEcheance(taches);
        if (prochaine === undefined || prochaine > cible) {
          break;
        }

        instant = prochaine;

        // On travaille sur une copie: un rappel a le droit de s'arreter
        // lui-meme, ce que fait la boucle de partie quand la partie se termine.
        for (const tache of [...taches]) {
          if (taches.has(tache) && tache.prochainMs <= instant) {
            tache.prochainMs += tache.intervalleMs;
            tache.rappel();
          }
        }
      }

      instant = cible;
    },
  };
}

/** L'instant du prochain rappel attendu, s'il y en a un. */
function prochaineEcheance(taches: ReadonlySet<Tache>): number | undefined {
  let prochaine: number | undefined;

  for (const tache of taches) {
    if (prochaine === undefined || tache.prochainMs < prochaine) {
      prochaine = tache.prochainMs;
    }
  }

  return prochaine;
}
