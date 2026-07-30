import { DirectoryPage } from "../directory-page";

export default function ResourcesPage(){
  return <DirectoryPage eyebrow="RESOURCES" title="Marketplace Resources" intro="Learn how the marketplace works, find answers, and understand the House of Joshi." cards={[
    {eyebrow:"GUIDES",title:"Learn",description:"Understand wallets, networks, collecting, listing, and onchain settlement.",href:"/learn",icon:"book"},
    {eyebrow:"ASSISTANCE",title:"Help Centre",description:"Find practical answers about using the marketplace across supported networks.",href:"/help-centre",icon:"help"},
    {eyebrow:"THE HOUSE",title:"About",description:"Read about the House of Joshi and the principles behind the NFT Marketplace.",href:"/about",icon:"collection"},
  ]}/>;
}
