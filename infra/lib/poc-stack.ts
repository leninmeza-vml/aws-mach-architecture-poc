import * as path from "node:path";
import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as rds from "aws-cdk-lib/aws-rds";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as logs from "aws-cdk-lib/aws-logs";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as apigwv2 from "aws-cdk-lib/aws-apigatewayv2";
import * as apigwv2Integrations from "aws-cdk-lib/aws-apigatewayv2-integrations";
import * as apigwv2Authorizers from "aws-cdk-lib/aws-apigatewayv2-authorizers";
import * as iam from "aws-cdk-lib/aws-iam";

export interface PocMachStackProps extends cdk.StackProps {
  orgPrefix?: string;
  workloadName?: string;
  environmentName?: string;
  regionShort?: string;
  githubOrgRepo?: string;
  githubPagesOrigin?: string;
  createOidcResources?: boolean;
}

export class PocMachStack extends cdk.Stack {
  public readonly httpApiUrl: cdk.CfnOutput;
  public readonly userPoolId: cdk.CfnOutput;

  constructor(scope: Construct, id: string, props?: PocMachStackProps) {
    super(scope, id, props);

    const orgPrefix = props?.orgPrefix ?? "wppes";
    const workloadName = props?.workloadName ?? "mach-poc";
    const environmentName = props?.environmentName ?? "dev";
    const regionShort = props?.regionShort ?? "mxc1";
    const resourcePrefix = `${orgPrefix}-${workloadName}-${environmentName}-${regionShort}`;

    const githubOrgRepo =
      props?.githubOrgRepo ?? "leninmeza-vml/aws-mach-architecture-poc";
    const githubPagesOrigin =
      props?.githubPagesOrigin ?? "https://leninmeza-vml.github.io";

    // Etiquetas corporativas estándar para WPP Enterprise Solutions
    cdk.Tags.of(this).add("Organization", "WPP Enterprise Solutions");
    cdk.Tags.of(this).add(
      "OrganizationUrl",
      "https://www.wpp.com/en/wpp-enterprise-solutions"
    );
    cdk.Tags.of(this).add("Workload", workloadName);
    cdk.Tags.of(this).add("Environment", environmentName);
    cdk.Tags.of(this).add("Region", "mx-central-1");
    cdk.Tags.of(this).add("Architecture", "MACH-API-Led");
    cdk.Tags.of(this).add("ManagedBy", "AWS-CDK-v2");

    // 1. Red (VPC) en Querétaro, México (mx-central-1) con subredes públicas y privadas aisladas
    const vpc = new ec2.Vpc(this, "PocMachVpc", {
      vpcName: `${resourcePrefix}-vpc`,
      availabilityZones: ["mx-central-1a", "mx-central-1b"],
      natGateways: 0,
      subnetConfiguration: [
        {
          name: `${resourcePrefix}-snet-public`,
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 24,
        },
        {
          name: `${resourcePrefix}-snet-isolated`,
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
          cidrMask: 24,
        },
      ],
    });

    // Security Groups de privilegio mínimo
    const sapiLambdaSg = new ec2.SecurityGroup(this, "SapiLambdaSecurityGroup", {
      vpc,
      securityGroupName: `${resourcePrefix}-sg-sapi-lambda`,
      description: "Security Group para la Lambda System API (sAPI)",
      allowAllOutbound: true,
    });

    const dbSg = new ec2.SecurityGroup(this, "DatabaseSecurityGroup", {
      vpc,
      securityGroupName: `${resourcePrefix}-sg-rds-postgres`,
      description:
        "Security Group para RDS PostgreSQL - solo acepta puerto 5432 desde sAPI",
      allowAllOutbound: false,
    });

    dbSg.addIngressRule(
      sapiLambdaSg,
      ec2.Port.tcp(5432),
      "Permitir acceso PostgreSQL (5432) exclusivamente desde Lambda sAPI"
    );

    // 2. Credenciales en AWS Secrets Manager + Base de Datos RDS PostgreSQL en subred privada aislada
    const dbCredentialsSecret = new secretsmanager.Secret(
      this,
      "PocMachDbSecret",
      {
        secretName: `${orgPrefix}/${workloadName}/${environmentName}/${regionShort}/rds-postgres-credentials`,
        description:
          "Credenciales administradas para PostgreSQL de WPP Enterprise Solutions MACH PoC",
        generateSecretString: {
          secretStringTemplate: JSON.stringify({ username: "wppes_mach_admin" }),
          generateStringKey: "password",
          excludePunctuation: true,
          includeSpace: false,
        },
      }
    );

    const database = new rds.DatabaseInstance(this, "PocMachPostgresDb", {
      instanceIdentifier: `${resourcePrefix}-rds-pg`,
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_16,
      }),
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.T4G,
        ec2.InstanceSize.MICRO
      ),
      vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
      },
      securityGroups: [dbSg],
      credentials: rds.Credentials.fromSecret(dbCredentialsSecret),
      databaseName: "wppes_mach_poc",
      allocatedStorage: 20,
      storageEncrypted: true,
      multiAz: false,
      publiclyAccessible: false,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      deletionProtection: false,
    });

    const monorepoRoot = path.resolve(__dirname, "../../..");

    // 3. Observabilidad centralizada (CloudWatch Logs) y Microservicios API-Led (sAPI, pAPI, xAPI)
    const sapiFnName = `${resourcePrefix}-lmb-sapi`;
    const papiFnName = `${resourcePrefix}-lmb-papi`;
    const xapiFnName = `${resourcePrefix}-lmb-xapi`;

    const sapiLogGroup = new logs.LogGroup(this, "SapiLogGroup", {
      logGroupName: `/aws/lambda/${sapiFnName}`,
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const sapiFunction = new lambda.Function(this, "SapiLambda", {
      functionName: sapiFnName,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "handler.handler",
      timeout: cdk.Duration.seconds(15),
      code: lambda.Code.fromAsset(
        path.join(monorepoRoot, "apps/sapi/dist-lambda")
      ),
      vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
      },
      securityGroups: [sapiLambdaSg],
      logGroup: sapiLogGroup,
      tracing: lambda.Tracing.ACTIVE,
      environment: {
        DB_SECRET_ARN: dbCredentialsSecret.secretArn,
        DB_HOST: database.dbInstanceEndpointAddress,
        DB_PORT: database.dbInstanceEndpointPort,
        DB_NAME: "wppes_mach_poc",
        DB_USER: "wppes_mach_admin",
        DB_PASSWORD: dbCredentialsSecret
          .secretValueFromJson("password")
          .unsafeUnwrap(),
      },
    });

    dbCredentialsSecret.grantRead(sapiFunction);

    const papiLogGroup = new logs.LogGroup(this, "PapiLogGroup", {
      logGroupName: `/aws/lambda/${papiFnName}`,
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const papiFunction = new lambda.Function(this, "PapiLambda", {
      functionName: papiFnName,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "handler.handler",
      timeout: cdk.Duration.seconds(15),
      code: lambda.Code.fromAsset(
        path.join(monorepoRoot, "apps/papi/dist-lambda")
      ),
      logGroup: papiLogGroup,
      tracing: lambda.Tracing.ACTIVE,
      environment: {
        SAPI_FUNCTION_NAME: sapiFunction.functionName,
      },
    });

    sapiFunction.grantInvoke(papiFunction);

    const xapiLogGroup = new logs.LogGroup(this, "XapiLogGroup", {
      logGroupName: `/aws/lambda/${xapiFnName}`,
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const xapiFunction = new lambda.Function(this, "XapiLambda", {
      functionName: xapiFnName,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "handler.handler",
      timeout: cdk.Duration.seconds(15),
      code: lambda.Code.fromAsset(
        path.join(monorepoRoot, "apps/xapi/dist-lambda")
      ),
      logGroup: xapiLogGroup,
      tracing: lambda.Tracing.ACTIVE,
      environment: {
        PAPI_FUNCTION_NAME: papiFunction.functionName,
      },
    });

    papiFunction.grantInvoke(xapiFunction);

    // 4. Amazon Cognito + Amazon API Gateway v2 (HTTP API) con CORS para GitHub Pages y Localhost
    const userPool = new cognito.UserPool(this, "PocMachUserPool", {
      userPoolName: `${resourcePrefix}-cog-up`,
      selfSignUpEnabled: false,
      signInAliases: { email: true },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const userPoolClient = userPool.addClient("PocMachWebClient", {
      userPoolClientName: `${resourcePrefix}-cog-client-web`,
      authFlows: {
        userPassword: true,
        userSrp: true,
      },
    });

    const jwtAuthorizer = new apigwv2Authorizers.HttpUserPoolAuthorizer(
      "PocMachCognitoJwtAuthorizer",
      userPool,
      {
        authorizerName: `${resourcePrefix}-auth-cognito-jwt`,
        userPoolClients: [userPoolClient],
      }
    );
    void jwtAuthorizer;

    const httpApi = new apigwv2.HttpApi(this, "PocMachHttpApi", {
      apiName: `${resourcePrefix}-apigw-xapi`,
      description:
        "WPP Enterprise Solutions - HTTP API v2 de la capa Experience API (xAPI) con CORS estricto para GitHub Pages",
      corsPreflight: {
        allowOrigins: [githubPagesOrigin, "http://localhost:3000"],
        allowMethods: [
          apigwv2.CorsHttpMethod.GET,
          apigwv2.CorsHttpMethod.POST,
          apigwv2.CorsHttpMethod.DELETE,
          apigwv2.CorsHttpMethod.OPTIONS,
        ],
        allowHeaders: ["Content-Type", "Authorization", "traceparent"],
        exposeHeaders: ["traceparent"],
        maxAge: cdk.Duration.hours(1),
      },
    });

    const xapiIntegration = new apigwv2Integrations.HttpLambdaIntegration(
      "XapiHttpLambdaIntegration",
      xapiFunction
    );

    httpApi.addRoutes({
      path: "/v1/transactions",
      methods: [apigwv2.HttpMethod.POST, apigwv2.HttpMethod.DELETE],
      integration: xapiIntegration,
    });

    httpApi.addRoutes({
      path: "/v1/transactions/{transactionId}",
      methods: [apigwv2.HttpMethod.GET],
      integration: xapiIntegration,
    });

    // 5. Federación OIDC para GitHub Actions (Cero Credenciales Estáticas)
    const shouldCreateOidc =
      props?.createOidcResources ??
      process.env.CREATE_OIDC_RESOURCES !== "false";

    if (shouldCreateOidc) {
      const githubOidcProvider = new iam.OpenIdConnectProvider(
        this,
        "GitHubActionsOidcProvider",
        {
          url: "https://token.actions.githubusercontent.com",
          clientIds: ["sts.amazonaws.com"],
        }
      );

      const githubActionsDeployRole = new iam.Role(
        this,
        "GitHubActionsOidcDeployRole",
        {
          roleName: `${orgPrefix}-${workloadName}-${environmentName}-global-iam-role-gh-oidc`,
          assumedBy: new iam.WebIdentityPrincipal(
            githubOidcProvider.openIdConnectProviderArn,
            {
              StringEquals: {
                "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
              },
              StringLike: {
                "token.actions.githubusercontent.com:sub": `repo:${githubOrgRepo}:*`,
              },
            }
          ),
          description:
            "Rol asumible por GitHub Actions mediante OIDC sin claves estáticas para WPP Enterprise Solutions",
        }
      );

      githubActionsDeployRole.addManagedPolicy(
        iam.ManagedPolicy.fromAwsManagedPolicyName("PowerUserAccess")
      );
    }

    this.httpApiUrl = new cdk.CfnOutput(this, "HttpApiEndpoint", {
      value: httpApi.apiEndpoint,
      description: "URL base del endpoint de API Gateway v2 (xAPI)",
    });

    this.userPoolId = new cdk.CfnOutput(this, "CognitoUserPoolId", {
      value: userPool.userPoolId,
      description: "ID del User Pool de Cognito para emisión de JWT",
    });
  }
}
