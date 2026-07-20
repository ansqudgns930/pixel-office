# Agent Backend 13c Completion Audit

## Binding model

- Durable `agent_bindings_v7` records company, role, and member targets with backend, model, non-secret configuration, version, actor, and timestamp.
- Resolution order is member → pipeline role → company → runtime default.
- Demo companies always resolve to deterministic standalone `phase0-model`.
- `run_agent_binding_snapshots_v7` freezes planner, worker, and reviewer resolution when the Run first enters the pipeline.
- Later binding changes affect new Runs only.

## Execution and security

- RolePipeline invokes the frozen Host and model for every role and records both in model-call output and Run audit.
- Binding configuration rejects credential-like fields.
- Company policy permissions protect list/change APIs; Run snapshot reads require Company view access.
- A selected non-standalone runtime backend must pass model/CLI installation and login health probing before the Local Control Plane starts.
- No automatic backend fallback is performed.

## UI

- Company Command Center manages and lists company, role, and member bindings.
- Pixel Office employee Drawer shows the applied backend, model, pipeline role, and resolution path.

## Validation

- fallback, Demo override, secret rejection, cross-company rejection, snapshot immutability
- planner/worker/reviewer routing to different Host/model combinations
- binding API authorization and Run snapshot authorization
- browser rendering of the applied employee backend
- full `npm run verify`
