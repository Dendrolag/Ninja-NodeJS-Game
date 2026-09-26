/**
 * Tests des amis en direct (etape 2.8), sans reseau ni base: un annuaire d'essai, des
 * parties d'essai, et les messages que chaque connexion recevrait.
 *
 * Ce qui est verifie ici, c'est la logique: a qui part la presence, quand, et jamais a
 * qui. Ce qu'une invitation exige, ce qu'elle ouvre, et quand elle tombe. Le chemin
 * par de vraies sockets est verifie dans ServeurSocket.amis.test.ts.
 */

import type { InvitationEnvoyee, ResultatValidation, StatutPartie } from '@neon-ninja/shared';
import { BORNES_INVITATIONS } from '@neon-ninja/shared';
import { describe, expect, it, vi } from 'vitest';

import type { AmiConnu } from '../comptes/annuaire.js';
import type { HorlogeManuelle } from '../horloge.js';
import { creerHorlogeManuelle } from '../horloge.js';
import { INVITATION_TROP_TOT } from './invitations.js';
import type { PartieObservee } from './presence.js';
import type { AmisDeLAnnuaire, MessageDesAmis } from './ReseauDesAmis.js';
import { MOTIFS_D_INVITATION, ReseauDesAmis } from './ReseauDesAmis.js';

/** Les pseudos des comptes d'essai. */
const PSEUDOS: Readonly<Record<string, string>> = {
  alice: 'Alice',
  bob: 'Bob',
  carole: 'Carole',
  david: 'David',
};

/** Un annuaire d'essai: des amities qu'on change, et de quoi signaler un geste. */
interface AnnuaireDEssai extends AmisDeLAnnuaire {
  /** Les paires d'amis. */
  readonly amities: Set<string>;
  /** Les lectures d'amis faites, par compte. */
  readonly lectures: string[];
  /** Toute lecture echoue, comme une base injoignable. */
  panne: boolean;
  /** Les lectures attendent ce verrou avant de repondre. */
  verrou: Promise<void>;
  /** Previent les ecouteurs d'un geste de l'un sur l'autre. */
  signaler(auteur: string, vise: string): void;
}

/** La cle d'une amitie, quel que soit l'ordre. */
function cle(a: string, b: string): string {
  return [a, b].sort().join('|');
}

function annuaireDEssai(...amis: [string, string][]): AnnuaireDEssai {
  const ecouteurs = new Set<(auteur: string, vise: string) => void>();

  const annuaire: AnnuaireDEssai = {
    amities: new Set(amis.map(([a, b]) => cle(a, b))),
    lectures: [],
    panne: false,
    verrou: Promise.resolve(),
    signaler: (auteur, vise) => {
      for (const ecouteur of ecouteurs) {
        ecouteur(auteur, vise);
      }
    },
    amisDe: async (compteId): Promise<readonly AmiConnu[]> => {
      annuaire.lectures.push(compteId);
      await annuaire.verrou;

      if (annuaire.panne) {
        throw new Error('base injoignable');
      }

      return Object.keys(PSEUDOS)
        .filter((autre) => autre !== compteId && annuaire.amities.has(cle(compteId, autre)))
        .map((autre) => ({ compteId: autre, pseudo: PSEUDOS[autre] ?? autre }));
    },
    surAmitiesChangees: (ecouteur) => {
      ecouteurs.add(ecouteur);

      return () => {
        ecouteurs.delete(ecouteur);
      };
    },
  };

  return annuaire;
}

/** Une partie d'essai, dont on change le statut et les joueurs. */
interface PartieDEssai {
  id: string;
  statut: StatutPartie;
  visibilite: 'publique' | 'privee';
  mode: 'classique';
  capacite: number;
  joueurs: { id: string; pseudo: string; hote: boolean; compte?: { id: string; niveau: number } }[];
}

function partieDEssai(
  id: string,
  visibilite: 'publique' | 'privee' = 'privee',
  ...comptes: string[]
): PartieDEssai {
  return {
    id,
    statut: 'salon',
    visibilite,
    mode: 'classique',
    capacite: 12,
    joueurs: comptes.map((compteId, rang) => ({
      id: `joueur-${compteId}`,
      pseudo: PSEUDOS[compteId] ?? compteId,
      hote: rang === 0,
      compte: { id: compteId, niveau: 1 },
    })),
  };
}

