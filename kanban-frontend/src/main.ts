import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { createI18n } from 'vue-i18n';
import router from './router';
import App from './App.vue';
import ptBR from './i18n/pt-BR.json';
import './styles/colors.css';

const i18n = createI18n({
  legacy: false,
  locale: 'pt-BR',
  fallbackLocale: 'pt-BR',
  messages: {
    'pt-BR': ptBR,
  },
});

const app = createApp(App);
app.use(createPinia());
app.use(router);
app.use(i18n);
app.mount('#app');
