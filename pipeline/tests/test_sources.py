"""Source registration checks on generated files only (PDFs made with PyMuPDF in tmp_path)."""
from __future__ import annotations

import pymupdf
import pytest

from datalab import config, sources


def make_pdf(path, pages: list[str]):
    doc = pymupdf.open()
    for text in pages:
        page = doc.new_page(width=600, height=800)
        y = 80
        for line in text.split("\n"):
            page.insert_text((60, y), line, fontsize=11)
            y += 18
    doc.save(path)
    doc.close()
    return path


NATIONAL = ["LABOUR FORCE SURVEY 2014-15\nGovernment of Pakistan\nPakistan Bureau of Statistics",
            "Foreword. This report presents the findings of the survey for the country.",
            "Table-8 Crude activity (participation) rates - Pakistan and Provinces (%)"]
REGIONAL = ["LABOUR FORCE SURVEY 2014-15\nGovernment of Pakistan\nPakistan Bureau of Statistics",
            "Foreword. This report presents the findings of the survey for the country.",
            "Table-8 Crude activity (participation) rates - Azad Jammu & Kashmir (%)"]


def test_body_markers_find_the_pages_of_the_whole_document(tmp_path):
    pdf = make_pdf(tmp_path / "national.pdf", NATIONAL)
    found = sources.body_marker_pages(pdf, ["pakistan and provinces", "azad jammu"])
    assert found == {"pakistan and provinces": [3], "azad jammu": []}
    assert sources.body_marker_problems({"pakistan and provinces": [3]}, {"azad jammu": []}) == []


def test_body_markers_reject_a_regional_edition_with_a_national_cover(tmp_path):
    """The cover check alone passes this file: the regional name is printed only in the table titles."""
    pdf = make_pdf(tmp_path / "regional.pdf", REGIONAL)
    cover = sources.inspect_pdf(pdf, ["labour force survey", "government of pakistan"], [], ["2014-15"], marker_pages=2)
    assert cover["markers_ok"] is True
    problems = sources.body_marker_problems(sources.body_marker_pages(pdf, ["pakistan and provinces"]),
                                            sources.body_marker_pages(pdf, ["azad jammu"]))
    assert len(problems) == 2 and "no page" in problems[0] and "page(s) [3]" in problems[1]


@pytest.fixture
def repo(tmp_path, monkeypatch):
    """A throwaway SOURCES_DIR, thresholds and verification folder; nothing touches the real ones."""
    src = tmp_path / "sources_dir"
    monkeypatch.setenv("SOURCES_DIR", str(src))
    monkeypatch.setenv("RA_SHIP_DIR", str(tmp_path / "no_archive"))
    monkeypatch.setattr(config, "VERIFICATION_DIR", tmp_path / "verification")
    monkeypatch.setattr(config, "MANIFEST_CSV", tmp_path / "manifest.csv")
    monkeypatch.setattr(sources, "landing_links_file", lambda *a, **k: None)
    monkeypatch.setattr(sources, "wayback_lookup", lambda *a, **k: None)
    return src


def lfs_entry(sha: str | None = None) -> dict:
    return {"source_id": "lfs-test", "doc_type": "lfs_annual_report", "publisher": "PBS", "jurisdiction": "pbs",
            "title": "LFS test", "period": "2014-15", "role": "core", "file_url": "https://example.invalid/lfs.pdf",
            "filename": "lfs.pdf", "markers_all": ["labour force survey"], "marker_period": True, "marker_pages": 2,
            "body_markers_all": ["pakistan and provinces"], "body_markers_none": ["azad jammu"],
            "prefetched": {"retrieved_via": "official", "retrieved_at": "2026-01-01T00:00:00Z", "sha256": sha}}


@pytest.mark.parametrize("pages,status", [(NATIONAL, "official_only"), (REGIONAL, "failed")])
def test_register_fails_a_file_whose_table_titles_name_another_region(repo, pages, status):
    make_pdf((repo / "lfs_annual_report" / "2014-15").mkdir(parents=True) or repo / "lfs_annual_report" / "2014-15" / "lfs.pdf", pages)
    source = sources.register_one(lfs_entry(), save_to_wayback=False)
    assert source.verification_status == status
    record = config.read_json(config.VERIFICATION_DIR / "lfs-test.json")
    assert ("azad jammu" in record.get("reason", "")) == (status == "failed")


# ----------------------------------------------------------------------------- data files (CSV)

CSV_HEADER = '"Dataset","Series Key","Series","Observation Date","Observation Value","Unit"\n'
CSV_GOOD = CSV_HEADER + '"Snapshot (New Base: 2015-16)","K.1","CPI National -YoY","30-Jun-2025","7.5","Percent"\n'
PATTERNS = {"Dataset": r"New Base: 2015-16", "Series Key": r"^K\.1$", "Unit": "^Percent$"}
COLUMNS = ["Dataset", "Series Key", "Series", "Observation Date", "Observation Value", "Unit"]


