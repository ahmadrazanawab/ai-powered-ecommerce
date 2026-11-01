import type { ReactNode } from "react";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";

export default function UserLayout({ children }: { children: ReactNode }) {
    return (
        <div data-theme="light" className="min-h-screen bg-slate-50">
            {/* Wire real values here once customer auth and cart exist */}
            <Navbar cartCount={0} wishlistCount={0} user={null} />
            <main>{children}</main>
            <Footer/>
        </div>
    );
}