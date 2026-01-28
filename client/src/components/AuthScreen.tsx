import { Mail, Lock, Sparkles, Shield, Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';

interface AuthScreenProps {
  onNavigate: (page: string) => void;
}

export function AuthScreen({ onNavigate }: AuthScreenProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onNavigate('dashboard');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f1218] via-[#1a1f2e] to-[#0f1218] flex items-center justify-center px-6">
      <div className="w-full max-w-6xl grid lg:grid-cols-2 gap-12 items-center">
        {/* Left Side - Branding */}
        <div className="hidden lg:block space-y-8">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#0052FF] to-[#00D9FF] flex items-center justify-center glow-blue">
              <Sparkles className="w-7 h-7 text-white" />
            </div>
            <span className="text-white text-2xl">FinGuide</span>
          </div>
          <div>
            <h2 className="text-white mb-4">Your AI Financial Assistant</h2>
            <p className="text-white/60 text-lg">
              Upload documents, get instant AI-powered insights, and take control of your financial future.
            </p>
          </div>
          <div className="space-y-4">
            {[
              { icon: Sparkles, text: 'AI-powered document analysis' },
              { icon: Shield, text: 'Bank-level security & encryption' },
              { icon: Mail, text: 'Automatic email integration' }
            ].map((item, idx) => (
              <div key={idx} className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center">
                  <item.icon className="w-5 h-5 text-[#00D9FF]" />
                </div>
                <span className="text-white/70">{item.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right Side - Auth Form */}
        <div className="glass-light rounded-3xl p-8 lg:p-12 shadow-2xl">
          <div className="mb-8">
            <h3 className="text-[#1a1f2e] mb-2">
              {isLogin ? 'Welcome Back' : 'Create Account'}
            </h3>
            <p className="text-gray-600">
              {isLogin ? 'Sign in to access your financial dashboard' : 'Start your journey to financial clarity'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Email Input */}
            <div>
              <label htmlFor="email" className="block text-sm text-gray-700 mb-2">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-300 focus:border-[#0052FF] focus:outline-none focus:ring-2 focus:ring-[#0052FF]/20 transition-all"
                  required
                />
              </div>
            </div>

            {/* Password Input */}
            <div>
              <label htmlFor="password" className="block text-sm text-gray-700 mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-12 pr-12 py-3 rounded-xl border border-gray-300 focus:border-[#0052FF] focus:outline-none focus:ring-2 focus:ring-[#0052FF]/20 transition-all"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {isLogin && (
              <div className="flex justify-end">
                <button type="button" className="text-sm text-[#0052FF] hover:text-[#00D9FF]">
                  Forgot password?
                </button>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              className="w-full py-3 rounded-xl bg-gradient-to-r from-[#0052FF] to-[#00D9FF] text-white hover:shadow-lg hover:shadow-[#0052FF]/30 transition-all"
            >
              {isLogin ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          {/* OAuth Options */}
          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-white text-gray-500">Or continue with</span>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => onNavigate('dashboard')}
                className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl border border-gray-300 hover:border-[#0052FF] hover:bg-gray-50 transition-all"
              >
                <Mail className="w-5 h-5 text-gray-600" />
                <span className="text-sm text-gray-700">Gmail</span>
              </button>
              <button
                type="button"
                onClick={() => onNavigate('dashboard')}
                className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl border border-gray-300 hover:border-[#0052FF] hover:bg-gray-50 transition-all"
              >
                <Mail className="w-5 h-5 text-gray-600" />
                <span className="text-sm text-gray-700">Outlook</span>
              </button>
            </div>
          </div>

          {/* Toggle Login/Register */}
          <div className="mt-8 text-center">
            <p className="text-gray-600">
              {isLogin ? "Don't have an account?" : 'Already have an account?'}{' '}
              <button
                type="button"
                onClick={() => setIsLogin(!isLogin)}
                className="text-[#0052FF] hover:text-[#00D9FF]"
              >
                {isLogin ? 'Sign up' : 'Sign in'}
              </button>
            </p>
          </div>

          {/* Security Notice */}
          <div className="mt-8 flex items-start gap-3 p-4 rounded-xl bg-[#0052FF]/5 border border-[#0052FF]/10">
            <Shield className="w-5 h-5 text-[#0052FF] flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-gray-700">
                <span>Your data is encrypted and secure. We never share your information with third parties.</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
