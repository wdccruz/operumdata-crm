import i18n from 'i18next';
import {initReactI18next} from 'react-i18next';
import {en} from './locales/en-US';
// Chaves em português (idioma padrão): pt-BR não precisa de dicionário, a chave é o texto.
// en-US traduz a interface. Textos livres digitados pelos operadores nunca passam por aqui.
export const locales=['pt-BR','en-US'] as const;
export type Locale=(typeof locales)[number];
const KEY='operumdata.locale';
function stored():Locale{try{const v=localStorage.getItem(KEY);return v==='en-US'?'en-US':'pt-BR'}catch{return 'pt-BR'}}
export function remember(locale:Locale){try{localStorage.setItem(KEY,locale)}catch{/* armazenamento indisponível: preferência continua no perfil */}}
void i18n.use(initReactI18next).init({resources:{'pt-BR':{translation:{}},'en-US':{translation:en}},lng:stored(),fallbackLng:false,keySeparator:false,nsSeparator:false,returnEmptyString:false,interpolation:{escapeValue:false}});
const setLang=(l:string)=>{if(typeof document!=='undefined')document.documentElement.lang=l};
setLang(i18n.language);i18n.on('languageChanged',setLang);
export default i18n;
