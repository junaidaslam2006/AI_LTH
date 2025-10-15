
'use client';

import Link from "next/link";
import { Logo } from "./logo";
import { Button } from "./ui/button";
import { ThemeToggle } from "./theme-toggle";

export function Header() {
    const navLinks = [
        { href: '/', label: 'Home' },
        { href: '/features', label: 'Features' },
        { href: '/about', label: 'About' },
        { href: '/contact', label: 'Contact' },
    ];

    return (
        <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="container mx-auto flex h-16 max-w-5xl items-center justify-between px-4 md:px-6">
                <div className="flex items-center gap-6">
                    <Link href="/">
                        <Logo />
                    </Link>
                    <nav className="hidden md:flex md:items-center md:gap-4">
                        {navLinks.map(({ href, label }) => (
                            <Button key={label} variant="ghost" asChild className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary">
                                <Link
                                    href={href}
                                >
                                    {label}
                                </Link>
                            </Button>
                        ))}
                    </nav>
                </div>
                <div className="flex items-center gap-2">
                    <ThemeToggle />
                </div>
            </div>
        </header>
    );
}
