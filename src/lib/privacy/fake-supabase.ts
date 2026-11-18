/**
 * A test double for the Supabase browser client: it answers reads from fixed
 * rows and records every request a module makes, so a test can see exactly
 * what would leave the device. Tests only.
 */

export type FakeOperation = 'select' | 'insert' | 'upsert' | 'update' | 'delete';

export interface FakeRequest {
  table: string;
  op: FakeOperation;
  /** What a write would send: the row or rows, as given. */
  payload?: unknown;
  /** eq/in filters, as [column, value]. */
  filters: [string, unknown][];
}

export interface FakeSupabase {
  client: unknown;
  requests: FakeRequest[];
}

/**
 * `rows` are what a select on each table returns. `userId` is the signed-in
 * user; null means signed out.
 */
export function fakeSupabase(rows: Record<string, unknown> = {}, userId: string | null = '22222222-2222-4222-8222-222222222222'): FakeSupabase {
  const requests: FakeRequest[] = [];
  const user = userId ? { id: userId, email: 'fixture@example.invalid' } : null;
  const session = user ? { user, access_token: 'fixture-access' } : null;

  function builder(table: string) {
    let request: FakeRequest | null = null;
    const filters: [string, unknown][] = [];
    const start = (op: FakeOperation, payload?: unknown) => {
      request = { table, op, ...(payload === undefined ? {} : { payload }), filters };
      requests.push(request);
      return chain;
    };
    const result = () => {
      if (request?.op === 'select') {
        const data = rows[table] ?? [];
        return { data, error: null };
      }
      return { data: null, error: null };
    };
    const chain: Record<string, unknown> = {
      select: (columns?: string) => (request ? chain : start('select', columns === undefined ? undefined : { columns })),
      insert: (payload: unknown) => start('insert', payload),
      upsert: (payload: unknown) => start('upsert', payload),
      update: (payload: unknown) => start('update', payload),
      delete: () => start('delete'),
      eq: (column: string, value: unknown) => { filters.push([column, value]); return chain; },
      in: (column: string, value: unknown) => { filters.push([column, value]); return chain; },
      order: () => chain,
      limit: () => chain,
      maybeSingle: async () => {
        const { data, error } = result();
        return { data: Array.isArray(data) ? data[0] ?? null : data, error };
      },
      then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) => Promise.resolve(result()).then(resolve, reject),
    };
    return chain;
  }

  const client = {
    from: (table: string) => builder(table),
    auth: {
      getUser: async () => ({ data: { user }, error: null }),
      getSession: async () => ({ data: { session }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      signOut: async () => ({ error: null }),
    },
  };
  return { client, requests };
}
