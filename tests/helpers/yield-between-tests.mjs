// Every vitest worker call to the main process waits at most 60 s for its
// reply, and vitest 3 gives no option to change that (vitest-dev/vitest#11082;
// vitest 4 removed the limit). The runner moves from one test to the next on
// promises alone, so a file of synchronous tests never lets its worker's event
// loop turn: once such a file runs past 60 s on a busy machine, the reply to the
// task update it sent first sits unread, and the run fails with `Timeout
// calling "onTaskUpdate"` although every test passes (vitest-dev/vitest#8164).
// One turn of the event loop before each test reads those replies. The real
// setImmediate is kept here, before any test file can install fake timers.
import { beforeEach } from 'vitest';

const turn = globalThis.setImmediate;

beforeEach(() => new Promise((done) => turn(done)));
