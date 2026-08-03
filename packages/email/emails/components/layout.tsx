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
const APP_DOMAIN = 'classes.rasika.life';

interface LayoutProps {
  preview: string;
  children: React.ReactNode;
}

export function EmailLayout({ preview, children }: LayoutProps) {
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
            <Link href={`https://${APP_DOMAIN}`} style={footerLink}>
              {APP_DOMAIN}
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
