#!/usr/bin/env bash
#
# Les commandes de la machine Oracle (etape 5.9), installees en
# /usr/local/bin/neon-ninja par installer.sh.
#
# C'EST TOUT CE QUE LA CI PEUT FAIRE SUR LA MACHINE. Sa cle SSH y est enregistree
# avec cette commande imposee: quoi qu'elle demande, c'est ce script qui s'execute,
# avec la demande dans SSH_ORIGINAL_COMMAND, et il refuse ce qu'il ne connait pas.
# L'enchainement (construire, demarrer, attendre, basculer, arreter l'ancien) est
# decide par deploiement/oracle.ts, qui se teste; ici, chaque commande fait une
# seule chose.
#
# DEUX EMPLACEMENTS, BLEU ET VERT. Le serveur en service tourne dans l'un; le
# suivant demarre dans l'autre, et Caddy ne bascule vers lui qu'une fois qu'il a
# repondu. Si le nouveau ne repond pas, l'ancien n'a pas cesse de servir.
#
#   construire <commit>          construit l'image du commit, dont l'archive arrive
#                                sur l'entree standard
#   actif                        dit l'emplacement que Caddy sert, ou rien
#   demarrer <emplacement> <commit>
#   sante <emplacement>          la reponse de /sante du serveur de cet emplacement
#   basculer <emplacement>       Caddy sert desormais cet emplacement
#   arreter <emplacement>
#   journal <emplacement>        les dernieres lignes du serveur de cet emplacement
#   nettoyer                     retire les images qui ne servent plus

set -euo pipefail

# Le dossier d'etat de la machine, et le fichier que Caddy importe.
readonly ETAT=/var/lib/neon-ninja
readonly AMONT=/etc/caddy/amont.caddy
# Les variables du serveur, dont l'adresse de la base: un secret, lisible par le
# seul compte de mise en ligne.
readonly ENVIRONNEMENT=/etc/neon-ninja/environnement

# Appele par SSH avec une commande imposee: la demande est dans
# SSH_ORIGINAL_COMMAND. Elle n'est jamais evaluee par un interpreteur, seulement
# decoupee en mots, puis chaque mot est verifie.
if [[ -n "${SSH_ORIGINAL_COMMAND:-}" ]]; then
  read -r -a demande <<<"$SSH_ORIGINAL_COMMAND"
  set -- "${demande[@]}"
fi

echouer() {
  echo "neon-ninja: $*" >&2
  exit 1
}

# Un commit complet, quarante caracteres hexadecimaux.
commit_valide() {
  [[ "${1:-}" =~ ^[0-9a-f]{40}$ ]] || echouer "commit invalide: « ${1:-} »."
}

# Le port local de chaque emplacement. Le pare-feu ne les ouvre pas: seul Caddy,
# sur la machine, les joint.
port_de() {
  case "${1:-}" in
    bleu) echo 3001 ;;
    vert) echo 3002 ;;
    *) echouer "emplacement invalide: « ${1:-} », attendu bleu ou vert." ;;
  esac
}

construire() {
  commit_valide "${1:-}"

  local dossier
  dossier="$(mktemp -d "$ETAT/construction.XXXXXX")"
  trap 'rm -rf "$dossier"' RETURN
  tar -x -C "$dossier"
  docker build --network host \
    --file "$dossier/deploiement/oracle/Dockerfile" \
    --build-arg "VERSION_DU_JEU=$1" \
    --tag "neon-ninja:$1" \
    "$dossier"
}

actif() {
  if [[ -f "$ETAT/actif" ]]; then
    cat "$ETAT/actif"
  fi
}

demarrer() {
  local port
  port="$(port_de "${1:-}")"
  commit_valide "${2:-}"
  docker rm --force "neon-ninja-$1" >/dev/null 2>&1 || true
  # Le reseau de la machine: le serveur ecoute sur son port local, que le pare-feu
  # ne laisse pas sortir. Il redemarre seul s'il tombe, et au redemarrage de la
  # machine.
  docker run --detach \
    --name "neon-ninja-$1" \
    --network host \
    --restart unless-stopped \
    --env-file "$ENVIRONNEMENT" \
    --env "PORT=$port" \
    --env "VERSION_DU_JEU=$2" \
    "neon-ninja:$2" >/dev/null
}

sante() {
  local port
  port="$(port_de "${1:-}")"
  curl --silent --show-error --fail --max-time 5 "http://127.0.0.1:$port/sante"
}

basculer() {
  local port
  port="$(port_de "${1:-}")"
  printf 'reverse_proxy 127.0.0.1:%s\n' "$port" >"$AMONT"
  caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile
  echo "$1" >"$ETAT/actif"
}

arreter() {
  port_de "${1:-}" >/dev/null
  docker rm --force "neon-ninja-$1" >/dev/null 2>&1 || true
}

journal() {
  port_de "${1:-}" >/dev/null
  docker logs --tail 200 "neon-ninja-$1" 2>&1 || true
}

nettoyer() {
  docker image prune --all --force >/dev/null
  docker builder prune --force --filter until=168h >/dev/null
}

commande="${1:-}"
shift || true

case "$commande" in
  construire | actif | demarrer | sante | basculer | arreter | journal | nettoyer)
    "$commande" "$@"
    ;;
  *)
    echouer "commande inconnue: « $commande »."
    ;;
esac
