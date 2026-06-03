import { cookies } from 'next/headers'

export default function CallbackPage() {
    // Placeholder for OAuth callbacks
    return (
        <div className="p-8">
            <h1 className="text-2xl font-semibold">OAuth callback</h1>
            <p className="mt-2">This page will handle provider callbacks.</p>
        </div>
    )
}
