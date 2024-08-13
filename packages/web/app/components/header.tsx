import { Menu, X } from 'lucide-react';
import { useState } from 'react';
import { Button } from '~/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '~/components/ui/sheet';

import { ModeToggle } from './mode-toggle';

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

export const Header = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const navLinks = [
    { href: '/', label: 'Home' },
    { href: '/carnatic/songs', label: 'All Songs' },
    { href: '/carnatic/ragas', label: 'All Ragas' },
    { label: 'mode-toggle', component: <ModeToggle /> },
  ];

  return (
    <nav className="shadow-lg sticky top-0 z-50 bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <img
                className="h-8 w-8"
                src="/public/android-chrome-192x192.png"
                alt="Logo"
              />
            </div>
            <div className="hidden md:block">
              <div className="ml-10 flex items-baseline space-x-4">
                {navLinks.map((link) =>
                  link.component ? (
                    <div key={link.label}>{link.component}</div>
                  ) : (
                    <NavLink key={link.label} href={link.href}>
                      {link.label}
                    </NavLink>
                  ),
                )}
              </div>
            </div>
          </div>
          <div className="md:hidden">
            <Sheet open={isSidebarOpen} onOpenChange={setIsSidebarOpen}>
              <SheetTrigger asChild>
                {isSidebarOpen ? (
                  <Button variant="ghost" size="icon">
                    <X className="h-6 w-6" />
                    <span className="sr-only">Close menu</span>
                  </Button>
                ) : (
                  <Button variant="ghost" size="icon">
                    <Menu className="h-6 w-6" />
                    <span className="sr-only">Open menu</span>
                  </Button>
                )}
              </SheetTrigger>
              <SheetContent side="left" className="w-[240px] sm:w-[300px]">
                <nav className="flex flex-col space-y-4 mt-4">
                  {navLinks.map((link) =>
                    link.component ? (
                      <div key={link.label}>{link.component}</div>
                    ) : (
                      <NavLink key={link.label} href={link.href}>
                        {link.label}
                      </NavLink>
                    ),
                  )}
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </nav>
  );
};
