import Link from "next/link";

export default function NotFound() {
  return (
    <>
      <h1>Page not found</h1>
      <p>
        There is no page at this address in the current release. Try <Link href="/browse">browsing the series</Link> or the{" "}
        <Link href="/sources">source documents</Link>.
      </p>
    </>
  );
}
