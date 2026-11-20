"""Read-only public staging smoke test. No authentication, writes or real records."""
import argparse
import json
import sys
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import Request, urlopen


def url(base, path):
    parsed = urlsplit(base)
    if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password or parsed.query or parsed.fragment:
        raise ValueError("Use an HTTPS service root without credentials, query, or fragment.")
    return base.rstrip("/") + path


def probe(base, path, expect_json=False, expected_status=200):
    target = url(base, path)
    try:
        with urlopen(Request(target, headers={"Accept": "application/json" if expect_json else "text/plain",
                                              "User-Agent": "SmartParish-Staging-Smoke/1.0"}), timeout=60) as response:
            body = response.read(1024 * 1024)
            if expect_json:
                data = json.loads(body)
                if not isinstance(data, (dict, list)):
                    raise ValueError("Expected JSON object or array.")
            if response.status != expected_status:
                return f"FAIL unexpected HTTP {response.status}; expected {expected_status}"
            return f"PASS HTTP {response.status}"
    except HTTPError as exc:
        if exc.code == expected_status:
            return f"PASS HTTP {exc.code} (protected endpoint)"
        return f"FAIL HTTP {exc.code}; expected {expected_status}"
    except (URLError, TimeoutError, ValueError, json.JSONDecodeError) as exc:
        return f"FAIL {type(exc).__name__}: {str(exc)[:160]}"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--web", default="https://ifimarag.onrender.com")
    parser.add_argument("--api", default="https://smart-parish-api.onrender.com")
    args = parser.parse_args()
    checks = [
        ("Web homepage", args.web, "/", False, 200),
        ("Web readiness", args.web, "/api/ready", False, 200),
        ("Public calendar", args.web, "/api/parish-calendar", True, 200),
        ("Flask rejects anonymous /api/health", args.api, "/api/health", False, 401),
    ]
    failures = 0
    for name, base, path, as_json, expected in checks:
        result = probe(base, path, as_json, expected)
        print(f"{name}: {result}")
        failures += result.startswith("FAIL")
    print("Only public endpoints were checked. This does not prove private workflows, environment flags or database migration status.")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
