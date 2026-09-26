/**
 * Tests des amis en direct dans le client (etape 2.8): la presence poussee, les
 * invitations recues et envoyees, et la relecture des amis sur signal du serveur.
 *
 * Ce qu'ils protegent: la presence remplace la precedente, et s'oublie avec la session
 * et a chaque lien neuf, le serveur la redisant; une invitation recue ne se double pas,
 * se retire et s'ignore, survit a une sortie de partie, et part de l'etat une fois
 * servie; son refus reste attache a sa carte jusqu'a la navigation; une invitation
 * envoyee passe par en cours, puis partie ou refusee, ami par ami, et s'oublie en
 * quittant le salon; le signal relit la liste meme pendant une lecture, et la fiche
 * ouverte avec elle.
 */

import type {
  InfosSalon,
  InvitationRecue,
  ListeDAmis,
  MaProgression,
  PresenceDUnAmi,
} from '@neon-ninja/shared';
import { REGLAGES_PAR_DEFAUT } from '@neon-ninja/shared';
import { beforeEach, describe, expect, it } from 'vitest';

import type { Action } from './actions.js';
import type { Client } from './client.js';
import { creerClient } from './client.js';
import type { ApiComptesFactice } from './comptes/api.js';
import {
  JETON_DESSAI,
  LISTE_D_AMIS_VIDE,
  creerApiComptesFactice,
  ficheDEssai,
} from './comptes/api.js';
import type { CoffreDeJeton } from './comptes/coffre.js';
import { creerCoffreDeJeton } from './comptes/coffre.js';
import type { EtatClient } from './etat.js';
import { AUCUNE_INVITATION, ETAT_INITIAL } from './etat.js';
import { creerHorlogeClientManuelle } from './horloge.js';
import { reduire } from './reduction.js';
import type { ReseauFactice } from './reseau.js';
import { creerReseauFactice } from './reseau.js';

/** Applique une suite d'actions a un etat. */
function apres(actions: readonly Action[], depart: EtatClient = ETAT_INITIAL): EtatClient {
  return actions.reduce(reduire, depart);
}

function progression(pseudo: string): MaProgression {
  return {
    pseudo,
    niveau: 2,
    xpTotale: 150,
    pieces: 15,
    pointsLigue: 20,
    inscritLe: '2026-09-11T10:00:00.000Z',
  };
}

const SALON: InfosSalon = {
  idRoom: 'room-1',
  statut: 'salon',
  mode: 'classique',
  visibilite: 'privee',
  code: 'NX7K2P',
  capacite: 12,
  joueurs: [{ id: 'moi', pseudo: 'Bob', hote: true, compte: { niveau: 1 } }],
  reglages: REGLAGES_PAR_DEFAUT,
};

const ALICE_EN_LIGNE: PresenceDUnAmi = { pseudo: 'Alice', lieu: { etat: 'enLigne' } };

const ALICE_EN_PARTIE: PresenceDUnAmi = {
  pseudo: 'Alice',
  lieu: { etat: 'enPartie', partie: { visibilite: 'privee' } },
};

/** Une invitation d'Alice. */
function invitation(id: string, de = 'Alice'): InvitationRecue {
  return { id, de, mode: 'classique', visibilite: 'privee', joueurs: 2, capacite: 12 };
}

/** Bob, connecte, avec un lien etabli. */
const BOB: readonly Action[] = [
  { type: 'sessionDeCompte', progression: progression('Bob') },
  { type: 'connexionEtablie' },
];

describe('la presence des amis, dans l etat', () => {
  it('remplace la precedente, en entier', () => {
    const etat = apres([
      ...BOB,
      { type: 'presenceDesAmis', presences: [ALICE_EN_LIGNE] },
      { type: 'presenceDesAmis', presences: [ALICE_EN_PARTIE] },
    ]);

    expect(etat.presences).toEqual([ALICE_EN_PARTIE]);
  });

  it('s oublie a chaque lien neuf, avec les invitations recues, que le serveur redira', () => {
    const etat = apres([
      ...BOB,
      { type: 'presenceDesAmis', presences: [ALICE_EN_LIGNE] },
      { type: 'invitationRecue', invitation: invitation('i1') },
      { type: 'connexionEtablie' },
    ]);

    expect(etat.presences).toEqual([]);
    expect(etat.invitationsDAmis.recues).toEqual([]);
  });

  it('s oublie en redevenant invite, ou sous un autre compte, pas sous le meme', () => {
    const avec = apres([
      ...BOB,
      { type: 'presenceDesAmis', presences: [ALICE_EN_LIGNE] },
      { type: 'invitationRecue', invitation: invitation('i1') },
    ]);

    const invite = reduire(avec, { type: 'sessionDInvite', expiree: false });
    const autre = reduire(avec, { type: 'sessionDeCompte', progression: progression('Carole') });
    const meme = reduire(avec, { type: 'sessionDeCompte', progression: progression('bob') });

    expect(invite.presences).toEqual([]);
    expect(invite.invitationsDAmis).toEqual(AUCUNE_INVITATION);
    expect(autre.presences).toEqual([]);
    expect(autre.invitationsDAmis).toEqual(AUCUNE_INVITATION);
    expect(meme.presences).toEqual([ALICE_EN_LIGNE]);
    expect(meme.invitationsDAmis.recues).toHaveLength(1);
  });
});

