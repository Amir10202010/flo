'use client'

/**
 * Generic list/board surface for ONE workspace object, rendered entirely from
 * metadata: table columns come from `showInList` FieldSpecs, the board comes
 * from the object's pipeline stages. Reuses the clients-table styles so every
 * industry's pages look native to the app.
 */
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Kanban, Plus, Search, Table2 } from 'lucide-react'
import { formatFieldValue, type FieldSpec } from '@/lib/workspace/field-types'
import type { WorkspaceObjectModel } from '@/services/workspace/workspace.service'
import type { RecordModel } from '@/services/workspace/record.service'
import RecordModal from './RecordModal'

const MAX_LIST_FIELDS = 4

function stageLabel(object: WorkspaceObjectModel, stageKey: string | null): string {
  if (!stageKey) return ''
  return object.pipeline?.find((s) => s.key === stageKey)?.label ?? stageKey
}

export default function ObjectPage({
  object,
  records,
}: {
  object: WorkspaceObjectModel
  records: RecordModel[]
}) {
  const router = useRouter()
  const hasBoard = !!object.pipeline?.length
  const [view, setView] = useState<'table' | 'board'>(hasBoard ? 'board' : 'table')
  const [query, setQuery] = useState('')
  const [modal, setModal] = useState<{ record: RecordModel | null } | null>(null)
  const [movingId, setMovingId] = useState<string | null>(null)

  const listFields = useMemo(
    () => object.fields.filter((f) => f.showInList).slice(0, MAX_LIST_FIELDS),
    [object.fields],
  )

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return records
    return records.filter((r) => {
      if (r.title.toLowerCase().includes(q)) return true
      return listFields.some((f) => {
        const v = r.data[f.key]
        return typeof v === 'string' && v.toLowerCase().includes(q)
      })
    })
  }, [records, query, listFields])

  async function moveStage(record: RecordModel, stageKey: string) {
    setMovingId(record.id)
    try {
      await fetch(`/api/records/${record.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stageKey }),
      })
      router.refresh()
    } finally {
      setMovingId(null)
    }
  }

  const toolbar = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
      <div className="inbox-search" style={{ maxWidth: 320, flex: 1, minWidth: 180 }}>
        <Search size={13} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search ${object.plural.toLowerCase()}…`}
          aria-label={`Search ${object.plural}`}
        />
      </div>
      {hasBoard && (
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            type="button"
            className="btn-ghost"
            aria-pressed={view === 'board'}
            onClick={() => setView('board')}
            style={{ padding: '7px 12px', fontSize: 12.5, ...(view === 'board' ? { background: 'var(--bg-subtle)' } : {}) }}
          >
            <Kanban size={13} /> Board
          </button>
          <button
            type="button"
            className="btn-ghost"
            aria-pressed={view === 'table'}
            onClick={() => setView('table')}
            style={{ padding: '7px 12px', fontSize: 12.5, ...(view === 'table' ? { background: 'var(--bg-subtle)' } : {}) }}
          >
            <Table2 size={13} /> Table
          </button>
        </div>
      )}
      <div style={{ flex: 1 }} />
      <button type="button" className="btn-primary" onClick={() => setModal({ record: null })} style={{ fontSize: 13 }}>
        <Plus size={14} /> New {object.singular.toLowerCase()}
      </button>
    </div>
  )

  const empty = (
    <div
      style={{
        padding: '48px 24px',
        textAlign: 'center',
        border: '1px dashed var(--border)',
        borderRadius: 'var(--radius-lg, 12px)',
        color: 'var(--text-muted)',
        fontSize: 13.5,
        background: '#FFFFFF',
      }}
    >
      No {object.plural.toLowerCase()} yet — create the first one.
    </div>
  )

  return (
    <div>
      {toolbar}

      {visible.length === 0 ? (
        empty
      ) : view === 'board' && hasBoard ? (
        <Board
          object={object}
          records={visible}
          movingId={movingId}
          onOpen={(record) => router.push(`/o/${object.key}/${record.id}`)}
          onMove={moveStage}
        />
      ) : (
        <RecordsTable
          object={object}
          records={visible}
          listFields={listFields}
          onOpen={(record) => router.push(`/o/${object.key}/${record.id}`)}
        />
      )}

      {modal && <RecordModal object={object} record={modal.record} onClose={() => setModal(null)} />}
    </div>
  )
}

