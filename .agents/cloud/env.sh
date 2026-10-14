# EtsySentry cloud agent session exports, sourced by the fleet start and every
# session shell. A cloud agent has no Tailscale, so the database is the
# loopback cluster .agents/cloud/start.sh provisions on port 5435.
export ETSYSENTRY_DATABASE_HOST=127.0.0.1
