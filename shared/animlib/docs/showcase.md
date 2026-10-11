# Animation capability showcase

The current showcase combines eleven independently reviewed native animations
into one 2:11 silent film with chapter navigation at 1280×720 and 30 fps. It preserves complete operations,
original playback speed and reading holds. The surrounding page explains what to
watch and links each operation to its reusable API, source and review.

## What it shows

| Domain | Visible operations |
| --- | --- |
| Geometry and algebra | Shear a shared coordinate world; copy, scale and add vectors; carry their terms into arithmetic |
| Algorithms | Insert, extract and compact immutable frontier records with local cost comparisons |
| Linked scientific data | Events become rates and state vectors; traces become a projected trajectory; a selected prediction exposes its residual |
| Molecular choreography | Local coils form, hold and pack while sequence identity persists |
| DNA and RNA | Complementary arrivals dock and incorporate; a loop forms, cuts and rejoins; a chain passes through an aperture |
| Translation | Assembly, pairing, cargo transfer, register advance, repeated growth, stop recognition, release and separation |

The primary films use the current mathematical visual language. Separate
supplements demonstrate image/UV reuse and optical focus; their technical
acceptance does not turn historical artwork into the current default.

## Open or rebuild

The generated local artifact is `data/animlib-expansion/showcase/index.html`.
Open it in a browser or serve its directory with a local static server. The
companion `showcase.mp4` can also be played directly. Generated output is ignored
by Git; it is a viewing artifact, not a runtime dependency.

From repository root, assemble the exact reviewed renders with:

```sh
node shared/animlib/tools/build-capability-showcase.mjs --ffmpeg /path/to/ffmpeg
```

The versioned [catalog](../demo/expansion/showcase-catalog.json) pins source films
by SHA-256. This assembly requires those local films. A fresh clone first needs
the [scene generation and rendering workflows](../demo/expansion/README.md), and
new encodes need their own review and catalog update if their hashes differ.
Do not bypass the hash check or present regenerated media as the exact old freeze.

For new scenes, start with [explanatory motion](explanatory-motion.md) and
[helpers/assets](helpers-and-assets.md). The [coverage index](expansion-index.md)
records exact accepted operations and their limits. Biology uses prescribed
schematic motion; these films do not claim physical folding or atomistic kinetics.

The [independent assembly review](../../../docs/animlib-expansion/showcase-independent-review.md)
records frame preservation, full decode and chapter verification. The
[browser check](../../../docs/animlib-expansion/showcase-browser-qa.md) covers
playback, chapter navigation and narrow-screen layout.
