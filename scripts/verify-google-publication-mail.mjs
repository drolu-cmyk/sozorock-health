import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';
import nodemailer from 'nodemailer';
import { googlePublicationSmtpOptions } from '../apps/public-site/app/lib/publication-mail.mjs';
try {
  const name = process.env.PUBLICATION_GOOGLE_MAIL_PARAMETER;
  if (name !== '/sozorock-foundation/publication-google-mail') throw new Error('Unexpected mail parameter');
  const result = await new SSMClient({region: process.env.AWS_REGION || 'us-east-1'}).send(new GetParameterCommand({Name:name,WithDecryption:true}));
  const options = googlePublicationSmtpOptions(JSON.parse(result.Parameter?.Value || '{}'));
  if (options.auth.user !== process.env.PUBLICATION_EMAIL_FROM) throw new Error('Sender mismatch');
  await nodemailer.createTransport(options).verify();
  console.log('Google publication SMTP authentication verified.');
} catch {
  console.error('Google publication SMTP readiness failed. No credentials or provider error details are logged.');
  process.exitCode = 1;
}
