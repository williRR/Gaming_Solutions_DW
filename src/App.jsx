import Navigation from './components/Navigation.jsx'
import HeroSection from './components/HeroSection.jsx'
import CategoriesSection from './components/CategoriesSection.jsx'
import TrustSection from './components/TrustSection.jsx'
import Footer from './components/Footer.jsx'

function App() {
  return (
    <div className="min-h-screen bg-base-bg text-slate-100 overflow-x-hidden">
      <Navigation />
      <main>
        <HeroSection />
        <CategoriesSection />
        <TrustSection />
      </main>
      <Footer />
    </div>
  )
}

export default App
