/**
 * Tests d'integration de la couche reseau avec des comptes (etape 3.2).
 *
 * De vrais clients Socket.IO contre un vrai serveur, comme ServeurSocket.test.ts,
 * mais avec un annuaire des comptes EN MEMOIRE: ces tests verifient ce que la
 * couche reseau fait de ses reponses (qui entre, sous quel pseudo, quels refus),
 * pas la base. Le meme parcours contre une vraie base est dans
 * tests/base/authentification.test.ts.
 */

import type {
  EvenementsClientVersServeur,
  EvenementsServeurVersClient,
  InfosSalon,
  ResultatValidation,
} from '@neon-ninja/shared';
import { reperePseudo } from '@neon-ninja/shared';
import type { Socket as SocketClient } from 'socket.io-client';
import { io as connecter } from 'socket.io-client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { IdentiteDeCompte, ServiceDeComptes } from './comptes/annuaire.js';
import { creerHorlogeManuelle } from './horloge.js';
import type { ServeurMonte } from './serveur.js';
import { demarrerServeur } from './serveur.js';

/** Un client de test: les contrats sont vus a l'envers de ceux du serveur. */
type ClientTypee = SocketClient<EvenementsServeurVersClient, EvenementsClientVersServeur>;

/** Delai au-dela duquel on considere qu'un message attendu ne viendra pas. */
const DELAI_ATTENTE_MS = 3000;

/** Le jeton de la session d'Alice, compte de niveau 7. */
const JETON_ALICE = 'A'.repeat(43);

/** Un jeton bien forme, qui n'ouvre aucune session. */
const JETON_INCONNU = 'Z'.repeat(43);

/** Un annuaire en memoire, que chaque test peut derегler. */
interface AnnuaireDEssai extends ServiceDeComptes {
  readonly comptes: Map<string, IdentiteDeCompte>;
  /** Toute question leve une erreur, comme une base injoignable. */
  panne: boolean;
  /** Chaque question met ce temps a repondre, en millisecondes reelles. */
  delaiMs: number;
}

/** Un annuaire qui connait Alice, et la session JETON_ALICE. */
function annuaireDEssai(): AnnuaireDEssai {
  const sessions = new Map([[JETON_ALICE, 'compte-alice']]);
  const nonUtilise = async (): Promise<never> => {
    throw new Error('Les routes HTTP ne sont pas utilisees par ces tests.');
  };

  const annuaire: AnnuaireDEssai = {
    comptes: new Map([['compte-alice', { pseudo: 'Alice', niveau: 7 }]]),
    panne: false,
    delaiMs: 0,
    compteDeSession: async (jeton) => {
      await repondre();
      return sessions.get(jeton);
    },
    identiteDe: async (compteId) => {
      await repondre();
      return annuaire.comptes.get(compteId);
    },
    pseudoDeCompte: async (pseudo) => {
      await repondre();
      return [...annuaire.comptes.values()].some(
        (compte) => reperePseudo(compte.pseudo) === reperePseudo(pseudo),
      );
    },
    inscrire: nonUtilise,
    connecter: nonUtilise,
    deconnecter: nonUtilise,
    maProgression: nonUtilise,
  };

  async function repondre(): Promise<void> {
    if (annuaire.delaiMs > 0) {
      await new Promise((resoudre) => setTimeout(resoudre, annuaire.delaiMs));
    }

    if (annuaire.panne) {
      throw new Error('base injoignable');
    }
  }

  return annuaire;
}

let serveur: ServeurMonte | undefined;
let url = '';
const clients: ClientTypee[] = [];

afterEach(async () => {
  for (const client of clients.splice(0)) {
    client.disconnect();
  }

  await serveur?.fermer();
  serveur = undefined;
  vi.restoreAllMocks();
});

