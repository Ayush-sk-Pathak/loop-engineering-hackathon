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

Build and publish the repository image with an immutable tag, then replace the image marker
in `deploy/akash/deploy.example.yaml`. The same image can start the dashboard, control plane,
or procurement origin with different commands.

The template is coverage-only: it deploys the public dashboard/control plane and keeps the
procurement service private. Pomerium still needs to be the only public route to procurement
for the Pomerium claim. Record the Akash deployment sequence, provider, image digest, and
public URL in this file after deployment.

Do not spend critical demo time on persistent SQLite storage, custom domains, or multi-region
replicas. A running immutable container is enough for honest Akash coverage.