/** Un montage: les amis en direct, et ce que chaque connexion a recu. */
interface Montage {
  readonly amis: ReseauDesAmis;
  readonly annuaire: AnnuaireDEssai;
  readonly horloge: HorlogeManuelle;
  readonly parties: Map<string, PartieDEssai>;
  /** Les messages recus, par connexion, dans l'ordre. */
  readonly recus: Map<string, MessageDesAmis[]>;
}

function monter(annuaire: AnnuaireDEssai): Montage {
  const horloge = creerHorlogeManuelle();
  const parties = new Map<string, PartieDEssai>();
  const recus = new Map<string, MessageDesAmis[]>();
  let compteur = 0;

  const amis = new ReseauDesAmis({
    annuaire,
    horloge,
    partie: (idRoom) => parties.get(idRoom) as PartieObservee | undefined,
    envoyer: (idConnexion, message) => {
      recus.set(idConnexion, [...(recus.get(idConnexion) ?? []), message]);
    },
    tirerIdentifiant: () => {
      compteur += 1;
      return `invitation-${String(compteur)}`;
    },
  });

  return { amis, annuaire, horloge, parties, recus };
}

/** Laisse aboutir les lectures d'amis en cours. */
async function laisserFinir(): Promise<void> {
  await new Promise((resoudre) => setTimeout(resoudre, 0));
}

/** Les messages de ce nom recus par cette connexion. */
function messages<Nom extends MessageDesAmis['nom']>(
  montage: Montage,
  idConnexion: string,
  nom: Nom,
): Extract<MessageDesAmis, { nom: Nom }>[] {
  return (montage.recus.get(idConnexion) ?? []).filter(
    (message): message is Extract<MessageDesAmis, { nom: Nom }> => message.nom === nom,
  );
}

/** La derniere presence recue par cette connexion. */
function presence(montage: Montage, idConnexion: string) {
  return messages(montage, idConnexion, 'presenceDesAmis').at(-1)?.charge;
}

/** Oublie ce que les connexions ont recu. */
function oublier(montage: Montage): void {
  montage.recus.clear();
}

/** L'invitation acceptee, ou un echec de test explicite. */
function acceptee(reponse: ResultatValidation<InvitationEnvoyee>): InvitationEnvoyee {
  if (!reponse.valide) {
    throw new Error(`Invitation refusee: ${reponse.erreurs.map((e) => e.motif).join(', ')}`);
  }

  return reponse.valeur;
}

/** Le motif d'un refus, ou un echec de test. */
function motif<T>(reponse: ResultatValidation<T>): string | undefined {
  if (reponse.valide) {
    throw new Error('Attendu un refus.');
  }

  return reponse.erreurs[0]?.motif;
}

/** Alice dans le salon d'une partie privee, Bob sur les menus: amis, tous deux en ligne. */
async function aliceAuSalonBobEnLigne(): Promise<Montage> {
  const montage = monter(annuaireDEssai(['alice', 'bob']));
  montage.parties.set('room-1', partieDEssai('room-1', 'privee', 'alice'));
  montage.amis.connexionOuverte('a1', 'alice');
  montage.amis.connexionOuverte('b1', 'bob');
  await laisserFinir();
  montage.amis.entree('a1', 'room-1');

  return montage;
}

