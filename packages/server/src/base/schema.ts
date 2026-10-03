/**
 * Le schema de la base: les comptes, leur progression, les parties jouees et, depuis
 * l'etape 3.6, les amities, puis les succes (3.7), le titre (3.9), les faits de partie
 * (3.8) et les defis releves (3.10).
 *
 * C'EST LA SOURCE DES MIGRATIONS. Les fichiers SQL de packages/server/migrations
 * sont ecrits par drizzle-kit a partir de ce fichier (`pnpm base:generer`), jamais
 * a la main. La CI regenere les migrations et echoue si ce fichier a change sans
 * elles: le schema decrit ici et la base reelle ne peuvent pas diverger en silence.
 *
 * CE QUI SE DEDUIT NE SE STOCKE PAS (cadrage de l'etape 0.3, section 5). La
 * progression garde l'XP totale, les pieces et les points de ligue; le niveau et
 * le palier de rang s'en deduisent par des fonctions pures, dans
 * packages/shared/src/progression.ts (etape 3.3). Meme principe que le score
 * depuis le 14 aout 2026.
 *
 * CE QUI N'EST PAS ICI, VOLONTAIREMENT. Ni gemmes, ni pass de saison, ni skins, ni
 * clans. Chacun s'ajoutera par de nouvelles tables qui referencent le compte, sans
 * colonne ajoutee a celles-ci, comme l'ont fait le mot de passe et les sessions (3.2),
 * puis les defis de la semaine (3.10).
 *
 * DEUX TABLES POUR UNE PARTIE JOUEE. Le mode, la carte, la duree, le nombre de
 * joueurs et l'heure de fin sont les memes pour tous les joueurs d'une partie: ils
 * vivent une fois dans `parties`. Chaque compte y a sa ligne dans `resultats`,
 * avec ce qui lui est propre. Les recopier dans chaque resultat aurait permis a
 * deux resultats d'une meme partie de ne pas dire la meme carte.
 */

import { CARTES_ENREGISTREES, MODES } from '@neon-ninja/shared';
import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  date,
  foreignKey,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

/**
 * Les modes de jeu, tels que les connait @neon-ninja/shared.
 *
 * Un type enumere plutot qu'un texte libre: une partie ne peut pas etre
 * enregistree dans un mode qui n'existe pas. Ajouter un mode a MODES change ce
 * type, donc demande une migration, que la CI exige.
 */
export const modeDeJeu = pgEnum('mode_de_jeu', MODES);

/**
 * Les cartes qu'une partie enregistree peut porter. Meme raisonnement que pour les
 * modes, a une difference pres: la liste n'est pas celle des cartes jouables. Une
 * carte retiree du jeu reste dans l'enumeration, sans quoi les parties deja jouees
 * dessus deviendraient illisibles (etape 7.6: map2, Tokyo sans pluie, fondue dans
 * map1, garde sa valeur).
 */
export const carte = pgEnum('carte', CARTES_ENREGISTREES);

/** Horodatage avec fuseau: une heure de fin ne depend pas du fuseau du serveur. */
const horodatage = (nom: string) => timestamp(nom, { withTimezone: true });

/**
 * Un compte de joueur.
 *
 * Deux colonnes pour le pseudo. `pseudo` garde l'ecriture choisie, celle qu'on
 * affiche. `repere_pseudo` porte l'unicite: c'est reperePseudo de
 * @neon-ninja/shared, la meme fonction qui refuse deux pseudos identiques dans un
 * salon. La base ne recalcule pas elle-meme le repere (lower() de PostgreSQL ne
 * traite pas toutes les lettres comme toLowerCase de JavaScript): deux regles
 * d'unicite finiraient par ne pas refuser les memes pseudos.
 */
export const comptes = pgTable('comptes', {
  id: uuid('id').primaryKey().defaultRandom(),
  pseudo: text('pseudo').notNull(),
  reperePseudo: text('repere_pseudo').notNull().unique('comptes_repere_pseudo_unique'),
  creeLe: horodatage('cree_le').notNull().defaultNow(),
});

