<script>
  import { onMount, onDestroy } from 'svelte';
  import { postJSON } from '../lib/nui';

  // ================== الحالة ==================
  let items = [];          // [{ material, percentage }]
  let query = '';
  let showOnlyLow = false;
  let loading = false;
  let error = '';

  // إحصائيات
  $: totalCount   = items.length;
  $: lowCount     = items.filter(r => Number(r.percentage) < 50).length;
  $: criticalCount= items.filter(r => Number(r.percentage) < 20).length;

  // فلترة
  $: filtered = items
    .filter(r => r?.material?.toLowerCase().includes(String(query).toLowerCase()))
    .filter(r => showOnlyLow ? Number(r.percentage) < 50 : true)
    .sort((a,b) => (a.material||'').localeCompare(b.material||''));

  // ألوان حسب النسبة
  function colorFor(pct){
    const n = Number(pct) || 0;
    if (n >= 80) return 'linear-gradient(90deg,#2ecc71,#23bf8f)';
    if (n >= 50) return 'linear-gradient(90deg,#ffdd55,#f2b705)';
    if (n >= 20) return 'linear-gradient(90deg,#ff9a3c,#ff6a00)';
    return 'linear-gradient(90deg,#ff5967,#c0392b)';
  }

  // ===== شريط تقدم segmented مثل ProfileView =====
  const SEGMENTS = 12;
  function toSegments(percentage, n = SEGMENTS){
    const r = Math.max(0, Math.min(1, (Number(percentage)||0)/100));
    const total = r*n;
    const full  = Math.floor(total);
    const part  = total - full;
    return Array.from({ length:n }, (_,i)=> (i<full?1:(i===full?part:0)));
  }

  // ================== NUI ==================
  function onMessage(ev){
    const d = ev.data || {};
    if (d.type === 'updateItems'){
      try {
        items = Array.isArray(d.items) ? d.items : JSON.parse(d.items||'[]');
      } catch { items = []; }
    }
    // يمكن فتح هذه الصفحة من app.svelte عبر view='factory'
  }

  async function refresh(){
    // إن كان لديك callback من الـLua لقراءة المخزون الحالي، فعِّله هنا
    // مثال: 
    const res = await postJSON('factory:getItems', {});
    
    items = res?.items || [];
    // لو ما عندك، خلّيها ديمو أو تجاهل الزر
    if (import.meta.env.DEV) loadDemo(); // ديمو للويب
  }

  function loadDemo(){
    loading = true; error='';
    setTimeout(()=>{
      items = [
        { material:'steel',     percentage: 86.7 },
        { material:'rubber',    percentage: 41.5 },
        { material:'copper',    percentage: 63.2 },
        { material:'glass',     percentage: 18.9 },
        { material:'aluminium', percentage: 52.0 },
        { material:'silicon',   percentage: 8.0  },
        { material:'plastic',   percentage: 74.5 },
        { material:'carbon',    percentage: 22.0 },
      ];
      loading = false;
    }, 250);
  }

  function closeWindow(){
    fetch(`https://${GetParentResourceName?.() || 'debug'}/closeUI`, { method:'POST' }).catch(()=>{});
  }

  onMount(()=>{
    window.addEventListener('message', onMessage);
    if (import.meta.env.DEV) loadDemo();
  });
  onDestroy(()=> window.removeEventListener('message', onMessage));
  refresh();
</script>

<!-- ===== MINI HEADER (مطابق روح ProfileView) ===== -->
<section class="mini-header">
  <div class="ava" title="Factory">FN</div>
  <div class="meta">
    <div class="h-name">Factory Needs</div>
    <div class="h-tags">
      <span class="tag">Live Stock Monitor</span>
      <span class="tag ok">Synced</span>
      <span class="tag">Materials</span>
    </div>
  </div>
  <div class="header-actions">
    <!-- <button class="btn small" on:click={refresh}>↻ Refresh</button> -->
    <!-- <button class="btn small danger" on:click={closeWindow}>✕ Close</button> -->
  </div>
</section>

