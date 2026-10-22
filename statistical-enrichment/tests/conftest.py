import importlib.util
import sys
from unittest.mock import MagicMock

# ``graphdb.py`` and ``rcache.py`` import and instantiate connections at
# module level.  We must inject mocks for these external packages *before*
# any test module triggers the import chain so that collection succeeds
# without running external services.

# Substitute a stand-in module only when the package is genuinely not
# installed.  Testing ``sys.modules`` alone was not enough: nothing has
# imported neo4j by the time conftest runs, so the real driver was replaced
# unconditionally.  The stand-in answered to any attribute, which is how the
# removal of ``Session.read_transaction`` in driver 6.0 stayed invisible to
# every test while enrichment visualisation was broken in production.

for _module in ("neo4j",):
    if _module not in sys.modules and importlib.util.find_spec(_module) is None:
        sys.modules[_module] = MagicMock()

# Patch neo4j.GraphDatabase.driver at the attribute level so that the
# driver instantiation in graphdb.py does not attempt a real connection.
import neo4j  # noqa: E402 – may be real or the mock above
neo4j.GraphDatabase.driver = MagicMock(return_value=MagicMock())
neo4j.basic_auth = MagicMock(return_value=("neo4j", "password"))
