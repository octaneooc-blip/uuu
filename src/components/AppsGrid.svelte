<script>
  import { attached, inventory, slots } from '../lib/stores';
  import { post, requestStash } from '../lib/nui';

  export let apps = [];
  export let playerName = '';
  export let playerState = {};

  $: attachedNames = new Set(($attached || []).map(i => i?.name));

  function isLocked(app) {
    const req = (app?.require?.openItems || app?.require?.items || []);
    if (!Array.isArray(req) || !req.length) return false;
    return req.some(n => !attachedNames.has(n));
  }

  const LOCKED_ICON = 'https://images.dz-crew.com/tablet/icons/Encrypted-App.png';
  const LOCKED_NAME = 'Encrypted';

  async function openApp(app) {
    if (isLocked(app)) return;
    try {
      if (app.action?.type === 'client_event' && app.action?.name) {
        await post('triggerClientEvent', { eventName: app.action.name, appId: app.id });
      } else if (app.action?.type === 'server_event' && app.action?.name) {
        await post('triggerServerEvent', { eventName: app.action.name, appId: app.id });
      } else {
        await post('openApp', { appId: app.id, appName: app.name });
      }
    } catch (e) {
      console.error('[AppsGrid] openApp failed:', e);
    }
  }

  async function refreshStash() {
    try {
      const data = await requestStash();
      attached.set(data?.attached || []);
      inventory.set(data?.inventory || []);
      slots.set(data?.slots ?? 6);
    } catch {}
  }
  refreshStash();
</script>

<div class="apps-grid">
  {#each apps as app (app.id)}
    {#if app}
      <div
        class="tile {isLocked(app) ? 'tile--locked' : ''}"
        on:click={() => openApp(app)}
        on:keydown={(e) => e.key === 'Enter' && openApp(app)}
        role="button" tabindex="0"
        aria-label="Open {app.name}"
      >
        <div class="icon-wrap">
          <div class="icon-bg"></div>
          <img
            src={isLocked(app) ? LOCKED_ICON : app.icon}
            alt={isLocked(app) ? 'Locked App' : app.name}
            on:error={(e) => { e.target.src = LOCKED_ICON; e.target.style.opacity = '0.95'; }}
          />
        </div>
        <div class="label">{isLocked(app) ? LOCKED_NAME : app.name}</div>
      </div>
    {/if}
  {/each}

  {#if !apps?.length}
    <div class="empty">
      <div class="empty__icon">📱</div>
      <div class="empty__text">No apps yet<br><small>Apps will appear when configured</small></div>
    </div>
  {/if}
</div>

<style>
  .apps-grid{
    --tile-w: 94px;
    --tile-h: 110px;
    --tile-radius: 10px;
    --tile-bg: rgba(255,255,255,.04);
    --tile-border: rgba(255,255,255,.08);
    display:flex; flex-wrap:wrap; gap:30px;
  }
  .tile{
    width: var(--tile-w);
    height: var(--tile-h);
    border-radius: var(--tile-radius);
    background: var(--tile-bg);
    border: 1px solid var(--tile-border);
    box-shadow: 0 6px 16px rgba(0,0,0,.25), inset 0 1px 0 rgba(255,255,255,.04);
    display:flex; flex-direction:column; align-items:center; justify-content:center;
    padding-top: 1px; gap: 5px; cursor: pointer; outline: none;
    transition: transform .08s ease, border-color .1s ease, background .1s ease;
  }
  .tile:hover{ transform: translateY(-1px); border-color: rgba(255,255,255,.22); }
  .tile:focus{ box-shadow: 0 0 0 2px rgba(120,180,255,.35); }
  .tile--locked{ opacity: .96; }
  .icon-wrap{
    position: relative; width: 78px; height: 78px; border-radius: 6px;
    display:grid; place-items:center; overflow:hidden;
    box-shadow: inset 0 1px 0 rgba(255,255,255,.05), 0 8px 18px rgba(0,0,0,.30);
    background: rgba(255,255,255,.10);
  }
  .icon-bg{
    position:absolute; inset:0; pointer-events:none;
    background:
      radial-gradient(80% 70% at 25% 20%, rgba(255, 255, 255, 0.178), transparent 55%),
      linear-gradient(180deg, #2b313800 0%, #14181d00 100%);
  }
  .icon-wrap img{
    position:relative; width: 72%; height: 72%; object-fit: contain;
    filter: drop-shadow(0 2px 4px rgba(0,0,0,.35));
    pointer-events:none; -webkit-user-drag:none;
  }
  .label{
    font: 800 11.5px/1.05 ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto;
    color: rgba(255,255,255,.92); text-align:center; letter-spacing:.02em;
    padding: 0 6px; text-shadow: 0 1px 0 rgba(0,0,0,.35);
  }
  .empty{ display:flex; flex-direction:column; align-items:center; justify-content:center; padding: 24px; opacity:.75; }
  .empty__icon{ width:56px; height:56px; border-radius:12px; display:grid; place-items:center;
    border:1px dashed rgba(255,255,255,.14); background: rgba(255,255,255,.02); margin-bottom: 6px; }
  .empty__text{ color: #9fb0bd; text-align:center; }
  .empty small{ opacity:.85; }
</style>
