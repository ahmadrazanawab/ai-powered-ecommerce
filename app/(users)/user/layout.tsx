import type { ReactNode } from "react";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";

export default function UserLayout({ children }: { children: ReactNode }) {
    return (
        <div data-theme="light" className="min-h-screen bg-slate-50">
            <Navbar wishlistCount={0} user={null} />
            <main>{children}</main>
            <Footer/>
        </div>
    );
}