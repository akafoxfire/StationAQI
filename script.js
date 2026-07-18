/* ============================================================
   STATION/AQI — script.js
   Live air quality dashboard powered by the WAQI API
   (https://aqicn.org/api/)
   ============================================================ */

const CONFIG = {
  // Get a free token instantly at https://aqicn.org/data-platform/token/
  token: "03e5e431e2eae1cedf7c568cad6ad9b26e99ab48",
  savedCitiesKey: "aqi_saved_stations",
};

/* ------------------------------------------------------------
   AQI SCALE — US EPA / WHO breakpoints used by WAQI
   Each zone also carries a plain-language line and a mascot mood,
   so someone who's never seen an AQI number before still gets it.
   ------------------------------------------------------------ */
const AQI_SCALE = [
  { max: 50,  key: "good",           label: "Good",                          range: "0–50",    color: "var(--aqi-good)",
    advisory: "Air quality is satisfactory. Good day for outdoor activity.",
    plain: "Hawa saaf hai — bina fikar ke bahar ja sakte ho.",
    guide: "Saans lene layak, bilkul theek hawa." },
  { max: 100, key: "moderate",       label: "Moderate",                      range: "51–100",  color: "var(--aqi-moderate)",
    advisory: "Acceptable air quality. Unusually sensitive people should consider limiting prolonged outdoor exertion.",
    plain: "Hawa thodi si aisi-waisi hai, par zyada chinta wali baat nahi.",
    guide: "Zyadatar logo ke liye theek, sensitive logo ko thoda dhyaan rakhna chahiye." },
  { max: 150, key: "sensitive",      label: "Unhealthy for Sensitive Groups", range: "101–150", color: "var(--aqi-sensitive)",
    advisory: "Children, elderly, and people with respiratory issues should reduce prolonged outdoor exertion. A mask helps.",
    plain: "Bachon, budhon aur asthma waalon ko thoda sambhal ke rehna chahiye.",
    guide: "Kamzor logo (bachhe, budhe, saans ke mareez) ke liye takleef de sakti hai." },
  { max: 200, key: "unhealthy",      label: "Unhealthy",                     range: "151–200", color: "var(--aqi-unhealthy)",
    advisory: "Everyone may begin to feel effects. Wear a mask outdoors and avoid heavy exertion.",
    plain: "Hawa kharab hai — bahar nikle toh mask laga lo.",
    guide: "Sabko thodi bahut takleef mehsoos ho sakti hai." },
  { max: 300, key: "very-unhealthy", label: "Very Unhealthy",                range: "201–300", color: "var(--aqi-very-unhealthy)",
    advisory: "Health alert. Avoid outdoor activity — keep windows shut and run an air purifier if you have one.",
    plain: "Kaafi kharab hawa — jitna ho sake ghar ke andar raho.",
    guide: "Health alert — outdoor activity avoid karo, khidki band rakho." },
  { max: 999, key: "hazardous",      label: "Hazardous",                     range: "300+",    color: "var(--aqi-hazardous)",
    advisory: "Emergency conditions. Stay indoors, seal windows, and avoid all outdoor exertion.",
    plain: "Emergency level — bilkul bahar mat niklo.",
    guide: "Emergency — sabke liye khatarnak, ghar se bahar bilkul mat niklo." },
];

function getAqiZone(value) {
  return AQI_SCALE.find(z => value <= z.max) || AQI_SCALE[AQI_SCALE.length - 1];
}

/* ------------------------------------------------------------
   POLLUTANT INFO — plain-language, one line each
   ------------------------------------------------------------ */
const POLLUTANT_INFO = {
  pm25: { label: "PM2.5", unit: "µg/m³", plain: "Bahut chhote dhool ke particle — seedha phephdo tak pahunch jaate hain." },
  pm10: { label: "PM10",  unit: "µg/m³", plain: "Thode bade dust particles — mitti, dhuan, pollen." },
  o3:   { label: "Ozone (O₃)", unit: "µg/m³", plain: "Dhoop aur pollution mil kar banate hain — saans ki nali ko irritate karta hai." },
  no2:  { label: "NO₂", unit: "µg/m³", plain: "Gaadiyon aur factory ka dhuan — saans lene mein dikkat karta hai." },
  so2:  { label: "SO₂", unit: "µg/m³", plain: "Coal/fuel jalne se banti hai — gala aur aankhein irritate karti hai." },
  co:   { label: "CO", unit: "mg/m³", plain: "Rangheen gas, gaadiyon se — khoon mein oxygen kam kar deti hai." },
  t:    { label: "Temperature", unit: "°C", plain: "Abhi ka tapmaan." },
  h:    { label: "Humidity", unit: "%", plain: "Hawa mein nami kitni hai." },
};

