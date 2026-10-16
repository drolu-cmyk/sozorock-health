import importlib.util
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location("cost_controls", Path(__file__).parents[1] / "apply-cost-controls.py")
controls = importlib.util.module_from_spec(spec)
spec.loader.exec_module(controls)


class CostControlBoundaries(unittest.TestCase):
    def stack(self):
        return {"Parameters": [{"ParameterKey": "AmplifyAppArn", "ParameterValue": controls.APP_ARN}]}

    def resources(self):
        return [{"ResourceType": "AWS::WAFv2::WebACL", "PhysicalResourceId":
                 f"sozorock-health-cbcap-production|{controls.WAF_ID}|CLOUDFRONT"},
                {"ResourceType": "AWS::WAFv2::WebACLAssociation"}]

    def test_other_account_cannot_proceed(self):
        with self.assertRaises(controls.ControlBlocked):
            controls.require_account(lambda *args: {"Account": "891377012881"})

    def test_stack_containing_database_cannot_be_deleted(self):
        with self.assertRaises(controls.ControlBlocked):
            controls.require_dedicated_waf(self.resources() + [{"ResourceType": "AWS::RDS::DBCluster"}], self.stack())

    def test_other_application_cannot_be_deleted(self):
        stack = self.stack()
        stack["Parameters"][0]["ParameterValue"] = controls.APP_ARN.replace(controls.APP, "d2k1gmeov1v557")
        with self.assertRaises(controls.ControlBlocked):
            controls.require_dedicated_waf(self.resources(), stack)

    def test_other_acl_cannot_be_deleted(self):
        resources = self.resources()
        resources[0]["PhysicalResourceId"] = "another-firewall|different-id|CLOUDFRONT"
        with self.assertRaises(controls.ControlBlocked):
            controls.require_dedicated_waf(resources, self.stack())

    def test_dry_run_does_not_delete_or_read_template(self):
        calls = []
        def call(service, operation, *args):
            calls.append(operation)
            return {"Stacks": [self.stack()]} if operation == "describe-stacks" else {"StackResources": self.resources()}
        with tempfile.TemporaryDirectory() as directory:
            result = controls.retire_waf(call, False, Path(directory))
            self.assertEqual(result["status"], "validated")
            self.assertEqual(calls, ["describe-stacks", "describe-stack-resources"])
            self.assertEqual(list(Path(directory).iterdir()), [])

    def test_backup_exists_before_firewall_deletion(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory)
            def call(service, operation, *args):
                if operation == "describe-stacks": return {"Stacks": [self.stack()]}
                if operation == "describe-stack-resources": return {"StackResources": self.resources()}
                if operation == "get-template": return {"TemplateBody": "saved firewall configuration"}
                if operation == "delete-stack":
                    self.assertTrue((output / "cbcap-waf-template-backup.json").is_file())
                    self.assertEqual(args, ("--stack-name", controls.WAF_STACK))
                    return {}
                self.fail(f"Unexpected AWS operation: {operation}")
            self.assertEqual(controls.retire_waf(call, True, output)["status"], "deletion_requested")

    def test_other_instance_does_not_change_network_access(self):
        def call(service, operation, *args):
            self.assertEqual(operation, "describe-db-instances")
            return {"DBInstances": [{"DBInstanceIdentifier": controls.CLUSTERS["sozorock-evidence-production"],
                    "DBClusterIdentifier": "sozorock-evidence-production", "PubliclyAccessible": True}]}
        with self.assertRaises(controls.ControlBlocked):
            controls.make_np_private(call, True)

    def test_nonproduction_dry_run_does_not_modify_instance(self):
        def call(service, operation, *args):
            self.assertEqual(operation, "describe-db-instances")
            return {"DBInstances": [{"DBInstanceIdentifier": controls.CLUSTERS["sozorock-np"],
                    "DBClusterIdentifier": "sozorock-np", "PubliclyAccessible": True,
                    "Engine": "aurora-postgresql", "DBInstanceClass": "db.serverless"}]}
        self.assertEqual(controls.make_np_private(call, False)["status"], "validated")

    def test_partial_autobuild_change_is_reported(self):
        app = {"appId": controls.APP, "name": "sozorock-health-cbcap", "enableBranchAutoBuild": True}
        def call(service, operation, *args):
            if operation == "get-app": return {"app": app.copy()}
            if operation == "update-app":
                app["enableBranchAutoBuild"] = False
                return {}
            if operation == "update-branch": raise controls.ControlBlocked("AccessDenied")
            if operation == "get-branch": return {"branch": {"enableAutoBuild": True}}
            self.fail(f"Unexpected AWS operation: {operation}")
        result = controls.suspend_cbcap_autobuild(call, True)
        self.assertEqual(result["status"], "blocked_or_unverified")
        self.assertFalse(result["app_auto_build"])
        self.assertTrue(result["main_auto_build"])
        self.assertEqual(result["errors"][0]["operation"], "update-branch")


if __name__ == "__main__":
    unittest.main()
