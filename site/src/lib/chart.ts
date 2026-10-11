// Server side: the chart model of a series from the release. The model
// itself is built by the pure chartModelFrom() in chart-model.ts, which the
// browser also uses (compare page). Number() is used only for geometry.
import { db, type Series } from "./data";
import { chartModelFrom, type ChartModel } from "./chart-model";
export type { ChartBreak, ChartLine, ChartMark, ChartModel, ChartPoint, LineStyle } from "./chart-model";
export { canConnect, periodOrdinal } from "./chart-model";

export function buildChart(series: Series): ChartModel {
  return chartModelFrom(series, db().obsBySeries.get(series.series_id) ?? []);
}
