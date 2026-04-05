import React, { useState, useEffect } from 'react';
import { useAuth } from '@/_core/hooks/useAuth';
import { useTranslation } from '@/locales/useTranslation';
import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calculator, Coins, DollarSign, TrendingUp, RefreshCw, ArrowLeft, Home } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { toast } from 'sonner';

interface CurrencyRate {
  code: string;
  name: string;
  symbol: string;
  rateToUSD: number;
}

const CURRENCY_RATES: Record<string, CurrencyRate> = {
  'SAR': { code: 'SAR', name: 'Saudi Riyal', symbol: 'ر.س', rateToUSD: 0.267 },
  'EGP': { code: 'EGP', name: 'Egyptian Pound', symbol: 'ج.م', rateToUSD: 0.032 },
  'AED': { code: 'AED', name: 'UAE Dirham', symbol: 'د.إ', rateToUSD: 0.272 },
  'KWD': { code: 'KWD', name: 'Kuwaiti Dinar', symbol: 'د.ك', rateToUSD: 3.25 },
  'JOD': { code: 'JOD', name: 'Jordanian Dinar', symbol: 'د.ا', rateToUSD: 1.41 },
  'USD': { code: 'USD', name: 'US Dollar', symbol: '$', rateToUSD: 1 },
  'GBP': { code: 'GBP', name: 'British Pound', symbol: '£', rateToUSD: 1.27 },
};

