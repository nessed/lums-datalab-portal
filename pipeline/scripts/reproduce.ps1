<#
.SYNOPSIS
Rebuild a release from a clean clone and compare it with the committed release (plan item E5).

.DESCRIPTION
This script tests the promise "anyone can rebuild it from the raw sources". It does, in order:

  1. A fresh clone of the current branch (committed state only) into <ScratchDir>\repo.
  2. A fresh virtual environment from pipeline\requirements.lock.
  3. `datalab fetch` into a fresh, empty SOURCES_DIR at <ScratchDir>\sources. Every file is checked
     against the SHA-256 in sources\manifest.csv.
  4. New extraction runs:
       a. first, the runs that `datalab all` cannot make by itself, read from the committed
          release's own run manifests (releases\<Version>\runs): page-range runs of the long
          Labour Force Survey reports (decision D18) and runs of cross-source documents
          (Economic Survey chapters);
       b. then `datalab all --dataset abs`, `cpi` and `lfs` (the last with --reuse-runs, so the
          page-range runs from 4a are used instead of full-document runs of 200 to 400 pages).
  5. `datalab release --version <Version>` inside the clone, then `datalab check-release`.
  6. `datalab diff-release` between the committed release (copied aside before step 5) and the
     rebuilt one. The script's exit code is the exit code of that diff: 0 same data, 1 different.

Everything is written under <ScratchDir>. The repository this script is started from is only
read (decision D36: a reproduction makes new run ids and never touches the repo's work folder).

IT TAKES HOURS. The runs in v0.0.1-prototype took about 3 hours of Docling time on the machine
that built it, one run at a time. The first run also downloads Docling's models.

WHAT CANNOT BE REPRODUCED BY URL, AND WHAT THE SCRIPT DOES THEN
(see docs\reports\track_sources.md, sections 1.2 and 4, and AGENTS.md section 7)

  * The SBP EasyData CSV (source sbp-easydata-cpi-national-yoy). The public download is a form
    submission bound to a browser session, and the documented API answers 401 without a key.
    `datalab fetch` prints "NOT FETCHABLE BY URL" for it and writes nothing. The CPI build then
    skips the CPI-against-SBP comparison. The script continues. In the final diff, expect the
    cross_source checks of rule `cpi.yoy_matches_sbp_easydata` to be "only in A", and the
    observations those checks supported to show a tier difference. The diff then exits with 1 for
    that reason alone. To avoid it, pass -SbpCsv <path to the CSV someone already holds>: the
    script copies it into the fresh SOURCES_DIR only if its SHA-256 equals the one in the manifest,
    and refuses otherwise. It never downloads or guesses that file.

  * Files that exist only in the Wayback Machine (in v0.0.1-prototype: the CPI Monthly Reviews of
    June 2016, 2018, 2019 and 2021; the official PBS addresses answer 404). `datalab fetch` tries
    the official address, then the recorded Wayback snapshot. The Wayback Machine limits request
    rates and sometimes refuses. If `datalab fetch` reports a problem, the script waits
    -FetchRetryMinutes and tries again, at most -FetchAttempts times in all (files already fetched
    are not requested again). If a file still cannot be obtained with the right hash, the script
    STOPS with exit code 2 before any extraction: a release built without one of its sources is
    not a reproduction, and comparing it would only produce noise. Run the script again later
    with a new scratch folder, or pass -RaShipDir so that `datalab fetch` may fall back to the
    archive copy recorded in the file's verification record (hash-checked like every other route;
    the four Wayback-only CPI files have no archive copy, so this does not help for them).

  * A file the publisher has reissued under the same address fails its hash check in the same
    way and is handled the same way (exit code 2). That is a finding to record, not to work around.

.PARAMETER ScratchDir
A folder OUTSIDE the repository. It must not exist yet, or must be empty.

.PARAMETER Version
The release version to rebuild and compare, for example v0.0.1-prototype.

.PARAMETER SbpCsv
Optional. An existing copy of the SBP EasyData CSV. Used only if its SHA-256 equals the manifest's.

.PARAMETER RaShipDir
Optional. The read-only ra-ship archive, as a last fallback for `datalab fetch`. Never written to.

.PARAMETER PythonLauncher
The command that starts Python 3.12. Default: py, with -PythonLauncherArgs "-3.12". To use another
command, pass both, for example -PythonLauncher python -PythonLauncherArgs @().

.PARAMETER FetchAttempts
How many times `datalab fetch` is run in all before giving up (default 3).

.PARAMETER FetchRetryMinutes
Minutes to wait between two attempts (default 10).

