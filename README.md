# MREC Cell Size Optimiser

A browser-based geostatistical tool for determining optimal block model cell sizes from drillhole data. Built for MREC Iberico by Obsidian Consulting Services.

## Features

- **Five-step workflow**: Import → Map Columns → Desurvey → Parameters → Results
- **Three desurvey methods**: Minimum Curvature, Tangential, Balanced Tangential
- **Six-criteria analysis**: Drill spacing rule, variogram range, composite:block ratio, kriging neighbourhood, information content, SMU constraint
- **Interactive plan view**: Block grid explorer with live cell size slider, zoom and pan
- **CSV export**: Full criteria report download
- **Credential-protected**: Login screen with user management via `credentials.js`

## Repository Structure

```
mrec-cellsize-optimizer/
├── index.html          ← Main application entry point
├── credentials.js      ← User credentials (edit to manage access)
├── css/
│   └── style.css       ← All styling (geocore design system)
├── js/
│   └── app.js          ← All application logic
├── assets/
│   └── mrec_logo.png   ← MREC Iberico logo
└── README.md
```

## Deployment (GitHub Pages)

1. Push this repository to GitHub
2. Go to **Settings → Pages**
3. Set source to **Deploy from a branch → main → / (root)**
4. The tool will be available at `https://<username>.github.io/<repo-name>/`

## Managing User Credentials

Open `credentials.js` and edit the `CELLSIZE_USERS` object:

```js
const CELLSIZE_USERS = {
  "admin":      "yourpassword",
  "demo":       "demo",
  "new user":   "theirpassword"   // usernames may contain spaces
};
```

- **Usernames** are case-insensitive and may contain spaces
- **Passwords** are case-sensitive and may contain any characters
- To remove a user: delete or comment out their line
- To change a password: edit the value on the right

> ⚠️ **Security note**: This file is loaded by the browser. Do **not** commit real production passwords to a public GitHub repository. For public repos, keep placeholder passwords here and share actual credentials privately with each user.

## Usage

1. Navigate to the deployed URL
2. Log in with your credentials
3. **Step 1 — Import**: Upload Collar, Survey, Assay (and optionally Lithology) CSV files, or use a single point file. Use **Load Demo Data** to explore with synthetic data.
4. **Step 2 — Map Columns**: Verify the auto-detected column assignments
5. **Step 3 — Desurvey**: Choose a method and run to compute 3D sample positions
6. **Step 4 — Parameters**: Optionally enter a fitted variogram range and SMU dimensions
7. **Step 5 — Results**: Review the six-criteria analysis and recommended cell size

## Supported File Formats

- **Collar**: CSV with HOLEID, X, Y, Z, (DEPTH)
- **Survey**: CSV with HOLEID, DEPTH, DIP, AZIMUTH
- **Assay**: CSV with HOLEID, FROM, TO, and one or more grade columns
- **Lithology**: CSV with HOLEID, FROM, TO, LITH (optional)
- **Point file**: CSV with HOLEID, X, Y, Z per sample centroid

Common column naming variants are auto-detected.

## Technical Notes

- Pure HTML/CSS/JS — no build toolchain required
- All computation runs in-browser; no data is sent to any server
- Nearest-neighbour spacing uses true 2D collar distances (not axis-sorted differences)
- Z cell size is derived independently from sample length, not capped by horizontal cell size
- Variogram range criterion shows **EST.** badge when no fitted range is supplied

---

*Obsidian Consulting Services · MREC Iberico*
