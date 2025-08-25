<script>
  import { attached, inventory, slots } from '../lib/stores';
  import { postJSON } from '../lib/nui';
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';

  let isDragging = false;
  let dragData = null;        // { item, source }
  let hoverTarget = null;     // { zone, index }
  let ghostEl = null;
  const GHOST_OFFSET = { x: 8, y: 8 };

  async function refresh() {
    try {
      // const r = await post('getStash', {});
      // const data = await r.json();
      const data = await postJSON('getStash', {});
      attached.set(data.attached || []);
      inventory.set(data.inventory || []);
      slots.set(data.slots ?? 6);
    } catch (e) {
      console.error(e);
    }
  }
  onMount(refresh);

  async function attachItem(name, slotIndex) {
    await postJSON('attachItem', { name, slot: slotIndex });
  }
  async function detachItem(name, slotIndex) {
    await postJSON('detachItem', { name, slot: slotIndex });
  }

  function ensureLength(arr, len) {
    const out = [...arr];
    while (out.length < len) out.push(null);
    return out;
  }
  function removeFirstByName(arr, name) {
    const copy = [...arr];
    const idx = copy.findIndex((it) => it && it.name === name);
    if (idx !== -1) {
      const [removed] = copy.splice(idx, 1);
      return { copy, removed };
    }
    return { copy, removed: null };
  }

  function getPoint(e) {
    if (e.touches && e.touches[0]) return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    return { x: e.clientX, y: e.clientY };
  }

  function createGhostFromImg(imgEl) {
    const rect = imgEl.getBoundingClientRect();
    const el = document.createElement('img');
    el.className = 'ghost-img';
    el.src = imgEl.src;
    el.alt = imgEl.alt || '';
    el.style.width = rect.width + 'px';
    el.style.height = rect.height + 'px';
    document.body.appendChild(el);
    ghostEl = el;
  }

  function moveGhost(e) {
    if (!ghostEl) return;
    const p = getPoint(e);
    ghostEl.style.transform = `translate(${p.x + GHOST_OFFSET.x}px, ${p.y + GHOST_OFFSET.y}px)`;
  }

  function destroyGhost() {
    if (ghostEl) {
      ghostEl.remove();
      ghostEl = null;
    }
  }

  function startDrag(e, item, source) {
    e.preventDefault();
    const imgEl = e.currentTarget.querySelector('img');
    if (!imgEl) return;
    createGhostFromImg(imgEl);
    isDragging = true;
    dragData = { item, source };
    moveGhost(e);
    window.addEventListener('mousemove', moveGhost, { passive: false });
    window.addEventListener('touchmove', moveGhost, { passive: false });
    window.addEventListener('mouseup', endDrag, { passive: false });
    window.addEventListener('touchend', endDrag, { passive: false });
  }

  function markHover(zone, index) {
    if (!isDragging) return;
    hoverTarget = { zone, index };
  }

  async function endDrag() {
    destroyGhost();
    window.removeEventListener('mousemove', moveGhost);
    window.removeEventListener('touchmove', moveGhost);
    window.removeEventListener('mouseup', endDrag);
    window.removeEventListener('touchend', endDrag);

    if (!isDragging || !dragData || !hoverTarget) {
      isDragging = false; dragData = null; hoverTarget = null; return;
    }

    const { item, source } = dragData;
    const { zone: targetZone, index: slotIndex } = hoverTarget;

    const maxSlots = get(slots) || 6;
    let att = ensureLength(get(attached), maxSlots);
    let inv = [...get(inventory)];

    try {
      if (targetZone === 'attached' && source === 'inventory') {
        ({ copy: inv } = removeFirstByName(inv, item.name));
        const displaced = att[slotIndex] || null;
        att[slotIndex] = item;
        if (displaced) inv.push(displaced);
        attached.set(att); inventory.set(inv);
        await attachItem(item.name, slotIndex);
      } else if (targetZone === 'inventory' && source === 'attached') {
        const idx = att.findIndex((it) => it && it.name === item.name);
        if (idx !== -1) att[idx] = null;
        inv.push(item);
        attached.set(att); inventory.set(inv);
        await detachItem(item.name, slotIndex);
      }
      await refresh();
    } catch (err) {
      console.error(err);
      await refresh();
    } finally {
      isDragging = false; dragData = null; hoverTarget = null;
    }
  }

  $: attachedSlots = Array.from({ length: $slots }, (_, i) => $attached[i] || null);
  $: inventorySlots = Array.from({ length: Math.max(12, $inventory.length, 12) }, (_, i) => $inventory[i] || null);
