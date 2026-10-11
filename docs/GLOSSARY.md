# Glossary

Every term a newcomer meets on the site, in the reports or in the code, in one or two plain
sentences. Where a term is a field or a value in the release files, its exact spelling is given in
`code style`. The rules behind these terms are in `docs/METHODS.md`; the fields are in
`docs/SCHEMA.md`; a worked example is in `docs/HOW_A_NUMBER_GETS_ON_THE_SITE.md`.

## The documents

**Annual Budget Statement (ABS).** A document the Finance Division publishes with each year's
federal budget. It prints the government's planned spending for the coming year (budget
estimates) beside the budget and revised estimates for the year that is ending.

**Consumer Price Index (CPI).** The index the Pakistan Bureau of Statistics publishes each month
in its Monthly Review of Price Indices. It measures how the price of a fixed basket of goods and
services changes.

**Labour Force Survey (LFS).** A household survey by the Pakistan Bureau of Statistics. Its annual
report prints how many people work, how many are looking for work, and in which industries.

**Economic Survey (PES).** The Pakistan Economic Survey, published by the Finance Division before
each budget. Here it is used only to compare figures with, never as the source of a value.

**SBP EasyData.** The State Bank of Pakistan's data service. One of its series is used to compare
the CPI inflation rate with; it never supplies a value.

**Source.** One original file, exactly as the publisher issued it. Each has an id such as
`abs-fed-2025-26`.

**Edition, issue, round.** One year's Annual Budget Statement is an edition. One month's CPI review
is an issue. One year's Labour Force Survey is a round.

**Manifest.** The list of every source file (`sources/manifest.csv`): where it came from, when it
was downloaded, its size and its fingerprint. The files themselves are not kept in the repository.

**SHA-256, fingerprint, hash.** A short code computed from a file's contents. If one byte of the
file changes, the code changes, so two files with the same code are the same file.

**Verification status.** The result of checking that a downloaded file is the document it claims
to be (`verification_status`). A file whose status is `failed` is never used.

**Wayback Machine.** The Internet Archive's store of old copies of web pages and files. It is the
fallback when an official address no longer works, and every receipt links to a snapshot where
one exists.

**Born-digital, scanned.** A born-digital PDF carries real text that a program can read. A scanned
PDF is a picture of a page. Scanned documents are not processed on the normal track.

**Text layer.** The real text inside a born-digital PDF, as opposed to the picture of the page.

## Kinds of figure

**Budget estimate.** What the government plans to spend or collect in the coming year, as printed
in that year's budget (`vintage: be`).

**Revised estimate.** The government's updated figure for a year that is ending, printed in the
next year's budget (`vintage: re`).

**Actual.** What was really spent or collected, after the accounts are closed. The Annual Budget
Statement prints no actual figures, so the site shows none for it.

**Provisional, final.** A provisional figure is published early and may still change. A final
figure is the publisher's last word on it.

**Vintage.** Which kind of figure a number is: budget estimate, revised estimate, actual,
provisional, final or rebased. The CPI and the Labour Force Survey print only one kind, so their
figures carry `vintage: na`.

**Current expenditure.** Spending on running the government: salaries, interest, subsidies, grants.

**Development expenditure.** Spending on projects that build something lasting, such as roads and
dams.

**Revenue account, capital account.** The two halves of the government's books. The revenue
account holds ordinary income and running costs. The capital account holds borrowing, lending and
the repayment of loans.

**Function.** A purpose of spending, such as health, education or defence. The Annual Budget
Statement lists ten functions and, under each, sub-functions.

**Public Sector Development Programme (PSDP).** The federal government's yearly list of
development projects and the money set aside for them.

**Fiscal year.** Pakistan's financial year runs from 1 July to 30 June. It is written with both
calendar years: 2025-26 is the year that ends on 30 June 2026.

**Base year, rebased.** An index compares prices with a chosen year, the base year, which is set
to 100. When the publisher moves to a new base year the index is rebased, and figures on the old
and the new base cannot be put on one line.

