import { DirectoryPage } from "../directory-page";

export default function SupportPage(){
  return <DirectoryPage eyebrow="SUPPORT" title="Support from the House" intro="Get answers or contact the House of Joshi team." cards={[
    {eyebrow:"SELF SERVICE",title:"Help Centre",description:"Read answers about wallets, networks, listings, fees, and settlement.",href:"/help-centre",icon:"help"},
    {eyebrow:"CONTACT",title:"Contact Support",description:"Find official email and community support channels.",href:"/contact",icon:"support"},
  ]}/>;
}
