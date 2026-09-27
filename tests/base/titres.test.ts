/**
 * Tests d'integration du titre (etape 3.9), contre une vraie base.
 *
 * La table et sa cle etrangere, qui refuse d'elle-meme un titre non obtenu; le choix par
 * le service, refuse pour un succes non obtenu, remplace, retire; et le titre relu par le
 * profil, la fiche et l'identite d'entree en partie.
 *
 * Chaque test cree ses comptes: les tests de la base tournent en parallele sur la meme
 * base.
 */

import type { LimitesDesComptes } from '@neon-ninja/server';
import {
  Authentification,
  CODES_POSTGRES,
  choisirLeTitre,
  creerCompte,
  erreurPostgres,
  profilDuCompte,
  retirerLeTitre,
  schema,
  trouverCompteParPseudo,
} from '@neon-ninja/server';
import type { IdentifiantSucces } from '@neon-ninja/shared';
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { accepte, baseDeTest, baseDisponible, erreurDe, pseudoNeuf } from './contexte.js';

/** Des limites que les tests ne peuvent pas atteindre sans le vouloir. */
const LIMITES_LARGES: LimitesDesComptes = {
  connexionParPseudo: { parSeconde: 100, rafale: 1000 },
  connexionParAdresse: { parSeconde: 100, rafale: 1000 },
  inscriptionParAdresse: { parSeconde: 100, rafale: 1000 },
};

/** Un scrypt allege: ces tests ne portent pas sur l'empreinte. */
const SCRYPT_ALLEGE = { N: 2 ** 10, r: 8, p: 1 };

const MOT_DE_PASSE = 'correct cheval pile agrafe';

