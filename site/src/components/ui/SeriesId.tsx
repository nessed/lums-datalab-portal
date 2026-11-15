// SeriesId: the series id in monospace beside a title, with a small Copy button
// (like FRED's CPIAUCSL). The id is plain selectable text annotated
// data-num="id"; the Copy button is a tiny client island shown only when
// JavaScript runs (.js-only), so without JavaScript nothing is inert on screen.
//   <h1>Inflation, national <SeriesId id={series.series_id} /></h1>
//   <SeriesId id={series.series_id} copy={false} />   (id only)
// Styles: .series-id in src/styles/base.css.
import CopyButton from "./CopyButton";
import { Num } from "./Num";

export default function SeriesId({ id, copy = true, className }: { id: string; copy?: boolean; className?: string }) {
  return (
    <span className={`series-id${className ? ` ${className}` : ""}`}>
      <span className="sr-only">Series id </span>
      <Num kind="id" className="series-id-code">
        {id}
      </Num>
      {copy ? (
        <span className="js-only">
          <CopyButton text={id} label="Copy" name="Copy series id" className="series-id-copy" />
        </span>
      ) : null}
    </span>
  );
}
