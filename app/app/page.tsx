"use client"

import { useEffect, useRef, useState } from "react"
import { ChevronDown } from 'lucide-react'
import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"

const QUICK_PROMPTS = [
  { label: "Lofi chill beats", prompt: "lofi hip hop, chill, rainy day vibes, nostalgic" },
  { label: "Trap banger", prompt: "trap, 808s, hard hitting drums, dark energy" },
  { label: "Acoustic folk", prompt: "acoustic guitar, folk, warm, storytelling" },
  { label: "Synth pop", prompt: "synth pop, 80s inspired, bright, danceable" },
  { label: "Jazz vibes", prompt: "smooth jazz, saxophone, piano, late night" },
  { label: "EDM drop", prompt: "edm, electronic, heavy bass drop, festival energy" },
];

function seededRandom(seed: number) {
  const x = Math.sin(seed + 1) * 10000;
  return x - Math.floor(x);
}

const CARD_OFFSETS = Array.from({ length: 17 }, (_, i) => seededRandom(i) * 400 - 200);

const CARDS = [
  {
    image: "/images/1.png",
    initial: { x: 0, y: 0, opacity: 0, scale: 0.75 },
    descending: { x: 0, y: 250, opacity: 1, scale: 0.95 },
    exploded: { x: -3200 + CARD_OFFSETS[0], y: -280, opacity: 1, scale: 0.85, rotation: 0 },
    row: { x: -3200, y: 380, opacity: 1, scale: 1, rotation: 0 },
  },
  {
    image: "/images/2.png",
    initial: { x: 0, y: 0, opacity: 0, scale: 0.8 },
    descending: { x: 0, y: 250, opacity: 1, scale: 0.9 },
    exploded: { x: -2800 + CARD_OFFSETS[1], y: -200, opacity: 1, scale: 0.9, rotation: 0 },
    row: { x: -2800, y: 380, opacity: 1, scale: 1, rotation: 0 },
  },
  {
    image: "/images/3.png",
    initial: { x: 0, y: 0, opacity: 0, scale: 0.85 },
    descending: { x: 0, y: 250, opacity: 1, scale: 0.88 },
    exploded: { x: -2400 + CARD_OFFSETS[2], y: -150, opacity: 1, scale: 0.95, rotation: 0 },
    row: { x: -2400, y: 380, opacity: 1, scale: 1, rotation: 0 },
  },
  {
    image: "/images/4.png",
    initial: { x: 0, y: 0, opacity: 0, scale: 0.8 },
    descending: { x: 0, y: 250, opacity: 1, scale: 0.85 },
    exploded: { x: -2000 + CARD_OFFSETS[3], y: -100, opacity: 1, scale: 1.1, rotation: 0 },
    row: { x: -2000, y: 380, opacity: 1, scale: 1, rotation: 0 },
  },
  {
    image: "/images/5.png",
    initial: { x: 0, y: 0, opacity: 0, scale: 0.78 },
    descending: { x: 0, y: 250, opacity: 1, scale: 0.82 },
    exploded: { x: -1600 + CARD_OFFSETS[4], y: -120, opacity: 1, scale: 0.92, rotation: 0 },
    row: { x: -1600, y: 380, opacity: 1, scale: 1, rotation: 0 },
  },
  {
    image: "/images/6.png",
    initial: { x: 0, y: 0, opacity: 0, scale: 0.82 },
    descending: { x: 0, y: 250, opacity: 1, scale: 0.8 },
    exploded: { x: -1200 + CARD_OFFSETS[5], y: -180, opacity: 1, scale: 0.9, rotation: 0 },
    row: { x: -1200, y: 380, opacity: 1, scale: 1, rotation: 0 },
  },
  {
    image: "/images/7.png",
    initial: { x: 0, y: 0, opacity: 0, scale: 0.8 },
    descending: { x: 0, y: 250, opacity: 1, scale: 0.78 },
    exploded: { x: -800 + CARD_OFFSETS[6], y: -240, opacity: 1, scale: 0.88, rotation: 0 },
    row: { x: -800, y: 380, opacity: 1, scale: 1, rotation: 0 },
  },
  {
    image: "/images/9.png",
    initial: { x: 0, y: 0, opacity: 0, scale: 0.8 },
    descending: { x: 0, y: 250, opacity: 1, scale: 0.72 },
    exploded: { x: -400 + CARD_OFFSETS[7], y: 50, opacity: 1, scale: 0.83, rotation: 0 },
    row: { x: -400, y: 380, opacity: 1, scale: 1, rotation: 0 },
  },
  {
    image: "/images/10.png",
    initial: { x: 0, y: 0, opacity: 0, scale: 0.7 },
    descending: { x: 0, y: 250, opacity: 1, scale: 0.68 },
    exploded: { x: 0 + CARD_OFFSETS[8], y: -100, opacity: 1, scale: 0.82, rotation: 0 },
    row: { x: 0, y: 380, opacity: 1, scale: 1, rotation: 0 },
  },
  {
    image: "/images/11.png",
    initial: { x: 0, y: 0, opacity: 0, scale: 0.8 },
    descending: { x: 0, y: 250, opacity: 1, scale: 0.65 },
    exploded: { x: 400 + CARD_OFFSETS[9], y: -60, opacity: 1, scale: 0.8, rotation: 0 },
    row: { x: 400, y: 380, opacity: 1, scale: 1, rotation: 0 },
  },
  {
    image: "/images/12.png",
    initial: { x: 0, y: 0, opacity: 0, scale: 0.72 },
    descending: { x: 0, y: 250, opacity: 1, scale: 0.5 },
    exploded: { x: 800 + CARD_OFFSETS[10], y: 200, opacity: 1, scale: 0.78, rotation: 0 },
    row: { x: 800, y: 380, opacity: 1, scale: 1, rotation: 0 },
  },
  {
    image: "/images/13.png",
    initial: { x: 0, y: 0, opacity: 0, scale: 0.74 },
    descending: { x: 0, y: 250, opacity: 1, scale: 0.6 },
    exploded: { x: 1200 + CARD_OFFSETS[11], y: 150, opacity: 1, scale: 0.88, rotation: 0 },
    row: { x: 1200, y: 380, opacity: 1, scale: 1, rotation: 0 },
  },
  {
    image: "/images/16.png",
    initial: { x: 0, y: 0, opacity: 0, scale: 0.8 },
    descending: { x: 0, y: 250, opacity: 1, scale: 0.58 },
    exploded: { x: 1600 + CARD_OFFSETS[12], y: -120, opacity: 1, scale: 0.82, rotation: 0 },
    row: { x: 1600, y: 380, opacity: 1, scale: 1, rotation: 0 },
  },
  {
    image: "/images/14.png",
    initial: { x: 0, y: 0, opacity: 0, scale: 0.8 },
    descending: { x: 0, y: 250, opacity: 1, scale: 0.52 },
    exploded: { x: 2000 + CARD_OFFSETS[13], y: 180, opacity: 1, scale: 0.8, rotation: 0 },
    row: { x: 2000, y: 380, opacity: 1, scale: 1, rotation: 0 },
  },
  {
    image: "/images/15.png",
    initial: { x: 0, y: 0, opacity: 0, scale: 0.72 },
    descending: { x: 0, y: 250, opacity: 1, scale: 0.5 },
    exploded: { x: 2400 + CARD_OFFSETS[14], y: 100, opacity: 1, scale: 0.86, rotation: 0 },
    row: { x: 2400, y: 380, opacity: 1, scale: 1, rotation: 0 },
  },
  {
    image: "/images/8.png",
    initial: { x: 0, y: 0, opacity: 0, scale: 0.8 },
    descending: { x: 0, y: 250, opacity: 1, scale: 0.48 },
    exploded: { x: 2800 + CARD_OFFSETS[15], y: 140, opacity: 1, scale: 0.84, rotation: 0 },
    row: { x: 2800, y: 380, opacity: 1, scale: 1, rotation: 0 },
  },
  {
    image: "/images/4.png",
    initial: { x: 0, y: 0, opacity: 0, scale: 0.68 },
    descending: { x: 0, y: 250, opacity: 1, scale: 0.46 },
    exploded: { x: 3200 + CARD_OFFSETS[16], y: 200, opacity: 1, scale: 0.82, rotation: 0 },
    row: { x: 3200, y: 380, opacity: 1, scale: 1, rotation: 0 },
  },
];

