import mapboxgl from 'https://cdn.jsdelivr.net/npm/mapbox-gl@2.15.0/+esm';
import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7/+esm';

// Replace this with your PUBLIC Mapbox token (starts with pk.).
mapboxgl.accessToken = 'pk.eyJ1IjoibWFnZ2llNTk2IiwiYSI6ImNtd2cxZGdscDA3MngzMHBsNjloazl3NDgifQ.rlXtSs_4k2POW8BVHm2S1Q';
const status = document.querySelector('#status');
const slider = document.querySelector('#time-slider');
const timeLabel = document.querySelector('#selected-time');
const stationsURL = 'https://dsc106.com/labs/lab07/data/bluebikes-stations.json';
const tripsURL = 'https://dsc106.com/labs/lab07/data/bluebikes-traffic-2024-03.csv';

function formatTime(minutes) {
  if (minutes === -1) return 'Any time';
  return new Date(2024, 2, 1, Math.floor(minutes / 60), minutes % 60)
    .toLocaleTimeString('en-US', {hour:'numeric',minute:'2-digit'});
}
function minutesSinceMidnight(date) {return date.getHours()*60 + date.getMinutes();}
function withinHour(minutes, selected) {
  const distance = Math.abs(minutes - selected);
  return Math.min(distance, 1440-distance) <= 60;
}
function filterTripsByTime(trips, selected) {
  if (selected === -1) return trips;
  return trips.filter(t => withinHour(t.startMinutes,selected) || withinHour(t.endMinutes,selected));
}
function computeStationTraffic(stations,trips) {
  const departures = d3.rollup(trips, v=>v.length, d=>d.start_station_id);
  const arrivals = d3.rollup(trips, v=>v.length, d=>d.end_station_id);
  return stations.map(station => {
    const id = station.short_name ?? station.Number;
    const incoming = arrivals.get(id) ?? 0;
    const outgoing = departures.get(id) ?? 0;
    return {...station, arrivals:incoming, departures:outgoing, totalTraffic:incoming+outgoing};
  });
}
function stationCoordinates(station) {
  return [Number(station.lon ?? station.Long), Number(station.lat ?? station.Lat)];
}
function trafficColor(station) {
  const proportion = station.totalTraffic ? station.departures/station.totalTraffic : .5;
  return d3.interpolateRgbBasis(['#4d9cbd','#c5a3c9','#ee8566'])(proportion);
}

if (!mapboxgl.accessToken.startsWith('pk.')) {
  status.textContent = 'Setup needed: paste your Mapbox public token into map.js before opening this page.';
} else {
  const map = new mapboxgl.Map({container:'map',style:'mapbox://styles/mapbox/light-v11',center:[-71.09415,42.36027],zoom:12,minZoom:5,maxZoom:18});
  map.addControl(new mapboxgl.NavigationControl(),'top-left');
  map.on('error', event => console.warn('Mapbox:',event.error));
  map.on('load', async () => {
    const laneSources = [
      ['boston','https://bostonopendata-boston.opendata.arcgis.com/datasets/boston::existing-bike-network-2022.geojson'],
      ['cambridge','https://raw.githubusercontent.com/cambridgegis/cambridgegis_data/main/Recreation/Bike_Facilities/RECREATION_BikeFacilities.geojson']
    ];
    for (const [name,url] of laneSources) {
      map.addSource(name+'-routes',{type:'geojson',data:url});
      map.addLayer({id:name+'-lanes',type:'line',source:name+'-routes',paint:{'line-color':'#24a45a','line-width':3,'line-opacity':.65}});
    }
    try {
      status.textContent = 'Loading station and trip data (21 MB; may take a moment)…';
      const [stationJSON,trips] = await Promise.all([
        d3.json(stationsURL),
        d3.csv(tripsURL, trip => ({...trip,
          startMinutes:minutesSinceMidnight(new Date(trip.started_at)),
          endMinutes:minutesSinceMidnight(new Date(trip.ended_at))}))
      ]);
      const stations = stationJSON.data.stations;
      const allTraffic = computeStationTraffic(stations,trips);
      const maxTraffic = d3.max(allTraffic,d=>d.totalTraffic) || 1;
      const radiusScale = d3.scaleSqrt().domain([0,maxTraffic]).range([0,25]);
      const svg = d3.select('#map svg');
      const circles = svg.selectAll('circle').data(allTraffic,d=>d.short_name ?? d.Number).join('circle');
      circles.append('title');
      function updatePositions(){
        circles.each(function(d){
          const [lon,lat] = stationCoordinates(d);
          if (!Number.isFinite(lon)||!Number.isFinite(lat)) return;
          const p=map.project([lon,lat]);
          d3.select(this).attr('cx',p.x).attr('cy',p.y);
        });
      }
      function updateScatterPlot(selected) {
        const filtered = computeStationTraffic(stations,filterTripsByTime(trips,selected));
        const scale = selected===-1 ? radiusScale : d3.scaleSqrt().domain([0,d3.max(filtered,d=>d.totalTraffic)||1]).range([0,50]);
        circles.data(filtered,d=>d.short_name ?? d.Number)
          .attr('r',d=>d.totalTraffic ? Math.max(2,scale(d.totalTraffic)) : 0)
          .attr('fill',trafficColor)
          .select('title').text(d=>`${d.name ?? d.NAME ?? 'Bluebikes station'}\n${d.totalTraffic.toLocaleString()} trips\n${d.departures.toLocaleString()} departures · ${d.arrivals.toLocaleString()} arrivals`);
        status.textContent = `${filtered.length} stations · ${d3.sum(filtered,d=>d.totalTraffic).toLocaleString()} station arrivals + departures shown · ${selected===-1?'all day':formatTime(selected)+' ±1 hour'}`;
      }
      let pending;
      slider.addEventListener('input',()=>{
        const selected=Number(slider.value);
        timeLabel.textContent=formatTime(selected);
        cancelAnimationFrame(pending);
        pending=requestAnimationFrame(()=>updateScatterPlot(selected));
      });
      updatePositions();
      map.on('move',updatePositions);
      map.on('resize',updatePositions);
      updateScatterPlot(-1);
    } catch(error) {
      console.error(error);
      status.textContent='Unable to load bike data. Check your network and browser console.';
    }
  });
}
