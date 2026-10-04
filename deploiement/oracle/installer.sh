#!/usr/bin/env bash
#
# L'installation de la machine Oracle (etape 5.9), une fois, puis a chaque
# changement de ce dossier. Sans effet de bord a la relance.
#
# A LANCER EN ADMINISTRATEUR SUR LA MACHINE, depuis une copie de ce dossier:
#
#   sudo bash installer.sh <fichier de la cle publique de la CI>
#
# Ce qu'il pose: le pare-feu de la machine, les mises a jour de securite
# automatiques, Docker, Caddy, le compte « deploiement » de la CI et ses commandes.
# Ce qu'il ne pose pas: le fichier /etc/neon-ninja/environnement, qui porte
# l'adresse de la base, un secret ecrit a part (docs/deploiement.md).

set -euo pipefail

[[ "$(id -u)" == 0 ]] || { echo "A lancer avec sudo." >&2; exit 1; }
[[ -f "${1:-}" ]] || { echo "Usage: sudo bash installer.sh <cle publique de la CI>" >&2; exit 1; }

readonly ICI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly CLE_CI="$(cat "$1")"
readonly COMPTE=deploiement

echo "== Pare-feu de la machine: web ouvert"
# Les images Ubuntu d'Oracle refusent tout sauf SSH, par une regle REJECT en fin de
# chaine INPUT, enregistree dans /etc/iptables/rules.v4. On ouvre 80 et 443 avant
# elle, dans la chaine en service et dans le fichier relu au demarrage.
for port in 80 443; do
  regle=(-p tcp -m state --state NEW -m tcp --dport "$port" -j ACCEPT)
  if ! iptables -C INPUT "${regle[@]}" 2>/dev/null; then
    rejet="$(iptables -L INPUT --line-numbers -n | awk '$2 == "REJECT" { print $1; exit }')"
    iptables -I INPUT "${rejet:-1}" "${regle[@]}"
  fi
  ligne="-A INPUT ${regle[*]}"
  if [[ -f /etc/iptables/rules.v4 ]] && ! grep -qF -- "$ligne" /etc/iptables/rules.v4; then
    sed -i "0,/^-A INPUT -j REJECT/s//${ligne//\//\\/}\n&/" /etc/iptables/rules.v4
  fi
done

echo "== Logiciels"
export DEBIAN_FRONTEND=noninteractive
apt-get update -q
apt-get install -y -q docker.io docker-buildx caddy curl unattended-upgrades

echo "== Mises a jour de securite automatiques, redemarrage a 4h30 (heure de la machine) si besoin"
cat >/etc/apt/apt.conf.d/52neon-ninja <<'FIN'
// Pose par deploiement/oracle/installer.sh (etape 5.9).
Unattended-Upgrade::Automatic-Reboot "true";
Unattended-Upgrade::Automatic-Reboot-Time "04:30";
FIN
cat >/etc/apt/apt.conf.d/20auto-upgrades <<'FIN'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
FIN

echo "== Docker: journaux tournants"
mkdir -p /etc/docker
# Redemarrer Docker relance les serveurs en service: seulement si le reglage change.
if [[ "$(cat /etc/docker/daemon.json 2>/dev/null)" != '{ "log-driver": "local" }' ]]; then
  echo '{ "log-driver": "local" }' >/etc/docker/daemon.json
  systemctl restart docker
fi
systemctl enable docker >/dev/null

echo "== Compte de mise en ligne"
id "$COMPTE" >/dev/null 2>&1 || useradd --system --create-home --shell /bin/bash "$COMPTE"
usermod -aG docker "$COMPTE"
install -d -o "$COMPTE" -g "$COMPTE" -m 750 /var/lib/neon-ninja
install -m 755 "$ICI/neon-ninja.sh" /usr/local/bin/neon-ninja
install -d -o "$COMPTE" -g "$COMPTE" -m 700 "/home/$COMPTE/.ssh"
# La cle de la CI ne peut que lancer les commandes de la machine: ni terminal, ni
# renvoi de ports, ni autre commande.
printf 'command="/usr/local/bin/neon-ninja",restrict %s\n' "$CLE_CI" >"/home/$COMPTE/.ssh/authorized_keys"
chown "$COMPTE:$COMPTE" "/home/$COMPTE/.ssh/authorized_keys"
chmod 600 "/home/$COMPTE/.ssh/authorized_keys"

echo "== Variables du serveur"
install -d -m 750 -g "$COMPTE" /etc/neon-ninja
if [[ -f /etc/neon-ninja/environnement ]]; then
  chown "root:$COMPTE" /etc/neon-ninja/environnement
  chmod 640 /etc/neon-ninja/environnement
else
  echo "   /etc/neon-ninja/environnement manque encore: a ecrire avant la premiere mise en ligne."
fi

echo "== Caddy"
install -m 644 "$ICI/Caddyfile" /etc/caddy/Caddyfile
if [[ ! -f /etc/caddy/amont.caddy ]]; then
  printf 'reverse_proxy 127.0.0.1:3001\n' >/etc/caddy/amont.caddy
fi
chown "$COMPTE:caddy" /etc/caddy/amont.caddy
chmod 664 /etc/caddy/amont.caddy
systemctl enable caddy >/dev/null
systemctl reload-or-restart caddy

echo "== Installation terminee"
