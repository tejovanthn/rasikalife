import { Button as ReactEmailButton } from '@react-email/components';

interface ButtonProps {
  href: string;
  children: React.ReactNode;
}

export function Button({ href, children }: ButtonProps) {
  return (
    <ReactEmailButton href={href} style={button}>
      {children}
    </ReactEmailButton>
  );
}

const button = {
  backgroundColor: '#c2410c',
  borderRadius: '8px',
  color: '#ffffff',
  display: 'inline-block',
  fontSize: '14px',
  fontWeight: '600',
  padding: '10px 20px',
  textAlign: 'center' as const,
  textDecoration: 'none',
};
