import type { Metadata, Viewport } from "next";
import { Toaster } from "@/components/ui/sonner";
import { MaintenanceVeil } from "@/components/maintenance-veil";
import { getMaintenance } from "@/lib/maintenance";
import { ICON_NAMES } from "@/config/icons";
import "./globals.css";

// Google Sans Flex (text) and a Material Symbols subset (only the glyphs we use; regenerate with `npm run icons`).
const TEXT_FONT = "https://fonts.googleapis.com/css2?family=Google+Sans+Flex:opsz,wght@6..144,300..800&display=swap";
const ICON_FONT = `https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&icon_names=${ICON_NAMES.join(",")}&display=block`;

export const metadata: Metadata = {
  title: { default: "Design & Concur", template: "%s · Design & Concur" },
  description: "Event asset request, review and approval for Harisumiran and Atmiya Care Charities.",
  appleWebApp: { capable: true, title: "Design Seva", statusBarStyle: "default" },
};

export const viewport: Viewport = { themeColor: "#ffffff", width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const maintenance = await getMaintenance();
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* Google Sans Flex is not in next/font/google; loaded once here for the whole app. */}
        <link href={TEXT_FONT} rel="stylesheet" />
        <link href={ICON_FONT} rel="stylesheet" />
      </head>
      <body className="min-h-dvh bg-background font-sans text-foreground antialiased">
        {children}
        <MaintenanceVeil initial={maintenance} />
        {/* Bottom-left, clear of the phone tab bar and the asset page's fixed action bar. */}
        <Toaster position="bottom-left" offset={{ bottom: 20, left: 20 }} mobileOffset={{ bottom: 92, left: 12, right: 12 }} />
      </body>
    </html>
  );
}
