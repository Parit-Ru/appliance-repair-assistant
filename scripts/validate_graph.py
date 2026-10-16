"""
FixBot Troubleshooting Graph Validator (schema v2)

Validates graph files against:
1. JSON Schema (structure, types, enums)
2. Business rules (reachability, dead nodes, terminal constraints, safety placement)
3. v2-specific rules (input nodes, config provenance, variant coverage, template vars)

Usage:
    python validate_graph.py --all
    python validate_graph.py data/manuals/<manual_name>.json
"""

import json
import re
import sys
from pathlib import Path

EDGE_KEYS = ("on_yes", "on_no", "next", "on_invalid")
TERMINAL_TYPES = ("resolution", "escalation")


def validate_json_schema(graph: dict, schema: dict) -> list[str]:
    try:
        from jsonschema import Draft202012Validator
        validator = Draft202012Validator(schema)
        return [
            f"[SCHEMA] {e.json_path}: {e.message}"
            for e in sorted(validator.iter_errors(graph), key=lambda e: list(e.path))
        ]
    except ImportError:
        return ["[WARN] jsonschema not installed — run: pip install jsonschema"]


def validate_business_rules(graph: dict) -> list[str]:
    errors: list[str] = []
    warnings: list[str] = []

    nodes_by_id: dict[str, dict] = {}
    for node in graph.get("nodes", []):
        nid = node.get("node_id", "<missing>")
        if nid in nodes_by_id:
            errors.append(f"[BIZ] Duplicate node_id: '{nid}'")
        nodes_by_id[nid] = node

    entry = graph.get("entry_node")

    # --- 1. entry_node exists ---
    if entry and entry not in nodes_by_id:
        errors.append(f"[BIZ] entry_node '{entry}' does not exist in nodes")

    # --- 2. all edges resolve ---
    for node in graph.get("nodes", []):
        nid = node.get("node_id", "?")
        for key in EDGE_KEYS:
            target = node.get(key)
            if target and target not in nodes_by_id:
                errors.append(f"[BIZ] Node '{nid}' → {key}='{target}' references non-existent node")

    # --- 3. terminals have no outgoing edges ---
    for node in graph.get("nodes", []):
        nid = node.get("node_id", "?")
        if node.get("type") in TERMINAL_TYPES:
            for key in EDGE_KEYS:
                if key in node:
                    errors.append(f"[BIZ] Terminal '{nid}' must not have '{key}'")

    # --- 4. reachability ---
    if entry and entry in nodes_by_id:
        reachable, stack = set(), [entry]
        while stack:
            cur = stack.pop()
            if cur in reachable:
                continue
            reachable.add(cur)
            for key in EDGE_KEYS:
                t = nodes_by_id.get(cur, {}).get(key)
                if t:
                    stack.append(t)
        for uid in sorted(set(nodes_by_id) - reachable):
            errors.append(f"[BIZ] Node '{uid}' is unreachable from entry_node '{entry}'")

    # --- 5. every node can reach a terminal ---
    terminals = {n["node_id"] for n in graph.get("nodes", []) if n.get("type") in TERMINAL_TYPES}
    if not terminals:
        errors.append("[BIZ] Graph has no terminal nodes")
    else:
        for nid in sorted(nodes_by_id):
            if nid in terminals:
                continue
            seen, queue, ok = set(), [nid], False
            while queue:
                cur = queue.pop(0)
                if cur in terminals:
                    ok = True
                    break
                if cur in seen:
                    continue
                seen.add(cur)
                for key in EDGE_KEYS:
                    t = nodes_by_id.get(cur, {}).get(key)
                    if t:
                        queue.append(t)
            if not ok:
                errors.append(f"[BIZ] Node '{nid}' cannot reach any terminal — possible infinite loop")

    # --- 6. safety warning text required ---
    for node in graph.get("nodes", []):
        nid = node.get("node_id", "?")
        if node.get("safety_critical") and not node.get("safety_warning"):
            errors.append(
                f"[BIZ] Safety-critical node '{nid}' has no safety_warning — "
                f"the gate would render an empty warning box"
            )

    # --- 7. safety flag belongs on actions, not questions ---
    for node in graph.get("nodes", []):
        nid = node.get("node_id", "?")
        if node.get("type") in ("checkpoint", "input") and node.get("safety_critical"):
            warnings.append(
                f"[WARN] '{nid}' is type={node['type']} but marked safety_critical — "
                f"asking is not hazardous; move the flag to the instruction that acts"
            )

    # ------------------------------------------------------------------
    # v2-specific rules
    # ------------------------------------------------------------------

    # --- 8. input node: regex must compile ---
    for node in graph.get("nodes", []):
        if node.get("type") != "input":
            continue
        nid = node.get("node_id", "?")
        pat = node.get("pattern")
        if pat:
            try:
                re.compile(pat)
            except re.error as e:
                errors.append(f"[BIZ] Input '{nid}' has invalid regex pattern: {e}")
        if "on_invalid" not in node and pat:
            warnings.append(
                f"[WARN] Input '{nid}' has a validation pattern but no 'on_invalid' — "
                f"the engine will re-prompt the same node, which may loop silently"
            )

    # --- 9. template variables must be captured before use ---
    #     A node saying {{error_code}} is broken unless some input node upstream
    #     stores that key. This is the kind of bug that only shows at runtime.
    stored_keys = {n["store_as"] for n in graph.get("nodes", []) if n.get("type") == "input"}
    for node in graph.get("nodes", []):
        nid = node.get("node_id", "?")
        text = " ".join(str(node.get(k, "")) for k in ("content", "question", "prompt"))
        for var in re.findall(r"\{\{(\w+)\}\}", text):
            if var not in stored_keys:
                errors.append(
                    f"[BIZ] Node '{nid}' references template variable '{{{{{var}}}}}' "
                    f"but no input node stores it"
                )

    # --- 10. config provenance ---
    for key, entry_cfg in (graph.get("config") or {}).items():
        origin = (entry_cfg.get("source") or {}).get("origin")
        if origin == "author_assumption":
            warnings.append(
                f"[WARN] config '{key}' is an author_assumption, not sourced from a document — "
                f"must be disclosed in the report and never shown as a manual quote"
            )

    # --- 11. variant table must cover the graph's model_pattern ---
    #     Both sides carry wildcards, so a prefix comparison is not enough:
    #     'AR70*07*****' and 'AR70H**D1***' overlap even though neither is a
    #     prefix of the other. Two patterns overlap when, at every position, at
    #     least one side is a wildcard or the characters agree.
    def patterns_overlap(a: str, b: str) -> bool:
        if len(a) != len(b):
            return False
        return all(ca == "*" or cb == "*" or ca.upper() == cb.upper() for ca, cb in zip(a, b))

    model_pattern = graph.get("model_pattern", "")
    for key, entry_cfg in (graph.get("config") or {}).items():
        if entry_cfg.get("kind") != "by_model_variant":
            continue
        variants = entry_cfg.get("variants", [])
        if not variants:
            errors.append(f"[BIZ] config '{key}' is by_model_variant but has no variants")
            continue
        if model_pattern and not any(patterns_overlap(v["match"], model_pattern) for v in variants):
            errors.append(
                f"[BIZ] config '{key}' has no variant matching model_pattern "
                f"'{model_pattern}' — lookups will return nothing at runtime"
            )

    # --- 12. external references must declare KB status ---
    for node in graph.get("nodes", []):
        nid = node.get("node_id", "?")
        ext = node.get("external_reference")
        if ext and ext.get("in_knowledge_base") is False:
            warnings.append(
                f"[WARN] Node '{nid}' cites '{ext.get('document')}' which is NOT in the "
                f"knowledge base — the UI must not render it as a followable link"
            )

    return errors + warnings