/**
 * Le mot de passe d'un compte, sous forme d'empreinte (etape 3.2).
 *
 * UNE TABLE A PART, ET NON UNE COLONNE DE `comptes`. Un compte n'a pas forcement
 * de mot de passe: le compte invisible par navigateur (voie C de la decision du
 * 11 septembre 2026) ou une connexion par un fournisseur tiers en creeraient sans.
 * Chacun de ces moyens d'identification aura sa table, et `comptes` reste ce qu'il
 * est: une identite, sans colonne vide selon la facon dont on s'y connecte.
 *
 * L'empreinte decrit sa propre recette (algorithme, parametres, sel): voir
 * comptes/motDePasse.ts. Jamais le mot de passe lui-meme.
 */
export const motsDePasse = pgTable('mots_de_passe', {
  compteId: uuid('compte_id')
    .primaryKey()
    .references(() => comptes.id, { onDelete: 'cascade' }),
  empreinte: text('empreinte').notNull(),
  modifieLe: horodatage('modifie_le').notNull().defaultNow(),
});

/**
 * Les sessions ouvertes (etape 3.2).
 *
 * La cle est l'EMPREINTE du jeton, jamais le jeton: qui lit cette table ne peut
 * pas s'en servir pour se connecter. Fermer une session, c'est effacer sa ligne.
 * Une session expiree n'ouvre plus rien, et les lignes expirees sont effacees a
 * l'ouverture des sessions suivantes, d'ou l'index sur l'expiration.
 */
export const sessions = pgTable(
  'sessions',
  {
    empreinteJeton: text('empreinte_jeton').primaryKey(),
    compteId: uuid('compte_id')
      .notNull()
      .references(() => comptes.id, { onDelete: 'cascade' }),
    creeLe: horodatage('cree_le').notNull().defaultNow(),
    expireLe: horodatage('expire_le').notNull(),
  },
  (table) => [
    index('sessions_par_compte').on(table.compteId),
    index('sessions_par_expiration').on(table.expireLe),
    check('sessions_expire_apres_creation', sql`${table.expireLe} > ${table.creeLe}`),
  ],
);

/**
 * Le code de secours d'un compte, sous forme d'empreinte (etape 3.4).
 *
 * Un seul par compte: chaque nouveau code remplace le precedent. Un compte cree
 * avant l'etape 3.4 n'en a pas tant qu'il n'en a pas demande un. L'empreinte est un
 * SHA-256 du code normalise, comme pour les jetons: le code, tire au hasard sur
 * quatre-vingts bits, ne se devine pas par essais. Voir comptes/codeDeSecours.ts.
 */
export const codesDeSecours = pgTable('codes_de_secours', {
  compteId: uuid('compte_id')
    .primaryKey()
    .references(() => comptes.id, { onDelete: 'cascade' }),
  empreinte: text('empreinte').notNull(),
  creeLe: horodatage('cree_le').notNull().defaultNow(),
});

/** La progression d'un compte. Une et une seule par compte, creee avec lui. */
export const progressions = pgTable(
  'progressions',
  {
    compteId: uuid('compte_id')
      .primaryKey()
      .references(() => comptes.id, { onDelete: 'cascade' }),
    xpTotale: integer('xp_totale').notNull().default(0),
    pieces: integer('pieces').notNull().default(0),
    pointsLigue: integer('points_ligue').notNull().default(0),
    misAJourLe: horodatage('mis_a_jour_le').notNull().defaultNow(),
  },
  (table) => [
    check('progressions_xp_positive', sql`${table.xpTotale} >= 0`),
    check('progressions_pieces_positives', sql`${table.pieces} >= 0`),
    check('progressions_points_ligue_positifs', sql`${table.pointsLigue} >= 0`),
  ],
);

/**
 * Une partie terminee, commune a tous ceux qui l'ont jouee.
 *
 * Le nombre de joueurs n'est pas le nombre de resultats: un joueur sans compte
 * joue la partie sans y laisser de resultat.
 */
