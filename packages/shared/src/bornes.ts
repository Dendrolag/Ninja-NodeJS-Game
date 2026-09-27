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
 * large: le RoomManager fabrique des « room-1 ». Les codes d'invitation, eux, ont
 * leurs propres bornes, ci-dessous.
 */
export const BORNES_ROOM = {
  /** Longueur de l'identifiant, en caracteres. */
  longueur: { minimum: 1, maximum: 64 } satisfies Intervalle,
  /** Lettres latines sans accent, chiffres, tiret et tiret bas. */
  caracteresAdmis: /^[A-Za-z0-9_-]+$/u,
} as const;

/**
 * Code d'invitation d'une partie privee.
 *
 * SIX CARACTERES, FABRIQUES PAR LE SERVEUR, jamais choisis par un joueur. Leur
 * alphabet ecarte les caracteres qui se confondent a la lecture ou a la dictee:
 * O et 0, I et 1. Il en reste trente-deux, soit un peu plus d'un milliard de
 * codes: on ne tombe pas sur une partie privee en essayant au hasard, d'autant
 * que chaque essai consomme un jeton de la limite de debit.
 *
 * Un joueur peut saisir le code en minuscules, ou avec des espaces autour: la
 * validation le ramene a sa forme canonique avant toute comparaison.
 */
export const BORNES_CODE_INVITATION = {
  /** Nombre de caracteres d'un code. */
  longueur: 6,
  /** Les caracteres dont un code est fait. */
  alphabet: 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789',
  /** La forme canonique d'un code: six caracteres de l'alphabet. */
  forme: /^[A-HJ-NP-Z2-9]{6}$/u,
} as const;

/**
 * Mot de passe d'un compte (etape 3.2).
 *
 * UNE LONGUEUR, ET AUCUNE REGLE DE COMPOSITION. Exiger une majuscule, un chiffre
 * et un symbole pousse a des mots de passe courts et previsibles (« Motdepasse1! »)
 * sans les rendre plus surs; les recommandations actuelles demandent au contraire
 * une longueur minimale et laissent libre le reste. Huit caracteres au moins.
 *
 * Le maximum n'est pas une regle de securite, c'est une protection du serveur: le
 * hachage d'un mot de passe coute du calcul, et un texte d'un megaoctet en
 * couterait sans raison. Cent vingt-huit caracteres laissent toute la place a une
 * phrase de passe.
 */
export const BORNES_MOT_DE_PASSE = {
  /** Longueur, en caracteres, apres composition Unicode. */
  longueur: { minimum: 8, maximum: 128 } satisfies Intervalle,
} as const;

/**
 * Jeton de session d'un compte (etape 3.2).
 *
 * Fabrique par le serveur: trente-deux octets tires au hasard, ecrits en base 64
 * pour adresse, soit quarante-trois caracteres. Un texte d'une autre forme n'a
 * jamais ete emis par le serveur: il est refuse avant de consulter la base.
 */
export const BORNES_JETON = {
  forme: /^[A-Za-z0-9_-]{43}$/u,
} as const;

/**
 * Code de secours d'un compte (etape 3.4).
 *
 * CE QUI REMPLACE LE MOT DE PASSE OUBLIE. Les comptes n'ont aucun moyen de joindre
 * le joueur: a chaque nouveau mot de passe, le serveur lui remet un code a noter,
 * qui permet d'en choisir un autre sans session. Decision du porteur du projet du
 * 15 septembre 2026.
 *
 * SEIZE CARACTERES DE L'ALPHABET DE CROCKFORD, soit quatre-vingts bits tires au
 * hasard par le serveur. Cet alphabet ecarte les lettres qu'on confond en les
 * recopiant: ni I ni L (pris pour 1), ni O (pris pour 0), ni U. Le code s'affiche
 * en quatre groupes de quatre, separes par des tirets.
 *
 * LA SAISIE PARDONNE. La casse, les espaces et les tirets ne comptent pas, et O se
 * lit 0, I et L se lisent 1: un code recopie a la main doit ouvrir le compte.
 */
