# Skeletal geometry and nomenclature reliability patch

This patch is based on `Hydrocarbon-Lab-render-fix-v2.zip` and keeps all previous fixes.

## 1. Open-chain skeletal geometry

- Adds `app/skeletal-layout.ts`.
- Open acyclic structures are laid out from graph connectivity instead of applying a parity offset to raw editor coordinates.
- The parent carbon chain alternates bond directions at +30° / -30°, producing 120° C-C-C internal angles and the standard textbook zig-zag.
- Branches are placed on the same trigonal lattice.
- The layout is display-only and never mutates the molecule's chemical/editor coordinates.
- Ring structures continue to preserve their imported polygon geometry.

## 2. Bond selection/focus

- Removes the rectangular SVG outline from `.bond-control:focus-visible`.
- Keyboard focus is shown with a drop-shadow on the bond itself.
- Focus styling cannot affect atom coordinates.

## 3. Complex suggested-name safety

- The local analyzer continues detecting all functional groups.
- If a secondary/same-priority functional group is nested inside a carbon substituent and therefore requires its own substituent numbering, the local namer is considered unsafe for that graph.
- A structure successfully resolved by OPSIN/OpenChemLib keeps the validated source name instead of replacing it with an incomplete local name.
- After manual editing removes that trusted source context, an unsupported nested-functional structure displays `Nombre no disponible para estructuras complejas` instead of a chemically incomplete suggestion.
- Adds an integrated offline fallback for `3-fluoro-3-(2-oxopropyl)cyclohexan-1-one`.

## 4. N-substituted amines

- Fixes the Spanish-to-OPSIN bridge for names such as:
  - `N-metiletanamina` -> `N-methylethanamine`
  - `N,N-dimetiletanamina` -> `N,N-dimethylethanamine`
- Adds integrated offline SMILES fallbacks for both names.
- The existing local amine nomenclature can then preserve N- and N,N- substituent locants.

## Verification added

- Automated geometry tests for pentane and hexane require 120° internal angles.
- A test verifies bond focus is visual only.
- Resolver tests cover both N-substituted ethanamines and the fluorinated cyclic diketone.
- Functional-analysis tests verify two ketones plus a halogen are all detected in the complex example and that the local namer flags the nested group as unsafe.

Local lightweight checks completed while packaging:

- TypeScript/TSX syntax transpilation: passed for all modified TS/TSX files.
- Standalone pentane/hexane skeletal geometry tests: passed.
- Offline OPSIN fallback resolution checks for the three new complex-name cases: passed.

A full `npm test` was not run in the packaging container because project dependencies were not available locally.
