"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { ChevronDown, ArrowRight } from 'lucide-react'
import Link from "next/link"

export default function HomePage() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [scrollProgress, setScrollProgress] = useState(0)
  const [autoScrollOffset, setAutoScrollOffset] = useState(0)
  const [animationComplete, setAnimationComplete] = useState(false)
  const autoScrollStartTime = useRef<number | null>(null)
  const [mounted, setMounted] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    setMounted(true)
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
      
      // Lock scroll at 95% until animation completes
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

  const cards = [
    {
      image: "/images/1.png",
      initial: { x: 0, y: 0, opacity: 0, scale: 0.75 },
      descending: { x: 0, y: 250, opacity: 1, scale: 0.95 },
      exploded: { x: -3200 + (Math.random() * 400 - 200), y: -280, opacity: 1, scale: 0.85, rotation: 0 },
      row: { x: -3200, y: 380, opacity: 1, scale: 1, rotation: 0 },
    },
    {
      image: "/images/2.png",
      initial: { x: 0, y: 0, opacity: 0, scale: 0.8 },
      descending: { x: 0, y: 250, opacity: 1, scale: 0.9 },
      exploded: { x: -2800 + (Math.random() * 400 - 200), y: -200, opacity: 1, scale: 0.9, rotation: 0 },
      row: { x: -2800, y: 380, opacity: 1, scale: 1, rotation: 0 },
    },
    {
      image: "/images/3.png",
      initial: { x: 0, y: 0, opacity: 0, scale: 0.85 },
      descending: { x: 0, y: 250, opacity: 1, scale: 0.88 },
      exploded: { x: -2400 + (Math.random() * 400 - 200), y: -150, opacity: 1, scale: 0.95, rotation: 0 },
      row: { x: -2400, y: 380, opacity: 1, scale: 1, rotation: 0 },
    },
    {
      image: "/images/4.png",
      initial: { x: 0, y: 0, opacity: 0, scale: 0.8 },
      descending: { x: 0, y: 250, opacity: 1, scale: 0.85 },
      exploded: { x: -2000 + (Math.random() * 400 - 200), y: -100, opacity: 1, scale: 1.1, rotation: 0 },
      row: { x: -2000, y: 380, opacity: 1, scale: 1, rotation: 0 },
    },
    {
      image: "/images/5.png",
      initial: { x: 0, y: 0, opacity: 0, scale: 0.78 },
      descending: { x: 0, y: 250, opacity: 1, scale: 0.82 },
      exploded: { x: -1600 + (Math.random() * 400 - 200), y: -120, opacity: 1, scale: 0.92, rotation: 0 },
      row: { x: -1600, y: 380, opacity: 1, scale: 1, rotation: 0 },
    },
    {
      image: "/images/6.png",
      initial: { x: 0, y: 0, opacity: 0, scale: 0.82 },
      descending: { x: 0, y: 250, opacity: 1, scale: 0.8 },
      exploded: { x: -1200 + (Math.random() * 400 - 200), y: -180, opacity: 1, scale: 0.9, rotation: 0 },
      row: { x: -1200, y: 380, opacity: 1, scale: 1, rotation: 0 },
    },
    {
      image: "/images/7.png",
      initial: { x: 0, y: 0, opacity: 0, scale: 0.8 },
      descending: { x: 0, y: 250, opacity: 1, scale: 0.78 },
      exploded: { x: -800 + (Math.random() * 400 - 200), y: -240, opacity: 1, scale: 0.88, rotation: 0 },
      row: { x: -800, y: 380, opacity: 1, scale: 1, rotation: 0 },
    },
    {
      image: "/images/9.png",
      initial: { x: 0, y: 0, opacity: 0, scale: 0.8 },
      descending: { x: 0, y: 250, opacity: 1, scale: 0.72 },
      exploded: { x: -400 + (Math.random() * 400 - 200), y: 50, opacity: 1, scale: 0.83, rotation: 0 },
      row: { x: -400, y: 380, opacity: 1, scale: 1, rotation: 0 },
    },
    {
      image: "/images/10.png",
      initial: { x: 0, y: 0, opacity: 0, scale: 0.7 },
      descending: { x: 0, y: 250, opacity: 1, scale: 0.68 },
      exploded: { x: 0 + (Math.random() * 400 - 200), y: -100, opacity: 1, scale: 0.82, rotation: 0 },
      row: { x: 0, y: 380, opacity: 1, scale: 1, rotation: 0 },
    },
    {
      image: "/images/11.png",
      initial: { x: 0, y: 0, opacity: 0, scale: 0.8 },
      descending: { x: 0, y: 250, opacity: 1, scale: 0.65 },
      exploded: { x: 400 + (Math.random() * 400 - 200), y: -60, opacity: 1, scale: 0.8, rotation: 0 },
      row: { x: 400, y: 380, opacity: 1, scale: 1, rotation: 0 },
    },
    {
      image: "/images/12.png",
      initial: { x: 0, y: 0, opacity: 0, scale: 0.72 },
      descending: { x: 0, y: 250, opacity: 1, scale: 0.5 },
      exploded: { x: 800 + (Math.random() * 400 - 200), y: 200, opacity: 1, scale: 0.78, rotation: 0 },
      row: { x: 800, y: 380, opacity: 1, scale: 1, rotation: 0 },
    },
    {
      image: "/images/13.png",
      initial: { x: 0, y: 0, opacity: 0, scale: 0.74 },
      descending: { x: 0, y: 250, opacity: 1, scale: 0.6 },
      exploded: { x: 1200 + (Math.random() * 400 - 200), y: 150, opacity: 1, scale: 0.88, rotation: 0 },
      row: { x: 1200, y: 380, opacity: 1, scale: 1, rotation: 0 },
    },
    {
      image: "/images/16.png",
      initial: { x: 0, y: 0, opacity: 0, scale: 0.8 },
      descending: { x: 0, y: 250, opacity: 1, scale: 0.58 },
      exploded: { x: 1600 + (Math.random() * 400 - 200), y: -120, opacity: 1, scale: 0.82, rotation: 0 },
      row: { x: 1600, y: 380, opacity: 1, scale: 1, rotation: 0 },
    },
    {
      image: "/images/14.png",
      initial: { x: 0, y: 0, opacity: 0, scale: 0.8 },
      descending: { x: 0, y: 250, opacity: 1, scale: 0.52 },
      exploded: { x: 2000 + (Math.random() * 400 - 200), y: 180, opacity: 1, scale: 0.8, rotation: 0 },
      row: { x: 2000, y: 380, opacity: 1, scale: 1, rotation: 0 },
    },
    {
      image: "/images/15.png",
      initial: { x: 0, y: 0, opacity: 0, scale: 0.72 },
      descending: { x: 0, y: 250, opacity: 1, scale: 0.5 },
      exploded: { x: 2400 + (Math.random() * 400 - 200), y: 100, opacity: 1, scale: 0.86, rotation: 0 },
      row: { x: 2400, y: 380, opacity: 1, scale: 1, rotation: 0 },
    },
    {
      image: "/images/8.png",
      initial: { x: 0, y: 0, opacity: 0, scale: 0.8 },
      descending: { x: 0, y: 250, opacity: 1, scale: 0.48 },
      exploded: { x: 2800 + (Math.random() * 400 - 200), y: 140, opacity: 1, scale: 0.84, rotation: 0 },
      row: { x: 2800, y: 380, opacity: 1, scale: 1, rotation: 0 },
    },
    {
      image: "/images/4.png",
      initial: { x: 0, y: 0, opacity: 0, scale: 0.68 },
      descending: { x: 0, y: 250, opacity: 1, scale: 0.46 },
      exploded: { x: 3200 + (Math.random() * 400 - 200), y: 200, opacity: 1, scale: 0.82, rotation: 0 },
      row: { x: 3200, y: 380, opacity: 1, scale: 1, rotation: 0 },
    },
  ]

  const displayCards = isMobile ? cards.slice(0, 7) : cards

  const getCardStyle = (card: typeof cards[0], index: number) => {
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

  const nextSectionOpacity = animationComplete && scrollProgress > 0.95 ? Math.min((scrollProgress - 0.95) * 10, 1) : 0

  return (
    <div className="bg-black">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 px-6 py-4 flex items-center justify-between bg-black/80 backdrop-blur-sm">
        <div className="flex items-center gap-8">
          <div className="text-white">
            <img 
              src="/producething_brandmark.svg" 
              alt="ProduceThing" 
              className="h-12 w-auto"
            />
          </div>
          <div className="hidden md:flex items-center gap-8 text-white/90 text-sm font-medium">
            <button className="flex items-center gap-1 hover:text-white transition-colors">
              Product
              <ChevronDown className="w-4 h-4" />
            </button>
            <a href="#" className="hover:text-white transition-colors">Discover</a>
            <a href="#" className="hover:text-white transition-colors">Help</a>
          </div>
        </div>
        <Link href="/studio">
          <Button size="sm" className="bg-[#c4f567] text-black hover:bg-[#b8e557] font-medium px-4 flex items-center gap-2">
            Enter
            <ArrowRight className="w-4 h-4" />
          </Button>
        </Link>
      </nav>

      {/* Hero Section - Pinned scroll container */}
      <div ref={containerRef} className="relative" style={{ height: isMobile ? "600vh" : "800vh" }}>
        <div className="sticky top-0 left-0 right-0 h-screen overflow-hidden">
          <div className="relative w-full h-full">
            
            <div className="absolute inset-0 z-10 flex items-center justify-center">
              {displayCards.map((card, index) => (
                <div
                  key={index}
                  className={`absolute w-64 h-64 rounded-2xl overflow-hidden shadow-2xl transition-all duration-200 ${!isMobile ? 'hover:scale-110 hover:z-50' : ''} cursor-pointer`}
                  style={getCardStyle(card, index)}
                >
                  <img
                    src={card.image || "/placeholder.svg"}
                    alt={`Artwork ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                </div>
              ))}
            </div>

            <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
              <div className="relative w-full h-full flex items-center justify-center">
                {/* Centered Logo */}
                <div
                  className="absolute inset-0 flex items-center justify-center"
                  style={{
                    opacity: scrollProgress < 0.5 ? 1 - (scrollProgress - 0.4) * 5 : 0,
                    transform: `scale(${scrollProgress < 0.5 ? 1 - scrollProgress * 0.2 : 0.8})`,
                    transition: "opacity 0.2s, transform 0.2s",
                  }}
                >
                  <div className="text-center">
                    <img 
                      src="/producething_brandmark.svg" 
                      alt="ProduceThing" 
                      className="h-24 md:h-32 w-auto mx-auto"
                    />
                    <p className="text-2xl md:text-3xl text-white/60 mt-4">by Duy</p>
                  </div>
                </div>

                {/* Headline and CTA */}
                <div
                  className="absolute inset-0 flex items-center justify-center pointer-events-auto"
                  style={{
                    opacity: scrollProgress > 0.5 ? (scrollProgress - 0.5) * 2 : 0,
                    transform: `scale(${scrollProgress > 0.5 ? 0.85 + (scrollProgress - 0.5) * 0.3 : 0.85}) translateY(-${scrollProgress > 0.75 ? (scrollProgress - 0.75) * 50 : 0}vh)`,
                    transition: "opacity 0.2s, transform 0.2s",
                  }}
                >
                  <div className="flex flex-col items-center px-6">
                    <h2 className="text-5xl md:text-7xl font-bold text-white mb-6 leading-tight font-serif text-center">
                      Produce
                    </h2>
                    <Link href="/studio">
                      <Button 
                        size="lg" 
                        className="bg-[#c4f567] text-black hover:bg-[#b8e557] font-semibold text-base px-8 py-6 rounded-md flex items-center gap-2"
                      >
                        Enter
                        <ArrowRight className="w-5 h-5" />
                      </Button>
                    </Link>
                    <p className="text-sm text-white/50 mt-4">by <span className="italic font-serif">Duy</span></p>
                  </div>
                </div>

              </div>
            </div>

            {/* Scroll Indicator */}
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
