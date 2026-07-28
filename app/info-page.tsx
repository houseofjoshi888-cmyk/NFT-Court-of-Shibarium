type Section = { heading: string; body: string; href?: string };

export function InfoPage({ eyebrow, title, intro, sections }: { eyebrow: string; title: string; intro: string; sections: Section[] }) {
  return <main className="info-page">
    <section className="info-hero"><span>{eyebrow}</span><h1>{title}</h1><p>{intro}</p></section>
    <section className="info-content">{sections.map(section=><article key={section.heading}><h2>{section.heading}</h2>{section.href?<a className="info-contact-link" href={section.href} target={section.href.startsWith("http")?"_blank":undefined} rel={section.href.startsWith("http")?"noreferrer":undefined}>{section.body}</a>:<p>{section.body}</p>}</article>)}</section>
  </main>;
}
