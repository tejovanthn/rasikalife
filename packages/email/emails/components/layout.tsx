import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components';

const APP_NAME = 'Rasika Classes';

interface LayoutProps {
  preview: string;
  /**
   * The app's base URL, which is stage-aware and therefore has to be passed in rather than
   * written here. A hardcoded footer domain sent every dev-stage test email pointing at
   * production, while the button beside it pointed at the stage.
   */
  appUrl: string;
  children: React.ReactNode;
}

/** Regex rather than `new URL`, so a malformed base URL degrades the footer instead of throwing. */
function displayDomain(appUrl: string): string {
  return appUrl.replace(/^https?:\/\//, '').replace(/\/+$/, '');
}

export function EmailLayout({ preview, appUrl, children }: LayoutProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Text style={brand}>{APP_NAME}</Text>
          <Section>{children}</Section>
          <Hr style={hr} />
          <Text style={footerText}>
            {APP_NAME} ·{' '}
            <Link href={appUrl} style={footerLink}>
              {displayDomain(appUrl)}
            </Link>
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

const main = {
  backgroundColor: '#f6f5f3',
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
};

const container = {
  backgroundColor: '#ffffff',
  borderRadius: '8px',
  margin: '24px auto',
  maxWidth: '560px',
  padding: '24px',
};

const brand = {
  color: '#c2410c',
  fontSize: '18px',
  fontWeight: '700',
  margin: '0 0 16px',
};

const hr = {
  borderColor: '#e6e1db',
  margin: '32px 0 16px',
};

const footerText = {
  color: '#6b7280',
  fontSize: '12px',
  lineHeight: '16px',
  margin: '0',
};

const footerLink = {
  color: '#6b7280',
  textDecoration: 'underline',
};
