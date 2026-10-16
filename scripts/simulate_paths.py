"""
FixBot Graph Path Simulator

Walks every possible path through each graph and reports:
- Total distinct paths and their outcomes
- Longest path (UX concern: how many questions before an answer?)
- Paths that reach escalation vs resolution
- Safety gate coverage: are safety_critical nodes reachable on every dangerous path?
- Semantic smells the schema validator cannot detect

Usage:
    python simulate_paths.py --all <graphs_directory>
    python simulate_paths.py <graph_file.json>
"""

import json
import sys
from pathlib import Path


MAX_PATH_LENGTH = 40  # guard against runaway loops


def enumerate_paths(graph: dict, max_paths: int = 500) -> list[dict]:
    """
    Walk all distinct paths from entry_node to any terminal node.
    Retry loops are traversed at most once (loop edge taken one time only).
    """
    nodes = {n["node_id"]: n for n in graph["nodes"]}
    entry = graph["entry_node"]
    paths = []

    def walk(node_id, trail, answers, edge_counts):
        if len(trail) > MAX_PATH_LENGTH or len(paths) >= max_paths:
            return

        node = nodes.get(node_id)
        if node is None:
            return

        trail = trail + [node_id]
        ntype = node["type"]

        if ntype in ("resolution", "escalation"):
            paths.append({
                "trail": trail,
                "answers": answers,
                "outcome": ntype,
                "confidence": node.get("confidence"),
                "terminal_node": node_id,
                "questions_asked": sum(1 for n in trail if nodes[n]["type"] == "checkpoint"),
                "safety_nodes_hit": [n for n in trail if nodes[n].get("safety_critical")],
            })
            return

        if ntype == "instruction":
            target = node["next"]
            key = (node_id, "next", target)
            if edge_counts.get(key, 0) >= 1:
                return  # already took this loop edge once
            walk(target, trail, answers, {**edge_counts, key: edge_counts.get(key, 0) + 1})
            return

        if ntype == "checkpoint":
            for answer, edge in (("yes", "on_yes"), ("no", "on_no")):
                target = node[edge]
                key = (node_id, edge, target)
                if edge_counts.get(key, 0) >= 1:
                    continue
                walk(target, trail, answers + [(node_id, answer)],
                     {**edge_counts, key: edge_counts.get(key, 0) + 1})
            return

    walk(entry, [], [], {})
    return paths


def analyze(graph: dict) -> dict:
    nodes = {n["node_id"]: n for n in graph["nodes"]}
    paths = enumerate_paths(graph)

    resolutions = [p for p in paths if p["outcome"] == "resolution"]
    escalations = [p for p in paths if p["outcome"] == "escalation"]

    findings = []

    # --- Smell 1: dead-end escalation dominance ---
    if paths and len(escalations) / len(paths) > 0.75:
        findings.append(
            f"{len(escalations)}/{len(paths)} paths end in escalation — "
            f"graph may be too quick to give up"
        )

    # --- Smell 2: no resolution path at all ---
    if not resolutions:
        findings.append("NO path leads to a resolution — every outcome is escalation")

    # --- Smell 3: too many questions before an answer (UX) ---
    if paths:
        longest = max(paths, key=lambda p: p["questions_asked"])
        if longest["questions_asked"] > 6:
            findings.append(
                f"Longest path asks {longest['questions_asked']} questions "
                f"before an answer — consider splitting the graph"
            )

    # --- Smell 4: instant escalation (1 question, no attempt to help) ---
    instant = [p for p in escalations if p["questions_asked"] <= 1]
    if instant and len(instant) == len(escalations) and not resolutions:
        findings.append("All escalations happen after 1 question — graph does no real work")

    # --- Smell 5: safety node bypassable ---
    safety_nodes = [nid for nid, n in nodes.items() if n.get("safety_critical")]
    if safety_nodes:
        # Are there paths reaching a resolution WITHOUT hitting any safety node,
        # when safety nodes exist on other paths to the same resolution?
        for res_id in {p["terminal_node"] for p in resolutions}:
            to_res = [p for p in resolutions if p["terminal_node"] == res_id]
            with_safety = [p for p in to_res if p["safety_nodes_hit"]]
            without = [p for p in to_res if not p["safety_nodes_hit"]]
            if with_safety and without:
                findings.append(
                    f"Resolution '{res_id}' reachable both with and without safety gates "
                    f"({len(with_safety)} guarded, {len(without)} unguarded) — verify this is intended"
                )

    # --- Smell 6: resolution nodes missing explicit outcome_kind ---
    # A 'resolution' can mean two very different things:
    #   (a) the user performed a fix and it worked
    #   (b) nothing was wrong — the behavior is normal by design
    # These need different UI treatment and different analytics. Without an
    # explicit field we cannot tell them apart, so flag any that lack one.
    seen_missing = set()
    for p in resolutions:
        node = nodes[p["terminal_node"]]
        if "outcome_kind" not in node and p["terminal_node"] not in seen_missing:
            seen_missing.add(p["terminal_node"])
            findings.append(
                f"Resolution '{p['terminal_node']}' has no 'outcome_kind' — "
                f"cannot distinguish 'user fixed it' from 'this is normal behavior'"
            )

    # --- Smell 7: escalation with high confidence ---
    for p in escalations:
        node = nodes[p["terminal_node"]]
        if node.get("confidence") == "high":
            findings.append(
                f"Escalation '{p['terminal_node']}' has confidence='high' — "
                f"ambiguous: high confidence in WHAT? (that escalation is correct, or in a diagnosis?)"
            )
            break

    return {
        "graph_id": graph["graph_id"],
        "total_paths": len(paths),
        "resolutions": len(resolutions),
        "escalations": len(escalations),
        "max_questions": max((p["questions_asked"] for p in paths), default=0),
        "min_questions": min((p["questions_asked"] for p in paths), default=0),
        "node_count": len(nodes),
        "safety_nodes": len([n for n in nodes.values() if n.get("safety_critical")]),
        "findings": findings,
        "paths": paths,
    }


