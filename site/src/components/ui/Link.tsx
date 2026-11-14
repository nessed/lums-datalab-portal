// The site's only link component. Same as next/link, but never prefetches a
// page because it scrolled into view (DESIGN.md 14.2 rule 1): on a slow phone
// that cost the home page 1.7 MB of background downloads, page images included.
// A page still loads instantly enough on click; nothing is fetched unasked.
import NextLink from "next/link";
import type { ComponentProps } from "react";

export default function Link({ prefetch = false, ...rest }: ComponentProps<typeof NextLink>) {
  return <NextLink prefetch={prefetch} {...rest} />;
}
