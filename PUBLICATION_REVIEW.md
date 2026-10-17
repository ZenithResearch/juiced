# Public repository review

Reviewed on 2026-10-16 before any remote was configured or code was pushed.

## Result

No credentials, customer uploads, real profile records, session transcripts or workshop artifacts were found in the tracked source or reachable Git history. Gitleaks scanned both the complete reachable history and the local working directory with redaction enabled and found no leaks. This is a scoped audit, not a guarantee that every possible secret pattern is detectable.

The original commit was amended before publication to replace personal author and committer email addresses with the verified GitHub no-reply address and to replace an absolute workstation path in the migration manifest with a relative path. The private recovery bundle and detailed scan evidence are ignored under `.qa/` and are not for publication. The original commit can still exist in the local reflog; normal pushes include reachable commits, not the reflog or ignored recovery files.

## Checked boundaries

- The repository has one clean initial commit and no imported prototype history, tags, extra branches or submodules.
- Tracked binary assets are the three Manrope fonts; their SIL Open Font License notice is included and copied into the release.
- Test names, email addresses and URLs are fictional fixtures. No populated browser database or uploaded brand assets are tracked.
- The frontend contains no provider API integration, hardcoded credential, analytics beacon or camera upload endpoint. Camera frames stay local to the browser.
- `.env` files, local data, QA evidence, build output and common private-key/database formats are ignored.
- The build follows approved runtime imports. Release-boundary tests reject workshop, review, configuration and retired API paths.
- Only `dist/` is intended for website deployment. A public Git repository will also expose source, tests, questionnaire wording and matching schema definitions; those are deliberately part of the source tree.

## Not performed

No GitHub repository was created, no remote was added, no visibility setting changed and no commit was pushed. No open-source licence was added for the original application code. Publishing source does not require changing the bundled font's existing licence.

## Verification

`npm test` and `npm run build` passed after privacy cleanup. Detailed scan reports and the review of final reachable commit metadata remain local under the ignored `.qa/` directory.