def print_report(result: dict, verbose: bool = False):
    print(f"\n{'='*70}")
    print(f"{result['graph_id']}")
    print(f"{'='*70}")
    print(f"  Nodes: {result['node_count']}  |  Paths: {result['total_paths']}  |  "
          f"Safety gates: {result['safety_nodes']}")
    print(f"  Outcomes: {result['resolutions']} resolution / {result['escalations']} escalation")
    print(f"  Questions asked: min {result['min_questions']}, max {result['max_questions']}")

    if result["findings"]:
        print(f"\n  FINDINGS:")
        for f in result["findings"]:
            print(f"    - {f}")
    else:
        print(f"\n  No semantic issues detected")

    if verbose:
        print(f"\n  ALL PATHS:")
        for i, p in enumerate(result["paths"], 1):
            ans = " → ".join(f"{nid}={a}" for nid, a in p["answers"]) or "(no questions)"
            print(f"    [{i}] {ans}")
            print(f"        → {p['outcome']} ({p['confidence']}) at {p['terminal_node']}")


def main():
    args = sys.argv[1:]
    verbose = "-v" in args
    args = [a for a in args if a != "-v"]

    script_dir = Path(__file__).parent

    if not args:
        print("Usage: python simulate_paths.py --all [-v]")
        print("       python simulate_paths.py data/manuals/<ชื่อคู่มือ>.json [-v]")
        sys.exit(1)

    manuals_dir = script_dir.parent / "data" / "manuals"

    if args[0] == "--all":
        manual_files = sorted(manuals_dir.glob("*.json"))
        if not manual_files:
            print(f"ไม่พบไฟล์คู่มือใน {manuals_dir}")
            sys.exit(1)
    else:
        manual_files = [Path(args[0])]

    graphs_to_check = []
    for mf in manual_files:
        raw = json.loads(mf.read_text(encoding="utf-8"))
        manual_id = raw.get("manual_id", mf.stem)
        print(f"\n{'#'*70}")
        print(f"# คู่มือ: {manual_id}")
        print(f"{'#'*70}")
        graphs_to_check.extend(raw.get("graphs", []))

    all_results = []
    for graph in graphs_to_check:
        result = analyze(graph)
        all_results.append(result)
        print_report(result, verbose)

    # Aggregate
    print(f"\n{'='*70}")
    print("AGGREGATE")
    print(f"{'='*70}")
    total_paths = sum(r["total_paths"] for r in all_results)
    total_findings = sum(len(r["findings"]) for r in all_results)
    print(f"  Graphs analyzed: {len(all_results)}")
    print(f"  Total distinct paths: {total_paths}")
    print(f"  Total findings: {total_findings}")
    print(f"  Avg paths per graph: {total_paths / len(all_results):.1f}")
    print(f"  Graphs with findings: {sum(1 for r in all_results if r['findings'])}/{len(all_results)}")

    # Group findings by type
    print(f"\n  FINDINGS BY GRAPH:")
    for r in all_results:
        if r["findings"]:
            print(f"    {r['graph_id']}: {len(r['findings'])}")


if __name__ == "__main__":
    main()