/** Monte un serveur, avec cet annuaire ou sans comptes. */
async function monter(annuaire?: AnnuaireDEssai): Promise<ServeurMonte> {
  serveur = await demarrerServeur(0, {
    horloge: creerHorlogeManuelle(),
    ...(annuaire === undefined ? {} : { comptes: annuaire }),
  });

  const adresse = serveur.http.address();
  if (typeof adresse !== 'object' || adresse === null) {
    throw new Error("Le serveur de test n'a pas d'adresse.");
  }

  url = `http://localhost:${String(adresse.port)}`;
  return serveur;
}

/**
 * Ouvre une connexion, avec ce qu'elle presente a l'ouverture.
 *
 * Rejette avec l'erreur du serveur si la connexion est refusee.
 */
async function connecterUnClient(authentification?: Record<string, unknown>): Promise<ClientTypee> {
  const client: ClientTypee = connecter(url, {
    transports: ['websocket'],
    forceNew: true,
    reconnection: false,
    ...(authentification === undefined ? {} : { auth: authentification }),
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
    client.on('connect_error', (erreur) => {
      clearTimeout(minuterie);
      rejeter(erreur);
    });
  });

  return client;
}

/** Demande a entrer, et attend le verdict. */
async function rejoindre(
  client: ClientTypee,
  demande: Record<string, unknown>,
): Promise<ResultatValidation<InfosSalon>> {
  return new Promise((resoudre, rejeter) => {
    const minuterie = setTimeout(() => {
      rejeter(new Error("Le serveur n'a pas repondu a la demande d'entree."));
    }, DELAI_ATTENTE_MS);

    client.emit('rejoindre', demande as never, (reponse: ResultatValidation<InfosSalon>) => {
      clearTimeout(minuterie);
      resoudre(reponse);
    });
  });
}

/** Demande a creer une partie, et attend le verdict. */
async function creer(
  client: ClientTypee,
  demande: Record<string, unknown>,
): Promise<ResultatValidation<InfosSalon>> {
  return new Promise((resoudre, rejeter) => {
    const minuterie = setTimeout(() => {
      rejeter(new Error("Le serveur n'a pas repondu a la demande de creation."));
    }, DELAI_ATTENTE_MS);

    client.emit('creerPartie', demande as never, (reponse: ResultatValidation<InfosSalon>) => {
      clearTimeout(minuterie);
      resoudre(reponse);
    });
  });
}

/** Le salon d'une entree acceptee, ou un echec de test explicite. */
function salonAccepte(reponse: ResultatValidation<InfosSalon>): InfosSalon {
  if (!reponse.valide) {
    throw new Error(`Entree refusee: ${reponse.erreurs.map((e) => e.motif).join(', ')}`);
  }

  return reponse.valeur;
}

/** Le champ du premier motif d'un refus, ou un echec de test si c'etait accepte. */
function champRefuse(reponse: ResultatValidation<InfosSalon>): string | undefined {
  if (reponse.valide) {
    throw new Error('Attendu un refus, recu une entree acceptee.');
  }

  return reponse.erreurs[0]?.champ;
}

/** Attend le prochain message de ce nom. */
async function prochain<Nom extends keyof EvenementsServeurVersClient>(
  client: ClientTypee,
  nom: Nom,
): Promise<Parameters<EvenementsServeurVersClient[Nom]>[0]> {
  return new Promise((resoudre, rejeter) => {
    const minuterie = setTimeout(() => {
      rejeter(new Error(`Aucun message « ${String(nom)} » n est arrive.`));
    }, DELAI_ATTENTE_MS);

    client.once(nom, ((charge: Parameters<EvenementsServeurVersClient[Nom]>[0]) => {
      clearTimeout(minuterie);
      resoudre(charge);
    }) as never);
  });
}

