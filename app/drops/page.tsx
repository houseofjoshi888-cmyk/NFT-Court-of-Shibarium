import Image from "next/image";

export default function DropsPage(){
  return <main className="drops-page">
    <section className="drops-hero"><span>DROPS</span><h1>Upcoming from the Court</h1><p>Official House of Joshi releases, presented only when their details are confirmed.</p></section>
    <section className="featured-drop">
      <div className="featured-drop-art"><Image src="/one-minute-of-you.png" alt="One Minute of You — Your Movement Made Eternal" width={1254} height={1254} priority/></div>
      <div className="featured-drop-copy">
        <span>COMING SOON · BASE</span>
        <h2>One Minute of You</h2>
        <blockquote>Your movement.<br/>Made eternal.</blockquote>
        <p>A forthcoming collection of 500 unique portraits across five royal houses.</p>
        <dl><div><dt>COLLECTION</dt><dd>One Minute of You</dd></div><div><dt>SUPPLY</dt><dd>500 unique portraits</dd></div><div><dt>NETWORK</dt><dd>Base</dd></div><div><dt>STATUS</dt><dd>Coming soon</dd></div></dl>
        <small>The official release date and mint link will appear here when announced.</small>
      </div>
    </section>
  </main>;
}
