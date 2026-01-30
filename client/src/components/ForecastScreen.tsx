import { TrendingUp, Sparkles, PiggyBank, DollarSign, Calendar, Sliders } from 'lucide-react';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useState } from 'react';

interface ForecastScreenProps {
  onNavigate: (page: string) => void;
}

export function ForecastScreen({ onNavigate }: ForecastScreenProps) {
  const [monthlyContribution, setMonthlyContribution] = useState(280);
  const [retirementAge, setRetirementAge] = useState(65);

  // Mock data for pension growth
  const forecastData = [
    { year: '2025', value: 24300, projected: 24300 },
    { year: '2030', value: 45000, projected: 48000 },
    { year: '2035', value: 75000, projected: 82000 },
    { year: '2040', value: 115000, projected: 128000 },
    { year: '2045', value: 165000, projected: 186000 },
    { year: '2050', value: 230000, projected: 260000 },
    { year: '2055', value: 315000, projected: 358000 },
    { year: '2060', value: 420000, projected: 480000 },
    { year: '2065', value: 550000, projected: 630000 }
  ];

  const contributionImpactData = [
    { contribution: '200', total: 420000 },
    { contribution: '250', total: 485000 },
    { contribution: '280', total: 550000 },
    { contribution: '350', total: 640000 },
    { contribution: '400', total: 710000 },
    { contribution: '500', total: 850000 }
  ];

  const calculateProjectedValue = () => {
    const baseValue = 550000;
    const contributionMultiplier = monthlyContribution / 280;
    const ageMultiplier = (65 - retirementAge + 65) / 65;
    return Math.round(baseValue * contributionMultiplier * ageMultiplier);
  };

  return (
    <div className="min-h-screen bg-[#f5f7fa]">
      {/* Navigation */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#0052FF] to-[#00D9FF] flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <span className="text-[#1a1f2e] text-xl">FinGuide</span>
          </div>
          <button
            onClick={() => onNavigate('dashboard')}
            className="text-gray-600 hover:text-[#0052FF]"
          >
            ← Back to Dashboard
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <h2 className="text-[#1a1f2e] mb-2">Pension Forecast & Insights</h2>
          <p className="text-gray-600">Plan your retirement with AI-powered projections</p>
        </div>

        {/* Top Stats */}
        <div className="grid md:grid-cols-4 gap-6 mb-8">
          {[
            { label: 'Current Balance', value: '£24,300', icon: PiggyBank, color: '#0052FF', bg: 'bg-blue-50' },
            { label: 'Monthly Growth', value: '£700', icon: TrendingUp, color: '#00D9FF', bg: 'bg-cyan-50' },
            { label: 'Projected at 65', value: `£${(calculateProjectedValue() / 1000).toFixed(0)}k`, icon: Calendar, color: '#A855F7', bg: 'bg-purple-50' },
            { label: 'Years to Retirement', value: '33', icon: Calendar, color: '#0052FF', bg: 'bg-blue-50' }
          ].map((stat, idx) => (
            <div key={idx} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <div className={`w-10 h-10 rounded-lg ${stat.bg} flex items-center justify-center mb-3`}>
                <stat.icon className="w-5 h-5" style={{ color: stat.color }} />
              </div>
              <p className="text-sm text-gray-600 mb-1">{stat.label}</p>
              <p className="text-2xl text-[#1a1f2e]">{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Main Grid */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left Column - Charts */}
          <div className="lg:col-span-2 space-y-6">
            {/* Pension Growth Forecast */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h4 className="text-[#1a1f2e] mb-1">Pension Growth Forecast</h4>
                  <p className="text-sm text-gray-500">Projected balance over time</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-[#0052FF]"></div>
                    <span className="text-sm text-gray-600">Current Path</span>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <div className="w-3 h-3 rounded-full bg-[#00D9FF]"></div>
                    <span className="text-sm text-gray-600">Optimized</span>
                  </div>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={forecastData}>
                  <defs>
                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0052FF" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#0052FF" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorProjected" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#00D9FF" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#00D9FF" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="year" stroke="#9ca3af" />
                  <YAxis stroke="#9ca3af" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'white', 
                      border: '1px solid #e5e7eb', 
                      borderRadius: '12px',
                      padding: '12px'
                    }}
                    formatter={(value: number) => `£${value.toLocaleString()}`}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="value" 
                    stroke="#0052FF" 
                    strokeWidth={2}
                    fillOpacity={1} 
                    fill="url(#colorValue)" 
                  />
                  <Area 
                    type="monotone" 
                    dataKey="projected" 
                    stroke="#00D9FF" 
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    fillOpacity={1} 
                    fill="url(#colorProjected)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Contribution Impact */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <div className="mb-6">
                <h4 className="text-[#1a1f2e] mb-1">Impact of Monthly Contributions</h4>
                <p className="text-sm text-gray-500">How different contribution levels affect your retirement balance</p>
              </div>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={contributionImpactData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis 
                    dataKey="contribution" 
                    stroke="#9ca3af"
                    label={{ value: 'Monthly Contribution (£)', position: 'insideBottom', offset: -5 }}
                  />
                  <YAxis 
                    stroke="#9ca3af"
                    tickFormatter={(value) => `£${(value / 1000).toFixed(0)}k`}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'white', 
                      border: '1px solid #e5e7eb', 
                      borderRadius: '12px',
                      padding: '12px'
                    }}
                    formatter={(value: number) => `£${value.toLocaleString()}`}
                    labelFormatter={(label) => `£${label}/month`}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="total" 
                    stroke="#A855F7" 
                    strokeWidth={3}
                    dot={{ fill: '#A855F7', r: 5 }}
                    activeDot={{ r: 7 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Insights Cards */}
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-gradient-to-br from-[#0052FF]/10 to-[#00D9FF]/10 rounded-2xl p-6 border border-[#0052FF]/20">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp className="w-5 h-5 text-[#0052FF]" />
                  <h5 className="text-[#1a1f2e]">Growth Rate</h5>
                </div>
                <p className="text-2xl text-[#1a1f2e] mb-2">7.2% p.a.</p>
                <p className="text-sm text-gray-600">Based on your current investment mix and historical performance</p>
              </div>
              <div className="bg-gradient-to-br from-[#A855F7]/10 to-[#00D9FF]/10 rounded-2xl p-6 border border-[#A855F7]/20">
                <div className="flex items-center gap-2 mb-3">
                  <DollarSign className="w-5 h-5 text-[#A855F7]" />
                  <h5 className="text-[#1a1f2e]">Tax Benefits</h5>
                </div>
                <p className="text-2xl text-[#1a1f2e] mb-2">£672/year</p>
                <p className="text-sm text-gray-600">Tax relief on your current pension contributions</p>
              </div>
            </div>
          </div>

          {/* Right Column - Interactive Controls */}
          <div className="space-y-6">
            {/* Simulator Card */}
            <div className="bg-gradient-to-br from-[#0052FF] to-[#00D9FF] rounded-2xl p-6 text-white shadow-lg">
              <div className="flex items-center gap-2 mb-4">
                <Sliders className="w-6 h-6" />
                <h4>Retirement Simulator</h4>
              </div>
              <p className="text-white/90 text-sm mb-6">
                Adjust your contributions and retirement age to see how it impacts your pension
              </p>
              
              {/* Monthly Contribution Slider */}
              <div className="mb-6">
                <div className="flex justify-between mb-2">
                  <label className="text-sm text-white/90">Monthly Contribution</label>
                  <span className="text-sm">£{monthlyContribution}</span>
                </div>
                <input
                  type="range"
                  min="100"
                  max="1000"
                  step="50"
                  value={monthlyContribution}
                  onChange={(e) => setMonthlyContribution(Number(e.target.value))}
                  className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer slider"
                />
                <div className="flex justify-between text-xs text-white/70 mt-1">
                  <span>£100</span>
                  <span>£1,000</span>
                </div>
              </div>

              {/* Retirement Age Slider */}
              <div className="mb-6">
                <div className="flex justify-between mb-2">
                  <label className="text-sm text-white/90">Retirement Age</label>
                  <span className="text-sm">{retirementAge}</span>
                </div>
                <input
                  type="range"
                  min="55"
                  max="70"
                  step="1"
                  value={retirementAge}
                  onChange={(e) => setRetirementAge(Number(e.target.value))}
                  className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer slider"
                />
                <div className="flex justify-between text-xs text-white/70 mt-1">
                  <span>55</span>
                  <span>70</span>
                </div>
              </div>

              {/* Projected Result */}
              <div className="pt-4 border-t border-white/20">
                <p className="text-sm text-white/90 mb-2">Projected Pension Value</p>
                <p className="text-3xl mb-1">£{calculateProjectedValue().toLocaleString()}</p>
                <p className="text-xs text-white/70">at age {retirementAge}</p>
              </div>
            </div>

            {/* AI Recommendations */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="w-5 h-5 text-[#00D9FF]" />
                <h4 className="text-[#1a1f2e]">AI Recommendations</h4>
              </div>
              <div className="space-y-3">
                <div className="p-4 rounded-xl bg-[#00D9FF]/5 border border-[#00D9FF]/20">
                  <p className="text-sm text-[#1a1f2e] mb-1">Increase Contributions</p>
                  <p className="text-xs text-gray-600">
                    Adding £50/month would increase your retirement balance by £85,000
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-green-50 border border-green-200">
                  <p className="text-sm text-[#1a1f2e] mb-1">On Track</p>
                  <p className="text-xs text-gray-600">
                    You're projected to meet your £500k retirement goal
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-purple-50 border border-[#A855F7]/20">
                  <p className="text-sm text-[#1a1f2e] mb-1">Tax Optimization</p>
                  <p className="text-xs text-gray-600">
                    You could save an extra £280/year in tax by maximizing contributions
                  </p>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h4 className="text-[#1a1f2e] mb-4">Quick Actions</h4>
              <div className="space-y-2">
                <button className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-[#0052FF] to-[#00D9FF] text-white hover:shadow-lg hover:shadow-[#0052FF]/30 transition-all text-sm">
                  Adjust Contribution
                </button>
                <button className="w-full py-3 px-4 rounded-xl bg-gray-100 hover:bg-gray-200 text-[#1a1f2e] transition-colors text-sm">
                  Download Forecast
                </button>
                <button className="w-full py-3 px-4 rounded-xl bg-gray-100 hover:bg-gray-200 text-[#1a1f2e] transition-colors text-sm">
                  Schedule Review
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          width: 20px;
          height: 20px;
          background: white;
          border-radius: 50%;
          cursor: pointer;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
        }
        .slider::-moz-range-thumb {
          width: 20px;
          height: 20px;
          background: white;
          border-radius: 50%;
          cursor: pointer;
          border: none;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
        }
      `}</style>
    </div>
  );
}
