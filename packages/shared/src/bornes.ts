/**
 * Les bornes du jeu: ce qu'une entree a le droit de valoir, et a quelle cadence
 * elle a le droit d'arriver.
 *
 * Ce fichier ne contient que des DONNEES. Les fonctions qui s'en servent sont
 * dans validation.ts pour les valeurs et debit.ts pour les cadences. La raison
 * est celle qui vaut deja pour constantes.ts et reglages.ts: on veut pouvoir lire
 * d'un coup d'oeil tout ce qui est autorise, sans traverser du code.
 *
 * D'OU VIENNENT CES NOMBRES. Chaque fois que le legacy en portait un, c'est le
 * sien. Les bornes des reglages de partie sont celles que son salon imposait deja
 * dans index.html (les attributs min et max de ses champs numeriques), et la
 * longueur du pseudo est le maxlength de son champ de saisie. La difference est
 * qu'elles n'existaient QUE dans le navigateur: le serveur ne verifiait rien, si
 * bien qu'un client modifie envoyait ce qu'il voulait. Ici elles sont partagees,
 * donc verifiables du cote qui fait autorite.
 *
 * Six reglages n'avaient aucun equivalent dans le salon du legacy et leurs bornes
 * sont donc des decisions du 14 aout 2026: les trois reglages de zone, et les
 * trois reglages de bot noir autres que leur nombre. Elles sont larges a dessein,
 * une borne servant a empecher l'absurde, pas a equilibrer le jeu.
 */

/** Un intervalle de valeurs admises, bornes comprises. */
export interface Intervalle {
  readonly minimum: number;
  readonly maximum: number;
}

/**
 * Pseudo d'un joueur.
 *
 * Le legacy ne validait rien du tout cote serveur, et son client se contentait de
 * refuser le vide. C'est la faille S1 de l'audit: le pseudo etait ensuite injecte
 * dans du HTML par innerHTML a trois endroits, si bien qu'un pseudo contenant du
 * code s'executait chez tous les autres joueurs a la fin de la partie.
 *
 * LE JEU DE CARACTERES EST UNE LISTE BLANCHE, pas une liste noire. Interdire les
 * chevrons ne suffit pas: selon l'endroit ou le texte atterrit, une apostrophe,
 * une esperluette ou un caractere de controle peuvent suffire a en changer le
 * sens. On autorise donc uniquement ce dont un pseudo a besoin, et tout le reste
 * est refuse. Ce qui passe: les lettres de toutes les langues et leurs accents,
 * les chiffres, l'espace, le tiret, le tiret bas et le point.
 *
 * Ce qui ne passe pas, et c'est voulu: les emoji (la documentation du projet les
 * proscrit deja, et ils compliquent le rendu), les guillemets, les apostrophes,
 * et tout le balisage.
 */
export const BORNES_PSEUDO = {
  /** Longueur apres normalisation, en caracteres. Le maximum est celui du legacy. */
  longueur: { minimum: 1, maximum: 20 } satisfies Intervalle,
  /**
   * Les caracteres admis, une fois le pseudo normalise.
   *
   * Le drapeau u active les classes Unicode: \p{L} designe une lettre de
   * n'importe quelle langue, \p{M} un signe diacritique qui s'y accroche, \p{N}
   * un chiffre.
   */
  caracteresAdmis: /^[\p{L}\p{M}\p{N} _.-]+$/u,
} as const;

/**
 * Message de chat.
 *
 * Le legacy tronquait silencieusement a deux cents caracteres (server.js:2229).
 * On garde sa longueur et on refuse au lieu de tronquer: un message ampute a la
 * moitie d'une phrase est plus deroutant qu'un message refuse, et le client sait
 * empecher la saisie bien avant.
 *
 * Contrairement au pseudo, le texte n'a PAS de liste blanche de caracteres: un
 * message de chat est du texte libre, et le contraindre reviendrait a faire de la
 * moderation, ce que la fiche 1.6 place hors perimetre. Sa surete vient d'ailleurs:
 * il voyage comme du texte et s'affiche par textContent. Seuls les caracteres de
 * controle sont retires a la normalisation, parce qu'ils n'ecrivent rien et
 * servent uniquement a brouiller un affichage.
 */
export const BORNES_CHAT = {
  /** Longueur apres normalisation, en caracteres. Valeur du legacy. */
  longueur: { minimum: 1, maximum: 200 } satisfies Intervalle,
} as const;

/**
 * Identifiant de partie, tel qu'un joueur le fournit pour rejoindre.
 *
 * Le legacy n'avait qu'une partie et n'en nommait donc aucune. Des l'instant ou
 * il en existe plusieurs (etape 2.1), un joueur doit dire laquelle il rejoint,
 * et ce texte vient de lui: il se valide comme tout le reste.
 *
 * Le jeu de caracteres est une liste blanche, pour la meme raison que celui du
 * pseudo: cet identifiant sert de cle de recherche et de nom de salle Socket.IO,
 * deux endroits ou un caractere inattendu n'a rien a faire. La longueur est
 * large: le RoomManager fabrique aujourd'hui des « room-1 », et l'etape 2.4
 * introduira des codes d'invitation.
 */
