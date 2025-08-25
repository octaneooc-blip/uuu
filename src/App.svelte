<script>
  import './app.css';
  import { onMount } from 'svelte';
  import StatusBar from './components/StatusBar.svelte';
  import AppsGrid from './components/AppsGrid.svelte';
  import DevicesView from './components/DevicesView.svelte';
  import ProfileView from './components/ProfileView.svelte';
  import PoliceApp from './components/PoliceApp.svelte';
  import GroupsApp from './components/GroupsApp.svelte';
  import FactoryApp from './components/FactoryApp.svelte';
  import TasksApp from './components/TasksApp.svelte';

  import { onMessage, requestStash, post } from './lib/nui';
  import { playerName, playerState, apps, attached, inventory, slots } from './lib/stores';

  let view = 'home'; // 'home' | 'devices' | 'profile' | 'police' | 'groups'

  function showDevices() { view = 'devices'; refreshStash(); }
  function showProfile() { view = 'profile'; }
  function goHome() { view = 'home'; }
  function closeTablet() { post('close', {}); }

  async function refreshStash () {
    try {
      const data = await requestStash();
      attached.set(data?.attached || []);
      inventory.set(data?.inventory || []);
      slots.set(data?.slots ?? 6);
    } catch (e) {
      attached.set([]); inventory.set([]); slots.set(6);
    }
  }

  // ========== DEV MODE ==========
  function devOpen() {
    playerName.set('Mr Orkoda');
    playerState.set({
      job: 'developer',
      gang: 'dzcrew',
      onDuty: true,
      id: 17842,
      phone: '0550-123-456',
      money: 3250,
      bank: 128500,
      xp: 62,
      level: 18,
      badges: ['Clean Record','Pro Driver','Hacker'],
    });

    const demoApps = [
      { id:'notes', name:'Notes', icon:'https://images.dz-crew.com/tablet/icons/Notes.png', order:1 },
      { id:'camera', name:'Camera', icon:'https://images.dz-crew.com/tablet/icons/Camera.png', order:2 },
      { id:'groups', name:'Groups', icon:'https://images.dz-crew.com/tablet/icons/Groups.png', order:3 }, // ✅ زر التجريب
    ].sort((a,b)=>(a.order||999)-(b.order||999));
    apps.set(demoApps);

    attached.set([{ name:'SecureChip' }]);
    inventory.set([{ name:'Phone' }, { name:'ID Card' }]);
    slots.set(6);

    // ✅ افتح مباشرة تطبيق Groups لعرض البيانات الوهمية
    view = 'police';

    document.getElementById('app')?.classList.remove('hidden');
  }
  // =============================

  onMount(() => {
    onMessage((data) => {
      if (!data?.type) return;

      if (data.type === 'tablet:native:open' && data.name === 'police') {
        view = 'police';
        document.getElementById('app')?.classList.remove('hidden');
      }

      if (data.type === 'tablet:native:open' && data.name === 'groups') {
        view = 'groups';
        document.getElementById('app')?.classList.remove('hidden');
      }

      if (data.type === 'tablet:native:open' && data.name === 'factory') {
        view = 'factory';
        document.getElementById('app')?.classList.remove('hidden');
      }
      if (data.type === 'tablet:native:open' && data.name === 'tasks') {
        view = 'tasks';
        document.getElementById('app')?.classList.remove('hidden');
      }

      if (data.type === 'tablet:open') {
        (async () => {
          playerName.set(data.playerName || 'Citizen');
          playerState.set({
            ...(data.player || { job:'', gang:'', onDuty:false }),
            id: data.player?.id,
            phone: data.player?.phone,
            money: data.player?.money,
            bank: data.player?.bank,
            xp: data.player?.xp ?? 0,
            level: data.player?.level ?? 1,
            badges: data.player?.badges ?? [],
          });

          const list = Array.isArray(data.apps) ? data.apps.slice() : [];
          list.sort((a,b)=>(a.order||999)-(b.order||999));

          await refreshStash();

          apps.set(list);
          view = 'home';
          document.getElementById('app')?.classList.remove('hidden');
        })();
      }

      if (data.type === 'tablet:close') {
        document.getElementById('app')?.classList.add('hidden');
        view = 'home';
      }

      if (data.type === 'tablet:setApps') {
        const list = Array.isArray(data.apps) ? data.apps.slice() : [];
        list.sort((a,b)=>(a.order||999)-(b.order||999));
        apps.set(list);
      }
    });

    if (import.meta.env.DEV) setTimeout(() => devOpen(), 0);
  });
</script>


<div id="app" class="screen hidden">
  <StatusBar onDevices={showDevices} onClose={closeTablet} onProfile={showProfile} />

  {#if view === 'home'}
    <main class="view">
      <section class="welcome">
        <div class="hello">Welcome</div>
        <div class="player">{$playerName}</div>
      </section>
      <AppsGrid apps={$apps} playerName={$playerName} playerState={$playerState}/>
    </main>

  {:else if view === 'devices'}
    <main class="view" aria-label="Devices">
      <div class="toolbar">
        <button class="btn" on:click={goHome}>← Back</button>
        <h3 class="toolbar__title">Attached Device(s)</h3>
      </div>
      <DevicesView/>
    </main>

  {:else if view === 'profile'}
    <main class="view" aria-label="Profile">
      <div class="toolbar">
        <button class="btn" on:click={goHome}>← Back</button>
        <h3 class="toolbar__title">Player Profile</h3>
      </div>
      <ProfileView playerName={$playerName} playerState={$playerState}/>
    </main>
 {:else if view === 'police'}
  <main class="view" aria-label="Police App">
    <div class="toolbar">
      <button class="btn" on:click={goHome}>← Back</button>
      <h3 class="toolbar__title">Police App</h3>
    </div>
    <PoliceApp playerId={$playerState.PlayerId} />
  </main>
{:else if view === 'groups'}
  <main class="view" aria-label="Groups App">
    <div class="toolbar">
      <button class="btn" on:click={goHome}>← Back</button>
      <h3 class="toolbar__title">Groups</h3>
    </div>
    <GroupsApp />
  </main>
  {:else if view === 'factory'}
<main class="view" aria-label="Factory App">
  <div class="toolbar">
    <button class="btn" on:click={goHome}>← Back</button>
    <h3 class="toolbar__title">Factory Needs</h3>
  </div>
  <FactoryApp/>
</main>
{:else if view === 'tasks'}
  <main class="view" aria-label="Tasks App">
    <div class="toolbar">
      <button class="btn" on:click={goHome}>← Back</button>
      <h3 class="toolbar__title">Tasks</h3>
    </div>
    <TasksApp />
  </main>
{/if}



  
</div>

<style>
  .toolbar{display:flex;align-items:center;gap:12px;margin-bottom:10px}
  .toolbar__title{margin:0;font-size:18px;color:#cfe8ff;letter-spacing:.3px}
</style>
