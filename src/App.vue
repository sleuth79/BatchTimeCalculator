<template>
  <div id="app">
    <div v-if="isLoading">Loading...</div>
    <div v-else-if="error">Error: {{ error }}</div>
    <div v-else class="content-wrapper">
      <config-section class="pane" />
      <results-display class="pane" :show-placeholders="!calculationAttempted" />
      <config-window class="pane" />
    </div>
  </div>
</template>

<script>
import { computed, onMounted } from 'vue';
import { useGcStore } from './store';
import ConfigSection from './components/ConfigSection.vue';
import ConfigWindow from './components/configwindow.vue';
import ResultsDisplay from './components/ResultsDisplay.vue';

export default {
  name: 'App',
  components: {
    ConfigSection,
    ConfigWindow,
    ResultsDisplay,
  },
  setup() {
    const gcStore = useGcStore();

    onMounted(() => {
      gcStore.fetchGcData();
    });

    return {
      isLoading: computed(() => gcStore.isLoading),
      error: computed(() => gcStore.error),
      calculationAttempted: computed(() => gcStore.calculationAttempted),
    };
  },
};
</script>

<style scoped>
.content-wrapper {
  display: flex;
  flex-direction: row;
  gap: 16px;
  height: 100vh;
}

.pane {
  flex: 1;
  border: 1px solid #ccc;
  padding: 16px;
  box-sizing: border-box;
}
</style>