describe('la presence des amis', () => {
  it('part a l ouverture d une page, une fois les amis lus', async () => {
    const montage = monter(annuaireDEssai(['alice', 'bob']));

    montage.amis.connexionOuverte('b1', 'bob');
    expect(presence(montage, 'b1')).toBeUndefined();

    await laisserFinir();
    expect(presence(montage, 'b1')).toEqual([]);
    expect(montage.annuaire.lectures).toEqual(['bob']);
  });

  it('dit a chaque ami qu un compte vient d apparaitre, puis de disparaitre', async () => {
    const montage = monter(annuaireDEssai(['alice', 'bob']));
    montage.amis.connexionOuverte('b1', 'bob');
    await laisserFinir();

    montage.amis.connexionOuverte('a1', 'alice');
    await laisserFinir();

    expect(presence(montage, 'a1')).toEqual([{ pseudo: 'Bob', lieu: { etat: 'enLigne' } }]);
    expect(presence(montage, 'b1')).toEqual([{ pseudo: 'Alice', lieu: { etat: 'enLigne' } }]);

    montage.amis.connexionFermee('a1');
    expect(presence(montage, 'b1')).toEqual([]);
  });

  it('ne dit rien a qui n est pas ami', async () => {
    const montage = monter(annuaireDEssai(['alice', 'bob']));
    montage.amis.connexionOuverte('c1', 'carole');
    await laisserFinir();
    oublier(montage);

    montage.amis.connexionOuverte('a1', 'alice');
    await laisserFinir();
    montage.parties.set('room-1', partieDEssai('room-1', 'publique', 'alice'));
    montage.amis.entree('a1', 'room-1');

    expect(montage.recus.get('c1')).toBeUndefined();
  });

  it('suit un ami du salon a la partie, sans jamais montrer une partie privee', async () => {
    const montage = await aliceAuSalonBobEnLigne();

    expect(presence(montage, 'b1')).toEqual([
      { pseudo: 'Alice', lieu: { etat: 'salon', partie: { visibilite: 'privee' } } },
    ]);

    const partie = montage.parties.get('room-1');
    if (partie !== undefined) {
      partie.statut = 'enCours';
    }
    montage.amis.partieChangee('room-1');

    expect(presence(montage, 'b1')).toEqual([
      { pseudo: 'Alice', lieu: { etat: 'enPartie', partie: { visibilite: 'privee' } } },
    ]);
    expect(JSON.stringify(montage.recus.get('b1'))).not.toContain('room-1');
  });

  it('montre d une partie publique de quoi la rejoindre, et suit ses joueurs', async () => {
    const montage = monter(annuaireDEssai(['alice', 'bob']));
    const partie = partieDEssai('room-2', 'publique', 'alice');
    montage.parties.set('room-2', partie);
    montage.amis.connexionOuverte('a1', 'alice');
    montage.amis.connexionOuverte('b1', 'bob');
    await laisserFinir();
    montage.amis.entree('a1', 'room-2');

    expect(presence(montage, 'b1')).toEqual([
      {
        pseudo: 'Alice',
        lieu: {
          etat: 'salon',
          partie: {
            visibilite: 'publique',
            idRoom: 'room-2',
            mode: 'classique',
            joueurs: 1,
            capacite: 12,
          },
        },
      },
    ]);

    partie.joueurs.push({ id: 'invite', pseudo: 'Zoe', hote: false });
    montage.amis.partieChangee('room-2');

    const lieu = presence(montage, 'b1')?.[0]?.lieu;
    expect(
      lieu?.etat === 'salon' && lieu.partie.visibilite === 'publique' && lieu.partie.joueurs,
    ).toBe(2);
  });

  it('n envoie pas deux fois la meme liste', async () => {
    const montage = await aliceAuSalonBobEnLigne();
    oublier(montage);

    montage.amis.partieChangee('room-1');
    montage.amis.partieChangee('room-1');

    expect(messages(montage, 'b1', 'presenceDesAmis')).toEqual([]);
  });

  it('donne sa liste a une seconde page d un compte, sans relire ses amis', async () => {
    const montage = await aliceAuSalonBobEnLigne();

    montage.amis.connexionOuverte('b2', 'bob');

    expect(presence(montage, 'b2')).toEqual(presence(montage, 'b1'));
    expect(montage.annuaire.lectures).toEqual(['alice', 'bob']);
  });

  it('une sortie de partie ramene l ami en ligne', async () => {
    const montage = await aliceAuSalonBobEnLigne();

    montage.amis.sortie('a1');

    expect(presence(montage, 'b1')).toEqual([{ pseudo: 'Alice', lieu: { etat: 'enLigne' } }]);
  });

  it('continue sans amis quand la base ne repond pas', async () => {
    const journal = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const montage = monter(annuaireDEssai(['alice', 'bob']));
    montage.annuaire.panne = true;

    montage.amis.connexionOuverte('a1', 'alice');
    await laisserFinir();

    expect(presence(montage, 'a1')).toEqual([]);
    expect(journal).toHaveBeenCalledOnce();
    journal.mockRestore();
  });

  it('n applique que la derniere lecture des amis d un compte', async () => {
    const montage = monter(annuaireDEssai(['alice', 'bob']));
    montage.amis.connexionOuverte('b1', 'bob');
    await laisserFinir();

    let liberer = (): void => undefined;
    montage.annuaire.verrou = new Promise((resoudre) => {
      liberer = resoudre;
    });
    montage.amis.connexionOuverte('a1', 'alice');

    // Pendant la lecture retenue, l'amitie cesse, et une lecture plus recente part.
    montage.annuaire.amities.clear();
    montage.annuaire.verrou = Promise.resolve();
    montage.annuaire.signaler('alice', 'bob');
    await laisserFinir();
    liberer();
    await laisserFinir();

    expect(presence(montage, 'a1')).toEqual([]);
  });

  it('oublie une lecture finie apres la derniere page fermee', async () => {
    const montage = monter(annuaireDEssai(['alice', 'bob']));
    montage.amis.connexionOuverte('b1', 'bob');
    await laisserFinir();

    montage.amis.connexionOuverte('a1', 'alice');
    montage.amis.connexionFermee('a1');
    await laisserFinir();

    expect(presence(montage, 'b1')).toEqual([]);
    expect(montage.recus.get('a1')).toBeUndefined();
  });
});

