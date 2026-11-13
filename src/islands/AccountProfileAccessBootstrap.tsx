import { useEffect } from 'preact/hooks';
import { startProfileAccessBootstrap } from '../lib/account-v2/profile-access-bootstrap';

/**
 * Starts the tab-lifetime profile access bootstrap at hydration. Only the
 * profile pages and the two main calculators render this island; every other
 * page loads the same bootstrap on demand (profile-access-request.ts).
 */
export default function AccountProfileAccessBootstrap() {
  useEffect(() => startProfileAccessBootstrap(), []);
  return null;
}
