<template>
  <div class="gc-selector">
    <label for="gc-select">Select GC:</label>
    <div class="gc-group">
      <!-- Row for Energy GCs -->
      <div class="gc-group-row">
        <div class="gc-group-heading">Energy</div>
        <div class="gc-grid">
          <div
            v-for="gc in energyOptions"
            :key="gc.id"
            class="gc-box"
            :class="{ selected: gc.id === selectedGc }"
            @click="setSelectedGc(gc.id)"
          >
            {{ gc.name }}
          </div>
        </div>
      </div>
      <!-- Row for Sulphur GCs -->
      <div class="gc-group-row">
        <div class="gc-group-heading">Sulphur</div>
        <div class="gc-grid">
          <div
            v-for="gc in sulphurOptions"
            :key="gc.id"
            class="gc-box"
            :class="{ selected: gc.id === selectedGc }"
            @click="setSelectedGc(gc.id)"
          >
            {{ gc.name }}
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
  name: 'GcSelector',
  setup() {
    const gcStore = useGcStore();

    // Map GC data to include id, name, and type.
    const gcOptions = computed(() => {
      return Object.entries(gcStore.allGcData).map(([id, gc]) => ({
        id,
        name: gc.name,
        type: gc.type,
      }));
    });

    // Filter options by type.
    const energyOptions = computed(() =>
      gcOptions.value.filter((gc) => gc.type === 'Energy')
    );
    const sulphurOptions = computed(() =>
      gcOptions.value.filter((gc) => gc.type === 'Sulphur')
    );

    const selectedGc = computed(() => gcStore.selectedGc);

    const setSelectedGc = (gcId) => {
      gcStore.setSelectedGc(gcId);
      const selectedGcType = gcStore.selectedGcData?.type;
      if (selectedGcType) {
        gcStore.setWait15(selectedGcType === "Energy");
      }
    };

    return {
      energyOptions,
      sulphurOptions,
      selectedGc,
      setSelectedGc,
    };
  },
};
</script>

<style scoped>
.gc-selector {
  margin-bottom: 15px;
}

label {
  display: block;
  margin-bottom: 5px;
  font-weight: bold;
  font-size: 1.1rem;
}

/* Container for both groups */
.gc-group {
  margin-bottom: 10px;
}

/* Each row is a flex container with the heading on the left and grid on the right */
.gc-group-row {
  display: flex;
  align-items: center;
  margin-bottom: 10px;
  flex-wrap: wrap;
}

/* Fixed-width type heading styling for alignment */
.gc-group-heading {
  flex: 0 0 80px;
  margin-right: 10px;
  font-weight: bold;
  white-space: nowrap;
  font-size: 0.9rem;
  text-align: right;
}

/* Grid for the GC boxes - dynamically adjusting */
.gc-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(60px, 1fr)); /* Changed minmax from 80px to 60px */
  gap: 5px; /* Reduce gap for better spacing */
  flex: 1;
  min-width: 0;
}

/* GC Box Styling */
.gc-box {
  border: 1px solid #ccc;
  padding: 0 8px;
  height: 28px;
  line-height: 28px;
  text-align: center;
  cursor: pointer;
  user-select: none;
  font-size: 0.85rem;
  flex-grow: 1;
  min-width: 60px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Selected GC styling */
.gc-box.selected {
  background-color: var(--highlight-color);
  color: var(--text-highlight);
}
</style>
