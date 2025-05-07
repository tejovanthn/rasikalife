const NavLink = ({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) => (
  <a href={href} className="px-3 py-2 rounded-md text-sm font-medium">
    {children}
  </a>
);

export const Footer = () => {
  const navLinks = [
    { href: '/about', label: 'About' },
    { href: '/privacy', label: 'Privacy' },
    { href: '/tos', label: 'Terms' },
    { href: '/contact', label: 'Contact' },
    { href: '/attribution', label: 'Attribution' },
    { href: '/donate', label: 'Donate' },
    { href: '/contribute', label: 'Contribute' },
    { href: '/faq', label: 'FAQ' },
    { href: '/community', label: 'Community' },
    { href: '/accessibility', label: 'Accessibility' },
    { href: '/support', label: 'Support' },
  ];

  return (
    <footer className="bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="py-8">
          <div className="flex flex-wrap justify-center space-x-6">
            {navLinks.map(link => (
              <NavLink key={link.label} href={link.href}>
                {link.label}
              </NavLink>
            ))}
          </div>
          <div className="mt-8 flex justify-center">
            <p className="text-center text-sm text-muted-foreground">
              © {new Date().getFullYear()} Rasika.life. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
};
