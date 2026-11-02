#!/bin/sh
# One-time (re-runnable) hardening of the droplet itself. Run as root on the server: sh scripts/harden-host.sh
# - SSH: keys only (no passwords), root by key only, 3 tries, 30 s to log in, no X11/agent forwarding, TCP forwarding only for tunnels you open from your Mac (ssh -L).
#   The config is tested with `sshd -t` before the reload; keep your current session open until a NEW login works.
# - fail2ban: 5 failed SSH logins in 10 min -> banned 1 h, repeat offenders longer (the droplet saw ~1,700 tries a day).
# - Docker: default log limits for every container (10 MB x 3), so logs can never fill the disk.
# - Automatic security updates stay on (unattended-upgrades), and when one needs a restart the server restarts itself at
#   20:30 UTC (03:30 in Cambodia, after the 19:00 UTC backup); the containers start again on their own.
# - Kernel network settings: no ICMP redirects sent or accepted, no source routing, RFC 1337 protection, no core dumps
#   of programs that changed user.
# - Firewall: only 22/tcp, 80/tcp, 443/tcp and 443/udp (HTTP/3) are open; duplicate any-protocol rules are removed.
set -eu

cat > /etc/ssh/sshd_config.d/10-cc-hardening.conf <<'CONF'
# CC Livestock hardening (scripts/harden-host.sh). Files in sshd_config.d are read in name order; the first value wins.
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin prohibit-password
PubkeyAuthentication yes
MaxAuthTries 3
LoginGraceTime 30
X11Forwarding no
AllowAgentForwarding no
AllowTcpForwarding local
ClientAliveInterval 300
ClientAliveCountMax 2
CONF
sshd -t
systemctl reload ssh
echo "ssh: hardened (tested with sshd -t)"

if ! command -v fail2ban-client >/dev/null 2>&1; then
  DEBIAN_FRONTEND=noninteractive apt-get install -y -q fail2ban >/dev/null
fi
cat > /etc/fail2ban/jail.d/cc-sshd.local <<'CONF'
[DEFAULT]
backend = systemd
bantime = 1h
findtime = 10m
maxretry = 5
bantime.increment = true
bantime.maxtime = 1w

[sshd]
enabled = true
CONF
systemctl enable --now fail2ban >/dev/null 2>&1
systemctl restart fail2ban
echo "fail2ban: on"

if [ ! -f /etc/docker/daemon.json ]; then
  printf '{\n  "log-driver": "json-file",\n  "log-opts": { "max-size": "10m", "max-file": "3" }\n}\n' > /etc/docker/daemon.json
  echo "docker: log limits set (take effect after docker restarts)"
fi

systemctl is-active --quiet unattended-upgrades && echo "automatic security updates: on"

cat > /etc/apt/apt.conf.d/52cc-auto-reboot <<'CONF'
// CC Livestock (scripts/harden-host.sh): restart after an update that needs it, at a quiet hour (UTC).
Unattended-Upgrade::Automatic-Reboot "true";
Unattended-Upgrade::Automatic-Reboot-WithUsers "true";
Unattended-Upgrade::Automatic-Reboot-Time "20:30";
CONF
echo "automatic restart after updates: 20:30 UTC"

cat > /etc/sysctl.d/90-cc-hardening.conf <<'CONF'
# CC Livestock (scripts/harden-host.sh). IP forwarding stays as Docker sets it.
net.ipv4.conf.all.send_redirects = 0
net.ipv4.conf.default.send_redirects = 0
net.ipv4.conf.all.accept_redirects = 0
net.ipv4.conf.default.accept_redirects = 0
net.ipv6.conf.all.accept_redirects = 0
net.ipv6.conf.default.accept_redirects = 0
net.ipv4.conf.all.accept_source_route = 0
net.ipv6.conf.all.accept_source_route = 0
net.ipv4.icmp_echo_ignore_broadcasts = 1
net.ipv4.tcp_rfc1337 = 1
fs.suid_dumpable = 0
CONF
sysctl -q --system
echo "kernel network settings: hardened"

ufw allow 22/tcp >/dev/null
ufw allow 80/tcp >/dev/null
ufw allow 443/tcp >/dev/null
ufw allow 443/udp >/dev/null
ufw delete allow 80 >/dev/null 2>&1 || true
ufw delete allow 443 >/dev/null 2>&1 || true
ufw --force enable >/dev/null
echo "firewall: 22/tcp 80/tcp 443/tcp 443/udp"
