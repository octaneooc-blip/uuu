<script>
  export let bannerSrc = 'https://images.dz-crew.com/tablet/groups/sticky-note.png';   // نفس البانر القديم
  export let noteText = `"Welcome to the Groups App,\nwhere you can create new groups\nand join with ease and simplicity!"`;
</script>

<section class="grp-hero">
  <img class="hero-img" src={bannerSrc} alt="WELCOME TO GROUPS APP" />
  <div class="note">
    <div class="pin"></div>
    <pre class="text">{noteText}</pre>
  </div>
</section>

<style>
  .grp-hero{
    position:relative;
    width:100%;
    border-radius:14px;
    overflow:hidden;
    border:1px solid rgba(255,255,255,.08);
    box-shadow:0 18px 40px rgba(0,0,0,.35), inset 0 1px 0 rgba(255,255,255,.04);
    background:linear-gradient(180deg,#0f3e5f,#0b2c44 40%,#0b2436);
  }
  .hero-img{ display:block; width:100%; height:auto; }
  .note{
    position:absolute; top:10px; right:16px;
    width:220px; padding:12px 12px 14px;
    background:#8ad8ff2b; backdrop-filter: blur(4px);
    border-radius:10px; border:1px solid rgba(255,255,255,.2);
    transform: rotate(2deg);
  }
  .pin{
    position:absolute; width:14px; height:14px; border-radius:50%;
    background:#53b8ff; box-shadow:0 2px 6px rgba(0,0,0,.35);
    right:10px; top:-7px;
  }
  .text{
    margin:0; white-space:pre-wrap;
    color:#dff3ff; font:800 11.5px/1.35 ui-sans-serif;
  }
</style>
