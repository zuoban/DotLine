import { lazy, Suspense, useState } from 'react';
import { Header } from './components/Header';
import { ConfigPanel } from './components/ConfigPanel';
import { SingleQrTab } from './components/SingleQrTab';
import { defaultConfig, QrConfig } from './types';

const BatchExcelTab = lazy(() =>
  import('./components/BatchExcelTab').then(({ BatchExcelTab: Component }) => ({
    default: Component,
  })),
);

function BatchTabLoading() {
  return (
    <div
      className="min-h-64 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
      role="status"
      aria-live="polite"
      aria-label="正在加载 Excel 批量工具"
    >
      <div className="motion-safe:animate-pulse space-y-4 motion-reduce:animate-none" aria-hidden="true">
        <div className="h-5 w-44 rounded bg-slate-200" />
        <div className="h-24 rounded-xl bg-slate-100" />
        <div className="h-11 w-36 rounded-xl bg-slate-200" />
      </div>
      <span className="sr-only">正在加载 Excel 批量工具，请稍候。</span>
    </div>
  );
}

export function App() {
  const [activeTab, setActiveTab] = useState<'single' | 'batch'>('single');
  const [config, setConfig] = useState<QrConfig>(defaultConfig);

  return (
    <div className="min-h-screen bg-slate-50/70 flex flex-col">
      <Header activeTab={activeTab} setActiveTab={setActiveTab} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
          {/* 核心任务在 DOM 中优先，移动端与辅助技术会先读取；桌面端通过网格顺序显示在右侧。 */}
          <section className="order-1 lg:order-2 lg:col-span-8" aria-label="码图生成工作区">
            {activeTab === 'single' ? (
              <div id="panel-single" role="tabpanel" aria-labelledby="tab-single" tabIndex={0}>
                <SingleQrTab config={config} />
              </div>
            ) : (
              <div id="panel-batch" role="tabpanel" aria-labelledby="tab-batch" tabIndex={0}>
                <Suspense fallback={<BatchTabLoading />}>
                  <BatchExcelTab config={config} />
                </Suspense>
              </div>
            )}
          </section>

          {/* 桌面端左侧公共样式配置面板 (占据 4 列) */}
          <aside className="order-2 lg:order-1 lg:col-span-4 lg:sticky lg:top-24" aria-label="生成样式设置">
            <ConfigPanel config={config} onChange={setConfig} />
          </aside>
        </div>
      </main>

      {/* 页脚说明 */}
      <footer className="bg-white border-t border-slate-200 px-4 py-6 mt-12 text-center text-xs text-slate-500">
        DotLine 二维码 / 条形码生成器 &copy; {new Date().getFullYear()} — 纯前端合成与 Excel 码图嵌入
      </footer>
    </div>
  );
}

export default App;
