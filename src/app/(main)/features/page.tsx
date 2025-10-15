

'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  FileText,
  ScanEye,
  MessageCircle,
  Camera,
} from 'lucide-react';

export default function FeaturesPage() {
    const features = [
        {
          icon: <FileText className="h-8 w-8 text-primary" />,
          title: 'Prescription Translation',
          description:
            'Upload medical chits and get plain-English or Urdu explanations.',
        },
        {
          icon: <ScanEye className="h-8 w-8 text-primary" />,
          title: 'X-Ray & Report Analysis',
          description:
            'AI interprets uploaded X-rays or reports with simple explanations.',
        },
        {
          icon: <MessageCircle className="h-8 w-8 text-primary" />,
          title: 'AI Chatbot',
          description:
            'Ask health-related questions and receive bilingual answers instantly.',
        },
        {
          icon: <Camera className="h-8 w-8 text-primary" />,
          title: 'Real-Time Video Medicine Scan',
          description:
            'Point your camera at a medicine to know what it is, its uses, benefits, and risks.',
        },
      ];

  return (
    <main className="flex-1">
        <section id="features" className="w-full bg-secondary/50 py-12 md:py-24">
            <div className="container mx-auto max-w-5xl px-4">
            <div className="flex flex-col items-center space-y-4 text-center mb-12">
              <h1 className="text-3xl font-bold tracking-tighter text-primary sm:text-4xl md:text-5xl">
                Features
              </h1>
              <p className="max-w-[700px] text-muted-foreground md:text-xl">
                AI-LTH is packed with powerful features to make healthcare understandable.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4">
                {features.map((feature) => (
                <Card key={feature.title} className="transform transition-transform hover:scale-105">
                    <CardHeader className="flex flex-col items-center text-center">
                    {feature.icon}
                    <CardTitle className="mt-4">{feature.title}</CardTitle>
                    </CardHeader>
                    <CardContent className="text-center text-sm text-muted-foreground">
                    {feature.description}
                    </CardContent>
                </Card>
                ))}
            </div>
            </div>
        </section>
    </main>
  );
}
