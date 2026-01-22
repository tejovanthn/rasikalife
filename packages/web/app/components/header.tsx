import * as SheetPrimitive from '@radix-ui/react-dialog';
import { Menu, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, NavLink } from 'react-router';
import { Button } from '~/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '~/components/ui/sheet';

import { ModeToggle } from './mode-toggle';

export const Header = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const mobileNavRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (isSidebarOpen && mobileNavRef.current) {
      // Focus the first link when menu opens
      const firstLink = mobileNavRef.current.querySelector('a');
      if (firstLink) {
        firstLink.focus();
      }
    }
  }, [isSidebarOpen]);

  const navLinks = [
    { href: '/', label: 'Home' },
    { href: '/carnatic/compositions', label: 'Compositions' },
    { href: '/carnatic/artists', label: 'Artists' },
    { href: '/carnatic/ragas', label: 'Ragas' },
    { href: '/carnatic/talas', label: 'Talas' },
    { href: '/carnatic/languages', label: 'Languages' },
    { href: '/about', label: 'About' },
  ];

  return (
    <nav className="shadow-lg sticky top-0 z-50 bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 md:h-16">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Link to="/">
                <img
                  className="h-8 w-8"
                  src="/android-chrome-192x192.png"
                  alt="Rasika.life - Indian Classical Music Database"
                />
              </Link>
            </div>
            <div className="hidden md:block">
              <nav className="ml-10 flex items-baseline space-x-4" aria-label="Main navigation">
                {navLinks.map(link => (
                  <NavLink
                    key={link.label}
                    to={link.href}
                    className={({ isActive }) =>
                      `px-3 py-2 rounded-md text-sm font-medium ${
                        isActive
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:text-foreground'
                      }`
                    }
                  >
                    {link.label}
                  </NavLink>
                ))}
                <ModeToggle />
              </nav>
            </div>
          </div>
          <div className="md:hidden">
            <Sheet open={isSidebarOpen} onOpenChange={setIsSidebarOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-11 w-11">
                  {isSidebarOpen ? (
                    <>
                      <X className="h-6 w-6" />
                      <span className="sr-only">Close menu</span>
                    </>
                  ) : (
                    <>
                      <Menu className="h-6 w-6" />
                      <span className="sr-only">Open menu</span>
                    </>
                  )}
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[240px] sm:w-[300px]">
                <SheetHeader>
                  <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
                  <SheetDescription className="sr-only">
                    Main navigation menu for Rasika.life
                  </SheetDescription>
                </SheetHeader>
                <nav
                  ref={mobileNavRef}
                  className="flex flex-col space-y-4 mt-4"
                  aria-label="Main navigation"
                >
                  {navLinks.map(link => (
                    <NavLink
                      key={link.label}
                      to={link.href}
                      onClick={() => setIsSidebarOpen(false)}
                      className={({ isActive }) =>
                        `block px-3 py-2 rounded-md text-base font-medium ${
                          isActive
                            ? 'bg-primary text-primary-foreground'
                            : 'text-muted-foreground hover:text-foreground'
                        }`
                      }
                    >
                      {link.label}
                    </NavLink>
                  ))}
                  <div className="flex items-center justify-between px-3 py-2">
                    <span className="text-base font-medium text-muted-foreground">Theme</span>
                    <ModeToggle />
                  </div>
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </nav>
  );
};