export default function OwnerPointsCalculator() {
  const { user, loading: authLoading } = useAuth({ redirectOnUnauthenticated: true });
  const { language } = useTranslation();
  const [, setLocation] = useLocation();
  const isRTL = language === 'ar';

  const [tab, setTab] = useState('simple');
  
  // Simple Calculator
  const [simpleCurrency, setSimpleCurrency] = useState('SAR');
  const [simpleAmount, setSimpleAmount] = useState('');
  const [simplePoints, setSimplePoints] = useState('');
  const [simpleResult, setSimpleResult] = useState<number | null>(null);

  // Advanced Calculator
  const [advancedFromCurrency, setAdvancedFromCurrency] = useState('SAR');
  const [advancedToCurrency, setAdvancedToCurrency] = useState('USD');
  const [advancedAmount, setAdvancedAmount] = useState('');
  const [advancedResult, setAdvancedResult] = useState<number | null>(null);

  // Batch Calculator
  const [batchData, setBatchData] = useState<Array<{ amount: number; currency: string; result: number }>>([]);
  const [batchAmount, setBatchAmount] = useState('');
  const [batchCurrency, setBatchCurrency] = useState('SAR');

  const handleSimpleCalculate = () => {
    if (!simpleAmount) {
      toast.error(isRTL ? 'أدخل المبلغ' : 'Enter amount');
      return;
    }

    const amount = parseFloat(simpleAmount);
    const points = parseFloat(simplePoints) || 1;

    if (isNaN(amount) || isNaN(points)) {
      toast.error(isRTL ? 'أدخل أرقام صحيحة' : 'Enter valid numbers');
      return;
    }

    const result = (amount / points) * 100;
    setSimpleResult(Math.round(result * 100) / 100);
  };

  const handleAdvancedCalculate = () => {
    if (!advancedAmount) {
      toast.error(isRTL ? 'أدخل المبلغ' : 'Enter amount');
      return;
    }

    const amount = parseFloat(advancedAmount);
    if (isNaN(amount)) {
      toast.error(isRTL ? 'أدخل رقم صحيح' : 'Enter valid number');
      return;
    }

    const fromRate = CURRENCY_RATES[advancedFromCurrency]?.rateToUSD || 1;
    const toRate = CURRENCY_RATES[advancedToCurrency]?.rateToUSD || 1;

    const amountInUSD = amount * fromRate;
    const result = amountInUSD / toRate;
    setAdvancedResult(Math.round(result * 100) / 100);
  };

  const handleAddBatchItem = () => {
    if (!batchAmount) {
      toast.error(isRTL ? 'أدخل المبلغ' : 'Enter amount');
      return;
    }

    const amount = parseFloat(batchAmount);
    if (isNaN(amount)) {
      toast.error(isRTL ? 'أدخل رقم صحيح' : 'Enter valid number');
      return;
    }

    const rate = CURRENCY_RATES[batchCurrency]?.rateToUSD || 1;
    const result = Math.round((amount * rate) * 100) / 100;

    setBatchData([...batchData, { amount, currency: batchCurrency, result }]);
    setBatchAmount('');
  };

  const handleRemoveBatchItem = (index: number) => {
    setBatchData(batchData.filter((_, i) => i !== index));
  };

  const batchTotal = batchData.reduce((sum, item) => sum + item.result, 0);

  return (
    <div className={`min-h-screen bg-slate-50 pb-20 ${isRTL ? 'rtl' : 'ltr'}`} dir={isRTL ? 'rtl' : 'ltr'}>
      <header className="bg-white border-b p-4 flex justify-between items-center sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-green-600 p-2 rounded-lg text-white">
            <Calculator className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold text-slate-800">
            {isRTL ? 'حاسبة النقاط' : 'Points Calculator'}
          </h1>
        </div>
        <Button variant="ghost" size="icon" onClick={() => setLocation('/dashboard/owner')} className="text-slate-600">
          <ArrowLeft className="w-5 h-5" />
        </Button>
      </header>

      <main className="p-4 max-w-4xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Coins className="w-5 h-5 text-green-600" />
              {isRTL ? 'أدوات حساب النقاط' : 'Points Calculation Tools'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={tab} onValueChange={setTab} className="w-full">
              <TabsList className="grid w-full grid-cols-3 bg-slate-100">
                <TabsTrigger value="simple">{isRTL ? 'بسيط' : 'Simple'}</TabsTrigger>
                <TabsTrigger value="advanced">{isRTL ? 'متقدم' : 'Advanced'}</TabsTrigger>
                <TabsTrigger value="batch">{isRTL ? 'دفعات' : 'Batch'}</TabsTrigger>
              </TabsList>

              {/* Simple Calculator */}
              <TabsContent value="simple" className="space-y-6 mt-6">
                <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-6 rounded-lg border border-green-200">
                  <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-green-600" />
                    {isRTL ? 'حساب النقاط من المبلغ' : 'Calculate Points from Amount'}
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div className="space-y-2">
                      <Label>{isRTL ? 'العملة' : 'Currency'}</Label>
                      <Select value={simpleCurrency} onValueChange={setSimpleCurrency}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.values(CURRENCY_RATES).map(c => (
                            <SelectItem key={c.code} value={c.code}>
                              {c.name} ({c.symbol})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>{isRTL ? 'المبلغ' : 'Amount'}</Label>
                      <Input
                        type="number"
                        placeholder="0.00"
                        value={simpleAmount}
                        onChange={e => setSimpleAmount(e.target.value)}
                        className="text-lg"
                      />
                    </div>
                  </div>

                  <div className="space-y-2 mb-4">
                    <Label>{isRTL ? 'نقطة واحدة = كم من العملة؟' : 'One Point = How Much Currency?'}</Label>
                    <Input
                      type="number"
                      placeholder="1"
                      value={simplePoints}
                      onChange={e => setSimplePoints(e.target.value)}
                      className="text-lg"
                    />
                  </div>

                  <Button onClick={handleSimpleCalculate} className="w-full bg-green-600 hover:bg-green-700 mb-4">
                    <Calculator className="w-4 h-4 mr-2" />
                    {isRTL ? 'حساب' : 'Calculate'}
                  </Button>

                  {simpleResult !== null && (
                    <div className="bg-white p-4 rounded-lg border-2 border-green-300">
                      <p className="text-sm text-slate-600 mb-1">{isRTL ? 'النتيجة' : 'Result'}</p>
                      <p className="text-3xl font-bold text-green-600">{simpleResult.toLocaleString()} {isRTL ? 'نقطة' : 'Points'}</p>
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* Advanced Calculator */}
              <TabsContent value="advanced" className="space-y-6 mt-6">
                <div className="bg-gradient-to-br from-blue-50 to-cyan-50 p-6 rounded-lg border border-blue-200">
                  <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-blue-600" />
                    {isRTL ? 'تحويل العملات' : 'Currency Conversion'}
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div className="space-y-2">
                      <Label>{isRTL ? 'من' : 'From'}</Label>
                      <Select value={advancedFromCurrency} onValueChange={setAdvancedFromCurrency}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.values(CURRENCY_RATES).map(c => (
                            <SelectItem key={c.code} value={c.code}>
                              {c.name} ({c.symbol})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>{isRTL ? 'المبلغ' : 'Amount'}</Label>
                      <Input
                        type="number"
                        placeholder="0.00"
                        value={advancedAmount}
                        onChange={e => setAdvancedAmount(e.target.value)}
                        className="text-lg"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>{isRTL ? 'إلى' : 'To'}</Label>
                      <Select value={advancedToCurrency} onValueChange={setAdvancedToCurrency}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.values(CURRENCY_RATES).map(c => (
                            <SelectItem key={c.code} value={c.code}>
                              {c.name} ({c.symbol})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <Button onClick={handleAdvancedCalculate} className="w-full bg-blue-600 hover:bg-blue-700 mb-4">
                    <RefreshCw className="w-4 h-4 mr-2" />
                    {isRTL ? 'تحويل' : 'Convert'}
                  </Button>

                  {advancedResult !== null && (
                    <div className="bg-white p-4 rounded-lg border-2 border-blue-300">
                      <p className="text-sm text-slate-600 mb-1">
                        {advancedAmount} {CURRENCY_RATES[advancedFromCurrency]?.symbol} = 
                      </p>
                      <p className="text-3xl font-bold text-blue-600">
                        {advancedResult.toLocaleString()} {CURRENCY_RATES[advancedToCurrency]?.symbol}
                      </p>
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* Batch Calculator */}
              <TabsContent value="batch" className="space-y-6 mt-6">
                <div className="bg-gradient-to-br from-purple-50 to-pink-50 p-6 rounded-lg border border-purple-200">
                  <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <Coins className="w-4 h-4 text-purple-600" />
                    {isRTL ? 'حساب دفعات متعددة' : 'Batch Calculation'}
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div className="space-y-2">
                      <Label>{isRTL ? 'العملة' : 'Currency'}</Label>
                      <Select value={batchCurrency} onValueChange={setBatchCurrency}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.values(CURRENCY_RATES).map(c => (
                            <SelectItem key={c.code} value={c.code}>
                              {c.name} ({c.symbol})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>{isRTL ? 'المبلغ' : 'Amount'}</Label>
                      <Input
                        type="number"
                        placeholder="0.00"
                        value={batchAmount}
                        onChange={e => setBatchAmount(e.target.value)}
                        className="text-lg"
                      />
                    </div>

                    <div className="flex items-end">
                      <Button onClick={handleAddBatchItem} className="w-full bg-purple-600 hover:bg-purple-700">
                        {isRTL ? 'إضافة' : 'Add'}
                      </Button>
                    </div>
                  </div>

                  {batchData.length > 0 && (
                    <div className="space-y-4">
                      <div className="bg-white rounded-lg overflow-hidden border border-purple-200">
                        {batchData.map((item, idx) => (
                          <div key={idx} className="flex items-center justify-between p-4 border-b last:border-b-0 hover:bg-slate-50">
                            <div className="flex-1">
                              <p className="font-bold text-slate-800">
                                {item.amount} {CURRENCY_RATES[item.currency]?.symbol}
                              </p>
                              <p className="text-xs text-slate-500">{item.currency}</p>
                            </div>
                            <div className="text-right mr-4">
                              <p className="font-bold text-purple-600">{item.result.toLocaleString()}</p>
                              <p className="text-xs text-slate-500">{isRTL ? 'نقطة' : 'Points'}</p>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveBatchItem(idx)}
                              className="text-red-600 hover:bg-red-50"
                            >
                              ✕
                            </Button>
                          </div>
                        ))}
                      </div>

                      <div className="bg-white p-4 rounded-lg border-2 border-purple-300">
                        <p className="text-sm text-slate-600 mb-1">{isRTL ? 'الإجمالي' : 'Total'}</p>
                        <p className="text-3xl font-bold text-purple-600">{batchTotal.toLocaleString()} {isRTL ? 'نقطة' : 'Points'}</p>
                      </div>
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <Card className="bg-blue-50 border-blue-200">
          <CardHeader>
            <CardTitle className="text-sm">{isRTL ? 'معلومات أسعار الصرف' : 'Exchange Rate Information'}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-slate-600 space-y-2">
            <p>{isRTL ? 'الأسعار المعروضة تقريبية وقد تختلف حسب السوق الفعلي' : 'Displayed rates are approximate and may vary based on actual market rates'}</p>
            <p>{isRTL ? 'يتم تحديث الأسعار يومياً' : 'Rates are updated daily'}</p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
