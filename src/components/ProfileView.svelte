<script>
  import { onMount, onDestroy } from 'svelte';
  import { postJSON } from '../lib/nui';

  export let playerName = 'Citizen';
  export let playerState = {};

  // 🧑‍🎨 Initials avatar
  $: initials = (playerName || 'C')
    .split(' ')
    .map(s => s[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const money = (n) => '$' + Number(n || 0).toLocaleString();

  /* ===== XP ===== */
  const SEGMENTS = 12; // عدد القطاعات في شريط التقدّم

  function toSegments(cur, need, n = SEGMENTS) {
    if (!need || need <= 0) return Array.from({ length: n }, () => 0);
    const r = Math.max(0, Math.min(1, cur / need));
    const total = r * n;
    const full  = Math.floor(total);
    const part  = total - full;
    return Array.from({ length:n }, (_,i)=> (i<full?1:(i===full?part:0)));
  }

  let xpEntries = [];
  let xpLoading = true;
  let xpError = '';

  function normalizeXP(payload){
    if (payload && typeof payload === 'object' && 'data' in payload) payload = payload.data;

    const build = (key, d, idx=0) => {
      const label = d?.label || key || `Category ${idx+1}`;
      const xp    = Number(d?.xp || 0);
      const lvl   = Number(d?.level || 0);
      const need  = Math.max(1, Number(d?.level_xp || 1));
      const cur   = xp % need;
      const pct   = Math.max(0, Math.min(100, Math.floor((cur/need)*100)));
      const seg   = toSegments(cur, need, SEGMENTS);
      const safeKey = key && key !== '' ? key : (label || `cat_${idx+1}`);
      return { key:safeKey, label, xp, lvl, need, cur, pct, seg };
    };

    if (Array.isArray(payload)) return payload.map((d,i)=>build(d?.key||d?.label, d, i));
    if (payload && typeof payload === 'object') return Object.entries(payload).map(([k,d],i)=>build(k,d,i));
    return [];
  }

  async function loadXP(){
    xpLoading = true; xpError = '';
    try{
      const res = await postJSON('getXPData', {});   // ✅ JSON جاهز
      const entries = normalizeXP(res);
      entries.sort((a,b)=> (b.xp||0) - (a.xp||0));
      xpEntries = entries;
      if (!entries.length) xpError = 'No XP categories.';
    }catch(e){
      console.error('[Profile] getXPData error:', e);
      xpError = 'Failed to load XP data';
    }finally{
      xpLoading = false;
    }
  }

  onMount(loadXP);

  // 📡 تحديث فوري عند وصول Push event من السيرفر
  const onPush = (e)=>{
    const entries = normalizeXP(e.detail || {});
    entries.sort((a,b)=> (b.xp||0) - (a.xp||0));
    xpEntries = entries;
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('tablet:xp:update', onPush);
  }

  onDestroy(()=>{
    if (typeof window !== 'undefined') {
      window.removeEventListener('tablet:xp:update', onPush);
    }
  });
</script>

<!-- ===== MINI HEADER (تصميم جديد، صغير جدًا) ===== -->
<section class="mini-header">
  <div class="ava" title={playerName}>{initials}</div>
  <div class="meta">
    <div class="h-name">{playerName}</div>
    <div class="h-tags">
      <span class="tag">{playerState?.job || 'Unemployed'}</span>
      <span class="tag {playerState?.onDuty ? 'ok' : 'warn'}">
        {playerState?.onDuty ? 'On Duty' : 'Off Duty'}
      </span>
      <span class="tag">{playerState?.gang || 'No Gang'}</span>
    </div>
  </div>
</section>

<!-- ===== Identity ===== -->
<h4 class="section-title">Identity</h4>
<section class="stats">
  <div class="stat">
    <div class="k">Citizen ID</div>
    <div class="v">#{playerState?.id ?? '—'}</div>
  </div>
  <div class="stat">
    <div class="k">Cash</div>
    <div class="v">{money(playerState?.money)}</div>
  </div>
  <div class="stat">
    <div class="k">Bank</div>
    <div class="v emph">{money(playerState?.bank)}</div>
  </div>
</section>

<!-- ===== Skills & XP ===== -->
<h4 class="section-title">Skills &amp; XP</h4>
<section class="xp-wrap">
  <div class="xp-head">
    <button class="btn" on:click={loadXP} aria-label="Refresh">↻ Refresh</button>
  </div>

  {#if xpLoading}
    <div class="muted">Loading XP…</div>
  {:else if xpError}
    <div class="muted">{xpError}</div>
  {:else}
    <div class="skills-grid">
      {#each xpEntries as e (e.key)}
        <article class="skill">
          <header class="skill-top">
            <div class="label" title={e.label}>{e.label}</div>
            <div class="lvl">Lv {e.lvl}</div>
          </header>

          <!-- Progress segmented -->
          <div class="segbar" style="--n:{SEGMENTS}">
            {#each e.seg as f}
              <span class="seg"><span class="fill" style="--f:{f}"></span></span>
            {/each}
          </div>

          <footer class="meta-row">
            <span class="mchip">{e.cur.toLocaleString()} / {e.need.toLocaleString()} XP</span>
            <span class="mchip">{e.pct}%</span>
            <span class="mchip strong">{e.xp.toLocaleString()} XP</span>
          </footer>
        </article>
      {/each}
    </div>
  {/if}
</section>

<style>
  /* محاذاة أرقام ممتازة للأرقام */
  .skills-grid, .lvl, .meta-row, .mchip {
    font-variant-numeric: tabular-nums;
    font-feature-settings: "tnum" 1, "lnum" 1;
  }

  /* ===== MINI HEADER جديد ===== */
  .mini-header{
    display:flex; align-items:center; gap:10px;
    padding:6px 10px;
    border:1px solid var(--border);
    border-radius:10px;
    background: rgba(255,255,255,.02);
  }
  .ava{
    width:36px; height:36px; border-radius:50%;
    display:grid; place-items:center;
    color:#fff; font:800 13px/1 var(--font);
    background: linear-gradient(135deg, var(--accent), #0f2533);
    border:1px solid var(--border);
  }
  .h-name{
    font:800 16px/1.1 var(--font);
    letter-spacing:.2px;
    margin-bottom:4px;
  }
  .h-tags{ display:flex; gap:6px; flex-wrap:wrap; }
  .tag{
    height:18px; padding:0 8px;
    display:inline-flex; align-items:center; justify-content:center;
    border-radius:8px;
    border:1px solid var(--border);
    background: rgba(255,255,255,.015);
    color: rgba(255,255,255,.9);
    font:700 10px/1 var(--font);
    letter-spacing:.2px;
  }
  .tag.ok{ border-color:#2b9a6c; color:#bdf2dc; }
  .tag.warn{ border-color:#8a3f3f; color:#f3c7c7; }

  /* ===== عناوين الأقسام ===== */
  .section-title{
    margin:12px 2px 8px;
    font:800 12px/1 var(--font);
    letter-spacing:.25px;
    color:#a9c7e2;
    text-transform:uppercase;
  }

  /* ===== Identity Stats ===== */
  .stats{
    display:grid;
    grid-template-columns: repeat(3, 1fr);
    gap:10px;
  }
  .stat{
    border:1px solid var(--border);
    border-radius:10px;
    background: rgba(255,255,255,.02);
    padding:10px 12px;
  }
  .stat .k{ color: var(--text-muted); font-weight:600; margin-bottom:4px; }
  .stat .v{ font:800 13px/1 var(--font); color: var(--text-primary); }
  .stat .v.emph{ color:#d9fff6; }

  /* ===== XP ===== */
  .xp-wrap{
    border:1px solid var(--border);
    border-radius:10px;
        background:
      radial-gradient(80% 70% at 25% 20%, rgba(255, 255, 255, 0.082), transparent 55%),
      linear-gradient(180deg, #2b313800 0%, #14181d00 100%);
    padding:10px;
  }
  .xp-head{ display:flex; justify-content:flex-end; margin-bottom:10px; }
  .btn{
    height:24px; padding:0 10px;
    border:1px solid var(--border); border-radius:999px;
    background: rgba(255,255,255,.02);
    color: var(--text-secondary); font:700 11px/1 var(--font);
    cursor:pointer; transition: all .15s ease;
  }
  .btn:hover{ border-color: var(--accent); color: var(--accent); transform: translateY(-1px); }

  .skills-grid{
    display:grid;
    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
    gap:10px;
  }
  .skill{
    border:1px solid var(--border);
    border-radius:10px;
    background: rgba(255,255,255,.02);
    padding:10px;
    transition: border-color .15s ease, transform .12s ease;
  }
  .skill:hover{ border-color: rgba(255,255,255,.20); transform: translateY(-1px); }

  .skill-top{
    display:flex; align-items:center; justify-content:space-between; gap:8px;
    margin-bottom:8px;
  }
  .label{
    font:800 12.5px/1 var(--font);
    color: #b1b1b1;
    white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
  }
  .lvl{
    font:800 10.5px/1 var(--font);
    color:#bdeaff;
    padding:3px 7px; border-radius:999px;
    border:1px solid rgba(0,212,255,.32);
    background: rgba(0,212,255,.06);
  }

  /* progress segmented */
  .segbar{
    --n: 12;
    display:grid;
    grid-template-columns: repeat(var(--n), 1fr);
    gap:4px;
    height:9px;
    margin-bottom:6px;
  }
  .seg{
    position:relative; border-radius:2px; overflow:hidden;
    background: rgba(255,255,255,.06);
    outline: 1px solid rgba(255,255,255,.10);
  }
  .seg .fill{
    position:absolute; inset:0;
    width: calc(var(--f) * 100%);
    background: linear-gradient(90deg, var(--accent), #1b9bd1);
    border-radius: inherit;
  }

  .meta-row{
    display:flex; align-items:center; gap:6px; flex-wrap:wrap;
  }
  .mchip{
    height:20px; padding:0 8px;
    display:inline-flex; align-items:center; justify-content:center;
    border-radius:8px;
    border:1px solid var(--border);
    background: rgba(255,255,255,.015);
    color:#cfe0ec; font:700 10.5px/1 var(--font);
  }
  .mchip.strong{ color:#e9f6ff; border-color: rgba(255,255,255,.22); }

  /* Responsive */
  @media (max-width: 960px){ .stats{ grid-template-columns: 1fr 1fr; } }
  @media (max-width: 680px){
    .mini-header{ padding:6px 8px; }
    .ava{ width:32px; height:32px; font-size:12px; }
    .h-name{ font-size:14px; }
    .tag{ height:16px; padding:0 6px; font-size:9.8px; }
    .stats{ grid-template-columns: 1fr; }
  }
</style>