export default function HomePage() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [scrollProgress, setScrollProgress] = useState(0)
  const [autoScrollOffset, setAutoScrollOffset] = useState(0)
  const [animationComplete] = useState(false)
  const autoScrollStartTime = useRef<number | null>(null)
  const [isMobile, setIsMobile] = useState(false)
  const router = useRouter()
  const [prompt, setPrompt] = useState("")
  const searchRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  useEffect(() => {
    const handleScroll = () => {
      if (!containerRef.current) return

      const rect = containerRef.current.getBoundingClientRect()
      const containerHeight = containerRef.current.offsetHeight
      const viewportHeight = window.innerHeight

      const scrollableDistance = containerHeight - viewportHeight
      const scrolled = -rect.top
      const progress = Math.min(Math.max(scrolled / scrollableDistance, 0), 1)

      if (progress >= 0.95 && !animationComplete) {
        const maxScroll = scrollableDistance * 0.95
        window.scrollTo(0, maxScroll)
        setScrollProgress(0.95)
        return
      }

      setScrollProgress(progress)
    }

    window.addEventListener("scroll", handleScroll)
    handleScroll()

    return () => window.removeEventListener("scroll", handleScroll)
  }, [animationComplete])

  useEffect(() => {
    if (scrollProgress < 0.95) return

    if (!autoScrollStartTime.current) {
      autoScrollStartTime.current = Date.now()
    }

    const interval = setInterval(() => {
      setAutoScrollOffset((prev) => prev - 1.5)
    }, 16)

    return () => clearInterval(interval)
  }, [scrollProgress])

  const displayCards = isMobile ? CARDS.slice(0, 7) : CARDS

  const getCardStyle = (card: typeof CARDS[0], index: number) => {
    let x = card.initial.x
    let y = card.initial.y
    let opacity = 0
    let scale = card.initial.scale

    const isLateCard = index >= 8

    if (scrollProgress > 0 && scrollProgress <= 0.35) {
      const progress = Math.min(scrollProgress / 0.35, 1)
      const delay = index * 0.05
      const adjustedProgress = Math.max(0, Math.min((progress - delay) * 2, 1))

      opacity = isLateCard ? 0 : adjustedProgress
    }

    if (scrollProgress > 0.35 && scrollProgress <= 0.55) {
      const progress = Math.min((scrollProgress - 0.35) / 0.2, 1)
      const eased = progress * progress * (3 - 2 * progress)

      x = 0
      y = card.descending.y * eased
      scale = card.initial.scale + (card.descending.scale - card.initial.scale) * eased
      opacity = isLateCard ? Math.min(eased * 2, 1) : 1
    }

    if (scrollProgress > 0.55) {
      const progress = Math.min((scrollProgress - 0.55) / 0.2, 1)
      const eased = progress * progress * (3 - 2 * progress)

      x = card.descending.x + (card.exploded.x - card.descending.x) * eased
      y = card.descending.y + (card.exploded.y - card.descending.y) * eased
      scale = card.descending.scale + (card.exploded.scale - card.descending.scale) * eased
      opacity = 1
    }

    if (scrollProgress > 0.75) {
      const progress = Math.min((scrollProgress - 0.75) / 0.25, 1)
      const eased = progress * progress * (3 - 2 * progress)

      x = card.exploded.x + (card.row.x - card.exploded.x) * eased
      y = card.exploded.y + (card.row.y - card.exploded.y) * eased
      scale = card.exploded.scale + (card.row.scale - card.exploded.scale) * eased
      opacity = card.row.opacity
    }

    if (scrollProgress >= 0.95 && !isMobile) {
      const loopWidth = 6800
      const minX = -3400

      const rawPos = card.row.x + autoScrollOffset

      const relativePos = rawPos - minX
      const wrappedRelativePos = ((relativePos % loopWidth) + loopWidth) % loopWidth
      x = wrappedRelativePos + minX

      const fadeEdge = 2800
      const fadeWidth = 400

      if (x < -fadeEdge) {
        opacity = Math.max(0, 1 - ((-fadeEdge - x) / fadeWidth))
      } else if (x > fadeEdge) {
        opacity = Math.max(0, 1 - ((x - fadeEdge) / fadeWidth))
      } else {
        opacity = 1
      }
    }

    return {
      transform: `translate(${x}px, ${y}px) scale(${scale})`,
      opacity,
    }
  }

  return (
    <div className="bg-black">
      <nav aria-label="Main navigation" className="fixed top-0 left-0 right-0 z-50 px-6 py-4 flex items-center justify-between bg-black/80 backdrop-blur-sm">
        <div className="flex items-center gap-8">
          <div className="text-white">
            <Image
              src="/producething_brandmark.svg"
              alt="ProduceThing"
              width={48}
              height={48}
              className="h-12 w-auto"
            />
          </div>
        </div>
        <Link
          href="/studio"
          className="group relative px-5 py-2 text-sm font-medium text-black rounded-full bg-[#c4f567] hover:shadow-[0_0_20px_rgba(196,245,103,0.4)] transition-all duration-300"
        >
          <span className="relative z-10 flex items-center gap-1.5">
            Open Studio
            <svg className="w-3.5 h-3.5 transition-transform duration-300 group-hover:translate-x-0.5" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M3 8h10m0 0L9 4m4 4L9 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </span>
        </Link>
      </nav>

      <div ref={containerRef} className="relative" style={{ height: isMobile ? "600vh" : "800vh" }}>
        <div className="sticky top-0 left-0 right-0 h-screen overflow-hidden">
          <div className="relative w-full h-full">

            <div className="absolute inset-0 z-10 flex items-center justify-center">
              {displayCards.map((card, index) => (
                <div
                  key={index}
                  className={`absolute w-64 h-64 rounded-2xl overflow-hidden shadow-2xl transition-all duration-200 ${!isMobile ? 'hover:scale-110 hover:z-50' : ''} cursor-pointer relative`}
                  style={getCardStyle(card, index)}
                >
                  <Image
                    src={card.image || "/placeholder.svg"}
                    alt={`Artwork ${index + 1}`}
                    fill
                    className="object-cover"
                  />
                </div>
              ))}
            </div>

            <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
              <div className="relative w-full h-full flex items-center justify-center">
                <div
                  className="absolute inset-0 flex items-center justify-center"
                  style={{
                    opacity: scrollProgress < 0.5 ? 1 - (scrollProgress - 0.4) * 5 : 0,
                    transform: `scale(${scrollProgress < 0.5 ? 1 - scrollProgress * 0.2 : 0.8})`,
                    transition: "opacity 0.2s, transform 0.2s",
                  }}
                >
                  <div className="text-center">
                    <Image
                      src="/producething_brandmark.svg"
                      alt="ProduceThing"
                      width={128}
                      height={128}
                      className="h-24 md:h-32 w-auto mx-auto"
                    />
                  </div>
                </div>

                <div
                  ref={searchRef}
                  className="absolute inset-0 flex items-center justify-center pointer-events-auto"
                  style={{
                    opacity: scrollProgress > 0.5 ? (scrollProgress - 0.5) * 2 : 0,
                    transform: `scale(${scrollProgress > 0.5 ? 0.85 + (scrollProgress - 0.5) * 0.3 : 0.85}) translateY(-${scrollProgress > 0.75 ? (scrollProgress - 0.75) * 50 : 0}vh)`,
                    transition: "opacity 0.2s, transform 0.2s",
                  }}
                >
                  <div className="flex flex-col items-center px-6 w-full max-w-xl">
                    <h2 className="text-5xl md:text-7xl font-bold text-white mb-8 leading-tight font-serif text-center">
                      Start Producing
                    </h2>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (!prompt.trim()) return;
                        router.push(`/studio?prompt=${encodeURIComponent(prompt.trim())}`);
                      }}
                      className="w-full mb-5"
                    >
                      <div className="relative bg-white/[0.07] border border-white/[0.12] rounded-xl backdrop-blur-sm focus-within:border-[#c4f567]/40 transition-colors">
                        <input
                          type="text"
                          value={prompt}
                          onChange={(e) => setPrompt(e.target.value)}
                          placeholder="Describe your music..."
                          className="w-full bg-transparent px-5 py-4 pr-14 text-white placeholder:text-white/30 focus:outline-none text-base"
                        />
                        <button
                          type="submit"
                          disabled={!prompt.trim()}
                          aria-label="Start producing"
                          className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-[#c4f567] text-black flex items-center justify-center disabled:opacity-20 hover:shadow-[0_0_20px_rgba(196,245,103,0.5)] hover:scale-110 active:scale-95 transition-all duration-200"
                        >
                          <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                            <path d="M3 8h10m0 0L9 4m4 4L9 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </button>
                      </div>
                    </form>
                    <div className="flex flex-wrap gap-2 justify-center">
                      {QUICK_PROMPTS.map((qp) => (
                        <button
                          key={qp.label}
                          type="button"
                          onClick={() => {
                            setPrompt(qp.prompt);
                            router.push(`/studio?prompt=${encodeURIComponent(qp.prompt)}`);
                          }}
                          className="px-3.5 py-1.5 text-sm rounded-full bg-white/5 border border-white/10 text-white/50 hover:bg-white/10 hover:text-white hover:border-white/20 transition-all"
                        >
                          {qp.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

              </div>
            </div>

            {scrollProgress < 0.1 && (
              <div className="absolute bottom-12 left-1/2 -translate-x-1/2 z-30">
                <div className="flex flex-col items-center gap-2 text-white/50 text-sm animate-bounce">
                  <span>Keep scrolling</span>
                  <ChevronDown className="w-5 h-5" />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
