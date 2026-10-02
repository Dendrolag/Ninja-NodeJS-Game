/**
 * La connexion a la base, et les deux adresses d'une meme base Neon.
 *
 * LE SERVEUR PASSE PAR LE POOLER. Neon place devant chaque base un repartiteur de
 * connexions: le serveur y ouvre ses connexions, et le pooler les partage entre
 * beaucoup de clients. Son adresse ne differe de l'adresse directe que par le
 * suffixe `-pooler` du premier segment de l'hote.
 *
 * LES MIGRATIONS PASSENT EN DIRECT. Neon le recommande: certaines operations de
 * migration supportent mal le partage des connexions du pooler. D'ou les deux
 * fonctions qui passent d'une adresse a l'autre, pour ne demander qu'une seule
 * variable d'environnement.
 *
 * UNE CONNEXION AU REPOS PEUT ETRE COUPEE PAR LA BASE. Neon met en veille une base
 * inactive depuis quelques minutes, et ferme alors les connexions ouvertes. Le
 * pilote pg le signale par un evenement d'erreur sur le groupe de connexions: non
 * ecoute, cet evenement ferait tomber tout le serveur. Il est donc journalise, et
 * la prochaine requete ouvre une connexion neuve.
 *
 * UNE CONNEXION QUI NE REPOND PAS EST ABANDONNEE (etape 8.8). Sans delai, le pilote
 * attend indefiniment une base muette: le 2 octobre 2026, une mise en ligne est restee
 * quinze minutes dans ses migrations, jusqu'a ce que Render l'abandonne. Passe
 * DELAI_DE_CONNEXION_MS, l'ouverture echoue, et l'appelant decide: reessayer, ou
 * s'arreter en le disant.
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import pg from 'pg';

import * as schema from './schema.js';

/** La base, vue par le code du serveur: des requetes typees sur le schema. */
export type BaseDeDonnees = NodePgDatabase<typeof schema>;

/** Une base ouverte, et de quoi la refermer. */
export interface BaseOuverte {
  readonly db: BaseDeDonnees;
  /** Ferme toutes les connexions. A appeler une fois, en fin de vie. */
  fermer(): Promise<void>;
}

/**
 * Combien de temps attendre qu'une connexion s'ouvre, en millisecondes. Une base Neon
 * en veille se reveille en quelques secondes: vingt laissent une large marge.
 */
export const DELAI_DE_CONNEXION_MS = 20_000;

/** Ce qui se regle a l'ouverture. */
export interface OptionsBase {
  /** Nombre maximal de connexions ouvertes en meme temps. 10 par defaut. */
  readonly maximumConnexions?: number;
  /** Delai d'ouverture d'une connexion. DELAI_DE_CONNEXION_MS par defaut. */
  readonly delaiDeConnexionMs?: number;
}

/** Ouvre un groupe de connexions vers la base a cette adresse. */
export function ouvrirBase(adresse: string, options: OptionsBase = {}): BaseOuverte {
  const groupe = new pg.Pool({
    connectionString: adresseChiffree(adresse),
    max: options.maximumConnexions ?? 10,
    connectionTimeoutMillis: options.delaiDeConnexionMs ?? DELAI_DE_CONNEXION_MS,
  });

  groupe.on('error', (erreur) => {
    console.error('Une connexion a la base au repos a ete coupee:', erreur.message);
  });

  return {
    db: drizzle({ client: groupe, schema }),
    fermer: () => groupe.end(),
  };
}

/** L'adresse directe d'une base Neon, a partir de son adresse par le pooler. */
export function adresseDirecte(adresse: string): string {
  const url = new URL(adresse);
  url.hostname = url.hostname.replace(/^([^.]+)-pooler\./u, '$1.');

  return url.toString();
}

/**
 * L'adresse, avec un chiffrement dont le certificat est explicitement verifie.
 *
 * Neon donne des adresses en `sslmode=require`. Le pilote pg les traite
 * aujourd'hui comme `verify-full`: la connexion est chiffree ET le certificat du
 * serveur est verifie, ce qui empeche un tiers de se faire passer pour la base. Il
 * annonce que sa prochaine version majeure les traitera comme le fait libpq:
 * chiffre, sans verifier le certificat. Ecrire `verify-full` garde la protection
 * d'aujourd'hui apres cette mise a jour.
 */
export function adresseChiffree(adresse: string): string {
  const url = new URL(adresse);

  if (url.searchParams.get('sslmode') === 'require') {
    url.searchParams.set('sslmode', 'verify-full');
  }

  return url.toString();
}

/** L'adresse par le pooler d'une base Neon, a partir de son adresse directe. */
export function adressePooler(adresse: string): string {
  const url = new URL(adresse);

  if (!/^[^.]+-pooler\./u.test(url.hostname)) {
    url.hostname = url.hostname.replace(/^([^.]+)\./u, '$1-pooler.');
  }

  return url.toString();
}
