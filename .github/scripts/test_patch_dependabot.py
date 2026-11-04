"""Tests for patch_dependabot.py."""

import os
import textwrap
import pytest
from pathlib import Path
from patch_dependabot import patch


FIXTURE_DEPENDABOT = textwrap.dedent("""\
    version: 2
    updates:
      - package-ecosystem: "github-actions"
        directory: "/"
        schedule:
          interval: "daily"

      - package-ecosystem: npm
        directory: /client
        schedule:
          interval: weekly
        ignore:
          - dependency-name: '@angular/*'
          - dependency-name: '@ng-bootstrap/ng-bootstrap'
            versions: ['>=17']
          - dependency-name: '@ngrx/*'
            versions: ['>=18']

      - package-ecosystem: uv
        directory: /appserver
        schedule:
          interval: weekly
""")


@pytest.fixture()
def dep_file(tmp_path: Path) -> Path:
    p = tmp_path / "dependabot.yml"
    p.write_text(FIXTURE_DEPENDABOT)
    return p


# ---------------------------------------------------------------------------
# Ecosystem name mapping
# ---------------------------------------------------------------------------

def test_cap_npm_and_yarn_maps_to_npm(dep_file: Path) -> None:
    """fetch-metadata reports 'npm_and_yarn'; dependabot.yml uses 'npm'."""
    changed, new_cap = patch(
        path=str(dep_file),
        dep_names=["typescript"],
        ecosystem_raw="npm_and_yarn",   # what fetch-metadata outputs
        directory="/client",
        action="cap",
        cap=6,
    )
    assert changed
    assert new_cap is None
    text = dep_file.read_text()
    assert "typescript" in text
    assert ">=6" in text


def test_cap_github_actions_maps(dep_file: Path) -> None:
    """fetch-metadata reports 'github_actions'; dependabot.yml uses 'github-actions'."""
    changed, _ = patch(
        path=str(dep_file),
        dep_names=["actions/checkout"],
        ecosystem_raw="github_actions",
        directory="/",
        action="cap",
        cap=8,
    )
    assert changed
    text = dep_file.read_text()
    assert "actions/checkout" in text
    assert ">=8" in text


def test_cap_unknown_ecosystem_passed_through(dep_file: Path) -> None:
    """An unrecognised ecosystem name is passed to the YAML lookup unchanged."""
    with pytest.raises(SystemExit) as exc:
        patch(
            path=str(dep_file),
            dep_names=["some-dep"],
            ecosystem_raw="nonexistent",
            directory="/client",
            action="cap",
            cap=3,
        )
    assert exc.value.code == 1


# ---------------------------------------------------------------------------
# Cap action
# ---------------------------------------------------------------------------

def test_cap_adds_new_rule(dep_file: Path) -> None:
    changed, _ = patch(
        path=str(dep_file),
        dep_names=["chart.js"],
        ecosystem_raw="npm",
        directory="/client",
        action="cap",
        cap=5,
    )
    assert changed
    text = dep_file.read_text()
    assert "chart.js" in text
    assert ">=5" in text


def test_cap_updates_existing_rule(dep_file: Path) -> None:
    """An existing rule for the dep should be updated, not duplicated."""
    changed, _ = patch(
        path=str(dep_file),
        dep_names=["@ng-bootstrap/ng-bootstrap"],
        ecosystem_raw="npm",
        directory="/client",
        action="cap",
        cap=19,
    )
    assert changed
    text = dep_file.read_text()
    # Old rule >=17 must be gone, new rule >=19 must be present
    assert ">=17" not in text
    assert ">=19" in text
    assert text.count("@ng-bootstrap/ng-bootstrap") == 1


def test_cap_missing_entry_exits(dep_file: Path) -> None:
    """cap action must exit 1 when no matching ecosystem+directory entry exists."""
    with pytest.raises(SystemExit) as exc:
        patch(
            path=str(dep_file),
            dep_names=["some-lib"],
            ecosystem_raw="npm",
            directory="/nonexistent",
            action="cap",
            cap=3,
        )
    assert exc.value.code == 1


# ---------------------------------------------------------------------------
# Lift action
# ---------------------------------------------------------------------------

def test_lift_advances_existing_cap(dep_file: Path) -> None:
    """Single-major bump ng-bootstrap 15→16 should advance >=17 to >=18."""
    changed, new_cap = patch(
        path=str(dep_file),
        dep_names=["@ng-bootstrap/ng-bootstrap"],
        ecosystem_raw="npm",
        directory="/client",
        action="lift",
        new_major=16,
    )
    assert changed
    assert new_cap == 18
    text = dep_file.read_text()
    assert ">=17" not in text
    assert ">=18" in text


def test_lift_no_matching_cap_does_nothing(dep_file: Path) -> None:
    """Lift should not modify the file when no matching cap rule exists."""
    changed, new_cap = patch(
        path=str(dep_file),
        dep_names=["chart.js"],  # no ignore rule at all
        ecosystem_raw="npm",
        directory="/client",
        action="lift",
        new_major=5,
    )
    assert not changed
    assert new_cap is None


def test_lift_wrong_major_does_nothing(dep_file: Path) -> None:
    """Lift for the wrong major should leave the existing rule untouched."""
    # ng-bootstrap cap is >=17; a bump to major=15 looks for >=16, which is absent
    changed, new_cap = patch(
        path=str(dep_file),
        dep_names=["@ng-bootstrap/ng-bootstrap"],
        ecosystem_raw="npm",
        directory="/client",
        action="lift",
        new_major=15,  # would look for >=16, but rule says >=17
    )
    assert not changed
    assert new_cap is None
    assert ">=17" in dep_file.read_text()


def test_lift_missing_entry_does_not_exit(dep_file: Path) -> None:
    """Lift for a missing ecosystem+directory should return unchanged (no sys.exit)."""
    changed, new_cap = patch(
        path=str(dep_file),
        dep_names=["some-lib"],
        ecosystem_raw="npm",
        directory="/nonexistent",
        action="lift",
        new_major=3,
    )
    assert not changed
    assert new_cap is None


def test_lift_ngrx(dep_file: Path) -> None:
    """ngrx cap >=18 should advance to >=19 when major 16→17 arrives."""
    changed, new_cap = patch(
        path=str(dep_file),
        dep_names=["@ngrx/*"],
        ecosystem_raw="npm",
        directory="/client",
        action="lift",
        new_major=17,  # Dependabot proposes 16→17; cap was set for >=18
    )
    assert changed
    assert new_cap == 19
    text = dep_file.read_text()
    assert ">=18" not in text
    assert ">=19" in text
