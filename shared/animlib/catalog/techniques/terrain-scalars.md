# Terrain, scalar maps and cross-sections

## Inputs and truth
Supply a bounded height grid or analytic surface, horizontal coordinate system, horizontal and vertical units, datum, spacing and missing-data mask. Keep measurement provenance and any vertical exaggeration explicit.

## Construction
Show a selected location on the surface and its matching profile point before introducing a contour or scalar legend. Generate the surface, profile and contour from the same retained data and transform. Native `s.surface` handles a function graph; a prepared grid can use `s.mesh` with fixed topology. Missing cells must remain holes or visibly missing, not silently interpolated land.

The [USGS source record](../resources/usgs-elevation-data.md) describes preparation inputs. Read [surface APIs](../../docs/reference.md#function-and-parametric-surfaces) for geometry budgets and invalid samples.

## Fast path and checks
Crop and resample data on the host before scene generation. Keep full-resolution source data outside the prompt; feed a bounded grid or published static geometry plus provenance. Use a coarse contextual mesh and a selected detailed section when scale permits. Check coordinate orientation, elevation units, missing cells, vertical scale and agreement between profile and surface.

## Sources and limits
[USGS: DEM coordinates and resolution](https://www.usgs.gov/faqs/what-projection-horizontal-datum-vertical-datum-and-resolution-a-usgs-digital-elevation-model) and [DEM definitions](https://www.usgs.gov/ngp-standards-and-specifications/lidar-base-specification-glossary) establish metadata requirements. There is no GIS raster importer, reprojection, erosion or flood solver in scene code. A colorful scalar surface is not evidence of an actual terrain process.
