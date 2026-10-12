/* global process, console, URL, fetch, setTimeout, setInterval, clearInterval -- un outil lance par Node, hors des paquets. */
// Fait entrer des joueurs fictifs dans une partie locale, pour essayer Among Ninjas seul
// (etape 7.20): il faut cinq joueurs pour lancer. Chacun marche au hasard; un assassin tente un
// meurtre de temps en temps; en reunion, chacun vote, contre un joueur vivant ou pour passer.
//
// A lancer contre un serveur local sans base (tests/outils/jeu-sans-base.mjs), une fois la
// partie creee dans la page:
//
//   node tests/outils/joueurs-fictifs.mjs http://localhost:3000 <identifiant ou code> [nombre]
//
// « auto » a la place de l'identifiant prend la premiere partie publique Among Ninjas au salon;
// une partie privee se rejoint par son code. Sans nombre, quatre joueurs. Ctrl+C les fait tous
// partir.
//
// EN PRODUCTION AUSSI (12 octobre 2026), pour essayer Among Ninjas sans quatre amis: creer une
// partie PRIVEE dans la page, puis viser le serveur de jeu avec son code:
//
//   node tests/outils/joueurs-fictifs.mjs https://serveur.ninja.dendrolag.fr <code> 4
//
// Le serveur refuse une connexion d'une autre version que la sienne: l'outil lit la version sur
// /sante et la presente. Rien n'est ajoute au jeu: ce sont des clients ordinaires, que n'importe
// qui pourrait ecrire.

import { createRequire } from 'node:module';

// Le client Socket.IO est une dependance du serveur (ses tests d'integration s'en servent).
const { io } = createRequire(new URL('../../packages/server/package.json', import.meta.url))(
  'socket.io-client',
);

const [, , adresse = 'http://localhost:3000', partie, nombreDemande = '4'] = process.argv;

if (partie === undefined) {
  console.error(
    'Usage: node tests/outils/joueurs-fictifs.mjs <adresse> <identifiant ou code> [nombre]',
  );
  process.exit(1);
}

const PSEUDOS = [
  'Kenji',
  'Mai',
  'Haru',
  'Sora',
  'Yuki',
  'Ren',
  'Aoi',
  'Kaito',
  'Nao',
  'Rin',
  'Taro',
];
const nombre = Math.min(Number(nombreDemande), PSEUDOS.length);
const joueurs = [];

/** La version que sert le serveur, a presenter a chaque connexion; aucune en developpement. */
async function versionDuServeur() {
  try {
    const sante = await (await fetch(`${adresse}/sante`, { cache: 'no-store' })).json();
    return typeof sante.version === 'string' && sante.version !== '' ? sante.version : undefined;
  } catch {
    return undefined;
  }
}

const version = await versionDuServeur();
const options = {
  transports: ['websocket'],
  forceNew: true,
  ...(version === undefined ? {} : { auth: { version } }),
};

/** L'identifiant de la premiere partie publique Among Ninjas au salon, lu dans la liste. */
async function partieAuSalon() {
  const socket = io(adresse, options);
  const parties = await new Promise((resoudre) => {
    socket.on('connect', () => {
      socket.emit('listerParties', resoudre);
    });
  });
  socket.disconnect();
  const trouvee = parties.find((une) => une.mode === 'among');

  if (trouvee === undefined) {
    console.error('Aucune partie publique Among Ninjas au salon.');
    process.exit(1);
  }

  return trouvee.idRoom;
}

const cible = partie === 'auto' ? await partieAuSalon() : partie;

/** Un joueur fictif: il entre, marche, tue s'il est assassin, et vote. */
function joueur(pseudo) {
  const socket = io(adresse, options);
  // Un refus du serveur (une autre version, une adresse qui n'est pas un serveur de jeu) se dit.
  socket.on('connect_error', (erreur) => {
    console.error(`${pseudo} n'entre pas: ${erreur.message}`);
  });
  let prive;
  let classement = [];

  const entree = /^[A-Z0-9]{4,8}$/u.test(cible)
    ? { pseudo, code: cible }
    : { pseudo, idRoom: cible };

  socket.on('connect', () => {
    socket.emit('rejoindre', entree, (reponse) => {
      console.log(
        reponse.valide
          ? `${pseudo} est entre.`
          : `${pseudo} refuse: ${reponse.erreurs.map((erreur) => erreur.motif).join(', ')}`,
      );
    });
  });

  socket.on('amongNinjas', (etat) => {
    if (prive === undefined) {
      console.log(`${pseudo}: ${etat.role === 'tueur' ? 'assassin' : 'proie'}`);
      // Pas de carte a charger: la revelation n'a pas a l'attendre.
      socket.emit('carteChargee');
    }
    prive = etat;
  });

  // Le classement donne les joueurs: ses lignes se lisent dans le flux binaire, que l'outil ne
  // decode pas. Les identifiants des votes viennent donc du salon.
  socket.on('salon', (salon) => {
    classement = salon.joueurs.map((membre) => membre.id);
  });

  const morts = new Set();
  socket.on('reunion', (reunion) => {
    if (reunion.quoi === 'ouverte') {
      for (const mort of reunion.morts) {
        morts.add(mort);
      }
    }

    if (reunion.quoi === 'resultat' && reunion.ejecte !== undefined) {
      morts.add(reunion.ejecte);
    }

    if (reunion.quoi === 'voteOuvert' && prive?.fantome !== true) {
      setTimeout(
        () => {
          const vivants = classement.filter((id) => !morts.has(id) && id !== socket.id);
          const cible =
            Math.random() < 0.4 || vivants.length === 0
              ? null
              : vivants[Math.floor(Math.random() * vivants.length)];
          socket.emit('voter', { cible });
        },
        2000 + Math.random() * 8000,
      );
    }
  });

  // Marcher au hasard, changer de cap de temps en temps; un assassin tente sa chance.
  const marche = setInterval(() => {
    const angle = Math.random() * 2 * Math.PI;
    socket.emit('deplacer', {
      deplacement: { x: Math.cos(angle), y: Math.sin(angle) },
      enMouvement: Math.random() < 0.8,
    });

    if (prive?.role === 'tueur' && Math.random() < 0.5) {
      socket.emit('capturer');
    }
  }, 1200);

  socket.on('partieTerminee', () => {
    console.log(`${pseudo}: partie terminee.`);
  });

  return { socket, marche };
}

for (let rang = 0; rang < nombre; rang += 1) {
  joueurs.push(joueur(PSEUDOS[rang]));
}

process.on('SIGINT', () => {
  for (const { socket, marche } of joueurs) {
    clearInterval(marche);
    socket.disconnect();
  }
  process.exit(0);
});
