
'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { identifyPillAction } from '@/app/actions';
import { Loader2, ScanLine } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface LiveScanModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function LiveScanModal({ isOpen, onClose }: LiveScanModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<{name: string, description: string, dosage: string} | null>(null);

  const { toast } = useToast();

  const handleClose = () => {
    setScanResult(null);
    setIsScanning(false);
    onClose();
  }

  useEffect(() => {
    if (!isOpen) {
      if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
        videoRef.current.srcObject = null;
      }
      return;
    }

    const getCameraPermission = async () => {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        toast({
            variant: 'destructive',
            title: 'Camera Not Supported',
            description: 'Your browser does not support camera access.',
        });
        setHasCameraPermission(false);
        return;
      }
      
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        setHasCameraPermission(true);

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (error) {
        console.error('Error accessing camera:', error);
        setHasCameraPermission(false);
        toast({
          variant: 'destructive',
          title: 'Camera Access Denied',
          description: 'Please enable camera permissions in your browser settings to use this app.',
        });
      }
    };

    getCameraPermission();
    
    return () => {
        if (videoRef.current?.srcObject) {
            const stream = videoRef.current.srcObject as MediaStream;
            stream.getTracks().forEach(track => track.stop());
        }
    };
  }, [isOpen, toast]);

  const handleScan = async () => {
    if (!videoRef.current) return;
    setIsScanning(true);
    setScanResult(null);

    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const context = canvas.getContext('2d');
    if(!context) return;
    
    context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    const imageDataUri = canvas.toDataURL('image/jpeg');

    const formData = new FormData();
    formData.append('imageDataUri', imageDataUri);
    const result = await identifyPillAction(null, formData);
    
    setIsScanning(false);

    if(result.message === 'success' && result.data){
        setScanResult(result.data);
    } else {
        toast({
            variant: 'destructive',
            title: 'Scan Failed',
            description: result.message || 'Could not identify the object.',
        });
    }
  };


  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-h-[90vh] w-full max-w-3xl overflow-hidden p-0 sm:rounded-2xl">
        <div className="flex h-full flex-col">
          <DialogHeader className="space-y-1.5 border-b px-5 py-4">
            <DialogTitle>Live Medicine Scanner</DialogTitle>
            <DialogDescription>
              Point your camera at pills, medications, medical reports, or medical devices for identification. For other health questions, please use the chat feature.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-5 py-4">
            <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-black">
              <video
                ref={videoRef}
                className="h-full w-full object-cover"
                autoPlay
                muted
                playsInline
              />
              {hasCameraPermission === false && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/70">
                  <Alert variant="destructive" className="w-[90%] max-w-sm">
                    <AlertTitle>Camera Access Required</AlertTitle>
                    <AlertDescription>
                      Please allow camera access to use this feature.
                    </AlertDescription>
                  </Alert>
                </div>
              )}
              {hasCameraPermission === null && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                  <p className="text-white">Requesting camera permission...</p>
                </div>
              )}
            </div>

            {isScanning && (
              <div className="mt-6 flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-primary/40 bg-muted/40 px-6 py-8 text-center">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <p className="text-base font-medium">Scanning…</p>
                <p className="text-sm text-muted-foreground">
                  Hold steady while we analyze the image for medicine details.
                </p>
              </div>
            )}

            {scanResult && (
              <Card className="mt-6">
                <CardHeader>
                  <CardTitle>{scanResult.name}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h3 className="font-semibold">Description</h3>
                    <p className="text-muted-foreground">{scanResult.description}</p>
                  </div>
                  <div>
                    <h3 className="font-semibold">Dosage</h3>
                    <p className="text-muted-foreground">{scanResult.dosage}</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          <DialogFooter className="border-t px-5 py-4">
            <Button type="button" variant="secondary" onClick={handleClose}>
              Close
            </Button>
            <Button type="button" onClick={handleScan} disabled={isScanning || hasCameraPermission !== true}>
              <ScanLine className="mr-2 h-4 w-4" />
              {isScanning ? 'Scanning…' : 'Scan'}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