describe.runIf(baseDisponible())('titres', () => {
  const db = baseDeTest();

  /** Un compte neuf, pour un seul test. */
  async function nouveauCompte(): Promise<string> {
    return accepte(await creerCompte(db(), pseudoNeuf('Titre'))).id;
  }

  /** Inscrit ces succes pour ce compte, comme une fin de partie l'aurait fait. */
  async function obtenir(compteId: string, ...succes: string[]): Promise<void> {
    await db()
      .insert(schema.succesDebloques)
      .values(succes.map((id) => ({ compteId, succes: id, debloqueLe: new Date() })));
  }

  /** Le titre de ce compte, tel que la table le garde. */
  async function titreEnBase(compteId: string): Promise<string | undefined> {
    const [ligne] = await db()
      .select({ succes: schema.titres.succes })
      .from(schema.titres)
      .where(eq(schema.titres.compteId, compteId));

    return ligne?.succes;
  }

  /** Un service des comptes, et un compte inscrit par lui, avec sa session. */
  async function inscrit(): Promise<{
    auth: Authentification;
    pseudo: string;
    compteId: string;
    jeton: string;
  }> {
    const auth = new Authentification({
      db: db(),
      limites: LIMITES_LARGES,
      parametresScrypt: SCRYPT_ALLEGE,
    });
    const pseudo = pseudoNeuf('Titre');
    const inscription = await auth.inscrire({ pseudo, motDePasse: MOT_DE_PASSE }, '127.0.0.1');
    const compte = await trouverCompteParPseudo(db(), pseudo);

    if (!inscription.acceptee || compte === undefined) {
      throw new Error('Inscription refusee.');
    }

    return { auth, pseudo, compteId: compte.id, jeton: inscription.valeur.jeton };
  }

  describe('la table', () => {
    it('refuse d elle-meme un titre qui n est pas un succes obtenu', async () => {
      const compteId = await nouveauCompte();
      await obtenir(compteId, 'premier-pas');

      expect(
        erreurPostgres(
          await erreurDe(db().insert(schema.titres).values({ compteId, succes: 'centurion' })),
        ),
      ).toEqual({ code: CODES_POSTGRES.cleEtrangere, contrainte: 'titres_succes_obtenu' });
    });

    it('perd le titre avec le succes qu il donnait, et avec le compte', async () => {
      const alice = await nouveauCompte();
      const bob = await nouveauCompte();
      await obtenir(alice, 'premier-pas');
      await obtenir(bob, 'premier-pas');
      await db()
        .insert(schema.titres)
        .values([
          { compteId: alice, succes: 'premier-pas' },
          { compteId: bob, succes: 'premier-pas' },
        ]);

      await db().delete(schema.succesDebloques).where(eq(schema.succesDebloques.compteId, alice));
      await db().delete(schema.comptes).where(eq(schema.comptes.id, bob));

      expect(await titreEnBase(alice)).toBeUndefined();
      expect(await titreEnBase(bob)).toBeUndefined();
    });
  });

  describe('choisir et retirer', () => {
    it('choisit un succes obtenu, et le remplace par un autre', async () => {
      const compteId = await nouveauCompte();
      await obtenir(compteId, 'premier-pas', 'premiere-prise');

      expect(await choisirLeTitre(db(), compteId, 'premier-pas')).toBe(true);
      expect(await titreEnBase(compteId)).toBe('premier-pas');

      expect(await choisirLeTitre(db(), compteId, 'premiere-prise')).toBe(true);
      expect(await titreEnBase(compteId)).toBe('premiere-prise');
    });

    it('refuse un succes non obtenu, sans toucher au titre porte', async () => {
      const compteId = await nouveauCompte();
      await obtenir(compteId, 'premier-pas');
      await choisirLeTitre(db(), compteId, 'premier-pas');

      expect(await choisirLeTitre(db(), compteId, 'centurion')).toBe(false);
      expect(await titreEnBase(compteId)).toBe('premier-pas');
    });

    it('ne prend pas le succes d un autre compte', async () => {
      const alice = await nouveauCompte();
      const bob = await nouveauCompte();
      await obtenir(bob, 'centurion');

      expect(await choisirLeTitre(db(), alice, 'centurion')).toBe(false);
      expect(await titreEnBase(alice)).toBeUndefined();
    });

    it('retire le titre, et ne fait rien sans titre', async () => {
      const compteId = await nouveauCompte();
      await obtenir(compteId, 'premier-pas');
      await choisirLeTitre(db(), compteId, 'premier-pas');

      await retirerLeTitre(db(), compteId);
      await retirerLeTitre(db(), compteId);

      expect(await titreEnBase(compteId)).toBeUndefined();
    });

    it('ignore a la lecture un titre que le code ne connait plus', async () => {
      const compteId = await nouveauCompte();
      await obtenir(compteId, 'succes-retire');
      await db().insert(schema.titres).values({ compteId, succes: 'succes-retire' });

      expect((await profilDuCompte(db(), compteId))?.titre).toBeUndefined();
    });
  });

  describe('le service', () => {
    it('choisit, refuse un succes non obtenu ou inconnu, et retire', async () => {
      const { auth, compteId, jeton } = await inscrit();
      await obtenir(compteId, 'premier-pas');

      expect(await auth.choisirUnTitre(jeton, { titre: 'premier-pas' })).toEqual({
        acceptee: true,
        valeur: { titre: 'premier-pas' },
      });
      expect(await auth.choisirUnTitre(jeton, { titre: 'centurion' })).toMatchObject({
        acceptee: false,
        motif: 'succesNonObtenu',
      });
      expect(await auth.choisirUnTitre(jeton, { titre: 'pas-un-succes' })).toMatchObject({
        acceptee: false,
        motif: 'demandeInvalide',
      });
      expect(await titreEnBase(compteId)).toBe('premier-pas');

      expect(await auth.choisirUnTitre(jeton, { titre: null })).toEqual({
        acceptee: true,
        valeur: {},
      });
      expect(await titreEnBase(compteId)).toBeUndefined();
    });

    it('refuse sans session, avant de lire la demande', async () => {
      const { auth } = await inscrit();

      expect(await auth.choisirUnTitre('x'.repeat(43), { titre: 'premier-pas' })).toMatchObject({
        acceptee: false,
        motif: 'sessionAbsente',
      });
    });

    it('montre le titre au profil, sur la fiche et a l entree en partie, et rien sans titre', async () => {
      const { auth, pseudo, compteId, jeton } = await inscrit();
      const lecteur = await inscrit();
      const titre: IdentifiantSucces = 'premier-pas';
      await obtenir(compteId, titre);

      const avant = await auth.profil(jeton);
      expect(avant.acceptee && 'titre' in avant.valeur).toBe(false);
      expect(await auth.identiteDe(compteId)).toEqual({ pseudo, niveau: 1 });

      await auth.choisirUnTitre(jeton, { titre });

      const profil = await auth.profil(jeton);
      const fiche = await lecteur.auth.ficheJoueur(lecteur.jeton, pseudo);

      expect(profil.acceptee ? profil.valeur.titre : undefined).toBe(titre);
      expect(fiche.acceptee ? fiche.valeur.titre : undefined).toBe(titre);
      expect(await auth.identiteDe(compteId)).toEqual({ pseudo, niveau: 1, titre });
    });
  });
});
