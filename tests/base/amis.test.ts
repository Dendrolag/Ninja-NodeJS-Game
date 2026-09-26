/**
 * Tests d'integration des amis (etape 3.6), contre une vraie base.
 *
 * Ce que la fiche de l'etape demande: les contraintes des trois tables, la demande et
 * l'acceptation, les demandes croisees, le refus, le retrait, le blocage et le
 * deblocage, la demande d'un bloque enregistree mais invisible, les bornes, les gestes
 * concurrents, la cascade a la suppression d'un compte, la relation et le face-a-face
 * sur la fiche, et la liste triee. Les regles elles-memes, geste par geste, sont
 * verifiees sans base dans packages/server/src/comptes/amities.test.ts.
 */

import type {
  BaseDeDonnees,
  LimitesDesComptes,
  NouveauResultat,
  ServeurMonte,
} from '@neon-ninja/server';
import {
  Authentification,
  DEBLOQUER_D_ABORD,
  JOUEUR_INCONNU,
  MES_AMIS_AU_COMPLET,
  SES_AMIS_AU_COMPLET,
  TROP_DE_DEMANDES,
  demarrerServeur,
  enregistrerPartie,
  erreurPostgres,
  schema,
  trouverCompteParPseudo,
} from '@neon-ninja/server';
import type { FicheJoueur, GesteDAmitie, ListeDAmis, ReponseDeGeste } from '@neon-ninja/shared';
import { BORNES_AMITIES, ROUTES_COMPTES, reperePseudo } from '@neon-ninja/shared';
import { and, eq, or, sql } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';

import { baseDeTest, baseDisponible, erreurDe, pseudoNeuf } from './contexte.js';

/** Des limites que les tests ne peuvent pas atteindre sans le vouloir. */
const LIMITES_LARGES: LimitesDesComptes = {
  connexionParPseudo: { parSeconde: 100, rafale: 1000 },
  connexionParAdresse: { parSeconde: 100, rafale: 1000 },
  inscriptionParAdresse: { parSeconde: 100, rafale: 1000 },
  ficheParCompte: { parSeconde: 100, rafale: 1000 },
  gesteDAmitieParCompte: { parSeconde: 100, rafale: 1000 },
  demandeDAmiParCompte: { parSeconde: 100, rafale: 1000 },
};

/** Un scrypt allege: ces tests ne portent pas sur l'empreinte. */
const SCRYPT_ALLEGE = { N: 2 ** 10, r: 8, p: 1 };

const MOT_DE_PASSE = 'correct cheval pile agrafe';

/** Un compte inscrit pour le test. */
interface CompteDeTest {
  readonly pseudo: string;
  readonly jeton: string;
  readonly compteId: string;
}

