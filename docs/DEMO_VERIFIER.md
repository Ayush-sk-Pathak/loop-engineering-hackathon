# Local Demo Verifier

Run the complete two-client recovery smoke test with one command:

```bash
npm run demo:verify
```

The verifier builds Continuum, starts isolated fixture-only procurement, control-plane, and
web-proxy services on process-specific high ports, and uses a temporary SQLite database. It submits a
Meridian GPU incident and a Northwind material incident concurrently through the production web proxy,
then requires both runs to complete with a PO, a vendor
blacklist, 20 inbound units, and a valid database integrity check. It shuts down all temporary
processes and deletes the temporary database automatically.

No live Zero, Bedrock, Claude, Pomerium, email, or external client connector is called. A passing
run is the fastest pre-demo confidence check for the local dynamic flow; use `npm run doctor:prize`
and the integration runbooks separately for an externally authenticated prize/production rehearsal.
