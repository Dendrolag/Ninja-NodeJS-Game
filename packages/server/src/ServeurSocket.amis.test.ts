/**
 * Tests d'integration des amis en direct (etape 2.8): presence et invitations, par de
 * vrais clients Socket.IO contre un vrai serveur, avec un annuaire en memoire.
 *
 * La logique (a qui part quoi, quand une invitation tombe) est verifiee sans reseau
 * dans amis/ReseauDesAmis.test.ts. Ici, c'est le chemin: la couche reseau dit bien a
 * ReseauDesAmis chaque page, chaque entree et chaque sortie, les messages arrivent aux
 * bonnes pages, et une invitation fait entrer dans une partie privee sans son code.
 */

import type {
  EvenementsClientVersServeur,
  EvenementsServeurVersClient,
  InfosSalon,
  InvitationEnvoyee,
  InvitationRecue,
  ResultatValidation,
} from '@neon-ninja/shared';
import { BORNES_INVITATIONS, reperePseudo } from '@neon-ninja/shared';
import type { Socket as SocketClient } from 'socket.io-client';
import { io as connecter } from 'socket.io-client';
import { afterEach, describe, expect, it } from 'vitest';

import { MOTIFS_D_INVITATION } from './amis/ReseauDesAmis.js';
import type { AmiConnu, ServiceDeComptes } from './comptes/annuaire.js';
import type { HorlogeManuelle } from './horloge.js';
import { creerHorlogeManuelle } from './horloge.js';
import type { ServeurMonte } from './serveur.js';
import { demarrerServeur } from './serveur.js';

/** Un client de test: les contrats sont vus a l'envers de ceux du serveur. */
type ClientTypee = SocketClient<EvenementsServeurVersClient, EvenementsClientVersServeur>;

/** Delai au-dela duquel on considere qu'un message attendu ne viendra pas. */
const DELAI_ATTENTE_MS = 3000;

/** Les comptes d'essai: identifiant, pseudo, et jeton de session. */
const COMPTES = {
  alice: { pseudo: 'Alice', jeton: 'A'.repeat(43) },
  bob: { pseudo: 'Bob', jeton: 'B'.repeat(43) },
  carole: { pseudo: 'Carole', jeton: 'C'.repeat(43) },
} as const;

type Compte = keyof typeof COMPTES;

/** Un annuaire en memoire, avec des amities qu'on change et un geste qu'on signale. */
interface AnnuaireDEssai extends ServiceDeComptes {
  readonly amities: Set<string>;
  signaler(auteur: Compte, vise: Compte): void;
}

function cle(a: string, b: string): string {
  return [a, b].sort().join('|');
}

function annuaireDEssai(...amis: [Compte, Compte][]): AnnuaireDEssai {
  const ecouteurs = new Set<(auteur: string, vise: string) => void>();
  const nonUtilise = async (): Promise<never> => {
    throw new Error('Les routes HTTP ne sont pas utilisees par ces tests.');
  };
  const comptes = Object.keys(COMPTES) as Compte[];
  const amities = new Set(amis.map(([a, b]) => cle(a, b)));

  return {
    amities,
    signaler: (auteur, vise) => {
      for (const ecouteur of ecouteurs) {
        ecouteur(auteur, vise);
      }
    },
    compteDeSession: async (jeton) => comptes.find((compte) => COMPTES[compte].jeton === jeton),
    identiteDe: async (compteId) => {
      const compte = comptes.find((nom) => nom === compteId);
      return compte === undefined ? undefined : { pseudo: COMPTES[compte].pseudo, niveau: 3 };
    },
    pseudoDeCompte: async (pseudo) =>
      comptes.some((compte) => reperePseudo(COMPTES[compte].pseudo) === reperePseudo(pseudo)),
    amisDe: async (compteId): Promise<readonly AmiConnu[]> =>
      comptes
        .filter((autre) => autre !== compteId && amities.has(cle(compteId, autre)))
        .map((autre) => ({ compteId: autre, pseudo: COMPTES[autre].pseudo })),
    surAmitiesChangees: (ecouteur) => {
      ecouteurs.add(ecouteur);
      return () => {
        ecouteurs.delete(ecouteur);
      };
    },
    surSessionsFermees: () => () => undefined,
    enregistrerFinDePartie: async () => [],
    inscrire: nonUtilise,
    connecter: nonUtilise,
    deconnecter: nonUtilise,
    maProgression: nonUtilise,
    profil: nonUtilise,
    ficheJoueur: nonUtilise,
    amis: nonUtilise,
    gesteDAmitie: nonUtilise,
    changerMotDePasse: nonUtilise,
    nouveauCodeDeSecours: nonUtilise,
    reinitialiser: nonUtilise,
  };
}

