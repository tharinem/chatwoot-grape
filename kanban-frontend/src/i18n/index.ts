import { createI18n } from 'vue-i18n';
import ptBR from './pt-BR.json';

const i18n = createI18n({
  legacy: false,
  locale: 'pt-BR',
  fallbackLocale: 'pt-BR',
  messages: {
    'pt-BR': ptBR,
  },
});

export default i18n;
