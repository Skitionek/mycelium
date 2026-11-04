#!/usr/bin/env python3
"""Patch .github/dependabot.yml with a cap or lift action.

Usage (called by the dependabot-cap-major.yml workflow):
  ACTION=cap  DEP_NAMES=typescript ECOSYSTEM=npm_and_yarn DIRECTORY=/client \
    CAP=8 python3 patch_dependabot.py

  ACTION=lift DEP_NAMES=@ng-bootstrap/ng-bootstrap ECOSYSTEM=npm_and_yarn \
    DIRECTORY=/client NEW_MAJOR=16 python3 patch_dependabot.py

Outputs:
  Writes changed=true|false (and new_cap=N for lift) to $GITHUB_OUTPUT when
  the env var is set, or just prints the values to stdout otherwise.

Exit codes:
  0 — success (file may or may not have changed)
  1 — required updates entry not found (cap action only)
"""

import os
import sys

from ruamel.yaml import YAML
from ruamel.yaml.comments import CommentedSeq

# fetch-metadata uses different identifiers than dependabot.yml.
ECOSYSTEM_MAP: dict[str, str] = {
    "npm_and_yarn": "npm",
    "github_actions": "github-actions",
}


def patch(
    path: str,
    dep_names: list[str],
    ecosystem_raw: str,
    directory: str,
    action: str,
    cap: int | None = None,
    new_major: int | None = None,
) -> tuple[bool, int | None]:
    """Apply a cap or lift to *path* in-place.

    Returns (changed, new_cap_version).
    *new_cap_version* is set only when action='lift' and a rule was advanced.
    Raises SystemExit(1) if the matching updates entry is missing for action='cap'.
    """
    ecosystem = ECOSYSTEM_MAP.get(ecosystem_raw, ecosystem_raw)

    yaml = YAML()
    yaml.preserve_quotes = True
    yaml.width = 4096

    with open(path) as fh:
        doc = yaml.load(fh)

    changed = False
    new_cap_version: int | None = None

    for update in doc.get("updates", []):
        if update.get("package-ecosystem") == ecosystem and update.get("directory") == directory:
            if "ignore" not in update:
                update["ignore"] = CommentedSeq()
            ignore = update["ignore"]

            if action == "cap":
                assert cap is not None
                version_rule = f">={cap}"
                for dep_name in dep_names:
                    existing = next(
                        (r for r in ignore if r.get("dependency-name") == dep_name), None
                    )
                    if existing is not None:
                        existing["versions"] = [version_rule]
                        print(f"Updated cap for {dep_name!r}: versions {version_rule}")
                    else:
                        ignore.append(
                            {"dependency-name": dep_name, "versions": [version_rule]}
                        )
                        print(f"Added cap for {dep_name!r}: versions {version_rule}")
                changed = True

            elif action == "lift":
                assert new_major is not None
                # The previously-written cap that locked the dependency was:
                #   versions: ['>= new_major + 1']   e.g. '>=17' when new_major=16
                # Advance it to allow the next major too:
                #   versions: ['>= new_major + 2']   e.g. '>=18'
                old_rule = f">={new_major + 1}"
                new_rule = f">={new_major + 2}"
                for dep_name in dep_names:
                    existing = next(
                        (r for r in ignore if r.get("dependency-name") == dep_name), None
                    )
                    if existing is not None and old_rule in existing.get("versions", []):
                        existing["versions"] = [new_rule]
                        print(f"Lifted cap for {dep_name!r}: {old_rule} → {new_rule}")
                        changed = True
                        new_cap_version = new_major + 2
                    else:
                        print(
                            f"No matching cap found for {dep_name!r} at {old_rule}; skipping."
                        )
            break
    else:
        if action == "cap":
            print(
                f"::error::No updates entry found for "
                f"ecosystem={ecosystem!r} (from {ecosystem_raw!r}) directory={directory!r}",
                file=sys.stderr,
            )
            sys.exit(1)
        else:
            print(
                f"No updates entry for ecosystem={ecosystem!r} directory={directory!r}; "
                f"nothing to lift."
            )

    if changed:
        with open(path, "w") as fh:
            yaml.dump(doc, fh)

    return changed, new_cap_version


def main() -> None:
    dep_names = [n.strip() for n in os.environ["DEP_NAMES"].split(",") if n.strip()]
    ecosystem_raw = os.environ["ECOSYSTEM"]
    directory = os.environ["DIRECTORY"]
    action = os.environ["ACTION"]
    cap = int(os.environ["CAP"]) if action == "cap" else None
    new_major = int(os.environ["NEW_MAJOR"]) if action == "lift" else None

    changed, new_cap_version = patch(
        path=".github/dependabot.yml",
        dep_names=dep_names,
        ecosystem_raw=ecosystem_raw,
        directory=directory,
        action=action,
        cap=cap,
        new_major=new_major,
    )

    gha_out = os.environ.get("GITHUB_OUTPUT", "")
    output_lines = [f"changed={'true' if changed else 'false'}"]
    if new_cap_version is not None:
        output_lines.append(f"new_cap={new_cap_version}")

    if gha_out:
        with open(gha_out, "a") as fh:
            for line in output_lines:
                print(line, file=fh)
    else:
        for line in output_lines:
            print(line)


if __name__ == "__main__":
    main()
