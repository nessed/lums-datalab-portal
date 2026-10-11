# Gold set: how to label it

The gold set is the only source of an absolute error rate for the portal. It is a random sample
of printed cells that two humans read from the page images. **It is not labelled yet.** Until it
is, the portal says "measured error rate: pending".

No language model may label, pre-fill or "help with" the gold set (AGENTS.md section 4).

## What is here

| File | What it is |
|---|---|
| `sample.csv` | The sample: one row per cell, with the page image (the release's own page render under `releases/<version>/pages/`), the box, and the row and column labels. **The extracted value is deliberately not included**, so labelling is blind. |
| `sample.js` | The same rows as a script, so `label.html` works when opened straight from disk. |
| `sample_meta.json` | Release, random seed, strata and how many cells were drawn from each. |
| `label.html` | The labelling page. Open it in a browser; no server needed. |

The sample is drawn by `python -m datalab gold-sample --n 400 --seed 20261011` from the cells of
the release, stratified by data type, document and kind of row (breakdown line, total, other), in
proportion to how many cells each stratum holds, with at least one cell per stratum.

## Protocol

1. **Two labellers, working separately.** Ali and Ahmad each open `gold/label.html`, type their
   name, and label every cell. Don't talk about individual cells while labelling.
2. **Blind.** Type exactly what is printed inside the red box: digits, commas, brackets, minus
   signs, dashes, `n.a.`. Don't open the release, the site or the receipts while labelling.
3. If the box is empty, sits on text instead of a number, or can't be read, tick **Unreadable**
   and add a note. That is a finding too (a wrong box is an extraction error of its own kind).
4. Export your labels (button at the top) and save them as `gold/labels_<name>.csv`.
5. **Resolve disagreements against the page**, together, looking only at the page image. Record
   the resolved reading in both files (or in a third file `labels_resolved.csv` with the same
   columns). Never resolve a disagreement by looking at the extracted value.
6. **Freeze.** Write `gold/gold_manifest.json` with the SHA-256 of every labels file, the release
   version, the date and both names, and commit it. After that the labels are never edited; a
   mistake found later is recorded as a note, not a silent change.
7. **Score.** `python -m datalab gold-score gold/labels_ali.csv gold/labels_ahmad.csv` compares
   the agreed readings with the release and writes `gold/score.json`: the number of cells where
   both labellers agree, the number where the extracted value differs, and the error rate.
   Put that number in the next release's `release.json` (`measured_error_rate`) and dataset card.

Budget: about one hour for 400 cells between two people.

## What the number means

`error rate = cells where the agreed human reading differs from the extracted value / cells with
an agreed human reading`. It measures how right the captured values are. It is reported
separately from coverage (how much of each printed table was captured at all), never as one
figure.