.EXAMPLE
powershell -ExecutionPolicy Bypass -File pipeline\scripts\reproduce.ps1 -ScratchDir D:\datalab-repro -Version v0.0.1-prototype

.NOTES
Exit codes: 0 the rebuilt release holds the same data; 1 it differs (read the diff printed last);
2 the reproduction could not be carried out (a source could not be fetched, or a step failed).
Written for Windows PowerShell 5.1 and later. Run one copy at a time: Docling uses every core.
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$ScratchDir,
    [Parameter(Mandatory = $true)][string]$Version,
    [string]$SbpCsv = "",
    [string]$RaShipDir = "",
    [string]$PythonLauncher = "py",
    [string[]]$PythonLauncherArgs = @("-3.12"),
    [int]$FetchAttempts = 3,
    [int]$FetchRetryMinutes = 10
)

Set-StrictMode -Version 2.0
$ErrorActionPreference = "Stop"

function Write-Step([string]$Text) {
    Write-Host ""
    Write-Host ("=== " + (Get-Date -Format "yyyy-MM-dd HH:mm:ss") + "  " + $Text)
}

function Stop-Reproduction([string]$Text) {
    Write-Host ""
    Write-Host ("REPRODUCTION NOT CARRIED OUT: " + $Text)
    exit 2
}

# Runs a native command and returns its exit code. Output goes to the console as it comes.
function Invoke-Native([string]$Exe, [string[]]$Arguments) {
    # Local to this function: a tool that writes progress to stderr (git, pip) must not end the script.
    $ErrorActionPreference = "Continue"
    Write-Host ("> " + $Exe + " " + ($Arguments -join " "))
    & $Exe @Arguments | Out-Host
    return $LASTEXITCODE
}

# Runs a native command that must succeed.
function Invoke-Required([string]$Exe, [string[]]$Arguments, [string]$What) {
    $code = Invoke-Native $Exe $Arguments
    if ($code -ne 0) { Stop-Reproduction ($What + " failed with exit code " + $code + ".") }
}

# ---------------------------------------------------------------- where things are

