<script>
  export let title = 'No groups yet';
  export let hint  = 'Create your first group or browse public groups.';
  export let userIconSrc = 'usericon.png';
</script>

<div class="empty">
  <img class="ico" src={userIconSrc} alt="user" />
  <div class="t">{title}</div>
  <div class="h">{hint}</div>
</div>

<style>
  .empty{
    display:grid; place-items:center; text-align:center; gap:6px;
    padding:18px; border-radius:12px;
    background: rgba(255,255,255,.03);
    border:1px solid rgba(255,255,255,.08);
    color:#a9c1d4;
  }
  .ico{ width:58px; height:58px; opacity:.9; filter:drop-shadow(0 4px 14px rgba(0,0,0,.35)); }
  .t{ font:900 13px/1 ui-sans-serif; color:#dbefff; }
  .h{ font:700 11.5px/1.4 ui-sans-serif; color:#9fb6c9; }
</style>
