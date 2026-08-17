# SMILES interoperability

This update keeps `.quimica` as SciU's native editable document format and adds a separate SMILES interchange workflow.

## Added

- A **SMILES** button beside the advanced name builder.
- Export of the current editable molecular graph as a plain-text `.smi` file using OpenChemLib `toIsomericSmiles()`.
- Import of `.smi`, `.smiles`, and `.txt` files.
- SMILES parsing through the existing OpenChemLib adapter and automatic conversion to the editable SciU canvas graph.
- Import feedback with the locally calculated suggested IUPAC name.
- Support for conventional `.smi` records containing `SMILES label` on one line.
- Safe handling of multi-record files: the first molecule is imported and the UI reports how many additional records were ignored.
- English/Spanish interface strings, dark-mode styling, and responsive layout for the new panel.

## Preserved

- The `.quimica` import/export workflow is unchanged and remains the native SciU format.
- Existing nitrogen-compound fixes and display controls are retained.
- The same canvas chemistry/valence restrictions apply to imported SMILES; unsupported structures return a clear error rather than silently corrupting the graph.

## Validation performed

- `tests/smiles-file.test.mjs`: 4/4 passing.
- TypeScript/TSX syntax transpilation checks passed for the modified source files.
- ZIP integrity checked after packaging.

A full dependency install / production build was not run in the packaging environment, so OpenChemLib runtime integration should still be smoke-tested in the deployed app with representative `.smi` files.
