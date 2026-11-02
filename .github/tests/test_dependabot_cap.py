"""Tests for .github/scripts/dependabot_cap.py"""

import sys
from pathlib import Path
from textwrap import dedent

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent / "scripts"))
from dependabot_cap import add_cap, lift_cap, map_ecosystem  # noqa: E402


# ---------------------------------------------------------------------------
# map_ecosystem
# ---------------------------------------------------------------------------


def test_map_ecosystem_npm_and_yarn():
    assert map_ecosystem("npm_and_yarn") == "npm"


def test_map_ecosystem_github_actions():
    assert map_ecosystem("github_actions") == "github-actions"


def test_map_ecosystem_uv_passthrough():
    assert map_ecosystem("uv") == "uv"


def test_map_ecosystem_maven_passthrough():
    assert map_ecosystem("maven") == "maven"


def test_map_ecosystem_unknown_passthrough():
    assert map_ecosystem("some_new_ecosystem") == "some_new_ecosystem"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_MINIMAL_DEPENDABOT = dedent("""\
    version: 2
    updates:
      - package-ecosystem: npm
        directory: /client
        schedule:
          interval: weekly
      - package-ecosystem: github-actions
        directory: /
        schedule:
          interval: daily
      - package-ecosystem: uv
        directory: /appserver
        schedule:
          interval: weekly
""")


def _write_dependabot(tmp_path: Path, content: str = _MINIMAL_DEPENDABOT) -> Path:
    p = tmp_path / "dependabot.yml"
    p.write_text(content)
    return p


def _read_yaml(path: Path) -> dict:
    from ruamel.yaml import YAML

    return YAML().load(path)


# ---------------------------------------------------------------------------
# add_cap — ecosystem name mapping (the core bug)
# ---------------------------------------------------------------------------


class TestAddCapEcosystemMapping:
    """Given fetch-metadata reports npm_and_yarn, the cap must land under npm."""

    def test_npm_and_yarn_maps_to_npm(self, tmp_path):
        # Given
        dep_yml = _write_dependabot(tmp_path)

        # When
        add_cap(dep_yml, ["typescript"], "npm_and_yarn", "/client", 7)

        # Then
        doc = _read_yaml(dep_yml)
        npm_entry = next(u for u in doc["updates"] if u["package-ecosystem"] == "npm")
        assert npm_entry["ignore"] == [{"dependency-name": "typescript", "versions": [">=7"]}]

    def test_github_actions_maps_correctly(self, tmp_path):
        # Given
        dep_yml = _write_dependabot(tmp_path)

        # When
        add_cap(dep_yml, ["actions/checkout"], "github_actions", "/", 5)

        # Then
        doc = _read_yaml(dep_yml)
        ga_entry = next(u for u in doc["updates"] if u["package-ecosystem"] == "github-actions")
        assert ga_entry["ignore"] == [{"dependency-name": "actions/checkout", "versions": [">=5"]}]

    def test_uv_ecosystem_needs_no_mapping(self, tmp_path):
        # Given
        dep_yml = _write_dependabot(tmp_path)

        # When
        add_cap(dep_yml, ["flask"], "uv", "/appserver", 4)

        # Then
        doc = _read_yaml(dep_yml)
        uv_entry = next(u for u in doc["updates"] if u["package-ecosystem"] == "uv")
        assert uv_entry["ignore"] == [{"dependency-name": "flask", "versions": [">=4"]}]


class TestAddCapRuleManagement:
    """add_cap correctly creates, updates, and skips rules."""

    def test_adds_new_rule_when_no_ignore_section(self, tmp_path):
        # Given
        dep_yml = _write_dependabot(tmp_path)

        # When
        add_cap(dep_yml, ["lodash"], "npm_and_yarn", "/client", 5)

        # Then
        doc = _read_yaml(dep_yml)
        npm_entry = next(u for u in doc["updates"] if u["package-ecosystem"] == "npm")
        assert {"dependency-name": "lodash", "versions": [">=5"]} in npm_entry["ignore"]

    def test_updates_existing_rule_to_new_cap(self, tmp_path):
        # Given — rule already exists at >=4, we're raising it to >=5
        content = dedent("""\
            version: 2
            updates:
              - package-ecosystem: npm
                directory: /client
                schedule:
                  interval: weekly
                ignore:
                  - dependency-name: lodash
                    versions: ['>=4']
        """)
        dep_yml = _write_dependabot(tmp_path, content)

        # When
        changed = add_cap(dep_yml, ["lodash"], "npm_and_yarn", "/client", 5)

        # Then
        assert changed is True
        doc = _read_yaml(dep_yml)
        npm_entry = next(u for u in doc["updates"] if u["package-ecosystem"] == "npm")
        rule = next(r for r in npm_entry["ignore"] if r["dependency-name"] == "lodash")
        assert rule["versions"] == [">=5"]

    def test_no_change_when_rule_already_at_cap(self, tmp_path):
        # Given — rule already at the exact target version
        content = dedent("""\
            version: 2
            updates:
              - package-ecosystem: npm
                directory: /client
                schedule:
                  interval: weekly
                ignore:
                  - dependency-name: lodash
                    versions: ['>=5']
        """)
        dep_yml = _write_dependabot(tmp_path, content)

        # When
        changed = add_cap(dep_yml, ["lodash"], "npm_and_yarn", "/client", 5)

        # Then
        assert changed is False

    def test_handles_multiple_dep_names(self, tmp_path):
        # Given
        dep_yml = _write_dependabot(tmp_path)

        # When
        add_cap(dep_yml, ["@ngrx/store", "@ngrx/effects", "ngrx-store-localstorage"], "npm_and_yarn", "/client", 18)

        # Then
        doc = _read_yaml(dep_yml)
        npm_entry = next(u for u in doc["updates"] if u["package-ecosystem"] == "npm")
        names = [r["dependency-name"] for r in npm_entry["ignore"]]
        assert "@ngrx/store" in names
        assert "@ngrx/effects" in names
        assert "ngrx-store-localstorage" in names

    def test_exits_1_when_no_matching_entry(self, tmp_path):
        # Given
        dep_yml = _write_dependabot(tmp_path)

        # When / Then
        with pytest.raises(SystemExit) as exc_info:
            add_cap(dep_yml, ["foo"], "npm_and_yarn", "/nonexistent", 5)
        assert exc_info.value.code == 1


