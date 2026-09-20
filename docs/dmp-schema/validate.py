import glob
import json
import os
import sys

base = os.path.dirname(os.path.abspath(__file__))
repo_root = os.path.dirname(os.path.dirname(base))
schema_path = os.path.join(
    repo_root, "appserver", "neo4japp", "schemas", "formats", "madmp_v1_2.json"
)

try:
    import jsonschema
except ImportError:
    print("jsonschema not installed")
    sys.exit(1)

with open(schema_path) as f:
    schema = json.load(f)

Validator = jsonschema.validators.validator_for(schema)
Validator.check_schema(schema)
validator = Validator(schema)

ok = True
for f in sorted(glob.glob(os.path.join(base, "fixtures", "valid", "*.json"))):
    with open(f) as fh:
        doc = json.load(fh)
    errors = list(validator.iter_errors(doc))
    if errors:
        ok = False
        print(f"FAIL (expected valid) {f}:")
        for e in errors[:5]:
            print("   ", e.message, list(e.path))
    else:
        print(f"OK valid: {os.path.basename(f)}")

for f in sorted(glob.glob(os.path.join(base, "fixtures", "invalid", "*.json"))):
    with open(f) as fh:
        doc = json.load(fh)
    errors = list(validator.iter_errors(doc))
    if errors:
        print(f"OK invalid (correctly rejected): {os.path.basename(f)}")
    else:
        ok = False
        print(f"FAIL (expected invalid but passed) {f}")

print("ALL OK" if ok else "SOME FAILURES")
sys.exit(0 if ok else 1)
