<template>
  <div class="mode-selector">
    <div class="mode-grid">
      <div class="mode-column">
        <div
          class="mode-box start-time"
          :class="{ selected: selectedMode === 'start-time' }"
          @click="handleStartTimeClick"
        >
          <div class="mode-title">Batch Start Time Mode</div>
          <div class="mode-explanation"></div>
        </div>
      </div>
      <div class="mode-column">
        <div
          class="mode-box delay-calculator"
          :class="{ selected: selectedMode === 'delay-calculator' }"
          @click="handleDelayCalculatorClick"
        >
          <div class="mode-title">Time Delay Calculator Mode</div>
          <div class="mode-explanation">
            Use If no batches are currently running
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { computed } from 'vue';
import { useGcStore } from '../store';

export default {
  name: 'ModeSelector',
  props: {
    resetCallback: {
      type: Function,
      default: () => {},
    },
  },
  setup(props) {
    const gcStore = useGcStore();

    const handleStartTimeClick = () => {
      if (gcStore.selectedMode === 'start-time') {
        gcStore.resetStartTime();
        props.resetCallback();
      }
      gcStore.setSelectedMode('start-time');
    };

    const handleDelayCalculatorClick = () => {
      if (gcStore.selectedMode === 'delay-calculator') {
        gcStore.resetDelayCalculator();
        props.resetCallback();
      }
      gcStore.setSelectedMode('delay-calculator');
    };

    return {
      selectedMode: computed(() => gcStore.selectedMode),
      handleStartTimeClick,
      handleDelayCalculatorClick,
    };
  },
};
</script>

<style scoped>
.mode-selector {
  margin-bottom: 10px;
}

.mode-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(140px, 1fr));
  gap: 10px;
  width: 100%;
}

.mode-column {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.mode-box {
  box-sizing: border-box;
  border: 1px solid #ccc;
  padding: 8px;
  text-align: center;
  cursor: pointer;
  user-select: none;
  font-size: 1rem;
  width: 100%;
  height: 55px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  overflow: hidden;
}

.mode-box.selected {
  background-color: var(--highlight-color);
  color: var(--text-highlight);
  font-weight: bold;
}

.mode-box.start-time.selected,
.mode-box.delay-calculator.selected {
  color: black;
}

.mode-title {
  font-weight: bold;
  margin-bottom: 1px;
}

.mode-explanation {
  font-size: 0.75rem;
  color: inherit;
  line-height: 1.2;
  font-weight: normal;
}
</style>
