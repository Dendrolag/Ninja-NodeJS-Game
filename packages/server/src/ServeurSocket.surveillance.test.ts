/**
 * Tests d'integration de la surveillance de la production (etape 5.15), avec de vrais
 * clients Socket.IO contre un vrai serveur.
 *
 * Ce qu'ils protegent: la route /metriques n'existe que si on la demande, sur l'interface
 * locale seulement, jamais sur le port public; ses chiffres suivent une partie jouee
 * (battements, phases, octets, bulletins); un battement lent et une page qui saccade
 * s'ecrivent dans le journal avec leur contexte; et la ligne de chaque partie, toutes les
 * dix secondes, donne son verdict.
 *
 * Meme cadre que ServeurSocket.horde.test.ts: une horloge manuelle pour le temps du jeu,
 * des attentes explicites pour celui du reseau.
 */

import { networkInterfaces } from 'node:os';

import type {
  BulletinDePage,
  DemandeCreation,
  EvenementsClientVersServeur,
  EvenementsServeurVersClient,
  InfosSalon,
  ResultatValidation,
} from '@neon-ninja/shared';
import { CARTES, coderLeBulletin } from '@neon-ninja/shared';
import { carteSansMur } from '@neon-ninja/sim';
import type { Socket as SocketClient } from 'socket.io-client';
import { io as connecter } from 'socket.io-client';
import { afterEach, describe, expect, it } from 'vitest';

import type { Horloge, HorlogeManuelle } from './horloge.js';
import { creerHorlogeManuelle } from './horloge.js';
import type { ServeurMonte } from './serveur.js';
import { demarrerServeur } from './serveur.js';
import type { JournalEnMemoire } from './surveillance/journal.js';
import { creerJournalEnMemoire } from './surveillance/journal.js';
import { SurveillanceDuJeu } from './surveillance/surveillanceDuJeu.js';

/** Un client de test: les contrats sont vus a l'envers de ceux du serveur. */
type ClientTypee = SocketClient<EvenementsServeurVersClient, EvenementsClientVersServeur>;

/** Delai au-dela duquel on considere qu'un message attendu ne viendra pas. */
const DELAI_ATTENTE_MS = 3000;

/** Une Horde de dix minutes, trente faux ninjas, sur la petite carte. */
const PARTIE: DemandeCreation['configuration'] = {
  mode: 'classique',
  visibilite: 'publique',
  reglages: { carte: 'map1', dureePartieS: 600, nombreBotsInitial: 30 },
};

/** Un bulletin de dix secondes sans histoire. */
const BULLETIN_CALME: BulletinDePage = {
  images: {
    cases: [0, 600, 0, 0, 0, 0, 0, 0],
    sommeMs: 10_000,
    lentes: 0,
    tresLentes: 0,
    cachees: 0,
    tenues: 2,
  },
  lentes: { notreCodeMs: 0, pixiMs: 0, resteMs: 0 },
  pire: { dureeMs: 18, notreCodeMs: 2, pixiMs: 1 },
  instantanes: { cases: [0, 200, 0, 0, 0, 0, 0, 0], sommeMs: 10_000, enRetard: 0, ecartMaxMs: 52 },
  allersRetoursMs: [40, 45],
  entites: 31,
  son: false,
  erreurs: { script: 0, promesse: 0 },
};

/** Un bulletin d'une page qui rame: une image de 180 ms, et un dixieme d'images lentes. */
const BULLETIN_SACCADE: BulletinDePage = {
  ...BULLETIN_CALME,
  images: {
    ...BULLETIN_CALME.images,
    cases: [0, 500, 0, 0, 0, 50, 10, 0],
    lentes: 60,
    tresLentes: 10,
  },
  lentes: { notreCodeMs: 300, pixiMs: 900, resteMs: 3000 },
  pire: { dureeMs: 180, notreCodeMs: 12, pixiMs: 40 },
};

let serveur: ServeurMonte | undefined;
const clients: ClientTypee[] = [];

afterEach(async () => {
  for (const client of clients.splice(0)) {
    client.disconnect();
  }

  await serveur?.fermer();
  serveur = undefined;
});

/** Le port public d'un serveur monte. */
function portPublic(monte: ServeurMonte): number {
  const adresse = monte.http.address();
  if (typeof adresse !== 'object' || adresse === null) {
    throw new Error("Le serveur de test n'a pas d'adresse.");
  }
  return adresse.port;
}

/**
 * Une horloge manuelle qu'on peut ralentir: chaque lecture avance alors de tant de
 * millisecondes, comme si le battement prenait ce temps a chaque etape.
 */
