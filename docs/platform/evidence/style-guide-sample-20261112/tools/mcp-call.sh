#!/usr/bin/env bash
# usage: mcp-call.sh <outfile-stem> <tool> '<json args>'
set -euo pipefail
stem=$1; tool=$2; args=$3
req=$(printf '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"%s","arguments":%s}}' "$tool" "$args")
printf '%s\n' "$req" > "$stem.request.json"
curl -s -A "Mozilla/5.0 (X11; Linux x86_64) evidence-fetch" -X POST https://zodiacs.org/mcp \
  -H 'content-type: application/json' -H 'accept: application/json, text/event-stream' \
  -d "$req" | sed -n 's/^data: //p' > "$stem.response.json"
echo "$(date -u +%FT%TZ) $tool $(sha256sum < "$stem.response.json" | cut -c1-64) $(wc -c < "$stem.response.json")" | tee -a mcp-log.txt