describe('les invitations recues, dans l etat', () => {
  it('s ajoutent sans se doubler, se retirent et s ignorent', () => {
    const etat = apres([
      ...BOB,
      { type: 'invitationRecue', invitation: invitation('i1') },
      { type: 'invitationRecue', invitation: invitation('i2', 'Carole') },
      { type: 'invitationRecue', invitation: invitation('i1') },
    ]);

    expect(etat.invitationsDAmis.recues.map((recue) => recue.id)).toEqual(['i2', 'i1']);

    const retiree = reduire(etat, { type: 'invitationRetiree', id: 'i1' });
    const ignoree = reduire(etat, { type: 'invitationDAmiIgnoree', id: 'i2' });

    expect(retiree.invitationsDAmis.recues.map((recue) => recue.id)).toEqual(['i2']);
    expect(ignoree.invitationsDAmis.recues.map((recue) => recue.id)).toEqual(['i1']);
    expect(reduire(etat, { type: 'invitationRetiree', id: 'inconnue' })).toBe(etat);
  });

  it('partent de l etat une fois servies, et survivent a une sortie de partie', () => {
    const entre = apres([
      ...BOB,
      { type: 'invitationRecue', invitation: invitation('i1') },
      { type: 'invitationRecue', invitation: invitation('i2', 'Carole') },
      { type: 'entreeDemandee', pseudo: undefined, invitation: 'i1' },
    ]);

    expect(entre.invitationsDAmis.tentee).toBe('i1');

    const accepte = reduire(entre, { type: 'entreeAcceptee', salon: SALON });
    expect(accepte.invitationsDAmis.recues.map((recue) => recue.id)).toEqual(['i2']);
    expect(accepte.invitationsDAmis.tentee).toBeUndefined();

    const sorti = reduire(accepte, { type: 'sortie' });
    expect(sorti.invitationsDAmis.recues.map((recue) => recue.id)).toEqual(['i2']);
  });

  it('gardent la tentee apres un refus, jusqu a la navigation', () => {
    const refuse = apres([
      ...BOB,
      { type: 'invitationRecue', invitation: invitation('i1') },
      { type: 'entreeDemandee', pseudo: undefined, invitation: 'i1' },
      {
        type: 'entreeRefusee',
        action: 'rejoindre',
        erreurs: [{ champ: 'capacite', motif: 'Cette partie est complète.' }],
      },
    ]);

    expect(refuse.invitationsDAmis.tentee).toBe('i1');
    expect(refuse.invitationsDAmis.recues).toHaveLength(1);
    expect(reduire(refuse, { type: 'navigation', vers: 'amis' }).invitationsDAmis.tentee).toBe(
      undefined,
    );
  });

  it('une entree sans invitation n en tente aucune', () => {
    const etat = apres([...BOB, { type: 'entreeDemandee', pseudo: undefined }]);

    expect(etat.invitationsDAmis.tentee).toBeUndefined();
  });
});

describe('les invitations envoyees, dans l etat', () => {
  it('passent par en cours, puis partie ou refusee, ami par ami', () => {
    const etat = apres([
      ...BOB,
      { type: 'entreeAcceptee', salon: SALON },
      { type: 'invitationEnvoyee', pseudo: 'Alice' },
      { type: 'invitationEnvoyee', pseudo: 'Carole' },
      { type: 'invitationPartie', pseudo: 'Alice' },
      { type: 'invitationRefusee', pseudo: 'carole', motif: 'Carole n’est pas en ligne.' },
    ]);

    expect(etat.invitationsDAmis.envoyees).toEqual([
      { pseudo: 'Alice', statut: 'envoyee' },
      { pseudo: 'carole', statut: 'refusee', motif: 'Carole n’est pas en ligne.' },
    ]);
  });

  it('s oublient en quittant le salon, et en entrant dans un autre', () => {
    const envoyee = apres([
      ...BOB,
      { type: 'entreeAcceptee', salon: SALON },
      { type: 'invitationPartie', pseudo: 'Alice' },
    ]);

    expect(reduire(envoyee, { type: 'sortie' }).invitationsDAmis.envoyees).toEqual([]);
    expect(
      reduire(envoyee, { type: 'entreeAcceptee', salon: SALON }).invitationsDAmis.envoyees,
    ).toEqual([]);
  });
});

