import { ArrowUpRight, BookOpen, CircleHelp, Gem, Headphones, Sparkles } from "lucide-react";
import Link from "next/link";

type DirectoryCard = {
  eyebrow: string;
  title: string;
  description: string;
  href?: string;
  external?: boolean;
  icon?: "book" | "help" | "support" | "collection" | "drop";
};

const icons = { book: BookOpen, help: CircleHelp, support: Headphones, collection: Gem, drop: Sparkles };

export function DirectoryPage({ eyebrow, title, intro, cards }: { eyebrow:string; title:string; intro:string; cards:DirectoryCard[] }) {
  return <main className="directory-page">
    <section className="directory-hero"><span>{eyebrow}</span><h1>{title}</h1><p>{intro}</p></section>
    <section className="directory-grid">{cards.map((card)=>{
      const Icon=icons[card.icon??"book"];
      const content=<><div><Icon size={18}/><span>{card.eyebrow}</span></div><h2>{card.title}</h2><p>{card.description}</p><span className="directory-card-action">{card.href?"Open":"Link coming soon"} {card.href&&<ArrowUpRight size={14}/>}</span></>;
      return card.href
        ? card.external
          ? <a className="directory-card" href={card.href} target="_blank" rel="noreferrer" key={card.title}>{content}</a>
          : <Link className="directory-card" href={card.href} key={card.title}>{content}</Link>
        : <article className="directory-card pending" key={card.title}>{content}</article>;
    })}</section>
  </main>;
}
