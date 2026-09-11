/**
 * Le schema de la base: les comptes, leur progression, et les parties jouees.
 *
 * C'EST LA SOURCE DES MIGRATIONS. Les fichiers SQL de packages/server/migrations
 * sont ecrits par drizzle-kit a partir de ce fichier (`pnpm base:generer`), jamais
 * a la main. La CI regenere les migrations et echoue si ce fichier a change sans
 * elles: le schema decrit ici et la base reelle ne peuvent pas diverger en silence.
 *
 * CE QUI SE DEDUIT NE SE STOCKE PAS (cadrage de l'etape 0.3, section 5). La
 * progression garde l'XP totale, les pieces et les points de ligue; le niveau et
 * le palier de rang s'en deduisent par des fonctions pures, a l'etape 3.3. Meme
 * principe que le score depuis le 14 aout 2026.
 *
 * CE QUI N'EST PAS ICI, VOLONTAIREMENT. Ni gemmes, ni defis du jour, ni pass de
 * saison, ni skins, ni clans. Chacun s'ajoutera par de nouvelles tables qui
 * referencent le compte, sans colonne ajoutee a celles-ci. C'est deja le cas de
 * l'etape 3.2: le mot de passe et les sessions ont chacun leur table.
 *
 * DEUX TABLES POUR UNE PARTIE JOUEE. Le mode, la carte, la duree, le nombre de
 * joueurs et l'heure de fin sont les memes pour tous les joueurs d'une partie: ils
 * vivent une fois dans `parties`. Chaque compte y a sa ligne dans `resultats`,
 * avec ce qui lui est propre. Les recopier dans chaque resultat aurait permis a
 * deux resultats d'une meme partie de ne pas dire la meme carte.
 */

import type { IdentifiantCarte } from '@neon-ninja/shared';
import { CARTES, MODES } from '@neon-ninja/shared';
import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
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
 * Les cartes jouables. Meme raisonnement que pour les modes.
 *
 * Les cles de CARTES sont exactement les identifiants de carte: le type le
 * garantit (IdentifiantCarte est keyof typeof CARTES). Object.keys ne sait pas le
 * dire au compilateur, d'ou la conversion.
 */
export const carte = pgEnum(
  'carte',
  Object.keys(CARTES) as [IdentifiantCarte, ...IdentifiantCarte[]],
);

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
