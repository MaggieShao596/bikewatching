
import mapboxgl from 'https://cdn.jsdelivr.net/npm/mapbox-gl@2.15.0/+esm';
import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7/+esm';

// Mapbox Public Access Token
// Paste your existing pk. token between the quotes.
mapboxgl.accessToken = 'pk.eyJ1IjoibWFnZ2llNTk2IiwiYSI6ImNtd2cxZGdscDA3MngzMHBsNjloazl3NDgifQ.rlXtSs_4k2POW8BVHm2S1Q';

const status = document.querySelector('#status');
const slider = document.querySelector('#time-slider');
const timeLabel = document.querySelector('#selected-time');

const stationsURL =
  'https://dsc106.com/labs/lab07/data/bluebikes-stations.json';

const tripsURL =
  'https://dsc106.com/labs/lab07/data/bluebikes-traffic-2024-03.csv';

// -------------------------------
// Helper functions
// -------------------------------

function formatTime(minutes) {
  if (minutes === -1) return 'Any time';

  return new Date(
    2024, 2, 1,
    Math.floor(minutes / 60),
    minutes % 60
  ).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit'
  });
}

function minutesSinceMidnight(date) {
  return date.getHours() * 60 + date.getMinutes();
}

function withinHour(minutes, selected) {
  const distance = Math.abs(minutes - selected);
  return Math.min(distance, 1440 - distance) <= 60;
}

function filterTripsByTime(trips, selected) {
  if (selected === -1) return trips;

  return trips.filter(trip =>
    withinHour(trip.startMinutes, selected) ||
    withinHour(trip.endMinutes, selected)
  );
}

function computeStationTraffic(stations, trips) {
  const departures = d3.rollup(
    trips,
    values => values.length,
    d => d.start_station_id
  );

  const arrivals = d3.rollup(
    trips,
    values => values.length,
    d => d.end_station_id
  );

  return stations.map(station => {
    const id = station.short_name ?? station.Number;

    const incoming = arrivals.get(id) ?? 0;
    const outgoing = departures.get(id) ?? 0;

    return {
      ...station,
      arrivals: incoming,
      departures: outgoing,
      totalTraffic: incoming + outgoing
    };
  });
}

function stationCoordinates(station) {
  return [
    Number(station.lon ?? station.Long),
    Number(station.lat ?? station.Lat)
  ];
}

function trafficColor(station) {
  const proportion = station.totalTraffic
    ? station.departures / station.totalTraffic
    : 0.5;

  return d3.interpolateRgbBasis([
    '#4d9cbd',
    '#c5a3c9',
    '#ee8566'
  ])(proportion);
}

// -------------------------------
// Initialize Mapbox
// -------------------------------

