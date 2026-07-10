import type { Metadata } from "next";
import "./styles.css";
export const metadata: Metadata={title:"CB-CAP | SozoRock Health",description:"Protected county access intelligence."};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
