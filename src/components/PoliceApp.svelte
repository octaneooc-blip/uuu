<script>
  import { onMount, onDestroy } from 'svelte';
  import { postJSON } from '../lib/nui';

  export let playerId = null;

  // State
  let alerts = [];
  let loading = false;
  let error = '';
  let selectedAlert = null;

  // Mock data for development
  const mockAlerts = [
    {
      id: 1,
      type: 'Car Jacking',
      code: '#718',
      priority: 'Code 3',
      time: '42 Seconds ago',
      street: 'Nikola Avenue, Mirror Park',
      vehicle: 'Yamaha MT 09',
      plate: 'B6T8GNC',
      color: 'Metallic Black on Metallic Race Yellow',
      class: 'Motorcycle',
      heading: 'North Bound',
      timestamp: Date.now() - 42000
    },
    {
      id: 2,
      type: 'Armed Robbery',
      code: '#542',
      priority: 'Code 2',
      time: '2 Minutes ago',
      street: 'Grove Street, Davis',
      vehicle: 'Dodge Charger',
      plate: 'ABC123',
      color: 'Black',
      class: 'Sedan',
      heading: 'East Bound',
      timestamp: Date.now() - 120000
    }
  ];

  // Functions
  async function loadAlerts() {
    loading = true;
    error = '';
    try {
      const response = await postJSON('getPoliceAlerts', { playerId });
      alerts = response?.alerts || [];
      
      // Use mock data in development
      if (import.meta.env.DEV) {
        alerts = mockAlerts;
      }
    } catch (e) {
      console.error('Failed to load police alerts:', e);
      error = 'Failed to load alerts';
      // Use mock data on error in development
      if (import.meta.env.DEV) {
        alerts = mockAlerts;
      }
    } finally {
      loading = false;
    }
  }

  function selectAlert(alert) {
    selectedAlert = alert;
  }

  function closeAlert() {
    selectedAlert = null;
  }

  function getAlertIcon(type) {
    const icons = {
      'Car Jacking': '🚗',
      'Armed Robbery': '🔫',
      'Burglary': '🏠',
      'Assault': '👊',
      'Drug Deal': '💊',
      'Vandalism': '🔨',
      'Theft': '💰',
      'Domestic Violence': '🏠',
      'Traffic Stop': '🚦',
      'Pursuit': '🚓'
    };
    return icons[type] || '⚠️';
  }

  function getPriorityColor(priority) {
    const colors = {
      'Code 1': '#4ade80', // Green
      'Code 2': '#f59e0b', // Yellow
      'Code 3': '#ef4444'  // Red
    };
    return colors[priority] || '#6b7280';
  }

  function formatTime(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    
    if (minutes > 0) {
      return `${minutes} Minutes ago`;
    } else {
      return `${seconds} Seconds ago`;
    }
  }

  // NUI Message Handler
  function handleMessage(event) {
    const data = event.data;
    if (data.type === 'updatePoliceAlerts') {
      alerts = data.alerts || [];
    }
  }

  onMount(() => {
    window.addEventListener('message', handleMessage);
    loadAlerts();
  });

  onDestroy(() => {
    window.removeEventListener('message', handleMessage);
  });
</script>

