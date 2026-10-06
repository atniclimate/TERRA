# TERRA

Tribal Environmental Resilience and Resource Analytics: a static showcase of the nine applications in the TERRA portfolio of the Affiliated Tribes of Northwest Indians (ATNI), their dated development status, and the deliverables projected for the 0.9.x release candidates in mid-December 2026.

Live site: https://atniclimate.github.io/TERRA/

## Run locally

```
python -m http.server 8080 -d site
```

Then open http://localhost:8080. The site is plain HTML, CSS and JavaScript with no build step. Its one runtime library is CesiumJS, bundled locally for GeoBase's 3D terrain display (`site/assets/geobase3d/`), which loads only when that display is shown.

## Contents

- `site/` is the published site. GitHub Pages deploys it through `.github/workflows/pages.yml`.
- Status on the site comes from each project's own dated records; projected items are targets, not commitments.

## Credits

- Fonts: League Spartan and Poppins, SIL Open Font License 1.1 (license files in `site/assets/fonts/`).
- Elevation contours: NOAA NGDC ETOPO1 Global Relief Model (Amante and Eakins, 2009).
- 3D terrain display: USGS 3DEP terrain; USDA NAIP imagery via USGS The National Map; wind resource layer from the NREL WIND Toolkit with ESA WorldCover 2021 (contains modified Copernicus Sentinel data (2021) processed by ESA WorldCover consortium; CC BY 4.0); CesiumJS, Apache License 2.0.
- Photographs: Patrick Freeland. No photograph is identified by place, and all metadata is removed from the published copies.

## License

All rights reserved; see `LICENSE` for the terms and the third-party licenses.
