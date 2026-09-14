/**
 * La politique de securite du contenu de la page du jeu.
 *
 * ELLE EST ICI, ET NON DANS LE SERVEUR, DEPUIS L'ETAPE 5.3. En developpement et
 * dans les scenarios de bout en bout, le serveur de jeu sert lui-meme la page et
 * pose cette politique sur ses reponses (packages/server/src/fichiers.ts). En
 * production, la page est servie par un autre hebergement, Vercel, qui la pose a
 * sa place (packages/client/scripts/sortieVercel.ts). Les deux lisent cette meme
 * fonction: une regle ajoutee d'un cote ne peut pas manquer de l'autre.
 *
 * Elle interdit a la page de charger ou d'executer quoi que ce soit qui ne vienne
 * pas de son propre hebergement. C'est une defense de plus contre la faille S1 du
 * jeu d'origine: meme si un texte de joueur parvenait un jour a s'inserer comme du
 * balisage, le navigateur refuserait d'executer le script qu'il contiendrait.
 *
 * Chaque ligne a sa raison:
 *   - tout vient de l'hebergement de la page: scripts, styles, polices et sons;
 *   - les images acceptent aussi data: et blob:, parce que PixiJS decode les
 *     textures dans un travailleur qui lui rend des objets blob;
 *   - les travailleurs acceptent blob: pour la meme raison;
 *   - les connexions acceptent aussi data:. Avant de decoder dans un travailleur,
 *     PixiJS y lit une image de un pixel ecrite en data:, pour savoir si le
 *     navigateur en est capable. Bloquee, cette lecture lui faisait conclure a tort
 *     que non, et decoder les textures dans la page, avec deux erreurs dans la
 *     console du travailleur, que les scenarios de bout en bout ne voient pas
 *     (trouve a la reprise des ecrans du jalon 3). Une adresse data: ne sort pas
 *     du navigateur: rien ne peut fuir par elle;
 *   - les connexions acceptent enfin le serveur de jeu, quand il n'est pas
 *     l'hebergement de la page: ses routes des comptes, et le lien du jeu en
 *     WebSocket. Rien d'autre ne sort de la page;
 *   - rien ne peut encadrer la page, ni changer l'adresse de base de ses liens, ni
 *     envoyer un formulaire ailleurs.
 *
 * Elle interdit aussi l'evaluation de code fabrique a la volee; le client charge
 * pour cela le module unsafe-eval de PixiJS, qui s'en passe.
 *
 * Ce fichier ne lit rien et n'ecrit rien: il fabrique une chaine.
 */

/**
 * La forme d'une origine: un protocole web, un hote en minuscules, un port
 * eventuel, et rien apres, pas meme une barre.
 */
const FORME_D_ORIGINE = /^(https?):\/\/([a-z0-9.-]+(?::[0-9]{1,5})?)$/u;

/**
 * Le texte est-il une origine, comme https://jeu.exemple.fr.
 *
 * L'empaqueteur s'en sert pour refuser une adresse de serveur mal ecrite avant de
 * l'inscrire dans la page, plutot que d'expedier une page qui ne joindrait rien.
 */
export function origineValide(texte: string): boolean {
  return FORME_D_ORIGINE.test(texte);
}

/**
 * La politique de securite du contenu de la page.
 *
 * @param serveurDeJeu L'origine du serveur de jeu, quand il n'est pas l'hebergement
 *                     de la page. Absente, la page ne joint que son hebergement.
 */
export function politiqueDeContenu(serveurDeJeu?: string): string {
  return [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self'",
    "img-src 'self' data: blob:",
    "media-src 'self'",
    "font-src 'self'",
    ['connect-src', "'self'", 'data:', ...adressesDuServeur(serveurDeJeu)].join(' '),
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'none'",
  ].join('; ');
}

/**
 * Les adresses du serveur de jeu que la page peut joindre: son origine, pour les
 * routes des comptes, et la meme en WebSocket, pour le lien du jeu. Chiffre si
 * l'origine l'est.
 */
function adressesDuServeur(serveurDeJeu: string | undefined): readonly string[] {
  if (serveurDeJeu === undefined) {
    return [];
  }

  const forme = FORME_D_ORIGINE.exec(serveurDeJeu);
  const protocole = forme?.[1];
  const hote = forme?.[2];

  if (protocole === undefined || hote === undefined) {
    throw new Error(
      `Le serveur de jeu doit etre une origine, comme https://jeu.exemple.fr, recu « ${serveurDeJeu} ».`,
    );
  }

  return [serveurDeJeu, `${protocole === 'https' ? 'wss' : 'ws'}://${hote}`];
}