describe('une connexion authentifiee', () => {
  it('entre sous le pseudo et le niveau de son compte, sans lire le pseudo demande', async () => {
    await monter(annuaireDEssai());
    const alice = await connecterUnClient({ jeton: JETON_ALICE });

    const salon = salonAccepte(await rejoindre(alice, { pseudo: 'Mallory' }));

    expect(salon.joueurs).toEqual([
      { id: alice.id, pseudo: 'Alice', hote: true, compte: { niveau: 7 } },
    ]);
  });

  it('peut entrer et creer une partie sans fournir de pseudo', async () => {
    await monter(annuaireDEssai());
    const alice = await connecterUnClient({ jeton: JETON_ALICE });

    const salon = salonAccepte(
      await creer(alice, { configuration: { mode: 'classique', visibilite: 'privee' } }),
    );

    expect(salon.joueurs[0]?.pseudo).toBe('Alice');
    expect(salon.visibilite).toBe('privee');
  });

  it('se montre aux autres membres avec son niveau, et un invite sans', async () => {
    await monter(annuaireDEssai());
    const bob = await connecterUnClient();
    const idRoom = salonAccepte(await rejoindre(bob, { pseudo: 'Bob' })).idRoom;

    const arrivee = prochain(bob, 'joueurArrive');
    const alice = await connecterUnClient({ jeton: JETON_ALICE });
    const salon = salonAccepte(await rejoindre(alice, { idRoom }));

    expect(await arrivee).toEqual({
      id: alice.id,
      pseudo: 'Alice',
      hote: false,
      compte: { niveau: 7 },
    });
    const invite = salon.joueurs.find((joueur) => joueur.pseudo === 'Bob');
    expect(invite).toEqual({ id: bob.id, pseudo: 'Bob', hote: true });
    expect(invite !== undefined && 'compte' in invite).toBe(false);
  });

  it('part en disant qu elle etait un compte', async () => {
    await monter(annuaireDEssai());
    const bob = await connecterUnClient();
    const idRoom = salonAccepte(await rejoindre(bob, { pseudo: 'Bob' })).idRoom;
    const alice = await connecterUnClient({ jeton: JETON_ALICE });
    salonAccepte(await rejoindre(alice, { idRoom }));

    const depart = prochain(bob, 'joueurParti');
    alice.emit('quitter');

    expect(await depart).toEqual({
      id: alice.id,
      pseudo: 'Alice',
      hote: false,
      compte: { niveau: 7 },
    });
  });

  it('est refusee a l entree si son compte n existe plus', async () => {
    const annuaire = annuaireDEssai();
    await monter(annuaire);
    const alice = await connecterUnClient({ jeton: JETON_ALICE });

    annuaire.comptes.delete('compte-alice');

    expect(champRefuse(await rejoindre(alice, {}))).toBe('session');
    expect(serveur?.jeu.rooms.nombreDeRooms).toBe(0);
  });
});

describe('une connexion invitee', () => {
  it('entre sous le pseudo qu elle demande, sans compte', async () => {
    await monter(annuaireDEssai());
    const bob = await connecterUnClient();

    const salon = salonAccepte(await rejoindre(bob, { pseudo: 'Bob' }));

    expect(salon.joueurs).toEqual([{ id: bob.id, pseudo: 'Bob', hote: true }]);
  });

  it('doit choisir un pseudo', async () => {
    await monter(annuaireDEssai());
    const bob = await connecterUnClient();

    expect(champRefuse(await rejoindre(bob, {}))).toBe('pseudo');
    expect(
      champRefuse(
        await creer(bob, { configuration: { mode: 'classique', visibilite: 'publique' } }),
      ),
    ).toBe('pseudo');
    expect(serveur?.jeu.rooms.nombreDeRooms).toBe(0);
  });

  it('ne peut pas prendre le pseudo d un compte, quelle que soit son ecriture', async () => {
    await monter(annuaireDEssai());
    const usurpateur = await connecterUnClient();

    const refus = await rejoindre(usurpateur, { pseudo: '  aLICE ' });
    const creation = await creer(usurpateur, {
      pseudo: 'ALICE',
      configuration: { mode: 'classique', visibilite: 'publique' },
    });

    expect(champRefuse(refus)).toBe('pseudo');
    expect(champRefuse(creation)).toBe('pseudo');
    expect(serveur?.jeu.rooms.nombreDeRooms).toBe(0);
  });

  it('entre sans verification de pseudo sur un serveur sans comptes', async () => {
    await monter();
    const alice = await connecterUnClient();

    const salon = salonAccepte(await rejoindre(alice, { pseudo: 'Alice' }));

    expect(salon.joueurs[0]).toEqual({ id: alice.id, pseudo: 'Alice', hote: true });
  });
});

