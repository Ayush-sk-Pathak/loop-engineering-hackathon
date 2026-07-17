# Akash Deployment

**Owner:** Policy + Procurement. **Priority:** coverage after the local Zero + Pomerium
vertical slice is green.

## Cut Line

Do not start Akash work until all of these pass:

```bash
npm run doctor:prize
npm run build
docker compose up --build
```

## Local image build (B4) + SDL marker replace (B8)

One image serves all three roles (dashboard / control plane / procurement) via different
`command:`s. The SDL `deploy/akash/deploy.example.yaml` carries two markers,
`REPLACE_OWNER` and `REPLACE_SHA`, in all three `image:` lines.

```bash
# 1. Local build only — proves the image builds (B4 done criterion). No registry needed.
docker build -t stockshield:local .

# 2. Publish an immutable image to GHCR (B8; needs registry auth).
OWNER=<your-gh-user-or-org>
SHA=$(git rev-parse --short HEAD)
docker build -t "ghcr.io/$OWNER/stockshield:$SHA" .
echo "$GHCR_PAT" | docker login ghcr.io -u "$OWNER" --password-stdin
docker push "ghcr.io/$OWNER/stockshield:$SHA"

# 3. Prefer the pushed digest over the tag for true immutability.
DIGEST=$(docker inspect --format='{{index .RepoDigests 0}}' "ghcr.io/$OWNER/stockshield:$SHA")

# 4. Replace both markers in the SDL (all three image: lines at once).
#    macOS sed needs the '' after -i; on Linux drop it: sed -i "s|...|...|g"
sed -i '' "s|ghcr.io/REPLACE_OWNER/stockshield:REPLACE_SHA|$DIGEST|g" \
  deploy/akash/deploy.example.yaml
```

The same image starts the dashboard, control plane, or procurement origin with different
commands. After the markers are replaced, deploy on Akash (B8, gated — see the Cut Line):
`provider-services tx deployment create deploy/akash/deploy.example.yaml --from <key>`, then
accept a bid, create the lease, and query the lease URI. Exact CLI is finalized at B8.

The template is coverage-only: it deploys the public dashboard/control plane and keeps the
procurement service private. Pomerium still needs to be the only public route to procurement
for the Pomerium claim. Record the Akash deployment sequence, provider, image digest, and
public URL in this file after deployment.

Do not spend critical demo time on persistent SQLite storage, custom domains, or multi-region
replicas. A running immutable container is enough for honest Akash coverage.
