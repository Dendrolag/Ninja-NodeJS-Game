/**
 * Le signal de vie qui garde le serveur de jeu eveille (etape 5.5).
 *
 * POURQUOI. En offre gratuite, Render endort le serveur apres quinze minutes sans
 * requete entrante, et le reveil prend de quinze secondes a une minute
 * (docs/deploiement.md). Une fois le lien de jeu ouvert en WebSocket, la page
 * n'envoyait plus aucune requete: le serveur s'endormait sous un joueur reste sur
 * les menus. La page demande donc la route de sante toutes les dix minutes.
 *
 * SEULEMENT PAGE VISIBLE. Un onglet oublie en arriere-plan ne doit pas tenir le
 * serveur eveille indefiniment. En revenant au premier plan, la page envoie un
 * signal tout de suite si le dernier date d'un intervalle ou plus. Une partie en
 * cours garde de toute facon le serveur eveille.
 *
 * TOUT EST INJECTE: l'horloge, la minuterie, la requete et la visibilite. Le module
 * ne touche au navigateur que par ce qu'on lui donne, et se teste sans lui.
 */

/** Intervalle entre deux signaux de vie: sous les quinze minutes de Render. */
export const INTERVALLE_EVEIL_MS = 10 * 60_000;

/** Ce qu'il faut pour garder le serveur eveille. */
export interface OptionsEveil {
  /** L'adresse de la route de sante du serveur de jeu. */
  readonly adresse: string;
  /** Envoie la requete. Sa reponse ne sert a rien: seule compte son arrivee. */
  readonly demander: (adresse: string) => void;
  /** L'instant present, en millisecondes. */
  readonly maintenant: () => number;
  /** Appelle le rappel a chaque intervalle, et rend de quoi l'arreter. */
  readonly repeter: (rappel: () => void, intervalleMs: number) => () => void;
  /** La page est-elle visible. */
  readonly estVisible: () => boolean;
  /** Appelle le rappel quand la page change de visibilite, et rend de quoi arreter. */
  readonly surChangementDeVisibilite: (rappel: () => void) => () => void;
}

/** Garde le serveur eveille, et rend de quoi arreter. */
export function garderEveille(options: OptionsEveil): () => void {
  let dernierSignal = options.maintenant();

  const signaler = (): void => {
    dernierSignal = options.maintenant();
    options.demander(options.adresse);
  };

  const arreterLaMinuterie = options.repeter(() => {
    if (options.estVisible()) {
      signaler();
    }
  }, INTERVALLE_EVEIL_MS);

  const arreterLEcoute = options.surChangementDeVisibilite(() => {
    if (options.estVisible() && options.maintenant() - dernierSignal >= INTERVALLE_EVEIL_MS) {
      signaler();
    }
  });

  return () => {
    arreterLaMinuterie();
    arreterLEcoute();
  };
}

/**
 * Branche le signal de vie sur le navigateur.
 *
 * La requete part sans lire la reponse, en mode « no-cors »: la route de sante n'a pas
 * a autoriser la page, puisque seule compte son arrivee au serveur.
 *
 * @param serveur L'adresse du serveur de jeu, ou rien quand il sert la page lui-meme.
 */
export function garderEveilleDansLeNavigateur(serveur: string | undefined): () => void {
  return garderEveille({
    adresse: `${serveur ?? ''}/sante`,
    demander: (adresse) => {
      fetch(adresse, { mode: 'no-cors', cache: 'no-store' }).catch(() => undefined);
    },
    maintenant: () => Date.now(),
    repeter: (rappel, intervalleMs) => {
      const minuterie = setInterval(rappel, intervalleMs);
      return () => {
        clearInterval(minuterie);
      };
    },
    estVisible: () => document.visibilityState === 'visible',
    surChangementDeVisibilite: (rappel) => {
      document.addEventListener('visibilitychange', rappel);
      return () => {
        document.removeEventListener('visibilitychange', rappel);
      };
    },
  });
}
