/**
 * Loads the save-to-profile line only when the build has it switched on and
 * Supabase configured. The flag is read inline (not through
 * saved-pages-config) and decided when the module is built, so while it is
 * off the bundler drops the loader and its import: result pages ship nothing
 * for it.
 */
import { useEffect, useState } from 'preact/hooks';

export type AccountSaveModule = typeof import('./AccountSaveAction');

const ACCOUNT_SAVE_AVAILABLE = import.meta.env.PUBLIC_ACCOUNT_SAVES_ENABLED === '1'
  && Boolean(import.meta.env.PUBLIC_SUPABASE_URL);

function useLoadedAccountSaveModule(wanted: boolean): AccountSaveModule | null {
  const [module, setModule] = useState<AccountSaveModule | null>(null);
  useEffect(() => {
    if (!wanted || module) return;
    let active = true;
    void import('./AccountSaveAction')
      .then((loaded) => { if (active) setModule(loaded); })
      .catch(() => {});
    return () => { active = false; };
  }, [wanted, module]);
  return module;
}

function useNoAccountSaveModule(_wanted: boolean): AccountSaveModule | null {
  return null;
}

export const useAccountSaveModule = ACCOUNT_SAVE_AVAILABLE ? useLoadedAccountSaveModule : useNoAccountSaveModule;
