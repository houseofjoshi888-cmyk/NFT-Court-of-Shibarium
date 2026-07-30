import { DirectoryPage } from "../directory-page";

export default function DropsPage(){
  return <DirectoryPage eyebrow="DROPS" title="Court Drops" intro="Official releases will appear here only after their collection and launch details are verified." cards={[
    {eyebrow:"UPCOMING",title:"No announced drops",description:"There are no verified House of Joshi drops to display yet.",icon:"drop"},
  ]}/>;
}
