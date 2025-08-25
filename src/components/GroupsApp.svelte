<script>
  import { onMount, onDestroy } from 'svelte';

  /* ---------- NUI helper ---------- */
  async function postJSON(endpoint, data = {}) {
    const url = `https://${(typeof GetParentResourceName === 'function' ? GetParentResourceName() : 'debug')}/${endpoint}`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      try { return await res.json(); } catch { return null; }
    } catch {
      return null;
    }
  }

  /* ---------- Utils ---------- */
  const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

  /* ---------- State ---------- */
  let show = 'main';               // 'main' | 'create' | 'list' | 'group' | 'requests'
  let isInGroup = false;
  let isGroupLeader = false;
  let GroupID = 0;
  let CurrentStage = 'WAITING';

  // Data buckets
  let GroupList = [];              // [{ id, name, image, members }]
  let GroupMembers = [];           // [{ id, name, isLeader, avatar }]
  let GroupRequests = [];          // [{ id, name, avatar }]
  let newGroupName = '';
  let newGroupImage = '';

  /* ---------- Navigation ---------- */
  const goMain   = () => (show = 'main');
  const goCreate = () => { if (!isInGroup) show = 'create'; };
  const goGroup  = () => (show = 'group');

  async function goList() {
    const r = await postJSON('getActiveGroups', {});
    GroupList = Array.isArray(r) ? r : (r?.groups || []);
    show = 'list';
  }

  async function goReqs() {
    const r = await postJSON('view-requests', { groupID: GroupID });
    GroupRequests = Array.isArray(r) ? r : (r?.requests || []);
    show = 'requests';
  }

  function goMyGroup() {
    if (isInGroup) {
      show = 'group';
      getgroupmembers();
      GroupLeader();
    } else {
      goList();
    }
  }

  /* ---------- Actions ---------- */
  async function createGroup() {
    if (!newGroupName.trim() || isInGroup) return;
    const payload = { name: newGroupName, image: newGroupImage };
    const res = await postJSON('group-create', payload);
    if (!res) return;

    // You created a group -> immediately in group & leader
    isInGroup = true;
    isGroupLeader = true;
    GroupID = res.groupID;
    GroupMembers = [res]; // old script behavior: server returns creator object
    CurrentStage = 'WAITING';
    show = 'group'
    await postJSON('group-created', { GroupID, status: CurrentStage, leader: isGroupLeader });

    newGroupName = '';
    newGroupImage = '';
    // show = 'group';
    // goMyGroup();
  }

  async function requestJoin(id) {
    await postJSON('request-join', { groupID: id });
  }

  async function InGroup() {
    
    const res = await postJSON('group-checkingroup', {});
    if (res && res.inGroup) {
      isInGroup = true;
      GroupID = res.groupID || 0;
    } else {
      isInGroup = false;
      GroupID = 0;
    }
    return isInGroup;
  }

  InGroup();

