# Caffeine 3D complexity fixture

Prepared on 2026-10-16 from the official [PubChem PUG REST 3D record for CID 2519](https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/2519/JSON?record_type=3d). The [formula property endpoint](https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/2519/property/MolecularFormula/JSON) independently reports `C8H10N4O2`, matching the atom inventory.

Local files are in the ignored `data/realtime-workshop/complexity-matrix/inputs/` directory:

| File | Purpose |
| --- | --- |
| `pubchem-caffeine-cid2519-3d.json` | Unmodified 11,816-byte source response |
| `pubchem-caffeine-cid2519-formula.json` | Unmodified formula response |
| `caffeine-cid2519.data.json` | Compact 2,774-byte host-provided `DATA` object |
| `caffeine-cid2519.fixture.json` | Provenance, schema, framing ranges, element colors and low/high authoring instructions |

The two compact public files are also shipped byte-for-byte in `backend/bench/realtime-complexity-fixtures/` under the same filenames. This tracked copy makes the benchmark reproducible without the ignored local download directory or a new network request. No private media is included. That directory's `.gitattributes` disables JSON line-ending conversion so the recorded digests survive checkout on Windows and other hosts. The full raw PubChem responses remain local provenance evidence; their URLs and hashes are retained in the shipped fixture.

SHA-256 of the raw 3D response: `47431d2119cac4bf9230e0f7838b2dd731ca7840958c4f2f2a44d9276944bacc`.

SHA-256 of the formula response: `eb7179bfbfa7cab87bc0de391dd09dde1fba6eb0d3c3d9b81788021317290b07`.

SHA-256 of the compact data file, including its final newline: `c9258f019dcaad8754b4f171dd379f6b78e33bd27b8aa90b949378cd7079dce1`.

SHA-256 of the shipped instruction/provenance fixture: `40dfa2aa0ca54639a9f94f673fc62c9b8fa2b590674559e37df0b1032da707fd`.

The source has one coordinate set and one conformer. Its coordinate type codes `[2,5,10]` identify computed 3D coordinates in angstroms according to the [official NCBI coordinate-type schema](https://www.ncbi.nlm.nih.gov/IEB/ToolBox/CPP_DOC/asn_spec/PC-CoordinateType.html). This is a computed conformer, not an experimental structure or a molecular dynamics trajectory.

| View | Atoms | Bonds |
| --- | --- | --- |
| Heavy-atom / low mesh detail | 14: C8, N4, O2 | 15 |
| Full molecule / higher mesh detail | 24: C8, H10, N4, O2 | 25 |

The full source has 21 single bonds and 4 double bonds. The full molecule has **24 atoms**, not 26. Heavy-atom selection removes only H atoms and their incident bonds; it does not recompute topology or coordinates.

The adapter maps coordinates using PubChem atom IDs, retaining every numeric XYZ value, bond endpoint and bond order. A validation pass compared all 24 serialized coordinate triples and all 25 serialized bonds with the source record, checked unique atom IDs and endpoint membership, and cross-checked both the heavy-atom count and molecular formula. No geometry, hydrogens, connectivity or aromatic bond orders were inferred.

Exact source bounds are `min=[-3.1271,-3.1973,-0.8992]` and `max=[4.1992,3.1651,0.9004]` angstrom. The bounding-box midpoint, approximately `[0.53605,-0.0161,0.0006]`, is stored separately as `DATA.center`. The source coordinates remain uncentered and unscaled. Scene code may subtract this midpoint and apply one uniform display scale. Colors (`C=GREY_B`, `H=WHITE`, `N=BLUE`, `O=RED`), display radii, stick widths and double-bond offsets are illustration choices.

## Data delivery without coordinate regeneration

`CompileInput` in `shared/animlib/src/types.ts` currently provides asset descriptors, model metadata, palette, previous frame, controls and seed; it has no supported generic data field. The source compiler accepts ordinary top-level declarations before its single default-exported scene and rejects module imports.

The benchmark can therefore use a deterministic host prelude without changing the compiler:

```ts
const data = JSON.parse(await readFile(dataPath, 'utf8'));
const prelude = 'const DATA = ' + JSON.stringify(data) + ';\n';
const combinedSource = prelude + rawModelAuthoredSource;
```

Declare this binding contract before the model call. Give the model the schema, counts, colors and framing ranges from `fixture.promptContext`, plus the selected variant instructions; do not require it to repeat the coordinate arrays. The exact schema is `atoms:[{id:number,element:string,position:[x,y,z]}]`, `bonds:[{from:number,to:number,order:number}]`, `units:'angstrom'`, with separate `center`, `bounds`, `counts`, `selections` and `elementColors`.

Save and hash the raw model-authored source, raw data file, deterministic prelude and combined source. Compile the combined source exactly as assembled. The prelude supplies data only; it contains no scene, animation or layout and is not a post-generation repair. The model owns the molecule depiction, loops, bond representation, camera, labels and animation. The low variant explicitly omits hydrogens; the high variant includes all atoms and uses a rigid view rotation without inventing molecular motion.

## Reproducible chemistry case preparation

`prepareCaffeineCases(directory)` in `backend/bench/realtime-complexity-fixtures/prepare.ts` adds `caffeine-heavy` and `caffeine-full` to an existing prepared manifest. The host can import and await it after preparing the non-chemistry cases. It reads the shipped fixture relative to its own module, checks the data digest, and stores an absolute tracked data path in each case.

The prompts and case fields reproduce `.tmp/realtime-pair/prepare-chemistry.ts` exactly, except that `dataFile` points to the shipped data. The helper appends only missing IDs, leaves other manifest fields and case ordering intact, makes repeated calls idempotent, and checks all case-file conflicts before writing. It refuses to replace different existing evidence. It was tested in fresh temporary directories, never invoked on `screen-01`, and does not make network or model calls.

Verification: **3 tests passed, 15 assertions**, with focused TypeScript checking passing. Tests check both shipped hashes, exact case fields, both original screen-01 prompt hashes, idempotent unique appending, and preservation of conflicting existing evidence. The original screen-01 manifest plus its two caffeine case files and prompts were independently hash-checked unchanged.

This work prepared and validated data and case instructions only. It made no model calls, authored no benchmark scene and changed no compiler, renderer, world or main matrix implementation. The full 3D scene quality and timing remain for the model-authored screening run.
