import type { Metadata } from 'next'
import { Geist, Geist_Mono, DM_Serif_Display } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'

const _geist = Geist({ subsets: ["latin"] }); // eslint-disable-line @typescript-eslint/no-unused-vars
const _geistMono = Geist_Mono({ subsets: ["latin"] }); // eslint-disable-line @typescript-eslint/no-unused-vars
const _dmSerifDisplay = DM_Serif_Display({ // eslint-disable-line @typescript-eslint/no-unused-vars
  subsets: ["latin"],
  weight: "400"
});

export const metadata: Metadata = {
  title: 'ProduceThing Studio',
  description: 'AI-powered layer-by-layer music creation by Duy',
  icons: {
    icon: '/producething_brandmark.svg',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`font-sans antialiased`}>
        {children}
        <Analytics />
      </body>
    </html>
  )
}