describe('une invitation', () => {
  it('part a chaque page de l ami, avec la partie decrite et sans code', async () => {
    const montage = await aliceAuSalonBobEnLigne();
    montage.amis.connexionOuverte('b2', 'bob');

    expect(acceptee(await montage.amis.inviter('a1', 'Alice', 'bob'))).toEqual({ pseudo: 'Bob' });

    const attendue = {
      nom: 'invitationRecue',
      charge: {
        id: 'invitation-1',
        de: 'Alice',
        mode: 'classique',
        visibilite: 'privee',
        joueurs: 1,
        capacite: 12,
      },
    };
    expect(messages(montage, 'b1', 'invitationRecue')).toEqual([attendue]);
    expect(messages(montage, 'b2', 'invitationRecue')).toEqual([attendue]);
  });

  it('est refusee a qui n est pas un compte, ou hors d une partie', async () => {
    const montage = await aliceAuSalonBobEnLigne();

    expect(motif(await montage.amis.inviter('invite', 'Zoe', 'bob'))).toBe(
      MOTIFS_D_INVITATION.invite,
    );
    expect(motif(await montage.amis.inviter('b1', 'Bob', 'alice'))).toBe(
      MOTIFS_D_INVITATION.horsPartie,
    );
  });

  it('est refusee dans une partie terminee', async () => {
    const montage = await aliceAuSalonBobEnLigne();
    const partie = montage.parties.get('room-1');
    if (partie !== undefined) {
      partie.statut = 'terminee';
    }

    expect(motif(await montage.amis.inviter('a1', 'Alice', 'bob'))).toBe(
      MOTIFS_D_INVITATION.partieFinie,
    );
  });

  it('est refusee vers un non-ami, du meme motif qu un pseudo inconnu', async () => {
    const montage = await aliceAuSalonBobEnLigne();
    montage.amis.connexionOuverte('c1', 'carole');
    await laisserFinir();

    expect(motif(await montage.amis.inviter('a1', 'Alice', 'carole'))).toBe(
      MOTIFS_D_INVITATION.pasAmi,
    );
    expect(motif(await montage.amis.inviter('a1', 'Alice', 'personne'))).toBe(
      MOTIFS_D_INVITATION.pasAmi,
    );
    expect(messages(montage, 'c1', 'invitationRecue')).toEqual([]);
  });

  it('trouve l ami quelle que soit l ecriture de son pseudo', async () => {
    const montage = await aliceAuSalonBobEnLigne();

    expect(acceptee(await montage.amis.inviter('a1', 'Alice', '  BOB '))).toEqual({
      pseudo: 'Bob',
    });
  });

  it('est refusee vers un ami hors ligne, ou deja dans la partie', async () => {
    const montage = await aliceAuSalonBobEnLigne();
    montage.amis.connexionFermee('b1');

    expect(motif(await montage.amis.inviter('a1', 'Alice', 'bob'))).toBe('Bob n’est pas en ligne.');

    montage.amis.connexionOuverte('b1', 'bob');
    await laisserFinir();
    montage.parties.get('room-1')?.joueurs.push({
      id: 'joueur-bob',
      pseudo: 'Bob',
      hote: false,
      compte: { id: 'bob', niveau: 1 },
    });

    expect(motif(await montage.amis.inviter('a1', 'Alice', 'bob'))).toBe(
      'Bob est déjà dans votre partie.',
    );
  });

  it('est refusee vers le meme ami avant une minute', async () => {
    const montage = await aliceAuSalonBobEnLigne();
    acceptee(await montage.amis.inviter('a1', 'Alice', 'bob'));

    expect(motif(await montage.amis.inviter('a1', 'Alice', 'bob'))).toBe(INVITATION_TROP_TOT);

    montage.horloge.avancerDe(BORNES_INVITATIONS.intervalleParAmiMs);
    acceptee(await montage.amis.inviter('a1', 'Alice', 'bob'));

    // La precedente est retiree, la nouvelle part.
    expect(messages(montage, 'b1', 'invitationRetiree')).toEqual([
      { nom: 'invitationRetiree', charge: { id: 'invitation-1' } },
    ]);
    expect(messages(montage, 'b1', 'invitationRecue').map((m) => m.charge.id)).toEqual([
      'invitation-1',
      'invitation-2',
    ]);
  });

  it('attend la lecture des amis de l inviteur si elle est en cours', async () => {
    const montage = monter(annuaireDEssai(['alice', 'bob']));
    montage.parties.set('room-1', partieDEssai('room-1', 'privee', 'alice'));
    montage.amis.connexionOuverte('b1', 'bob');
    await laisserFinir();

    montage.amis.connexionOuverte('a1', 'alice');
    montage.amis.entree('a1', 'room-1');

    expect(acceptee(await montage.amis.inviter('a1', 'Alice', 'bob'))).toEqual({ pseudo: 'Bob' });
  });
});

