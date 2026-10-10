# Prepared image appearance v1

The approved asset architecture is extended in place: host registries own RGBA8
images and UV-mapped models; frames and the scene VM carry immutable references.
The first slice supports base color images, opaque/blend alpha, nearest/linear
filtering, clamp/repeat wrapping, and optional explicit palette tint. No PBR
equivalence, source vertex colors, palette-indexed storage, mipmaps, or image
clipping/outline/scalar/procedural combinations are claimed.

`PreparedImageInput` contains `id`, `kind:'image'`, `version:1`, width/height,
`storage:'rgba8'`, `encoding:'srgb'`, `origin:'top-left'`, `alpha:'straight'`,
`colorPolicy:'source'`, `pixels:Uint8Array`, and existing provenance. The registry
clones pixels before asynchronous hashing; resolvers return a frozen image
descriptor with a `copyPixels()` upload method, never its private mutable buffer.
Image identity hashes metadata plus the raw pixel SHA-256, excluding the ID.
Maximum dimension is 4096, image bytes 64 MiB, registry bytes 256 MiB.
`createAssetRegistry(inputs,{colorPolicy:'source'})` is the sole source-color
authorization. A scene descriptor cannot change host registry policy.

Model parts gain `uv0:[number,number][]` and `imageTexture`:
`{image:{id,hash},alphaMode:'opaque'|'blend',filter:'nearest'|'linear',wrap:'clamp'|'repeat',tint?:ColorValue}`.
UV count equals vertex count; seam vertices stay split. Every dependency must
exist at its declared hash. Model descriptors expose this appearance reference
and UV presence, without arrays. The package adds a Float32 UV0 blob and the same
appearance. Image packages replace input pixels with the existing checked BlobRef.

`s.image(id,{asset,width?,height?,alphaMode?,filter?,wrap?,tint?,...style})` emits
one ordinary planar mesh, top-left UV (0,0), with aspect ratio from the descriptor.
Width defaults to one; height defaults from width and image dimensions. `s.model`
inherits source part appearance. Tint is separate from fill and defaults to white.
Existing leases include image dependencies and retain transactional rollback.

Packed geometry appends UV plus image alpha mode to the existing vertex layout.
Both shaders sample RGBA8 unorm data without an implicit sRGB decode/re-encode:
the existing renderer operates on encoded sRGB palette values. This deliberately
preserves exact unlit source RGB and existing palette/lighting behavior; shading
and alpha composition remain the engine's stylized encoded-space operations,
not linear-light PBR. Image orientation is normalized only in offline preparation.
Texture identity and sampler join draw batching; blending keeps global triangle
sorting. Device/context caches share image uploads across instances and samplers,
sweep inactive images, and destroy/reupload on recovery.

Verification proceeds failure-first through validation, immutability, dependency
leases, compile/payload behavior, UV/seam packing, batching, and actual native
WebGPU/browser WebGL pixel readback. Synthetic fixtures test color corners,
non-palette midtones, alpha, tint, wrap, filtering, reuse and recovery. A separately
prepared CC0 Suzanne/base-color pairing supplies real source reuse evidence and
a 5–8 second native export. Existing baseline GPU failures remain visible.
