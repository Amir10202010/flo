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
  return (
    <span className={`module-pill pill-${status}`}>
      <span className="pill-dot" />
      {LABEL[status]}
    </span>
  )
}
