import { Upload, Mail, FileText, CheckCircle, Sparkles, X } from 'lucide-react';
import { useState } from 'react';

interface UploadScreenProps {
  onNavigate: (page: string) => void;
}

export function UploadScreen({ onNavigate }: UploadScreenProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    // Simulate file upload
    setUploadedFiles(['November_Payslip.pdf']);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setUploadedFiles(['November_Payslip.pdf']);
    }
  };

  const handleAnalyze = () => {
    // Simulate processing delay
    setTimeout(() => {
      onNavigate('analysis');
    }, 500);
  };

  return (
    <div className="min-h-screen bg-[#f5f7fa]">
      {/* Navigation */}
      <nav className="bg-white border-b border-gray-200">
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
      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="text-center mb-8">
          <h2 className="text-[#1a1f2e] mb-3">Upload Your Documents</h2>
          <p className="text-gray-600 text-lg">
            Upload payslips, pension statements, or tax documents for instant AI analysis
          </p>
        </div>

        {/* Upload Area */}
        <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-200 mb-6">
          <div
            className={`border-2 border-dashed rounded-2xl p-12 text-center transition-all ${
              isDragging
                ? 'border-[#0052FF] bg-[#0052FF]/5'
                : 'border-gray-300 hover:border-[#0052FF]/50'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#0052FF]/10 to-[#00D9FF]/10 flex items-center justify-center mx-auto mb-4">
              <Upload className="w-8 h-8 text-[#0052FF]" />
            </div>
            <h4 className="text-[#1a1f2e] mb-2">Drag and drop your files here</h4>
            <p className="text-gray-500 mb-6">
              or click to browse from your computer
            </p>
            <input
              type="file"
              id="file-upload"
              className="hidden"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={handleFileSelect}
              multiple
            />
            <label
              htmlFor="file-upload"
              className="inline-block px-6 py-3 rounded-xl bg-gradient-to-r from-[#0052FF] to-[#00D9FF] text-white cursor-pointer hover:shadow-lg hover:shadow-[#0052FF]/30 transition-all"
            >
              Select Files
            </label>
            <p className="text-sm text-gray-400 mt-4">
              Supported formats: PDF, JPG, PNG (Max 10MB)
            </p>
          </div>

          {/* Uploaded Files */}
          {uploadedFiles.length > 0 && (
            <div className="mt-6 space-y-3">
              <p className="text-sm text-gray-600">Uploaded Files</p>
              {uploadedFiles.map((file, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-4 rounded-xl bg-green-50 border border-green-200"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                      <FileText className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <p className="text-[#1a1f2e]">{file}</p>
                      <p className="text-sm text-gray-500">Ready to analyze</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <button
                      onClick={() => setUploadedFiles([])}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))}
              <button
                onClick={handleAnalyze}
                className="w-full py-4 rounded-xl bg-gradient-to-r from-[#0052FF] to-[#00D9FF] text-white hover:shadow-lg hover:shadow-[#0052FF]/30 transition-all"
              >
                Analyze Documents
              </button>
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="relative my-8">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300"></div>
          </div>
          <div className="relative flex justify-center">
            <span className="px-4 bg-[#f5f7fa] text-gray-500">Or</span>
          </div>
        </div>

        {/* Email Connect Option */}
        <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-200">
          <div className="flex items-start gap-6">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#00D9FF]/10 to-[#A855F7]/10 flex items-center justify-center flex-shrink-0">
              <Mail className="w-7 h-7 text-[#00D9FF]" />
            </div>
            <div className="flex-1">
              <h4 className="text-[#1a1f2e] mb-2">Connect Your Email</h4>
              <p className="text-gray-600 mb-6">
                Automatically import payslips and financial documents from your inbox. We'll analyze them as soon as they arrive.
              </p>
              <div className="flex flex-wrap gap-4">
                <button className="px-6 py-3 rounded-xl border border-gray-300 hover:border-[#0052FF] hover:bg-gray-50 transition-all flex items-center gap-2">
                  <Mail className="w-5 h-5 text-gray-600" />
                  Connect Gmail
                </button>
                <button className="px-6 py-3 rounded-xl border border-gray-300 hover:border-[#0052FF] hover:bg-gray-50 transition-all flex items-center gap-2">
                  <Mail className="w-5 h-5 text-gray-600" />
                  Connect Outlook
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Info Cards */}
        <div className="grid md:grid-cols-3 gap-6 mt-8">
          {[
            {
              icon: Sparkles,
              title: 'AI Analysis',
              description: 'Instant breakdown of all financial details',
              color: '#0052FF'
            },
            {
              icon: CheckCircle,
              title: 'Error Detection',
              description: 'Automatic identification of discrepancies',
              color: '#00D9FF'
            },
            {
              icon: FileText,
              title: 'Plain Language',
              description: 'Complex jargon explained simply',
              color: '#A855F7'
            }
          ].map((item, idx) => (
            <div key={idx} className="text-center p-6">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3"
                style={{ background: `${item.color}15` }}
              >
                <item.icon className="w-6 h-6" style={{ color: item.color }} />
              </div>
              <h5 className="text-[#1a1f2e] mb-2">{item.title}</h5>
              <p className="text-sm text-gray-600">{item.description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
