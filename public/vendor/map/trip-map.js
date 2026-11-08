/*
 * TripMap - shared editorial roadbook map (MapLibre GL + self-hosted PMTiles). No build step.
 * Load maplibre-gl.js and pmtiles.js first, then this file, then call:
 *
 *   const tm = TripMap.create({
 *     container: '#map',                       // element or selector
 *     base: 'map/base.pmtiles',                // Protomaps (v4 schema) extract, relative to the page
 *     terrain: 'map/terrain.pmtiles',          // Mapterhorn terrarium-512 extract (optional)
 *     landcover: 'map/landcover.pmtiles',      // coloured ESA WorldCover raster from scripts/build-landcover.py (optional)
 *     reliefTint: false,                       // true: warm hypsometric tint from the terrain source, fades out above z10
 *     reliefRange: [0, 1800],                  // metres mapped to the tint ramp (per trip)
 *     landcoverFullZoom: 9,                    // highest zoom at which the landcover file covers the whole view (see the landcover-lo source); omit when no tier is narrower
 *     maxBounds: [w, s, e, n],                 // the wide base/landcover tier; keeps every view inside the built data
 *     routes: 'map/routes.geojson',            // url or FeatureCollection; properties {id,label,color}
 *     points: [{ id, name, lngLat: [lng, lat], kind: 'stop'|'photo'|'stay', label }],
 *     activeRoutes: ['main', 'south'],         // others are drawn at 30% opacity
 *     onPointClick(point, feature) {},         // fired for stops/photos/stays (not clusters)
 *     fitPadding: { top, right, bottom, left },// optional override of the overview padding
 *     errorText: '...',                        // shown if tiles fail to load
 *     maxZoom: 13,                             // default 13; keep <= base maxzoom + 1
 *     clusterMaxZoom: 11,                      // optional: highest zoom at which nearby points are merged into a count
 *     mergeClusters: false,                    // true: stops and photo spots share one cluster source (no cross-kind overlap)
 *     fitButton: true,                         // built-in "全景" button (false if the page has its own)
 *   });
 *   tm.map                    // the maplibregl.Map
 *   tm.ready                  // Promise resolved on first style load
 *   tm.setPoints(points)      // replace all points (e.g. when a route variant adds a stop)
 *   tm.setActiveRoute(ids)    // highlight these route ids
 *   tm.setRoutes(featureCollection) // replace the drawn routes (e.g. recolour per plan); feature.properties.color is a palette index
 *   tm.focusPoint(id, { context: [ids], padding, maxZoom, fly: false })  // mark active, fly to it (+ neighbours) unless fly:false
 *   tm.clearFocus()
 *   tm.fitTo([[lng,lat],...], { padding, maxZoom })
 *   tm.fitAll()               // fit the active routes (or all points)
 *   tm.destroy()
 *
 * AMap segmented navigation (standard for every roadbook; works without a map instance):
 *   TripMap.navSegments(stops)        // stops: [{ name, lngLat: [lng, lat] (WGS-84) }]
 *                                     // -> [{ part: 1.., stops: [2-3 stops] }], step 2, max 3 points per segment
 *   TripMap.amapRoute(stops, src)     // 2-3 stops -> https://uri.amap.com/navigation?from=..&to=..&mode=car&policy=0&callnative=1&src=..[&via=..]
 *                                     // coordinates are converted WGS-84 -> GCJ-02 (same algorithm as the Anhui roadbook)
 *   TripMap.wgs84ToGcj02(lng, lat)    // -> [lng, lat]
 *
 * Returns null (and calls opts.onUnsupported) when WebGL is unavailable.
 * TripMap.renderLegend(el)   // fills el with the land-cover / road / boundary legend (Chinese, styles in trip-map.css)
 * All coordinates are WGS-84. Admin boundaries are province/prefecture/county only; country, disputed and maritime lines are never drawn.
 */
