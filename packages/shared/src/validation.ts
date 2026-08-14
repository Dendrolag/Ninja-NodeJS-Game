/**
 * Les schemas de validation: ce qui a le droit d'entrer dans le jeu.
 *
 * Une seule idee gouverne ce fichier. Tout ce qui vient d'un joueur est INCONNU
 * jusqu'a preuve du contraire, et la preuve se fait ici, a la frontiere. En
 * dessous de cette frontiere, dans le moteur, plus rien n'a besoin de se mefier.
 *
 * Chaque fonction prend un unknown, parce que c'est ce qu'un message reseau est
 * reellement, et rend un resultat qui dit oui avec une valeur propre, ou non avec
 * la liste de ce qui cloche. Il n'y a pas de troisieme possibilite: aucune de ces
 * fonctions ne rogne une valeur en silence pour la faire entrer. Un reglage hors
 * bornes est refuse, il n'est pas ramene a la borne, parce qu'un hote qui demande
 * une partie de deux heures doit apprendre qu'elle est refusee, et non decouvrir
 * apres coup qu'elle dure dix minutes.
 *
 * La seule exception est la NORMALISATION du texte, qui n'est pas un rognage: un
 * pseudo entoure d'espaces est le meme pseudo, et deux ecritures Unicode de la
 * meme lettre accentuee sont la meme lettre. Normaliser rend comparable ce qui
 * doit l'etre, sans rien changer de ce que le joueur a voulu ecrire.
 *
 * OU S'APPLIQUE CE FICHIER. La couche reseau de l'etape 2.2 appelle ces fonctions
 * sur chaque message recu, avant de toucher a quoi que ce soit. Le moteur, lui,
 * ne les appelle pas: il se defend autrement, en ne lisant jamais un champ d'etat
 * fourni par un client et en bornant lui-meme le deplacement par dt.
 *
 * CE QUE LA VALIDATION NE REMPLACE PAS. Valider un pseudo a l'entree ne dispense
 * jamais de l'echapper a l'affichage. La faille S1 du legacy venait d'un pseudo
 * pose dans du HTML par innerHTML: le client de l'etape 4.3 posera tout texte
 * venu d'un joueur avec textContent, sans exception. Les deux protections sont
 * exigees parce qu'elles ne protegent pas de la meme chose: l'une empeche
 * d'entrer, l'autre empeche de nuire si quelque chose entrait quand meme.
 */

import type { Intervalle } from './bornes.js';
import { BORNES_CHAT, BORNES_PSEUDO, BORNES_REGLAGES, BORNES_ROOM } from './bornes.js';
import type { IdentifiantCarte } from './constantes.js';
import { CARTES, TYPES_BONUS, TYPES_MALUS, TYPES_ZONE } from './constantes.js';
import type {
  DemandeRejoindre,
  IntentionDeplacement,
  MessageChat,
  SessionJoueur,
} from './entrees.js';
import type { ReglagesPartie, ReglagesPartiels } from './reglages.js';
import { completerReglages } from './reglages.js';

/** Ce qui cloche dans une entree refusee: ou, et pourquoi. */
export interface ErreurValidation {
  /** Chemin du champ fautif, par exemple « bonus.types.vitesse.dureeS ». */
  readonly champ: string;
  /** Explication en francais, destinee a etre montree au joueur. */
  readonly motif: string;
}

/**
 * Le verdict d'une validation.
 *
 * C'est une union discriminee, et non une valeur eventuellement nulle: le
 * compilateur oblige donc l'appelant a regarder le champ valide avant de lire
 * quoi que ce soit. On ne peut pas oublier de traiter le refus.
 */
export type ResultatValidation<T> =
  | { readonly valide: true; readonly valeur: T }
  | { readonly valide: false; readonly erreurs: readonly ErreurValidation[] };

