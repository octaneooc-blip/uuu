<script>
  import { onMount, onDestroy } from 'svelte';
  import { postJSON } from '../lib/nui';

  // ------------- Tabs / State -------------
  let tab = 'legal'; // home | legal | illegal | progress
  let loading = false;
  let error = '';
  let missionStarted = false;
  let missionsopted = false;

  // progress
  let dailyXP = 0, weeklyXP = 0, milestoneXP = 0;
  const PROG_TOTAL = { daily: 4, weekly: 49, milestone: 1460 };

  // tasks
  let legalTasks = [];
  let illegalTasks = [];

  // filters
  let qLegal = '', qIllegal = '';

  // segmented progress (like ProfileView)
  const SEGMENTS = 12;
  function toSegments(cur, need, n = SEGMENTS) {
    if (!need || need <= 0) return Array.from({ length: n }, () => 0);
    const r = Math.max(0, Math.min(1, cur / need));
    const total = r * n;
    const full = Math.floor(total);
    const part = total - full;
    return Array.from({ length: n }, (_, i) => (i < full ? 1 : (i === full ? part : 0)));
  }
  function pct(cur, need) {
    if (!need || need <= 0) return 0;
    return Math.max(0, Math.min(100, Math.floor((cur / need) * 100)));
  }

  // ------------- Derived -------------
  $: fLegal = legalTasks
    .filter(t => String(t?.title||'').toLowerCase().includes(qLegal.toLowerCase()));

  $: fIllegal = illegalTasks
    .filter(t => String(t?.title||'').toLowerCase().includes(qIllegal.toLowerCase()));

  // ------------- Loaders -------------
  async function loadProgress() {
    loading = true; error = '';
    try {
      const r = await postJSON('getProgressData', {});
      const d = r?.data ?? r ?? {};
      dailyXP = Number(d.dailyTasksXP || 0);
      weeklyXP = Number(d.weeklyTasksXP || 0);
      milestoneXP = Number(d.milestonesXP || 0);
    } catch (e) {
      error = 'Failed to load progress.';
    } finally {
      loading = false;
    }
  }

   async function loadmissionbuttonstatsus() {
    loading = true; error = '';
    try {
      const r = await postJSON('getMissionButtonStatus', {});
      if (r?.status === 'started') {
        missionStarted = true;
        missionsopted = false;
      } else {
        missionStarted = false;
        missionsopted = true;
      }
    } catch (e) {
      error = 'Failed to load mission status.';
    } finally {
      loading = false;
    }
}

  async function loadLegal() {
    loading = true; error = '';
    try {
      await postJSON('refreshTasks', {});
      loadmissionbuttonstatsus();
    } catch (e) {
      error = 'Failed to load legal tasks.';
    } finally { loading = false; }
  }

  async function loadIllegal() {
    loading = true; error = '';
    try {
      await postJSON('refreshTasks', {});
      loadmissionbuttonstatsus();
    } catch (e) {
      error = 'Failed to load illegal tasks.';
    } finally { loading = false; }
  }
  async function startmission() {
    // loading = true; error = '';
    // try {
      await postJSON('startMission', {});
      await postJSON('refreshTasks', {});
    // } catch (e) {
    //   error = 'Failed to start mission.';
    // } finally { loading = false; }
    loadmissionbuttonstatsus();
  }
  async function stopmission() {
    // loading = true; error = '';
    // try {
      await postJSON('stopMission', {});
    // } catch (e) {
    //   error = 'Failed to stop mission.';
    // } finally { loading = false; }
    loadmissionbuttonstatsus();
  }

  function normalizeTasks(arr) {
    return arr.map(t => ({
      id: t.id ?? cryptoRandom(),
      title: t.title || 'Untitled task',
      image: t.image || '',
      completed: Number(t.completed || 0),
      required: Number(t.required || 1),
      claimed: Boolean(t.claimed),
      reward: t.reward ?? null,
      meta: Object.fromEntries(
        Object.entries(t).filter(([k]) => !['id','title','image','completed','required','claimed','reward'].includes(k))
      )
    }));
  }
  function cryptoRandom() {
    try { return crypto.getRandomValues(new Uint32Array(1))[0]; } catch { return Math.floor(Math.random()*1e9); }
  }

  // ------------- Actions -------------
 async function claim(task, type) {
    if (task.claimed || task.completed < task.required) return;

    const key = `claim:${task.id}`;
    // await withLock(key, async () => {
      task._claiming = true;
      try {
        const r = await postJSON('claimReward', { taskName: task.title });
        // if (r?.success) {
          task.claimed = true;
          await loadProgress();
          if (type === 'legal') await loadLegal();
          else await loadIllegal();
        // }
      } finally {
        task._claiming = false;
      }
    // });
  }

  function openTab(t) {
    tab = t;
    if (t === 'progress') loadProgress();
    if (t === 'legal') loadLegal();
    if (t === 'illegal') loadIllegal();
  }

  function closeApp() {
    fetch(`https://${(typeof GetParentResourceName === 'function' && GetParentResourceName()) || 'debug'}/closeUI`, {method:'POST',body:'{}'}).catch(()=>{});
  }

  // ------------- NUI bridge -------------
  function onMessage(ev) {
    const d = ev.data || {};
    if (d.type === 'loadTasks') {
      legalTasks  = normalizeTasks(d.legalTasks || []);
      illegalTasks= normalizeTasks(d.illegalTasks || []);
    }
    if (d.type === 'updateProgress') {
      const data = d?.data || {};
      dailyXP     = Number(data.dailyTasksXP || 0);
      weeklyXP    = Number(data.weeklyTasksXP || 0);
      milestoneXP = Number(data.milestonesXP || 0);
    }
  }

  // ------------- DEV Demo -------------
  function loadDemo() {
    dailyXP = 2; weeklyXP = 17; milestoneXP = 430;
    legalTasks = normalizeTasks([
      { id:1, title:'Deliver supplies', image:'https://picsum.photos/seed/leg1/400/260', completed:1, required:3, reward:{type:'money', amount:{min:250, max:500}, moneyType:'cash'}, zone:'Docks' },
      { id:2, title:'Repair vehicle', image:'https://picsum.photos/seed/leg2/400/260', completed:3, required:3, claimed:false, reward:{itemName:'RepairKit', itemCount:{min:1,max:2}} },
      { id:2, title:'Repair vehicle', image:'https://picsum.photos/seed/leg2/400/260', completed:3, required:3, claimed:false, reward:{itemName:'RepairKit', itemCount:{min:1,max:2}} },
    ]);
    illegalTasks = normalizeTasks([
      { id:3, title:'Steal data', image:'https://picsum.photos/seed/ill1/400/260', completed:2, required:5, reward:{type:'money', amount:{min:1200, max:2500}, moneyType:'black'} },
      { id:4, title:'Hacked ATM', image:'https://picsum.photos/seed/ill2/400/260', completed:5, required:5, claimed:false, reward:{itemName:'USB', itemCount:{min:1,max:1}} },
      { id:4, title:'Hacked ATM', image:'https://picsum.photos/seed/ill2/400/260', completed:5, required:5, claimed:false, reward:{itemName:'USB', itemCount:{min:1,max:1}} },
    ]);
  }

  onMount(() => {
    window.addEventListener('message', onMessage);
    if (import.meta.env.DEV) { loadDemo(); }
  });
  onDestroy(() => window.removeEventListener('message', onMessage));
  loadIllegal();