function horlogeRalentissable(manuelle: HorlogeManuelle): Horloge & { ralentir(ms: number): void } {
  let decalage = 0;
  let parLecture = 0;

  return {
    maintenant: () => {
      decalage += parLecture;
      return manuelle.maintenant() + decalage;
    },
    repeter: (rappel, intervalleMs) => manuelle.repeter(rappel, intervalleMs),
    ralentir: (ms) => {
      parLecture = ms;
    },
  };
}

/** Monte un serveur surveille, avec sa route des metriques sur un port libre. */
async function monterSurveille(): Promise<{
  readonly manuelle: HorlogeManuelle;
  readonly horloge: ReturnType<typeof horlogeRalentissable>;
  readonly journal: JournalEnMemoire;
  readonly surveillance: SurveillanceDuJeu;
  readonly port: number;
}> {
  const manuelle = creerHorlogeManuelle();
  const horloge = horlogeRalentissable(manuelle);
  const journal = creerJournalEnMemoire();
  const surveillance = new SurveillanceDuJeu({
    version: 'essai',
    horloge,
    journal,
    processus: false,
    date: () => Date.UTC(2026, 9, 12),
  });

  serveur = await demarrerServeur(0, {
    horloge,
    terrains: { charger: ({ carte }) => carteSansMur(CARTES[carte]) },
    surveillance,
    portDesMetriques: 0,
  });

  return { manuelle, horloge, journal, surveillance, port: portPublic(serveur) };
}

/** Lit les metriques par la route locale. */
async function lireLesMetriques(): Promise<string> {
  const port = serveur?.metriques?.port;
  if (port === undefined) {
    throw new Error("La route des metriques n'est pas ouverte.");
  }
  return (await fetch(`http://127.0.0.1:${String(port)}/metriques`)).text();
}

/** La valeur d'une serie dans le texte des metriques, ou rien. */
function valeur(texte: string, serie: string): number | undefined {
  const ligne = texte.split('\n').find((candidate) => candidate.startsWith(`${serie} `));
  return ligne === undefined ? undefined : Number(ligne.slice(serie.length + 1));
}

/** Ouvre une connexion cliente et attend qu'elle soit etablie. */
async function connecterUnClient(port: number): Promise<ClientTypee> {
  const client: ClientTypee = connecter(`http://localhost:${String(port)}`, {
    transports: ['websocket'],
    forceNew: true,
  });
  clients.push(client);

  await new Promise<void>((resoudre, rejeter) => {
    const minuterie = setTimeout(() => {
      rejeter(new Error('La connexion du client n a pas abouti.'));
    }, DELAI_ATTENTE_MS);
    client.on('connect', () => {
      clearTimeout(minuterie);
      resoudre();
    });
  });

  return client;
}

/** Attend le prochain message de ce nom. */
async function prochain(
  client: ClientTypee,
  nom: keyof EvenementsServeurVersClient,
): Promise<void> {
  return new Promise((resoudre, rejeter) => {
    const minuterie = setTimeout(() => {
      rejeter(new Error(`Aucun message « ${String(nom)} » n est arrive.`));
    }, DELAI_ATTENTE_MS);
    client.once(nom, (() => {
      clearTimeout(minuterie);
      resoudre();
    }) as never);
  });
}

/** Attend que cette condition soit remplie. */
async function jusquA(condition: () => boolean | Promise<boolean>): Promise<void> {
  const limite = Date.now() + DELAI_ATTENTE_MS;

  while (!(await condition())) {
    if (Date.now() > limite) {
      throw new Error("La condition attendue n'a jamais ete remplie.");
    }
    await new Promise((resoudre) => setTimeout(resoudre, 5));
  }
}

/** Cree une partie, la lance, et rend le client hote et l'identifiant de la partie. */
async function jouerUnePartie(
  port: number,
  manuelle: HorlogeManuelle,
): Promise<{ readonly hote: ClientTypee; readonly idRoom: string }> {
  const hote = await connecterUnClient(port);
  const reponse = await new Promise<ResultatValidation<InfosSalon>>((resoudre) => {
    hote.emit('creerPartie', { pseudo: 'Remi', configuration: PARTIE }, resoudre);
  });

  if (!reponse.valide) {
    throw new Error('La partie n a pas ete creee.');
  }

  const lancee = prochain(hote, 'partieLancee');
  const decompte = prochain(hote, 'compteARebours');
  hote.emit('demarrer');
  await decompte;
  manuelle.avancerDe(5000);
  await lancee;

  return { hote, idRoom: reponse.valeur.idRoom };
}