export const parties = pgTable(
  'parties',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    mode: modeDeJeu('mode').notNull(),
    carte: carte('carte').notNull(),
    modeMiroir: boolean('mode_miroir').notNull(),
    dureeS: integer('duree_s').notNull(),
    nombreJoueurs: integer('nombre_joueurs').notNull(),
    termineeLe: horodatage('terminee_le').notNull(),
  },
  (table) => [
    check('parties_duree_positive', sql`${table.dureeS} > 0`),
    check('parties_au_moins_un_joueur', sql`${table.nombreJoueurs} >= 1`),
  ],
);

/**
 * Ce qu'un compte a fait dans une partie, et ce qu'il y a gagne.
 *
 * Supprimer un compte supprime ses resultats. Supprimer une partie qui a encore
 * des resultats est refuse: un resultat sans sa partie ne dirait plus ni la carte
 * ni le mode.
 */
export const resultats = pgTable(
  'resultats',
  {
    partieId: uuid('partie_id')
      .notNull()
      .references(() => parties.id, { onDelete: 'restrict' }),
    compteId: uuid('compte_id')
      .notNull()
      .references(() => comptes.id, { onDelete: 'cascade' }),
    placement: integer('placement').notNull(),
    points: integer('points').notNull(),
    captures: integer('captures').notNull(),
    botsNoirsDetruits: integer('bots_noirs_detruits').notNull(),
    xpGagnee: integer('xp_gagnee').notNull(),
    piecesGagnees: integer('pieces_gagnees').notNull(),
    /** Signee: une mauvaise partie fait perdre des points de ligue. */
    variationPointsLigue: integer('variation_points_ligue').notNull(),
  },
  (table) => [
    primaryKey({ name: 'resultats_partie_compte', columns: [table.partieId, table.compteId] }),
    index('resultats_par_compte').on(table.compteId),
    check('resultats_placement_positif', sql`${table.placement} >= 1`),
    check('resultats_points_positifs', sql`${table.points} >= 0`),
    check('resultats_captures_positives', sql`${table.captures} >= 0`),
    check('resultats_bots_noirs_positifs', sql`${table.botsNoirsDetruits} >= 0`),
    check('resultats_xp_positive', sql`${table.xpGagnee} >= 0`),
    check('resultats_pieces_positives', sql`${table.piecesGagnees} >= 0`),
  ],
);

/**
 * Les amities (etape 3.6): une ligne par paire d'amis.
 *
 * UNE AMITIE EST SYMETRIQUE: elle se stocke une fois, dans un ordre fixe, le plus
 * petit identifiant d'abord. Une contrainte l'impose, si bien que la meme amitie ne
 * peut pas exister deux fois, dans un sens puis dans l'autre. Les amis d'un compte se
 * lisent dans les deux colonnes: la cle primaire sert la premiere, un index la seconde.
 */
export const amities = pgTable(
  'amities',
  {
    compteA: uuid('compte_a')
      .notNull()
      .references(() => comptes.id, { onDelete: 'cascade' }),
    compteB: uuid('compte_b')
      .notNull()
      .references(() => comptes.id, { onDelete: 'cascade' }),
    creeeLe: horodatage('creee_le').notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ name: 'amities_paire', columns: [table.compteA, table.compteB] }),
    index('amities_par_compte_b').on(table.compteB),
    check('amities_dans_l_ordre', sql`${table.compteA} < ${table.compteB}`),
  ],
);

/**
 * Les demandes d'ami en attente (etape 3.6): dirigees, de celui qui demande a celui
 * qui repondra.
 *
 * Une demande acceptee, refusee ou annulee est effacee: il n'y a pas de statut, et
 * aucune trace d'un refus, qui est silencieux. Les demandes recues se lisent par
 * l'index sur le destinataire.
 */
export const demandesDAmi = pgTable(
  'demandes_d_ami',
  {
    de: uuid('de')
      .notNull()
      .references(() => comptes.id, { onDelete: 'cascade' }),
    pour: uuid('pour')
      .notNull()
      .references(() => comptes.id, { onDelete: 'cascade' }),
    creeeLe: horodatage('creee_le').notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ name: 'demandes_d_ami_paire', columns: [table.de, table.pour] }),
    index('demandes_d_ami_par_destinataire').on(table.pour),
    check('demandes_d_ami_pas_a_soi', sql`${table.de} <> ${table.pour}`),
  ],
);

