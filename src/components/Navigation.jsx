import { useEffect, useState } from 'react'

const links = [
  { label: 'Inicio', href: '#inicio' },
  { label: 'Categorías', href: '#categorias' },
  { label: 'Garantía', href: '#garantia' },
  { label: 'Sobre Nosotros', href: '#sobre-nosotros' },
]

function Navigation() {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const handleNavClick = (e, href) => {
    e.preventDefault()
    setOpen(false)
    document.querySelector(href)?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-colors duration-300 ${
        scrolled ? 'bg-base-bg/90 backdrop-blur border-b border-base-line' : 'bg-transparent border-b border-transparent'
      }`}
    >
      <nav className="max-w-7xl mx-auto flex items-center justify-between px-6 lg:px-10 h-18 py-3">
        {/* Logo */}
        <a
          href="#inicio"
          onClick={(e) => handleNavClick(e, '#inicio')}
          className="flex items-center gap-2 font-display text-xl sm:text-2xl font-bold tracking-wide"
        >
          <span className="w-9 h-9 flex items-center justify-center bevel-btn bg-gradient-to-br from-cyan-500 to-purple-600 text-base-bg font-extrabold">
            GS
          </span>
          <span className="text-white">
            GAMING <span className="text-cyan-400">SOLUTIONS</span>
          </span>
        </a>

        {/* Enlaces desktop */}
        <ul className="hidden md:flex items-center gap-8 font-display text-sm font-semibold tracking-wider uppercase">
          {links.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                onClick={(e) => handleNavClick(e, link.href)}
                className="text-slate-300 hover:text-cyan-400 transition-colors relative group"
              >
                {link.label}
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-cyan-400 transition-all duration-300 group-hover:w-full" />
              </a>
            </li>
          ))}
        </ul>

        {/* CTA contacto desktop */}
        <a
          href="#contacto"
          onClick={(e) => handleNavClick(e, '#sobre-nosotros')}
          className="hidden md:inline-flex bevel-btn items-center px-5 py-2.5 font-display font-bold uppercase text-sm tracking-wider bg-cyan-500 text-base-bg hover:bg-cyan-400 hover:shadow-glow-cyan transition-all"
        >
          Contáctanos
        </a>

        {/* Botón menú móvil */}
        <button
          className="md:hidden text-slate-200"
          onClick={() => setOpen(!open)}
          aria-label="Abrir menú de navegación"
          aria-expanded={open}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {open ? (
              <path d="M6 6l12 12M6 18L18 6" strokeLinecap="round" />
            ) : (
              <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
            )}
          </svg>
        </button>
      </nav>

      {/* Menú móvil */}
      {open && (
        <div className="md:hidden bg-base-panel border-t border-base-line px-6 py-6 flex flex-col gap-5 font-display uppercase font-semibold tracking-wide">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={(e) => handleNavClick(e, link.href)}
              className="text-slate-200 hover:text-cyan-400 transition-colors"
            >
              {link.label}
            </a>
          ))}
          <a
            href="#sobre-nosotros"
            onClick={(e) => handleNavClick(e, '#sobre-nosotros')}
            className="bevel-btn inline-flex justify-center px-5 py-3 bg-cyan-500 text-base-bg font-bold"
          >
            Contáctanos
          </a>
        </div>
      )}
    </header>
  )
}

export default Navigation
