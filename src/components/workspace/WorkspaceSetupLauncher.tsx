'use client'

/**
 * Client shell for the standalone /workspace/setup page — reuses the same
 * interview/preview/apply component as onboarding; finishing (apply or skip)
 * returns to the dashboard, which re-renders under the new schema.
 */
import { useRouter } from 'next/navigation'
import WorkspaceSetupStep from '@/components/org/WorkspaceSetupStep'

export default function WorkspaceSetupLauncher() {
  const router = useRouter()
  return (
    <WorkspaceSetupStep
      onDone={() => {
        router.push('/dashboard')
        router.refresh()
      }}
    />
  )
}
