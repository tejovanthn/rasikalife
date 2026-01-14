import { ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';

const NavLink = ({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) => (
  <a
    href={href}
    className="block px-3 py-2 rounded-md text-sm font-medium hover:bg-muted transition-colors"
  >
    {children}
  </a>
);

const FooterSection = ({
  title,
  links,
  isOpen,
  onToggle,
}: {
  title: string;
  links: Array<{ href: string; label: string }>;
  isOpen: boolean;
  onToggle: () => void;
}) => (
  <div className="border-b border-border pb-4 mb-4 md:border-0 md:pb-0 md:mb-0">
    <button
      type="button"
      onClick={onToggle}
      className="flex items-center justify-between w-full md:hidden text-left font-semibold mb-2"
      aria-expanded={isOpen}
    >
      {title}
      {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
    </button>
    <div className={`md:block ${isOpen ? 'block' : 'hidden'}`}>
      <h3 className="hidden md:block font-semibold mb-2">{title}</h3>
      <div className="space-y-1">
        {links.map(link => (
          <NavLink key={link.label} href={link.href}>
            {link.label}
          </NavLink>
        ))}
      </div>
    </div>
  </div>
);

export const Footer = () => {
  const [aboutOpen, setAboutOpen] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const [communityOpen, setCommunityOpen] = useState(false);

  const aboutLinks = [
    { href: '/about', label: 'About' },
    { href: '/privacy', label: 'Privacy' },
    { href: '/tos', label: 'Terms' },
    { href: '/attribution', label: 'Attribution' },
    { href: '/accessibility', label: 'Accessibility' },
  ];

  const supportLinks = [
    { href: '/contact', label: 'Contact' },
    { href: '/faq', label: 'FAQ' },
    { href: '/support', label: 'Support' },
  ];

  const communityLinks = [
    { href: '/contribute', label: 'Contribute' },
    { href: '/community', label: 'Community' },
    { href: '/donate', label: 'Donate' },
  ];

  return (
    <footer className="bg-background border-t">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="py-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <FooterSection
              title="About & Legal"
              links={aboutLinks}
              isOpen={aboutOpen}
              onToggle={() => setAboutOpen(!aboutOpen)}
            />
            <FooterSection
              title="Support"
              links={supportLinks}
              isOpen={supportOpen}
              onToggle={() => setSupportOpen(!supportOpen)}
            />
            <FooterSection
              title="Community"
              links={communityLinks}
              isOpen={communityOpen}
              onToggle={() => setCommunityOpen(!communityOpen)}
            />
          </div>
          <div className="mt-8 pt-6 border-t border-border flex justify-center">
            <p className="text-center text-sm text-muted-foreground">
              © {new Date().getFullYear()} Rasika.life. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
};
