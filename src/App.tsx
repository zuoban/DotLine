import { useState } from 'react';
import { Header } from './components/Header';
import { ConfigPanel } from './components/ConfigPanel';
import { SingleQrTab } from './components/SingleQrTab';
import { BatchExcelTab } from './components/BatchExcelTab';
import { defaultConfig, QrConfig } from './types';

export function App() {
  const [activeTab, setActiveTab] = useState<'single' | 'batch'>('single');
  const [config, setConfig] = useState<QrConfig>(defaultConfig);

  return (
    <div className="min-h-screen bg-slate-50/70 flex flex-col">
      <Header activeTab={activeTab} setActiveTab={setActiveTab} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* 左侧公共样式配置面板 (占据 4 列) */}
          <div className="lg:col-span-4 sticky top-24">
            <ConfigPanel config={config} onChange={setConfig} />
          </div>

          {/* 右侧核心工作区 (占据 8 列) */}
          <div className="lg:col-span-8">
            {activeTab === 'single' ? (
              <SingleQrTab config={config} />
            ) : (
              <BatchExcelTab config={config} />
            )}
          </div>
        </div>
      </main>

      {/* 页脚说明 */}
      <footer className="bg-white border-t border-slate-200 py-6 mt-12 text-center text-xs text-slate-400">
        DotLine 批量二维码生成器 &copy; {new Date().getFullYear()} — 高性能纯前端合成与 Excel 二维码嵌入
      </footer>
    </div>
  );
}

export default App;