describe('la route des metriques', () => {
  it('n existe pas sans surveillance: aucun port de plus, et rien sur le port public', async () => {
    serveur = await demarrerServeur(0);

    expect(serveur.metriques).toBeUndefined();
    const reponse = await fetch(`http://127.0.0.1:${String(portPublic(serveur))}/metriques`);
    expect(reponse.status).toBe(404);
  });

  it('ecoute sur 127.0.0.1 seulement, et jamais sur le port public', async () => {
    const { port } = await monterSurveille();
    const metriques = serveur?.metriques?.port ?? 0;

    expect(metriques).toBeGreaterThan(0);
    expect(metriques).not.toBe(port);
    expect(await lireLesMetriques()).toContain('neon_demarrage_secondes{version="essai"}');
    expect((await fetch(`http://127.0.0.1:${String(port)}/metriques`)).status).toBe(404);
    expect((await fetch(`http://127.0.0.1:${String(metriques)}/autre`)).status).toBe(404);

    // Par une adresse de la machine qui n'est pas l'interface locale, rien ne repond.
    const externe = Object.values(networkInterfaces())
      .flat()
      .find((interfaceReseau) => interfaceReseau?.family === 'IPv4' && !interfaceReseau.internal);

    if (externe !== undefined) {
      await expect(
        fetch(`http://${externe.address}:${String(metriques)}/metriques`, {
          signal: AbortSignal.timeout(2000),
        }),
      ).rejects.toThrow();
    }
  });
});

describe('les chiffres d une partie jouee', () => {
  it('suivent les battements, leurs phases, les octets et les bulletins', async () => {
    const { manuelle, port } = await monterSurveille();
    const { hote } = await jouerUnePartie(port, manuelle);

    manuelle.avancerDe(1000);
    let texte = await lireLesMetriques();

    expect(
      valeur(texte, 'neon_battements_total{mode="classique",version="essai"}'),
    ).toBeGreaterThanOrEqual(20);
    expect(valeur(texte, 'neon_battements_en_retard_total{mode="classique",version="essai"}')).toBe(
      0,
    );
    for (const phase of ['moteur', 'vues', 'codage', 'envoi']) {
      expect(
        valeur(texte, `neon_battement_phase_ms_count{phase="${phase}",version="essai"}`),
      ).toBeGreaterThanOrEqual(20);
    }
    expect(
      valeur(texte, 'neon_octets_envoyes_total{mode="classique",version="essai"}'),
    ).toBeGreaterThan(0);
    expect(texte).toMatch(
      /neon_battement_duree_ms_count\{mode="classique",carte="map1",charge="0-50",version="essai"\} \d+/u,
    );
    expect(valeur(texte, 'neon_parties{mode="classique",statut="enCours",version="essai"}')).toBe(
      1,
    );
    expect(valeur(texte, 'neon_joueurs{mode="classique",version="essai"}')).toBe(1);
    expect(valeur(texte, 'neon_connexions{transport="websocket",version="essai"}')).toBe(1);

    // La sonde: l'accuse revient aussitot.
    await new Promise<void>((resoudre) => {
      hote.emit('sonde', resoudre);
    });

    hote.emit('appareil', {
      appareil: 'telephone',
      navigateur: 'safari',
      moteur: 'webgl',
      largeur: 390,
      hauteur: 844,
      densite: 3,
    });
    hote.emit('bulletin', coderLeBulletin(BULLETIN_CALME));
    // Trop tot apres le precedent, puis mal forme.
    hote.emit('bulletin', coderLeBulletin(BULLETIN_CALME));
    hote.emit('bulletin', [7, 1, 2]);
    hote.emit(
      'bulletin',
      Array.from({ length: 2000 }, () => 1),
    );

    await jusquA(async () => {
      texte = await lireLesMetriques();
      return valeur(texte, 'neon_bulletins_total{issue="trop_gros",version="essai"}') === 1;
    });

    expect(valeur(texte, 'neon_bulletins_total{issue="accepte",version="essai"}')).toBe(1);
    expect(valeur(texte, 'neon_bulletins_total{issue="trop_frequent",version="essai"}')).toBe(1);
    expect(valeur(texte, 'neon_bulletins_total{issue="mal_forme",version="essai"}')).toBe(1);
    expect(
      valeur(
        texte,
        'neon_page_images_total{appareil="telephone",navigateur="safari",version="essai"}',
      ),
    ).toBe(600);
    expect(
      valeur(
        texte,
        'neon_page_instantanes_total{appareil="telephone",navigateur="safari",version="essai"}',
      ),
    ).toBe(200);
    expect(
      valeur(
        texte,
        'neon_page_aller_retour_ms_count{appareil="telephone",navigateur="safari",version="essai"}',
      ),
    ).toBe(2);
    expect(
      valeur(
        texte,
        'neon_page_appareils_total{appareil="telephone",navigateur="safari",moteur="webgl",version="essai"}',
      ),
    ).toBe(1);

    // Dix secondes plus tard, le bulletin suivant passe.
    manuelle.avancerDe(10_000);
    hote.emit('bulletin', coderLeBulletin(BULLETIN_CALME));
    await jusquA(
      async () =>
        valeur(
          await lireLesMetriques(),
          'neon_bulletins_total{issue="accepte",version="essai"}',
        ) === 2,
    );
  });

  it('ignore le bulletin d une connexion qui ne joue pas', async () => {
    const { port } = await monterSurveille();
    const client = await connecterUnClient(port);

    client.emit('bulletin', coderLeBulletin(BULLETIN_CALME));

    await jusquA(
      async () =>
        valeur(
          await lireLesMetriques(),
          'neon_bulletins_total{issue="hors_partie",version="essai"}',
        ) === 1,
    );
  });
});

