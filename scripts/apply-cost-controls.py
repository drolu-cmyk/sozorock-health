"""Apply the specifically authorized October 2026 cost controls using existing IAM.

No SQL, secret values, database deletion, IP release, or IAM changes are used.
Run without --apply to inspect; operations denied by IAM are reported as blocked.
"""

import argparse
import datetime as dt
import json
import os
from pathlib import Path
import subprocess


ACCOUNT = "791860731989"
REGION = "us-east-1"
APP = "d307qqji18y8il"
APP_ARN = f"arn:aws:amplify:{REGION}:{ACCOUNT}:apps/{APP}"
WAF_STACK = "sozorock-health-cbcap-waf"
WAF_ID = "15608475-1d6c-4e58-9888-1cce47be8059"
CLUSTERS = {
    "sozorock-evidence-production": "sozorock-evidence-production-writer",
    "sozorock-evidence-staging": "sozorock-evidence-staging-writer",
    "sozorock-np": "sozorock-np-instance-1",
}


class ControlBlocked(RuntimeError):
    pass


def aws(service, operation, *args):
    result = subprocess.run(
        ["aws", service, operation, *args, "--region", REGION,
         "--output", "json", "--no-cli-pager"],
        capture_output=True, text=True, check=False, timeout=90,
    )
    if result.returncode:
        # All calls use fixed resource identifiers and never include credentials.
        raise ControlBlocked(result.stderr.strip()[:1500])
    return json.loads(result.stdout) if result.stdout.strip() else {}


def require_account(call):
    account = call("sts", "get-caller-identity").get("Account")
    if account != ACCOUNT:
        raise ControlBlocked(f"Unexpected AWS account: {account}; no changes allowed.")


def require_dedicated_waf(resources, stack):
    active = [r for r in resources if r.get("ResourceStatus") != "DELETE_COMPLETE"]
    types = sorted(r.get("ResourceType") for r in active)
    if types != ["AWS::WAFv2::WebACL", "AWS::WAFv2::WebACLAssociation"]:
        raise ControlBlocked("WAF stack contains unexpected resources; deletion refused.")
    acl = next(r for r in active if r["ResourceType"] == "AWS::WAFv2::WebACL")
    parts = acl.get("PhysicalResourceId", "").split("|")
    if parts != ["sozorock-health-cbcap-production", WAF_ID, "CLOUDFRONT"]:
        raise ControlBlocked("WAF identity does not match the authorized ACL.")
    parameters = {p["ParameterKey"]: p.get("ParameterValue") for p in stack.get("Parameters", [])}
    if parameters.get("AmplifyAppArn") != APP_ARN:
        raise ControlBlocked("WAF stack protects an unexpected application.")
    if stack.get("EnableTerminationProtection"):
        raise ControlBlocked("WAF stack has termination protection; leave it intact.")


def retire_waf(call, apply, output):
    stack = call("cloudformation", "describe-stacks", "--stack-name", WAF_STACK)["Stacks"][0]
    if stack.get("StackStatus") == "DELETE_IN_PROGRESS":
        return {"status": "deletion_in_progress"}
    resources = call("cloudformation", "describe-stack-resources", "--stack-name", WAF_STACK)["StackResources"]
    require_dedicated_waf(resources, stack)
    if not apply:
        return {"status": "validated", "stack": WAF_STACK}
    template = call("cloudformation", "get-template", "--stack-name", WAF_STACK)
    backup = output / "cbcap-waf-template-backup.json"
    backup.write_text(json.dumps(template, indent=2) + "\n", encoding="utf-8")
    backup.chmod(0o600)
    call("cloudformation", "delete-stack", "--stack-name", WAF_STACK)
    return {"status": "deletion_requested", "stack": WAF_STACK, "backup": backup.name}


def reconcile_scaling(call, apply):
    result = []
    for name, writer in CLUSTERS.items():
        cluster = call("rds", "describe-db-clusters", "--db-cluster-identifier", name)["DBClusters"][0]
        if cluster.get("DBClusterIdentifier") != name or cluster.get("Engine") != "aurora-postgresql":
            raise ControlBlocked("Unexpected Aurora cluster identity or engine.")
        scaling = cluster.get("ServerlessV2ScalingConfiguration", {})
        entry = {"cluster": name, "scaling": scaling, "status": "observed"}
        if scaling.get("MinCapacity") == 0 and scaling.get("SecondsUntilAutoPause") == 900:
            entry["status"] = "configured"
        elif apply:
            maximum = scaling.get("MaxCapacity")
            if not isinstance(maximum, (int, float)) or maximum <= 0.5:
                raise ControlBlocked("Cannot preserve the current maximum capacity.")
            call("rds", "modify-db-cluster", "--db-cluster-identifier", name,
                 "--serverless-v2-scaling-configuration",
                 f"MinCapacity=0,MaxCapacity={maximum},SecondsUntilAutoPause=900",
                 "--apply-immediately")
            entry["status"] = "change_requested"
        result.append(entry)
    return result


