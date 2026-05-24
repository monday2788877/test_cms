import type { ReactNode } from 'react'
import './styles.css'

export const metadata = {
  title: 'Real Estate Admin',
  description: 'Payload CMS admin for real-estate hybrid app',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  )
}
