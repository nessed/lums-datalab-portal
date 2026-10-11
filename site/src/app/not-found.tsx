import Link from "next/link";

export default function NotFound() {
  return (
    <div className="not-found">
      <p className="kicker">Not found</p>
      <h1>There is no page at this address in the current release.</h1>
      <p className="lede">
        If you followed a link to a figure, it may belong to a series this release does not publish, or the address may be mistyped. Figure addresses
        look like <code>/o/series~period~kind</code>.
      </p>
      <ul className="nf-links">
        <li>
          <Link href="/browse">Browse the catalogue</Link>, or press <kbd>/</kbd> to search
        </li>
        <li>
          <Link href="/sources">The source documents</Link>
        </li>
        <li>
          <Link href="/releases">Releases and errata</Link>: a figure that changed is listed there
        </li>
        <li>
          <Link href="/">Home</Link>
        </li>
      </ul>
    </div>
  );
}
