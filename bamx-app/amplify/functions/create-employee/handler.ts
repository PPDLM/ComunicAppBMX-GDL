import type { Schema } from '../../data/resource';
import { env } from '$amplify/env/create-employee';
import {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
  AdminAddUserToGroupCommand,
} from '@aws-sdk/client-cognito-identity-provider';

const cognito = new CognitoIdentityProviderClient();

export const handler: Schema['createEmployeeAccount']['functionHandler'] = async (event) => {
  const email = event.arguments.email.trim().toLowerCase();
  const role = event.arguments.role;

  await cognito.send(
    new AdminCreateUserCommand({
      UserPoolId: env.AMPLIFY_AUTH_USERPOOL_ID,
      Username: email,
      UserAttributes: [
        { Name: 'email', Value: email },
        { Name: 'email_verified', Value: 'true' },
      ],
      DesiredDeliveryMediums: ['EMAIL'],
    })
  );

  await cognito.send(
    new AdminAddUserToGroupCommand({
      UserPoolId: env.AMPLIFY_AUTH_USERPOOL_ID,
      Username: email,
      GroupName: role as string,
    })
  );

  return { email, role };
};