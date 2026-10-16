# Exact metadata lookup for complex assets

2026-10-16. Host-only changes; no new provider run or animation-playback support.

The local asset index now searches validated published-model part IDs/names,
native-package part IDs, glTF clip names and top-level JSON data keys. These names
remain host metadata rather than extra prompt payload. Literal names precede
tokenized matches, so scientific names such as `A`, `In` and `C-alpha` remain
discoverable. Duplicate names preserve distinct asset/part identities.

Search metadata has bounded accounting (up to 1,024 unique names per record and
an aggregate allowance of `min(maxBytes, 8 MiB)`). Accounting is a conservative
estimate, not measured JavaScript heap usage. Omitted names have explicit record
limitations and counters. Private clip details have a separate allowance; omitted
details are also reported. Results preserve the existing 28,000-byte descriptor
and 63,500-byte page limits. Large clip inventories return query-relevant entries
first, with exact original indices, paths and JSON pointers; `omittedClips` counts
undelivered entries. This is metadata discovery, not clip playback.

Frozen lecture sessions expose `parts({assetId, query?, offset?, limit?})` and local
GET `/lecture-assets/parts`. Only registered runtime asset IDs are accepted. Each
page contains exact IDs/names, inventory identity, matching total and continuation
offset; maximum 20 parts and 16,000 encoded bytes. Empty-query paging preserves
metadata order. Exact part IDs outrank literal names, which outrank token matches.
The same query puts relevant parts first in the existing 24-part candidate summary.
The model still has one submission tool: no extra provider lookup round trip was
added, and the part endpoint is host/browser infrastructure rather than a new tool.

Metadata and scientific provenance remain frozen with verified geometry. Lookup
does not re-read geometry, alter inventory identity or replace the retained world.
Byte limits never shorten a part name or scientific caveat; candidate descriptors
that cannot fit are omitted whole with existing omission counts.

Local installed-inventory smoke found 52 records, 311 indexed names, no omitted
search names and zero animated records. Querying `chain-A-protein-trace-0` returned
the expected `node-0` in both candidate and part results, preserved inventory
identity, and added no metadata reads. One candidate lookup plus 101 part lookups
took 7.69 ms in this single warm local sample. This excludes index construction,
asset preparation, inference and rendering, and is not an end-to-end speed claim.
The existing oversized biological staging JSON remains an explicit index issue.

Regression coverage includes late parts beyond the first 24, 128 long clip names,
data keys beyond the 64-key preview, literal stopword/punctuation names, duplicate
names, ID/name collisions, escaped-name byte budgets, cache/filter behavior,
immutable snapshots, changed files, concurrent admission and cumulative browser
inventory limits. Synthetic clip fixtures are necessary because the installed
corpus contains no clips. No scientific-selection or motion-quality acceptance
follows from these tests.

Final verification passed 52 tests across four files (1,213 assertions), plus
strict targeted TypeScript checks. Windows hardlink/junction fixtures required
execution outside the filesystem sandbox; initial permission failures were not
fixed by weakening publication validation. Independent review found and resolved
literal-name and ID/name-ranking issues, with no remaining scoped findings.

See the separate [latency audit](animation-latency-audit-2026-10-16.md),
[architecture research](animation-architecture-research-2026-10-16.md) and
[cross-subject/detail matrix](cross-subject-visual-matrix.md). The existing ten-case
side-by-side viewer remains a handwritten runtime comparison, not a paired model
speed benchmark.
