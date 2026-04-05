import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calculator, CheckCircle2, AlertCircle } from 'lucide-react';

interface PointsCalculatorProps {
  cafeteriaName: string;
  cafeteriaCurrency: string;
  requestedAmount: number;
  onApprove: (data: {
    approvedPoints: number;
    paidAmount: number;
    paidCurrency: string;
    exchangeRateToUsd: number;
    pointsMultiplier: number;
  }) => void;
  onCancel: () => void;
  isProcessing: boolean;
}

export function PointsCalculator({
  cafeteriaName,
  cafeteriaCurrency,
  requestedAmount,
  onApprove,
  onCancel,
  isProcessing
}: PointsCalculatorProps) {
  const [paidAmount, setPaidAmount] = useState<number>(requestedAmount);
  const [paidCurrency, setPaidCurrency] = useState<string>(cafeteriaCurrency || 'USD');
  const [exchangeRateToUsd, setExchangeRateToUsd] = useState<number>(1.0);
  const [pointsMultiplier, setPointsMultiplier] = useState<number>(100);
  const [calculatedPoints, setCalculatedPoints] = useState<number>(0);
  const [manualOverride, setManualOverride] = useState<number | null>(null);

  // Update exchange rate based on currency (simplified)
  useEffect(() => {
    const rates: Record<string, number> = {
      'USD': 1.0,
      'EUR': 1.09,
      'GBP': 1.27,
      'INR': 0.012,
      'BRL': 0.20,
      'MXN': 0.06,
    };
    setExchangeRateToUsd(rates[paidCurrency] || 1.0);
  }, [paidCurrency]);

  // Calculate points whenever inputs change
  useEffect(() => {
    const points = Math.ceil(paidAmount * exchangeRateToUsd * pointsMultiplier);
    setCalculatedPoints(points);
  }, [paidAmount, exchangeRateToUsd, pointsMultiplier]);

  const finalPoints = manualOverride !== null ? manualOverride : calculatedPoints;

  return (
    <Card className="w-full border-blue-200 shadow-lg">
      <CardHeader className="bg-blue-50 border-b border-blue-100">
        <CardTitle className="text-blue-800 flex items-center gap-2">
          <Calculator className="w-5 h-5" />
          Points Calculator - {cafeteriaName}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="paidAmount">Paid Amount ({paidCurrency})</Label>
            <Input
              id="paidAmount"
              type="number"
              value={paidAmount}
              onChange={(e) => setPaidAmount(Number(e.target.value))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="paidCurrency">Paid Currency</Label>
            <select
              id="paidCurrency"
              className="w-full p-2 border rounded-md text-sm"
              value={paidCurrency}
              onChange={(e) => setPaidCurrency(e.target.value)}
            >
              <option value="USD">USD - US Dollar</option>
              <option value="EUR">EUR - Euro</option>
              <option value="GBP">GBP - British Pound</option>
              <option value="INR">INR - Indian Rupee</option>
              <option value="BRL">BRL - Brazilian Real</option>
              <option value="MXN">MXN - Mexican Peso</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="exchangeRate">Exchange Rate (to USD)</Label>
            <Input
              id="exchangeRate"
              type="number"
              step="0.0001"
              value={exchangeRateToUsd}
              onChange={(e) => setExchangeRateToUsd(Number(e.target.value))}
            />
            <p className="text-[10px] text-gray-500">1 {paidCurrency} = {exchangeRateToUsd} USD</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="multiplier">Points Multiplier (per USD)</Label>
            <Input
              id="multiplier"
              type="number"
              value={pointsMultiplier}
              onChange={(e) => setPointsMultiplier(Number(e.target.value))}
            />
          </div>
        </div>

        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-600">Calculated Points:</span>
            <span className="text-lg font-bold text-blue-700">{calculatedPoints.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <Label htmlFor="override" className="text-xs text-gray-500">Manual Points Override (Optional)</Label>
              <Input
                id="override"
                type="number"
                placeholder="Leave blank to use calculated"
                value={manualOverride === null ? '' : manualOverride}
                onChange={(e) => setManualOverride(e.target.value === '' ? null : Number(e.target.value))}
                className="h-8 text-sm"
              />
            </div>
          </div>
        </div>

        {finalPoints !== requestedAmount && (
          <div className="flex items-center gap-2 text-amber-600 bg-amber-50 p-2 rounded text-xs">
            <AlertCircle className="w-4 h-4" />
            <span>Note: Approved points ({finalPoints}) differ from requested amount ({requestedAmount}).</span>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="outline" onClick={onCancel} disabled={isProcessing}>
            Cancel
          </Button>
          <Button 
            className="bg-green-600 hover:bg-green-700 text-white gap-2"
            onClick={() => onApprove({
              approvedPoints: finalPoints,
              paidAmount,
              paidCurrency,
              exchangeRateToUsd,
              pointsMultiplier
            })}
            disabled={isProcessing || finalPoints <= 0}
          >
            <CheckCircle2 className="w-4 h-4" />
            Approve {finalPoints.toLocaleString()} Points
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
