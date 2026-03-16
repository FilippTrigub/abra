# Workflow Test Plan

## Scope
Test the workflow orchestration layer, not individual skills (already tested in `test_*.py`).

## Implemented Tests (11 passing)

### 1. Config Layer ✓
- [x] Discover workflows from `creative/` and `brand/` directories
- [x] Validate required fields (name, steps, skill existence)

### 2. Execution Layer ✓
- [x] Runner help works
- [x] Missing workflow shows available options
- [x] Missing input shows clear error

### 3. Schema Validation ✓
- [x] Enforce: brand-manager first (with action=refresh)
- [x] Enforce: post-scheduler last

### 4. CLI Flags ✓
- [x] `--skip-optional` flag accepted
- [x] `--device` flag accepted
- [x] `--no-archive` flag accepted

## Not Implemented (would require full E2E)

### Execution (needs real input)
- [ ] Run workflow with valid input
- [ ] Pass output of step N as input to step N+1

### File Management
- [ ] Copy input to `input/staging/` before processing
- [ ] Move input to `archive/<workflow>/<timestamp>/` after scheduling
- [ ] Copy final output to `output/<workflow>/`

### Error Handling
- [ ] Missing skill → clear error
- [ ] Failed step → report and exit

## What NOT to Test
- Individual skill outputs (tested in `test_*.py`)
- ML model behavior
- GPU requirements

## Approach
- Use existing fixtures (`test_clip`, `test_frames`)
- Test workflow runner as black box via subprocess
- Mock slow/skippable skills if needed
