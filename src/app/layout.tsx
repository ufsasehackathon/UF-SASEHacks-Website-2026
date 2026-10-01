import type { Metadata } from "next";
import "./globals.css";
import { HACK_NAME, DATES, CITY, DOMAIN } from "@/lib/constants";
import Header from "@/components/Header";
import { Jersey_20, Inconsolata } from "next/font/google";

const jersey20 = Jersey_20({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-heading",
});

const inconsolata = Inconsolata({
  subsets: ["latin"],
  variable: "--font-body",
});

export const metadata: Metadata = {
  title: `${HACK_NAME}`,
  description: `${HACK_NAME} is a community hackathon in ${CITY}. Join us on ${DATES}.`,
  metadataBase: new URL(
    `https://${DOMAIN}`.includes("{{your-domain.com}}")
      ? "http://localhost:3000"
      : `https://${DOMAIN}`
  ),
  openGraph: {
    title: `${HACK_NAME}`,
    description: `Build with us in ${CITY}.`,
    type: "website",
    images: [
      {
        url: "/images/gbm-4-s25.JPG", 
        width: 1200,
        height: 630,
        alt: `${HACK_NAME} Event Preview`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${HACK_NAME} - ${DATES}`,
    description: `Build with us in ${CITY}.`,
    images: ["/images/gbm-4-s25.JPG"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${jersey20.variable} ${inconsolata.variable}`}>
        <Header />
        <main>{children}</main>
        <footer className="bg-[#ebb8ce] border-t-4 border-[#ffffff]">
          <div className="mx-auto max-w-screen-xl px-4 py-8">
            <div className="text-center space-y-4">
              <h3 className="font-[family-name:var(--font-heading)] text-[#560700] text-2xl md:text-3xl">
                SASEHacks
              </h3>
              <p className="font-[family-name:var(--font-body)] text-[#560700]/60 text-md md:text-lg">
                Made with ❤️ by the SASEHacks Team
              </p>
              <p className="font-[family-name:var(--font-body)] text-[#560700]/60 text-md md:text-lg">
                © 2027
              </p>
              <a
                href="https://github.com/MLH/mlh-policies/blob/main/code-of-conduct.md"
                target="_blank"
                rel="noopener noreferrer"
                className="font-[family-name:var(--font-body)] text-[#560700] text-xs md:text-sm underline underline-offset-2"
              >
                MLH Code of Conduct
              </a>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}