**Month on month, year on year.** A month-on-month change compares a month with the month before.
A year-on-year change compares it with the same month a year earlier.

**Basket weight.** The share of a group of goods, such as food, in the CPI basket. The weights of
all groups add up to 100.

## How the data is organised

**Series.** One thing that is measured over time, such as federal current expenditure on health.
Each has an id such as `fed.exp.current.function.health`.

**Period.** The time a figure refers to: a fiscal year (`2025-26`), a month (`2026-06`) or a
survey round.

**Cell.** One printed number in one file: its page, its place in the table, the box around it and
the exact text printed there. A cell is a reading, not yet a fact.

**Observation.** One fact, identified by series, period and vintage, for example
`fed.exp.current.function.health:2025-26:be`. One or more cells support it.

**Primary cell, supporting cells.** The primary cell is the printing a published value is taken
from: the earliest document that prints the figure. Supporting cells are the other places where
the same figure is printed.

**Printed text and parsed value.** The printed text (`value_raw`) is what is on the page,
character for character. The parsed value (`value_parsed`) is the number a fixed set of rules
makes of it. Both are always kept.

**Normalisation.** Turning printed text into a number by fixed rules: commas are thousands
separators, a number in brackets is negative, a dash means no figure.

**Normalisation flag.** A note that a rule had to do something to the printed text, such as
reading brackets as a minus sign (`normalization_flags`).

**Structural flag.** A note that a table was read badly, for example two numbers merged into one
cell or a column lost (`structural_flags`). Figures from a flagged table are not published from
that reading.

**Scale.** What one unit of a printed number stands for. A table headed "Rs in million" has a
scale of 1,000,000 (`scale_factor`).

**Label dictionary.** The list of row labels the pipeline recognises and the series each one
belongs to. A label that is not in the dictionary stays unmapped and is never published.

**Derived figure.** A figure a program computes from two checked figures, such as health as a
share of total expenditure. The formula and both inputs are shown on its receipt.

**Series break.** A point where what a series measures changes, so the figures before and after
cannot be compared. Examples are the transfer of many functions to the provinces from 2011-12 and
the CPI's move to a new base year in 2019. Breaks are marked and never smoothed over.

**Receipt.** The page for one figure. It shows the value, the status, the image of the government
page with a box around the number, the checks the figure took part in, and links to the document.

**Release.** A frozen, versioned folder holding everything the site shows: sources, series, cells,
checks, observations and page images. A published release is never changed silently.

**Erratum.** A public note of a correction to a published figure. Corrections make a new release;
the old one stays as it was, so a citation never breaks.

## Reading the documents

**Extraction.** Reading the tables out of a PDF with a tool. The tool here is Docling.

**Run.** One pass of the extraction tool over one document. Every run has an id, records the
tool's version and settings, and is never overwritten.

**Full-document run, page-range run.** A full-document run reads the whole file. A page-range run
reads only some pages, and is used for very long reports; it never supplies its first or its
last page.

**Validation.** A separate program's check that a run is complete: the file is unchanged, every
page is accounted for and no error was logged. Only the validator marks a run as valid.

**Second reader.** A second tool (pdfplumber) that reads a table again when the first tool
visibly misread its structure. Its reading is used only if the table's own arithmetic then passes
on it.

**Coverage.** How much of a printed table was captured: the numbers the tool returned, as a share
of the numbers printed in the table's area. Coverage says nothing about whether the captured
numbers are right, and it is never merged with accuracy into one figure.

**Accuracy.** Whether the captured numbers are right. The evidence is the checks and, once it is
labelled, the gold set.

## Checks

**Check.** One deterministic test over printed numbers, stored with its result. Checks are
arithmetic; no person and no language model decides one.

**Column total, row total.** The rows of a table add up to the total printed under them, or the
columns add up to the total printed beside them.

**Hierarchy sum.** Sub-items add up to their parent line.

**Accounting identity.** A relation that must hold by definition, such as current plus development
expenditure equals total expenditure.

**Cross-table.** A figure printed in a summary table equals the same figure in the detail table of
the same document.

**Cross-edition.** A figure printed in one year's document equals the same figure reprinted in the
next year's document.

