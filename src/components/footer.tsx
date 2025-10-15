
'use client';

import Link from "next/link";
import { Logo } from "./logo";

export function Footer() {
    return (
        <footer className="w-full border-t border-border/40 bg-background">
            <div className="container mx-auto max-w-5xl px-4 py-6 md:px-6">
                <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
                    <div className="flex items-center gap-2">
                        <Logo />
                        <span className="text-sm text-muted-foreground">
                            © {new Date().getFullYear()} AI-LTH. All rights reserved.
                        </span>
                    </div>
                    <nav className="flex gap-4">
                        <Link href="/" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                            Home
                        </Link>
                        <Link href="/features" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                            Features
                        </Link>
                        <Link href="/about" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                            About
                        </Link>
                        <Link href="/contact" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                            Contact
                        </Link>
                    </nav>
                </div>
            </div>
        </footer>
    );
}
