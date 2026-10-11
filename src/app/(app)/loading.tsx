import { PageLoader } from "@/components/page-loader";

/** While a page's data loads the sidebar stays put and a frosted three-dot loader sits in the middle. */
export default function Loading() {
  return <PageLoader />;
}