**Cross-source.** A figure agrees with another official publication that prints the same thing for
the same period in the same unit.

**Recompute.** A rate or percentage is worked out again from the numbers printed beside it and
compared with the printed rate.

**Reference value.** A printed figure is compared with a recorded constant, such as a CPI group's
basket weight. It ties a row's figures to its name.

**Residual.** What a check found minus what it expected. A residual of zero is an exact match.

**Tolerance, within rounding.** Printed tables are rounded, so a sum may miss its printed total by
a hair. A check passes "within rounding" when the difference is no more than half a unit of the
last printed digit for each number added. Two printings of one figure must agree within one unit
of the last printed digit.

**Check results.** `pass` (exact), `pass_within_rounding`, `fail`, `not_evaluable` (the check could
not be run, for example on a badly read table) and `disputed`.

## Status

**Status.** What the site says about a figure: checked, disputed, or one of the kinds of gap. A
program works it out from the stored check results. Nobody sets it by hand.

**Checked.** At least one check passed, and the figure's tier is A or B (see Tier). Only checked
figures show a value.

**Tier.** The internal grade behind a status. Tier A: an arithmetic check passed and a second
official printing agrees. Tier B: one of those two. Tier C: no check covers the figure. Tier D: a
check failed and no other official printing confirms the figure, or the reading was flagged. Tiers A and B are published as "checked"; C and D are
not published.

**Disputed.** Two official documents print different figures for the same thing, and each printing
adds up in its own table. That is a restatement by the publisher, not a reading error. Both
printings are shown with their pages and neither is published as checked.

**Gap.** A place where the site shows no value. Every gap says which kind it is.

**Gap kinds.** `not_in_source`: the government did not publish this figure. `not_yet_verified`: we
have a reading, but no check covers it or the table was not read cleanly. `failed_checks`: a check
failed or the reading was flagged, so the figure is withheld. `disputed`: see above.

**Withheld.** We have a reading but do not show it, because we cannot stand behind it.

**Published.** Shown on the site with a value. Only checked figures of a data type that meets
every threshold are published.

**Threshold.** A minimum that a whole data type must reach before any of it is published, for
coverage, for the share of checks passed and for cross-edition agreement. Thresholds were fixed
before the first result was seen and are never edited afterwards.

**Deviation.** A recorded departure from a rule or a threshold definition that was fixed in
advance. It is written down with its reason and waits for a human to confirm it.

**Coming.** How the site labels a data type that is processed but does not yet meet a threshold.

## Measuring error

**Gold set.** A random sample of about 400 printed cells that two people read from the page images
without seeing the extracted values. It is the only source of an absolute error rate, and it has
not been labelled yet.

**Blind labelling.** The labeller sees the page and the box but not the value the pipeline
extracted, so the label cannot be influenced by it.

**Error rate.** Among the cells that both labellers could read and read the same way, the share
where the extracted value differs from their reading. Cells that a labeller could not read, and
cells the two read differently, are counted separately and are not part of the rate.

**Inter-rater agreement.** How often the two labellers come to the same result. Raw agreement is
the plain share of cells on which they agree.

**Cohen's kappa.** Agreement between two labellers after taking out the agreement that chance
alone would produce. It is 1 for perfect agreement and 0 for agreement no better than chance.

## Tools and reports

**Sanity report.** A list for humans of things worth a look in a release: large jumps, changes of
sign, series that some documents print and others do not, checks that passed only just. It is a
report and changes nothing (`datalab sanity`).

**Source-change check.** A single pass that asks each official address whether its file is still
the one that was registered (`datalab watch --dry-run`). It writes nothing.

**Release diff.** A comparison of two release folders that says whether they hold the same data,
leaving aside run ids and timestamps (`datalab diff-release`).

**Reproduction.** Rebuilding a release from a clean copy of the code and freshly downloaded
sources, then comparing the result with the published release.

**Language model (LLM).** A program that produces text, such as the assistants used to write this
project's code. No language model reads, writes, corrects or judges any number here, and none
labels the gold set.
