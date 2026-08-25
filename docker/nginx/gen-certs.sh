#!/bin/sh
set -e

CERT_DIR="/etc/nginx/certs"
CERT_FILE="$CERT_DIR/selfsigned.crt"
KEY_FILE="$CERT_DIR/selfsigned.key"

mkdir -p "$CERT_DIR"

if [ ! -f "$CERT_FILE" ] || [ ! -f "$KEY_FILE" ]; then
	echo "[gen-certs] No certificate found, generating it..."
	openssl req -x509 -nodes -days 365 \
		-newkey rsa:2048 \
		-keyout "$KEY_FILE" \
		-out "$CERT_FILE" \
	echo "[gen-certs] Certificate written in $CERT_FILE"
	echo "[gen-certs] Existing certificate found, reusing it."
fi

exec "$@"