<div class="police-app">
  <!-- Header -->
  <header class="app-header">
    <div class="header-content">
      <div class="header-icon">
        <span class="badge-icon">👮</span>
      </div>
      <div class="header-info">
        <h1 class="app-title">Police Dispatch</h1>
        <p class="app-subtitle">Active alerts and incidents</p>
      </div>
      <button class="refresh-btn" on:click={loadAlerts} disabled={loading}>
        <span class="refresh-icon">🔄</span>
        Refresh
      </button>
    </div>
  </header>

  <!-- Content -->
  <main class="app-content">
    {#if loading}
      <div class="loading-state">
        <div class="loading-spinner"></div>
        <p>Loading alerts...</p>
      </div>
    {:else if error}
      <div class="error-state">
        <span class="error-icon">⚠️</span>
        <p>{error}</p>
        <button class="retry-btn" on:click={loadAlerts}>Retry</button>
      </div>
    {:else if alerts.length === 0}
      <div class="empty-state">
        <span class="empty-icon">📡</span>
        <h3>No Active Alerts</h3>
        <p>All quiet on the streets</p>
      </div>
    {:else}
      <div class="alerts-container">
        {#each alerts as alert (alert.id)}
          <article class="alert-card" on:click={() => selectAlert(alert)}>
            <div class="alert-header">
              <div class="alert-type">
                <span class="type-icon">{getAlertIcon(alert.type)}</span>
                <span class="type-text">{alert.type}</span>
              </div>
              <div class="alert-meta">
                <span class="alert-code">{alert.code}</span>
                <span class="alert-priority" style="color: {getPriorityColor(alert.priority)}">{alert.priority}</span>
              </div>
            </div>

            <div class="alert-time">
              <span class="time-icon">⏰</span>
              <span class="time-text">{alert.time}</span>
            </div>

            <div class="alert-details">
              <div class="detail-row">
                <span class="detail-icon">📍</span>
                <span class="detail-label">Street:</span>
                <span class="detail-value">{alert.street}</span>
              </div>

              {#if alert.vehicle}
                <div class="detail-row">
                  <span class="detail-icon">🚗</span>
                  <span class="detail-label">Vehicle:</span>
                  <span class="detail-value">{alert.vehicle}</span>
                </div>
              {/if}

              {#if alert.plate}
                <div class="detail-row">
                  <span class="detail-icon">🔢</span>
                  <span class="detail-label">Plate:</span>
                  <span class="detail-value">{alert.plate}</span>
                </div>
              {/if}

              {#if alert.color}
                <div class="detail-row">
                  <span class="detail-icon">🎨</span>
                  <span class="detail-label">Color:</span>
                  <span class="detail-value">{alert.color}</span>
                </div>
              {/if}

              {#if alert.class}
                <div class="detail-row">
                  <span class="detail-icon">📋</span>
                  <span class="detail-label">Class:</span>
                  <span class="detail-value">{alert.class}</span>
                </div>
              {/if}

              {#if alert.heading}
                <div class="detail-row">
                  <span class="detail-icon">🧭</span>
                  <span class="detail-label">Heading:</span>
                  <span class="detail-value">{alert.heading}</span>
                </div>
              {/if}
            </div>

            <div class="alert-actions">
              <button class="action-btn respond">Respond</button>
              <button class="action-btn details">Details</button>
            </div>
          </article>
        {/each}
      </div>
    {/if}
  </main>

  <!-- Alert Detail Modal -->
  {#if selectedAlert}
    <div class="modal-overlay" on:click={closeAlert}>
      <div class="modal-content" on:click|stopPropagation>
        <header class="modal-header">
          <h2 class="modal-title">{selectedAlert.type} - {selectedAlert.code}</h2>
          <button class="close-btn" on:click={closeAlert}>✕</button>
        </header>
        
        <div class="modal-body">
          <div class="detail-section">
            <h3>Incident Details</h3>
            <div class="detail-grid">
              <div class="detail-item">
                <span class="label">Priority:</span>
                <span class="value priority" style="color: {getPriorityColor(selectedAlert.priority)}">{selectedAlert.priority}</span>
              </div>
              <div class="detail-item">
                <span class="label">Time:</span>
                <span class="value">{selectedAlert.time}</span>
              </div>
              <div class="detail-item">
                <span class="label">Location:</span>
                <span class="value">{selectedAlert.street}</span>
              </div>
            </div>
          </div>

          {#if selectedAlert.vehicle || selectedAlert.plate || selectedAlert.color}
            <div class="detail-section">
              <h3>Vehicle Information</h3>
              <div class="detail-grid">
                {#if selectedAlert.vehicle}
                  <div class="detail-item">
                    <span class="label">Vehicle:</span>
                    <span class="value">{selectedAlert.vehicle}</span>
                  </div>
                {/if}
                {#if selectedAlert.plate}
                  <div class="detail-item">
                    <span class="label">Plate:</span>
                    <span class="value">{selectedAlert.plate}</span>
                  </div>
                {/if}
                {#if selectedAlert.color}
                  <div class="detail-item">
                    <span class="label">Color:</span>
                    <span class="value">{selectedAlert.color}</span>
                  </div>
                {/if}
                {#if selectedAlert.class}
                  <div class="detail-item">
                    <span class="label">Class:</span>
                    <span class="value">{selectedAlert.class}</span>
                  </div>
                {/if}
                {#if selectedAlert.heading}
                  <div class="detail-item">
                    <span class="label">Heading:</span>
                    <span class="value">{selectedAlert.heading}</span>
                  </div>
                {/if}
              </div>
            </div>
          {/if}
        </div>

        <footer class="modal-footer">
          <button class="modal-btn primary">Respond to Call</button>
          <button class="modal-btn secondary">Mark as Handled</button>
          <button class="modal-btn tertiary" on:click={closeAlert}>Close</button>
        </footer>
      </div>
    </div>
  {/if}
</div>

<style>
  .police-app {
    display: flex;
    flex-direction: column;
    gap: 20px;
    height: 100%;
    font-family: var(--font);
  }

  /* Header */
  .app-header {
    background: linear-gradient(135deg, #1e3a8a, #1e40af);
    border: 1px solid rgba(59, 130, 246, 0.3);
    border-radius: 16px;
    padding: 20px;
    box-shadow: 0 8px 32px rgba(30, 58, 138, 0.3);
  }

  .header-content {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .header-icon {
    width: 56px;
    height: 56px;
    background: linear-gradient(135deg, #3b82f6, #2563eb);
    border-radius: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 16px rgba(59, 130, 246, 0.4);
  }

  .badge-icon {
    font-size: 24px;
    filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3));
  }

  .header-info {
    flex: 1;
  }

  .app-title {
    margin: 0 0 4px;
    font: 900 24px/1.2 var(--font);
    color: white;
    letter-spacing: -0.5px;
  }

  .app-subtitle {
    margin: 0;
    font: 600 14px/1.4 var(--font);
    color: rgba(255, 255, 255, 0.8);
  }

  .refresh-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 8px;
    color: white;
    font: 700 12px/1 var(--font);
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .refresh-btn:hover {
    background: rgba(255, 255, 255, 0.2);
    transform: translateY(-1px);
  }

  .refresh-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .refresh-icon {
    font-size: 14px;
  }

  /* Content */
  .app-content {
    flex: 1;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 16px;
    padding: 24px;
    overflow: auto;
    min-height: 400px;
  }

  /* Loading, Error, Empty States */
  .loading-state, .error-state, .empty-state {
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

  .error-icon, .empty-icon {
    font-size: 48px;
    opacity: 0.6;
  }

  .retry-btn {
    padding: 8px 16px;
    background: var(--accent);
    border: none;
    border-radius: 8px;
    color: white;
    font: 700 12px/1 var(--font);
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .retry-btn:hover {
    background: var(--accent-dark);
    transform: translateY(-1px);
  }

  /* Alerts Container */
  .alerts-container {
    display: grid;
    gap: 16px;
  }

  /* Alert Card - Styled like the image */
  .alert-card {
    background: linear-gradient(135deg, #dc2626, #b91c1c);
    border: 1px solid rgba(220, 38, 38, 0.5);
    border-radius: 12px;
    padding: 20px;
    cursor: pointer;
    transition: all 0.2s ease;
    box-shadow: 0 4px 16px rgba(220, 38, 38, 0.3);
    color: white;
  }

  .alert-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(220, 38, 38, 0.4);
    border-color: rgba(220, 38, 38, 0.7);
  }

  .alert-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
  }

  .alert-type {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .type-icon {
    font-size: 20px;
    filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3));
  }

  .type-text {
    font: 800 18px/1.2 var(--font);
    color: white;
    letter-spacing: -0.3px;
  }

  .alert-meta {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .alert-code {
    background: rgba(0, 0, 0, 0.3);
    padding: 4px 8px;
    border-radius: 6px;
    font: 700 12px/1 var(--font);
    color: white;
  }

  .alert-priority {
    font: 800 12px/1 var(--font);
    padding: 4px 8px;
    border-radius: 6px;
    background: rgba(0, 0, 0, 0.2);
  }

  .alert-time {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 16px;
    padding: 8px 12px;
    background: rgba(0, 0, 0, 0.2);
    border-radius: 8px;
  }

  .time-icon {
    font-size: 16px;
  }

  .time-text {
    font: 700 14px/1 var(--font);
    color: white;
  }

  .alert-details {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 16px;
  }

  .detail-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 0;
  }

  .detail-icon {
    font-size: 16px;
    width: 20px;
    text-align: center;
  }

  .detail-label {
    font: 700 13px/1 var(--font);
    color: rgba(255, 255, 255, 0.9);
    min-width: 60px;
  }

  .detail-value {
    font: 600 13px/1 var(--font);
    color: white;
    flex: 1;
  }

  .alert-actions {
    display: flex;
    gap: 8px;
    margin-top: 16px;
  }

  .action-btn {
    flex: 1;
    padding: 10px 16px;
    border: 1px solid rgba(255, 255, 255, 0.3);
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.1);
    color: white;
    font: 700 12px/1 var(--font);
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .action-btn:hover {
    background: rgba(255, 255, 255, 0.2);
    border-color: rgba(255, 255, 255, 0.5);
    transform: translateY(-1px);
  }

  .action-btn.respond {
    background: rgba(34, 197, 94, 0.2);
    border-color: rgba(34, 197, 94, 0.5);
  }

  .action-btn.respond:hover {
    background: rgba(34, 197, 94, 0.3);
  }

  /* Modal */
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    backdrop-filter: blur(4px);
  }

  .modal-content {
    background: var(--surface-elevated);
    border: 1px solid var(--border);
    border-radius: 16px;
    width: 90%;
    max-width: 600px;
    max-height: 80vh;
    overflow: hidden;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20px;
    border-bottom: 1px solid var(--border);
    background: linear-gradient(135deg, #dc2626, #b91c1c);
  }

  .modal-title {
    margin: 0;
    font: 800 18px/1.2 var(--font);
    color: white;
  }

  .close-btn {
    width: 32px;
    height: 32px;
    border: none;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.1);
    color: white;
    font-size: 16px;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .close-btn:hover {
    background: rgba(255, 255, 255, 0.2);
  }

  .modal-body {
    padding: 20px;
    overflow-y: auto;
    max-height: 400px;
  }

  .detail-section {
    margin-bottom: 24px;
  }

  .detail-section h3 {
    margin: 0 0 12px;
    font: 800 16px/1.2 var(--font);
    color: var(--text-primary);
  }

  .detail-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 12px;
  }

  .detail-item {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 12px;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .detail-item .label {
    font: 700 12px/1 var(--font);
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .detail-item .value {
    font: 600 14px/1.2 var(--font);
    color: var(--text-primary);
  }

  .detail-item .value.priority {
    font-weight: 800;
  }

  .modal-footer {
    display: flex;
    gap: 12px;
    padding: 20px;
    border-top: 1px solid var(--border);
    background: rgba(255, 255, 255, 0.02);
  }

  .modal-btn {
    flex: 1;
    padding: 12px 16px;
    border: none;
    border-radius: 8px;
    font: 700 14px/1 var(--font);
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .modal-btn.primary {
    background: linear-gradient(135deg, #1d6c46, #0f4c31);
    color: #e8fff5;
    box-shadow: 0 4px 12px rgba(29, 108, 70, 0.3);
  }

  .modal-btn.secondary {
    background: linear-gradient(135deg, var(--accent), var(--accent-dark));
    color: white;
    box-shadow: 0 4px 12px rgba(0, 212, 255, 0.3);
  }

  .modal-btn.tertiary {
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    color: var(--text-secondary);
  }

  .modal-btn:hover {
    transform: translateY(-1px);
    filter: brightness(1.1);
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

    .app-content {
      padding: 16px;
    }

    .alert-card {
      padding: 16px;
    }

    .alert-header {
      flex-direction: column;
      align-items: flex-start;
      gap: 8px;
    }

    .alert-actions {
      flex-direction: column;
    }

    .modal-content {
      width: 95%;
      margin: 20px;
    }

    .modal-footer {
      flex-direction: column;
    }

    .detail-grid {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 480px) {
    .app-title {
      font-size: 20px;
    }

    .type-text {
      font-size: 16px;
    }

    .alert-meta {
      flex-direction: column;
      align-items: flex-start;
      gap: 4px;
    }
  }
</style>