/**
 * Les blocages (etape 3.6): diriges, de celui qui bloque a celui qui est bloque.
 *
 * Le bloque n'en sait rien: ses demandes au bloqueur s'enregistrent encore dans
 * demandes_d_ami, et c'est la lecture qui les ignore. Voir comptes/amities.ts.
 */
export const blocages = pgTable(
  'blocages',
  {
    bloqueur: uuid('bloqueur')
      .notNull()
      .references(() => comptes.id, { onDelete: 'cascade' }),
    bloque: uuid('bloque')
      .notNull()
      .references(() => comptes.id, { onDelete: 'cascade' }),
    creeLe: horodatage('cree_le').notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ name: 'blocages_paire', columns: [table.bloqueur, table.bloque] }),
    check('blocages_pas_de_soi', sql`${table.bloqueur} <> ${table.bloque}`),
  ],
);

/**
 * Les succes debloques (etape 3.7): une ligne par compte et par succes obtenu.
 *
 * L'IDENTIFIANT DU SUCCES EST UN TEXTE, PAS UNE ENUMERATION. Les succes sont definis
 * dans le code (packages/shared/src/succes.ts): en ajouter un ne demande pas de
 * migration, et un succes retire reste lisible. La lecture ignore un identifiant que le
 * code ne connait plus. Seule sa forme est controlee ici.
 *
 * DATE ET PARTIE SONT CELLES DE L'ORIGINE: la fin de la partie apres laquelle le succes
 * etait atteint pour la premiere fois, meme s'il s'inscrit plus tard (rattrapage).
 * Supprimer un compte supprime ses succes. La partie, elle, ne se supprime pas tant
 * qu'elle a des resultats: si elle disparaissait, le succes resterait, sans sa partie.
 */
export const succesDebloques = pgTable(
  'succes_debloques',
  {
    compteId: uuid('compte_id')
      .notNull()
      .references(() => comptes.id, { onDelete: 'cascade' }),
    succes: text('succes').notNull(),
    debloqueLe: horodatage('debloque_le').notNull(),
    partieId: uuid('partie_id').references(() => parties.id, { onDelete: 'set null' }),
  },
  (table) => [
    primaryKey({ name: 'succes_debloques_compte_succes', columns: [table.compteId, table.succes] }),
    check('succes_debloques_identifiant', sql`${table.succes} ~ '^[a-z0-9]+(-[a-z0-9]+)*$'`),
    check('succes_debloques_longueur', sql`char_length(${table.succes}) <= 40`),
  ],
);

/**
 * Le titre d'un compte (etape 3.9): un succes obtenu, qu'il a choisi d'afficher sous son
 * pseudo, au salon et sur sa fiche. Une ligne par compte qui en porte un.
 *
 * UNE TABLE A PART, ET NON UNE COLONNE DE `comptes`, comme le mot de passe: un compte
 * reste une identite, sans colonne vide selon ce qu'il a choisi.
 *
 * C'EST LA BASE QUI GARANTIT QU'UN TITRE EST UN SUCCES OBTENU. La cle etrangere porte sur
 * le couple (compte, succes) de `succes_debloques`: un titre non obtenu ne peut pas
 * s'ecrire, quoi que fasse le service. Elle est en cascade: un succes efface emporte le
 * titre qu'il donnait, et un compte supprime, ses succes, donc son titre.
 */
export const titres = pgTable(
  'titres',
  {
    compteId: uuid('compte_id').primaryKey(),
    succes: text('succes').notNull(),
  },
  (table) => [
    foreignKey({
      name: 'titres_succes_obtenu',
      columns: [table.compteId, table.succes],
      foreignColumns: [succesDebloques.compteId, succesDebloques.succes],
    }).onDelete('cascade'),
  ],
);

