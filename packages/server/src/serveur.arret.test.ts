/**
 * Tests de l'arret du serveur (etape 2.6).
 *
 * Ce qu'ils protegent: l'arret d'une mise en ligne ne reste pas suspendu a une
 * connexion qu'un navigateur a ouverte d'avance sans y envoyer de requete, ce qui a
 * ete constate a l'etape 2.6, quand les pages se sont mises a rouvrir leur lien
 * d'elles-memes; une reponse en cours part avant que le serveur ne s'eteigne; plus
 * aucune connexion n'est acceptee ensuite.
 */

import { connect } from 'node:net';

import type { SessionOuverte } from '@neon-ninja/shared';
import { ROUTES_COMPTES } from '@neon-ninja/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ReponseDeCompte, ServiceDeComptes } from './comptes/annuaire.js';
import type { OptionsServeur, ServeurMonte } from './serveur.js';
import { demarrerServeur } from './serveur.js';

const SESSION: SessionOuverte = { jeton: 'J'.repeat(43), compte: { pseudo: 'Alice', niveau: 1 } };

let serveur: ServeurMonte | undefined;

afterEach(async () => {
  await serveur?.fermer();
  serveur = undefined;
});

/** Monte un serveur, et rend son port. */
async function monter(options: OptionsServeur = {}): Promise<number> {
  serveur = await demarrerServeur(0, options);
  const adresse = serveur.http.address();

  if (typeof adresse !== 'object' || adresse === null) {
    throw new Error("Le serveur de test n'a pas d'adresse.");
  }

  return adresse.port;
}

/** Arrete le serveur monte, et le dit arrete. */
async function arreter(): Promise<void> {
  const enMarche = serveur;
  serveur = undefined;
  await enMarche?.fermer();
}

/** Ce que rend une attente: le travail a abouti, ou le delai est passe avant. */
async function avantLeDelai(travail: Promise<unknown>, delaiMs: number): Promise<boolean> {
  let minuterie: NodeJS.Timeout | undefined;

  const abouti = await Promise.race([
    travail.then(() => true),
    new Promise<boolean>((resoudre) => {
      minuterie = setTimeout(() => {
        resoudre(false);
      }, delaiMs);
    }),
  ]);

  clearTimeout(minuterie);
  return abouti;
}

/** Un service des comptes dont la connexion attend qu'on la laisse repondre. */
function comptesQuiFontAttendre(): {
  readonly service: ServiceDeComptes;
  readonly repondre: () => void;
} {
  let repondre = (): void => undefined;
  const reponse = new Promise<void>((resoudre) => {
    repondre = resoudre;
  });

  const service: ServiceDeComptes = {
    inscrire: vi.fn(),
    connecter: vi.fn(async (): Promise<ReponseDeCompte<SessionOuverte>> => {
      await reponse;
      return { acceptee: true, valeur: SESSION };
    }),
    deconnecter: vi.fn(),
    maProgression: vi.fn(),
    profil: vi.fn(),
    ficheJoueur: vi.fn(),
    amis: vi.fn(),
    gesteDAmitie: vi.fn(),
    changerMotDePasse: vi.fn(),
    nouveauCodeDeSecours: vi.fn(),
    reinitialiser: vi.fn(),
    compteDeSession: vi.fn(async () => undefined),
    identiteDe: vi.fn(async () => undefined),
    pseudoDeCompte: vi.fn(async () => false),
    enregistrerFinDePartie: vi.fn(async () => []),
    surSessionsFermees: vi.fn(() => () => undefined),
    amisDe: vi.fn(async () => []),
    surAmitiesChangees: vi.fn(() => () => undefined),
  };

  return { service, repondre: () => repondre() };
}

describe('l arret du serveur', () => {
  it('ne reste pas suspendu a une connexion ouverte sans requete, comme un navigateur en ouvre', async () => {
    const port = await monter();
    const connexion = connect(port, '127.0.0.1');
    await new Promise<void>((resoudre) => {
      connexion.once('connect', () => {
        resoudre();
      });
    });

    try {
      expect(await avantLeDelai(arreter(), 2000)).toBe(true);
    } finally {
      connexion.destroy();
    }
  });

  it('laisse partir une reponse en cours avant de s eteindre, puis refuse toute connexion', async () => {
    const { service, repondre } = comptesQuiFontAttendre();
    const port = await monter({ comptes: service });
    const url = `http://127.0.0.1:${String(port)}`;

    const enCours = fetch(`${url}${ROUTES_COMPTES.connexion}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    await vi.waitFor(() => {
      expect(service.connecter).toHaveBeenCalled();
    });

    let eteint = false;
    const arret = arreter().then(() => {
      eteint = true;
    });

    // La reponse n'est pas partie: le serveur l'attend.
    await new Promise((resoudre) => setTimeout(resoudre, 100));
    expect(eteint).toBe(false);

    repondre();

    expect((await enCours).status).toBe(200);
    await arret;
    expect(eteint).toBe(true);
    await expect(fetch(`${url}/sante`)).rejects.toThrow();
  });
});
