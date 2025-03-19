<template>
  <div class="position-selector">
    <div class="grid-container">
      <div
        v-for="position in allowedPositions"
        :key="position"
        :class="[
          'grid-item',
          { 
            selected: isSelected(position),
            disabled: isDisabled(position),
            'full-tile': position === 32 
          }
        ]"
        @click="selectPosition(position)"
      >
        {{ position === 32 ? '32 - Full Batch' : position }}
      </div>
    </div>
  </div>
</template>

<script>
import { computed, watch } from 'vue';

export default {
  name: 'PositionSelector',
  props: {
    allowedPositions: {
      type: Array,
      required: true,
    },
    disabledPositions: {
      type: Array,
      default: () => [],
    },
    mode: {
      type: String,
      required: true,
    },
    field: {
      type: String,
      required: true,
      validator: (value) =>
        ['current-run', 'final-position', 'start-time', 'sequential'].includes(value),
    },
    modelValue: {
      type: Number,
      default: null,
    },
  },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    // Log the initial disabledPositions value
    console.log("PositionSelector disabledPositions on setup:", props.disabledPositions);
    
    // Watch for changes in disabledPositions so we can debug updates.
    watch(() => props.disabledPositions, (newVal) => {
      console.log("PositionSelector disabledPositions changed:", newVal);
    }, { deep: true });
    
    // Use the passed modelValue as the current selected position.
    const selectedPosition = computed(() => props.modelValue);

    // Returns true if the position is in the disabledPositions array.
    const isDisabled = (position) => props.disabledPositions.includes(position);

    // Returns true if the position is currently selected.
    const isSelected = (position) => position === selectedPosition.value;

    // On click, if not disabled, toggle the selection.
    const selectPosition = (position) => {
      if (isDisabled(position)) return; // Do nothing if disabled

      if (selectedPosition.value === position) {
        // Toggle off selection.
        emit('update:modelValue', null);
      } else {
        // Set the new selection.
        emit('update:modelValue', position);
      }
    };

    return {
      isSelected,
      isDisabled,
      selectPosition,
    };
  },
};
</script>

<style scoped>
.position-selector {
  display: flex;
  justify-content: flex-start !important;
  margin-bottom: 0px;
}

.grid-container {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(30px, 1fr));
  gap: 5px;
  width: 100%;
}

.grid-item {
  border: 1px solid #ccc;
  padding: 5px;
  text-align: center;
  cursor: pointer;
  height: 18px;
  font-size: 14px;
  border-radius: 5px;
  transition: background-color 0.3s ease, color 0.3s ease;
  box-shadow: 0 2px 3px rgba(0, 0, 0, 0.1);
}

.grid-item:hover {
  background-color: #f0f0f0;
}

.grid-item.selected {
  background-color: var(--highlight-color);
  color: var(--text-highlight);
}

/* Disabled positions appear greyed out and non-clickable */
.grid-item.disabled {
  background-color: #ccc;
  cursor: not-allowed;
  pointer-events: none;
  opacity: 0.6;
}

/* "Full" tile spans four columns */
.grid-item.full-tile {
  grid-column: span 4;
}
</style>