let serveur: ServeurMonte | undefined;
let horloge: HorlogeManuelle = creerHorlogeManuelle();
let url = '';
const clients: ClientTypee[] = [];

afterEach(async () => {
  for (const client of clients.splice(0)) {
    client.disconnect();
  }

  await serveur?.fermer();
  serveur = undefined;
});

/** Monte un serveur, avec cet annuaire ou sans comptes. */
async function monter(annuaire?: AnnuaireDEssai): Promise<void> {
  horloge = creerHorlogeManuelle();
  serveur = await demarrerServeur(0, {
    horloge,
    ...(annuaire === undefined ? {} : { comptes: annuaire }),
  });

  const adresse = serveur.http.address();
  if (typeof adresse !== 'object' || adresse === null) {
    throw new Error("Le serveur de test n'a pas d'adresse.");
  }

  url = `http://localhost:${String(adresse.port)}`;
}

/** Une page ouverte, et tout ce qu'elle a recu des amis en direct. */
interface Page {
  readonly client: ClientTypee;
  readonly presences: Parameters<EvenementsServeurVersClient['presenceDesAmis']>[0][];
  readonly invitations: InvitationRecue[];
  readonly retraits: string[];
  signaux: number;
}

/** Ouvre une page, sous ce compte ou en invite. */
async function ouvrir(compte?: Compte): Promise<Page> {
  const client: ClientTypee = connecter(url, {
    transports: ['websocket'],
    forceNew: true,
    reconnection: false,
    ...(compte === undefined ? {} : { auth: { jeton: COMPTES[compte].jeton } }),
  });
  clients.push(client);

  const page: Page = { client, presences: [], invitations: [], retraits: [], signaux: 0 };
  client.on('presenceDesAmis', (presences) => {
    page.presences.push(presences);
  });
  client.on('invitationRecue', (invitation) => {
    page.invitations.push(invitation);
  });
  client.on('invitationRetiree', ({ id }) => {
    page.retraits.push(id);
  });
  client.on('amitiesChangees', () => {
    page.signaux += 1;
  });

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

  await laisserPasser();
  return page;
}

/** Envoie une demande a accuse, et attend la reponse. */
async function demander<T>(
  page: Page,
  nom: 'rejoindre' | 'creerPartie' | 'inviter',
  demande: Record<string, unknown>,
): Promise<ResultatValidation<T>> {
  return new Promise((resoudre, rejeter) => {
    const minuterie = setTimeout(() => {
      rejeter(new Error(`Le serveur n'a pas repondu a « ${nom} ».`));
    }, DELAI_ATTENTE_MS);

    page.client.emit(
      nom,
      demande as never,
      ((reponse: ResultatValidation<T>) => {
        clearTimeout(minuterie);
        resoudre(reponse);
      }) as never,
    );
  });
}

/** Cree une partie de cette visibilite, et en rend le salon. */
async function creer(page: Page, visibilite: 'publique' | 'privee'): Promise<InfosSalon> {
  const reponse = await demander<InfosSalon>(page, 'creerPartie', {
    configuration: { mode: 'classique', visibilite },
  });

  if (!reponse.valide) {
    throw new Error(`Creation refusee: ${reponse.erreurs.map((e) => e.motif).join(', ')}`);
  }

  await laisserPasser();
  return reponse.valeur;
}

/** Le motif d'un refus, ou un echec de test. */
function motif<T>(reponse: ResultatValidation<T>): string | undefined {
  if (reponse.valide) {
    throw new Error('Attendu un refus.');
  }

  return reponse.erreurs[0]?.motif;
}

/** Laisse le reseau et les lectures d'amis aboutir. */
async function laisserPasser(): Promise<void> {
  await new Promise((resoudre) => setTimeout(resoudre, 40));
}

