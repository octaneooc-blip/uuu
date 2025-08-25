<script>
  export let onDevices = () => {};
  export let onClose = () => {};
  export let onProfile = () => {};

  import { playerName, playerState } from '../lib/stores';
  let now = new Date();
  const tick = () => (now = new Date());
  const t = setInterval(tick, 1000);
  import { onDestroy } from 'svelte';
  onDestroy(()=>clearInterval(t));

  const time = () => now.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit'});
  $: initials = ($playerName || 'C')?.split(' ').map(s=>s[0]).slice(0,2).join('').toUpperCase();
  $: duty = $playerState?.onDuty ? 'On Duty' : 'Off Duty';
</script>

<div class="statusbar">
  <div class="time">{time()}</div>

  <!-- <div class="sb-center">
    <div class="badge">{ $playerState?.job || 'Unemployed' }</div>
    <div class="dot"></div>
    <div class="badge { $playerState?.onDuty ? 'ok' : 'warn' }">{duty}</div>
    <div class="dot"></div>
    <div class="badge">{ $playerState?.gang || 'No Gang' }</div>
  </div> -->

  <div class="sb-right">
    <button class="pill1" on:click={onDevices}>Devices</button>
    <button class="pill1" on:click={onProfile}>
      <span class="avatar" aria-hidden="true">{initials}</span>
      Profile
    </button>
    <button class="pill2 pill--ghost" aria-label="Close" on:click={onClose}>×</button>
  </div>
</div>

<style>
  .statusbar {
    height: 60px; display:flex; align-items:center; justify-content:space-between;
    padding: 0 var(--spacing-xl);
    background: radial-gradient(80.56% 128.89% at 50% 0,#064980 0,#064e88 100%);
    border-bottom: 1px solid var(--border);
  }
  .time { font: 600 14px/1 var(--font); color: var(--text-primary); letter-spacing: .5px; }
  .sb-center{ display:flex; align-items:center; gap:10px; }
  .badge{
    font: 600 12px/1 var(--font); color: var(--text-secondary);
    background: var(--surface); border:1px solid var(--border);
    padding:6px 10px; border-radius: 999px;
  }
  .badge.ok{ border-color: #2b9a6c; color:#b4f2d6; }
  .badge.warn{ border-color: #8a3f3f; color:#f3c7c7; }
  .dot{ width:6px; height:6px; border-radius:50%; background:#37424f; }
  .sb-right{ display:flex; gap:8px; align-items:center; }
  .avatar{
    width:20px; height:20px; border-radius:50%;
    background: linear-gradient(135deg, #01455a 0%, #01455a 100%);
    display:inline-grid; place-items:center;
    color:white; font: 300 9px/1 var(--font);
  }
</style>
