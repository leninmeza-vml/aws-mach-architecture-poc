import { describe, it } from "node:test";
import * as cdk from "aws-cdk-lib";
import { Template, Match } from "aws-cdk-lib/assertions";
import { PocMachStack } from "./poc-stack";

describe("PocMachStack AWS CDK v2 IaC synthesis", () => {
  it("sintetiza VPC, RDS PostgreSQL privado, Secrets Manager, Lambdas xAPI/pAPI/sAPI, API Gateway v2 y OIDC Role", () => {
    const app = new cdk.App();
    const stack = new PocMachStack(app, "TestPocMachStack", {
      githubOrgRepo: "leninmeza-vml/aws-mach-architecture-poc",
      githubPagesOrigin: "https://leninmeza-vml.github.io",
    });

    const template = Template.fromStack(stack);

    template.resourceCountIs("AWS::EC2::VPC", 1);
    template.resourceCountIs("AWS::RDS::DBInstance", 1);
    template.resourceCountIs("AWS::SecretsManager::Secret", 1);
    template.resourceCountIs("AWS::ApiGatewayV2::Api", 1);

    template.hasResourceProperties("AWS::EC2::SecurityGroupIngress", {
      IpProtocol: "tcp",
      FromPort: 5432,
      ToPort: 5432,
    });

    template.hasResourceProperties("AWS::ApiGatewayV2::Api", {
      Name: "wppes-mach-poc-dev-mxc1-apigw-xapi",
      CorsConfiguration: Match.objectLike({
        AllowOrigins: ["https://leninmeza-vml.github.io"],
        AllowHeaders: Match.arrayWith(["Authorization", "traceparent"]),
      }),
    });

    template.hasResourceProperties("AWS::Lambda::Function", {
      FunctionName: "wppes-mach-poc-dev-mxc1-lmb-xapi",
    });

    template.hasResourceProperties("AWS::Lambda::Function", {
      FunctionName: "wppes-mach-poc-dev-mxc1-lmb-papi",
    });

    template.hasResourceProperties("AWS::Lambda::Function", {
      FunctionName: "wppes-mach-poc-dev-mxc1-lmb-sapi",
    });

    template.hasResourceProperties("AWS::RDS::DBInstance", {
      DBInstanceIdentifier: "wppes-mach-poc-dev-mxc1-rds-pg",
      DBName: "wppes_mach_poc",
    });
  });
});
