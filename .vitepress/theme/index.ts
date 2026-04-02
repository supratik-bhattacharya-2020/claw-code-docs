import DefaultTheme from 'vitepress/theme'
import AgentLoopStepper from './components/AgentLoopStepper.vue'

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('AgentLoopStepper', AgentLoopStepper)
  }
}