if (!mapboxgl.accessToken.startsWith('pk.')) {
  status.textContent =
    'Setup needed: paste your Mapbox public token into map.js.';
} else {

  const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/light-v11',
    center: [-71.09415, 42.36027],
    zoom: 12,
    minZoom: 5,
    maxZoom: 18
  });

  map.addControl(
    new mapboxgl.NavigationControl(),
    'top-left'
  );

  map.on('error', event => {
    console.warn('Mapbox:', event.error);
  });

  map.on('load', async () => {

    // -------------------------------
    // Bike lanes
    // -------------------------------

    const laneSources = [
      [
        'boston',
        'https://bostonopendata-boston.opendata.arcgis.com/datasets/boston::existing-bike-network-2022.geojson'
      ],
      [
        'cambridge',
        'https://raw.githubusercontent.com/cambridgegis/cambridgegis_data/main/Recreation/Bike_Facilities/RECREATION_BikeFacilities.geojson'
      ]
    ];

    for (const [name, url] of laneSources) {
      map.addSource(name + '-routes', {
        type: 'geojson',
        data: url
      });

      map.addLayer({
        id: name + '-lanes',
        type: 'line',
        source: name + '-routes',
        paint: {
          'line-color': '#24a45a',
          'line-width': 3,
          'line-opacity': 0.65
        }
      });
    }

    try {

      status.textContent =
        'Loading station and trip data (21 MB; may take a moment)…';

      // -------------------------------
      // Load data
      // -------------------------------

      const [stationJSON, trips] = await Promise.all([
        d3.json(stationsURL),

        d3.csv(tripsURL, trip => ({
          ...trip,
          startMinutes: minutesSinceMidnight(
            new Date(trip.started_at)
          ),
          endMinutes: minutesSinceMidnight(
            new Date(trip.ended_at)
          )
        }))
      ]);

      const stations = stationJSON.data.stations;

      const allTraffic = computeStationTraffic(
        stations,
        trips
      );

      const maxTraffic =
        d3.max(allTraffic, d => d.totalTraffic) || 1;

      const radiusScale = d3.scaleSqrt()
        .domain([0, maxTraffic])
        .range([0, 25]);

      // -------------------------------
      // SVG station circles
      // -------------------------------

      const svg = d3.select('#map svg');

      const circles = svg
        .selectAll('circle')
        .data(
          allTraffic,
          d => d.short_name ?? d.Number
        )
        .join('circle')
        .style('cursor', 'pointer');

      // -------------------------------
      // Custom Tooltip
      // -------------------------------

      const tooltip = d3.select('body')
        .append('div')
        .attr('class', 'station-tooltip')
        .style('position', 'fixed')
        .style('background', 'white')
        .style('color', '#1e293b')
        .style('padding', '12px 16px')
        .style('border-radius', '10px')
        .style('box-shadow', '0 4px 18px rgba(0,0,0,0.22)')
        .style('font-family', 'Arial, sans-serif')
        .style('font-size', '14px')
        .style('line-height', '1.6')
        .style('pointer-events', 'none')
        .style('z-index', '9999')
        .style('display', 'none');

      circles
        .on('mouseenter', function() {
          d3.select(this)
            .attr('stroke', '#172554')
            .attr('stroke-width', 2.5);

          tooltip.style('display', 'block');
        })

        .on('mousemove', function(event, d) {
          const stationName =
            d.name ?? d.NAME ?? 'BlueBikes Station';

          tooltip
            .html(`
              <strong>${stationName}</strong>
              <div>Trips: ${d.totalTraffic.toLocaleString()}</div>
              <div>Departures: ${d.departures.toLocaleString()}</div>
              <div>Arrivals: ${d.arrivals.toLocaleString()}</div>
            `)
            .style(
              'left',
              `${Math.min(event.clientX + 15, window.innerWidth - 240)}px`
            )
            .style(
              'top',
              `${Math.min(event.clientY + 15, window.innerHeight - 130)}px`
            );
        })

        .on('mouseleave', function() {
          d3.select(this)
            .attr('stroke', null)
            .attr('stroke-width', null);

          tooltip.style('display', 'none');
        });

      // -------------------------------
      // Update station positions
      // -------------------------------

      function updatePositions() {
        circles.each(function(d) {
          const [lon, lat] = stationCoordinates(d);

          if (
            !Number.isFinite(lon) ||
            !Number.isFinite(lat)
          ) {
            return;
          }

          const point = map.project([lon, lat]);

          d3.select(this)
            .attr('cx', point.x)
            .attr('cy', point.y);
        });
      }

      // -------------------------------
      // Update traffic visualization
      // -------------------------------

      function updateScatterPlot(selected) {

        const filtered = computeStationTraffic(
          stations,
          filterTripsByTime(trips, selected)
        );

        const scale = selected === -1
          ? radiusScale
          : d3.scaleSqrt()
              .domain([
                0,
                d3.max(
                  filtered,
                  d => d.totalTraffic
                ) || 1
              ])
              .range([0, 50]);

        circles
          .data(
            filtered,
            d => d.short_name ?? d.Number
          )
          .attr(
            'r',
            d => d.totalTraffic
              ? Math.max(2, scale(d.totalTraffic))
              : 0
          )
          .attr('fill', trafficColor);

        tooltip.style('display', 'none');

        status.textContent =
          `${filtered.length} stations · ` +
          `${d3.sum(filtered, d => d.totalTraffic).toLocaleString()} ` +
          `station arrivals + departures shown · ` +
          `${selected === -1
            ? 'all day'
            : formatTime(selected) + ' ±1 hour'}`;
      }

      // -------------------------------
      // Time slider
      // -------------------------------

      let pending;

      slider.addEventListener('input', () => {

        const selected = Number(slider.value);

        timeLabel.textContent = formatTime(selected);

        cancelAnimationFrame(pending);

        pending = requestAnimationFrame(() => {
          updateScatterPlot(selected);
        });
      });

      // -------------------------------
      // Initialize visualization
      // -------------------------------

      updatePositions();

      map.on('move', updatePositions);
      map.on('resize', updatePositions);

      updateScatterPlot(-1);

    } catch (error) {

      console.error(error);

      status.textContent =
        'Unable to load bike data. Check your network and browser console.';
    }
  });
}