describe('le droit d entree d une invitation', () => {
  it('ouvre la partie au seul compte invite', async () => {
    const montage = await aliceAuSalonBobEnLigne();
    acceptee(await montage.amis.inviter('a1', 'Alice', 'bob'));

    expect(montage.amis.droitDEntree('invitation-1', 'bob')).toEqual({
      valide: true,
      valeur: 'room-1',
    });

    for (const autre of ['carole', undefined]) {
      expect(motif(montage.amis.droitDEntree('invitation-1', autre))).toBe(
        MOTIFS_D_INVITATION.plusValable,
      );
    }

    expect(motif(montage.amis.droitDEntree('inconnue', 'bob'))).toBe(
      MOTIFS_D_INVITATION.plusValable,
    );
  });

  it('expire au bout de deux minutes, et l invite l apprend', async () => {
    const montage = await aliceAuSalonBobEnLigne();
    acceptee(await montage.amis.inviter('a1', 'Alice', 'bob'));

    montage.horloge.avancerDe(BORNES_INVITATIONS.validiteMs);

    expect(motif(montage.amis.droitDEntree('invitation-1', 'bob'))).toBe(
      MOTIFS_D_INVITATION.plusValable,
    );
    expect(messages(montage, 'b1', 'invitationRetiree')).toEqual([
      { nom: 'invitationRetiree', charge: { id: 'invitation-1' } },
    ]);
  });

  it('ne sert qu une fois', async () => {
    const montage = await aliceAuSalonBobEnLigne();
    acceptee(await montage.amis.inviter('a1', 'Alice', 'bob'));

    montage.amis.invitationServie('invitation-1');
    montage.amis.invitationServie('invitation-1');

    expect(motif(montage.amis.droitDEntree('invitation-1', 'bob'))).toBe(
      MOTIFS_D_INVITATION.plusValable,
    );
    expect(messages(montage, 'b1', 'invitationRetiree')).toHaveLength(1);
    expect(montage.amis.nombreDInvitations).toBe(0);
  });

  it('attend l invite: une page qu il ouvre ensuite la recoit', async () => {
    const montage = await aliceAuSalonBobEnLigne();
    acceptee(await montage.amis.inviter('a1', 'Alice', 'bob'));
    montage.amis.connexionFermee('b1');

    montage.amis.connexionOuverte('b3', 'bob');

    expect(messages(montage, 'b3', 'invitationRecue').map((m) => m.charge.id)).toEqual([
      'invitation-1',
    ]);
  });
});

