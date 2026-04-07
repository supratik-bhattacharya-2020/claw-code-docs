/* app.js — Terminal Replay Vue 3 Application */
const { createApp, ref, computed, nextTick, onMounted, onUnmounted } = Vue

createApp({
  setup() {
    // --- Scenario data ---
    const scenarios = [
      SCENARIO_FULL_LOOP,
      SCENARIO_PERMISSION,
      SCENARIO_MULTI_TOOL,
    ]
    const currentScenario = ref(0)

    // --- Playback state ---
    const playing = ref(false)
    const speed = ref(1)
    const speeds = [0.5, 1, 2, 4]
    const frameIndex = ref(0)
    const terminalLines = ref([])   // committed lines
    const activeLine = ref(null)    // line currently being typed/streamed
    const isTyping = ref(false)

    // --- Architecture state ---
    const activeArchStep = ref(null)
    const completedSteps = ref(new Set())
    const activeInfo = ref(null)

    // --- Derived ---
    const frames = computed(() => scenarios[currentScenario.value].frames)
    const archNodes = computed(() => scenarios[currentScenario.value].archNodes)
    const totalFrames = computed(() => frames.value.length)
    const progressPct = computed(() =>
      totalFrames.value === 0 ? 0 : (frameIndex.value / totalFrames.value) * 100
    )

    // --- Refs ---
    const terminalBody = ref(null)
    let playTimer = null
    let typeTimer = null

    // --- Architecture helpers ---
    function nodeState(id) {
      if (id === activeArchStep.value) return "active"
      if (completedSteps.value.has(id)) return "completed"
      return "upcoming"
    }

    function nodeIcon(id) {
      if (id === activeArchStep.value) return "▶"
      if (completedSteps.value.has(id)) return "✓"
      return "○"
    }

    function connectorState(id) {
      if (completedSteps.value.has(id)) return "done"
      if (id === activeArchStep.value) return "active-line"
      return ""
    }

    // --- Scroll terminal to bottom ---
    function scrollToBottom() {
      nextTick(() => {
        if (terminalBody.value) {
          terminalBody.value.scrollTop = terminalBody.value.scrollHeight
        }
      })
    }

    // --- Commit the active line (move it to terminalLines) ---
    function commitActiveLine() {
      if (activeLine.value !== null) {
        terminalLines.value.push({
          html: activeLine.value.html,
          cls: activeLine.value.cls,
        })
        activeLine.value = null
        isTyping.value = false
      }
    }

    // --- Escape HTML ---
    function esc(text) {
      return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    }

    // --- Play a single frame, returns a Promise that resolves when done ---
    function playFrame(frame) {
      return new Promise((resolve) => {
        // Update architecture panel
        if (frame.archStep !== undefined) {
          if (activeArchStep.value && activeArchStep.value !== frame.archStep) {
            completedSteps.value.add(activeArchStep.value)
          }
          activeArchStep.value = frame.archStep
        }
        if (frame.archInfo) {
          activeInfo.value = frame.archInfo
        }

        const baseDelay = frame.delay / speed.value

        if (frame.type === "input") {
          // Character-by-character typing
          const text = frame.text
          isTyping.value = true
          activeLine.value = { html: "", cls: frame.cls }

          if (baseDelay <= 0 || text.length === 0) {
            activeLine.value.html = esc(text)
            scrollToBottom()
            resolve()
            return
          }

          let idx = 0
          const charDelay = baseDelay
          typeTimer = setInterval(() => {
            if (idx < text.length) {
              activeLine.value.html += esc(text[idx])
              idx++
              scrollToBottom()
            } else {
              clearInterval(typeTimer)
              typeTimer = null
              isTyping.value = false
              // Don't commit input lines immediately — they stay as active for cursor display
              // They'll be committed when the next frame starts
              resolve()
            }
          }, charDelay)
        } else if (frame.type === "streaming") {
          // Token-by-token streaming (word-level for readability)
          commitActiveLine()
          const words = frame.text.split(/(\s+)/)
          isTyping.value = true
          activeLine.value = { html: "", cls: frame.cls }

          if (baseDelay <= 0) {
            activeLine.value.html = esc(frame.text)
            isTyping.value = false
            scrollToBottom()
            resolve()
            return
          }

          let idx = 0
          const wordDelay = baseDelay
          typeTimer = setInterval(() => {
            if (idx < words.length) {
              activeLine.value.html += esc(words[idx])
              idx++
              scrollToBottom()
            } else {
              clearInterval(typeTimer)
              typeTimer = null
              isTyping.value = false
              resolve()
            }
          }, wordDelay)
        } else {
          // "output" — instant display
          commitActiveLine()
          terminalLines.value.push({
            html: esc(frame.text),
            cls: frame.cls,
          })
          scrollToBottom()
          setTimeout(resolve, Math.max(baseDelay, 20))
        }
      })
    }

    // --- Main play loop ---
    async function playLoop() {
      while (playing.value && frameIndex.value < totalFrames.value) {
        await playFrame(frames.value[frameIndex.value])
        frameIndex.value++
      }
      if (frameIndex.value >= totalFrames.value) {
        playing.value = false
        // Mark last step as completed
        if (activeArchStep.value) {
          completedSteps.value.add(activeArchStep.value)
          activeArchStep.value = null
        }
      }
    }

    // --- Controls ---
    function togglePlay() {
      if (frameIndex.value >= totalFrames.value) {
        restart()
      }
      playing.value = !playing.value
      if (playing.value) {
        playLoop()
      } else {
        stopTimers()
      }
    }

    function stopTimers() {
      if (typeTimer) {
        clearInterval(typeTimer)
        typeTimer = null
      }
      if (playTimer) {
        clearTimeout(playTimer)
        playTimer = null
      }
    }

    function restart() {
      stopTimers()
      playing.value = false
      frameIndex.value = 0
      terminalLines.value = []
      activeLine.value = null
      isTyping.value = false
      activeArchStep.value = null
      completedSteps.value = new Set()
      activeInfo.value = null
    }

    function stepForward() {
      if (frameIndex.value < totalFrames.value && !playing.value) {
        playFrame(frames.value[frameIndex.value]).then(() => {
          frameIndex.value++
        })
      }
    }

    function stepBackward() {
      if (frameIndex.value > 0 && !playing.value) {
        // Replay from start up to frameIndex - 1
        const target = frameIndex.value - 1
        rebuildToFrame(target)
      }
    }

    // Rebuild terminal state by replaying frames instantly
    async function rebuildToFrame(targetIdx) {
      stopTimers()
      terminalLines.value = []
      activeLine.value = null
      isTyping.value = false
      activeArchStep.value = null
      completedSteps.value = new Set()
      activeInfo.value = null
      frameIndex.value = 0

      for (let i = 0; i < targetIdx && i < totalFrames.value; i++) {
        const frame = frames.value[i]
        // Update arch
        if (frame.archStep !== undefined) {
          if (activeArchStep.value && activeArchStep.value !== frame.archStep) {
            completedSteps.value.add(activeArchStep.value)
          }
          activeArchStep.value = frame.archStep
        }
        if (frame.archInfo) activeInfo.value = frame.archInfo

        // Add text instantly
        const html = esc(frame.text)
        if (frame.type === "input" || frame.type === "streaming" || frame.type === "output") {
          terminalLines.value.push({ html, cls: frame.cls })
        }
      }
      frameIndex.value = targetIdx
      scrollToBottom()
    }

    function scrub(e) {
      const rect = e.currentTarget.getBoundingClientRect()
      const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
      const target = Math.round(pct * totalFrames.value)
      if (playing.value) {
        stopTimers()
        playing.value = false
      }
      rebuildToFrame(target)
    }

    function switchScenario(idx) {
      if (idx === currentScenario.value) return
      restart()
      currentScenario.value = idx
    }

    // --- Keyboard shortcuts ---
    function onKeyDown(e) {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return
      switch (e.code) {
        case "Space":
          e.preventDefault()
          togglePlay()
          break
        case "ArrowRight":
          e.preventDefault()
          stepForward()
          break
        case "ArrowLeft":
          e.preventDefault()
          stepBackward()
          break
        case "Digit1": speed.value = 0.5; break
        case "Digit2": speed.value = 1; break
        case "Digit3": speed.value = 2; break
        case "Digit4": speed.value = 4; break
      }
    }

    onMounted(() => {
      window.addEventListener("keydown", onKeyDown)
    })

    onUnmounted(() => {
      window.removeEventListener("keydown", onKeyDown)
      stopTimers()
    })

    return {
      scenarios,
      currentScenario,
      playing,
      speed,
      speeds,
      frameIndex,
      totalFrames,
      progressPct,
      terminalLines,
      activeLine,
      isTyping,
      archNodes,
      activeInfo,
      terminalBody,
      nodeState,
      nodeIcon,
      connectorState,
      togglePlay,
      restart,
      scrub,
      switchScenario,
    }
  },
}).mount("#app")
