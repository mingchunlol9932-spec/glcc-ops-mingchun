import './globals.css'

export const metadata = {
  title: 'Gepuklah',
  description: 'Gepuklah — join the queue',
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
}

// Minimal root shell. The business dashboard sidebar lives in app/(dash)/layout.tsx
// so the customer-facing /queue pages render full-screen without it.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
