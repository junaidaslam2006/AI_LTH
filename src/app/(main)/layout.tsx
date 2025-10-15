
import { Footer } from "@/components/footer";

export default function PagesLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="flex flex-col min-h-screen">
            <main className="flex-1">{children}</main>
            <Footer />
        </div>
    );
}
