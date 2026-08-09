import React from 'react';
import { QrCode, Barcode, FileSpreadsheet, Sparkles } from 'lucide-react';

interface HeaderProps {
  activeTab: 'single' | 'batch';
  setActiveTab: (tab: 'single' | 'batch') => void;
}

export const Header: React.FC<HeaderProps> = ({ activeTab, setActiveTab }) => {
  const handleTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    let nextTab: 'single' | 'batch' | undefined;

    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp' || event.key === 'Home') {
      nextTab = 'single';
    } else if (event.key === 'ArrowRight' || event.key === 'ArrowDown' || event.key === 'End') {
      nextTab = 'batch';
    }

    if (!nextTab) return;

    event.preventDefault();
    setActiveTab(nextTab);
    document.getElementById(`tab-${nextTab}`)?.focus();
  };

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-3 py-3 lg:min-h-20 lg:flex-row lg:justify-between lg:items-center">
          {/* Logo & Title */}
          <div className="flex min-w-0 items-center gap-3">
            <div className="shrink-0 bg-indigo-600 p-2 rounded-xl text-white shadow-md shadow-indigo-100 flex gap-1" aria-hidden="true">
              <QrCode className="w-5 h-5" />
              <Barcode className="hidden min-[360px]:block w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg leading-tight font-bold text-slate-900 sm:flex sm:items-center sm:gap-2">
                <span className="sm:hidden">二维码 / 条码生成器</span>
                <span className="hidden sm:inline">批量二维码 / 条形码生成器</span>
                <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-100 whitespace-nowrap">
                  <Sparkles className="w-3 h-3 mr-1" />
                  Excel 嵌入版
                </span>
              </h1>
              <p className="mt-1 text-xs leading-4 text-slate-600 sm:hidden">单张生成 · Excel 批量处理</p>
              <p className="hidden sm:block mt-1 text-xs text-slate-600">双引擎：支持一维条码（CODE128 / EAN13 等）、二维码排版与 Excel 插入</p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav
            className="grid w-full grid-cols-2 bg-slate-100 p-1 rounded-xl border border-slate-200 lg:w-auto lg:min-w-[326px]"
            role="tablist"
            aria-label="生成方式"
          >
            <button
              id="tab-single"
              type="button"
              role="tab"
              aria-selected={activeTab === 'single'}
              aria-controls="panel-single"
              tabIndex={activeTab === 'single' ? 0 : -1}
              onClick={() => setActiveTab('single')}
              onKeyDown={handleTabKeyDown}
              className={`min-h-11 flex items-center justify-center gap-2 px-3 sm:px-4 text-sm font-medium rounded-lg transition-[color,background-color,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1 motion-reduce:transition-none ${
                activeTab === 'single'
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <QrCode className="w-4 h-4" />
              单张生成
            </button>
            <button
              id="tab-batch"
              type="button"
              role="tab"
              aria-selected={activeTab === 'batch'}
              aria-controls="panel-batch"
              tabIndex={activeTab === 'batch' ? 0 : -1}
              onClick={() => setActiveTab('batch')}
              onKeyDown={handleTabKeyDown}
              className={`min-h-11 flex items-center justify-center gap-2 px-3 sm:px-4 text-sm font-medium rounded-lg transition-[color,background-color,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1 motion-reduce:transition-none ${
                activeTab === 'batch'
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span className="sm:hidden">Excel 批量</span>
              <span className="hidden sm:inline">Excel 批量导入导出</span>
            </button>
          </nav>
        </div>
      </div>
    </header>
  );
};
