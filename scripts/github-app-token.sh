#!/usr/bin/env bash
# Mint a one-hour installation token for the site's publishing GitHub App.
#
# Site Publish (.github/workflows/site-publish.yml) runs this from the trusted
# default branch. The App is installed on this repository only; the token is
# narrowed again here to this one repository and to exactly what landing a
# publication needs: Contents, Pull requests and Actions write, Checks read.
# The App's private key lives only in the site-publish-production
# environment, is written to a private temporary file for the signature and
# deleted straight after. Nothing secret is printed; the token is masked and
# handed to the next step as the `token` output.
#
# Env: APP_ID (the App's numeric ID or its Client ID), APP_PRIVATE_KEY (its .pem contents),
#      GITHUB_REPOSITORY, GITHUB_OUTPUT, optional GITHUB_API_URL.
set -euo pipefail

: "${APP_ID:?APP_ID is required}"
: "${APP_PRIVATE_KEY:?APP_PRIVATE_KEY is required}"
: "${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}"
: "${GITHUB_OUTPUT:?GITHUB_OUTPUT is required}"
# The App's settings page shows both a numeric App ID and a Client ID (Iv...);
# GitHub accepts either as the issuer.
if ! [[ "$APP_ID" =~ ^([0-9]+|Iv[0-9A-Za-z.]+)$ ]]; then
  echo "::error title=The publishing App ID does not look right::Set SITE_PUBLISH_APP_ID to the App ID (a number) shown on the App's settings page." >&2
  exit 1
fi
api="${GITHUB_API_URL:-https://api.github.com}"

umask 077
key=$(mktemp "${RUNNER_TEMP:-/tmp}/publish-app-key.XXXXXX")
trap 'rm -f "$key"' EXIT
printf '%s\n' "$APP_PRIVATE_KEY" >"$key"

b64url() { openssl base64 -A | tr '+/' '-_' | tr -d '='; }
now=$(date +%s)
header=$(printf '{"alg":"RS256","typ":"JWT"}' | b64url)
claims=$(printf '{"iat":%d,"exp":%d,"iss":"%s"}' "$((now - 60))" "$((now + 540))" "$APP_ID" | b64url)
if ! signature=$(printf '%s.%s' "$header" "$claims" | openssl dgst -sha256 -sign "$key" -binary | b64url) || [ -z "$signature" ]; then
  echo "::error title=The publishing App key could not be read::SITE_PUBLISH_APP_KEY must hold the whole .pem file the App generated, including its BEGIN and END lines." >&2
  exit 1
fi
jwt="$header.$claims.$signature"
echo "::add-mask::$jwt"

call() {
  curl -fsS --retry 3 --retry-all-errors -H "Authorization: Bearer $1" -H "Accept: application/vnd.github+json" \
    -H "X-GitHub-Api-Version: 2022-11-28" "${@:2}"
}

if ! installation=$(call "$jwt" "$api/repos/$GITHUB_REPOSITORY/installation" | jq -r '.id // empty') || [ -z "$installation" ]; then
  echo "::error title=The publishing App is not installed here::Install the App on $GITHUB_REPOSITORY (App settings → Install App), and check SITE_PUBLISH_APP_ID." >&2
  exit 1
fi

request=$(jq -nc --arg repo "${GITHUB_REPOSITORY#*/}" \
  '{repositories: [$repo], permissions: {contents: "write", pull_requests: "write", actions: "write", checks: "read"}}')
if ! token=$(call "$jwt" -X POST -d "$request" "$api/app/installations/$installation/access_tokens" | jq -r '.token // empty') \
  || [ -z "$token" ]; then
  echo "::error title=The publishing App could not get a token::Give the App Contents, Pull requests and Actions read and write, and Checks read, then accept the new permissions on its installation." >&2
  exit 1
fi
echo "::add-mask::$token"
echo "token=$token" >>"$GITHUB_OUTPUT"
echo "github-app-token: minted a one-hour token for ${GITHUB_REPOSITORY} (installation $installation)"
