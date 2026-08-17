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

## 5. Nitriles and nitro compounds

- Adds nitrile (`C≡N`) as a first-class functional group in the local analyzer.
- A terminal nitrile carbon participates in the parent chain and receives functional-group priority above aldehydes and ketones.
- `butanonitrilo` is now suggested as `butanonitrilo`, not `butano`, and the reasoning panel identifies the nitrile as the principal functional group.
- Secondary nitriles are represented with the `ciano-` prefix.
- Adds nitro-group detection (`–NO₂`) as a prefix functional group, so `2-nitropropano` is suggested correctly and appears in the substituent reasoning.
- OpenChemLib import now permits the formal-charge pattern specifically required by nitro groups (`N+` / `O−`) while continuing to reject unsupported charged structures.
- Atom formal charges are retained in the canvas data model so nitro oxygens do not acquire spurious implicit hydrogens.
- Adds nitrogen-palette templates for nitrile and nitro groups.
- Adds offline fallbacks for `2-nitropropano` and `butanonitrilo`.
- Fixes the Spanish-to-OPSIN bridge: `butanonitrilo` -> `butanenitrile`.

Additional verification added:

- OPSIN translation tests for `2-nitropropano` and `butanonitrilo`.
- Offline fallback tests for both compounds.
- OpenChemLib test for the nitro formal-charge pattern.
- Local nomenclature/reasoning tests requiring `butanonitrilo` to identify nitrile as the principal group and `2-nitropropano` to identify `nitro` as a substituent.
