import { ImageResponse } from 'next/og'

// Site-wide social share image (inherited by every route without its own).
export const alt = 'Velnox — The AI shared inbox for teams'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: '#0B0B0F',
          padding: 80,
          color: '#FFFFFF',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: '#4F5CF4', marginRight: 18 }} />
          <div style={{ fontSize: 36, fontWeight: 700, letterSpacing: '-0.01em' }}>Velnox</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 70, fontWeight: 700, lineHeight: 1.05, letterSpacing: '-0.03em', maxWidth: 920 }}>
            The AI shared inbox for teams
          </div>
          <div style={{ display: 'flex', fontSize: 30, color: '#A0A0AE', marginTop: 28, maxWidth: 900, lineHeight: 1.4 }}>
            Every thread gets an owner and an AI-drafted reply — on the Gmail you already use.
          </div>
        </div>

        <div style={{ display: 'flex', fontSize: 24, color: '#6E6E7A' }}>
          Flat pricing · no per-seat · live in minutes
        </div>
      </div>
    ),
    { ...size },
  )
}
