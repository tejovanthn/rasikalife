import { getDomain } from './domain';

/**
 * Verifies the whole stage domain as an SES sender, so any address on it
 * (noreply@, ...) can send. `getDomain('')` already owns the DNS records for the site itself,
 * so this rides the same hosted zone rather than requesting a second one.
 */
const { name: sender, dns } = getDomain('');

export const email = new sst.aws.Email('Email', {
  sender,
  dns,
});