describe('ouverture d une connexion', () => {
  it('refuse un jeton qui n ouvre aucune session', async () => {
    await monter(annuaireDEssai());

    await expect(connecterUnClient({ jeton: JETON_INCONNU })).rejects.toThrow(
      'Session invalide ou expirée',
    );
  });

  it('refuse un jeton mal forme, sans interroger l annuaire', async () => {
    const annuaire = annuaireDEssai();
    const question = vi.spyOn(annuaire, 'compteDeSession');
    await monter(annuaire);

    await expect(connecterUnClient({ jeton: 'trop-court' })).rejects.toThrow('Session invalide');
    await expect(connecterUnClient({ jeton: 42 })).rejects.toThrow('Session invalide');
    expect(question).not.toHaveBeenCalled();
  });

  it('refuse un jeton sur un serveur sans comptes, plutot que d en faire un invite', async () => {
    await monter();

    await expect(connecterUnClient({ jeton: JETON_ALICE })).rejects.toThrow(
      'Les comptes sont indisponibles',
    );
  });

  it('refuse la connexion si la session ne peut pas etre verifiee, et le journalise', async () => {
    const journal = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const annuaire = annuaireDEssai();
    annuaire.panne = true;
    await monter(annuaire);

    await expect(connecterUnClient({ jeton: JETON_ALICE })).rejects.toThrow(
      "n'a pas pu être vérifiée",
    );
    expect(journal).toHaveBeenCalled();
  });
});

describe('entree pendant l identification', () => {
  it('refuse l entree d un invite si le pseudo ne peut pas etre verifie', async () => {
    const journal = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const annuaire = annuaireDEssai();
    await monter(annuaire);
    const bob = await connecterUnClient();

    annuaire.panne = true;

    expect(champRefuse(await rejoindre(bob, { pseudo: 'Bob' }))).toBe('serveur');
    expect(serveur?.jeu.rooms.nombreDeRooms).toBe(0);
    expect(journal).toHaveBeenCalled();
  });

  it('ne fait entrer qu une fois une connexion qui envoie deux demandes coup sur coup', async () => {
    const annuaire = annuaireDEssai();
    await monter(annuaire);
    const bob = await connecterUnClient();

    annuaire.delaiMs = 40;
    const reponses = await Promise.all([
      rejoindre(bob, { pseudo: 'Bob' }),
      creer(bob, { pseudo: 'Bob', configuration: { mode: 'classique', visibilite: 'privee' } }),
    ]);

    expect(reponses.filter((reponse) => reponse.valide)).toHaveLength(1);
    expect(reponses.map((reponse) => (reponse.valide ? 'entree' : champRefuse(reponse)))).toContain(
      'session',
    );
    expect(serveur?.jeu.rooms.nombreDeRooms).toBe(1);
  });

  it('ne fait rien entrer d une connexion fermee pendant la verification', async () => {
    const annuaire = annuaireDEssai();
    await monter(annuaire);
    const bob = await connecterUnClient();

    annuaire.delaiMs = 60;
    bob.emit('rejoindre', { pseudo: 'Bob' }, () => undefined);
    await new Promise((resoudre) => setTimeout(resoudre, 10));
    bob.disconnect();
    await new Promise((resoudre) => setTimeout(resoudre, 120));

    expect(serveur?.jeu.rooms.nombreDeRooms).toBe(0);
  });
});
