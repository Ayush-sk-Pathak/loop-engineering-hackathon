# Deploying Continuim

Two prebuilt images run everything (no build at boot — see decision 0018):

- `ghcr.io/ayush-sk-pathak/continuim-services:<tag>` — control-plane + procurement
  (one image, per-service `command`)
- `ghcr.io/ayush-sk-pathak/continuim-web:<tag>` — Next.js standalone dashboard

Current tag: `2026-07-18a`.

## Build & push

```bash
docker buildx build --platform linux/amd64 -t ghcr.io/ayush-sk-pathak/continuim-services:<tag> .
docker buildx build --platform linux/amd64 -t ghcr.io/ayush-sk-pathak/continuim-web:<tag> Continuum
docker push ghcr.io/ayush-sk-pathak/continuim-services:<tag>
docker push ghcr.io/ayush-sk-pathak/continuim-web:<tag>
```

## Local parity

`docker compose up --build` — web on :3000 is the only published port; SQLite in the
`continuim-data` volume; restart recovery is seconds (verified 2026-07-18: full incident
run in containers, PO accepted, state survives `docker compose restart`).

## Production option A — Hetzner + Coolify (chosen target)

Prereq: the box `5.78.149.138` must be up (down as of 2026-07-18 — power on via the
Hetzner console; verify with `ssh root@5.78.149.138`).

1. Tunnel: `ssh -L 8000:localhost:8000 root@5.78.149.138`, Coolify at `localhost:8000`.
2. Create a **Docker Compose** resource from `deploy/coolify/compose.yaml`
   (instant-deploy OFF).
3. Before first deploy set: FQDN `continuum-hq.com` → `web:3000`, and env
   `CONTINUIM_TAG`, `ATTESTATION_SIGNING_SECRET` (random), `VERIFICATION_MODE`
   (`fixture` until spend-comfortable, then `live` + `FIRECRAWL_API_KEY`),
   `STOCKOUT_WEBHOOK_SECRET`.
4. Deploy; smoke-test the generated `*.5.78.149.138.sslip.io` URL
   (`/api/control/health`, then a client-incident run).
5. Cloudflare: point `continuum-hq.com` A → `5.78.149.138` (proxied, SSL Flexible).
6. Only after the domain verifies end-to-end: close Akash dseq `1784324838403`
   (escrow refunds to the Console wallet).

## Production option B — Akash with images

Prereq: make both `continuim-*` GHCR packages **public** (GitHub → profile → Packages →
package → settings → Change visibility); providers pull anonymously — verified 403
while private. Then:

```bash
console-axi update 1784324838403 --sdl deploy/akash/deploy.image.yaml
```

`continuum-hq.com` already CNAMEs to this deployment's provider ingress, so no DNS
change. If the provider rejects the update, do a fresh `console-axi deploy --sdl ...`
and repoint the Cloudflare CNAME to the new ingress before closing the old dseq.

## Interim: clone-at-boot (current prod, until A or B lands)

The live deployment (`deploy/akash/deploy.clone.yaml`, applied 2026-07-18 via
`console-axi deployment update`) still clones `main` at boot, but with trimmed
commands: backend pods run clone → `npm ci` → start (~2 min); only the dashboard
builds the web app. First-ever full prod e2e passed after this: **PO-C92351A9**,
14 events, 20 inbound, `authorizationMode: origin`.

Hard-won SDL facts (both SDLs already encode them):

- **Pin ports explicitly.** The provider's cluster injects Kubernetes service-link
  vars — a service named `procurement` gets `PROCUREMENT_PORT=tcp://<ip>:4001` in
  its own env, which `Number()` turns into NaN and the server crashes. Prod
  procurement crash-looped from deploy day until 2026-07-18 because of this
  (errors.jsonl `k8s-service-link-port-injection`).
- **Keep the `accept:` hosts** (`continuum-hq.com`, `www.continuum-hq.com`) on the
  dashboard expose — omit them and the provider ingress 404s the custom domain.
- Real resource profile (update is rejected on any mismatch): dashboard
  0.5 CPU/1Gi/2Gi, control 0.5 CPU/1Gi/2Gi, procurement 0.25 CPU/512Mi/1Gi.
- To force a pod to re-clone: `kill 1` is a NO-OP (PID 1 ignores unhandled
  signals). Kill the child tree instead:

```bash
console-axi exec 1784324838403 --service <svc> --   sh -c 'ls /proc | grep -E "^[0-9]+$" | grep -v "^1$" | xargs -r kill -9 2>/dev/null; true'
```

New-code marker: `https://continuum-hq.com/api/control/health` reports
`"authorizationMode":"origin"` (old code says `"development"`).