/* ------------------------------------------------------------
   DOM refs
   ------------------------------------------------------------ */
const els = {
  heroPanel: document.getElementById("heroPanel"),
  searchForm: document.getElementById("searchForm"),
  cityInput: document.getElementById("cityInput"),
  geoBtn: document.getElementById("geoBtn"),
  statusLine: document.getElementById("statusLine"),

  heroEmpty: document.getElementById("heroEmpty"),
  heroContent: document.getElementById("heroContent"),
  gaugeNeedle: document.getElementById("gaugeNeedle"),
  gaugeValue: document.getElementById("gaugeValue"),
  gaugeLabel: document.getElementById("gaugeLabel"),
  stationEyebrow: document.getElementById("stationEyebrow"),
  stationName: document.getElementById("stationName"),
  stationMeta: document.getElementById("stationMeta"),
  stationSuggestions: document.getElementById("stationSuggestions"),
  advisoryText: document.getElementById("advisoryText"),
  saveBtn: document.getElementById("saveBtn"),

  mascotBody: document.getElementById("mascotBody"),
  mascotPuff1: document.getElementById("mascotPuff1"),
  mascotPuff2: document.getElementById("mascotPuff2"),
  mascotPuff3: document.getElementById("mascotPuff3"),
  mascotMouth: document.getElementById("mascotMouth"),
  eyeL: document.getElementById("eyeL"),
  eyeR: document.getElementById("eyeR"),
  plainSummary: document.getElementById("plainSummary"),

  aqiScaleLegend: document.getElementById("aqiScaleLegend"),

  indiaStationDots: document.getElementById("indiaStationDots"),
  mapStatus: document.getElementById("mapStatus"),

  pollutantSection: document.getElementById("pollutantSection"),
  pollutantGrid: document.getElementById("pollutantGrid"),

  trendSection: document.getElementById("trendSection"),
  trendCanvas: document.getElementById("trendChart"),

  savedGrid: document.getElementById("savedGrid"),
  savedEmpty: document.getElementById("savedEmpty"),

  gaugeZones: document.getElementById("gaugeZones"),
  gaugeTicks: document.getElementById("gaugeTicks"),
};

let currentStation = null; // holds the last successfully loaded feed
let trendChartInstance = null;

/* ------------------------------------------------------------
   INIT
   ------------------------------------------------------------ */
function init() {
  drawGaugeStatic();
  renderSavedStations();
  renderAqiGuide();
  loadIndiaMap();

  els.searchForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const city = els.cityInput.value.trim();
    if (city) loadCity(city);
  });

  els.geoBtn.addEventListener("click", useMyLocation);
  els.saveBtn.addEventListener("click", saveCurrentStation);
}

/* ------------------------------------------------------------
   STATUS LINE HELPERS
   ------------------------------------------------------------ */
function setStatus(msg, isError = false) {
  els.statusLine.textContent = msg;
  els.statusLine.classList.toggle("is-error", isError);
}

/* ------------------------------------------------------------
   API CALLS
   ------------------------------------------------------------ */
async function fetchFeed(query) {
  // query is either a city name, "geo:lat;lon", or "@uid"
  const url = `https://api.waqi.info/feed/${encodeURIComponent(query)}/?token=${CONFIG.token}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Network error contacting WAQI.");
  const json = await res.json();
  if (json.status !== "ok") {
    throw new Error(json.data || "Station not found.");
  }
  return json.data;
}

async function searchStations(keyword) {
  // Fuzzy search across WAQI's whole station network — catches small towns
  // that /feed/{name} won't match directly.
  const url = `https://api.waqi.info/search/?token=${CONFIG.token}&keyword=${encodeURIComponent(keyword)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Network error contacting WAQI.");
  const json = await res.json();
  if (json.status !== "ok") return [];
  return json.data || [];
}

