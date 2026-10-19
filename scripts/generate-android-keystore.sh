#!/usr/bin/env bash
# Génère la clé de signature Android (keystore) de FISSA PIECE AUTO et affiche
# les 4 secrets GitHub à créer. À lancer UNE SEULE FOIS, puis conserver le
# fichier .jks en lieu sûr : perdre cette clé = impossible de mettre à jour
# l'app sur le Play Store (sauf si "Signature d'application par Google Play"
# est activée, ce qui est le cas par défaut pour une nouvelle app).
#
# Prérequis : Java (keytool). macOS : `brew install --cask temurin`.
# Usage : bash scripts/generate-android-keystore.sh [chemin/vers/fissa-release.jks]
set -euo pipefail

OUT="${1:-$HOME/fissa-release.jks}"
ALIAS="fissa"

if [ -f "$OUT" ]; then
  echo "Le fichier $OUT existe déjà — on ne l'écrase pas." >&2
  exit 1
fi

read -r -s -p "Mot de passe du keystore (≥ 6 caractères, à conserver) : " PASS
echo

keytool -genkeypair -v \
  -keystore "$OUT" \
  -alias "$ALIAS" \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -storepass "$PASS" -keypass "$PASS" \
  -dname "CN=FISSA PIECE AUTO, O=FISSA LIV, L=Paris, C=FR"

echo
echo "✅ Keystore créé : $OUT"
echo
echo "Secrets à créer dans GitHub → Settings → Secrets and variables → Actions :"
echo "  ANDROID_KEYSTORE_PASSWORD = (le mot de passe saisi)"
echo "  ANDROID_KEY_ALIAS         = $ALIAS"
echo "  ANDROID_KEY_PASSWORD      = (le même mot de passe)"
echo "  ANDROID_KEYSTORE_BASE64   = le contenu ci-dessous (une seule ligne) :"
echo
base64 < "$OUT" | tr -d '\n'
echo
echo
echo "⚠️  Sauvegarder $OUT (et le mot de passe) hors du dépôt git."