export const BORNES_ROOM = {
  /** Longueur de l'identifiant, en caracteres. */
  longueur: { minimum: 1, maximum: 64 } satisfies Intervalle,
  /** Lettres latines sans accent, chiffres, tiret et tiret bas. */
  caracteresAdmis: /^[A-Za-z0-9_-]+$/u,
} as const;

/**
 * Bornes des reglages de partie choisis par l'hote dans le salon.
 *
 * La structure suit exactement celle de ReglagesPartie, groupe par groupe, pour
 * qu'un reglage ajoute a l'un oblige a ajouter sa borne a l'autre.
 */
export const BORNES_REGLAGES = {
  /** Duree de la partie, en secondes. Bornes du salon du legacy. */
  dureePartieS: { minimum: 30, maximum: 600 } satisfies Intervalle,
  /** Nombre de bots au demarrage. Bornes du salon du legacy. */
  nombreBotsInitial: { minimum: 10, maximum: 150 } satisfies Intervalle,
  bonus: {
    /** Delai entre deux tentatives d'apparition, en secondes. */
    intervalleApparitionS: { minimum: 2, maximum: 20 } satisfies Intervalle,
    /** Duree d'un bonus une fois ramasse, en secondes. */
    dureeS: { minimum: 5, maximum: 30 } satisfies Intervalle,
    /** Chance sur cent d'apparaitre a chaque tentative. */
    tauxApparitionPourCent: { minimum: 5, maximum: 100 } satisfies Intervalle,
  },
  malus: {
    intervalleApparitionS: { minimum: 4, maximum: 30 } satisfies Intervalle,
    dureeS: { minimum: 5, maximum: 30 } satisfies Intervalle,
    tauxApparitionPourCent: { minimum: 5, maximum: 100 } satisfies Intervalle,
  },
  /** Aucun de ces trois reglages n'existait dans le salon du legacy. */
  zones: {
    /** Duree de vie d'une zone, en secondes. La minimale ne peut pas depasser la maximale. */
    dureeS: { minimum: 5, maximum: 120 } satisfies Intervalle,
    intervalleApparitionS: { minimum: 5, maximum: 120 } satisfies Intervalle,
  },
  botsNoirs: {
    /** Nombre de bots noirs qui entrent en jeu ensemble. Bornes du salon du legacy. */
    nombre: { minimum: 1, maximum: 5 } satisfies Intervalle,
    /** A quel pourcentage de la partie ecoule ils apparaissent. Decision du 14 aout 2026. */
    momentApparitionPourCent: { minimum: 0, maximum: 100 } satisfies Intervalle,
    /** Distance de detection d'une proie, en pixels. Decision du 14 aout 2026. */
    rayonDetectionPx: { minimum: 50, maximum: 500 } satisfies Intervalle,
    /** Part des bots perdue lors d'une prise. Decision du 14 aout 2026. */
    partDeBotsPerduePourCent: { minimum: 0, maximum: 100 } satisfies Intervalle,
  },
} as const;

/**
 * Cadence maximale autorisee pour un type d'entree, sous forme de seau a jetons.
 *
 * Un seau contient au plus « rafale » jetons et se remplit de « parSeconde »
 * jetons chaque seconde. Chaque message consomme un jeton; un message qui arrive
 * sur un seau vide est refuse. Ce modele tolere donc une bouffee courte, ce qui
 * arrive normalement apres un a-coup de reseau, sans tolerer un debit soutenu
 * au-dessus de la limite.
 */
export interface LimiteDebit {
  /** Nombre de messages autorises par seconde en regime etabli. */
  readonly parSeconde: number;
  /** Nombre de messages autorises d'un coup apres une periode de silence. */
  readonly rafale: number;
}

/**
 * Combien de messages de chaque sorte un joueur a le droit d'envoyer.
 *
 * CES VALEURS SE DECIDENT ICI, ELLES S'APPLIQUENT EN 2.2. Le moteur n'en a pas
 * besoin: il ne voit qu'une intention par joueur et par battement, quel que soit
 * le nombre de messages recus. La limitation sert a proteger le SERVEUR, dont le
 * legacy n'avait aucune protection (faille S4: chaque message move y declenchait
 * un releve complet des collisions, de sorte qu'un client bavard saturait un
 * coeur processeur a lui tout seul).
 *
 * Le deplacement est calibre sur la cadence reelle du client du legacy, un envoi
 * toutes les vingt millisecondes, soit cinquante par seconde. On accorde soixante
 * pour laisser respirer un client un peu plus rapide, et une rafale de dix pour
 * absorber un a-coup sans rien refuser.
 */
export const LIMITES_DEBIT = {
  /** Intentions de deplacement. Un depassement est ignore, pas fatal. */
  deplacement: { parSeconde: 60, rafale: 10 } satisfies LimiteDebit,
  /** Messages de chat. Large pour une conversation, etroit pour une inondation. */
  chat: { parSeconde: 1, rafale: 5 } satisfies LimiteDebit,
  /** Changements de reglages par l'hote du salon. */
  reglages: { parSeconde: 5, rafale: 10 } satisfies LimiteDebit,
  /** Tout le reste: rejoindre, quitter, lancer, se declarer pret. */
  autresActions: { parSeconde: 5, rafale: 10 } satisfies LimiteDebit,
} as const;
