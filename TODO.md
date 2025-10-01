# Raze CLI — Grant MVP TODOs

This file is your day-by-day checklist for the high-value features targeted for grant/investor milestones.
When you finish a task, tell me and I will confirm and mark it done in this file.

## Priority MVP (work in order)

1. [✅] Core CLI (scaffold / test / deploy) — **COMPLETED**

   - Subtasks:
     - [✅] Stabilize scaffolding commands (project init, contract template)
     - [✅] Integrate tests commands (unit, fork, fuzz) for common frameworks
     - [✅] Deploy command for testnets (ethers/hardhat/cli integration)
   - Acceptance criteria:
     - [✅] `raze scaffold <project>` creates a working sample project
     - [✅] `raze test` runs unit tests and returns exit code 0 on success
     - [✅] `raze deploy --network <testnet>` successfully deploys sample contract to public testnet
   - **Status:** COMPLETED ✅ — All features implemented and tested
   - **Key Achievements:**
     - Multi-framework support (Hardhat, Foundry, Brownie)
     - Contract templates (ERC20, ERC721, basic)
     - OpenZeppelin v5 compatibility
     - Auto project setup with dependencies
     - Universal test runner with project detection
     - Multi-chain deployment system
   - Est. effort: 4–8 days (Completed in 1 day)

2. [ ] ROT basic agent (AI-assist for code snippets / scaffolding)

   - Subtasks:
     - [ ] Implement simple prompt templates for scaffold + code snippets
     - [ ] Add fallback parsing and safe action whitelist
     - [ ] Wire AI usage meter hooks (emit events for billing)
   - Acceptance criteria:
     - `raze rot "scaffold an ERC20 with Brownie/Hardhat"` produces usable scaffold or a clear fallback
     - Agent calls are logged with a usage ID for later metering
   - Est. effort: 3–6 days

3. [ ] On-chain verifier (beta)

   - Subtasks:
     - [ ] Design verifier API & data model (artifact hash, metadata, signer)
     - [ ] Implement a simple server endpoint that signs/verifies artifacts
     - [ ] Deploy a testnet smart contract (optional) to anchor receipts
     - [ ] Add client CLI call: `raze verify <artifact>`
   - Acceptance criteria:
     - CLI can produce a signed verification receipt for an artifact
     - Verification receipt can be validated locally and (optionally) on-chain
   - Est. effort: 5–10 days

4. [ ] Plugin registry / marketplace alpha (discoverability)

   - Subtasks:
     - [ ] Define plugin manifest and registry schema
     - [ ] Add CLI commands: `raze plugin publish`, `raze plugin list`, `raze plugin install`
     - [ ] Build a minimal registry (Git-backed or simple JSON index) for alpha
   - Acceptance criteria:
     - A plugin can be published and installed via the CLI
     - Registry supports metadata (author, price, version)
   - Est. effort: 4–8 days

5. [ ] AI credits usage metering + simple billing prototype

   - Subtasks:
     - [ ] Add usage events to key AI operations (ROT, code-gen)
     - [ ] Implement a lightweight credits ledger (local file for alpha)
     - [ ] Prototype a Stripe checkout / billing page for buying credits (optional beta)
   - Acceptance criteria:
     - AI calls decrement credits from a user's ledger and refuse if no credits
     - Admin can top-up credits via a simple script or Stripe demo
   - Est. effort: 3–6 days

6. [ ] Integrations: Hardhat + Foundry + 1 L2 partner
   - Subtasks:
     - [ ] Hardhat: scaffolding templates + run/test integration
     - [ ] Foundry: template + test/run hooks
     - [ ] L2 partner: add network config + publish a quick-start sample
   - Acceptance criteria:
     - `raze scaffold --template hardhat` creates a runnable Hardhat project
     - `raze scaffold --template foundry` creates a runnable Foundry project
     - One L2 quick-start sample published and documented
   - Est. effort: 4–8 days

## Workflow & rules

- Work the list in order. Each completed task: tell me "done: <task name>" and I will verify and mark it checked.
- For partial progress, tell me which subtask is finished and I will update the list accordingly.
- I can also open / edit PRs, generate test scripts, or create example projects from these tasks on request.

## Suggested daily cadence

- Day 1: Core CLI scaffold + one integration (e.g., Hardhat template)
- Day 2–3: Finish CLI test & deploy flows, start ROT templates
- Day 4–7: Build verifier prototype and add CLI `verify` command

---

If you want this in a different format (JSON, GitHub issues, or a Kanban board), tell me and I will create that next.
