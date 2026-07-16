import { redirect } from 'next/navigation'

/** The graph moved into the Knowledge section — preserve deep links. */
export default async function GraphRedirect({
  searchParams,
}: {
  searchParams?: Promise<{ focus?: string }>
}) {
  const focus = (await searchParams)?.focus
  redirect(focus ? `/knowledge?focus=${encodeURIComponent(focus)}` : '/knowledge')
}
