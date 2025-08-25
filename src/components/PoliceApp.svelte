<script>
  import { onMount, onDestroy, tick } from 'svelte';
  import { postJSON } from '../lib/nui';
  import 'leaflet/dist/leaflet.css';

  // ======= Props =======
  export let playerName = '';
  export let playerId;

  // ======= Tabs / Common =======
  let tab = 'map';            // 'rules' | 'ops' | 'map'
  let loading = false;
  let error = '';

  // ======= Rules =======
  let rules = [];
  let ruleQuery = '';
  $: filteredRules = (rules || []).filter(r => {
    const t = String(r?.title || '').toLowerCase();
    const b = String(r?.body  || '').toLowerCase();
    const q = ruleQuery.toLowerCase().trim();
    return !q || t.includes(q) || b.includes(q);
  });

  async function loadRules() {
    loading = true; error = '';
    try {
      const res = await postJSON('police:getRules', {});
      let arr = Array.isArray(res?.items) ? res.items : [];
      if (!arr.length && import.meta?.env?.DEV) {
        arr = [
          { title: 'Use of Force', body: 'Apply minimal force necessary.' },
          { title: 'Evidence Handling', body: 'Store in evidence locker.' },
        ];
      }
      rules = arr;
    } catch {
      error = 'Failed to load rules.';
    } finally { loading = false; }
  }

  // ======= Ops =======
  let ops = [];
  const norm = (s) => (String(s || '').trim().toLowerCase());

  function isMe(member) {
    const mid = Number(member?.id ?? member?.source ?? 0);
    if (playerId && mid && playerId === mid) return true;
    return norm(member?.name) === norm(playerName);
  }

  function normalizeOp(op) {
    const members = Array.isArray(op?.members) ? op.members : [];
    const maxFromOp = Number(op?.max || 0);
    const channelRaw = op?.channel ?? op?.meta?.channel ?? 0;
    return {
      name: op?.name || 'Operation',
      channel: channelRaw,
      max: Number.isFinite(maxFromOp) && maxFromOp > 0 ? maxFromOp : 0,
      members: members.map((m) => ({
        id: Number(m?.id ?? m?.source ?? m?.playerId ?? m?.cid ?? m?.citizenid ?? 0),
        name: m?.name || m?.label || 'Unknown',
        rank: m?.rank || 'Officer',
      })),
    };
  }

  async function loadOps() {
    loading = true; error = '';
    try {
      const res = await postJSON('getOperations', {});
      let list = Array.isArray(res?.operations) ? res.operations.map(normalizeOp) : [];
      if (!list.length && import.meta?.env?.DEV) {
        list = [{
          name:'Operation Alpha', channel:1, max:7,
          members:[{id:7, name: playerName || 'Officer', rank:'AOP'}]
        }];
      }
      ops = list;
    } catch {
      error = 'Failed to load operations.';
    } finally { loading = false; }
  }

  async function join(op){ if(!op?.name) return; try{ await postJSON('joinOperationFromTablet',{name:op.name}); }catch{} setTimeout(loadOps,180); }
  async function leave(opName) { try { await postJSON("leaveOperation", { opName }); } catch {} setTimeout(loadOps, 180); }

  // ======= Leaflet / Map =======
  let L;                 // Leaflet module
  let map;               // Leaflet map instance
  let markersLayer;      // robberies
  let alertsLayer;       // alerts
  let mapEl;             // DOM element
  let mapInitialized = false;

  let robberies = [];
  let robLoading = false;
  let robError = '';
  let robQuery = '';
  let robType = 'all';

  // تحويل GTA -> Leaflet (نفس صيغة كودك في Vue)
  function gtaToLatLng(x, y) {
    const lng = x * 0.66 + 3755;
    const lat = y * 0.66 + -5525;
    return [lat, lng];
  }

  const typeColor = (t) => {
    const k = String(t || '').toLowerCase();
    if (k.includes('store')) return '#4caf50';
    if (k.includes('bank'))  return '#ff5252';
    if (k.includes('house')) return '#ff9800';
    if (k.includes('atm'))   return '#3f51b5';
    return '#00d1f5';
  };

  $: filteredRobberies = (robberies || []).filter(r => {
    const q = robQuery.trim().toLowerCase();
    const t = String(r?.type || '').toLowerCase();
    const n = String(r?.name || '').toLowerCase();
    const okType = (robType === 'all') || t.includes(robType);
    const okText = !q || t.includes(q) || n.includes(q);
    return okType && okText;
  });

  async function ensureLeaflet() {
    if (L) return;
    const mod = await import('leaflet');
    L = mod.default || mod;
  }

  function initMap() {
    if (mapInitialized) return;
    if (!mapEl || !mapEl.isConnected) {
      requestAnimationFrame(initMap);
      return;
    }

    const crs = L.CRS.Simple;
    crs.scale = function (zoom) {
      return Math.pow(2, zoom) / Math.pow(2, 3) * 0.25;
    };

    const AtlasStyle = L.tileLayer('./styleAtlas/{z}/{x}/{y}.png', {
      minZoom: 0,
      maxZoom: 5,
      noWrap: true,
      tms: true,
      id: 'styleAtlas map',
    });

    map = L.map(mapEl, {
      maxZoom: 5,
      minZoom: 3,
      layers: [AtlasStyle],
      crs: crs,
      center: [-5525, 3755],
      zoom: 4,
      attributionControl: false,
      zoomControl: false,
      maxBounds: L.latLngBounds([[-8192, 0], [0, 8192]]),
      preferCanvas: true,
    });

    markersLayer = L.layerGroup().addTo(map);
    alertsLayer  = L.layerGroup().addTo(map);
    mapInitialized = true;

    requestAnimationFrame(() => map.invalidateSize());
  }

  function demoRobberies(count = 6) {
    const types = ['store', 'bank', 'house', 'atm', 'store', 'bank'];
    const names = [
      '24/7 Strawberry', 'Fleeca Legion', 'House Alta St.',
      'ATM Pillbox', '24/7 Sandy', 'Pacific Standard'
    ];
    const pts = [
      [-140.5, -625.2],
      [149.0, -1042.0],
      [-30.2, -90.1],
      [-254.0, 611.3],
      [300.0, -250.0],
      [-1215.4, -336.8],
    ];
    const now = Date.now();
    const arr = [];
    for (let i = 0; i < count; i++) {
      const p = pts[i % pts.length];
      arr.push({
        id: i + 1,
        x: p[0],
        y: p[1],
        type: types[i % types.length],
        name: names[i % names.length],
        time: now - (i + 1) * 90_000,
      });
    }
    return arr;
  }

  async function loadRobberies() {
    robLoading = true; robError = '';
    try {
      const res = {};
      let arr = Array.isArray(res?.items) ? res.items : [];
      if (!arr.length) arr = demoRobberies();
      robberies = arr;
    } catch (e) {
      robberies = demoRobberies();
    } finally {
      robLoading = false;
    }
  }

  function renderMarkers() {
    if (!markersLayer || !L || !mapInitialized) return;
    markersLayer.clearLayers();
    filteredRobberies.forEach(r => {
      const c = typeColor(r?.type);
      const latlng = gtaToLatLng(Number(r?.x||0), Number(r?.y||0));
      const marker = L.circleMarker(latlng, {
        radius: 6,
        weight: 1.2,
        color: c,
        fillColor: c,
        fillOpacity: 0.75
      });
      marker.bindPopup(
        robberyPopupHtml(r),
        { className: 'rob-popup ' + popupTypeClass(r?.type), maxWidth: 280, closeButton: true }
      );
      marker.addTo(markersLayer);
    });
  }
  $: if (mapInitialized) renderMarkers();

  // ======= Alerts / Dispatch =======
  let alerts = [];
  const MAX_ALERTS = 30;

  function alertColor(t) {
    const k = String(t || '').toLowerCase();
    if (k.includes('car') || k.includes('vehicle')) return '#ff5252';
    if (k.includes('rob') || k.includes('store'))   return '#ff9800';
    if (k.includes('bank'))                         return '#e53935';
    if (k.includes('house'))                        return '#fb8c00';
    return '#00d1f5';
  }

  // -------- Helpers لألوان الـ 3D --------
  function shadeHex(hex, amt) {
    hex = String(hex || '#888').replace('#','');
    if (hex.length === 3) hex = hex.split('').map(c=>c+c).join('');
    const clamp = (v)=>Math.max(0, Math.min(255, v));
    let r = clamp(parseInt(hex.slice(0,2),16) + amt);
    let g = clamp(parseInt(hex.slice(2,4),16) + amt);
    let b = clamp(parseInt(hex.slice(4,6),16) + amt);
    const toHex = (n)=>n.toString(16).padStart(2,'0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }
  const lighten = (hex, p=0.35)=> shadeHex(hex, Math.round(255 * p));
  const darken  = (hex, p=0.25)=> shadeHex(hex, Math.round(-255 * p));

  // مسارات SVG داخل الـ pin
  const GLYPHS = {
    car:    'M3 13l2-5a2 2 0 0 1 2-1h10a2 2 0 0 1 2 1l2 5M5 13h14M6 10h12 M7 16a2 2 0 1 0 .001 0z M17 16a2 2 0 1 0 .001 0z',
    store:  'M4 10l2-4h12l2 4v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z M8 14h8 M8 18h4',
    bank:   'M4 10l8-4 8 4v10H4z M4 14h16 M8 14v6 M12 14v6 M16 14v6',
    house:  'M4 12l8-6 8 6v8H6v-6h4v6',
    other:  'M12 6a6 6 0 1 1 0 12a6 6 0 0 1 0-12z'
  };
  function glyphFor(type=''){
    const k = String(type).toLowerCase();
    if (k.includes('car') || k.includes('vehicle')) return 'car';
    if (k.includes('store') || k.includes('rob'))   return 'store';
    if (k.includes('bank'))                         return 'bank';
    if (k.includes('house'))                        return 'house';
    return 'other';
  }
  function uid(){ return Math.random().toString(36).slice(2,9); }

  // أيقونة 3D
  function blip3DIcon(type) {
    const base = alertColor(type);
    const gId  = uid();
    const glow = lighten(base, .45);
    const deep = darken(base, .20);
    const path = GLYPHS[glyphFor(type)];
    const html = `
<svg class="blip3d" viewBox="0 0 36 52" width="36" height="52" aria-hidden="true">
  <defs>
    <radialGradient id="g-${gId}" cx="30%" cy="25%" r="75%">
      <stop offset="0%"   stop-color="${glow}"/>
      <stop offset="70%"  stop-color="${base}"/>
      <stop offset="100%" stop-color="${deep}"/>
    </radialGradient>
    <filter id="drop-${gId}" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="2"/>
      <feOffset dx="0" dy="2" result="o"/>
      <feComponentTransfer><feFuncA type="linear" slope="0.55"/></feComponentTransfer>
      <feMerge><feMergeNode in="o"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>

  <ellipse cx="18" cy="48.5" rx="8" ry="2.8" fill="rgba(0,0,0,.35)"/>

  <g filter="url(#drop-${gId})">
    <path d="M18 1C9 1 2 8.5 2 17.5 2 30 18 51 18 51S34 30 34 17.5C34 8.5 27 1 18 1z"
          fill="url(#g-${gId})"/>
    <path d="M10 10c2-4 8-6 13-4" stroke="rgba(255,255,255,.35)" stroke-width="3" fill="none" stroke-linecap="round"/>
    <g transform="translate(6,7)">
      <path d="${path}" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
    </g>
  </g>
</svg>`;
    return L.divIcon({
      className: 'blip3d-wrap',
      html,
      iconSize: [36,52],
      iconAnchor: [18,50],
      popupAnchor: [0,-44]
    });
  }

  function timeAgo(input){
    if (!input) return 'just now';
    let ts = Number(input);
    if (!Number.isFinite(ts)) return 'just now';
    // إذا وصلتنا بالثواني (FiveM غالبًا)، حوّلها إلى ms
    if (ts < 1e11) ts *= 1000;
    const diff = Math.max(0, Date.now() - ts);
    const s = Math.floor(diff/1000);
    if (s < 60) return `${s}s ago`;
    const m = Math.floor(s/60); if (m < 60) return `${m}m ago`;
    const h = Math.floor(m/60); if (h < 24) return `${h}h ago`;
    const d = Math.floor(h/24); return `${d}d ago`;
  }

  function addAlert(a = {}) {
    const id = a.id ?? Math.floor(Math.random() * 1e9);
    const ts = Number(a.time ?? Date.now());
    const latlng = gtaToLatLng(Number(a.x || 0), Number(a.y || 0));

    // استخدم الأيقونة 3D
    const marker = L.marker(latlng, { icon: blip3DIcon(a.type) })
      .bindPopup(
        alertPopupHtml(a),
        { className: 'alert-popup ' + popupTypeClass(a.type), maxWidth: 320, autoClose: false, closeButton: true }
      );

    marker.on('popupopen', ()=> marker._icon?.classList.add('is-open'));
    marker.on('popupclose', ()=> marker._icon?.classList.remove('is-open'));

    if (alertsLayer) marker.addTo(alertsLayer);

    const item = { ...a, id, time: ts, _marker: marker };
    alerts.unshift(item);

    if (alerts.length > MAX_ALERTS) {
      const old = alerts.pop();
      try { old?._marker?.remove(); } catch {}
    }
  }

  function focusAlert(a) {
    if (!a?._marker || !mapInitialized) return;
    map.setView(a._marker.getLatLng(), Math.max(map.getZoom(), 5), { animate:true });
    a._marker.openPopup();
  }

  function addDemoAlerts() {
    demoRobberies(6).forEach((rb, i) => {
      addAlert({
        title:  i % 2 ? 'Car Jacking' : 'Store Robbery',
        type:   i % 2 ? 'car'         : 'store',
        x: rb.x, y: rb.y,
        street:  i % 2 ? 'Nikola Avenue, Mirror Park' : 'Grove St.',
        vehicle: i % 2 ? 'Yamaha MT 09'               : '',
        plate:   i % 2 ? '987868KE'                   : '',
        color:   i % 2 ? 'Metallic Black / Race Yellow' : '',
        class:   i % 2 ? 'Motorcycle' : '',
        heading: 'North Bound',
        code:    i % 2 ? 'Code 9' : 'Code 2',
        num:     200 + i,
        time:    Date.now() - (i + 1) * 42000,
      });
    });
  }

  // ======= Icons (inline SVG) =======
  const ICONS = {
    siren:'<svg class="ic" viewBox="0 0 24 24"><path d="M7 11V8a5 5 0 0 1 10 0v3M5 21h14M4 17h16M6 3l1.5 1.5M18 3 16.5 4.5M3 10h2M21 10h-2"/></svg>',
    clock:'<svg class="ic" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>',
    road:'<svg class="ic" viewBox="0 0 24 24"><path d="M6 21l5-18h2l5 18"/><path d="M12 8v3m0 4v3"/></svg>',
    car:'<svg class="ic" viewBox="0 0 24 24"><path d="M3 13l2-5a2 2 0 0 1 2-1h10a2 2 0 0 1 2 1l2 5"/><circle cx="7" cy="16" r="2"/><circle cx="17" cy="16" r="2"/><path d="M5 13h14"/></svg>',
    plate:'<svg class="ic" viewBox="0 0 24 24"><rect x="3" y="7" width="18" height="10" rx="2"/><path d="M7 12h10"/></svg>',
    compass:'<svg class="ic" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M16 8l-4 8-4-4 8-4z"/></svg>',
    drop:'<svg class="ic" viewBox="0 0 24 24"><path d="M12 2C9 6 6 9 6 13a6 6 0 0 0 12 0c0-4-3-7-6-11z"/></svg>',
    block:'<svg class="ic" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M4 4l16 16"/></svg>',
    door:'<svg class="ic" viewBox="0 0 24 24"><rect x="6" y="3" width="12" height="18" rx="1"/><circle cx="14" cy="12" r="1"/></svg>',
  };
  function I(name){ return ICONS[name] || ''; }

  // نوع لوني للـ popup
  function popupTypeClass(t=''){
    const k = String(t).toLowerCase();
    if (k.includes('car') || k.includes('vehicle')) return 't-car';
    if (k.includes('store') || k.includes('rob'))   return 't-store';
    if (k.includes('bank'))                         return 't-bank';
    if (k.includes('house'))                        return 't-house';
    return 't-other';
  }
  function escapeHtml(s=''){return String(s).replace(/[&<>"']/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m]));}

  // Popup بطاقة بلاغ
function alertPopupHtml(a = {}) {
  const base = alertColor(a.type); // لون حسب النوع
  return `
    <div class="apm" style="--ap:${base}">
      <header class="apm-head">
        <div class="apm-title">${I('siren')}<span>${escapeHtml(a.title || a.type || 'Incident')}</span></div>
        <div class="apm-badges">
          ${a.num  ? `<span class="tag">#${escapeHtml(a.num)}</span>` : ''}
          ${a.code ? `<span class="tag ghost">${escapeHtml(a.code)}</span>` : ''}
        </div>
      </header>
      <ul class="apm-list">
        <li class="apm-row">${I('clock')}   <span><b>Time:</b> ${escapeHtml(timeAgo(a.time))}</span></li>
        ${a.street  ? `<li class="apm-row">${I('road')}    <span><b>Street:</b> ${escapeHtml(a.street)}</span></li>` : ''}
        ${a.vehicle ? `<li class="apm-row">${I('car')}     <span><b>Vehicle:</b> ${escapeHtml(a.vehicle)}</span></li>` : ''}
        ${a.plate   ? `<li class="apm-row">${I('plate')}   <span><b>Plate:</b> ${escapeHtml(a.plate)}</span></li>` : ''}
        ${a.color   ? `<li class="apm-row">${I('drop')}    <span><b>Color:</b> ${escapeHtml(a.color)}</span></li>` : ''}
        ${a.class   ? `<li class="apm-row">${I('block')}   <span><b>Class:</b> ${escapeHtml(a.class)}</span></li>` : ''}
        ${a.doors   ? `<li class="apm-row">${I('door')}    <span><b>Doors:</b> ${escapeHtml(a.doors)}</span></li>` : ''}
        ${a.heading ? `<li class="apm-row">${I('compass')} <span><b>Heading:</b> ${escapeHtml(a.heading)}</span></li>` : ''}
      </ul>
    </div>`;
}


  // Popup نقاط السرقة
  function robberyPopupHtml(r={}){
    const t = (r.type || 'Robbery');
    return `
    <div class="rp">
      <div class="rp-head">${escapeHtml(t)}</div>
      <div class="rp-body">
        <div class="rp-row">${I('road')} <b>${escapeHtml(r.name || 'Location')}</b></div>
        <div class="rp-row">${I('compass')} X: ${Number(r.x||0).toFixed(1)} &nbsp; Y: ${Number(r.y||0).toFixed(1)}</div>
      </div>
    </div>`;
  }

  // ======= Tab switching / Lifecycle =======
  async function setTab(next){
    if (tab === next) return;
    tab = next;
    if (tab === 'rules' && !rules.length) loadRules();
    if (tab === 'ops'   && !ops.length)   loadOps();
    if (tab === 'map')  await tick();
  }

  function onOpsRefresh(){ loadOps(); }

  onMount(async () => {
    if (typeof window!=='undefined') window.addEventListener('police:ops:refresh', onOpsRefresh);
    await ensureLeaflet();
    initMap();
    await loadRobberies();
    renderMarkers();
    addDemoAlerts(); // ديمو للبلاغات
  });

  onDestroy(() => {
    if (typeof window!=='undefined') window.removeEventListener('police:ops:refresh', onOpsRefresh);
  });

  // تحديث من اللعبة (اختياري)
  if (typeof window !== 'undefined') {
    window.addEventListener('police:robberies:refresh', () => {
      loadRobberies().then(renderMarkers);
    });
    // window.dispatchEvent(new CustomEvent('police:alert:add', { detail:{...} }))
    window.addEventListener('police:alert:add', (ev) => addAlert(ev?.detail));
  }


  function headerIcon(type=''){
  const k = String(type).toLowerCase();
  if (k.includes('car') || k.includes('vehicle')) return 'car';
  if (k.includes('store') || k.includes('rob'))   return 'store';
  if (k.includes('bank'))                         return 'bank';
  if (k.includes('house'))                        return 'house';
  return 'compass';
}

</script>


<section class="police">
  <header class="p-header">
    <div class="h-left">
      <img class="h-icon" src="https://images.dz-crew.com/tablet/icons/rb_2401.png" alt="Police" />
      <div class="h-titles">
        <h2 class="title">Police App</h2>
        <p class="sub">Standard procedures & active operations</p>
      </div>
    </div>
    <nav class="tabs">
      <button class="tab {tab==='rules' ? 'active' : ''}" on:click={() => setTab('rules')}>Rules</button>
      <button class="tab {tab==='ops'   ? 'active' : ''}"   on:click={() => setTab('ops')}>Operations</button>
      <button class="tab {tab==='map'   ? 'active' : ''}"   on:click={() => setTab('map')}>Map</button>
    </nav>
  </header>

  <div class="content">
    {#if loading}
      <div class="muted">Loading…</div>
    {:else if error}
      <div class="muted">{error}</div>
    {:else}
      {#if tab === 'rules'}
        <section class="rules">
          <div class="rules-toolbar">
            <input
              class="rules-search"
              type="text"
              placeholder="Search rules…"
              bind:value={ruleQuery}
              aria-label="Search rules"
            />
            <div class="rules-count">
              {filteredRules.length} / {rules.length || 0}
            </div>
          </div>

          {#if !filteredRules.length}
            <div class="muted">No rules found.</div>
          {:else}
            <div class="rule-grid">
              {#each filteredRules as r, i}
                <div class="rule-card">
                  <div class="rule-head">
                    <span class="r-num">{i + 1}</span>
                    <h3 class="r-title">{r?.title || 'Untitled rule'}</h3>
                  </div>
                  <div class="rule-body">
                    <p class="r-text">{r?.body || ''}</p>
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </section>

      {:else if tab === 'map'}
        <section class="robbery-map-wrap">
          <!-- Alerts panel -->
<!-- Alerts panel -->
<!-- Alerts panel (dispatch style) -->
      <div class="alerts-list fontstyelnew">
        {#if !alerts.length}
          <div class="muted small">No alerts.</div>
        {:else}
          {#each alerts as a, i (a.id)}
            <article class="dispatch-card" on:click={() => focusAlert(a)} title="Focus on map">
              <div class="accent"></div>

              <header class="dc-head">
                <h4 class="dc-title">
                  {@html I('siren')}
                  <span>{a.title || a.type || 'Incident'}</span>
                </h4>

                <div class="dc-right">
                  {@html I(headerIcon(a.type))}
                </div>

                <div class="dc-badges">
                  {#if a.num}<span class="badge id-tag">#{a.num}</span>{/if}
                  {#if a.code}<span class="badge ghost erekbtn">{a.code}</span>{/if}
                </div>
              </header>

              <div class="dc-body">
                <ul class="dc-lines">
                  <li class="dc-line">{@html I('clock')}   <span><b>Time:</b> {timeAgo(a.time)}</span></li>
                  {#if a.street}  <li class="dc-line">{@html I('road')}    <span><b>Street:</b> {a.street}</span></li>{/if}
                  {#if a.vehicle} <li class="dc-line">{@html I('car')}     <span><b>Vehicle:</b> {a.vehicle}</span></li>{/if}
                  {#if a.plate}   <li class="dc-line">{@html I('plate')}   <span><b>Plate:</b> {a.plate}</span></li>{/if}
                  {#if a.color}   <li class="dc-line">{@html I('drop')}    <span><b>Color:</b> {a.color}</span></li>{/if}
                  {#if a.class}   <li class="dc-line">{@html I('block')}   <span><b>Class:</b> {a.class}</span></li>{/if}
                  {#if a.doors}   <li class="dc-line">{@html I('door')}    <span><b>Doors:</b> {a.doors}</span></li>{/if}
                  {#if a.heading} <li class="dc-line">{@html I('compass')} <span><b>Heading:</b> {a.heading}</span></li>{/if}
                </ul>

                {#if i === 0}
                  <div class="respond">
                    <span class="respond-pill">[E] Respond</span>
                  </div>
                {/if}
              </div>
            </article>
          {/each}
        {/if}
      </div>



          <!-- Toolbar -->
          <div class="rob-toolbar">
            <input
              class="rob-search"
              type="text"
              placeholder="Search type or name… (e.g. bank / store / atm)"
              bind:value={robQuery}
              aria-label="Search robberies"
            />
            <select class="rob-type" bind:value={robType} aria-label="Filter by type">
              <option value="all">All</option>
              <option value="bank">Bank</option>
              <option value="store">Store</option>
              <option value="house">House</option>
              <option value="atm">ATM</option>
            </select>
            <button class="rob-refresh" on:click={() => { loadRobberies().then(renderMarkers); }}>↻ Refresh</button>
          </div>

          <!-- Map -->
          {#if robLoading}
            <div class="muted">Loading robberies…</div>
          {:else if robError}
            <div class="muted">{robError}</div>
          {:else}
            <div bind:this={mapEl} class="robbery-map"></div>
            <div class="rob-legend">
              <span class="lg"><i style="background:#ff5252"></i> Bank</span>
              <span class="lg"><i style="background:#4caf50"></i> Store</span>
              <span class="lg"><i style="background:#ff9800"></i> House</span>
              <span class="lg"><i style="background:#3f51b5"></i> ATM</span>
              <span class="lg"><i style="background:#00d1f5"></i> Other</span>
            </div>
          {/if}
        </section>

      {:else}
        <div class="ops-grid">
          {#if !ops.length}
            <div class="muted">No active operations.</div>
          {:else}
            {#each ops as o}
              {@const members = Array.isArray(o?.members) ? o.members : []}
              {@const cnt = members.length}
              {@const amMember = members.some(isMe)}

              <article class="opcard {amMember ? 'is-joined' : ''} {o.max && cnt > o.max ? 'is-over' : ''}">
                <div class="op-head">
                  <div class="op-title">
                    <img class="op-icon" src="https://images.dz-crew.com/tablet/icons/rb_2401.png" alt="op" />
                    <div>
                      <h3 title={o?.name || 'Operation'}>{o?.name || 'Operation'}</h3>
                      <div class="op-sub">
                        <span class="dot dot--ok"></span>
                        <span>Channel {o?.channel}</span>
                      </div>
                    </div>
                  </div>
                  <div class="op-stat">
                    <div class="op-count">{cnt}{#if o.max} / {o.max}{/if}</div>
                    <div class="op-count-label">Members</div>
                  </div>
                </div>

                <div class="op-body">
                  {#if !cnt}
                    <div class="muted small">No members</div>
                  {:else}
                    <ul class="member-list">
                      {#each members as m}
                        <li class="member">
                          <div class="avatar">{(m?.name || 'U').slice(0,2).toUpperCase()}</div>
                          <div class="m-meta">
                            <div class="m-name" title={m?.name || 'Unknown'}>{m?.name || 'Unknown'}</div>
                            <div class="m-sub">{m?.rank || 'Officer'}</div>
                          </div>
                          <span class="m-state"><span class="dot dot--ok"></span>Online</span>
                        </li>
                      {/each}
                    </ul>
                  {/if}
                </div>

                <div class="op-foot">
                  {#if amMember}
                    <button class="btn-ghost" disabled>Joined</button>
                    <button class="btn-danger" on:click={() => leave(o.name)}>⟲ Leave Operation</button>
                  {:else}
                    <button class="btn-success" on:click={() => join(o)}>＋ Join Operation</button>
                  {/if}
                </div>
              </article>
            {/each}
          {/if}
        </div>
      {/if}
    {/if}
  </div>
</section>

<style>
  :root { --font: ui-sans-serif, system-ui, Segoe UI, Roboto, Helvetica, Arial; }

  .police{ display:flex; flex-direction:column; gap:10px; }
  .p-header{ display:flex; align-items:center; justify-content:space-between; border:1px solid var(--border); border-radius:10px; background: var(--surface); padding:10px 12px; }
  .h-left{ display:flex; align-items:center; gap:10px; }
  .h-icon{ width:40px; height:40px; object-fit:contain; }
  .title{ margin:0; font:900 16px/1.1 var(--font); color:#cfe8ff; }
  .sub{ margin:0; color: var(--text-secondary); font:600 12px/1.3 var(--font); }
  .tabs{ display:flex; gap:6px; }
  .tab{ height:28px; padding:0 12px; border:1px solid var(--border); border-radius:999px; background: var(--surface-elevated); color: var(--text-secondary); font:800 11.5px/1 var(--font); cursor:pointer; transition:.15s ease; }
  .tab:hover{ border-color: var(--accent); color: var(--accent); transform: translateY(-1px); }
  .tab.active{ border-color: var(--accent); color: var(--accent); }

  .content{ border:1px solid var(--border); border-radius:10px; background: var(--surface); padding:10px; overflow:auto; min-height:78vh; display:flex; flex-direction:column; }
  .muted{ color:#a5b4c3; padding:10px; }
  .small{ font-size:12px; }

  /* ===== Ops ===== */
  .ops-grid{ display:grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap:12px; }
  .opcard{ border:1px solid var(--border); border-radius:12px; background: rgba(255,255,255,.02); overflow:hidden; box-shadow: 0 8px 20px rgba(0,0,0,.25); display:flex; flex-direction:column; transition: border-color .15s ease, transform .12s ease; }
  .opcard:hover{ transform: translateY(-1px); border-color: rgba(255,255,255,.18); }
  .opcard.is-joined{ border-color: rgba(0,212,255,.28); }
  .opcard.is-over{ border-color: rgba(255, 120, 120, .35); }
  .op-head{ display:flex; align-items:center; justify-content:space-between; padding:10px 12px; background: linear-gradient(180deg, rgba(0, 104, 171, .65), rgba(0, 45, 78, .65)); border-bottom: 1px solid rgba(255,255,255,.08); }
  .opcard.is-over .op-head{ background: linear-gradient(180deg, rgba(120,0,0,.6), rgba(60,0,0,.6)); }
  .op-title{ display:flex; align-items:center; gap:10px; min-width:0; }
  .op-icon{ width:36px; height:36px; object-fit:contain; filter: drop-shadow(0 2px 4px rgba(0,0,0,.35)); }
  .op-title h3{ margin:0; font:800 14px/1.1 var(--font); color:#eaf7ff; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .op-sub{ display:flex; align-items:center; gap:6px; color:#cfe8ff; font:700 11px/1 var(--font); opacity:.9; }
  .dot{ width:8px; height:8px; border-radius:50%; display:inline-block; }
  .dot--ok{ background:#41d494; box-shadow:0 0 0 2px rgba(65,212,148,.25); }
  .op-stat{ text-align:right; }
  .op-count{ font:900 18px/1 var(--font); color:#ffffff; text-shadow:0 1px 0 rgba(0,0,0,.35); }
  .op-count-label{ color:#cfe8ff; font:700 10px/1 var(--font); opacity:.85; }
  .op-body{ padding:10px 12px; background: var(--surface); }
  .member-list{ list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:8px; }
  .member{ display:flex; align-items:center; gap:10px; padding:8px; border:1px solid var(--border); border-radius:10px; background: var(--surface-elevated); }
  .avatar{ width:28px; height:28px; border-radius:6px; display:grid; place-items:center; background: linear-gradient(135deg, var(--accent), #0f2533); color:#fff; font:800 11px/1 var(--font); border:1px solid rgba(255,255,255,.10); }
  .m-meta{ flex:1 1 auto; min-width:0; }
  .m-name{ color:#eaf2f9; font:800 12px/1 var(--font); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .m-sub{ color:#98a9b7; font:700 10px/1 var(--font); }
  .m-state{ color:#a9ffda; font:700 10px/1 var(--font); display:flex; align-items:center; gap:6px; }
  .op-foot{ display:flex; gap:8px; padding:10px 12px; border-top:1px solid var(--border); background: rgba(255,255,255,.02); }
  .op-foot .btn-success, .op-foot .btn-danger, .op-foot .btn-ghost{ flex:1 1 auto; height:34px; border-radius:8px; border:1px solid var(--border); font:800 12px/1 var(--font); cursor:pointer; display:inline-flex; align-items:center; justify-content:center; transition: transform .1s ease, filter .15s ease, border-color .15s ease; }
  .btn-success{ background: linear-gradient(180deg, #1d6c46, #0f4c31); color:#e8fff5; border-color: rgba(0,0,0,.25); }
  .btn-success:hover{ transform: translateY(-1px); filter: brightness(1.05); border-color:#2b9a6c; }
  .btn-danger{ background: linear-gradient(180deg, #7a1f25, #59161a); color:#ffe9e9; border-color: rgba(0,0,0,.25); }
  .btn-danger:hover{ transform: translateY(-1px); filter: brightness(1.04); border-color:#b94141; }
  .btn-ghost{ background: rgba(255,255,255,.03); color:#cfe0ec; }
  .btn-ghost[disabled]{ opacity:.75; cursor:default; }
  @media (max-width: 560px){ .ops-grid{ grid-template-columns: 1fr; } }

  /* ===== Rules ===== */
  .rules { display: flex; flex-direction: column; gap: 12px; }
  .rules-toolbar {
    display: flex; align-items: center; gap: 10px;
    border: 1px solid var(--border); background: var(--surface);
    border-radius: 10px; padding: 8px;
  }
  .rules-search {
    flex: 1 1 auto; height: 32px; padding: 0 10px;
    border-radius: 8px; border: 1px solid var(--border);
    background: var(--surface-elevated); color: var(--text-primary);
    font: 700 12px/1 var(--font); outline: none;
  }
  .rules-search::placeholder { color: var(--text-muted); }
  .rules-count {
    height: 28px; padding: 0 10px; border-radius: 999px;
    border: 1px solid var(--border); background: rgba(255,255,255,.03);
    color: var(--text-secondary); display: inline-flex; align-items: center;
    font: 800 11px/1 var(--font);
  }
  .rule-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; }
  .rule-card {
    display: flex; flex-direction: column; border: 1px solid var(--border);
    background: var(--surface); border-radius: 12px; overflow: hidden;
    transition: transform .12s ease, border-color .15s ease;
  }
  .rule-card:hover { transform: translateY(-2px); border-color: rgba(255,255,255,.2); }
  .rule-head {
    display: flex; align-items: center; gap: 8px; padding: 10px 12px;
    background: linear-gradient(180deg, rgba(0,104,171,.55), rgba(0,45,78,.55)); color: #eaf7ff;
  }
  .r-num {
    width: 28px; height: 28px; border-radius: 6px; display: grid; place-items: center;
    font: 900 12px/1 var(--font); color: #fff; background: linear-gradient(135deg, var(--accent), #0f2533);
    border: 1px solid rgba(255,255,255,.12);
  }
  .r-title { margin: 0; font: 800 13px/1.2 var(--font); color: #eaf7ff; flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .rule-body { padding: 10px 12px; background: var(--surface); }
  .r-text { margin: 0; color: #d8e6f2; font: 600 12.5px/1.55 var(--font); white-space: pre-wrap; }

  /* ===== Map & Alerts ===== */
@import url('https://fonts.googleapis.com/css2?family=Oswald:wght@300;400;500;600;700&display=swap');

.fontstyelnew { font-family: "Oswald", system-ui, sans-serif; }

/* قائمة */
.alerts-list{
  display:grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap:10px;
  margin-bottom:6px;
}

/* البطاقة */
.dispatch-card{
  position:relative;
  cursor:pointer;
  border:1px solid rgba(255,255,255,.08);
  border-radius:14px;
  background: radial-gradient(75% 82% at 50% 50%, #bb4848c2 0%, #572121cc 100%); /* نفس dispatch */
  color:#ffe9e9;
  box-shadow:0 10px 24px rgba(0,0,0,.35);
  transition: transform .12s ease, border-color .15s ease, box-shadow .15s ease;
  overflow:hidden;
}
.dispatch-card:hover{
  transform:translateY(-1px);
  border-color:rgba(255,160,160,.35);
  box-shadow:0 12px 28px rgba(0,0,0,.45);
}
/* شريط أحمر يسار مثل borbutminp */
.dispatch-card .accent{
  position:absolute; inset:0 auto 0 0; width:4px; background:#ff5555;
}

/* الرأس */
.dc-head{
  position:relative;
  display:grid;
  grid-template-columns: 1fr auto;
  grid-template-areas:
    "title icon"
    "badges badges";
  gap:6px 10px;
  align-items:center;
  padding:10px 12px 6px 14px;
  border-bottom:1px solid rgba(255,255,255,.08);
}
.dc-title{
  grid-area:title;
  margin:0;
  font-weight:700; font-size:14.5px; line-height:1.1;
  color:#ffd1d1;
  display:flex; align-items:center; gap:6px;
}
.dc-title .ic{ width:16px; height:16px; stroke:#ffeaea; }

.dc-right{
  grid-area:icon;
  display:flex; align-items:center; justify-content:center;
  width:28px; height:28px;
  border-radius:8px;
  background:rgba(0,0,0,.18);
  border:1px solid rgba(255,255,255,.08);
}
.dc-right .ic{ width:16px; height:16px; stroke:#ffeaea; }

.dc-badges{
  grid-area:badges;
  display:flex; gap:6px; align-items:center;
}

/* بادج الـ id والـ code (نفس ألوانك) */
.badge{
  height:22px; padding:0 8px;
  display:inline-flex; align-items:center; justify-content:center;
  border-radius:6px;
  background:rgba(255,255,255,.12);
  color:#fff; font-weight:700; font-size:11px;
  border:1px solid rgba(255,255,255,.12);
}
.badge.ghost{ background:#ff6f6f27; border-color:rgba(255,255,255,.18); }
.id-tag{ background:#ff6f6f27; color:#fff; }

/* الجسم */
.dc-body{ display:flex; }
.dc-lines{
  list-style:none; margin:0; padding:10px 12px 12px;
  flex:1 1 auto; min-width:0;
  display:grid; gap:7px;
}
.dc-line{
  display:flex; gap:8px; align-items:center;
  color:#fff; font-weight:700; font-size:12.3px; line-height:1.35;
  white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
}
.dc-line b{ font-weight:900; color:#fff; }
.dc-line .ic{ width:15px; height:15px; stroke:#ffffff; }

/* زر Respond يمين مثل السكربت */
.respond{ width:30%; display:flex; align-items:flex-end; justify-content:center; padding:10px 10px 12px 0; }
.respond-pill{
  color:#fff; background:#ff6f6f27; border:1px solid rgba(255,255,255,.1);
  border-radius:999px; padding:.25rem .6rem; font-weight:700; font-size:12px;
}

/* (اختياري) على الشاشات الصغيرة أخفِ زر Respond */
@media (max-width: 520px){ .respond{ display:none; } }
  /* .alert-card{
    cursor:pointer; border:1px solid rgba(255,255,255,.08); border-radius:12px;
    background: linear-gradient(180deg, rgba(120,0,0,.55), rgba(80,0,0,.55));
    color:#ffecec; box-shadow:0 8px 18px rgba(0,0,0,.3);
    transition: transform .12s ease, border-color .15s ease, box-shadow .15s ease; padding:10px;
  }
  .alert-card:hover{ transform:translateY(-1px); border-color:rgba(255,160,160,.35); box-shadow:0 10px 22px rgba(0,0,0,.4); } */
  /* .al-head{ display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:6px; border-bottom:1px solid rgba(255,255,255,.08); padding-bottom:6px; }
  .al-title{ margin:0; font:900 14px/1.1 var(--font); color:#fff2f2; display:flex; align-items:center; gap:6px; }
  .al-badges{ display:flex; align-items:center; gap:6px; }
  .al-badge{ height:22px; padding:0 8px; display:inline-flex; align-items:center; justify-content:center; border-radius:999px; background:rgba(255,255,255,.12); color:#fff; font:800 11px/1 var(--font); }
  .al-badge--ghost{ background:rgba(255,255,255,.06); color:#ffe2e2; border:1px solid rgba(255,255,255,.15); }
  .al-lines{ list-style:none; margin:8px 0 0; padding:0; display:grid; gap:4px; color:#ffe9e9; font:700 12px/1.35 var(--font); }
  .al-lines li{ display:flex; gap:8px; align-items:center; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .ic{ width:16px; height:16px; stroke:currentColor; fill:none; stroke-width:2; stroke-linecap:round; stroke-linejoin:round; flex:none; opacity:.95; } */

  .rob-toolbar {
    display:flex; gap:8px; align-items:center; border:1px solid var(--border);
    background: var(--surface); border-radius:10px; padding:8px;
  }
  .rob-search {
    flex:1 1 auto; height:32px; padding:0 10px; border-radius:8px;
    border:1px solid var(--border); background: var(--surface-elevated);
    color: var(--text-primary); font:700 12px/1 var(--font); outline:none;
  }
  .rob-type, .rob-refresh {
    height:32px; border-radius:8px; border:1px solid var(--border);
    background: var(--surface-elevated); color: var(--text-secondary);
    font:800 12px/1 var(--font); padding:0 10px; cursor:pointer;
  }
  .robbery-map { flex:1; min-height:60vh; border:1px solid var(--border); border-radius:10px; overflow:hidden; }
  .rob-legend{ display:flex; gap:12px; align-items:center; flex-wrap:wrap; color:var(--text-secondary); font:800 11px/1 var(--font); }
  .rob-legend .lg{ display:inline-flex; align-items:center; gap:6px; }
  .rob-legend .lg i{ width:12px; height:12px; border-radius:3px; display:inline-block; border:1px solid rgba(255,255,255,.2); }

  /* ==== Pulsing blip ==== */
  .blip { position: relative; }
  .blip-dot {
    position: absolute; left: 50%; top: 50%;
    width: 10px; height: 10px; border-radius: 50%;
    transform: translate(-50%, -50%);
  }
  .blip-ring {
    position: absolute; left: 50%; top: 50%;
    width: 10px; height: 10px; border-radius: 50%;
    border: 2px solid;
    transform: translate(-50%, -50%);
    animation: blipPulse 1.6s ease-out infinite;
  }
  @keyframes blipPulse {
    from { opacity: .9; transform: translate(-50%, -50%) scale(1); }
    to   { opacity: 0;  transform: translate(-50%, -50%) scale(2.4); }
  }

  /* ====== Popup (تصميم بطاقة بلاغ) ====== */
.alert-popup .leaflet-popup-content { margin: 0; }
.alert-popup .leaflet-popup-content-wrapper{
  background: linear-gradient(180deg, rgba(40,17,20,.96), rgba(24,10,12,.96));
  border: 1px solid rgba(255,120,120,.45);
  border-radius: 14px;
  box-shadow: 0 14px 30px rgba(0,0,0,.55);
  color: #ffe9e9;
  padding: 0;
}
.alert-popup .leaflet-popup-tip{
  background: #2a1115;
  border: 1px solid rgba(255,255,255,.12);
}

/* تلوين حسب النوع */
.alert-popup.t-store .leaflet-popup-content-wrapper,
.rob-popup.t-store .leaflet-popup-content-wrapper{ border-color:#4caf50aa; }
.alert-popup.t-bank  .leaflet-popup-content-wrapper,
.rob-popup.t-bank  .leaflet-popup-content-wrapper{ border-color:#ff5252aa; }
.alert-popup.t-house .leaflet-popup-content-wrapper,
.rob-popup.t-house .leaflet-popup-content-wrapper{ border-color:#ff9800aa; }
.alert-popup.t-other .leaflet-popup-content-wrapper,
.rob-popup.t-other .leaflet-popup-content-wrapper{ border-color:#00d1f5aa; }

/* محتوى البطاقة */
.ap-head{
  display:flex; align-items:center; justify-content:space-between; gap:8px;
  padding:10px 12px; border-bottom:1px solid rgba(255,255,255,.08);
  background: linear-gradient(180deg, rgba(175,33,45,.6), rgba(120,22,32,.5));
  border-radius: 14px 14px 0 0;
}
.ap-title{ margin:0; font:900 14px/1.1 var(--font); color:#fff2f2; display:flex; gap:6px; align-items:center; }
.ap-badges{ display:flex; gap:6px; }
.badge{ height:22px; padding:0 8px; display:inline-flex; align-items:center; justify-content:center;
  border-radius:999px; background:rgba(255,255,255,.12); color:#fff; font:800 11px/1 var(--font); }
.badge.ghost{ background:rgba(255,255,255,.06); color:#ffe2e2; border:1px solid rgba(255,255,255,.15); }
.ap-box{ padding:10px 12px 12px; }
.ap-row{ display:flex; gap:8px; align-items:center; margin:6px 0; font:700 12px/1.35 var(--font); white-space:nowrap; }
.ic{ width:14px; height:14px; stroke:currentColor; fill:none; stroke-width:2; stroke-linecap:round; stroke-linejoin:round; opacity:.95; }

/* ====== Popup للسرقات (نفس روح البطاقة) ====== */
.rob-popup .leaflet-popup-content { margin: 0; }
.rob-popup .leaflet-popup-content-wrapper{
  background: linear-gradient(180deg, rgba(6,24,36,.96), rgba(4,16,26,.96));
  border:1px solid rgba(0,200,255,.35);
  border-radius:12px; box-shadow:0 12px 26px rgba(0,0,0,.5); color:#eaf7ff; padding:0;
}
.rob-popup .leaflet-popup-tip{
  background:#081a26; border:1px solid rgba(0,200,255,.25);
}
.rp-head{ padding:10px 12px; border-bottom:1px solid rgba(255,255,255,.08); font:900 13px/1.1 var(--font); color:#eaf7ff; }
.rp-body{ padding:10px 12px 12px; font:700 12px/1.35 var(--font); }
.rp-row{ display:flex; gap:8px; align-items:center; margin:6px 0; }


/* ====== GLOBAL rules for Leaflet popups & blips & icons ====== */
:global(.leaflet-container .leaflet-popup-content) { margin: 0; }

/* بطاقات البلاغ (alerts) */
:global(.alert-popup .leaflet-popup-content-wrapper){
  background: linear-gradient(180deg, rgba(40,17,20,.96), rgba(24,10,12,.96));
  border: 1px solid rgba(255,120,120,.45);
  border-radius: 14px;
  box-shadow: 0 14px 30px rgba(0,0,0,.55);
  color: #ffe9e9;
  padding: 0;
}
:global(.alert-popup .leaflet-popup-tip){
  background: #2a1115;
  border: 1px solid rgba(255,255,255,.12);
}

/* بطاقات نقاط السرقات */
:global(.rob-popup .leaflet-popup-content-wrapper){
  background: linear-gradient(180deg, rgba(6,24,36,.96), rgba(4,16,26,.96));
  border:1px solid rgba(0,200,255,.35);
  border-radius:12px;
  box-shadow:0 12px 26px rgba(0,0,0,.5);
  color:#eaf7ff;
  padding:0;
}
:global(.rob-popup .leaflet-popup-tip){
  background:#081a26; border:1px solid rgba(0,200,255,.25);
}

/* تلوين حسب النوع */
:global(.alert-popup.t-store .leaflet-popup-content-wrapper),
:global(.rob-popup.t-store .leaflet-popup-content-wrapper){ border-color:#4caf50aa; }
:global(.alert-popup.t-bank  .leaflet-popup-content-wrapper),
:global(.rob-popup.t-bank  .leaflet-popup-content-wrapper){ border-color:#ff5252aa; }
:global(.alert-popup.t-house .leaflet-popup-content-wrapper),
:global(.rob-popup.t-house .leaflet-popup-content-wrapper){ border-color:#ff9800aa; }
:global(.alert-popup.t-other .leaflet-popup-content-wrapper),
:global(.rob-popup.t-other .leaflet-popup-content-wrapper){ border-color:#00d1f5aa; }

/* أيقونات SVG داخل الـ popups (بدون scope) */
:global(.ic){
  width: 14px;
  height: 14px;
  stroke: currentColor;
  fill: none;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
  display: inline-block;
  vertical-align: -2px;
  opacity: .95;
}

/* blip (النبض) على الخريطة */
:global(.blip){ position: relative; }
:global(.blip-dot){
  position: absolute; left: 50%; top: 50%;
  width: 10px; height: 10px; border-radius: 50%;
  transform: translate(-50%, -50%);
}
:global(.blip-ring){
  position: absolute; left: 50%; top: 50%;
  width: 10px; height: 10px; border-radius: 50%;
  border: 2px solid;
  transform: translate(-50%, -50%);
  animation: blipPulse 1.6s ease-out infinite;
}
@keyframes blipPulse {
  from { opacity: .9; transform: translate(-50%, -50%) scale(1); }
  to   { opacity: 0;  transform: translate(-50%, -50%) scale(2.4); }
}


/* ==== 3D Blip wrapper ==== */
:global(.blip3d-wrap){ will-change: transform; transition: transform .15s ease, filter .15s ease; }
:global(.blip3d-wrap.is-open){ transform: translateY(-2px) scale(1.05); filter: drop-shadow(0 6px 14px rgba(0,0,0,.4)); }
:global(.blip3d){ display:block; pointer-events:none; }

/* نبض خفيف حول الـ pin (اختياري) */
:global(.blip3d-wrap::after){
  content:""; position:absolute; left:50%; top:50%;
  width:12px; height:12px; border-radius:999px; border:2px solid rgba(255,255,255,.25);
  transform:translate(-50%,-40%); animation: blipPulse 1.8s ease-out infinite;
}
@keyframes blipPulse{
  0%{ opacity:.6; transform:translate(-50%,-40%) scale(1); }
  100%{ opacity:0; transform:translate(-50%,-40%) scale(2.4); }
}

/* popups تبعك بقيت كما هي (مع :global) */
:global(.alert-popup .leaflet-popup-content){ margin:0; }
:global(.alert-popup .leaflet-popup-content-wrapper){
  background: rgba(40,17,20,.96);
  border: 1px solid rgba(255,120,120,.45);
  border-radius: 14px;
  box-shadow: 0 14px 30px rgba(0,0,0,.55);
  color: #ffe9e9; padding:0;
}
:global(.alert-popup .leaflet-popup-tip){
  background:#2a1115; border:1px solid rgba(255,255,255,.12);
}

/* === Alerts (card like your screenshot) === */
.alerts-list{
  display:grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap:10px;
  margin-bottom:6px;
}

.alert-card{
  cursor:pointer;
  border:1px solid rgba(255,255,255,.08);
  border-radius:14px;
  background: linear-gradient(180deg, rgba(124,31,39,.92), rgba(66,17,22,.92));
  color:#ffe9e9;
  box-shadow:0 10px 24px rgba(0,0,0,.35);
  transition: transform .12s ease, border-color .15s ease, box-shadow .15s ease;
  overflow:hidden;
}
.alert-card:hover{
  transform:translateY(-1px);
  border-color:rgba(255,160,160,.35);
  box-shadow:0 12px 28px rgba(0,0,0,.45);
}

.al-head{
  position:relative;
  display:grid;
  grid-template-columns: 1fr auto;
  grid-template-areas:
    "title icon"
    "badges badges";
  gap:6px 10px;
  align-items:center;
  padding:10px 12px 6px;
  border-bottom:1px solid rgba(255,255,255,.08);
}
.al-title{
  grid-area:title;
  margin:0;
  font:900 14.5px/1.1 var(--font);
  color:#ffd1d1;             /* عنوان وردي فاتح */
  display:flex;
  align-items:center;
  gap:6px;
}
.al-right{
  grid-area:icon;
  display:flex; align-items:center; justify-content:center;
  width:28px; height:28px;
  border-radius:8px;
  background:rgba(0,0,0,.18);
  border:1px solid rgba(255,255,255,.08);
}
.al-right .ic{ width:16px; height:16px; stroke:#ffeaea; }

.al-badges{
  grid-area:badges;
  display:flex; gap:6px; align-items:center;
}
.al-badge{
  height:22px; padding:0 8px;
  display:inline-flex; align-items:center; justify-content:center;
  border-radius:999px;
  background:rgba(255,255,255,.12);
  color:#fff;
  font:800 11px/1 var(--font);
  border:1px solid rgba(255,255,255,.12);
}
.al-badge--ghost{
  background:rgba(255,255,255,.06);
  color:#ffe2e2;
  border-color:rgba(255,255,255,.18);
}

.al-body{
  list-style:none;
  margin:0; padding:10px 12px 12px;
  display:grid; gap:7px;
}
.al-line{
  display:flex; gap:8px; align-items:center;
  color:#fff; font:700 12.3px/1.35 var(--font);
  white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
}
.al-line b{ font-weight:900; color:#fff; }
.ic{ width:15px; height:15px; stroke:#ffffff; fill:none; stroke-width:2; stroke-linecap:round; stroke-linejoin:round; opacity:.95; }

/* خط واضح مثل dispatch */
@import url('https://fonts.googleapis.com/css2?family=Oswald:wght@400;600;700&display=swap');

/* Leaflet wrappers */
:global(.alert-modern .leaflet-popup-content){ margin:0; }
:global(.alert-modern .leaflet-popup-content-wrapper){
  background: linear-gradient(180deg, rgba(32,12,14,.92), rgba(20,8,10,.94));
  backdrop-filter: blur(4px);
  border: 1px solid color-mix(in oklab, var(--ap, #ff5555) 60%, #ffffff 0%);
  border-radius: 14px;
  box-shadow: 0 18px 36px rgba(0,0,0,.5);
  padding: 0;
}
:global(.alert-modern .leaflet-popup-tip){
  background: rgba(20,8,10,.94);
  border: 1px solid color-mix(in oklab, var(--ap, #ff5555) 50%, #ffffff 0%);
}

/* محتوى البطاقة */
:global(.alert-modern .apm){
  --ap: #ff5555; /* يتغير inline من الدالة */
  font-family: "Oswald", system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
  color:#ffeceb;
  letter-spacing:.2px;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}

:global(.alert-modern .apm-head){
  display:flex; align-items:center; justify-content:space-between; gap:10px;
  padding:10px 12px 8px;
  border-bottom:1px solid rgba(255,255,255,.08);
  background: linear-gradient(180deg, color-mix(in oklab, var(--ap) 22%, transparent), transparent);
  border-radius: 14px 14px 0 0;
}
:global(.alert-modern .apm-title){
  margin:0; display:flex; align-items:center; gap:6px;
  font-weight:700; font-size:14.5px; line-height:1.1; color:#ffd1d1;
}
:global(.alert-modern .apm-title .ic){ width:16px; height:16px; stroke:#ffeaea; }

:global(.alert-modern .apm-badges){ display:flex; gap:6px; }
:global(.alert-modern .tag){
  height:22px; padding:0 8px; display:inline-flex; align-items:center; justify-content:center;
  border-radius:6px; border:1px solid rgba(255,255,255,.14);
  background: color-mix(in oklab, var(--ap) 22%, transparent);
  color:#fff; font-weight:700; font-size:11px;
}
:global(.alert-modern .tag.ghost){
  background: rgba(255,255,255,.06);
}

:global(.alert-modern .apm-list){
  list-style:none; margin:0; padding:10px 12px 12px;
  display:grid; gap:6px;
}
:global(.alert-modern .apm-row){
  display:flex; gap:8px; align-items:center;
  font-weight:650; font-size:12.5px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
}
:global(.alert-modern .apm-row b){ font-weight:900; color:#fff; }
:global(.alert-modern .apm-row .ic){ width:15px; height:15px; stroke:#ffffff; }

/* (اختياري) تلوين حسب النوع لو تحب تبقيه */
:global(.alert-modern.t-store .leaflet-popup-content-wrapper){ border-color:#4caf50aa; }
:global(.alert-modern.t-bank  .leaflet-popup-content-wrapper){ border-color:#ff5252aa; }
:global(.alert-modern.t-house .leaflet-popup-content-wrapper){ border-color:#ff9800aa; }
:global(.alert-modern.t-other .leaflet-popup-content-wrapper){ border-color:#00d1f5aa; }

</style>