def validate_manual(path: str, schema: dict | None) -> dict[str, bool]:
    """
    ตรวจไฟล์คู่มือหนึ่งเล่ม โดยแตก graph แต่ละอันออกมาตรวจทีละอัน

    ทำแบบนี้เพราะ schema เขียนไว้สำหรับ graph หนึ่งอัน ไม่ใช่ไฟล์คู่มือ
    และเวลาแจ้ง error จะได้บอกได้ว่าเป็น graph ไหน
    """
    raw = json.loads(Path(path).read_text(encoding="utf-8"))
    manual_id = raw.get("manual_id", Path(path).stem)
    graphs = raw.get("graphs", [])
    results: dict[str, bool] = {}

    print(f"\n{'#'*66}")
    print(f"# คู่มือ: {manual_id}  ({len(graphs)} graph)")
    print(f"{'#'*66}")

    for graph in graphs:
        gid = graph.get("graph_id", "<ไม่มีชื่อ>")
        print(f"\n{'='*66}")
        print(f"Validating: {gid}")
        print(f"{'='*66}")

        issues = []
        if schema:
            issues += validate_json_schema(graph, schema)
        issues += validate_business_rules(graph)

        schema_err = [i for i in issues if i.startswith("[SCHEMA]")]
        biz_err = [i for i in issues if i.startswith("[BIZ]")]
        warns = [i for i in issues if i.startswith("[WARN]")]

        for i in schema_err + biz_err:
            print(f"  ERROR {i}")
        for i in warns:
            print(f"  {i}")

        ok = not (schema_err or biz_err)
        if ok:
            nodes = graph.get("nodes", [])
            types: dict[str, int] = {}
            for n in nodes:
                types[n.get("type", "?")] = types.get(n.get("type", "?"), 0) + 1
            print(f"  PASS — {len(nodes)} nodes ({', '.join(f'{v} {k}' for k, v in sorted(types.items()))})")
            if warns:
                print(f"  ({len(warns)} warnings above)")
        else:
            print(f"\n  FAIL — {len(schema_err)} schema, {len(biz_err)} business, {len(warns)} warnings")

        results[f"{manual_id}/{gid}"] = ok

    return results


def main():
    script_dir = Path(__file__).parent
    schema_path = script_dir.parent / "data" / "schemas" / "troubleshooting-graph.v2.schema.json"
    schema = json.loads(schema_path.read_text(encoding="utf-8")) if schema_path.exists() else None
    if schema:
        print("Schema v2 loaded")

    if not sys.argv[1:]:
        print("Usage: python validate_graph.py --all")
        print("       python validate_graph.py data/manuals/<ชื่อคู่มือ>.json")
        sys.exit(1)

    manuals_dir = script_dir.parent / "data" / "manuals"
    results: dict[str, bool] = {}

    if sys.argv[1] == "--all":
        # ตรวจทุกคู่มือในโฟลเดอร์ manuals/
        manual_files = sorted(manuals_dir.glob("*.json"))
        if not manual_files:
            print(f"ไม่พบไฟล์คู่มือใน {manuals_dir}")
            sys.exit(1)
        for mf in manual_files:
            results.update(validate_manual(str(mf), schema))
    else:
        # ตรวจคู่มือเล่มเดียวที่ระบุมา
        results = validate_manual(sys.argv[1], schema)

    print(f"\n{'='*66}")
    print(f"SUMMARY: {sum(results.values())}/{len(results)} passed")
    for p, ok in results.items():
        print(f"  [{'PASS' if ok else 'FAIL'}] {Path(p).name}")

    sys.exit(0 if all(results.values()) else 1)


if __name__ == "__main__":
    main()