async function GroupLeader() {
  if (!isInGroup) return false;
  const res = await postJSON('group-checkleader', {}); // no need to send groupID
  isGroupLeader = !!res?.isLeader;
  console.log('isGroupLeader:', isGroupLeader);

  return isGroupLeader;
}


  async function getgroupmembers() {
    if (!isInGroup || !GroupID) return;
    const res = await postJSON('group-getgroupmembers', { groupID: GroupID });
    GroupMembers = Array.isArray(res) ? res : (res?.members || []);
  }

 
    
 

  async function leaveGroup() {
    if (!isInGroup) return;

    // optimistic UI (instant)
    const prevId = GroupID;
    const prevMembers = [...GroupMembers];
    const prevLeader = isGroupLeader;

    isInGroup = false;
    isGroupLeader = false;
    GroupID = 0;
    GroupMembers = [];
    CurrentStage = 'None';
    show = 'main';

    try {
      await postJSON('group-leave', { groupID: prevId });
      await postJSON('group-cleanup', {});
    } catch {
      // revert if failed
      isInGroup = true;
      isGroupLeader = prevLeader;
      GroupID = prevId;
      GroupMembers = prevMembers;
      CurrentStage = 'WAITING';
      show = 'group';
    }
  }

  async function requestAccept(idx, id) {
    GroupRequests.splice(idx, 1);
    await postJSON('request-accept', { player: id, groupID: GroupID });
  }

  async function requestDeny(idx, id) {
    GroupRequests.splice(idx, 1);
    await postJSON('request-deny', { player: id, groupID: GroupID });
  }

  async function memberKick(idx, id) {
    GroupMembers.splice(idx, 1);
    await postJSON('member-kick', { player: id, groupID: GroupID });
  }

  function cleanup() {
    isInGroup = false;
    isGroupLeader = false;
    GroupID = 0;
    CurrentStage = 'None';
    GroupMembers = [];
    GroupRequests = [];
    postJSON('group-cleanup', {});
  }

  /* ---------- NUI message bridge (same semantics as old UI) ---------- */
  function handleMessage(e) {
    const d = e.data || {};
    if (d.action === 'open') {
      show = isInGroup ? 'group' : 'main';
    } else if (d.action === 'update') {
      if (d.type === 'setStage') {
        CurrentStage = d.data?.stage || 'WAITING';
        postJSON('update-status', { status: CurrentStage });
      } else if (d.type === 'groupDestroy') {
        cleanup();
        show = 'main';
      } else if (d.type === 'update') {
        GroupMembers = Array.isArray(d.data) ? d.data : [];
      }
    } else if (d.action === 'join') {
      isInGroup = true;
      GroupID = d.groupID;
      show = 'group';
    } else if (d.action === 'makeLeader') {
      isGroupLeader = true;
    }
  }

  /* ---------- Mount ---------- */
  onMount(async () => {
    window.addEventListener('message', handleMessage);

    // DEV preview (web testing)
    if (import.meta?.env?.DEV) {
      GroupList = [
        { id: 1, name: 'Alpha Squad',  image: 'https://via.placeholder.com/100/4299E1/FFFFFF?text=A', members: 8 },
        { id: 2, name: 'Bravo Team',   image: 'https://via.placeholder.com/100/48BB78/FFFFFF?text=B', members: 14 },
        { id: 3, name: 'Operation X',  image: 'https://via.placeholder.com/100/F56565/FFFFFF?text=O', members: 3 }
      ];
      // simulate: not in group at start
      isInGroup = false;
      isGroupLeader = false;
      show = 'main';
    }
  });

  onDestroy(() => window.removeEventListener('message', handleMessage));
</script>

