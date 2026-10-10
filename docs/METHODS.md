# Methods

This page explains, in plain words, how a number gets onto this site and what "checked" means.
The live figures for the current release (coverage, check results, status mix) are shown above
this text and in the dataset card on the Releases page.

## The promise

Every number on this site can be checked by you:

1. It links to the exact spot on the government page it came from (the receipt).
2. It passed at least one deterministic check before it was published.
3. It says what kind of figure it is: budget estimate, revised estimate, and so on.
4. If we cannot stand behind a number, we show a labelled gap instead of the number.

A missing number is acceptable. A wrong number is not.

## Where the documents come from

Each source document is downloaded from the publisher's own website (for example the Finance
Division for the Annual Budget Statement). For every file we record the web address, the time of
download, its size, its page count and a SHA-256 fingerprint. A program then confirms that the
file is the document it claims to be: the title words and the year must appear in its first
pages, and nearly every page must carry real text rather than a scanned image. Where a cover
page has no readable text, the file is accepted only if its contents page matches and the
official budget page for that year links to that exact file; the Sources page says so.

Where we also hold an older archived copy of the same document, we compare the two fingerprints
and say whether they are identical. If the official site has replaced a file since it was
archived, the Sources page shows that as a caveat.

We do not host the documents. Each receipt links to the official address and, where one exists,
to a snapshot in the Internet Archive's Wayback Machine.

## How numbers are read

A table-reading tool (Docling) converts each PDF, whole document at a time, into tables. The
tool's version and settings are recorded with every run, and a run is never overwritten.

**No language model reads, writes or judges any number on this site.** Language models were used
to write the software. The numbers are read by the extraction tool and judged by arithmetic.

The printed text of every cell is kept exactly as printed, next to the parsed value. Parsing is a
fixed set of rules: commas are thousands separators; a number in brackets is negative; dashes,
"n.a." and "nil" mean "no figure"; a year label such as 2024-25 is never treated as a value; a
cell that contains two numbers is treated as a reading error and withheld.

## Two separate questions: how much did we capture, and is it right?

These are different questions and we never merge them into one figure.

**Coverage** asks how much of the printed table was captured. A program counts the numbers in the
PDF's text layer inside the table's area and compares them with the numbers the extraction tool
produced for that table. It also looks across the full width of the page over the same rows, to
catch a column left outside the table. A table below the coverage threshold is not used.

**Accuracy** asks whether the captured numbers are right. The evidence is the checks below, and,
once it has been labelled by people, the gold set.

## The checks

| Check | What it tests |
|---|---|
| Column total | The rows of a table add up to the total printed under them. |
| Hierarchy sum | Sub-items add up to their parent line. |
| Accounting identity | For example, current plus development expenditure equals total expenditure. |
| Same figure, same page | A total printed twice on one page is the same both times. |
| Cross-edition | A figure printed in one year's document equals the same figure reprinted in the next year's document (this year's budget estimate appears again as last year's column). |
| Recompute | A rate or percentage recomputes from the counts printed beside it. |
| Cross-source | The figure agrees with another official publication. |

Printed tables are rounded, so a sum may differ from its printed total by a hair. The rule is
fixed in advance: an exact match passes; a difference of at most half a unit of the last printed
digit for each item added passes as "within rounding"; anything larger fails. The receipt says
which of the two it was. Two printings of the same figure must agree within one unit of the last
printed digit.

If a sum fails and nothing independently shows which number is wrong, every number in that sum is
withheld. We do not guess.

A sum on a table that the tool read badly (a lost column, two numbers merged into one cell) is
recorded as "could not be run", never as passed.

## What "checked" means

Status is worked out by a program from the stored check results. Nobody sets it by hand.

| Status on the site | What is behind it |
|---|---|
| **Checked** | At least one check passed. Internally: tier A when an arithmetic check passed *and* a second official printing agrees; tier B when one of those two is present. |
| **Not yet verified by us** | We have a reading, but no check covers it, or the table was not read cleanly, or the data type is still below a publication threshold. The value is not shown. |
| **We could not verify this figure; it is withheld** | A check failed or the reading was flagged. The value is not shown. |
| **Not published by the government** | The document does not print this line. |

The last three are gaps. They always say which kind they are.

## Thresholds, fixed before any result was seen

The publication thresholds were written and fingerprinted before the first extraction ran, and
the fingerprint is stored in every release. A data type that falls below a threshold is not
published at all; it is shown as "coming". Thresholds are never edited after results are seen; a
deviation would be recorded instead.

## Measured error rate: pending

Checks show that numbers are consistent with each other. They cannot prove that no number is
wrong. The absolute error rate comes from the gold set: a random sample of about 400 cells that
two people read from the page images without seeing the extracted values. That labelling has
not been done yet, so no error rate is claimed for this release.

## Kinds of figure, and breaks

- The Annual Budget Statement prints **budget estimates** and **revised estimates**. It prints no
  actual (audited) spending, so this site shows none for it.
- The ten function lines in the budget's Summary of Expenditure are **current expenditure on
  revenue account**. Development spending by function is not printed in that table.
- **Series breaks are marked and never smoothed over.** From 2011-12 the 18th Amendment moved
  many functions, including most of health and education, to the provinces: federal figures
  before and after are not comparable. The CPI was rebased to 2015-16 in 2019.
- **Derived figures** (for example health as a share of total expenditure) are computed by a
  program from two checked values. The formula and both inputs are on the receipt.

## Corrections

Releases are frozen and versioned. A published number is never changed silently: a correction
produces a new release and an entry on the errata page. Citations name the release, so a cited
number can always be found again.

## Reproducing it

Anyone can rebuild a release from the official sources using the manifest and the code. The
exact commands and the expected fingerprint of every input are in "How to reproduce" on the
Releases page.

## This is a prototype

This release is a prototype: it has no DOI, the series definitions are drafts, and the error
rate has not been measured. Do not cite it in publications yet. The government documents remain
the authority; if this site and a document disagree, the document is right, and we would like to
hear about it.
