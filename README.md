# Bikewatching — DSC 106 Lab 7

Interactive Boston/Cambridge Bluebikes traffic visualization using Mapbox GL JS, D3, SVG, and the course-provided March 2024 datasets.

## Setup
1. Create a free Mapbox account at https://account.mapbox.com/ and copy your **public** token (starts `pk.`).
2. Open `map.js` and replace `YOUR_MAPBOX_PUBLIC_ACCESS_TOKEN` with your token.
3. Open the folder in VS Code and use Live Server, or run `python3 -m http.server 8000` in this folder and visit http://localhost:8000.
4. Create a new GitHub repository, upload all files preserving the `assets/` folder, then enable Settings → Pages → Deploy from branch → main / root.
5. Open your existing personal website's `projects.html` and add a link to your published new project.

## Features
- Mapbox pan and zoom
- Boston and Cambridge bike lane layers
- SVG station markers positioned using `map.project()`
- D3 square-root scaling of traffic volume
- Hover tooltips for trips, arrivals and departures
- Time slider filtering trips within ±60 minutes, including midnight wraparound
- Arrival/departure diverging color scale and legend

## Recording
Record a <=60-second MP4 showing the map, panning/zooming, station tooltips, time slider, color legend, and one thing learned.

## Notes
Data files are loaded remotely from dsc106.com, so internet access is required. Mapbox public token is needed for map rendering. No GitHub upload or live-browser test is performed by this package.
