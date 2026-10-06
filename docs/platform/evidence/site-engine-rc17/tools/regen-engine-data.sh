#!/bin/sh
# Regenerate, in one site tree, every committed data file the engine computes,
# then copy the results out for comparison: regenerated-outputs.json compares
# a run on site main b4f82564 with rc.16 installed and a run on this adoption.
# The rc.16 tree was a git worktree of b4f82564 whose node_modules held links
# to this tree's packages, except @zodiacs/engine, unpacked from
# vendor/zodiacs-engine-0.1.1-rc.16.tgz. Generators that take a generatedAt
# are given the committed one; three others stamp the time of the run.
#
#   sh docs/platform/evidence/site-engine-rc17/tools/regen-engine-data.sh <tree> <outdir>
set -eu
tree=$1; out=$2
mkdir -p "$out"
cd "$tree"
echo "engine $(node -e "import('@zodiacs/engine').then(m=>console.log(m.ENGINE_VERSION))")"
stamp() { node -e "const d=require('./$1'); console.log(d.generatedAt)"; }
node scripts/build-sky.mjs --generated-at "$(stamp src/data/sky.json)"
node scripts/build-ingresses.mjs
node scripts/build-eclipses.mjs --generated-at "$(stamp src/data/eclipses.json)"
node scripts/build-birthdays.mjs
node scripts/build-aura-moon-ingresses.mjs
node scripts/build-daily.mjs 2026-10-06
node scripts/build-registry-outlook.mjs
npm run --silent editorial:daily:build
npm run --silent editorial:horoscopes:build
npm run --silent data:events:build
for f in src/data/transits-*.json; do
  m=${f#src/data/transits-}; m=${m%.json}
  node scripts/build-transits.mjs "$m" > /dev/null
done
echo "transits rebuilt: $(ls src/data/transits-*.json | wc -l)"
cp -r src/data "$out/data"
mkdir -p "$out/public-assets" && cp public/assets/registry-outlook.json "$out/public-assets/"
git status --porcelain --untracked-files=all > "$out/git-status.txt"
git diff --stat > "$out/git-diff-stat.txt"
echo done
