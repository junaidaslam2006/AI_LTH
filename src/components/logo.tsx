
import { Activity } from 'lucide-react';
import React from 'react';

export function Logo() {
  return (
    <div className="flex items-center gap-2">
      <Activity className="h-8 w-8 text-primary" />
      <h1 className="text-2xl font-bold tracking-tight text-primary transition-colors">
        AI-LTH
      </h1>
    </div>
  );
}