def test_data_file_inspection_accepts_only_the_described_series(tmp_path):
    good = tmp_path / "good.csv"
    good.write_text(CSV_GOOD, encoding="utf-8")
    out = sources.inspect_data_file(good, COLUMNS, PATTERNS)
    assert out["markers_ok"] and out["rows"] == 1 and out["descriptive_values"]["Unit"] == ["Percent"]

    other_base = tmp_path / "other.csv"
    other_base.write_text(CSV_GOOD.replace("2015-16", "2007-08"), encoding="utf-8")
    assert not sources.inspect_data_file(other_base, COLUMNS, PATTERNS)["markers_ok"]

    no_column = tmp_path / "nocol.csv"
    no_column.write_text('"Series Key","Observation Value"\n"K.1","7.5"\n', encoding="utf-8")
    out = sources.inspect_data_file(no_column, COLUMNS, PATTERNS)
    assert not out["markers_ok"] and "columns missing" in out["problems"][0]

    empty = tmp_path / "empty.csv"
    empty.write_text(CSV_HEADER, encoding="utf-8")
    assert not sources.inspect_data_file(empty, COLUMNS, PATTERNS)["markers_ok"]


def sbp_entry(sha: str) -> dict:
    return {"source_id": "sbp-test", "doc_type": "sbp_easydata", "publisher": "SBP", "jurisdiction": "sbp",
            "title": "SBP test", "period": "2026-01-01", "role": "cross_source",
            "file_url": "https://example.invalid/form", "filename": "data.csv", "csv_columns_all": COLUMNS,
            "csv_column_patterns": PATTERNS, "terms_note": "terms not confirmed", "credentials_note": "no key used",
            "prefetched": {"retrieved_via": "official", "retrieved_at": "2026-01-01T00:00:00Z", "sha256": sha,
                           "request": {"method": "POST", "url": "https://example.invalid/form"}}}


def test_register_a_prefetched_data_file_records_request_hash_and_terms(repo):
    dest = repo / "sbp_easydata" / "2026-01-01" / "data.csv"
    dest.parent.mkdir(parents=True)
    dest.write_text(CSV_GOOD, encoding="utf-8")
    source = sources.register_one(sbp_entry(config.sha256_file(dest)), save_to_wayback=False)
    assert (source.verification_status, source.format, source.page_count, source.role) == ("official_only", "csv", None, "cross_source")
    assert source.sha256 == config.sha256_file(dest) and source.retrieved_at == "2026-01-01T00:00:00Z"
    record = config.read_json(config.VERIFICATION_DIR / "sbp-test.json")
    assert record["request"]["method"] == "POST" and record["terms_note"] and record["credentials_note"]
    assert record["reproducible_by_url"] is False


def test_register_fails_a_data_file_that_changed_since_it_was_downloaded(repo):
    dest = repo / "sbp_easydata" / "2026-01-01" / "data.csv"
    dest.parent.mkdir(parents=True)
    dest.write_text(CSV_GOOD, encoding="utf-8")
    source = sources.register_one(sbp_entry("0" * 64), save_to_wayback=False)
    assert source.verification_status == "failed"


def test_a_data_file_that_is_not_on_disk_is_never_requested_by_url(repo, monkeypatch):
    def no_network(*a, **k):
        raise AssertionError("a form download must not be requested by GET")
    monkeypatch.setattr(sources, "download", no_network)
    assert sources.register_one(sbp_entry("0" * 64), save_to_wayback=False) is None
    assert config.read_json(config.VERIFICATION_DIR / "sbp-test.json")["verification_status"] == "failed"


def test_fetch_does_not_write_a_guess_for_a_data_file(repo, monkeypatch, capsys):
    dest = repo / "sbp_easydata" / "2026-01-01" / "data.csv"
    dest.parent.mkdir(parents=True)
    dest.write_text(CSV_GOOD, encoding="utf-8")
    source = sources.register_one(sbp_entry(config.sha256_file(dest)), save_to_wayback=False)
    sources.write_manifest([source])
    dest.unlink()
    monkeypatch.setattr(sources, "download", lambda *a, **k: (_ for _ in ()).throw(AssertionError("no GET")))
    assert sources.fetch() == 0          # a cross-source file does not block a rebuild
    assert not dest.exists() and "NOT FETCHABLE BY URL" in capsys.readouterr().out


JULY_ISSUE = ["Monthly Review" + chr(10) + "on" + chr(10) + "Price Indices" + chr(10) + "July 2025" + chr(10) + "(Base Year 2015-16)",
              "Inflation in Brief" + chr(10) + "CPI inflation General increased to 4.1% in July 2025 against 3.2% in June 2025."]
