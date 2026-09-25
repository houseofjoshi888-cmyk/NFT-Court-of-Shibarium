"use client";

import { Portal } from "./portal";

/** Compatibility entry point. Trading uses the same confirmed flow as /market. */
export function Marketplace() { return <Portal view="market"/>; }
export default Marketplace;
