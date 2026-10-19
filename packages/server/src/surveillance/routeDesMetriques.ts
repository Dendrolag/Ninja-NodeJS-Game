/**
 * La route /metriques, sur un port a part, attache a 127.0.0.1 (etape 5.15).
 *
 * JAMAIS PUBLIQUE. Les metriques disent combien de parties tournent, sur quelles cartes,
 * et a quelle charge: rien de secret, mais rien qui regarde un visiteur, et une route de
 * plus a ouvrir au monde, c'est une surface de plus. Elle n'ecoute donc que l'interface
 * locale de la machine, sur un second port que Caddy ne relaie pas: seul l'agent Grafana
 * Alloy, sur la meme machine, la lit. Elle n'existe que si PORT_DES_METRIQUES est pose;
 * absent, comme sur Render, en developpement et dans les tests, aucun port n'est ouvert.
 */

import { createServer } from 'node:http';
import type { Server } from 'node:http';

import { ecouterSurUnPortPermis } from '../portsPermis.js';

/** L'adresse ou ecoute la route: l'interface locale, et elle seule. */
export const ADRESSE_DES_METRIQUES = '127.0.0.1';

/** Ce que la route ecrit, a chaque lecture. */
export interface SourceDesMetriques {
  ecrire(): string;
}

/** Un serveur des metriques qui ecoute. */
export interface ServeurDesMetriques {
  /** Le port ou il ecoute: celui demande, ou celui que le systeme a choisi pour zero. */
  readonly port: number;
  fermer(): Promise<void>;
}

/**
 * Ouvre la route /metriques sur ce port de l'interface locale.
 *
 * @param port Le port; zero laisse le systeme en choisir un libre, ce dont les tests se
 *             servent, et jamais un port que fetch refuse.
 */
export async function ouvrirLaRouteDesMetriques(
  port: number,
  source: SourceDesMetriques,
): Promise<ServeurDesMetriques> {
  const serveur: Server = createServer((requete, reponse) => {
    if (requete.method !== 'GET' || requete.url !== '/metriques') {
      reponse.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      reponse.end('Introuvable.\n');
      return;
    }

    reponse.writeHead(200, {
      'Content-Type': 'text/plain; version=0.0.4; charset=utf-8',
      'Cache-Control': 'no-store',
    });
    reponse.end(source.ecrire());
  });

  const obtenu = await ecouterSurUnPortPermis(serveur, port, { hote: ADRESSE_DES_METRIQUES });

  return {
    port: obtenu,
    fermer: async () =>
      new Promise<void>((resoudre) => {
        serveur.close(() => {
          resoudre();
        });
        serveur.closeAllConnections();
      }),
  };
}
