# Agent Company OS Production Runbook

## Deployment boundary

This release is a single-workstation/local-network Control Plane. It binds to `127.0.0.1`, uses Redis for the Run queue, SQLite WAL for durable state, and one explicitly selected Agent Backend. It is not an internet-facing multi-node deployment.

## 1. Prepare

1. Install Node 24.17.x, Redis, and Git. Confirm the selected executable and SQLite capabilities with `npm run runtime:check` before build or startup.
2. Build with `npm run verify`.
3. Copy `.env.production.example` values into the service account environment. Do not create a checked-in secret file.
4. Use an absolute, dedicated `AGENT_COMPANY_RUNTIME` directory and a random API token of at least 16 characters.
5. For CLI backends, install and log in as the same Windows account that runs the service. Credentials remain owned by the CLI.

Run the gate:

```powershell
npm run ops:preflight
```

All checks must report `ok: true`. A non-standalone backend is probed again during Control Plane startup; failure stops startup without fallback.

## 2. Start and verify

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/start-production.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify-production.ps1
```

Logs are written under `%AGENT_COMPANY_RUNTIME%\logs`. The PID file is `%AGENT_COMPANY_RUNTIME%\control-plane.pid`.

## 3. Backup and restore rehearsal

Run before rollout and after every schema change:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/rehearse-backup-restore.ps1
```

The command creates an online backup, manifest, integrity-verified restored database, and timestamped evidence under `%AGENT_COMPANY_RUNTIME%\backup-rehearsals`. Restoration never overwrites an existing target.

## 4. Stop

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/stop-production.ps1
```

The stop script verifies the recorded process command line, writes a local stop request, and waits up to 20 seconds for HTTP, worker, queue, and SQLite shutdown. It does not kill an unrelated PID and does not force terminate on timeout.

## Rollback

1. Stop the Control Plane.
2. Preserve the failed runtime directory and logs.
3. Select a verified rehearsal backup and restore it to a new runtime database path using `npm run ops:restore -- <backup> <new-target>`.
4. Point `AGENT_COMPANY_RUNTIME` to the restored runtime directory or move the restored database only during a controlled offline window.
5. Start, verify health, then run a read-only Company/Project/Run inspection before accepting new work.

## Release gates

- `npm run verify`
- optional Redis integration: `$env:REDIS_INTEGRATION='1'; npm run test:redis`
- `npm run ops:preflight`
- production health returns SQLite `ready`, integrity `ok`, Redis `ready`, and the intended active backend/model
- backup/restore rehearsal succeeds
- no secrets appear in SQLite binding configuration, health output, browser storage, or logs