/**
 * Les faits de partie (etape 3.8): ce que le serveur a releve d'un compte pendant une
 * partie, et que son resultat ne dit pas. Une ligne par fait non nul: les Evades
 * attrapes, le plus haut multiplicateur, « jamais pris » en Horde. Les exploits et les
 * secrets s'en deduisent, comme les autres succes se deduisent des resultats.
 *
 * UNE TABLE A PART, ET NON DES COLONNES DE `resultats`: un fait de plus ne demande pas
 * de migration (schema de l'etape 3.1). L'identifiant du fait est un texte, controle
 * par sa forme seulement, comme celui d'un succes: la lecture ignore un fait que le
 * code ne connait plus.
 *
 * UN FAIT APPARTIENT A UN RESULTAT. La cle etrangere porte sur le couple (partie,
 * compte) de `resultats`, en cascade: un fait ne s'ecrit pas sans le resultat de son
 * compte, et supprimer un compte supprime ses resultats, donc ses faits. Les faits d'un
 * compte se lisent par l'index sur le compte, avec son historique.
 */
export const faitsDePartie = pgTable(
  'faits_de_partie',
  {
    partieId: uuid('partie_id').notNull(),
    compteId: uuid('compte_id').notNull(),
    fait: text('fait').notNull(),
    valeur: integer('valeur').notNull(),
  },
  (table) => [
    primaryKey({
      name: 'faits_de_partie_partie_compte_fait',
      columns: [table.partieId, table.compteId, table.fait],
    }),
    foreignKey({
      name: 'faits_de_partie_resultat',
      columns: [table.partieId, table.compteId],
      foreignColumns: [resultats.partieId, resultats.compteId],
    }).onDelete('cascade'),
    index('faits_de_partie_par_compte').on(table.compteId),
    check('faits_de_partie_identifiant', sql`${table.fait} ~ '^[a-z][a-zA-Z0-9]*$'`),
    check('faits_de_partie_longueur', sql`char_length(${table.fait}) <= 40`),
    check('faits_de_partie_valeur_positive', sql`${table.valeur} > 0`),
  ],
);

/**
 * Les defis releves (etape 3.10): une ligne par compte, par semaine et par defi releve.
 *
 * LES DEFIS DE LA SEMAINE NE SONT PAS ICI. Ils se tirent de la semaine seule, par le
 * paquet partage (defisDeLaSemaine): seul ce qu'un compte a releve s'ecrit.
 *
 * LA CLE (compte, semaine, defi) EMPECHE DE TOUCHER DEUX FOIS UNE RECOMPENSE. L'XP versee
 * s'ecrit avec le defi: une recompense peut changer, l'historique dit ce qui a ete verse.
 * L'identifiant du defi est un texte, controle par sa forme seulement, comme celui d'un
 * succes: en ajouter un ne demande pas de migration, et la lecture ignore un defi retire.
 *
 * LA PARTIE EST CELLE QUI L'A RELEVE. C'est par elle qu'un reessai d'enregistrement
 * retrouve les defis deja verses, et que le pli des succes compte leur XP avec elle.
 * Supprimer un compte supprime ses defis; la partie ne se supprime pas tant qu'elle a
 * des resultats.
 */
export const defisReleves = pgTable(
  'defis_releves',
  {
    compteId: uuid('compte_id')
      .notNull()
      .references(() => comptes.id, { onDelete: 'cascade' }),
    /** Le lundi de la semaine, a l'heure de Paris. */
    semaine: date('semaine', { mode: 'string' }).notNull(),
    defi: text('defi').notNull(),
    xp: integer('xp').notNull(),
    releveLe: horodatage('releve_le').notNull(),
    partieId: uuid('partie_id').references(() => parties.id, { onDelete: 'set null' }),
  },
  (table) => [
    primaryKey({
      name: 'defis_releves_compte_semaine_defi',
      columns: [table.compteId, table.semaine, table.defi],
    }),
    index('defis_releves_par_partie').on(table.partieId),
    check('defis_releves_identifiant', sql`${table.defi} ~ '^[a-z0-9]+(-[a-z0-9]+)*$'`),
    check('defis_releves_longueur', sql`char_length(${table.defi}) <= 40`),
    check('defis_releves_xp_positive', sql`${table.xp} >= 0`),
    check('defis_releves_un_lundi', sql`extract(isodow from ${table.semaine}) = 1`),
  ],
);
