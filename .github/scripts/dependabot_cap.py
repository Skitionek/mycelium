"""
Patch .github/dependabot.yml to add or remove Dependabot major-version caps.

Used by the dependabot-cap-major workflow. Two entry-points:

  python dependabot_cap.py add   --dep-names "foo,bar" --ecosystem npm_and_yarn
                                 --directory /client --cap 7
  python dependabot_cap.py lift  --dep-names "foo,bar" --ecosystem npm_and_yarn
                                 --directory /client --new-major 6

Both commands exit 0 and print a summary line. `add` exits 1 when no matching
updates entry is found. `lift` always exits 0 (no matching rule is not an
error).

Return codes:
  0  success (may or may not have made a change)
  1  no matching updates entry found in dependabot.yml (add only)

The script prints one of two outcome tokens to stdout so the caller can detect
whether a real change was written:
  changed    at least one rule was added / removed
  unchanged  dependabot.yml was not modified
"""

import argparse
import fnmatch
import sys
from pathlib import Path

from ruamel.yaml import YAML
from ruamel.yaml.comments import CommentedSeq

# fetch-metadata reports internal Dependabot API names (snake_case).
# dependabot.yml uses public config keys (different spelling for two values).
FETCH_METADATA_TO_YML = {
    "npm_and_yarn": "npm",
    "github_actions": "github-actions",
}


def map_ecosystem(raw: str) -> str:
    """Return the dependabot.yml package-ecosystem key for a fetch-metadata value."""
    return FETCH_METADATA_TO_YML.get(raw, raw)


def _load_yaml(path: Path):
    yaml = YAML()
    yaml.preserve_quotes = True
    yaml.width = 4096
    return yaml, yaml.load(path)


def _dump_yaml(yaml, doc, path: Path) -> None:
    with path.open("w") as fh:
        yaml.dump(doc, fh)


def _rule_matches_dep(rule_name: str, dep_name: str) -> bool:
    """True when the rule's dependency-name pattern covers dep_name."""
    return fnmatch.fnmatch(dep_name, rule_name)


def add_cap(path: Path, dep_names: list[str], ecosystem_raw: str, directory: str, cap: int) -> bool:
    """
    Add or update ignore rules so that versions >= cap are blocked.

    Returns True when at least one rule was written.
    Exits with code 1 when no updates entry matches ecosystem + directory.
    """
    ecosystem_yml = map_ecosystem(ecosystem_raw)
    version_rule = f">={cap}"

    yaml, doc = _load_yaml(path)

    for update in doc.get("updates", []):
        if (
            update.get("package-ecosystem") == ecosystem_yml
            and update.get("directory") == directory
        ):
            if "ignore" not in update:
                update["ignore"] = CommentedSeq()
            ignore = update["ignore"]

            changed = False
            for dep_name in dep_names:
                existing = next(
                    (r for r in ignore if r.get("dependency-name") == dep_name), None
                )
                if existing is not None:
                    if existing.get("versions") == [version_rule]:
                        print(f"Ignore rule for {dep_name!r} already at {version_rule}; no change.")
                    else:
                        existing["versions"] = [version_rule]
                        print(f"Updated ignore rule for {dep_name!r}: versions {version_rule}")
                        changed = True
                else:
                    ignore.append({"dependency-name": dep_name, "versions": [version_rule]})
                    print(f"Added ignore rule for {dep_name!r}: versions {version_rule}")
                    changed = True

            if changed:
                _dump_yaml(yaml, doc, path)
            print("changed" if changed else "unchanged")
            return changed

    print(
        f"::error::No updates entry found for "
        f"ecosystem={ecosystem_yml!r} directory={directory!r}",
        file=sys.stderr,
    )
    sys.exit(1)


def lift_cap(path: Path, dep_names: list[str], ecosystem_raw: str, directory: str, new_major: int) -> bool:
    """
    Remove any ignore rule whose versions list is exactly ['>={new_major+1}'] and
    whose dependency-name pattern covers one of dep_names.

    The cap '>= new_major+1' was written when the package was at (new_major-1).x
    and blocked everything beyond new_major. Now that the single-major bump to
    new_major is being proposed, that cap is no longer needed.

    Returns True when at least one rule was removed.
    Never exits with a non-zero code.
    """
    ecosystem_yml = map_ecosystem(ecosystem_raw)
    cap_to_lift = f">={new_major + 1}"

    yaml, doc = _load_yaml(path)

    changed = False
    for update in doc.get("updates", []):
        if (
            update.get("package-ecosystem") == ecosystem_yml
            and update.get("directory") == directory
        ):
            ignore = update.get("ignore")
            if not ignore:
                break

            to_remove = [
                rule
                for rule in ignore
                if rule.get("versions") == [cap_to_lift]
                and any(_rule_matches_dep(rule.get("dependency-name", ""), dep) for dep in dep_names)
            ]

            for rule in to_remove:
                ignore.remove(rule)
                print(f"Lifted cap {cap_to_lift!r} from {rule['dependency-name']!r}")
                changed = True

            break

    if changed:
        _dump_yaml(yaml, doc, path)
    print("changed" if changed else "unchanged")
    return changed


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)

    common = argparse.ArgumentParser(add_help=False)
    common.add_argument("--dep-names", required=True)
    common.add_argument("--ecosystem", required=True)
    common.add_argument("--directory", required=True)
    common.add_argument("--path", default=".github/dependabot.yml", type=Path)

    add_p = sub.add_parser("add", parents=[common])
    add_p.add_argument("--cap", required=True, type=int)

    lift_p = sub.add_parser("lift", parents=[common])
    lift_p.add_argument("--new-major", required=True, type=int)

    return parser.parse_args()


def main() -> None:
    args = _parse_args()
    dep_names = [n.strip() for n in args.dep_names.split(",") if n.strip()]

    if args.command == "add":
        add_cap(args.path, dep_names, args.ecosystem, args.directory, args.cap)
    else:
        lift_cap(args.path, dep_names, args.ecosystem, args.directory, args.new_major)


if __name__ == "__main__":
    main()
