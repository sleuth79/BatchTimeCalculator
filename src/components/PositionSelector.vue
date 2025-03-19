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
import { useGcStore } from '../store';

export default {
  name: 'PositionSelector',
  props: {
    allowedPositions: {
      type: Array,
      required: true,
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
    const gcStore = useGcStore();

    // Compute the currently selected position based on the mode.
    const selectedPosition = computed(() => {
      if (props.mode === 'start-time') {
        return gcStore.startTime.finalPosition;
      } else if (props.mode === 'sequential') {
        return gcStore.sequentialFinalPosition;
      }
      return null;
    });

    // Compute disabled positions based on the control values in the store.
    const disabledPositions = computed(() => {
      const controls = gcStore.startTime.controls;
      let disabled = [];
      if (controls) {
        if (controls.control1) disabled.push(controls.control1);
        if (controls.control2) disabled.push(controls.control2);
      }
      return disabled;
    });

    const isSelected = (position) => position === selectedPosition.value;

    const isDisabled = (position) => disabledPositions.value.includes(position);

    // Prevent selection if a position is disabled.
    const selectPosition = (position) => {
      if (isDisabled(position)) return; // Do nothing if disabled

      if (selectedPosition.value === position) {
        if (props.mode === 'start-time') {
          gcStore.setStartTimeFinalPosition(null);
          gcStore.calculateStartTimeBatch();
        } else if (props.mode === 'sequential') {
          gcStore.setSequentialFinalPosition(null);
          emit('update:modelValue', null);
        }
      } else {
        if (props.mode === 'start-time') {
          gcStore.setStartTimeFinalPosition(position);
          gcStore.calculateStartTimeBatch();
        } else if (props.mode === 'sequential') {
          gcStore.setSequentialFinalPosition(position);
          emit('update:modelValue', position);
        }
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

/* Disabled positions appear grey and non-clickable */
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
