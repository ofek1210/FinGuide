import { Upload, Mail, Sparkles, Shield, FileText, TrendingUp } from 'lucide-react';
import { ImageWithFallback } from './figma/ImageWithFallback';

interface LandingPageProps {
  onNavigate: (page: string) => void;
}

export function LandingPage({ onNavigate }: LandingPageProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f1218] via-[#1a1f2e] to-[#0f1218]">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#0052FF] to-[#00D9FF] flex items-center justify-center glow-blue">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <span className="text-white text-xl">FinGuide</span>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => onNavigate('auth')}
              className="px-4 py-2 text-white hover:text-[#00D9FF] transition-colors"
            >
              Login
            </button>
            <button
              onClick={() => onNavigate('auth')}
              className="px-6 py-2 rounded-lg bg-gradient-to-r from-[#0052FF] to-[#00D9FF] text-white hover:shadow-lg hover:shadow-[#0052FF]/50 transition-all"
            >
              Get Started
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-light border border-[#00D9FF]/30">
                <Sparkles className="w-4 h-4 text-[#00D9FF]" />
                <span className="text-sm text-white/90">AI-Powered Financial Analysis</span>
              </div>
              <h1 className="text-white">
                Understand Your Finances <span className="bg-gradient-to-r from-[#0052FF] to-[#00D9FF] bg-clip-text text-transparent">With AI</span>
              </h1>
              <p className="text-white/70 text-lg max-w-xl">
                Upload your payslips, pension statements, and tax documents. Our AI breaks down complex financial jargon into simple, clear explanations you can actually understand.
              </p>
              <div className="flex flex-wrap gap-4 pt-4">
                <button
                  onClick={() => onNavigate('upload')}
                  className="group px-8 py-4 rounded-xl bg-gradient-to-r from-[#0052FF] to-[#00D9FF] text-white hover:shadow-2xl hover:shadow-[#0052FF]/50 transition-all flex items-center gap-2"
                >
                  <Upload className="w-5 h-5" />
                  Upload Payslip
                  <div className="w-0 group-hover:w-2 transition-all">→</div>
                </button>
                <button
                  onClick={() => onNavigate('upload')}
                  className="px-8 py-4 rounded-xl glass text-white border border-white/10 hover:border-[#00D9FF]/50 transition-all flex items-center gap-2"
                >
                  <Mail className="w-5 h-5" />
                  Connect Email
                </button>
              </div>
              <div className="flex items-center gap-6 pt-4">
                <div className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-[#00D9FF]" />
                  <span className="text-white/60 text-sm">Bank-level security</span>
                </div>
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-[#A855F7]" />
                  <span className="text-white/60 text-sm">AI-powered insights</span>
                </div>
              </div>
            </div>
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-[#0052FF]/30 to-[#A855F7]/30 rounded-3xl blur-3xl"></div>
              <div className="relative glass rounded-3xl p-8 border-2 border-white/10">
                <ImageWithFallback
                  src="https://images.unsplash.com/photo-1652212976547-16d7e2841b8c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhYnN0cmFjdCUyMHRlY2hub2xvZ3klMjBibHVlfGVufDF8fHx8MTc2NTc4NDM0NHww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral"
                  alt="AI Technology"
                  className="w-full h-96 object-cover rounded-2xl"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-white mb-4">How FinGuide Helps You</h2>
            <p className="text-white/60 text-lg">Simple, powerful tools to understand your financial documents</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: FileText,
                title: 'Upload Documents',
                description: 'Drag and drop your payslips, pension statements, or connect your email for automatic imports',
                color: '#0052FF'
              },
              {
                icon: Sparkles,
                title: 'AI Analysis',
                description: 'Our AI reads and analyzes your documents, detecting issues and explaining every detail in plain language',
                color: '#00D9FF'
              },
              {
                icon: TrendingUp,
                title: 'Clear Insights',
                description: 'Get personalized forecasts, tax breakdowns, and actionable recommendations for your financial future',
                color: '#A855F7'
              }
            ].map((feature, idx) => (
              <div key={idx} className="glass rounded-2xl p-8 hover:border-white/20 transition-all group">
                <div 
                  className="w-14 h-14 rounded-xl flex items-center justify-center mb-6 transition-all group-hover:scale-110"
                  style={{ background: `linear-gradient(135deg, ${feature.color}, ${feature.color}40)` }}
                >
                  <feature.icon className="w-7 h-7 text-white" />
                </div>
                <h4 className="text-white mb-3">{feature.title}</h4>
                <p className="text-white/60">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust Section */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto glass rounded-3xl p-12 text-center">
          <Shield className="w-16 h-16 text-[#00D9FF] mx-auto mb-6" />
          <h3 className="text-white mb-4">Your Financial Privacy Matters</h3>
          <p className="text-white/70 text-lg max-w-2xl mx-auto mb-8">
            We use bank-level encryption to protect your documents. Your data is never shared with third parties, and you can delete it anytime.
          </p>
          <div className="flex justify-center gap-8 flex-wrap">
            <div className="flex items-center gap-2 text-white/60">
              <div className="w-2 h-2 rounded-full bg-[#00D9FF]"></div>
              End-to-end encryption
            </div>
            <div className="flex items-center gap-2 text-white/60">
              <div className="w-2 h-2 rounded-full bg-[#00D9FF]"></div>
              GDPR compliant
            </div>
            <div className="flex items-center gap-2 text-white/60">
              <div className="w-2 h-2 rounded-full bg-[#00D9FF]"></div>
              Your data, your control
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-white mb-6">Ready to Understand Your Finances?</h2>
          <p className="text-white/60 text-lg mb-8">Join thousands who've gained clarity on their financial situation</p>
          <button
            onClick={() => onNavigate('upload')}
            className="px-10 py-5 rounded-xl bg-gradient-to-r from-[#0052FF] to-[#00D9FF] text-white hover:shadow-2xl hover:shadow-[#0052FF]/50 transition-all text-lg"
          >
            Get Started Free
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 py-8 px-6">
        <div className="max-w-7xl mx-auto text-center text-white/40 text-sm">
          © 2025 FinGuide. Your trusted AI financial assistant.
        </div>
      </footer>
    </div>
  );
}