(function () {
  'use strict';
  var ROOT = (document.currentScript && document.currentScript.src || location.href).replace(/[^/]*$/, '');
  var PALETTE = ['#263c31', '#97502e', '#c08a3e', '#4f6f5c', '#7a4a62'];
  var KIND_COLOR = { stop: '#263c31', photo: '#97502e', stay: '#c08a3e' };
  var PAPER = '#fffdf8';
  var CJK_FONT = "'PingFang SC','Hiragino Sans GB','Microsoft YaHei','Noto Sans CJK SC',sans-serif";
  var HAN = ['==', ['get', 'script'], 'Han']; // only Han-script labels are shown (no Mongolian/Cyrillic/Latin names)
  var REG = ['Noto Sans Regular'], MED = ['Noto Sans Medium'];
  var protocolReady = false;

  function z(stops) { return ['interpolate', ['linear'], ['zoom']].concat(stops); }
  function absolute(url) { return new URL(url, location.href).href; }

  function webglOk() {
    try { var c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; }
  }

  // Land-cover palette: the same hex values are baked into map/landcover.pmtiles by scripts/build-landcover.py (the legend reads them from here).
  var LC = { forest: '#b5c79e', shrub: '#cbd5ac', grass: '#dde2b6', farm: '#efe2b2', built: '#d9bfae', bare: '#e5dac6', water: '#b7cdcf', wetland: '#c3d7c9' };
  var ROAD = { hw: '#b9875f', nat: '#c99a6e', cty: '#d8c3a2' };
  var BOUNDARY = '#9b8a9a';

  function buildStyle(opts) {
    var sources = {
      base: { type: 'vector', url: 'pmtiles://' + absolute(opts.base), attribution: '' }
    };
    if (opts.terrain) sources.terrain = { type: 'raster-dem', url: 'pmtiles://' + absolute(opts.terrain), encoding: 'terrarium', tileSize: 512, attribution: '' };
    if (opts.landcover) {
      sources.landcover = { type: 'raster', url: 'pmtiles://' + absolute(opts.landcover), tileSize: 512, attribution: '' };
      // MapLibre does not fall back to a parent tile for a raster tile that is missing: a second source of the same file, capped at the zoom where the file has no gaps, is drawn beneath so a z12+ tile outside the detailed tier shows overzoomed land cover instead of paper.
      if (opts.landcoverFullZoom) sources['landcover-lo'] = { type: 'raster', url: 'pmtiles://' + absolute(opts.landcover), tileSize: 512, maxzoom: opts.landcoverFullZoom, attribution: '' };
    }
    var L = [];
    var poly = ['==', ['geometry-type'], 'Polygon'];
    var line = ['==', ['geometry-type'], 'LineString'];
    var kind = ['get', 'kind'], detail = ['get', 'kind_detail'];
    var inList = function (v, list) { return ['in', v, ['literal', list]]; };
    L.push({ id: 'bg', type: 'background', paint: { 'background-color': '#f3eee1' } });
    L.push({ id: 'earth', type: 'fill', source: 'base', 'source-layer': 'earth', paint: { 'fill-color': '#f3eee1' } });
    if (opts.landcover) {
      if (opts.landcoverFullZoom) L.push({ id: 'landcover-lo', type: 'raster', source: 'landcover-lo', paint: { 'raster-resampling': 'linear', 'raster-fade-duration': 0 } });
      L.push({ id: 'landcover', type: 'raster', source: 'landcover', paint: { 'raster-resampling': 'linear', 'raster-fade-duration': 0 } });
    } else { // no raster built for this trip: fall back to the faint OSM landcover tint
      L.push({ id: 'landcover', type: 'fill', source: 'base', 'source-layer': 'landcover', paint: { 'fill-color': ['match', kind, ['forest', 'wood'], '#e4e8d6', 'farmland', '#efe9d8', ['urban_area'], '#ebe3cf', 'rgba(0,0,0,0)'] } });
    }
    if (opts.terrain && opts.reliefTint) {
      // optional hypsometric tint: warm ramp over [min, max] metres, faded out above z10 where the land cover takes over
      var r = Array.isArray(opts.reliefRange) ? opts.reliefRange : [0, 1800], ramp = ['#d3dcc0', '#e3dfb9', '#dfcfa4', '#cdb08a'], stops = [];
      ramp.forEach(function (c, i) { stops.push(r[0] + (r[1] - r[0]) * i / (ramp.length - 1), c); });
      L.push({ id: 'relief-tint', type: 'color-relief', source: 'terrain', paint: {
        'color-relief-color': ['interpolate', ['linear'], ['elevation']].concat(stops), 'color-relief-opacity': z([6, 0.55, 9, 0.45, 11, 0]) } });
    }
    if (opts.terrain) {
      L.push({ id: 'hillshade', type: 'hillshade', source: 'terrain', paint: {
        'hillshade-shadow-color': '#2c3e33', 'hillshade-highlight-color': 'rgba(255,253,248,0.5)', 'hillshade-accent-color': 'rgba(0,0,0,0)',
        'hillshade-exaggeration': z([5, 0.3, 10, 0.3, 12, 0.22, 13, 0.18]), 'hillshade-illumination-direction': 315 } });
    }
    // OSM landuse only where it adds precision to the 10 m raster: built-up edges from z11, protected areas as an outline
    L.push({ id: 'landuse-built', type: 'fill', source: 'base', 'source-layer': 'landuse', minzoom: 11, filter: ['all', poly, inList(kind, ['residential', 'industrial', 'commercial', 'retail', 'aerodrome'])], paint: {
      'fill-color': '#dcc3ad', 'fill-opacity': z([11, 0.55, 13, 0.8]) } });
    L.push({ id: 'landuse-park', type: 'line', source: 'base', 'source-layer': 'landuse', minzoom: 9, filter: ['all', poly, inList(kind, ['park', 'national_park', 'nature_reserve', 'protected_area'])], paint: {
      'line-color': '#7f9a78', 'line-width': 0.9, 'line-dasharray': [4, 2], 'line-opacity': 0.8 } });
    L.push({ id: 'water', type: 'fill', source: 'base', 'source-layer': 'water', filter: poly, paint: { 'fill-color': '#b1c9cc' } });
    L.push({ id: 'river', type: 'line', source: 'base', 'source-layer': 'water', filter: line, paint: {
      'line-color': '#97b6bb', 'line-width': (function (r) { return z([6, r(0.8, 0.4), 12, r(2.2, 0.9), 14, r(3, 1.2)]); })(function (big, small) { return ['match', detail, ['river', 'canal'], big, small]; }) } });
    L.push({ id: 'rail', type: 'line', source: 'base', 'source-layer': 'roads', minzoom: 8, filter: ['all', line, ['==', kind, 'rail']], paint: {
      'line-color': '#8c8a7a', 'line-width': 1, 'line-dasharray': [6, 4] } });
    // four road tiers (casing under line). Protomaps: highway/motorway; major_road trunk+primary; major_road secondary+tertiary; minor_road, path/track
    var wide = function (stops, add) { return z(stops.map(function (v, i) { return i % 2 ? v + add : v; })); };
    var road = function (id, filter, color, stops, minzoom, casing) {
      var f = ['all', line, filter];
      if (casing) L.push({ id: id + '-casing', type: 'line', source: 'base', 'source-layer': 'roads', minzoom: minzoom, filter: f, layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: {
        'line-color': '#fbf7ec', 'line-opacity': 0.85, 'line-width': wide(stops, casing) } });
      L.push({ id: id, type: 'line', source: 'base', 'source-layer': 'roads', minzoom: minzoom, filter: f, layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': color, 'line-width': wide(stops, 0) } });
      return L[L.length - 1];
    };
    var NAT = ['trunk', 'trunk_link', 'primary', 'primary_link'], CTY = ['secondary', 'secondary_link', 'tertiary', 'tertiary_link'];
    var major = ['==', kind, 'major_road'];
    road('road-minor', ['any', ['==', kind, 'minor_road'], ['all', major, ['!', inList(detail, NAT.concat(CTY))]]], '#e0d2b8', [12, 0.6, 14, 1.4, 18, 5], 12);
    road('road-path', ['==', kind, 'path'], '#a8987c', [12, 0.5, 14, 0.9, 18, 2], 12).paint['line-dasharray'] = [3, 2];
    road('road-county', ['all', major, inList(detail, CTY)], ROAD.cty, [9, 0.6, 12, 1, 14, 1.9, 18, 6], 9, 1.2);
    road('road-national', ['all', major, inList(detail, NAT)], ROAD.nat, [6, 0.6, 8, 1, 14, 2.6, 18, 8], 6, 1.2);
    road('road-expressway', ['==', kind, 'highway'], ROAD.hw, [5, 0.7, 8, 1.4, 14, 3.4, 18, 10], 5, 1.2);
    // admin boundaries: province 4, prefecture 5, county 6 only; never country (2), disputed or maritime lines
    var bnd = function (id, level, width, dash, minzoom) {
      L.push({ id: id, type: 'line', source: 'base', 'source-layer': 'boundaries', minzoom: minzoom, filter: ['all', line, ['==', detail, level], ['!=', kind, 'country'],
        ['!', ['to-boolean', ['get', 'disputed']]], ['!', ['to-boolean', ['get', 'maritime']]]],
        layout: { 'line-join': 'round' }, paint: { 'line-color': BOUNDARY, 'line-width': width, 'line-dasharray': dash, 'line-opacity': 0.9 } });
    };
    bnd('boundary-county', 6, 0.6, [2, 2], 9);
    bnd('boundary-prefecture', 5, 0.9, [3, 2], 6);
    bnd('boundary-province', 4, 1.2, [4, 2], 4);
    // routes: casing + colored line (source added in create())
    L.push({ id: 'route-casing', type: 'line', source: 'routes', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: {
      'line-color': PAPER, 'line-width': z([5, 5, 12, 8]), 'line-opacity': 0.3 } });
    L.push({ id: 'route-line', type: 'line', source: 'routes', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: {
      'line-color': ['to-color', ['at', ['coalesce', ['get', 'color'], 0], ['literal', PALETTE]]], 'line-width': z([5, 2.8, 12, 4.5]), 'line-opacity': 0.3 } });
    L.push({ id: 'route-dir', type: 'symbol', source: 'routes', minzoom: 7, layout: {
      'symbol-placement': 'line', 'symbol-spacing': 110, 'text-field': '>', 'text-font': MED, 'text-size': 12, 'text-keep-upright': false, 'text-rotation-alignment': 'map', 'text-allow-overlap': true }, paint: {
      'text-color': PAPER, 'text-opacity': 0.9 } });
    // labels
    var label = function (id, props) { L.push(Object.assign({ id: id, type: 'symbol', source: 'base' }, props)); };
    label('label-river', { 'source-layer': 'water', minzoom: 9, filter: ['all', line, HAN], layout: { 'symbol-placement': 'line', 'text-field': ['get', 'name'], 'text-font': REG, 'text-size': 11 },
      paint: { 'text-color': '#4f7a78', 'text-halo-color': '#e4eae3', 'text-halo-width': 1.2 } });
    label('label-water', { 'source-layer': 'water', minzoom: 8, filter: ['all', ['==', ['geometry-type'], 'Point'], HAN], layout: { 'text-field': ['get', 'name'], 'text-font': REG, 'text-size': 12, 'text-letter-spacing': 0.1 },
      paint: { 'text-color': '#4f7a78', 'text-halo-color': '#e4eae3', 'text-halo-width': 1.2 } });
    // G/S route numbers in a paper box along the road; compound refs ("G233;S207") read "G233 S207"
    var ref = ['to-string', ['get', 'ref']], semi = ['index-of', ';', ref];
    label('label-road-ref', { 'source-layer': 'roads', minzoom: 9, filter: ['all', line, ['has', 'ref'], inList(kind, ['highway', 'major_road']), inList(['slice', ref, 0, 1], ['G', 'S'])], layout: {
      'symbol-placement': 'line', 'symbol-spacing': 420, 'text-field': ['case', ['>=', semi, 0], ['concat', ['slice', ref, 0, semi], ' ', ['slice', ref, ['+', semi, 1]]], ref],
      'text-font': MED, 'text-size': 10, 'text-padding': 8, 'text-max-angle': 25, 'icon-image': 'tm-ref', 'icon-text-fit': 'both', 'icon-text-fit-padding': [1, 4, 1, 4], 'icon-rotation-alignment': 'map' },
      paint: { 'text-color': ['case', ['==', kind, 'highway'], '#7a4f2e', '#8a6a4a'] } });
    // admin names: provinces (letter-spaced, z5-7), then cities/towns/villages; label sits beside a stop marker (radial offset clears it) and flips before it would hide
    label('label-province', { 'source-layer': 'places', minzoom: 5, maxzoom: 8, filter: ['all', ['==', kind, 'region'], HAN], layout: { 'text-field': ['get', 'name'], 'text-font': REG, 'text-size': 13, 'text-letter-spacing': 0.35, 'text-max-width': 6 },
      paint: { 'text-color': '#7d6f7c', 'text-halo-color': '#f5f2e9', 'text-halo-width': 1.4 } });
    var place = function (id, kd, size, color, minzoom, maxzoom, font) {
      label(id, { 'source-layer': 'places', minzoom: minzoom, maxzoom: maxzoom || 24, filter: ['all', ['==', kind, 'locality'], ['==', detail, kd], HAN],
        layout: { 'text-field': ['get', 'name'], 'text-font': font || REG, 'text-size': size, 'text-padding': 4, 'text-max-width': 8, 'text-variable-anchor': ['top', 'bottom', 'left', 'right'], 'text-radial-offset': 22 / size, 'text-justify': 'auto' },
        paint: { 'text-color': color, 'text-halo-color': '#f5f2e9', 'text-halo-width': 1.6 } });
    };
    place('label-hamlet', 'hamlet', 10.5, '#6b7a6c', 13);
    place('label-village', 'village', 11, '#5f6f61', 12);
    place('label-town', 'town', 12.5, '#33493d', 7);
    place('label-city', 'city', 15, '#203d30', 4, 24, MED);
    label('label-transit', { 'source-layer': 'pois', minzoom: 11, filter: ['all', ['in', kind, ['literal', ['aerodrome', 'station', 'train_station']]], HAN], layout: {
      'text-field': ['get', 'name'], 'text-font': REG, 'text-size': 10.5 },
      paint: { 'text-color': '#6b7a6c', 'text-halo-color': '#f5f2e9', 'text-halo-width': 1.4 } });
    return { version: 8, glyphs: ROOT + 'fonts/{fontstack}/{range}.pbf', sources: sources, layers: L };
  }

  // Rounded paper box behind road numbers (9-slice so it stretches to the text)
  function addRefBox(map) {
    var px = 2, w = 24, h = 16, c = document.createElement('canvas'); c.width = w * px; c.height = h * px;
    var x = c.getContext('2d'); x.scale(px, px);
    x.beginPath(); x.moveTo(5, 1); x.arcTo(w - 1, 1, w - 1, h - 1, 4); x.arcTo(w - 1, h - 1, 1, h - 1, 4); x.arcTo(1, h - 1, 1, 1, 4); x.arcTo(1, 1, w - 1, 1, 4); x.closePath();
    x.fillStyle = 'rgba(255,253,248,0.94)'; x.fill(); x.lineWidth = 1; x.strokeStyle = '#c9b290'; x.stroke();
    map.addImage('tm-ref', x.getImageData(0, 0, w * px, h * px), { pixelRatio: px, stretchX: [[8 * px, 16 * px]], stretchY: [[6 * px, 10 * px]], content: [6 * px, 4 * px, 18 * px, 12 * px] });
  }

  // Point markers are symbol layers (so place labels collide with them); their circles are drawn here.
  function circleImage(r, sw, color, alpha) {
    var px = 2, d = Math.ceil(2 * r + sw) + 2, c = document.createElement('canvas'); c.width = c.height = d * px;
    var x = c.getContext('2d'); x.scale(px, px); x.globalAlpha = alpha || 1;
    x.beginPath(); x.arc(d / 2, d / 2, r, 0, 2 * Math.PI); x.fillStyle = color; x.fill();
    x.lineWidth = sw; x.strokeStyle = PAPER; x.stroke();
    return x.getImageData(0, 0, d * px, d * px);
  }
  function addMarkerImages(map) {
    var o = { pixelRatio: 2 };
    Object.keys(KIND_COLOR).forEach(function (k) {
      var photo = k === 'photo';
      map.addImage('tm-' + k, circleImage(photo ? 11 : 13, 2, KIND_COLOR[k]), o);
      map.addImage('tm-' + k + '-a', circleImage(photo ? 14 : 16, 3, KIND_COLOR[k]), o);
    });
    ['main', 'photo'].forEach(function (src) {
      var color = src === 'photo' ? KIND_COLOR.photo : KIND_COLOR.stop;
      map.addImage('tm-c-' + src + '-s', circleImage(16, 2.5, color, 0.94), o);
      map.addImage('tm-c-' + src + '-l', circleImage(19, 2.5, color, 0.94), o);
    });
  }

  function ZoomControl(map, onFit) {
    this.el = document.createElement('div'); this.el.className = 'tm-zoom maplibregl-ctrl';
    [['+', '放大', 1], ['−', '缩小', -1]].forEach(function (d) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'tm-btn'; b.textContent = d[0]; b.setAttribute('aria-label', d[1]);
      b.addEventListener('click', function () { map.easeTo({ zoom: map.getZoom() + d[2], duration: 250 }); });
      this.el.append(b);
    }, this);
    if (onFit) { var f = document.createElement('button'); f.type = 'button'; f.className = 'tm-btn tm-fit'; f.textContent = '全景'; f.setAttribute('aria-label', '查看全景'); f.addEventListener('click', onFit); this.el.append(f); }
  }
  ZoomControl.prototype.onAdd = function () { return this.el; };
  ZoomControl.prototype.onRemove = function () { this.el.remove(); };

  function AttributionBar(landcover) {
    this.el = document.createElement('div'); this.el.className = 'tm-attrib maplibregl-ctrl';
    this.el.innerHTML = '<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap</a> · <a href="https://protomaps.com" target="_blank" rel="noopener">Protomaps</a> · <a href="https://mapterhorn.com/attribution" target="_blank" rel="noopener">Mapterhorn</a>'
      + (landcover ? ' · <a href="https://esa-worldcover.org" target="_blank" rel="noopener">ESA WorldCover</a>' : '');
  }
  AttributionBar.prototype.onAdd = function () { return this.el; };
  AttributionBar.prototype.onRemove = function () { this.el.remove(); };

  function toFeatures(points, merge) {
    var split = { main: [], photo: [] };
    points.forEach(function (p) {
      split[p.kind === 'photo' && !merge ? 'photo' : 'main'].push({ type: 'Feature', geometry: { type: 'Point', coordinates: p.lngLat },
        properties: { id: p.id, kind: p.kind || 'stop', label: p.label == null ? '' : String(p.label), color: KIND_COLOR[p.kind] || KIND_COLOR.stop } });
    });
    return { main: { type: 'FeatureCollection', features: split.main }, photo: { type: 'FeatureCollection', features: split.photo } };
  }

  function create(opts) {
    var container = typeof opts.container === 'string' ? document.querySelector(opts.container) : opts.container;
    if (!container) return null;
    if (!window.maplibregl || !window.pmtiles || !webglOk()) {
      if (opts.onUnsupported) opts.onUnsupported();
      return null;
    }
    if (!protocolReady) { maplibregl.addProtocol('pmtiles', new pmtiles.Protocol().tile); protocolReady = true; }

    var coarse = matchMedia('(max-width: 980px)');
    var points = (opts.points || []).slice();
    var byId = {};
    var activeRoutes = opts.activeRoutes || [];
    var activeId = null;
    var routeData = { type: 'FeatureCollection', features: [] };
    var routesSet = false;
    var style = buildStyle(opts);
    style.sources.routes = { type: 'geojson', data: routeData };
    var fc = toFeatures(points, opts.mergeClusters);
    style.sources.main = { type: 'geojson', data: fc.main, cluster: true, clusterRadius: 36, clusterMaxZoom: opts.clusterMaxZoom || 11 };
    style.sources.photo = { type: 'geojson', data: fc.photo, cluster: true, clusterRadius: 30, clusterMaxZoom: opts.clusterMaxZoom || 13 };

    var map = new maplibregl.Map({
      container: container, style: style, attributionControl: false, localIdeographFontFamily: CJK_FONT,
      cooperativeGestures: true, dragRotate: false, pitchWithRotate: false, touchPitch: false, maxPitch: 0, minZoom: 4, maxZoom: opts.maxZoom || 13, center: [120.8, 48.2], zoom: 6, maxBounds: opts.maxBounds,
      locale: { 'CooperativeGesturesHandler.WindowsHelpText': '按住 Ctrl 并滚动来缩放地图', 'CooperativeGesturesHandler.MacHelpText': '按住 ⌘ 并滚动来缩放地图', 'CooperativeGesturesHandler.MobileHelpText': '用双指移动地图' }
    });
    map.touchZoomRotate.disableRotation();
    var api;
    map.addControl(new ZoomControl(map, opts.fitButton === false ? null : function () { api.fitAll(); }), 'top-left');
    map.addControl(new maplibregl.ScaleControl({ unit: 'metric', maxWidth: 90 }), 'bottom-right');
    map.addControl(new AttributionBar(!!opts.landcover), 'bottom-right');
    container.classList.add('tm-map');

    var failed = false;
    map.on('error', function (e) {
      var err = e && e.error;
      if (failed || !e.sourceId || (err && err.name === 'AbortError')) return;
      if (e.sourceId === 'base') {
        failed = true;
        var n = document.createElement('div'); n.className = 'tm-error'; n.textContent = opts.errorText || '地图瓦片加载失败，请使用站点列表和高德链接。';
        container.append(n);
      }
    });

    function iconFor(active) {
      return ['case', active, ['concat', 'tm-', ['get', 'kind'], '-a'], ['concat', 'tm-', ['get', 'kind']]];
    }
    function pointLayers(src) {
      var single = ['!', ['has', 'point_count']];
      var none = ['==', ['get', 'id'], ['literal', '']];
      var icon = { 'icon-allow-overlap': true, 'icon-ignore-placement': false, 'text-font': MED, 'text-allow-overlap': true, 'text-ignore-placement': true };
      return [
        { id: src + '-cluster', type: 'symbol', source: src, filter: ['has', 'point_count'], layout: Object.assign({
          'icon-image': ['concat', 'tm-c-', src, '-', ['step', ['get', 'point_count'], 's', 5, 'l']], 'text-field': ['get', 'point_count_abbreviated'], 'text-size': 13 }, icon), paint: { 'text-color': PAPER } },
        { id: src + '-halo', type: 'circle', source: src, filter: ['all', single, none], paint: { 'circle-radius': 22, 'circle-color': ['get', 'color'], 'circle-opacity': 0.2 } },
        { id: src + '-dot', type: 'symbol', source: src, filter: single, layout: Object.assign({
          'icon-image': iconFor(none), 'text-field': ['get', 'label'], 'text-size': src === 'photo' ? 11.5 : 13 }, icon), paint: { 'text-color': PAPER } },
        { id: src + '-hit', type: 'circle', source: src, filter: single, paint: { 'circle-radius': 22, 'circle-color': '#000', 'circle-opacity': 0.001 } }
      ];
    }
    var main = pointLayers('main'), photo = pointLayers('photo');
    photo.forEach(function (l) { l.minzoom = 8; });
    var pointLayerDefs = main.concat(photo);

    function setActivePaint() {
      if (!map.getLayer('main-dot')) return;
      ['main', 'photo'].forEach(function (src) {
        var active = ['==', ['get', 'id'], activeId == null ? '' : String(activeId)];
        map.setLayoutProperty(src + '-dot', 'icon-image', iconFor(active));
        map.setFilter(src + '-halo', ['all', ['!', ['has', 'point_count']], active]);
      });
    }
    function setRoutePaint() {
      if (!map.getLayer('route-line')) return;
      var on = ['in', ['get', 'id'], ['literal', activeRoutes]];
      map.setPaintProperty('route-line', 'line-opacity', ['case', on, 1, 0.3]);
      map.setPaintProperty('route-casing', 'line-opacity', ['case', on, 1, 0.3]);
      map.setPaintProperty('route-dir', 'text-opacity', ['case', on, 0.9, 0]);
    }
    function routeBounds(ids) {
      var b = new maplibregl.LngLatBounds(), any = false;
      routeData.features.forEach(function (f) {
        if (ids && ids.indexOf(f.properties.id) < 0) return;
        f.geometry.coordinates.forEach(function (c) { b.extend(c); any = true; });
      });
      return any ? b : null;
    }
    function defaultPadding() {
      if (opts.fitPadding) return opts.fitPadding;
      return coarse.matches ? { top: 72, bottom: 56, left: 64, right: 32 } : { top: 72, bottom: 64, left: 64, right: 48 };
    }
    function fitBounds(b, o) {
      o = o || {};
      map.fitBounds(b, { padding: o.padding || defaultPadding(), maxZoom: o.maxZoom || 11, duration: o.duration == null ? 700 : o.duration });
    }
    function indexPoints() { byId = {}; points.forEach(function (p) { byId[p.id] = p; }); }
    indexPoints();

    var ready = new Promise(function (resolve) {
      map.on('load', function () {
        addMarkerImages(map); addRefBox(map);
        pointLayerDefs.forEach(function (l) { map.addLayer(l); });
        // casing/line sources are in the style already; keep route layers below point layers
        setRoutePaint(); setActivePaint();
        resolve();
      });
    });
    var routes = opts.routes;
    Promise.resolve(typeof routes === 'string' ? fetch(routes).then(function (r) { return r.json(); }) : routes).then(function (data) {
      if (data && !routesSet) routeData = data;
      return ready;
    }).then(function () {
      map.getSource('routes').setData(routeData);
      setRoutePaint();
      if (routesSet) return; // the page drives the view through setRoutes + fitTo
      var b = routeBounds(activeRoutes.length ? activeRoutes : null);
      if (b) fitBounds(b, { duration: 0 });
      else if (points.length) fitTo(points.map(function (p) { return p.lngLat; }), { duration: 0 });
    }).catch(function () { /* routes are optional: points and base map still work */ });

    function fitTo(lngLats, o) {
      var b = new maplibregl.LngLatBounds(); lngLats.forEach(function (c) { b.extend(c); });
      fitBounds(b, o);
    }

    map.on('click', function (e) {
      var cl = map.queryRenderedFeatures(e.point, { layers: ['main-cluster', 'photo-cluster'].filter(function (id) { return map.getLayer(id); }) })[0];
      if (cl) {
        var src = map.getSource(cl.source);
        src.getClusterExpansionZoom(cl.properties.cluster_id).then(function (zoom) {
          map.easeTo({ center: cl.geometry.coordinates, zoom: Math.min(zoom + 0.3, map.getMaxZoom()), duration: 500 });
        });
        return;
      }
      var f = map.queryRenderedFeatures(e.point, { layers: ['main-hit', 'photo-hit'].filter(function (id) { return map.getLayer(id); }) })[0];
      if (f && opts.onPointClick) opts.onPointClick(byId[f.properties.id], f);
    });
    ['main-cluster', 'photo-cluster', 'main-hit', 'photo-hit'].forEach(function (id) {
      map.on('mouseenter', id, function () { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', id, function () { map.getCanvas().style.cursor = ''; });
    });

    api = {
      map: map,
      ready: ready,
      setPoints: function (next) {
        points = next.slice(); indexPoints();
        var d = toFeatures(points, opts.mergeClusters);
        ready.then(function () { map.getSource('main').setData(d.main); map.getSource('photo').setData(d.photo); });
      },
      setActiveRoute: function (ids) { activeRoutes = ids || []; setRoutePaint(); },
      setRoutes: function (data) {
        routeData = data; routesSet = true;
        ready.then(function () { map.getSource('routes').setData(routeData); setRoutePaint(); });
      },
      focusPoint: function (id, o) {
        o = o || {};
        var p = byId[id]; if (!p) return;
        activeId = id; setActivePaint();
        if (o.fly === false) return;
        var coords = [p.lngLat].concat((o.context || []).map(function (c) { return byId[c] && byId[c].lngLat; }).filter(Boolean));
        var b = new maplibregl.LngLatBounds(); coords.forEach(function (c) { b.extend(c); });
        map.stop();
        map.fitBounds(b, { padding: o.padding || defaultPadding(), maxZoom: o.maxZoom || (p.kind === 'photo' ? 12.5 : 10.5), duration: 800 });
      },
      clearFocus: function () { activeId = null; setActivePaint(); },
      fitTo: fitTo,
      fitAll: function (o) { activeId = null; setActivePaint(); var b = routeBounds(activeRoutes.length ? activeRoutes : null); if (b) fitBounds(b, o); else fitTo(points.map(function (p) { return p.lngLat; }), o); },
      destroy: function () { map.remove(); }
    };
    return api;
  }

  function wgs84ToGcj02(lon, lat) {
    if (![lon, lat].every(Number.isFinite) || Math.abs(lon) > 180 || Math.abs(lat) > 90) throw new RangeError('Invalid geographic coordinate');
    if (!(lon > 73.66 && lon < 135.05 && lat > 3.86 && lat < 53.55)) return [lon, lat];
    var pi = Math.PI, x = lon - 105, y = lat - 35;
    var common = (20 * Math.sin(6 * x * pi) + 20 * Math.sin(2 * x * pi)) * 2 / 3;
    var dy = -100 + 2 * x + 3 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x)) + common;
    dy += (20 * Math.sin(y * pi) + 40 * Math.sin(y / 3 * pi)) * 2 / 3;
    dy += (160 * Math.sin(y / 12 * pi) + 320 * Math.sin(y * pi / 30)) * 2 / 3;
    var dx = 300 + x + 2 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x)) + common;
    dx += (20 * Math.sin(x * pi) + 40 * Math.sin(x / 3 * pi)) * 2 / 3;
    dx += (150 * Math.sin(x / 12 * pi) + 300 * Math.sin(x / 30 * pi)) * 2 / 3;
    var rad = lat / 180 * pi, magic = 1 - 0.00669342162296594323 * Math.pow(Math.sin(rad), 2), root = Math.sqrt(magic);
    return [lon + dx * 180 / (6378245 / root * Math.cos(rad) * pi), lat + dy * 180 / (6378245 * (1 - 0.00669342162296594323) / (magic * root) * pi)];
  }

  function navSegments(stops) {
    var out = [];
    for (var i = 0; i < stops.length - 1; i += 2) out.push({ part: i / 2 + 1, stops: stops.slice(i, i + 3) });
    return out;
  }

  function amapRoute(stops, src) {
    if (!Array.isArray(stops) || stops.length < 2 || stops.length > 3) throw new RangeError('Amap navigation requires two or three stops');
    var pos = function (s) { var xy = wgs84ToGcj02(s.lngLat[0], s.lngLat[1]); return xy[0].toFixed(6) + ',' + xy[1].toFixed(6) + ',' + s.name; };
    var params = new URLSearchParams({ from: pos(stops[0]), to: pos(stops[stops.length - 1]), mode: 'car', policy: '0', callnative: '1', src: src });
    if (stops.length === 3) params.set('via', pos(stops[1]));
    return 'https://uri.amap.com/navigation?' + params.toString();
  }

  function renderLegend(el) {
    var chip = function (bg, text) { return '<span class="tm-key"><i class="tm-chip" style="background:' + bg + '"></i>' + text + '</span>'; };
    var ln = function (border, text) { return '<span class="tm-key"><i class="tm-line" style="border-top:' + border + '"></i>' + text + '</span>'; };
    el.classList.add('tm-legend');
    el.innerHTML = chip(LC.forest, '森林') + chip('linear-gradient(90deg,' + LC.shrub + ' 50%,' + LC.grass + ' 50%)', '灌丛草地') + chip(LC.farm, '农田') + chip(LC.built, '城镇')
      + chip('linear-gradient(90deg,' + LC.water + ' 50%,' + LC.wetland + ' 50%)', '水体湿地') + chip(LC.bare, '裸地')
      + ln('3.4px solid ' + ROAD.hw, '高速') + ln('2.6px solid ' + ROAD.nat, '国道省道') + ln('1.9px solid ' + ROAD.cty, '县道') + ln('1.5px dashed ' + BOUNDARY, '县界');
  }

  window.TripMap = { create: create, renderLegend: renderLegend, navSegments: navSegments, amapRoute: amapRoute, wgs84ToGcj02: wgs84ToGcj02 };
})();
