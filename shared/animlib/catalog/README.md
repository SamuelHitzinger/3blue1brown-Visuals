# Visualization catalog

This catalog lives with animlib and describes reusable authoring knowledge. It is separate from the renderer's asset descriptor catalog.

- **Resources** are exact assets, data and sources, with provenance and preparation requirements.
- **Techniques** are reusable domain explanations selected by the storyboard's relationship, identities and invariants.
- **Foundations** are general quality and explanatory skills used across techniques.

Start with the teaching need. The compact [navigation guide](navigation.md) is injected directly into planning, authoring, review, repair, and lecture synthesis. Search the versioned [index](index.json), read selected records, and follow their related IDs only as needed. The production host exposes bounded ID-only search/read tools; listing a source does not fetch it, register an asset, or authorize a scientific or visual claim.

A ready record describes an available method or supported publication route. Host-preparation records require the stated host capability and input selection. Reference records, when added, supply background without promising executable support.

To add a record: choose a stable lowercase ID, concise discovery metadata, one bounded document under its tier directory, related IDs and explicit limits. Record exact inputs, preparation, provenance, representation meaning and verification. Preserve historical assets and proof identities. Do not include lesson-private source material. The host validates index shape, entry paths, relationships and response budgets; catalog tests also verify linked local resources. Keep the general prompt constant as the catalog grows.

The root index is a small versioned routing manifest. Metadata lives in independently bounded tier/domain shards under `indexes/`; split a growing domain into another shard and add its path to the root. Documents stay separate and are read only by selected ID. The host caches validated metadata for deterministic search, reads at most 20 result summaries or one 16 KB document per request, and traverses at most 12 related entries without cycling. Adding records does not enlarge every agent prompt.

Current host safety ceilings are 128 shards of 256 KB each (at most 2,000 entries per shard). These are defensive I/O/memory limits, not a target library size. At larger scale, replace the service's metadata-search implementation with an indexed store or domain router while preserving the public search/read API, stable IDs and bounded responses; do not inject the full catalog into prompts or raise limits without measuring resident memory and retrieval quality. Reload deployment after catalog changes so cached metadata matches its versioned documents.
