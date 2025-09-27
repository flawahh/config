(function () {
  'use strict';
  const CONFIG_ENDPOINTS = [
    'https://raw.githubusercontent.com/flawahh/config/main/config.json',
    'https://cdn.jsdelivr.net/gh/flawahh/config@main/config.json'
  ];
  const KEY_ENABLED  = 'to_highlighter_enabled';
  const KEY_INTERVAL = 'to_highlighter_interval_ms';
  const KEY_HUD      = 'to_highlighter_hud_enabled';
  let allies = [], enemies = [], neutrals = [];
  let setAllies = new Set(), setEnemies = new Set(), setNeutrals = new Set();
  let clanAllies = [], clanEnemies = [], clanNeutrals = [];
  let scriptEnabled = (localStorage.getItem(KEY_ENABLED) ?? 'true') === 'true';
  let HIGHLIGHT_INTERVAL_MS = parseInt(localStorage.getItem(KEY_INTERVAL) || '50', 10);
  let hudEnabled = (localStorage.getItem(KEY_HUD) ?? 'true') === 'true';
  const CONFIG_REFRESH_MS = 10000;
  let highlightTimer = null, configTimer = null;
  let lastConfigUpdate = null;
  let hudDot, hudCounts;
  (function injectStyle() {
    if (document.getElementById('to-highlighter-styles')) return;
    const style = document.createElement('style');
    style.id = 'to-highlighter-styles';
    style.textContent = `
      .to-ally    { color: lime !important;  font-weight: 800 !important; text-shadow: 0 0 8px #0f0 !important; }
      .to-enemy   { color: red  !important;  font-weight: 800 !important; text-shadow: 0 0 8px #f00 !important; }
      .to-neutral { color: gold !important;  font-weight: 800 !important; text-shadow: 0 0 8px #ff0 !important; }
    `;
    document.head.appendChild(style);
  })();
  const isClanTag = (x) => /^\[[^\]]+\]$/.test(x);
  function buildLookups() {
    setAllies = new Set(allies.filter((x) => !isClanTag(x)));
    setEnemies = new Set(enemies.filter((x) => !isClanTag(x)));
    setNeutrals = new Set(neutrals.filter((x) => !isClanTag(x)));
    clanAllies = allies.filter(isClanTag);
    clanEnemies = enemies.filter(isClanTag);
    clanNeutrals = neutrals.filter(isClanTag);
  }
  function matchCategory(name) {
    if (setAllies.has(name)) return 'ally';
    if (setEnemies.has(name)) return 'enemy';
    if (setNeutrals.has(name)) return 'neutral';
    for (const t of clanAllies)   if (name.startsWith(t)) return 'ally';
    for (const t of clanEnemies)  if (name.startsWith(t)) return 'enemy';
    for (const t of clanNeutrals) if (name.startsWith(t)) return 'neutral';
    return null;
  }
  function clearClasses(el) {
    el.classList.remove('to-ally', 'to-enemy', 'to-neutral');
  }
  function applyCategory(el, cat) {
    const cls = cat === 'ally' ? 'to-ally' : cat === 'enemy' ? 'to-enemy' : 'to-neutral';
    if (!el.classList.contains(cls)) {
      clearClasses(el);
      el.classList.add(cls);
    }
  }
  function findNicknameNodes() {
  let nodes = document.querySelectorAll(
    'td.UsersTableStyle-cellName span, td.BattleTabStatisticComponentStyle-nicknameCell span'
  );
  if (!nodes || nodes.length === 0) {
    const table = document.querySelector('.UsersTableStyle');
    if (table) nodes = table.querySelectorAll('span');
  }
  return nodes || [];
}
  function highlightScope() {
    if (!scriptEnabled) {
      updateHUD(0, 0, 0);
      return;
    }
    const nodes = findNicknameNodes();
    let a = 0, e = 0, n = 0;
    nodes.forEach((el) => {
      const name = (el.textContent || '').trim();
      if (!name) return;
      const cat = matchCategory(name);
      if (cat) {
        applyCategory(el, cat);
        if (cat === 'ally') a++;
        else if (cat === 'enemy') e++;
        else n++;
      } else {
        clearClasses(el);
      }
    });
    updateHUD(a, e, n);
  }
  function startHighlightTicker() {
    if (highlightTimer) clearInterval(highlightTimer);
    highlightTimer = setInterval(highlightScope, HIGHLIGHT_INTERVAL_MS);
  }
  function fetchConfigWithFallback(idx = 0) {
    if (idx >= CONFIG_ENDPOINTS.length) return;
    const url = CONFIG_ENDPOINTS[idx] + '?t=' + Date.now();
    GM.xmlHttpRequest({
      method: 'GET',
      url,
      onload: function (resp) {
        try {
          const cfg = JSON.parse(resp.responseText);
          allies = Array.isArray(cfg.allies) ? cfg.allies : [];
          enemies = Array.isArray(cfg.enemies) ? cfg.enemies : [];
          neutrals = Array.isArray(cfg.neutrals) ? cfg.neutrals : [];
          buildLookups();
          lastConfigUpdate = new Date();
          updateLastUpdatedLabel();
          highlightScope();
        } catch (e) {
          fetchConfigWithFallback(idx + 1);
        }
      },
      onerror: () => fetchConfigWithFallback(idx + 1),
      ontimeout: () => fetchConfigWithFallback(idx + 1)
    });
  }
  function loadConfig() { fetchConfigWithFallback(0); }
  function startConfigTimer() {
    if (configTimer) clearInterval(configTimer);
    configTimer = setInterval(loadConfig, CONFIG_REFRESH_MS);
  }
  function createHUD() {
    hudDot = document.createElement('div');
    hudDot.id = 'to-hud-dot';
    hudDot.style.cssText = `
      position: fixed; top: 10px; right: 10px; width: 14px; height: 14px;
      border-radius: 50%; background: ${scriptEnabled ? 'lime' : 'red'};
      box-shadow: 0 0 10px ${scriptEnabled ? 'lime' : 'red'};
      z-index: 999999; display:${hudEnabled ? 'block' : 'none'};
    `;
    document.body.appendChild(hudDot);
    hudCounts = document.createElement('div');
    hudCounts.id = 'to-hud-counts';
    hudCounts.style.cssText = `
      position: fixed; top: 30px; right: 10px; color: #e8f7ff;
      font-family: 'Segoe UI', sans-serif; font-size: 13px;
      background: rgba(0,0,0,0.6); padding: 4px 8px; border-radius: 6px;
      box-shadow: 0 0 8px rgba(0,0,0,0.5);
      z-index: 999999; display:${hudEnabled ? 'block' : 'none'};
    `;
    hudCounts.textContent = 'Allies: 0 | Enemies: 0 | Neutrals: 0';
    document.body.appendChild(hudCounts);
  }
  function updateHUD(a = 0, e = 0, n = 0) {
    if (hudDot) {
      hudDot.style.background = scriptEnabled ? 'lime' : 'red';
      hudDot.style.boxShadow = `0 0 10px ${scriptEnabled ? 'lime' : 'red'}`;
      hudDot.style.display = hudEnabled ? 'block' : 'none';
    }
    if (hudCounts) {
      hudCounts.textContent = `Allies: ${a} | Enemies: ${e} | Neutrals: ${n}`;
      hudCounts.style.display = hudEnabled ? 'block' : 'none';
    }
  }
  function createModal() {
    const modal = document.createElement('div');
    modal.id = 'clanHighlighterModal';
    modal.style.cssText = `
      position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
      background: radial-gradient(120% 120% at 50% 0%, #151515 0%, #0b0b0b 60%, #060606 100%);
      color: #e8f7ff; padding: 26px 28px; border-radius: 14px; z-index: 999999;
      max-width: 520px; width: calc(100% - 40px);
      font-family: 'Segoe UI', system-ui, -apple-system, Roboto, Arial, sans-serif;
      border: 1px solid rgba(0,234,255,0.3); box-shadow: 0 0 35px rgba(0,234,255,0.35), inset 0 0 18px rgba(0,234,255,0.15);
      backdrop-filter: blur(4px);
      display: none;
    `;
    modal.innerHTML = `
      <style>
        #clanHighlighterModal h2 { margin: 4px 0 12px; color: #00eaff; text-align: center; font-weight: 800; text-shadow: 0 0 12px rgba(0,234,255,0.9); }
        #clanHighlighterModal .row { display: flex; align-items: center; justify-content: space-between; margin: 10px 0; }
        #clanHighlighterModal .pill {
          display: inline-flex; gap: 10px; background: linear-gradient(145deg, rgba(0,234,255,0.1), rgba(0,234,255,0.05));
          border: 1px solid rgba(0,234,255,0.25); border-radius: 999px; padding: 8px 12px; margin: 4px 6px 8px 0;
        }
        #clanHighlighterModal .divider { height: 1px; border: none; margin: 12px 0; background: linear-gradient(90deg, rgba(0,234,255,0), rgba(0,234,255,0.6), rgba(0,234,255,0)); }
        #clanHighlighterModal .btn {
          background: linear-gradient(145deg, #00eaff 0%, #0077aa 100%); border: none; border-radius: 10px;
          padding: 10px 14px; color: #01161a; font-weight: 800; cursor: pointer; box-shadow: 0 6px 24px rgba(0,234,255,0.35);
        }
        #clanHighlighterModal .btn-ghost { background: transparent; color: #9bd9e4; border: 1px solid rgba(0,234,255,0.3); }
        #clanHighlighterModal .close { position: absolute; top: 10px; right: 12px; background: transparent; color: #b9f4ff; border: none; font-size: 18px; cursor: pointer; padding: 6px 8px; border-radius: 8px; }
        #clanHighlighterModal .switch { position: relative; width: 56px; height: 28px; background: linear-gradient(145deg, #0f2b30, #0b1e21);
          border: 1px solid rgba(0,234,255,0.25); border-radius: 999px; cursor: pointer; }
        #clanHighlighterModal .knob { position: absolute; top: 3px; left: 3px; width: 22px; height: 22px; border-radius: 50%; background: #00eaff; box-shadow: 0 0 14px rgba(0,234,255,0.9); transition: left 160ms ease; }
        #clanHighlighterModal .switch.on .knob { left: 31px; background: #2aff9b; box-shadow: 0 0 14px rgba(42,255,155,0.9); }
        #clanHighlighterModal .slider-wrap { margin-top: 8px; background: linear-gradient(145deg, rgba(0,234,255,0.08), rgba(0,234,255,0.04)); border: 1px solid rgba(0,234,255,0.25); border-radius: 12px; padding: 12px; }
        #clanHighlighterModal input[type=range] { -webkit-appearance: none; width: 100%; height: 10px; border-radius: 6px; background: linear-gradient(90deg, #09333a, #0a1f24); outline: none; box-shadow: inset 0 0 6px #000; }
        #clanHighlighterModal input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; width: 20px; height: 20px; border-radius: 50%; background: radial-gradient(circle at 35% 35%, #fff, #00eaff); cursor: pointer; box-shadow: 0 0 12px rgba(0,234,255,0.9); }
        #clanHighlighterModal .footer { margin-top: 12px; font-size: 12px; text-align: center; color: #9bd9e4; }
        #clanHighlighterModal .muted { color: #8cbfc9; font-size: 13px; }
        #clanHighlighterModal .tag { font-weight: 800; }
      </style>
      <button class="close" id="to-close">✖</button>
      <h2>Nickname Highlighter</h2>
      <div>
        <span class="pill"><span style="color:lime; font-weight:800; text-shadow:0 0 8px lime;">Green</span> = Allies</span>
        <span class="pill"><span style="color:red; font-weight:800; text-shadow:0 0 8px red;">Red</span> = Enemies</span>
        <span class="pill"><span style="color:gold; font-weight:800; text-shadow:0 0 8px gold;">Yellow</span> = Neutrals</span>
      </div>
      <div class="row">
        <div>
          <div><b>Status:</b> <span id="to-status" class="tag">${scriptEnabled ? 'ENABLED' : 'DISABLED'}</span></div>
          <div class="muted">F4: panel • F5: reload config • F6: toggle script</div>
        </div>
        <div id="to-switch-script" class="switch ${scriptEnabled ? 'on' : ''}">
          <div class="knob"></div>
        </div>
      </div>
      <div class="row">
        <div><b>HUD indicators</b></div>
        <div id="to-switch-hud" class="switch ${hudEnabled ? 'on' : ''}">
          <div class="knob"></div>
        </div>
      </div>
      <hr class="divider">
      <div class="slider-wrap">
        <div class="row" style="margin: 0 0 8px 0;">
          <div><b>Highlight interval</b></div>
          <div><span id="to-interval-value" class="tag">${HIGHLIGHT_INTERVAL_MS}</span> ms</div>
        </div>
        <input type="range" id="to-interval-slider" min="20" max="200" step="5" value="${HIGHLIGHT_INTERVAL_MS}">
        <div class="muted" style="margin-top:6px;">How often names are scanned and colored (default 50ms)</div>
      </div>
      <div class="row" style="margin-top: 12px;">
        <button class="btn" id="to-reload">Reload Config Now</button>
        <button class="btn btn-ghost" id="to-hide">Hide</button>
      </div>
      <div class="footer">
        Author: <b>DaddyFlaw</b> • Discord: <b>flawahhhh</b><br>
        <span id="to-last-updated" class="muted">Config: not loaded yet</span>
      </div>
    `;
    document.body.appendChild(modal);
    const closeBtn   = modal.querySelector('#to-close');
    const hideBtn    = modal.querySelector('#to-hide');
    const statusEl   = modal.querySelector('#to-status');
    const switchScript = modal.querySelector('#to-switch-script');
    const switchHUD    = modal.querySelector('#to-switch-hud');
    const reloadBtn  = modal.querySelector('#to-reload');
    const sliderEl   = modal.querySelector('#to-interval-slider');
    const valueEl    = modal.querySelector('#to-interval-value');
    const setScriptStatus = (on) => {
      statusEl.textContent = on ? 'ENABLED' : 'DISABLED';
      switchScript.classList.toggle('on', on);
      updateHUD();
    };
    const setHUDStatus = (on) => {
      switchHUD.classList.toggle('on', on);
      hudEnabled = on;
      localStorage.setItem(KEY_HUD, String(hudEnabled));
      updateHUD();
    };
    closeBtn.addEventListener('click', () => (modal.style.display = 'none'));
    hideBtn.addEventListener('click',  () => (modal.style.display = 'none'));
    switchScript.addEventListener('click', () => {
      scriptEnabled = !scriptEnabled;
      localStorage.setItem(KEY_ENABLED, String(scriptEnabled));
      setScriptStatus(scriptEnabled);
    });
    switchHUD.addEventListener('click', () => {
      setHUDStatus(!hudEnabled);
    });
    reloadBtn.addEventListener('click', () => loadConfig());
    sliderEl.addEventListener('input', () => {
      HIGHLIGHT_INTERVAL_MS = parseInt(sliderEl.value, 10);
      valueEl.textContent = String(HIGHLIGHT_INTERVAL_MS);
      localStorage.setItem(KEY_INTERVAL, String(HIGHLIGHT_INTERVAL_MS));
      startHighlightTicker();
    });
    return modal;
  }
  function updateLastUpdatedLabel() {
    const el = document.querySelector('#to-last-updated');
    if (!el) return;
    if (!lastConfigUpdate) el.textContent = 'Config: not loaded yet';
    else el.textContent = `Config updated: ${lastConfigUpdate.toLocaleTimeString()}`;
  }
  document.addEventListener('keydown', (e) => {
    if (e.code === 'F4') {
      const modal = document.querySelector('#clanHighlighterModal');
      if (modal) modal.style.display = modal.style.display === 'none' ? 'block' : 'none';
    } else if (e.code === 'F5') {
      loadConfig();
    } else if (e.code === 'F6') {
      scriptEnabled = !scriptEnabled;
      localStorage.setItem(KEY_ENABLED, String(scriptEnabled));
      const statusEl = document.querySelector('#to-status');
      const switchEl = document.querySelector('#to-switch-script');
      if (statusEl) statusEl.textContent = scriptEnabled ? 'ENABLED' : 'DISABLED';
      if (switchEl) switchEl.classList.toggle('on', scriptEnabled);
      updateHUD();
    }
  });
  if (typeof GM_registerMenuCommand !== 'undefined') {
    GM_registerMenuCommand('Reload Config Now', loadConfig);
    GM_registerMenuCommand('Toggle Script', () => {
      scriptEnabled = !scriptEnabled;
      localStorage.setItem(KEY_ENABLED, String(scriptEnabled));
      const statusEl = document.querySelector('#to-status');
      const switchEl = document.querySelector('#to-switch-script');
      if (statusEl) statusEl.textContent = scriptEnabled ? 'ENABLED' : 'DISABLED';
      if (switchEl) switchEl.classList.toggle('on', scriptEnabled);
      updateHUD();
      alert('Script is now ' + (scriptEnabled ? 'ENABLED' : 'DISABLED'));
    });
    GM_registerMenuCommand((hudEnabled ? 'Disable' : 'Enable') + ' HUD', () => {
      hudEnabled = !hudEnabled;
      localStorage.setItem(KEY_HUD, String(hudEnabled));
      const hudSwitch = document.querySelector('#to-switch-hud');
      if (hudSwitch) hudSwitch.classList.toggle('on', hudEnabled);
      updateHUD();
      alert('HUD is now ' + (hudEnabled ? 'ENABLED' : 'DISABLED'));
    });
    GM_registerMenuCommand('Set Highlight Interval (ms)', () => {
      const val = prompt('Enter highlight interval in ms:', String(HIGHLIGHT_INTERVAL_MS));
      if (val && !isNaN(val)) {
        HIGHLIGHT_INTERVAL_MS = Math.max(20, Math.min(200, parseInt(val, 10)));
        localStorage.setItem(KEY_INTERVAL, String(HIGHLIGHT_INTERVAL_MS));
        startHighlightTicker();
        const valueEl = document.querySelector('#to-interval-value');
        const sliderEl = document.querySelector('#to-interval-slider');
        if (valueEl) valueEl.textContent = String(HIGHLIGHT_INTERVAL_MS);
        if (sliderEl) sliderEl.value = String(HIGHLIGHT_INTERVAL_MS);
        alert('Highlight interval set to ' + HIGHLIGHT_INTERVAL_MS + ' ms');
      }
    });
    GM_registerMenuCommand('Show Panel (F4)', () => {
      const modal = document.querySelector('#clanHighlighterModal');
      if (modal) modal.style.display = 'block';
    });
  }
  function init() {
    const modal = createModal();
    createHUD();
    window.addEventListener('load', () => { modal.style.display = 'block'; });
    loadConfig();
    startConfigTimer();
    startHighlightTicker();
    setInterval(updateLastUpdatedLabel, 5000);
    setTimeout(() => highlightScope(), 300);
  }
  init();
})();
