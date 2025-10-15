

'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { HeartPulse, Lightbulb, Users } from 'lucide-react';

export default function AboutPage() {
  return (
      <main className="flex-1">
        <section className="w-full py-12 md:py-24 lg:py-32">
          <div className="container mx-auto max-w-5xl px-4 md:px-6">
            <div className="flex flex-col items-center space-y-4 text-center">
              <h1 className="text-3xl font-bold tracking-tighter text-primary sm:text-4xl md:text-5xl">
                About AI-LTH
              </h1>
              <p className="max-w-[700px] text-muted-foreground md:text-xl">
                AI-LTH is a revolutionary health assistant designed to bridge the communication gap in healthcare. We empower individuals to understand their health better by providing simple, clear, and accessible explanations of medical information.
              </p>
            </div>
          </div>
        </section>

        <section className="w-full bg-secondary/50 py-12 md:py-24">
          <div className="container mx-auto max-w-5xl px-4 md:px-6">
            <div className="grid gap-10 sm:px-10 md:gap-16 md:grid-cols-3">
              <Card className="text-center">
                <CardHeader>
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                    <HeartPulse className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle className="mt-4">Our Mission</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">To make health information universally accessible and understandable, regardless of language or literacy level, improving health outcomes for everyone.</p>
                </CardContent>
              </Card>
              <Card className="text-center">
                <CardHeader>
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                    <Lightbulb className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle className="mt-4">Our Vision</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">A world where every person feels confident and informed about their health journey, supported by AI that speaks their language.</p>
                </CardContent>
              </Card>
              <Card className="text-center">
                <CardHeader>
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                    <Users className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle className="mt-4">Our Team</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">We are a passionate team of developers, healthcare professionals, and AI experts dedicated to leveraging technology for the greater good.</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>
      </main>
  );
}
