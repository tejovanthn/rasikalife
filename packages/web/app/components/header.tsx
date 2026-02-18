import * as SheetPrimitive from '@radix-ui/react-dialog';
import { LogOut, Menu, User, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Form, Link, NavLink } from 'react-router';
import { useAuth } from '~/components/auth-context';
import { Button } from '~/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '~/components/ui/sheet';

import { GlobalSearch } from './GlobalSearch';
import { ModeToggle } from './mode-toggle';

export const Header = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const mobileNavRef = useRef<HTMLElement>(null);
  const { user } = useAuth();

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
    { href: '/artists', label: 'Artists' },
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
              </nav>
            </div>
          </div>
          <div className="hidden md:flex items-center space-x-4">
            <GlobalSearch />
            <ModeToggle />
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="flex items-center gap-2 px-2">
                    {user.picture ? (
                      <img src={user.picture} alt={user.name} className="h-8 w-8 rounded-full" />
                    ) : (
                      <User className="h-5 w-5" />
                    )}
                    <span className="hidden lg:inline text-sm font-medium">
                      {user.name.split(' ')[0]}
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <div className="px-2 py-1.5">
                    <p className="text-sm font-medium">{user.name}</p>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/my-edits" className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      My Edits
                    </Link>
                  </DropdownMenuItem>
                  {(user.role === 'moderator' || user.role === 'admin') && (
                    <>
                      <DropdownMenuItem asChild>
                        <Link to="/moderator/edits" className="flex items-center gap-2">
                          <User className="h-4 w-4" />
                          Edit Queue
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link to="/moderator/events" className="flex items-center gap-2">
                          <User className="h-4 w-4" />
                          Event Queue
                        </Link>
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Form method="post" action="/auth/logout" className="w-full">
                      <Button type="submit" variant="outline" className="w-full justify-start">
                        <LogOut className="h-4 w-4 mr-2" />
                        Logout
                      </Button>
                    </Form>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button asChild variant="outline" size="sm">
                <Link to="/auth/login">Login</Link>
              </Button>
            )}
          </div>
          <div className="md:hidden flex items-center space-x-2">
            <GlobalSearch />
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
                  <div className="pt-4 border-t border-border mt-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-base font-medium text-muted-foreground">Theme</span>
                      <ModeToggle />
                    </div>
                    {user ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 px-3">
                          {user.picture ? (
                            <img
                              src={user.picture}
                              alt={user.name}
                              className="h-8 w-8 rounded-full"
                            />
                          ) : (
                            <User className="h-8 w-8 rounded-full bg-muted p-1" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{user.name}</p>
                            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                          </div>
                        </div>
                        <Link
                          to="/my-edits"
                          className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground rounded-md hover:bg-accent"
                          onClick={() => setIsSidebarOpen(false)}
                        >
                          <User className="h-4 w-4" />
                          My Edits
                        </Link>
                        {(user.role === 'moderator' || user.role === 'admin') && (
                          <>
                            <Link
                              to="/moderator/edits"
                              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground rounded-md hover:bg-accent"
                              onClick={() => setIsSidebarOpen(false)}
                            >
                              <User className="h-4 w-4" />
                              Edit Queue
                            </Link>
                            <Link
                              to="/moderator/events"
                              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground rounded-md hover:bg-accent"
                              onClick={() => setIsSidebarOpen(false)}
                            >
                              <User className="h-4 w-4" />
                              Event Queue
                            </Link>
                          </>
                        )}
                        <Form method="post" action="/auth/logout">
                          <Button
                            type="submit"
                            variant="outline"
                            className="w-full justify-start"
                            onClick={() => setIsSidebarOpen(false)}
                          >
                            <LogOut className="h-4 w-4 mr-2" />
                            Logout
                          </Button>
                        </Form>
                      </div>
                    ) : (
                      <Button asChild variant="outline" className="w-full">
                        <Link to="/auth/login" onClick={() => setIsSidebarOpen(false)}>
                          Login with Google
                        </Link>
                      </Button>
                    )}
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
