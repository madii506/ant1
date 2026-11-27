# ANT1: the anti-vamp launchpad

Vamps drain. Ants carry. Launch an "ant" of any pump coin: its pump.fun curve is priced in the original (the queen),
so every buy of the ant buys the queen first. Buy any ant with SOL in one multi-hop swap.

Built locally, not deployed. Everything below is what you do once, when you're home.

## What's in here

| Path | What it is |
|---|---|
| `index.html`, `js/intro.js`, `js/home.js` | Home: wordless intro, live colony hero (click to drop food), the drain, the farm, anatomy, one swap, live queens + queen check, vamp radar + most-vamped board, colony, five deep, vamp vs ant, for communities, FAQ |
| `app.html`, `js/app.js`, `js/wallet.js` | App: launch an ant, buy an ant with SOL, the colony, check a coin |
| `docs.html`, `404.html`, `js/page.js` | Docs (13 sections incl. the API) and the 404 |
| `api/ant1.js` | The only server function. Builds unsigned transactions with pump.fun's SDK, simulates them, relays signed ones. Holds no keys. |
| `css/ant1.css`, `fonts/`, `img/` | Styles, self-hosted Inter + mono, favicons and the og image |

## Deploy (GitHub + Vercel, same as before)

1. Create a new GitHub repo (for example `ant1`) and upload everything in this folder, keeping the folders
   (`api`, `css`, `fonts`, `img`, `js`, `vendor`, plus the html files, `package.json`, `vercel.json`, `.vercelignore`).
2. On vercel.com: Add New → Project → import the repo → Framework preset "Other" → Deploy.
3. In the new project: Storage → Create (or connect) a **Blob** store → connect it to the project.
   That adds `BLOB_READ_WRITE_TOKEN` by itself. Coin images and metadata are stored there.
4. Settings → Environment Variables, then redeploy:
   - `ANT1_SITE` = your final URL, e.g. `https://ant1.vercel.app` (metadata links use it; set it before the first launch).
   - `RPC_URL` = a mainnet RPC (Helius, Triton, QuickNode...). Strongly recommended: public RPCs rate-limit reads and sends.
   - Optional: `ANT1_TAG` (the colony's tag address, default `3rg5Xtu9HFEKdQCYq26VWDWkKAWkGpVskxCWBbt5VKnS`), `ANT1_CU_PRICE` (priority fee, micro-lamports, default 400000).
5. If your domain isn't `ant1.vercel.app`, replace that domain in the `og:image` / `twitter:image` lines of
   `index.html`, `app.html` and `docs.html` (6 lines) so link previews show the banner.

## Check it after deploy (5 minutes)

Open these on your live domain; each should answer `"ok": true`:

- `/api/config` (tag + level cap 5) · `/api/hosts` (237 listed assets) · `/api/pump` (trending)
- `/api/vamps?mint=B34nXKzCgsJb9ChLuSHPRpXLE3WFSWyeT8Cqkzzmpump` (FIONA's vamps)
- `/api/chain?mint=<any ant or pump coin>` (its line down to SOL)
- `/api/quote?mint=B34nXKzCgsJb9ChLuSHPRpXLE3WFSWyeT8Cqkzzmpump&sol=1` (what 1 SOL of an ant buy feeds its queen)

Then in the app, with a wallet holding a little SOL:

1. Launch a test ant of a pump coin with no first buy (about 0.01 SOL). It appears in the colony within a minute.
2. Buy it on the Buy tab with 0.01 SOL. That runs SOL › queen › ant in one `multi_hop_swap`.

Both are simulated against mainnet before your wallet is asked to sign, so a failure costs nothing.
What was checked from here (this workspace can't reach Solana): the buy transaction was built offline with pump.fun's
SDK for every depth. An ant of a SOL coin fits one transaction (1,159 bytes, 1,181 if its queen graduated; the limit is
1,232). A deeper ant is bought in steps of two hops, one signature each, and the app runs those steps for you (tested end
to end with a test wallet). Still to confirm on mainnet after deploy: the Buy tab swap, `/api/chain`, `/api/quote` and
the SOL first buy. The launch itself is the same engine that ran on HOST.

## Honesty notes kept on the site

- No fake numbers: every figure is read live (pump.fun, Jupiter, Solana) or measured; empty states say so.
- ant1 takes no fee. pump.fun's normal fees apply on every hop. An ant falls with its queen. Nothing is advice.
