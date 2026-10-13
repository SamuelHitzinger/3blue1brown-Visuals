# USGS elevation-data preparation source

Readiness: reference only. No raster downloader, GeoTIFF parser, GIS reprojection tool or DEM is bundled by this catalog entry. Preparation must happen externally before a selected grid or supported model is available to a scene.

The [USGS metadata guide](https://www.usgs.gov/faqs/what-projection-horizontal-datum-vertical-datum-and-resolution-a-usgs-digital-elevation-model) explains product-dependent coordinates, resolution and datums. Read the actual product header and metadata instead of assuming all USGS elevation products share them. The [USGS glossary](https://www.usgs.gov/ngp-standards-and-specifications/lidar-base-specification-glossary) distinguishes elevation grids and their spatial resolution.

Record source product and tile IDs, acquisition or publication date when provided, download date, source hash, horizontal/vertical units, datums, missing-data encoding and every crop/resampling operation. Check product-specific attribution and usage conditions. A hillshade or color image is not an elevation grid.

Prepare a bounded local coordinate grid, missing-data mask and explicit display transform. Resample outside the scene VM and retain a higher-resolution source for checking. Use native mesh vertices for a small grid or a supported host-prepared static model. Current `publish_model` does not accept GIS files directly; any GLB conversion is a separate prepared derivative.

Follow [terrain and scalar surfaces](../techniques/terrain-scalars.md). Check matching section heights, north/east orientation and vertical exaggeration. Catalog inclusion establishes a research route, not automatic data availability or permission to infer erosion, flooding or geological history.