</script>

<section class="tasks-app">
  <!-- Enhanced Header -->
  <header class="app-header">
    <div class="header-content">
      <div class="header-icon">
        <div class="icon-wrapper">
          <span class="icon"></span>
        </div>
      </div>
      <div class="header-info">
        <h1 class="app-title">Tasks & Missions</h1>
        <p class="app-subtitle">Complete tasks to earn rewards and progress</p>
      </div>
    </div>
    
    <nav class="tab-navigation">
      <!-- <button class="nav-tab {tab==='home'?'active':''}" on:click={() => openTab('home')}>
        <span class="tab-icon">🏠</span>
        <span class="tab-label">Home</span>
      </button> -->
      <button class="nav-tab {tab==='legal'?'active':''}" on:click={() => openTab('legal')}>
        <span class="tab-icon"></span>
        <span class="tab-label">Legal</span>
      </button>
      <button class="nav-tab {tab==='illegal'?'active':''}" on:click={() => openTab('illegal')}>
        <span class="tab-icon"></span>
        <span class="tab-label">Illegal</span>
      </button>
      <button class="nav-tab {tab==='progress'?'active':''}" on:click={() => openTab('progress')}>
        <span class="tab-icon"></span>
        <span class="tab-label">Progress</span>
      </button>
    </nav>
  </header>

  <!-- Content Area -->
  <main class="app-content">
    {#if loading}
      <div class="loading-state">
        <div class="loading-spinner"></div>
        <p>Loading...</p>
      </div>
    {:else if error}
      <div class="error-state">
        <span class="error-icon"></span>
        <p>{error}</p>
      </div>
    {:else}
      {#if tab === 'home'}
        <div class="home-section">
          <div class="welcome-card">
            <div class="welcome-icon"></div>
            <h2 class="welcome-title">Welcome to Tasks</h2>
            <p class="welcome-text">Choose your path and start completing missions to earn rewards and advance your progress.</p>
            
            <div class="quick-actions">
              <button class="action-btn primary" on:click={() => openTab('legal')}>
                <span class="btn-icon"></span>
                <span class="btn-text">Legal Tasks</span>
              </button>
              <button class="action-btn secondary" on:click={() => openTab('illegal')}>
                <span class="btn-icon"></span>
                <span class="btn-text">Illegal Tasks</span>
              </button>
              <button class="action-btn tertiary" on:click={() => openTab('progress')}>
                <span class="btn-icon"></span>
                <span class="btn-text">View Progress</span>
              </button>
            </div>
          </div>
        </div>

      {:else if tab === 'progress'}
        <div class="progress-section">
          <div class="section-header">
            <h2 class="section-title">Your Progress</h2>
            <p class="section-subtitle">Track your daily, weekly, and milestone achievements</p>
          </div>
          
          <div class="progress-grid">
            <!-- Daily Progress -->
            <div class="progress-card daily">
              <div class="card-header">
                <div class="card-icon"></div>
                <div class="card-info">
                  <h3 class="card-title">Daily Progress</h3>
                  <p class="card-subtitle">{dailyXP} / {PROG_TOTAL.daily} Points</p>
                </div>
                <div class="card-percentage">{pct(dailyXP, PROG_TOTAL.daily)}%</div>
              </div>
              
              <div class="progress-bar">
                <div class="segbar" style="--n:{SEGMENTS}">
                  {#each toSegments(dailyXP, PROG_TOTAL.daily) as f}
                    <span class="seg"><span class="fill daily-fill" style="--f:{f}"></span></span>
                  {/each}
                </div>
              </div>
            </div>

            <!-- Weekly Progress -->
            <div class="progress-card weekly">
              <div class="card-header">
                <div class="card-icon"></div>
                <div class="card-info">
                  <h3 class="card-title">Weekly Progress</h3>
                  <p class="card-subtitle">{weeklyXP} / {PROG_TOTAL.weekly} Points</p>
                </div>
                <div class="card-percentage">{pct(weeklyXP, PROG_TOTAL.weekly)}%</div>
              </div>
              
              <div class="progress-bar">
                <div class="segbar" style="--n:{SEGMENTS}">
                  {#each toSegments(weeklyXP, PROG_TOTAL.weekly) as f}
                    <span class="seg"><span class="fill weekly-fill" style="--f:{f}"></span></span>
                  {/each}
                </div>
              </div>
            </div>

            <!-- Milestone Progress -->
            <div class="progress-card milestone">
              <div class="card-header">
                <div class="card-icon"></div>
                <div class="card-info">
                  <h3 class="card-title">Milestones</h3>
                  <p class="card-subtitle">{milestoneXP} / {PROG_TOTAL.milestone} Points</p>
                </div>
                <div class="card-percentage">{pct(milestoneXP, PROG_TOTAL.milestone)}%</div>
              </div>
              
              <div class="progress-bar">
                <div class="segbar" style="--n:{SEGMENTS}">
                  {#each toSegments(milestoneXP, PROG_TOTAL.milestone) as f}
                    <span class="seg"><span class="fill milestone-fill" style="--f:{f}"></span></span>
                  {/each}
                </div>
              </div>
            </div>
          </div>
        </div>

      {:else if tab === 'legal'}
        <div class="tasks-section">
          <div class="section-header">
            <div class="header-left">
              <h2 class="section-title">Legal Tasks</h2>
              <p class="section-subtitle">Legitimate work opportunities</p>
            </div>
            <button class="start-btn" on:click={startmission} disabled={missionStarted}>
              <span class="refresh-icon"></span>
              {#if missionStarted}<span class="spinner s"></span>{/if}
              Start mission
            </button>
            <button class="stop-btn" on:click={stopmission} disabled={missionsopted}>
              <span class="refresh-icon"></span>
              {#if missionsopted}<span class="spinner s"></span>{/if}
              Stop mission
            </button>
            <!-- <button class="refresh-btn" on:click={loadIllegal}>
              <span class="refresh-icon"></span>
              Refresh
            </button> -->

          </div>
          
          <!-- <div class="search-bar">
            <div class="search-input-wrapper">
              <span class="search-icon">🔍</span>
              <input class="search-input" placeholder="Search legal tasks..." bind:value={qLegal} />
            </div>
          </div> -->
          
          <div class="tasks-grid">
            {#each fLegal as t}
              <article class="task-card {t.claimed?'completed':''}">
                <div class="task-image">
                  {#if t.image}
                    <img src={t.image} alt={t.title} />
                  {:else}
                    <div class="placeholder-image">
                      <span class="placeholder-icon"></span>
                    </div>
                  {/if}
                  <div class="task-status {t.claimed ? 'claimed' : t.completed >= t.required ? 'ready' : 'progress'}">
                    {#if t.claimed}
                      Claimed
                    {:else if t.completed >= t.required}
                       Ready
                    {:else}
                       In Progress
                    {/if}
                  </div>
                </div>
                
                <div class="task-content">
                  <h3 class="task-title">{t.title}</h3>
                  <div class="task-progress">
                    <span class="progress-text">{t.completed} / {t.required}</span>
                    <div class="progress-line">
                      <div class="progress-fill" style="width: {Math.min(100, (t.completed / t.required) * 100)}%"></div>
                    </div>
                  </div>

                  {#if t.reward}
                    <div class="task-reward">
                      <span class="reward-icon"></span>
                      <span class="reward-text">
                        {#if t.reward.type === 'money'}
                          ${t.reward.amount?.min}-${t.reward.amount?.max} ({t.reward.moneyType||'cash'})
                        {:else}
                          {t.reward.itemName} × {t.reward.itemCount?.min}-{t.reward.itemCount?.max}
                        {/if}
                      </span>
                    </div>
                  {/if}

                  {#if Object.keys(t.meta).length}
                    <div class="task-meta">
                      {#each Object.entries(t.meta).slice(0, 2) as [k,v]}
                        <span class="meta-tag">{k}: {String(v)}</span>
                      {/each}
                    </div>
                  {/if}
                </div>
                
                <div class="task-actions">
                  {#if !t.claimed && t.completed >= t.required}
                    <button class="claim-btn" on:click={() => claim(t,'legal')}>
                      <span class="btn-icon"></span>
                      Claim Reward
                    </button>
                  {:else if t.claimed}
                    <button class="claimed-btn" disabled>
                      <span class="btn-icon"></span>
                      Claimed
                    </button>
                  {:else}
                    <button class="progress-btn" disabled>
                      <span class="btn-icon"></span>
                      In Progress
                    </button>
                  {/if}
                </div>
              </article>
            {/each}
            
            {#if !fLegal.length}
              <div class="empty-state">
                <div class="empty-icon"></div>
                <h3>No Legal Tasks Found</h3>
                <p>Check back later for new opportunities</p>
              </div>
            {/if}
          </div>
        </div>

      {:else if tab === 'illegal'}
        <div class="tasks-section">
          <div class="section-header">
            <div class="header-left">
              <h2 class="section-title">Illegal Tasks</h2>
              <p class="section-subtitle">High-risk, high-reward operations</p>
            </div>
            <button class="start-btn" on:click={startmission} disabled={missionStarted}>
              <span class="refresh-icon"></span>
              {#if missionStarted}<span class="spinner s"></span>{/if}
              Start mission
            </button>
            <button class="stop-btn" on:click={stopmission} disabled={missionsopted}>
              <span class="refresh-icon"></span>
              {#if missionsopted}<span class="spinner s"></span>{/if}
              Stop mission
            </button>
            <!-- <button class="refresh-btn" on:click={loadIllegal}>
              <span class="refresh-icon"></span>
              Refresh
            </button> -->
          </div>
          
          <!-- <div class="search-bar">
            <div class="search-input-wrapper">
              <span class="search-icon"></span>
              <input class="search-input" placeholder="Search illegal tasks..." bind:value={qIllegal} />
            </div>
          </div> -->
          
          <div class="tasks-grid">
            {#each fIllegal as t}
              <article class="task-card illegal {t.claimed?'completed':''}">
                <div class="task-image">
                  {#if t.image}
                    <img src={t.image} alt={t.title} />
                  {:else}
                    <div class="placeholder-image illegal">
                      <span class="placeholder-icon"></span>
                    </div>
                  {/if}
                  <div class="task-status {t.claimed ? 'claimed' : t.completed >= t.required ? 'ready' : 'progress'}">
                    {#if t.claimed}
                       Claimed
                    {:else if t.completed >= t.required}
                       Ready
                    {:else}
                       In Progress
                    {/if}
                  </div>
                </div>
                
                <div class="task-content">
                  <h3 class="task-title">{t.title}</h3>
                  <div class="task-progress">
                    <span class="progress-text">{t.completed} / {t.required}</span>
                    <div class="progress-line">
                      <div class="progress-fill illegal" style="width: {Math.min(100, (t.completed / t.required) * 100)}%"></div>
                    </div>
                  </div>

                  {#if t.reward}
                    <div class="task-reward">
                      <span class="reward-icon"></span>
                      <span class="reward-text">
                        {#if t.reward.type === 'money'}
                          ${t.reward.amount?.min}-${t.reward.amount?.max} ({t.reward.moneyType||'black'})
                        {:else}
                          {t.reward.itemName} × {t.reward.itemCount?.min}-{t.reward.itemCount?.max}
                        {/if}
                      </span>
                    </div>
                  {/if}

                  {#if Object.keys(t.meta).length}
                    <div class="task-meta">
                      {#each Object.entries(t.meta).slice(0, 2) as [k,v]}
                        <span class="meta-tag">{k}: {String(v)}</span>
                      {/each}
                    </div>
                  {/if}
                </div>
                
                <div class="task-actions">
                  {#if !t.claimed && t.completed >= t.required}
                    <button class="claim-btn illegal" on:click={() => claim(t,'illegal')}>
                      <span class="btn-icon"></span>
                      Claim Reward
                    </button>
                  {:else if t.claimed}
                    <button class="claimed-btn" disabled>
                      <span class="btn-icon"></span>
                      Claimed
                    </button>
                  {:else}
                    <button class="progress-btn" disabled>
                      <span class="btn-icon"></span>
                      In Progress
                    </button>
                  {/if}
                </div>
              </article>
            {/each}
            
            {#if !fIllegal.length}
              <div class="empty-state">
                <div class="empty-icon"></div>
                <h3>No Illegal Tasks Found</h3>
                <p>Stay low and check back later</p>
              </div>
            {/if}
          </div>
        </div>
      {/if}
    {/if}
  </main>
</section>

<style>
  .tasks-app {
    display: flex;
    flex-direction: column;
    gap: 20px;
    height: 100%;
    font-family: var(--font);
  }

  /* Enhanced Header */
  .app-header {
    background: linear-gradient(135deg, var(--surface-elevated), var(--surface));
    border: 1px solid var(--border);
    border-radius: 16px;
    padding: 20px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
  }

  .header-content {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: 20px;
  }

  .header-icon {
    position: relative;
  }

  .icon-wrapper {
    width: 56px;
    height: 56px;
    background: linear-gradient(135deg, var(--accent), var(--accent-dark));
    border-radius: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 16px rgba(0, 212, 255, 0.3);
  }

  .icon {
    font-size: 24px;
    filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3));
  }

  .header-info {
    flex: 1;
  }

  .app-title {
    margin: 0;
    font: 900 24px/1.2 var(--font);
    color: var(--text-primary);
    letter-spacing: -0.5px;
  }

  .app-subtitle {
    margin: 4px 0 0;
    font: 600 14px/1.4 var(--font);
    color: var(--text-secondary);
  }

  /* Enhanced Navigation */
  .tab-navigation {
    display: flex;
    gap: 8px;
    background: rgba(255, 255, 255, 0.05);
    padding: 8px;
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .nav-tab {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 16px;
    border: none;
    border-radius: 8px;
    background: transparent;
    color: var(--text-secondary);
    font: 700 13px/1 var(--font);
    cursor: pointer;
    transition: all 0.2s ease;
    position: relative;
    overflow: hidden;
  }

  .nav-tab::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, var(--accent), var(--accent-dark));
    opacity: 0;
    transition: opacity 0.2s ease;
  }

  .nav-tab:hover::before {
    opacity: 0.1;
  }

  .nav-tab.active {
    background: linear-gradient(135deg, var(--accent), var(--accent-dark));
    color: white;
    box-shadow: 0 4px 12px rgba(0, 212, 255, 0.3);
  }

  .nav-tab.active::before {
    opacity: 0;
  }

  .tab-icon {
    font-size: 16px;
    position: relative;
    z-index: 1;
  }

  .tab-label {
    position: relative;
    z-index: 1;
  }

  /* Content Area */
  .app-content {
    flex: 1;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 16px;
    padding: 24px;
    overflow: auto;
    min-height: 400px;
  }

  /* Loading & Error States */
  .loading-state, .error-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    min-height: 300px;
    color: var(--text-secondary);
  }

  .loading-spinner {
    width: 40px;
    height: 40px;
    border: 3px solid rgba(255, 255, 255, 0.1);
    border-top: 3px solid var(--accent);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  .error-icon {
    font-size: 32px;
  }

  /* Home Section */
  .home-section {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 400px;
  }

  .welcome-card {
    text-align: center;
    max-width: 500px;
    padding: 40px;
    background: linear-gradient(135deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02));
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 20px;
    box-shadow: 0 16px 40px rgba(0, 0, 0, 0.2);
  }

  .welcome-icon {
    font-size: 64px;
    margin-bottom: 20px;
    filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.3));
  }

  .welcome-title {
    margin: 0 0 16px;
    font: 900 28px/1.2 var(--font);
    color: var(--text-primary);
    letter-spacing: -0.5px;
  }

  .welcome-text {
    margin: 0 0 32px;
    font: 600 16px/1.5 var(--font);
    color: var(--text-secondary);
  }

  .quick-actions {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .action-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 16px 24px;
    border: none;
    border-radius: 12px;
    font: 700 14px/1 var(--font);
    cursor: pointer;
    transition: all 0.2s ease;
    position: relative;
    overflow: hidden;
  }

  .action-btn.primary {
    background: linear-gradient(135deg, #1d6c46, #0f4c31);
    color: #e8fff5;
    box-shadow: 0 4px 16px rgba(29, 108, 70, 0.3);
  }

  .action-btn.secondary {
    background: linear-gradient(135deg, #7a1f25, #59161a);
    color: #ffe9e9;
    box-shadow: 0 4px 16px rgba(122, 31, 37, 0.3);
  }

  .action-btn.tertiary {
    background: linear-gradient(135deg, var(--accent), var(--accent-dark));
    color: white;
    box-shadow: 0 4px 16px rgba(0, 212, 255, 0.3);
  }

  .action-btn:hover {
    transform: translateY(-2px);
    filter: brightness(1.1);
  }

  .btn-icon {
    font-size: 18px;
  }

  /* Section Headers */
  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 24px;
    padding-bottom: 16px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    gap: 16px;
  }

  .header-left {
    flex: 1;
  }

  .section-title {
    margin: 0 0 4px;
    font: 900 20px/1.2 var(--font);
    color: var(--text-primary);
    letter-spacing: -0.3px;
  }

  .section-subtitle {
    margin: 0;
    font: 600 14px/1.4 var(--font);
    color: var(--text-secondary);
  }

  .refresh-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    color: var(--text-secondary);
    font: 700 12px/1 var(--font);
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .refresh-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    color: var(--accent);
    border-color: var(--accent);
  }

  .start-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    background: rgba(0, 109, 5, 0.267);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    color: var(--text-secondary);
    font: 700 12px/1 var(--font);
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .start-btn:hover {
    background: rgba(0, 109, 5, 0.267);
    /* color: var(--accent); */
    border-color: var(--accent);
  }
  .stop-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    background: rgba(204, 0, 0, 0.205);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    color: var(--text-secondary);
    font: 700 12px/1 var(--font);
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .stop-btn:hover {
    background: rgba(204, 0, 0, 0.205);

    /* color: var(--accent); */
    border-color: var(--accent);
  }

  .refresh-icon {
    font-size: 14px;
  }

  /* Progress Section */
  .progress-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 20px;
  }

  .progress-card {
    background: linear-gradient(135deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02));
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 16px;
    padding: 20px;
    transition: all 0.2s ease;
  }

  .progress-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
  }

  .card-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 16px;
  }

  .card-icon {
    font-size: 24px;
    filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3));
  }

  .card-info {
    flex: 1;
  }

  .card-title {
    margin: 0 0 4px;
    font: 800 16px/1.2 var(--font);
    color: var(--text-primary);
  }

  .card-subtitle {
    margin: 0;
    font: 600 12px/1.4 var(--font);
    color: var(--text-secondary);
  }

  .card-percentage {
    font: 900 18px/1 var(--font);
    color: var(--accent);
  }

  .progress-bar {
    margin-top: 12px;
  }

  .segbar {
    --n: 12;
    display: grid;
    grid-template-columns: repeat(var(--n), 1fr);
    gap: 4px;
    height: 12px;
  }

  .seg {
    position: relative;
    border-radius: 3px;
    overflow: hidden;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .fill {
    position: absolute;
    inset: 0;
    width: calc(var(--f) * 100%);
    border-radius: inherit;
    transition: width 0.3s ease;
  }

  .daily-fill {
    background: linear-gradient(90deg, #4ade80, #22c55e);
  }

  .weekly-fill {
    background: linear-gradient(90deg, var(--accent), var(--accent-dark));
  }

  .milestone-fill {
    background: linear-gradient(90deg, #f59e0b, #d97706);
  }

  /* Search Bar */
  .search-bar {
    margin-bottom: 24px;
  }

  .search-input-wrapper {
    position: relative;
    max-width: 400px;
  }

  .search-icon {
    position: absolute;
    left: 12px;
    top: 50%;
    transform: translateY(-50%);
    font-size: 16px;
    color: var(--text-muted);
  }

  .search-input {
    width: 100%;
    padding: 12px 16px 12px 40px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    color: var(--text-primary);
    font: 600 14px/1 var(--font);
    outline: none;
    transition: all 0.2s ease;
  }

  .search-input:focus {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px rgba(0, 212, 255, 0.1);
  }

  .search-input::placeholder {
    color: var(--text-muted);
  }

  /* Tasks Grid */
  .tasks-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 0.7fr));
    gap: 20px;
  }

  .task-card {
    background: linear-gradient(135deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02));
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 16px;
    overflow: hidden;
    transition: all 0.2s ease;
    display: flex;
    flex-direction: column;
  }

  .task-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.3);
    border-color: rgba(255, 255, 255, 0.2);
  }

  .task-card.completed {
    border-color: rgba(0, 212, 255, 0.3);
    background: linear-gradient(135deg, rgba(0, 212, 255, 0.1), rgba(0, 212, 255, 0.05));
  }

  .task-card.illegal {
    border-color: rgba(255, 120, 120, 0.2);
  }

  .task-card.illegal.completed {
    border-color: rgba(255, 120, 120, 0.3);
    background: linear-gradient(135deg, rgba(255, 120, 120, 0.1), rgba(255, 120, 120, 0.05));
  }

  .task-image {
    position: relative;
    height: 180px;
    overflow: hidden;
  }

  .task-image img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: transform 0.2s ease;
  }

  .task-card:hover .task-image img {
    transform: scale(1.05);
  }

  .placeholder-image {
    width: 100%;
    height: 100%;
    background: linear-gradient(135deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.05));
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .placeholder-image.illegal {
    background: linear-gradient(135deg, rgba(255, 120, 120, 0.2), rgba(255, 120, 120, 0.1));
  }

  .placeholder-icon {
    font-size: 48px;
    opacity: 0.6;
  }

  .task-status {
    position: absolute;
    top: 12px;
    right: 12px;
    padding: 6px 12px;
    border-radius: 20px;
    font: 700 11px/1 var(--font);
    backdrop-filter: blur(8px);
    border: 1px solid rgba(255, 255, 255, 0.2);
  }

  .task-status.claimed {
    background: rgba(34, 197, 94, 0.9);
    color: white;
  }

  .task-status.ready {
    background: rgba(0, 212, 255, 0.9);
    color: white;
  }

  .task-status.progress {
    background: rgba(245, 158, 11, 0.9);
    color: white;
  }

  .task-content {
    padding: 20px;
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .task-title {
    margin: 0;
    font: 800 18px/1.3 var(--font);
    color: var(--text-primary);
    letter-spacing: -0.3px;
  }

  .task-progress {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .progress-text {
    font: 700 12px/1 var(--font);
    color: var(--text-secondary);
  }

  .progress-line {
    height: 8px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 4px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: linear-gradient(90deg, var(--accent), var(--accent-dark));
    border-radius: 4px;
    transition: width 0.3s ease;
  }

  .progress-fill.illegal {
    background: linear-gradient(90deg, #ef4444, #dc2626);
  }

  .task-reward {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .reward-icon {
    font-size: 16px;
  }

  .reward-text {
    font: 700 12px/1 var(--font);
    color: var(--text-primary);
  }

  .task-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .meta-tag {
    padding: 4px 8px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    font: 600 10px/1 var(--font);
    color: var(--text-secondary);
  }

  .task-actions {
    padding: 16px 20px;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
  }

  .claim-btn, .claimed-btn, .progress-btn {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 12px 16px;
    border: none;
    border-radius: 10px;
    font: 700 14px/1 var(--font);
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .claim-btn {
    background: linear-gradient(135deg, #1d6c46, #0f4c31);
    color: #e8fff5;
    box-shadow: 0 4px 12px rgba(29, 108, 70, 0.3);
  }

  .claim-btn.illegal {
    background: linear-gradient(135deg, #7a1f25, #59161a);
    color: #ffe9e9;
    box-shadow: 0 4px 12px rgba(122, 31, 37, 0.3);
  }

  .claim-btn:hover {
    transform: translateY(-1px);
    filter: brightness(1.1);
  }

  .claimed-btn {
    background: rgba(34, 197, 94, 0.2);
    color: #bbf7d0;
    cursor: default;
  }

  .progress-btn {
    background: rgba(245, 158, 11, 0.2);
    color: #fde68a;
    cursor: default;
  }

  /* Empty State */
  .empty-state {
    grid-column: 1 / -1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    padding: 60px 20px;
    text-align: center;
  }

  .empty-icon {
    font-size: 64px;
    opacity: 0.6;
  }

  .empty-state h3 {
    margin: 0;
    font: 800 20px/1.2 var(--font);
    color: var(--text-primary);
  }

  .empty-state p {
    margin: 0;
    font: 600 14px/1.4 var(--font);
    color: var(--text-secondary);
  }

  /* Responsive Design */
  @media (max-width: 768px) {
    .app-header {
      padding: 16px;
    }

    .header-content {
      flex-direction: column;
      text-align: center;
      gap: 12px;
    }

    .tab-navigation {
      flex-wrap: wrap;
      justify-content: center;
    }

    .nav-tab {
      flex: 1;
      min-width: 120px;
    }

    .app-content {
      padding: 16px;
    }

    .section-header {
      flex-direction: column;
      align-items: flex-start;
      gap: 12px;
    }

    .progress-grid {
      grid-template-columns: 1fr;
    }

    .tasks-grid {
      grid-template-columns: 1fr;
    }

    .quick-actions {
      width: 100%;
    }
  }

  @media (max-width: 480px) {
    .welcome-card {
      padding: 24px;
    }

    .welcome-title {
      font-size: 24px;
    }

    .app-title {
      font-size: 20px;
    }

    .section-title {
      font-size: 18px;
    }
  }

    .spinner {
    width: 14px;
    height: 14px;
    border: 2px solid rgba(255,255,255,.2);
    border-top-color: currentColor;
    border-radius: 50%;
    animation: spin .8s linear infinite;
    margin-right: 6px;
  }
  .spinner.s {
    width: 12px;
    height: 12px;
    margin-right: 8px;
  }

  @keyframes spin { to { transform: rotate(360deg); } }
</style>