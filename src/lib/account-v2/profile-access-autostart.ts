/**
 * The on-demand entry for the profile access bootstrap. Importing it starts
 * the one bootstrap this tab runs (or joins the island's) and keeps it for
 * the tab's lifetime. Both the save-path loader (profile-access-request.ts)
 * and the inline presence loader in Base.astro import this chunk; the build
 * stamps its hashed URL into the inline loader
 * (scripts/stamp-profile-access-loader.mjs).
 */
import {
  profileAccessDecision,
  profileAccessSettled,
  startProfileAccessBootstrap,
} from './profile-access-bootstrap';

startProfileAccessBootstrap();

export { profileAccessDecision, profileAccessSettled };