/**
 * Normalise un texte fourni par un joueur.
 *
 * Quatre passes, dans cet ordre:
 *
 *   1. Composition Unicode. « e » suivi d'un accent aigu devient « e accent
 *      aigu »: deux ecritures d'un meme mot deviennent une seule chaine.
 *   2. Suppression des caracteres de format, invisibles a l'ecran. Ils ne
 *      servent qu'a fabriquer deux pseudos qui se ressemblent, ou a inverser le
 *      sens de lecture d'une ligne de chat.
 *   3. Les caracteres de controle, retours a la ligne compris, deviennent des
 *      espaces. Un pseudo sur trois lignes casse toute mise en page.
 *   4. Les suites d'espaces sont ramenees a un seul, et les bords sont rognes.
 */
export function normaliserTexte(brut: string): string {
  return brut
    .normalize('NFC')
    .replace(/\p{Cf}/gu, '')
    .replace(/\p{Cc}/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

/**
 * Valide le pseudo choisi par un joueur.
 *
 * Le legacy ne verifiait rien cote serveur: ni longueur, ni caracteres. C'etait
 * la moitie de la faille S1. Voir BORNES_PSEUDO pour le detail de ce qui passe,
 * et surtout pourquoi c'est une liste blanche.
 */
export function validerPseudo(brut: unknown): ResultatValidation<string> {
  if (typeof brut !== 'string') {
    return refuse('pseudo', 'Un pseudo doit etre du texte.');
  }

  const pseudo = normaliserTexte(brut);
  const taille = nombreDeCaracteres(pseudo);

  if (taille < BORNES_PSEUDO.longueur.minimum) {
    return refuse('pseudo', 'Un pseudo ne peut pas etre vide.');
  }

  if (taille > BORNES_PSEUDO.longueur.maximum) {
    return refuse('pseudo', `Un pseudo fait au plus ${BORNES_PSEUDO.longueur.maximum} caracteres.`);
  }

  if (!BORNES_PSEUDO.caracteresAdmis.test(pseudo)) {
    return refuse(
      'pseudo',
      'Un pseudo n accepte que des lettres, des chiffres, l espace, le tiret, le tiret bas et le point.',
    );
  }

  return accepte(pseudo);
}

/**
 * Valide la demande d'entree en partie: un pseudo, et eventuellement une partie.
 *
 * L'identifiant de partie est du texte fourni par un joueur, donc suspect au
 * meme titre que le reste. Il sert ensuite de cle de recherche dans le
 * RoomManager et de nom de salle Socket.IO: le laisser passer tel quel
 * reviendrait a laisser un client choisir ou ses messages atterrissent. Un
 * identifiant absent n'est pas une erreur, il signifie « n'importe quelle
 * partie ».
 */
export function validerDemandeRejoindre(brut: unknown): ResultatValidation<DemandeRejoindre> {
  const source = objetOuRien(brut);
  if (source === undefined) {
    return refuse('rejoindre', 'Une demande d entree doit etre un objet.');
  }

  const verdictPseudo = validerPseudo(champ(source, 'pseudo'));
  if (!verdictPseudo.valide) {
    return { valide: false, erreurs: verdictPseudo.erreurs };
  }

  const brutRoom = champ(source, 'idRoom');
  if (brutRoom === undefined) {
    return accepte({ pseudo: verdictPseudo.valeur });
  }

  if (typeof brutRoom !== 'string') {
    return refuse('idRoom', 'L identifiant d une partie doit etre du texte.');
  }

  const taille = nombreDeCaracteres(brutRoom);
  if (taille < BORNES_ROOM.longueur.minimum || taille > BORNES_ROOM.longueur.maximum) {
    return refuse(
      'idRoom',
      `L identifiant d une partie fait au plus ${BORNES_ROOM.longueur.maximum} caracteres.`,
    );
  }

  if (!BORNES_ROOM.caracteresAdmis.test(brutRoom)) {
    return refuse(
      'idRoom',
      'L identifiant d une partie n accepte que des lettres sans accent, des chiffres, le tiret et le tiret bas.',
    );
  }

  return accepte({ pseudo: verdictPseudo.valeur, idRoom: brutRoom });
}

/**
 * Valide un message de chat et le SIGNE avec l'identite de la session.
 *
 * C'est la correction de la faille S3. Le legacy rediffusait le champ nickname du
 * message recu (server.js:2234), si bien que n'importe qui pouvait ecrire sous le
 * nom de n'importe qui. Ici la signature n'est pas verifiee, elle est APPOSEE:
 * les champs auteur et pseudo du resultat viennent de la session et de nulle part
 * ailleurs. Le message entrant a beau en declarer d'autres, ils ne sont jamais
 * lus. Une fonction qui verifierait la concordance pourrait etre oubliee; une
 * fonction qui ne lit pas le champ ne peut pas l'etre.
 *
 * @param session Identite etablie a la connexion, hors de portee du client.
 * @param brut Le message recu, dont seul le champ texte est lu.
 */
export function validerMessageChat(
  session: SessionJoueur,
  brut: unknown,
): ResultatValidation<MessageChat> {
  const source = objetOuRien(brut);
  if (source === undefined) {
    return refuse('message', 'Un message de chat doit etre un objet.');
  }

  const brutTexte = champ(source, 'texte');
  if (typeof brutTexte !== 'string') {
    return refuse('message.texte', 'Le texte d un message doit etre du texte.');
  }

  const texte = normaliserTexte(brutTexte);
  const taille = nombreDeCaracteres(texte);

  if (taille < BORNES_CHAT.longueur.minimum) {
    return refuse('message.texte', 'Un message vide ne s envoie pas.');
  }

  if (taille > BORNES_CHAT.longueur.maximum) {
    return refuse(
      'message.texte',
      `Un message fait au plus ${BORNES_CHAT.longueur.maximum} caracteres.`,
    );
  }

  return accepte({ auteur: session.id, pseudo: session.pseudo, texte });
}

/**
 * Valide l'intention de deplacement recue d'un joueur.
 *
 * Deux verifications, et deux silences volontaires.
 *
 * Les verifications: les deux coordonnees sont des nombres FINIS, et l'indicateur
 * de mouvement est un booleen. La finitude n'est pas une coquetterie: une
 * coordonnee valant NaN traverse tous les calculs sans jamais lever d'erreur et
 * finit par empoisonner la position du joueur, donc les distances, donc les
 * captures. C'est le seul type d'entree capable de corrompre un etat entier.
 *
 * Le premier silence: la LONGUEUR du vecteur n'est pas verifiee, parce qu'elle
 * n'a aucune importance. Le moteur ne lit que l'orientation et fixe lui-meme la
 * distance a partir de dt et de la vitesse du joueur. Un vecteur de longueur mille
 * fait donc exactement le meme pas qu'un vecteur de longueur un.
 *
 * Le second silence: tout champ supplementaire est IGNORE. Un client qui joint
 * speedBoostActive ou isMobile a son message, comme le legacy le lui permettait,
 * n'obtient rien: ces champs ne sont pas lus, donc ils ne peuvent rien accorder.
 */
export function validerIntentionDeplacement(
  brut: unknown,
): ResultatValidation<IntentionDeplacement> {
  const source = objetOuRien(brut);
  if (source === undefined) {
    return refuse('intention', 'Une intention de deplacement doit etre un objet.');
  }

  const enMouvement = champ(source, 'enMouvement');
  if (typeof enMouvement !== 'boolean') {
    return refuse('intention.enMouvement', 'L indicateur de mouvement doit etre un booleen.');
  }

  const vecteur = objetOuRien(champ(source, 'deplacement'));
  if (vecteur === undefined) {
    return refuse('intention.deplacement', 'Le deplacement doit etre un vecteur.');
  }

  const erreurs: ErreurValidation[] = [];
  const x = coordonnee(vecteur, 'x', erreurs);
  const y = coordonnee(vecteur, 'y', erreurs);

  if (x === undefined || y === undefined) {
    return { valide: false, erreurs };
  }

  return accepte({ deplacement: { x, y }, enMouvement });
}

/**
 * Valide les reglages proposes par l'hote d'un salon.
 *
 * Les reglages absents prennent leur valeur par defaut: l'hote n'envoie que ce
 * qu'il change. Les reglages presents sont verifies un par un, et TOUTES les
 * erreurs sont rendues d'un coup plutot que la premiere seule, pour que l'ecran
 * de reglages puisse les montrer toutes ensemble.
 *
 * Seuls les champs CONNUS sont recopies dans les reglages retenus. Ce n'est pas
 * qu'une question de proprete: recopier a l'aveugle les champs d'un objet fourni
 * par un client permettrait d'y glisser une cle speciale du langage et de
 * modifier le comportement d'objets qui n'ont rien a voir. Ici, une cle inconnue
 * n'est pas refusee, elle est simplement ignoree, donc elle ne va nulle part.
 *
 * Tous les nombres attendus sont des ENTIERS. Le salon du legacy les saisissait
 * deja ainsi, et une partie de cent quatre-vingts virgule sept secondes n'a
 * aucun sens.
 */
export function validerReglages(brut: unknown): ResultatValidation<ReglagesPartie> {
  if (brut === undefined || brut === null) {
    return accepte(completerReglages());
  }

  const source = objetOuRien(brut);
  if (source === undefined) {
    return refuse('reglages', 'Les reglages doivent etre un objet.');
  }

  const erreurs: ErreurValidation[] = [];
  const retenus: Enregistrement = {};

  poser(
    retenus,
    'dureePartieS',
    entier(source, 'dureePartieS', BORNES_REGLAGES.dureePartieS, erreurs),
  );
  poser(retenus, 'carte', identifiantDeCarte(source, erreurs));
  poser(retenus, 'modeMiroir', booleen(source, 'modeMiroir', erreurs));
  poser(
    retenus,
    'nombreBotsInitial',
    entier(source, 'nombreBotsInitial', BORNES_REGLAGES.nombreBotsInitial, erreurs),
  );
  poser(retenus, 'bonus', groupeBonus(source, erreurs));
  poser(retenus, 'malus', groupeMalus(source, erreurs));
  poser(retenus, 'zones', groupeZones(source, erreurs));
  poser(retenus, 'botsNoirs', groupeBotsNoirs(source, erreurs));

  if (erreurs.length > 0) {
    return { valide: false, erreurs };
  }

  // La conversion est sure: retenus ne contient que des cles connues, chacune
  // portant une valeur deja verifiee. TypeScript ne sait pas l'exprimer, comme
  // pour la fusion des reglages partiels dans reglages.ts.
  const reglages = completerReglages(retenus as ReglagesPartiels);

  // Seule regle qui met deux reglages en rapport, donc la seule qui ne puisse
  // pas se verifier champ par champ. Elle se juge apres completion, parce que
  // l'hote peut n'avoir change qu'une des deux durees.
  if (reglages.zones.dureeMinimumS > reglages.zones.dureeMaximumS) {
    return refuse(
      'zones.dureeMinimumS',
      'La duree minimale d une zone ne peut pas depasser sa duree maximale.',
    );
  }

  return accepte(reglages);
}

// --------------------------------------------------------------------------
// Lecture des groupes de reglages
// --------------------------------------------------------------------------

/** Un objet quelconque en cours de lecture ou de construction. */
type Enregistrement = Record<string, unknown>;

/** Reglages des bonus: l'intervalle commun, puis chaque nature de bonus. */
function groupeBonus(
  source: Enregistrement,
  erreurs: ErreurValidation[],
): Enregistrement | undefined {
  const brut = groupe(source, 'bonus', 'bonus', erreurs);
  if (brut === undefined) {
    return undefined;
  }

  const retenu: Enregistrement = {};
  poser(
    retenu,
    'intervalleApparitionS',
    entier(
      brut,
      'intervalleApparitionS',
      BORNES_REGLAGES.bonus.intervalleApparitionS,
      erreurs,
      'bonus',
    ),
  );

  const types: Enregistrement = {};
  const brutTypes = groupe(brut, 'types', 'bonus.types', erreurs);

  for (const nature of TYPES_BONUS) {
    const chemin = `bonus.types.${nature}`;
    const brutNature = groupe(brutTypes ?? {}, nature, chemin, erreurs);
    if (brutNature === undefined) {
      continue;
    }

    const reglage: Enregistrement = {};
    poser(reglage, 'actif', booleen(brutNature, 'actif', erreurs, chemin));
    poser(
      reglage,
      'dureeS',
      entier(brutNature, 'dureeS', BORNES_REGLAGES.bonus.dureeS, erreurs, chemin),
    );
    poser(
      reglage,
      'tauxApparitionPourCent',
      entier(
        brutNature,
        'tauxApparitionPourCent',
        BORNES_REGLAGES.bonus.tauxApparitionPourCent,
        erreurs,
        chemin,
      ),
    );
    poser(types, nature, siRempli(reglage));
  }

  poser(retenu, 'types', siRempli(types));

  return siRempli(retenu);
}

/** Reglages des malus: un interrupteur, un intervalle, un taux, puis chaque nature. */
function groupeMalus(
  source: Enregistrement,
  erreurs: ErreurValidation[],
): Enregistrement | undefined {
  const brut = groupe(source, 'malus', 'malus', erreurs);
  if (brut === undefined) {
    return undefined;
  }

  const retenu: Enregistrement = {};
  poser(retenu, 'actifs', booleen(brut, 'actifs', erreurs, 'malus'));
  poser(
    retenu,
    'intervalleApparitionS',
    entier(
      brut,
      'intervalleApparitionS',
      BORNES_REGLAGES.malus.intervalleApparitionS,
      erreurs,
      'malus',
    ),
  );
  poser(
    retenu,
    'tauxApparitionPourCent',
    entier(
      brut,
      'tauxApparitionPourCent',
      BORNES_REGLAGES.malus.tauxApparitionPourCent,
      erreurs,
      'malus',
    ),
  );

  const types: Enregistrement = {};
  const brutTypes = groupe(brut, 'types', 'malus.types', erreurs);

  for (const nature of TYPES_MALUS) {
    const chemin = `malus.types.${nature}`;
    const brutNature = groupe(brutTypes ?? {}, nature, chemin, erreurs);
    if (brutNature === undefined) {
      continue;
    }

    const reglage: Enregistrement = {};
    poser(reglage, 'actif', booleen(brutNature, 'actif', erreurs, chemin));
    poser(
      reglage,
      'dureeS',
      entier(brutNature, 'dureeS', BORNES_REGLAGES.malus.dureeS, erreurs, chemin),
    );
    poser(types, nature, siRempli(reglage));
  }

  poser(retenu, 'types', siRempli(types));

  return siRempli(retenu);
}

/** Reglages des zones: un interrupteur, deux durees, un intervalle, quatre natures. */
function groupeZones(
  source: Enregistrement,
  erreurs: ErreurValidation[],
): Enregistrement | undefined {
  const brut = groupe(source, 'zones', 'zones', erreurs);
  if (brut === undefined) {
    return undefined;
  }

  const retenu: Enregistrement = {};
  poser(retenu, 'actives', booleen(brut, 'actives', erreurs, 'zones'));
  poser(
    retenu,
    'dureeMinimumS',
    entier(brut, 'dureeMinimumS', BORNES_REGLAGES.zones.dureeS, erreurs, 'zones'),
  );
  poser(
    retenu,
    'dureeMaximumS',
    entier(brut, 'dureeMaximumS', BORNES_REGLAGES.zones.dureeS, erreurs, 'zones'),
  );
  poser(
    retenu,
    'intervalleApparitionS',
    entier(
      brut,
      'intervalleApparitionS',
      BORNES_REGLAGES.zones.intervalleApparitionS,
      erreurs,
      'zones',
    ),
  );

  const types: Enregistrement = {};
  const brutTypes = groupe(brut, 'types', 'zones.types', erreurs);

  for (const nature of TYPES_ZONE) {
    poser(types, nature, booleen(brutTypes ?? {}, nature, erreurs, 'zones.types'));
  }

  poser(retenu, 'types', siRempli(types));

  return siRempli(retenu);
}

/** Reglages des bots noirs: un interrupteur et quatre nombres. */
function groupeBotsNoirs(
  source: Enregistrement,
  erreurs: ErreurValidation[],
): Enregistrement | undefined {
  const brut = groupe(source, 'botsNoirs', 'botsNoirs', erreurs);
  if (brut === undefined) {
    return undefined;
  }

  const bornes = BORNES_REGLAGES.botsNoirs;
  const retenu: Enregistrement = {};
  poser(retenu, 'actifs', booleen(brut, 'actifs', erreurs, 'botsNoirs'));
  poser(retenu, 'nombre', entier(brut, 'nombre', bornes.nombre, erreurs, 'botsNoirs'));
  poser(
    retenu,
    'momentApparitionPourCent',
    entier(brut, 'momentApparitionPourCent', bornes.momentApparitionPourCent, erreurs, 'botsNoirs'),
  );
  poser(
    retenu,
    'rayonDetectionPx',
    entier(brut, 'rayonDetectionPx', bornes.rayonDetectionPx, erreurs, 'botsNoirs'),
  );
  poser(
    retenu,
    'partDeBotsPerduePourCent',
    entier(brut, 'partDeBotsPerduePourCent', bornes.partDeBotsPerduePourCent, erreurs, 'botsNoirs'),
  );

  return siRempli(retenu);
}

// --------------------------------------------------------------------------
// Briques de lecture, communes a tous les schemas
// --------------------------------------------------------------------------

/** Un resultat accepte. */
function accepte<T>(valeur: T): ResultatValidation<T> {
  return { valide: true, valeur };
}

/** Un resultat refuse, avec un seul motif. */
function refuse<T>(champFautif: string, motif: string): ResultatValidation<T> {
  return { valide: false, erreurs: [{ champ: champFautif, motif }] };
}

/**
 * Lit une cle d'un objet inconnu, sans jamais remonter sa chaine de prototypes.
 *
 * Une cle absente et une cle heritee se valent ici: ni l'une ni l'autre n'a ete
 * ecrite par l'appelant.
 */
function champ(source: Enregistrement, cle: string): unknown {
  return Object.hasOwn(source, cle) ? source[cle] : undefined;
}

/** La valeur si c'est un objet ordinaire, rien sinon. Un tableau n'en est pas un. */
function objetOuRien(valeur: unknown): Enregistrement | undefined {
  return typeof valeur === 'object' && valeur !== null && !Array.isArray(valeur)
    ? (valeur as Enregistrement)
    : undefined;
}

/** Range une valeur dans un objet en construction, sauf si elle est absente. */
function poser(cible: Enregistrement, cle: string, valeur: unknown): void {
  if (valeur !== undefined) {
    cible[cle] = valeur;
  }
}

/** L'objet s'il porte au moins un champ, rien s'il est reste vide. */
function siRempli(construit: Enregistrement): Enregistrement | undefined {
  return Object.keys(construit).length > 0 ? construit : undefined;
}

/**
 * Lit un sous-groupe de reglages.
 *
 * Un groupe absent rend un objet vide plutot que rien, pour que la lecture des
 * champs qu'il contient se poursuive sans cas particulier: chacun sera absent a
 * son tour, donc chacun prendra sa valeur par defaut.
 */
function groupe(
  source: Enregistrement,
  cle: string,
  chemin: string,
  erreurs: ErreurValidation[],
): Enregistrement | undefined {
  const valeur = champ(source, cle);
  if (valeur === undefined) {
    return {};
  }

  const objet = objetOuRien(valeur);
  if (objet === undefined) {
    erreurs.push({ champ: chemin, motif: 'Ce groupe de reglages doit etre un objet.' });
    return undefined;
  }

  return objet;
}

/** Lit un booleen. Absent: rien. Present et d'un autre type: une erreur. */
function booleen(
  source: Enregistrement,
  cle: string,
  erreurs: ErreurValidation[],
  prefixe?: string,
): boolean | undefined {
  const valeur = champ(source, cle);
  if (valeur === undefined) {
    return undefined;
  }

  if (typeof valeur !== 'boolean') {
    erreurs.push({ champ: cheminDe(prefixe, cle), motif: 'Ce reglage doit valoir vrai ou faux.' });
    return undefined;
  }

  return valeur;
}

/** Lit un entier borne. Absent: rien. Hors bornes ou d'un autre type: une erreur. */
function entier(
  source: Enregistrement,
  cle: string,
  intervalle: Intervalle,
  erreurs: ErreurValidation[],
  prefixe?: string,
): number | undefined {
  const valeur = champ(source, cle);
  if (valeur === undefined) {
    return undefined;
  }

  const chemin = cheminDe(prefixe, cle);

  if (typeof valeur !== 'number' || !Number.isInteger(valeur)) {
    erreurs.push({ champ: chemin, motif: 'Ce reglage doit etre un nombre entier.' });
    return undefined;
  }

  if (valeur < intervalle.minimum || valeur > intervalle.maximum) {
    erreurs.push({
      champ: chemin,
      motif: `Ce reglage doit se trouver entre ${intervalle.minimum} et ${intervalle.maximum}, bornes comprises.`,
    });
    return undefined;
  }

  return valeur;
}

/** Lit l'identifiant de la carte jouee, parmi celles qui existent. */
function identifiantDeCarte(
  source: Enregistrement,
  erreurs: ErreurValidation[],
): IdentifiantCarte | undefined {
  const valeur = champ(source, 'carte');
  if (valeur === undefined) {
    return undefined;
  }

  if (typeof valeur !== 'string' || !Object.hasOwn(CARTES, valeur)) {
    erreurs.push({
      champ: 'carte',
      motif: `La carte doit etre l une de ${Object.keys(CARTES).join(', ')}.`,
    });
    return undefined;
  }

  return valeur as IdentifiantCarte;
}

/** Lit une coordonnee de vecteur: un nombre fini, et rien d'autre. */
function coordonnee(
  vecteur: Enregistrement,
  cle: string,
  erreurs: ErreurValidation[],
): number | undefined {
  const valeur = champ(vecteur, cle);

  if (typeof valeur !== 'number' || !Number.isFinite(valeur)) {
    erreurs.push({
      champ: `intention.deplacement.${cle}`,
      motif: 'Une coordonnee doit etre un nombre fini.',
    });
    return undefined;
  }

  return valeur;
}

/** Assemble le chemin d'un champ pour un message d'erreur lisible. */
function cheminDe(prefixe: string | undefined, cle: string): string {
  return prefixe === undefined ? cle : `${prefixe}.${cle}`;
}

/**
 * Compte les caracteres d'un texte, et non ses unites de codage.
 *
 * Une lettre hors de l'alphabet latin peut occuper deux unites en memoire. Sans
 * cette precaution, la limite de vingt caracteres d'un pseudo n'en autoriserait
 * que dix a un joueur qui ecrit dans son alphabet.
 */
function nombreDeCaracteres(texte: string): number {
  return [...texte].length;
}
