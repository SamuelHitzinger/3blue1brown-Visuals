# Reviewed motion inputs

These original schematic schedules make current scene generation independent of
historical exports under ignored `data/`. They contain no reference-film pixels
or source models. Public helpers consume these ordinary JSON props; this directory
is example data, not a second runtime API.

`transcription-cycle.json` preserves the exact revision-2 template, paired strand,
eight RNA arrivals, extrusion geometry and absolute event schedule used by the
independently accepted revision-3 mathematical rendering. It was copied from the
reviewed `cycle-inputs.json`; changing its filesystem location leaves generated
scene source and manifest bytes unchanged.

`rna-processing-splice.json` and `rna-processing-thread.json` preserve the
reviewed revision-2 motion props consumed by the independently accepted
revision-4 mathematical rendering. They retain the material-arc loop formation,
cut/join topology and curved pore path without parameter changes. The generator
reads each file's `props`; its `provenance.historicalSource` records the original
extraction location and is not a generation dependency.

The [current reproduction audit](../../../../../docs/animlib-expansion/current-capability-audit.md)
records byte-identical regenerated scene sources and manifests after these
input relocations. Generate a new candidate before changing these schedules;
the accepted films and their hash records describe the frozen inputs.
