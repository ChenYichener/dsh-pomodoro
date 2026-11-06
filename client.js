/**
 * Browser half of dsh-pomodoro: the "番茄钟" sidebar entry directly below the
 * "写作" entry, and the focus-timer main panel.
 *
 * - `sidebar.panellist` registers the sidebar row (the shell owns the button and
 *   selects `main.pomodoro` when it is clicked). The row carries a small badge
 *   while a round is running so the timer is visible from any panel.
 * - `main` keyed `pomodoro` renders the workspace: countdown ring, start/pause,
 *   focus goal, today's log and settings.
 * - `shell.overlay` renders the completion notice, so a round that ends while
 *   the user is writing in another panel still announces itself (with a soft
 *   chime); the countdown itself is owned by a module-level store, not by the
 *   mounted page, so switching panels never pauses it.
 *
 * Plain-JavaScript client bundle: React comes from the browser module table,
 * styles are one `<style data-plugin>` element owned by the plugin fiber, and
 * all colors come from the host's `--dsw-alias-*` theme tokens.
 *
 * @module dsh-pomodoro/client
 */

window.__ModuleLoader__.load({
  id: 'dsh-pomodoro',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    /** Services required before the module registers its UI. */
    const inject = ['slots', 'locale']

    const NS = 'dsh-pomodoro'
    const PANEL_ID = 'pomodoro'
    /** Sits directly below the "写作" entry, which the writing bundle orders 20. */
    const PANEL_ORDER = 21
    const STORAGE_KEY = 'dsh-pomodoro/state/v1'
    const STATE_VERSION = 1
    const MINUTE = 60 * 1000
    const MODES = ['focus', 'short', 'long']
    const RING_RADIUS = 104
    const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS
    const MAX_GOAL_LENGTH = 120
    const MAX_LOG = 50

    const DEFAULT_SETTINGS = { focus: 25, short: 5, long: 15, cycle: 4, sound: true }

    /** [min, max, step] per numeric setting, in minutes / pomodoros. */
    const SETTING_LIMITS = {
      focus: [5, 90, 5],
      short: [1, 30, 1],
      long: [5, 60, 5],
      cycle: [2, 8, 1],
    }

    // -----------------------------------------------------------------------
    // Copy (registered into the Client locale service under this namespace)
    // -----------------------------------------------------------------------

    const TEXT = {
      zh: {
        panel: '番茄钟',
        modeFocus: '专注',
        modeShort: '短休息',
        modeLong: '长休息',
        phaseFocus: '专注中',
        phaseFocusIdle: '准备专注',
        phasePaused: '已暂停',
        phaseShort: '休息中',
        phaseShortIdle: '短休息',
        phaseLong: '长休息中',
        phaseLongIdle: '长休息',
        cycleAria: '本轮进度：{n} / {total}',
        startFocus: '开始专注',
        startBreak: '开始休息',
        pause: '暂停',
        resume: '继续',
        reset: '重置',
        skip: '跳过',
        decrease: '减少',
        increase: '增加',
        goalLabel: '这轮想写完什么？',
        goalPlaceholder: '这轮想写完什么？可留空',
        today: '今天',
        pomodoros: '个番茄',
        focusMinutes: '分钟专注',
        logTitle: '完成记录',
        logEmpty: '完成第一个番茄后，这里会出现记录。',
        logUntitled: '专注写作',
        minutesShort: '{n} 分钟',
        settings: '设置',
        settingFocus: '专注时长',
        settingShort: '短休息',
        settingLong: '长休息',
        settingCycle: '长休息间隔',
        settingValueMinutes: '{n} 分钟',
        settingValueCycle: '每 {n} 个番茄',
        sound: '完成提示音',
        soundOn: '开',
        soundOff: '关',
        localNote: '设置和记录只保存在本机浏览器。',
        noticeShort: '完成一个番茄！休息 {n} 分钟。',
        noticeLong: '本轮番茄全部完成，长休息 {n} 分钟。',
        noticeBreakOver: '休息结束，开始下一轮专注吧。',
        resetDone: '已重置当前计时',
        skipDone: '已跳到下一阶段',
        clearToday: '清空',
        clearConfirm: '确认清空？',
        clearDone: '已清空今日记录',
        timerAria: '剩余时间 {clock}',
      },
      en: {
        panel: 'Pomodoro',
        modeFocus: 'Focus',
        modeShort: 'Short break',
        modeLong: 'Long break',
        phaseFocus: 'Focusing',
        phaseFocusIdle: 'Ready to focus',
        phasePaused: 'Paused',
        phaseShort: 'On a break',
        phaseShortIdle: 'Short break',
        phaseLong: 'Long break',
        phaseLongIdle: 'Long break',
        cycleAria: 'Round progress: {n} / {total}',
        startFocus: 'Start focus',
        startBreak: 'Start break',
        pause: 'Pause',
        resume: 'Resume',
        reset: 'Reset',
        skip: 'Skip',
        decrease: 'Decrease',
        increase: 'Increase',
        goalLabel: 'What will you finish this round?',
        goalPlaceholder: 'What will you finish this round?',
        today: 'Today',
        pomodoros: 'pomodoros',
        focusMinutes: 'minutes focused',
        logTitle: 'Completed',
        logEmpty: 'Your first completed pomodoro will show up here.',
        logUntitled: 'Writing focus',
        minutesShort: '{n} min',
        settings: 'Settings',
        settingFocus: 'Focus length',
        settingShort: 'Short break',
        settingLong: 'Long break',
        settingCycle: 'Long break every',
        settingValueMinutes: '{n} min',
        settingValueCycle: 'every {n}',
        sound: 'Completion chime',
        soundOn: 'On',
        soundOff: 'Off',
        localNote: 'Settings and history stay in this browser.',
        noticeShort: 'Pomodoro complete! Take a {n}-minute break.',
        noticeLong: 'All rounds done — take a {n}-minute long break.',
        noticeBreakOver: 'Break over — ready for the next round.',
        resetDone: 'Timer reset',
        skipDone: 'Skipped to the next phase',
        clearToday: 'Clear',
        clearConfirm: 'Clear today?',
        clearDone: 'Today’s log cleared',
        timerAria: 'Time remaining {clock}',
      },
    }

    const MODE_LABELS = { focus: 'modeFocus', short: 'modeShort', long: 'modeLong' }

    // -----------------------------------------------------------------------
    // Small utilities
    // -----------------------------------------------------------------------

    /** Local calendar day as `YYYY-MM-DD`. */
    function dateKey(date = new Date()) {
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }

    function emptyToday() {
      return { date: dateKey(), count: 0, focusMs: 0, log: [] }
    }

    /** Clamp a numeric value, falling back when it is not a usable number. */
    function clampNumber(value, min, max, fallback) {
      const number = typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : NaN
      if (!Number.isFinite(number)) return fallback
      return Math.min(max, Math.max(min, number))
    }

    /** Snap a value onto the setting's `[min, max, step]` grid. */
    function snapSetting(value, min, max, step, fallback) {
      const clamped = clampNumber(value, min, max, fallback)
      const steps = Math.round((clamped - min) / step)
      return Math.min(max, Math.max(min, min + steps * step))
    }

    function normalizeSettings(input) {
      const raw = input !== null && typeof input === 'object' ? input : {}
      const settings = {}
      for (const key of Object.keys(SETTING_LIMITS)) {
        const [min, max, step] = SETTING_LIMITS[key]
        settings[key] = snapSetting(raw[key], min, max, step, DEFAULT_SETTINGS[key])
      }
      settings.sound = raw.sound !== false
      return settings
    }

    function normalizeToday(input) {
      const raw = input !== null && typeof input === 'object' ? input : {}
      if (typeof raw.date !== 'string' || raw.date !== dateKey()) return emptyToday()
      const log = Array.isArray(raw.log)
        ? raw.log
          .filter((entry) => entry !== null && typeof entry === 'object' && typeof entry.at === 'number')
          .slice(0, MAX_LOG)
          .map((entry) => ({
            at: entry.at,
            minutes: clampNumber(entry.minutes, 1, 240, DEFAULT_SETTINGS.focus),
            goal: typeof entry.goal === 'string' ? entry.goal.slice(0, MAX_GOAL_LENGTH) : '',
          }))
        : []
      return {
        date: raw.date,
        count: clampNumber(raw.count, 0, 200, 0),
        focusMs: clampNumber(raw.focusMs, 0, 200 * 240 * MINUTE, 0),
        log,
      }
    }

    /** Parse a persisted snapshot; anything unusable degrades to defaults. */
    function normalizeState(input) {
      const raw = input !== null && typeof input === 'object' ? input : {}
      const settings = normalizeSettings(raw.settings)
      const mode = MODES.includes(raw.mode) ? raw.mode : 'focus'
      const totalMs = settings[mode] * MINUTE
      const endsAt = typeof raw.endsAt === 'number' && Number.isFinite(raw.endsAt) ? raw.endsAt : null
      const running = raw.running === true && endsAt !== null
      const remainingRaw = typeof raw.remainingMs === 'number' && Number.isFinite(raw.remainingMs)
        ? raw.remainingMs
        : totalMs
      return {
        version: STATE_VERSION,
        mode,
        running,
        endsAt: running ? endsAt : null,
        remainingMs: running ? Math.max(0, endsAt - Date.now()) : Math.min(totalMs, Math.max(0, remainingRaw)),
        cycle: clampNumber(raw.cycle, 0, settings.cycle, 0),
        goal: typeof raw.goal === 'string' ? raw.goal.slice(0, MAX_GOAL_LENGTH) : '',
        today: normalizeToday(raw.today),
        settings,
        now: Date.now(),
        notice: null,
      }
    }

    function initialState() {
      return {
        version: STATE_VERSION,
        mode: 'focus',
        running: false,
        endsAt: null,
        remainingMs: DEFAULT_SETTINGS.focus * MINUTE,
        cycle: 0,
        goal: '',
        today: emptyToday(),
        settings: { ...DEFAULT_SETTINGS },
        now: Date.now(),
        notice: null,
      }
    }

    /** Roll the daily log over when the local date changed. */
    function withToday(state, now = Date.now()) {
      return state.today.date === dateKey(new Date(now)) ? state : { ...state, today: emptyToday() }
    }

    /** Substitute `{name}` placeholders in a translated template. */
    function format(template, params) {
      if (typeof template !== 'string') return ''
      return template.replace(/\{(\w+)\}/g, (match, name) => {
        const value = params === undefined ? undefined : params[name]
        return value === undefined ? match : String(value)
      })
    }

    /** Read the persisted snapshot, if the browser allows it. */
    function readStoredState() {
      try {
        if (typeof window === 'undefined' || window.localStorage === undefined) return undefined
        const raw = window.localStorage.getItem(STORAGE_KEY)
        if (raw === null || raw === '') return undefined
        return JSON.parse(raw)
      } catch {
        return undefined
      }
    }

    // -----------------------------------------------------------------------
    // Timer store
    //
    // The store lives outside React so the countdown survives main-panel
    // switches and so the sidebar badge / overlay notice can observe it. It is
    // a plain external store: `getSnapshot()` returns an immutable state object
    // and every mutation notifies subscribers.
    // -----------------------------------------------------------------------

    function createPomodoroStore() {
      let state = normalizeState(readStoredState())
      const listeners = new Set()
      let tickId = null
      let rolloverId = null
      let noticeSeq = 0
      let noticeTimeout = null
      let audio = null

      function emit() {
        for (const listener of Array.from(listeners)) {
          try {
            listener()
          } catch {
            // A broken subscriber must not stop the timer.
          }
        }
      }

      /** Persist the durable part of the snapshot (never the live clock/notice). */
      function persist() {
        try {
          if (typeof window === 'undefined' || window.localStorage === undefined) return
          const { now, notice, ...durable } = state
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(durable))
        } catch {
          // Storage may be unavailable (private mode); the timer still works.
        }
      }

      function setState(next) {
        if (next === state) return
        state = next
        persist()
        emit()
        syncTicker()
      }

      function syncTicker() {
        const shouldTick = state.running === true
        if (shouldTick && tickId === null) {
          tickId = window.setInterval(onTick, 250)
        } else if (!shouldTick && tickId !== null) {
          window.clearInterval(tickId)
          tickId = null
        }
      }

      function onTick() {
        const now = Date.now()
        if (state.running && typeof state.endsAt === 'number' && now >= state.endsAt) {
          completePhase(now)
          return
        }
        state = { ...state, now }
        emit()
      }

      function ensureAudio() {
        try {
          if (audio !== null) {
            if (audio.state === 'suspended') void audio.resume()
            return
          }
          const AudioCtor = typeof window === 'undefined'
            ? undefined
            : (window.AudioContext ?? window.webkitAudioContext)
          if (typeof AudioCtor !== 'function') return
          audio = new AudioCtor()
          if (audio.state === 'suspended') void audio.resume()
        } catch {
          audio = null
        }
      }

      function playChime() {
        if (audio === null) ensureAudio()
        if (audio === null) return
        try {
          if (audio.state === 'suspended') void audio.resume()
          const start = audio.currentTime + 0.02
          ;[880, 1174.66].forEach((frequency, index) => {
            const oscillator = audio.createOscillator()
            const gain = audio.createGain()
            const at = start + index * 0.16
            oscillator.type = 'sine'
            oscillator.frequency.value = frequency
            gain.gain.setValueAtTime(0.0001, at)
            gain.gain.exponentialRampToValueAtTime(0.11, at + 0.02)
            gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.55)
            oscillator.connect(gain)
            gain.connect(audio.destination)
            oscillator.start(at)
            oscillator.stop(at + 0.6)
          })
        } catch {
          // Sound is a nicety; never let it break the phase transition.
        }
      }

      function announce(key, params) {
        noticeSeq += 1
        const notice = { id: noticeSeq, key, params: params ?? {} }
        state = { ...state, notice }
        persist()
        emit()
        if (noticeTimeout !== null) window.clearTimeout(noticeTimeout)
        noticeTimeout = window.setTimeout(() => {
          noticeTimeout = null
          if (state.notice !== null && state.notice.id === notice.id) {
            state = { ...state, notice: null }
            persist()
            emit()
          }
        }, 6000)
      }

      /** Finish the running phase exactly once and move to the next one. */
      function completePhase(now) {
        const finished = state
        const settings = finished.settings
        const mode = finished.mode
        const today = withToday(finished, now).today

        if (mode === 'focus') {
          const cycle = finished.cycle + 1
          const longDue = cycle >= settings.cycle
          const nextMode = longDue ? 'long' : 'short'
          state = {
            ...finished,
            mode: nextMode,
            running: false,
            endsAt: null,
            remainingMs: settings[nextMode] * MINUTE,
            cycle,
            now,
            today: {
              ...today,
              count: today.count + 1,
              focusMs: today.focusMs + settings.focus * MINUTE,
              log: [
                { at: now, minutes: settings.focus, goal: finished.goal.trim() },
                ...today.log,
              ].slice(0, MAX_LOG),
            },
          }
          persist()
          emit()
          syncTicker()
          if (settings.sound) playChime()
          announce(longDue ? 'noticeLong' : 'noticeShort', { n: nextMode === 'long' ? settings.long : settings.short })
          return
        }

        state = {
          ...finished,
          mode: 'focus',
          running: false,
          endsAt: null,
          remainingMs: settings.focus * MINUTE,
          cycle: mode === 'long' ? 0 : finished.cycle,
          now,
          today,
        }
        persist()
        emit()
        syncTicker()
        if (settings.sound) playChime()
        announce('noticeBreakOver')
      }

      // ---- actions ---------------------------------------------------------

      function start() {
        ensureAudio()
        const now = Date.now()
        const current = withToday(state, now)
        const totalMs = current.settings[current.mode] * MINUTE
        const remaining = current.running
          ? Math.max(0, (current.endsAt ?? now) - now)
          : (current.remainingMs > 0 ? Math.min(current.remainingMs, totalMs) : totalMs)
        setState({ ...current, running: true, endsAt: now + remaining, remainingMs: remaining, now })
      }

      function pause() {
        if (!state.running) return
        const now = Date.now()
        const remaining = Math.max(0, (state.endsAt ?? now) - now)
        setState({ ...state, running: false, endsAt: null, remainingMs: remaining, now })
      }

      function reset() {
        const current = withToday(state)
        setState({
          ...current,
          running: false,
          endsAt: null,
          remainingMs: current.settings[current.mode] * MINUTE,
          now: Date.now(),
        })
      }

      function skip() {
        const current = withToday(state)
        const nextMode = current.mode === 'focus' ? 'short' : 'focus'
        setState({
          ...current,
          mode: nextMode,
          running: false,
          endsAt: null,
          remainingMs: current.settings[nextMode] * MINUTE,
          cycle: current.mode === 'long' ? 0 : current.cycle,
          now: Date.now(),
        })
      }

      function selectMode(mode) {
        if (!MODES.includes(mode) || mode === state.mode) return
        const current = withToday(state)
        setState({
          ...current,
          mode,
          running: false,
          endsAt: null,
          remainingMs: current.settings[mode] * MINUTE,
          now: Date.now(),
        })
      }

      function setGoal(goal) {
        const value = String(goal === undefined || goal === null ? '' : goal).slice(0, MAX_GOAL_LENGTH)
        if (value === state.goal) return
        setState({ ...state, goal: value })
      }

      function stepSetting(key, delta) {
        const limits = SETTING_LIMITS[key]
        if (limits === undefined) return
        const current = withToday(state)
        const [min, max, step] = limits
        const nextValue = Math.min(max, Math.max(min, current.settings[key] + delta * step))
        if (nextValue === current.settings[key]) return
        const settings = { ...current.settings, [key]: nextValue }
        let next = { ...current, settings, now: Date.now() }
        if (key === 'cycle') {
          next.cycle = Math.min(current.cycle, nextValue)
        } else if (!current.running && current.mode === key) {
          next.remainingMs = nextValue * MINUTE
        }
        setState(next)
      }

      function toggleSound() {
        setState({ ...state, settings: { ...state.settings, sound: state.settings.sound !== true } })
      }

      /** Discard today's completed rounds (and the in-cycle progress they imply). */
      function clearToday() {
        const current = withToday(state)
        setState({ ...current, cycle: 0, today: emptyToday(), now: Date.now() })
        announce('clearDone')
      }

      // ---- lifecycle -------------------------------------------------------

      rolloverId = window.setInterval(() => {
        if (state.today.date !== dateKey()) setState({ ...state, today: emptyToday() })
      }, 30 * 1000)
      syncTicker()

      return {
        subscribe(listener) {
          listeners.add(listener)
          return () => {
            listeners.delete(listener)
          }
        },
        getSnapshot() {
          return state
        },
        start,
        pause,
        reset,
        skip,
        selectMode,
        setGoal,
        stepSetting,
        toggleSound,
        clearToday,
        dispose() {
          if (tickId !== null) window.clearInterval(tickId)
          if (rolloverId !== null) window.clearInterval(rolloverId)
          if (noticeTimeout !== null) window.clearTimeout(noticeTimeout)
          tickId = null
          rolloverId = null
          noticeTimeout = null
          listeners.clear()
          try {
            if (audio !== null && typeof audio.close === 'function') void audio.close()
          } catch {
            // Closing an already closed context is harmless.
          }
          audio = null
        },
      }
    }

    // -----------------------------------------------------------------------
    // Icons
    // -----------------------------------------------------------------------

    const ICON_PATHS = {
      tomato: [
        'M12 20.5a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z',
        'M12 4.6V2.6',
        'M12 4.6c-1.5-.7-2.9-.9-4.3-.5',
        'M12 4.6c1.5-.7 2.9-.9 4.3-.5',
        'M12 9V13l2.5 1.6',
      ],
      play: ['M8.5 5.6 18.6 12 8.5 18.4Z'],
      pause: ['M9 5.5v13', 'M15 5.5v13'],
      rotate: ['M3.5 12a8.5 8.5 0 1 0 2.5-6L3.5 8.5', 'M3.5 3.5v5h5'],
      skip: ['M5.5 5.8 13 12l-7.5 6.2Z', 'M18.5 5.5v13'],
      minus: ['M5 12h14'],
      plus: ['M12 5v14', 'M5 12h14'],
      check: ['M4.5 12.5 9 17 19.5 6.5'],
    }

    function Icon(name, size = 14, options) {
      const paths = ICON_PATHS[name] ?? []
      const children = paths.map((d, index) => h('path', { key: index, d }))
      if (options !== undefined && options.badge === true) {
        children.push(h('circle', {
          key: 'badge',
          className: 'dp-icon-badge',
          cx: 19.6,
          cy: 19.4,
          r: 2.8,
          fill: 'var(--dsw-alias-state-success-primary, #2f9e63)',
          stroke: 'var(--dsw-alias-bg-base, #fff)',
          strokeWidth: 1.2,
        }))
      }
      return h('svg', {
        width: size,
        height: size,
        viewBox: '0 0 24 24',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 1.8,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        'aria-hidden': true,
      }, children)
    }

    // -----------------------------------------------------------------------
    // Styles
    // -----------------------------------------------------------------------

    const CSS = `
      .dp-page {
        width: 100%; height: 100%; min-width: 0; min-height: 0; box-sizing: border-box;
        display: flex; overflow: hidden; position: relative;
        color: var(--dsw-alias-label-primary); background: var(--dsw-alias-bg-base);
        font-size: 13px; line-height: 1.6;
      }
      [data-platform='darwin'] .dp-page {
        padding-top: var(--dsh-frame-top-clearance, 0px);
        padding-left: var(--dsh-frame-leading-clearance, 0px);
      }
      .dp-page *, .dp-page *::before, .dp-page *::after { box-sizing: border-box; }
      .dp-page button { font-family: inherit; }

      .dp-scroll { flex: 1; min-height: 0; overflow-y: auto; }
      .dp-scroll::-webkit-scrollbar { width: 8px; }
      .dp-scroll::-webkit-scrollbar-thumb {
        background: var(--dsw-alias-border-l2, rgba(127,127,127,.4));
        border-radius: 4px; border: 2px solid transparent; background-clip: content-box;
      }
      .dp-stage {
        min-height: 100%; width: 100%; max-width: 1000px; margin: 0 auto;
        padding: 48px 32px 56px;
        display: flex; flex-direction: column; align-items: center;
        justify-content: center; justify-content: safe center; gap: 28px;
      }

      /* ---- mode switch: quiet text pills, no outline ---- */
      .dp-modes { display: inline-flex; align-items: center; gap: 4px; }
      .dp-mode {
        border: 0; background: transparent; border-radius: 999px;
        padding: 8px 18px; font-size: 13.5px; color: var(--dsw-alias-label-secondary, #8a8f98);
        cursor: pointer; white-space: nowrap;
        transition: color .2s ease, background .2s ease;
      }
      .dp-mode:hover { color: var(--dsw-alias-label-primary); }
      .dp-mode[aria-pressed='true'] {
        background: var(--dsw-alias-bg-layer-2, rgba(127,127,127,.12));
        color: var(--dsw-alias-label-primary); font-weight: 600;
      }

      /* ---- the timer dominates the page ---- */
      .dp-ring-wrap { position: relative; width: min(560px, 100%, 60vh); aspect-ratio: 1; }
      .dp-ring { display: block; width: 100%; height: 100%; }
      .dp-ring-track {
        fill: none; stroke: var(--dsw-alias-bg-layer-2, rgba(127,127,127,.13)); stroke-width: 12;
      }
      .dp-ring-bar {
        fill: none; stroke: var(--dsw-alias-brand-primary, #4c8dff); stroke-width: 12;
        stroke-linecap: round;
        transition: stroke-dashoffset .25s linear, stroke .3s ease;
      }
      .dp-page[data-mode='short'] .dp-ring-bar,
      .dp-page[data-mode='long'] .dp-ring-bar {
        stroke: var(--dsw-alias-state-success-primary, #2f9e63);
      }
      .dp-ring-center {
        position: absolute; inset: 0; display: flex; flex-direction: column;
        align-items: center; justify-content: center; gap: 2px; pointer-events: none;
      }
      .dp-clock {
        font-size: 112px; font-weight: 600; letter-spacing: -.02em; line-height: 1;
        font-variant-numeric: tabular-nums;
      }
      .dp-phase { font-size: 15px; color: var(--dsw-alias-label-secondary, #8a8f98); margin-top: 8px; }
      .dp-dots { display: flex; align-items: center; gap: 9px; margin-top: 20px; }
      .dp-dot {
        width: 11px; height: 11px; border-radius: 50%; background: transparent;
        border: 1px solid var(--dsw-alias-border-l2, rgba(127,127,127,.45));
      }
      .dp-dot[data-state='done'] {
        background: var(--dsw-alias-brand-primary, #4c8dff); border-color: transparent;
      }
      .dp-dot[data-state='current'] { border-color: var(--dsw-alias-brand-primary, #4c8dff); }

      /* ---- goal: one quiet line, no box ---- */
      .dp-goal { width: min(600px, 100%); }
      .dp-goal-input {
        width: 100%; height: 46px; padding: 0 16px; border: 0; border-radius: 12px;
        background: transparent; color: var(--dsw-alias-label-primary);
        font-family: inherit; font-size: 15px; text-align: center; outline: none;
        transition: background .2s ease;
      }
      .dp-goal-input::placeholder { color: var(--dsw-alias-label-secondary, #8a8f98); opacity: .8; }
      .dp-goal-input:hover { background: var(--dsw-alias-bg-layer-1, rgba(127,127,127,.06)); }
      .dp-goal-input:focus { background: var(--dsw-alias-bg-layer-2, rgba(127,127,127,.12)); }

      /* ---- controls: one filled pill and two quiet actions ---- */
      .dp-controls { display: flex; align-items: center; gap: 6px; }
      .dp-primary {
        height: 60px; min-width: 240px; padding: 0 48px; border: 0; border-radius: 999px;
        background: var(--dsw-alias-brand-primary, #4c8dff); color: var(--dsw-alias-bg-base, #fff);
        font-size: 16px; font-weight: 600; cursor: pointer;
        display: inline-flex; align-items: center; justify-content: center; gap: 10px;
        transition: filter .15s ease, transform .1s ease;
      }
      .dp-primary:hover { filter: brightness(1.08); }
      .dp-primary:active { transform: translateY(1px); }
      .dp-ghost {
        height: 60px; padding: 0 18px; border: 0; border-radius: 999px; cursor: pointer;
        background: transparent; color: var(--dsw-alias-label-secondary, #8a8f98);
        font-size: 14px; display: inline-flex; align-items: center; gap: 7px;
        transition: color .15s ease, background .15s ease;
      }
      .dp-ghost:hover {
        background: var(--dsw-alias-bg-layer-2, rgba(127,127,127,.1));
        color: var(--dsw-alias-label-primary);
      }

      /* ---- footer: today at a glance, quiet pane switches ---- */
      .dp-foot {
        display: flex; align-items: center; gap: 12px; flex-wrap: wrap; justify-content: center;
        font-size: 12.5px; color: var(--dsw-alias-label-secondary, #8a8f98);
      }
      .dp-foot-stat { display: inline-flex; align-items: baseline; gap: 5px; }
      .dp-foot-stat strong {
        color: var(--dsw-alias-label-primary); font-size: 15px; font-weight: 600;
        font-variant-numeric: tabular-nums;
      }
      .dp-foot-sep { width: 1px; height: 14px; background: var(--dsw-alias-border-l2, rgba(127,127,127,.35)); }
      .dp-link {
        border: 0; background: transparent; padding: 5px 10px; border-radius: 8px; cursor: pointer;
        color: var(--dsw-alias-label-secondary, #8a8f98); font-size: 12.5px;
        transition: color .15s ease, background .15s ease;
      }
      .dp-link:hover { color: var(--dsw-alias-label-primary); background: var(--dsw-alias-bg-layer-2, rgba(127,127,127,.1)); }
      .dp-link[data-active='true'] {
        color: var(--dsw-alias-label-primary); background: var(--dsw-alias-bg-layer-2, rgba(127,127,127,.12));
      }
      .dp-link[data-armed='true'] { color: var(--dsw-alias-state-error-primary, #f06464); }

      /* ---- expanded panes: plain rows, no boxes ---- */
      .dp-pane {
        width: min(640px, 100%); display: flex; flex-direction: column; gap: 2px;
        padding: 2px 0 6px; font-size: 13px;
      }
      .dp-pane-head {
        display: flex; align-items: center; justify-content: space-between;
        padding: 0 4px 6px; font-size: 12px; color: var(--dsw-alias-label-secondary, #8a8f98);
      }
      .dp-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 6px 4px; }
      .dp-row-label { color: var(--dsw-alias-label-primary); }
      .dp-stepper { display: flex; align-items: center; gap: 2px; }
      .dp-step {
        width: 28px; height: 28px; padding: 0; border: 0; border-radius: 8px; cursor: pointer;
        background: transparent; color: var(--dsw-alias-label-secondary, #8a8f98);
        display: inline-flex; align-items: center; justify-content: center;
        transition: background .15s ease, color .15s ease;
      }
      .dp-step:hover:not(:disabled) {
        background: var(--dsw-alias-bg-layer-2, rgba(127,127,127,.12));
        color: var(--dsw-alias-label-primary);
      }
      .dp-step:disabled { opacity: .3; cursor: default; }
      .dp-step-value {
        min-width: 88px; text-align: center; font-size: 13px;
        color: var(--dsw-alias-label-primary); font-variant-numeric: tabular-nums;
      }
      .dp-switch {
        position: relative; width: 40px; height: 22px; padding: 0; border: 0; border-radius: 999px;
        cursor: pointer; background: var(--dsw-alias-bg-layer-2, rgba(127,127,127,.18));
        transition: background .2s ease;
      }
      .dp-switch::after {
        content: ''; position: absolute; top: 3px; left: 3px; width: 16px; height: 16px; border-radius: 50%;
        background: var(--dsw-alias-label-secondary, #8a8f98);
        transition: transform .18s ease, background .18s ease;
      }
      .dp-switch[aria-checked='true'] { background: var(--dsw-alias-brand-primary, #4c8dff); }
      .dp-switch[aria-checked='true']::after {
        transform: translateX(18px);
        background: var(--dsw-alias-bg-base, #fff);
      }
      .dp-note { padding: 6px 4px 0; font-size: 11.5px; color: var(--dsw-alias-label-secondary, #8a8f98); }
      .dp-log-list { display: flex; flex-direction: column; }
      .dp-log-item { display: flex; align-items: baseline; gap: 10px; padding: 6px 4px; }
      .dp-log-time {
        flex: none; font-size: 12px; color: var(--dsw-alias-label-secondary, #8a8f98);
        font-variant-numeric: tabular-nums;
      }
      .dp-log-goal {
        flex: 1; min-width: 0; font-size: 13px;
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      }
      .dp-log-minutes { flex: none; font-size: 11.5px; color: var(--dsw-alias-label-secondary, #8a8f98); }
      .dp-empty-line { padding: 8px 4px; font-size: 12.5px; color: var(--dsw-alias-label-secondary, #8a8f98); }

      .dp-sr {
        position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0;
        overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0;
      }

      /* ---- sidebar badge + frame-wide completion notice ---- */
      @keyframes dp-pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: .35; }
      }
      .dp-icon-badge { animation: dp-pulse 1.6s ease-in-out infinite; }
      .dp-toast {
        position: fixed; left: 50%; bottom: 26px; transform: translateX(-50%);
        display: inline-flex; align-items: center; gap: 8px; z-index: 30;
        max-width: min(84vw, 460px); padding: 10px 16px; border-radius: 999px;
        background: var(--dsw-alias-bg-overlay, rgba(255,255,255,.96));
        color: var(--dsw-alias-label-primary); font-size: 12.5px; line-height: 1.4;
        box-shadow: 0 10px 28px rgba(0,0,0,.18);
        pointer-events: none;
      }
      .dp-toast svg { flex: none; color: var(--dsw-alias-brand-primary, #4c8dff); }

      /* ---- narrower panels ---- */
      @media (max-width: 900px) {
        .dp-stage { padding: 34px 22px 42px; gap: 22px; }
        .dp-clock { font-size: 76px; }
      }
      @media (max-width: 620px) {
        .dp-stage { padding: 26px 16px 34px; gap: 18px; }
        .dp-clock { font-size: 58px; }
        .dp-primary { height: 52px; min-width: 0; padding: 0 34px; font-size: 15px; }
        .dp-ghost { height: 52px; padding: 0 12px; }
        .dp-ghost span { display: none; }
        .dp-goal-input { font-size: 14px; }
        .dp-dots { margin-top: 10px; }
      }
    `

    // -----------------------------------------------------------------------
    // Hooks
    // -----------------------------------------------------------------------

    /** Subscribe to the whole store snapshot (the clock repaints while running). */
    function useStoreState(store) {
      return React.useSyncExternalStore(
        store.subscribe,
        store.getSnapshot,
        store.getSnapshot,
      )
    }

    /** Subscribe to one derived store value; re-renders only when it changes. */
    function useStoreSelector(store, select) {
      return React.useSyncExternalStore(
        store.subscribe,
        () => select(store.getSnapshot()),
        () => select(store.getSnapshot()),
      )
    }

    /** Re-render when the locale preference or a registered dictionary changes. */
    function useLocaleRevision(locale) {
      return React.useSyncExternalStore(
        (onChange) => {
          try {
            const dispose = locale.subscribe(onChange)
            return typeof dispose === 'function' ? dispose : () => {}
          } catch {
            return () => {}
          }
        },
        () => {
          try {
            return locale.getSnapshot().revision
          } catch {
            return 0
          }
        },
        () => 0,
      )
    }

    /** Bind this plugin's dictionary namespace to a translate function. */
    function useTranslate(locale) {
      useLocaleRevision(locale)
      return React.useMemo(() => {
        try {
          const bound = locale.bind(NS)
          if (typeof bound === 'function') return bound
        } catch {
          // Fall through to the bundled Chinese table.
        }
        return (key) => TEXT.zh[key] ?? key
      }, [locale])
    }

    function formatClockTime(timestamp) {
      const date = new Date(timestamp)
      const hours = String(date.getHours()).padStart(2, '0')
      const minutes = String(date.getMinutes()).padStart(2, '0')
      return `${hours}:${minutes}`
    }

    // -----------------------------------------------------------------------
    // Components
    // -----------------------------------------------------------------------

    /** The pomodoro workspace rendered by `main.pomodoro`. */
    function PomodoroPage(props) {
      const { store, locale } = props
      const t = useTranslate(locale)
      const state = useStoreState(store)
      const [pane, setPane] = React.useState(null)
      const [clearArmed, setClearArmed] = React.useState(false)

      React.useEffect(() => {
        if (!clearArmed) return undefined
        const id = window.setTimeout(() => setClearArmed(false), 4000)
        return () => window.clearTimeout(id)
      }, [clearArmed])

      const settings = state.settings
      const mode = state.mode
      const totalMs = settings[mode] * MINUTE
      const now = typeof state.now === 'number' ? state.now : Date.now()
      const remainingMs = state.running && typeof state.endsAt === 'number'
        ? Math.max(0, state.endsAt - now)
        : Math.max(0, Math.min(state.remainingMs, totalMs))
      const secondsLeft = Math.max(0, Math.ceil(remainingMs / 1000))
      const clock = `${String(Math.floor(secondsLeft / 60)).padStart(2, '0')}:${String(secondsLeft % 60).padStart(2, '0')}`
      const ratio = totalMs > 0 ? Math.min(1, Math.max(0, 1 - remainingMs / totalMs)) : 0
      const dashed = (RING_CIRCUMFERENCE * (1 - ratio)).toFixed(2)
      const canResume = !state.running && remainingMs > 0 && remainingMs < totalMs - 1000
      const primaryLabel = state.running
        ? t('pause')
        : canResume
          ? t('resume')
          : mode === 'focus'
            ? t('startFocus')
            : t('startBreak')

      let phaseText = t('phaseFocusIdle')
      if (mode === 'focus') {
        phaseText = state.running ? t('phaseFocus') : canResume ? t('phasePaused') : t('phaseFocusIdle')
      } else if (mode === 'short') {
        phaseText = state.running ? t('phaseShort') : t('phaseShortIdle')
      } else {
        phaseText = state.running ? t('phaseLong') : t('phaseLongIdle')
      }

      const today = state.today
      const focusMinutes = Math.round(today.focusMs / MINUTE)
      const hasTodayData = today.count > 0 || today.log.length > 0

      const modeTabs = MODES.map((item) => h('button', {
        key: item,
        type: 'button',
        className: 'dp-mode',
        'aria-pressed': item === mode,
        onClick: () => store.selectMode(item),
      }, t(MODE_LABELS[item])))

      const dots = []
      for (let index = 0; index < settings.cycle; index += 1) {
        const dotState = index < state.cycle
          ? 'done'
          : (index === state.cycle && mode === 'focus' ? 'current' : 'idle')
        dots.push(h('span', { key: index, className: 'dp-dot', 'data-state': dotState }))
      }

      const settingRow = (key, labelKey, valueText) => {
        const [min, max] = SETTING_LIMITS[key]
        const value = settings[key]
        return h('div', { className: 'dp-row', key },
          h('span', { className: 'dp-row-label' }, t(labelKey)),
          h('div', { className: 'dp-stepper' },
            h('button', {
              type: 'button',
              className: 'dp-step',
              'aria-label': `${t('decrease')} ${t(labelKey)}`,
              disabled: value <= min,
              onClick: () => store.stepSetting(key, -1),
            }, Icon('minus', 13)),
            h('span', { className: 'dp-step-value' }, valueText),
            h('button', {
              type: 'button',
              className: 'dp-step',
              'aria-label': `${t('increase')} ${t(labelKey)}`,
              disabled: value >= max,
              onClick: () => store.stepSetting(key, 1),
            }, Icon('plus', 13)),
          ),
        )
      }

      const settingsPane = pane === 'settings'
        ? h('div', { className: 'dp-pane' },
          h('div', { className: 'dp-pane-head' }, h('span', null, t('settings'))),
          settingRow('focus', 'settingFocus', format(t('settingValueMinutes'), { n: settings.focus })),
          settingRow('short', 'settingShort', format(t('settingValueMinutes'), { n: settings.short })),
          settingRow('long', 'settingLong', format(t('settingValueMinutes'), { n: settings.long })),
          settingRow('cycle', 'settingCycle', format(t('settingValueCycle'), { n: settings.cycle })),
          h('div', { className: 'dp-row' },
            h('span', { className: 'dp-row-label' }, t('sound')),
            h('button', {
              type: 'button',
              className: 'dp-switch',
              role: 'switch',
              'aria-checked': settings.sound === true,
              'aria-label': t('sound'),
              onClick: () => store.toggleSound(),
            }, h('span', { className: 'dp-sr' }, settings.sound ? t('soundOn') : t('soundOff'))),
          ),
          h('div', { className: 'dp-note' }, t('localNote')),
        )
        : null

      const clearButton = hasTodayData
        ? h('button', {
          type: 'button',
          className: 'dp-link',
          'data-armed': clearArmed,
          onClick: () => {
            if (!clearArmed) {
              setClearArmed(true)
              return
            }
            setClearArmed(false)
            store.clearToday()
          },
        }, clearArmed ? t('clearConfirm') : t('clearToday'))
        : null

      const logPane = pane === 'log'
        ? h('div', { className: 'dp-pane' },
          h('div', { className: 'dp-pane-head' },
            h('span', null, t('logTitle')),
            clearButton,
          ),
          today.log.length === 0
            ? h('div', { className: 'dp-empty-line' }, t('logEmpty'))
            : h('div', { className: 'dp-log-list' },
              today.log.map((entry, index) => h('div', {
                className: 'dp-log-item',
                key: `${entry.at}-${index}`,
              },
                h('span', { className: 'dp-log-time' }, formatClockTime(entry.at)),
                h('span', { className: 'dp-log-goal' }, entry.goal === '' ? t('logUntitled') : entry.goal),
                h('span', { className: 'dp-log-minutes' }, format(t('minutesShort'), { n: entry.minutes })),
              )),
            ),
        )
        : null

      const togglePane = (next) => setPane(pane === next ? null : next)

      return h('div', { className: 'dp-page', 'data-plugin': NS, 'data-mode': mode },
        h('div', { className: 'dp-scroll' },
          h('div', { className: 'dp-stage' },
            h('div', { className: 'dp-modes' }, modeTabs),
            h('div', {
              className: 'dp-ring-wrap',
              role: 'timer',
              'aria-label': format(t('timerAria'), { clock }),
            },
              h('svg', { className: 'dp-ring', viewBox: '0 0 240 240', 'aria-hidden': true },
                h('circle', { className: 'dp-ring-track', cx: 120, cy: 120, r: RING_RADIUS }),
                h('circle', {
                  className: 'dp-ring-bar',
                  cx: 120,
                  cy: 120,
                  r: RING_RADIUS,
                  transform: 'rotate(-90 120 120)',
                  strokeDasharray: RING_CIRCUMFERENCE.toFixed(2),
                  strokeDashoffset: dashed,
                }),
              ),
              h('div', { className: 'dp-ring-center' },
                h('div', { className: 'dp-clock' }, clock),
                h('div', { className: 'dp-phase' }, phaseText),
                h('div', {
                  className: 'dp-dots',
                  'aria-label': format(t('cycleAria'), { n: state.cycle, total: settings.cycle }),
                }, dots),
              ),
            ),
            h('div', { className: 'dp-goal' },
              h('label', { className: 'dp-sr', htmlFor: 'dp-goal-input' }, t('goalLabel')),
              h('input', {
                id: 'dp-goal-input',
                className: 'dp-goal-input',
                type: 'text',
                value: state.goal,
                maxLength: MAX_GOAL_LENGTH,
                placeholder: t('goalPlaceholder'),
                onChange: (event) => store.setGoal(event.target.value),
              }),
            ),
            h('div', { className: 'dp-controls' },
              h('button', {
                type: 'button',
                className: 'dp-primary',
                onClick: () => (store.getSnapshot().running ? store.pause() : store.start()),
              },
                Icon(state.running ? 'pause' : 'play', 18),
                h('span', null, primaryLabel),
              ),
              h('button', { type: 'button', className: 'dp-ghost', onClick: () => store.reset() },
                Icon('rotate', 15), h('span', null, t('reset'))),
              h('button', { type: 'button', className: 'dp-ghost', onClick: () => store.skip() },
                Icon('skip', 15), h('span', null, t('skip'))),
            ),
            h('div', { className: 'dp-foot' },
              h('span', { className: 'dp-foot-stat' },
                h('strong', null, String(today.count)),
                h('span', null, t('pomodoros')),
              ),
              h('span', { className: 'dp-foot-sep' }),
              h('span', { className: 'dp-foot-stat' },
                h('strong', null, String(focusMinutes)),
                h('span', null, t('focusMinutes')),
              ),
              h('span', { className: 'dp-foot-sep' }),
              h('button', {
                type: 'button',
                className: 'dp-link',
                'data-active': pane === 'log',
                onClick: () => togglePane('log'),
              }, t('logTitle')),
              h('button', {
                type: 'button',
                className: 'dp-link',
                'data-active': pane === 'settings',
                onClick: () => togglePane('settings'),
              }, t('settings')),
            ),
            settingsPane,
            logPane,
          ),
        ),
      )
    }

    /** Sidebar row icon: tomato clock, pulsing dot while a round runs. */
    function PomodoroIcon(props) {
      const store = props.store
      const running = useStoreSelector(store, (snapshot) => snapshot.running === true)
      return Icon('tomato', props.size ?? 16, { badge: running })
    }

    /** Frame-wide completion notice, so a finished round announces itself anywhere. */
    function PomodoroNotice(props) {
      const { store, locale } = props
      const t = useTranslate(locale)
      const notice = useStoreSelector(store, (snapshot) => snapshot.notice)
      if (notice === null || notice === undefined) return null
      return h('div', { className: 'dp-toast', role: 'status', 'aria-live': 'polite' },
        Icon('tomato', 15),
        h('span', null, format(t(notice.key), notice.params)),
      )
    }

    // -----------------------------------------------------------------------
    // Plugin body
    // -----------------------------------------------------------------------

    function apply(ctx) {
      const locale = ctx.locale
      const store = createPomodoroStore()

      ctx.effect(() => () => store.dispose(), `${NS}: timer`)

      ctx.effect(() => {
        const disposers = []
        for (const id of ['zh', 'en']) {
          try {
            disposers.push(locale.register(NS, id, TEXT[id]))
          } catch {
            // A duplicate namespace keeps serving the already registered table.
          }
        }
        return () => {
          for (const dispose of disposers) {
            try {
              dispose()
            } catch {
              // Disposal is best effort.
            }
          }
        }
      }, `${NS}: dictionaries`)

      ctx.effect(() => {
        if (typeof document === 'undefined') return () => {}
        const tag = document.createElement('style')
        tag.dataset.plugin = NS
        tag.dataset.pluginCss = `${NS}/styles`
        tag.textContent = CSS
        document.head.appendChild(tag)
        return () => {
          tag.remove()
        }
      }, `${NS}: styles`)

      const Panel = () => h(PomodoroPage, { store, locale })
      const SidebarIcon = (props) => h(PomodoroIcon, { ...props, store })
      const Notice = () => h(PomodoroNotice, { store, locale })

      ctx.slots.inject('main', () => ctx.slots.register({
        name: 'main',
        key: PANEL_ID,
      }, Panel))

      ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
        name: 'sidebar.panellist',
        id: PANEL_ID,
        order: PANEL_ORDER,
        label: () => {
          try {
            return locale.bind(NS)('panel')
          } catch {
            return TEXT.zh.panel
          }
        },
      }, SidebarIcon))

      ctx.slots.inject('shell.overlay', () => ctx.slots.register({
        name: 'shell.overlay',
        id: `${NS}.notice`,
        order: 50,
      }, Notice))
    }

    return { inject, apply }
  },
})
