import { DirectoryPage } from "../directory-page";

export default function CollectionsPage(){
  return <DirectoryPage eyebrow="COLLECTIONS" title="Collections of the Court" intro="Discover verified collections presented across the House of Joshi ecosystem." cards={[
    {eyebrow:"TRENDING",title:"Malkuta Mandalas",description:"The official collection link and verified works will appear here when supplied.",icon:"collection"},
  ]}/>;
}