<section class="groups">
  <!-- Top Bar -->
  <header class="topbar">
    <div class="tb-left">
      <img class="tb-icon" src="https://images.dz-crew.com/tablet/icons/usericon.png" alt="Groups" />
      <div class="tb-titles">
        <h2>Groups</h2>
        <p>Organize, recruit, and play together</p>
      </div>
    </div>

    <div class="tb-actions">
      <button class="btn" on:click={goMyGroup} disabled={!isInGroup} title={!isInGroup ? 'Not in a group' : 'Open my group'}>
        My Group
      </button>

      <button class="btn btn-primary"
              on:click={goCreate}
              disabled={isInGroup}
              aria-disabled={isInGroup}
              title={isInGroup ? 'You are already in a group' : 'Create a group'}>
        Create Group
      </button>

      <button class="btn" on:click={goList}>
        Available Groups
      </button>

      {#if show === 'group'}
        <button class="btn danger" on:click={leaveGroup}>⟲ Leave Group</button>
      {/if}
    </div>
  </header>

  <!-- Content Area -->
  <div class="content">
    {#if show === 'create'}
      <div class="panel">
        <div class="panel-head">
          <h3>Create a New Group</h3>
          <button class="btn small" on:click={goMain}>← Back</button>
        </div>

        <div class="form">
          <div class="field">
            <label>Group Name</label>
            <input class="input" placeholder="e.g. Night Watch" bind:value={newGroupName} />
          </div>

          <div class="field">
            <label>Image URL (optional)</label>
            <input class="input" placeholder="https://..." bind:value={newGroupImage} />
          </div>

          <button class="btn btn-primary" on:click={createGroup}>Create</button>
        </div>
      </div>

    {:else if show === 'list'}
      <div class="panel">
        <div class="panel-head">
          <h3>Public Groups / مجموعات متاحة</h3>
          <span class="muted">{plural(GroupList.length, 'group')}</span>
        </div>

        <div class="grid">
          <div class="card dashed"
               class:disabled={isInGroup}
               on:click={() => { if (!isInGroup) goCreate(); }}
               title={isInGroup ? 'Already in a group' : 'Create Group'}>
            <div class="plus">＋</div>
            <div class="card-name">Create Group</div>
            <div class="card-sub">أنشئ مجموعة جديدة</div>
          </div>

        {#each GroupList as g}
          <div class="card" on:click={() => requestJoin(g.id)} title={g.name}>
            <div class="avatar">
              <img
                src={g.image || 'https://images.dz-crew.com/tablet/groups/usericon.png'}
                alt=""
                on:error={(e) => e.target.src = 'https://images.dz-crew.com/tablet/groups/usericon.png'}
              />
            </div>
            <div class="card-name">{g.name}</div>
            <div class="card-sub">{plural(g.members || 0, 'member')}</div>
          </div>
        {/each}

        </div>

        {#if !GroupList.length}
          <div class="empty">No groups are available at the moment.</div>
        {/if}
      </div>

    {:else if show === 'group'}
      <div class="panel">
        <div class="panel-head">
          <h3>My Group</h3>
          <div class="head-actions">
            {#if isGroupLeader}
              <button class="btn small" on:click={goReqs}>📥 Requests</button>
            {/if}
            <button class="btn small danger" on:click={leaveGroup}>⟲ Leave</button>
          </div>
        </div>

        <div class="sub-title">Current Task: {CurrentStage}</div>

      <div class="members">
        {#each GroupMembers as m, i}
          <div class="member">
            {#if m.isLeader}
              <span class="leader" title="Leader">★</span>
            {/if}
            <img
              class="m-img"
              src={m.avatar || 'https://images.dz-crew.com/tablet/groups/usericon.png'}
              alt=""
              on:error={(e) => e.target.src = 'https://images.dz-crew.com/tablet/groups/usericon.png'}
            />
            <div class="m-name" title={m.name}>{m.name}</div>
            {#if isGroupLeader && !m.isLeader}
              <button class="kick" on:click={() => memberKick(i, m.id)}>✕</button>
            {/if}
          </div>
        {/each}
      </div>


        {#if !GroupMembers.length}
          <div class="empty">This group has no members.</div>
        {/if}
      </div>

    {:else if show === 'requests'}
      <div class="panel">
        <div class="panel-head">
          <h3>Group Requests</h3>
          <button class="btn small" on:click={goGroup}>← Back</button>
        </div>

        <div class="reqs">
          {#each GroupRequests as r, i}
            <div class="req">
              <div class="info">
                <img class="req-img" src={r.avatar || './usericon.png'} alt="" />
                <span>{r.name}</span>
              </div>
              <div class="req-actions">
                <button class="btn small accept" on:click={() => requestAccept(i, r.id)}>✔</button>
                <button class="btn small deny"   on:click={() => requestDeny(i, r.id)}>✖</button>
              </div>
            </div>
          {/each}
        </div>

        {#if !GroupRequests.length}
          <div class="empty">You have no pending join requests.</div>
        {/if}
      </div>

    {:else}
      <div class="panel">
        <div class="panel-head">
          <h3>Welcome</h3>
        </div>
        <div class="intro">
          <p class="lead">
            انضم إلى أصدقائك وأنجزوا المهام سويًا — أنشئ مجموعة جديدة أو انضم إلى واحدة متاحة.
          </p>
          <p class="lead fr">
            Rejoignez vos amis et accomplissez des missions ensemble — créez votre groupe ou rejoignez-en un.
          </p>
          <div class="cta">
            <button class="btn btn-primary" on:click={goCreate} disabled={isInGroup}>Create Group</button>
            <button class="btn" on:click={goList}>Available Groups</button>
          </div>
        </div>
      </div>
    {/if}
  </div>
</section>

<style>
  :root{
        --surface: rgba(255,255,255,.03);
    --surface-2: rgba(255,255,255,.05);
     --border: rgba(255,255,255,.12);
    --accent: #35d0ff;
    --text: #eaf3fb;
    --text-2:#a8bacb;
    --font: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial;



  }

  .groups{
    display:flex; flex-direction:column; gap:12px;
  }

  /* Top bar */
  .topbar{
    display:flex; align-items:center; justify-content:space-between;
    background: var(--surface);
    border:1px solid var(--border);
    border-radius:12px;
    padding:10px 12px;
    box-shadow: 0 12px 26px rgba(0,0,0,.25) inset, 0 10px 24px rgba(0,0,0,.18);
  }
  .tb-left{ display:flex; align-items:center; gap:10px; }
  .tb-icon{ width:34px; height:34px; object-fit:contain;  }
  .tb-titles h2{ margin:0; font:900 16px/1.1 var(--font); color:#e5f7ff; }
  .tb-titles p{ margin:0; color:#aecdde; font:700 11px/1 var(--font); }

  .tb-actions{ display:flex; gap:8px; }
  .btn{
    height:32px; padding:0 12px; border-radius:8px;
    border:1px solid var(--border);
    background: var(--surface-2);
    color:#cfe0ec; font:800 12px/1 var(--font);
    cursor:pointer;
    transition: transform .1s ease, border-color .15s ease, color .15s ease, filter .15s ease;
  }
  .btn:hover{ transform: translateY(-1px); border-color: var(--accent); color: var(--accent); }
  .btn[disabled]{ opacity:.6; cursor: default; filter: grayscale(15%); }
  .btn.small{ height:26px; padding:0 10px; font-size:11px; }

  .btn-primary{ background: linear-gradient(180deg,#1d6c46,#0f4c31); color:#e8fff5; border-color: rgba(0,0,0,.25); }
  .btn-primary:hover{ filter: brightness(1.06); border-color:#2b9a6c; }
  .danger{ background: linear-gradient(180deg,#7a1f25,#59161a); color:#ffe9e9; border-color: rgba(0,0,0,.25); }

  /* Content wrapper */
  .content{ display:flex; flex-direction:column; gap:10px; }

  /* Generic panel */
  .panel{
    background: var(--surface);
    border:1px solid var(--border);
    border-radius:12px;
    padding:12px;
    /* box-shadow: 0 20px 40px rgba(0,0,0,.18) inset, 0 14px 28px rgba(0,0,0,.18); */
  }
  .panel-head{
    display:flex; align-items:center; justify-content:space-between; gap:10px;
    margin-bottom:8px;
  }
  .panel-head h3{ margin:0; font:900 14px/1.1 var(--font); color:#cfe8ff; }
  .muted{ color:#9fb0bd; }

  /* Intro (main) */
  .intro{ display:flex; flex-direction:column; gap:10px; }
  .lead{ margin:0; color:#cfe2f3; font:700 12.5px/1.6 var(--font); }
  .lead.fr{ opacity:.95; }
  .cta{ display:flex; gap:8px; margin-top:6px; }

  /* Form */
  .form{ display:grid; gap:10px; max-width:460px; }
  .field{ display:grid; gap:6px; }
  .field label{ color:#cfe8ff; font:800 12px/1 var(--font); }
  .input{
    height:36px; padding:0 10px; border:1px solid var(--border); border-radius:8px;
    background: rgba(255,255,255,.04); color:#fff;
    font:700 12px/1 var(--font); outline:none;
  }

  /* List grid */
  .grid{
    display:grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap:10px;
  }
  .card{
    border:1px solid var(--border); border-radius:10px;
    background: rgba(255,255,255,.04);
    padding:12px; text-align:center; cursor:pointer;
    display:flex; flex-direction:column; align-items:center; gap:8px;
    transition: transform .12s ease, border-color .15s ease;
  }
  .card:hover{ border-color: rgba(255,255,255,.18); transform: translateY(-1px); }
  .card.dashed{ border:2px dashed var(--border); background: transparent; color:#a0aec0; }
  .card.disabled{ opacity:.6; pointer-events: none; filter: grayscale(20%); }
  .plus{ width:46px; height:46px; border-radius:50%; display:grid; place-items:center; background: var(--border); color:#fff; }

  .avatar{ width:68px; height:68px; border-radius:50%; overflow:hidden; }
  .avatar img{ width:100%; height:100%; object-fit:cover; }
  .card-name{ font:800 12.5px/1.1 var(--font); color:#e2eef7; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width: 100%; }
  .card-sub{ color:#97a8b7; font:700 11px/1 var(--font); }

  /* Group members */
  .sub-title{ color:#9fbdd7; font:800 11px/1 var(--font); text-transform:uppercase; margin:6px 0 10px; }
  .members{
    display:grid;
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
    gap:10px;
  }
  .member{
    position:relative;
    border:1px solid var(--border); border-radius:10px;
    background: rgba(255,255,255,.04);
    padding:10px; display:flex; flex-direction:column; align-items:center; gap:6px;
  }
  .leader{ position:absolute; top:8px; right:8px; color:#2db0ff; }
  .m-img{ width:80px; height:80px; border-radius:50%; object-fit:cover; }
  .m-name{ font:700 12px/1 var(--font); color:#e3eef9; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:100%; }
  .kick{
    position:absolute; right:6px; bottom:6px; width:24px; height:24px; border-radius:50%; border:none; cursor:pointer;
    background: rgba(245,101,101,.2); color:#f56565;
  }

  /* Requests */
  .reqs{ display:flex; flex-direction:column; gap:8px; }
  .req{
    display:flex; align-items:center; justify-content:space-between;
    border:1px solid var(--border); border-radius:10px;
    background: rgba(255,255,255,.04);
    padding:10px;
  }
  .info{ display:flex; align-items:center; gap:10px; }
  .req-img{ width:40px; height:40px; border-radius:50%; object-fit:cover; }
  .req-actions .btn{ margin-left:6px; }
  .accept{ background:#48bb78; color:#fff; }
  .deny{ background:#f56565; color:#fff; }

  .empty{ color:#9fb0bd; padding:8px; text-align:center; }

  @media (max-width: 740px){
    .tb-titles p{ display:none; }
    .tb-actions{ gap:6px; }
  }
</style>
