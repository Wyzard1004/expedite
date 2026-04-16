export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100">
      {/* Navigation Header */}
      <nav className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="text-2xl font-bold text-blue-600">Expedite</div>
          <a href="/admin/dashboard" className="px-4 py-2 text-sm font-medium text-slate-700 hover:text-blue-600">Admin</a>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-6 py-20">
        <div className="text-center mb-16">
          <h1 className="text-5xl md:text-6xl font-bold text-slate-900 mb-4">
            Hotel Review Management
          </h1>
          <p className="text-xl text-slate-600 mb-8 max-w-3xl mx-auto">
            Streamline guest reviews, detect data discrepancies, and manage your properties with powerful AI-assisted tools.
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <a href="/hotels" className="px-8 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors">
              Browse Hotels
            </a>
            <a href="/admin/dashboard" className="px-8 py-3 bg-slate-200 text-slate-900 rounded-lg font-semibold hover:bg-slate-300 transition-colors">
              Admin Dashboard
            </a>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="max-w-7xl mx-auto px-6 py-20">
        <h2 className="text-4xl font-bold text-slate-900 text-center mb-16">Key Features</h2>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {/* Feature 1: Reviews */}
          <div className="bg-white rounded-lg shadow-lg p-8 hover:shadow-xl transition-shadow">
            <h3 className="text-xl font-bold text-slate-900 mb-3">Guest Reviews</h3>
            <p className="text-slate-600">
              Collect and manage guest feedback with text and voice review options. AI-enhanced responses keep conversations going.
            </p>
          </div>

          {/* Feature 2: Voice */}
          <div className="bg-white rounded-lg shadow-lg p-8 hover:shadow-xl transition-shadow">
            <h3 className="text-xl font-bold text-slate-900 mb-3">Voice & Audio</h3>
            <p className="text-slate-600">
              Accept voice reviews and get AI-generated audio responses with realistic text-to-speech synthesis.
            </p>
          </div>

          {/* Feature 3: Discrepancies */}
          <div className="bg-white rounded-lg shadow-lg p-8 hover:shadow-xl transition-shadow">
            <h3 className="text-xl font-bold text-slate-900 mb-3">Discrepancy Detection</h3>
            <p className="text-slate-600">
              AI automatically flags contradictions between reviews and advertised amenities for quick resolution.
            </p>
          </div>

          {/* Feature 4: Analytics */}
          <div className="bg-white rounded-lg shadow-lg p-8 hover:shadow-xl transition-shadow">
            <h3 className="text-xl font-bold text-slate-900 mb-3">Analytics Dashboard</h3>
            <p className="text-slate-600">
              Real-time insights into property performance, review trends, and data quality metrics.
            </p>
          </div>

          {/* Feature 5: Background Processing */}
          <div className="bg-white rounded-lg shadow-lg p-8 hover:shadow-xl transition-shadow">
            <h3 className="text-xl font-bold text-slate-900 mb-3">Async Processing</h3>
            <p className="text-slate-600">
              Advanced AI analysis runs in the background without slowing down guest interactions.
            </p>
          </div>

          {/* Feature 6: Property Manager Tools */}
          <div className="bg-white rounded-lg shadow-lg p-8 hover:shadow-xl transition-shadow">
            <h3 className="text-xl font-bold text-slate-900 mb-3">Manager Tools</h3>
            <p className="text-slate-600">
              Complete control over your properties, amenities, categories, and review management.
            </p>
          </div>
        </div>
      </section>

      {/* Navigation Cards Section */}
      <section className="max-w-7xl mx-auto px-6 py-20">
        <h2 className="text-4xl font-bold text-slate-900 text-center mb-16">Get Started</h2>
        
        <div className="grid md:grid-cols-2 gap-8">
          {/* Hotels Card */}
          <a href="/hotels" className="bg-white rounded-lg shadow-lg p-12 hover:shadow-2xl transition-all hover:scale-105">
            <h3 className="text-2xl font-bold text-slate-900 mb-3">Browse Hotels</h3>
            <p className="text-slate-600 mb-6">
              Explore all properties in the system. View amenities, guest reviews, and property details.
            </p>
            <div className="inline-flex items-center text-blue-600 font-semibold">
              Go to Hotels <span className="ml-2">→</span>
            </div>
          </a>

          {/* Admin Dashboard Card */}
          <a href="/admin/dashboard" className="bg-white rounded-lg shadow-lg p-12 hover:shadow-2xl transition-all hover:scale-105">
            <h3 className="text-2xl font-bold text-slate-900 mb-3">Admin Dashboard</h3>
            <p className="text-slate-600 mb-6">
              Manage property data, resolve discrepancies, and track review analytics for your properties.
            </p>
            <div className="inline-flex items-center text-blue-600 font-semibold">
              Go to Dashboard <span className="ml-2">→</span>
            </div>
          </a>
        </div>
      </section>

      {/* Stats Section */}
      <section className="bg-blue-600 text-white py-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-3 gap-12 text-center">
            <div>
              <div className="text-5xl font-bold mb-2">∞</div>
              <p className="text-blue-100">Properties Supported</p>
            </div>
            <div>
              <div className="text-5xl font-bold mb-2">AI</div>
              <p className="text-blue-100">Powered by GPT-4o-mini</p>
            </div>
            <div>
              <div className="text-5xl font-bold mb-2">24/7</div>
              <p className="text-blue-100">Real-time Processing</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-300 py-8">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-8">
            <div>
              <div className="text-2xl font-bold text-white mb-2">Expedite</div>
              <p className="text-slate-400">Hotel Review Management Platform</p>
            </div>
            <div className="flex gap-8">
              <a href="/hotels" className="hover:text-white transition-colors">Hotels</a>
              <a href="/admin/dashboard" className="hover:text-white transition-colors">Admin</a>
              <a href="#" className="hover:text-white transition-colors">Documentation</a>
            </div>
          </div>
          <div className="border-t border-slate-700 mt-8 pt-8 text-center text-slate-400 text-sm">
            <p>© 2026 Expedite. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
