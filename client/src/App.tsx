import { useState } from 'react';
import { LandingPage } from './components/LandingPage';
import { AuthScreen } from './components/AuthScreen';
import { Dashboard } from './components/Dashboard';
import { UploadScreen } from './components/UploadScreen';
import { AnalysisResults } from './components/AnalysisResults';
import { ForecastScreen } from './components/ForecastScreen';

type Page = 'landing' | 'auth' | 'dashboard' | 'upload' | 'analysis' | 'forecast';

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>('landing');

  const handleNavigate = (page: string) => {
    setCurrentPage(page as Page);
  };

  return (
    <div className="min-h-screen">
      {currentPage === 'landing' && <LandingPage onNavigate={handleNavigate} />}
      {currentPage === 'auth' && <AuthScreen onNavigate={handleNavigate} />}
      {currentPage === 'dashboard' && <Dashboard onNavigate={handleNavigate} />}
      {currentPage === 'upload' && <UploadScreen onNavigate={handleNavigate} />}
      {currentPage === 'analysis' && <AnalysisResults onNavigate={handleNavigate} />}
      {currentPage === 'forecast' && <ForecastScreen onNavigate={handleNavigate} />}
    </div>
  );
}