def make_np_private(call, apply):
    db = call("rds", "describe-db-instances", "--db-instance-identifier", CLUSTERS["sozorock-np"])["DBInstances"][0]
    if db.get("DBInstanceIdentifier") != CLUSTERS["sozorock-np"] or db.get("DBClusterIdentifier") != "sozorock-np":
        raise ControlBlocked("Unexpected nonproduction instance identity.")
    if db.get("Engine") != "aurora-postgresql" or db.get("DBInstanceClass") != "db.serverless":
        raise ControlBlocked("Unexpected nonproduction database engine or class.")
    if not db.get("PubliclyAccessible"):
        return {"status": "already_private"}
    if not apply:
        return {"status": "validated", "instance": db["DBInstanceIdentifier"]}
    call("rds", "modify-db-instance", "--db-instance-identifier", db["DBInstanceIdentifier"],
         "--no-publicly-accessible", "--apply-immediately")
    observed = call("rds", "describe-db-instances", "--db-instance-identifier", db["DBInstanceIdentifier"])["DBInstances"][0]
    return {"status": "private" if not observed.get("PubliclyAccessible") else "change_requested",
            "instance": db["DBInstanceIdentifier"]}


def capacity_observations(call):
    end = dt.datetime.now(dt.timezone.utc)
    start = end - dt.timedelta(minutes=30)
    result = []
    for writer in CLUSTERS.values():
        metrics = call("cloudwatch", "get-metric-statistics", "--namespace", "AWS/RDS",
                       "--metric-name", "ServerlessDatabaseCapacity", "--dimensions",
                       f"Name=DBInstanceIdentifier,Value={writer}", "--start-time", start.isoformat(),
                       "--end-time", end.isoformat(), "--period", "300", "--statistics", "Minimum", "Maximum")
        points = sorted(metrics.get("Datapoints", []), key=lambda p: p["Timestamp"])[-3:]
        result.append({"instance": writer, "recent_capacity": points})
    return result


def suspend_cbcap_autobuild(call, apply):
    app = call("amplify", "get-app", "--app-id", APP)["app"]
    if app.get("appId") != APP or app.get("name") != "sozorock-health-cbcap":
        raise ControlBlocked("Unexpected CB-CAP application identity.")
    errors = []
    if apply:
        for operation, arguments in [
            ("update-app", ("--app-id", APP, "--no-enable-branch-auto-build", "--no-enable-auto-branch-creation")),
            ("update-branch", ("--app-id", APP, "--branch-name", "main", "--no-enable-auto-build")),
        ]:
            try:
                call("amplify", operation, *arguments)
            except (ControlBlocked, subprocess.TimeoutExpired) as error:
                errors.append({"operation": operation, "reason": str(error)})
    observed = call("amplify", "get-app", "--app-id", APP)["app"]
    branch = call("amplify", "get-branch", "--app-id", APP, "--branch-name", "main")["branch"]
    return {"status": "blocked_or_unverified" if errors else "observed",
            "app_auto_build": observed.get("enableBranchAutoBuild"),
            "main_auto_build": branch.get("enableAutoBuild"), "firewall": observed.get("wafConfiguration"),
            "errors": errors}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--phase", choices=["database", "cbcap"], required=True)
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--output", type=Path, default=Path("output/cost-controls"))
    args = parser.parse_args()
    os.umask(0o077)
    require_account(aws)
    args.output.mkdir(parents=True, exist_ok=True)
    report = {"account": ACCOUNT, "region": REGION, "apply": args.apply, "phase": args.phase,
              "timestamp": dt.datetime.now(dt.timezone.utc).isoformat(), "operations": {}}
    tasks = [("scaling", lambda: reconcile_scaling(aws, args.apply)),
             ("np_public_access", lambda: make_np_private(aws, args.apply)),
             ("capacity", lambda: capacity_observations(aws))] if args.phase == "database" else [
                 ("cbcap_auto_build", lambda: suspend_cbcap_autobuild(aws, args.apply))]
    tasks.append(("cbcap_waf", lambda: retire_waf(aws, args.apply, args.output)))
    for name, task in tasks:
        try:
            report["operations"][name] = task()
        except (ControlBlocked, KeyError, ValueError, OSError, subprocess.TimeoutExpired) as error:
            report["operations"][name] = {"status": "blocked_or_unverified", "reason": str(error)}
    report["result"] = "partial" if any(isinstance(v, dict) and v.get("status") == "blocked_or_unverified"
                                        for v in report["operations"].values()) else "operations_reported"
    rendered = json.dumps(report, indent=2)
    (args.output / f"{args.phase}-report.json").write_text(rendered + "\n", encoding="utf-8")
    print(rendered)
    if os.environ.get("GITHUB_STEP_SUMMARY"):
        with open(os.environ["GITHUB_STEP_SUMMARY"], "a", encoding="utf-8") as summary:
            summary.write(f"\n## Cost controls: {args.phase}\n\n```json\n{rendered}\n```\n")


if __name__ == "__main__":
    main()