describe('le retrait d une invitation', () => {
  it('tombe quand l inviteur quitte la partie, pas quand un autre la quitte', async () => {
    const montage = await aliceAuSalonBobEnLigne();
    acceptee(await montage.amis.inviter('a1', 'Alice', 'bob'));

    montage.amis.joueurSorti('carole', 'room-1');
    montage.amis.joueurSorti('alice', 'room-2');
    expect(montage.amis.nombreDInvitations).toBe(1);

    montage.amis.joueurSorti('alice', 'room-1');
    expect(montage.amis.nombreDInvitations).toBe(0);
    expect(messages(montage, 'b1', 'invitationRetiree')).toHaveLength(1);
  });

  it('tombe quand la partie se termine ou disparait', async () => {
    const montage = await aliceAuSalonBobEnLigne();
    acceptee(await montage.amis.inviter('a1', 'Alice', 'bob'));
    const partie = montage.parties.get('room-1');
    if (partie !== undefined) {
      partie.statut = 'terminee';
    }

    montage.amis.partieChangee('room-1');
    expect(montage.amis.nombreDInvitations).toBe(0);

    montage.horloge.avancerDe(BORNES_INVITATIONS.intervalleParAmiMs);
    if (partie !== undefined) {
      partie.statut = 'salon';
    }
    acceptee(await montage.amis.inviter('a1', 'Alice', 'bob'));
    montage.parties.delete('room-1');
    montage.amis.partieChangee('room-1');

    expect(montage.amis.nombreDInvitations).toBe(0);
    expect(messages(montage, 'b1', 'invitationRetiree')).toHaveLength(2);
  });

  it('tombe quand l amitie cesse, et reste quand elle dure', async () => {
    const montage = await aliceAuSalonBobEnLigne();
    acceptee(await montage.amis.inviter('a1', 'Alice', 'bob'));

    montage.annuaire.signaler('alice', 'bob');
    await laisserFinir();
    expect(montage.amis.nombreDInvitations).toBe(1);

    montage.annuaire.amities.clear();
    montage.annuaire.signaler('bob', 'alice');
    await laisserFinir();

    expect(montage.amis.nombreDInvitations).toBe(0);
    expect(messages(montage, 'b1', 'invitationRetiree')).toHaveLength(1);
  });

  it('tombe aussi quand l amitie cesse pendant que l inviteur est hors ligne', async () => {
    const montage = await aliceAuSalonBobEnLigne();
    acceptee(await montage.amis.inviter('a1', 'Alice', 'bob'));
    montage.amis.connexionFermee('a1');

    montage.annuaire.amities.clear();
    montage.annuaire.signaler('alice', 'bob');
    await laisserFinir();

    expect(montage.amis.nombreDInvitations).toBe(0);
  });
});

describe('les amities changees', () => {
  it('font relire leur liste aux pages des deux comptes, et suivre la presence', async () => {
    const montage = monter(annuaireDEssai());
    montage.amis.connexionOuverte('a1', 'alice');
    montage.amis.connexionOuverte('b1', 'bob');
    montage.amis.connexionOuverte('c1', 'carole');
    await laisserFinir();
    oublier(montage);

    montage.annuaire.amities.add(cle('alice', 'bob'));
    montage.annuaire.signaler('bob', 'alice');
    await laisserFinir();

    expect(messages(montage, 'a1', 'amitiesChangees')).toHaveLength(1);
    expect(messages(montage, 'b1', 'amitiesChangees')).toHaveLength(1);
    expect(montage.recus.get('c1')).toBeUndefined();
    expect(presence(montage, 'a1')).toEqual([{ pseudo: 'Bob', lieu: { etat: 'enLigne' } }]);
    expect(presence(montage, 'b1')).toEqual([{ pseudo: 'Alice', lieu: { etat: 'enLigne' } }]);

    montage.annuaire.amities.clear();
    montage.annuaire.signaler('alice', 'bob');
    await laisserFinir();

    expect(presence(montage, 'a1')).toEqual([]);
    expect(presence(montage, 'b1')).toEqual([]);
  });

  it('ne disent rien a un compte hors ligne', async () => {
    const montage = monter(annuaireDEssai(['alice', 'bob']));
    montage.amis.connexionOuverte('a1', 'alice');
    await laisserFinir();

    montage.annuaire.signaler('alice', 'bob');
    await laisserFinir();

    expect(montage.annuaire.lectures).toEqual(['alice', 'alice']);
  });

  it('ne s ecoutent plus une fois ferme', async () => {
    const montage = monter(annuaireDEssai(['alice', 'bob']));
    montage.amis.connexionOuverte('a1', 'alice');
    await laisserFinir();
    montage.amis.fermer();
    oublier(montage);

    montage.annuaire.signaler('alice', 'bob');
    await laisserFinir();

    expect(montage.recus.size).toBe(0);
  });
});