# This file is <repo>\pipeline\scripts\reproduce.ps1.
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path.TrimEnd("\")
$Scratch = [System.IO.Path]::GetFullPath($ScratchDir).TrimEnd("\")

if (($Scratch + "\").StartsWith($RepoRoot + "\", [System.StringComparison]::OrdinalIgnoreCase)) {
    Stop-Reproduction "ScratchDir is inside the repository. Choose a folder outside it."
}
if (Test-Path $Scratch) {
    if (@(Get-ChildItem -Force $Scratch).Count -gt 0) {
        Stop-Reproduction "ScratchDir exists and is not empty. A reproduction starts from an empty folder."
    }
} else {
    New-Item -ItemType Directory -Force $Scratch | Out-Null
}

$Clone = Join-Path $Scratch "repo"
$SourcesDir = Join-Path $Scratch "sources"
$WorkDir = Join-Path $Scratch "work"
$Expected = Join-Path $Scratch "expected-release"
$Python = Join-Path $Clone "pipeline\.venv\Scripts\python.exe"

$Branch = (& git -C $RepoRoot rev-parse --abbrev-ref HEAD).Trim()
$Commit = (& git -C $RepoRoot rev-parse HEAD).Trim()
if ($LASTEXITCODE -ne 0 -or $Branch -eq "" -or $Branch -eq "HEAD") {
    Stop-Reproduction "could not read the current branch of the repository (a detached HEAD cannot be cloned by branch name)."
}
$Dirty = @(& git -C $RepoRoot status --porcelain)
if ($Dirty.Count -gt 0) {
    Write-Host ("NOTE: the repository has " + $Dirty.Count + " uncommitted change(s). The clone holds committed files only, so they are not part of this reproduction.")
}

# `datalab` reads SOURCES_DIR, WORK_DIR and RA_SHIP_DIR from the environment before it reads .env,
# so values left in this shell would silently point the clone at the real folders. They are set
# here for this process and put back at the end.
$SavedEnv = @{}
foreach ($name in @("SOURCES_DIR", "WORK_DIR", "RA_SHIP_DIR")) { $SavedEnv[$name] = [Environment]::GetEnvironmentVariable($name, "Process") }

$ExitCode = 2
try {
    $env:SOURCES_DIR = $SourcesDir
    $env:WORK_DIR = $WorkDir
    if ($RaShipDir -ne "") { $env:RA_SHIP_DIR = (Resolve-Path $RaShipDir).Path } else { Remove-Item Env:RA_SHIP_DIR -ErrorAction SilentlyContinue }

    # ------------------------------------------------------------ 1. fresh clone
    Write-Step ("1/6 Fresh clone of branch " + $Branch + " at " + $Commit.Substring(0, 12))
    Invoke-Required "git" @("clone", "--no-hardlinks", "--single-branch", "--branch", $Branch, $RepoRoot, $Clone) "git clone"
    $CloneCommit = (& git -C $Clone rev-parse HEAD).Trim()
    if ($CloneCommit -ne $Commit) { Stop-Reproduction "the clone is not at the commit the repository is at." }

    $CommittedRelease = Join-Path $Clone ("releases\" + $Version)
    if (-not (Test-Path (Join-Path $CommittedRelease "release.json"))) {
        Stop-Reproduction ("the branch has no committed release " + $Version + ".")
    }
    # The rebuild in step 5 overwrites releases\<Version> inside the clone, so the committed copy
    # is put aside first. Page images are not needed for the comparison.
    New-Item -ItemType Directory -Force $Expected | Out-Null
    Copy-Item -Path (Join-Path $CommittedRelease "*.json") -Destination $Expected
    Copy-Item -Path (Join-Path $CommittedRelease "runs") -Destination $Expected -Recurse

    # An .env for anyone who later works in the clone by hand. No secrets in it.
    $envLines = @("SOURCES_DIR=" + ($SourcesDir -replace "\\", "/"), "WORK_DIR=" + ($WorkDir -replace "\\", "/"))
    if ($RaShipDir -ne "") { $envLines += ("RA_SHIP_DIR=" + ($env:RA_SHIP_DIR -replace "\\", "/")) }
    [System.IO.File]::WriteAllLines((Join-Path $Clone ".env"), [string[]]$envLines)   # UTF-8 without a byte-order mark
    New-Item -ItemType Directory -Force $SourcesDir, $WorkDir | Out-Null

    # ------------------------------------------------------------ 2. fresh environment
    Write-Step "2/6 Fresh virtual environment from pipeline\requirements.lock"
    Invoke-Required $PythonLauncher ($PythonLauncherArgs + @("-m", "venv", (Join-Path $Clone "pipeline\.venv"))) "creating the virtual environment"
    Invoke-Required $Python @("-m", "pip", "install", "--disable-pip-version-check", "-r", (Join-Path $Clone "pipeline\requirements.lock")) "pip install -r requirements.lock"
    Invoke-Required $Python @("-m", "pip", "install", "--disable-pip-version-check", "--no-deps", "-e", (Join-Path $Clone "pipeline")) "pip install -e pipeline"

    # Every datalab command runs from the clone's pipeline folder, so the clone's code is the code used.
    Push-Location (Join-Path $Clone "pipeline")
    try {
        $where = (& $Python -c "import datalab, pathlib; print(pathlib.Path(datalab.__file__).resolve().parents[2])").Trim()
        if ([System.IO.Path]::GetFullPath($where).TrimEnd("\") -ne [System.IO.Path]::GetFullPath($Clone).TrimEnd("\")) {
            Stop-Reproduction ("python imports datalab from " + $where + ", not from the clone.")
        }

        # -------------------------------------------------------- 3. sources
        Write-Step "3/6 datalab fetch into a fresh SOURCES_DIR (every file is hash-checked)"
        $Manifest = Import-Csv (Join-Path $Clone "sources\manifest.csv")
        if ($SbpCsv -ne "") {
            # The one file that cannot be fetched by URL. Accepted only with the manifest's hash.
            $row = $Manifest | Where-Object { $_.doc_type -eq "sbp_easydata" } | Select-Object -First 1
            if ($null -eq $row) { Stop-Reproduction "-SbpCsv was given but the manifest has no sbp_easydata source." }
            $hash = (Get-FileHash -Algorithm SHA256 -Path $SbpCsv).Hash.ToLowerInvariant()
            if ($hash -ne $row.sha256) {
                Stop-Reproduction ("the file given as -SbpCsv has SHA-256 " + $hash + "; the manifest has " + $row.sha256 + ". It is not the registered file and is not used.")
            }
            $dest = Join-Path $SourcesDir ($row.local_path -replace "/", "\")
            New-Item -ItemType Directory -Force (Split-Path $dest -Parent) | Out-Null
            Copy-Item -Path $SbpCsv -Destination $dest
            Write-Host ("SBP CSV copied (hash equals the manifest): " + $row.source_id)
        } else {
            Write-Host "No -SbpCsv given: the CPI-against-SBP checks will be skipped and will show up in the final diff (see the header of this script)."
        }

        $fetched = $false
        for ($attempt = 1; $attempt -le $FetchAttempts; $attempt++) {
            $code = Invoke-Native $Python @("-m", "datalab", "fetch")
            if ($code -eq 0) { $fetched = $true; break }
            if ($attempt -lt $FetchAttempts) {
                Write-Host ("datalab fetch reported a problem (attempt " + $attempt + " of " + $FetchAttempts + "). Waiting " + $FetchRetryMinutes + " minutes before trying the missing files again.")
                Start-Sleep -Seconds ($FetchRetryMinutes * 60)
            }
        }
        if (-not $fetched) {
            Stop-Reproduction ("datalab fetch could not obtain every source with the SHA-256 in the manifest after " + $FetchAttempts + " attempts. Read the [fetch] PROBLEM lines above. Wayback-only files are subject to rate limits: try again later with a new scratch folder.")
        }

        # -------------------------------------------------------- 4. extraction
        Write-Step "4/6 Extraction (new runs; one at a time)"
        # 4a. Runs recorded in the committed release that `datalab all` would not make:
        #     page-range runs, and runs of documents that belong to no dataset (cross-source).
        $DatasetDocTypes = @("abs", "cpi_monthly_review", "lfs_annual_report")
        $DocTypeOf = @{}
        foreach ($m in $Manifest) { $DocTypeOf[$m.source_id] = $m.doc_type }
        $Recorded = Get-ChildItem (Join-Path $Expected "runs") -Filter "*.manifest.json" | Sort-Object Name |
            ForEach-Object { Get-Content $_.FullName -Raw -Encoding UTF8 | ConvertFrom-Json }
        foreach ($run in $Recorded) {
            $isRange = ($run.run_mode -eq "page-range") -and ($null -ne $run.page_range)
            $outsideDatasets = -not ($DatasetDocTypes -contains $DocTypeOf[$run.source_id])
            if (-not ($isRange -or $outsideDatasets)) { continue }
            $arguments = @("-m", "datalab", "extract", "--source", $run.source_id)
            if ($isRange) { $arguments += @("--pages", ("" + $run.page_range[0] + "-" + $run.page_range[1])) }
            Invoke-Required $Python $arguments ("extract for " + $run.source_id + " (recorded run " + $run.run_id + ")")
            # `validate --source` validates the newest run of that source, which is the one just made.
            Invoke-Required $Python @("-m", "datalab", "validate", "--source", $run.source_id) ("validate for " + $run.source_id)
        }

        # 4b. The datasets. `all` = fetch (now a hash check only), extract, validate, build.
        Invoke-Required $Python @("-m", "datalab", "all", "--dataset", "abs") "datalab all --dataset abs"
        Invoke-Required $Python @("-m", "datalab", "all", "--dataset", "cpi") "datalab all --dataset cpi"
        # --reuse-runs: sources that already have a validated run from 4a are not extracted again in full.
        Invoke-Required $Python @("-m", "datalab", "all", "--dataset", "lfs", "--reuse-runs") "datalab all --dataset lfs"

        # -------------------------------------------------------- 5. release
        Write-Step ("5/6 datalab release --version " + $Version + " (inside the clone)")
        Invoke-Required $Python @("-m", "datalab", "release", "--version", $Version) "datalab release"
        $Rebuilt = Join-Path $Clone ("releases\" + $Version)
        $code = Invoke-Native $Python @("-m", "datalab", "check-release", ("releases/" + $Version))
        if ($code -ne 0) { Write-Host "NOTE: check-release reported problems in the rebuilt release (listed above). The diff below is still made." }

        # -------------------------------------------------------- 6. compare
        Write-Step "6/6 datalab diff-release: committed release (A) against the rebuilt one (B)"
        $ExitCode = Invoke-Native $Python @("-m", "datalab", "diff-release", $Expected, $Rebuilt)
    } finally {
        Pop-Location
    }

    Write-Host ""
    if ($ExitCode -eq 0) {
        Write-Host "REPRODUCED: the rebuilt release holds the same sources, series, cells, checks and observations."
    } else {
        Write-Host "NOT IDENTICAL: read the differences above. If no -SbpCsv was given, the CPI-against-SBP checks are expected among them."
    }
    Write-Host ("Everything is under " + $Scratch + " (clone, sources, work, expected-release). Delete the folder when done.")
} finally {
    foreach ($name in $SavedEnv.Keys) { [Environment]::SetEnvironmentVariable($name, $SavedEnv[$name], "Process") }
}
exit $ExitCode
