import { FileText, AlertTriangle, CheckCircle, Sparkles, TrendingUp, DollarSign, Calendar, Info } from 'lucide-react';

interface AnalysisResultsProps {
  onNavigate: (page: string) => void;
}

export function AnalysisResults({ onNavigate }: AnalysisResultsProps) {
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
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center">
              <FileText className="w-6 h-6 text-[#0052FF]" />
            </div>
            <div>
              <h2 className="text-[#1a1f2e]">November Payslip Analysis</h2>
              <p className="text-gray-500">Analyzed on December 1, 2025</p>
            </div>
          </div>
        </div>

        {/* Alert Banner */}
        <div className="bg-gradient-to-r from-[#A855F7]/10 to-[#00D9FF]/10 rounded-2xl p-6 border-2 border-[#A855F7]/30 mb-8">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-[#A855F7]/20 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-6 h-6 text-[#A855F7]" />
            </div>
            <div className="flex-1">
              <h4 className="text-[#1a1f2e] mb-2">Tax Discrepancy Detected</h4>
              <p className="text-gray-700 mb-4">
                We found that you've been overtaxed by <span className="text-[#A855F7]">£485 this month</span>. This appears to be due to an incorrect tax code. You're eligible for a refund.
              </p>
              <div className="flex flex-wrap gap-3">
                <button className="px-4 py-2 rounded-lg bg-[#A855F7] text-white hover:bg-[#A855F7]/90 transition-colors text-sm">
                  Request Refund Guide
                </button>
                <button className="px-4 py-2 rounded-lg bg-white text-[#A855F7] hover:bg-gray-50 transition-colors text-sm">
                  Explain Tax Code
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Main Grid */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left Column - Detailed Breakdown */}
          <div className="lg:col-span-2 space-y-6">
            {/* Payslip Overview */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h4 className="text-[#1a1f2e] mb-6">Payslip Breakdown</h4>
              <div className="space-y-4">
                {[
                  { label: 'Gross Pay', value: '£4,200.00', description: 'Your total earnings before any deductions', icon: DollarSign, iconBg: 'bg-blue-50', iconColor: 'text-[#0052FF]' },
                  { label: 'Income Tax', value: '£1,085.00', description: 'Tax deducted under code 1257L (this seems high)', icon: TrendingUp, iconBg: 'bg-purple-50', iconColor: 'text-[#A855F7]', alert: true },
                  { label: 'National Insurance', value: '£385.00', description: 'Your NI contribution (correct rate applied)', icon: CheckCircle, iconBg: 'bg-green-50', iconColor: 'text-green-600' },
                  { label: 'Pension Contribution', value: '£280.00', description: '5% of your gross pay (you could contribute more for tax benefits)', icon: Info, iconBg: 'bg-cyan-50', iconColor: 'text-[#00D9FF]' }
                ].map((item, idx) => (
                  <div key={idx} className={`p-4 rounded-xl ${item.alert ? 'bg-purple-50 border border-[#A855F7]/20' : 'bg-gray-50'}`}>
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg ${item.iconBg} flex items-center justify-center`}>
                          <item.icon className={`w-5 h-5 ${item.iconColor}`} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-[#1a1f2e]">{item.label}</p>
                            {item.alert && <AlertTriangle className="w-4 h-4 text-[#A855F7]" />}
                          </div>
                          <p className="text-sm text-gray-500">{item.description}</p>
                        </div>
                      </div>
                      <p className={`text-lg ${item.alert ? 'text-[#A855F7]' : 'text-[#1a1f2e]'}`}>{item.value}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-6 pt-6 border-t border-gray-200">
                <div className="flex items-center justify-between">
                  <p className="text-[#1a1f2e]">Net Pay</p>
                  <p className="text-2xl text-[#0052FF]">£2,450.00</p>
                </div>
              </div>
            </div>

            {/* Tax Details */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h4 className="text-[#1a1f2e] mb-4">Tax Analysis</h4>
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-[#A855F7]/5 border border-[#A855F7]/20">
                  <div className="flex items-start gap-3 mb-3">
                    <Sparkles className="w-5 h-5 text-[#A855F7] flex-shrink-0 mt-1" />
                    <div>
                      <p className="text-[#1a1f2e] mb-1">AI Explanation</p>
                      <p className="text-gray-700 text-sm leading-relaxed">
                        Your tax code 1257L should give you a personal allowance of £12,570 per year (£1,047.50 per month) tax-free. However, you were taxed on your full gross pay this month, suggesting the code wasn't applied correctly by your employer.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-gray-50">
                    <p className="text-sm text-gray-600 mb-1">Expected Tax</p>
                    <p className="text-2xl text-[#1a1f2e]">£600.00</p>
                    <p className="text-xs text-gray-500 mt-1">Based on your tax code</p>
                  </div>
                  <div className="p-4 rounded-xl bg-purple-50">
                    <p className="text-sm text-gray-600 mb-1">Actual Tax Paid</p>
                    <p className="text-2xl text-[#A855F7]">£1,085.00</p>
                    <p className="text-xs text-[#A855F7] mt-1">£485 overpaid</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Pension Details */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h4 className="text-[#1a1f2e] mb-4">Pension Contribution</h4>
              <div className="space-y-4">
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="p-4 rounded-xl bg-cyan-50">
                    <p className="text-sm text-gray-600 mb-1">Your Contribution</p>
                    <p className="text-xl text-[#00D9FF]">£280</p>
                    <p className="text-xs text-gray-500 mt-1">5% of gross pay</p>
                  </div>
                  <div className="p-4 rounded-xl bg-blue-50">
                    <p className="text-sm text-gray-600 mb-1">Employer Match</p>
                    <p className="text-xl text-[#0052FF]">£420</p>
                    <p className="text-xs text-gray-500 mt-1">7.5% of gross pay</p>
                  </div>
                  <div className="p-4 rounded-xl bg-green-50">
                    <p className="text-sm text-gray-600 mb-1">Tax Relief</p>
                    <p className="text-xl text-green-600">£56</p>
                    <p className="text-xs text-gray-500 mt-1">20% tax relief</p>
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-[#00D9FF]/5 border border-[#00D9FF]/20">
                  <div className="flex items-start gap-3">
                    <Info className="w-5 h-5 text-[#00D9FF] flex-shrink-0 mt-1" />
                    <div>
                      <p className="text-[#1a1f2e] mb-1 text-sm">Optimization Tip</p>
                      <p className="text-gray-700 text-sm">
                        Consider increasing your contribution to 8% (£336/month). You'll get an extra £56 tax relief, and your employer might match the increase depending on your contract.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - AI Assistant & Actions */}
          <div className="space-y-6">
            {/* AI Assistant */}
            <div className="bg-gradient-to-br from-[#0052FF] to-[#00D9FF] rounded-2xl p-6 text-white shadow-lg">
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="w-6 h-6" />
                <h4>AI Assistant</h4>
              </div>
              <p className="text-white/90 text-sm mb-4">
                I've analyzed your November payslip and found a tax issue. Would you like me to:
              </p>
              <div className="space-y-2">
                <button className="w-full py-2 px-4 rounded-lg bg-white/20 hover:bg-white/30 transition-colors text-left text-sm">
                  Explain how to claim your refund
                </button>
                <button className="w-full py-2 px-4 rounded-lg bg-white/20 hover:bg-white/30 transition-colors text-left text-sm">
                  Contact your HR department
                </button>
                <button className="w-full py-2 px-4 rounded-lg bg-white/20 hover:bg-white/30 transition-colors text-left text-sm">
                  Show tax code explanation
                </button>
              </div>
            </div>

            {/* Summary Card */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h4 className="text-[#1a1f2e] mb-4">Summary</h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <span className="text-sm text-gray-600">Status</span>
                  <span className="text-sm text-[#A855F7]">Issue Found</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <span className="text-sm text-gray-600">Document Type</span>
                  <span className="text-sm text-[#1a1f2e]">Payslip</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <span className="text-sm text-gray-600">Period</span>
                  <span className="text-sm text-[#1a1f2e]">November 2025</span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm text-gray-600">Analyzed</span>
                  <span className="text-sm text-[#1a1f2e]">Dec 1, 2025</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h4 className="text-[#1a1f2e] mb-4">Actions</h4>
              <div className="space-y-2">
                <button
                  onClick={() => onNavigate('forecast')}
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-[#0052FF] to-[#00D9FF] text-white hover:shadow-lg hover:shadow-[#0052FF]/30 transition-all text-sm"
                >
                  View Forecast
                </button>
                <button className="w-full py-3 px-4 rounded-xl bg-gray-100 hover:bg-gray-200 text-[#1a1f2e] transition-colors text-sm">
                  Download Report
                </button>
                <button className="w-full py-3 px-4 rounded-xl bg-gray-100 hover:bg-gray-200 text-[#1a1f2e] transition-colors text-sm">
                  Share with Accountant
                </button>
              </div>
            </div>

            {/* Related Documents */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h4 className="text-[#1a1f2e] mb-4">Related</h4>
              <div className="space-y-2">
                {['October Payslip', 'September Payslip'].map((doc, idx) => (
                  <button
                    key={idx}
                    className="w-full p-3 rounded-xl hover:bg-gray-50 transition-colors text-left flex items-center gap-3"
                  >
                    <FileText className="w-5 h-5 text-[#0052FF]" />
                    <span className="text-sm text-gray-700">{doc}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