JUNE_COVER = r"monthly review on price indices june ?,? ?2025 \(base (year )?2015-16\)"
JULY_COVER = r"monthly review on price indices july ?,? ?2025 \(base (year )?2015-16\)"


def test_a_month_named_inside_the_next_issue_does_not_identify_it(tmp_path):
    """The July issue prints "June 2025" too. Only the cover line (title, month, year, base together) says which issue it is."""
    pdf = make_pdf(tmp_path / "Monthly-Review-June-2025.pdf", JULY_ISSUE)      # a misleading file name on purpose
    plain = sources.inspect_pdf(pdf, [], ["monthly review"], ["june 2025"], marker_pages=2)
    assert plain["markers_ok"] is True                                         # the weak marker is fooled
    as_june = sources.inspect_pdf(pdf, [], ["monthly review"], ["june 2025"], marker_pages=2, markers_regex_all=[JUNE_COVER])
    assert as_june["markers_ok"] is False and as_june["markers"]["regex_all"] == {JUNE_COVER: False}
    as_july = sources.inspect_pdf(pdf, [], ["monthly review"], ["july 2025"], marker_pages=2, markers_regex_all=[JULY_COVER])
    assert as_july["markers_ok"] is True
    old_base = JULY_COVER.replace("2015-16", "2007-08")
    assert sources.inspect_pdf(pdf, [], [], [], marker_pages=2, markers_regex_all=[old_base])["markers_ok"] is False


def test_register_fails_a_monthly_issue_whose_cover_names_another_month(repo):
    def entry(period: str, month: str, cover: str) -> dict:
        folder = repo / "cpi_monthly_review" / period
        folder.mkdir(parents=True)
        pdf = make_pdf(folder / "review.pdf", JULY_ISSUE)
        return {"source_id": f"cpi-test-{period}", "doc_type": "cpi_monthly_review", "publisher": "PBS", "jurisdiction": "pbs",
                "title": f"Monthly Review, {month}", "period": period, "role": "core",
                "file_url": "https://example.invalid/review.pdf", "filename": "review.pdf", "markers_any": ["monthly review"],
                "markers_period": [month.lower()], "marker_pages": 2, "markers_regex_all": [cover],
                "prefetched": {"retrieved_via": "official", "retrieved_at": "2026-01-01T00:00:00Z",
                               "sha256": config.sha256_file(pdf)}}

    as_june = sources.register_one(entry("2025-06", "June 2025", JUNE_COVER), save_to_wayback=False)
    assert as_june.verification_status == "failed"
    record = config.read_json(config.VERIFICATION_DIR / "cpi-test-2025-06.json")
    assert record["reason"] == "expected text markers not found in the first pages"
    assert record["inspection"]["markers"]["period"] == {"june 2025": True}   # the plain marker alone would have passed it
    as_july = sources.register_one(entry("2025-07", "July 2025", JULY_COVER), save_to_wayback=False)
    assert as_july.verification_status == "official_only"


class FakeResponse:
    def __init__(self, status_code: int, rows: list | None = None):
        self.status_code, self._rows, self.text = status_code, rows, "x" if rows is not None else ""

    def json(self):
        return self._rows


@pytest.mark.parametrize("answers,outcome,found", [
    ([504, 429, 200], "snapshot_found", True),        # busy twice, then the listing
    ([504, 504, 504], "http_504", False),             # still busy: recorded as such, not as "no snapshot"
    ([200], "snapshot_found", True),
    ([404], "http_404", False),                       # not a busy answer: no retry
])
def test_wayback_lookup_backs_off_when_the_index_is_busy(monkeypatch, answers, outcome, found):
    calls = []
    listing = [["timestamp", "original", "digest", "length"], ["20220703003819", "https://example.invalid/a.pdf", "DIGEST", "10"]]

    class FakeSession:
        def get(self, *a, **k):
            calls.append(1)
            status = answers[len(calls) - 1]
            return FakeResponse(status, listing if status == 200 else None)

    monkeypatch.setattr(sources, "_session", lambda: FakeSession())
    monkeypatch.setattr(sources.time, "sleep", lambda s: None)
    log: list[dict] = []
    snap = sources.wayback_lookup("https://example.invalid/a.pdf", log)
    assert (snap is not None) is found and log[-1]["outcome"] == outcome and len(calls) == len(answers)
    if found:
        assert snap["wayback_timestamp"] == "20220703003819" and snap["snapshot_digest"] == "DIGEST"


def test_wayback_lookup_reports_no_snapshot_only_when_the_index_answered(monkeypatch):
    class FakeSession:
        def get(self, *a, **k):
            return FakeResponse(200, [])

    monkeypatch.setattr(sources, "_session", lambda: FakeSession())
    log: list[dict] = []
    assert sources.wayback_lookup("https://example.invalid/a.pdf", log) is None and log[-1]["outcome"] == "no_snapshot"
