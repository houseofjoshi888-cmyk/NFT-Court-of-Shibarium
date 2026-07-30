import { InfoPage } from "../info-page";

export default function LearnPage(){return <InfoPage eyebrow="LEARN" title="Learn the Court" intro="A clear introduction to collecting and listing NFTs safely across supported networks." sections={[
  {heading:"Connect your wallet",body:"Use Connect Wallet at the top of the page. The network selector appears directly beside it, so your wallet and marketplace network remain visible together."},
  {heading:"Choose a network",body:"Select Ethereum, Shibarium, Polygon, Base, or Robinhood Chain. Listings, activity, balances, and settlement are kept separate for each network."},
  {heading:"Collect a work",body:"Open a verified listing, review its collection, contract, token ID, price, and network, then confirm the purchase in your wallet."},
  {heading:"Present a work",body:"Choose an ERC-721 from your connected wallet, approve the marketplace, set its price, and confirm the listing transaction."},
]}/>}
