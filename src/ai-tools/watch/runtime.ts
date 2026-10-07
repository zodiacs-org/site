export { createAiNodeHandler } from '../http';
export { configuredSkyWatch } from './service';
export { watchRpc } from './store';
export { digest } from './crypto';
import { configuredSkyWatch } from './service';
import { fillWatchLedger, deliverWatchEvents } from './worker';

export async function runSkyWatchTick(env: Readonly<Record<string, string | undefined>> = process.env) {
  const watch = configuredSkyWatch(env);
  if (!watch) throw new Error('Sky Watch preview is disabled.');
  const windowsFilled = await fillWatchLedger(watch.rpc);
  const delivery = await deliverWatchEvents(watch.rpc, watch.vault, watch.post);
  return { windowsFilled, ...delivery };
}
