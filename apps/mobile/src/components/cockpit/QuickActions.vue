<template>
  <section class="quick-actions">
    <button class="secondary-button" disabled title="Read-only mode">Emergency stop disabled</button>
    <button class="primary-button" disabled title="Read-only mode">Manual valve disabled</button>
    <button class="secondary-button" disabled>Auto mode disabled</button>
    <RouterLink class="secondary-button" to="/devices">Read-only devices</RouterLink>
    <RouterLink class="secondary-button" to="/alerts">Alerts</RouterLink>
  </section>
</template>