/** Alice et Bob, amis, en ligne; Alice dans le salon d'une partie privee. */
async function aliceInviteBob(): Promise<{ alice: Page; bob: Page; salon: InfosSalon }> {
  await monter(annuaireDEssai(['alice', 'bob']));
  const bob = await ouvrir('bob');
  const alice = await ouvrir('alice');
  const salon = await creer(alice, 'privee');

  return { alice, bob, salon };
}

describe('la presence par le reseau', () => {
  it('part a chaque page de compte, et ne va qu aux amis', async () => {
    await monter(annuaireDEssai(['alice', 'bob']));
    const bob = await ouvrir('bob');
    const carole = await ouvrir('carole');
    const invite = await ouvrir();

    expect(bob.presences).toEqual([[]]);

    await ouvrir('alice');

    expect(bob.presences.at(-1)).toEqual([{ pseudo: 'Alice', lieu: { etat: 'enLigne' } }]);
    expect(carole.presences).toEqual([[]]);
    expect(invite.presences).toEqual([]);
  });

  it('suit un ami dans son salon prive sans jamais en montrer le code, puis a son depart', async () => {
    const { alice, bob, salon } = await aliceInviteBob();

    expect(bob.presences.at(-1)).toEqual([
      { pseudo: 'Alice', lieu: { etat: 'salon', partie: { visibilite: 'privee' } } },
    ]);
    expect(salon.code).toBeDefined();
    expect(JSON.stringify(bob.presences)).not.toContain(salon.code ?? '');
    expect(JSON.stringify(bob.presences)).not.toContain(salon.idRoom);

    alice.client.emit('quitter');
    await laisserPasser();
    expect(bob.presences.at(-1)).toEqual([{ pseudo: 'Alice', lieu: { etat: 'enLigne' } }]);

    alice.client.disconnect();
    await laisserPasser();
    expect(bob.presences.at(-1)).toEqual([]);
  });

  it('montre d une partie publique de quoi la rejoindre, et y fait entrer', async () => {
    await monter(annuaireDEssai(['alice', 'bob']));
    const bob = await ouvrir('bob');
    const alice = await ouvrir('alice');
    const salon = await creer(alice, 'publique');

    expect(bob.presences.at(-1)).toEqual([
      {
        pseudo: 'Alice',
        lieu: {
          etat: 'salon',
          partie: {
            visibilite: 'publique',
            idRoom: salon.idRoom,
            mode: 'classique',
            joueurs: 1,
            capacite: salon.capacite,
          },
        },
      },
    ]);

    const entree = await demander<InfosSalon>(bob, 'rejoindre', { idRoom: salon.idRoom });
    expect(entree.valide).toBe(true);
    await laisserPasser();

    const lieu = alice.presences.at(-1)?.[0]?.lieu;
    expect(
      lieu?.etat === 'salon' && lieu.partie.visibilite === 'publique' && lieu.partie.joueurs,
    ).toBe(2);
  });

  it('fait relire leur liste aux pages des deux comptes d un geste', async () => {
    const annuaire = annuaireDEssai();
    await monter(annuaire);
    const alice = await ouvrir('alice');
    const bob = await ouvrir('bob');
    const carole = await ouvrir('carole');

    annuaire.amities.add(cle('alice', 'bob'));
    annuaire.signaler('alice', 'bob');
    await laisserPasser();

    expect(alice.signaux).toBe(1);
    expect(bob.signaux).toBe(1);
    expect(carole.signaux).toBe(0);
    expect(bob.presences.at(-1)).toEqual([{ pseudo: 'Alice', lieu: { etat: 'enLigne' } }]);
  });
});

