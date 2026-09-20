/**
 * La version du jeu: une page ne parle qu'au serveur construit du meme commit.
 *
 * POURQUOI, DEPUIS L'ETAPE 5.3. En production, la page (Vercel) et le serveur de
 * jeu (Render) sont deux mises en ligne distinctes. Le contrat qui les lie, les
 * evenements, le format du flux d'etat, les regles de validation, change d'un
 * commit a l'autre sans numero de version. Une page d'hier restee ouverte dans un
 * onglet, face au serveur d'aujourd'hui, echangerait des messages que l'autre
 * comprend de travers, sans qu'aucune erreur ne le dise. La version est donc le
 * commit lui-meme: la page la joint a l'ouverture du lien, et le serveur refuse une
 * page qui n'est pas la sienne, avec un motif qui dit au joueur quoi faire.
 *
 * SANS VERSION, AUCUN CONTROLE. Un serveur lance en developpement, par les tests
 * ou par les scenarios de bout en bout ne connait pas de version: il accepte toute
 * page, comme avant cette etape.
 */

/** Ce que lit un joueur dont la page n'est pas de la version du serveur. */
export const MOTIF_VERSION_DIFFERENTE =
  'Une nouvelle version du jeu est en ligne. Rechargez la page.';

/**
 * La page peut-elle ouvrir un lien avec ce serveur.
 *
 * @param versionDuServeur La version du serveur, absente en developpement.
 * @param authentification Ce que la page a joint a l'ouverture, tel que recu: rien
 *                         n'en est encore verifie.
 */
export function versionAcceptee(
  versionDuServeur: string | undefined,
  authentification: unknown,
): boolean {
  if (versionDuServeur === undefined) {
    return true;
  }

  if (
    typeof authentification !== 'object' ||
    authentification === null ||
    !Object.hasOwn(authentification, 'version')
  ) {
    return false;
  }

  return (authentification as Record<string, unknown>)['version'] === versionDuServeur;
}

/**
 * Les noms de mois, pour ecrire une date que tout le monde lit.
 *
 * Ecrits ici plutot que demandes au navigateur: toLocaleDateString rend « 20
 * septembre 2026 » chez l'un et « September 20, 2026 » chez l'autre, selon la langue
 * reglee dans le navigateur, et les tests ne figeraient rien. La page du jeu est en
 * francais, sa version l'est aussi.
 */
const MOIS = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
] as const;

/** Les six champs d'une date ISO 8601, sans le fuseau: 2026-09-20T19:44:10+02:00. */
const CHAMPS_ISO = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/;

/** Ce que la page affiche quand elle n'a pas ete empaquetee pour une mise en ligne. */
export const LIBELLE_DE_DEVELOPPEMENT = 'Version de développement';

/** Nombre de caracteres de l'empreinte du commit montres au joueur. */
export const LONGUEUR_EMPREINTE_COURTE = 7;

/**
 * La date d'un commit, ecrite en toutes lettres, ou rien si la chaine n'en est pas une.
 *
 * ELLE NE CONVERTIT AUCUNE HEURE. Les champs se lisent tels qu'ils sont ecrits dans
 * la chaine, et le fuseau qui la termine est ignore: l'heure affichee est celle a
 * laquelle le commit a ete fait, la ou il a ete fait. Passer par un objet Date
 * donnerait une heure differente selon le reglage de la machine qui affiche, ce qui
 * ferait varier la meme version d'un lecteur a l'autre.
 */
export function dateDeVersion(horodatage: string): string | undefined {
  const champs = CHAMPS_ISO.exec(horodatage);

  if (champs === null) {
    return undefined;
  }

  // Les cinq groupes existent des lors que l'expression a reconnu la chaine; les
  // valeurs par defaut ne servent qu'a le dire au verificateur de types.
  const [, annee = '', mois = '', jour = '', heures = '', minutes = ''] = champs;
  const nomDuMois = MOIS[Number(mois) - 1];

  if (nomDuMois === undefined) {
    return undefined;
  }

  // Le premier du mois se dit « 1er », pas « 1 ».
  const numeroDuJour = Number(jour);
  const quantieme = numeroDuJour === 1 ? '1er' : String(numeroDuJour);

  return `${quantieme} ${nomDuMois} ${annee}, ${heures}h${minutes}`;
}

/**
 * Ce que le joueur lit en pied d'accueil pour savoir sur quelle version il est.
 *
 * POURQUOI CETTE LIGNE EXISTE (etape 8.4). La version du jeu est le commit, et le
 * commit ne se lit pas. Le 20 septembre 2026, la production est restee trois commits
 * en arriere sans que rien ne le signale: il a fallu interroger la route de sante du
 * serveur pour s'en apercevoir. Une date en toutes lettres et sept caracteres
 * d'empreinte suffisent a repondre a la question « de quand date ce que je vois ».
 *
 * @param version    L'empreinte complete du commit, absente en developpement.
 * @param horodatage La date du commit en ISO 8601, absente si git n'a rien su en dire.
 */
export function libelleDeVersion(version?: string, horodatage?: string): string {
  if (version === undefined || version === '') {
    return LIBELLE_DE_DEVELOPPEMENT;
  }

  const empreinte = version.slice(0, LONGUEUR_EMPREINTE_COURTE);
  const date =
    horodatage === undefined || horodatage === '' ? undefined : dateDeVersion(horodatage);

  return date === undefined ? `Version ${empreinte}` : `Version du ${date} · ${empreinte}`;
}
