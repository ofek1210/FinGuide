import { FileText, AlertTriangle, PiggyBank, Upload, TrendingUp, DollarSign, Calendar, Sparkles, Menu } from 'lucide-react';

interface DashboardProps {
  onNavigate: (page: string) => void;
}

export function Dashboard({ onNavigate }: DashboardProps) {
  return (
    <div className="min-h-screen bg-[#f5f7fa]">
      {/* Navigation */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#0052FF] to-[#00D9FF] flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <span className="text-[#1a1f2e] text-xl">FinGuide</span>
            </div>
            <div className="hidden md:flex items-center gap-6">
              <button className="text-[#0052FF]">Dashboard</button>
              <button 
                onClick={() => onNavigate('analysis')}
                className="text-gray-600 hover:text-[#0052FF]"
              >
                Documents
              </button>
              <button
                onClick={() => onNavigate('forecast')}
                className="text-gray-600 hover:text-[#0052FF]"
              >
                Insights
              </button>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => onNavigate('upload')}
              className="px-6 py-2 rounded-lg bg-gradient-to-r from-[#0052FF] to-[#00D9FF] text-white hover:shadow-lg hover:shadow-[#0052FF]/30 transition-all flex items-center gap-2"
            >
              <Upload className="w-4 h-4" />
              Upload
            </button>
            <button className="md:hidden p-2">
              <Menu className="w-6 h-6 text-gray-600" />
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h2 className="text-[#1a1f2e] mb-2">Welcome back, Sarah</h2>
          <p className="text-gray-600">Here's your financial overview for December 2025</p>
        </div>

        {/* Stats Cards */}
        <div className="grid md:grid-cols-4 gap-6 mb-8">
          {[
            {
              label: 'Monthly Income',
              value: '£3,450',
              change: '+5.2%',
              icon: DollarSign,
              color: '#0052FF',
              bgColor: 'bg-blue-50'
            },
            {
              label: 'Pension Balance',
              value: '£24,300',
              change: '+12.8%',
              icon: PiggyBank,
              color: '#00D9FF',
              bgColor: 'bg-cyan-50'
            },
            {
              label: 'Tax Refund Due',
              value: '£485',
              change: 'Pending',
              icon: TrendingUp,
              color: '#A855F7',
              bgColor: 'bg-purple-50'
            },
            {
              label: 'Documents',
              value: '12',
              change: '3 this month',
              icon: FileText,
              color: '#0052FF',
              bgColor: 'bg-blue-50'
            }
          ].map((stat, idx) => (
            <div key={idx} className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow border border-gray-100">
              <div className="flex items-start justify-between mb-4">
                <div className={`w-12 h-12 rounded-xl ${stat.bgColor} flex items-center justify-center`}>
                  <stat.icon className="w-6 h-6" style={{ color: stat.color }} />
                </div>
                <span className="text-sm text-gray-500">{stat.change}</span>
              </div>
              <p className="text-gray-600 text-sm mb-1">{stat.label}</p>
              <p className="text-2xl text-[#1a1f2e]">{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Main Grid */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Alerts & Issues */}
          <div className="lg:col-span-2 space-y-6">
            {/* Alert Card */}
            <div className="bg-gradient-to-r from-[#A855F7]/10 to-[#00D9FF]/10 rounded-2xl p-6 border border-[#A855F7]/20">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-[#A855F7]/20 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="w-6 h-6 text-[#A855F7]" />
                </div>
                <div className="flex-1">
                  <h4 className="text-[#1a1f2e] mb-2">Tax Discrepancy Detected</h4>
                  <p className="text-gray-600 mb-4">
                    We found a potential £485 tax overpayment in your November payslip. You may be eligible for a refund.
                  </p>
                  <button 
                    onClick={() => onNavigate('analysis')}
                    className="px-4 py-2 rounded-lg bg-white text-[#A855F7] hover:bg-gray-50 transition-colors text-sm"
                  >
                    View Details
                  </button>
                </div>
              </div>
            </div>

            {/* Recent Documents */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-6">
                <h4 className="text-[#1a1f2e]">Recent Documents</h4>
                <button 
                  onClick={() => onNavigate('analysis')}
                  className="text-sm text-[#0052FF] hover:text-[#00D9FF]"
                >
                  View All
                </button>
              </div>
              <div className="space-y-4">
                {[
                  { name: 'November Payslip', date: 'Dec 1, 2025', status: 'Issue Found', statusColor: 'text-[#A855F7] bg-purple-50' },
                  { name: 'October Payslip', date: 'Nov 1, 2025', status: 'Analyzed', statusColor: 'text-green-600 bg-green-50' },
                  { name: 'Pension Statement Q3', date: 'Oct 15, 2025', status: 'Analyzed', statusColor: 'text-green-600 bg-green-50' },
                  { name: 'September Payslip', date: 'Oct 1, 2025', status: 'Analyzed', statusColor: 'text-green-600 bg-green-50' }
                ].map((doc, idx) => (
                  <div 
                    key={idx} 
                    className="flex items-center justify-between p-4 rounded-xl hover:bg-gray-50 transition-colors cursor-pointer group"
                    onClick={() => onNavigate('analysis')}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                        <FileText className="w-5 h-5 text-[#0052FF]" />
                      </div>
                      <div>
                        <p className="text-[#1a1f2e] group-hover:text-[#0052FF] transition-colors">{doc.name}</p>
                        <p className="text-sm text-gray-500">{doc.date}</p>
                      </div>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs ${doc.statusColor}`}>
                      {doc.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Pension Overview */}
            <div className="bg-gradient-to-br from-[#0052FF] to-[#00D9FF] rounded-2xl p-6 text-white shadow-lg">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
                  <PiggyBank className="w-6 h-6 text-white" />
                </div>
                <h4>Pension Overview</h4>
              </div>
              <div className="mb-6">
                <p className="text-white/70 text-sm mb-1">Total Balance</p>
                <p className="text-3xl">£24,300</p>
              </div>
              <div className="space-y-3 mb-6">
                <div className="flex justify-between text-sm">
                  <span className="text-white/70">Monthly Contribution</span>
                  <span>£280</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-white/70">Employer Match</span>
                  <span>£420</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-white/70">Growth (YTD)</span>
                  <span>+12.8%</span>
                </div>
              </div>
              <button
                onClick={() => onNavigate('forecast')}
                className="w-full py-2 rounded-lg bg-white text-[#0052FF] hover:bg-white/90 transition-colors text-sm"
              >
                View Forecast
              </button>
            </div>

            {/* AI Insights */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="w-5 h-5 text-[#00D9FF]" />
                <h4 className="text-[#1a1f2e]">AI Insights</h4>
              </div>
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-[#00D9FF]/5 border border-[#00D9FF]/10">
                  <p className="text-sm text-gray-700">
                    Your pension contributions are <span className="text-[#00D9FF]">below optimal</span>. Consider increasing by £50/month to maximize tax benefits.
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-green-50 border border-green-100">
                  <p className="text-sm text-gray-700">
                    You're on track to reach your retirement goal of <span className="text-green-600">£500,000 by age 65</span>.
                  </p>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h4 className="text-[#1a1f2e] mb-4">Quick Actions</h4>
              <div className="space-y-2">
                <button
                  onClick={() => onNavigate('upload')}
                  className="w-full py-3 px-4 rounded-xl bg-gray-50 hover:bg-gray-100 text-left text-gray-700 transition-colors flex items-center gap-3"
                >
                  <Upload className="w-5 h-5 text-[#0052FF]" />
                  Upload Document
                </button>
                <button
                  onClick={() => onNavigate('forecast')}
                  className="w-full py-3 px-4 rounded-xl bg-gray-50 hover:bg-gray-100 text-left text-gray-700 transition-colors flex items-center gap-3"
                >
                  <Calendar className="w-5 h-5 text-[#00D9FF]" />
                  Schedule Review
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
