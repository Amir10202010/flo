import type { CSSProperties, ReactNode } from 'react'
import ModulePill, { type ModuleStatus } from './ModulePill'

/**
 * Shared card shell for dashboard modules: icon + title + status pill header,
 * optional right-side action, content below. Server- and client-safe.
 */
export default function WidgetShell({
  icon,
  iconTone = 'default',
  title,
  sub,
  status,
  action,
  children,
  bodyStyle,
  style,
}: {
  icon?: ReactNode
  /** 'ai' marks AI-powered modules with the branded gradient icon tile. */
  iconTone?: 'default' | 'ai'
  title: string
  sub?: string
  status?: ModuleStatus
  action?: ReactNode
  children: ReactNode
  bodyStyle?: CSSProperties
  style?: CSSProperties
}) {
  return (
    <section className="widget" style={style}>
      <header className="widget-head">
        {icon && <div className={`widget-icon${iconTone === 'ai' ? ' widget-icon-ai' : ''}`}>{icon}</div>}
        <div className="widget-head-text" style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <h2 className="widget-title" style={{ margin: 0 }}>{title}</h2>
            {status && <ModulePill status={status} />}
          </div>
          {sub && <div className="widget-sub">{sub}</div>}
        </div>
        {action && <div className="widget-action">{action}</div>}
      </header>
      <div style={{ flex: 1, minWidth: 0, ...bodyStyle }}>{children}</div>
    </section>
  )
}
