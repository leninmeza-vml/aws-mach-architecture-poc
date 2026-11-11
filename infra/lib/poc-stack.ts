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
  githubOrgRepo?: string;
  githubPagesOrigin?: string;
}

export class PocMachStack extends cdk.Stack {
  public readonly httpApiUrl: cdk.CfnOutput;
  public readonly userPoolId: cdk.CfnOutput;

  constructor(scope: Construct, id: string, props?: PocMachStackProps) {
    super(scope, id, props);

    const githubOrgRepo =
      props?.githubOrgRepo ?? "leninmeza-vml/aws-mach-architecture-poc";
    const githubPagesOrigin =
      props?.githubPagesOrigin ?? "https://leninmeza-vml.github.io";

    // 1. Red (VPC) con subredes públicas y privadas aisladas
    const vpc = new ec2.Vpc(this, "PocMachVpc", {
      maxAzs: 2,
      natGateways: 0,
      subnetConfiguration: [
        {
          name: "PublicSubnet",
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 24,
        },
        {
          name: "PrivateIsolatedSubnet",
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
          cidrMask: 24,
        },
      ],
    });

    // Security Groups de privilegio mínimo
    const sapiLambdaSg = new ec2.SecurityGroup(this, "SapiLambdaSecurityGroup", {
      vpc,
      description: "Security Group para la Lambda System API (sAPI)",
      allowAllOutbound: true,
    });

    const dbSg = new ec2.SecurityGroup(this, "DatabaseSecurityGroup", {
      vpc,
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
        secretName: "poc-mach/rds/postgres-credentials",
        description: "Credenciales administradas para PostgreSQL de PoC MACH",
        generateSecretString: {
          secretStringTemplate: JSON.stringify({ username: "mach_admin" }),
          generateStringKey: "password",
          excludePunctuation: true,
          includeSpace: false,
        },
      }
    );

    const database = new rds.DatabaseInstance(this, "PocMachPostgresDb", {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_16_3,
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
      databaseName: "machpocdb",
      allocatedStorage: 20,
      storageEncrypted: true,
      multiAz: false,
      publiclyAccessible: false,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      deletionProtection: false,
    });

    const monorepoRoot = path.resolve(__dirname, "../../..");

    // 3. Observabilidad centralizada (CloudWatch Logs) y Microservicios API-Led (sAPI, pAPI, xAPI)
    const sapiLogGroup = new logs.LogGroup(this, "SapiLogGroup", {
      logGroupName: "/aws/lambda/poc-mach-sapi",
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const sapiFunction = new lambda.Function(this, "SapiLambda", {
      functionName: "poc-mach-sapi",
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "handler.handler",
      code: lambda.Code.fromAsset(
        path.join(monorepoRoot, "apps/sapi/dist")
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
        DB_NAME: "machpocdb",
      },
    });

    dbCredentialsSecret.grantRead(sapiFunction);

    const papiLogGroup = new logs.LogGroup(this, "PapiLogGroup", {
      logGroupName: "/aws/lambda/poc-mach-papi",
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const papiFunction = new lambda.Function(this, "PapiLambda", {
      functionName: "poc-mach-papi",
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "handler.handler",
      code: lambda.Code.fromAsset(
        path.join(monorepoRoot, "apps/papi/dist")
      ),
      logGroup: papiLogGroup,
      tracing: lambda.Tracing.ACTIVE,
      environment: {
        SAPI_FUNCTION_NAME: sapiFunction.functionName,
      },
    });

    sapiFunction.grantInvoke(papiFunction);

    const xapiLogGroup = new logs.LogGroup(this, "XapiLogGroup", {
      logGroupName: "/aws/lambda/poc-mach-xapi",
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const xapiFunction = new lambda.Function(this, "XapiLambda", {
      functionName: "poc-mach-xapi",
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "handler.handler",
      code: lambda.Code.fromAsset(
        path.join(monorepoRoot, "apps/xapi/dist")
      ),
      logGroup: xapiLogGroup,
      tracing: lambda.Tracing.ACTIVE,
      environment: {
        PAPI_FUNCTION_NAME: papiFunction.functionName,
      },
    });

    papiFunction.grantInvoke(xapiFunction);

    // 4. Amazon Cognito + Amazon API Gateway v2 (HTTP API) con CORS estricto y JWT Authorizer
    const userPool = new cognito.UserPool(this, "PocMachUserPool", {
      userPoolName: "poc-mach-users",
      selfSignUpEnabled: false,
      signInAliases: { email: true },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const userPoolClient = userPool.addClient("PocMachWebClient", {
      userPoolClientName: "poc-mach-web-client",
      authFlows: {
        userPassword: true,
        userSrp: true,
      },
    });

    const jwtAuthorizer = new apigwv2Authorizers.HttpUserPoolAuthorizer(
      "PocMachCognitoJwtAuthorizer",
      userPool,
      {
        userPoolClients: [userPoolClient],
      }
    );

    const httpApi = new apigwv2.HttpApi(this, "PocMachHttpApi", {
      apiName: "poc-mach-experience-http-api",
      description:
        "HTTP API v2 de la capa Experience API (xAPI) con CORS estricto para GitHub Pages",
      corsPreflight: {
        allowOrigins: [githubPagesOrigin],
        allowMethods: [
          apigwv2.CorsHttpMethod.GET,
          apigwv2.CorsHttpMethod.POST,
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
      methods: [apigwv2.HttpMethod.POST],
      integration: xapiIntegration,
      authorizer: jwtAuthorizer,
    });

    httpApi.addRoutes({
      path: "/v1/transactions/{transactionId}",
      methods: [apigwv2.HttpMethod.GET],
      integration: xapiIntegration,
      authorizer: jwtAuthorizer,
    });

    // 5. Federación OIDC para GitHub Actions (Cero Credenciales Estáticas)
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
        roleName: "poc-mach-github-actions-oidc-role",
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
          "Rol asumible por GitHub Actions mediante OIDC sin claves estáticas",
      }
    );

    githubActionsDeployRole.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName("PowerUserAccess")
    );

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
