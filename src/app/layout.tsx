import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: 'DraftXI — Armá tu selección histórica',
  description: 'Draft roguelike de fútbol. Elegí jugadores de selecciones históricas y llevá tu equipo al campeonato.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning className={`${inter.variable} h-full`}>
      <body className="min-h-full bg-gray-950 text-white antialiased">{children}</body>
    </html>
  )
}
