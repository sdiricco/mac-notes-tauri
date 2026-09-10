// Preset PrimeVue dell'app. Aura di default ha il primary verde smeraldo e le
// superfici scure "zinc" (grigio freddo): entrambe stonano con la palette a
// grigi puri di main.css (accento #4a4a4a / #cacaca, selezione nera o bianca
// al 8-12%). Qui il primary diventa un grigio neutro e le superfici la scala
// "neutral" di Aura (R=G=B), cosi' checkbox, focus, opzione selezionata,
// bottoni e tendine seguono il resto dell'interfaccia senza override sparsi.
import { definePreset } from '@primevue/themes'
import Aura from '@primevue/themes/aura'

const neutralScale = {
  0: '#ffffff',
  50: '{neutral.50}',
  100: '{neutral.100}',
  200: '{neutral.200}',
  300: '{neutral.300}',
  400: '{neutral.400}',
  500: '{neutral.500}',
  600: '{neutral.600}',
  700: '{neutral.700}',
  800: '{neutral.800}',
  900: '{neutral.900}',
  950: '{neutral.950}'
}

export const RustNotesPreset = definePreset(Aura, {
  semantic: {
    primary: {
      50: '{neutral.50}',
      100: '{neutral.100}',
      200: '{neutral.200}',
      300: '{neutral.300}',
      400: '{neutral.400}',
      500: '{neutral.500}',
      600: '{neutral.600}',
      700: '{neutral.700}',
      800: '{neutral.800}',
      900: '{neutral.900}',
      950: '{neutral.950}'
    },
    colorScheme: {
      light: {
        surface: neutralScale,
        primary: {
          color: '#4a4a4a', // --accent-color
          contrastColor: '#ffffff',
          hoverColor: '#3a3a3a',
          activeColor: '#2a2a2a'
        },
        // Selezione come --selection-bg: velo nero leggero, testo normale.
        // Niente tinta: l'elemento selezionato si distingue dallo sfondo,
        // non dal colore.
        highlight: {
          background: 'rgba(0, 0, 0, 0.08)',
          focusBackground: 'rgba(0, 0, 0, 0.12)',
          color: '{text.color}',
          focusColor: '{text.color}'
        }
      },
      dark: {
        surface: neutralScale,
        primary: {
          color: '#cacaca', // --accent-color (dark)
          contrastColor: '#1a1a1a',
          hoverColor: '#dadada',
          activeColor: '#eaeaea'
        },
        highlight: {
          background: 'rgba(255, 255, 255, 0.12)',
          focusBackground: 'rgba(255, 255, 255, 0.16)',
          color: '{text.color}',
          focusColor: '{text.color}'
        }
      }
    }
  }
})