# ---------------------------------------------------------------------------
# lift_cap
# ---------------------------------------------------------------------------


class TestLiftCap:
    """lift_cap removes the exactly-matching cap rule and no other rules."""

    def test_lifts_cap_for_exact_next_major(self, tmp_path):
        # Given — ng-bootstrap was capped at >=17, Dependabot now proposes 16→17
        content = dedent("""\
            version: 2
            updates:
              - package-ecosystem: npm
                directory: /client
                schedule:
                  interval: weekly
                ignore:
                  - dependency-name: '@ng-bootstrap/ng-bootstrap'
                    versions: ['>=17']
        """)
        dep_yml = _write_dependabot(tmp_path, content)

        # When — single-major bump to 17 is proposed
        changed = lift_cap(dep_yml, ["@ng-bootstrap/ng-bootstrap"], "npm_and_yarn", "/client", 16)

        # Then
        assert changed is True
        doc = _read_yaml(dep_yml)
        npm_entry = next(u for u in doc["updates"] if u["package-ecosystem"] == "npm")
        rules = npm_entry.get("ignore", [])
        names = [r.get("dependency-name") for r in rules]
        assert "@ng-bootstrap/ng-bootstrap" not in names

    def test_lifts_cap_when_rule_uses_glob_pattern(self, tmp_path):
        # Given — ngrx/* is capped via a glob, single package triggers the lift
        content = dedent("""\
            version: 2
            updates:
              - package-ecosystem: npm
                directory: /client
                schedule:
                  interval: weekly
                ignore:
                  - dependency-name: '@ngrx/*'
                    versions: ['>=18']
        """)
        dep_yml = _write_dependabot(tmp_path, content)

        # When — Dependabot proposes @ngrx/store 17→18 (fetch-metadata dep name)
        changed = lift_cap(dep_yml, ["@ngrx/store"], "npm_and_yarn", "/client", 17)

        # Then
        assert changed is True
        doc = _read_yaml(dep_yml)
        npm_entry = next(u for u in doc["updates"] if u["package-ecosystem"] == "npm")
        rules = npm_entry.get("ignore", [])
        assert all(r.get("dependency-name") != "@ngrx/*" for r in rules)

    def test_does_not_lift_cap_for_wrong_version(self, tmp_path):
        # Given — cap at >=18, but we're only bumping to 16 (diff=1, still far from cap)
        content = dedent("""\
            version: 2
            updates:
              - package-ecosystem: npm
                directory: /client
                schedule:
                  interval: weekly
                ignore:
                  - dependency-name: typescript
                    versions: ['>=18']
        """)
        dep_yml = _write_dependabot(tmp_path, content)

        # When — bumping 15→16 (new_major=16, so we'd only lift >=17, not >=18)
        changed = lift_cap(dep_yml, ["typescript"], "npm_and_yarn", "/client", 15)

        # Then
        assert changed is False
        doc = _read_yaml(dep_yml)
        npm_entry = next(u for u in doc["updates"] if u["package-ecosystem"] == "npm")
        rule = next(r for r in npm_entry.get("ignore", []) if r["dependency-name"] == "typescript")
        assert rule["versions"] == [">=18"]

    def test_does_not_lift_other_rules_for_same_package(self, tmp_path):
        # Given — package has both a cap rule and an unrelated ignore rule
        content = dedent("""\
            version: 2
            updates:
              - package-ecosystem: npm
                directory: /client
                schedule:
                  interval: weekly
                ignore:
                  - dependency-name: jasmine-core
                    versions: ['>=7.0.0']
                  - dependency-name: '@ng-bootstrap/ng-bootstrap'
                    versions: ['>=17']
        """)
        dep_yml = _write_dependabot(tmp_path, content)

        # When — lift cap for ng-bootstrap (new_major=16 → lifts >=17)
        lift_cap(dep_yml, ["@ng-bootstrap/ng-bootstrap"], "npm_and_yarn", "/client", 16)

        # Then — jasmine-core rule is untouched
        doc = _read_yaml(dep_yml)
        npm_entry = next(u for u in doc["updates"] if u["package-ecosystem"] == "npm")
        jasmine_rule = next(r for r in npm_entry["ignore"] if r["dependency-name"] == "jasmine-core")
        assert jasmine_rule["versions"] == [">=7.0.0"]

    def test_noop_when_no_matching_rule(self, tmp_path):
        # Given — no ignore rules at all
        dep_yml = _write_dependabot(tmp_path)

        # When
        changed = lift_cap(dep_yml, ["some-pkg"], "npm_and_yarn", "/client", 5)

        # Then
        assert changed is False

    def test_noop_when_no_matching_entry(self, tmp_path):
        # Given
        dep_yml = _write_dependabot(tmp_path)

        # When — wrong directory, lift should not crash
        changed = lift_cap(dep_yml, ["foo"], "npm_and_yarn", "/nonexistent", 5)

        # Then
        assert changed is False