describe('une invitation par le reseau', () => {
  it('fait entrer l ami dans la partie privee sans son code, une seule fois', async () => {
    const { alice, bob, salon } = await aliceInviteBob();

    const envoi = await demander<InvitationEnvoyee>(alice, 'inviter', { pseudo: 'bob' });
    expect(envoi).toEqual({ valide: true, valeur: { pseudo: 'Bob' } });
    await laisserPasser();

    const [invitation] = bob.invitations;
    expect(invitation).toMatchObject({ de: 'Alice', mode: 'classique', visibilite: 'privee' });
    expect(JSON.stringify(invitation)).not.toContain(salon.code ?? '');
    expect(JSON.stringify(invitation)).not.toContain(salon.idRoom);

    const entree = await demander<InfosSalon>(bob, 'rejoindre', { invitation: invitation?.id });
    expect(entree.valide && entree.valeur.idRoom).toBe(salon.idRoom);
    expect(entree.valide && entree.valeur.joueurs.map((joueur) => joueur.pseudo)).toEqual([
      'Alice',
      'Bob',
    ]);
    await laisserPasser();
    expect(bob.retraits).toEqual([invitation?.id]);

    // Servie, elle ne rouvre rien, meme apres une sortie.
    bob.client.emit('quitter');
    await laisserPasser();
    expect(motif(await demander(bob, 'rejoindre', { invitation: invitation?.id }))).toBe(
      MOTIFS_D_INVITATION.plusValable,
    );
  });

  it('ne fait entrer ni un autre compte, ni un invite', async () => {
    const { alice, bob } = await aliceInviteBob();
    const carole = await ouvrir('carole');
    const invite = await ouvrir();
    await demander(alice, 'inviter', { pseudo: 'Bob' });
    await laisserPasser();
    const id = bob.invitations[0]?.id;

    expect(motif(await demander(carole, 'rejoindre', { invitation: id }))).toBe(
      MOTIFS_D_INVITATION.plusValable,
    );
    expect(motif(await demander(invite, 'rejoindre', { pseudo: 'Zoe', invitation: id }))).toBe(
      MOTIFS_D_INVITATION.plusValable,
    );
    expect(carole.invitations).toEqual([]);
  });

  it('expire au bout de deux minutes, et l ami l apprend', async () => {
    const { alice, bob } = await aliceInviteBob();
    await demander(alice, 'inviter', { pseudo: 'Bob' });
    await laisserPasser();
    const id = bob.invitations[0]?.id;

    horloge.avancerDe(BORNES_INVITATIONS.validiteMs);
    await laisserPasser();

    expect(bob.retraits).toEqual([id]);
    expect(motif(await demander(bob, 'rejoindre', { invitation: id }))).toBe(
      MOTIFS_D_INVITATION.plusValable,
    );
  });

  it('tombe quand l inviteur quitte sa partie', async () => {
    const { alice, bob } = await aliceInviteBob();
    await demander(alice, 'inviter', { pseudo: 'Bob' });
    await laisserPasser();

    alice.client.emit('quitter');
    await laisserPasser();

    expect(bob.retraits).toEqual([bob.invitations[0]?.id]);
  });

  it('attend une page que l ami ouvre ensuite', async () => {
    const { alice, bob } = await aliceInviteBob();
    await demander(alice, 'inviter', { pseudo: 'Bob' });
    await laisserPasser();

    const secondePage = await ouvrir('bob');

    expect(secondePage.invitations.map((invitation) => invitation.id)).toEqual([
      bob.invitations[0]?.id,
    ]);
  });

  it('est refusee a un invite, hors partie, vers un non-ami, et trop tot', async () => {
    const { alice, bob } = await aliceInviteBob();
    const invite = await ouvrir();
    await ouvrir('carole');

    expect(motif(await demander(invite, 'inviter', { pseudo: 'Bob' }))).toBe(
      MOTIFS_D_INVITATION.invite,
    );
    expect(motif(await demander(bob, 'inviter', { pseudo: 'Alice' }))).toBe(
      MOTIFS_D_INVITATION.horsPartie,
    );
    expect(motif(await demander(alice, 'inviter', { pseudo: 'Carole' }))).toBe(
      MOTIFS_D_INVITATION.pasAmi,
    );
    expect(motif(await demander(alice, 'inviter', { pseudo: '<b>' }))).toBeDefined();

    await demander(alice, 'inviter', { pseudo: 'Bob' });
    expect((await demander(alice, 'inviter', { pseudo: 'Bob' })).valide).toBe(false);
  });

  it('est refusee sur un serveur sans comptes', async () => {
    await monter();
    const invite = await ouvrir();

    expect(motif(await demander(invite, 'inviter', { pseudo: 'Bob' }))).toBe(
      MOTIFS_D_INVITATION.invite,
    );
  });
});
