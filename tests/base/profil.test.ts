/**
 * Tests d'integration du profil, contre une vraie base Neon.
 *
 * Ce sont les tests de la route du profil que demande la fiche de la reprise des
 * ecrans du jalon 3: les statistiques se deduisent de tout l'historique enregistre,
 * seules les dernieres parties sont rendues, une partie jouee seul n'est pas une
 * victoire, et le profil n'est rendu qu'a qui presente sa session.
 */

import type { LimitesDesComptes, NouveauResultat, ServeurMonte } from '@neon-ninja/server';
import {
  Authentification,
  demarrerServeur,
  enregistrerPartie,
  trouverCompteParPseudo,
} from '@neon-ninja/server';
import type { ProfilDuCompte } from '@neon-ninja/shared';
import { PARTIES_DU_PROFIL, ROUTES_COMPTES } from '@neon-ninja/shared';
import { afterEach, describe, expect, it } from 'vitest';

import { baseDeTest, baseDisponible, pseudoNeuf } from './contexte.js';

/** Des limites que les tests ne peuvent pas atteindre sans le vouloir. */
const LIMITES_LARGES: LimitesDesComptes = {
  connexionParPseudo: { parSeconde: 100, rafale: 1000 },
  connexionParAdresse: { parSeconde: 100, rafale: 1000 },
  inscriptionParAdresse: { parSeconde: 100, rafale: 1000 },
};

/** Un scrypt allege: ces tests ne portent pas sur l'empreinte. */
const SCRYPT_ALLEGE = { N: 2 ** 10, r: 8, p: 1 };

const MOT_DE_PASSE = 'correct cheval pile agrafe';

describe.runIf(baseDisponible())('profil', () => {
  const db = baseDeTest();
  const serveurs: ServeurMonte[] = [];

  afterEach(async () => {
    for (const serveur of serveurs.splice(0)) {
      await serveur.fermer();
    }
  });

  /** L'authentification sur la base de test. */
  function authentification(): Authentification {
    return new Authentification({
      db: db(),
      limites: LIMITES_LARGES,
      parametresScrypt: SCRYPT_ALLEGE,
    });
  }

  /** Inscrit un compte neuf, et rend son jeton et son identifiant. */
  async function inscrire(
    auth: Authentification,
  ): Promise<{ readonly jeton: string; readonly compteId: string }> {
    const pseudo = pseudoNeuf('Profil');
    const reponse = await auth.inscrire({ pseudo, motDePasse: MOT_DE_PASSE }, '127.0.0.1');

    if (!reponse.acceptee) {
      throw new Error(`Inscription refusee: ${JSON.stringify(reponse.erreurs)}`);
    }

    const compte = await trouverCompteParPseudo(db(), pseudo);

    if (compte === undefined) {
      throw new Error("Le compte inscrit n'est pas en base.");
    }

    return { jeton: reponse.valeur.jeton, compteId: compte.id };
  }

  /** Enregistre une partie, terminee a cette date, avec ce resultat pour le compte. */
  async function jouer(
    compteId: string,
    termineeLe: string,
    nombreJoueurs: number,
    resultat: Partial<NouveauResultat>,
  ): Promise<void> {
    await enregistrerPartie(
      db(),
      {
        mode: 'classique',
        carte: 'map3',
        modeMiroir: true,
        dureeS: 180,
        nombreJoueurs,
        termineeLe: new Date(termineeLe),
      },
      [
        {
          compteId,
          placement: 2,
          points: 10,
          captures: 0,
          botsNoirsDetruits: 0,
          xpGagnee: 30,
          piecesGagnees: 3,
          variationPointsLigue: 0,
          ...resultat,
        },
      ],
    );
  }

  /** Le profil, ou un echec de test explicite. */
  async function profilDe(auth: Authentification, jeton: string): Promise<ProfilDuCompte> {
    const reponse = await auth.profil(jeton);

    if (!reponse.acceptee) {
      throw new Error(`Profil refuse: ${JSON.stringify(reponse.erreurs)}`);
    }

    return reponse.valeur;
  }

  it('rend un profil vide a un compte qui n a jamais joue', async () => {
    const auth = authentification();
    const { jeton } = await inscrire(auth);

    const profil = await profilDe(auth, jeton);

    expect(profil.statistiques).toEqual({ partiesJouees: 0, victoires: 0 });
    expect(profil.dernieresParties).toEqual([]);
    expect(profil).toMatchObject({ niveau: 1, xpTotale: 0, pieces: 0, pointsLigue: 0 });
  });

  it('deduit les statistiques de tout l historique, et ne rend que les dernieres parties', async () => {
    const auth = authentification();
    const { jeton, compteId } = await inscrire(auth);
    const total = PARTIES_DU_PROFIL + 2;

    // La plus ancienne partie porte le meilleur score: les statistiques doivent le
    // voir, bien qu'elle ne soit pas parmi les parties rendues.
    await jouer(compteId, '2026-01-01T12:00:00.000Z', 3, { placement: 1, points: 99 });

    for (let jour = 2; jour <= total; jour += 1) {
      await jouer(compteId, `2026-01-${String(jour).padStart(2, '0')}T12:00:00.000Z`, 3, {
        placement: jour % 4 === 0 ? 1 : 2,
        points: jour,
      });
    }

    const profil = await profilDe(auth, jeton);

    expect(profil.statistiques).toEqual({ partiesJouees: total, victoires: 4, meilleurScore: 99 });
    expect(profil.dernieresParties).toHaveLength(PARTIES_DU_PROFIL);
    expect(profil.dernieresParties[0]).toEqual({
      mode: 'classique',
      carte: 'map3',
      modeMiroir: true,
      placement: 1,
      nombreJoueurs: 3,
      points: total,
      xpGagnee: 30,
      piecesGagnees: 3,
      variationPointsLigue: 0,
      termineeLe: `2026-01-${String(total)}T12:00:00.000Z`,
    });
  });

  it('ne compte pas une partie jouee seul comme une victoire', async () => {
    const auth = authentification();
    const { jeton, compteId } = await inscrire(auth);

    await jouer(compteId, '2026-02-01T12:00:00.000Z', 1, { placement: 1, points: 40 });
    await jouer(compteId, '2026-02-02T12:00:00.000Z', 2, { placement: 1, points: 20 });

    expect((await profilDe(auth, jeton)).statistiques).toEqual({
      partiesJouees: 2,
      victoires: 1,
      meilleurScore: 40,
    });
  });

  it('rend le profil par sa route a qui presente sa session, et le refuse sans', async () => {
    const auth = authentification();
    const { jeton } = await inscrire(auth);
    const serveur = await demarrerServeur(0, { comptes: auth });
    serveurs.push(serveur);

    const adresse = serveur.http.address();
    if (typeof adresse !== 'object' || adresse === null) {
      throw new Error("Le serveur de test n'a pas d'adresse.");
    }

    const url = `http://127.0.0.1:${String(adresse.port)}${ROUTES_COMPTES.profil}`;
    const avecSession = await fetch(url, { headers: { Authorization: `Bearer ${jeton}` } });
    const sansSession = await fetch(url);
    const jetonInconnu = await fetch(url, {
      headers: { Authorization: `Bearer ${'x'.repeat(43)}` },
    });

    expect(avecSession.status).toBe(200);
    expect(((await avecSession.json()) as ProfilDuCompte).statistiques).toEqual({
      partiesJouees: 0,
      victoires: 0,
    });
    expect(sansSession.status).toBe(401);
    expect(jetonInconnu.status).toBe(401);
  });
});