function RecordsTable({
  object,
  records,
  listFields,
  onOpen,
}: {
  object: WorkspaceObjectModel
  records: RecordModel[]
  listFields: FieldSpec[]
  onOpen: (r: RecordModel) => void
}) {
  return (
    <div className="clients-table-wrap">
      <table className="clients-table">
        <thead>
          <tr>
            <th>{object.singular}</th>
            {listFields.map((f) => (
              <th key={f.key}>{f.label}</th>
            ))}
            {object.pipeline?.length ? <th style={{ width: 130 }}>Stage</th> : null}
            <th style={{ width: 90 }}>Updated</th>
          </tr>
        </thead>
        <tbody>
          {records.map((r) => (
            <tr key={r.id} onClick={() => onOpen(r)} style={{ cursor: 'pointer' }}>
              <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{r.title}</td>
              {listFields.map((f) => (
                <td key={f.key} style={{ color: 'var(--text-secondary)', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {formatFieldValue(f, r.data[f.key]) || '—'}
                </td>
              ))}
              {object.pipeline?.length ? (
                <td style={{ color: 'var(--text-secondary)', fontSize: 12.5 }}>{stageLabel(object, r.stageKey)}</td>
              ) : null}
              <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{r.updatedAgo}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Board({
  object,
  records,
  movingId,
  onOpen,
  onMove,
}: {
  object: WorkspaceObjectModel
  records: RecordModel[]
  movingId: string | null
  onOpen: (r: RecordModel) => void
  onMove: (r: RecordModel, stageKey: string) => void
}) {
  const stages = object.pipeline ?? []
  const known = new Set(stages.map((s) => s.key))
  const cardFields = object.fields.filter((f) => f.showInList).slice(0, 2)

  const byStage = new Map<string, RecordModel[]>(stages.map((s) => [s.key, []]))
  for (const r of records) {
    const key = r.stageKey && known.has(r.stageKey) ? r.stageKey : stages[0]?.key
    if (key) byStage.get(key)!.push(r)
  }

  return (
    <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8, alignItems: 'flex-start' }}>
      {stages.map((stage) => {
        const items = byStage.get(stage.key) ?? []
        return (
          <div
            key={stage.key}
            style={{
              minWidth: 230,
              width: 230,
              flexShrink: 0,
              background: 'var(--bg-subtle)',
              border: '1px solid var(--border-light)',
              borderRadius: 'var(--radius-lg, 12px)',
              padding: '10px 10px 12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '2px 4px 10px' }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: stage.terminal ? 'var(--text-muted)' : 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {stage.label}
              </span>
              <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{items.length}</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {items.map((r) => (
                <div
                  key={r.id}
                  style={{
                    background: '#FFFFFF',
                    border: '1px solid var(--border)',
                    borderRadius: 10,
                    padding: '10px 11px',
                    boxShadow: 'var(--shadow-xs)',
                    opacity: movingId === r.id ? 0.5 : 1,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => onOpen(r)}
                    style={{ display: 'block', width: '100%', textAlign: 'left', border: 'none', background: 'none', padding: 0, cursor: 'pointer' }}
                  >
                    <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
                      {r.title}
                    </span>
                    {cardFields.map((f) => {
                      const v = formatFieldValue(f, r.data[f.key])
                      return v ? (
                        <span key={f.key} style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {v}
                        </span>
                      ) : null
                    })}
                  </button>
                  <select
                    value={r.stageKey && known.has(r.stageKey) ? r.stageKey : stage.key}
                    onChange={(e) => onMove(r, e.target.value)}
                    disabled={movingId === r.id}
                    aria-label="Move to stage"
                    style={{
                      marginTop: 8,
                      width: '100%',
                      fontSize: 11.5,
                      padding: '4px 6px',
                      borderRadius: 7,
                      border: '1px solid var(--border-light)',
                      background: 'var(--bg-base)',
                      color: 'var(--text-muted)',
                    }}
                  >
                    {stages.map((s) => (
                      <option key={s.key} value={s.key}>{s.label}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
