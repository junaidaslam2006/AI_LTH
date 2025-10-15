'use client';

import { useState } from 'react';
import { useFirebaseStorage } from '@/hooks/use-firebase-storage';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, FileImage, Loader2, Check } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';

type DocumentType = 'prescription' | 'medicine' | 'report';

export function MedicalUpload() {
  const { user } = useAuth();
  const { uploadMedicalImage, isUploading, uploadProgress } = useFirebaseStorage();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [documentType, setDocumentType] = useState<DocumentType>('prescription');
  const [uploadComplete, setUploadComplete] = useState(false);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setUploadComplete(false);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !user) return;

    try {
      const result = await uploadMedicalImage(selectedFile, documentType);
      if (result.success) {
        setUploadComplete(true);
        setSelectedFile(null);
        // Reset file input
        const fileInput = document.getElementById('medical-file') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
      }
    } catch (error) {
      console.error('Upload failed:', error);
    }
  };

  if (!user) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-sm text-muted-foreground">
            Sign in to upload and save medical documents
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileImage className="h-5 w-5" />
          Upload Medical Document
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="document-type">Document Type</Label>
          <Select value={documentType} onValueChange={(value) => setDocumentType(value as DocumentType)}>
            <SelectTrigger>
              <SelectValue placeholder="Select document type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="prescription">Prescription</SelectItem>
              <SelectItem value="medicine">Medicine Photo</SelectItem>
              <SelectItem value="report">Medical Report</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="medical-file">Select File</Label>
          <div className="flex items-center gap-2">
            <input
              id="medical-file"
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="file:mr-2 file:py-1 file:px-3 file:rounded file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 flex-1 text-sm"
              disabled={isUploading}
            />
          </div>
        </div>

        {selectedFile && (
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">
              Selected: {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
            </div>
            
            {isUploading && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Uploading... {Math.round(uploadProgress)}%
                </div>
                <Progress value={uploadProgress} className="w-full" />
              </div>
            )}
            
            {uploadComplete && (
              <div className="flex items-center gap-2 text-sm text-green-600">
                <Check className="h-4 w-4" />
                Upload completed successfully!
              </div>
            )}
          </div>
        )}

        <Button
          onClick={handleUpload}
          disabled={!selectedFile || isUploading}
          className="w-full gap-2"
        >
          {isUploading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Uploading...
            </>
          ) : (
            <>
              <Upload className="h-4 w-4" />
              Upload Document
            </>
          )}
        </Button>

        <div className="text-xs text-muted-foreground">
          Supported formats: JPG, PNG, WebP. Max size: 5MB.
          Your documents are securely stored and only accessible to you.
        </div>
      </CardContent>
    </Card>
  );
}