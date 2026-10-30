/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Server,
  X,
  CheckCircle,
  AlertCircle,
  Zap,
  RefreshCw,
  Globe,
  Sliders,
  ShieldCheck,
  Key,
  Eye,
  EyeOff,
  Layers,
  ArrowRight,
  Info,
} from 'lucide-react';
import { ProxyConfig } from '../types/maddahi';
import { AppTheme } from '../types/theme';
import { getApiBase, setApiBase, isNativeApp } from '../utils/api';

export const PROXY_STORAGE_KEY = 'tanin_maddahi_proxy_config';

export const DEFAULT_PROXY_CONFIG: ProxyConfig = {
  enabled: false,
  baseUrl: '',
  apiKey: '',
  modelName: 'gemini-2.5-flash',
  endpointType: 'auto',
};

interface ProxySettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (config: ProxyConfig) => void;
  currentConfig?: ProxyConfig;
  theme?: AppTheme;
}

export const ProxySettingsModal: React.FC<ProxySettingsModalProps> = ({
  isOpen,
  onClose,
  onSave,
  currentConfig,
  theme = 'soft-green',
}) => {
  const [enabled, setEnabled] = useState<boolean>(currentConfig?.enabled || false);
  const [baseUrl, setBaseUrl] = useState<string>(currentConfig?.baseUrl || '');
  const [apiKey, setApiKey] = useState<string>(currentConfig?.apiKey || '');
  const [showApiKey, setShowApiKey] = useState<boolean>(false);
  const [modelName, setModelName] = useState<string>(currentConfig?.modelName || 'gemini-2.5-flash');
  const [endpointType, setEndpointType] = useState<'auto' | 'chat' | 'audio_transcriptions'>(
    currentConfig?.endpointType || 'auto'
  );

  const [appServerUrl, setAppServerUrl] = useState<string>(() => getApiBase());
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    latency?: number;
    modelsList?: string[];
  } | null>(null);

  const isGreen = theme === 'soft-green';

  useEffect(() => {
    if (isOpen) {
      setEnabled(currentConfig?.enabled || false);
      setBaseUrl(currentConfig?.baseUrl || '');
      setApiKey(currentConfig?.apiKey || '');
      setModelName(currentConfig?.modelName || 'gemini-2.5-flash');
      setEndpointType(currentConfig?.endpointType || 'auto');
      setAppServerUrl(getApiBase());
      setTestResult(null);
    }
  }, [isOpen, currentConfig]);

  if (!isOpen) return null;

  const handleTestConnection = async () => {
    if (!baseUrl.trim()) {
      setTestResult({
        success: false,
        message: 'لطفاً ابتدا آدرس سرور واسط (Endpoint URL) را وارد کنید.',
      });
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    const startTime = Date.now();
    try {
      const response = await fetch(`${appServerUrl.trim().replace(/\/+$/, '') || getApiBase()}/api/proxy/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseUrl: baseUrl.trim(),
          apiKey: apiKey.trim(),
          modelName: modelName.trim() || 'gemini-2.5-flash',
          endpointType,
        }),
      });

      const data = await response.json();
      const latency = Date.now() - startTime;

      if (data.success) {
        setTestResult({
          success: true,
          message: data.message || `ارتباط با سرور واسط با موفقیت برقرار شد. مدل آماده پردازش و تبدیل سریع است.`,
          latency: data.latency || latency,
          modelsList: data.modelsList || [],
        });
      } else {
        setTestResult({
          success: false,
          message: data.error || 'ارتباط با سرور واسط ناموفق بود. لطفاً آدرس یا توکن را بررسی کنید.',
        });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: `خطای شبکه: ${err.message || 'عدم دسترسی به آدرس سرور واسط'}`,
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = () => {
    setApiBase(appServerUrl);
    onSave({
      enabled,
      baseUrl: baseUrl.trim(),
      apiKey: apiKey.trim(),
      modelName: modelName.trim() || 'gemini-2.5-flash',
      endpointType,
    });
    onClose();
  };

  const handleReset = () => {
    setEnabled(false);
    setBaseUrl('');
    setApiKey('');
    setModelName('gemini-2.5-flash');
    setEndpointType('auto');
    setTestResult(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 select-none">
      <div
        className={`relative w-full max-w-xl rounded-2xl border p-4 sm:p-6 text-stone-100 flex flex-col max-h-[92vh] overflow-y-auto ${
          isGreen
            ? 'bg-[#101813] border-[#223828]'
            : 'bg-[#181010] border-[#382222]'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-stone-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                isGreen
                  ? 'bg-[#183321] text-emerald-300'
                  : 'bg-[#331818] text-red-300'
              }`}
            >
              <Server className="w-5 h-5 fill-current" />
            </div>
            <div>
              <h3
                className={`text-base sm:text-lg font-bold flex items-center gap-2 ${
                  isGreen ? 'text-emerald-200' : 'text-red-200'
                }`}
              >
                <span>تنظیم سرور واسط اختصاصی</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-stone-900 border border-stone-800 text-stone-300 font-mono">
                  OpenAI Architecture
                </span>
              </h3>
              <p className="text-[11px] sm:text-xs text-stone-400">
                اتصال مستقیم به سرور واسط شما (مانند One-API، LiteLLM یا پراکسی معکوس مدل‌های گوگل)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="p-1.5 rounded-lg hover:bg-stone-800 text-stone-400 hover:text-stone-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Form */}
        <div className="py-4 space-y-4">
          {/* آدرس سرور برنامه (برای نسخهٔ اندروید که سرور داخلی ندارد) */}
          <div className="p-3.5 rounded-xl border bg-stone-950 border-stone-800">
            <label className="block text-xs font-semibold text-stone-300 mb-1">
              آدرس سرور برنامه {isNativeApp() ? '(لازم برای استخراج هوشمند و گوگل درایو)' : '(اختیاری)'}
            </label>
            <input
              type="url"
              dir="ltr"
              value={appServerUrl}
              onChange={(e) => setAppServerUrl(e.target.value)}
              placeholder="https://your-app.run.app"
              className="w-full px-3 py-2 rounded-xl border bg-stone-900 border-stone-800 text-xs text-stone-100 placeholder-stone-600 focus:outline-none focus:border-stone-600 font-mono"
            />
            <p className="text-[11px] text-stone-500 mt-1.5 leading-relaxed">
              نسخهٔ اندروید سرور داخلی ندارد. برای استخراج متن با هوش مصنوعی و همگام‌سازی گوگل درایو،
              آدرس نسخهٔ آنلاین برنامه (همان سروری که server.ts روی آن اجرا می‌شود) را وارد کنید. اگر خالی
              باشد، بقیهٔ امکانات (پخش، متن، انتخاب صوت، یادداشت) بدون اینترنت کار می‌کنند.
            </p>
          </div>

          {/* Toggle: Enable / Disable custom proxy */}
          <div
            className={`p-3.5 rounded-xl border flex items-center justify-between transition-colors ${
              enabled
                ? isGreen
                  ? 'bg-[#14301d] border-[#225732]'
                  : 'bg-[#301414] border-[#572222]'
                : 'bg-stone-950 border-stone-800'
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                  enabled
                    ? isGreen
                      ? 'bg-emerald-500 text-stone-950'
                      : 'bg-red-500 text-stone-100'
                    : 'bg-stone-900 text-stone-400'
                }`}
              >
                <Zap className="w-5 h-5 fill-current" />
              </div>
              <div>
                <p className="text-xs sm:text-sm font-bold text-stone-100">
                  استفاده از سرور واسط من برای تبدیل و استخراج صوت
                </p>
                <p className="text-[11px] text-stone-400">
                  {enabled
                    ? 'فعال: درخواست‌های استخراج صوت و همگامی اول به سرور شما ارسال می‌شوند'
                    : 'غیرفعال: استفاده مستقیم از سرویس پیش‌فرض داخلی برنامه'}
                </p>
              </div>
            </div>

            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div
                className={`w-11 h-6 bg-stone-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all ${
                  isGreen
                    ? 'peer-checked:bg-emerald-600'
                    : 'peer-checked:bg-red-600'
                }`}
              />
            </label>
          </div>

          {/* Base URL Input */}
          <div>
            <label className="block text-xs font-semibold text-stone-300 mb-1 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-stone-400" />
                <span>آدرس پایه سرور واسط (Base URL)</span>
              </span>
              <span className="text-[10px] text-stone-500 font-mono">OpenAI Compatible</span>
            </label>
            <input
              type="text"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://api.your-proxy-domain.com/v1"
              dir="ltr"
              className={`w-full px-3.5 py-2.5 rounded-xl bg-stone-950 border text-xs sm:text-sm text-stone-100 placeholder-stone-600 font-mono text-left focus:outline-none ${
                isGreen
                  ? 'border-stone-800 focus:border-emerald-500'
                  : 'border-stone-800 focus:border-red-500'
              }`}
            />
          </div>

          {/* API Key / Bearer Token */}
          <div>
            <label className="block text-xs font-semibold text-stone-300 mb-1 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-stone-400" />
                <span>کلید دسترسی سرور واسط (API Key / Bearer Token)</span>
              </span>
              <span className="text-[10px] text-stone-500">اختیاری</span>
            </label>
            <div className="relative">
              <input
                type={showApiKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-..."
                dir="ltr"
                className={`w-full px-3.5 py-2.5 pl-10 rounded-xl bg-stone-950 border text-xs sm:text-sm text-stone-100 placeholder-stone-600 font-mono text-left focus:outline-none ${
                  isGreen
                    ? 'border-stone-800 focus:border-emerald-500'
                    : 'border-stone-800 focus:border-red-500'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-500 hover:text-stone-300 transition-colors cursor-pointer"
                title={showApiKey ? 'مخفی کردن کلید' : 'نمایش کلید'}
              >
                {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Model Name Input & Quick Chips */}
          <div>
            <label className="block text-xs font-semibold text-stone-300 mb-1 flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-stone-400" />
              <span>نام مدل در سرور واسط (Model Name)</span>
            </label>
            <input
              type="text"
              value={modelName}
              onChange={(e) => setModelName(e.target.value)}
              placeholder="مثال: gemini-2.5-flash یا gemini-3.5-flash-lite یا whisper-1"
              dir="ltr"
              className={`w-full px-3.5 py-2.5 rounded-xl bg-stone-950 border text-xs sm:text-sm text-stone-100 placeholder-stone-600 font-mono text-left focus:outline-none ${
                isGreen
                  ? 'border-stone-800 focus:border-emerald-500'
                  : 'border-stone-800 focus:border-red-500'
              }`}
            />
            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
              <span className="text-[10px] text-stone-400">مدل‌های پرکاربرد:</span>
              {[
                { label: 'gemini-3.5-flash-lite', id: 'gemini-3.5-flash-lite' },
                { label: 'gemini-2.5-flash', id: 'gemini-2.5-flash' },
                { label: 'whisper-1', id: 'whisper-1' },
                { label: 'gemini-3.8-flash', id: 'gemini-3.8-flash' },
              ].map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setModelName(m.id)}
                  className={`text-[10px] px-2 py-0.5 rounded border font-mono transition-colors cursor-pointer ${
                    modelName === m.id
                      ? isGreen
                        ? 'bg-[#14301d] text-emerald-300 border-[#225732] font-bold'
                        : 'bg-[#301414] text-red-300 border-[#572222] font-bold'
                      : 'bg-stone-950 text-stone-400 border-stone-800 hover:text-stone-200'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Endpoint Type */}
          <div>
            <label className="block text-xs font-semibold text-stone-300 mb-1 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-stone-400" />
              <span>نوع معماری درخواست (Protocol Endpoint)</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'auto', title: 'خودکار (Auto)', desc: 'تشخیص بر اساس مدل' },
                { id: 'chat', title: 'Chat Completions', desc: '/v1/chat/completions' },
                { id: 'audio_transcriptions', title: 'Audio Transcribe', desc: '/v1/audio/transcriptions' },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setEndpointType(t.id as any)}
                  className={`p-2.5 rounded-xl border text-right transition-colors cursor-pointer ${
                    endpointType === t.id
                      ? isGreen
                        ? 'bg-[#14301d] border-[#225732] text-emerald-200 font-bold'
                        : 'bg-[#301414] border-[#572222] text-red-200 font-bold'
                      : 'bg-stone-950 border-stone-800 text-stone-400 hover:border-stone-700'
                  }`}
                >
                  <p className="text-xs">{t.title}</p>
                  <p className="text-[9px] text-stone-500 font-mono mt-0.5">{t.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Test Connection Button & Result */}
          <div className="pt-2">
            <button
              onClick={handleTestConnection}
              disabled={isTesting || !baseUrl.trim()}
              type="button"
              className="min-h-[42px] w-full py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 disabled:opacity-40 text-stone-200 font-bold text-xs flex items-center justify-center gap-2 border border-stone-800 transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
              <span>{isTesting ? 'در حال سنجش ارتباط با سرور واسط...' : 'تست اتصال به سرور واسط شخصی'}</span>
            </button>

            {testResult && (
              <div
                className={`mt-2.5 p-3 rounded-xl border text-xs flex items-start gap-2.5 ${
                  testResult.success
                    ? 'bg-[#112417] border-emerald-600/70 text-emerald-200'
                    : 'bg-[#261212] border-red-800 text-red-200'
                }`}
              >
                {testResult.success ? (
                  <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                )}
                <div className="flex-1">
                  <p className="font-semibold">{testResult.message}</p>
                  {testResult.latency !== undefined && (
                    <p className="text-[10px] text-stone-400 font-mono mt-1">
                      زمان پاسخگویی: {testResult.latency} میلی‌ثانیه
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-stone-800 shrink-0">
          <button
            onClick={handleReset}
            type="button"
            className="text-xs text-stone-500 hover:text-stone-300 font-medium cursor-pointer"
          >
            بازنشانی به حالت پیش‌فرض
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              type="button"
              className="px-4 py-2 rounded-xl text-stone-400 hover:text-stone-200 text-xs font-semibold cursor-pointer"
            >
              انصراف
            </button>

            <button
              onClick={handleSave}
              type="button"
              className={`min-h-[40px] px-5 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                isGreen
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-stone-950'
                  : 'bg-red-600 hover:bg-red-500 text-stone-100'
              }`}
            >
              <span>ذخیره تنظیمات سرور</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
