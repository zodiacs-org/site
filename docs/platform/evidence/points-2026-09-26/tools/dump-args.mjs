/*
 * The engine's lunar mean arguments l, F and Ω at 401 instants from -2 to +2
 * Julian centuries of TT, for erfa-args.py to set beside ERFA's IERS 2003
 * fundamental arguments.
 *
 *   node tools/dump-args.mjs > "$WORK/args.jsonl"
 */
import { lunarMeanArguments } from '@zodiacs/engine';

for (let k = -200; k <= 200; k += 1) {
  const t = k / 100;
  process.stdout.write(`${JSON.stringify({ t, ...lunarMeanArguments(t) })}\n`);
}
