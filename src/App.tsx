import { ErrorBoundary } from './components/ErrorBoundary';
import { Canvas } from './components/Canvas';
import { Sidebar } from './components/Sidebar';
import { ToastContainer } from './components/ui';
import { MobileToolbar, GestureHints } from './components/Mobile';
import './App.css';

export const App: React.FC = () => {
  return (
    <div className="app">
      <Sidebar />
      <main className="main">
        <ErrorBoundary>
          <Canvas />
        </ErrorBoundary>
      </main>
      <ToastContainer />
      {/* Mobile-only components */}
      <MobileToolbar />
      <GestureHints />
    </div>
  );
};
