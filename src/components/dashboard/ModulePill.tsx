/**
 * Module maturity pill — every dashboard section declares what it is:
 *   live    — fully implemented on real workspace data
 *   beta    — functional preview, behaviour may change
 *   preview — designed module, backend rolling out
 *   soon    — announced, not yet functional
 */
export type ModuleStatus = 'live' | 'beta' | 'preview' | 'soon'

const LABEL: Record<ModuleStatus, string> = {
  live: 'Live',
  beta: 'Beta',
  preview: 'Preview',
  soon: 'Soon',
}

export default function ModulePill({ status }: { status: ModuleStatus }) {
  // 'live' is the default state — a badge on every working module is just noise.
  // Only surface a label for modules that aren't fully live yet.
  if (status === 'live') return null
  return <span className="module-pill">{LABEL[status]}</span>
}