describe('les amis en direct, par le client', () => {
  let reseau: ReseauFactice;
  let api: ApiComptesFactice;
  let coffre: CoffreDeJeton;
  let client: Client;

  const laisserRepondre = async (): Promise<void> => {
    await new Promise((resoudre) => setTimeout(resoudre, 0));
  };

  const appels = (nom: string): unknown[] =>
    api.appels.filter((appel) => appel.nom === nom).map((appel) => appel.argument);

  beforeEach(async () => {
    reseau = creerReseauFactice();
    api = creerApiComptesFactice();
    coffre = creerCoffreDeJeton();
    client = creerClient({ reseau, comptes: api, coffre, horloge: creerHorlogeClientManuelle() });
    coffre.garder(JETON_DESSAI);
    client.ouvrir();
    await laisserRepondre();
    reseau.simulerConnexion();
    await laisserRepondre();
  });

  it('recoit la presence et les invitations du serveur', () => {
    reseau.recevoir('presenceDesAmis', [ALICE_EN_LIGNE]);
    reseau.recevoir('invitationRecue', invitation('i1'));
    reseau.recevoir('invitationRecue', invitation('i2'));
    reseau.recevoir('invitationRetiree', { id: 'i1' });

    expect(client.etat.presences).toEqual([ALICE_EN_LIGNE]);
    expect(client.etat.invitationsDAmis.recues.map((recue) => recue.id)).toEqual(['i2']);
  });

  it('rejoint par une invitation, sans pseudo, et l oublie une fois entre', () => {
    reseau.recevoir('invitationRecue', invitation('i1'));

    client.rejoindre(undefined, { invitation: 'i1' });

    expect(reseau.dernier('rejoindre')?.[0]).toEqual({ invitation: 'i1' });
    expect(client.etat.invitationsDAmis.tentee).toBe('i1');

    reseau.dernier('rejoindre')?.[1]({ valide: true, valeur: SALON });
    expect(client.etat.invitationsDAmis.recues).toEqual([]);
    expect(client.etat.ecran).toBe('salon');
  });

  it('ignore une invitation sans rien envoyer au serveur', () => {
    reseau.recevoir('invitationRecue', invitation('i1'));
    const avant = reseau.emis.length;

    client.ignorerLInvitationDAmi('i1');

    expect(client.etat.invitationsDAmis.recues).toEqual([]);
    expect(reseau.emis).toHaveLength(avant);
  });

  it('invite un ami, et retient ce que le serveur en dit', () => {
    client.inviter('Alice');

    expect(reseau.dernier('inviter')?.[0]).toEqual({ pseudo: 'Alice' });
    expect(client.etat.invitationsDAmis.envoyees).toEqual([{ pseudo: 'Alice', statut: 'enCours' }]);

    reseau.dernier('inviter')?.[1]({ valide: true, valeur: { pseudo: 'Alice' } });
    expect(client.etat.invitationsDAmis.envoyees).toEqual([{ pseudo: 'Alice', statut: 'envoyee' }]);

    client.inviter('Carole');
    reseau.dernier('inviter')?.[1]({
      valide: false,
      erreurs: [{ champ: 'pseudo', motif: 'Vous ne pouvez inviter que vos amis.' }],
    });
    expect(client.etat.invitationsDAmis.envoyees.at(-1)).toEqual({
      pseudo: 'Carole',
      statut: 'refusee',
      motif: 'Vous ne pouvez inviter que vos amis.',
    });
  });

  it('n invite personne sans lien', () => {
    reseau.simulerDeconnexion();

    client.inviter('Alice');

    expect(reseau.dernier('inviter')).toBeUndefined();
    expect(client.etat.invitationsDAmis.envoyees).toEqual([]);
  });

  it('relit la liste des amis sur signal, meme pendant une lecture, et la fiche ouverte', async () => {
    const BOB_AMI: ListeDAmis = { ...LISTE_D_AMIS_VIDE, amis: [{ pseudo: 'Bob', niveau: 3 }] };
    let repondreALaPremiere: (() => void) | undefined;
    api.reponses.amis = () =>
      new Promise((resoudre) => {
        repondreALaPremiere = () => {
          resoudre({ acceptee: true, valeur: LISTE_D_AMIS_VIDE });
        };
      });
    client.chargerLesAmis();
    client.ouvrirLaFiche('Bob');
    await laisserRepondre();
    const lecturesAvant = appels('amis').length;
    const fichesAvant = appels('joueur').length;

    api.reponses.amis = async () => ({ acceptee: true, valeur: BOB_AMI });
    reseau.recevoir('amitiesChangees');
    await laisserRepondre();
    repondreALaPremiere?.();
    await laisserRepondre();

    expect(appels('amis')).toHaveLength(lecturesAvant + 1);
    expect(appels('joueur')).toHaveLength(fichesAvant + 1);
    expect(client.etat.amis.liste).toEqual(BOB_AMI);
    expect(client.etat.fiche).toMatchObject({ statut: 'chargee', fiche: ficheDEssai('Bob') });
  });
});
