import Link from "next/link";
import Image from "next/image";

type Section = { heading: string; body: string; href?: string };

export function InfoPage({ eyebrow, title, intro, sections }: { eyebrow: string; title: string; intro: string; sections: Section[] }) {
  return <main className="info-page"><header><Link href="/" className="wordmark"><Image src="/house-of-joshi.png" alt="House of Joshi" width={36} height={36} className="footer-logo"/><span>HOUSE OF JOSHI</span></Link><nav><Link href="/market">Market</Link><Link href="/sell">Sell</Link><Link href="/contact">Contact</Link></nav></header><section className="info-hero"><span>{eyebrow}</span><h1>{title}</h1><p>{intro}</p></section><section className="info-content">{sections.map(section=><article key={section.heading}><h2>{section.heading}</h2>{section.href?<a className="info-contact-link" href={section.href} target={section.href.startsWith("http")?"_blank":undefined} rel={section.href.startsWith("http")?"noreferrer":undefined}>{section.body}</a>:<p>{section.body}</p>}</article>)}</section><footer className="info-footer"><span>© 2026 The House of Joshi. All rights reserved.</span><div><Link href="/terms">Terms &amp; Conditions</Link><Link href="/privacy">Privacy Policy</Link><Link href="/contact">Contact</Link></div></footer></main>;
}