describe.runIf(baseDisponible())('amis', () => {
  const db = baseDeTest();
  const serveurs: ServeurMonte[] = [];

  afterEach(async () => {
    for (const serveur of serveurs.splice(0)) {
      await serveur.fermer();
    }
  });

  /** L'authentification sur la base de test. */
  function authentification(limites: LimitesDesComptes = LIMITES_LARGES): Authentification {
    return new Authentification({ db: db(), limites, parametresScrypt: SCRYPT_ALLEGE });
  }

  /** Inscrit un compte neuf sous un pseudo tire de ce prefixe. */
  async function inscrire(auth: Authentification, prefixe = 'Ami'): Promise<CompteDeTest> {
    const pseudo = pseudoNeuf(prefixe);
    const reponse = await auth.inscrire({ pseudo, motDePasse: MOT_DE_PASSE }, '127.0.0.1');

    if (!reponse.acceptee) {
      throw new Error(`Inscription refusee: ${JSON.stringify(reponse.erreurs)}`);
    }

    const compte = await trouverCompteParPseudo(db(), pseudo);

    if (compte === undefined) {
      throw new Error("Le compte inscrit n'est pas en base.");
    }

    return { pseudo, jeton: reponse.valeur.jeton, compteId: compte.id };
  }

  /** Fait un geste accepte, ou un echec de test explicite. */
  async function geste(
    auth: Authentification,
    de: CompteDeTest,
    nom: GesteDAmitie,
    vers: string,
  ): Promise<ReponseDeGeste> {
    const reponse = await auth.gesteDAmitie(de.jeton, { geste: nom, pseudo: vers });

    if (!reponse.acceptee) {
      throw new Error(`Geste ${nom} refuse: ${JSON.stringify(reponse.erreurs)}`);
    }

    return reponse.valeur;
  }

  /** La liste des amis, ou un echec de test explicite. */
  async function listeDe(auth: Authentification, compte: CompteDeTest): Promise<ListeDAmis> {
    const reponse = await auth.amis(compte.jeton);

    if (!reponse.acceptee) {
      throw new Error(`Liste refusee: ${JSON.stringify(reponse.erreurs)}`);
    }

    return reponse.valeur;
  }

  /** La fiche, ou un echec de test explicite. */
  async function ficheDe(
    auth: Authentification,
    lecteur: CompteDeTest,
    pseudo: string,
  ): Promise<FicheJoueur> {
    const reponse = await auth.ficheJoueur(lecteur.jeton, pseudo);

    if (!reponse.acceptee) {
      throw new Error(`Fiche refusee: ${JSON.stringify(reponse.erreurs)}`);
    }

    return reponse.valeur;
  }

  /** Les pseudos d'une liste. */
  const pseudos = (liste: readonly { readonly pseudo: string }[]): string[] =>
    liste.map((personne) => personne.pseudo);

  /** Le nombre de lignes d'amitie entre ces deux comptes, dans un sens ou dans l'autre. */
  async function lignesDAmitie(a: string, b: string): Promise<number> {
    const lignes = await db()
      .select()
      .from(schema.amities)
      .where(
        or(
          and(eq(schema.amities.compteA, a), eq(schema.amities.compteB, b)),
          and(eq(schema.amities.compteA, b), eq(schema.amities.compteB, a)),
        ),
      );

    return lignes.length;
  }

  /**
   * Cree ce nombre de comptes d'un coup, sans mot de passe, et rend leurs identifiants:
   * les bornes demandent des centaines de comptes, qu'une inscription chacun rendrait
   * lents.
   */
  async function comptesEnNombre(base: BaseDeDonnees, nombre: number): Promise<string[]> {
    const prefixe = pseudoNeuf('Foule');
    const crees = await base
      .insert(schema.comptes)
      .values(
        Array.from({ length: nombre }, (_, index) => {
          const pseudo = `${prefixe}-${String(index)}`;
          return { pseudo, reperePseudo: reperePseudo(pseudo) };
        }),
      )
      .returning({ id: schema.comptes.id });
    const ids = crees.map((compte) => compte.id);

    await base.insert(schema.progressions).values(ids.map((compteId) => ({ compteId })));

    return ids;
  }

  /** Rend ce compte ami de tous ceux-la, directement en base. */
  async function amitiesEnNombre(compteId: string, autres: readonly string[]): Promise<void> {
    await db()
      .insert(schema.amities)
      .values(
        autres.map((autre) => ({
          compteA: sql`least(${compteId}::uuid, ${autre}::uuid)`,
          compteB: sql`greatest(${compteId}::uuid, ${autre}::uuid)`,
        })),
      );
  }

  // --------------------------------------------------------------------------
  // Contraintes
  // --------------------------------------------------------------------------

  it('refuse une amitie dans le mauvais ordre, une demande ou un blocage de soi, et les doublons', async () => {
    const auth = authentification();
    const alice = await inscrire(auth);
    const bob = await inscrire(auth);
    const [petit, grand] = [alice.compteId, bob.compteId].sort();

    if (petit === undefined || grand === undefined) {
      throw new Error('Deux comptes attendus.');
    }

    const desordre = await erreurDe(
      db().insert(schema.amities).values({ compteA: grand, compteB: petit }),
    );
    const demandeASoi = await erreurDe(
      db().insert(schema.demandesDAmi).values({ de: alice.compteId, pour: alice.compteId }),
    );
    const blocageDeSoi = await erreurDe(
      db().insert(schema.blocages).values({ bloqueur: alice.compteId, bloque: alice.compteId }),
    );

    expect(erreurPostgres(desordre)?.contrainte).toBe('amities_dans_l_ordre');
    expect(erreurPostgres(demandeASoi)?.contrainte).toBe('demandes_d_ami_pas_a_soi');
    expect(erreurPostgres(blocageDeSoi)?.contrainte).toBe('blocages_pas_de_soi');

    await db().insert(schema.amities).values({ compteA: petit, compteB: grand });
    const doublon = await erreurDe(
      db().insert(schema.amities).values({ compteA: petit, compteB: grand }),
    );

    expect(erreurPostgres(doublon)?.contrainte).toBe('amities_paire');
  });

  it('efface amities, demandes et blocages avec le compte', async () => {
    const auth = authentification();
    const alice = await inscrire(auth);
    const bob = await inscrire(auth);
    const carole = await inscrire(auth);
    const david = await inscrire(auth);

    await geste(auth, alice, 'demander', bob.pseudo);
    await geste(auth, bob, 'accepter', alice.pseudo);
    await geste(auth, alice, 'demander', carole.pseudo);
    await geste(auth, alice, 'bloquer', david.pseudo);

    await db().delete(schema.comptes).where(eq(schema.comptes.id, alice.compteId));

    expect(await lignesDAmitie(alice.compteId, bob.compteId)).toBe(0);
    expect(
      await db()
        .select()
        .from(schema.demandesDAmi)
        .where(eq(schema.demandesDAmi.de, alice.compteId)),
    ).toEqual([]);
    expect(
      await db().select().from(schema.blocages).where(eq(schema.blocages.bloqueur, alice.compteId)),
    ).toEqual([]);
    expect((await listeDe(auth, bob)).amis).toEqual([]);
    expect((await listeDe(auth, carole)).recues).toEqual([]);
  });

  // --------------------------------------------------------------------------
  // Demander, accepter, refuser, annuler, retirer
  // --------------------------------------------------------------------------

  it('fait deux amis d une demande acceptee, vus de chaque cote', async () => {
    const auth = authentification();
    const alice = await inscrire(auth);
    const bob = await inscrire(auth);

    const demande = await geste(auth, alice, 'demander', bob.pseudo.toLowerCase());

    expect(demande.relation).toBe('demandeEnvoyee');
    expect(pseudos(demande.amis.envoyees)).toEqual([bob.pseudo]);
    expect(pseudos((await listeDe(auth, bob)).recues)).toEqual([alice.pseudo]);
    expect((await ficheDe(auth, bob, alice.pseudo)).relation).toBe('demandeRecue');

    const acceptation = await geste(auth, bob, 'accepter', alice.pseudo);

    expect(acceptation.relation).toBe('ami');
    expect(acceptation.amis).toEqual({
      amis: [{ pseudo: alice.pseudo, niveau: 1 }],
      recues: [],
      envoyees: [],
      bloques: [],
    });
    expect(pseudos((await listeDe(auth, alice)).amis)).toEqual([bob.pseudo]);
    expect((await listeDe(auth, alice)).envoyees).toEqual([]);
    expect(await lignesDAmitie(alice.compteId, bob.compteId)).toBe(1);

    // Tout geste deja fait ne change rien, et ne refuse rien.
    expect((await geste(auth, alice, 'demander', bob.pseudo)).relation).toBe('ami');
    expect((await geste(auth, alice, 'accepter', bob.pseudo)).relation).toBe('ami');
    expect(await lignesDAmitie(alice.compteId, bob.compteId)).toBe(1);
  });

  it('fait valoir une demande croisee comme acceptation', async () => {
    const auth = authentification();
    const alice = await inscrire(auth);
    const bob = await inscrire(auth);

    await geste(auth, alice, 'demander', bob.pseudo);
    const croisee = await geste(auth, bob, 'demander', alice.pseudo);

    expect(croisee.relation).toBe('ami');
    expect(await lignesDAmitie(alice.compteId, bob.compteId)).toBe(1);
    expect((await listeDe(auth, alice)).envoyees).toEqual([]);
  });

  it('ne fait qu une amitie de deux demandes croisees au meme instant', async () => {
    const auth = authentification();
    const alice = await inscrire(auth);
    const bob = await inscrire(auth);

    const [deAlice, deBob] = await Promise.all([
      geste(auth, alice, 'demander', bob.pseudo),
      geste(auth, bob, 'demander', alice.pseudo),
    ]);

    // L'une est passee la premiere, sous le verrou: l'autre l'a trouvee, et accepte.
    expect([deAlice.relation, deBob.relation].sort()).toEqual(['ami', 'demandeEnvoyee']);
    expect(await lignesDAmitie(alice.compteId, bob.compteId)).toBe(1);
    expect(
      await db()
        .select()
        .from(schema.demandesDAmi)
        .where(
          or(eq(schema.demandesDAmi.de, alice.compteId), eq(schema.demandesDAmi.de, bob.compteId)),
        ),
    ).toEqual([]);
  });

  it('refuse, annule et retire sans rien dire a l autre', async () => {
    const auth = authentification();
    const alice = await inscrire(auth);
    const bob = await inscrire(auth);
    const carole = await inscrire(auth);

    await geste(auth, alice, 'demander', bob.pseudo);
    expect((await geste(auth, bob, 'refuser', alice.pseudo)).relation).toBe('aucune');
    expect((await listeDe(auth, alice)).envoyees).toEqual([]);
    expect((await ficheDe(auth, alice, bob.pseudo)).relation).toBe('aucune');

    await geste(auth, alice, 'demander', carole.pseudo);
    expect((await geste(auth, alice, 'annuler', carole.pseudo)).relation).toBe('aucune');
    expect((await listeDe(auth, carole)).recues).toEqual([]);

    await geste(auth, alice, 'demander', bob.pseudo);
    await geste(auth, bob, 'accepter', alice.pseudo);
    expect((await geste(auth, bob, 'retirer', alice.pseudo)).relation).toBe('aucune');
    expect((await listeDe(auth, alice)).amis).toEqual([]);
    expect(await lignesDAmitie(alice.compteId, bob.compteId)).toBe(0);

    // Rien a defaire: ni refus ni ecriture.
    expect((await geste(auth, bob, 'retirer', alice.pseudo)).relation).toBe('aucune');
  });

  it('refuse d accepter une demande qui n existe pas', async () => {
    const auth = authentification();
    const alice = await inscrire(auth);
    const bob = await inscrire(auth);

    expect(
      await auth.gesteDAmitie(alice.jeton, { geste: 'accepter', pseudo: bob.pseudo }),
    ).toMatchObject({
      acceptee: false,
      motif: 'gesteImpossible',
    });
  });

  // --------------------------------------------------------------------------
  // Bloquer
  // --------------------------------------------------------------------------

  it('bloque en silence: le bloque n en sait rien, et sa demande est ignoree', async () => {
    const auth = authentification();
    const alice = await inscrire(auth);
    const bob = await inscrire(auth);

    await geste(auth, alice, 'demander', bob.pseudo);
    await geste(auth, bob, 'accepter', alice.pseudo);

    const blocage = await geste(auth, alice, 'bloquer', bob.pseudo);

    expect(blocage.relation).toBe('bloque');
    expect(blocage.amis.amis).toEqual([]);
    expect(pseudos(blocage.amis.bloques)).toEqual([bob.pseudo]);

    // Vu de Bob: plus d'ami, et rien d'autre.
    expect(await listeDe(auth, bob)).toEqual({ amis: [], recues: [], envoyees: [], bloques: [] });
    const ficheDAlice = await ficheDe(auth, bob, alice.pseudo);
    expect(ficheDAlice.relation).toBe('aucune');
    expect(ficheDAlice).not.toHaveProperty('ensemble');

    // Sa demande est acceptee, et se montre comme toute demande qui attend.
    expect((await geste(auth, bob, 'demander', alice.pseudo)).relation).toBe('demandeEnvoyee');
    expect(pseudos((await listeDe(auth, bob)).envoyees)).toEqual([alice.pseudo]);
    expect((await ficheDe(auth, bob, alice.pseudo)).relation).toBe('demandeEnvoyee');

    // Alice ne la voit pas, ne peut pas l'accepter, ni demander Bob.
    expect((await listeDe(auth, alice)).recues).toEqual([]);
    expect((await ficheDe(auth, alice, bob.pseudo)).relation).toBe('bloque');
    expect(
      await auth.gesteDAmitie(alice.jeton, { geste: 'accepter', pseudo: bob.pseudo }),
    ).toMatchObject({ acceptee: false, motif: 'gesteImpossible' });
    expect(await auth.gesteDAmitie(alice.jeton, { geste: 'demander', pseudo: bob.pseudo })).toEqual(
      {
        acceptee: false,
        motif: 'gesteImpossible',
        erreurs: [{ champ: 'geste', motif: DEBLOQUER_D_ABORD }],
      },
    );

    // Debloquer n'y fait pas resurgir la demande ignoree.
    expect((await geste(auth, alice, 'debloquer', bob.pseudo)).relation).toBe('aucune');
    expect((await listeDe(auth, alice)).recues).toEqual([]);
    expect((await listeDe(auth, bob)).envoyees).toEqual([]);
  });

  it('defait les demandes dans les deux sens en bloquant', async () => {
    const auth = authentification();
    const alice = await inscrire(auth);
    const bob = await inscrire(auth);

    await geste(auth, bob, 'demander', alice.pseudo);
    await geste(auth, alice, 'bloquer', bob.pseudo);

    expect((await listeDe(auth, bob)).envoyees).toEqual([]);
    expect(
      await db().select().from(schema.demandesDAmi).where(eq(schema.demandesDAmi.de, bob.compteId)),
    ).toEqual([]);
  });

  // --------------------------------------------------------------------------
  // Bornes et limites
  // --------------------------------------------------------------------------

  it('refuse une amitie au-dela de 200 amis, de chaque cote', async () => {
    const auth = authentification();
    const alice = await inscrire(auth);
    const bob = await inscrire(auth);
    const carole = await inscrire(auth);
    const foule = await comptesEnNombre(db(), BORNES_AMITIES.amisMaximum);

    await amitiesEnNombre(bob.compteId, foule);

    // Bob est au complet: il ne demande plus, et personne ne devient son ami.
    expect(
      await auth.gesteDAmitie(bob.jeton, { geste: 'demander', pseudo: carole.pseudo }),
    ).toEqual({
      acceptee: false,
      motif: 'gesteImpossible',
      erreurs: [{ champ: 'geste', motif: MES_AMIS_AU_COMPLET }],
    });
    expect((await geste(auth, alice, 'demander', bob.pseudo)).relation).toBe('demandeEnvoyee');
    expect(
      await auth.gesteDAmitie(bob.jeton, { geste: 'accepter', pseudo: alice.pseudo }),
    ).toMatchObject({ erreurs: [{ motif: MES_AMIS_AU_COMPLET }] });

    await geste(auth, carole, 'demander', alice.pseudo);
    await amitiesEnNombre(carole.compteId, foule);
    expect(
      await auth.gesteDAmitie(alice.jeton, { geste: 'accepter', pseudo: carole.pseudo }),
    ).toMatchObject({ erreurs: [{ motif: SES_AMIS_AU_COMPLET }] });
  });

  it('refuse une demande au-dela de 50 en attente', async () => {
    const auth = authentification();
    const alice = await inscrire(auth);
    const bob = await inscrire(auth);
    const foule = await comptesEnNombre(db(), BORNES_AMITIES.demandesEnAttenteMaximum);

    await db()
      .insert(schema.demandesDAmi)
      .values(foule.map((pour) => ({ de: alice.compteId, pour })));

    expect(await auth.gesteDAmitie(alice.jeton, { geste: 'demander', pseudo: bob.pseudo })).toEqual(
      {
        acceptee: false,
        motif: 'gesteImpossible',
        erreurs: [{ champ: 'geste', motif: TROP_DE_DEMANDES }],
      },
    );
  });

  it('limite les demandes d un compte, sans gener ses autres gestes ni les autres comptes', async () => {
    const auth = authentification({
      ...LIMITES_LARGES,
      demandeDAmiParCompte: { parSeconde: 1 / 3600, rafale: 2 },
    });
    const alice = await inscrire(auth);
    const autres = [await inscrire(auth), await inscrire(auth), await inscrire(auth)];
    const [bob, carole, david] = autres as [CompteDeTest, CompteDeTest, CompteDeTest];

    await geste(auth, alice, 'demander', bob.pseudo);
    await geste(auth, alice, 'demander', carole.pseudo);

    expect(
      await auth.gesteDAmitie(alice.jeton, { geste: 'demander', pseudo: david.pseudo }),
    ).toMatchObject({ acceptee: false, motif: 'tropDeTentatives' });
    expect((await geste(auth, alice, 'annuler', bob.pseudo)).relation).toBe('aucune');
    expect((await geste(auth, david, 'demander', alice.pseudo)).relation).toBe('demandeEnvoyee');
  });

  it('limite tous les gestes d un compte', async () => {
    const auth = authentification({
      ...LIMITES_LARGES,
      gesteDAmitieParCompte: { parSeconde: 1 / 3600, rafale: 1 },
    });
    const alice = await inscrire(auth);
    const bob = await inscrire(auth);

    await geste(auth, alice, 'retirer', bob.pseudo);

    expect(
      await auth.gesteDAmitie(alice.jeton, { geste: 'bloquer', pseudo: bob.pseudo }),
    ).toMatchObject({ acceptee: false, motif: 'tropDeTentatives' });
  });

  it('refuse sans session, un geste mal forme, soi-meme, et un pseudo sans compte', async () => {
    const auth = authentification();
    const alice = await inscrire(auth);

    expect(await auth.amis('x'.repeat(43))).toMatchObject({
      acceptee: false,
      motif: 'sessionAbsente',
    });
    expect(
      await auth.gesteDAmitie('x'.repeat(43), { geste: 'demander', pseudo: 'Bob' }),
    ).toMatchObject({ acceptee: false, motif: 'sessionAbsente' });
    expect(
      await auth.gesteDAmitie(alice.jeton, { geste: 'embrasser', pseudo: 'Bob' }),
    ).toMatchObject({ acceptee: false, motif: 'demandeInvalide' });
    expect(
      await auth.gesteDAmitie(alice.jeton, {
        geste: 'demander',
        pseudo: alice.pseudo.toUpperCase(),
      }),
    ).toMatchObject({ acceptee: false, motif: 'gesteImpossible' });
    expect(
      await auth.gesteDAmitie(alice.jeton, { geste: 'demander', pseudo: pseudoNeuf('Personne') }),
    ).toEqual({
      acceptee: false,
      motif: 'joueurInconnu',
      erreurs: [{ champ: 'pseudo', motif: JOUEUR_INCONNU }],
    });
    expect((await ficheDe(auth, alice, alice.pseudo)).relation).toBe('soi');
  });

  // --------------------------------------------------------------------------
  // Liste et fiche
  // --------------------------------------------------------------------------

  it('trie chaque liste par pseudo, quelle que soit la casse, avec le niveau', async () => {
    const auth = authentification();
    const alice = await inscrire(auth);
    const suffixe = pseudoNeuf('');
    const noms = [`zoe${suffixe}`, `Ben${suffixe}`, `anna${suffixe}`];
    const comptes: CompteDeTest[] = [];

    for (const nom of noms) {
      const reponse = await auth.inscrire({ pseudo: nom, motDePasse: MOT_DE_PASSE }, '127.0.0.1');
      if (!reponse.acceptee) {
        throw new Error('Inscription refusee.');
      }
      const compte = await trouverCompteParPseudo(db(), nom);
      comptes.push({ pseudo: nom, jeton: reponse.valeur.jeton, compteId: compte?.id ?? '' });
    }

    for (const compte of comptes) {
      await geste(auth, compte, 'demander', alice.pseudo);
    }

    await db()
      .update(schema.progressions)
      .set({ xpTotale: 100_000 })
      .where(eq(schema.progressions.compteId, comptes[0]?.compteId ?? ''));

    const recues = (await listeDe(auth, alice)).recues;

    expect(pseudos(recues)).toEqual([`anna${suffixe}`, `Ben${suffixe}`, `zoe${suffixe}`]);
    expect(recues.find((personne) => personne.pseudo === `zoe${suffixe}`)?.niveau).toBeGreaterThan(
      1,
    );
  });

  it('montre a un ami les parties jouees ensemble, et le face-a-face sans les egalites', async () => {
    const auth = authentification();
    const alice = await inscrire(auth);
    const bob = await inscrire(auth);
    const carole = await inscrire(auth);

    /** Une partie ou Alice et Bob finissent a ces places. */
    const ensemble = async (placeAlice: number, placeBob: number): Promise<void> => {
      const resultat = (compteId: string, placement: number): NouveauResultat => ({
        compteId,
        placement,
        points: 10,
        captures: 0,
        botsNoirsDetruits: 0,
        xpGagnee: 30,
        piecesGagnees: 3,
        variationPointsLigue: 0,
      });

      await enregistrerPartie(
        db(),
        {
          mode: 'equipes',
          carte: 'map1',
          modeMiroir: false,
          dureeS: 180,
          nombreJoueurs: 4,
          termineeLe: new Date('2026-09-20T12:00:00.000Z'),
        },
        [resultat(alice.compteId, placeAlice), resultat(bob.compteId, placeBob)],
      );
    };

    await ensemble(1, 3);
    await ensemble(3, 1);
    await ensemble(1, 4);
    // Coequipiers vainqueurs: egalite.
    await ensemble(1, 1);

    // Pas encore amis: ni face-a-face, ni relation d'ami.
    const avant = await ficheDe(auth, alice, bob.pseudo);
    expect(avant.relation).toBe('aucune');
    expect(avant).not.toHaveProperty('ensemble');

    await geste(auth, alice, 'demander', bob.pseudo);
    await geste(auth, bob, 'accepter', alice.pseudo);

    expect((await ficheDe(auth, alice, bob.pseudo)).ensemble).toEqual({
      partiesEnsemble: 4,
      devant: 2,
      derriere: 1,
    });
    expect((await ficheDe(auth, bob, alice.pseudo)).ensemble).toEqual({
      partiesEnsemble: 4,
      devant: 1,
      derriere: 2,
    });

    // Un ami sans partie commune a un face-a-face vide.
    await geste(auth, alice, 'demander', carole.pseudo);
    await geste(auth, carole, 'accepter', alice.pseudo);
    expect((await ficheDe(auth, alice, carole.pseudo)).ensemble).toEqual({
      partiesEnsemble: 0,
      devant: 0,
      derriere: 0,
    });
  });

  it('sert la liste et les gestes par leur route, et les refuse sans session', async () => {
    const auth = authentification();
    const alice = await inscrire(auth);
    const bob = await inscrire(auth, 'Léa B.');
    const serveur = await demarrerServeur(0, { comptes: auth });
    serveurs.push(serveur);

    const adresse = serveur.http.address();
    if (typeof adresse !== 'object' || adresse === null) {
      throw new Error("Le serveur de test n'a pas d'adresse.");
    }

    const racine = `http://127.0.0.1:${String(adresse.port)}`;
    const avecSession = { Authorization: `Bearer ${alice.jeton}` };

    const demande = await fetch(`${racine}${ROUTES_COMPTES.amis}`, {
      method: 'POST',
      headers: { ...avecSession, 'Content-Type': 'application/json' },
      body: JSON.stringify({ geste: 'demander', pseudo: bob.pseudo }),
    });
    const liste = await fetch(`${racine}${ROUTES_COMPTES.amis}`, { headers: avecSession });
    const sansSession = await fetch(`${racine}${ROUTES_COMPTES.amis}`);
    const impossible = await fetch(`${racine}${ROUTES_COMPTES.amis}`, {
      method: 'POST',
      headers: { ...avecSession, 'Content-Type': 'application/json' },
      body: JSON.stringify({ geste: 'accepter', pseudo: bob.pseudo }),
    });

    expect(demande.status).toBe(200);
    expect(((await demande.json()) as ReponseDeGeste).relation).toBe('demandeEnvoyee');
    expect(pseudos(((await liste.json()) as ListeDAmis).envoyees)).toEqual([bob.pseudo]);
    expect(sansSession.status).toBe(401);
    expect(impossible.status).toBe(409);
  });
});