</script>

<!-- ATTACHED: سوكِت -->
<section class="panel">
  <header class="panel__header">
    <h2 class="panel__title">SECURE SOCKETS (ATTACHED)</h2>
    <div class="panel__meta">{$attached.length} / {$slots}</div>
  </header>

  <div class="slots">
    {#each attachedSlots as item, index}
      <div
        class="slot {item ? 'slot--filled' : 'slot--empty'} {isDragging && hoverTarget?.zone==='attached' && hoverTarget?.index===index ? 'slot--hover' : ''}"
        on:mouseenter={() => markHover('attached', index)}
      >
        <div class="bay">
          <div class="bay__bezel"></div>
          <div class="bay__depth"></div>
          <div class="bay__screws">
            <span></span><span></span><span></span><span></span>
          </div>

          {#if item}
            <button
              class="chip"
              on:mousedown={(e) => startDrag(e, item, 'attached')}
              on:touchstart={(e) => startDrag(e, item, 'attached')}
              title={item.name}
            >
              <img src={item.icon} alt={item.name} />
            </button>
          {:else}
            {#if isDragging && hoverTarget?.zone==='attached' && hoverTarget?.index===index}
              <div class="chip chip--preview">
                <img src={dragData?.item?.icon} alt="preview" />
              </div>
            {:else}
              <div class="placeholder"><span class="plus">+</span></div>
            {/if}
          {/if}
        </div>
      </div>
    {/each}
  </div>
</section>

<!-- INVENTORY: بسيط، مربّعات صغيرة وألوان ناعمة -->
<section class="panel inventory-panel">
  <header class="panel__header">
    <h2 class="panel__title">ENCRYPTED MODULES (INVENTORY)</h2>
    <div class="panel__meta">{$inventory.length}</div>
  </header>

  <div class="inv-grid">
    {#each inventorySlots as item, index}
      <div
        class="inv-tile {item ? 'inv-tile--filled' : 'inv-tile--empty'} {isDragging && hoverTarget?.zone==='inventory' && hoverTarget?.index===index ? 'inv-tile--hover' : ''}"
        on:mouseenter={() => markHover('inventory', index)}
      >
        {#if item}
          <button
            class="chip chip--inv"
            on:mousedown={(e) => startDrag(e, item, 'inventory')}
            on:touchstart={(e) => startDrag(e, item, 'inventory')}
            title={item.name}
          >
            <img src={item.icon} alt={item.name} />
          </button>
        {:else}
          {#if isDragging && hoverTarget?.zone==='inventory' && hoverTarget?.index===index}
            <div class="chip chip--inv chip--preview">
              <img src={dragData?.item?.icon} alt="preview" />
            </div>
          {:else}
            <div class="inv-placeholder">LOCKED</div>
          {/if}
        {/if}
      </div>
    {/each}
  </div>
</section>

<style>
  /* ===== DZ Crew DevicesView — Theme-matched (transparent + clean) ===== */
  :root{
    /* Sizes */
    --chip: 90px;   /* ATTACHED chip size */
    --inv:  56px;   /* INVENTORY chip size */
    --radius: 14px;
  }

  /* inherit theme colors from app.css */
  :global(body){ color: var(--text-primary); background: transparent; }

  /* Panels */
  .panel{
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 14px;
    margin-bottom: 14px;
  }
  .panel__header{
    display:flex; align-items:center; justify-content:space-between; margin-bottom:12px;
  }
  .panel__title{ font:800 .95rem/1 var(--font); letter-spacing:.35px; color: var(--text-secondary); }
  .panel__meta{ color: var(--text-muted); font-weight:700; }

  /* ATTACHED grid */
  .slots{
    display:grid;
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
    gap:12px;
  }

  /* ATTACHED bay look */
  .slot{
    border-radius: var(--radius);
    transition: transform .1s ease, border-color .12s ease, background-color .12s ease;
  }
  .slot--empty{ background: rgba(255,255,255,.02); border: 1px dashed var(--border); }
  .slot--filled{ background: var(--surface-elevated); border: 1px solid var(--border); }
  .slot--hover{ transform: translateY(-1px); }

  .bay{
    position: relative;
    border-radius: 12px;
    padding: 8px;
    height: calc(var(--chip) + 14px);
    display: grid; place-items: center;
    background: linear-gradient(180deg, rgba(255,255,255,.03), rgba(255,255,255,.015));
    box-shadow: inset 0 1px 0 rgba(255,255,255,.03);
  }
  .bay__depth{
    position:absolute; inset:6px; border-radius: 10px;
    background: rgba(255,255,255,.01);
    box-shadow: inset 0 0 0 1px rgba(255,255,255,.04);
    pointer-events: none;
  }
  .bay__bezel{
    position:absolute; inset:0; border-radius: 12px;
    box-shadow: inset 0 0 0 1px rgba(255,255,255,.06);
    pointer-events: none;
  }
  .slot--hover .bay__bezel{
    box-shadow: inset 0 0 0 2px rgba(0,209,245,.35);
  }

  /* tiny screw dots */
  .bay__screws{ position:absolute; inset:8px; pointer-events:none; }
  .bay__screws span{
    position:absolute; width:6px; height:6px; border-radius:50%;
    background: linear-gradient(180deg, #cfd8e3, #64748b);
    box-shadow: 0 1px 2px rgba(0,0,0,.25), inset 0 0 0 1px rgba(255,255,255,.35);
  }
  .bay__screws span:nth-child(1){ left:0; top:0; transform: translate(-30%, -30%); }
  .bay__screws span:nth-child(2){ right:0; top:0; transform: translate(30%, -30%); }
  .bay__screws span:nth-child(3){ left:0; bottom:0; transform: translate(-30%, 30%); }
  .bay__screws span:nth-child(4){ right:0; bottom:0; transform: translate(30%, 30%); }

  /* Chip */
  .chip{
    width: var(--chip); height: var(--chip);
    border-radius: 12px;
    background: var(--surface);
    border: 1px solid var(--border);
    display:grid; place-items:center;
    cursor: grab;
    transition: transform .1s ease, border-color .12s ease, background-color .12s ease, box-shadow .12s ease;
  }
  .chip:hover{
    border-color: var(--border-hover);
    background: var(--surface-elevated);
    box-shadow: 0 8px 18px rgba(0,0,0,.25);
  }
  .chip:active{ cursor: grabbing; transform: scale(.98); }
  .chip img{
    width: 100%; height: 100%; object-fit: contain;
    pointer-events: none; -webkit-user-drag: none;
    filter: drop-shadow(0 2px 6px rgba(0,0,0,.35));
  }
  .chip--preview{ opacity:.65; transform: scale(.96); border: 1px dashed var(--border-hover); }
  .placeholder{
    display:grid; place-items:center; width: var(--chip); height: var(--chip);
    border-radius: 12px; border: 1px dashed var(--border); color: var(--text-muted);
    background: rgba(255,255,255,.015);
  }
  .plus{ font-size: 20px; line-height: 1; color: var(--text-secondary); }

  /* INVENTORY */
  .inv-grid{
    display:grid;
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
    gap:10px;
  }
  .inv-tile{
    border-radius: 10px;
    padding: 10px;
    min-height: calc(var(--inv) + 20px);
    display:grid; place-items:center;
    background: var(--surface);
    border: 1px solid var(--border);
    transition: transform .1s ease, border-color .12s ease, background-color .12s ease;
  }
  .inv-tile--hover{
    transform: translateY(-1px);
    border-color: var(--accent);
    background: var(--accent-soft);
  }
  .inventory-panel .chip{
    width: var(--inv); height: var(--inv);
    border-radius: 10px;
    background: var(--surface-elevated);
    border: 1px solid var(--border);
  }
  .inventory-panel .chip:hover{
    border-color: var(--border-hover);
    background: var(--surface);
  }
  .inventory-panel .chip img{ width: 92%; height: 92%; }

  .inv-placeholder{
    width: var(--inv); height: var(--inv);
    display:grid; place-items:center;
    border-radius: 10px;
    border: 1px dashed var(--border);
    color: var(--text-muted); font-weight:700; font-size:.55rem; letter-spacing:.18em;
    background: rgba(255,255,255,.015);
  }

  /* Ghost */
  .ghost-img{
    position: fixed; left: 0; top: 0; z-index: 9999;
    pointer-events: none; user-select: none;
    filter: drop-shadow(0 8px 18px rgba(0,0,0,.35));
    transform: translate(-9999px, -9999px);
  }

  /* Focus */
  .chip:focus-visible, .btn:focus-visible{
    outline: 2px solid var(--accent);
    outline-offset: 2px;
    border-radius: 12px;
  }

  /* Responsive */
  @media (max-width: 900px){
    :root{ --chip: 60px; --inv: 52px; }
    .slots{ grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); }
    .inv-grid{ grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); }
  }
  @media (max-width: 680px){
    :root{ --chip: 56px; --inv: 48px; }
  }
</style>

