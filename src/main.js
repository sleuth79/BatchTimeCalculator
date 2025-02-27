import { createApp } from 'vue';
import App from './App.vue';
import { pinia } from './store'; // Import the Pinia instance

const app = createApp(App);
app.use(pinia); // Use Pinia
app.mount('#app');