<!-- ===== لوحة إحصائيات بسيطة (مثل Identity) ===== -->
<h4 class="section-title">Overview</h4>
<section class="stats">
  <div class="stat">
    <div class="k">Total Materials</div>
    <div class="v">{totalCount}</div>
  </div>
  <div class="stat">
    <div class="k">Low (&lt; 50%)</div>
    <div class="v">{lowCount}</div>
  </div>
  <div class="stat">
    <div class="k">Critical (&lt; 20%)</div>
    <div class="v emph">{criticalCount}</div>
  </div>
</section>

<!-- ===== شريط أدوات: بحث + فلتر ===== -->
<section class="toolbar">
  <input
    class="input"
    placeholder="Search materials…"
    bind:value={query}
    aria-label="Search materials"
  />
  <label class="toggle">
    <input type="checkbox" bind:checked={showOnlyLow} />
    <span>Show &lt; 50%</span>
  </label>
</section>

<!-- ===== شبكة بطاقات المواد مع segmented bar ===== -->
<h4 class="section-title">Materials</h4>
<section class="grid">
  {#if loading}
    <div class="muted">Loading…</div>
  {:else if error}
    <div class="muted">{error}</div>
  {:else if !filtered.length}
    <div class="muted">No items found.</div>
  {:else}
    {#each filtered as r (r.material)}
      {@const seg = toSegments(r.percentage)}
      <article class="card">
        <header class="card-head">
          <div class="mat">
            <img
              class="m-img"
              alt={r.material + ' icon'}
              src={`https://images.dz-crew.com/inventory/icons/${r.material}.png`}
              on:error={(e)=> e.currentTarget.style.visibility='hidden'}
            />
            <div class="m-meta">
              <div class="m-name" title={r.material}>{r.material}</div>
              <div class="m-sub">Stock level</div>
            </div>
          </div>
          <div class="pct" title="Percentage">{Number(r.percentage).toFixed(1)}%</div>
        </header>

        <div class="segbar" style="--n:{SEGMENTS}">
          {#each seg as f}
            <span class="seg">
              <span class="fill" style="--f:{f}; background:{colorFor(r.percentage)};"></span>
            </span>
          {/each}
        </div>

        <footer class="meta-row">
          <span class="mchip">Thresholds: 50% / 20%</span>
          {#if Number(r.percentage) < 20}
            <span class="mchip danger">Critical</span>
          {:else if Number(r.percentage) < 50}
            <span class="mchip warn">Low</span>
          {:else}
            <span class="mchip ok">Healthy</span>
          {/if}
        </footer>
      </article>
    {/each}
  {/if}
</section>

<style>
  /* تنسيق أرقام */
  .grid, .pct, .stats, .mchip { font-variant-numeric: tabular-nums; font-feature-settings: "tnum" 1, "lnum" 1; }

  /* ===== MINI HEADER ===== */
  .mini-header{
    display:flex; align-items:center; gap:10px;
    padding:6px 10px; border:1px solid var(--border);
    border-radius:10px; background: rgba(255,255,255,.02);
  }
  .ava{
    width:36px; height:36px; border-radius:50%;
    display:grid; place-items:center;
    color:#fff; font:800 13px/1 var(--font);
    background: linear-gradient(135deg, var(--accent), #0f2533);
    border:1px solid var(--border);
  }
  .meta{ flex:1 1 auto; }
  .h-name{ font:800 16px/1.1 var(--font); letter-spacing:.2px; margin-bottom:4px; }
  .h-tags{ display:flex; gap:6px; flex-wrap:wrap; }
  .tag{
    height:18px; padding:0 8px; display:inline-flex; align-items:center; justify-content:center;
    border-radius:8px; border:1px solid var(--border); background: rgba(255,255,255,.015);
    color: rgba(255,255,255,.9); font:700 10px/1 var(--font); letter-spacing:.2px;
  }
  .tag.ok{ border-color:#2b9a6c; color:#bdf2dc; }

  .header-actions{ display:flex; gap:6px; }

  /* ===== عناوين الأقسام ===== */
  .section-title{
    margin:12px 2px 8px; font:800 12px/1 var(--font); letter-spacing:.25px;
    color:#a9c7e2; text-transform:uppercase;
  }

  /* ===== إحصائيات ===== */
  .stats{ display:grid; grid-template-columns: repeat(3, 1fr); gap:10px; }
  .stat{
    border:1px solid var(--border); border-radius:10px; background: rgba(255,255,255,.02);
    padding:10px 12px;
  }
  .stat .k{ color: var(--text-muted); font-weight:600; margin-bottom:4px; }
  .stat .v{ font:800 13px/1 var(--font); color: var(--text-primary); }
  .stat .v.emph{ color:#d9fff6; }

  /* ===== شريط أدوات ===== */
  .toolbar{
    display:flex; gap:8px; align-items:center; margin-top:10px; margin-bottom:4px;
  }
  .input{
    flex:1 1 auto; height:34px; padding:0 10px; border:1px solid var(--border); border-radius:8px;
    background: var(--surface-elevated); color:#fff; font:700 12px/1 var(--font); outline:none;
  }
  .toggle{
    display:inline-flex; align-items:center; gap:8px; color:#cfe0ec; font:700 12px/1 var(--font);
  }
  .toggle input{ transform: translateY(1px); }

  /* ===== شبكة المواد ===== */
  .grid{ display:grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap:10px; }
  .muted{ color:#9fb0bd; padding:10px; text-align:center; }

  .card{
    border:1px solid var(--border); border-radius:10px; background: rgba(255,255,255,.02);
    padding:10px; transition: border-color .15s ease, transform .12s ease;
  }
  .card:hover{ border-color: rgba(255,255,255,.20); transform: translateY(-1px); }

  .card-head{ display:flex; align-items:center; justify-content:space-between; margin-bottom:8px; gap:10px; }
  .mat{ display:flex; align-items:center; gap:8px; min-width:0; }
  .m-img{
    width:36px; height:36px; border-radius:8px; object-fit:contain; background: rgba(255,255,255,.05);
    border:1px solid rgba(255,255,255,.08);
  }
  .m-meta{ min-width:0; }
  .m-name{ font:800 13px/1.1 var(--font); color:#e3eef9; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .m-sub{ color:#98a9b7; font:700 10px/1 var(--font); }

  .pct{ font:900 14px/1 var(--font); color:#eaf6ff; }

  /* segmented مثل ProfileView */
  .segbar{
    --n: 12;
    display:grid; grid-template-columns: repeat(var(--n), 1fr);
    gap:4px; height:9px; margin-bottom:6px;
  }
  .seg{ position:relative; border-radius:2px; overflow:hidden; background: rgba(255,255,255,.06); outline: 1px solid rgba(255,255,255,.10); }
  .fill{ position:absolute; inset:0; width: calc(var(--f) * 100%); border-radius:inherit; }

  .meta-row{ display:flex; align-items:center; gap:6px; flex-wrap:wrap; }
  .mchip{
    height:20px; padding:0 8px; display:inline-flex; align-items:center; justify-content:center;
    border-radius:8px; border:1px solid var(--border);
    background: rgba(255,255,255,.015); color:#cfe0ec; font:700 10.5px/1 var(--font);
  }
  .mchip.ok{    border-color:#269a62; color:#bdf2dc; }
  .mchip.warn{  border-color:#b98a2a; color:#ffe9b6; }
  .mchip.danger{border-color:#b94141; color:#ffd4d4; }

  /* أزرار */
  .btn{
    height:28px; padding:0 12px; border:1px solid var(--border); border-radius:999px;
    background: rgba(255,255,255,.02); color: var(--text-secondary);
    font:700 11px/1 var(--font); cursor:pointer; transition:all .15s ease;
  }
  .btn:hover{ border-color: var(--accent); color: var(--accent); transform: translateY(-1px); }
  .btn.small{ height:26px; padding:0 10px; font-size:11px; }
  .danger{ background: linear-gradient(180deg, #7a1f25, #59161a); color:#ffe9e9; border-color: rgba(0,0,0,.25); }

  /* Responsive */
  @media (max-width: 960px){ .stats{ grid-template-columns: 1fr 1fr 1fr; } }
  @media (max-width: 720px){ .stats{ grid-template-columns: 1fr 1fr; } }
  @media (max-width: 540px){ .stats{ grid-template-columns: 1fr; } }
</style>
