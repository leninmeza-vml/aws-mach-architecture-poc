#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { PocMachStack } from "../lib/poc-stack";

const app = new cdk.App();

new PocMachStack(app, "PocMachStack", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT || "123456789012",
    region: process.env.CDK_DEFAULT_REGION || "us-east-1",
  },
  githubOrgRepo:
    process.env.GITHUB_ORG_REPO || "leninmeza-vml/aws-mach-architecture-poc",
  githubPagesOrigin:
    process.env.GITHUB_PAGES_ORIGIN || "https://leninmeza-vml.github.io",
});
