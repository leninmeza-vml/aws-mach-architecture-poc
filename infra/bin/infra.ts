#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { PocMachStack } from "../lib/poc-stack";

const app = new cdk.App();

new PocMachStack(app, "WppesMachPocDevStack", {
  stackName: "wppes-mach-poc-dev-use1-stack",
  orgPrefix: "wppes",
  workloadName: "mach-poc",
  environmentName: "dev",
  regionShort: "use1",
  githubOrgRepo:
    process.env.GITHUB_ORG_REPO || "leninmeza-vml/aws-mach-architecture-poc",
  githubPagesOrigin:
    process.env.GITHUB_PAGES_ORIGIN || "https://leninmeza-vml.github.io",
});