/* ------------------------------------------------------------
   HAVERSINE DISTANCE (km) — so we can be honest about how far
   a fallback station actually is from the user.
   ------------------------------------------------------------ */
function distanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/* ------------------------------------------------------------
   RELEVANCE CHECK — WAQI's fuzzy search occasionally returns a
   completely unrelated station (e.g. searching "Sikar" returning
   a station in the US). Only trust a match if the searched word
   actually appears in the station's own name.
   ------------------------------------------------------------ */
function isRelevantMatch(match, keyword) {
  const name = (match.station?.name || "").toLowerCase();
  const kw = keyword.trim().toLowerCase();
  if (!kw) return false;
  return name.includes(kw);
}

/* ------------------------------------------------------------
   LOAD BY CITY NAME — search first (fuzzy, but relevance-checked),
   fall back to direct feed, then point to the India map.
   ------------------------------------------------------------ */
async function loadCity(cityQuery) {
  setStatus(`"${cityQuery}" ke liye station dhoond rahe hain …`);
  els.stationSuggestions.hidden = true;
  els.stationSuggestions.innerHTML = "";

  try {
    const allMatches = await searchStations(cityQuery).catch(() => []);
    const matches = allMatches.filter(m => isRelevantMatch(m, cityQuery));

    if (matches.length) {
      const best = matches[0];
      const data = await fetchFeed(`@${best.uid}`);
      renderStation(data);
      if (matches.length > 1) renderSuggestions(matches, cityQuery);
      setStatus(`Live — updated ${formatTime(data.time?.iso)}`);
      return;
    }

    // fall back to a direct name lookup, in case search missed an exact slug
    const data = await fetchFeed(cityQuery);
    renderStation(data);
    setStatus(`Live — updated ${formatTime(data.time?.iso)}`);
  } catch (err) {
    setStatus(
      `"${cityQuery}" ke liye koi monitoring station nahi mila. WAQI ka network chhote shehron mein sparse hai — neeche India ke map par dekho kaunsa station tumhare paas available hai.`,
      true
    );
    document.getElementById("indiaMapSection")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

/* ------------------------------------------------------------
   LOAD BY GEOLOCATION — honest about distance to nearest station
   ------------------------------------------------------------ */
async function loadGeo(lat, lon) {
  setStatus("Aapke sabse nazdeek station dhoond rahe hain …");
  try {
    const data = await fetchFeed(`geo:${lat};${lon}`);
    renderStation(data);

    const stationGeo = data.city?.geo;
    if (stationGeo && stationGeo.length === 2) {
      const km = distanceKm(lat, lon, stationGeo[0], stationGeo[1]);
      if (km > 25) {
        // The station is far — this is almost certainly why a small town
        // shows a big city's reading. Say so, plainly.
        els.stationMeta.textContent =
          `${formatTime(data.time?.iso)} · Ye aapke exact location ka station nahi hai — sabse nazdeek monitor ${Math.round(km)} km door hai. Aapke area mein shayad koi AQI monitor nahi lagi hai.`;
      } else {
        els.stationMeta.textContent = `Updated ${formatTime(data.time?.iso)} · ~${Math.round(km)} km aapse · Source: WAQI network`;
      }
    }
    setStatus(`Live — updated ${formatTime(data.time?.iso)}`);
  } catch (err) {
    setStatus(err.message || "Aapke location ke paas koi station nahi mila.", true);
  }
}

function useMyLocation() {
  if (!navigator.geolocation) {
    setStatus("Geolocation isn't supported in this browser.", true);
    return;
  }
  setStatus("Location maang rahe hain …");
  navigator.geolocation.getCurrentPosition(
    (pos) => loadGeo(pos.coords.latitude, pos.coords.longitude),
    () => setStatus("Location permission denied.", true)
  );
}

/* ------------------------------------------------------------
   INDIA POLYGON — same simplified Survey-of-India boundary used
   for the outline path, as [lon, lat] pairs. Used to filter out
   any station that isn't actually inside India (the WAQI bounds
   query is a rectangle, so it also picks up Nepal/Bhutan/
   Bangladesh/Myanmar/China stations near the border — this
   polygon check removes those).
   ------------------------------------------------------------ */
const INDIA_POLYGON = [[84.769,19.08],[84.118,18.301],[82.306,17.03],[82.313,16.555],[81.313,16.36],[81.007,15.763],[80.498,15.857],[80.135,15.557],[80.346,13.293],[79.767,11.744],[79.879,10.287],[79.299,10.264],[78.895,9.479],[79.188,9.281],[78.213,9.048],[78.067,8.371],[77.31,8.126],[76.55,8.898],[75.823,11.168],[74.828,12.831],[74.43,14.625],[74.095,14.797],[74.25,14.875],[73.914,15.084],[73.784,15.411],[73.922,15.404],[73.936,15.436],[73.459,16.057],[72.643,19.851],[72.886,20.571],[72.608,21.583],[72.835,21.668],[72.538,21.664],[72.505,21.981],[72.592,22.208],[72.754,22.173],[72.809,22.246],[72.878,22.224],[72.91,22.243],[72.916,22.278],[72.486,22.197],[72.493,22.248],[72.471,22.239],[72.435,22.301],[72.389,22.31],[72.412,22.358],[72.394,22.383],[72.362,22.376],[72.114,21.197],[70.822,20.691],[70.1,21.105],[68.936,22.308],[70.163,22.552],[70.493,23.075],[69.446,22.778],[69.191,22.841],[68.653,23.155],[68.484,23.548],[68.806,24.313],[70.016,24.17],[71.115,24.399],[70.658,25.706],[70.099,25.935],[70.173,26.551],[69.506,26.753],[69.584,27.173],[70.374,28.012],[70.883,27.708],[71.899,27.963],[72.389,28.769],[72.947,29.03],[73.4,29.941],[73.967,30.187],[73.935,30.489],[74.695,31.073],[74.517,31.14],[74.613,31.887],[75.378,32.235],[74.685,32.482],[74.701,32.835],[74.371,32.759],[73.628,33.09],[73.391,34.377],[74.135,35.11],[73.716,35.226],[73.785,35.526],[73.1,35.878],[72.534,35.917],[73.085,36.7],[75.333,37.055],[75.769,36.573],[76.644,36.184],[76.812,35.845],[77.358,35.718],[77.382,35.477],[77.983,35.456],[77.952,35.607],[79.378,35.995],[80.292,35.607],[80.069,34.715],[79.509,34.474],[79.427,34.017],[78.906,33.976],[79.107,33.617],[78.917,33.632],[78.954,33.381],[79.453,33.26],[79.332,33.012],[79.627,32.738],[78.985,32.338],[78.769,32.697],[78.46,32.58],[78.456,32.242],[78.788,31.995],[78.895,31.266],[79.145,31.434],[79.428,31.032],[81.034,30.247],[80.374,29.749],[80.07,28.829],[81.891,27.858],[82.714,27.728],[82.742,27.501],[83.312,27.329],[84.154,27.519],[85.213,26.758],[85.637,26.872],[85.852,26.568],[88.02,26.353],[88.143,27.962],[88.841,28.011],[88.929,27.326],[88.758,27.143],[89.137,26.808],[92.059,26.847],[92.125,27.287],[91.652,27.484],[91.549,27.855],[92.565,27.82],[93.342,28.64],[93.931,28.671],[94.634,29.348],[95.452,29.034],[96.092,29.46],[96.397,29.253],[96.17,28.902],[96.529,29.075],[96.619,28.774],[96.266,28.408],[97.401,28.192],[97.389,27.887],[96.897,27.612],[97.145,27.092],[96.712,27.372],[96.234,27.277],[95.154,26.613],[95.184,26.073],[94.643,25.395],[94.717,24.935],[94.159,23.847],[93.345,24.109],[93.391,23.135],[93.131,23.044],[93.206,22.258],[92.908,21.944],[92.716,22.151],[92.61,21.979],[92.282,23.715],[91.956,23.728],[91.622,22.944],[91.163,23.601],[91.382,24.105],[91.907,24.137],[92.172,24.422],[92.438,25.032],[89.838,25.295],[89.696,26.222],[89.581,25.968],[89.358,26.011],[89.091,26.4],[88.676,26.265],[88.403,26.625],[88.528,26.357],[88.183,26.147],[88.114,25.796],[89.013,25.267],[88.444,25.209],[88.014,24.664],[88.74,24.275],[88.565,23.644],[88.802,23.497],[88.724,23.255],[88.998,23.215],[88.957,22.61],[88.853,22.433],[88.766,22.561],[88.672,22.549],[88.954,22.225],[88.666,22.339],[88.607,21.913],[88.376,21.97],[88.266,21.73],[88.203,22.167],[87.985,22.246],[87.946,22.406],[87.883,22.441],[87.94,22.26],[88.189,22.099],[86.951,21.358],[86.974,20.793],[86.88,20.808],[86.794,20.745],[87.057,20.715],[86.784,20.326],[84.769,19.08]];

// ray-casting point-in-polygon test
function isInsideIndia(lon, lat) {
  let inside = false;
  for (let i = 0, j = INDIA_POLYGON.length - 1; i < INDIA_POLYGON.length; j = i++) {
    const [xi, yi] = INDIA_POLYGON[i];
    const [xj, yj] = INDIA_POLYGON[j];
    const intersect = (yi > lat) !== (yj > lat) &&
      lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

// curated major cities to guarantee real coverage beyond whatever the
// bounds query happens to return (Delhi-NCR tends to dominate it)
const MAJOR_INDIAN_CITIES = [
  "Delhi", "Mumbai", "Bengaluru", "Chennai", "Kolkata", "Hyderabad", "Pune",
  "Ahmedabad", "Jaipur", "Lucknow", "Patna", "Chandigarh", "Guwahati",
  "Bhopal", "Kanpur", "Nagpur", "Indore", "Kochi", "Coimbatore",
  "Visakhapatnam", "Amritsar", "Varanasi", "Dehradun", "Srinagar",
  "Jodhpur", "Udaipur", "Surat", "Vadodara", "Ranchi", "Raipur",
  "Bhubaneswar", "Gurugram", "Noida", "Agra", "Meerut", "Shimla",
];

/* ------------------------------------------------------------
   INDIA STATIONS MAP — every real WAQI station inside India's
   bounding box, plotted so you can SEE what's actually covered
   instead of guessing city names.
   ------------------------------------------------------------ */
async function loadIndiaMap() {
  try {
    // 1) broad rectangular sweep (fast, but also catches Nepal/Bhutan/
    //    Bangladesh/Myanmar/China border stations — filtered out below)
    const url = `https://api.waqi.info/map/bounds/?latlng=6,68,37,98&token=${CONFIG.token}`;
    const boundsRes = await fetch(url);
    const boundsJson = await boundsRes.json();
    const boundsStations = boundsJson.status === "ok" ? (boundsJson.data || []) : [];

    // 2) curated major-city fetches, run in parallel, so real coverage
    //    doesn't depend entirely on what the rectangle sweep returns
    const cityResults = await Promise.allSettled(
      MAJOR_INDIAN_CITIES.map(city => fetchFeed(city))
    );
    const cityStations = cityResults
      .filter(r => r.status === "fulfilled")
      .map(r => ({
        lat: r.value.city?.geo?.[0],
        lon: r.value.city?.geo?.[1],
        aqi: r.value.aqi,
        uid: r.value.idx,
        station: { name: r.value.city?.name },
      }));

    // merge + dedupe by uid, then keep only points that are actually
    // inside India's real boundary
    const byUid = new Map();
    [...boundsStations, ...cityStations].forEach(s => {
      if (s.lat && s.lon && s.uid != null) byUid.set(s.uid, s);
    });

    const indiaOnly = [...byUid.values()].filter(s => isInsideIndia(s.lon, s.lat));
    renderIndiaMap(indiaOnly);
  } catch (err) {
    if (els.mapStatus) els.mapStatus.textContent = "Stations load nahi ho paaye — thodi der baad try karo.";
  }
}

function projectLatLon(lat, lon) {
  // Equirectangular projection (centered on mean latitude 23°N) matching
  // the official Survey-of-India boundary path, so live station dots land
  // in the right place relative to the real coastline.
  const lonMin = 68.0, latMax = 38.0, scale = 14.0;
  const cosMean = Math.cos((23.0 * Math.PI) / 180);
  const x = (lon - lonMin) * scale * cosMean;
  const y = (latMax - lat) * scale;
  return { x, y };
}

function renderIndiaMap(stations) {
  if (!els.indiaStationDots) return;
  els.indiaStationDots.innerHTML = "";

  if (!stations.length) {
    els.mapStatus.textContent = "Abhi koi station data nahi mil raha.";
    return;
  }

  els.mapStatus.textContent = `${stations.length} live stations — kisi bhi dot par click karo.`;

  stations.forEach(s => {
    const { x, y } = projectLatLon(s.lat, s.lon);
    if (x < -10 || x > 397 || y < -10 || y > 430) return;

    const aqi = Number(s.aqi);
    const zone = getAqiZone(isNaN(aqi) ? 0 : aqi);
    const name = s.station?.name?.split(",")[0] || "Station";

    const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    dot.setAttribute("cx", x);
    dot.setAttribute("cy", y);
    dot.setAttribute("r", 4.5);
    dot.setAttribute("class", "station-dot");
    dot.style.fill = zone.color;
    dot.addEventListener("click", () => loadCityByUid(s.uid, name));

    const title = document.createElementNS("http://www.w3.org/2000/svg", "title");
    title.textContent = `${name} — AQI ${isNaN(aqi) ? "—" : aqi} (${zone.label})`;
    dot.appendChild(title);

    els.indiaStationDots.appendChild(dot);
  });
}

/* ------------------------------------------------------------
   SUGGESTIONS — other nearby matches from the search endpoint
   ------------------------------------------------------------ */
function renderSuggestions(matches, keyword) {
  const others = matches.slice(1, 5);
  if (!others.length) return;

  els.stationSuggestions.innerHTML = `<span class="suggestions-label">Aur nazdeek stations:</span>`;
  others.forEach(m => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "suggestion-chip";
    btn.textContent = m.station?.name?.split(",")[0] || "Station";
    btn.addEventListener("click", () => loadCityByUid(m.uid, btn.textContent));
    els.stationSuggestions.appendChild(btn);
  });
  els.stationSuggestions.hidden = false;
}

async function loadCityByUid(uid, label) {
  setStatus(`Reading ${label} …`);
  try {
    const data = await fetchFeed(`@${uid}`);
    renderStation(data);
    setStatus(`Live — updated ${formatTime(data.time?.iso)}`);
  } catch (err) {
    setStatus(err.message || "Could not load that station.", true);
  }
}

/* ------------------------------------------------------------
   RENDER: STATION (hero + mascot + pollutants + trend)
   ------------------------------------------------------------ */
function renderStation(data) {
  currentStation = data;

  els.heroEmpty.hidden = true;
  els.heroContent.hidden = false;
  els.pollutantSection.hidden = false;
  els.stationSuggestions.hidden = true;
  els.stationSuggestions.innerHTML = "";

  const aqi = Number(data.aqi);
  const zone = getAqiZone(isNaN(aqi) ? 0 : aqi);

  setGaugeNeedle(aqi);
  els.gaugeValue.textContent = isNaN(aqi) ? "—" : aqi;
  els.gaugeLabel.textContent = zone.label;
  els.gaugeLabel.style.color = zone.color;
  els.gaugeLabel.style.borderColor = zone.color;
  els.heroPanel.style.setProperty("--zone-glow", zone.color);

  els.stationEyebrow.textContent = "Station reading";
  els.stationName.textContent = data.city?.name || "Unknown station";
  els.stationMeta.textContent = `Updated ${formatTime(data.time?.iso)} · Source: WAQI network`;
  els.advisoryText.textContent = zone.advisory;
  els.advisoryText.style.borderLeftColor = zone.color;

  els.plainSummary.textContent = zone.plain;
  setMascotMood(zone);

  renderPollutants(data.iaqi || {});
  renderTrend(data.forecast?.daily);
}

/* ------------------------------------------------------------
   MASCOT — a friendly cloud whose face reacts to the AQI zone
   ------------------------------------------------------------ */
function setMascotMood(zone) {
  const rawColor = getComputedStyle(document.documentElement)
    .getPropertyValue(zone.color.replace("var(", "").replace(")", ""))
    .trim() || "#2E90FA";

  [els.mascotBody, els.mascotPuff1, els.mascotPuff2, els.mascotPuff3].forEach(el => {
    if (el) el.style.fill = rawColor;
  });

  const mouths = {
    good: "M40 60 Q50 72 60 60",
    moderate: "M40 63 Q50 68 60 63",
    sensitive: "M40 65 L60 65",
    unhealthy: "M40 68 Q50 60 60 68",
    "very-unhealthy": "M40 70 Q50 58 60 70",
    hazardous: "M38 70 Q50 56 62 70",
  };
  if (els.mascotMouth) els.mascotMouth.setAttribute("d", mouths[zone.key] || mouths.good);

  const eyeShrink = zone.key === "hazardous" || zone.key === "very-unhealthy";
  [els.eyeL, els.eyeR].forEach(el => {
    if (el) el.setAttribute("r", eyeShrink ? 2.5 : 4);
  });
}

/* ------------------------------------------------------------
   AQI 101 GUIDE — plain-language legend, built once
   ------------------------------------------------------------ */
function renderAqiGuide() {
  els.aqiScaleLegend.innerHTML = "";
  AQI_SCALE.forEach(zone => {
    const row = document.createElement("div");
    row.className = "guide-row";
    row.innerHTML = `
      <span class="guide-chip" style="background:${zone.color}"></span>
      <div class="guide-text">
        <p class="guide-label">${zone.label} <span class="guide-range">(${zone.range})</span></p>
        <p class="guide-plain">${zone.guide}</p>
      </div>
    `;
    els.aqiScaleLegend.appendChild(row);
  });
}

/* ------------------------------------------------------------
   POLLUTANTS — with plain-language one-liners
   ------------------------------------------------------------ */
function renderPollutants(iaqi) {
  els.pollutantGrid.innerHTML = "";
  let any = false;

  Object.keys(POLLUTANT_INFO).forEach(key => {
    if (!iaqi[key]) return;
    any = true;
    const info = POLLUTANT_INFO[key];
    const val = iaqi[key].v;
    const pct = Math.min(100, (val / 300) * 100); // rough visual scale
    const zone = getAqiZone(key === "pm25" || key === "pm10" ? val : 0);

    const card = document.createElement("div");
    card.className = "pollutant-card";
    card.innerHTML = `
      <p class="pollutant-name">${info.label}</p>
      <p class="pollutant-value">${val}<span> ${info.unit}</span></p>
      <div class="pollutant-bar"><div class="pollutant-bar-fill" style="width:${pct}%; background:${zone.color}"></div></div>
      <p class="pollutant-plain">${info.plain}</p>
    `;
    els.pollutantGrid.appendChild(card);
  });

  els.pollutantSection.hidden = !any;
}

/* ------------------------------------------------------------
   TREND CHART
   ------------------------------------------------------------ */
function renderTrend(daily) {
  if (!daily?.pm25?.length || typeof Chart === "undefined") {
    els.trendSection.hidden = true;
    return;
  }
  els.trendSection.hidden = false;

  const points = daily.pm25;
  const labels = points.map(p => p.day);
  const avgs = points.map(p => p.avg);

  if (trendChartInstance) trendChartInstance.destroy();

  const ctx = els.trendCanvas.getContext("2d");
  trendChartInstance = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [{
        label: "PM2.5 (avg)",
        data: avgs,
        borderColor: "#2E90FA",
        backgroundColor: "rgba(46,144,250,0.12)",
        fill: true,
        tension: 0.35,
        pointRadius: 3,
        pointBackgroundColor: "#2E90FA",
      }],
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: "#E3EBF3" }, ticks: { color: "#5C7186", font: { family: "IBM Plex Mono", size: 10 } } },
        y: { grid: { color: "#E3EBF3" }, ticks: { color: "#5C7186", font: { family: "IBM Plex Mono", size: 10 } } },
      },
    },
  });
}

