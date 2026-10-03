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

/**
 * Le numero de version du jeu (etape 4.9), le seul endroit ou il s'ecrit.
 *
 * IL PART DE 1.5.0, le numero donne par le porteur du projet le 2 octobre 2026. Le
 * commit dit de quelle construction il s'agit; le numero dit ce que le joueur a
 * entre les mains.
 *
 * LA REGLE D'AVANCEMENT. Le numero se fixe a la main, ici, a la fin d'une etape qui
 * le justifie:
 * - le deuxieme chiffre (1.X.0) avance pour une nouveaute majeure, et s'accompagne
 *   toujours d'une note de version, que les joueurs liront une fois: un test exige
 *   que la note existe;
 * - le troisieme chiffre (1.5.X) avance pour une correction ou un reglage, sans note.
 * Une etape qui ne change rien de ce que voit le joueur ne le touche pas.
 */
export const NUMERO_DE_VERSION = '1.6.1';

/**
 * La version mineure d'un numero, celle qui porte une note: « 1.5 » pour « 1.5.3 ».
 * Un correctif ne change rien aux nouveautes annoncees.
 */
export function versionMineure(numero: string): string {
  return numero.split('.').slice(0, 2).join('.');
}

/** Ce que la page affiche quand elle n'a pas ete empaquetee pour une mise en ligne. */
export const LIBELLE_DE_DEVELOPPEMENT = `V${NUMERO_DE_VERSION} · développement`;

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
 * La date d'un commit en jj/mm/aaaa, ou rien si la chaine n'en est pas une.
 *
 * Comme dateDeVersion, elle lit les champs tels qu'ils sont ecrits, sans convertir:
 * la meme version porte la meme date pour tous les joueurs.
 */
export function dateCourteDeVersion(horodatage: string): string | undefined {
  const champs = CHAMPS_ISO.exec(horodatage);

  if (champs === null) {
    return undefined;
  }

  const [, annee = '', mois = '', jour = ''] = champs;
  const numeroDuMois = Number(mois);

  if (numeroDuMois < 1 || numeroDuMois > MOIS.length) {
    return undefined;
  }

  return `${jour}/${mois}/${annee}`;
}

/**
 * Ce que le joueur lit en pied d'accueil pour savoir sur quelle version il est:
 * « V1.5.0 · 02/10/2026 · 8f2a8df ».
 *
 * POURQUOI CETTE LIGNE EXISTE (etape 8.4). La version du jeu est le commit, et le
 * commit ne se lit pas. Le 20 septembre 2026, la production est restee trois commits
 * en arriere sans que rien ne le signale: il a fallu interroger la route de sante du
 * serveur pour s'en apercevoir. La date et sept caracteres d'empreinte suffisent a
 * repondre a la question « de quand date ce que je vois ».
 *
 * LE NUMERO EN TETE (etape 4.9), puis une date courte: « jjmmaa », demande d'abord,
 * a ete ecarte, ambigu (021026). L'heure est dans l'infobulle (infobulleDeVersion).
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
    horodatage === undefined || horodatage === '' ? undefined : dateCourteDeVersion(horodatage);

  return date === undefined
    ? `V${NUMERO_DE_VERSION} · ${empreinte}`
    : `V${NUMERO_DE_VERSION} · ${date} · ${empreinte}`;
}

/**
 * L'infobulle du pied d'accueil: la date complete et l'empreinte entiere, pour qui
 * a le depot sous la main. Rien en developpement, ou aucun commit n'est servi.
 */
export function infobulleDeVersion(version?: string, horodatage?: string): string | undefined {
  if (version === undefined || version === '') {
    return undefined;
  }

  const date =
    horodatage === undefined || horodatage === '' ? undefined : dateDeVersion(horodatage);

  return date === undefined ? `Commit ${version}` : `Version du ${date} · commit ${version}`;
}
