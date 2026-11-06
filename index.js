/**
 * Host half of dsh-pomodoro.
 *
 * The timer is a browser-side feature: countdown state, settings and the daily
 * pomodoro log live in the page, so the host half only needs to exist as the
 * bundle's plugin row. It declares no service, which keeps the row active in
 * any profile that mounts a Web UI.
 *
 * @module dsh-pomodoro
 */

/** No host service is required; the Client half owns all behavior. */
export function apply() {}