/* ------------------------------------------------------------
   GAUGE (SVG semi-circle instrument)
   ------------------------------------------------------------ */
function polarToCartesian(cx, cy, r, angleDeg) {
  const rad = ((angleDeg - 180) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(cx, cy, r, startAngle, endAngle) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArc = endAngle - startAngle <= 180 ? 0 : 1;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`;
}

function drawGaugeStatic() {
  const cx = 150, cy = 150, r = 105;
  const zonesGroup = els.gaugeZones;
  const ticksGroup = els.gaugeTicks;
  zonesGroup.innerHTML = "";
  ticksGroup.innerHTML = "";

  const bounds = [0, 50, 100, 150, 200, 300, 500];
  const colors = [
    "var(--aqi-good)", "var(--aqi-moderate)", "var(--aqi-sensitive)",
    "var(--aqi-unhealthy)", "var(--aqi-very-unhealthy)", "var(--aqi-hazardous)"
  ];

  for (let i = 0; i < colors.length; i++) {
    const a1 = (bounds[i] / 500) * 180;
    const a2 = (bounds[i + 1] / 500) * 180;
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", arcPath(cx, cy, r, a1, a2));
    path.setAttribute("class", "zone-arc");
    path.setAttribute("stroke", colors[i]);
    path.setAttribute("stroke-width", "18");
    zonesGroup.appendChild(path);
  }

  for (let v = 0; v <= 500; v += 50) {
    const angle = (v / 500) * 180;
    const p1 = polarToCartesian(cx, cy, r - 9, angle);
    const p2 = polarToCartesian(cx, cy, r + 9, angle);
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", p1.x); line.setAttribute("y1", p1.y);
    line.setAttribute("x2", p2.x); line.setAttribute("y2", p2.y);
    line.setAttribute("class", "tick-line");
    ticksGroup.appendChild(line);
  }
}

function setGaugeNeedle(aqiValue) {
  const clamped = Math.max(0, Math.min(500, isNaN(aqiValue) ? 0 : aqiValue));
  const angle = (clamped / 500) * 180;
  const rotateDeg = angle - 90;
  els.gaugeNeedle.setAttribute("transform", `rotate(${rotateDeg} 150 150)`);
}

/* ------------------------------------------------------------
   SAVED STATIONS (localStorage)
   ------------------------------------------------------------ */
function getSavedStations() {
  try {
    return JSON.parse(localStorage.getItem(CONFIG.savedCitiesKey)) || [];
  } catch {
    return [];
  }
}

function setSavedStations(list) {
  localStorage.setItem(CONFIG.savedCitiesKey, JSON.stringify(list));
}

function saveCurrentStation() {
  if (!currentStation) return;
  const list = getSavedStations();
  const name = currentStation.city?.name || "Unknown";
  const query = currentStation.idx ? `@${currentStation.idx}` : (currentStation.city?.geo
    ? `geo:${currentStation.city.geo[0]};${currentStation.city.geo[1]}`
    : name);

  if (list.some(s => s.name === name)) {
    setStatus(`${name} pehle se saved hai.`);
    return;
  }
  list.push({ name, query, aqi: currentStation.aqi });
  setSavedStations(list);
  renderSavedStations();
  setStatus(`Saved ${name}.`);
}

function removeSavedStation(name, e) {
  e.stopPropagation();
  const list = getSavedStations().filter(s => s.name !== name);
  setSavedStations(list);
  renderSavedStations();
}

function renderSavedStations() {
  const list = getSavedStations();
  els.savedGrid.innerHTML = "";

  if (!list.length) {
    els.savedGrid.appendChild(els.savedEmpty);
    return;
  }

  list.forEach(s => {
    const zone = getAqiZone(Number(s.aqi) || 0);
    const card = document.createElement("div");
    card.className = "saved-card";
    card.innerHTML = `
      <div>
        <p class="saved-card-name">${s.name}</p>
        <p class="saved-card-meta">Tap to refresh reading</p>
      </div>
      <div style="display:flex; flex-direction:column; align-items:flex-end; gap:8px;">
        <span class="saved-card-badge" style="color:${zone.color}; border:1px solid ${zone.color}">${s.aqi ?? "—"}</span>
        <button type="button" class="btn-danger" title="Remove">✕</button>
      </div>
    `;
    card.addEventListener("click", () => loadCity(s.query));
    card.querySelector(".btn-danger").addEventListener("click", (e) => removeSavedStation(s.name, e));
    els.savedGrid.appendChild(card);
  });
}

/* ------------------------------------------------------------
   UTIL
   ------------------------------------------------------------ */
function formatTime(iso) {
  if (!iso) return "just now";
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" });
  } catch {
    return iso;
  }
}

init();
