# Specifications

Every behaviour change starts here, before any test or code.

- `features/<slug>/<slug>.md` — one spec per feature: user stories, a sequence
  diagram per story, and acceptance criteria as **Gherkin scenarios** tagged
  with stable IDs (`@AC-KUDOS-1`). Created with `/feature` in Claude Code.
- `features/README.md` — generated index (`generate-features-index.py`).
- `features/_template.md`, `_bug-template.md` — starting points.

The AC ID is also the name of the test that proves it, so a search for
`AC-KUDOS-1` finds both the scenario and its test.