export const BORNES_CODE_DE_SECOURS = {
  /** Les trente-deux caracteres admis, dans l'ordre de leur valeur. */
  alphabet: '0123456789ABCDEFGHJKMNPQRSTVWXYZ',
  /** Longueur du code, sans ses tirets. */
  longueur: 16,
  /** Taille d'un groupe a l'affichage. */
  groupe: 4,
  /** La forme d'un code une fois normalise. */
  forme: /^[0-9A-HJKMNP-TV-Z]{16}$/u,
  /**
   * Longueur maximale d'une saisie, espaces et tirets compris, avant normalisation.
   * Au-dela, ce n'est pas un code recopie avec des espaces en trop.
   */
  saisieMaximum: 64,
} as const;

/**
 * Les bornes des amities d'un compte (etape 3.6, etude des amis, section 4.1).
 *
 * Une liste d'amis sert a retrouver les joueurs avec qui l'on joue: deux cents, c'est
 * bien plus qu'on ne retrouve jamais. Les demandes en attente sont bornees pour qu'un
 * compte ne puisse pas en semer partout; au-dela, il faut en annuler une, ou attendre
 * une reponse. La vitesse des demandes est une limite de debit, LIMITES_COMPTES.
 */
export const BORNES_AMITIES = {
  /** Le nombre d'amis d'un compte. */
  amisMaximum: 200,
  /** Les demandes qu'un compte a envoyees et qui n'ont pas eu de reponse. */
  demandesEnAttenteMaximum: 50,
} as const;

/**
 * Les bornes des invitations entre amis (etape 2.8, etude des amis, section 4.4).
 *
 * Une invitation porte un droit d'entree tenu par le serveur, valable deux minutes:
 * de quoi finir une manche de menu et repondre, pas assez pour qu'une invitation
 * oubliee fasse entrer quelqu'un dans une partie qui a change de visage. On n'invite
 * pas le meme ami plus d'une fois par minute (etude, 4.6): relancer un ami qui ne
 * repond pas ne doit pas devenir une nuisance. L'identifiant d'une invitation a la
 * forme d'un jeton de session (BORNES_JETON).
 */
export const BORNES_INVITATIONS = {
  /** Combien de temps un droit d'entree vaut, en millisecondes. */
  validiteMs: 120_000,
  /** Le temps minimal entre deux invitations d'un compte au meme ami, en millisecondes. */
  intervalleParAmiMs: 60_000,
} as const;

/**
 * Combien de temps une partie en cours garde la place d'un joueur dont le lien est
 * tombe (etape 2.5), en millisecondes.
 *
 * Trente secondes: de quoi recharger une page, ou laisser un telephone retrouver
 * du reseau. Au-dela, son depart est un abandon, comme s'il avait quitte la
 * partie. Pendant ce temps, le joueur reste dans la partie, immobile: sa couleur
 * continue de se transmettre, et il reste capturable. Le serveur compte ce delai
 * a partir du moment ou il constate la coupure; le client reessaie pendant la meme
 * duree a partir du moment ou il la constate lui-meme.
 *
 * Un jeton de retour a la forme d'un jeton de session (BORNES_JETON): trente-deux
 * octets tires au hasard par le serveur.
 */
export const DELAI_DE_RETOUR_MS = 30_000;

/**
 * Bornes des reglages de partie choisis par l'hote dans le salon.
 *
 * La structure suit exactement celle de ReglagesPartie, groupe par groupe, pour
 * qu'un reglage ajoute a l'un oblige a ajouter sa borne a l'autre.
 */