describe('le journal', () => {
  it('ecrit un battement lent force, avec ses phases et son contexte', async () => {
    const { manuelle, horloge, journal, port } = await monterSurveille();
    const { idRoom } = await jouerUnePartie(port, manuelle);

    // Chaque lecture d'horloge prend dix millisecondes: le battement en dure des dizaines.
    horloge.ralentir(10);
    manuelle.avancerDe(50);
    horloge.ralentir(0);

    const episode = journal.lignes.find((ligne) => ligne['type'] === 'episode');

    expect(episode).toMatchObject({
      origine: 'serveur',
      partie: idRoom,
      mode: 'classique',
      carte: 'map1',
      pnj: 30,
      joueurs: 1,
      instant: '2026-10-12T00:00:00.000Z',
    });
    expect(episode?.['dureeMs']).toBeGreaterThanOrEqual(25);
    expect(Object.keys(episode?.['phasesMs'] as object)).toEqual([
      'moteur',
      'vues',
      'codage',
      'envoi',
    ]);

    // Un second battement lent dans la minute n'est que compte.
    horloge.ralentir(10);
    manuelle.avancerDe(50);
    horloge.ralentir(0);

    expect(journal.lignes.filter((ligne) => ligne['type'] === 'episode')).toHaveLength(1);
    const texte = await lireLesMetriques();
    expect(valeur(texte, 'neon_episodes_total{origine="serveur",version="essai"}')).toBe(1);
    expect(valeur(texte, 'neon_episodes_ignores_total{origine="serveur",version="essai"}')).toBe(1);
  });

  it('ecrit la saccade d une page, puis la ligne de sa partie avec son verdict', async () => {
    const { manuelle, journal, port } = await monterSurveille();
    const { hote, idRoom } = await jouerUnePartie(port, manuelle);

    hote.emit('appareil', {
      appareil: 'ordinateur',
      navigateur: 'firefox',
      moteur: 'webgl',
      largeur: 1920,
      hauteur: 1080,
      densite: 1,
    });
    hote.emit('bulletin', coderLeBulletin(BULLETIN_SACCADE));
    await jusquA(() => journal.lignes.some((ligne) => ligne['origine'] === 'page'));

    expect(journal.lignes.find((ligne) => ligne['origine'] === 'page')).toMatchObject({
      type: 'episode',
      partie: idRoom,
      joueur: 'Remi',
      appareil: { appareil: 'ordinateur', navigateur: 'firefox' },
      pireImage: { dureeMs: 180, notreCodeMs: 12, pixiMs: 40 },
      imagesLentes: 60,
      serveur: { pnj: 30, joueurs: 1 },
    });

    // La ligne de la partie part toutes les dix secondes.
    manuelle.avancerDe(10_000);

    expect(journal.lignes.find((ligne) => ligne['type'] === 'partie')).toMatchObject({
      partie: idRoom,
      mode: 'classique',
      carte: 'map1',
      joueurs: 1,
      pnj: 30,
      verdict: 'page',
      pireJoueur: { pseudo: 'Remi', imagesLentesPourCent: 10.7 },
    });
  });
});
