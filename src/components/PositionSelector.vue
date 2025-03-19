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
import { computed } from 'vue';

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
    // Debug: log disabledPositions to verify they are being passed
    console.log("PositionSelector disabledPositions:", props.disabledPositions);
    
    // Use modelValue as the current selected position.
    const selectedPosition = computed(() => props.modelValue);

    // Check if the position should be disabled based on the passed prop.
    const isDisabled = (position) => props.disabledPositions.includes(position);

    const isSelected = (position) => position === selectedPosition.value;

    // When a position is clicked, do nothing if it's disabled.
    const selectPosition = (position) => {
      if (isDisabled(position)) return; // Do nothing if disabled

      if (selectedPosition.value === position) {
        // Toggle off selection.
        emit('update:modelValue', null);
      } else {
        // Set new selection.
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
