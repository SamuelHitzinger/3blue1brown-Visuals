# Prepared native geometry and image packages

Use prepared packages for dense static geometry, named rigid parts, and reusable images. They reduce repeated source/VM work, not the scene's logical geometry or renderer budgets.

The [asset import contract](../../docs/assets-import.md), [host loader](../../tools/load-assets.mjs), [biological package inventory](../../fixtures/biological/README.md), and [Suzanne source record](../../fixtures/suzanne/README.md) describe real resources. Manifest provenance and content hashes identify assets; keep image dependencies and source-color policy with them.

Native host workflows load selected package manifests into an asset registry, supply descriptor-only catalogs for compilation and retain registry ownership for rendering. Production video agents instead use the existing `publish_model` GLB delivery path, which supports only the allowlisted bundled fixtures or other supported source inputs. Do not assume every native fixture has a publication fixtureId. Check the supplied modelCatalog.

For static GLB publication, use named parts and licensed self-contained supported geometry. Import does not supply arbitrary skins, clips or deformation topology. Source images require their documented material/color policy; schema-compatible bytes are not a license grant.

Verify package IDs/hashes, decoded budgets, required image dependencies, part identities and a rendered representation. Historical assets are optional resources, not the latest visual acceptance merely because their directory has a higher revision number.
