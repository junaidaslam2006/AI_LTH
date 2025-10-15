

'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';

export default function ContactPage() {
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        // In a real application, you would handle form submission here.
        alert('Thank you for your message! We will get back to you shortly.');
    };

  return (
      <main className="flex flex-1 items-center justify-center py-12 md:py-24">
        <div className="container mx-auto max-w-2xl px-4">
          <Card>
            <CardHeader className="text-center">
              <CardTitle className="text-3xl font-bold text-primary">Contact Us</CardTitle>
              <CardDescription>
                Have questions or feedback? We'd love to hear from you.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input id="name" placeholder="Enter your name" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" placeholder="Enter your email" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="message">Message</Label>
                  <Textarea id="message" placeholder="Enter your message" required className="min-h-[120px]" />
                </div>
                <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
                  Send Message
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>
  );
}
