import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Html5QrcodeScanner } from "html5-qrcode";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { QrCode, LogIn, UtensilsCrossed, X } from "lucide-react";

export default function Home() {
  const [, setLocation] = useLocation();
  const [isScanning, setIsScanning] = useState(false);

  useEffect(() => {
    let scanner: Html5QrcodeScanner | null = null;

    if (isScanning) {
      scanner = new Html5QrcodeScanner(
        "qr-reader",
        { 
          fps: 10, 
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0
        },
        /* verbose= */ false
      );

      scanner.render(
        (decodedText) => {
          let token = decodedText;
          if (decodedText.includes("/menu/")) {
            token = decodedText.split("/menu/")[1];
          }
          
          if (scanner) {
            scanner.clear().catch(error => console.error("Failed to clear scanner", error));
          }
          setIsScanning(false);
          setLocation(`/menu/${token}`);
        },
        (error) => {
          // silent error for scan failures
        }
      );
    }

    return () => {
      if (scanner) {
        scanner.clear().catch(error => console.error("Failed to clear scanner on unmount", error));
      }
    };
  }, [isScanning, setLocation]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      {!isScanning ? (
        <Card className="w-full max-w-md border-none shadow-2xl bg-white">
          <CardHeader className="text-center pb-4">
            <div className="mx-auto bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mb-4 shadow-md">
              <UtensilsCrossed className="w-8 h-8 text-blue-600" />
            </div>
            <CardTitle className="text-3xl font-black tracking-tight text-slate-900">
              Cafeteria v6
            </CardTitle>
            <p className="text-slate-500 mt-2 text-sm">Manage your operations with ease</p>
          </CardHeader>
          
          <CardContent className="space-y-3 pt-2">
            <Button 
              onClick={() => setIsScanning(true)}
              className="w-full h-24 text-lg font-bold flex items-center justify-center gap-3 rounded-2xl transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg bg-blue-600 hover:bg-blue-700 text-white"
            >
              <QrCode className="w-7 h-7" />
              <span>Scan QR / Barcode</span>
            </Button>

            <Button 
              onClick={() => setLocation("/login")}
              className="w-full h-20 text-lg font-bold flex items-center justify-center gap-3 rounded-2xl transition-all hover:scale-[1.02] active:scale-[0.98] shadow-md border-2 border-slate-200 bg-white text-slate-900 hover:bg-slate-50"
            >
              <LogIn className="w-6 h-6" />
              <span>Login</span>
            </Button>
          </CardContent>
          
          <div className="px-6 py-4 text-center text-xs text-slate-400 border-t border-slate-100">
            © {new Date().getFullYear()} Cafeteria Management System
          </div>
        </Card>
      ) : (
        <div className="w-full max-w-md space-y-4">
          <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
            <div className="bg-blue-600 text-white p-4 text-center">
              <h2 className="text-xl font-bold">Scan QR Code</h2>
              <p className="text-blue-100 text-sm mt-1">Point camera at QR code</p>
            </div>
            <div id="qr-reader" className="w-full aspect-square bg-slate-100"></div>
            <div className="p-4 bg-slate-50 text-center text-xs text-slate-500">
              Position the QR code within the frame
            </div>
          </div>
          <Button 
            onClick={() => setIsScanning(false)}
            variant="outline" 
            className="w-full py-6 text-slate-600 font-bold border-2 border-white text-white hover:bg-white/10"
          >
            <X className="w-5 h-5 mr-2" />
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
}
