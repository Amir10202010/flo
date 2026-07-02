'use client'

/** Edit button + modal for the record detail page; deletion returns to the list. */
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil } from 'lucide-react'
import type { WorkspaceObjectModel } from '@/services/workspace/workspace.service'
import type { RecordModel } from '@/services/workspace/record.service'
import RecordModal from './RecordModal'

export default function RecordDetailActions({
  object,
  record,
}: {
  object: WorkspaceObjectModel
  record: RecordModel
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" className="btn-ghost" onClick={() => setOpen(true)} style={{ fontSize: 13, padding: '8px 16px' }}>
        <Pencil size={13} /> Edit
      </button>
      {open && (
        <RecordModal
          object={object}
          record={record}
          onClose={() => setOpen(false)}
          onDeleted={() => router.push(`/o/${object.key}`)}
        />
      )}
    </>
  )
}
