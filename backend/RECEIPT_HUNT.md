# Receipt Hunt: manual social review

Participants submit an X username and two screenshots from `/receipt-hunt`: one for
following `@replateapp`, one for liking and reposting the announcement. Screenshots
are compressed in the browser and kept in PostgreSQL, not in public media storage.
The wallet signs the evidence request without making an on-chain transaction.

The public status endpoint returns only task states and a revision, never the X
username, screenshots, or the wallet-to-X association. An administrator reviews
evidence in the Base frontend at `/receipt-hunt/review`. Only the deployed Replate
contract's current `validator()` wallet can authorize access or save a review.
The Farcaster frontend uses the same backend and approvals.

## Setup

1. Apply migration `009_receipt_hunt_review.sql` with the existing migration runner:
   `cd backend` then `npm run db:migrate`. Check the configured database before
   running this command. Source changes alone do not apply migrations.
2. Optionally set the public `RECEIPT_HUNT_ANNOUNCEMENT_URL` backend environment
   variable to the exact `https://x.com/<account>/status/<id>` URL. No X API keys
   or paid verification service are required.
3. Connect the validator wallet in the Base frontend and open
   `/receipt-hunt/review`. Click **Sign in / reload queue**, open a participant,
   review both screenshots and any submitted post, choose each decision, and click
   **Sign and save review**. Read access signatures expire after four minutes;
   signing in again renews access. Write signatures bind the exact decision and
   submission revision. This page never transfers a prize.
4. Confirm the X account belongs to the participant, the follow is for
   `@replateapp`, and the liked/reposted post is the intended announcement.
   Screenshots are evidence for human review, not proof of X account ownership.
5. Participants use **Refresh approval status** after review. Both tasks must be
   approved before the Hunt receipt controls are displayed, including when the
   receipt page is opened directly. Updating evidence resets both task decisions.

One X username can have both tasks approved for only one wallet per campaign.
Participants cannot edit an already fully approved submission. Administrators can
reopen evidence and change a decision if correction is needed. Conflicting edits
must reload the latest evidence instead of silently overwriting it.

The receipt analysis remains 0.05 USDC. The existing team-selected, manually paid
single-winner AAPLc prize and the October 21–27, 2026 schedule are unchanged.
Social approval permits participation; it does not itself award or claim a prize.
The team must use approved records when checking the selected winner.

The pilot review queue displays the latest 100 submissions. Add pagination before
expanding beyond this scale. Review screenshots privately and remove campaign
evidence when it is no longer needed, following the project's data retention policy.

## Local checks

`node node_modules/tsx/dist/cli.mjs scripts/test-receipt-hunt.ts`

This uses ephemeral test wallets, an in-memory PostgreSQL adapter, and a local RPC
stub. It does not connect to a production database, X, or the Base network. Run the
migration against a disposable PostgreSQL database before a production rollout.
