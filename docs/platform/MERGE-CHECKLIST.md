# Merge checklist

This is the list a pull request into `main` must pass before the owner merges
it. It adds detail to the publishing rules in `AGENTS.md` ("Identity and
publishing") and changes none of them. Nothing in this repository merges a pull
request on its own, and no script or agent should: the owner merges by hand.

Each line is checked on one pinned commit: the full 40-character id of the
head that was reviewed.

1. **Pinned head.** The pull request's head is still the pinned commit. If it
   moved, the review and the checks below start again on the new head.
2. **Review.** An independent review record names the full pinned commit id
   (a short id is not enough) and ends with `VERDICT: NO BLOCKERS`.
3. **Checks.** Every required check ran on the pinned commit and succeeded:
   the four that branch protection on `main` requires, and the full CI list
   (Build & Check, the feature-flag builds, the sitemap dates check, the SQL
   suites and the browser drives). A check still running means wait. A
   failure anywhere, required or not, means stop, unless it is shown to be
   unrelated and also fails on `main`. A skip counts only for a job that is
   meant to skip, such as the template-named browser evidence job.
4. **Threads.** No review thread is unresolved and no reviewer has changes
   requested. Branch protection already enforces resolved conversations.
5. **History.** The branch was never force-pushed. Commits are added on top;
   they are not rewritten, squashed locally or re-authored before the merge.
6. **Commit messages kept.** Merge with GitHub's default squash message. Do not
   pass a subject or body that drops lines the branch's commits carry, so the
   record on `main` shows how the change was made.
7. **Mergeable.** GitHub reports no conflict with `main`.
8. **After the merge.** Check the live site, revert if it is broken, and log
   the merge in the pinned Merge log issue (#879).

A pull request that passes 1 to 7 is ready for the owner's decision. It is not
merged until the owner merges it.