export const BORNES_REGLAGES = {
  /** Duree de la partie, en secondes. Bornes du salon du legacy. */
  dureePartieS: { minimum: 30, maximum: 600 } satisfies Intervalle,
  /**
   * Nombre de bots au demarrage. Le minimum est celui du salon du legacy, qui
   * plafonnait a 150. Depuis l'etape 7.6, le maximum est le plus haut des plafonds
   * de carte (PLAFONDS_DE_FAUX_NINJAS): chaque carte a le sien, verifie a part.
   */
  nombreBotsInitial: { minimum: 10, maximum: 500 } satisfies Intervalle,
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
  /**
   * Demandes de tir, dans le mode Tactique (etape 7.1). Un tir ne part qu'au battement
   * suivant, et plusieurs demandes du meme battement n'en font qu'une: au-dela de
   * quelques-unes par seconde, un client ne demande rien de plus. Une rafale de cinq
   * laisse vider ses cinq charges d'affilee.
   */
  capture: { parSeconde: 5, rafale: 5 } satisfies LimiteDebit,
  /** Tout le reste: rejoindre, quitter, lancer, se declarer pret. */
  autresActions: { parSeconde: 5, rafale: 10 } satisfies LimiteDebit,
} as const;

/**
 * Combien de tentatives d'inscription et de connexion sont admises (etape 3.2).
 *
 * Meme modele que LIMITES_DEBIT, mais a une tout autre echelle de temps: il ne
 * s'agit plus de proteger le processeur contre un client bavard, mais un compte
 * contre qui essaie des mots de passe les uns apres les autres.
 *
 * DEUX SEAUX POUR LA CONNEXION, PARCE QUE DEUX ATTAQUES. Essayer beaucoup de mots
 * de passe sur UN compte, depuis beaucoup d'adresses: le seau par pseudo l'arrete,
 * cinq essais puis un par minute. Essayer un mot de passe courant sur BEAUCOUP de
 * comptes depuis une adresse: le seau par adresse l'arrete. Le seau par adresse
 * est large, parce que plusieurs amis derriere la meme box partagent une adresse.
 *
 * L'inscription n'a qu'un seau, par adresse, contre la fabrication de comptes en
 * serie. Dix d'un coup laissent une soiree entre amis s'inscrire ensemble.
 *
 * Depuis l'etape 3.5, la lecture des fiches a aussi son seau, par compte: ce n'est
 * plus un secret qu'on protege, mais la base, contre un compte qui la ferait agreger
 * en boucle. Depuis l'etape 3.6, les gestes d'amitie aussi, et les demandes d'ami ont
 * le leur, contre un compte qui en enverrait a tout le monde.
 */
export const LIMITES_COMPTES = {
  /** Connexions a un meme compte, quelle que soit l'adresse: cinq, puis une par minute. */
  connexionParPseudo: { parSeconde: 1 / 60, rafale: 5 } satisfies LimiteDebit,
  /** Connexions depuis une meme adresse, tous comptes confondus: vingt, puis dix par minute. */
  connexionParAdresse: { parSeconde: 1 / 6, rafale: 20 } satisfies LimiteDebit,
  /** Inscriptions depuis une meme adresse: dix, puis une toutes les deux minutes. */
  inscriptionParAdresse: { parSeconde: 1 / 120, rafale: 10 } satisfies LimiteDebit,
  /**
   * Fiches lues par un meme compte (etape 3.5): trente, puis une par seconde. Chaque
   * lecture agrege tout l'historique d'un joueur; parcourir les fiches d'un salon ou
   * d'un classement n'en demande qu'une douzaine.
   */
  ficheParCompte: { parSeconde: 1, rafale: 30 } satisfies LimiteDebit,
  /**
   * Gestes d'amitie d'un meme compte, tous confondus (etape 3.6): trente, puis un par
   * seconde. Chacun ecrit en base dans une transaction qui verrouille deux comptes.
   */
  gesteDAmitieParCompte: { parSeconde: 1, rafale: 30 } satisfies LimiteDebit,
  /**
   * Demandes d'ami d'un meme compte (etape 3.6): dix, puis dix par minute. Une soiree
   * passee a ajouter les joueurs d'une partie n'en demande pas davantage; semer des
   * demandes a tous les pseudos connus, si.
   */
  demandeDAmiParCompte: { parSeconde: 1 / 6, rafale: 10 } satisfies LimiteDebit,
} as const;
